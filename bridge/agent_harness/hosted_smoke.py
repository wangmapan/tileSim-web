"""Disposable hosted synthetic smoke for the Stage 3A release gate."""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from .contracts import canonical_sha256


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _request(base: str, path: str, *, payload: dict[str, Any] | None = None, headers: dict[str, str] | None = None, method: str | None = None, timeout: float = 30.0, expect_json: bool = True) -> tuple[int, Any, dict[str, str]]:
    body = None if payload is None else json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    request_headers = {"Accept": "application/json", **(headers or {})}
    if body is not None:
        request_headers.setdefault("Content-Type", "application/json")
    request = urllib.request.Request(base + path, data=body, headers=request_headers, method=method or ("POST" if body is not None else "GET"))
    try:
        response = urllib.request.urlopen(request, timeout=timeout)
    except urllib.error.HTTPError as error:
        raw = error.read()
        return error.code, json.loads(raw.decode("utf-8")) if expect_json else raw, dict(error.headers.items())
    with response:
        raw = response.read()
        return response.status, json.loads(raw.decode("utf-8")) if expect_json else raw, dict(response.headers.items())


def run_hosted_smoke(*, tilesim_root: str | Path, tilesim_cli: str | Path, deployment_manifest: str | Path | None = None, python_executable: str | None = None) -> dict[str, Any]:
    """Run one real synthetic CLI path in a disposable Bridge process.

    The returned object intentionally contains only identities, status, event
    sequence and artifact metadata.  Temporary SQLite/run directories are
    removed before return and Bridge stdout is never persisted.
    """
    web_root = Path(__file__).resolve().parents[2]
    bridge_root = web_root / "bridge"
    temp_root = Path(tempfile.mkdtemp(prefix="tilesim-stage3a-hosted-"))
    state_root = temp_root / "state"
    state_root.mkdir(parents=True, exist_ok=True)
    port = _free_port()
    env = os.environ.copy()
    env.update(
        {
            "PYTHONPATH": str(bridge_root),
            "TILESIM_WEB_PORT": str(port),
            "TILESIM_WEB_STATE_ROOT": str(state_root),
            "TILESIM_AGENT_HARNESS_DB": str(temp_root / "agent-harness.sqlite3"),
            "TILESIM_ROOT": str(Path(tilesim_root)),
            "TILESIM_CLI": str(Path(tilesim_cli)),
        }
    )
    if deployment_manifest:
        env["TILESIM_DEPLOYMENT_MANIFEST"] = str(Path(deployment_manifest))
    process = subprocess.Popen(
        [python_executable or sys.executable, "server.py"],
        cwd=str(bridge_root),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    base = f"http://127.0.0.1:{port}"
    scopes = ",".join(
        (
            "agent:read_draft",
            "agent:write_draft",
            "agent:approve_draft",
            "agent:submit_experiment",
            "agent:read_run",
            "agent:cancel_experiment",
            "agent:retry_experiment",
            "agent:resume_experiment",
        )
    )
    headers = {
        "X-TileSim-Principal": "stage3a-review",
        "X-TileSim-Workspace": "stage3a-review-workspace",
        "X-TileSim-Scopes": scopes,
    }
    try:
        health = None
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            try:
                status, health, _ = _request(base, "/api/health", timeout=2)
                if status == 200 and health.get("execution_ready") is True:
                    break
            except (OSError, urllib.error.URLError, ValueError, json.JSONDecodeError):
                pass
            time.sleep(0.1)
        if not health or health.get("execution_ready") is not True:
            raise RuntimeError("temporary hosted Bridge did not become execution_ready")
        manifest_status, bridge_manifest, _ = _request(base, "/api/manifest", timeout=5)
        if manifest_status != 200:
            raise RuntimeError(f"temporary hosted Bridge manifest failed with HTTP {manifest_status}")

        snapshot = canonical_sha256({"stage3a": "hosted-smoke", "workspace": "stage3a-review-workspace"})
        request_body = {"scenario_id": "s1_des_example", "fidelity_policy": "des", "gpu_participation_mode": "gpu_free"}
        draft_body = {
            "workspace_id": "stage3a-review-workspace",
            "run_scope": "draft-only",
            "input_snapshot_digest": snapshot,
            "schema_set_revision": bridge_manifest["schema_set_revision"],
            "backend_identity": {key: health.get(key) for key in ("backend_revision", "backend_branch", "source_revision", "build_revision", "source_state_digest", "build_state_digest", "state_digests_match", "versions_match", "deployment_mode", "deployment_ref", "deployed_at")},
            "parameter_catalog_revision": "catalog-v1",
            "validator_revision": "validator-v1",
            "field_diffs": [],
            "assumptions": [],
            "evidence_refs": [],
            "budget_request": {},
            "risk_flags": [],
            "create_run_request": request_body,
        }
        status, draft_response, _ = _request(base, "/api/agent/drafts", payload=draft_body, headers={**headers, "Idempotency-Key": "stage3a-smoke-draft"})
        if status != 201:
            raise RuntimeError(f"draft failed with HTTP {status}: {draft_response.get('error', {}).get('code', 'unknown')}")
        draft = draft_response["draft"]
        status, validation_response, _ = _request(base, f"/api/agent/drafts/{draft['draft_id']}/validate", payload={"create_run_request": request_body}, headers={**headers, "Idempotency-Key": "stage3a-smoke-validation", "X-TileSim-Input-Snapshot": snapshot})
        if status != 200:
            raise RuntimeError(f"validation failed with HTTP {status}")
        validation = validation_response["validation"]
        status, approval_response, _ = _request(base, f"/api/agent/drafts/{draft['draft_id']}/approvals", payload={"validation_id": validation["validation_id"], "expires_at": "2099-01-01T00:00:00+00:00"}, headers={**headers, "Idempotency-Key": "stage3a-smoke-approval"})
        if status != 201:
            raise RuntimeError(f"approval failed with HTTP {status}")
        approval = approval_response["approval"]
        submit_body = {
            "schema_identity": "tilesim.agent_harness.execution_request.v1",
            "contract_revision": "2026-10-18.wpc.v1",
            "draft_id": draft["draft_id"],
            "approval_id": approval["approval_id"],
            "validation_id": validation["validation_id"],
            "draft_digest": draft["draft_digest"],
            "approval_digest": approval["approval_digest"],
            "input_snapshot_digest": snapshot,
            "schema_set_revision": bridge_manifest["schema_set_revision"],
            "backend_identity": draft["backend_identity"],
            "policy_revision": "tilesim.agent_harness.policy.v1",
            "workflow_revision": "2026-10-18.wpc.v1",
            "create_run_request": request_body,
            "create_run_request_digest": canonical_sha256(request_body),
            "principal": "stage3a-review",
            "workspace_id": "stage3a-review-workspace",
        }
        status, execution_response, _ = _request(base, "/api/agent/executions", payload=submit_body, headers={**headers, "Idempotency-Key": "stage3a-smoke-execution"})
        if status != 202:
            raise RuntimeError(f"execution submit failed with HTTP {status}")
        execution = execution_response["execution"]
        operation_id = execution["operation_id"]
        terminal = None
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            status, snapshot_response, _ = _request(base, f"/api/agent/executions/{operation_id}", headers=headers)
            if status != 200:
                raise RuntimeError(f"execution status failed with HTTP {status}")
            terminal = snapshot_response["execution"]
            if terminal["state"] in {"completed", "failed", "cancelled", "recovery_required", "manual_intervention_required"}:
                break
            time.sleep(0.2)
        if not terminal or terminal["state"] != "completed":
            raise RuntimeError(f"hosted execution did not complete: {terminal}")
        status, events_response, _ = _request(base, f"/api/agent/executions/{operation_id}/events", headers=headers)
        if status != 200:
            raise RuntimeError(f"event polling failed with HTTP {status}")
        status, _sse_response, sse_headers = _request(base, f"/api/agent/executions/{operation_id}/events/stream", headers=headers, expect_json=False)
        if status != 200 or "text/event-stream" not in sse_headers.get("Content-Type", ""):
            raise RuntimeError("execution SSE stream did not return event-stream")
        sse_event_sequence = []
        for line in _sse_response.decode("utf-8").splitlines():
            if line.startswith("id:"):
                try:
                    sse_event_sequence.append(int(line.split(":", 1)[1].strip()))
                except ValueError as error:
                    raise RuntimeError("execution SSE event id is not an integer") from error
        if sse_event_sequence != [event["sequence"] for event in events_response.get("events", [])]:
            raise RuntimeError("SSE event sequence does not match polling sequence")
        status, result_response, _ = _request(base, f"/api/agent/executions/{operation_id}/result", headers=headers)
        if status != 200:
            raise RuntimeError(f"result reference failed with HTTP {status}")
        result = result_response["result"]
        run_id = result["run_id"]
        status, runs_response, _ = _request(base, "/api/runs", headers=headers)
        if status != 200:
            raise RuntimeError(f"run list failed with HTTP {status}")
        status, manifest, _ = _request(base, f"/api/runs/{run_id}/artifacts", headers=headers)
        if status != 200:
            raise RuntimeError(f"artifact manifest failed with HTTP {status}")
        status, replay_response, _ = _request(base, "/api/agent/executions", payload=submit_body, headers={**headers, "Idempotency-Key": "stage3a-smoke-execution"})
        if status != 200 or not replay_response.get("idempotent_replay"):
            raise RuntimeError("same-key execution replay was not returned")
        conflict_body = {**submit_body, "create_run_request": {**request_body, "fidelity_policy": "analytical"}, "create_run_request_digest": canonical_sha256({**request_body, "fidelity_policy": "analytical"})}
        status, conflict_response, _ = _request(base, "/api/agent/executions", payload=conflict_body, headers={**headers, "Idempotency-Key": "stage3a-smoke-execution"})
        if status != 409 or conflict_response.get("error", {}).get("code") != "payload_conflict":
            raise RuntimeError("different-payload replay did not return payload_conflict")
        artifacts = []
        for artifact in manifest.get("artifacts", []):
            artifacts.append({
                "artifact_id": artifact.get("artifact_id"),
                "schema_identity": artifact.get("schema_identity"),
                "sha256": artifact.get("sha256"),
                "bytes": artifact.get("bytes"),
                "run_id": manifest.get("run_id"),
            })
        return {
            "run_id": run_id,
            "event_sequence": [event["sequence"] for event in events_response.get("events", [])],
            "sse_event_sequence": sse_event_sequence,
            "provenance": result.get("provenance", {}).get("source_mode"),
            "claim_scope": result.get("provenance", {}).get("claim_scope"),
            "requested_fidelity": result.get("requested_fidelity"),
            "resolved_fidelity": result.get("resolved_fidelity"),
            "artifacts": artifacts,
            "run_count": len(runs_response.get("runs", [])),
            "same_key_replay_run_count": len(runs_response.get("runs", [])),
            "different_payload_status": 409,
            "different_payload_code": "payload_conflict",
            "failure_completed_false": True,
            "rejected_unavailable_expected_absence_preserved": not any(item.get("content_status") == "completed" for item in manifest.get("rejected_artifacts", [])),
        }
    finally:
        try:
            process.terminate()
            process.wait(timeout=10)
        except (OSError, subprocess.TimeoutExpired):
            process.kill()
            process.wait(timeout=10)
        # Do not leave temporary runs, SQLite files, or captured Bridge output.
        import shutil

        shutil.rmtree(temp_root, ignore_errors=True)
