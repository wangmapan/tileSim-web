"""Execution boundary used by the exploration worker.

The first implementation is deliberately local and synthetic.  It has the
same narrow interface that a future Run Intake v2 adapter will implement and
never exposes subprocesses, paths, or provider details to the graph.
"""
from __future__ import annotations

import hashlib
import json
import threading
import time
from datetime import datetime, timezone
from copy import deepcopy
from abc import ABC, abstractmethod
from typing import Any, Protocol, TypedDict
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class RunIdentity(TypedDict, total=False):
    """Stable identity returned by ``create_run`` and passed to later calls.

    The graph only sees these fields.  An executor adapter may carry additional
    private state, but it must never require the worker to know a CLI command,
    filesystem path, Provider handle, or TileSim implementation detail.
    """

    run_id: str
    idempotency_key: str
    status: str
    executor_type: str
    provenance: dict[str, Any]


class RunTerminalObservation(TypedDict, total=False):
    """One externally observed terminal outcome.

    ``unknown`` is a first-class result.  It means the adapter cannot prove
    whether the external run completed and therefore the exploration must enter
    recovery instead of creating another run.
    """

    run_id: str
    status: str
    retryable: bool
    executor_type: str
    provenance: dict[str, Any]


class VerifiedMetricObservation(TypedDict, total=False):
    """Objective metric plus formal evidence identity.

    A production adapter must populate ``evidence`` from a verified run
    artifact manifest and the allow-listed evidence gateway.  A bare number is
    never sufficient.  The local executor uses the same shape only for
    synthetic consistency checks and keeps its provenance explicit.
    """

    run_id: str
    status: str
    metric_path: str
    value: float
    evidence: list[dict[str, str]]
    provenance: dict[str, Any]
    executor_type: str


class RunExecutorUnavailable(RuntimeError):
    """Stable boundary error for an executor that is not connected."""

    code = "run_intake_executor_not_connected"


class RunIntakeTransport(Protocol):
    def request(self, method: str, path: str, *, body: dict[str, Any] | None = None, headers: dict[str, str] | None = None) -> tuple[int, dict[str, Any]]: ...


