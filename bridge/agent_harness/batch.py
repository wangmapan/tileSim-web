"""Local-dev batch experiment coordinator.

The batch layer owns only bounded orchestration metadata.  It deliberately
keeps run payloads out of SQLite and delegates every side effect to the
published Stage-3 execution endpoint.  The same store is safe to reopen after
Bridge restart: in-flight work is fenced as ``recovery_required`` instead of
being retried blindly.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .contracts import canonical_sha256


CONTRACT_REVISION = "2026-10-19.wpe.v1"
POLICY_REVISION = "tilesim.agent_harness.local_batch.policy.v1"
TOOL_REGISTRY_REVISION = "2026-10-19.tools.v3"
PROVENANCE = {
    "deployment_mode": "local_dev",
    "source_mode": "synthetic_trace",
    "claim_scope": "exploratory",
    "production_status": "not_for_production",
}
SCHEMA_IDENTITIES = {
    "batch": "tilesim.agent_harness.batch_session.v1",
    "plan": "tilesim.agent_harness.experiment_plan.v1",
    "candidate_set": "tilesim.agent_harness.candidate_set.v1",
    "run_slot": "tilesim.agent_harness.run_slot.v1",
    "objective": "tilesim.agent_harness.batch_objective.v1",
    "budget": "tilesim.agent_harness.batch_budget.v1",
    "concurrency": "tilesim.agent_harness.concurrency_policy.v1",
    "stop_policy": "tilesim.agent_harness.stop_policy.v1",
    "checkpoint": "tilesim.agent_harness.batch_checkpoint.v1",
    "summary": "tilesim.agent_harness.batch_summary.v1",
    "result": "tilesim.agent_harness.batch_run_result.v1",
    "failure": "tilesim.agent_harness.batch_failure_recovery.v1",
    "stop_reason": "tilesim.agent_harness.stop_reason.v1",
    "event": "tilesim.agent_harness.batch_event.v1",
}
STATES = {
    "draft",
    "validated",
    "waiting_approval",
    "queued",
    "running",
    "paused",
    "completed",
    "failed",
    "cancelled",
    "recovery_required",
    "manual_intervention_required",
}
TERMINAL_STATES = {"completed", "failed", "cancelled"}
ACTIVE_STATES = {"validated", "waiting_approval", "queued", "running", "paused", "recovery_required"}
ALLOWED_TRANSITIONS = {
    "draft": {"validated", "cancelled"},
    "validated": {"waiting_approval", "cancelled"},
    "waiting_approval": {"queued", "cancelled"},
    "queued": {"running", "paused", "cancelled", "recovery_required"},
    "running": {"paused", "completed", "failed", "cancelled", "recovery_required", "manual_intervention_required"},
    "paused": {"queued", "cancelled", "recovery_required"},
    "recovery_required": {"queued", "cancelled", "manual_intervention_required"},
    "failed": {"queued", "cancelled"},
    "completed": set(),
    "cancelled": set(),
    "manual_intervention_required": set(),
}
MAX_CANDIDATES = 32
MAX_RUNS = 32
MAX_SECONDS = 60 * 60
MAX_FAILURES = 8
MAX_RETRIES = 3


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


class BatchError(RuntimeError):
    def __init__(self, code: str, message: str, *, retryable: bool = False, unknown_outcome: bool = False, field_path: str = "/"):
        super().__init__(message)
        self.code = code
        self.retryable = retryable
        self.unknown_outcome = unknown_outcome
        self.field_path = field_path


def _bounded_int(value: Any, name: str, default: int, maximum: int) -> int:
    if value is None:
        return default
    if isinstance(value, bool) or not isinstance(value, int) or value < 1 or value > maximum:
        raise BatchError("invalid_budget", f"{name} is outside the local-dev batch bound.", field_path=f"/budget/{name}")
    return value


def validate_budget(value: Any) -> dict[str, int]:
    if value is None:
        value = {}
    if not isinstance(value, dict):
        raise BatchError("invalid_budget", "budget must be an object.", field_path="/budget")
    allowed = {"max_candidates", "max_runs", "max_seconds", "max_concurrency", "max_failures", "max_retries", "resource_units", "max_no_improvement"}
    unknown = sorted(set(value) - allowed)
    if unknown:
        raise BatchError("unknown_field", "budget is closed.", field_path=f"/budget/{unknown[0]}")
    return {
        "max_candidates": _bounded_int(value.get("max_candidates"), "max_candidates", 4, MAX_CANDIDATES),
        "max_runs": _bounded_int(value.get("max_runs"), "max_runs", 4, MAX_RUNS),
        "max_seconds": _bounded_int(value.get("max_seconds"), "max_seconds", 900, MAX_SECONDS),
        "max_concurrency": _bounded_int(value.get("max_concurrency"), "max_concurrency", 1, 1),
        "max_failures": _bounded_int(value.get("max_failures"), "max_failures", 2, MAX_FAILURES),
        "max_retries": _bounded_int(value.get("max_retries"), "max_retries", 1, MAX_RETRIES),
        "resource_units": _bounded_int(value.get("resource_units"), "resource_units", 1, 1024),
        "max_no_improvement": _bounded_int(value.get("max_no_improvement"), "max_no_improvement", 2, MAX_CANDIDATES),
    }


def validate_batch_request(body: dict[str, Any], *, principal: str, workspace_id: str, schema_set_revision: str, backend_identity: Any) -> dict[str, Any]:
    allowed = {"schema_identity", "contract_revision", "batch_id", "principal", "workspace_id", "input_snapshot_digest", "schema_set_revision", "backend_identity", "policy_revision", "plan", "candidate_set", "objective", "budget", "concurrency_policy", "stop_policy", "execution_request", "approval_required", "auto_execute", "local_dev", "idempotency_key", "expires_at"}
    unknown = sorted(set(body) - allowed)
    if unknown:
        raise BatchError("unknown_field", "Batch request is closed.", field_path=f"/{unknown[0]}")
    if body.get("schema_identity", SCHEMA_IDENTITIES["batch"]) != SCHEMA_IDENTITIES["batch"]:
        raise BatchError("schema_revision_mismatch", "Batch schema identity is stale.", field_path="/schema_identity")
    if body.get("contract_revision", CONTRACT_REVISION) != CONTRACT_REVISION:
        raise BatchError("contract_revision_mismatch", "Batch contract revision is stale.", field_path="/contract_revision")
    if body.get("principal", principal) != principal or body.get("workspace_id", workspace_id) != workspace_id:
        raise BatchError("principal_mismatch", "Batch principal or workspace does not match.", field_path="/principal")
    if body.get("schema_set_revision") != schema_set_revision:
        raise BatchError("schema_revision_mismatch", "Batch schema-set revision is stale.", field_path="/schema_set_revision")
    if body.get("backend_identity") != backend_identity:
        raise BatchError("backend_identity_mismatch", "Batch backend identity is stale.", field_path="/backend_identity")
    if body.get("policy_revision", POLICY_REVISION) != POLICY_REVISION:
        raise BatchError("policy_revision_mismatch", "Batch policy revision is stale.", field_path="/policy_revision")
    if body.get("local_dev") is not True:
        raise BatchError("local_dev_required", "Stage 5 is only exposed in explicit local-dev mode.", field_path="/local_dev")
    if body.get("approval_required", True) is not True:
        raise BatchError("approval_required", "A human approval is required for every local batch plan.", field_path="/approval_required")
    if body.get("auto_execute") is True and body.get("approval_required") is False:
        raise BatchError("approval_required", "Automatic execution cannot bypass approval.", field_path="/approval_required")
    snapshot = body.get("input_snapshot_digest")
    if not isinstance(snapshot, str) or not snapshot.startswith("sha256:"):
        raise BatchError("invalid_digest", "input_snapshot_digest must be a sha256 digest.", field_path="/input_snapshot_digest")
    candidate_set = body.get("candidate_set")
    if not isinstance(candidate_set, list) or not candidate_set or len(candidate_set) > MAX_CANDIDATES or any(not isinstance(item, dict) for item in candidate_set):
        raise BatchError("invalid_candidate_set", "candidate_set must contain one to thirty-two objects.", field_path="/candidate_set")
    plan = body.get("plan")
    objective = body.get("objective")
    if not isinstance(plan, dict) or not isinstance(objective, dict) or not isinstance(objective.get("metric_path"), str) or not objective["metric_path"].startswith("/"):
        raise BatchError("invalid_plan", "plan and objective.metric_path are required.", field_path="/objective/metric_path")
    direction = objective.get("direction", "minimize")
    if direction not in {"minimize", "maximize"}:
        raise BatchError("invalid_objective", "objective.direction must be minimize or maximize.", field_path="/objective/direction")
    execution_request = body.get("execution_request")
    if execution_request is not None and (not isinstance(execution_request, dict) or not execution_request):
        raise BatchError("invalid_execution_request", "execution_request must be a non-empty object when supplied.", field_path="/execution_request")
    budget = validate_budget(body.get("budget"))
    concurrency = body.get("concurrency_policy") or {}
    if not isinstance(concurrency, dict) or set(concurrency) - {"max_concurrency", "queue_policy"}:
        unknown = sorted(set(concurrency) - {"max_concurrency", "queue_policy"}) if isinstance(concurrency, dict) else []
        raise BatchError("invalid_concurrency_policy", "concurrency_policy is closed and must be bounded.", field_path=f"/concurrency_policy/{unknown[0]}" if unknown else "/concurrency_policy")
    if concurrency.get("max_concurrency", 1) != 1 or concurrency.get("queue_policy", "bounded_fifo") != "bounded_fifo":
        raise BatchError("invalid_concurrency_policy", "Local-dev batches support only bounded_fifo with max_concurrency=1.", field_path="/concurrency_policy/max_concurrency")
    stop_policy = body.get("stop_policy") or {}
    if not isinstance(stop_policy, dict) or set(stop_policy) - {"on_failure", "on_no_improvement"}:
        unknown = sorted(set(stop_policy) - {"on_failure", "on_no_improvement"}) if isinstance(stop_policy, dict) else []
        raise BatchError("invalid_stop_policy", "stop_policy is closed.", field_path=f"/stop_policy/{unknown[0]}" if unknown else "/stop_policy")
    if stop_policy.get("on_failure", "continue") not in {"continue", "stop"} or stop_policy.get("on_no_improvement", "stop") != "stop":
        raise BatchError("invalid_stop_policy", "Only continue/stop failure handling and stop-on-no-improvement are supported.", field_path="/stop_policy")
    objective_value = {"schema_identity": SCHEMA_IDENTITIES["objective"], "contract_revision": CONTRACT_REVISION, "metric_path": objective["metric_path"], "direction": direction, "policy_revision": POLICY_REVISION, "digest": canonical_sha256({"metric_path": objective["metric_path"], "direction": direction}), "status": "pending", "value": None}
    plan_value = {"schema_identity": SCHEMA_IDENTITIES["plan"], "contract_revision": CONTRACT_REVISION, "plan_digest": canonical_sha256(plan), "snapshot_digest": snapshot, "parent_batch_id": None, "principal": principal, "workspace_id": workspace_id, "backend_identity": backend_identity, "schema_set_revision": schema_set_revision, "policy_revision": POLICY_REVISION, "steps": [plan], "provenance": PROVENANCE}
    concurrency_value = {"schema_identity": SCHEMA_IDENTITIES["concurrency"], "contract_revision": CONTRACT_REVISION, "max_concurrency": 1, "queue_policy": "bounded_fifo"}
    stop_value = {"schema_identity": SCHEMA_IDENTITIES["stop_policy"], "contract_revision": CONTRACT_REVISION, "on_failure": stop_policy.get("on_failure", "continue"), "on_no_improvement": "stop"}
    return {**body, "schema_identity": SCHEMA_IDENTITIES["batch"], "contract_revision": CONTRACT_REVISION, "principal": principal, "workspace_id": workspace_id, "schema_set_revision": schema_set_revision, "backend_identity": backend_identity, "policy_revision": POLICY_REVISION, "candidate_set": candidate_set, "plan": plan_value, "objective": objective_value, "budget": budget, "concurrency_policy": concurrency_value, "stop_policy": stop_value, "approval_required": True, "auto_execute": bool(body.get("auto_execute", True)), "local_dev": True, "provenance": PROVENANCE}


def candidate_document(batch: dict[str, Any], sequence: int, config: dict[str, Any], parent_candidate_id: str | None = None) -> dict[str, Any]:
    candidate_id = f"batch-candidate-{uuid.uuid4().hex}"
    digest = canonical_sha256({"batch_id": batch["batch_id"], "parent_candidate_id": parent_candidate_id, "config": config})
    return {"schema_identity": SCHEMA_IDENTITIES["candidate_set"], "contract_revision": CONTRACT_REVISION, "candidate_id": candidate_id, "batch_id": batch["batch_id"], "sequence": sequence, "parent_candidate_id": parent_candidate_id, "candidate_digest": digest, "principal": batch["principal"], "workspace_id": batch["workspace_id"], "snapshot_digest": batch["input_snapshot_digest"], "schema_set_revision": batch["schema_set_revision"], "backend_identity": batch["backend_identity"], "policy_revision": POLICY_REVISION, "config": config, "diff": {"changed_fields": sorted(config), "parent_candidate_id": parent_candidate_id}, "status": "waiting_approval", "operation_id": None, "run_id": None, "artifact_manifest_digest": None, "created_at": now(), "updated_at": now(), "provenance": PROVENANCE}


class BatchStore:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.db = sqlite3.connect(str(self.path), check_same_thread=False, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA busy_timeout=5000")
        self.db.executescript("""
        CREATE TABLE IF NOT EXISTS batches (batch_id TEXT PRIMARY KEY, idempotency_key TEXT UNIQUE NOT NULL, principal TEXT NOT NULL, workspace_id TEXT NOT NULL, state TEXT NOT NULL, document_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
        CREATE TABLE IF NOT EXISTS batch_candidates (candidate_id TEXT PRIMARY KEY, batch_id TEXT NOT NULL, sequence INTEGER NOT NULL, document_json TEXT NOT NULL, status TEXT NOT NULL, retry_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(batch_id,sequence), UNIQUE(batch_id,candidate_id));
        CREATE TABLE IF NOT EXISTS batch_events (batch_id TEXT NOT NULL, event_id TEXT NOT NULL, sequence INTEGER NOT NULL, state TEXT NOT NULL, node TEXT NOT NULL, payload_digest TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(batch_id,event_id), UNIQUE(batch_id,sequence));
        CREATE TABLE IF NOT EXISTS batch_checkpoints (checkpoint_id TEXT PRIMARY KEY, batch_id TEXT NOT NULL, state_digest TEXT NOT NULL, last_event_sequence INTEGER NOT NULL, document_json TEXT NOT NULL, created_at TEXT NOT NULL, valid INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS batch_leases (batch_id TEXT PRIMARY KEY, owner TEXT NOT NULL, heartbeat_at TEXT NOT NULL, expires_at TEXT NOT NULL);
        """)

    def close(self) -> None:
        self.db.close()

    def _batch(self, row: sqlite3.Row | None) -> dict[str, Any] | None:
        if row is None:
            return None
        value = _decode(row["document_json"], {})
        value.update({"batch_id": row["batch_id"], "state": row["state"], "created_at": row["created_at"], "updated_at": row["updated_at"]})
        return value

    def get(self, batch_id: str) -> dict[str, Any] | None:
        with self.lock:
            return self._batch(self.db.execute("SELECT * FROM batches WHERE batch_id=? AND deleted_at IS NULL", (batch_id,)).fetchone())

    def list(self, principal: str, workspace_id: str) -> list[dict[str, Any]]:
        with self.lock:
            return [self._batch(row) for row in self.db.execute("SELECT * FROM batches WHERE principal=? AND workspace_id=? AND deleted_at IS NULL ORDER BY created_at DESC", (principal, workspace_id)).fetchall()]

    def create(self, document: dict[str, Any], *, idempotency_key: str) -> tuple[dict[str, Any], bool]:
        with self.lock, self.db:
            existing = self.db.execute("SELECT * FROM batches WHERE idempotency_key=? AND deleted_at IS NULL", (idempotency_key,)).fetchone()
            if existing:
                current = self._batch(existing)
                if canonical_sha256(current.get("candidate_set")) != canonical_sha256(document.get("candidate_set")):
                    raise BatchError("idempotency_payload_mismatch", "Idempotency-Key is bound to another batch plan.")
                return current, True
            batch_id = document.get("batch_id") or f"batch-{uuid.uuid4().hex}"
            created = now()
            value = {**document, "batch_id": batch_id, "state": "waiting_approval", "status": "waiting_approval", "created_at": created, "updated_at": created, "provenance": PROVENANCE, "summary": None}
            self.db.execute("INSERT INTO batches(batch_id,idempotency_key,principal,workspace_id,state,document_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)", (batch_id, idempotency_key, document["principal"], document["workspace_id"], "waiting_approval", _json(value), created, created))
            seen: set[str] = set()
            seen_configs: set[str] = set()
            for sequence, config in enumerate(document["candidate_set"]):
                config_digest = canonical_sha256(config)
                if config_digest in seen_configs:
                    raise BatchError("duplicate_candidate", "candidate_set contains duplicate candidate configurations.", field_path=f"/candidate_set/{sequence}")
                seen_configs.add(config_digest)
                candidate = candidate_document(value, sequence, config)
                if candidate["candidate_digest"] in seen:
                    raise BatchError("duplicate_candidate", "candidate_set contains duplicate candidate digests.", field_path=f"/candidate_set/{sequence}")
                seen.add(candidate["candidate_digest"])
                self.db.execute("INSERT INTO batch_candidates(candidate_id,batch_id,sequence,document_json,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)", (candidate["candidate_id"], batch_id, sequence, _json(candidate), candidate["status"], created, created))
            self._event_locked(batch_id, "waiting_approval", "batch", canonical_sha256({"batch_id": batch_id}))
            return value, False

    def candidates(self, batch_id: str) -> list[dict[str, Any]]:
        with self.lock:
            return [_decode(row["document_json"], {}) for row in self.db.execute("SELECT document_json FROM batch_candidates WHERE batch_id=? ORDER BY sequence", (batch_id,)).fetchall()]

    def candidate(self, batch_id: str, candidate_id: str) -> dict[str, Any] | None:
        with self.lock:
            row = self.db.execute("SELECT document_json FROM batch_candidates WHERE batch_id=? AND candidate_id=?", (batch_id, candidate_id)).fetchone()
            return _decode(row["document_json"], None) if row else None

    def detail(self, batch_id: str) -> dict[str, Any] | None:
        batch = self.get(batch_id)
        if batch is None:
            return None
        return {"batch": batch, "candidates": self.candidates(batch_id), "events": self.events(batch_id), "checkpoint": self.latest_checkpoint(batch_id), "lease": self.lease(batch_id)}

    def _event_locked(self, batch_id: str, state: str, node: str, payload_digest: str) -> dict[str, Any]:
        row = self.db.execute("SELECT COALESCE(MAX(sequence),0)+1 AS sequence FROM batch_events WHERE batch_id=?", (batch_id,)).fetchone()
        event = {"schema_identity": SCHEMA_IDENTITIES["event"], "contract_revision": CONTRACT_REVISION, "batch_id": batch_id, "event_id": f"batch-event-{uuid.uuid4().hex}", "sequence": int(row["sequence"]), "state": state, "node": node, "payload_digest": payload_digest, "created_at": now(), "provenance": PROVENANCE}
        self.db.execute("INSERT INTO batch_events(batch_id,event_id,sequence,state,node,payload_digest,created_at) VALUES(?,?,?,?,?,?,?)", (batch_id, event["event_id"], event["sequence"], state, node, payload_digest, event["created_at"]))
        return event

    def events(self, batch_id: str, after: int = 0) -> list[dict[str, Any]]:
        with self.lock:
            return [{"schema_identity": SCHEMA_IDENTITIES["event"], "contract_revision": CONTRACT_REVISION, "batch_id": batch_id, "event_id": row["event_id"], "sequence": row["sequence"], "state": row["state"], "node": row["node"], "payload_digest": row["payload_digest"], "created_at": row["created_at"], "provenance": PROVENANCE} for row in self.db.execute("SELECT * FROM batch_events WHERE batch_id=? AND sequence>? ORDER BY sequence", (batch_id, after)).fetchall()]

    def transition(self, batch_id: str, state: str, *, expected: set[str] | None = None, error: dict[str, Any] | None = None) -> dict[str, Any]:
        if state not in STATES:
            raise BatchError("invalid_workflow_state", "Unknown batch workflow state.")
        with self.lock, self.db:
            current = self.get(batch_id)
            if current is None:
                raise BatchError("batch_not_found", "Batch was not found.")
            if expected and current["state"] not in expected:
                raise BatchError("invalid_transition", "Batch state transition is not allowed.")
            if current["state"] in TERMINAL_STATES and state != current["state"]:
                raise BatchError("terminal_mutation", "Terminal batch cannot change state.")
            if state != current["state"] and state not in ALLOWED_TRANSITIONS.get(current["state"], set()):
                raise BatchError("invalid_transition", "Batch state transition is not allowed.")
            updated = now(); payload = dict(current); payload.update({"state": state, "status": state, "updated_at": updated})
            if error is not None:
                payload["error"] = {"code": str(error.get("code", "batch_error")), "retryable": bool(error.get("retryable", False)), "unknown_outcome": bool(error.get("unknown_outcome", False))}
            self.db.execute("UPDATE batches SET state=?,document_json=?,updated_at=? WHERE batch_id=?", (state, _json(payload), updated, batch_id))
            self._event_locked(batch_id, state, "lifecycle", canonical_sha256(error or {"state": state}))
            return payload

    def approve(self, batch_id: str, *, approval_digest: str, expires_at: str) -> dict[str, Any]:
        batch = self.get(batch_id)
        if batch is None:
            raise BatchError("batch_not_found", "Batch was not found.")
        if batch["state"] != "waiting_approval":
            raise BatchError("approval_stale", "Only a waiting batch can be approved.")
        plan_digest = batch.get("plan", {}).get("plan_digest") if isinstance(batch.get("plan"), dict) else None
        plan_digest = plan_digest or canonical_sha256(batch.get("plan"))
        expected_digests = {
            canonical_sha256({"batch_id": batch_id, "plan_digest": plan_digest, "snapshot_digest": batch["input_snapshot_digest"]}),
            canonical_sha256({"batch_id": batch_id, "plan_digest": canonical_sha256(batch.get("plan")), "snapshot_digest": batch["input_snapshot_digest"]}),
        }
        if approval_digest not in expected_digests:
            raise BatchError("approval_digest_mismatch", "Approval digest does not bind the batch plan.")
        try:
            if datetime.fromisoformat(expires_at.replace("Z", "+00:00")) <= datetime.now(timezone.utc):
                raise BatchError("approval_expired", "Approval is already expired.")
        except ValueError as error:
            raise BatchError("invalid_expiry", "Approval expiry is not ISO-8601.", field_path="/expires_at") from error
        approval = {"schema_identity": "tilesim.agent_harness.batch_approval.v1", "contract_revision": CONTRACT_REVISION, "approval_id": f"batch-approval-{uuid.uuid4().hex}", "batch_id": batch_id, "approval_digest": approval_digest, "status": "approved", "single_use": True, "consumed": False, "expires_at": expires_at, "created_at": now(), "provenance": PROVENANCE}
        payload = dict(batch); payload["approval"] = approval
        self.db.execute("UPDATE batches SET document_json=?,updated_at=? WHERE batch_id=?", (_json(payload), payload["updated_at"], batch_id))
        return approval

    def consume_approval(self, batch_id: str) -> dict[str, Any]:
        batch = self.get(batch_id); approval = (batch or {}).get("approval")
        if not isinstance(approval, dict):
            raise BatchError("approval_not_found", "Batch approval was not found.")
        if approval.get("consumed") or approval.get("status") != "approved":
            raise BatchError("approval_replayed", "Batch approval is single-use.")
        try:
            if datetime.fromisoformat(str(approval["expires_at"]).replace("Z", "+00:00")) <= datetime.now(timezone.utc):
                raise BatchError("approval_expired", "Batch approval has expired.")
        except (KeyError, ValueError) as error:
            raise BatchError("invalid_expiry", "Batch approval expiry is invalid.") from error
        approval = {**approval, "status": "consumed", "consumed": True, "consumed_at": now()}
        payload = dict(batch); payload["approval"] = approval; payload["updated_at"] = now()
        with self.lock, self.db:
            self.db.execute("UPDATE batches SET document_json=?,updated_at=? WHERE batch_id=?", (_json(payload), payload["updated_at"], batch_id))
            self._event_locked(batch_id, "queued", "approval", canonical_sha256({"approval_id": approval["approval_id"]}))
        return approval

    def update_candidate(self, batch_id: str, candidate_id: str, **fields: Any) -> dict[str, Any]:
        with self.lock, self.db:
            candidate = self.candidate(batch_id, candidate_id)
            if candidate is None:
                raise BatchError("candidate_not_found", "Batch candidate was not found.")
            candidate.update(fields); candidate["updated_at"] = now()
            self.db.execute("UPDATE batch_candidates SET document_json=?,status=?,retry_count=COALESCE(?,retry_count),updated_at=? WHERE batch_id=? AND candidate_id=?", (_json(candidate), candidate.get("status", "queued"), fields.get("retry_count"), candidate["updated_at"], batch_id, candidate_id))
            self._event_locked(batch_id, candidate.get("status", "queued"), "candidate", canonical_sha256({"candidate_id": candidate_id, "status": candidate.get("status")}))
            return candidate

    def save_checkpoint(self, batch_id: str, document: dict[str, Any]) -> dict[str, Any]:
        with self.lock, self.db:
            checkpoint = {"schema_identity": SCHEMA_IDENTITIES["checkpoint"], "contract_revision": CONTRACT_REVISION, "checkpoint_id": f"batch-checkpoint-{uuid.uuid4().hex}", "batch_id": batch_id, "state_digest": canonical_sha256(document), "last_event_sequence": len(self.events(batch_id)), "document": {"candidate_ids": list(document.get("candidate_ids", [])), "completed_count": int(document.get("completed_count", 0)), "failed_count": int(document.get("failed_count", 0))}, "created_at": now(), "provenance": PROVENANCE}
            self.db.execute("INSERT INTO batch_checkpoints(checkpoint_id,batch_id,state_digest,last_event_sequence,document_json,created_at) VALUES(?,?,?,?,?,?)", (checkpoint["checkpoint_id"], batch_id, checkpoint["state_digest"], checkpoint["last_event_sequence"], _json(checkpoint), checkpoint["created_at"]))
            return checkpoint

    def latest_checkpoint(self, batch_id: str) -> dict[str, Any] | None:
        with self.lock:
            row = self.db.execute("SELECT document_json FROM batch_checkpoints WHERE batch_id=? ORDER BY created_at DESC LIMIT 1", (batch_id,)).fetchone()
            return _decode(row["document_json"], None) if row else None

    def acquire_lease(self, batch_id: str, owner: str, *, ttl_seconds: int = 30) -> bool:
        with self.lock, self.db:
            current = self.db.execute("SELECT * FROM batch_leases WHERE batch_id=?", (batch_id,)).fetchone()
            now_dt = datetime.now(timezone.utc); expires = now_dt.timestamp() + ttl_seconds
            if current:
                try:
                    if datetime.fromisoformat(current["expires_at"].replace("Z", "+00:00")).timestamp() > now_dt.timestamp() and current["owner"] != owner:
                        return False
                except ValueError:
                    pass
                self.db.execute("UPDATE batch_leases SET owner=?,heartbeat_at=?,expires_at=? WHERE batch_id=?", (owner, now_dt.isoformat(), datetime.fromtimestamp(expires, timezone.utc).isoformat(), batch_id))
            else:
                self.db.execute("INSERT INTO batch_leases(batch_id,owner,heartbeat_at,expires_at) VALUES(?,?,?,?)", (batch_id, owner, now_dt.isoformat(), datetime.fromtimestamp(expires, timezone.utc).isoformat()))
            return True

    def heartbeat(self, batch_id: str, owner: str, *, ttl_seconds: int = 30) -> bool:
        return self.acquire_lease(batch_id, owner, ttl_seconds=ttl_seconds)

    def lease(self, batch_id: str) -> dict[str, Any] | None:
        with self.lock:
            row = self.db.execute("SELECT * FROM batch_leases WHERE batch_id=?", (batch_id,)).fetchone()
            return {"owner": row["owner"], "heartbeat_at": row["heartbeat_at"], "expires_at": row["expires_at"]} if row else None

    def recover_inflight(self) -> int:
        changed = 0
        with self.lock, self.db:
            rows = self.db.execute("SELECT batch_id FROM batches WHERE deleted_at IS NULL AND state IN ('queued','running')").fetchall()
            for row in rows:
                batch_id = row["batch_id"]
                self.transition(batch_id, "recovery_required", expected={"queued", "running"}, error={"code": "worker_restarted", "unknown_outcome": True})
                changed += 1
        return changed

    def summary(self, batch_id: str) -> dict[str, Any]:
        batch = self.get(batch_id); candidates = self.candidates(batch_id)
        if batch is None:
            raise BatchError("batch_not_found", "Batch was not found.")
        counts = {state: sum(1 for item in candidates if item.get("status") == state) for state in {"waiting_approval", "queued", "running", "completed", "failed", "recovery_required", "cancelled"}}
        return {"schema_identity": SCHEMA_IDENTITIES["summary"], "contract_revision": CONTRACT_REVISION, "batch_id": batch_id, "state": batch["state"], "counts": counts, "best_candidate_id": batch.get("best_candidate_id"), "best_value": batch.get("best_value"), "no_improvement_count": int(batch.get("no_improvement_count", 0)), "evaluated_count": int(batch.get("evaluated_count", 0)), "stop_reason": batch.get("stop_reason"), "checkpoint_id": (self.latest_checkpoint(batch_id) or {}).get("checkpoint_id"), "provenance": PROVENANCE}

    def set_summary(self, batch_id: str, summary: dict[str, Any], *, best_candidate_id: str | None = None, stop_reason: dict[str, Any] | None = None) -> None:
        with self.lock, self.db:
            batch = self.get(batch_id)
            if batch is None:
                raise BatchError("batch_not_found", "Batch was not found.")
            payload = dict(batch); payload["summary"] = summary
            if best_candidate_id is not None:
                payload["best_candidate_id"] = best_candidate_id
            if stop_reason is not None:
                payload["stop_reason"] = stop_reason
            payload["updated_at"] = now()
            self.db.execute("UPDATE batches SET document_json=?,updated_at=? WHERE batch_id=?", (_json(payload), payload["updated_at"], batch_id))

    def set_progress(self, batch_id: str, *, best_candidate_id: str | None, best_value: float | None, no_improvement_count: int, evaluated_count: int) -> None:
        """Persist bounded objective progress, never raw artifact payloads."""
        with self.lock, self.db:
            batch = self.get(batch_id)
            if batch is None:
                raise BatchError("batch_not_found", "Batch was not found.")
            payload = dict(batch)
            payload.update({"best_candidate_id": best_candidate_id, "best_value": best_value, "no_improvement_count": max(0, int(no_improvement_count)), "evaluated_count": max(0, int(evaluated_count)), "updated_at": now()})
            self.db.execute("UPDATE batches SET document_json=?,updated_at=? WHERE batch_id=?", (_json(payload), payload["updated_at"], batch_id))

    def delete(self, batch_id: str) -> bool:
        with self.lock, self.db:
            changed = self.db.execute("DELETE FROM batches WHERE batch_id=?", (batch_id,)).rowcount
            if changed:
                self.db.execute("DELETE FROM batch_candidates WHERE batch_id=?", (batch_id,))
                self.db.execute("DELETE FROM batch_events WHERE batch_id=?", (batch_id,))
                self.db.execute("DELETE FROM batch_checkpoints WHERE batch_id=?", (batch_id,))
                self.db.execute("DELETE FROM batch_leases WHERE batch_id=?", (batch_id,))
            return bool(changed)
