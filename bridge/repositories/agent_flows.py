"""Durable SQLite persistence for the independent LangGraph flow surface.

This store intentionally does not reuse Agent Harness operation tables.  A flow
is a resumable user interaction with its own identity binding and event log.
Only JSON-safe state and bounded metadata are persisted; provider payloads and
hidden reasoning never enter this store.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from collections.abc import Callable
from typing import Any


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class AgentFlowStoreError(RuntimeError):
    def __init__(self, code: str, message: str, *, status: int = 409, retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.status = status
        self.retryable = retryable


class AgentFlowStore:
    """Single-host WAL store with atomic start/resume idempotency fences."""

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._connection = sqlite3.connect(str(self.path), check_same_thread=False, isolation_level=None)
        self._connection.row_factory = sqlite3.Row
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute("PRAGMA foreign_keys=ON")
        self._connection.execute("PRAGMA busy_timeout=5000")
        self._migrate()

    def close(self) -> None:
        with self._lock:
            self._connection.close()

    @contextmanager
    def _transaction(self):
        """Run a write transaction explicitly on the autocommit connection."""
        with self._lock:
            self._connection.execute("BEGIN IMMEDIATE")
            try:
                yield
            except BaseException:
                self._connection.rollback()
                raise
            else:
                self._connection.commit()

    def _migrate(self) -> None:
        with self._lock:
            self._connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS agent_flows (
                    flow_id TEXT PRIMARY KEY,
                    start_idempotency_key TEXT NOT NULL UNIQUE,
                    start_payload_digest TEXT NOT NULL,
                    principal TEXT NOT NULL,
                    workspace_id TEXT NOT NULL,
                    document_json TEXT NOT NULL,
                    state_json TEXT NOT NULL,
                    status TEXT NOT NULL,
                    sequence INTEGER NOT NULL,
                    contract_revision TEXT NOT NULL,
                    schema_set_revision TEXT NOT NULL,
                    backend_identity_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    deleted_at TEXT
                );
                CREATE INDEX IF NOT EXISTS agent_flows_principal_idx
                    ON agent_flows(principal, workspace_id, updated_at);
                CREATE TABLE IF NOT EXISTS agent_flow_events (
                    flow_id TEXT NOT NULL,
                    sequence INTEGER NOT NULL,
                    event_id TEXT NOT NULL,
                    event_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY(flow_id, sequence),
                    UNIQUE(flow_id, event_id),
                    FOREIGN KEY(flow_id) REFERENCES agent_flows(flow_id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS agent_flow_resumes (
                    flow_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    payload_digest TEXT NOT NULL,
                    response_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY(flow_id, idempotency_key),
                    FOREIGN KEY(flow_id) REFERENCES agent_flows(flow_id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS agent_flow_authorization_revokes (
                    flow_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    payload_digest TEXT NOT NULL,
                    response_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY(flow_id, idempotency_key),
                    FOREIGN KEY(flow_id) REFERENCES agent_flows(flow_id) ON DELETE CASCADE
                );
                """
            )

    @staticmethod
    def _decode(row: sqlite3.Row | None) -> dict[str, Any] | None:
        if row is None:
            return None
        value = dict(row)
        value["document"] = json.loads(value.pop("document_json"))
        value["state"] = json.loads(value.pop("state_json"))
        value["backend_identity"] = json.loads(value.pop("backend_identity_json"))
        return value

    def get(self, flow_id: str) -> dict[str, Any] | None:
        with self._lock:
            return self._decode(self._connection.execute(
                "SELECT * FROM agent_flows WHERE flow_id=? AND deleted_at IS NULL", (flow_id,)
            ).fetchone())

    def flow_ids_for_run(self, run_id: str) -> list[str]:
        with self._lock:
            rows = self._connection.execute("SELECT flow_id,document_json,state_json FROM agent_flows").fetchall()
            matches = []
            for row in rows:
                if run_id in row["document_json"] or run_id in row["state_json"]:
                    matches.append(str(row["flow_id"]))
            return sorted(set(matches))

    def delete_permanently(self, flow_id: str, *, principal: str | None = None, workspace_id: str | None = None) -> dict[str, Any]:
        """Erase a flow, its events and resume replay records atomically."""
        with self._transaction():
            row = self._connection.execute("SELECT * FROM agent_flows WHERE flow_id=?", (flow_id,)).fetchone()
            if row is None:
                return {"status": "not_found", "store": "flow", "resource_id": flow_id}
            if principal is not None and row["principal"] != principal:
                raise AgentFlowStoreError("principal_mismatch", "Flow does not belong to the caller.", status=403)
            if workspace_id is not None and row["workspace_id"] != workspace_id:
                raise AgentFlowStoreError("workspace_mismatch", "Flow does not belong to the caller workspace.", status=403)
            counts = {
                "agent_flow_authorization_revokes": int(self._connection.execute("DELETE FROM agent_flow_authorization_revokes WHERE flow_id=?", (flow_id,)).rowcount),
                "agent_flow_resumes": int(self._connection.execute("DELETE FROM agent_flow_resumes WHERE flow_id=?", (flow_id,)).rowcount),
                "agent_flow_events": int(self._connection.execute("DELETE FROM agent_flow_events WHERE flow_id=?", (flow_id,)).rowcount),
                "agent_flows": int(self._connection.execute("DELETE FROM agent_flows WHERE flow_id=?", (flow_id,)).rowcount),
            }
            return {"status": "deleted", "store": "flow", "resource_id": flow_id, "deleted_rows": counts}

    def get_start_replay(
        self,
        idempotency_key: str,
        payload_digest: str,
        *,
        principal: str,
        workspace_id: str,
    ) -> dict[str, Any] | None:
        """Return an already-created start without executing the graph again.

        The service calls this before entering either the deterministic graph
        or an optional LangGraph runtime.  ``create`` remains the durable
        final fence for a process race, while this read path prevents an exact
        retry from invoking a runtime whose work may have side effects.
        """
        with self._lock:
            row = self._connection.execute(
                "SELECT * FROM agent_flows WHERE start_idempotency_key=? AND deleted_at IS NULL",
                (idempotency_key,),
            ).fetchone()
        if row is None:
            return None
        existing = self._decode(row)
        if existing["principal"] != principal or existing["workspace_id"] != workspace_id:
            raise AgentFlowStoreError(
                "flow_access_denied",
                "Idempotency-Key belongs to another principal and workspace.",
                status=403,
            )
        if existing["start_payload_digest"] != payload_digest:
            raise AgentFlowStoreError(
                "idempotency_payload_mismatch",
                "Idempotency-Key was already used with a different flow payload.",
            )
        return existing

    def create(
        self,
        *,
        flow_id: str,
        idempotency_key: str,
        payload_digest: str,
        document: dict[str, Any],
        state: dict[str, Any],
        status: str,
        principal: str,
        workspace_id: str,
        contract_revision: str,
        schema_set_revision: str,
        backend_identity: dict[str, Any],
        event: dict[str, Any],
    ) -> tuple[dict[str, Any], bool]:
        now = utc_now()
        with self._transaction():
            existing_row = self._connection.execute(
                "SELECT * FROM agent_flows WHERE start_idempotency_key=? AND deleted_at IS NULL",
                (idempotency_key,),
            ).fetchone()
            if existing_row is not None:
                existing = self._decode(existing_row)
                if existing["principal"] != principal or existing["workspace_id"] != workspace_id:
                    raise AgentFlowStoreError("flow_access_denied", "Idempotency-Key belongs to another principal and workspace.", status=403)
                if existing["start_payload_digest"] != payload_digest:
                    raise AgentFlowStoreError("idempotency_payload_mismatch", "Idempotency-Key was already used with a different flow payload.")
                return existing, True
            try:
                self._connection.execute(
                    "INSERT INTO agent_flows(flow_id,start_idempotency_key,start_payload_digest,principal,workspace_id,document_json,state_json,status,sequence,contract_revision,schema_set_revision,backend_identity_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (flow_id, idempotency_key, payload_digest, principal, workspace_id,
                     json.dumps(document, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
                     json.dumps(state, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
                     status, int(event.get("sequence", 0)), contract_revision, schema_set_revision,
                     json.dumps(backend_identity, ensure_ascii=False, sort_keys=True, separators=(",", ":")), now, now),
                )
            except sqlite3.IntegrityError as error:
                raise AgentFlowStoreError("flow_store_conflict", "Flow could not be durably created; retry with a fresh idempotency key.", status=503, retryable=True) from error
            self._append_event_locked(flow_id, event, now=now)
            return self.get(flow_id), False  # type: ignore[return-value]

    def update(
        self,
        flow_id: str,
        *,
        state: dict[str, Any],
        status: str,
        event: dict[str, Any],
    ) -> dict[str, Any]:
        now = utc_now()
        with self._transaction():
            row = self._connection.execute("SELECT sequence FROM agent_flows WHERE flow_id=? AND deleted_at IS NULL", (flow_id,)).fetchone()
            if row is None:
                raise AgentFlowStoreError("flow_not_found", "Flow was not found.", status=404)
            expected = int(row["sequence"]) + 1
            if int(event.get("sequence", -1)) != expected:
                raise AgentFlowStoreError("event_out_of_order", "Flow event sequence must increase by one.")
            self._connection.execute(
                "UPDATE agent_flows SET state_json=?,status=?,sequence=?,updated_at=? WHERE flow_id=?",
                (json.dumps(state, ensure_ascii=False, sort_keys=True, separators=(",", ":")), status, expected, now, flow_id),
            )
            self._append_event_locked(flow_id, event, now=now)
            return self.get(flow_id)  # type: ignore[return-value]

    def transition_resume(
        self,
        flow_id: str,
        idempotency_key: str,
        payload_digest: str,
        *,
        state: dict[str, Any],
        status: str,
        event: dict[str, Any],
        response_factory: Callable[[dict[str, Any]], dict[str, Any]],
    ) -> tuple[dict[str, Any], bool]:
        """Atomically apply a resume transition and record its replay response.

        The idempotency row and flow event/state update must share one SQLite
        transaction.  Reserving a key in one transaction and writing the
        transition in a later transaction allows concurrent resumes to race,
        and a crash between the two commits would lose the replay response.
        """
        now = utc_now()
        with self._transaction():
            replay_row = self._connection.execute(
                "SELECT payload_digest,response_json FROM agent_flow_resumes WHERE flow_id=? AND idempotency_key=?",
                (flow_id, idempotency_key),
            ).fetchone()
            if replay_row is not None:
                if replay_row["payload_digest"] != payload_digest:
                    raise AgentFlowStoreError(
                        "idempotency_payload_mismatch",
                        "Resume Idempotency-Key was already used with a different payload.",
                    )
                return json.loads(replay_row["response_json"]), True

            row = self._connection.execute(
                "SELECT sequence,state_json FROM agent_flows WHERE flow_id=? AND deleted_at IS NULL",
                (flow_id,),
            ).fetchone()
            if row is None:
                raise AgentFlowStoreError("flow_not_found", "Flow was not found.", status=404)
            current_state = json.loads(row["state_json"])
            # A revoke is an authorization boundary, not merely a UI state.
            # Re-check it inside the same write transaction so a resume that
            # passed its service-level read fence cannot commit after a
            # concurrent revocation.
            if current_state.get("authorization_digest") and current_state.get("authorization_status", "active") != "active":
                raise AgentFlowStoreError(
                    "authorization_inactive",
                    "Flow authorization is no longer active.",
                    status=409,
                )
            expected = int(row["sequence"]) + 1
            if int(event.get("sequence", -1)) != expected:
                raise AgentFlowStoreError(
                    "event_out_of_order",
                    "Flow event sequence must increase by one.",
                )
            self._connection.execute(
                "UPDATE agent_flows SET state_json=?,status=?,sequence=?,updated_at=? WHERE flow_id=?",
                (
                    json.dumps(state, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
                    status,
                    expected,
                    now,
                    flow_id,
                ),
            )
            self._append_event_locked(flow_id, event, now=now)
            record = self._decode(
                self._connection.execute(
                    "SELECT * FROM agent_flows WHERE flow_id=? AND deleted_at IS NULL",
                    (flow_id,),
                ).fetchone()
            )
            if record is None:  # pragma: no cover - protected by the row above
                raise AgentFlowStoreError("flow_not_found", "Flow was not found.", status=404)
            response = response_factory(record)
            self._connection.execute(
                "INSERT INTO agent_flow_resumes(flow_id,idempotency_key,payload_digest,response_json,created_at) VALUES(?,?,?,?,?)",
                (
                    flow_id,
                    idempotency_key,
                    payload_digest,
                    json.dumps(response, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
                    now,
                ),
            )
            return response, False

    def transition_authorization_revoke(
        self,
        flow_id: str,
        idempotency_key: str,
        payload_digest: str,
        *,
        state: dict[str, Any],
        status: str,
        event: dict[str, Any],
        response_factory: Callable[[dict[str, Any]], dict[str, Any]],
    ) -> tuple[dict[str, Any], bool]:
        """Atomically revoke a flow authorization and record its replay.

        Revocation is a separate mutation family from user resume actions.  A
        dedicated replay table prevents a revoke key from colliding with a
        resume key while keeping the state update, event, and response replay
        in one SQLite transaction.  The active-status check is deliberately
        inside the transaction so two callers cannot both append a revoke
        event or race a resume transition around the same authorization.
        """

        now = utc_now()
        with self._transaction():
            replay_row = self._connection.execute(
                "SELECT payload_digest,response_json FROM agent_flow_authorization_revokes WHERE flow_id=? AND idempotency_key=?",
                (flow_id, idempotency_key),
            ).fetchone()
            if replay_row is not None:
                if replay_row["payload_digest"] != payload_digest:
                    raise AgentFlowStoreError(
                        "idempotency_payload_mismatch",
                        "Authorization revoke Idempotency-Key was already used with a different payload.",
                    )
                return json.loads(replay_row["response_json"]), True

            row = self._connection.execute(
                "SELECT * FROM agent_flows WHERE flow_id=? AND deleted_at IS NULL",
                (flow_id,),
            ).fetchone()
            if row is None:
                raise AgentFlowStoreError("flow_not_found", "Flow was not found.", status=404)
            current_state = json.loads(row["state_json"])
            if current_state.get("authorization_status", "active") != "active":
                raise AgentFlowStoreError(
                    "authorization_inactive",
                    "Flow authorization is no longer active.",
                    status=409,
                )
            expected = int(row["sequence"]) + 1
            if int(event.get("sequence", -1)) != expected:
                raise AgentFlowStoreError("event_out_of_order", "Flow event sequence must increase by one.")
            self._connection.execute(
                "UPDATE agent_flows SET state_json=?,status=?,sequence=?,updated_at=? WHERE flow_id=? AND deleted_at IS NULL",
                (
                    json.dumps(state, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
                    status,
                    expected,
                    now,
                    flow_id,
                ),
            )
            self._append_event_locked(flow_id, event, now=now)
            record = self._decode(
                self._connection.execute(
                    "SELECT * FROM agent_flows WHERE flow_id=? AND deleted_at IS NULL",
                    (flow_id,),
                ).fetchone()
            )
            if record is None:  # pragma: no cover - protected by the row above
                raise AgentFlowStoreError("flow_not_found", "Flow was not found.", status=404)
            response = response_factory(record)
            self._connection.execute(
                "INSERT INTO agent_flow_authorization_revokes(flow_id,idempotency_key,payload_digest,response_json,created_at) VALUES(?,?,?,?,?)",
                (
                    flow_id,
                    idempotency_key,
                    payload_digest,
                    json.dumps(response, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
                    now,
                ),
            )
            return response, False

    def _append_event_locked(self, flow_id: str, event: dict[str, Any], *, now: str) -> None:
        sequence = int(event["sequence"])
        event_id = str(event.get("event_id") or f"{flow_id}:{sequence}")
        value = {**event, "event_id": event_id, "flow_id": flow_id}
        try:
            self._connection.execute(
                "INSERT INTO agent_flow_events(flow_id,sequence,event_id,event_json,created_at) VALUES(?,?,?,?,?)",
                (flow_id, sequence, event_id, json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")), now),
            )
        except sqlite3.IntegrityError as error:
            # A second resume can pass the service-level read fence after the
            # first caller commits, but still carry the same next sequence.
            # The event primary key is the final durable fence; expose a
            # contract error instead of leaking sqlite3.IntegrityError or
            # leaving the HTTP worker with an unhandled exception.
            raise AgentFlowStoreError(
                "event_out_of_order",
                "Flow event sequence or identity already exists.",
                status=409,
            ) from error

    def events(self, flow_id: str, *, after_sequence: int = 0) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._connection.execute(
                "SELECT event_json FROM agent_flow_events WHERE flow_id=? AND sequence>? ORDER BY sequence ASC",
                (flow_id, after_sequence),
            ).fetchall()
            return [json.loads(row["event_json"]) for row in rows]

    def has_event(self, flow_id: str, sequence: int) -> bool:
        with self._lock:
            return self._connection.execute(
                "SELECT 1 FROM agent_flow_events WHERE flow_id=? AND sequence=?", (flow_id, sequence)
            ).fetchone() is not None

    def resume_record(self, flow_id: str, idempotency_key: str, payload_digest: str, response: dict[str, Any] | None = None) -> tuple[dict[str, Any] | None, bool]:
        with self._transaction():
            row = self._connection.execute(
                "SELECT payload_digest,response_json FROM agent_flow_resumes WHERE flow_id=? AND idempotency_key=?",
                (flow_id, idempotency_key),
            ).fetchone()
            if row is not None:
                if row["payload_digest"] != payload_digest:
                    raise AgentFlowStoreError("idempotency_payload_mismatch", "Resume Idempotency-Key was already used with a different payload.")
                return json.loads(row["response_json"]), True
            if response is None:
                return None, False
            self._connection.execute(
                "INSERT INTO agent_flow_resumes(flow_id,idempotency_key,payload_digest,response_json,created_at) VALUES(?,?,?,?,?)",
                (flow_id, idempotency_key, payload_digest, json.dumps(response, ensure_ascii=False, sort_keys=True, separators=(",", ":")), utc_now()),
            )
            return response, False

    def get_resume_record(
        self,
        flow_id: str,
        idempotency_key: str,
        payload_digest: str,
    ) -> tuple[dict[str, Any] | None, bool]:
        """Read a completed resume replay without reserving the key.

        This fast path preserves idempotent replay for terminal flows.  New
        transitions still use :meth:`transition_resume`, which rechecks the
        row while holding the write transaction to fence concurrent callers.
        """
        with self._lock:
            row = self._connection.execute(
                "SELECT payload_digest,response_json FROM agent_flow_resumes WHERE flow_id=? AND idempotency_key=?",
                (flow_id, idempotency_key),
            ).fetchone()
            if row is None:
                return None, False
            if row["payload_digest"] != payload_digest:
                raise AgentFlowStoreError(
                    "idempotency_payload_mismatch",
                    "Resume Idempotency-Key was already used with a different payload.",
                )
            return json.loads(row["response_json"]), True
    def get_authorization_revoke_record(
        self,
        flow_id: str,
        idempotency_key: str,
        payload_digest: str,
    ) -> tuple[dict[str, Any] | None, bool]:
        """Read a completed authorization revoke replay without reserving it."""

        with self._lock:
            row = self._connection.execute(
                "SELECT payload_digest,response_json FROM agent_flow_authorization_revokes WHERE flow_id=? AND idempotency_key=?",
                (flow_id, idempotency_key),
            ).fetchone()
            if row is None:
                return None, False
            if row["payload_digest"] != payload_digest:
                raise AgentFlowStoreError(
                    "idempotency_payload_mismatch",
                    "Authorization revoke Idempotency-Key was already used with a different payload.",
                )
            return json.loads(row["response_json"]), True