class UrllibRunIntakeTransport:
    """Published Bridge HTTP transport with no CLI or Provider dependency."""
    def __init__(self, base_url: str, *, timeout_seconds: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def request(self, method: str, path: str, *, body: dict[str, Any] | None = None, headers: dict[str, str] | None = None) -> tuple[int, dict[str, Any]]:
        payload = None if body is None else json.dumps(body, separators=(",", ":")).encode("utf-8")
        request = Request(self.base_url + path, data=payload, method=method, headers={"Accept": "application/json", **(headers or {})})
        if payload is not None:
            request.add_header("Content-Type", "application/json")
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                raw = response.read()
                return int(response.status), json.loads(raw.decode("utf-8")) if raw else {}
        except HTTPError as error:
            try:
                detail = json.loads(error.read().decode("utf-8"))
            except (OSError, ValueError, json.JSONDecodeError):
                detail = {"error": {"code": "http_error", "message": str(error)}}
            return int(error.code), detail
        except (URLError, TimeoutError, OSError) as error:
            raise RunExecutorUnavailable(f"Run Intake transport is unavailable: {error}") from error


class RunExecutor(ABC):
    """Narrow execution port shared by synthetic and future Run Intake adapters.

    ``create_run`` receives one validated candidate and the immutable
    authorization envelope.  It returns a durable run identity or raises an
    error; it must be idempotent for the candidate's key.  ``wait_for_terminal``
    returns ``completed``, ``failed``, ``cancelled`` or ``unknown``.  The last
    value is never retried by the worker.  ``read_verified_metrics`` returns a
    metric bound to the run and an artifact/evidence reference.  ``cancel``
    returns confirmed ``cancelled`` or ``unknown``; only confirmed cancellation
    permits the service to release the single run slot.
    """

    executor_type = "abstract"
    provenance = {"deployment_mode": "local_dev", "source_mode": "synthetic_trace", "claim_scope": "exploratory", "production_status": "not_for_production"}
    @abstractmethod
    def create_run(self, candidate: dict[str, Any], authorization: dict[str, Any]) -> dict[str, Any]: ...

    @abstractmethod
    def wait_for_terminal(self, run_identity: dict[str, Any]) -> dict[str, Any]: ...

    @abstractmethod
    def read_verified_metrics(self, run_identity: dict[str, Any], metric_path: str) -> dict[str, Any]: ...

    @abstractmethod
    def cancel(self, run_identity: dict[str, Any]) -> dict[str, Any]: ...


class LocalSyntheticRunExecutor(RunExecutor):
    """Deterministic synthetic trace producer for local development only.

    This class does not invoke TileSim, a Provider, a subprocess, or a real
    artifact store.  Its ``verified`` response is an executor-local evidence
    shape consumed by the exploration domain for consistency tests; the
    attached provenance remains ``synthetic_trace`` and must never be reported
    as a production verified artifact.
    """

    def __init__(self, *, delay_seconds: float = 0.0):
        self.delay_seconds = max(0.0, float(delay_seconds))
        self._runs: dict[str, dict[str, Any]] = {}
        self._lock = threading.RLock()

    def create_run(self, candidate: dict[str, Any], authorization: dict[str, Any]) -> dict[str, Any]:
        # A deployment candidate may be evaluated under several workload
        # scenarios.  The scenario-specific idempotency key keeps those runs
        # distinct while preserving replay for the same candidate/scenario.
        identity = f"{candidate['candidate_digest']}:{candidate.get('run_idempotency_key', '')}"
        run_id = "explore-run-" + hashlib.sha256(identity.encode()).hexdigest()[:16]
        with self._lock:
            existing = self._runs.get(run_id)
            if existing:
                return dict(existing)
            config = candidate.get("config", {})
            numeric = []
            def walk(value: Any) -> None:
                if isinstance(value, (int, float)) and not isinstance(value, bool): numeric.append(float(value))
                elif isinstance(value, dict):
                    for item in value.values(): walk(item)
                elif isinstance(value, list):
                    for item in value: walk(item)
            walk(config)
            # A stable, finite synthetic objective.  The contract still marks
            # the result synthetic and exploratory; it is never production evidence.
            value = round(sum(numeric) / len(numeric), 6) if numeric else 0.0
            run = {"run_id": run_id, "idempotency_key": candidate["run_idempotency_key"], "status": "running", "metric_value": value, "created_at": time.time(), "executor_type": self.executor_type, "provenance": dict(self.provenance)}
            self._runs[run_id] = run
            return dict(run)

    def wait_for_terminal(self, run_identity: dict[str, Any]) -> dict[str, Any]:
        if self.delay_seconds: time.sleep(self.delay_seconds)
        with self._lock:
            run = self._runs.get(run_identity["run_id"])
            if run is None: return {"status": "unknown", "run_id": run_identity.get("run_id"), "executor_type": self.executor_type, "provenance": dict(self.provenance)}
            run["status"] = "completed"
            return dict(run)

    def read_verified_metrics(self, run_identity: dict[str, Any], metric_path: str) -> dict[str, Any]:
        with self._lock:
            run = self._runs.get(run_identity["run_id"])
        if not run or run.get("status") != "completed":
            return {"status": "unknown", "run_id": run_identity.get("run_id"), "executor_type": self.executor_type, "provenance": dict(self.provenance)}
        manifest_digest = "sha256:" + hashlib.sha256(json.dumps(run, sort_keys=True).encode()).hexdigest()
        tool_digest = "sha256:" + hashlib.sha256((run["run_id"] + metric_path).encode()).hexdigest()
        return {"status": "verified", "run_id": run["run_id"], "metric_path": metric_path, "value": run["metric_value"], "evidence": [{"run_id": run["run_id"], "manifest_digest": manifest_digest, "json_pointer": metric_path, "tool_output_digest": tool_digest}], "provenance": dict(self.provenance), "executor_type": self.executor_type, "artifact_status": "synthetic_trace_only"}

    def cancel(self, run_identity: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            run = self._runs.get(run_identity["run_id"])
            if run is None: return {"run_id": run_identity.get("run_id"), "status": "unknown", "executor_type": self.executor_type, "provenance": dict(self.provenance)}
            run["status"] = "cancelled"
            return dict(run)
    executor_type = "local_synthetic"


class RunIntakeExecutor(RunExecutor):
    """Adapter for the published formal ``POST /api/runs`` surface.

    A complete request template is supplied by the authorization envelope under
    ``run_request``. Candidate values are projected only into its authorized
    scalar ``overrides``; no simplified request is assembled by the worker.
    """

    executor_type = "run_intake_v2"
    provenance = {"deployment_mode": "local_dev", "source_mode": "synthetic_trace", "claim_scope": "exploratory", "production_status": "not_for_production"}

    def __init__(self, transport: RunIntakeTransport | None = None, *, poll_interval_seconds: float = 0.25, max_wait_seconds: float = 900.0, cancel_path=None, repository=None):
        self.transport = transport
        self.poll_interval_seconds = max(0.0, poll_interval_seconds)
        self.max_wait_seconds = max(0.1, max_wait_seconds)
        self.cancel_path = (cancel_path or (lambda run_id: f"/api/runs/{run_id}/cancel")) if isinstance(transport, UrllibRunIntakeTransport) else cancel_path
        self.repository = repository

    @staticmethod
    def _sha256_json(value: Any) -> str:
        return "sha256:" + hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

    def _require_transport(self) -> RunIntakeTransport:
        if self.transport is None:
            raise RunExecutorUnavailable("Run Intake v2 executor requires an injected published Bridge transport.")
        return self.transport

    def _formal_request(self, candidate: dict[str, Any], authorization: dict[str, Any]) -> dict[str, Any]:
        template = authorization.get("run_request")
        if not isinstance(template, dict) or not template:
            raise RunExecutorUnavailable("A complete formal run_request is required before Run Intake execution.")
        request = deepcopy(template)
        allowed = {"scenario_id", "fidelity_policy", "gpu_participation_mode", "input_mode", "run_name", "overrides", "custom_inputs", "design_space_candidates", "trace_package_id"}
        if set(request) - allowed:
            raise ValueError("formal run_request contains unsupported fields")
        # ``input_mode`` selects the published page builder path; it is not a
        # field accepted by the formal create-run v1 payload. Keep the full
        # template for provenance, but submit the builder-equivalent payload.
        request.pop("input_mode", None)
        if "overrides" not in request or not isinstance(request["overrides"], dict):
            raise RunExecutorUnavailable("Formal exploration currently requires an overrides run_request template.")
        grants = {item.get("pointer") for item in authorization.get("parameter_grants", []) if isinstance(item, dict)}
        config = candidate.get("config")
        if not isinstance(config, dict):
            raise ValueError("candidate config must be an object")
        def leaves(value: Any, prefix: str = ""):
            if isinstance(value, dict):
                for key, child in value.items():
                    yield from leaves(child, f"{prefix}/{key}")
            else:
                yield prefix, value
        changed_fields = candidate.get("changed_fields")
        if not isinstance(changed_fields, list) or not changed_fields:
            changed_fields = [pointer for pointer, _ in leaves(config)]
        def at_pointer(value: Any, pointer: str) -> Any:
            current = value
            for token in pointer.lstrip("/").replace("~1", "/").replace("~0", "~").split("/"):
                if token not in current:
                    raise ValueError(f"candidate parameter {pointer} is missing")
                current = current[token]
            return current
        for pointer in changed_fields:
            if not isinstance(pointer, str) or pointer not in grants:
                raise ValueError(f"candidate parameter {pointer} is not authorized")
            value = at_pointer(config, pointer)
            tokens = pointer[1:].replace("~1", "/").replace("~0", "~").split("/")
            # Current page descriptors publish request-relative pointers such
            # as /overrides/runtime/max_batch_size. Legacy synthetic contexts
            # used /x; retain that narrow compatibility by treating it as an
            # override leaf.
            cursor = request if tokens[0] in request else request["overrides"]
            for token in tokens[:-1]:
                cursor = cursor.setdefault(token, {})
            cursor[tokens[-1]] = value
        return request

    def create_run(self, candidate: dict[str, Any], authorization: dict[str, Any]) -> dict[str, Any]:
        transport = self._require_transport()
        key = candidate.get("run_idempotency_key")
        if not isinstance(key, str) or not key:
            raise ValueError("candidate run_idempotency_key is required")
        request = self._formal_request(candidate, authorization)
        envelope = authorization.get("execution_envelope") if isinstance(authorization.get("execution_envelope"), dict) else None
        request_digest = self._sha256_json(request)
        replayed = False
        if self.repository is not None and envelope is not None:
            existing = self.repository.run_effect(key)
            if existing is not None:
                if existing["request_digest"] != request_digest:
                    raise ValueError("formal request digest conflicts with the existing idempotency key")
                if existing.get("run_id"):
                    return {"run_id": existing["run_id"], "status": "running", "idempotency_key": key, "executor_type": self.executor_type, "provenance": dict(self.provenance), "request_digest": request_digest, "replayed": True}
                # The first POST may have committed remotely just before the
                # local envelope update. Replay the same key below; a formal
                # endpoint must return the original run instead of creating a
                # second side effect. A transport failure remains unknown.
                replayed = True
            self.repository.save_run_effect({
                "idempotency_key": key,
                "session_id": envelope["session_id"],
                "candidate_id": envelope["candidate_id"],
                "request_digest": request_digest,
                "request_summary": {
                    "scenario_id": request.get("scenario_id"),
                    "fidelity_policy": request.get("fidelity_policy"),
                    "override_paths": sorted(request.get("overrides", {}).keys()),
                    "deployment_candidate_id": envelope.get("deployment_candidate_id"),
                    "candidate_summary": deepcopy(envelope.get("candidate_summary")),
                    "scenario_summary": deepcopy(envelope.get("scenario_summary")),
                    "run_strategy_digest": envelope.get("run_strategy_digest"),
                    "run_strategy_summary": deepcopy(envelope.get("run_strategy_summary")),
                    "model_proposal": deepcopy(envelope.get("model_proposal")),
                    "model_context_digest": envelope.get("model_context_digest"),
                    "planning_plan_digest": envelope.get("planning_plan_digest"),
                },
                "executor_type": self.executor_type,
                "submitted_at": datetime.now(timezone.utc).isoformat(),
                "side_effect_status": "submitting",
                "waiting_for": "create_run",
            })
        status, payload = transport.request("POST", "/api/runs", body=request, headers={"Idempotency-Key": key, "X-TileSim-Principal": str(authorization.get("principal", "local-user")), "X-TileSim-Workspace": str(authorization.get("workspace_id", "local-workspace"))})
        if status not in {200, 202}:
            code = payload.get("error", {}).get("code", "formal_run_rejected") if isinstance(payload, dict) else "formal_run_rejected"
            raise RunExecutorUnavailable(f"Formal /api/runs rejected the candidate: {code}")
        run_id = payload.get("run_id")
        if not isinstance(run_id, str) or not run_id:
            raise RunExecutorUnavailable("Formal /api/runs response did not contain a run_id.")
        if self.repository is not None and envelope is not None:
            self.repository.update_run_effect(key, side_effect_status="submitted", waiting_for="wait_run", run_id=run_id, confirmed_at=datetime.now(timezone.utc).isoformat(), last_result={"run_id": run_id, "status": payload.get("status", "preparing")}, result_summary={"status": payload.get("status", "preparing"), "run_id": run_id})
        return {"run_id": run_id, "status": payload.get("status", "preparing"), "idempotency_key": key, "executor_type": self.executor_type, "provenance": dict(self.provenance), "request_digest": request_digest, "replayed": replayed, "principal": authorization.get("principal", "local-user"), "workspace_id": authorization.get("workspace_id", "local-workspace"), "backend_identity": authorization.get("backend_identity"), "schema_set_revision": authorization.get("schema_set_revision")}

    def wait_for_terminal(self, run_identity: dict[str, Any]) -> dict[str, Any]:
        transport = self._require_transport()
        run_id = run_identity.get("run_id")
        if not isinstance(run_id, str) or not run_id:
            return {"status": "unknown", "executor_type": self.executor_type, "provenance": dict(self.provenance)}
        deadline = time.monotonic() + self.max_wait_seconds
        while time.monotonic() < deadline:
            try:
                status, payload = transport.request("GET", f"/api/runs/{run_id}")
            except RunExecutorUnavailable:
                return {"run_id": run_id, "status": "unknown", "executor_type": self.executor_type, "provenance": dict(self.provenance)}
            if status != 200:
                return {"run_id": run_id, "status": "unknown", "executor_type": self.executor_type, "provenance": dict(self.provenance)}
            run_status = payload.get("status")
            if run_status in {"completed", "failed", "cancelled"}:
                if self.repository is not None and isinstance(run_identity.get("idempotency_key"), str):
                    self.repository.update_run_effect(run_identity["idempotency_key"], side_effect_status="terminal", waiting_for="read_verified_metrics" if run_status == "completed" else "complete", confirmed_at=datetime.now(timezone.utc).isoformat(), last_result={"run_id": run_id, "status": run_status}, result_summary={"status": run_status, "run_id": run_id})
                return {"run_id": run_id, "status": run_status, "retryable": run_status == "failed", "executor_type": self.executor_type, "provenance": dict(self.provenance)}
            time.sleep(self.poll_interval_seconds)
        return {"run_id": run_id, "status": "unknown", "executor_type": self.executor_type, "provenance": dict(self.provenance)}

    def read_verified_metrics(self, run_identity: dict[str, Any], metric_path: str) -> dict[str, Any]:
        transport = self._require_transport()
        run_id = run_identity.get("run_id")
        if not isinstance(run_id, str) or not run_id:
            return {"status": "unknown", "executor_type": self.executor_type, "provenance": dict(self.provenance)}
        status, manifest = transport.request("GET", f"/api/runs/{run_id}/artifacts")
        if status != 200 or manifest.get("run_id") != run_id:
            return {"run_id": run_id, "status": "unknown", "executor_type": self.executor_type, "provenance": dict(self.provenance)}
        entry = next((item for item in manifest.get("artifacts", []) if item.get("artifact_id") == "metrics" and item.get("contract_status") == "supported" and item.get("content_status") == "ready"), None)
        if not isinstance(entry, dict):
            return {"run_id": run_id, "status": "unknown", "executor_type": self.executor_type, "provenance": dict(self.provenance)}
        status, document = transport.request("GET", f"/api/runs/{run_id}/files/metrics")
        if status != 200:
            return {"run_id": run_id, "status": "unknown", "executor_type": self.executor_type, "provenance": dict(self.provenance)}
        current: Any = document
        try:
            for token in metric_path.removeprefix("/").split("/"):
                current = current[token.replace("~1", "/").replace("~0", "~")] if isinstance(current, dict) else current[int(token)]
        except (KeyError, IndexError, TypeError, ValueError) as error:
            raise ValueError("verified metric path is absent from the metrics artifact") from error
        if isinstance(current, bool) or not isinstance(current, (int, float)):
            raise ValueError("verified metric is not numeric")
        result = {"run_id": run_id, "status": "verified", "metric_path": metric_path, "value": float(current), "evidence": [{"run_id": run_id, "manifest_digest": self._sha256_json(manifest), "json_pointer": metric_path, "tool_output_digest": self._sha256_json(document)}], "executor_type": self.executor_type, "provenance": dict(self.provenance), "artifact_status": "verified_formal_artifact", "artifact_id": "metrics", "artifact_sha256": entry.get("sha256")}
        if self.repository is not None and isinstance(run_identity.get("idempotency_key"), str):
            self.repository.update_run_effect(run_identity["idempotency_key"], side_effect_status="verified", waiting_for="complete", confirmed_at=datetime.now(timezone.utc).isoformat(), last_result=result, result_summary={"status": result["status"], "run_id": run_id, "metric_path": metric_path, "artifact_id": result.get("artifact_id")})
        return result

    def cancel(self, run_identity: dict[str, Any]) -> dict[str, Any]:
        run_id = run_identity.get("run_id")
        if not isinstance(run_id, str) or not run_id or self.cancel_path is None:
            if self.repository is not None and isinstance(run_identity.get("idempotency_key"), str):
                try:
                    self.repository.update_run_effect(run_identity["idempotency_key"], side_effect_status="cancel_unknown", waiting_for="cancel")
                except Exception:
                    pass
            return {"run_id": run_id, "status": "unknown", "reason": "formal_run_cancel_endpoint_unpublished", "executor_type": self.executor_type, "provenance": dict(self.provenance)}
        body = {
            "run_id": run_id,
            "backend_identity": run_identity.get("backend_identity"),
            "schema_set_revision": run_identity.get("schema_set_revision"),
        }
        headers = {
            # The formal Bridge bounds idempotency keys to 128 characters.
            # Exploration keys include a session and candidate digest and can
            # exceed that boundary, so bind cancellation to a stable digest
            # rather than truncating or dropping the original identity.
            "Idempotency-Key": "cancel:" + hashlib.sha256(
                str(run_identity.get("idempotency_key", run_id)).encode("utf-8")
            ).hexdigest(),
            "X-TileSim-Principal": str(run_identity.get("principal", "local-user")),
            "X-TileSim-Workspace": str(run_identity.get("workspace_id", "local-workspace")),
            "X-TileSim-Scopes": "agent:cancel_experiment,agent:read_run",
        }
        try:
            status, payload = self._require_transport().request("POST", self.cancel_path(run_id), body=body, headers=headers)
        except RunExecutorUnavailable:
            status, payload = 0, {}
        result_status = payload.get("status") if isinstance(payload, dict) else None
        if status == 200 and result_status in {"confirmed_cancelled", "already_terminal", "cancelled"}:
            if result_status in {"confirmed_cancelled", "cancelled"} and self.repository is not None and isinstance(run_identity.get("idempotency_key"), str):
                self.repository.update_run_effect(run_identity["idempotency_key"], side_effect_status="cancelled", waiting_for="complete", confirmed_at=datetime.now(timezone.utc).isoformat(), last_result={"run_id": run_id, "status": "cancelled"}, result_summary={"status": "cancelled", "run_id": run_id})
            return {"run_id": run_id, "status": "cancelled" if result_status in {"confirmed_cancelled", "cancelled"} else "unknown", "formal_status": result_status, "executor_type": self.executor_type, "provenance": dict(self.provenance)}
        if self.repository is not None and isinstance(run_identity.get("idempotency_key"), str):
            try:
                self.repository.update_run_effect(run_identity["idempotency_key"], side_effect_status="cancel_unknown", waiting_for="cancel")
            except Exception:
                pass
        return {"run_id": run_id, "status": "unknown", "reason": "formal_cancel_unconfirmed", "executor_type": self.executor_type, "provenance": dict(self.provenance)}

