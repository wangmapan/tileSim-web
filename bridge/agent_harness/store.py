"""SQLite WAL durable store for Agent Harness state.

This is intentionally a single-process/single-host MVP.  It provides atomic
commits and recovery semantics, but does not claim distributed HA scheduling.
Only identity, digest, status and bounded error summaries are stored.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .contracts import (
    CONTRACT_REVISION, HarnessContractError, POLICY_REVISION, SCHEMA_IDENTITIES,
    TERMINAL_STATES, canonical_sha256, operation_identity, utc_now,
)
from .stage2 import APPROVAL_STATUSES, DRAFT_STATUSES

MIGRATION_VERSION = 3


class HarnessStoreError(RuntimeError):
    def __init__(self, code: str, message: str, *, retryable: bool = False, unknown_outcome: bool = False, field_path: str | None = None):
        super().__init__(message)
        self.code = code
        self.retryable = retryable
        self.unknown_outcome = unknown_outcome
        # Store failures are not tied to a request field in every case.  The
        # root pointer is nevertheless a valid, stable RFC 6901 location and
        # keeps the published error envelope machine-addressable.
        self.field_path = field_path or "/"


class DurableHarnessStore:
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

    def _migrate(self) -> None:
        with self._lock:
            self._connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY,
                    applied_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS operations (
                    operation_id TEXT PRIMARY KEY,
                    idempotency_key TEXT NOT NULL UNIQUE,
                    request_digest TEXT NOT NULL,
                    document_json TEXT NOT NULL,
                    state TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    cancellation_fence TEXT,
                    lease_json TEXT,
                    attempt_count INTEGER NOT NULL DEFAULT 0,
                    last_error_json TEXT,
                    retention_expires_at TEXT,
                    deleted_at TEXT
                );
                CREATE INDEX IF NOT EXISTS operations_state_idx ON operations(state);
                CREATE TABLE IF NOT EXISTS events (
                    operation_id TEXT NOT NULL,
                    event_id TEXT NOT NULL,
                    sequence INTEGER NOT NULL,
                    parent_event_id TEXT,
                    state TEXT NOT NULL,
                    node TEXT NOT NULL,
                    payload_digest TEXT NOT NULL,
                    terminal INTEGER NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    schema_identity TEXT NOT NULL,
                    contract_revision TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    draft_id TEXT,
                    approval_id TEXT,
                    PRIMARY KEY(operation_id, event_id),
                    UNIQUE(operation_id, sequence),
                    FOREIGN KEY(operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS checkpoints (
                    checkpoint_id TEXT PRIMARY KEY,
                    operation_id TEXT NOT NULL,
                    state_digest TEXT NOT NULL,
                    last_event_sequence INTEGER NOT NULL,
                    side_effect_digests_json TEXT NOT NULL,
                    resume_policy_json TEXT NOT NULL,
                    schema_set_revision TEXT NOT NULL,
                    backend_identity_json TEXT NOT NULL,
                    policy_revision TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    valid INTEGER NOT NULL DEFAULT 1,
                    FOREIGN KEY(operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS tool_calls (
                    tool_call_id TEXT PRIMARY KEY,
                    operation_id TEXT NOT NULL,
                    tool_name TEXT NOT NULL,
                    tool_revision TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    input_digest TEXT NOT NULL,
                    permission_decision TEXT NOT NULL,
                    outcome TEXT,
                    output_digest TEXT,
                    error_code TEXT,
                    retryable INTEGER,
                    terminal_failure INTEGER,
                    unknown_outcome INTEGER,
                    created_at TEXT NOT NULL,
                    finished_at TEXT,
                    FOREIGN KEY(operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE
                );
                CREATE UNIQUE INDEX IF NOT EXISTS tool_calls_idem_idx ON tool_calls(operation_id, idempotency_key);
                CREATE TABLE IF NOT EXISTS approvals (
                    approval_digest TEXT PRIMARY KEY,
                    operation_id TEXT NOT NULL,
                    draft_digest TEXT NOT NULL,
                    principal TEXT NOT NULL,
                    approved_at TEXT,
                    expires_at TEXT NOT NULL,
                    decision TEXT NOT NULL,
                    schema_set_revision TEXT NOT NULL,
                    policy_revision TEXT NOT NULL,
                    backend_identity_json TEXT NOT NULL,
                    FOREIGN KEY(operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS side_effects (
                    operation_id TEXT NOT NULL,
                    command_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    command_digest TEXT NOT NULL,
                    target_identity TEXT NOT NULL,
                    status TEXT NOT NULL,
                    result_identity TEXT,
                    unknown_outcome INTEGER NOT NULL DEFAULT 0,
                    started_at TEXT NOT NULL,
                    finished_at TEXT,
                    policy_revision TEXT NOT NULL,
                    PRIMARY KEY(operation_id, command_id),
                    UNIQUE(operation_id, idempotency_key),
                    FOREIGN KEY(operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS stage2_drafts (
                    draft_id TEXT PRIMARY KEY,
                    idempotency_key TEXT NOT NULL UNIQUE,
                    operation_id TEXT NOT NULL,
                    draft_digest TEXT NOT NULL,
                    document_json TEXT NOT NULL,
                    status TEXT NOT NULL,
                    principal TEXT NOT NULL,
                    workspace_id TEXT NOT NULL,
                    input_snapshot_digest TEXT NOT NULL,
                    schema_set_revision TEXT NOT NULL,
                    backend_identity_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    deleted_at TEXT,
                    FOREIGN KEY(operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS stage2_drafts_owner_idx ON stage2_drafts(principal, workspace_id);
                CREATE TABLE IF NOT EXISTS stage2_validations (
                    validation_id TEXT PRIMARY KEY,
                    draft_id TEXT NOT NULL,
                    draft_digest TEXT NOT NULL,
                    report_json TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(draft_id) REFERENCES stage2_drafts(draft_id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS stage2_validation_actions (
                    draft_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    payload_digest TEXT NOT NULL,
                    validation_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY(draft_id, idempotency_key),
                    FOREIGN KEY(draft_id) REFERENCES stage2_drafts(draft_id) ON DELETE CASCADE,
                    FOREIGN KEY(validation_id) REFERENCES stage2_validations(validation_id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS stage2_approvals (
                    approval_id TEXT PRIMARY KEY,
                    idempotency_key TEXT NOT NULL UNIQUE,
                    draft_id TEXT NOT NULL,
                    draft_digest TEXT NOT NULL,
                    validation_id TEXT NOT NULL,
                    approval_digest TEXT NOT NULL UNIQUE,
                    document_json TEXT NOT NULL,
                    status TEXT NOT NULL,
                    principal TEXT NOT NULL,
                    workspace_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    consumed INTEGER NOT NULL DEFAULT 0,
                    deleted_at TEXT,
                    FOREIGN KEY(draft_id) REFERENCES stage2_drafts(draft_id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS stage2_approvals_draft_idx ON stage2_approvals(draft_id);
                CREATE TABLE IF NOT EXISTS stage2_approval_actions (
                    approval_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    payload_digest TEXT NOT NULL,
                    action TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY(approval_id, idempotency_key),
                    FOREIGN KEY(approval_id) REFERENCES stage2_approvals(approval_id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS stage3_executions (
                    execution_id TEXT PRIMARY KEY,
                    operation_id TEXT NOT NULL UNIQUE,
                    idempotency_key TEXT NOT NULL UNIQUE,
                    draft_id TEXT NOT NULL,
                    approval_id TEXT NOT NULL,
                    validation_id TEXT NOT NULL,
                    draft_digest TEXT NOT NULL,
                    approval_digest TEXT NOT NULL,
                    input_snapshot_digest TEXT NOT NULL,
                    schema_set_revision TEXT NOT NULL,
                    backend_identity_json TEXT NOT NULL,
                    policy_revision TEXT NOT NULL,
                    workflow_revision TEXT NOT NULL,
                    request_digest TEXT NOT NULL,
                    request_json TEXT NOT NULL,
                    document_json TEXT NOT NULL,
                    state TEXT NOT NULL,
                    run_id TEXT,
                    result_json TEXT,
                    error_json TEXT,
                    retryable INTEGER NOT NULL DEFAULT 0,
                    unknown_outcome INTEGER NOT NULL DEFAULT 0,
                    cancellation_fence TEXT,
                    attempt_count INTEGER NOT NULL DEFAULT 0,
                    principal TEXT NOT NULL,
                    workspace_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS stage3_executions_state_idx ON stage3_executions(state);
                """
            )
            version = self._connection.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0] or 0
            columns = {row["name"] for row in self._connection.execute("PRAGMA table_info(events)").fetchall()}
            if "idempotency_key" not in columns:
                self._connection.execute("ALTER TABLE events ADD COLUMN idempotency_key TEXT NOT NULL DEFAULT ''")
            if "draft_id" not in columns:
                self._connection.execute("ALTER TABLE events ADD COLUMN draft_id TEXT")
            if "approval_id" not in columns:
                self._connection.execute("ALTER TABLE events ADD COLUMN approval_id TEXT")
            if version < MIGRATION_VERSION:
                self._connection.execute("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)", (MIGRATION_VERSION, utc_now()))

    @staticmethod
    def _json(value: Any) -> str:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)

    @staticmethod
    def _decode(value: str | None, default: Any = None) -> Any:
        if value is None:
            return default
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default

    def _row_document(self, row: sqlite3.Row) -> dict[str, Any]:
        document = self._decode(row["document_json"], {})
        document["workflow_state"] = row["state"]
        document["updated_at"] = row["updated_at"]
        document["attempt_count"] = row["attempt_count"]
        document["last_error"] = self._decode(row["last_error_json"])
        document["cancellation_fence"] = row["cancellation_fence"]
        document["lease"] = self._decode(row["lease_json"], document.get("lease"))
        document["retention"] = {"expires_at": row["retention_expires_at"], "deleted_at": row["deleted_at"]}
        return document

    def get_operation(self, operation_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute("SELECT * FROM operations WHERE operation_id=? AND deleted_at IS NULL", (operation_id,)).fetchone()
            return self._row_document(row) if row else None

    def get_by_idempotency(self, key: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute("SELECT * FROM operations WHERE idempotency_key=? AND deleted_at IS NULL", (key,)).fetchone()
            return self._row_document(row) if row else None

    def create_operation(self, *, idempotency_key: str, request_payload: Any, schema_set_revision: str,
                         backend_identity: Any, run_id: str | None = None, snapshot_digest: str | None = None,
                         principal: str = "anonymous", operation_kind: str = "read_only",
                         operation_id: str | None = None, turn_id: str | None = None) -> tuple[dict[str, Any], bool]:
        digest = canonical_sha256(request_payload)
        with self._lock:
            self._connection.execute("BEGIN IMMEDIATE")
            try:
                existing = self._connection.execute("SELECT * FROM operations WHERE idempotency_key=? AND deleted_at IS NULL", (idempotency_key,)).fetchone()
                if existing:
                    document = self._row_document(existing)
                    if existing["request_digest"] != digest:
                        raise HarnessStoreError("idempotency_payload_mismatch", "Idempotency key is bound to another canonical payload.")
                    self._connection.execute("COMMIT")
                    return document, True
                operation_id = operation_id or f"op-{uuid.uuid4().hex}"
                turn_id = turn_id or f"turn-{uuid.uuid4().hex}"
                document = operation_identity(operation_id=operation_id, turn_id=turn_id, schema_set_revision=schema_set_revision,
                                              backend_identity=backend_identity, run_id=run_id, snapshot_digest=snapshot_digest,
                                              idempotency_key=idempotency_key, request_digest=digest,
                                              operation_kind=operation_kind, principal=principal, state="queued")
                self._connection.execute(
                    "INSERT INTO operations(operation_id,idempotency_key,request_digest,document_json,state,created_at,updated_at,cancellation_fence,lease_json,attempt_count,last_error_json,retention_expires_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL)",
                    (operation_id, idempotency_key, digest, self._json(document), "queued", document["created_at"], document["updated_at"], None, self._json(document["lease"]), 0, None, None),
                )
                self._connection.execute("COMMIT")
                return document, False
            except Exception:
                self._connection.execute("ROLLBACK")
                raise

    def transition(self, operation_id: str, state: str, *, error: dict[str, Any] | None = None,
                   expected: set[str] | None = None, cancellation_fence: str | None = None) -> dict[str, Any]:
        if state not in {"queued", "running", "retrying", "waiting_tool", "waiting_approval", "completed", "failed", "cancelled", "recovery_required", "manual_intervention_required", "submitted", "draft", "preparing", "waiting_artifacts", "cancel_requested"}:
            raise HarnessStoreError("invalid_workflow_state", "Unknown workflow state.")
        with self._lock:
            self._connection.execute("BEGIN IMMEDIATE")
            try:
                row = self._connection.execute("SELECT * FROM operations WHERE operation_id=? AND deleted_at IS NULL", (operation_id,)).fetchone()
                if not row:
                    raise HarnessStoreError("operation_not_found", "Operation was not found.")
                old = row["state"]
                if expected and old not in expected:
                    raise HarnessStoreError("state_conflict", "Operation state changed concurrently.")
                resumable_transitions = {
                    ("failed", "retrying"),
                    ("recovery_required", "queued"),
                }
                if old in TERMINAL_STATES and state != old and (old, state) not in resumable_transitions:
                    raise HarnessStoreError("terminal_mutation", "Terminal operation cannot be mutated.")
                if old == "recovery_required" and state not in {"recovery_required", "queued", "cancelled"}:
                    raise HarnessStoreError("recovery_required", "Recovery must be explicitly resumed or cancelled before another transition.")
                if old == "cancelled" and state != "cancelled":
                    raise HarnessStoreError("cancelled_late_result", "Cancellation fence rejects late results.")
                updated = utc_now()
                fence = cancellation_fence if state == "cancelled" else row["cancellation_fence"]
                self._connection.execute("UPDATE operations SET state=?,updated_at=?,last_error_json=?,cancellation_fence=? WHERE operation_id=?", (state, updated, self._json(error) if error else row["last_error_json"], fence, operation_id))
                self._connection.execute("COMMIT")
                return self.get_operation(operation_id) or {}
            except Exception:
                self._connection.execute("ROLLBACK")
                raise

    def bind_operation_run(self, operation_id: str, run_id: str | None) -> dict[str, Any]:
        """Durably bind the generic operation snapshot to its Bridge run."""
        with self._lock, self._connection:
            row = self._connection.execute("SELECT * FROM operations WHERE operation_id=? AND deleted_at IS NULL", (operation_id,)).fetchone()
            if row is None:
                raise HarnessStoreError("operation_not_found", "Operation was not found.")
            document = self._row_document(row)
            document["run_id"] = run_id
            document["updated_at"] = utc_now()
            self._connection.execute("UPDATE operations SET document_json=?,updated_at=? WHERE operation_id=?", (self._json(document), document["updated_at"], operation_id))
        return self.get_operation(operation_id) or {}

    def claim_lease(self, operation_id: str, *, worker_id: str, visibility_timeout_seconds: float) -> dict[str, Any]:
        with self._lock, self._connection:
            row = self._connection.execute("SELECT * FROM operations WHERE operation_id=? AND deleted_at IS NULL", (operation_id,)).fetchone()
            if not row:
                raise HarnessStoreError("operation_not_found", "Operation was not found.")
            if row["state"] in TERMINAL_STATES:
                raise HarnessStoreError("terminal_mutation", "Terminal operation cannot acquire a lease.")
            now = utc_now()
            visibility = (datetime.now(timezone.utc) + timedelta(seconds=max(1.0, visibility_timeout_seconds))).isoformat()
            lease = {"worker_id": worker_id, "leased_at": now, "heartbeat_at": now, "visibility_timeout_at": visibility}
            self._connection.execute("UPDATE operations SET lease_json=?,updated_at=?,attempt_count=attempt_count+1 WHERE operation_id=?", (self._json(lease), now, operation_id))
        return self.get_operation(operation_id) or {}

    def heartbeat(self, operation_id: str, *, worker_id: str, visibility_timeout_seconds: float) -> dict[str, Any]:
        with self._lock, self._connection:
            row = self._connection.execute("SELECT * FROM operations WHERE operation_id=? AND deleted_at IS NULL", (operation_id,)).fetchone()
            if not row:
                raise HarnessStoreError("operation_not_found", "Operation was not found.")
            lease = self._decode(row["lease_json"], {})
            if lease.get("worker_id") != worker_id:
                raise HarnessStoreError("lease_not_owned", "Worker lease is not owned by this worker.")
            now = utc_now()
            lease["heartbeat_at"] = now
            lease["visibility_timeout_at"] = (datetime.now(timezone.utc) + timedelta(seconds=max(1.0, visibility_timeout_seconds))).isoformat()
            self._connection.execute("UPDATE operations SET lease_json=?,updated_at=? WHERE operation_id=?", (self._json(lease), now, operation_id))
        return self.get_operation(operation_id) or {}

    def release_lease(self, operation_id: str, *, worker_id: str) -> dict[str, Any]:
        with self._lock, self._connection:
            row = self._connection.execute("SELECT * FROM operations WHERE operation_id=? AND deleted_at IS NULL", (operation_id,)).fetchone()
            if not row:
                raise HarnessStoreError("operation_not_found", "Operation was not found.")
            lease = self._decode(row["lease_json"], {})
            if lease.get("worker_id") not in {None, worker_id}:
                raise HarnessStoreError("lease_not_owned", "Worker lease is not owned by this worker.")
            self._connection.execute("UPDATE operations SET lease_json=? WHERE operation_id=?", (self._json({"worker_id": None, "leased_at": None, "heartbeat_at": None, "visibility_timeout_at": None}), operation_id))
        return self.get_operation(operation_id) or {}

    def list_operations(self, *, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._connection.execute("SELECT * FROM operations WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ?", (max(1, min(limit, 200)),)).fetchall()
            return [self._row_document(row) for row in rows]

    def append_event(self, operation_id: str, *, event_id: str, sequence: int, node: str, state: str,
                     payload_digest: str, parent_event_id: str | None = None, terminal: bool = False,
                     idempotency_key: str | None = None, draft_id: str | None = None,
                     approval_id: str | None = None, schema_identity: str | None = None,
                     contract_revision: str | None = None) -> dict[str, Any]:
        with self._lock:
            self._connection.execute("BEGIN IMMEDIATE")
            try:
                op = self._connection.execute("SELECT * FROM operations WHERE operation_id=? AND deleted_at IS NULL", (operation_id,)).fetchone()
                if not op:
                    raise HarnessStoreError("operation_not_found", "Operation was not found.")
                duplicate = self._connection.execute("SELECT * FROM events WHERE operation_id=? AND event_id=?", (operation_id, event_id)).fetchone()
                if duplicate:
                    if duplicate["payload_digest"] != payload_digest or duplicate["sequence"] != sequence:
                        raise HarnessStoreError("event_conflict", "Event identity is already bound to another payload.")
                    self._connection.execute("COMMIT")
                    return self._event_document(duplicate)
                last = self._connection.execute("SELECT MAX(sequence) FROM events WHERE operation_id=?", (operation_id,)).fetchone()[0] or 0
                if sequence != last + 1:
                    raise HarnessStoreError("event_out_of_order", "Event sequence must be strictly monotonic.", retryable=False)
                if op["state"] in TERMINAL_STATES and state != op["state"]:
                    code = "cancelled_late_result" if op["state"] == "cancelled" else "terminal_mutation"
                    raise HarnessStoreError(code, "No event may overwrite a terminal operation.")
                created = utc_now()
                self._connection.execute("INSERT INTO events(operation_id,event_id,sequence,parent_event_id,state,node,payload_digest,terminal,idempotency_key,schema_identity,contract_revision,created_at,draft_id,approval_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (operation_id,event_id,sequence,parent_event_id,state,node,payload_digest,1 if terminal else 0,idempotency_key or event_id,schema_identity or SCHEMA_IDENTITIES["workflow_event"],contract_revision or CONTRACT_REVISION,created,draft_id,approval_id))
                self._connection.execute("COMMIT")
                return self.get_event(operation_id, event_id) or {}
            except sqlite3.IntegrityError as error:
                self._connection.execute("ROLLBACK")
                raise HarnessStoreError("event_out_of_order", str(error))
            except Exception:
                self._connection.execute("ROLLBACK")
                raise

    def get_event(self, operation_id: str, event_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute("SELECT * FROM events WHERE operation_id=? AND event_id=?", (operation_id, event_id)).fetchone()
            return self._event_document(row) if row else None

    def _event_document(self, row: sqlite3.Row) -> dict[str, Any]:
        operation = self.get_operation(row["operation_id"]) or {}
        execution = self.get_stage3_by_operation(row["operation_id"])
        return {
            "schema_identity": row["schema_identity"], "contract_revision": row["contract_revision"],
            "operation_id": row["operation_id"], "turn_id": operation.get("turn_id"), "run_id": operation.get("run_id"),
            "snapshot_digest": operation.get("snapshot_digest"), "workflow_state": row["state"],
            # ``state`` is the successor execution-event field.  Keep
            # ``workflow_state`` for the published WP-A workflow-event shape.
            "state": row["state"],
            "schema_set_revision": operation.get("schema_set_revision"), "policy_revision": operation.get("policy_revision"),
            "backend_identity": operation.get("backend_identity"), "created_at": row["created_at"], "updated_at": row["created_at"],
            "event_id": row["event_id"], "sequence": row["sequence"], "parent_event_id": row["parent_event_id"],
            "node": row["node"], "payload_digest": row["payload_digest"], "terminal": bool(row["terminal"]),
            "idempotency_key": row["idempotency_key"],
            "draft_id": row["draft_id"], "approval_id": row["approval_id"],
            "execution_id": execution.get("execution_id") if execution else None,
            "retryable": execution.get("retryable", False) if execution else False,
        }

    def list_events(self, operation_id: str, *, after_sequence: int = 0) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._connection.execute("SELECT * FROM events WHERE operation_id=? AND sequence>? ORDER BY sequence", (operation_id, after_sequence)).fetchall()
            return [self._event_document(row) for row in rows]

    def save_checkpoint(self, operation_id: str, *, checkpoint_id: str, state_digest: str, last_event_sequence: int,
                        side_effect_digests: list[str], resume_policy: dict[str, Any], schema_set_revision: str,
                        backend_identity: Any) -> dict[str, Any]:
        with self._lock:
            op = self.get_operation(operation_id)
            if not op:
                raise HarnessStoreError("operation_not_found", "Operation was not found.")
            if op.get("workflow_state") in TERMINAL_STATES:
                raise HarnessStoreError("terminal_mutation", "A terminal operation cannot receive a checkpoint.")
            checkpoint = {"schema_identity": SCHEMA_IDENTITIES["checkpoint"], "contract_revision": CONTRACT_REVISION,
                          "operation_id": operation_id, "turn_id": op["turn_id"], "run_id": op.get("run_id"),
                          "snapshot_digest": op.get("snapshot_digest"), "workflow_state": op["workflow_state"],
                          "schema_set_revision": schema_set_revision, "policy_revision": POLICY_REVISION,
                          "backend_identity": backend_identity, "created_at": utc_now(), "updated_at": utc_now(),
                          "checkpoint_id": checkpoint_id, "state_digest": state_digest, "last_event_sequence": last_event_sequence,
                          "side_effect_digests": side_effect_digests, "resume_policy": resume_policy}
            with self._connection:
                self._connection.execute("INSERT OR REPLACE INTO checkpoints(checkpoint_id,operation_id,state_digest,last_event_sequence,side_effect_digests_json,resume_policy_json,schema_set_revision,backend_identity_json,policy_revision,created_at,valid) VALUES(?,?,?,?,?,?,?,?,?,?,1)", (checkpoint_id,operation_id,state_digest,last_event_sequence,self._json(side_effect_digests),self._json(resume_policy),schema_set_revision,self._json(backend_identity),POLICY_REVISION,checkpoint["created_at"]))
                self._connection.execute("UPDATE operations SET document_json=?,updated_at=? WHERE operation_id=?", (self._json({**op,"checkpoint_id":checkpoint_id}),utc_now(),operation_id))
            return checkpoint

    def get_checkpoint(self, checkpoint_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute("SELECT * FROM checkpoints WHERE checkpoint_id=? AND valid=1", (checkpoint_id,)).fetchone()
            if not row:
                return None
            operation = self.get_operation(row["operation_id"]) or {}
            return {"schema_identity": SCHEMA_IDENTITIES["checkpoint"], "contract_revision": CONTRACT_REVISION,
                    "operation_id": row["operation_id"], "turn_id": operation.get("turn_id"), "run_id": operation.get("run_id"),
                    "snapshot_digest": operation.get("snapshot_digest"), "workflow_state": operation.get("workflow_state"),
                    "schema_set_revision": row["schema_set_revision"], "policy_revision": row["policy_revision"],
                    "backend_identity": self._decode(row["backend_identity_json"], {}), "created_at": row["created_at"], "updated_at": row["created_at"],
                    "checkpoint_id": row["checkpoint_id"], "state_digest": row["state_digest"], "last_event_sequence": row["last_event_sequence"],
                    "side_effect_digests": self._decode(row["side_effect_digests_json"], []), "resume_policy": self._decode(row["resume_policy_json"], {}), "valid": True}

    def record_tool_call(self, *, operation_id: str, tool_call_id: str, tool_name: str, tool_revision: str,
                         idempotency_key: str, input_digest: str, permission_decision: str) -> dict[str, Any] | None:
        with self._lock:
            existing = self._connection.execute("SELECT * FROM tool_calls WHERE operation_id=? AND idempotency_key=?", (operation_id, idempotency_key)).fetchone()
            if existing:
                if existing["input_digest"] != input_digest:
                    raise HarnessStoreError("idempotency_payload_mismatch", "Tool idempotency key is bound to another input.")
                return dict(existing)
            created = utc_now()
            with self._connection:
                self._connection.execute("INSERT INTO tool_calls(tool_call_id,operation_id,tool_name,tool_revision,idempotency_key,input_digest,permission_decision,created_at) VALUES(?,?,?,?,?,?,?,?)", (tool_call_id,operation_id,tool_name,tool_revision,idempotency_key,input_digest,permission_decision,created))
            return None

    def finish_tool_call(self, *, tool_call_id: str, outcome: str, output_digest: str | None = None, error_code: str | None = None,
                         retryable: bool = False, terminal_failure: bool = False, unknown_outcome: bool = False) -> dict[str, Any]:
        with self._lock, self._connection:
            self._connection.execute("UPDATE tool_calls SET outcome=?,output_digest=?,error_code=?,retryable=?,terminal_failure=?,unknown_outcome=?,finished_at=? WHERE tool_call_id=?", (outcome, output_digest, error_code, int(retryable), int(terminal_failure), int(unknown_outcome), utc_now(), tool_call_id))
            row = self._connection.execute("SELECT * FROM tool_calls WHERE tool_call_id=?", (tool_call_id,)).fetchone()
            if not row:
                raise HarnessStoreError("tool_call_not_found", "Tool call was not found.")
            return dict(row)

    def record_side_effect(self, *, operation_id: str, command_id: str, idempotency_key: str, command_digest: str,
                           target_identity: str, policy_revision: str = POLICY_REVISION) -> dict[str, Any] | None:
        with self._lock:
            existing = self._connection.execute("SELECT * FROM side_effects WHERE operation_id=? AND idempotency_key=?", (operation_id, idempotency_key)).fetchone()
            if existing:
                if existing["command_digest"] != command_digest:
                    raise HarnessStoreError("idempotency_payload_mismatch", "Side-effect key is bound to another command.")
                return dict(existing)
            with self._connection:
                self._connection.execute("INSERT INTO side_effects(operation_id,command_id,idempotency_key,command_digest,target_identity,status,unknown_outcome,started_at,policy_revision) VALUES(?,?,?,?,?,?,?,?,?)", (operation_id,command_id,idempotency_key,command_digest,target_identity,"started",0,utc_now(),policy_revision))
            return None

    def finish_side_effect(self, *, operation_id: str, command_id: str, status: str, result_identity: str | None = None,
                           unknown_outcome: bool = False) -> dict[str, Any]:
        if status not in {"succeeded", "failed", "unknown"}:
            raise HarnessStoreError("invalid_side_effect_state", "Unknown side-effect state.")
        with self._lock, self._connection:
            self._connection.execute("UPDATE side_effects SET status=?,result_identity=?,unknown_outcome=?,finished_at=? WHERE operation_id=? AND command_id=?", (status,result_identity,int(unknown_outcome),utc_now(),operation_id,command_id))
            row = self._connection.execute("SELECT * FROM side_effects WHERE operation_id=? AND command_id=?", (operation_id,command_id)).fetchone()
            if not row:
                raise HarnessStoreError("side_effect_not_found", "Side effect was not found.")
            return dict(row)

    def list_side_effects(self, operation_id: str) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(row) for row in self._connection.execute("SELECT * FROM side_effects WHERE operation_id=? ORDER BY started_at", (operation_id,)).fetchall()]

    def save_approval(self, *, operation_id: str, approval_digest: str, draft_digest: str, principal: str,
                      approved_at: str | None, expires_at: str, decision: str, schema_set_revision: str,
                      backend_identity: Any, policy_revision: str = POLICY_REVISION) -> dict[str, Any]:
        with self._lock, self._connection:
            self._connection.execute("INSERT OR REPLACE INTO approvals(approval_digest,operation_id,draft_digest,principal,approved_at,expires_at,decision,schema_set_revision,policy_revision,backend_identity_json) VALUES(?,?,?,?,?,?,?,?,?,?)", (approval_digest,operation_id,draft_digest,principal,approved_at,expires_at,decision,schema_set_revision,policy_revision,self._json(backend_identity)))
        operation = self.get_operation(operation_id) or {}
        timestamp = utc_now()
        return {"schema_identity": SCHEMA_IDENTITIES["approval"], "contract_revision": CONTRACT_REVISION,
                "operation_id": operation_id, "turn_id": operation.get("turn_id"), "run_id": operation.get("run_id"),
                "snapshot_digest": operation.get("snapshot_digest"), "workflow_state": operation.get("workflow_state"),
                "schema_set_revision": schema_set_revision, "policy_revision": policy_revision,
                "backend_identity": backend_identity, "created_at": timestamp, "updated_at": timestamp,
                "approval_digest": approval_digest, "draft_digest": draft_digest, "principal": principal,
                "approved_at": approved_at, "expires_at": expires_at, "decision": decision}

    def get_approval(self, approval_digest: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute("SELECT * FROM approvals WHERE approval_digest=?", (approval_digest,)).fetchone()
            if not row:
                return None
            operation = self.get_operation(row["operation_id"]) or {}
            return {"schema_identity": SCHEMA_IDENTITIES["approval"], "contract_revision": CONTRACT_REVISION,
                    "operation_id": row["operation_id"], "turn_id": operation.get("turn_id"), "run_id": operation.get("run_id"),
                    "snapshot_digest": operation.get("snapshot_digest"), "workflow_state": operation.get("workflow_state"),
                    "schema_set_revision": row["schema_set_revision"], "policy_revision": row["policy_revision"],
                    "backend_identity": self._decode(row["backend_identity_json"], {}), "created_at": operation.get("created_at"), "updated_at": operation.get("updated_at"),
                    "approval_digest": row["approval_digest"], "draft_digest": row["draft_digest"], "principal": row["principal"],
                    "approved_at": row["approved_at"], "expires_at": row["expires_at"], "decision": row["decision"]}

    def validate_approval(self, approval_digest: str, *, draft_digest: str, principal: str,
                          schema_set_revision: str, backend_identity: Any, now_iso: str | None = None) -> dict[str, Any]:
        approval = self.get_approval(approval_digest)
        if approval is None:
            raise HarnessStoreError("approval_not_found", "Approval was not found.")
        if approval["decision"] != "approved":
            raise HarnessStoreError("approval_rejected", "Approval is not approved.")
        if approval["draft_digest"] != draft_digest:
            raise HarnessStoreError("stale_draft", "Approval does not bind the requested draft.")
        if approval["principal"] != principal:
            raise HarnessStoreError("principal_mismatch", "Approval principal does not match.")
        if approval["schema_set_revision"] != schema_set_revision:
            raise HarnessStoreError("schema_revision_mismatch", "Approval schema-set revision is stale.")
        if approval["policy_revision"] != POLICY_REVISION or approval["backend_identity"] != backend_identity:
            raise HarnessStoreError("approval_stale", "Approval policy or backend identity is stale.")
        if (now_iso or utc_now()) >= approval["expires_at"]:
            raise HarnessStoreError("approval_expired", "Approval has expired.")
        return approval

    def recover_incomplete(self) -> list[dict[str, Any]]:
        """Fail closed after a process restart; no unknown side effect is retried."""
        with self._lock, self._connection:
            rows = self._connection.execute("SELECT operation_id FROM operations WHERE state IN ('running','retrying','waiting_tool','preparing','waiting_artifacts','cancel_requested') AND deleted_at IS NULL").fetchall()
            for row in rows:
                side = self._connection.execute("SELECT COUNT(*) AS count_unknown FROM side_effects WHERE operation_id=? AND (status='unknown' OR unknown_outcome=1)", (row["operation_id"],)).fetchone()
                unknown = bool(side and side["count_unknown"])
                error = {"code": "bridge_restart_recovery_required", "retryable": False, "unknown_outcome": unknown}
                self._connection.execute("UPDATE operations SET state='recovery_required',updated_at=?,last_error_json=? WHERE operation_id=?", (utc_now(), self._json(error), row["operation_id"]))
                self._connection.execute("UPDATE stage3_executions SET state='recovery_required',updated_at=?,error_json=?,unknown_outcome=? WHERE operation_id=?", (utc_now(), self._json(error), int(unknown), row["operation_id"]))
        return self.list_operations()

    def recover_expired_leases(self, *, now_iso: str | None = None) -> int:
        now_iso = now_iso or utc_now()
        changed = 0
        with self._lock, self._connection:
            rows = self._connection.execute("SELECT operation_id,lease_json FROM operations WHERE state IN ('running','retrying','waiting_tool','preparing','waiting_artifacts','cancel_requested') AND deleted_at IS NULL").fetchall()
            for row in rows:
                lease = self._decode(row["lease_json"], {})
                if lease.get("visibility_timeout_at") and lease["visibility_timeout_at"] <= now_iso:
                    self._connection.execute("UPDATE operations SET state='recovery_required',updated_at=?,last_error_json=? WHERE operation_id=?", (now_iso, self._json({"code": "worker_visibility_timeout", "retryable": False, "unknown_outcome": True}), row["operation_id"]))
                    changed += 1
        return changed

    def delete_operation(self, operation_id: str) -> bool:
        with self._lock:
            row = self._connection.execute("SELECT operation_id FROM operations WHERE operation_id=? AND deleted_at IS NULL", (operation_id,)).fetchone()
            if not row:
                return False
            timestamp = utc_now()
            with self._connection:
                self._connection.execute(
                    "UPDATE operations SET document_json=?,last_error_json=NULL,deleted_at=?,updated_at=? WHERE operation_id=?",
                    (self._json({"operation_id": operation_id, "deleted_at": timestamp}), timestamp, timestamp, operation_id),
                )
                self._connection.execute(
                    "UPDATE stage3_executions SET request_json='{}',document_json='{}',result_json=NULL,error_json=NULL,updated_at=? WHERE operation_id=?",
                    (timestamp, operation_id),
                )
            return True

    def purge_expired(self, *, now_iso: str | None = None) -> int:
        now_iso = now_iso or utc_now()
        with self._lock, self._connection:
            rows = self._connection.execute("SELECT operation_id FROM operations WHERE retention_expires_at IS NOT NULL AND retention_expires_at<? AND deleted_at IS NULL", (now_iso,)).fetchall()
            for row in rows:
                self._connection.execute("UPDATE operations SET deleted_at=?,updated_at=? WHERE operation_id=?", (now_iso,now_iso,row["operation_id"]))
            return len(rows)

    # ---- Stage-2 draft / validation / approval persistence -----------------
    @staticmethod
    def _stage2_document(row: sqlite3.Row) -> dict[str, Any]:
        return json.loads(row["document_json"])

    def save_stage2_draft(self, document: dict[str, Any], *, operation_id: str,
                          idempotency_key: str, draft_digest: str) -> tuple[dict[str, Any], bool]:
        with self._lock:
            self._connection.execute("BEGIN IMMEDIATE")
            try:
                row = self._connection.execute("SELECT * FROM stage2_drafts WHERE idempotency_key=? AND deleted_at IS NULL", (idempotency_key,)).fetchone()
                if row:
                    if row["draft_digest"] != draft_digest:
                        raise HarnessStoreError("idempotency_payload_mismatch", "Idempotency key is bound to another draft payload.")
                    self._connection.execute("COMMIT")
                    return self._stage2_document(row), True
                self._connection.execute("INSERT INTO stage2_drafts(draft_id,idempotency_key,operation_id,draft_digest,document_json,status,principal,workspace_id,input_snapshot_digest,schema_set_revision,backend_identity_json,created_at,expires_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)", (document["draft_id"], idempotency_key, operation_id, draft_digest, self._json(document), document["status"], document["principal"], document["workspace_id"], document["input_snapshot_digest"], document["schema_set_revision"], self._json(document["backend_identity"]), document["created_at"], document["expires_at"]))
                self._connection.execute("COMMIT")
                return document, False
            except Exception:
                self._connection.execute("ROLLBACK")
                raise

    def get_stage2_draft(self, draft_id: str, *, include_deleted: bool = False) -> dict[str, Any] | None:
        with self._lock:
            query = "SELECT * FROM stage2_drafts WHERE draft_id=?" + ("" if include_deleted else " AND deleted_at IS NULL")
            row = self._connection.execute(query, (draft_id,)).fetchone()
            if not row:
                return None
            document = self._stage2_document(row)
            document["status"] = row["status"]
            if row["deleted_at"]:
                document["status"] = "deleted"
            elif document.get("expires_at", "") <= utc_now() and document["status"] in {"draft", "validated"}:
                document["status"] = "expired"
                with self._connection:
                    self._connection.execute("UPDATE stage2_drafts SET status='expired',deleted_at=? WHERE draft_id=?", (utc_now(), draft_id))
                    self._connection.execute("UPDATE stage2_approvals SET status='expired',deleted_at=? WHERE draft_id=? AND status IN ('pending','approved')", (utc_now(), draft_id))
            return document

    def save_stage2_validation(self, report: dict[str, Any], *, idempotency_key: str | None = None,
                                payload_digest: str | None = None) -> tuple[dict[str, Any], bool]:
        """Persist a validation report and its replay fence atomically."""
        with self._lock:
            self._connection.execute("BEGIN IMMEDIATE")
            try:
                if idempotency_key is not None and payload_digest is not None:
                    action = self._connection.execute(
                        "SELECT payload_digest,validation_id FROM stage2_validation_actions WHERE draft_id=? AND idempotency_key=?",
                        (report["draft_id"], idempotency_key),
                    ).fetchone()
                    if action:
                        if action["payload_digest"] != payload_digest:
                            raise HarnessStoreError("idempotency_payload_mismatch", "Idempotency key is bound to another validation payload.")
                        row = self._connection.execute("SELECT report_json FROM stage2_validations WHERE validation_id=?", (action["validation_id"],)).fetchone()
                        if row is None:
                            raise HarnessStoreError("validation_not_found", "Validation replay record is unavailable.")
                        self._connection.execute("COMMIT")
                        return self._decode(row["report_json"]), True
                self._connection.execute("INSERT INTO stage2_validations(validation_id,draft_id,draft_digest,report_json,status,created_at) VALUES(?,?,?,?,?,?)", (report["validation_id"], report["draft_id"], report["draft_digest"], self._json(report), report["status"], report["created_at"]))
                self._connection.execute("UPDATE stage2_drafts SET status=? WHERE draft_id=? AND deleted_at IS NULL", ("validated" if report["status"] == "valid" else report["status"], report["draft_id"]))
                self._connection.execute("UPDATE stage2_approvals SET status='stale' WHERE draft_id=? AND validation_id<>? AND status IN ('pending','approved') AND deleted_at IS NULL", (report["draft_id"], report["validation_id"]))
                if idempotency_key is not None and payload_digest is not None:
                    self._connection.execute("INSERT INTO stage2_validation_actions(draft_id,idempotency_key,payload_digest,validation_id,created_at) VALUES(?,?,?,?,?)", (report["draft_id"], idempotency_key, payload_digest, report["validation_id"], utc_now()))
                self._connection.execute("COMMIT")
                return report, False
            except Exception:
                self._connection.execute("ROLLBACK")
                raise

    def get_stage2_validation(self, validation_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute("SELECT report_json FROM stage2_validations WHERE validation_id=?", (validation_id,)).fetchone()
            return self._decode(row["report_json"]) if row else None

    def latest_stage2_validation(self, draft_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute("SELECT report_json FROM stage2_validations WHERE draft_id=? ORDER BY created_at DESC LIMIT 1", (draft_id,)).fetchone()
            return self._decode(row["report_json"]) if row else None

    def save_stage2_approval(self, document: dict[str, Any], *, idempotency_key: str) -> tuple[dict[str, Any], bool]:
        with self._lock:
            self._connection.execute("BEGIN IMMEDIATE")
            try:
                row = self._connection.execute("SELECT * FROM stage2_approvals WHERE idempotency_key=? AND deleted_at IS NULL", (idempotency_key,)).fetchone()
                if row:
                    existing = self._stage2_document(row)
                    if existing.get("approval_digest") != document.get("approval_digest"):
                        raise HarnessStoreError("idempotency_payload_mismatch", "Idempotency key is bound to another approval payload.")
                    self._connection.execute("COMMIT")
                    return existing, True
                self._connection.execute("INSERT INTO stage2_approvals(approval_id,idempotency_key,draft_id,draft_digest,validation_id,approval_digest,document_json,status,principal,workspace_id,created_at,expires_at,consumed,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0,NULL)", (document["approval_id"], idempotency_key, document["draft_id"], document["draft_digest"], document["validation_id"], document["approval_digest"], self._json(document), document["status"], document["principal"], document["workspace_id"], document["created_at"], document["expires_at"]))
                self._connection.execute("COMMIT")
                return document, False
            except Exception:
                self._connection.execute("ROLLBACK")
                raise

    def get_stage2_approval(self, approval_id: str, *, include_deleted: bool = False) -> dict[str, Any] | None:
        with self._lock:
            query = "SELECT * FROM stage2_approvals WHERE approval_id=?" + ("" if include_deleted else " AND deleted_at IS NULL")
            row = self._connection.execute(query, (approval_id,)).fetchone()
            if not row:
                return None
            document = self._stage2_document(row)
            document["status"] = row["status"]
            document["consumed"] = bool(row["consumed"])
            if document["status"] in {"pending", "approved"} and document.get("expires_at", "") <= utc_now():
                document["status"] = "expired"
                with self._connection:
                    self._connection.execute("UPDATE stage2_approvals SET status=?,document_json=? WHERE approval_id=?", ("expired", self._json(document), approval_id))
            return document

    def consume_stage2_approval(self, approval_id: str, *, draft_digest: str, validation_id: str,
                                 principal: str, workspace_id: str, schema_set_revision: str,
                                 backend_identity: Any) -> dict[str, Any]:
        """Future submit gateway fence; deliberately not exposed as an HTTP endpoint in stage 2."""
        with self._lock:
            self._connection.execute("BEGIN IMMEDIATE")
            try:
                row = self._connection.execute("SELECT * FROM stage2_approvals WHERE approval_id=? AND deleted_at IS NULL", (approval_id,)).fetchone()
                if row is None:
                    raise HarnessStoreError("approval_not_found", "Approval was not found.")
                approval = self._stage2_document(row)
                approval["status"] = row["status"]
                approval["consumed"] = bool(row["consumed"])
                if approval["status"] != "approved":
                    code = "approval_expired" if approval["status"] == "expired" else "approval_not_approved"
                    raise HarnessStoreError(code, "Approval is not approved.")
                for key, expected in (("draft_digest", draft_digest), ("validation_id", validation_id), ("principal", principal), ("workspace_id", workspace_id), ("schema_set_revision", schema_set_revision), ("backend_identity", backend_identity)):
                    if approval.get(key) != expected:
                        raise HarnessStoreError("approval_stale", "Approval binding is stale.")
                if approval.get("single_use") and approval.get("consumed"):
                    raise HarnessStoreError("approval_replay", "Single-use approval has already been consumed.")
                if approval.get("expires_at", "") <= utc_now():
                    self._connection.execute("UPDATE stage2_approvals SET status='expired',document_json=? WHERE approval_id=?", (self._json({**approval, "status": "expired"}), approval_id))
                    raise HarnessStoreError("approval_expired", "Approval has expired.")
                if approval.get("single_use"):
                    document = {**approval, "consumed": True}
                    self._connection.execute("UPDATE stage2_approvals SET consumed=1,document_json=? WHERE approval_id=?", (self._json(document), approval_id))
                    approval = document
                self._connection.execute("COMMIT")
                return approval
            except Exception:
                self._connection.execute("ROLLBACK")
                raise

    # ---- Stage-3 controlled execution persistence -------------------------
    @staticmethod
    def _stage3_document(row: sqlite3.Row) -> dict[str, Any]:
        document = json.loads(row["document_json"])
        document["state"] = row["state"]
        document["run_id"] = row["run_id"]
        document["result"] = DurableHarnessStore._decode(row["result_json"])
        document["error"] = DurableHarnessStore._decode(row["error_json"])
        document["retryable"] = bool(row["retryable"])
        document["unknown_outcome"] = bool(row["unknown_outcome"])
        document["cancellation_fence"] = row["cancellation_fence"]
        document["attempt_count"] = row["attempt_count"]
        document["updated_at"] = row["updated_at"]
        return document

    def get_stage3_execution(self, execution_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT stage3_executions.* FROM stage3_executions JOIN operations USING(operation_id) WHERE stage3_executions.execution_id=? AND operations.deleted_at IS NULL",
                (execution_id,),
            ).fetchone()
            return self._stage3_document(row) if row else None

    def get_stage3_by_operation(self, operation_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT stage3_executions.* FROM stage3_executions JOIN operations USING(operation_id) WHERE stage3_executions.operation_id=? AND operations.deleted_at IS NULL",
                (operation_id,),
            ).fetchone()
            return self._stage3_document(row) if row else None

    def get_stage3_by_idempotency(self, idempotency_key: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT stage3_executions.* FROM stage3_executions JOIN operations USING(operation_id) WHERE stage3_executions.idempotency_key=? AND operations.deleted_at IS NULL",
                (idempotency_key,),
            ).fetchone()
            return self._stage3_document(row) if row else None

    def get_stage3_request(self, execution_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute("SELECT request_json FROM stage3_executions WHERE execution_id=?", (execution_id,)).fetchone()
            return self._decode(row["request_json"], {}) if row else None

    def save_stage3_execution(self, document: dict[str, Any], *, request_payload: dict[str, Any]) -> tuple[dict[str, Any], bool]:
        with self._lock:
            self._connection.execute("BEGIN IMMEDIATE")
            try:
                row = self._connection.execute("SELECT * FROM stage3_executions WHERE idempotency_key=?", (document["idempotency_key"],)).fetchone()
                if row:
                    existing = self._stage3_document(row)
                    if row["request_digest"] != document["request_digest"]:
                        raise HarnessStoreError("payload_conflict", "Execution idempotency key is bound to another payload.")
                    self._connection.execute("COMMIT")
                    return existing, True
                self._connection.execute(
                    "INSERT INTO stage3_executions(execution_id,operation_id,idempotency_key,draft_id,approval_id,validation_id,draft_digest,approval_digest,input_snapshot_digest,schema_set_revision,backend_identity_json,policy_revision,workflow_revision,request_digest,request_json,document_json,state,run_id,result_json,error_json,retryable,unknown_outcome,cancellation_fence,attempt_count,principal,workspace_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (document["execution_id"], document["operation_id"], document["idempotency_key"], document["draft_id"], document["approval_id"], document["validation_id"], document["draft_digest"], document["approval_digest"], document["input_snapshot_digest"], document["schema_set_revision"], self._json(document["backend_identity"]), document["policy_revision"], document["workflow_revision"], document["request_digest"], self._json(request_payload), self._json(document), document["state"], None, None, None, 0, 0, None, 0, document["principal"], document["workspace_id"], document["created_at"], document["updated_at"]),
                )
                self._connection.execute("COMMIT")
                return document, False
            except Exception:
                self._connection.execute("ROLLBACK")
                raise

    def update_stage3_execution(self, execution_id: str, *, state: str | None = None, run_id: str | None = None,
                                result: dict[str, Any] | None = None, error: dict[str, Any] | None = None,
                                retryable: bool | None = None, unknown_outcome: bool | None = None,
                                cancellation_fence: str | None = None, increment_attempt: bool = False,
                                clear_error: bool = False) -> dict[str, Any]:
        fields: list[str] = ["updated_at=?"]
        values: list[Any] = [utc_now()]
        if state is not None:
            fields.append("state=?"); values.append(state)
        if run_id is not None:
            fields.append("run_id=?"); values.append(run_id)
        if result is not None:
            fields.append("result_json=?"); values.append(self._json(result))
        if error is not None:
            fields.append("error_json=?"); values.append(self._json(error))
        elif clear_error:
            fields.append("error_json=NULL")
        if retryable is not None:
            fields.append("retryable=?"); values.append(int(retryable))
        if unknown_outcome is not None:
            fields.append("unknown_outcome=?"); values.append(int(unknown_outcome))
        if cancellation_fence is not None:
            fields.append("cancellation_fence=?"); values.append(cancellation_fence)
        if increment_attempt:
            fields.append("attempt_count=attempt_count+1")
        values.append(execution_id)
        with self._lock, self._connection:
            current_row = self._connection.execute("SELECT state,cancellation_fence FROM stage3_executions WHERE execution_id=?", (execution_id,)).fetchone()
            if current_row is None:
                raise HarnessStoreError("execution_not_found", "Execution operation was not found.")
            current_state = current_row["state"]
            terminal_states = {"completed", "failed", "cancelled", "manual_intervention_required"}
            resumable_transitions = {("failed", "retrying"), ("recovery_required", "queued")}
            if state is not None and current_state in terminal_states and state != current_state and (current_state, state) not in resumable_transitions:
                code = "cancelled_late_result" if current_state == "cancelled" else "terminal_mutation"
                raise HarnessStoreError(code, "No execution update may overwrite a terminal state.")
            if state is not None and current_row["cancellation_fence"] and state != "cancelled":
                raise HarnessStoreError("cancelled_late_result", "Cancellation fence rejects a late execution result.")
            if current_state == "cancelled" and (run_id is not None or result is not None or error is not None):
                raise HarnessStoreError("cancelled_late_result", "Cancellation fence rejects a late execution result.")
            self._connection.execute(f"UPDATE stage3_executions SET {', '.join(fields)} WHERE execution_id=?", values)
            row = self._connection.execute("SELECT * FROM stage3_executions WHERE execution_id=?", (execution_id,)).fetchone()
            if row is None:
                raise HarnessStoreError("execution_not_found", "Execution operation was not found.")
            return self._stage3_document(row)

    def transition_stage2_approval(self, approval_id: str, status: str, *, reason: str | None = None) -> dict[str, Any]:
        if status not in APPROVAL_STATUSES - {"pending"}:
            raise HarnessStoreError("invalid_approval_state", "Approval transition is not supported.")
        with self._lock:
            row = self._connection.execute("SELECT * FROM stage2_approvals WHERE approval_id=? AND deleted_at IS NULL", (approval_id,)).fetchone()
            if not row:
                raise HarnessStoreError("approval_not_found", "Approval was not found.")
            current = row["status"]
            if current in {"rejected", "revoked", "expired", "stale"}:
                raise HarnessStoreError("approval_terminal", "Approval is already terminal.")
            document = self._stage2_document(row)
            timestamp = utc_now()
            document["status"] = status
            document["reason"] = reason
            if status == "approved": document["approved_at"] = timestamp
            if status == "rejected": document["rejected_at"] = timestamp
            if status == "revoked": document["revoked_at"] = timestamp
            with self._connection:
                self._connection.execute("UPDATE stage2_approvals SET status=?,document_json=? WHERE approval_id=?", (status, self._json(document), approval_id))
            return document

    def record_stage2_approval_action(self, approval_id: str, *, idempotency_key: str,
                                      payload_digest: str, action: str) -> bool:
        with self._lock, self._connection:
            row = self._connection.execute("SELECT payload_digest,action FROM stage2_approval_actions WHERE approval_id=? AND idempotency_key=?", (approval_id, idempotency_key)).fetchone()
            if row:
                if row["payload_digest"] != payload_digest or row["action"] != action:
                    raise HarnessStoreError("idempotency_payload_mismatch", "Approval action key is bound to another payload.")
                return True
            self._connection.execute("INSERT INTO stage2_approval_actions(approval_id,idempotency_key,payload_digest,action,created_at) VALUES(?,?,?,?,?)", (approval_id, idempotency_key, payload_digest, action, utc_now()))
            return False

    def delete_stage2_draft(self, draft_id: str) -> bool:
        with self._lock:
            row = self._connection.execute("SELECT draft_id FROM stage2_drafts WHERE draft_id=? AND deleted_at IS NULL", (draft_id,)).fetchone()
            if not row:
                return False
            timestamp = utc_now()
            with self._connection:
                self._connection.execute("UPDATE stage2_drafts SET status='deleted',deleted_at=? WHERE draft_id=?", (timestamp, draft_id))
                self._connection.execute("UPDATE stage2_approvals SET status='stale',deleted_at=? WHERE draft_id=? AND deleted_at IS NULL", (timestamp, draft_id))
            return True

    def purge_stage2_expired(self, *, now_iso: str | None = None) -> int:
        now_iso = now_iso or utc_now()
        with self._lock, self._connection:
            rows = self._connection.execute("SELECT draft_id FROM stage2_drafts WHERE expires_at<? AND deleted_at IS NULL", (now_iso,)).fetchall()
            for row in rows:
                self._connection.execute("UPDATE stage2_drafts SET status='expired',deleted_at=? WHERE draft_id=?", (now_iso, row["draft_id"]))
                self._connection.execute("UPDATE stage2_approvals SET status='expired',deleted_at=? WHERE draft_id=? AND status IN ('pending','approved')", (now_iso, row["draft_id"]))
            self._connection.execute("UPDATE stage2_approvals SET status='expired' WHERE expires_at<? AND status IN ('pending','approved') AND deleted_at IS NULL", (now_iso,))
            return len(rows)
