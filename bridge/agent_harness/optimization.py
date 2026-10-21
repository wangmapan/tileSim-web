"""Local-dev controlled optimization sessions.

The optimizer is intentionally a small, single-host, durable coordinator.  It
does not expose a model, shell, filesystem, URL or provider transport.  A
candidate is immutable once created, every write is idempotent, and execution
is delegated to the published Stage-3 execution endpoint.  When that endpoint
is not available the session fails closed; the optional local proxy evaluator
is explicitly labelled synthetic and is never presented as simulation output.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .contracts import canonical_sha256


CONTRACT_REVISION = "2026-10-19.wpd.v1"
POLICY_REVISION = "tilesim.agent_harness.local_optimization.policy.v1"
TOOL_REGISTRY_REVISION = "2026-10-19.tools.v2"
PROVENANCE = {
    "deployment_mode": "local_dev",
    "source_mode": "synthetic_trace",
    "claim_scope": "exploratory",
    "production_status": "not_for_production",
}
SESSION_STATES = {
    "draft",
    "submitted",
    "queued",
    "running",
    "waiting_tool",
    "waiting_approval",
    "paused",
    "retrying",
    "completed",
    "failed",
    "cancelled",
    "recovery_required",
    "manual_intervention_required",
}
TERMINAL_STATES = {"completed", "failed", "cancelled"}
ACTIVE_STATES = {"submitted", "queued", "running", "waiting_tool", "waiting_approval", "retrying", "paused", "recovery_required"}
ALLOWED_TRANSITIONS = {
    "draft": {"submitted", "cancelled"},
    "submitted": {"queued", "failed", "recovery_required", "cancelled"},
    "queued": {"running", "paused", "failed", "recovery_required", "cancelled"},
    "running": {"waiting_tool", "waiting_approval", "retrying", "completed", "failed", "recovery_required", "paused", "cancelled"},
    "waiting_tool": {"running", "failed", "recovery_required", "paused", "cancelled"},
    "waiting_approval": {"queued", "paused", "cancelled"},
    "retrying": {"running", "queued", "failed", "recovery_required", "cancelled"},
    "paused": {"queued", "waiting_approval", "cancelled"},
    "failed": {"retrying", "waiting_approval", "cancelled"},
    "recovery_required": {"waiting_approval", "manual_intervention_required", "cancelled"},
    "manual_intervention_required": {"cancelled"},
    "completed": set(),
    "cancelled": set(),
}
MAX_ITERATIONS = 20
MAX_RUNS = 20
MAX_FAILURES = 5
MAX_CONCURRENCY = 1
MAX_BUDGET_SECONDS = 60 * 60

SCHEMA_IDENTITIES = {
    "session": "tilesim.agent_harness.optimization_session.v1",
    "candidate": "tilesim.agent_harness.optimization_candidate.v1",
    "objective": "tilesim.agent_harness.optimization_objective.v1",
    "constraint": "tilesim.agent_harness.optimization_constraint.v1",
    "tool_invocation": "tilesim.agent_harness.optimization_tool_invocation.v1",
    "tool_result": "tilesim.agent_harness.optimization_tool_result.v1",
    "iteration": "tilesim.agent_harness.optimization_iteration.v1",
    "evaluation": "tilesim.agent_harness.optimization_evaluation.v1",
    "checkpoint": "tilesim.agent_harness.optimization_checkpoint.v1",
    "stop_reason": "tilesim.agent_harness.optimization_stop_reason.v1",
    "approval": "tilesim.agent_harness.optimization_approval.v1",
    "action": "tilesim.agent_harness.optimization_action.v1",
    "summary": "tilesim.agent_harness.optimization_summary.v1",
    "event": "tilesim.agent_harness.optimization_event.v1",
}

TOOL_REGISTRY = (
    {"name": "get_capability_catalog", "scope": "agent:read_capability", "write": False},
    {"name": "get_draft", "scope": "agent:read_draft", "write": False},
    {"name": "validate_draft", "scope": "agent:write_draft", "write": True},
    {"name": "create_approval", "scope": "agent:approve_draft", "write": True},
    {"name": "submit_execution", "scope": "agent:submit_experiment", "write": True},
    {"name": "get_operation_status", "scope": "agent:read_run", "write": False},
    {"name": "get_operation_events", "scope": "agent:read_run", "write": False},
    {"name": "get_execution_result", "scope": "agent:read_evidence", "write": False},
    {"name": "query_verified_metrics", "scope": "agent:read_evidence", "write": False},
    {"name": "list_run_evidence", "scope": "agent:read_evidence", "write": False},
    {"name": "cancel_execution", "scope": "agent:cancel_experiment", "write": True},
    {"name": "retry_execution", "scope": "agent:retry_experiment", "write": True},
    {"name": "resume_execution", "scope": "agent:resume_experiment", "write": True},
)


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _decode(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


class OptimizationError(RuntimeError):
    def __init__(self, code: str, message: str, *, retryable: bool = False, unknown_outcome: bool = False, field_path: str = "/"):
        super().__init__(message)
        self.code = code
        self.retryable = retryable
        self.unknown_outcome = unknown_outcome
        self.field_path = field_path


def validate_budget(budget: Any) -> dict[str, int]:
    if not isinstance(budget, dict):
        raise OptimizationError("invalid_budget", "Budget must be an object.", field_path="/budget")
    allowed = {"max_iterations", "max_runs", "max_seconds", "max_concurrency", "max_failures"}
    unknown = sorted(set(budget) - allowed)
    if unknown:
        raise OptimizationError("unknown_field", "Budget is closed.", field_path=f"/budget/{unknown[0]}")
    defaults = {"max_iterations": 3, "max_runs": 3, "max_seconds": 900, "max_concurrency": 1, "max_failures": 2}
    result: dict[str, int] = {}
    limits = {"max_iterations": MAX_ITERATIONS, "max_runs": MAX_RUNS, "max_seconds": MAX_BUDGET_SECONDS, "max_concurrency": MAX_CONCURRENCY, "max_failures": MAX_FAILURES}
    for key, default in defaults.items():
        value = budget.get(key, default)
        if not isinstance(value, int) or isinstance(value, bool) or value < 1 or value > limits[key]:
            raise OptimizationError("invalid_budget", f"{key} is outside the local-dev bound.", field_path=f"/budget/{key}")
        result[key] = value
    return result


def validate_session_request(body: dict[str, Any], *, principal: str, workspace_id: str, schema_set_revision: str, backend_identity: Any) -> dict[str, Any]:
    allowed = {"schema_identity", "contract_revision", "session_id", "principal", "workspace_id", "input_snapshot_digest", "schema_set_revision", "backend_identity", "policy_revision", "objective", "constraints", "budget", "base_config", "execution_request", "automatic_submission", "local_dev", "idempotency_key", "expires_at"}
    unknown = sorted(set(body) - allowed)
    if unknown:
        raise OptimizationError("unknown_field", "Optimization session input is closed.", field_path=f"/{unknown[0]}")
    if body.get("schema_identity", SCHEMA_IDENTITIES["session"]) != SCHEMA_IDENTITIES["session"]:
        raise OptimizationError("schema_revision_mismatch", "Optimization session schema identity is stale.", field_path="/schema_identity")
    if body.get("contract_revision", CONTRACT_REVISION) != CONTRACT_REVISION:
        raise OptimizationError("schema_revision_mismatch", "Optimization contract revision is stale.", field_path="/contract_revision")
    if body.get("principal", principal) != principal or body.get("workspace_id", workspace_id) != workspace_id:
        raise OptimizationError("principal_mismatch", "Session principal or workspace does not match the local subject.", field_path="/principal")
    if body.get("schema_set_revision") != schema_set_revision:
        raise OptimizationError("schema_revision_mismatch", "Session schema-set revision is stale.", field_path="/schema_set_revision")
    if body.get("backend_identity") != backend_identity:
        raise OptimizationError("backend_identity_mismatch", "Session backend identity is stale.", field_path="/backend_identity")
    if body.get("policy_revision", POLICY_REVISION) != POLICY_REVISION:
        raise OptimizationError("policy_revision_mismatch", "Session policy revision is stale.", field_path="/policy_revision")
    if body.get("local_dev") is not True:
        raise OptimizationError("local_dev_required", "Stage 4 is only exposed in explicit local-dev mode.", field_path="/local_dev")
    if body.get("automatic_submission") is True:
        raise OptimizationError("approval_required", "Automatic submission is disabled; approve each candidate explicitly.", field_path="/automatic_submission")
    snapshot = body.get("input_snapshot_digest")
    if not isinstance(snapshot, str) or not snapshot.startswith("sha256:"):
        raise OptimizationError("invalid_digest", "input_snapshot_digest must be a sha256 digest.", field_path="/input_snapshot_digest")
    objective = body.get("objective")
    if not isinstance(objective, dict) or not objective.get("metric_path"):
        raise OptimizationError("invalid_objective", "A bounded objective metric_path is required.", field_path="/objective")
    constraint_list = body.get("constraints", [])
    if not isinstance(constraint_list, list) or len(constraint_list) > 32 or any(not isinstance(item, dict) for item in constraint_list):
        raise OptimizationError("invalid_constraint", "constraints must be a bounded list of objects.", field_path="/constraints")
    base_config = body.get("base_config")
    if not isinstance(base_config, dict):
        raise OptimizationError("invalid_candidate", "base_config must be an object.", field_path="/base_config")
    execution_request = body.get("execution_request")
    if execution_request is not None and not isinstance(execution_request, dict):
        raise OptimizationError("invalid_execution_request", "execution_request must be an object when supplied.", field_path="/execution_request")
    budget = validate_budget(body.get("budget", {}))
    return {**body, "schema_identity": SCHEMA_IDENTITIES["session"], "contract_revision": CONTRACT_REVISION, "principal": principal, "workspace_id": workspace_id, "schema_set_revision": schema_set_revision, "backend_identity": backend_identity, "policy_revision": POLICY_REVISION, "budget": budget, "objective": objective, "constraints": constraint_list, "base_config": base_config, "execution_request": execution_request, "local_dev": True, "automatic_submission": False}


def candidate_document(*, session: dict[str, Any], sequence: int, parent_candidate_id: str | None, config: dict[str, Any]) -> dict[str, Any]:
    candidate_id = f"candidate-{uuid.uuid4().hex}"
    candidate_digest = canonical_sha256({"session_id": session["session_id"], "sequence": sequence, "parent_candidate_id": parent_candidate_id, "config": config})
    return {
        "schema_identity": SCHEMA_IDENTITIES["candidate"], "contract_revision": CONTRACT_REVISION,
        "candidate_id": candidate_id, "session_id": session["session_id"], "iteration_id": None,
        "parent_candidate_id": parent_candidate_id, "candidate_digest": candidate_digest,
        "principal": session["principal"], "workspace_id": session["workspace_id"], "snapshot_digest": session["input_snapshot_digest"],
        "schema_set_revision": session["schema_set_revision"], "backend_identity": session["backend_identity"], "policy_revision": POLICY_REVISION,
        "config": config, "diff": {"parent_candidate_id": parent_candidate_id, "changed_fields": sorted(config)},
        "objective_digest": canonical_sha256(session["objective"]), "constraint_digest": canonical_sha256(session["constraints"]),
        "expected_side_effects": ["one bounded Stage-3 execution or an explicit unavailable result"],
        "status": "waiting_approval", "approval_id": None, "approval_digest": None,
        "created_at": now(), "updated_at": now(), "provenance": PROVENANCE,
    }


class OptimizationStore:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.db = sqlite3.connect(str(self.path), check_same_thread=False, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA busy_timeout=5000")
        self.db.executescript("""
        CREATE TABLE IF NOT EXISTS sessions (session_id TEXT PRIMARY KEY, idempotency_key TEXT UNIQUE NOT NULL, principal TEXT NOT NULL, workspace_id TEXT NOT NULL, state TEXT NOT NULL, document_json TEXT NOT NULL, updated_at TEXT NOT NULL, created_at TEXT NOT NULL, current_candidate_id TEXT, current_iteration INTEGER NOT NULL DEFAULT 0, run_count INTEGER NOT NULL DEFAULT 0, failure_count INTEGER NOT NULL DEFAULT 0, deleted_at TEXT);
        CREATE TABLE IF NOT EXISTS candidates (candidate_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, sequence INTEGER NOT NULL, document_json TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(session_id, sequence), UNIQUE(session_id, candidate_id));
        CREATE TABLE IF NOT EXISTS iterations (iteration_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, sequence INTEGER NOT NULL, candidate_id TEXT NOT NULL, state TEXT NOT NULL, document_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(session_id, sequence));
        CREATE TABLE IF NOT EXISTS events (session_id TEXT NOT NULL, event_id TEXT NOT NULL, sequence INTEGER NOT NULL, state TEXT NOT NULL, node TEXT NOT NULL, payload_digest TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(session_id,event_id), UNIQUE(session_id,sequence));
        CREATE TABLE IF NOT EXISTS approvals (approval_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, candidate_id TEXT NOT NULL, approval_digest TEXT UNIQUE NOT NULL, status TEXT NOT NULL, expires_at TEXT NOT NULL, consumed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS tool_calls (invocation_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, iteration_id TEXT, tool_name TEXT NOT NULL, input_digest TEXT NOT NULL, idempotency_key TEXT NOT NULL, outcome TEXT, result_digest TEXT, error_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(session_id,idempotency_key));
        CREATE TABLE IF NOT EXISTS checkpoints (checkpoint_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, state_digest TEXT NOT NULL, last_event_sequence INTEGER NOT NULL, document_json TEXT NOT NULL, created_at TEXT NOT NULL, valid INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS evaluations (evaluation_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, candidate_id TEXT NOT NULL, document_json TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(session_id,candidate_id));
        """)

    def close(self) -> None:
        self.db.close()

    def recover_inflight(self) -> int:
        """Fence sessions whose worker disappeared across a Bridge restart."""
        changed = 0
        with self.lock, self.db:
            rows = self.db.execute("SELECT session_id FROM sessions WHERE deleted_at IS NULL AND state IN ('queued','running','retrying')").fetchall()
            for row in rows:
                session_id = row["session_id"]
                session = self.get(session_id)
                if session is None:
                    continue
                payload = dict(session)
                payload["state"] = "recovery_required"
                payload["status"] = "recovery_required"
                payload["error"] = {"code": "worker_restarted", "unknown_outcome": True}
                payload["updated_at"] = now()
                self.db.execute("UPDATE sessions SET state='recovery_required',document_json=?,updated_at=? WHERE session_id=?", (_json(payload), payload["updated_at"], session_id))
                self._event_locked(session_id, "recovery_required", "restart", canonical_sha256(payload["error"]))
                changed += 1
        return changed

    def _session(self, row: sqlite3.Row | None) -> dict[str, Any] | None:
        if row is None:
            return None
        value = _decode(row["document_json"], {})
        value.update({"session_id": row["session_id"], "state": row["state"], "current_candidate_id": row["current_candidate_id"], "current_iteration": row["current_iteration"], "run_count": row["run_count"], "failure_count": row["failure_count"], "created_at": row["created_at"], "updated_at": row["updated_at"]})
        return value

    def get(self, session_id: str) -> dict[str, Any] | None:
        with self.lock:
            return self._session(self.db.execute("SELECT * FROM sessions WHERE session_id=? AND deleted_at IS NULL", (session_id,)).fetchone())

    def list(self, principal: str, workspace_id: str) -> list[dict[str, Any]]:
        with self.lock:
            return [self._session(row) for row in self.db.execute("SELECT * FROM sessions WHERE principal=? AND workspace_id=? AND deleted_at IS NULL ORDER BY created_at DESC", (principal, workspace_id)).fetchall()]

    def create(self, document: dict[str, Any], *, idempotency_key: str) -> tuple[dict[str, Any], bool]:
        with self.lock, self.db:
            existing = self.db.execute("SELECT * FROM sessions WHERE idempotency_key=? AND deleted_at IS NULL", (idempotency_key,)).fetchone()
            if existing:
                current = self._session(existing)
                if canonical_sha256(current.get("base_config")) != canonical_sha256(document.get("base_config")):
                    raise OptimizationError("idempotency_payload_mismatch", "Idempotency-Key is bound to another optimization session.")
                return current, True
            created = now()
            session_id = document.get("session_id") or f"opt-{uuid.uuid4().hex}"
            value = {**document, "session_id": session_id, "created_at": created, "updated_at": created, "provenance": PROVENANCE, "status": "waiting_approval", "state": "waiting_approval"}
            self.db.execute("INSERT INTO sessions(session_id,idempotency_key,principal,workspace_id,state,document_json,updated_at,created_at,current_candidate_id) VALUES(?,?,?,?,?,?,?,?,NULL)", (session_id, idempotency_key, document["principal"], document["workspace_id"], "waiting_approval", _json(value), created, created))
            candidate = candidate_document(session=value, sequence=0, parent_candidate_id=None, config=document["base_config"])
            self.db.execute("INSERT INTO candidates(candidate_id,session_id,sequence,document_json,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)", (candidate["candidate_id"], session_id, 0, _json(candidate), candidate["status"], created, created))
            self.db.execute("UPDATE sessions SET current_candidate_id=? WHERE session_id=?", (candidate["candidate_id"], session_id))
            value["current_candidate_id"] = candidate["candidate_id"]
            self._event_locked(session_id, "waiting_approval", "candidate", candidate["candidate_digest"])
            return value, False

    def candidate(self, session_id: str, candidate_id: str | None = None) -> dict[str, Any] | None:
        with self.lock:
            row = self.db.execute("SELECT document_json FROM candidates WHERE session_id=? AND candidate_id=COALESCE(?,candidate_id) ORDER BY sequence DESC LIMIT 1", (session_id, candidate_id)).fetchone()
            return _decode(row["document_json"], None) if row else None

    def candidates(self, session_id: str) -> list[dict[str, Any]]:
        with self.lock:
            return [_decode(row["document_json"], {}) for row in self.db.execute("SELECT document_json FROM candidates WHERE session_id=? ORDER BY sequence", (session_id,)).fetchall()]

    def add_candidate(self, session_id: str, candidate: dict[str, Any]) -> dict[str, Any]:
        """Persist one immutable next candidate, rejecting duplicate digests."""
        with self.lock, self.db:
            duplicate = self.db.execute("SELECT document_json FROM candidates WHERE session_id=? AND json_extract(document_json, '$.candidate_digest')=?", (session_id, candidate["candidate_digest"])).fetchone()
            if duplicate:
                return _decode(duplicate["document_json"], candidate)
            row = self.db.execute("SELECT COALESCE(MAX(sequence),-1)+1 AS sequence FROM candidates WHERE session_id=?", (session_id,)).fetchone()
            sequence = int(row["sequence"])
            candidate = {**candidate, "sequence": sequence, "created_at": candidate.get("created_at", now()), "updated_at": now()}
            self.db.execute("INSERT INTO candidates(candidate_id,session_id,sequence,document_json,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)", (candidate["candidate_id"], session_id, sequence, _json(candidate), candidate.get("status", "waiting_approval"), candidate["created_at"], candidate["updated_at"]))
            self.db.execute("UPDATE sessions SET current_candidate_id=?,updated_at=? WHERE session_id=?", (candidate["candidate_id"], candidate["updated_at"], session_id))
            self._event_locked(session_id, "waiting_approval", "candidate", candidate["candidate_digest"])
            return candidate

    def mark_candidate_waiting_approval(self, session_id: str, candidate_id: str) -> None:
        with self.lock, self.db:
            row = self.db.execute("SELECT document_json FROM candidates WHERE candidate_id=? AND session_id=?", (candidate_id, session_id)).fetchone()
            if not row:
                raise OptimizationError("candidate_not_found", "Candidate was not found.")
            candidate = _decode(row["document_json"], {})
            candidate["status"] = "waiting_approval"
            candidate["updated_at"] = now()
            self.db.execute("UPDATE candidates SET document_json=?,status=?,updated_at=? WHERE candidate_id=?", (_json(candidate), "waiting_approval", candidate["updated_at"], candidate_id))

    def reset_candidate_for_retry(self, session_id: str) -> dict[str, Any]:
        with self.lock, self.db:
            session = self.get(session_id)
            candidate = self.candidate(session_id)
            if session is None or candidate is None:
                raise OptimizationError("candidate_not_found", "Candidate was not found.")
            if session.get("state") != "failed":
                raise OptimizationError("retry_not_allowed", "Only a failed optimization may be explicitly retried.")
            if session.get("error", {}).get("unknown_outcome"):
                raise OptimizationError("unknown_outcome", "Unknown outcome cannot be blindly retried.", unknown_outcome=True)
            changed = dict(candidate)
            changed.update({"status": "waiting_approval", "approval_id": None, "approval_digest": None, "updated_at": now()})
            self.db.execute("UPDATE candidates SET document_json=?,status=?,updated_at=? WHERE candidate_id=?", (_json(changed), "waiting_approval", changed["updated_at"], candidate["candidate_id"]))
            self.transition(session_id, "waiting_approval", expected={"failed"})
            return changed

    def consume_approval(self, session_id: str, approval_id: str, *, principal: str, candidate_digest: str) -> dict[str, Any]:
        """Consume the local approval exactly once immediately before submit."""
        with self.lock, self.db:
            row = self.db.execute("SELECT * FROM approvals WHERE approval_id=? AND session_id=?", (approval_id, session_id)).fetchone()
            session = self.get(session_id)
            if row is None or session is None:
                raise OptimizationError("approval_not_found", "Optimization approval was not found.")
            if session.get("principal") != principal:
                raise OptimizationError("principal_mismatch", "Approval principal does not match.")
            if row["candidate_id"] != session.get("current_candidate_id") or row["approval_digest"] != canonical_sha256({"candidate_digest": candidate_digest, "session_id": session_id}):
                raise OptimizationError("approval_stale", "Approval is not bound to the current candidate.")
            if row["consumed"] or row["status"] != "approved":
                raise OptimizationError("approval_replayed", "Approval is single-use and has already been consumed.")
            try:
                expired = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00")) <= datetime.now(timezone.utc)
            except ValueError as error:
                raise OptimizationError("invalid_expiry", "Approval expiry is not ISO-8601.") from error
            if expired:
                self.db.execute("UPDATE approvals SET status='expired',updated_at=? WHERE approval_id=?", (now(), approval_id))
                raise OptimizationError("approval_expired", "Approval has expired.")
            updated = now()
            self.db.execute("UPDATE approvals SET consumed=1,status='consumed',updated_at=? WHERE approval_id=? AND consumed=0", (updated, approval_id))
            value = {"approval_id": approval_id, "session_id": session_id, "candidate_id": row["candidate_id"], "approval_digest": row["approval_digest"], "status": "consumed", "consumed": True, "expires_at": row["expires_at"], "updated_at": updated, "provenance": PROVENANCE}
            self._event_locked(session_id, "running", "approval", canonical_sha256(value))
            return value

    def set_active_operation(self, session_id: str, operation_id: str | None) -> None:
        with self.lock, self.db:
            session = self.get(session_id)
            if session is None:
                raise OptimizationError("session_not_found", "Optimization session was not found.")
            payload = dict(session)
            payload["active_operation_id"] = operation_id
            payload["updated_at"] = now()
            self.db.execute("UPDATE sessions SET document_json=?,updated_at=? WHERE session_id=?", (_json(payload), payload["updated_at"], session_id))

    def set_summary(self, session_id: str, summary: dict[str, Any]) -> None:
        with self.lock, self.db:
            session = self.get(session_id)
            if session is None:
                raise OptimizationError("session_not_found", "Optimization session was not found.")
            payload = dict(session)
            payload["summary"] = summary
            payload["updated_at"] = now()
            self.db.execute("UPDATE sessions SET document_json=?,updated_at=? WHERE session_id=?", (_json(payload), payload["updated_at"], session_id))

    def increment_failure(self, session_id: str) -> int:
        with self.lock, self.db:
            self.db.execute("UPDATE sessions SET failure_count=failure_count+1,updated_at=? WHERE session_id=?", (now(), session_id))
            row = self.db.execute("SELECT failure_count FROM sessions WHERE session_id=?", (session_id,)).fetchone()
            return int(row["failure_count"]) if row else 0

    def _event_locked(self, session_id: str, state: str, node: str, payload_digest: str) -> dict[str, Any]:
        row = self.db.execute("SELECT COALESCE(MAX(sequence),0)+1 AS sequence FROM events WHERE session_id=?", (session_id,)).fetchone()
        event = {"schema_identity": SCHEMA_IDENTITIES["event"], "contract_revision": CONTRACT_REVISION, "session_id": session_id, "event_id": f"evt-{uuid.uuid4().hex}", "sequence": int(row["sequence"]), "state": state, "node": node, "payload_digest": payload_digest, "created_at": now(), "provenance": PROVENANCE}
        self.db.execute("INSERT INTO events(session_id,event_id,sequence,state,node,payload_digest,created_at) VALUES(?,?,?,?,?,?,?)", (session_id, event["event_id"], event["sequence"], state, node, payload_digest, event["created_at"]))
        return event

    def events(self, session_id: str, after: int = 0) -> list[dict[str, Any]]:
        with self.lock:
            return [{"schema_identity": SCHEMA_IDENTITIES["event"], "contract_revision": CONTRACT_REVISION, "session_id": session_id, "event_id": row["event_id"], "sequence": row["sequence"], "state": row["state"], "node": row["node"], "payload_digest": row["payload_digest"], "created_at": row["created_at"], "provenance": PROVENANCE} for row in self.db.execute("SELECT * FROM events WHERE session_id=? AND sequence>? ORDER BY sequence", (session_id, after)).fetchall()]

    def transition(self, session_id: str, state: str, *, expected: set[str] | None = None, error: dict[str, Any] | None = None) -> dict[str, Any]:
        if state not in SESSION_STATES:
            raise OptimizationError("invalid_workflow_state", "Unknown optimization workflow state.")
        with self.lock, self.db:
            row = self.db.execute("SELECT * FROM sessions WHERE session_id=? AND deleted_at IS NULL", (session_id,)).fetchone()
            current = self._session(row)
            if current is None:
                raise OptimizationError("session_not_found", "Optimization session was not found.")
            if expected and current["state"] not in expected:
                if current["state"] in TERMINAL_STATES:
                    raise OptimizationError("terminal_mutation", "Terminal optimization session cannot change state.")
                raise OptimizationError("invalid_transition", "Optimization state transition is not allowed.")
            if current["state"] in TERMINAL_STATES and state != current["state"]:
                raise OptimizationError("terminal_mutation", "Terminal optimization session cannot change state.")
            if state != current["state"] and state not in ALLOWED_TRANSITIONS.get(current["state"], set()):
                raise OptimizationError("invalid_transition", "Optimization state transition is not allowed.")
            updated = now()
            payload = dict(current)
            payload["state"] = state
            # ``state`` is the workflow authority, while ``status`` is the
            # backwards-compatible projection consumed by older local-dev
            # callers.  Keep both in the durable document in lockstep so a
            # restart can never resurrect a stale status label.
            payload["status"] = state
            payload["updated_at"] = updated
            if error is not None:
                payload["error"] = error
            self.db.execute("UPDATE sessions SET state=?,document_json=?,updated_at=? WHERE session_id=?", (state, _json(payload), updated, session_id))
            self._event_locked(session_id, state, "lifecycle", canonical_sha256(error or {"state": state}))
            return payload

    def approve(self, session_id: str, candidate_id: str, *, principal: str, digest: str, expires_at: str) -> dict[str, Any]:
        with self.lock, self.db:
            session = self.get(session_id)
            candidate = self.candidate(session_id, candidate_id)
            if session is None or candidate is None:
                raise OptimizationError("session_not_found", "Optimization session or candidate was not found.")
            if session["principal"] != principal:
                raise OptimizationError("principal_mismatch", "Approval principal does not match.")
            if session["state"] != "waiting_approval" or candidate["status"] != "waiting_approval":
                raise OptimizationError("approval_stale", "Only the current waiting candidate may be approved.")
            if digest != canonical_sha256({"candidate_digest": candidate["candidate_digest"], "session_id": session_id}):
                raise OptimizationError("approval_digest_mismatch", "Approval digest does not bind the candidate.")
            try:
                if datetime.fromisoformat(expires_at.replace("Z", "+00:00")) <= datetime.now(timezone.utc):
                    raise OptimizationError("approval_expired", "Approval is already expired.")
            except ValueError as error:
                raise OptimizationError("invalid_expiry", "Approval expiry is not ISO-8601.", field_path="/expires_at") from error
            approval = {"schema_identity": SCHEMA_IDENTITIES["approval"], "contract_revision": CONTRACT_REVISION, "approval_id": f"opt-approval-{uuid.uuid4().hex}", "session_id": session_id, "candidate_id": candidate_id, "candidate_digest": candidate["candidate_digest"], "approval_digest": digest, "principal": principal, "workspace_id": session["workspace_id"], "schema_set_revision": session["schema_set_revision"], "backend_identity": session["backend_identity"], "policy_revision": POLICY_REVISION, "status": "approved", "created_at": now(), "expires_at": expires_at, "consumed": False, "provenance": PROVENANCE}
            self.db.execute("INSERT INTO approvals(approval_id,session_id,candidate_id,approval_digest,status,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)", (approval["approval_id"], session_id, candidate_id, digest, "approved", expires_at, approval["created_at"], approval["created_at"]))
            changed = dict(candidate); changed.update({"status": "approved", "approval_id": approval["approval_id"], "approval_digest": digest, "updated_at": approval["created_at"]})
            self.db.execute("UPDATE candidates SET document_json=?,status=?,updated_at=? WHERE candidate_id=?", (_json(changed), "approved", changed["updated_at"], candidate_id))
            session["approval"] = approval
            self.transition(session_id, "queued", expected={"waiting_approval"})
            return approval

    def mark_running(self, session_id: str) -> dict[str, Any]:
        return self.transition(session_id, "running", expected={"queued", "retrying"})

    def record_iteration(self, session_id: str, candidate_id: str, state: str, payload: dict[str, Any]) -> dict[str, Any]:
        with self.lock, self.db:
            row = self.db.execute("SELECT COALESCE(MAX(sequence),-1)+1 AS sequence FROM iterations WHERE session_id=?", (session_id,)).fetchone()
            sequence = int(row["sequence"])
            iteration = {"schema_identity": SCHEMA_IDENTITIES["iteration"], "contract_revision": CONTRACT_REVISION, "iteration_id": f"iteration-{uuid.uuid4().hex}", "session_id": session_id, "sequence": sequence, "candidate_id": candidate_id, "state": state, "document": payload, "created_at": now(), "updated_at": now(), "provenance": PROVENANCE}
            self.db.execute("INSERT INTO iterations(iteration_id,session_id,sequence,candidate_id,state,document_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)", (iteration["iteration_id"], session_id, sequence, candidate_id, state, _json(iteration), iteration["created_at"], iteration["updated_at"]))
            # ``run_count`` is a side-effect budget, not an event count.  A
            # completed iteration must not consume a second run slot.
            increment_run = 1 if state == "running" else 0
            self.db.execute("UPDATE sessions SET current_iteration=?,run_count=run_count+?,updated_at=? WHERE session_id=?", (sequence, increment_run, iteration["updated_at"], session_id))
            self._event_locked(session_id, state, "iteration", canonical_sha256(payload))
            return iteration

    def list_iterations(self, session_id: str) -> list[dict[str, Any]]:
        with self.lock:
            return [_decode(row["document_json"], {}) for row in self.db.execute("SELECT document_json FROM iterations WHERE session_id=? ORDER BY sequence", (session_id,)).fetchall()]

    def save_checkpoint(self, session_id: str, document: dict[str, Any]) -> dict[str, Any]:
        with self.lock, self.db:
            checkpoint = {"schema_identity": SCHEMA_IDENTITIES["checkpoint"], "contract_revision": CONTRACT_REVISION, "checkpoint_id": f"opt-checkpoint-{uuid.uuid4().hex}", "session_id": session_id, "state_digest": canonical_sha256(document), "last_event_sequence": len(self.events(session_id)), "document": document, "created_at": now(), "provenance": PROVENANCE}
            self.db.execute("INSERT INTO checkpoints(checkpoint_id,session_id,state_digest,last_event_sequence,document_json,created_at) VALUES(?,?,?,?,?,?)", (checkpoint["checkpoint_id"], session_id, checkpoint["state_digest"], checkpoint["last_event_sequence"], _json(checkpoint), checkpoint["created_at"]))
            return checkpoint

    def save_evaluation(self, session_id: str, candidate_id: str, document: dict[str, Any]) -> dict[str, Any]:
        with self.lock, self.db:
            value = {**document, "evaluation_id": f"evaluation-{uuid.uuid4().hex}", "created_at": document.get("created_at", now())}
            existing = self.db.execute("SELECT document_json FROM evaluations WHERE session_id=? AND candidate_id=?", (session_id, candidate_id)).fetchone()
            if existing:
                return _decode(existing["document_json"], value)
            self.db.execute("INSERT INTO evaluations(evaluation_id,session_id,candidate_id,document_json,created_at) VALUES(?,?,?,?,?)", (value["evaluation_id"], session_id, candidate_id, _json(value), value["created_at"]))
            self._event_locked(session_id, "running", "evaluation", canonical_sha256(value))
            return value

    def evaluations(self, session_id: str) -> list[dict[str, Any]]:
        with self.lock:
            return [_decode(row["document_json"], {}) for row in self.db.execute("SELECT document_json FROM evaluations WHERE session_id=? ORDER BY created_at", (session_id,)).fetchall()]

    def detail(self, session_id: str) -> dict[str, Any] | None:
        session = self.get(session_id)
        if session is None:
            return None
        return {"session": session, "candidate": self.candidate(session_id), "candidates": self.candidates(session_id), "iterations": self.list_iterations(session_id), "evaluations": self.evaluations(session_id), "events": self.events(session_id), "checkpoint": self.latest_checkpoint(session_id), "approval": self.latest_approval(session_id), "tool_invocations": self.tool_calls(session_id), "summary": session.get("summary")}

    def latest_checkpoint(self, session_id: str) -> dict[str, Any] | None:
        with self.lock:
            row = self.db.execute("SELECT document_json FROM checkpoints WHERE session_id=? ORDER BY created_at DESC LIMIT 1", (session_id,)).fetchone()
            return _decode(row["document_json"], None) if row else None

    def latest_approval(self, session_id: str) -> dict[str, Any] | None:
        with self.lock:
            row = self.db.execute("SELECT * FROM approvals WHERE session_id=? ORDER BY created_at DESC LIMIT 1", (session_id,)).fetchone()
            if not row:
                return None
            return {"schema_identity": SCHEMA_IDENTITIES["approval"], "contract_revision": CONTRACT_REVISION, "approval_id": row["approval_id"], "session_id": session_id, "candidate_id": row["candidate_id"], "approval_digest": row["approval_digest"], "status": row["status"], "expires_at": row["expires_at"], "consumed": bool(row["consumed"]), "created_at": row["created_at"], "updated_at": row["updated_at"], "provenance": PROVENANCE}

    def tool_calls(self, session_id: str) -> list[dict[str, Any]]:
        with self.lock:
            return [{"schema_identity": SCHEMA_IDENTITIES["tool_invocation"], "contract_revision": CONTRACT_REVISION, "invocation_id": row["invocation_id"], "session_id": session_id, "iteration_id": row["iteration_id"], "tool_name": row["tool_name"], "input_digest": row["input_digest"], "idempotency_key": row["idempotency_key"], "outcome": row["outcome"], "result_digest": row["result_digest"], "error_code": row["error_code"], "created_at": row["created_at"], "updated_at": row["updated_at"], "provenance": PROVENANCE} for row in self.db.execute("SELECT * FROM tool_calls WHERE session_id=? ORDER BY created_at", (session_id,)).fetchall()]

    def record_tool(self, session_id: str, tool_name: str, payload: Any, *, iteration_id: str | None, idempotency_key: str, outcome: str = "succeeded", result: Any = None, error_code: str | None = None) -> dict[str, Any]:
        if tool_name not in {item["name"] for item in TOOL_REGISTRY}:
            raise OptimizationError("unknown_tool", "Tool is not in the optimization allowlist.")
        digest = canonical_sha256(payload)
        result_digest = canonical_sha256(result) if result is not None else None
        with self.lock, self.db:
            existing = self.db.execute("SELECT * FROM tool_calls WHERE session_id=? AND idempotency_key=?", (session_id, idempotency_key)).fetchone()
            if existing:
                if existing["input_digest"] != digest:
                    raise OptimizationError("idempotency_payload_mismatch", "Tool invocation key is bound to another input.")
                return self.tool_calls(session_id)[-1]
            created = now(); invocation_id = f"invocation-{uuid.uuid4().hex}"
            self.db.execute("INSERT INTO tool_calls(invocation_id,session_id,iteration_id,tool_name,input_digest,idempotency_key,outcome,result_digest,error_code,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)", (invocation_id, session_id, iteration_id, tool_name, digest, idempotency_key, outcome, result_digest, error_code, created, created))
            return {"schema_identity": SCHEMA_IDENTITIES["tool_invocation"], "contract_revision": CONTRACT_REVISION, "invocation_id": invocation_id, "session_id": session_id, "iteration_id": iteration_id, "tool_name": tool_name, "input_digest": digest, "idempotency_key": idempotency_key, "outcome": outcome, "result_digest": result_digest, "error_code": error_code, "created_at": created, "updated_at": created, "provenance": PROVENANCE}

    def delete(self, session_id: str) -> bool:
        with self.lock, self.db:
            changed = self.db.execute("UPDATE sessions SET deleted_at=?,updated_at=? WHERE session_id=? AND deleted_at IS NULL", (now(), now(), session_id)).rowcount
            return bool(changed)
