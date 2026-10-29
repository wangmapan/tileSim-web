#!/usr/bin/env python3
"""TileSim Web local bridge.

This intentionally small server serves the standalone dashboard and exposes a
strict, allow-listed execution surface for the local TileSimCLI binary.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
import http.client
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from api import responses
from infra import identity
from repositories import runs as run_repository
from services import execution
from services import evidence_agent as evidence_agent_service
from services import capability_catalog
from services import run_intake as run_intake_service
from services import trace_packages
from services import week7
from providers import assistant_model
from providers import agent_intent
from providers import evidence_agent as evidence_agent_provider_contract
from providers.evidence_agent import ProviderError, ProviderStructuredOutputError, ProviderTimeoutError

from agent_harness.contracts import (
    CONTRACT_REVISION as AGENT_HARNESS_CONTRACT_REVISION,
    ERROR_SCHEMA_IDENTITY as AGENT_HARNESS_ERROR_SCHEMA_IDENTITY,
    POLICY_REVISION as AGENT_HARNESS_POLICY_REVISION,
    canonical_sha256 as harness_canonical_sha256,
    HarnessContractError,
)
from agent_harness.store import DurableHarnessStore, HarnessStoreError
from agent_harness.queue import HarnessQueue, QueueConfig
from agent_harness import tools as harness_tools
from agent_harness.stage2 import (
    APPROVAL_STATUSES,
    STAGE2_SCHEMA_IDENTITIES,
    SUCCESSOR_CONTRACT_REVISION,
    draft_digest as stage2_draft_digest,
    now_iso as stage2_now,
    require_digest as stage2_require_digest,
    validate_stage2_approval,
    validate_stage2_create,
    validation_report as stage2_validation_report,
)
from agent_harness.stage3 import (
    EXECUTION_CANCELABLE_STATES,
    EXECUTION_CONTRACT_REVISION,
    EXECUTION_SCHEMA_IDENTITIES,
    EXECUTION_STATES,
    EXECUTION_TERMINAL_STATES,
    execution_operation,
    event_payload_digest,
    request_digest as stage3_request_digest,
    result_reference as stage3_result_reference,
    validate_mutation_request,
    validate_submit_request,
)
from agent_harness.optimization import (
    CONTRACT_REVISION as OPTIMIZATION_CONTRACT_REVISION,
    POLICY_REVISION as OPTIMIZATION_POLICY_REVISION,
    PROVENANCE as OPTIMIZATION_PROVENANCE,
    SCHEMA_IDENTITIES as OPTIMIZATION_SCHEMA_IDENTITIES,
    SESSION_STATES as OPTIMIZATION_SESSION_STATES,
    TERMINAL_STATES as OPTIMIZATION_TERMINAL_STATES,
    TOOL_REGISTRY as OPTIMIZATION_TOOL_REGISTRY,
    OptimizationError,
    OptimizationStore,
    MAX_BUDGET_SECONDS,
    build_attempt_history,
    canonical_sha256 as optimization_digest,
    candidate_document as optimization_candidate_document,
    validate_session_request,
)
from agent_harness.authorization import (
    AuthorizationError,
    issue_authorization,
    revoke_authorization,
    validate_authorization,
    verify_authorization,
)
from services.agent_loop import run_agent_turn
from services.agent_deletion import AgentDeletionCoordinator
from agent_harness.batch import (
    CONTRACT_REVISION as BATCH_CONTRACT_REVISION,
    POLICY_REVISION as BATCH_POLICY_REVISION,
    PROVENANCE as BATCH_PROVENANCE,
    SCHEMA_IDENTITIES as BATCH_SCHEMA_IDENTITIES,
    STATES as BATCH_STATES,
    TERMINAL_STATES as BATCH_TERMINAL_STATES,
    ACTIVE_STATES as BATCH_ACTIVE_STATES,
    BatchError,
    BatchStore,
    validate_batch_request,
)
from repositories.agent_flows import AgentFlowStore, AgentFlowStoreError
from services.agent_flow import (
    AgentFlowError,
    AgentFlowService,
    FLOW_CONTRACT_REVISION,
    FLOW_ERROR_SCHEMA_IDENTITY,
)

# Generic Harness operations use recovery/manual-intervention as durable
# observation boundaries.  They are not ordinary completed/failed/cancelled
# terminals (explicit recovery or human action is still required), but replay
# responses and SSE must expose the same boundary marker.
GENERIC_HARNESS_OBSERVATION_BOUNDARY_STATES = frozenset(
    {"completed", "failed", "cancelled", "recovery_required", "manual_intervention_required"}
)

from contracts import evidence_agent
from contracts.schema_set import compute_schema_set_revision
from contracts.agent_orchestration_capability import load_catalog
from contracts.experiment_descriptor import (
    DESIGN_SPACE_MODES,
    DESCRIPTOR_REVISION,
    GPU_PARTICIPATION_MODES,
    INPUT_MODES,
    PARAMETER_DEFINITIONS,
    REQUESTED_FIDELITY_OPTIONS,
    SCENARIO_OPTIONS,
    build_experiment_descriptor,
)
from contracts.validation import (
    MAX_CUSTOM_INPUT_BYTES,
    MAX_DESIGN_SPACE_CANDIDATES,
    MAX_DESIGN_SPACE_TRANSFERS,
    MAX_EXACT_JSON_INTEGER,
    SCHEDULERS,
    RequestValidationError,
    bounded_number,
    is_number,
    pointer_for_label,
    request_validation_error,
    validate_custom_inputs,
    validate_design_space_candidates,
    validate_overrides,
    validate_run_name,
)
from contracts.run_request import validate_run_request


BRIDGE_ROOT = Path(__file__).resolve().parent
# Deployment scripts query these two values before they stop an already
# running Bridge.  They are deliberately read-only commands and must not
# open any durable Agent Harness SQLite store: on a mounted Windows worktree,
# a second WAL connection can report the database as malformed while the
# serving process still owns the lock.  Keep this fence close to argv parsing
# so importing the module for either diagnostic cannot touch user state.
_READ_ONLY_CLI_COMMANDS = frozenset({"--print-source-state-digest", "--print-schema-set-revision"})
_READ_ONLY_CLI = (
    len(sys.argv) == 2 and sys.argv[1] in _READ_ONLY_CLI_COMMANDS
) or Path(sys.argv[0]).name == "check_schema_set_revision.py"
_package_root_value = os.environ.get("TILESIM_PACKAGE_ROOT", "").strip()
PACKAGE_ROOT = Path(_package_root_value).resolve() if _package_root_value else None
_package_manifest_path = PACKAGE_ROOT / "release.json" if PACKAGE_ROOT else None
_package_manifest = identity.deployment_manifest(_package_manifest_path) if _package_manifest_path else {}
_packaged_runtime_kind = os.environ.get("TILESIM_RUNTIME_KIND", "") or str(_package_manifest.get("runtime_kind", ""))
WEB_ROOT = Path(os.environ["TILESIM_WEB_ROOT"]).resolve() if os.environ.get("TILESIM_WEB_ROOT") else (
    PACKAGE_ROOT / "app/web" if PACKAGE_ROOT else BRIDGE_ROOT.parent
)
STATIC_ROOT = Path(os.environ["TILESIM_STATIC_ROOT"]).resolve() if os.environ.get("TILESIM_STATIC_ROOT") else (
    WEB_ROOT / "dist" if (WEB_ROOT / "dist/index.html").is_file() else WEB_ROOT
)
STATE_ROOT = Path(os.environ.get("TILESIM_WEB_STATE_ROOT", str(PACKAGE_ROOT / "user-data" if PACKAGE_ROOT else WEB_ROOT)))
_default_tilesim_root = (
    Path("/opt/tilesim/backend/resources")
    if PACKAGE_ROOT and _packaged_runtime_kind == "wsl-prebuilt"
    else PACKAGE_ROOT / "app/backend/resources"
    if PACKAGE_ROOT
    else Path("/mnt/d/tileSim")
)
_default_tilesim_cli = (
    Path("/opt/tilesim/bin/TileSimCLI")
    if PACKAGE_ROOT and _packaged_runtime_kind == "wsl-prebuilt"
    else PACKAGE_ROOT / "runtime/native/TileSimCLI.exe"
    if PACKAGE_ROOT
    else Path("/home/mapanwang/tilesim-build/TileSimCLI")
)
TILESIM_ROOT = Path(os.environ.get("TILESIM_ROOT", str(_default_tilesim_root)))
TILESIM_CLI = Path(os.environ.get("TILESIM_CLI", str(_default_tilesim_cli)))
TRACE_PACKAGE_ROOT = (
    Path(os.environ["TILESIM_TRACE_PACKAGE_ROOT"])
    if os.environ.get("TILESIM_TRACE_PACKAGE_ROOT")
    else None
)
DEPLOYMENT_MANIFEST = Path(os.environ.get(
    "TILESIM_DEPLOYMENT_MANIFEST",
    str(PACKAGE_ROOT / "release.json" if PACKAGE_ROOT else "/mnt/d/tileSim-web/runtime/backend-current.json"),
))
RUNS_ROOT = STATE_ROOT / "runs"
CONTRACT_ROOT = Path(os.environ.get("TILESIM_CONTRACT_ROOT", str(BRIDGE_ROOT / "contracts")))


def load_contract_json(path: Path) -> dict:
    """Load a checked-in contract document; startup must fail closed if it is invalid."""
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise RuntimeError(f"Bridge contract must be a JSON object: {path}")
    return value


OPENAPI_CONTRACT = load_contract_json(CONTRACT_ROOT / "openapi.json")
CONTRACT_METADATA = OPENAPI_CONTRACT["x-tilesim-contract"]

SCENARIOS = {
    "s1_des_example": {
        "label": next(
            option["label"]
            for option in SCENARIO_OPTIONS
            if option["scenario_id"] == "s1_des_example"
        ),
        "from": "S1",
        "to": "S6",
        "trace": TILESIM_ROOT / "docs/examples/s1_runtime_trace.json",
        "topology": TILESIM_ROOT / "docs/examples/modular_fabric_scenario.json",
    },
    "dense_des_package": {
        "label": next(option["label"] for option in SCENARIO_OPTIONS if option["scenario_id"] == "dense_des_package"),
        "from": "S0",
        "to": "S6",
        "trace": TILESIM_ROOT / "docs/examples/dense_timing/workload.json",
        "topology": TILESIM_ROOT / "docs/examples/dense_timing/topology.json",
    },
    "pd_disaggregation_example": {
        "label": next(
            option["label"]
            for option in SCENARIO_OPTIONS
            if option["scenario_id"] == "pd_disaggregation_example"
        ),
        "from": "S1",
        "to": "S6",
        "trace": TILESIM_ROOT / "docs/examples/pd_runtime_trace.json",
        "topology": TILESIM_ROOT / "docs/examples/modular_fabric_scenario.json",
        "request_attribution_applicable": True,
        "runtime_evidence_applicable": True,
    },
}


MODEL_CATALOG_FILES = (
    "docs/examples/s1_runtime_trace.json",
    "docs/examples/s1_runtime_trace_vllm_hosted.json",
    "docs/examples/s1_runtime_trace_sglang_hosted.json",
    "docs/examples/s1_runtime_trace_tensorrt_llm_hosted.json",
    "docs/examples/kernel_efficiency/h100_llama2_portable.json",
    "docs/examples/pd_runtime_trace.json",
)

MODEL_CATALOG_IDS = (
    "qwen3-0.6b",
    "qwen2.5-math-7b-instruct",
)


def simulation_model_ids() -> list[str]:
    model_ids: set[str] = set(MODEL_CATALOG_IDS)
    for relative_path in MODEL_CATALOG_FILES:
        trace_path = TILESIM_ROOT / relative_path
        if not trace_path.is_file():
            continue
        try:
            trace = json.loads(trace_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            continue
        if not isinstance(trace, dict):
            continue
        for request in trace.get("requests", []):
            if isinstance(request, dict):
                model_id = request.get("model_id")
                if isinstance(model_id, str) and model_id.strip():
                    model_ids.add(model_id.strip())
        dense_execution = trace.get("dense_execution")
        if isinstance(dense_execution, dict):
            model_id = dense_execution.get("model_id")
            if isinstance(model_id, str) and model_id.strip():
                model_ids.add(model_id.strip())
        model_id = trace.get("model_id")
        if isinstance(model_id, str) and model_id.strip():
            model_ids.add(model_id.strip())
    return sorted(model_ids)


ALLOWED_FIDELITY_POLICIES = {
    option["fidelity_policy"] for option in REQUESTED_FIDELITY_OPTIONS if option["available"]
}
ALLOWED_GPU_PARTICIPATION_MODES = {
    option["gpu_participation_mode"] for option in GPU_PARTICIPATION_MODES if option["available"]
}
MAX_REQUEST_BYTES = 2_100_000
MAX_EVIDENCE_AGENT_REQUEST_BYTES = 1_500_000
MAX_ACTIVE_RUNS = max(1, int(os.environ.get("TILESIM_MAX_ACTIVE_RUNS", "1")))
SSE_WAIT_TIMEOUT_SECONDS = 15.0
SSE_HEARTBEAT_SECONDS = 5.0
API_VERSION = CONTRACT_METADATA["api_version"]
API_MANIFEST_SCHEMA = CONTRACT_METADATA["manifest_schema"]
ERROR_SCHEMA_VERSION = CONTRACT_METADATA["error_schema"]
ARTIFACT_MANIFEST_SCHEMA = CONTRACT_METADATA["artifact_manifest_schema"]
KNOWN_REPORT_SCHEMA_IDENTITIES = CONTRACT_METADATA["known_report_schema_identities"]
EXPERIMENT_DESCRIPTOR_CONTRACT = CONTRACT_METADATA["experiment_descriptor"]
REPORT_FILE_NAMES = CONTRACT_METADATA["report_files"]
JSON_ARTIFACT_DEFINITIONS = CONTRACT_METADATA["artifacts"]
RUN_CREATION_CONTRACT = CONTRACT_METADATA["run_creation"]
RUN_EVENT_CONTRACT = CONTRACT_METADATA["run_events"]
EVIDENCE_AGENT_CONTRACT = CONTRACT_METADATA["evidence_agent"]
AGENT_ORCHESTRATION_CAPABILITY_CONTRACT = CONTRACT_METADATA[
    "agent_orchestration_capability"
]
AGENT_FLOW_CONTRACT = CONTRACT_METADATA["agent_flow"]
TRACE_PACKAGE_CONTRACT = CONTRACT_METADATA["trace_packages"]
SCHEMA_SET_REVISION = compute_schema_set_revision(CONTRACT_ROOT)
runs: dict[str, dict] = {}
runs_lock = threading.Lock()
metadata_lock = threading.RLock()
BRIDGE_INSTANCE_ID = uuid.uuid4().hex
week7_operation_lock = threading.Lock()
evidence_agent_operation_lock = threading.Lock()
evidence_agent_provider = (
    None
    if _READ_ONLY_CLI
    else evidence_agent_provider_contract.ProviderRuntime.from_environment()
)

# Agent Harness is a Bridge-owned, single-host durable MVP.  The simulator and
# its run entrypoint remain untouched; the queue only owns harness lifecycle
# metadata and read-only tool calls.
AGENT_HARNESS_DB = Path(
    os.environ.get("TILESIM_AGENT_HARNESS_DB", str(STATE_ROOT / "runtime" / "agent-harness.sqlite3"))
)
OPTIMIZATION_DB = Path(
    os.environ.get("TILESIM_AGENT_OPTIMIZATION_DB", str(STATE_ROOT / "runtime" / "agent-harness-optimization.sqlite3"))
)
BATCH_DB = Path(
    os.environ.get("TILESIM_AGENT_BATCH_DB", str(STATE_ROOT / "runtime" / "agent-harness-batch.sqlite3"))
)
AGENT_FLOW_DB = Path(
    os.environ.get("TILESIM_AGENT_FLOW_DB", str(STATE_ROOT / "runtime" / "agent-flow.sqlite3"))
)
if _READ_ONLY_CLI:
    # These names remain defined because the rest of this module contains the
    # normal HTTP handlers.  None is safe here: the read-only command exits
    # from the __main__ block without constructing a handler or queue.
    optimization_store = None
    batch_store = None
    agent_flow_store = None
    agent_flow_service = None
    agent_deletion_coordinator = None
else:
    optimization_store = OptimizationStore(OPTIMIZATION_DB)
    optimization_store.recover_inflight()
    batch_store = BatchStore(BATCH_DB)
    batch_store.recover_inflight()
    agent_flow_store = AgentFlowStore(AGENT_FLOW_DB)
    agent_flow_service = AgentFlowService(
        agent_flow_store,
        schema_set_revision=SCHEMA_SET_REVISION,
        backend_identity_provider=lambda: harness_backend_identity(),
    )
    agent_deletion_coordinator = AgentDeletionCoordinator(
        {
            "harness": agent_harness_store if "agent_harness_store" in globals() else None,
            "batch": batch_store,
            "optimization": optimization_store,
            "flow": agent_flow_store,
        },
        STATE_ROOT / "runtime" / "agent-deletion.sqlite3",
    )
batch_workers: dict[str, threading.Thread] = {}
batch_workers_lock = threading.RLock()
optimization_workers: dict[str, threading.Thread] = {}
optimization_workers_lock = threading.RLock()

# New autonomous behavior is opt-in twice: tool calling is separately gated,
# and the optimization worker requires an explicit autonomy mode.  The default
# therefore remains byte-for-byte compatible with the human-approval path.
AGENT_TOOLS_ENABLED = os.environ.get("TILESIM_AGENT_TOOLS", "off").strip().lower() in {"on", "true", "1"}
AGENT_AUTONOMY_MODE = os.environ.get("TILESIM_AGENT_AUTONOMY", "off").strip().lower()
if AGENT_AUTONOMY_MODE not in {"off", "propose", "auto"}:
    AGENT_AUTONOMY_MODE = "off"

AGENT_SECURITY_STOP_ERRORS = frozenset(
    {
        "authorization_inactive",
        "authorization_revoked",
        "authorization_required",
        "authorization_expired",
        "authorization_invalid",
        "authorization_digest_mismatch",
        "invalid_tool_allowlist",
        "protected_field",
        "snapshot_mismatch",
        "schema_revision_mismatch",
        "backend_identity_mismatch",
        "principal_mismatch",
        "workspace_mismatch",
        "session_not_found",
    }
)

# Named SSE frames are an additive projection for Agent diagnostics.  The
# durable ``workflow`` frame remains the replay/cursor fence for older
# clients; named frames deliberately carry no event id and are de-duplicated
# by the browser adapter against their workflow counterpart.
OPTIMIZATION_AGENT_EVENT_NAMES = frozenset(
    {
        "agent.step",
        "agent.tool_call",
        "agent.tool_result",
        "agent.verdict",
        "agent.degraded",
        "agent.ask_user",
    }
)


def _process_harness_operation(operation_id: str) -> None:
    """Worker lifecycle hook. Read-only operations wait for an explicit tool action.

    The worker owns lease/state progression; it never invokes TileSimCLI and never
    creates a run.  A tool call or explicit lifecycle action closes the operation.
    """
    operation = agent_harness_store.get_operation(operation_id) if "agent_harness_store" in globals() else None
    if operation and operation.get("operation_kind") == "controlled_execution":
        execution_record = agent_harness_store.get_stage3_by_operation(operation_id)
        if execution_record is not None:
            _stage3_run_execution(execution_record["execution_id"])
        return
    if operation and operation.get("workflow_state") == "running":
        # Keep the operation running while a caller may submit its bounded tool call.
        try:
            if not any(item.get("state") == "running" for item in agent_harness_store.list_events(operation_id)):
                harness_operation_event(operation_id, node="worker", state="running")
        except HarnessStoreError:
            pass
        return


if _READ_ONLY_CLI:
    agent_harness_store = None
    agent_harness_queue = None
else:
    agent_harness_store = DurableHarnessStore(AGENT_HARNESS_DB)
    agent_deletion_coordinator.stores["harness"] = agent_harness_store
    agent_harness_store.recover_incomplete()
    agent_harness_queue: HarnessQueue | None = HarnessQueue(
        agent_harness_store,
        config=QueueConfig(max_active=MAX_ACTIVE_RUNS, visibility_timeout_seconds=30.0, max_attempts=3),
        handler=lambda operation_id: _process_harness_operation(operation_id),
    )


def ensure_harness_queue() -> HarnessQueue:
    global agent_harness_queue
    if agent_harness_queue is None or agent_harness_queue.store is not agent_harness_store:
        if agent_harness_queue is not None:
            agent_harness_queue.stop()
        agent_harness_queue = HarnessQueue(
            agent_harness_store,
            config=QueueConfig(max_active=MAX_ACTIVE_RUNS, visibility_timeout_seconds=30.0, max_attempts=3),
            handler=lambda operation_id: _process_harness_operation(operation_id),
        )
    return agent_harness_queue

def resolve_linked_git_dir(root: Path) -> Path | None:
    return identity.resolve_linked_git_dir(root)


def git_command(root: Path, *args: str) -> list[str]:
    return identity.git_command(root, *args)


def git_value(*args: str) -> str:
    return identity.git_value(TILESIM_ROOT, *args)


def worktree_state_digest(root: Path = TILESIM_ROOT) -> str:
    return identity.worktree_state_digest(root)


def deployment_manifest() -> dict:
    return identity.deployment_manifest(DEPLOYMENT_MANIFEST)


def backend_identity() -> dict:
    return identity.backend_identity(TILESIM_ROOT, TILESIM_CLI, DEPLOYMENT_MANIFEST)


def harness_backend_identity() -> dict:
    """Stable non-path backend identity exposed to Harness contracts."""
    value = backend_identity()
    return {key: value.get(key) for key in ("backend_revision", "backend_branch", "source_revision", "build_revision", "source_state_digest", "build_state_digest", "state_digests_match", "versions_match", "deployment_mode", "deployment_ref", "deployed_at")}


def runtime_capabilities() -> dict:
    return identity.runtime_capabilities(TILESIM_CLI)


def agent_orchestration_capability_release_metadata() -> dict:
    catalog = load_catalog()
    release = deployment_manifest()
    web_git_revision = identity.git_value(WEB_ROOT, "rev-parse", "HEAD")
    web_source_revision = release.get("web_source_revision") or web_git_revision
    web_build_revision = (
        os.environ.get("TILESIM_WEB_BUILD_REVISION")
        or release.get("web_source_revision")
        or web_source_revision
    )
    backend = harness_backend_identity()
    return {
        "web_source_revision": web_source_revision,
        "web_build_revision": web_build_revision,
        "backend_revision": backend["source_revision"],
        "schema_set_revision": SCHEMA_SET_REVISION,
        "experiment_descriptor_revision": DESCRIPTOR_REVISION,
        "catalog_revision": catalog["catalog_revision"],
        "contract_package_revision": catalog["contract_package_revision"],
    }


def agent_orchestration_capability_snapshot() -> dict:
    return capability_catalog.build_capability_snapshot(
        agent_orchestration_capability_release_metadata()
    )


def harness_capability_snapshot() -> dict:
    """Published successor contract and explicit read-only surface."""
    backend = harness_backend_identity()
    return {
        "schema_identity": "tilesim.agent_harness.capability_snapshot.v1",
        "contract_revision": AGENT_HARNESS_CONTRACT_REVISION,
        "schema_set_revision": SCHEMA_SET_REVISION,
        "policy_revision": AGENT_HARNESS_POLICY_REVISION,
        "backend_identity": backend,
        "durable_store": {
            "kind": "sqlite_wal",
            "path_identity": harness_canonical_sha256(str(AGENT_HARNESS_DB.resolve())),
            "migration_version": 3,
            "scope": "single_host_mvp",
            "high_availability": False,
        },
        "workflow_states": [
            "draft", "submitted", "queued", "running", "waiting_tool", "waiting_approval",
            "retrying", "completed", "failed", "cancelled", "recovery_required",
            "manual_intervention_required",
        ],
        "tools": harness_tools.catalog(schema_set_revision=SCHEMA_SET_REVISION, backend_identity=backend)["tools"],
        "write_tools": [],
        "draft_actions": ["create_draft", "validate_draft", "delete_draft", "create_approval", "reject_approval", "revoke_approval"],
        "draft_validation_approval": {
            "contract_revision": SUCCESSOR_CONTRACT_REVISION,
            "schema_identities": list(STAGE2_SCHEMA_IDENTITIES.values()),
            "would_create_run": False,
            "endpoints": [
                "POST /api/agent/drafts", "GET /api/agent/drafts/{draft_id}",
                "POST /api/agent/drafts/{draft_id}/validate", "DELETE /api/agent/drafts/{draft_id}",
                "GET /api/agent/drafts/{draft_id}/events", "POST /api/agent/drafts/{draft_id}/approvals",
                "GET /api/agent/drafts/{draft_id}/approvals/{approval_id}",
                "POST /api/agent/drafts/{draft_id}/approvals/{approval_id}/reject",
                "POST /api/agent/drafts/{draft_id}/approvals/{approval_id}/revoke",
            ],
        },
        "execution": {
            "contract_revision": EXECUTION_CONTRACT_REVISION,
            "schema_identities": list(EXECUTION_SCHEMA_IDENTITIES.values()),
            "states": sorted(EXECUTION_STATES),
            "submit_endpoint": "POST /api/agent/executions",
            "status_endpoint": "GET /api/agent/executions/{operation_id}",
            "events_endpoint": "GET /api/agent/executions/{operation_id}/events",
            "event_stream_endpoint": "GET /api/agent/executions/{operation_id}/events/stream",
            "result_endpoint": "GET /api/agent/executions/{operation_id}/result",
            "cancel_endpoint": "POST /api/agent/executions/{operation_id}/cancel",
            "retry_endpoint": "POST /api/agent/executions/{operation_id}/retry",
            "resume_endpoint": "POST /api/agent/executions/{operation_id}/resume",
            "run_entrypoint": "POST /api/runs",
            "approval_single_use": True,
            "unknown_outcome": "recovery_required",
        },
        "optimization": {
            "contract_revision": OPTIMIZATION_CONTRACT_REVISION,
            "schema_identities": list(OPTIMIZATION_SCHEMA_IDENTITIES.values()),
            "states": sorted(OPTIMIZATION_SESSION_STATES),
            "local_dev": True,
            "automatic_submission": False,
            "production_status": "not_for_production",
            "endpoints": [
                "POST /api/agent/optimization/sessions",
                "GET /api/agent/optimization/sessions",
                "GET /api/agent/optimization/sessions/{session_id}",
                "GET /api/agent/optimization/sessions/{session_id}/events",
                "POST /api/agent/optimization/sessions/{session_id}/candidates/{candidate_id}/approve",
                "POST /api/agent/optimization/sessions/{session_id}/{action}",
            ],
            "tool_registry_revision": "2026-10-19.tools.v2",
            "tools": OPTIMIZATION_TOOL_REGISTRY,
        },
        "batch": {
            "contract_revision": BATCH_CONTRACT_REVISION,
            "schema_identities": list(BATCH_SCHEMA_IDENTITIES.values()),
            "states": sorted(BATCH_STATES),
            "local_dev": True,
            "approval_required": True,
            "automatic_submission": False,
            "production_status": "not_for_production",
            "tool_registry_revision": "2026-10-19.tools.v3",
            "execution_endpoint": "POST /api/agent/executions",
            "endpoints": [
                "POST /api/agent/batches", "GET /api/agent/batches", "GET /api/agent/batches/{batch_id}",
                "GET /api/agent/batches/{batch_id}/events", "POST /api/agent/batches/{batch_id}/approve",
                "POST /api/agent/batches/{batch_id}/{action}",
            ],
        },
        "flow": {
            "contract_revision": FLOW_CONTRACT_REVISION,
            "runtime_mode": "deterministic_transition_adapter",
            "langgraph_runtime_status": "optional_not_active",
            "activation_boundary": "local_dev_only",
            "schema_identities": list(AGENT_FLOW_CONTRACT["schema_identities"]),
            "states": ["created", "running", "waiting_user", "completed", "draft_ready", "stale", "refused", "cancelled", "failed"],
            "local_dev": True,
            "automatic_submission": False,
            "production_status": "not_for_production",
            "endpoints": [
                "POST /api/agent/flows",
                "GET /api/agent/flows/{flow_id}",
                "GET /api/agent/flows/{flow_id}/events",
                "GET /api/agent/flows/{flow_id}/events/stream",
                "POST /api/agent/flows/{flow_id}/resume",
                "POST /api/agent/flows/{flow_id}/authorization/revoke",
            ],
            "scopes": ["agent:start_flow", "agent:read_flow", "agent:resume_flow"],
            "creates_run": False,
            "writes_configuration": False,
            "provider_calls": False,
        },
        "autonomous_optimization": bool(AGENT_TOOLS_ENABLED and AGENT_AUTONOMY_MODE == "auto"),
        "local_optimization": True,
        "provider_acceptance": "live_acceptance_pending",
    }


def harness_principal(handler: SimpleHTTPRequestHandler) -> tuple[str, set[str]]:
    """Resolve a bounded local principal and scopes without accepting bearer secrets."""
    principal = handler.headers.get("X-TileSim-Principal", "local-user").strip()
    if not re.fullmatch(r"[A-Za-z0-9._:-]{1,128}", principal):
        raise HarnessContractError("principal_invalid", "Principal identity is invalid.", "/headers/X-TileSim-Principal", status=403)
    raw_scope = handler.headers.get("X-TileSim-Scopes", "agent:read_capability,agent:read_run,agent:read_evidence,agent:read_draft,agent:write_draft,agent:approve_draft,agent:start_flow,agent:read_flow,agent:resume_flow")
    scopes = {item.strip() for item in raw_scope.split(",") if item.strip()}
    allowed = {"agent:read_capability", "agent:read_run", "agent:read_evidence", "agent:read_draft", "agent:write_draft", "agent:approve_draft", "agent:submit_experiment", "agent:cancel_experiment", "agent:retry_experiment", "agent:resume_experiment", "agent:start_flow", "agent:read_flow", "agent:resume_flow"}
    if not scopes.issubset(allowed):
        raise HarnessContractError("unknown_scope", "Unknown scope is rejected.", "/headers/X-TileSim-Scopes", status=403)
    return principal, scopes


def harness_workspace(handler: SimpleHTTPRequestHandler) -> str:
    workspace = handler.headers.get("X-TileSim-Workspace", "local-workspace").strip()
    if not re.fullmatch(r"[A-Za-z0-9._:-]{1,128}", workspace):
        raise HarnessContractError("workspace_invalid", "Workspace identity is invalid.", "/headers/X-TileSim-Workspace", status=403)
    return workspace


def harness_json_body(handler: SimpleHTTPRequestHandler, *, max_bytes: int = MAX_REQUEST_BYTES) -> dict:
    try:
        length = int(handler.headers.get("Content-Length", "0"))
    except ValueError as error:
        raise HarnessContractError("invalid_request", "Content-Length is invalid.", "/headers/Content-Length") from error
    if length <= 0 or length > max_bytes:
        raise HarnessContractError("input_too_large", "Request body is outside the bounded input size.", "/")
    try:
        value = json.loads(handler.rfile.read(length), parse_constant=reject_nonfinite_json)
    except (ValueError, json.JSONDecodeError) as error:
        raise HarnessContractError("invalid_json", "Request body is not strict JSON.", "/") from error
    if not isinstance(value, dict):
        raise HarnessContractError("invalid_request", "Request body must be an object.", "/")
    return value


def harness_error(handler: SimpleHTTPRequestHandler, error: HarnessContractError | HarnessStoreError | harness_tools.ToolGatewayError) -> None:
    code = getattr(error, "code", "harness_error")
    status_map = {
        "operation_not_found": HTTPStatus.NOT_FOUND, "checkpoint_not_found": HTTPStatus.NOT_FOUND,
        "approval_not_found": HTTPStatus.NOT_FOUND, "run_not_found": HTTPStatus.NOT_FOUND,
        "draft_not_found": HTTPStatus.NOT_FOUND, "validation_not_found": HTTPStatus.NOT_FOUND,
        "batch_not_found": HTTPStatus.NOT_FOUND,
        "event_not_found": HTTPStatus.NOT_FOUND,
        "unknown_tool": HTTPStatus.FORBIDDEN, "unknown_scope": HTTPStatus.FORBIDDEN,
        "tool_scope_denied": HTTPStatus.FORBIDDEN, "operation_access_denied": HTTPStatus.FORBIDDEN,
        "principal_mismatch": HTTPStatus.FORBIDDEN, "run_access_denied": HTTPStatus.FORBIDDEN,
        "workspace_mismatch": HTTPStatus.FORBIDDEN, "draft_access_denied": HTTPStatus.FORBIDDEN,
        "approval_access_denied": HTTPStatus.FORBIDDEN, "scope_denied": HTTPStatus.FORBIDDEN,
        "validation_required": HTTPStatus.CONFLICT, "approval_terminal": HTTPStatus.CONFLICT,
        "approval_replay": HTTPStatus.CONFLICT, "approval_stale": HTTPStatus.CONFLICT,
        "tool_unknown_outcome": HTTPStatus.SERVICE_UNAVAILABLE,
        "principal_forbidden": HTTPStatus.FORBIDDEN,
        "approval_missing": HTTPStatus.CONFLICT, "approval_expired": HTTPStatus.CONFLICT,
        "approval_revoked": HTTPStatus.CONFLICT, "approval_replayed": HTTPStatus.CONFLICT,
        "approval_not_single_use": HTTPStatus.CONFLICT,
        "approval_digest_mismatch": HTTPStatus.CONFLICT, "draft_invalid": HTTPStatus.CONFLICT,
        "draft_stale": HTTPStatus.CONFLICT, "snapshot_mismatch": HTTPStatus.CONFLICT,
        "backend_identity_mismatch": HTTPStatus.CONFLICT, "policy_revision_mismatch": HTTPStatus.CONFLICT,
        "payload_conflict": HTTPStatus.CONFLICT, "execution_not_found": HTTPStatus.NOT_FOUND,
        "execution_terminal": HTTPStatus.CONFLICT, "cancel_not_allowed": HTTPStatus.CONFLICT,
        "retry_not_allowed": HTTPStatus.CONFLICT, "resume_not_allowed": HTTPStatus.CONFLICT,
        "unknown_outcome": HTTPStatus.CONFLICT, "recovery_required": HTTPStatus.CONFLICT, "event_sequence_gap": HTTPStatus.CONFLICT,
         "recovery_acknowledgement_required": HTTPStatus.CONFLICT,
         "schema_revision_mismatch": HTTPStatus.CONFLICT, "contract_revision_mismatch": HTTPStatus.CONFLICT,
         "result_schema_mismatch": HTTPStatus.CONFLICT, "result_identity_incomplete": HTTPStatus.CONFLICT,
         "provenance_mismatch": HTTPStatus.CONFLICT, "objective_unavailable": HTTPStatus.CONFLICT,
         "artifact_pointer_not_found": HTTPStatus.CONFLICT, "artifact_sha_mismatch": HTTPStatus.CONFLICT,
         "artifact_bytes_mismatch": HTTPStatus.CONFLICT,
        "artifact_manifest_invalid": HTTPStatus.CONFLICT,
        "queue_capacity_reached": HTTPStatus.TOO_MANY_REQUESTS,
        "approval_required": HTTPStatus.CONFLICT, "invalid_transition": HTTPStatus.CONFLICT,
        "authorization_required": HTTPStatus.CONFLICT, "authorization_inactive": HTTPStatus.CONFLICT,
        "authorization_expired": HTTPStatus.CONFLICT, "authorization_not_found": HTTPStatus.NOT_FOUND,
        "authorization_already_issued": HTTPStatus.CONFLICT, "autonomy_disabled": HTTPStatus.CONFLICT,
        "create_run_failed": HTTPStatus.SERVICE_UNAVAILABLE,
        "cli_unavailable": HTTPStatus.SERVICE_UNAVAILABLE,
        "run_timeout": HTTPStatus.CONFLICT,
        "result_not_ready": HTTPStatus.CONFLICT,
    }
    return write_json(
        handler,
        HTTPStatus(getattr(error, "status", status_map.get(code, HTTPStatus.CONFLICT if code in {"idempotency_payload_mismatch", "event_out_of_order", "event_conflict", "terminal_mutation", "snapshot_mismatch"} else HTTPStatus.BAD_REQUEST))),
        {
            "schema_identity": AGENT_HARNESS_ERROR_SCHEMA_IDENTITY,
            "contract_revision": AGENT_HARNESS_CONTRACT_REVISION,
            "error": {
                "code": error.code,
                "message": str(error),
                "field_path": getattr(error, "field_path", None),
                "retryable": getattr(error, "retryable", False),
                "terminal_failure": not getattr(error, "retryable", False),
                "unknown_outcome": getattr(error, "unknown_outcome", False),
            },
            "request_id": request_id_for(handler),
        },
    )


def agent_flow_error(handler: SimpleHTTPRequestHandler, error: AgentFlowError | AgentFlowStoreError) -> None:
    """Write the canonical Bridge error envelope for the independent flow."""
    return write_error(
        handler,
        HTTPStatus(getattr(error, "status", HTTPStatus.CONFLICT)),
        getattr(error, "code", "flow_error"),
        str(error),
        field_path=getattr(error, "field_path", "/"),
        retryable=bool(getattr(error, "retryable", False)),
        # `nested_schema_identity` identifies the payload schema that owns the
        # error, not the contract revision used to version that schema.  Keep
        # flow failures distinguishable from the generic Bridge error envelope
        # and from other Agent Harness contracts.
        nested_schema_identity=FLOW_ERROR_SCHEMA_IDENTITY,
    )


def harness_public_operation(operation: dict) -> dict:
    # Public state contains identities/digests and bounded errors only.
    value = dict(operation)
    value.pop("request_payload", None)
    return value


def _stage2_scope(handler: SimpleHTTPRequestHandler, required: str | set[str]) -> tuple[str, str]:
    principal, scopes = harness_principal(handler)
    required_scopes = {required} if isinstance(required, str) else required
    if not required_scopes.intersection(scopes):
        raise HarnessContractError("scope_denied", "The requested draft action is not in the caller scope.", "/headers/X-TileSim-Scopes", status=403)
    return principal, harness_workspace(handler)


def _agent_flow_scope(handler: SimpleHTTPRequestHandler, required: str) -> tuple[str, str]:
    principal, scopes = harness_principal(handler)
    if required not in scopes:
        raise AgentFlowError("scope_denied", "The requested flow action is not in the caller scope.", status=403, field_path="/headers/X-TileSim-Scopes")
    return principal, harness_workspace(handler)


def _agent_flow_idempotency_key(handler: SimpleHTTPRequestHandler) -> str:
    key = handler.headers.get("Idempotency-Key", "").strip()
    if not re.fullmatch(r"[A-Za-z0-9._:-]{8,128}", key):
        raise AgentFlowError("missing_idempotency_key", "A stable Idempotency-Key is required for flow mutation.", field_path="/headers/Idempotency-Key")
    return key


def _agent_flow_body(handler: SimpleHTTPRequestHandler) -> dict[str, Any]:
    try:
        length = int(handler.headers.get("Content-Length", "0"))
    except ValueError as error:
        raise AgentFlowError("invalid_request", "Content-Length is invalid.", field_path="/headers/Content-Length") from error
    if length <= 0 or length > MAX_REQUEST_BYTES:
        raise AgentFlowError("input_too_large", "Flow request body is outside the bounded input size.", field_path="/")
    try:
        value = json.loads(handler.rfile.read(length), parse_constant=reject_nonfinite_json)
    except (ValueError, json.JSONDecodeError) as error:
        raise AgentFlowError("invalid_json", "Flow request body is not strict JSON.", field_path="/") from error
    if not isinstance(value, dict):
        raise AgentFlowError("invalid_json", "Flow request body must be an object.", field_path="/")
    return value


def _agent_flow_last_event_id(handler: SimpleHTTPRequestHandler, query_after: str | None) -> int:
    """Parse the flow cursor exactly as published by the Flow contract.

    ``int()`` accepts signs and surrounding whitespace, while the public
    ``FlowLastEventId`` parameter is deliberately restricted to ASCII digits.
    Keep the HTTP adapter fail-closed so malformed cursors cannot be silently
    normalized into a valid replay position.
    """
    raw = handler.headers.get("Last-Event-ID")
    if raw is None:
        raw = query_after if query_after is not None else "0"
    if not re.fullmatch(r"[0-9]+", raw):
        raise AgentFlowError(
            "invalid_last_event_id",
            "Last-Event-ID must be a sequence integer.",
            field_path="/headers/Last-Event-ID",
        )
    try:
        return int(raw)
    except ValueError as error:
        # Python's integer string conversion limit protects the process from
        # unbounded cursors; expose the same stable contract error instead of
        # leaking the interpreter exception.
        raise AgentFlowError(
            "invalid_last_event_id",
            "Last-Event-ID must be a sequence integer.",
            field_path="/headers/Last-Event-ID",
        ) from error


def _strict_event_cursor(raw: str | None) -> int:
    """Parse a durable event cursor without Python's permissive ``int`` rules.

    All Agent replay endpoints use the same cursor contract: an omitted
    ``Last-Event-ID`` starts at zero, while a supplied value must be ASCII
    digits only.  In particular, signs, whitespace, an empty header and
    unbounded integer strings are rejected instead of being normalized into a
    valid replay position.
    """
    value = "0" if raw is None else raw
    if not re.fullmatch(r"[0-9]+", value):
        raise ValueError("Last-Event-ID must be a sequence integer.")
    try:
        return int(value)
    except ValueError as error:
        # Python may reject an extremely long decimal string because of its
        # integer conversion safety limit.  Keep that as the same protocol
        # failure instead of leaking an interpreter-specific message.
        raise ValueError("Last-Event-ID must be a sequence integer.") from error


def _assert_event_replay_contiguous(events: list[dict[str, Any]], after: int) -> None:
    """Fail closed when a durable replay contains a sequence gap."""
    expected = after + 1
    for event in events:
        sequence = event.get("sequence")
        if type(sequence) is not int or sequence != expected:
            raise ValueError("Event sequence is not contiguous.")
        expected += 1


def create_agent_flow(handler: SimpleHTTPRequestHandler) -> None:
    try:
        principal, workspace_id = _agent_flow_scope(handler, "agent:start_flow")
        key = _agent_flow_idempotency_key(handler)
        document = _agent_flow_body(handler)
        response, replay = agent_flow_service.start(document, principal=principal, workspace_id=workspace_id, idempotency_key=key)
        return write_json(handler, HTTPStatus.OK if replay else HTTPStatus.CREATED, {"flow": response, "idempotent_replay": replay})
    except (AgentFlowError, AgentFlowStoreError, HarnessContractError) as error:
        return agent_flow_error(handler, error)


def get_agent_flow(handler: SimpleHTTPRequestHandler, flow_id: str) -> None:
    try:
        principal, workspace_id = _agent_flow_scope(handler, "agent:read_flow")
        response = agent_flow_service.get(flow_id, principal=principal, workspace_id=workspace_id)
        return write_json(handler, HTTPStatus.OK, {"flow": response})
    except (AgentFlowError, AgentFlowStoreError, HarnessContractError) as error:
        return agent_flow_error(handler, error)


def agent_flow_events(handler: SimpleHTTPRequestHandler, flow_id: str) -> None:
    try:
        principal, workspace_id = _agent_flow_scope(handler, "agent:read_flow")
        query_after = parse_qs(urlparse(handler.path).query, keep_blank_values=True).get("after_sequence", [None])[0]
        after = _agent_flow_last_event_id(handler, query_after)
        flow, events = agent_flow_service.events(flow_id, principal=principal, workspace_id=workspace_id, after_sequence=after)
        return write_json(handler, HTTPStatus.OK, {"flow": flow, "events": events, "after_sequence": after, "terminal": flow["status"] in {"completed", "draft_ready", "stale", "refused", "cancelled", "failed"}})
    except (AgentFlowError, AgentFlowStoreError, HarnessContractError) as error:
        return agent_flow_error(handler, error)


def stream_agent_flow_events(handler: SimpleHTTPRequestHandler, flow_id: str) -> None:
    try:
        principal, workspace_id = _agent_flow_scope(handler, "agent:read_flow")
        query_after = parse_qs(urlparse(handler.path).query, keep_blank_values=True).get("after_sequence", [None])[0]
        after = _agent_flow_last_event_id(handler, query_after)
        flow, events = agent_flow_service.events(flow_id, principal=principal, workspace_id=workspace_id, after_sequence=after)
        handler.send_response(HTTPStatus.OK)
        handler.send_header("Content-Type", "text/event-stream; charset=utf-8")
        handler.send_header("Cache-Control", "no-store")
        handler.send_header("Connection", "close")
        add_contract_headers(handler)
        add_cors_headers(handler)
        handler.end_headers()
        for event in events:
            responses.write_sse_event(handler, event="flow", event_id=str(event["sequence"]), data=event)
        if flow["status"] in {"completed", "draft_ready", "stale", "refused", "cancelled", "failed"}:
            responses.write_sse_event(handler, event="terminal", data=flow)
    except (AgentFlowError, AgentFlowStoreError, HarnessContractError) as error:
        return agent_flow_error(handler, error)
    except (BrokenPipeError, ConnectionResetError, OSError):
        return None


def resume_agent_flow(handler: SimpleHTTPRequestHandler, flow_id: str) -> None:
    try:
        principal, workspace_id = _agent_flow_scope(handler, "agent:resume_flow")
        key = _agent_flow_idempotency_key(handler)
        document = _agent_flow_body(handler)
        response, replay = agent_flow_service.resume(
            flow_id,
            document,
            principal=principal,
            workspace_id=workspace_id,
            idempotency_key=key,
        )
        flow = dict(response)
        events = flow.pop("events", [])
        action = flow.pop("action", document.get("action"))
        flow.pop("idempotent_replay", None)
        return write_json(
            handler,
            HTTPStatus.OK,
            {
                "flow": flow,
                "events": events,
                "idempotent_replay": replay,
                "action": action,
            },
        )
    except (AgentFlowError, AgentFlowStoreError, HarnessContractError) as error:
        return agent_flow_error(handler, error)


def revoke_agent_flow_authorization(handler: SimpleHTTPRequestHandler, flow_id: str) -> None:
    """Revoke the immutable authorization envelope for a durable flow.

    This is a security mutation rather than a user resume action.  It uses the
    same resume scope because the published Flow contract has no broader
    write scope, and it requires an idempotency key so a lost response cannot
    produce a second terminal event.
    """

    try:
        principal, workspace_id = _agent_flow_scope(handler, "agent:resume_flow")
        key = _agent_flow_idempotency_key(handler)
        document = _agent_flow_body(handler)
        response, replay = agent_flow_service.revoke_authorization(
            flow_id,
            document,
            principal=principal,
            workspace_id=workspace_id,
            idempotency_key=key,
        )
        # The durable replay row stores the original response verbatim.  The
        # HTTP envelope still reports whether this request was the replay so a
        # client can distinguish a fresh terminal transition from an exact
        # idempotent retry.
        payload = dict(response)
        payload["idempotent_replay"] = replay
        return write_json(handler, HTTPStatus.OK, payload)
    except (AgentFlowError, AgentFlowStoreError, HarnessContractError) as error:
        return agent_flow_error(handler, error)


def _stage2_current_snapshot(handler: SimpleHTTPRequestHandler, supplied: str | None) -> str:
    header = handler.headers.get("X-TileSim-Input-Snapshot", "").strip()
    current = header or supplied or ""
    stage2_require_digest(current, "/input_snapshot_digest", "input_snapshot_digest")
    if supplied is not None and header and supplied != header:
        raise HarnessContractError("snapshot_mismatch", "Input snapshot does not match the current workspace snapshot.", "/input_snapshot_digest")
    return current


def _stage2_request_digest(request: dict[str, Any]) -> str:
    return harness_canonical_sha256(request)


def _stage2_validate_payload(request: dict[str, Any] | None) -> tuple[str, list[dict], list[dict], list[str], dict, list[str]]:
    if request is None:
        return "unavailable", [{"code": "request_missing", "severity": "error", "message": "A create_run_request is required for deterministic validation."}], [], [], {"status": "unavailable", "reason": "not_estimated"}, ["requires_backend_profile"]
    try:
        command = validate_run_request(
            request,
            scenario_ids=set(SCENARIOS),
            fidelity_policies=ALLOWED_FIDELITY_POLICIES,
            gpu_participation_modes=ALLOWED_GPU_PARTICIPATION_MODES,
            capabilities=runtime_capabilities(),
        )
    except RequestValidationError as error:
        return "invalid", [{"code": "invalid_field", "severity": "error", "message": str(error), "field_path": error.field_path}], [], [], {"status": "not_estimated", "reason": "validation_failed"}, ["validation_failed"]
    field_results = [{"field_id": key, "json_pointer": f"/{key}", "status": "valid", "reason": None} for key in sorted(request)]
    budget = {"estimated_run_count": 0, "estimated_max_concurrency": 0, "estimated_duration_class": "not_estimated", "status": "requires_backend_profile", "would_create_run": False}
    risks = ["synthetic_trace_not_fidelity_ground_truth"] if command.custom_inputs else ["provider_acceptance_pending"]
    return "valid", [], field_results, [], budget, risks


def _stage2_draft_public(document: dict[str, Any]) -> dict[str, Any]:
    value = dict(document)
    value.pop("create_run_request", None)
    value.pop("request", None)
    return value


def create_stage2_draft(handler: SimpleHTTPRequestHandler) -> None:
    try:
        principal, workspace_id = _stage2_scope(handler, "agent:write_draft")
        document = harness_json_body(handler)
        key = handler.headers.get("Idempotency-Key", "").strip()
        if not re.fullmatch(r"[A-Za-z0-9._:-]{1,256}", key):
            raise HarnessContractError("missing_idempotency_key", "Idempotency-Key is required for draft writes.", "/headers/Idempotency-Key")
        supplied_snapshot = document.get("input_snapshot_digest")
        if document.get("idempotency_key") is not None and document.get("idempotency_key") != key:
            raise HarnessContractError("idempotency_key_mismatch", "Body idempotency_key must match Idempotency-Key.", "/idempotency_key")
        snapshot = _stage2_current_snapshot(handler, supplied_snapshot)
        backend = harness_backend_identity()
        normalized = validate_stage2_create({**document, "input_snapshot_digest": snapshot}, principal=principal, workspace_id=workspace_id, schema_set_revision=SCHEMA_SET_REVISION, backend_identity=backend)
        request = normalized.get("create_run_request")
        status, issues, field_results, unsupported, budget, risks = _stage2_validate_payload(request)
        draft_id = normalized.get("draft_id") or f"draft-{uuid.uuid4().hex}"
        operation_id = normalized.get("operation_id") or f"draft-op-{uuid.uuid4().hex}"
        created = stage2_now()
        expires = normalized.get("expires_at") or (datetime.now(timezone.utc) + timedelta(hours=24)).replace(microsecond=0).isoformat()
        try:
            draft_expired = datetime.fromisoformat(expires.replace("Z", "+00:00")) <= datetime.now(timezone.utc)
        except ValueError as error:
            raise HarnessContractError("invalid_expiry", "expires_at must be an ISO-8601 timestamp.", "/expires_at") from error
        # Identity is derived from the caller payload, never from generated IDs
        # or timestamps, so the same Idempotency-Key can replay exactly.
        request_digest = _stage2_request_digest(request) if request is not None else None
        digest = stage2_draft_digest({**normalized, "status": "draft", "create_run_request_digest": request_digest})
        payload = {"draft_id": draft_id, "operation_id": operation_id, "principal": principal, "workspace_id": workspace_id, "input_snapshot_digest": snapshot, "schema_set_revision": SCHEMA_SET_REVISION, "backend_identity": backend, "parameter_catalog_revision": normalized["parameter_catalog_revision"], "validator_revision": normalized["validator_revision"], "policy_revision": AGENT_HARNESS_POLICY_REVISION, "run_scope": normalized["run_scope"], "conversation_id": normalized.get("conversation_id"), "turn_id": normalized.get("turn_id"), "field_diffs": normalized.get("field_diffs", []), "assumptions": normalized.get("assumptions", []), "evidence_refs": normalized.get("evidence_refs", []), "budget_request": normalized.get("budget_request", {}), "risk_flags": [*normalized.get("risk_flags", []), *risks], "status": "expired" if draft_expired else ("draft" if status == "valid" else status), "created_at": created, "expires_at": expires, "draft_digest": digest, "idempotency_key": key, "would_create_run": False, "create_run_request_digest": request_digest}
        operation, replay = agent_harness_store.create_operation(idempotency_key=f"stage2-draft:{key}", request_payload={"draft_digest": digest, "snapshot": snapshot}, schema_set_revision=SCHEMA_SET_REVISION, backend_identity=backend, principal=principal, operation_kind="draft_validation", operation_id=operation_id, turn_id=normalized.get("turn_id"))
        if not replay:
            agent_harness_store.transition(operation["operation_id"], "draft", expected={"queued"})
            harness_operation_event(operation["operation_id"], node="draft", state="draft", payload={"draft_digest": digest}, draft_id=draft_id)
        saved, replay = agent_harness_store.save_stage2_draft(payload, operation_id=operation["operation_id"], idempotency_key=key, draft_digest=digest)
        return write_json(handler, HTTPStatus.OK if replay else HTTPStatus.CREATED, {"draft": _stage2_draft_public(saved), "idempotent_replay": replay, "would_create_run": False})
    except (HarnessContractError, HarnessStoreError) as error:
        return harness_error(handler, error)


def get_stage2_draft(handler: SimpleHTTPRequestHandler, draft_id: str) -> None:
    try:
        principal, workspace_id = _stage2_scope(handler, {"agent:read_draft", "agent:write_draft"})
        draft = agent_harness_store.get_stage2_draft(draft_id)
        if draft is None:
            raise HarnessStoreError("draft_not_found", "Draft was not found.")
        if draft["principal"] != principal or draft["workspace_id"] != workspace_id:
            raise HarnessContractError("draft_access_denied", "Draft is not owned by this principal and workspace.", "/draft_id", status=403)
        if draft["schema_set_revision"] != SCHEMA_SET_REVISION:
            raise HarnessContractError("stale_draft", "Draft schema-set revision is stale.", "/schema_set_revision")
        if draft["backend_identity"] != harness_backend_identity():
            raise HarnessContractError("stale_draft", "Draft backend identity is stale.", "/backend_identity")
        return write_json(handler, HTTPStatus.OK, {"draft": _stage2_draft_public(draft), "validation": agent_harness_store.latest_stage2_validation(draft_id), "would_create_run": False})
    except (HarnessContractError, HarnessStoreError) as error:
        return harness_error(handler, error)


def validate_stage2_draft(handler: SimpleHTTPRequestHandler, draft_id: str) -> None:
    try:
        principal, workspace_id = _stage2_scope(handler, "agent:write_draft")
        key = handler.headers.get("Idempotency-Key", "").strip()
        if not re.fullmatch(r"[A-Za-z0-9._:-]{1,256}", key):
            raise HarnessContractError("missing_idempotency_key", "Idempotency-Key is required for validation writes.", "/headers/Idempotency-Key")
        draft = agent_harness_store.get_stage2_draft(draft_id)
        if draft is None:
            raise HarnessStoreError("draft_not_found", "Draft was not found.")
        if draft["principal"] != principal or draft["workspace_id"] != workspace_id:
            raise HarnessContractError("draft_access_denied", "Draft is not owned by this principal and workspace.", "/draft_id", status=403)
        if draft["schema_set_revision"] != SCHEMA_SET_REVISION or draft["backend_identity"] != harness_backend_identity():
            raise HarnessContractError("stale_draft", "Draft binding is stale and cannot be approved.", "/draft_digest")
        body = harness_json_body(handler)
        unknown = sorted(set(body) - {"create_run_request", "request", "input_snapshot_digest", "validated_create_run_request_digest", "idempotency_key"})
        if unknown:
            raise HarnessContractError("unknown_field", "Unknown validation field is rejected.", f"/{unknown[0]}")
        if body.get("idempotency_key") is not None and body.get("idempotency_key") != key:
            raise HarnessContractError("idempotency_key_mismatch", "Body idempotency_key must match Idempotency-Key.", "/idempotency_key")
        snapshot = _stage2_current_snapshot(handler, body.get("input_snapshot_digest", draft["input_snapshot_digest"]))
        if snapshot != draft["input_snapshot_digest"]:
            raise HarnessContractError("snapshot_mismatch", "Draft snapshot is stale.", "/input_snapshot_digest")
        request = body.get("create_run_request", body.get("request"))
        request_digest = body.get("validated_create_run_request_digest")
        if request is not None and request_digest and request_digest != _stage2_request_digest(request):
            raise HarnessContractError("payload_digest_mismatch", "Validation payload digest does not match request.", "/validated_create_run_request_digest")
        status, issues, fields, unsupported, budget, risks = _stage2_validate_payload(request)
        validation_payload_digest = harness_canonical_sha256({"draft_id": draft_id, "snapshot": snapshot, "request": request})
        agent_harness_store.create_operation(
            idempotency_key=f"stage2-validate:{key}",
            request_payload={"draft_id": draft_id, "payload_digest": validation_payload_digest},
            schema_set_revision=SCHEMA_SET_REVISION,
            backend_identity=harness_backend_identity(),
            principal=principal,
            operation_kind="draft_validation",
        )
        report = stage2_validation_report(draft=draft, validation_id=f"validation-{uuid.uuid4().hex}", status=status, issues=issues, field_results=fields, unsupported_fields=unsupported, stale_reasons=[], budget_estimate=budget, risk_flags=risks, validated_request_digest=_stage2_request_digest(request) if request is not None else harness_canonical_sha256({"status": "unavailable"}))
        saved, replay = agent_harness_store.save_stage2_validation(report, idempotency_key=key, payload_digest=validation_payload_digest)
        if not replay:
            harness_operation_event(draft["operation_id"], node="validation", state="draft", payload={"validation_id": report["validation_id"], "status": status}, draft_id=draft_id)
        return write_json(handler, HTTPStatus.OK, {"validation": saved, "would_create_run": False, "idempotent_replay": replay})
    except (HarnessContractError, HarnessStoreError) as error:
        return harness_error(handler, error)


def stage2_draft_events(handler: SimpleHTTPRequestHandler, draft_id: str) -> None:
    try:
        principal, workspace_id = _stage2_scope(handler, "agent:read_draft")
        draft = agent_harness_store.get_stage2_draft(draft_id)
        if draft is None or draft["principal"] != principal or draft["workspace_id"] != workspace_id:
            raise HarnessStoreError("draft_not_found", "Draft was not found.")
        try:
            after = _strict_event_cursor(handler.headers.get("Last-Event-ID"))
        except ValueError as error:
            raise HarnessContractError("invalid_last_event_id", "Last-Event-ID must be a sequence integer.", "/headers/Last-Event-ID") from error
        all_events = agent_harness_store.list_events(draft["operation_id"])
        if after > 0 and not any(event["sequence"] == after for event in all_events):
            raise HarnessStoreError("event_not_found", "Last-Event-ID is not present in the durable event log.")
        events = agent_harness_store.list_events(draft["operation_id"], after_sequence=after)
        try:
            _assert_event_replay_contiguous(events, after)
        except ValueError as error:
            raise HarnessStoreError("event_sequence_gap", "Draft event sequence has a durable gap.") from error
        return write_json(handler, HTTPStatus.OK, {"draft_id": draft_id, "events": events, "after_sequence": after, "terminal": draft["status"] in {"deleted", "expired", "stale"}})
    except (HarnessContractError, HarnessStoreError) as error:
        return harness_error(handler, error)


def stream_stage2_draft_events(handler: SimpleHTTPRequestHandler, draft_id: str) -> None:
    try:
        principal, workspace_id = _stage2_scope(handler, "agent:read_draft")
        draft = agent_harness_store.get_stage2_draft(draft_id)
        if draft is None or draft["principal"] != principal or draft["workspace_id"] != workspace_id:
            raise HarnessStoreError("draft_not_found", "Draft was not found.")
        try:
            after = _strict_event_cursor(handler.headers.get("Last-Event-ID"))
        except ValueError as error:
            raise HarnessContractError("invalid_last_event_id", "Last-Event-ID must be a sequence integer.", "/headers/Last-Event-ID") from error
        all_events = agent_harness_store.list_events(draft["operation_id"])
        if after > 0 and not any(event["sequence"] == after for event in all_events):
            raise HarnessStoreError("event_not_found", "Last-Event-ID is not present in the durable event log.")
        events = agent_harness_store.list_events(draft["operation_id"], after_sequence=after)
        try:
            _assert_event_replay_contiguous(events, after)
        except ValueError as error:
            raise HarnessStoreError("event_sequence_gap", "Draft event sequence has a durable gap.") from error
        handler.send_response(HTTPStatus.OK)
        handler.send_header("Content-Type", "text/event-stream; charset=utf-8")
        handler.send_header("Cache-Control", "no-store")
        handler.send_header("Connection", "close")
        add_contract_headers(handler)
        add_cors_headers(handler)
        handler.end_headers()
        for event in events:
            responses.write_sse_event(handler, event="workflow", event_id=str(event["sequence"]), data=event)
        if draft["status"] in {"deleted", "expired", "stale"}:
            responses.write_sse_event(handler, event="terminal", data={"draft_id": draft_id, "state": draft["status"]})
    except (HarnessContractError, HarnessStoreError) as error:
        return harness_error(handler, error)


def create_stage2_approval(handler: SimpleHTTPRequestHandler, draft_id: str) -> None:
    try:
        principal, workspace_id = _stage2_scope(handler, "agent:approve_draft")
        key = handler.headers.get("Idempotency-Key", "").strip()
        if not re.fullmatch(r"[A-Za-z0-9._:-]{1,256}", key):
            raise HarnessContractError("missing_idempotency_key", "Idempotency-Key is required for approval writes.", "/headers/Idempotency-Key")
        body = harness_json_body(handler)
        if body.get("idempotency_key") is not None and body.get("idempotency_key") != key:
            raise HarnessContractError("idempotency_key_mismatch", "Body idempotency_key must match Idempotency-Key.", "/idempotency_key")
        draft = agent_harness_store.get_stage2_draft(draft_id)
        if draft is None or draft["principal"] != principal or draft["workspace_id"] != workspace_id:
            raise HarnessStoreError("draft_not_found", "Draft was not found.")
        if draft["schema_set_revision"] != SCHEMA_SET_REVISION or draft["backend_identity"] != harness_backend_identity():
            raise HarnessContractError("stale_draft", "Draft binding is stale and cannot be approved.", "/draft_digest")
        validation_id = body.get("validation_id")
        report = agent_harness_store.get_stage2_validation(validation_id) if isinstance(validation_id, str) else None
        if not report or report["draft_id"] != draft_id or report["status"] != "valid":
            raise HarnessStoreError("validation_required", "Only a current valid validation report can be approved.")
        approval_input = {**body, "draft_id": draft_id, "draft_digest": draft["draft_digest"], "validation_id": validation_id, "principal": principal, "workspace_id": workspace_id, "schema_set_revision": SCHEMA_SET_REVISION, "backend_identity": harness_backend_identity()}
        normalized = validate_stage2_approval(approval_input, principal=principal, workspace_id=workspace_id, schema_set_revision=SCHEMA_SET_REVISION, backend_identity=harness_backend_identity())
        created = stage2_now()
        approval_id = normalized.get("approval_id") or f"approval-{uuid.uuid4().hex}"
        approval_digest = harness_canonical_sha256({"approval_id": approval_id, "draft_id": draft_id, "draft_digest": draft["draft_digest"], "validation_id": validation_id, "principal": principal, "workspace_id": workspace_id, "schema_set_revision": SCHEMA_SET_REVISION, "backend_identity": harness_backend_identity(), "policy_revision": AGENT_HARNESS_POLICY_REVISION, "expires_at": normalized["expires_at"], "single_use": normalized.get("single_use", True)})
        if normalized.get("approval_digest") is not None and normalized["approval_digest"] != approval_digest:
            raise HarnessContractError("approval_digest_mismatch", "Approval digest does not match the bound draft and validation.", "/approval_digest")
        try:
            expired = datetime.fromisoformat(normalized["expires_at"].replace("Z", "+00:00")) <= datetime.now(timezone.utc)
        except ValueError as error:
            raise HarnessContractError("invalid_expiry", "expires_at must be an ISO-8601 timestamp.", "/expires_at") from error
        document = {"schema_identity": STAGE2_SCHEMA_IDENTITIES["approval"], "contract_revision": SUCCESSOR_CONTRACT_REVISION, "approval_id": approval_id, "draft_id": draft_id, "draft_digest": draft["draft_digest"], "validation_id": validation_id, "principal": principal, "workspace_id": workspace_id, "policy_revision": AGENT_HARNESS_POLICY_REVISION, "schema_set_revision": SCHEMA_SET_REVISION, "backend_identity": harness_backend_identity(), "status": "expired" if expired else "approved", "created_at": created, "expires_at": normalized["expires_at"], "approved_at": None if expired else created, "rejected_at": None, "revoked_at": None, "reason": normalized.get("reason"), "approval_digest": approval_digest, "single_use": normalized.get("single_use", True), "consumed": False}
        saved, replay = agent_harness_store.save_stage2_approval(document, idempotency_key=key)
        if not replay:
            harness_operation_event(draft["operation_id"], node="approval", state="waiting_approval", payload={"approval_id": approval_id, "approval_digest": approval_digest}, draft_id=draft_id, approval_id=approval_id)
        return write_json(handler, HTTPStatus.OK if replay else HTTPStatus.CREATED, {"approval": saved, "idempotent_replay": replay, "would_create_run": False})
    except (HarnessContractError, HarnessStoreError) as error:
        return harness_error(handler, error)


def get_stage2_approval(handler: SimpleHTTPRequestHandler, draft_id: str, approval_id: str) -> None:
    try:
        principal, workspace_id = _stage2_scope(handler, {"agent:read_draft", "agent:approve_draft"})
        approval = agent_harness_store.get_stage2_approval(approval_id)
        if approval is None or approval["draft_id"] != draft_id:
            raise HarnessStoreError("approval_not_found", "Approval was not found.")
        if approval["principal"] != principal or approval["workspace_id"] != workspace_id:
            raise HarnessContractError("approval_access_denied", "Approval is not owned by this principal and workspace.", "/approval_id", status=403)
        return write_json(handler, HTTPStatus.OK, {"approval": approval, "would_create_run": False})
    except (HarnessContractError, HarnessStoreError) as error:
        return harness_error(handler, error)


def mutate_stage2_approval(handler: SimpleHTTPRequestHandler, draft_id: str, approval_id: str, action: str) -> None:
    try:
        principal, workspace_id = _stage2_scope(handler, "agent:approve_draft")
        key = handler.headers.get("Idempotency-Key", "").strip()
        if not re.fullmatch(r"[A-Za-z0-9._:-]{1,256}", key):
            raise HarnessContractError("missing_idempotency_key", "Idempotency-Key is required for approval writes.", "/headers/Idempotency-Key")
        approval = agent_harness_store.get_stage2_approval(approval_id)
        if approval is None or approval["draft_id"] != draft_id:
            raise HarnessStoreError("approval_not_found", "Approval was not found.")
        if approval["principal"] != principal or approval["workspace_id"] != workspace_id:
            raise HarnessContractError("approval_access_denied", "Approval is not owned by this principal and workspace.", "/approval_id", status=403)
        body = harness_json_body(handler)
        unknown = sorted(set(body) - {"reason", "idempotency_key"})
        if unknown:
            raise HarnessContractError("unknown_field", "Unknown approval action field is rejected.", f"/{unknown[0]}")
        if body.get("idempotency_key") is not None and body.get("idempotency_key") != key:
            raise HarnessContractError("idempotency_key_mismatch", "Body idempotency_key must match Idempotency-Key.", "/idempotency_key")
        action_digest = harness_canonical_sha256({"action": action, "reason": body.get("reason")})
        replay = agent_harness_store.record_stage2_approval_action(approval_id, idempotency_key=key, payload_digest=action_digest, action=action)
        if replay:
            return write_json(handler, HTTPStatus.OK, {"approval": agent_harness_store.get_stage2_approval(approval_id), "would_create_run": False, "idempotent_replay": True})
        updated = agent_harness_store.transition_stage2_approval(approval_id, "rejected" if action == "reject" else "revoked", reason=body.get("reason"))
        draft = agent_harness_store.get_stage2_draft(draft_id)
        if draft:
            harness_operation_event(draft["operation_id"], node="approval", state="draft", payload={"approval_id": approval_id, "status": updated["status"]}, draft_id=draft_id, approval_id=approval_id)
        return write_json(handler, HTTPStatus.OK, {"approval": updated, "would_create_run": False, "idempotent_replay": False})
    except (HarnessContractError, HarnessStoreError) as error:
        return harness_error(handler, error)


# ---- Stage 3A: approved single-run execution -----------------------------
BRIDGE_SERVER_ADDRESS: tuple[str, int] | None = None
EXECUTION_POLL_SECONDS = max(0.01, float(os.environ.get("TILESIM_EXECUTION_POLL_SECONDS", "0.05")))
EXECUTION_TIMEOUT_SECONDS = max(1.0, float(os.environ.get("TILESIM_EXECUTION_TIMEOUT_SECONDS", "120")))


def _remember_bridge_server(handler: SimpleHTTPRequestHandler) -> None:
    global BRIDGE_SERVER_ADDRESS
    try:
        host, port = handler.server.server_address[:2]
        BRIDGE_SERVER_ADDRESS = (str(host), int(port))
    except (AttributeError, TypeError, ValueError):
        pass


def _stage3_public(execution: dict[str, Any]) -> dict[str, Any]:
    return {
        key: execution.get(key)
        for key in (
            "schema_identity", "contract_revision", "execution_id", "operation_id", "draft_id", "approval_id",
            "validation_id", "draft_digest", "approval_digest", "input_snapshot_digest", "schema_set_revision",
            "backend_identity", "policy_revision", "workflow_revision", "idempotency_key", "request_digest",
            "principal", "workspace_id", "run_id", "state", "created_at", "updated_at", "attempt_count",
            "retryable", "unknown_outcome", "cancellation_fence", "result", "error",
        )
    }


def _stage3_event(execution: dict[str, Any], *, node: str, state: str, terminal: bool = False, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    return harness_operation_event(
        execution["operation_id"],
        node=node,
        state=state,
        terminal=terminal,
        payload=payload or {"execution_id": execution["execution_id"], "state": state},
        draft_id=execution["draft_id"],
        approval_id=execution["approval_id"],
        schema_identity=EXECUTION_SCHEMA_IDENTITIES["event"],
        contract_revision=EXECUTION_CONTRACT_REVISION,
    )


def _stage3_error(code: str, message: str, *, retryable: bool = False, unknown_outcome: bool = False) -> HarnessStoreError:
    return HarnessStoreError(code, message, retryable=retryable, unknown_outcome=unknown_outcome)


def _stage3_validate_bindings(handler: SimpleHTTPRequestHandler, body: dict[str, Any], principal: str, workspace_id: str) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    current_snapshot = _stage2_current_snapshot(handler, body.get("input_snapshot_digest"))
    normalized = validate_submit_request(
        body,
        principal=principal,
        workspace_id=workspace_id,
        schema_set_revision=SCHEMA_SET_REVISION,
        backend_identity=harness_backend_identity(),
    )
    if normalized["input_snapshot_digest"] != current_snapshot:
        raise HarnessContractError("snapshot_mismatch", "Input snapshot does not match the current workspace snapshot.", "/input_snapshot_digest")
    draft = agent_harness_store.get_stage2_draft(normalized["draft_id"])
    if draft is None:
        raise HarnessStoreError("draft_invalid", "Draft was not found.")
    if draft["principal"] != principal or draft["workspace_id"] != workspace_id:
        raise HarnessContractError("principal_forbidden", "Draft is not owned by this principal and workspace.", "/draft_id", status=403)
    if draft.get("status") != "validated":
        code = "draft_stale" if draft.get("status") in {"expired", "stale", "deleted"} else "draft_invalid"
        raise HarnessStoreError(code, "Only a current validated draft may execute.")
    for key in ("input_snapshot_digest", "schema_set_revision", "backend_identity", "policy_revision"):
        if draft.get(key) != normalized.get(key):
            code = "snapshot_mismatch" if key == "input_snapshot_digest" else "schema_revision_mismatch" if key == "schema_set_revision" else "backend_identity_mismatch" if key == "backend_identity" else "policy_revision_mismatch"
            raise HarnessStoreError(code, "Draft execution binding is stale.")
    approval = agent_harness_store.get_stage2_approval(normalized["approval_id"])
    if approval is None or approval.get("draft_id") != draft["draft_id"]:
        raise HarnessStoreError("approval_missing", "Approval was not found for this draft.")
    if approval.get("principal") != principal or approval.get("workspace_id") != workspace_id:
        raise HarnessContractError("principal_forbidden", "Approval is not owned by this principal and workspace.", "/approval_id", status=403)
    if approval.get("status") != "approved":
        code = (
            "approval_expired" if approval.get("status") == "expired"
            else "approval_revoked" if approval.get("status") == "revoked"
            else "draft_stale" if approval.get("status") == "stale"
            else "approval_replayed" if approval.get("consumed") else "approval_missing"
        )
        raise HarnessStoreError(code, "Approval is not executable.")
    if approval.get("single_use", True) is not True:
        raise HarnessStoreError("approval_not_single_use", "Execution requires a single-use approval.")
    if approval.get("consumed"):
        raise HarnessStoreError("approval_replayed", "Single-use approval has already been consumed.")
    if approval.get("draft_digest") != draft.get("draft_digest") or approval.get("draft_digest") != normalized.get("draft_digest"):
        raise HarnessStoreError("approval_digest_mismatch", "Approval does not bind the submitted draft digest.")
    if approval.get("approval_digest") != normalized.get("approval_digest"):
        raise HarnessStoreError("approval_digest_mismatch", "Approval digest does not match the submitted approval.")
    report = agent_harness_store.get_stage2_validation(approval.get("validation_id"))
    if not report or report.get("draft_id") != draft["draft_id"] or report.get("status") != "valid":
        raise HarnessStoreError("draft_invalid", "A current valid validation report is required.")
    if report.get("validator_revision") != draft.get("validator_revision"):
        raise HarnessStoreError("policy_revision_mismatch", "Validation report revision does not match the draft.")
    request = normalized["create_run_request"]
    digest = stage3_request_digest(request)
    if digest != normalized["create_run_request_digest"] or digest != report.get("validated_create_run_request_digest") or digest != draft.get("create_run_request_digest"):
        raise HarnessStoreError("approval_digest_mismatch", "create_run_request digest does not match the validated draft.")
    # Re-run the ordinary deterministic validator at the execution boundary.
    status, issues, _fields, _unsupported, _budget, _risks = _stage2_validate_payload(request)
    if status != "valid":
        raise HarnessStoreError("draft_invalid", "The approved request is no longer in the supported parameter surface.")
    return normalized, draft, approval, report


def _stage3_formal_run_request(request: dict[str, Any], *, idempotency_key: str, principal: str) -> tuple[int, dict[str, Any]]:
    """Call the published /api/runs route, never TileSimCLI directly."""
    if BRIDGE_SERVER_ADDRESS is None:
        raise TimeoutError("Bridge server address is unavailable.")
    connection = http.client.HTTPConnection(BRIDGE_SERVER_ADDRESS[0], BRIDGE_SERVER_ADDRESS[1], timeout=EXECUTION_TIMEOUT_SECONDS)
    try:
        body = json.dumps(request, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        connection.request("POST", "/api/runs", body=body, headers={
            "Content-Type": "application/json",
            "Content-Length": str(len(body)),
            "Idempotency-Key": idempotency_key,
            "X-TileSim-Principal": principal,
            "X-TileSim-Scopes": "agent:read_run",
        })
        response = connection.getresponse()
        raw = response.read()
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            payload = {"error": {"code": "invalid_run_response", "retryable": False}}
        return int(response.status), payload if isinstance(payload, dict) else {}
    finally:
        connection.close()


def _stage3_manifest_digest(manifest: dict[str, Any]) -> str:
    return harness_canonical_sha256(manifest)


def _stage3_validate_manifest(manifest: dict[str, Any], *, run_id: str, run_dir: Path) -> dict[str, Any]:
    """Reconcile the result manifest against the run repository at the fence.

    The execution worker must not trust a manifest returned by an adapter or a
    stale in-memory snapshot.  Recomputing the allow-listed entries from the
    run directory catches run/schema, byte-count, SHA-256 and rejection-set
    drift before a completed result reference is persisted.
    """
    if not isinstance(manifest, dict):
        raise run_repository.ArtifactManifestValidationError("Artifact manifest is not an object.")
    expected = run_repository.artifact_manifest_for(
        run_id,
        run_dir,
        artifact_definitions=JSON_ARTIFACT_DEFINITIONS,
        artifact_manifest_schema=ARTIFACT_MANIFEST_SCHEMA,
        api_version=API_VERSION,
        schema_set_revision=SCHEMA_SET_REVISION,
    )
    for field in ("schema_version", "api_version", "schema_set_revision", "run_id", "artifacts", "rejected_artifacts"):
        if manifest.get(field) != expected.get(field):
            raise run_repository.ArtifactManifestValidationError(f"Artifact manifest {field} mismatch.")
    return manifest


def _stage3_submit_run_side_effect(execution_record: dict[str, Any]) -> str:
    """Reserve the run through /api/runs before enqueueing monitoring work.

    This makes a successful submit response carry the durable run identity while
    the bounded worker remains responsible for all long-running monitoring and
    artifact reconciliation.
    """
    operation_id = execution_record["operation_id"]
    command_id = "create-run-0"
    side_key = f"{execution_record['idempotency_key']}:create-run:0"
    ledger = agent_harness_store.record_side_effect(
        operation_id=operation_id,
        command_id=command_id,
        idempotency_key=side_key,
        command_digest=execution_record["request_digest"],
        target_identity="tilesim.bridge:/api/runs",
    )
    if ledger and ledger.get("status") == "succeeded" and ledger.get("result_identity"):
        return str(ledger["result_identity"])
    if ledger and ledger.get("status") == "unknown":
        raise _stage3_error("unknown_outcome", "The create-run side effect has an unknown outcome.", unknown_outcome=True)
    run_key = f"tilesim-agent-execution:{execution_record['idempotency_key']}"
    try:
        status, response = _stage3_formal_run_request(
            agent_harness_store.get_stage3_request(execution_record["execution_id"]) or {},
            idempotency_key=run_key,
            principal=execution_record["principal"],
        )
    except (TimeoutError, OSError, http.client.HTTPException) as error:
        agent_harness_store.finish_side_effect(operation_id=operation_id, command_id=command_id, status="unknown", unknown_outcome=True)
        raise _stage3_error("unknown_outcome", "The create-run outcome could not be determined.", unknown_outcome=True) from error
    run_id = response.get("run_id")
    if status >= 400 or not isinstance(run_id, str):
        retryable = status in {429, 502, 503, 504}
        agent_harness_store.finish_side_effect(operation_id=operation_id, command_id=command_id, status="failed")
        raise _stage3_error(response.get("error", {}).get("code", "create_run_failed"), "The formal /api/runs entrypoint rejected the execution.", retryable=retryable)
    agent_harness_store.finish_side_effect(operation_id=operation_id, command_id=command_id, status="succeeded", result_identity=run_id)
    agent_harness_store.update_stage3_execution(execution_record["execution_id"], run_id=run_id)
    agent_harness_store.bind_operation_run(operation_id, run_id)
    return run_id


def _stage3_run_execution(execution_id: str) -> None:
    execution_record = agent_harness_store.get_stage3_execution(execution_id)
    if execution_record is None:
        return
    operation_id = execution_record["operation_id"]
    operation = agent_harness_store.get_operation(operation_id)
    if operation is None:
        return
    try:
        if execution_record["state"] in {"cancelled", "completed", "manual_intervention_required"}:
            return
        agent_harness_store.update_stage3_execution(execution_id, state="preparing", increment_attempt=True)
        agent_harness_store.transition(operation_id, "running", expected={"submitted", "queued", "running", "retrying", "recovery_required"})
        _stage3_event({**execution_record, "state": "preparing"}, node="preparing", state="preparing")
        execution_record = agent_harness_store.get_stage3_execution(execution_id) or execution_record
        side_digest = execution_record["request_digest"]
        if execution_record.get("run_id"):
            run_id = execution_record["run_id"]
        else:
            side_key = f"{execution_record['idempotency_key']}:create-run:{execution_record['attempt_count']}"
            ledger = agent_harness_store.record_side_effect(operation_id=operation_id, command_id=f"create-run-{execution_record['attempt_count']}", idempotency_key=side_key, command_digest=side_digest, target_identity="tilesim.bridge:/api/runs")
            if ledger and ledger.get("status") == "unknown":
                raise _stage3_error("unknown_outcome", "The create-run side effect has an unknown outcome.", unknown_outcome=True)
            if ledger and ledger.get("status") == "succeeded" and ledger.get("result_identity"):
                run_id = ledger["result_identity"]
            else:
                run_key = f"tilesim-agent-execution:{execution_record['idempotency_key']}"
                try:
                    request_payload = agent_harness_store.get_stage3_request(execution_id) or {}
                    status, response = _stage3_formal_run_request(request_payload, idempotency_key=run_key, principal=execution_record["principal"])
                except (TimeoutError, OSError, http.client.HTTPException) as error:
                    agent_harness_store.finish_side_effect(operation_id=operation_id, command_id=f"create-run-{execution_record['attempt_count']}", status="unknown", unknown_outcome=True)
                    raise _stage3_error("unknown_outcome", "The create-run outcome could not be determined.", unknown_outcome=True) from error
                run_id = response.get("run_id")
                if status >= 400 or not isinstance(run_id, str):
                    retryable = status in {429, 502, 503, 504}
                    agent_harness_store.finish_side_effect(operation_id=operation_id, command_id=f"create-run-{execution_record['attempt_count']}", status="failed", unknown_outcome=False)
                    raise _stage3_error(response.get("error", {}).get("code", "create_run_failed"), "The formal /api/runs entrypoint rejected the execution.", retryable=retryable)
                agent_harness_store.finish_side_effect(operation_id=operation_id, command_id=f"create-run-{execution_record['attempt_count']}", status="succeeded", result_identity=run_id)
        agent_harness_store.update_stage3_execution(execution_id, state="running", run_id=run_id)
        agent_harness_store.bind_operation_run(operation_id, run_id)
        events_now = agent_harness_store.list_events(operation_id)
        agent_harness_store.save_checkpoint(
            operation_id,
            checkpoint_id=f"cp-{execution_id}-{execution_record['attempt_count']}",
            state_digest=execution_record["request_digest"],
            last_event_sequence=events_now[-1]["sequence"] if events_now else 0,
            side_effect_digests=[side_digest],
            resume_policy={"workflow_revision": execution_record["workflow_revision"], "no_blind_retry_unknown_outcome": True},
            schema_set_revision=execution_record["schema_set_revision"],
            backend_identity=execution_record["backend_identity"],
        )
        # The bounded HarnessQueue worker owns the generic operation lease and
        # transitions it to ``running`` before invoking this execution handler.
        # Execution-specific ``preparing`` is intentionally kept in the
        # successor execution record; trying to transition the generic
        # operation from ``preparing`` here races with that worker-owned state
        # and incorrectly fences an otherwise valid run as failed.
        agent_harness_store.transition(operation_id, "running", expected={"running"})
        _stage3_event({**execution_record, "run_id": run_id}, node="run", state="running")
        started = time.monotonic()
        while time.monotonic() - started < EXECUTION_TIMEOUT_SECONDS:
            current = agent_harness_store.get_stage3_execution(execution_id) or execution_record
            if current.get("state") == "cancelled" or current.get("cancellation_fence"):
                return
            run = run_snapshot(run_id)
            if run is None:
                time.sleep(EXECUTION_POLL_SECONDS)
                continue
            if run.get("status") == "failed":
                raise _stage3_error("run_failed", "TileSim run reached failed terminal state.", retryable=False)
            if run.get("status") == "completed":
                agent_harness_store.update_stage3_execution(execution_id, state="waiting_artifacts", run_id=run_id)
                agent_harness_store.transition(operation_id, "running", expected={"running"})
                _stage3_event({**current, "run_id": run_id}, node="artifacts", state="waiting_artifacts")
                try:
                    manifest = artifact_manifest_for(run_id, safe_run_directory(run_id))
                    manifest = _stage3_validate_manifest(manifest, run_id=run_id, run_dir=safe_run_directory(run_id))
                except (run_repository.ArtifactManifestValidationError, TypeError, OSError) as error:
                    raise _stage3_error("artifact_manifest_invalid", "Run artifact manifest failed verification.") from error
                result = stage3_result_reference(operation={**current, "operation_id": operation_id}, run=run, manifest=manifest, manifest_digest=_stage3_manifest_digest(manifest))
                agent_harness_store.update_stage3_execution(execution_id, state="completed", run_id=run_id, result=result, retryable=False, unknown_outcome=False)
                agent_harness_store.transition(operation_id, "completed", expected={"running"})
                _stage3_event({**current, "run_id": run_id}, node="result", state="completed", terminal=True, payload={"run_id": run_id, "manifest_digest": result["manifest_digest"]})
                return
            time.sleep(EXECUTION_POLL_SECONDS)
        raise _stage3_error("run_timeout", "The run did not reach a terminal state before the execution deadline.", unknown_outcome=True)
    except HarnessStoreError as error:
        execution_record = agent_harness_store.get_stage3_execution(execution_id) or execution_record
        if execution_record.get("state") == "cancelled":
            return
        if error.unknown_outcome:
            agent_harness_store.update_stage3_execution(execution_id, state="recovery_required", error={"code": error.code, "retryable": False, "unknown_outcome": True}, retryable=False, unknown_outcome=True)
            try:
                agent_harness_store.transition(operation_id, "recovery_required", expected={"preparing", "running", "waiting_artifacts"}, error={"code": error.code, "retryable": False, "unknown_outcome": True})
            except HarnessStoreError:
                pass
            _stage3_event({**execution_record, "state": "recovery_required"}, node="recovery", state="recovery_required", terminal=True, payload={"code": error.code})
        else:
            agent_harness_store.update_stage3_execution(execution_id, state="failed", error={"code": error.code, "retryable": error.retryable, "unknown_outcome": False}, retryable=error.retryable, unknown_outcome=False)
            try:
                agent_harness_store.transition(operation_id, "failed", expected={"preparing", "running", "waiting_artifacts", "retrying"}, error={"code": error.code, "retryable": error.retryable, "unknown_outcome": False})
            except HarnessStoreError:
                pass
            _stage3_event({**execution_record, "state": "failed"}, node="run", state="failed", terminal=True, payload={"code": error.code, "retryable": error.retryable})


def create_stage3_execution(handler: SimpleHTTPRequestHandler) -> None:
    try:
        principal, scopes = harness_principal(handler)
        if "agent:submit_experiment" not in scopes:
            raise HarnessContractError("scope_denied", "Submit requires agent:submit_experiment.", "/headers/X-TileSim-Scopes", status=403)
        key = handler.headers.get("Idempotency-Key", "").strip()
        if not re.fullmatch(r"[A-Za-z0-9._:-]{1,256}", key):
            raise HarnessContractError("missing_idempotency_key", "Idempotency-Key is required for execution submit.", "/headers/Idempotency-Key")
        body = harness_json_body(handler)
        if body.get("idempotency_key") not in {None, key}:
            raise HarnessContractError("idempotency_key_mismatch", "Body idempotency_key must match Idempotency-Key.", "/idempotency_key")
        body["idempotency_key"] = key
        # Replay is checked before approval validation: a completed or queued
        # submit with the same canonical payload must never consume the approval
        # a second time.
        existing = agent_harness_store.get_stage3_by_idempotency(key)
        submitted_request = body.get("create_run_request")
        if existing is not None and isinstance(submitted_request, dict):
            submitted_digest = stage3_request_digest(submitted_request)
            if existing.get("request_digest") != submitted_digest:
                raise HarnessStoreError("payload_conflict", "Execution idempotency key is bound to another payload.")
            return write_json(handler, HTTPStatus.OK, {"execution": _stage3_public(existing), "operation": harness_public_operation(agent_harness_store.get_operation(existing["operation_id"]) or {}), "idempotent_replay": True})
        normalized, draft, approval, report = _stage3_validate_bindings(handler, body, principal, harness_workspace(handler))
        request_digest_value = stage3_request_digest(normalized["create_run_request"])
        existing = agent_harness_store.get_stage3_by_idempotency(key)
        if existing is not None:
            if existing.get("request_digest") != request_digest_value:
                raise HarnessStoreError("payload_conflict", "Execution idempotency key is bound to another payload.")
            return write_json(handler, HTTPStatus.OK, {"execution": _stage3_public(existing), "operation": harness_public_operation(agent_harness_store.get_operation(existing["operation_id"]) or {}), "idempotent_replay": True})
        if not ensure_harness_queue().has_capacity():
            raise HarnessStoreError("queue_capacity_reached", "The bounded local execution queue is full.", retryable=True)
        consumed = agent_harness_store.consume_stage2_approval(approval["approval_id"], draft_digest=draft["draft_digest"], validation_id=approval["validation_id"], principal=principal, workspace_id=draft["workspace_id"], schema_set_revision=SCHEMA_SET_REVISION, backend_identity=harness_backend_identity())
        operation, _ = agent_harness_store.create_operation(idempotency_key=f"execution:{key}", request_payload={"execution_request_digest": request_digest_value, "approval_digest": consumed["approval_digest"]}, schema_set_revision=SCHEMA_SET_REVISION, backend_identity=harness_backend_identity(), principal=principal, operation_kind="controlled_execution", snapshot_digest=draft["input_snapshot_digest"])
        agent_harness_store.transition(operation["operation_id"], "submitted", expected={"queued"})
        execution_record = execution_operation(operation_id=operation["operation_id"], execution_id=f"exec-{uuid.uuid4().hex}", draft_id=draft["draft_id"], approval_id=approval["approval_id"], validation_id=approval["validation_id"], draft_digest=draft["draft_digest"], approval_digest=approval["approval_digest"], input_snapshot_digest=draft["input_snapshot_digest"], schema_set_revision=SCHEMA_SET_REVISION, backend_identity=harness_backend_identity(), policy_revision=AGENT_HARNESS_POLICY_REVISION, workflow_revision=EXECUTION_CONTRACT_REVISION, idempotency_key=key, request_digest_value=request_digest_value, principal=principal, workspace_id=draft["workspace_id"], state="submitted")
        agent_harness_store.save_stage3_execution(execution_record, request_payload=normalized["create_run_request"])
        agent_harness_store.transition(operation["operation_id"], "queued", expected={"submitted"})
        queued = agent_harness_store.update_stage3_execution(execution_record["execution_id"], state="queued")
        _stage3_event(queued, node="queue", state="queued")
        try:
            run_id = _stage3_submit_run_side_effect(queued)
            queued = agent_harness_store.get_stage3_execution(execution_record["execution_id"]) or queued
        except HarnessStoreError as error:
            if error.unknown_outcome:
                agent_harness_store.update_stage3_execution(execution_record["execution_id"], state="recovery_required", error={"code": error.code, "retryable": False, "unknown_outcome": True}, unknown_outcome=True)
                agent_harness_store.transition(operation["operation_id"], "recovery_required", expected={"queued"}, error={"code": error.code, "retryable": False, "unknown_outcome": True})
            else:
                agent_harness_store.update_stage3_execution(execution_record["execution_id"], state="failed", error={"code": error.code, "retryable": error.retryable, "unknown_outcome": False}, retryable=error.retryable)
                agent_harness_store.transition(operation["operation_id"], "failed", expected={"queued"}, error={"code": error.code, "retryable": error.retryable, "unknown_outcome": False})
            failed = agent_harness_store.get_stage3_execution(execution_record["execution_id"]) or queued
            _stage3_event(failed, node="submit", state=failed["state"], terminal=True, payload={"code": error.code})
            return write_json(handler, HTTPStatus.ACCEPTED, {"execution": _stage3_public(failed), "operation": harness_public_operation(agent_harness_store.get_operation(operation["operation_id"]) or {}), "idempotent_replay": False})
        ensure_harness_queue().submit(operation["operation_id"])
        return write_json(handler, HTTPStatus.ACCEPTED, {"execution": _stage3_public(queued), "operation": harness_public_operation(agent_harness_store.get_operation(operation["operation_id"]) or {}), "run_id": queued.get("run_id"), "idempotent_replay": False})
    except (HarnessContractError, HarnessStoreError) as error:
        return harness_error(handler, error)


def _get_stage3_for_request(handler: SimpleHTTPRequestHandler, operation_id: str, scope: str = "agent:read_run") -> tuple[dict[str, Any], dict[str, Any]]:
    execution = agent_harness_store.get_stage3_by_operation(operation_id)
    if execution is None:
        raise HarnessStoreError("execution_not_found", "Execution operation was not found.")
    principal, scopes = harness_principal(handler)
    if scope not in scopes:
        raise HarnessContractError("scope_denied", f"{scope} is required for this operation.", "/headers/X-TileSim-Scopes", status=403)
    if execution.get("principal") != principal:
        raise HarnessContractError("principal_forbidden", "Execution is not owned by this principal.", "/operation_id", status=403)
    return execution, agent_harness_store.get_operation(operation_id) or {}


def get_stage3_execution(handler: SimpleHTTPRequestHandler, operation_id: str) -> None:
    try:
        execution_record, operation = _get_stage3_for_request(handler, operation_id)
        return write_json(handler, HTTPStatus.OK, {"execution": _stage3_public(execution_record), "operation": harness_public_operation(operation)})
    except (HarnessContractError, HarnessStoreError) as error:
        return harness_error(handler, error)


def stage3_execution_events(handler: SimpleHTTPRequestHandler, operation_id: str) -> None:
    try:
        execution_record, operation = _get_stage3_for_request(handler, operation_id)
        raw_after = handler.headers.get("Last-Event-ID", "0")
        try:
            after = _strict_event_cursor(raw_after)
        except ValueError as error:
            raise HarnessContractError("invalid_last_event_id", "Last-Event-ID must be a sequence integer.", "/headers/Last-Event-ID") from error
        events = agent_harness_store.list_events(operation_id)
        if any(item["sequence"] != index for index, item in enumerate(events, 1)):
            raise HarnessStoreError("event_sequence_gap", "Execution event sequence has a gap; recovery is required.")
        if after > 0 and not any(event["sequence"] == after for event in events):
            raise HarnessStoreError("event_not_found", "Last-Event-ID is not present in the durable event log.")
        return write_json(handler, HTTPStatus.OK, {"execution": _stage3_public(execution_record), "operation": harness_public_operation(operation), "events": [event for event in events if event["sequence"] > after], "after_sequence": after, "terminal": execution_record.get("state") in EXECUTION_TERMINAL_STATES})
    except (HarnessContractError, HarnessStoreError) as error:
        return harness_error(handler, error)


def stage3_execution_result(handler: SimpleHTTPRequestHandler, operation_id: str) -> None:
    try:
        execution_record, _operation = _get_stage3_for_request(handler, operation_id)
        if execution_record.get("state") != "completed" or not execution_record.get("result"):
            raise HarnessStoreError("result_not_ready", "Execution result is not complete.", retryable=True)
        return write_json(handler, HTTPStatus.OK, {"result": execution_record["result"]})
    except (HarnessContractError, HarnessStoreError) as error:
        return harness_error(handler, error)


def stream_stage3_execution_events(handler: SimpleHTTPRequestHandler, operation_id: str) -> None:
    try:
        execution_record, operation = _get_stage3_for_request(handler, operation_id)
        raw_after = handler.headers.get("Last-Event-ID", "0")
        try:
            after = _strict_event_cursor(raw_after)
        except ValueError as error:
            raise HarnessContractError("invalid_last_event_id", "Last-Event-ID must be a sequence integer.", "/headers/Last-Event-ID") from error
        events = agent_harness_store.list_events(operation_id)
        if any(item["sequence"] != index for index, item in enumerate(events, 1)):
            raise HarnessStoreError("event_sequence_gap", "Execution event sequence has a gap; recovery is required.")
        if after > 0 and not any(event["sequence"] == after for event in events):
            raise HarnessStoreError("event_not_found", "Last-Event-ID is not present in the durable event log.")
        handler.send_response(HTTPStatus.OK)
        handler.send_header("Content-Type", "text/event-stream; charset=utf-8")
        handler.send_header("Cache-Control", "no-store")
        handler.send_header("Connection", "close")
        add_contract_headers(handler)
        add_cors_headers(handler)
        handler.end_headers()
        for event in events:
            if event["sequence"] > after:
                responses.write_sse_event(handler, event="execution", event_id=str(event["sequence"]), data=event)
        if execution_record.get("state") in EXECUTION_TERMINAL_STATES:
            responses.write_sse_event(handler, event="terminal", data={"operation_id": operation_id, "state": execution_record["state"]})
    except (HarnessContractError, HarnessStoreError) as error:
        return harness_error(handler, error)


def mutate_stage3_execution(handler: SimpleHTTPRequestHandler, operation_id: str, action: str) -> None:
    command_id: str | None = None
    try:
        execution_record, operation = _get_stage3_for_request(handler, operation_id, {"cancel": "agent:cancel_experiment", "retry": "agent:retry_experiment", "resume": "agent:resume_experiment"}[action])
        command_key = handler.headers.get("Idempotency-Key", "").strip()
        if not re.fullmatch(r"[A-Za-z0-9._:-]{1,256}", command_key):
            raise HarnessContractError("missing_idempotency_key", "Idempotency-Key is required for execution mutations.", "/headers/Idempotency-Key")
        validate_mutation_request(harness_json_body(handler), operation_id=operation_id, action=action, idempotency_key=command_key)
        command_digest = harness_canonical_sha256({"action": action, "operation_id": operation_id})
        command_id = f"{action}-{command_key}"
        side_effect_key = f"execution:{action}:{command_key}"
        existing_effect = agent_harness_store.record_side_effect(
            operation_id=operation_id,
            command_id=command_id,
            idempotency_key=side_effect_key,
            command_digest=command_digest,
            target_identity=f"tilesim.bridge:/api/agent/executions/{action}",
        )
        if existing_effect and existing_effect.get("status") == "succeeded":
            current = agent_harness_store.get_stage3_execution(execution_record["execution_id"]) or execution_record
            return write_json(handler, HTTPStatus.OK, {"execution": _stage3_public(current), "operation": harness_public_operation(agent_harness_store.get_operation(operation_id) or {}), "action": action, "idempotent_replay": True})
        if existing_effect and existing_effect.get("status") in {"started", "unknown"}:
            raise _stage3_error("unknown_outcome", "Execution mutation outcome is unknown; manual recovery is required.", unknown_outcome=True)
        if existing_effect and existing_effect.get("status") == "failed":
            raise HarnessStoreError(existing_effect.get("result_identity") or "execution_mutation_failed", "Execution mutation key already has a failed command.")
        if action == "cancel":
            if execution_record.get("state") not in EXECUTION_CANCELABLE_STATES:
                raise HarnessStoreError("cancel_not_allowed", "Only queued, preparing, running, or waiting_artifacts executions may be cancelled.")
            fence = f"cancel-fence-{uuid.uuid4().hex}"
            agent_harness_store.update_stage3_execution(execution_record["execution_id"], state="cancel_requested", cancellation_fence=fence)
            updated_operation = agent_harness_store.transition(operation_id, "cancelled", expected={"queued", "preparing", "running", "waiting_artifacts"}, cancellation_fence=fence)
            updated = agent_harness_store.update_stage3_execution(execution_record["execution_id"], state="cancelled", cancellation_fence=fence)
            _stage3_event(updated, node="cancel", state="cancelled", terminal=True, payload={"cancellation_fence": fence})
        elif action == "retry":
            if execution_record.get("state") != "failed" or not execution_record.get("retryable") or execution_record.get("unknown_outcome"):
                raise HarnessStoreError("retry_not_allowed", "Retry requires an explicit retryable failure with no unknown side effect.")
            updated = agent_harness_store.update_stage3_execution(execution_record["execution_id"], state="retrying", error=None, clear_error=True, unknown_outcome=False, increment_attempt=False)
            updated_operation = agent_harness_store.transition(operation_id, "retrying", expected={"failed"})
            agent_harness_store.transition(operation_id, "queued", expected={"retrying"})
            updated = agent_harness_store.update_stage3_execution(execution_record["execution_id"], state="queued")
            _stage3_event(updated, node="retry", state="queued", payload={"attempt_count": updated["attempt_count"]})
            try:
                ensure_harness_queue().submit(operation_id)
            except HarnessStoreError as error:
                agent_harness_store.update_stage3_execution(execution_record["execution_id"], state="failed", error={"code": error.code, "retryable": error.retryable, "unknown_outcome": False}, retryable=error.retryable)
                agent_harness_store.transition(operation_id, "failed", expected={"queued"}, error={"code": error.code, "retryable": error.retryable, "unknown_outcome": False})
                raise
        else:
            if execution_record.get("state") != "recovery_required":
                raise HarnessStoreError("resume_not_allowed", "Resume requires recovery_required state.")
            if execution_record.get("schema_set_revision") != SCHEMA_SET_REVISION or execution_record.get("backend_identity") != harness_backend_identity() or execution_record.get("policy_revision") != AGENT_HARNESS_POLICY_REVISION or execution_record.get("workflow_revision") != EXECUTION_CONTRACT_REVISION:
                raise HarnessStoreError("schema_revision_mismatch", "Checkpoint identity is stale and cannot resume.")
            if any(item.get("status") == "unknown" or item.get("unknown_outcome") for item in agent_harness_store.list_side_effects(operation_id)):
                agent_harness_store.update_stage3_execution(execution_record["execution_id"], state="manual_intervention_required", error={"code": "unknown_outcome", "retryable": False, "unknown_outcome": True}, unknown_outcome=True)
                raise HarnessStoreError("unknown_outcome", "Unknown side effect requires manual intervention.", unknown_outcome=True)
            agent_harness_store.transition(operation_id, "queued", expected={"recovery_required"})
            updated = agent_harness_store.update_stage3_execution(execution_record["execution_id"], state="queued", unknown_outcome=False)
            _stage3_event(updated, node="resume", state="queued", payload={"recovered": True})
            try:
                ensure_harness_queue().submit(operation_id)
            except HarnessStoreError as error:
                agent_harness_store.update_stage3_execution(execution_record["execution_id"], state="recovery_required", error={"code": error.code, "retryable": error.retryable, "unknown_outcome": False}, retryable=error.retryable)
                agent_harness_store.transition(operation_id, "recovery_required", expected={"queued"}, error={"code": error.code, "retryable": error.retryable, "unknown_outcome": False})
                raise
        agent_harness_store.finish_side_effect(operation_id=operation_id, command_id=command_id, status="succeeded", result_identity=operation_id)
        return write_json(handler, HTTPStatus.OK, {"execution": _stage3_public(updated), "operation": harness_public_operation(agent_harness_store.get_operation(operation_id) or {}), "action": action, "idempotent_replay": False})
    except (HarnessContractError, HarnessStoreError) as error:
        if command_id is not None and getattr(error, "code", "") not in {"unknown_outcome"}:
            try:
                agent_harness_store.finish_side_effect(operation_id=operation_id, command_id=command_id, status="failed", result_identity=getattr(error, "code", "execution_mutation_failed"))
            except HarnessStoreError:
                pass
        return harness_error(handler, error)


def _optimization_public(detail: dict[str, Any]) -> dict[str, Any]:
    """Return the bounded optimization projection; never return run payloads."""
    return detail


def _optimization_scoped(handler: SimpleHTTPRequestHandler, required: str | set[str]) -> tuple[str, str]:
    principal, scopes = harness_principal(handler)
    wanted = {required} if isinstance(required, str) else required
    if not wanted.intersection(scopes):
        raise OptimizationError("scope_denied", "The requested optimization action is not in the caller scope.", field_path="/headers/X-TileSim-Scopes")
    return principal, harness_workspace(handler)


def _optimization_detail_for(handler: SimpleHTTPRequestHandler, session_id: str, required: str = "agent:read_run") -> tuple[str, str, dict[str, Any]]:
    principal, workspace = _optimization_scoped(handler, required)
    detail = optimization_store.detail(session_id)
    if detail is None:
        raise OptimizationError("session_not_found", "Optimization session was not found.")
    session = detail["session"]
    if session.get("principal") != principal or session.get("workspace_id") != workspace:
        raise OptimizationError("operation_access_denied", "Optimization session is not owned by this principal and workspace.")
    if session.get("schema_set_revision") != SCHEMA_SET_REVISION:
        raise OptimizationError("schema_revision_mismatch", "Optimization session schema-set revision is stale.")
    if session.get("backend_identity") != harness_backend_identity():
        raise OptimizationError("backend_identity_mismatch", "Optimization session backend identity is stale.")
    return principal, workspace, detail


def _optimization_authorization_session(handler: SimpleHTTPRequestHandler, session_id: str, required: str) -> tuple[str, str, dict[str, Any]]:
    principal, workspace, detail = _optimization_detail_for(handler, session_id, required)
    session = detail["session"]
    if session.get("schema_set_revision") != SCHEMA_SET_REVISION or session.get("backend_identity") != harness_backend_identity():
        raise OptimizationError("schema_revision_mismatch", "Authorization session identity is stale.")
    return principal, workspace, detail


def get_optimization_authorization(handler: SimpleHTTPRequestHandler, session_id: str) -> None:
    try:
        _principal, _workspace, detail = _optimization_authorization_session(handler, session_id, "agent:read_draft")
        return write_json(handler, HTTPStatus.OK, {"authorization": detail.get("authorization"), "session_id": session_id, "provenance": OPTIMIZATION_PROVENANCE})
    except OptimizationError as error:
        return harness_error(handler, error)


def create_optimization_authorization(handler: SimpleHTTPRequestHandler, session_id: str) -> None:
    try:
        principal, workspace, detail = _optimization_authorization_session(handler, session_id, "agent:approve_draft")
        key = handler.headers.get("Idempotency-Key", "").strip()
        if not re.fullmatch(r"[A-Za-z0-9._:-]{8,128}", key):
            raise OptimizationError("missing_idempotency_key", "Idempotency-Key is required for authorization writes.", field_path="/headers/Idempotency-Key")
        body = harness_json_body(handler)
        session = detail["session"]
        request_digest = harness_canonical_sha256(body)
        replay = optimization_store.authorization_request(session_id, key, request_digest)
        if replay is not None:
            current = optimization_store.get(session_id)
            return write_json(
                handler,
                HTTPStatus.OK,
                {
                    "authorization": replay,
                    "session": current,
                    "detail": optimization_store.detail(session_id),
                    "idempotent_replay": True,
                    "provenance": OPTIMIZATION_PROVENANCE,
                },
            )
        existing = detail.get("authorization")
        if isinstance(existing, dict):
            if existing.get("status") == "active":
                # A second issuance would create two competing envelopes for
                # one session.  The caller must revoke first and create a new
                # session rather than silently replacing the old grant.
                raise OptimizationError("authorization_already_issued", "This session already has an active authorization envelope.")
            raise OptimizationError("authorization_inactive", "This session authorization is no longer active.")
        normalized = validate_authorization(body, session=session)
        requested_level = normalized["autonomy_level"]
        if requested_level == "bounded_autonomous" and (os.environ.get("TILESIM_AGENT_AUTONOMY", AGENT_AUTONOMY_MODE).strip().lower() != "auto" or os.environ.get("TILESIM_AGENT_TOOLS", "on" if AGENT_TOOLS_ENABLED else "off").strip().lower() not in {"on", "true", "1"}):
            raise OptimizationError("autonomy_disabled", "Bounded autonomous optimization is disabled by the local Bridge flag.")
        allowlist = normalized["tool_allowlist"]
        # The autonomous loop dispatches through ``_harness_dispatch``.  The
        # optimization registry also contains descriptive/session operations
        # (for example ``validate_draft`` and ``resume_execution``) that have
        # no tool-gateway handler; advertising those names would create an
        # authorization that can never be executed.  Keep the allow-list bound
        # to the actual closed gateway registry until a dedicated dispatcher is
        # published for any additional operation.
        published = set(harness_tools.TOOL_DEFINITIONS)
        if not isinstance(allowlist, list) or any(item not in published for item in allowlist):
            raise OptimizationError("invalid_tool_allowlist", "Authorization tool_allowlist contains an unpublished tool.", field_path="/tool_allowlist")
        envelope = issue_authorization(
            session=session,
            grants=normalized["parameter_grants"],
            objective=normalized["objective"],
            budget=normalized["budget"],
            tool_allowlist=allowlist,
            allowed_pages=normalized["allowed_pages"],
            allowed_actions=normalized["allowed_actions"],
            autonomy_level=requested_level,
            issued_by=principal,
            ttl_seconds=normalized["ttl_seconds"],
        )
        optimization_store.set_authorization(session_id, envelope)
        optimization_store.record_authorization_request(session_id, key, request_digest, envelope)
        autonomous_accepted = False
        if requested_level == "bounded_autonomous" and os.environ.get("TILESIM_AGENT_AUTONOMY", AGENT_AUTONOMY_MODE).strip().lower() == "auto" and os.environ.get("TILESIM_AGENT_TOOLS", "on" if AGENT_TOOLS_ENABLED else "off").strip().lower() in {"on", "true", "1"}:
            candidate = optimization_store.candidate(session_id)
            if candidate is None:
                raise OptimizationError("candidate_not_found", "The session has no initial candidate.")
            grant = optimization_store.approve_autonomous(session_id, candidate["candidate_id"], principal=principal, authorization_digest=envelope["authorization_digest"], expires_at=(datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat())
            with optimization_workers_lock:
                thread = optimization_workers.get(session_id)
                if thread is None or not thread.is_alive():
                    thread = threading.Thread(target=_optimization_worker, args=(session_id, candidate["candidate_id"], grant), daemon=True)
                    optimization_workers[session_id] = thread
                    thread.start()
            autonomous_accepted = True
        return write_json(handler, HTTPStatus.CREATED, {"authorization": envelope, "session": optimization_store.get(session_id), "detail": optimization_store.detail(session_id), "autonomous_started": autonomous_accepted, "idempotent_replay": False, "provenance": OPTIMIZATION_PROVENANCE})
    except (OptimizationError, AuthorizationError) as error:
        if isinstance(error, AuthorizationError):
            wrapped = OptimizationError(error.code, str(error), field_path=error.field_path)
        else:
            wrapped = error
        return harness_error(handler, wrapped)


def revoke_optimization_authorization(handler: SimpleHTTPRequestHandler, session_id: str) -> None:
    try:
        principal, _workspace, detail = _optimization_authorization_session(handler, session_id, "agent:approve_draft")
        key = handler.headers.get("Idempotency-Key", "").strip()
        if not re.fullmatch(r"[A-Za-z0-9._:-]{8,128}", key):
            raise OptimizationError("missing_idempotency_key", "Idempotency-Key is required for authorization writes.", field_path="/headers/Idempotency-Key")
        body = harness_json_body(handler)
        request_digest = harness_canonical_sha256(body)
        replay_key = f"revoke:{key}"
        replay = optimization_store.authorization_request(session_id, replay_key, request_digest)
        if replay is not None:
            current = optimization_store.get(session_id)
            return write_json(
                handler,
                HTTPStatus.OK,
                {
                    "authorization": replay,
                    "session": current,
                    "detail": optimization_store.detail(session_id),
                    "idempotent_replay": True,
                    "provenance": OPTIMIZATION_PROVENANCE,
                },
            )
        if body:
            raise OptimizationError("payload_conflict", "Authorization revoke does not accept a request body.")
        authorization = detail.get("authorization")
        if not isinstance(authorization, dict):
            raise OptimizationError("authorization_not_found", "No authorization envelope exists for this session.")
        verified = verify_authorization(authorization, session=detail["session"], principal=principal, workspace_id=detail["session"]["workspace_id"], schema_set_revision=SCHEMA_SET_REVISION, backend_identity=harness_backend_identity())
        if not verified.get("valid") and verified.get("code") not in {"authorization_inactive", "authorization_expired"}:
            raise OptimizationError(verified.get("code", "authorization_invalid"), "Authorization envelope failed verification.")
        revoked = revoke_authorization(authorization, actor=principal)
        revoked, replayed = optimization_store.revoke_authorization_idempotent(
            session_id,
            revoked,
            idempotency_key=replay_key,
            request_digest=request_digest,
        )
        return write_json(handler, HTTPStatus.OK, {"authorization": revoked, "session": optimization_store.get(session_id), "detail": optimization_store.detail(session_id), "idempotent_replay": replayed, "provenance": OPTIMIZATION_PROVENANCE})
    except HarnessContractError as error:
        return harness_error(handler, error)
    except (OptimizationError, AuthorizationError) as error:
        wrapped = OptimizationError(error.code, str(error), field_path=getattr(error, "field_path", "/")) if isinstance(error, AuthorizationError) else error
        return harness_error(handler, wrapped)


def _optimization_stage2_records(session: dict[str, Any], candidate: dict[str, Any], approval: dict[str, Any]) -> dict[str, Any]:
    """Create the redacted Stage-2 records consumed by the formal WPC endpoint."""
    # A candidate is immutable and is the source of truth for each iteration.
    # The session-level request is retained only as a bootstrap fallback for
    # older local-dev records created before candidate configs were persisted.
    request = candidate.get("config") or session.get("execution_request")
    if not isinstance(request, dict) or not request:
        raise OptimizationError("execution_request_unavailable", "This candidate has no formal execution request.")
    retry_count = int(candidate.get("retry_count", 0))
    retry_suffix = f":retry-{retry_count}" if retry_count else ""
    status, issues, fields, unsupported, budget, risks = _stage2_validate_payload(request)
    if status != "valid":
        raise OptimizationError("candidate_invalid", "Candidate failed the formal parameter validator.")
    draft_id = f"opt-draft-{candidate['candidate_id']}{retry_suffix}"
    operation_id = f"opt-draft-op-{candidate['candidate_id']}{retry_suffix}"
    request_digest = stage3_request_digest(request)
    draft_payload = {
        "draft_id": draft_id, "operation_id": operation_id, "principal": session["principal"], "workspace_id": session["workspace_id"],
        "input_snapshot_digest": session["input_snapshot_digest"], "schema_set_revision": SCHEMA_SET_REVISION, "backend_identity": harness_backend_identity(),
        "parameter_catalog_revision": session.get("parameter_catalog_revision", "local-dev.optimization.catalog.v1"), "validator_revision": session.get("validator_revision", "local-dev.optimization.validator.v1"),
        "policy_revision": AGENT_HARNESS_POLICY_REVISION, "run_scope": "optimization_candidate", "field_diffs": candidate.get("diff", {}).get("changed_fields", []),
        "assumptions": ["local-dev optimization candidate"], "evidence_refs": [], "budget_request": session["budget"], "risk_flags": ["synthetic_trace_not_fidelity_ground_truth"],
        "status": "validated", "created_at": stage2_now(), "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
        "draft_digest": stage2_draft_digest({"candidate_digest": candidate["candidate_digest"], "input_snapshot_digest": session["input_snapshot_digest"], "schema_set_revision": SCHEMA_SET_REVISION}),
        "idempotency_key": f"optimization-draft:{candidate['candidate_id']}{retry_suffix}", "would_create_run": False, "create_run_request_digest": request_digest,
        "create_run_request": request,
    }
    operation, replay = agent_harness_store.create_operation(idempotency_key=f"optimization-draft-op:{candidate['candidate_id']}{retry_suffix}", request_payload={"candidate_digest": candidate["candidate_digest"], "retry_count": retry_count}, schema_set_revision=SCHEMA_SET_REVISION, backend_identity=harness_backend_identity(), principal=session["principal"], operation_kind="draft_validation", operation_id=operation_id)
    if not replay:
        agent_harness_store.transition(operation_id, "draft", expected={"queued"})
        harness_operation_event(operation_id, node="draft", state="draft", payload={"candidate_digest": candidate["candidate_digest"]}, draft_id=draft_id)
    agent_harness_store.save_stage2_draft(draft_payload, operation_id=operation_id, idempotency_key=draft_payload["idempotency_key"], draft_digest=draft_payload["draft_digest"])
    report = stage2_validation_report(draft=draft_payload, validation_id=f"opt-validation-{candidate['candidate_id']}", status="valid", issues=issues, field_results=fields, unsupported_fields=unsupported, stale_reasons=[], budget_estimate=budget, risk_flags=risks, validated_request_digest=request_digest)
    agent_harness_store.save_stage2_validation(report, idempotency_key=f"optimization-validation:{candidate['candidate_id']}{retry_suffix}", payload_digest=optimization_digest(request))
    approval_payload = {
        "approval_id": f"opt-wpc-approval-{candidate['candidate_id']}{retry_suffix}", "draft_id": draft_id, "draft_digest": draft_payload["draft_digest"], "validation_id": report["validation_id"],
        "principal": session["principal"], "workspace_id": session["workspace_id"], "policy_revision": AGENT_HARNESS_POLICY_REVISION, "schema_set_revision": SCHEMA_SET_REVISION,
        "backend_identity": harness_backend_identity(), "status": "approved", "created_at": stage2_now(), "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
        "approved_at": stage2_now(), "rejected_at": None, "revoked_at": None, "reason": "local-dev candidate approval", "approval_digest": approval["approval_digest"], "single_use": True, "consumed": False,
        "schema_identity": STAGE2_SCHEMA_IDENTITIES["approval"], "contract_revision": SUCCESSOR_CONTRACT_REVISION,
    }
    agent_harness_store.save_stage2_approval(approval_payload, idempotency_key=f"optimization-wpc-approval:{candidate['candidate_id']}{retry_suffix}")
    return {"draft": draft_payload, "validation": report, "approval": approval_payload, "request": request}


def _optimization_submit_formal(session: dict[str, Any], candidate: dict[str, Any], approval: dict[str, Any]) -> str:
    records = _optimization_stage2_records(session, candidate, approval)
    retry_count = int(candidate.get("retry_count", 0))
    retry_suffix = f":retry-{retry_count}" if retry_count else ""
    body = {
        "schema_identity": EXECUTION_SCHEMA_IDENTITIES["request"], "contract_revision": EXECUTION_CONTRACT_REVISION,
        "draft_id": records["draft"]["draft_id"], "approval_id": records["approval"]["approval_id"], "validation_id": records["validation"]["validation_id"],
        "draft_digest": records["draft"]["draft_digest"], "approval_digest": approval["approval_digest"], "input_snapshot_digest": session["input_snapshot_digest"],
        "schema_set_revision": SCHEMA_SET_REVISION, "backend_identity": harness_backend_identity(), "policy_revision": AGENT_HARNESS_POLICY_REVISION,
        "workflow_revision": EXECUTION_CONTRACT_REVISION, "create_run_request": records["request"], "create_run_request_digest": stage3_request_digest(records["request"]),
        "principal": session["principal"], "workspace_id": session["workspace_id"], "idempotency_key": f"optimization-execution:{candidate['candidate_id']}{retry_suffix}",
    }
    if BRIDGE_SERVER_ADDRESS is None:
        raise OptimizationError("execution_endpoint_unavailable", "The formal execution endpoint is not bound to a Bridge server.", retryable=True)
    connection = http.client.HTTPConnection(BRIDGE_SERVER_ADDRESS[0], BRIDGE_SERVER_ADDRESS[1], timeout=30)
    try:
        raw = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        connection.request("POST", "/api/agent/executions", body=raw, headers={"Content-Type": "application/json", "Content-Length": str(len(raw)), "Idempotency-Key": body["idempotency_key"], "X-TileSim-Principal": session["principal"], "X-TileSim-Workspace": session["workspace_id"], "X-TileSim-Scopes": "agent:submit_experiment,agent:read_run,agent:read_evidence"})
        response = connection.getresponse(); payload = json.loads(response.read().decode("utf-8"))
    except (OSError, http.client.HTTPException, ValueError, json.JSONDecodeError) as error:
        raise OptimizationError("execution_endpoint_unavailable", "The formal execution endpoint could not be reached.", retryable=True, unknown_outcome=True) from error
    finally:
        connection.close()
    execution = payload.get("execution") if isinstance(payload, dict) else None
    if response.status >= 400 or not isinstance(execution, dict):
        error = payload.get("error", {}) if isinstance(payload, dict) else {}
        raise OptimizationError(error.get("code", "execution_submit_failed"), "Formal execution endpoint rejected the candidate.", retryable=response.status in {429, 502, 503, 504}, unknown_outcome=error.get("unknown_outcome", False))
    return str(execution.get("operation_id"))


def _optimization_numeric_paths(value: Any, prefix: str = "") -> list[tuple[str, int | float]]:
    paths: list[tuple[str, int | float]] = []
    if isinstance(value, dict):
        for key in sorted(value):
            paths.extend(_optimization_numeric_paths(value[key], f"{prefix}/{key}"))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            paths.extend(_optimization_numeric_paths(item, f"{prefix}/{index}"))
    elif isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value)):
        paths.append((prefix or "/", value))
    return paths


def _optimization_set_pointer(document: dict[str, Any], pointer: str, value: int | float) -> dict[str, Any]:
    result = json.loads(json.dumps(document, ensure_ascii=False))
    tokens = [item.replace("~1", "/").replace("~0", "~") for item in pointer.lstrip("/").split("/")]
    current: Any = result
    for token in tokens[:-1]:
        current = current[int(token)] if isinstance(current, list) else current[token]
    leaf = tokens[-1]
    if isinstance(current, list):
        current[int(leaf)] = value
    else:
        current[leaf] = value
    return result


def _optimization_verified_evaluation(session: dict[str, Any], candidate: dict[str, Any], execution: dict[str, Any]) -> dict[str, Any]:
    """Read only the allow-listed, identity-checked metric pointer."""
    result = execution.get("result")
    if not isinstance(result, dict) or result.get("schema_identity") != EXECUTION_SCHEMA_IDENTITIES["result"]:
        raise OptimizationError("result_schema_mismatch", "Execution result reference is not current.")
    for key in ("run_id", "manifest_digest", "schema_set_revision"):
        if not isinstance(result.get(key), str) or not result[key]:
            raise OptimizationError("result_identity_incomplete", "Execution result identity is incomplete.", field_path=f"/result/{key}")
    if result.get("schema_set_revision") != session["schema_set_revision"]:
        raise OptimizationError("schema_revision_mismatch", "Execution result schema-set is stale.")
    provenance = result.get("provenance") if isinstance(result.get("provenance"), dict) else {}
    if provenance.get("source_mode") != "synthetic_trace" or provenance.get("claim_scope") != "exploratory":
        raise OptimizationError("provenance_mismatch", "Optimization only accepts the bounded synthetic exploratory provenance.")
    # The formal execution record, rather than the legacy public run shape, is
    # the authoritative snapshot binding for Harness-owned runs.
    if execution.get("input_snapshot_digest") != session["input_snapshot_digest"]:
        raise OptimizationError("snapshot_mismatch", "Result execution snapshot does not match the optimization session.")
    objective = session["objective"]
    metric_path = objective.get("metric_path")
    if not isinstance(metric_path, str) or not metric_path.startswith("/"):
        raise OptimizationError("invalid_objective", "Objective metric_path must be a JSON Pointer.", field_path="/objective/metric_path")
    try:
        tool_result = _harness_dispatch(
            execution["operation_id"],
            "query_verified_metrics",
            {"run_id": result["run_id"], "artifact_id": "metrics", "json_pointers": [metric_path], "principal": session["principal"], "scope": "agent:read_evidence", "idempotency_key": f"optimization-metrics:{candidate['candidate_id']}"},
            session["principal"],
            {"agent:read_evidence"},
        )
    except harness_tools.ToolGatewayError as error:
        raise OptimizationError(error.code, "Verified metrics could not be read.", retryable=error.retryable, unknown_outcome=error.unknown_outcome, field_path=error.field_path or "/objective/metric_path") from error
    optimization_store.record_tool(session["session_id"], "query_verified_metrics", {"run_id": result["run_id"], "metric_path": metric_path, "manifest_digest": result["manifest_digest"]}, iteration_id=None, idempotency_key=f"optimization-metrics:{candidate['candidate_id']}", outcome="succeeded", result={"output_digest": tool_result.get("output_digest")})
    if tool_result.get("snapshot_digest") != session["input_snapshot_digest"]:
        raise OptimizationError("snapshot_mismatch", "Verified metrics tool result is not bound to the session snapshot.")
    values = tool_result.get("result") if isinstance(tool_result, dict) else None
    value = values.get(metric_path) if isinstance(values, dict) else None
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(float(value)):
        raise OptimizationError("objective_unavailable", "Verified objective pointer did not contain a finite number.", field_path=f"/objective/{metric_path.lstrip('/')}")
    return {
        "schema_identity": OPTIMIZATION_SCHEMA_IDENTITIES["evaluation"], "contract_revision": OPTIMIZATION_CONTRACT_REVISION,
        "session_id": session["session_id"], "candidate_id": candidate["candidate_id"],
        "objective": {"metric_path": metric_path, "direction": objective.get("direction", "minimize"), "value": value, "status": "verified"},
        "constraints": session.get("constraints", []),
        "evidence": [{"run_id": result["run_id"], "manifest_digest": result["manifest_digest"], "json_pointer": metric_path, "tool_output_digest": tool_result.get("output_digest")}],
        "provenance": OPTIMIZATION_PROVENANCE,
    }


def _optimization_stop_reason(session_id: str, reason: str, detail: str) -> dict[str, Any]:
    # Keep the durable 2026-10-19 union fail-closed.  Internal lifecycle
    # markers (notably ``authorization_revoked``) are intentionally richer
    # than that published union; callers must not leak them as an invalid
    # schema value.  Preserve the marker in the human-readable detail so the
    # audit/event stream still explains why the stop happened.
    allowed = {
        "improvement_reached",
        "budget_exhausted",
        "iteration_limit",
        "run_limit",
        "time_limit",
        "failure_limit",
        "no_improvement",
        "objective_unavailable",
        "cancelled",
        "failed",
        "recovery_required",
    }
    published_reason = reason if reason in allowed else "objective_unavailable"
    published_detail = detail if reason in allowed else f"[{reason}] {detail}"
    return {"schema_identity": OPTIMIZATION_SCHEMA_IDENTITIES["stop_reason"], "contract_revision": OPTIMIZATION_CONTRACT_REVISION, "session_id": session_id, "reason": published_reason, "detail": published_detail, "provenance": OPTIMIZATION_PROVENANCE}


def _optimization_agent_stop_reason(session_id: str, reason: str, detail: str) -> dict[str, Any]:
    """Map an Agent decision reason into the published optimization union.

    The model's decision vocabulary is intentionally smaller/different from
    the durable optimization stop-reason schema.  Keep that translation in
    one deterministic boundary instead of leaking internal loop sentinels to
    the client contract.
    """
    mapped = {
        "objective_reached": "improvement_reached",
        "no_improvement": "no_improvement",
        "out_of_scope": "objective_unavailable",
        "needs_human": "objective_unavailable",
        "model_call_limit": "budget_exhausted",
        "tool_budget_exhausted": "budget_exhausted",
        "consecutive_denials": "budget_exhausted",
    }.get(reason, reason if reason in {"improvement_reached", "budget_exhausted", "iteration_limit", "run_limit", "time_limit", "failure_limit", "no_improvement", "objective_unavailable", "cancelled", "failed", "recovery_required"} else "objective_unavailable")
    return _optimization_stop_reason(session_id, mapped, detail)


def _optimization_next_candidate(session: dict[str, Any], candidate: dict[str, Any], evaluation: dict[str, Any], authorization: dict[str, Any] | None = None) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    session = optimization_store.get(session["session_id"]) or session
    candidates = optimization_store.candidates(session["session_id"])
    budget = session["budget"]
    if len(candidates) >= budget["max_iterations"]:
        return None, _optimization_stop_reason(session["session_id"], "iteration_limit", "The bounded iteration budget has been reached.")
    if session.get("run_count", 0) >= budget["max_runs"]:
        return None, _optimization_stop_reason(session["session_id"], "run_limit", "The bounded run budget has been reached.")
    try:
        created = datetime.fromisoformat(str(session["created_at"]).replace("Z", "+00:00"))
        if (datetime.now(timezone.utc) - created).total_seconds() >= budget["max_seconds"]:
            return None, _optimization_stop_reason(session["session_id"], "time_limit", "The bounded time budget has been reached.")
    except (TypeError, ValueError):
        return None, _optimization_stop_reason(session["session_id"], "time_limit", "The session creation time is invalid.")
    numeric = _optimization_numeric_paths(candidate.get("config", {}))
    if not numeric:
        return None, _optimization_stop_reason(session["session_id"], "no_improvement", "No bounded numeric parameter is available for a next candidate.")
    path, current_value = numeric[0]
    direction = evaluation.get("objective", {}).get("direction", "minimize")
    factor = 0.9 if direction == "minimize" else 1.1
    proposed = current_value * factor
    if isinstance(current_value, int):
        proposed = int(round(proposed))
        if proposed == current_value:
            proposed = current_value - 1 if direction == "minimize" else current_value + 1
    if proposed == current_value:
        return None, {
            "_wait_for_user": True,
            "code": "no_safe_candidate",
            "question": "规则回退会重复当前配置，无法安全生成新的候选。请调整参数或取消探索。",
        }
    if authorization is not None:
        from services.agent_loop import authorize_action
        verdict = authorize_action(
            authorization=authorization,
            action={"kind": "propose_candidate", "config": {path: proposed}},
            state={"rounds": len(candidates), "run_count": session.get("run_count", 0), "candidate_digests": [item.get("candidate_digest") for item in candidates]},
        )
        if verdict.get("verdict") != "allow":
            if verdict.get("code") == "duplicate_candidate":
                # A duplicate is a control-flow hand-off, not a successful
                # optimization stop.  Keep the evaluated candidate and let
                # the user choose a new parameter/strategy or cancel.
                return None, {
                    "_wait_for_user": True,
                    "code": "duplicate_candidate",
                    "question": "规则回退生成的候选已存在，已暂停等待人工介入；不会重复提交。请调整参数或取消探索。",
                }
            return None, _optimization_stop_reason(session["session_id"], str(verdict.get("code", "authorization_denied")), "The deterministic fallback was outside the authorization grant.")
    config = _optimization_set_pointer(candidate["config"], path, proposed)
    status, _issues, _fields, _unsupported, _budget, _risks = _stage2_validate_payload(config)
    if status != "valid":
        return None, _optimization_stop_reason(session["session_id"], "no_improvement", "The bounded parameter change was rejected by the formal validator.")
    config_digest = harness_canonical_sha256(config)
    if any(
        isinstance(existing.get("config"), dict)
        and harness_canonical_sha256(existing["config"]) == config_digest
        for existing in candidates
    ):
        return None, {
            "_wait_for_user": True,
            "code": "duplicate_candidate",
            "question": "规则回退生成的候选已存在，已暂停等待人工介入；不会重复提交。请调整参数或取消探索。",
        }
    next_candidate = optimization_candidate_document(session=session, sequence=len(candidates), parent_candidate_id=candidate["candidate_id"], config=config, origin="rule", authorization_id=session.get("authorization_id"))
    next_candidate["diff"] = {"parent_candidate_id": candidate["candidate_id"], "changed_fields": [path]}
    next_candidate["expected_side_effects"] = ["one bounded Stage-3 execution", "verified metrics read through the allow-listed gateway"]
    next_candidate["reason"] = {"objective": evaluation["objective"], "parameter_pointer": path, "step": proposed}
    return optimization_store.add_candidate(session["session_id"], next_candidate, event_state="running" if authorization is not None else "waiting_approval"), None


def _optimization_autonomous_enabled(session: dict[str, Any]) -> bool:
    mode = os.environ.get("TILESIM_AGENT_AUTONOMY", AGENT_AUTONOMY_MODE).strip().lower()
    authorization = session.get("authorization")
    tools_enabled = os.environ.get("TILESIM_AGENT_TOOLS", "on" if AGENT_TOOLS_ENABLED else "off").strip().lower() in {"on", "true", "1"}
    return tools_enabled and mode == "auto" and isinstance(authorization, dict) and authorization.get("autonomy_level") == "bounded_autonomous"


def _optimization_agent_enabled(session: dict[str, Any]) -> bool:
    """Whether the model may propose the next candidate in this worker.

    ``propose`` intentionally shares the read/decision loop with ``auto``;
    only the latter is allowed to derive and consume an approval without a
    human click.  Keeping this separate from ``_optimization_autonomous_enabled``
    preserves the default/off and human-approval submission semantics.
    """
    mode = os.environ.get("TILESIM_AGENT_AUTONOMY", AGENT_AUTONOMY_MODE).strip().lower()
    authorization = session.get("authorization")
    tools_enabled = os.environ.get("TILESIM_AGENT_TOOLS", "on" if AGENT_TOOLS_ENABLED else "off").strip().lower() in {"on", "true", "1"}
    return tools_enabled and mode in {"propose", "auto"} and isinstance(authorization, dict)


def _optimization_set_agent_event(session_id: str, node: str, payload: dict[str, Any]) -> None:
    # Events are intentionally digest-only; full model text never enters the
    # durable optimization event log.  Persistence is part of the safety
    # boundary, not an optional telemetry side effect: if the event cannot be
    # committed, callers must fail closed instead of continuing an autonomous
    # turn with an incomplete audit trail.  The surrounding worker converts
    # the raised OptimizationError into a bounded intervention outcome.
    try:
        optimization_store.record_agent_event(session_id, node, payload)
    except OptimizationError:
        raise
    except Exception as error:
        # The worker may already have consumed a tool/run when this audit
        # append fails.  Treat the outcome as unknown and force the durable
        # recovery boundary; never continue (or manufacture a rule fallback)
        # with an incomplete event trail.
        raise OptimizationError(
            "event_persistence_failed",
            "Agent event persistence failed; manual recovery is required.",
            unknown_outcome=True,
        ) from error


def _optimization_authorized_tool_payload(
    *,
    session: dict[str, Any],
    authorization: dict[str, Any],
    tool_name: str,
    arguments: dict[str, Any],
    idempotency_key: str,
) -> dict[str, Any]:
    """Bind one model tool call to the current authorization/session identity.

    The model only supplies ``arguments``.  Every identity field is refreshed
    from the durable session immediately before dispatch, and the snapshot is
    passed to the closed gateway so a run from another input snapshot cannot be
    observed accidentally.
    """

    current_authorization = session.get("authorization")
    if not isinstance(current_authorization, dict):
        raise OptimizationError("authorization_inactive", "Authorization is no longer available.")
    authorization_digest = authorization.get("authorization_digest")
    if (
        current_authorization.get("authorization_digest") != authorization_digest
        or current_authorization.get("status") != "active"
    ):
        raise OptimizationError("authorization_inactive", "Authorization changed while the Agent was deciding.")
    verified = verify_authorization(
        authorization,
        session=session,
        principal=session.get("principal", ""),
        workspace_id=session.get("workspace_id", ""),
        schema_set_revision=SCHEMA_SET_REVISION,
        backend_identity=harness_backend_identity(),
    )
    if not verified.get("valid"):
        raise OptimizationError(str(verified.get("code") or "authorization_inactive"), "Authorization binding failed before tool dispatch.")
    snapshot_digest = authorization.get("input_snapshot_digest")
    if not isinstance(snapshot_digest, str) or session.get("input_snapshot_digest") != snapshot_digest:
        raise OptimizationError("snapshot_mismatch", "Tool call snapshot does not match the authorized session.")
    payload = {
        **arguments,
        "principal": session["principal"],
        "scope": harness_tools.TOOL_DEFINITIONS[tool_name].scope,
        "idempotency_key": idempotency_key,
    }
    # Catalog inspection has no run identity. Run-bound readers carry the
    # snapshot fence into ``harness_tools.dispatch`` for its manifest check.
    if "run_id" in arguments:
        payload["snapshot_digest"] = snapshot_digest
    return payload


def _optimization_pointer_apply(base: dict[str, Any], changes: dict[str, Any]) -> dict[str, Any]:
    result = json.loads(json.dumps(base, ensure_ascii=False))
    for pointer, value in changes.items():
        tokens = [item.replace("~1", "/").replace("~0", "~") for item in pointer.lstrip("/").split("/")]
        current: Any = result
        for token in tokens[:-1]:
            current = current[int(token)] if isinstance(current, list) else current[token]
        leaf = tokens[-1]
        if isinstance(current, list):
            current[int(leaf)] = value
        else:
            current[leaf] = value
    return result


def _optimization_agent_next_candidate(session: dict[str, Any], candidate: dict[str, Any], evaluation: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """Ask the model for the next candidate; deterministic rule fallback is explicit."""
    # A worker keeps a local session snapshot while the durable store records
    # each candidate/evaluation. Refresh here so authorization counters and
    # revocation status from prior turns cannot be lost between rounds.
    session = optimization_store.get(session["session_id"]) or session
    authorization = session.get("authorization")
    if not isinstance(authorization, dict):
        return _optimization_next_candidate(session, candidate, evaluation, authorization)
    # These failures invalidate the authority/identity fence.  They are not
    # provider degradation and must never enter the deterministic candidate
    # fallback path: doing so could submit a candidate after revoke or after
    # the session moved to a different workspace/schema/backend.
    security_fence_errors = {
        "authorization_inactive",
        "authorization_revoked",
        "authorization_required",
        "authorization_expired",
        "authorization_invalid",
        "authorization_digest_mismatch",
        "invalid_tool_allowlist",
        "protected_field",
        "snapshot_mismatch",
        "schema_revision_mismatch",
        "backend_identity_mismatch",
        "principal_mismatch",
        "workspace_mismatch",
        "session_not_found",
    }
    try:
        verify = verify_authorization(
            authorization,
            session=session,
            principal=session["principal"],
            workspace_id=session["workspace_id"],
            schema_set_revision=SCHEMA_SET_REVISION,
            backend_identity=harness_backend_identity(),
        )
        if not verify.get("valid"):
            return None, _optimization_stop_reason(session["session_id"], "authorization_revoked", "The autonomous authorization is no longer active.")
        try:
            created_at = datetime.fromisoformat(str(session.get("created_at", "")).replace("Z", "+00:00"))
            elapsed_seconds = max(0.0, (datetime.now(timezone.utc) - created_at).total_seconds())
        except (TypeError, ValueError):
            elapsed_seconds = float(session.get("budget", {}).get("max_seconds", 900))
        candidates = optimization_store.candidates(session["session_id"])
        evaluations = optimization_store.evaluations(session["session_id"])
        try:
            attempt_history = build_attempt_history(session=session, candidates=candidates, evaluations=evaluations)
        except OptimizationError as error:
            # A malformed or cross-boundary history is an evidence failure,
            # not provider degradation.  Never fall back to a rule candidate
            # when the Agent cannot be shown a trustworthy attempt ledger.
            _optimization_set_agent_event(
                session["session_id"],
                "agent.history_rejected",
                {"code": error.code},
            )
            return None, _optimization_agent_stop_reason(
                session["session_id"],
                "objective_unavailable",
                f"[attempt_history:{error.code}] Attempt history could not be verified; human review is required.",
            )
        objective = evaluation.get("objective") if isinstance(evaluation.get("objective"), dict) else {}
        evidence = evaluation.get("evidence") if isinstance(evaluation.get("evidence"), list) else []
        primary_evidence = evidence[0] if evidence and isinstance(evidence[0], dict) else {}
        round_state = {
            "round": len(candidates),
            "run_count": session.get("run_count", 0),
            # The signed authorization has separate counters for formal run
            # creations and execution time.  Keep these values in the state
            # passed through the deterministic veto so a replan cannot regain
            # either budget by omitting an internal field.
            "run_creations": session.get("run_count", 0),
            "failure_count": session.get("failure_count", 0),
            "model_calls": int(session.get("agent_model_calls", 0) or 0),
            "best_metric": objective.get("value"),
            "elapsed_seconds": elapsed_seconds,
            "execution_time_ms": max(0, int(elapsed_seconds * 1000)),
            # The model receives the last verified observation and the
            # identity needed to ask the allow-listed metrics tool for a
            # focused follow-up.  This is an evidence reference, not a
            # frontend/server recomputation or an unbounded result payload.
            "last_verified_evaluation": {
                "metric_path": objective.get("metric_path"),
                "direction": objective.get("direction"),
                "value": objective.get("value"),
                "status": objective.get("status"),
                "run_id": primary_evidence.get("run_id"),
                "manifest_digest": primary_evidence.get("manifest_digest"),
                "json_pointer": primary_evidence.get("json_pointer"),
                "tool_output_digest": primary_evidence.get("tool_output_digest"),
            },
            "initial_observations": [{
                "kind": "verified_evaluation",
                "objective": objective,
                "evidence": {
                    "run_id": primary_evidence.get("run_id"),
                    "manifest_digest": primary_evidence.get("manifest_digest"),
                    "json_pointer": primary_evidence.get("json_pointer"),
                    "tool_output_digest": primary_evidence.get("tool_output_digest"),
                },
                "provenance": evaluation.get("provenance", OPTIMIZATION_PROVENANCE),
            }],
            # Do not copy the full candidate configuration into the model
            # prompt.  The model receives only the bounded change/metric
            # summary below; the canonical config remains server-side for the
            # authorization and Stage-2 validation fences.
            "run_id": primary_evidence.get("run_id"),
            "objective_metric_path": objective.get("metric_path"),
            "candidate_digests": [item.get("candidate_digest") for item in candidates],
            "candidate_config_digests": [
                optimization_digest(item.get("config"))
                for item in candidates
                if isinstance(item, dict) and isinstance(item.get("config"), dict)
            ],
            # The model receives only a bounded, identity-bound attempt
            # summary.  Full candidate configurations remain server-side and
            # are never copied into a prompt.
            "attempt_history": attempt_history.get("entries", []),
            "attempt_history_digest": attempt_history.get("history_digest"),
            "attempt_history_truncated": bool(attempt_history.get("truncated")),
            "attempt_history_omitted_count": int(attempt_history.get("omitted_count", 0) or 0),
        }
        def model_call(*, messages, tools, state):
            # Optimization turns are isolated by their durable session identity; a panel model
            # selection in another browser tab cannot change an in-flight decision.
            return assistant_model.agent_decision(
                messages,
                tools=tools,
                scope=assistant_model.bind_selection_scope(
                    session["session_id"], session["principal"], session["workspace_id"]
                ),
            )
        def tool_dispatch(*, tool_name, arguments, idempotency_key, state):
            current_session = optimization_store.get(session["session_id"])
            if not isinstance(current_session, dict):
                raise OptimizationError("session_not_found", "Optimization session disappeared during Agent turn.")
            current_authorization = current_session.get("authorization")
            if not isinstance(current_authorization, dict):
                raise OptimizationError("authorization_inactive", "Authorization is no longer available.")
            operation_id = current_session.get("active_operation_id")
            if not isinstance(operation_id, str) or not operation_id:
                return {"outcome": "rejected", "error_code": "operation_unavailable"}
            # Resolve the permission from the actual gateway definition.  The
            # optimization registry is descriptive and does not cover every
            # read tool (notably ``get_run_status``); falling back to a generic
            # evidence scope would make an otherwise authorized call fail or,
            # worse, obscure the closed-scope boundary.
            gateway_definition = harness_tools.TOOL_DEFINITIONS.get(tool_name)
            if gateway_definition is None:
                raise OptimizationError("tool_not_authorized", "Tool is not in the closed gateway registry.")
            try:
                payload = _optimization_authorized_tool_payload(
                    session=current_session,
                    authorization=current_authorization,
                    tool_name=tool_name,
                    arguments=arguments,
                    idempotency_key=idempotency_key,
                )
                return _harness_dispatch(operation_id, tool_name, payload, current_session["principal"], {gateway_definition.scope})
            except Exception as error:
                if getattr(error, "code", None) in {
                    "authorization_inactive",
                    "authorization_revoked",
                    "authorization_required",
                    "authorization_expired",
                    "authorization_invalid",
                    "authorization_digest_mismatch",
                    "invalid_tool_allowlist",
                    "protected_field",
                    "snapshot_mismatch",
                    "schema_revision_mismatch",
                    "backend_identity_mismatch",
                    "principal_mismatch",
                    "workspace_mismatch",
                }:
                    raise
                return {"outcome": "rejected", "error_code": getattr(error, "code", "tool_error")}
        # ``verify_authorization`` above has already checked the immutable
        # envelope.  Pass its materialized budget through unchanged so the
        # worker and its audit receipt share one signed source of truth.
        authorization_budget = authorization.get("budget") if isinstance(authorization.get("budget"), dict) else {}
        turn = run_agent_turn(authorization=authorization, state=round_state, model_call=model_call, tool_dispatch=tool_dispatch, limits=authorization_budget, emit=lambda kind, payload: _optimization_set_agent_event(session["session_id"], kind, payload))
        security_error = turn.get("security_error") if isinstance(turn, dict) else None
        if security_error in security_fence_errors:
            _optimization_set_agent_event(
                session["session_id"],
                "agent.verdict",
                {"verdict": "deny", "code": security_error, "hint": "Authorization or identity binding changed; no fallback candidate was created."},
            )
            return None, _optimization_agent_stop_reason(
                session["session_id"],
                "authorization_revoked",
                f"The authorization/identity fence failed ({security_error}); autonomous work stopped.",
            )
        decision = turn.get("decision") if isinstance(turn, dict) else {"kind": "stop", "reason": "needs_human"}
        _optimization_set_agent_event(session["session_id"], "agent.step", {"kind": decision.get("kind"), "authorization_id": authorization.get("authorization_id"), "attempt_history_digest": round_state.get("attempt_history_digest")})
        model_calls_used = max(0, int(turn.get("model_calls", 0) or 0) - int(round_state.get("model_calls", 0) or 0))
        tool_calls_used = int(turn.get("tool_calls_used", 0) or 0)
        remaining = turn.get("remaining_budget")
        if not isinstance(remaining, dict):
            remaining = {
                "model_calls": max(0, int(authorization_budget.get("max_model_calls", 0) or 0) - int(turn.get("model_calls", 0) or 0)),
                "tool_calls_per_round": max(0, int(authorization_budget.get("max_tool_calls_per_round", 0) or 0) - tool_calls_used),
                "navigation_attempts": max(0, int(authorization_budget.get("max_navigation_attempts", 0) or 0) - int(round_state.get("navigation_attempts", 0) or 0)),
                "run_creations": max(0, int(authorization_budget.get("max_run_creations", 0) or 0) - int(round_state.get("run_creations", 0) or 0)),
                "execution_time_ms": max(0, int(authorization_budget.get("max_execution_time_ms", 0) or 0) - int(round_state.get("execution_time_ms", 0) or 0)),
            }
        optimization_store.record_agent_turn(session["session_id"], {"kind": decision.get("kind"), "denials": turn.get("denials", 0), "stop": turn.get("stop"), "model_calls_used": model_calls_used, "tool_calls_used": tool_calls_used, "remaining_budget": remaining, "authorization_digest": authorization.get("authorization_digest"), "max_model_calls": authorization_budget.get("max_model_calls"), "max_tool_calls_per_round": authorization_budget.get("max_tool_calls_per_round"), "max_navigation_attempts": authorization_budget.get("max_navigation_attempts"), "max_run_creations": authorization_budget.get("max_run_creations"), "max_execution_time_ms": authorization_budget.get("max_execution_time_ms"), "allowed_pages": authorization.get("allowed_pages", []), "allowed_actions": authorization.get("allowed_actions", []), "attempt_history_digest": round_state.get("attempt_history_digest"), "attempt_history_truncated": bool(round_state.get("attempt_history_truncated")), "summary": str(decision.get("reason", decision.get("question", decision.get("expected_effect", ""))))[:2000]})
        if decision.get("kind") == "propose_candidate":
            from services.agent_loop import authorize_action
            verdict = authorize_action(authorization=authorization, action=decision, state=round_state)
            _optimization_set_agent_event(session["session_id"], "agent.verdict", verdict)
            if verdict.get("code") == "duplicate_candidate":
                return None, {
                    "_wait_for_user": True,
                    "code": "duplicate_candidate",
                    "question": "模型建议的候选已存在，已暂停等待人工介入；不会重复提交。请调整参数或取消探索。",
                }
            if verdict.get("verdict") == "allow":
                proposed = decision.get("config")
                if isinstance(proposed, dict) and all(isinstance(key, str) and key.startswith("/") for key in proposed):
                    config = _optimization_pointer_apply(candidate.get("config", {}), proposed)
                elif isinstance(proposed, dict):
                    config = proposed
                else:
                    config = None
                if isinstance(config, dict):
                    status, issues, *_ = _stage2_validate_payload(config)
                    if status == "valid":
                        next_candidate = optimization_candidate_document(session=session, sequence=len(optimization_store.candidates(session["session_id"])), parent_candidate_id=candidate["candidate_id"], config=config, origin="model", authorization_id=authorization.get("authorization_id"))
                        next_candidate["diff"] = {"parent_candidate_id": candidate["candidate_id"], "changed_fields": sorted(proposed)}
                        next_candidate["reason"] = {"model": str(decision.get("reason", "model proposal"))[:240], "expected_effect": str(decision.get("expected_effect", ""))[:240]}
                        return optimization_store.add_candidate(session["session_id"], next_candidate, event_state="running"), None
                    # Authorization is necessary but not sufficient: the
                    # formal Stage-2 validator remains the final schema gate.
                    # Do not silently discard an otherwise authorized model
                    # proposal; leave a bounded verdict and use the explicit
                    # deterministic fallback so the audit trail explains why
                    # the model candidate was not submitted.
                    issue = issues[0] if isinstance(issues, list) and issues and isinstance(issues[0], dict) else {}
                    verdict = {
                        "verdict": "deny",
                        "code": "schema_violation",
                        "field_path": issue.get("field_path", "/config"),
                        "hint": "The formal Stage-2 validator rejected this candidate.",
                    }
                    _optimization_set_agent_event(session["session_id"], "agent.verdict", verdict)
                    _optimization_set_agent_event(
                        session["session_id"],
                        "agent.degraded",
                        {"code": "stage2_validation_rejected", "field_path": verdict["field_path"]},
                    )
                    fallback, fallback_reason = _optimization_next_candidate(session, candidate, evaluation, authorization)
                    if fallback is not None:
                        fallback["origin"] = "rule"
                        fallback["authorization_id"] = authorization.get("authorization_id")
                        _optimization_set_agent_event(
                            session["session_id"],
                            "agent.degraded",
                            {"code": "rule_fallback", "authorization_id": authorization.get("authorization_id")},
                        )
                    return fallback, fallback_reason
            # A denial is an observation, not an exception; after the loop's
            # bounded denial budget the rule path is visibly marked degraded.
            # A duplicate candidate is different from an ordinary malformed
            # proposal: the canonical config digest proves that this exact
            # attempt was already persisted.  Do not map that hand-off to a
            # published terminal stop reason (which would make the worker
            # mark the session completed).  Preserve the current candidate
            # and return the same explicit user-intervention sentinel used by
            # deterministic fallback de-duplication.
            if verdict.get("code") == "duplicate_candidate":
                return None, {
                    "_wait_for_user": True,
                    "code": "duplicate_candidate",
                    "question": "该候选已经尝试过，已暂停等待人工介入；请调整参数或取消探索。",
                }
        if decision.get("kind") == "stop":
            # ``run_agent_turn`` converts ProviderError into a bounded
            # ``stop/needs_human`` decision so the provider's raw exception
            # never crosses the decision boundary.  That stop is still a
            # degradation signal, not a model-requested terminal outcome:
            # follow the explicit rule fallback and leave an agent.degraded
            # event instead of parking the session without a next candidate.
            provider_error = any(
                isinstance(item, dict) and item.get("code") == "provider_error"
                for item in (turn.get("observations", []) if isinstance(turn, dict) else [])
            )
            if provider_error:
                fallback, fallback_reason = _optimization_next_candidate(session, candidate, evaluation, authorization)
                if fallback is not None:
                    fallback["origin"] = "rule"
                    fallback["authorization_id"] = authorization.get("authorization_id")
                    _optimization_set_agent_event(
                        session["session_id"],
                        "agent.degraded",
                        {"code": "rule_fallback", "reason": "provider_error", "authorization_id": authorization.get("authorization_id")},
                    )
                return fallback, fallback_reason
            if int(turn.get("denials", 0) or 0) >= 3 or turn.get("stop") == "consecutive_denials":
                fallback, fallback_reason = _optimization_next_candidate(session, candidate, evaluation, authorization)
                if fallback is not None:
                    fallback["origin"] = "rule"
                    fallback["authorization_id"] = authorization.get("authorization_id")
                    _optimization_set_agent_event(
                        session["session_id"],
                        "agent.degraded",
                        {"code": "rule_fallback", "reason": "consecutive_denials", "authorization_id": authorization.get("authorization_id")},
                    )
                return fallback, fallback_reason
            return None, _optimization_agent_stop_reason(session["session_id"], str(decision.get("reason", "no_improvement")), "The model requested a bounded stop.")
        if decision.get("kind") == "ask_user":
            # This is an internal hand-off marker.  It is consumed by the
            # worker below and never serialized as an unsupported stop reason.
            return None, {"_wait_for_user": True, "question": str(decision.get("question", "需要用户确认下一步。"))[:240]}
    except Exception as error:
        error_code = getattr(error, "code", None)
        if isinstance(error_code, str) and error_code.startswith("attempt_history"):
            return None, _optimization_agent_stop_reason(
                session["session_id"],
                "objective_unavailable",
                f"[attempt_history:{error_code}] Attempt history could not be verified; human review is required.",
            )
        if error_code in security_fence_errors:
            _optimization_set_agent_event(
                session["session_id"],
                "agent.verdict",
                {"verdict": "deny", "code": error_code, "hint": "Authorization or identity binding changed; no fallback candidate was created."},
            )
            return None, _optimization_agent_stop_reason(
                session["session_id"],
                "authorization_revoked",
                f"The authorization/identity fence failed ({error_code}); autonomous work stopped.",
            )
        _optimization_set_agent_event(session["session_id"], "agent.degraded", {"code": "provider_error", "type": type(error).__name__})
        fallback, reason = _optimization_next_candidate(session, candidate, evaluation, authorization)
        if fallback is not None:
            fallback["origin"] = "rule"
            fallback["authorization_id"] = authorization.get("authorization_id")
            _optimization_set_agent_event(session["session_id"], "agent.degraded", {"code": "rule_fallback", "authorization_id": authorization.get("authorization_id")})
        return fallback, reason
    observations = turn.get("observations", []) if isinstance(turn, dict) else []
    provider_error = any(isinstance(item, dict) and item.get("code") == "provider_error" for item in observations)
    if not provider_error and int(turn.get("denials", 0) or 0) < 3:
        stop_reason = str(turn.get("stop") or "needs_human")
        return None, _optimization_agent_stop_reason(session["session_id"], stop_reason, "The bounded model turn did not produce an authorized candidate.")
    fallback, reason = _optimization_next_candidate(session, candidate, evaluation, authorization)
    if fallback is not None:
        fallback["origin"] = "rule"
        fallback["authorization_id"] = authorization.get("authorization_id")
        _optimization_set_agent_event(session["session_id"], "agent.degraded", {"code": "rule_fallback", "authorization_id": authorization.get("authorization_id")})
    return fallback, reason


def _optimization_set_terminal_summary(session_id: str, state: str, stop_reason: dict[str, Any], *, best_candidate_id: str | None = None) -> None:
    summary = {"schema_identity": OPTIMIZATION_SCHEMA_IDENTITIES["summary"], "contract_revision": OPTIMIZATION_CONTRACT_REVISION, "session_id": session_id, "state": state, "best_candidate_id": best_candidate_id, "stop_reason": stop_reason, "provenance": OPTIMIZATION_PROVENANCE}
    optimization_store.set_summary(session_id, summary)


def _optimization_elapsed_execution_ms(session: dict[str, Any]) -> int:
    """Return bounded wall-clock time consumed by an authorized session."""
    try:
        created = datetime.fromisoformat(str(session.get("created_at", "")).replace("Z", "+00:00"))
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return max(0, int((datetime.now(timezone.utc) - created.astimezone(timezone.utc)).total_seconds() * 1000))
    except (TypeError, ValueError, OverflowError):
        # An invalid durable timestamp is not a reason to grant unlimited
        # execution time.  Treat it as exhausted and let the caller stop.
        return 2**63 - 1


def _optimization_authorization_budget_stop(session: dict[str, Any], authorization: dict[str, Any]) -> dict[str, Any] | None:
    """Check signed run-count/time limits immediately before submission."""
    budget = authorization.get("budget") if isinstance(authorization.get("budget"), dict) else {}
    run_creations = int(session.get("run_count", 0) or 0)
    max_run_creations = budget.get("max_run_creations")
    if isinstance(max_run_creations, int) and run_creations >= max_run_creations:
        return _optimization_stop_reason(
            session["session_id"],
            "budget_exhausted",
            "The signed maximum run-creation budget has been reached.",
        )
    execution_time_ms = _optimization_elapsed_execution_ms(session)
    max_execution_time_ms = budget.get("max_execution_time_ms")
    if isinstance(max_execution_time_ms, int) and execution_time_ms >= max_execution_time_ms:
        return _optimization_stop_reason(
            session["session_id"],
            "budget_exhausted",
            "The signed maximum execution-time budget has been reached.",
        )
    return None


def _optimization_authorized_execution(authorization: dict[str, Any]) -> bool:
    """Require the signed user-facing execute grant before formal submit."""
    allowed_actions = authorization.get("allowed_actions")
    return isinstance(allowed_actions, (list, tuple, set)) and "execute" in allowed_actions


def _optimization_worker(session_id: str, candidate_id: str, approval: dict[str, Any], *, _nested: bool = False) -> None:
    try:
        detail = optimization_store.detail(session_id)
        if detail is None:
            return
        session = detail["session"]; candidate = optimization_store.candidate(session_id, candidate_id)
        if candidate is None:
            raise OptimizationError("candidate_not_found", "Candidate was not found.")
        if session.get("state") == "cancelled":
            return
        if session.get("state") == "paused":
            # A paused worker remains durable; the explicit resume action lets
            # this same worker continue without creating a duplicate run.
            while True:
                current = optimization_store.get(session_id)
                if current is None or current.get("state") == "cancelled":
                    return
                if current.get("state") != "paused":
                    session = current
                    break
                time.sleep(0.1)
        optimization_store.mark_running(session_id)
        # Re-verify the authorization immediately before consuming the
        # single-use grant and before _optimization_submit_formal can run.  A
        # revoke racing with a model proposal therefore cannot buy one extra
        # submission.
        if candidate.get("authorization_id"):
            current_auth = optimization_store.authorization(session_id)
            check = verify_authorization(current_auth or {}, session=session, principal=session["principal"], workspace_id=session["workspace_id"], schema_set_revision=SCHEMA_SET_REVISION, backend_identity=harness_backend_identity())
            if not check.get("valid"):
                optimization_store.transition(session_id, "completed", expected={"running", "queued"}, error={"code": "authorization_revoked"})
                _optimization_set_terminal_summary(session_id, "completed", _optimization_stop_reason(session_id, "authorization_revoked", "Authorization was revoked before the next submission."), best_candidate_id=candidate_id)
                return
            if not _optimization_authorized_execution(current_auth or {}):
                stop_reason = _optimization_stop_reason(
                    session_id,
                    "objective_unavailable",
                    "The signed authorization does not include the execute action; no run was created.",
                )
                _optimization_set_agent_event(
                    session_id,
                    "agent.verdict",
                    {"verdict": "deny", "code": "action_not_authorized", "field_path": "/allowed_actions"},
                )
                optimization_store.transition(session_id, "completed", expected={"running", "queued"}, error={"code": "action_not_authorized"})
                _optimization_set_terminal_summary(session_id, "completed", stop_reason, best_candidate_id=candidate_id)
                return
            budget_stop = _optimization_authorization_budget_stop(session, current_auth or {})
            if budget_stop is not None:
                optimization_store.transition(session_id, "completed", expected={"running", "queued"}, error={"code": "budget_exhausted"})
                _optimization_set_terminal_summary(session_id, "completed", budget_stop, best_candidate_id=candidate_id)
                return
        if candidate.get("authorization_id"):
            # Keep revoke from interleaving between the final authorization
            # check/consume and the formal submission.  The durable store
            # fence rechecks the active digest while holding SQLite's write
            # transaction; a revoke that arrives first therefore stops here,
            # while one that arrives after this block observes a submission
            # already attempted and follows the normal recovery boundary.
            authorization = optimization_store.authorization(session_id)
            if not isinstance(authorization, dict):
                raise OptimizationError("authorization_required", "Autonomous submission requires authorization.")
            with optimization_store.authorization_submission_fence(
                session_id,
                principal=session["principal"],
                workspace_id=session["workspace_id"],
                schema_set_revision=SCHEMA_SET_REVISION,
                backend_identity=harness_backend_identity(),
                input_snapshot_digest=session["input_snapshot_digest"],
                authorization_digest=str(authorization.get("authorization_digest", "")),
            ) as current_session:
                optimization_store._consume_approval_locked(
                    session_id,
                    approval["approval_id"],
                    principal=session["principal"],
                    candidate_digest=candidate["candidate_digest"],
                    approval_digest=approval.get("approval_digest"),
                    authorization_digest=str(authorization.get("authorization_digest", "")),
                )
                session = current_session
                operation_id = _optimization_submit_formal(current_session, candidate, approval)
        else:
            optimization_store.consume_approval(session_id, approval["approval_id"], principal=session["principal"], candidate_digest=candidate["candidate_digest"], approval_digest=approval.get("approval_digest"))
            operation_id = _optimization_submit_formal(session, candidate, approval)
        optimization_store.record_iteration(session_id, candidate_id, "running", {"candidate_digest": candidate["candidate_digest"], "approval_digest": approval["approval_digest"]})
        optimization_store.record_tool(session_id, "submit_execution", {"candidate_digest": candidate["candidate_digest"]}, iteration_id=None, idempotency_key=f"optimization-submit:{candidate_id}", outcome="started")
        optimization_store.set_active_operation(session_id, operation_id)
        optimization_store.record_tool(session_id, "get_operation_status", {"operation_id": operation_id}, iteration_id=None, idempotency_key=f"optimization-status:{candidate_id}", outcome="succeeded", result={"operation_id": operation_id})
        # The Stage-3 queue is durable; poll only its redacted record and never
        # copy run/artifact payloads into the optimization store.
        execution_deadline_seconds = min(session["budget"]["max_seconds"], MAX_BUDGET_SECONDS)
        if candidate.get("authorization_id") and isinstance(authorization, dict):
            auth_budget = authorization.get("budget") if isinstance(authorization.get("budget"), dict) else {}
            max_execution_time_ms = auth_budget.get("max_execution_time_ms")
            if isinstance(max_execution_time_ms, int):
                elapsed_ms = _optimization_elapsed_execution_ms(session)
                execution_deadline_seconds = min(
                    execution_deadline_seconds,
                    max(0, max_execution_time_ms - elapsed_ms) / 1000,
                )
        deadline = time.monotonic() + execution_deadline_seconds
        while time.monotonic() < deadline:
            current_session = optimization_store.get(session_id)
            if current_session is None or current_session.get("state") == "cancelled":
                return
            if current_session.get("state") == "paused":
                time.sleep(0.1)
                continue
            if current_session.get("state") == "queued":
                optimization_store.mark_running(session_id)
            execution = agent_harness_store.get_stage3_by_operation(operation_id)
            if execution and execution.get("state") in EXECUTION_TERMINAL_STATES:
                if execution["state"] == "completed":
                    evaluation = _optimization_verified_evaluation(session, candidate, execution)
                    optimization_store.save_evaluation(session_id, candidate_id, evaluation)
                    optimization_store.record_iteration(session_id, candidate_id, "completed", {"operation_id": operation_id, "result_digest": optimization_digest(execution.get("result")), "evaluation": evaluation, "provenance": OPTIMIZATION_PROVENANCE})
                    optimization_store.save_checkpoint(session_id, {"session_id": session_id, "candidate_id": candidate_id, "operation_id": operation_id, "evaluation": evaluation, "schema_set_revision": session["schema_set_revision"], "backend_identity": session["backend_identity"], "input_snapshot_digest": session["input_snapshot_digest"]})
                    next_candidate, stop_reason = (_optimization_agent_next_candidate(session, candidate, evaluation) if _optimization_agent_enabled(session) else _optimization_next_candidate(session, candidate, evaluation))
                    if next_candidate is not None:
                        optimization_store.set_active_operation(session_id, None)
                        if _optimization_autonomous_enabled(session):
                            # Derive and consume one approval for this exact
                            # candidate, then continue in this same worker
                            # thread.  No per-round worker is created.
                            auth = optimization_store.authorization(session_id)
                            if not isinstance(auth, dict):
                                raise OptimizationError("authorization_required", "Autonomous submission requires authorization.")
                            check = verify_authorization(auth, session=optimization_store.get(session_id) or session, principal=session["principal"], workspace_id=session["workspace_id"], schema_set_revision=SCHEMA_SET_REVISION, backend_identity=harness_backend_identity())
                            if not check.get("valid"):
                                optimization_store.transition(session_id, "completed", expected={"running"}, error={"code": "authorization_revoked"})
                                _optimization_set_terminal_summary(session_id, "completed", _optimization_stop_reason(session_id, "authorization_revoked", "Authorization was revoked before the next submission."), best_candidate_id=candidate_id)
                                return
                            grant = optimization_store.approve_autonomous(session_id, next_candidate["candidate_id"], principal=session["principal"], authorization_digest=auth["authorization_digest"], expires_at=(datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat())
                            # Same-thread continuation; this is deliberately a
                            # direct call rather than spawning one thread per
                            # model turn.
                            # Continue in this same worker thread.  The nested
                            # call must return ownership to the outer frame
                            # immediately: otherwise the outer frame would
                            # clear the inner round's active operation and the
                            # inner ``finally`` would unregister a still-live
                            # worker, opening a second-concurrency window.
                            _optimization_worker(session_id, next_candidate["candidate_id"], grant, _nested=True)
                            return
                        else:
                            optimization_store.transition(session_id, "waiting_approval", expected={"running"})
                    else:
                        if isinstance(stop_reason, dict) and stop_reason.get("_wait_for_user"):
                            # Interactive hand-offs (including duplicate or
                            # no-safe fallback candidates) return control to
                            # a human. Keep the evaluated candidate reviewable
                            # and do not manufacture a terminal summary.
                            optimization_store.mark_candidate_waiting_approval(session_id, candidate_id)
                            _optimization_set_agent_event(
                                session_id,
                                "agent.ask_user",
                                {
                                    "code": stop_reason.get("code", "needs_human"),
                                    "question": stop_reason.get("question", "需要用户确认下一步。"),
                                },
                            )
                            optimization_store.transition(session_id, "waiting_approval", expected={"running"})
                        else:
                            terminal_summary = stop_reason or _optimization_stop_reason(
                                session_id,
                                "no_improvement",
                                "No next candidate was produced.",
                            )
                            # Persist the summary before publishing the terminal
                            # state.  Readers poll the session and can observe
                            # ``completed`` between two SQLite transactions;
                            # ordering the writes prevents a transient terminal
                            # document with no stop reason.
                            _optimization_set_terminal_summary(
                                session_id,
                                "completed",
                                terminal_summary,
                                best_candidate_id=candidate_id,
                            )
                            optimization_store.transition(session_id, "completed", expected={"running"})
                        optimization_store.set_active_operation(session_id, None)
                elif execution["state"] == "recovery_required":
                    optimization_store.transition(session_id, "recovery_required", expected={"running"}, error={"code": "execution_recovery_required", "unknown_outcome": True})
                    _optimization_set_terminal_summary(session_id, "recovery_required", _optimization_stop_reason(session_id, "recovery_required", "The formal execution has an unknown outcome."), best_candidate_id=candidate_id)
                else:
                    failure_count = optimization_store.increment_failure(session_id)
                    error_code = (execution.get("error") or {}).get("code", "execution_failed")
                    optimization_store.transition(session_id, "failed", expected={"running"}, error={"code": error_code, "retryable": bool(execution.get("retryable"))})
                    _optimization_set_terminal_summary(session_id, "failed", _optimization_stop_reason(session_id, "failure_limit" if failure_count >= session["budget"]["max_failures"] else "failed", error_code), best_candidate_id=candidate_id)
                optimization_store.set_active_operation(session_id, None)
                return
            time.sleep(0.25)
        optimization_store.transition(session_id, "recovery_required", expected={"running"}, error={"code": "optimization_timeout", "unknown_outcome": True})
        _optimization_set_terminal_summary(session_id, "recovery_required", _optimization_stop_reason(session_id, "recovery_required", "The optimization execution deadline elapsed."), best_candidate_id=candidate_id)
    except OptimizationError as error:
        try:
            current = optimization_store.get(session_id)
            if current and current.get("state") in {"cancelled", "paused"}:
                return
            if error.code == "authorization_inactive":
                # A revoke may win the final submission fence after the
                # worker has already entered its running state.  This is a
                # bounded, known stop—not a generic worker failure—and must
                # remain visible as an authorization stop without retrying.
                if current and current.get("state") in {"running", "queued", "retrying"}:
                    optimization_store.transition(session_id, "completed", expected={"running", "queued", "retrying"}, error={"code": "authorization_revoked"})
                    _optimization_set_terminal_summary(session_id, "completed", _optimization_stop_reason(session_id, "authorization_revoked", "Authorization was revoked before the next submission."), best_candidate_id=candidate_id)
                return
            state = "recovery_required" if error.unknown_outcome else "failed"
            optimization_store.increment_failure(session_id)
            # Event persistence may fail after the worker has already moved
            # into the explicit human hand-off state.  That state must still
            # be recoverable; otherwise a missing audit event would leave an
            # apparently approvable session outside the recovery boundary.
            expected_states = {"running", "queued", "retrying"}
            if error.unknown_outcome:
                expected_states.add("waiting_approval")
            optimization_store.transition(session_id, state, expected=expected_states, error={"code": error.code, "retryable": error.retryable, "unknown_outcome": error.unknown_outcome})
            _optimization_set_terminal_summary(session_id, state, _optimization_stop_reason(session_id, "recovery_required" if error.unknown_outcome else "failed", error.code), best_candidate_id=candidate_id)
        except OptimizationError:
            pass
    except Exception as error:
        try:
            optimization_store.transition(session_id, "recovery_required", expected={"running", "queued", "retrying"}, error={"code": "optimization_worker_unknown_outcome", "exception_type": type(error).__name__, "detail": str(error)[:160], "unknown_outcome": True})
            _optimization_set_terminal_summary(session_id, "recovery_required", _optimization_stop_reason(session_id, "recovery_required", "The optimization worker outcome is unknown."), best_candidate_id=candidate_id)
        except OptimizationError:
            pass
    finally:
        if not _nested:
            with optimization_workers_lock:
                optimization_workers.pop(session_id, None)


def create_optimization_session(handler: SimpleHTTPRequestHandler) -> None:
    try:
        principal, workspace = _optimization_scoped(handler, "agent:write_draft")
        key = handler.headers.get("Idempotency-Key", "").strip()
        if not re.fullmatch(r"[A-Za-z0-9._:-]{8,128}", key):
            raise OptimizationError("missing_idempotency_key", "Idempotency-Key is required for optimization writes.", field_path="/headers/Idempotency-Key")
        body = harness_json_body(handler)
        document = validate_session_request(body, principal=principal, workspace_id=workspace, schema_set_revision=SCHEMA_SET_REVISION, backend_identity=harness_backend_identity())
        session, replay = optimization_store.create(document, idempotency_key=key)
        return write_json(handler, HTTPStatus.OK if replay else HTTPStatus.CREATED, {"session": session, "detail": optimization_store.detail(session["session_id"]), "idempotent_replay": replay, "provenance": OPTIMIZATION_PROVENANCE})
    except OptimizationError as error:
        return harness_error(handler, error)


def list_optimization_sessions(handler: SimpleHTTPRequestHandler) -> None:
    try:
        principal, workspace = _optimization_scoped(handler, {"agent:read_run", "agent:read_draft"})
        return write_json(handler, HTTPStatus.OK, {"sessions": optimization_store.list(principal, workspace), "provenance": OPTIMIZATION_PROVENANCE})
    except OptimizationError as error:
        return harness_error(handler, error)


def get_optimization_session(handler: SimpleHTTPRequestHandler, session_id: str) -> None:
    try:
        _principal, _workspace, detail = _optimization_detail_for(handler, session_id)
        return write_json(handler, HTTPStatus.OK, {"session": _optimization_public(detail["session"]), "detail": detail, "provenance": OPTIMIZATION_PROVENANCE})
    except OptimizationError as error:
        return harness_error(handler, error)


def optimization_events(handler: SimpleHTTPRequestHandler, session_id: str) -> None:
    try:
        _principal, _workspace, detail = _optimization_detail_for(handler, session_id)
        raw_after = handler.headers.get("Last-Event-ID")
        try:
            after = _strict_event_cursor(raw_after)
        except ValueError as error:
            raise OptimizationError("invalid_last_event_id", "Last-Event-ID must be an integer.", field_path="/headers/Last-Event-ID") from error
        if after and not any(event["sequence"] == after for event in detail["events"]):
            raise OptimizationError("event_not_found", "Last-Event-ID is not in the durable optimization event log.")
        events = [event for event in detail["events"] if event["sequence"] > after]
        try:
            _assert_event_replay_contiguous(events, after)
        except ValueError as error:
            raise OptimizationError("event_sequence_gap", "Optimization event sequence has a durable gap.") from error
        # ``recovery_required`` is a stop point for observation even though a
        # reviewed recovery action may later move the session back to
        # waiting_approval.  Keep JSON replay aligned with the SSE terminal
        # frame and the browser adapter's terminal-state set.
        terminal = detail["session"]["state"] in OPTIMIZATION_TERMINAL_STATES or detail["session"]["state"] in {"recovery_required", "manual_intervention_required"}
        return write_json(handler, HTTPStatus.OK, {"session_id": session_id, "events": events, "after_sequence": after, "terminal": terminal, "provenance": OPTIMIZATION_PROVENANCE})
    except OptimizationError as error:
        return harness_error(handler, error)


def optimization_event_stream(handler: SimpleHTTPRequestHandler, session_id: str) -> None:
    try:
        _principal, _workspace, detail = _optimization_detail_for(handler, session_id)
        raw_after = handler.headers.get("Last-Event-ID")
        try:
            after = _strict_event_cursor(raw_after)
        except ValueError as error:
            raise OptimizationError("invalid_last_event_id", "Last-Event-ID must be an integer.", field_path="/headers/Last-Event-ID") from error
        all_events = detail["events"]
        if after and not any(event["sequence"] == after for event in all_events):
            raise OptimizationError("event_not_found", "Last-Event-ID is not in the durable optimization event log.")
        events = [event for event in all_events if event["sequence"] > after]
        try:
            _assert_event_replay_contiguous(events, after)
        except ValueError as error:
            raise OptimizationError("event_sequence_gap", "Optimization event sequence has a durable gap.") from error
        handler.send_response(HTTPStatus.OK)
        handler.send_header("Content-Type", "text/event-stream; charset=utf-8")
        handler.send_header("Cache-Control", "no-store")
        handler.send_header("Connection", "close")
        add_contract_headers(handler)
        add_cors_headers(handler)
        handler.end_headers()
        for event in events:
            # ``workflow`` is the durable compatibility frame and owns the
            # Last-Event-ID cursor.  Publish an additive typed frame for Agent
            # diagnostics so consumers can route those events by name.  The
            # typed frame intentionally has no id: the workflow frame is the
            # single replay fence for reconnects.
            responses.write_sse_event(handler, event="workflow", event_id=str(event["sequence"]), data=event)
            if event.get("node") in OPTIMIZATION_AGENT_EVENT_NAMES:
                responses.write_sse_event(handler, event=str(event["node"]), data=event)
        if detail["session"]["state"] in OPTIMIZATION_TERMINAL_STATES or detail["session"]["state"] in {"recovery_required", "manual_intervention_required"}:
            responses.write_sse_event(handler, event="terminal", data={"session_id": session_id, "state": detail["session"]["state"]})
    except (BrokenPipeError, ConnectionResetError, OSError):
        return
    except OptimizationError as error:
        return harness_error(handler, error)


def optimization_action(handler: SimpleHTTPRequestHandler, session_id: str, action: str) -> None:
    try:
        principal, _workspace, detail = _optimization_detail_for(handler, session_id, {"pause": "agent:cancel_experiment", "resume": "agent:resume_experiment", "cancel": "agent:cancel_experiment", "retry": "agent:retry_experiment"}[action])
        key = handler.headers.get("Idempotency-Key", "").strip()
        if not re.fullmatch(r"[A-Za-z0-9._:-]{8,128}", key):
            raise OptimizationError("missing_idempotency_key", "Idempotency-Key is required for optimization writes.", field_path="/headers/Idempotency-Key")
        body = harness_json_body(handler)
        if set(body) - {"session_id", "action", "idempotency_key", "recovery_acknowledged"} or body.get("session_id") != session_id or body.get("action") != action:
            raise OptimizationError("payload_conflict", "Optimization action payload does not match the path.")
        if body.get("idempotency_key") not in {None, key}:
            raise OptimizationError("idempotency_key_mismatch", "Body idempotency_key must match Idempotency-Key.", field_path="/idempotency_key")
        if action == "pause":
            optimization_store.transition(session_id, "paused", expected={"waiting_approval", "queued", "running"})
        elif action == "cancel":
            optimization_store.transition(session_id, "cancelled", expected=ACTIVE_STATES)
            _optimization_set_terminal_summary(session_id, "cancelled", _optimization_stop_reason(session_id, "cancelled", "The local operator cancelled the optimization."))
        elif action == "retry":
            optimization_store.reset_candidate_for_retry(session_id)
            updated = optimization_store.get(session_id)
        else:
            current = optimization_store.get(session_id)
            if current is None:
                raise OptimizationError("session_not_found", "Optimization session was not found.")
            if current.get("state") == "recovery_required":
                # An unknown outcome is never retried in place.  An explicit
                # operator acknowledgement only creates a fresh, immutable
                # child candidate and returns to the approval fence; it does
                # not submit anything by itself.
                if body.get("recovery_acknowledged") is not True:
                    raise OptimizationError(
                        "recovery_acknowledgement_required",
                        "Recovery requires an explicit acknowledgement before a fresh approval.",
                        field_path="/recovery_acknowledged",
                        unknown_outcome=True,
                    )
                previous = optimization_store.candidate(session_id)
                if previous is None:
                    raise OptimizationError("candidate_not_found", "Recovery has no candidate to review.")
                fresh = optimization_candidate_document(
                    session=current,
                    sequence=len(optimization_store.candidates(session_id)),
                    parent_candidate_id=previous["candidate_id"],
                    config=previous.get("config", {}),
                )
                fresh["reason"] = {
                    "recovery_acknowledged": True,
                    "parent_candidate_id": previous["candidate_id"],
                    "detail": "A new approval is required after the previous execution outcome was unknown.",
                }
                optimization_store.add_candidate(session_id, fresh)
                optimization_store.set_active_operation(session_id, None)
                updated = optimization_store.transition(session_id, "waiting_approval", expected={"recovery_required"})
                return write_json(handler, HTTPStatus.OK, {"session": updated, "detail": optimization_store.detail(session_id), "action": action, "provenance": OPTIMIZATION_PROVENANCE})
            candidate = optimization_store.candidate(session_id)
            approval = detail.get("approval")
            if candidate and candidate.get("status") == "waiting_approval" and not approval:
                updated = optimization_store.transition(session_id, "waiting_approval", expected={"paused"})
            else:
                updated = optimization_store.transition(session_id, "queued", expected={"paused"})
                with optimization_workers_lock:
                    thread = optimization_workers.get(session_id)
                    if thread is None or not thread.is_alive():
                        # A durable paused session may only be resumed by an
                        # existing worker. Re-submitting a consumed approval
                        # after a Bridge restart would be an unsafe blind retry.
                        optimization_store.transition(session_id, "recovery_required", expected={"queued"}, error={"code": "worker_restart_requires_recovery", "unknown_outcome": True})
                        _optimization_set_terminal_summary(session_id, "recovery_required", _optimization_stop_reason(session_id, "recovery_required", "The paused worker was not present; resume requires recovery review."))
        return write_json(handler, HTTPStatus.OK, {"session": optimization_store.get(session_id), "detail": optimization_store.detail(session_id), "action": action, "provenance": OPTIMIZATION_PROVENANCE})
    except OptimizationError as error:
        return harness_error(handler, error)


def approve_optimization_candidate(handler: SimpleHTTPRequestHandler, session_id: str, candidate_id: str | None = None) -> None:
    try:
        principal, _workspace, detail = _optimization_detail_for(handler, session_id, "agent:approve_draft")
        key = handler.headers.get("Idempotency-Key", "").strip()
        if not re.fullmatch(r"[A-Za-z0-9._:-]{8,128}", key):
            raise OptimizationError("missing_idempotency_key", "Idempotency-Key is required for optimization writes.", field_path="/headers/Idempotency-Key")
        body = harness_json_body(handler)
        if body.get("idempotency_key") not in {None, key}:
            raise OptimizationError("idempotency_key_mismatch", "Body idempotency_key must match Idempotency-Key.", field_path="/idempotency_key")
        candidate = optimization_store.candidate(session_id, candidate_id or body.get("candidate_id"))
        if candidate is None:
            raise OptimizationError("candidate_not_found", "Candidate was not found.")
        expires_at = body.get("expires_at")
        if not isinstance(expires_at, str):
            expires_at = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        approval_digest = body.get("approval_digest") or optimization_digest({"candidate_digest": candidate["candidate_digest"], "session_id": session_id})
        approval = optimization_store.approve(session_id, candidate["candidate_id"], principal=principal, digest=approval_digest, expires_at=expires_at)
        with optimization_workers_lock:
            thread = threading.Thread(target=_optimization_worker, args=(session_id, candidate["candidate_id"], approval), daemon=True)
            optimization_workers[session_id] = thread; thread.start()
        return write_json(handler, HTTPStatus.ACCEPTED, {"approval": approval, "session": optimization_store.get(session_id), "detail": optimization_store.detail(session_id), "provenance": OPTIMIZATION_PROVENANCE})
    except OptimizationError as error:
        return harness_error(handler, error)


def _batch_detail_for(handler: SimpleHTTPRequestHandler, batch_id: str, required: str = "agent:read_run") -> tuple[str, str, dict[str, Any]]:
    try:
        principal, workspace = _optimization_scoped(handler, required)
    except OptimizationError as error:
        raise BatchError(error.code, str(error), field_path=error.field_path) from error
    detail = batch_store.detail(batch_id)
    if detail is None:
        raise BatchError("batch_not_found", "Batch was not found.")
    batch = detail["batch"]
    if batch.get("principal") != principal or batch.get("workspace_id") != workspace:
        raise BatchError("operation_access_denied", "Batch is not owned by this principal and workspace.")
    if batch.get("schema_set_revision") != SCHEMA_SET_REVISION:
        raise BatchError("schema_revision_mismatch", "Batch schema-set revision is stale.")
    if batch.get("backend_identity") != harness_backend_identity():
        raise BatchError("backend_identity_mismatch", "Batch backend identity is stale.")
    return principal, workspace, detail


def _batch_stop_reason(batch_id: str, reason: str, detail: str) -> dict[str, Any]:
    return {"schema_identity": BATCH_SCHEMA_IDENTITIES["stop_reason"], "contract_revision": BATCH_CONTRACT_REVISION, "batch_id": batch_id, "reason": reason, "detail": detail, "provenance": BATCH_PROVENANCE}


def _batch_verified_evaluation(batch: dict[str, Any], candidate: dict[str, Any], execution: dict[str, Any]) -> dict[str, Any]:
    """Resolve exactly one allow-listed metric for a completed formal run.

    Batch orchestration never reads a run directory directly.  The execution
    result reference is first bound to this batch's snapshot/schema/backend and
    the metric is then obtained through the same verified tool gateway used by
    the single-session optimizer.  Only the scalar value and bounded evidence
    identity are retained in the batch store.
    """
    result = execution.get("result")
    if not isinstance(result, dict) or result.get("schema_identity") != EXECUTION_SCHEMA_IDENTITIES["result"]:
        raise BatchError("result_schema_mismatch", "Execution result reference is not current.")
    for key in ("run_id", "manifest_digest", "schema_set_revision"):
        if not isinstance(result.get(key), str) or not result[key]:
            raise BatchError("result_identity_incomplete", "Execution result identity is incomplete.")
    if result["schema_set_revision"] != batch["schema_set_revision"]:
        raise BatchError("schema_revision_mismatch", "Execution result schema-set is stale.")
    if execution.get("input_snapshot_digest") != batch["input_snapshot_digest"]:
        raise BatchError("snapshot_mismatch", "Execution result snapshot does not match the batch.")
    if execution.get("backend_identity") != batch["backend_identity"]:
        raise BatchError("backend_identity_mismatch", "Execution result backend identity is stale.")
    provenance = result.get("provenance") if isinstance(result.get("provenance"), dict) else {}
    if (
        provenance.get("source_mode") != "synthetic_trace"
        or provenance.get("claim_scope") != "exploratory"
        or provenance.get("deployment_mode") not in {None, "local_dev"}
    ):
        raise BatchError("provenance_mismatch", "Batch accepts only local synthetic exploratory results.")
    objective = batch.get("objective") if isinstance(batch.get("objective"), dict) else {}
    metric_path = objective.get("metric_path")
    if not isinstance(metric_path, str) or not metric_path.startswith("/"):
        raise BatchError("invalid_objective", "Objective metric_path must be a JSON Pointer.", field_path="/objective/metric_path")
    try:
        tool_result = _harness_dispatch(
            execution["operation_id"],
            "query_verified_metrics",
            {
                "run_id": result["run_id"],
                "artifact_id": "metrics",
                "json_pointers": [metric_path],
                "principal": batch["principal"],
                "scope": "agent:read_evidence",
                "idempotency_key": f"batch-metrics:{candidate['candidate_id']}",
            },
            batch["principal"],
            {"agent:read_evidence"},
        )
    except harness_tools.ToolGatewayError as error:
        raise BatchError(error.code, "Verified metrics could not be read.", retryable=error.retryable, unknown_outcome=error.unknown_outcome, field_path=error.field_path or "/objective/metric_path") from error
    if tool_result.get("snapshot_digest") != batch["input_snapshot_digest"]:
        raise BatchError("snapshot_mismatch", "Verified metrics are not bound to the batch snapshot.")
    values = tool_result.get("result") if isinstance(tool_result, dict) else None
    value = values.get(metric_path) if isinstance(values, dict) else None
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(float(value)):
        raise BatchError("objective_unavailable", "Verified objective pointer did not contain a finite number.", field_path=f"/objective/{metric_path.lstrip('/')}")
    objective_record = {
        "schema_identity": BATCH_SCHEMA_IDENTITIES["objective"],
        "contract_revision": BATCH_CONTRACT_REVISION,
        "metric_path": metric_path,
        "direction": objective.get("direction", "minimize"),
        "policy_revision": batch.get("policy_revision", BATCH_POLICY_REVISION),
        "digest": harness_canonical_sha256({"metric_path": metric_path, "value": value}),
        "value": value,
        "status": "verified",
    }
    return {
        "schema_identity": BATCH_SCHEMA_IDENTITIES["result"],
        "contract_revision": BATCH_CONTRACT_REVISION,
        "batch_id": batch["batch_id"],
        "candidate_id": candidate["candidate_id"],
        "status": "completed",
        "operation_id": execution["operation_id"],
        "run_id": result["run_id"],
        "artifact_manifest_digest": result["manifest_digest"],
        "objective": objective_record,
        "evidence": [{"run_id": result["run_id"], "manifest_digest": result["manifest_digest"], "json_pointer": metric_path, "tool_output_digest": tool_result.get("output_digest")}],
        "snapshot_digest": batch["input_snapshot_digest"],
        "schema_set_revision": batch["schema_set_revision"],
        "backend_identity": batch["backend_identity"],
        "provenance": BATCH_PROVENANCE,
    }


def _batch_best(batch: dict[str, Any], candidates: list[dict[str, Any]]) -> tuple[str | None, int | float | None, int]:
    objective = batch.get("objective") if isinstance(batch.get("objective"), dict) else {}
    direction = objective.get("direction", "minimize")
    values: list[tuple[str, int | float]] = []
    for candidate in candidates:
        result = candidate.get("result") if isinstance(candidate.get("result"), dict) else {}
        evaluation = result.get("objective") if isinstance(result.get("objective"), dict) else {}
        value = evaluation.get("value")
        if candidate.get("status") == "completed" and isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value)):
            values.append((candidate["candidate_id"], value))
    if not values:
        return None, None, 0
    values.sort(key=lambda item: item[1], reverse=direction == "maximize")
    best_id, best_value = values[0]
    return best_id, best_value, len(values)


def _batch_attempt_count(candidates: list[dict[str, Any]]) -> int:
    attempted_states = {"running", "completed", "failed", "recovery_required", "manual_intervention_required"}
    return sum(int(candidate.get("retry_count", 0)) + (1 if candidate.get("status") in attempted_states else 0) for candidate in candidates)


def _batch_worker(batch_id: str) -> None:
    owner = f"batch-worker-{uuid.uuid4().hex}"
    try:
        if not batch_store.acquire_lease(batch_id, owner):
            raise BatchError("queue_capacity_reached", "Another batch worker owns this batch.", retryable=True)
        batch = batch_store.get(batch_id)
        if batch is None:
            return
        batch_store.transition(batch_id, "running", expected={"queued"})
        runtime = batch.get("runtime") if isinstance(batch.get("runtime"), dict) else {}
        persisted_failures = runtime.get("failure_count")
        failures = int(persisted_failures) if isinstance(persisted_failures, (int, float)) and persisted_failures >= 0 else sum(1 for item in batch_store.candidates(batch_id) if item.get("status") == "failed")
        batch_store.set_runtime_metadata(batch_id, failure_count=failures)
        started_at_epoch = runtime.get("started_at_epoch")
        if not isinstance(started_at_epoch, (int, float)):
            started_at_epoch = time.time()
            batch_store.set_runtime_metadata(batch_id, started_at_epoch=started_at_epoch)
        deadline = time.monotonic() + max(0.0, min(batch["budget"]["max_seconds"], MAX_BUDGET_SECONDS) - max(0.0, time.time() - started_at_epoch))
        for candidate in batch_store.candidates(batch_id):
            current = batch_store.get(batch_id)
            if current is None or current.get("state") == "cancelled":
                return
            while current and current.get("state") == "paused":
                batch_store.heartbeat(batch_id, owner)
                time.sleep(0.1)
                current = batch_store.get(batch_id)
            if current is None or current.get("state") == "cancelled":
                return
            if current.get("state") == "queued":
                batch_store.transition(batch_id, "running", expected={"queued"})
                current = batch_store.get(batch_id)
            current_candidates = batch_store.candidates(batch_id)
            attempted = _batch_attempt_count(current_candidates)
            if attempted >= batch["budget"]["max_runs"] or time.monotonic() >= deadline:
                reason = "run_budget_exhausted" if attempted >= batch["budget"]["max_runs"] else "time_budget_exhausted"
                detail = "The bounded run budget was exhausted." if reason == "run_budget_exhausted" else "The bounded batch time budget was exhausted."
                batch_store.transition(batch_id, "completed", expected={"running"})
                batch_store.set_summary(batch_id, batch_store.summary(batch_id), stop_reason=_batch_stop_reason(batch_id, reason, detail))
                return
            if candidate.get("status") in {"completed", "cancelled", "recovery_required", "manual_intervention_required"}:
                continue
            request = candidate.get("config") or batch.get("execution_request")
            if not isinstance(request, dict) or not request:
                failure = {"code": "execution_request_unavailable", "retryable": False, "unknown_outcome": False}
                batch_store.update_candidate(batch_id, candidate["candidate_id"], status="failed", failure=failure)
                failures += 1
                batch_store.set_runtime_metadata(batch_id, failure_count=failures)
                if batch.get("stop_policy", {}).get("on_failure") == "stop" or failures >= batch["budget"]["max_failures"]:
                    batch_store.transition(batch_id, "failed", expected={"running"}, error={"code": "failure_budget_exhausted"})
                    batch_store.set_summary(batch_id, batch_store.summary(batch_id), stop_reason=_batch_stop_reason(batch_id, "failure_budget", "The bounded failure budget was exhausted."))
                    return
                continue
            candidate_for_execution = {**candidate, "session_id": batch_id}
            session_for_execution = {**batch, "session_id": batch_id, "constraints": batch.get("constraints", []), "budget": {"max_seconds": batch["budget"]["max_seconds"], "max_runs": batch["budget"]["max_runs"], "max_iterations": batch["budget"]["max_candidates"], "max_failures": batch["budget"]["max_failures"]}}
            approval = {"approval_digest": optimization_digest({"batch_id": batch_id, "candidate_digest": candidate["candidate_digest"]})}
            batch_store.update_candidate(batch_id, candidate["candidate_id"], status="running")
            try:
                operation_id = _optimization_submit_formal(session_for_execution, {**candidate_for_execution, "config": request}, approval)
                batch_store.update_candidate(batch_id, candidate["candidate_id"], operation_id=operation_id)
                execution = None
                while time.monotonic() < deadline:
                    current = batch_store.get(batch_id)
                    if current and current.get("state") == "cancelled":
                        return
                    if current and current.get("state") == "paused":
                        if not batch_store.heartbeat(batch_id, owner):
                            raise BatchError("lease_lost", "Batch worker lease was lost.", unknown_outcome=True)
                        time.sleep(0.1); continue
                    execution = agent_harness_store.get_stage3_by_operation(operation_id)
                    if execution and execution.get("state") in EXECUTION_TERMINAL_STATES:
                        break
                    batch_store.heartbeat(batch_id, owner)
                    time.sleep(0.1)
                if not execution or execution.get("state") == "recovery_required" or execution.get("state") not in EXECUTION_TERMINAL_STATES:
                    failure = {"code": "unknown_outcome", "retryable": False, "unknown_outcome": True}
                    batch_store.update_candidate(batch_id, candidate["candidate_id"], status="recovery_required", failure=failure)
                    batch_store.transition(batch_id, "recovery_required", expected={"running"}, error=failure)
                    return
                if execution.get("state") != "completed":
                    execution_error = execution.get("error") if isinstance(execution.get("error"), dict) else {}
                    unknown_outcome = bool(execution.get("unknown_outcome")) or bool(execution_error.get("unknown_outcome"))
                    execution_state = execution.get("state")
                    if execution_state == "manual_intervention_required":
                        failure = {
                            "code": execution_error.get("code", "manual_intervention_required"),
                            "retryable": False,
                            "unknown_outcome": True,
                        }
                        batch_store.update_candidate(batch_id, candidate["candidate_id"], status="manual_intervention_required", failure=failure)
                        batch_store.transition(batch_id, "manual_intervention_required", expected={"running"}, error=failure)
                        return
                    if execution_state == "recovery_required" or unknown_outcome:
                        failure = {
                            "code": execution_error.get("code", "unknown_outcome"),
                            "retryable": False,
                            "unknown_outcome": True,
                        }
                        batch_store.update_candidate(batch_id, candidate["candidate_id"], status="recovery_required", failure=failure)
                        batch_store.transition(batch_id, "recovery_required", expected={"running"}, error=failure)
                        return
                    failure = {"code": execution_error.get("code", "execution_failed"), "retryable": bool(execution.get("retryable")), "unknown_outcome": False}
                    batch_store.update_candidate(batch_id, candidate["candidate_id"], status="failed", failure=failure)
                    failures += 1
                    batch_store.set_runtime_metadata(batch_id, failure_count=failures)
                else:
                    current = batch_store.get(batch_id)
                    if current is None or current.get("state") == "cancelled":
                        return
                    evaluated = _batch_verified_evaluation(batch_store.get(batch_id) or batch, candidate, execution)
                    batch_store.update_candidate(batch_id, candidate["candidate_id"], status="completed", run_id=evaluated.get("run_id"), artifact_manifest_digest=evaluated.get("artifact_manifest_digest"), result=evaluated)
            except (OptimizationError, BatchError) as error:
                failure = {"code": getattr(error, "code", "batch_execution_failed"), "retryable": bool(getattr(error, "retryable", False)), "unknown_outcome": bool(getattr(error, "unknown_outcome", False))}
                failure_record = {"schema_identity": BATCH_SCHEMA_IDENTITIES["failure"], "contract_revision": BATCH_CONTRACT_REVISION, "batch_id": batch_id, "candidate_id": candidate["candidate_id"], **failure, "field_path": getattr(error, "field_path", "/"), "provenance": BATCH_PROVENANCE}
                batch_store.update_candidate(batch_id, candidate["candidate_id"], status="recovery_required" if failure["unknown_outcome"] else "failed", failure=failure_record)
                if failure["unknown_outcome"]:
                    batch_store.transition(batch_id, "recovery_required", expected={"running"}, error=failure); return
                failures += 1
                batch_store.set_runtime_metadata(batch_id, failure_count=failures)
            completed = sum(1 for item in batch_store.candidates(batch_id) if item.get("status") == "completed")
            failed = sum(1 for item in batch_store.candidates(batch_id) if item.get("status") == "failed")
            checkpoint = batch_store.save_checkpoint(batch_id, {"candidate_ids": [item["candidate_id"] for item in batch_store.candidates(batch_id) if item.get("status") == "completed"], "completed_count": completed, "failed_count": failed})
            fresh_candidates = batch_store.candidates(batch_id)
            best_id, best_value, evaluated_count = _batch_best(batch_store.get(batch_id) or batch, fresh_candidates)
            current_batch = batch_store.get(batch_id) or batch
            previous_best = current_batch.get("best_value")
            no_improvement = int(current_batch.get("no_improvement_count", 0))
            if best_value is not None and previous_best is not None:
                direction = (current_batch.get("objective") or {}).get("direction", "minimize")
                improved = best_value < float(previous_best) if direction == "minimize" else best_value > float(previous_best)
                no_improvement = 0 if improved else no_improvement + 1
            elif best_value is not None:
                no_improvement = 0
            batch_store.set_progress(batch_id, best_candidate_id=best_id, best_value=best_value, no_improvement_count=no_improvement, evaluated_count=evaluated_count)
            if no_improvement >= batch["budget"]["max_no_improvement"] and batch.get("stop_policy", {}).get("on_no_improvement") == "stop":
                batch_store.transition(batch_id, "completed", expected={"running"})
                batch_store.set_summary(batch_id, batch_store.summary(batch_id), stop_reason=_batch_stop_reason(batch_id, "no_improvement", "The bounded no-improvement budget was exhausted."), best_candidate_id=best_id)
                return
            if failures >= batch["budget"]["max_failures"] or (failures > 0 and batch.get("stop_policy", {}).get("on_failure") == "stop"):
                batch_store.transition(batch_id, "failed", expected={"running"}, error={"code": "failure_budget_exhausted"})
                batch_store.set_summary(batch_id, batch_store.summary(batch_id), stop_reason=_batch_stop_reason(batch_id, "failure_budget", "The bounded failure budget was exhausted."))
                return
        batch_store.transition(batch_id, "completed", expected={"running"})
        best_id, _best_value, _evaluated_count = _batch_best(batch_store.get(batch_id) or batch, batch_store.candidates(batch_id))
        batch_store.set_summary(batch_id, batch_store.summary(batch_id), stop_reason=_batch_stop_reason(batch_id, "candidate_set_exhausted", "All bounded candidate slots reached a terminal state."), best_candidate_id=best_id)
    except BatchError as error:
        try:
            batch_store.transition(batch_id, "recovery_required" if error.unknown_outcome else "failed", expected={"queued", "running"}, error={"code": error.code, "retryable": error.retryable, "unknown_outcome": error.unknown_outcome})
        except BatchError:
            pass
    finally:
        batch_store.release_lease(batch_id, owner)
        with batch_workers_lock:
            batch_workers.pop(batch_id, None)


def _start_batch_worker(batch_id: str) -> None:
    with batch_workers_lock:
        current = batch_workers.get(batch_id)
        if current and current.is_alive():
            return
        thread = threading.Thread(target=_batch_worker, args=(batch_id,), daemon=True)
        batch_workers[batch_id] = thread
        thread.start()


def create_batch(handler: SimpleHTTPRequestHandler) -> None:
    try:
        try:
            principal, workspace = _optimization_scoped(handler, "agent:write_draft")
        except OptimizationError as error:
            raise BatchError(error.code, str(error), field_path=error.field_path) from error
        key = handler.headers.get("Idempotency-Key", "").strip()
        if not re.fullmatch(r"[A-Za-z0-9._:-]{8,128}", key):
            raise BatchError("missing_idempotency_key", "Idempotency-Key is required for batch writes.", field_path="/headers/Idempotency-Key")
        raw_body = harness_json_body(handler)
        if raw_body.get("idempotency_key") not in {None, key}:
            raise BatchError("idempotency_key_mismatch", "Body idempotency_key must match Idempotency-Key.", field_path="/idempotency_key")
        document = validate_batch_request(raw_body, principal=principal, workspace_id=workspace, schema_set_revision=SCHEMA_SET_REVISION, backend_identity=harness_backend_identity())
        batch, replay = batch_store.create(document, idempotency_key=key)
        return write_json(handler, HTTPStatus.OK if replay else HTTPStatus.CREATED, {"batch": batch, "detail": batch_store.detail(batch["batch_id"]), "idempotent_replay": replay, "provenance": BATCH_PROVENANCE})
    except BatchError as error:
        return harness_error(handler, error)


def list_batches(handler: SimpleHTTPRequestHandler) -> None:
    try:
        try:
            principal, workspace = _optimization_scoped(handler, {"agent:read_run", "agent:read_draft"})
        except OptimizationError as error:
            raise BatchError(error.code, str(error), field_path=error.field_path) from error
        return write_json(handler, HTTPStatus.OK, {"batches": batch_store.list(principal, workspace), "provenance": BATCH_PROVENANCE})
    except BatchError as error:
        return harness_error(handler, error)


def get_batch(handler: SimpleHTTPRequestHandler, batch_id: str) -> None:
    try:
        _principal, _workspace, detail = _batch_detail_for(handler, batch_id)
        return write_json(handler, HTTPStatus.OK, {"batch": detail["batch"], "detail": {**detail, "summary": batch_store.summary(batch_id)}, "provenance": BATCH_PROVENANCE})
    except BatchError as error:
        return harness_error(handler, error)


def batch_events(handler: SimpleHTTPRequestHandler, batch_id: str) -> None:
    try:
        _principal, _workspace, detail = _batch_detail_for(handler, batch_id)
        try: after = _strict_event_cursor(handler.headers.get("Last-Event-ID"))
        except ValueError as error: raise BatchError("invalid_last_event_id", "Last-Event-ID must be an integer.", field_path="/headers/Last-Event-ID") from error
        all_events = detail["events"]
        if after and not any(item["sequence"] == after for item in all_events):
            raise BatchError("event_not_found", "Last-Event-ID is not present in the batch event log.")
        # Recovery is a terminal observation boundary for this replay.  The
        # state may later resume only after explicit acknowledgement, so the
        # durable polling/SSE adapters must stop here instead of waiting for a
        # frame that will never arrive on this connection.
        terminal = detail["batch"]["state"] in BATCH_TERMINAL_STATES or detail["batch"]["state"] == "recovery_required"
        events = [item for item in all_events if item["sequence"] > after]
        try:
            _assert_event_replay_contiguous(events, after)
        except ValueError as error:
            raise BatchError("event_sequence_gap", "Batch event sequence has a durable gap.") from error
        return write_json(handler, HTTPStatus.OK, {"batch_id": batch_id, "events": events, "after_sequence": after, "terminal": terminal, "provenance": BATCH_PROVENANCE})
    except BatchError as error:
        return harness_error(handler, error)


def batch_event_stream(handler: SimpleHTTPRequestHandler, batch_id: str) -> None:
    try:
        _principal, _workspace, detail = _batch_detail_for(handler, batch_id)
        try: after = _strict_event_cursor(handler.headers.get("Last-Event-ID"))
        except ValueError as error: raise BatchError("invalid_last_event_id", "Last-Event-ID must be an integer.", field_path="/headers/Last-Event-ID") from error
        if after and not any(item["sequence"] == after for item in detail["events"]):
            raise BatchError("event_not_found", "Last-Event-ID is not present in the batch event log.")
        events = [item for item in detail["events"] if item["sequence"] > after]
        try:
            _assert_event_replay_contiguous(events, after)
        except ValueError as error:
            raise BatchError("event_sequence_gap", "Batch event sequence has a durable gap.") from error
        handler.send_response(HTTPStatus.OK); handler.send_header("Content-Type", "text/event-stream; charset=utf-8"); handler.send_header("Cache-Control", "no-store"); handler.send_header("Connection", "close"); add_contract_headers(handler); add_cors_headers(handler); handler.end_headers()
        for event in events:
            responses.write_sse_event(handler, event="workflow", event_id=str(event["sequence"]), data=event)
        if detail["batch"]["state"] in BATCH_TERMINAL_STATES or detail["batch"]["state"] == "recovery_required":
            responses.write_sse_event(handler, event="terminal", data={"batch_id": batch_id, "state": detail["batch"]["state"]})
    except (BrokenPipeError, ConnectionResetError, OSError):
        return
    except BatchError as error:
        return harness_error(handler, error)


def batch_approve(handler: SimpleHTTPRequestHandler, batch_id: str) -> None:
    try:
        _principal, _workspace, detail = _batch_detail_for(handler, batch_id, "agent:approve_draft")
        key = handler.headers.get("Idempotency-Key", "").strip()
        if not re.fullmatch(r"[A-Za-z0-9._:-]{8,128}", key): raise BatchError("missing_idempotency_key", "Idempotency-Key is required for batch approval.")
        body = harness_json_body(handler); batch = detail["batch"]
        if body.get("idempotency_key") not in {None, key}:
            raise BatchError("idempotency_key_mismatch", "Body idempotency_key must match Idempotency-Key.", field_path="/idempotency_key")
        plan_digest = batch.get("plan", {}).get("plan_digest") if isinstance(batch.get("plan"), dict) else None
        plan_digest = plan_digest or optimization_digest(batch.get("plan"))
        digest = body.get("approval_digest") or optimization_digest({"batch_id": batch_id, "plan_digest": plan_digest, "snapshot_digest": batch["input_snapshot_digest"]})
        expires_at = body.get("expires_at") or (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        approval = batch_store.approve(batch_id, approval_digest=digest, expires_at=expires_at)
        if batch.get("auto_execute", True):
            batch_store.consume_approval(batch_id); batch_store.transition(batch_id, "queued", expected={"waiting_approval"}); _start_batch_worker(batch_id)
        return write_json(handler, HTTPStatus.OK, {"batch": batch_store.get(batch_id), "detail": batch_store.detail(batch_id), "approval": approval, "provenance": BATCH_PROVENANCE})
    except BatchError as error:
        return harness_error(handler, error)


def batch_action(handler: SimpleHTTPRequestHandler, batch_id: str, action: str) -> None:
    try:
        required = {"start": "agent:submit_experiment", "pause": "agent:cancel_experiment", "resume": "agent:resume_experiment", "cancel": "agent:cancel_experiment", "retry": "agent:retry_experiment"}[action]
        _principal, _workspace, detail = _batch_detail_for(handler, batch_id, required)
        key = handler.headers.get("Idempotency-Key", "").strip()
        if not re.fullmatch(r"[A-Za-z0-9._:-]{8,128}", key): raise BatchError("missing_idempotency_key", "Idempotency-Key is required for batch actions.")
        body = harness_json_body(handler)
        if body.get("idempotency_key") not in {None, key}:
            raise BatchError("idempotency_key_mismatch", "Body idempotency_key must match Idempotency-Key.", field_path="/idempotency_key")
        if set(body) - {"batch_id", "action", "recovery_acknowledged", "idempotency_key"} or body.get("batch_id") != batch_id or body.get("action") != action: raise BatchError("payload_conflict", "Batch action payload does not match the path.")
        current = detail["batch"]
        if action == "start":
            if current["state"] == "waiting_approval":
                if not isinstance(current.get("approval"), dict) or current["approval"].get("status") != "approved":
                    raise BatchError("approval_required", "Batch plan must be approved before start.")
                batch_store.consume_approval(batch_id)
                batch_store.transition(batch_id, "queued", expected={"waiting_approval"})
                _start_batch_worker(batch_id)
                return write_json(handler, HTTPStatus.OK, {"batch": batch_store.get(batch_id), "detail": batch_store.detail(batch_id), "action": action, "provenance": BATCH_PROVENANCE})
            if current["state"] == "recovery_required": raise BatchError("recovery_acknowledgement_required", "Recovery requires explicit acknowledgement.", unknown_outcome=True)
            if current["state"] in {"queued", "running"}: return write_json(handler, HTTPStatus.OK, {"batch": current, "detail": batch_store.detail(batch_id), "idempotent_replay": True, "provenance": BATCH_PROVENANCE})
            batch_store.transition(batch_id, "queued", expected={"paused", "validated"}); _start_batch_worker(batch_id)
        elif action == "pause":
            batch_store.transition(batch_id, "paused", expected={"queued", "running"})
        elif action == "cancel":
            batch_store.transition(batch_id, "cancelled", expected=BATCH_ACTIVE_STATES)
        elif action == "retry":
            if current["state"] != "failed": raise BatchError("retry_not_allowed", "Only a failed batch can be explicitly retried.")
            batch_store.prepare_retry(batch_id, max_retries=int(current.get("budget", {}).get("max_retries", 1)))
            batch_store.transition(batch_id, "waiting_approval", expected={"failed"}, allow_retry=True)
        else:
            if current["state"] == "recovery_required":
                if body.get("recovery_acknowledged") is not True: raise BatchError("recovery_acknowledgement_required", "Recovery requires explicit acknowledgement.", unknown_outcome=True)
                batch_store.mark_recovery_for_manual_intervention(batch_id)
                batch_store.transition(batch_id, "manual_intervention_required", expected={"recovery_required"})
            else:
                batch_store.transition(batch_id, "queued", expected={"paused"}); _start_batch_worker(batch_id)
        return write_json(handler, HTTPStatus.OK, {"batch": batch_store.get(batch_id), "detail": batch_store.detail(batch_id), "action": action, "provenance": BATCH_PROVENANCE})
    except BatchError as error:
        return harness_error(handler, error)


def harness_operation_event(operation_id: str, *, node: str, state: str, terminal: bool = False, payload: dict | None = None, draft_id: str | None = None, approval_id: str | None = None, schema_identity: str | None = None, contract_revision: str | None = None) -> dict:
    operation = agent_harness_store.get_operation(operation_id)
    if operation is None:
        raise HarnessStoreError("operation_not_found", "Operation was not found.")
    events = agent_harness_store.list_events(operation_id)
    sequence = (events[-1]["sequence"] if events else 0) + 1
    event_id = f"evt-{uuid.uuid4().hex}"
    event = agent_harness_store.append_event(
        operation_id,
        event_id=event_id,
        sequence=sequence,
        node=node,
        state=state,
        payload_digest=harness_canonical_sha256(payload or {"state": state}),
        parent_event_id=events[-1]["event_id"] if events else None,
        terminal=terminal,
        idempotency_key=operation.get("idempotency_key"),
        draft_id=draft_id,
        approval_id=approval_id,
        schema_identity=schema_identity,
        contract_revision=contract_revision,
    )
    return event


def _harness_run_status(run_id: str) -> dict | None:
    return public_run(run_snapshot(run_id)) if run_snapshot(run_id) is not None else None


def _harness_run_owner(principal: str, run_id: str) -> bool:
    run = run_snapshot(run_id)
    if run is None:
        return False
    # Existing manual runs predate Harness ownership metadata and are scoped to
    # the loopback local subject. Future run metadata may bind an explicit owner.
    return run.get("principal", "local-user") == principal


def _harness_manifest(run_id: str) -> dict:
    run_dir = safe_run_directory(run_id)
    if run_dir is None:
        raise harness_tools.ToolGatewayError("run_not_found", "Run was not found.", "/input/run_id", status=404)
    try:
        return artifact_manifest_for(run_id, run_dir)
    except run_repository.ArtifactManifestValidationError as error:
        raise harness_tools.ToolGatewayError("artifact_manifest_invalid", str(error), status=409) from error


def _harness_artifact(run_id: str, artifact_id: str) -> dict:
    run_dir = safe_run_directory(run_id)
    if run_dir is None:
        raise harness_tools.ToolGatewayError("run_not_found", "Run was not found.", "/input/run_id", status=404)
    path = json_artifact_paths_for(run_dir).get(artifact_id)
    if path is None:
        raise harness_tools.ToolGatewayError("artifact_not_found", "Artifact is not allow-listed.", "/input/artifact_id", status=404)
    try:
        inspected = run_repository.inspect_artifact(run_id, path, JSON_ARTIFACT_DEFINITIONS[artifact_id])
        document = json.loads(inspected["body"].decode("utf-8"))
        return {"document": document, "sha256": hashlib.sha256(inspected["body"]).hexdigest(), "bytes": len(inspected["body"])}
    except (run_repository.ArtifactContractError, OSError, ValueError, json.JSONDecodeError) as error:
        raise harness_tools.ToolGatewayError("artifact_invalid", str(error), status=409) from error


def _harness_dispatch(operation_id: str, tool_name: str, payload: dict, principal: str, scopes: set[str]) -> dict:
    return harness_tools.dispatch(
        store=agent_harness_store,
        operation_id=operation_id,
        tool_name=tool_name,
        payload=payload,
        principal=principal,
        scopes=scopes,
        schema_set_revision=SCHEMA_SET_REVISION,
        backend_identity=harness_backend_identity(),
        get_catalog=lambda: harness_capability_snapshot(),
        get_run=_harness_run_status,
        get_manifest=_harness_manifest,
        get_artifact=_harness_artifact,
        run_owner=_harness_run_owner,
    )


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def request_id_for(handler: SimpleHTTPRequestHandler) -> str:
    return responses.request_id_for(handler)


def add_contract_headers(handler: SimpleHTTPRequestHandler) -> None:
    return responses.add_contract_headers(
        handler,
        api_version=API_VERSION,
        schema_set_revision=SCHEMA_SET_REVISION,
    )


def write_json(handler: SimpleHTTPRequestHandler, status: HTTPStatus, payload: dict) -> None:
    return responses.write_json(
        handler,
        status,
        payload,
        api_version=API_VERSION,
        schema_set_revision=SCHEMA_SET_REVISION,
    )


def write_error(
    handler: SimpleHTTPRequestHandler,
    status: HTTPStatus,
    code: str,
    message: str,
    *,
    field_path: str | None = None,
    retryable: bool | None = None,
    nested_schema_identity: str | None = None,
) -> None:
    return responses.write_error(
        handler,
        status,
        code,
        message,
        error_schema_version=ERROR_SCHEMA_VERSION,
        api_version=API_VERSION,
        schema_set_revision=SCHEMA_SET_REVISION,
        field_path=field_path,
        retryable=retryable,
        nested_schema_identity=nested_schema_identity,
    )


def api_manifest() -> dict:
    return responses.api_manifest(
        OPENAPI_CONTRACT,
        manifest_schema=API_MANIFEST_SCHEMA,
        api_version=API_VERSION,
        schema_set_revision=SCHEMA_SET_REVISION,
        error_schema_version=ERROR_SCHEMA_VERSION,
        artifact_manifest_schema=ARTIFACT_MANIFEST_SCHEMA,
        known_report_schema_identities=KNOWN_REPORT_SCHEMA_IDENTITIES,
        experiment_descriptor_contract=EXPERIMENT_DESCRIPTOR_CONTRACT,
        run_creation_contract=RUN_CREATION_CONTRACT,
        run_event_contract=RUN_EVENT_CONTRACT,
        evidence_agent_contract=EVIDENCE_AGENT_CONTRACT,
        agent_orchestration_capability_contract=(
            AGENT_ORCHESTRATION_CAPABILITY_CONTRACT
        ),
        agent_flow_contract=AGENT_FLOW_CONTRACT,
        trace_package_contract=TRACE_PACKAGE_CONTRACT,
    )


def add_cors_headers(handler: SimpleHTTPRequestHandler) -> None:
    return responses.add_cors_headers(handler)


def assistant_model_scope(
    handler: SimpleHTTPRequestHandler,
    *,
    required: bool = False,
) -> str | None:
    """Read the non-secret browser session scope used to isolate model choices.

    The scope is deliberately not an auth credential.  It only selects an in-memory model binding;
    the normal Bridge principal/workspace headers still govern protected operations.  A malformed
    scope is rejected instead of being silently treated as the legacy shared scope.
    """

    raw = handler.headers.get(assistant_model.SELECTION_SCOPE_HEADER, "").strip()
    if not raw:
        if required:
            raise ValueError(
                "The assistant model session scope header is required for this route."
            )
        return None
    try:
        principal = handler.headers.get("X-TileSim-Principal", "local-user").strip() or "local-user"
        workspace = handler.headers.get("X-TileSim-Workspace", "local-workspace").strip() or "local-workspace"
        return assistant_model.bind_selection_scope(raw, principal, workspace)
    except ValueError as error:
        raise ValueError("The assistant model session scope is invalid.") from error


def write_json_file(handler: SimpleHTTPRequestHandler, path: Path) -> None:
    return responses.write_json_file(
        handler,
        path,
        api_version=API_VERSION,
        schema_set_revision=SCHEMA_SET_REVISION,
        write_not_found=lambda: write_error(
            handler,
            HTTPStatus.NOT_FOUND,
            "artifact_not_found",
            "JSON artifact was not found.",
            retryable=False,
        ),
    )


def write_json_artifact_body(handler: SimpleHTTPRequestHandler, body: bytes) -> None:
    return responses.write_json_bytes(
        handler,
        body,
        api_version=API_VERSION,
        schema_set_revision=SCHEMA_SET_REVISION,
    )


def load_reports(run: dict) -> dict:
    return run_repository.load_reports(run, JSON_ARTIFACT_DEFINITIONS)


def report_paths_for(run_dir: Path) -> dict[str, Path]:
    return run_repository.report_paths_for(run_dir, REPORT_FILE_NAMES)


def validate_execution_replay(run_id: str, path: Path) -> str | None:
    """Validate the canonical replay before publishing an S6 run as completed."""
    try:
        run_repository.inspect_artifact(
            run_id,
            path,
            JSON_ARTIFACT_DEFINITIONS["execution-replay"],
        )
    except run_repository.ArtifactContractError as error:
        return f"Canonical execution replay artifact failed verification: {error}"
    return None


def json_artifact_paths_for(run_dir: Path) -> dict[str, Path]:
    return run_repository.json_artifact_paths_for(run_dir, JSON_ARTIFACT_DEFINITIONS)


def json_schema_identity(value: object) -> str:
    return run_repository.json_schema_identity(value)


def artifact_manifest_for(run_id: str, run_dir: Path) -> dict:
    return run_repository.artifact_manifest_for(
        run_id,
        run_dir,
        artifact_definitions=JSON_ARTIFACT_DEFINITIONS,
        artifact_manifest_schema=ARTIFACT_MANIFEST_SCHEMA,
        api_version=API_VERSION,
        schema_set_revision=SCHEMA_SET_REVISION,
    )


def evidence_agent_artifact_documents(run_dir: Path, manifest: dict) -> dict[str, dict]:
    """Freeze only verified, fixed-name JSON artifacts from the manifest snapshot."""
    documents: dict[str, dict] = {}
    for entry in manifest.get("artifacts", []):
        if entry.get("contract_status") != "supported":
            continue
        artifact_id = entry.get("artifact_id")
        definition = JSON_ARTIFACT_DEFINITIONS.get(artifact_id)
        if not isinstance(definition, dict):
            continue
        path = run_dir / definition["file_name"]
        try:
            body = path.read_bytes()
            document = json.loads(body)
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
            raise run_repository.ArtifactManifestValidationError(
                f"Evidence Agent artifact {artifact_id} cannot be frozen as valid JSON."
            ) from error
        if (
            not isinstance(document, dict)
            or len(body) != entry.get("bytes")
            or hashlib.sha256(body).hexdigest() != entry.get("sha256")
            or json_schema_identity(document) != entry.get("schema_identity")
        ):
            raise run_repository.ArtifactManifestValidationError(
                f"Evidence Agent artifact {artifact_id} changed after manifest verification."
            )
        documents[artifact_id] = document
    return documents


def safe_run_directory(run_id: str) -> Path | None:
    return run_repository.safe_run_directory(run_id, RUNS_ROOT)


def read_json_file(path: Path) -> dict:
    return run_repository.read_json_file(path)


def is_valid_json_file(path: Path) -> bool:
    return run_repository.is_valid_json_file(path)


def atomic_write_json(path: Path, payload: dict) -> None:
    return run_repository.atomic_write_json(path, payload)


def update_run_metadata(run_dir: Path, **updates: object) -> None:
    with metadata_lock:
        return run_repository.update_run_metadata(
            run_dir,
            read_json=read_json_file,
            write_json=atomic_write_json,
            **updates,
        )


def run_digest(report_paths: dict[str, Path]) -> dict:
    return run_repository.run_digest(report_paths)


def persisted_run(run_id: str) -> dict | None:
    return run_repository.persisted_run(
        run_id,
        runs_root=RUNS_ROOT,
        report_file_names=REPORT_FILE_NAMES,
        bridge_instance_id=BRIDGE_INSTANCE_ID,
        now=now,
        write_json=atomic_write_json,
    )


def public_run(run: dict) -> dict:
    return run_repository.public_run(run)


def idempotency_key_for(handler: SimpleHTTPRequestHandler) -> str:
    key = handler.headers.get("Idempotency-Key", "").strip()
    if not re.fullmatch(r"[A-Za-z0-9._:-]{8,128}", key):
        raise RequestValidationError(
            "Idempotency-Key must contain 8 to 128 safe characters.",
            "/headers/Idempotency-Key",
        )
    return key


def request_payload_digest(request: dict) -> str:
    canonical = json.dumps(request, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def reject_nonfinite_json(value: str) -> None:
    raise RequestValidationError(f"JSON number {value} is not finite.", "/")


def idempotent_run(key: str) -> dict | None:
    return run_repository.idempotent_run(
        key,
        runs=runs,
        runs_root=RUNS_ROOT,
        load_persisted_run=persisted_run,
    )


def creation_response(run: dict, *, idempotent_replay: bool) -> dict:
    return run_repository.creation_response(run, idempotent_replay=idempotent_replay)


def run_snapshot(run_id: str) -> dict | None:
    return run_repository.run_snapshot(
        run_id,
        runs=runs,
        runs_lock=runs_lock,
        load_persisted_run=persisted_run,
    )


def is_terminal_run(run: dict) -> bool:
    return run_repository.is_terminal_run(run)


def write_sse_event(
    handler: SimpleHTTPRequestHandler,
    *,
    event: str,
    data: dict,
    event_id: str | None = None,
) -> None:
    return responses.write_sse_event(handler, event=event, data=data, event_id=event_id)


def materialize_inputs(run_dir: Path, scenario: dict, overrides: dict) -> dict:
    return execution.materialize_inputs(run_dir, scenario, overrides)


def materialize_custom_inputs(run_dir: Path, scenario: dict, inputs: dict) -> dict:
    return execution.materialize_custom_inputs(run_dir, scenario, inputs)


def materialize_design_space_candidates(run_dir: Path, manifest: dict | None) -> Path | None:
    return execution.materialize_design_space_candidates(run_dir, manifest)


def materialize_trace_package_inputs(
    run_dir: Path,
    scenario: dict,
    *,
    manifest_path: Path,
    manifest_sha256: str,
    source_mode: str,
    entry_boundary: str,
    entry_trace_kind: str,
) -> dict:
    return execution.materialize_trace_package_inputs(
        run_dir,
        scenario,
        manifest_path=manifest_path,
        manifest_sha256=manifest_sha256,
        source_mode=source_mode,
        entry_boundary=entry_boundary,
        entry_trace_kind=entry_trace_kind,
    )


def trace_package_catalog() -> dict:
    return trace_packages.catalog(
        TRACE_PACKAGE_ROOT,
        schema_set_revision=SCHEMA_SET_REVISION,
        backend_identity=backend_identity(),
        tilesim_cli=TILESIM_CLI,
        tilesim_root=TILESIM_ROOT,
        process_runner=subprocess.run,
    )


def inspect_trace_package(package_id: str) -> tuple[trace_packages.TracePackageCandidate, dict]:
    return trace_packages.inspect_package(
        TRACE_PACKAGE_ROOT,
        package_id,
        tilesim_cli=TILESIM_CLI,
        tilesim_root=TILESIM_ROOT,
        process_runner=subprocess.run,
    )


def trace_package_error_status(error: trace_packages.TracePackageError) -> HTTPStatus:
    if error.code == "trace_package_not_found":
        return HTTPStatus.NOT_FOUND
    if error.code == "trace_package_inspect_timeout":
        return HTTPStatus.GATEWAY_TIMEOUT
    if error.retryable:
        return HTTPStatus.SERVICE_UNAVAILABLE
    return HTTPStatus.UNPROCESSABLE_ENTITY


def execute_run(run_id: str, scenario: dict, fidelity_policy: str) -> None:
    return execution.execute_run(
        run_id,
        scenario,
        fidelity_policy,
        runs_root=RUNS_ROOT,
        tilesim_cli=TILESIM_CLI,
        tilesim_root=TILESIM_ROOT,
        runs=runs,
        runs_lock=runs_lock,
        report_paths_for=report_paths_for,
        is_valid_json_file=is_valid_json_file,
        validate_execution_replay=validate_execution_replay,
        update_run_metadata=update_run_metadata,
        now=now,
        process_runner=subprocess.run,
    )


def start_run_execution(run_id: str, scenario: dict, fidelity_policy: str) -> None:
    return execution.start_run_execution(
        run_id,
        scenario,
        fidelity_policy,
        execute=execute_run,
    )


def execute_week7_operation(operation_id: str) -> dict:
    return week7.execute_week7_operation(
        operation_id,
        tilesim_cli=TILESIM_CLI,
        tilesim_root=TILESIM_ROOT,
        process_runner=subprocess.run,
    )


def run_intake_profile_records() -> dict:
    """Read the published Phase 2 Profile record set for the Run Intake preview.

    The published package declares five empty families, so every Profile reference fails
    closed as ``profile_missing``.  Nothing here ever invents a record, and a missing or
    invalid published manifest is a release-integrity failure, not a bad request.
    """
    return run_intake_service.published_profile_records()


class BridgeHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_ROOT), **kwargs)

    def log_message(self, format: str, *args) -> None:
        print("[TileSim Web] " + format % args)

    def do_GET(self) -> None:
        _remember_bridge_server(self)
        path = urlparse(self.path).path
        if path.startswith("/api/agent/flows/"):
            parts = path.strip("/").split("/")
            if len(parts) == 4 and parts[:3] == ["api", "agent", "flows"]:
                return get_agent_flow(self, parts[3])
            if len(parts) == 5 and parts[:4] == ["api", "agent", "flows", parts[3]] and parts[4] == "events":
                return agent_flow_events(self, parts[3])
            if len(parts) == 6 and parts[:5] == ["api", "agent", "flows", parts[3], "events"] and parts[5] == "stream":
                return stream_agent_flow_events(self, parts[3])
        if path == "/api/agent/optimization/sessions":
            return list_optimization_sessions(self)
        if path == "/api/agent/batches":
            return list_batches(self)
        if path.startswith("/api/agent/batches/"):
            parts = path.strip("/").split("/")
            if len(parts) == 4 and parts[:3] == ["api", "agent", "batches"]:
                return get_batch(self, parts[3])
            if len(parts) == 5 and parts[:4] == ["api", "agent", "batches", parts[3]] and parts[4] == "events":
                return batch_events(self, parts[3])
            if len(parts) == 6 and parts[:5] == ["api", "agent", "batches", parts[3], "events"] and parts[5] == "stream":
                return batch_event_stream(self, parts[3])
        if path.startswith("/api/agent/optimization/sessions/"):
            parts = path.strip("/").split("/")
            if len(parts) == 5 and parts[:4] == ["api", "agent", "optimization", "sessions"]:
                return get_optimization_session(self, parts[4])
            if len(parts) == 6 and parts[:4] == ["api", "agent", "optimization", "sessions"] and parts[5] == "authorization":
                return get_optimization_authorization(self, parts[4])
            if len(parts) == 6 and parts[:4] == ["api", "agent", "optimization", "sessions"] and parts[5] == "events":
                return optimization_events(self, parts[4])
            if len(parts) == 7 and parts[:4] == ["api", "agent", "optimization", "sessions"] and parts[5:] == ["events", "stream"]:
                return optimization_event_stream(self, parts[4])
        if path.startswith("/api/agent/executions/"):
            parts = path.strip("/").split("/")
            if len(parts) == 4 and parts[:3] == ["api", "agent", "executions"]:
                return get_stage3_execution(self, parts[3])
            if len(parts) == 5 and parts[:4] == ["api", "agent", "executions", parts[3]] and parts[4] == "events":
                return stage3_execution_events(self, parts[3])
            if len(parts) == 5 and parts[:4] == ["api", "agent", "executions", parts[3]] and parts[4] == "result":
                return stage3_execution_result(self, parts[3])
            if len(parts) == 6 and parts[:4] == ["api", "agent", "executions", parts[3]] and parts[4:] == ["events", "stream"]:
                return stream_stage3_execution_events(self, parts[3])
        if path == "/api/agent/harness-capabilities":
            return write_json(self, HTTPStatus.OK, harness_capability_snapshot())
        if path.startswith("/api/agent/drafts/"):
            parts = path.strip("/").split("/")
            if len(parts) == 4 and parts[:3] == ["api", "agent", "drafts"]:
                return get_stage2_draft(self, parts[3])
            if len(parts) == 5 and parts[:4] == ["api", "agent", "drafts", parts[3]] and parts[4] == "events":
                return stage2_draft_events(self, parts[3])
            if len(parts) == 6 and parts[:4] == ["api", "agent", "drafts", parts[3]] and parts[4:] == ["events", "stream"]:
                return stream_stage2_draft_events(self, parts[3])
            if len(parts) == 6 and parts[:4] == ["api", "agent", "drafts", parts[3]] and parts[4] == "approvals":
                return get_stage2_approval(self, parts[3], parts[5])
        if path == "/api/agent/tools":
            return write_json(self, HTTPStatus.OK, harness_tools.catalog(schema_set_revision=SCHEMA_SET_REVISION, backend_identity=harness_backend_identity()))
        if path == "/api/agent/operations":
            try:
                principal, _ = harness_principal(self)
                operations = [item for item in agent_harness_store.list_operations() if item.get("principal") == principal]
                return write_json(self, HTTPStatus.OK, {"operations": [harness_public_operation(item) for item in operations]})
            except HarnessContractError as error:
                return harness_error(self, error)
        if path == "/api/manifest":
            return write_json(self, HTTPStatus.OK, api_manifest())
        if path == "/api/health":
            identity = backend_identity()
            cli_available = TILESIM_CLI.is_file() and os.access(TILESIM_CLI, os.X_OK)
            return write_json(self, HTTPStatus.OK, {
                "cli_available": cli_available,
                "execution_ready": cli_available and identity["versions_match"],
                "tilesim_root_available": TILESIM_ROOT.is_dir(),
                "frontend_build_available": STATIC_ROOT != WEB_ROOT,
                "detail": "Bridge only permits allow-listed scenarios and structured arguments.",
                **identity,
            })
        if path == "/api/catalog":
            return write_json(self, HTTPStatus.OK, {
                "scenarios": [{"scenario_id": key, "label": value["label"]} for key, value in SCENARIOS.items()],
                "fidelity_policies": sorted(ALLOWED_FIDELITY_POLICIES),
                "input_modes": [option["input_mode"] for option in INPUT_MODES if option["available"]],
                "design_space_modes": [
                    option["design_space_mode"] for option in DESIGN_SPACE_MODES if option["available"]
                ],
                "gpu_participation_modes": sorted(ALLOWED_GPU_PARTICIPATION_MODES),
                "model_ids": simulation_model_ids(),
            })
        if path == "/api/capabilities":
            return write_json(self, HTTPStatus.OK, runtime_capabilities())
        if path == "/api/experiment-schema":
            return write_json(
                self,
                HTTPStatus.OK,
                build_experiment_descriptor(SCHEMA_SET_REVISION, runtime_capabilities()),
            )
        if path == "/api/trace-packages":
            return write_json(self, HTTPStatus.OK, trace_package_catalog())
        if path == "/api/agent/evidence-capabilities":
            return write_json(
                self,
                HTTPStatus.OK,
                evidence_agent.build_descriptor(
                    SCHEMA_SET_REVISION, evidence_agent_provider.capability()
                ),
            )
        if path == "/api/agent/assistant-model":
            try:
                scope = assistant_model_scope(self)
            except ValueError as error:
                return write_error(self, HTTPStatus.BAD_REQUEST, "invalid_assistant_model_session", str(error), field_path="/headers/X-TileSim-Assistant-Session", retryable=False)
            descriptor = assistant_model.build_descriptor(scope=scope)
            descriptor["schema_set_revision"] = SCHEMA_SET_REVISION
            return write_json(self, HTTPStatus.OK, descriptor)
        if path == "/api/agent/assistant-model-catalogue":
            return self.list_assistant_models()
        if path == "/api/agent/orchestration-capabilities":
            try:
                snapshot = agent_orchestration_capability_snapshot()
            except (RuntimeError, ValueError):
                return write_error(
                    self,
                    HTTPStatus.SERVICE_UNAVAILABLE,
                    "agent_orchestration_capability_snapshot_unavailable",
                    "The Agent orchestration capability snapshot release binding is unavailable.",
                    retryable=False,
                )
            return write_json(self, HTTPStatus.OK, snapshot)
        if path == "/api/week7/evidence-map":
            return self.run_week7_operation("evidence_map")
        parts = path.strip("/").split("/")
        if len(parts) == 4 and parts[:3] == ["api", "agent", "operations"]:
            operation = agent_harness_store.get_operation(parts[3])
            if operation is None:
                return harness_error(self, HarnessStoreError("operation_not_found", "Operation was not found."))
            try:
                principal, _ = harness_principal(self)
            except HarnessContractError as error:
                return harness_error(self, error)
            if operation.get("principal") != principal:
                return harness_error(self, HarnessContractError("operation_access_denied", "Operation is not owned by this principal.", "/operation_id", status=403))
            return write_json(self, HTTPStatus.OK, {"operation": harness_public_operation(operation), "events": agent_harness_store.list_events(parts[3])})
        if len(parts) == 5 and parts[:3] == ["api", "agent", "operations"] and parts[4] == "events":
            operation = agent_harness_store.get_operation(parts[3])
            if operation is None:
                return harness_error(self, HarnessStoreError("operation_not_found", "Operation was not found."))
            try:
                principal, _ = harness_principal(self)
            except HarnessContractError as error:
                return harness_error(self, error)
            if operation.get("principal") != principal:
                return harness_error(self, HarnessContractError("operation_access_denied", "Operation is not owned by this principal.", "/operation_id", status=403))
            raw_after = self.headers.get("Last-Event-ID")
            try:
                after = _strict_event_cursor(raw_after)
            except ValueError:
                return harness_error(self, HarnessContractError("invalid_last_event_id", "Last-Event-ID must be a sequence integer.", "/headers/Last-Event-ID"))
            all_events = agent_harness_store.list_events(parts[3])
            if after > 0 and not any(event["sequence"] == after for event in all_events):
                return harness_error(self, HarnessStoreError("event_not_found", "Last-Event-ID is not present in the durable event log."))
            events = agent_harness_store.list_events(parts[3], after_sequence=after)
            try:
                _assert_event_replay_contiguous(events, after)
            except ValueError:
                return harness_error(self, HarnessStoreError("event_sequence_gap", "Operation event sequence has a durable gap."))
            return write_json(
                self,
                HTTPStatus.OK,
                {
                    "operation": harness_public_operation(operation),
                    "events": events,
                    "after_sequence": after,
                    "terminal": operation.get("workflow_state") in GENERIC_HARNESS_OBSERVATION_BOUNDARY_STATES,
                },
            )
        if len(parts) == 6 and parts[:3] == ["api", "agent", "operations"] and parts[4:] == ["events", "stream"]:
            return self.stream_harness_events(parts[3])
        if len(parts) == 4 and parts[:3] == ["api", "agent", "checkpoints"]:
            checkpoint = agent_harness_store.get_checkpoint(parts[3])
            if checkpoint is None:
                return harness_error(self, HarnessStoreError("checkpoint_not_found", "Checkpoint was not found."))
            return write_json(self, HTTPStatus.OK, {"checkpoint": checkpoint})
        if len(parts) == 4 and parts[:3] == ["api", "agent", "approvals"]:
            approval = agent_harness_store.get_approval(parts[3])
            if approval is None:
                return harness_error(self, HarnessStoreError("approval_not_found", "Approval was not found."))
            return write_json(self, HTTPStatus.OK, {"approval": approval})
        if path == "/api/runs":
            return self.list_runs()
        if len(parts) == 3 and parts[:2] == ["api", "templates"]:
            scenario = SCENARIOS.get(parts[2])
            if scenario is None:
                return write_error(
                    self,
                    HTTPStatus.NOT_FOUND,
                    "template_not_found",
                    "Template scenario was not found.",
                    field_path="/scenario_id",
                    retryable=False,
                )
            return write_json(self, HTTPStatus.OK, {
                "scenario_id": parts[2],
                "runtime_trace": json.loads(scenario["trace"].read_text(encoding="utf-8")),
                "topology": json.loads(scenario["topology"].read_text(encoding="utf-8")),
            })
        if len(parts) == 3 and parts[:2] == ["api", "runs"]:
            return self.get_run(parts[2])
        if len(parts) == 4 and parts[:2] == ["api", "runs"] and parts[3] == "events":
            return self.get_run_events(parts[2])
        if len(parts) == 4 and parts[:2] == ["api", "runs"] and parts[3] == "reports":
            return self.get_reports(parts[2])
        if len(parts) == 4 and parts[:2] == ["api", "runs"] and parts[3] == "artifacts":
            return self.get_artifact_manifest(parts[2])
        if len(parts) == 5 and parts[:2] == ["api", "runs"] and parts[3] == "files":
            return self.get_json_artifact(parts[2], parts[4])
        if path == "/api" or path.startswith("/api/"):
            return write_error(
                self,
                HTTPStatus.NOT_FOUND,
                "unknown_endpoint",
                "Unknown API endpoint.",
                retryable=False,
            )
        if Path(path).suffix == "" and (STATIC_ROOT / "index.html").is_file():
            self.path = "/index.html"
        return super().do_GET()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        add_contract_headers(self)
        add_cors_headers(self)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, X-Request-ID, Idempotency-Key, Last-Event-ID, X-TileSim-Principal, X-TileSim-Workspace, X-TileSim-Scopes, X-TileSim-Assistant-Session",
        )
        self.send_header("Content-Length", "0")
        self.end_headers()

    def create_harness_operation(self) -> None:
        try:
            document = harness_json_body(self)
            unknown = sorted(set(document) - {"operation_kind", "idempotency_key", "run_id", "snapshot_digest", "principal", "turn_id"})
            if unknown:
                raise HarnessContractError("unknown_field", "Operation input is closed.", f"/{unknown[0]}")
            key = document.get("idempotency_key") or self.headers.get("Idempotency-Key", "").strip()
            if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z0-9._:-]{1,256}", key):
                raise HarnessContractError("missing_idempotency_key", "A stable Idempotency-Key is required.", "/idempotency_key")
            principal, scopes = harness_principal(self)
            requested_principal = document.get("principal", principal)
            if requested_principal != principal:
                raise HarnessContractError("principal_mismatch", "Operation principal does not match the local subject.", "/principal", status=403)
            run_id = document.get("run_id")
            if run_id is not None:
                if not isinstance(run_id, str) or not run_id:
                    raise HarnessContractError("invalid_field", "run_id must be a bounded string.", "/run_id")
                if _harness_run_status(run_id) is None:
                    raise HarnessContractError("run_not_found", "Bound run was not found.", "/run_id", status=404)
            operation, replay = agent_harness_store.create_operation(
                idempotency_key=key,
                request_payload={key: document[key] for key in ("operation_kind", "run_id", "snapshot_digest", "principal") if key in document},
                schema_set_revision=SCHEMA_SET_REVISION,
                backend_identity=harness_backend_identity(),
                run_id=run_id,
                snapshot_digest=document.get("snapshot_digest"),
                principal=principal,
                operation_kind=document.get("operation_kind", "read_only"),
                turn_id=document.get("turn_id"),
            )
            if not replay:
                harness_operation_event(operation["operation_id"], node="queue", state="queued")
                try:
                    ensure_harness_queue().submit(operation["operation_id"])
                except HarnessStoreError as error:
                    agent_harness_store.transition(operation["operation_id"], "failed", error={"code": error.code, "retryable": error.retryable}, expected={"queued"})
                    raise
            return write_json(self, HTTPStatus.OK if replay else HTTPStatus.ACCEPTED, {"operation": harness_public_operation(operation), "idempotent_replay": replay})
        except (HarnessContractError, HarnessStoreError) as error:
            return harness_error(self, error)

    def mutate_harness_operation(self, operation_id: str, action: str) -> None:
        try:
            principal, scopes = harness_principal(self)
            operation = agent_harness_store.get_operation(operation_id)
            if operation is None:
                raise HarnessStoreError("operation_not_found", "Operation was not found.")
            if operation.get("principal") != principal:
                raise HarnessContractError("operation_access_denied", "Operation is not owned by this principal.", "/operation_id", status=403)
            if action == "cancel":
                if operation.get("workflow_state") in {"completed", "failed", "cancelled"}:
                    raise HarnessStoreError("terminal_mutation", "Terminal operation cannot be cancelled.")
                updated = agent_harness_store.transition(operation_id, "cancelled", expected={"draft", "submitted", "queued", "running", "retrying", "waiting_tool", "waiting_approval", "recovery_required", "manual_intervention_required"}, cancellation_fence=f"fence-{uuid.uuid4().hex}")
                harness_operation_event(operation_id, node="cancel", state="cancelled", terminal=True)
            elif action == "resume":
                if operation.get("workflow_state") != "recovery_required":
                    raise HarnessStoreError("duplicate_resume", "Only recovery_required operations may be resumed.")
                updated = agent_harness_store.transition(operation_id, "queued", expected={"recovery_required"})
                harness_operation_event(operation_id, node="resume", state="queued")
            else:
                if operation.get("workflow_state") not in {"failed", "recovery_required"}:
                    raise HarnessStoreError("retry_not_allowed", "Retry requires a recoverable failure.")
                if operation.get("last_error", {}).get("unknown_outcome"):
                    raise HarnessStoreError("unknown_side_effect", "Unknown outcome cannot be blindly retried.", unknown_outcome=True)
                updated = agent_harness_store.transition(operation_id, "retrying", expected={"failed", "recovery_required"})
                harness_operation_event(operation_id, node="retry", state="retrying")
            return write_json(self, HTTPStatus.OK, {"operation": harness_public_operation(updated), "action": action})
        except (HarnessContractError, HarnessStoreError) as error:
            return harness_error(self, error)

    def save_harness_checkpoint(self, operation_id: str) -> None:
        try:
            document = harness_json_body(self)
            unknown = sorted(set(document) - {"checkpoint_id", "state_digest", "last_event_sequence", "side_effect_digests", "resume_policy"})
            if unknown:
                raise HarnessContractError("unknown_field", "Checkpoint input is closed.", f"/{unknown[0]}")
            operation = agent_harness_store.get_operation(operation_id)
            if operation is None:
                raise HarnessStoreError("operation_not_found", "Operation was not found.")
            checkpoint = agent_harness_store.save_checkpoint(
                operation_id,
                checkpoint_id=document.get("checkpoint_id") or f"cp-{uuid.uuid4().hex}",
                state_digest=document.get("state_digest") if isinstance(document.get("state_digest"), str) else "",
                last_event_sequence=document.get("last_event_sequence") if isinstance(document.get("last_event_sequence"), int) else -1,
                side_effect_digests=document.get("side_effect_digests") if isinstance(document.get("side_effect_digests"), list) else [],
                resume_policy=document.get("resume_policy") if isinstance(document.get("resume_policy"), dict) else {},
                schema_set_revision=SCHEMA_SET_REVISION,
                backend_identity=harness_backend_identity(),
            )
            return write_json(self, HTTPStatus.OK, {"checkpoint": checkpoint})
        except (HarnessContractError, HarnessStoreError) as error:
            return harness_error(self, error)

    def save_harness_approval(self) -> None:
        try:
            document = harness_json_body(self)
            allowed = {"operation_id", "approval_digest", "draft_digest", "principal", "approved_at", "expires_at", "decision"}
            unknown = sorted(set(document) - allowed)
            if unknown:
                raise HarnessContractError("unknown_field", "Approval input is closed.", f"/{unknown[0]}")
            principal, _ = harness_principal(self)
            if document.get("principal", principal) != principal:
                raise HarnessContractError("principal_mismatch", "Approval principal does not match the local subject.", "/principal", status=403)
            operation_id = document.get("operation_id")
            operation = agent_harness_store.get_operation(operation_id) if isinstance(operation_id, str) else None
            if operation is None:
                raise HarnessStoreError("operation_not_found", "Operation was not found.")
            required = ("approval_digest", "draft_digest", "expires_at", "decision")
            for key in required:
                if not isinstance(document.get(key), str) or not document[key]:
                    raise HarnessContractError("missing_field", "Approval field is required.", f"/{key}")
            if document["decision"] not in {"approved", "rejected", "expired"}:
                raise HarnessContractError("invalid_approval", "Approval decision is not supported.", "/decision")
            approval = agent_harness_store.save_approval(operation_id=operation_id, approval_digest=document["approval_digest"], draft_digest=document["draft_digest"], principal=principal, approved_at=document.get("approved_at"), expires_at=document["expires_at"], decision=document["decision"], schema_set_revision=SCHEMA_SET_REVISION, backend_identity=harness_backend_identity())
            return write_json(self, HTTPStatus.OK, {"approval": approval})
        except (HarnessContractError, HarnessStoreError) as error:
            return harness_error(self, error)

    def stream_harness_events(self, operation_id: str) -> None:
        operation = agent_harness_store.get_operation(operation_id)
        if operation is None:
            return harness_error(self, HarnessStoreError("operation_not_found", "Operation was not found."))
        try:
            principal, _ = harness_principal(self)
        except HarnessContractError as error:
            return harness_error(self, error)
        if operation.get("principal") != principal:
            return harness_error(self, HarnessContractError("operation_access_denied", "Operation is not owned by this principal.", "/operation_id", status=403))
        raw_last = self.headers.get("Last-Event-ID")
        try:
            after = _strict_event_cursor(raw_last)
        except ValueError:
            return harness_error(self, HarnessContractError("invalid_last_event_id", "Last-Event-ID must be a sequence integer for SSE recovery.", "/headers/Last-Event-ID"))
        all_events = agent_harness_store.list_events(operation_id)
        if after > 0 and not any(event["sequence"] == after for event in all_events):
            return harness_error(self, HarnessStoreError("event_not_found", "Last-Event-ID is not present in the durable event log."))
        events = agent_harness_store.list_events(operation_id, after_sequence=after)
        try:
            _assert_event_replay_contiguous(events, after)
        except ValueError:
            return harness_error(self, HarnessStoreError("event_sequence_gap", "Operation event sequence has a durable gap."))
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        add_contract_headers(self)
        add_cors_headers(self)
        self.end_headers()
        try:
            for event in events:
                responses.write_sse_event(self, event="workflow", event_id=str(event["sequence"]), data=event)
            if operation.get("workflow_state") in GENERIC_HARNESS_OBSERVATION_BOUNDARY_STATES:
                responses.write_sse_event(self, event="terminal", data={"operation_id": operation_id, "state": operation["workflow_state"]})
        except (BrokenPipeError, ConnectionResetError, OSError):
            return

    def call_harness_tool(self) -> None:
        try:
            document = harness_json_body(self)
            unknown = sorted(set(document) - {"operation_id", "tool_name", "input", "principal", "scope"})
            if unknown:
                raise HarnessContractError("unknown_field", "Tool call input is closed.", f"/{unknown[0]}")
            operation_id = document.get("operation_id")
            if not isinstance(operation_id, str):
                raise HarnessContractError("invalid_field", "operation_id is required.", "/operation_id")
            operation = agent_harness_store.get_operation(operation_id)
            if operation is None:
                raise HarnessStoreError("operation_not_found", "Operation was not found.")
            principal, scopes = harness_principal(self)
            if operation.get("principal") != principal:
                raise HarnessContractError("operation_access_denied", "Operation is not owned by this principal.", "/operation_id", status=403)
            result = _harness_dispatch(operation_id, document.get("tool_name"), document.get("input", {}), principal, scopes)
            updated = agent_harness_store.transition(operation_id, "completed", expected={"queued", "running", "waiting_tool"})
            harness_operation_event(operation_id, node="tool", state="completed", terminal=True, payload={"tool_call_id": result.get("tool_call_id"), "output_digest": result.get("output_digest")})
            return write_json(self, HTTPStatus.OK, {"operation": harness_public_operation(updated), "tool_result": result})
        except (HarnessContractError, HarnessStoreError, harness_tools.ToolGatewayError) as error:
            return harness_error(self, error)

    def do_DELETE(self) -> None:
        path = urlparse(self.path).path
        parts = path.strip("/").split("/")
        if len(parts) == 4 and parts[:3] == ["api", "agent", "drafts"]:
            try:
                principal, workspace_id = _stage2_scope(self, "agent:write_draft")
                draft = agent_harness_store.get_stage2_draft(parts[3])
                if draft is None:
                    raise HarnessStoreError("draft_not_found", "Draft was not found.")
                if draft["principal"] != principal or draft["workspace_id"] != workspace_id:
                    raise HarnessContractError("draft_access_denied", "Draft is not owned by this principal and workspace.", "/draft_id", status=403)
                key = self.headers.get("Idempotency-Key", "").strip()
                if not re.fullmatch(r"[A-Za-z0-9._:-]{1,256}", key):
                    raise HarnessContractError("missing_idempotency_key", "Idempotency-Key is required for draft deletion.", "/headers/Idempotency-Key")
                _, replay = agent_harness_store.create_operation(idempotency_key=f"stage2-delete:{key}", request_payload={"draft_id": parts[3], "action": "delete"}, schema_set_revision=SCHEMA_SET_REVISION, backend_identity=harness_backend_identity(), principal=principal, operation_kind="draft_delete")
                if replay:
                    return write_json(self, HTTPStatus.OK, {"draft_id": parts[3], "deleted": True, "would_create_run": False, "idempotent_replay": True})
                deleted = agent_harness_store.delete_stage2_draft(parts[3])
                if not deleted:
                    raise HarnessStoreError("draft_not_found", "Draft was not found.")
                harness_operation_event(draft["operation_id"], node="draft", state="cancelled", terminal=True, payload={"deleted": True}, draft_id=parts[3])
                return write_json(self, HTTPStatus.OK, {"draft_id": parts[3], "deleted": True, "would_create_run": False})
            except (HarnessContractError, HarnessStoreError) as error:
                return harness_error(self, error)
        if len(parts) == 4 and parts[:3] == ["api", "agent", "operations"]:
            try:
                # This is the user-erasure route.  Keep it on the coordinator
                # so it resolves every associated store and calls the
                # harness' permanent graph purge; ``delete_operation`` is the
                # legacy retention/tombstone wrapper and must never be used
                # for this endpoint.
                principal, scopes = harness_principal(self)
                if "agent:read_run" not in scopes and "agent:write_draft" not in scopes:
                    raise HarnessContractError("scope_denied", "Operation deletion is not in the caller scope.", status=403)
                workspace_id = harness_workspace(self)
                operation = agent_harness_store.get_operation(parts[3])
                if operation is None:
                    return write_json(self, HTTPStatus.OK, {"operation_id": parts[3], "deleted": True, "status": "not_found"})
                if operation.get("principal") != principal:
                    raise HarnessContractError("operation_access_denied", "Operation is not owned by this principal.", "/operation_id", status=403)
                key = self.headers.get("Idempotency-Key", "").strip() or f"operation-delete:{parts[3]}"
                # Resolve the complete Agent-owned graph before deleting any
                # store.  Passing only the harness id here used to bypass the
                # coordinator's preflight and made the route's permanent
                # erasure semantics depend on whichever store happened to be
                # named by the caller.  The resolver returns exact IDs (or an
                # explicit not-applicable result) and refuses a partial
                # association lookup, so retries cannot silently leave a
                # child flow/batch/optimization record behind.
                result = agent_deletion_coordinator.delete_resource(
                    resource_id=parts[3],
                    idempotency_key=key,
                    principal=principal,
                    # The published v1 operation identity predates the
                    # workspace field.  Keep principal as the mandatory
                    # owner fence for those legacy roots; a successor record
                    # may opt into workspace binding and will be checked by
                    # the coordinator when present.
                    workspace_id=(
                        operation.get("workspace_id")
                        if isinstance(operation.get("workspace_id"), str)
                        else None
                    ),
                )
                if result.get("status") == "deletion_incomplete":
                    return write_json(self, HTTPStatus.CONFLICT, {"operation_id": parts[3], "deleted": False, **result})
                return write_json(self, HTTPStatus.OK, {"operation_id": parts[3], "deleted": result.get("status") == "deleted", **result})
            except (HarnessContractError, HarnessStoreError) as error:
                return harness_error(self, error)
        if len(parts) == 3 and parts[:2] == ["api", "runs"]:
            return self.delete_run(parts[2])
        return write_error(
            self,
            HTTPStatus.NOT_FOUND,
            "unknown_endpoint",
            "Unknown API endpoint.",
            retryable=False,
        )

    def do_POST(self) -> None:
        _remember_bridge_server(self)
        path = urlparse(self.path).path
        parts = path.strip("/").split("/")
        if path == "/api/agent/flows":
            return create_agent_flow(self)
        if len(parts) == 5 and parts[:4] == ["api", "agent", "flows", parts[3]] and parts[4] == "resume":
            return resume_agent_flow(self, parts[3])
        if len(parts) == 6 and parts[:4] == ["api", "agent", "flows", parts[3]] and parts[4:] == ["authorization", "revoke"]:
            return revoke_agent_flow_authorization(self, parts[3])
        if path == "/api/agent/optimization/sessions":
            return create_optimization_session(self)
        if path == "/api/agent/batches":
            return create_batch(self)
        if len(parts) == 5 and parts[:4] == ["api", "agent", "batches", parts[3]] and parts[4] == "approve":
            return batch_approve(self, parts[3])
        if len(parts) == 5 and parts[:4] == ["api", "agent", "batches", parts[3]] and parts[4] in {"start", "pause", "resume", "cancel", "retry"}:
            return batch_action(self, parts[3], parts[4])
        if len(parts) == 8 and parts[:4] == ["api", "agent", "optimization", "sessions"] and parts[5] == "candidates" and parts[7] == "approve":
            return approve_optimization_candidate(self, parts[4], parts[6])
        if len(parts) == 6 and parts[:4] == ["api", "agent", "optimization", "sessions"] and parts[5] == "authorization":
            return create_optimization_authorization(self, parts[4])
        if len(parts) == 7 and parts[:4] == ["api", "agent", "optimization", "sessions"] and parts[5:] == ["authorization", "revoke"]:
            return revoke_optimization_authorization(self, parts[4])
        if len(parts) == 6 and parts[:4] == ["api", "agent", "optimization", "sessions"] and parts[5] in {"pause", "resume", "cancel", "retry"}:
            return optimization_action(self, parts[4], parts[5])
        if path == "/api/agent/executions":
            return create_stage3_execution(self)
        if len(parts) == 5 and parts[:3] == ["api", "agent", "executions"] and parts[4] in {"cancel", "retry", "resume"}:
            return mutate_stage3_execution(self, parts[3], parts[4])
        if path == "/api/agent/drafts":
            return create_stage2_draft(self)
        if len(parts) == 5 and parts[:4] == ["api", "agent", "drafts", parts[3]] and parts[4] == "validate":
            return validate_stage2_draft(self, parts[3])
        if len(parts) == 5 and parts[:4] == ["api", "agent", "drafts", parts[3]] and parts[4] == "approvals":
            return create_stage2_approval(self, parts[3])
        if len(parts) == 7 and parts[:4] == ["api", "agent", "drafts", parts[3]] and parts[4] == "approvals" and parts[6] in {"reject", "revoke"}:
            return mutate_stage2_approval(self, parts[3], parts[5], parts[6])
        if path == "/api/agent/operations":
            return self.create_harness_operation()
        if path == "/api/agent/approvals":
            return self.save_harness_approval()
        if len(parts) == 5 and parts[:3] == ["api", "agent", "operations"] and parts[4] in {"cancel", "resume", "retry"}:
            return self.mutate_harness_operation(parts[3], parts[4])
        if len(parts) == 5 and parts[:3] == ["api", "agent", "operations"] and parts[4] == "checkpoint":
            return self.save_harness_checkpoint(parts[3])
        if path == "/api/agent/tools/call":
            return self.call_harness_tool()
        if path == "/api/agent/scenario-plan":
            return self.plan_agent_scenario()
        if path == "/api/agent/intent":
            return self.classify_agent_intent()
        if path == "/api/agent/scenario-chat":
            return self.stream_agent_scenario_chat()
        if path == "/api/agent/result-analysis":
            return self.stream_agent_result_analysis()
        if path == "/api/agent/assistant-model-selection":
            return self.select_agent_assistant_model()
        if path == "/api/agent/run-intake-preview":
            return self.preview_agent_run_intake()
        if path == "/api/week7/calibration-example":
            return self.run_week7_operation("calibration_example")
        if path == "/api/week7/orchestration-example":
            return self.run_week7_operation("orchestration_example")
        if len(parts) == 4 and parts[:2] == ["api", "runs"] and parts[3] == "name":
            return self.rename_run(parts[2])
        if (
            len(parts) == 5
            and parts[:2] == ["api", "runs"]
            and parts[3:] == ["agent", "evidence-analyses"]
        ):
            return self.create_evidence_analysis(parts[2])
        if len(parts) == 4 and parts[:2] == ["api", "trace-packages"] and parts[3] == "inspect":
            package_id = unquote(parts[2])
            try:
                _, inspected = inspect_trace_package(package_id)
            except trace_packages.TracePackageError as error:
                return write_error(
                    self,
                    trace_package_error_status(error),
                    error.code,
                    str(error),
                    field_path="/trace_package_id",
                    retryable=error.retryable,
                )
            return write_json(
                self,
                HTTPStatus.OK,
                trace_packages.inspect_response(
                    inspected,
                    schema_set_revision=SCHEMA_SET_REVISION,
                    backend_identity=backend_identity(),
                ),
            )
        if path != "/api/runs":
            return write_error(
                self,
                HTTPStatus.NOT_FOUND,
                "unknown_endpoint",
                "Unknown API endpoint.",
                retryable=False,
            )

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_REQUEST_BYTES:
                raise RequestValidationError("Request body must be between 1 byte and 2.1 MB.", "/")
            request = json.loads(self.rfile.read(length), parse_constant=reject_nonfinite_json)
            if not isinstance(request, dict):
                raise RequestValidationError("Request body must be a JSON object.", "/")
            idempotency_key = idempotency_key_for(self)
            payload_digest = request_payload_digest(request)
        except (ValueError, json.JSONDecodeError) as error:
            validation = request_validation_error(error)
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_run_request",
                str(validation),
                field_path=validation.field_path,
                retryable=False,
            )

        with runs_lock:
            existing = idempotent_run(idempotency_key)
            replay_digest = existing.get("request_payload_sha256") if existing is not None else None
            replay_response = (
                creation_response(existing, idempotent_replay=True) if existing is not None else None
            )
        if replay_response is not None:
            if replay_digest != payload_digest:
                return write_error(
                    self,
                    HTTPStatus.CONFLICT,
                    "idempotency_payload_mismatch",
                    "Idempotency-Key was already used with a different request payload.",
                    field_path="/headers/Idempotency-Key",
                    retryable=False,
                )
            return write_json(self, HTTPStatus.OK, replay_response)

        try:
            capabilities = runtime_capabilities()
            command = validate_run_request(
                request,
                scenario_ids=set(SCENARIOS),
                fidelity_policies=ALLOWED_FIDELITY_POLICIES,
                gpu_participation_modes=ALLOWED_GPU_PARTICIPATION_MODES,
                capabilities=capabilities,
            )
            scenario_id = command.scenario_id
            fidelity_policy = command.fidelity_policy
            gpu_participation_mode = command.gpu_participation_mode
            run_name = command.run_name
            overrides = command.overrides
            custom_inputs = command.custom_inputs
            design_space_candidates = command.design_space_candidates
            design_space_candidate_schema_identity = (
                command.design_space_candidate_schema_identity
            )
            trace_package_id = command.trace_package_id
        except (ValueError, json.JSONDecodeError) as error:
            validation = request_validation_error(error)
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_run_request",
                str(validation),
                field_path=validation.field_path,
                retryable=False,
                nested_schema_identity=validation.nested_schema_identity,
            )

        if not (TILESIM_CLI.is_file() and os.access(TILESIM_CLI, os.X_OK)):
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "cli_unavailable",
                "TileSimCLI is not available to the bridge.",
            )
        identity = backend_identity()
        if not identity["versions_match"]:
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "backend_identity_mismatch",
                "Backend source and TileSimCLI build revisions do not match; run scripts/update-backend.ps1.",
            )

        trace_package_candidate = None
        trace_package_inspection = None
        if trace_package_id is not None:
            try:
                trace_package_candidate, trace_package_inspection = inspect_trace_package(
                    trace_package_id
                )
            except trace_packages.TracePackageError as error:
                return write_error(
                    self,
                    trace_package_error_status(error),
                    error.code,
                    str(error),
                    field_path="/trace_package_id",
                    retryable=error.retryable,
                )
            if trace_package_inspection["trace_provenance"].get("source_mode") != "synthetic_trace":
                return write_error(
                    self,
                    HTTPStatus.BAD_REQUEST,
                    "trace_package_source_mode_unavailable",
                    "The prototype only permits synthetic_trace Trace packages.",
                    field_path="/trace_package_id",
                    retryable=False,
                )

        with runs_lock:
            existing = idempotent_run(idempotency_key)
            if existing is not None:
                replay_digest = existing.get("request_payload_sha256")
                replay_response = creation_response(existing, idempotent_replay=True)
                reservation_error = None
                capacity_reached = False
            else:
                replay_digest = None
                replay_response = None
                active_run_count = sum(
                    run.get("status") in {"preparing", "running"}
                    for run in runs.values()
                )
                capacity_reached = active_run_count >= MAX_ACTIVE_RUNS
                if capacity_reached:
                    reservation_error = None
                else:
                    run_id = f"run-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}"
                    run_dir = RUNS_ROOT / run_id
                    input_mode = (
                        "trace_package"
                        if trace_package_id is not None
                        else "json"
                        if custom_inputs is not None
                        else "controls"
                    )
                    input_files = {"topology": "input-topology.json"}
                    if trace_package_id is None:
                        input_files["runtime_trace"] = "input-runtime-trace.json"
                    metadata = {
                        "run_id": run_id,
                        "status": "preparing",
                        "created_at": now(),
                        "scenario_id": scenario_id,
                        "run_name": run_name,
                        "fidelity_policy": fidelity_policy,
                        "gpu_participation_mode": gpu_participation_mode,
                        "input_mode": input_mode,
                        "overrides": overrides,
                        "input_files": input_files,
                        "design_space_mode": (
                            "not_applicable_trace_package"
                            if trace_package_id is not None
                            else "external_manifest"
                            if design_space_candidates is not None
                            else "built_in_synthetic"
                        ),
                        "design_space_candidate_schema_identity": (
                            design_space_candidate_schema_identity
                        ),
                        "idempotency_key": idempotency_key,
                        "request_payload_sha256": payload_digest,
                        "bridge_instance_id": BRIDGE_INSTANCE_ID,
                        "bridge_pid": os.getpid(),
                        "principal": self.headers.get("X-TileSim-Principal", "local-user"),
                        "workspace_id": self.headers.get("X-TileSim-Workspace", "local-workspace"),
                    }
                    if trace_package_inspection is not None:
                        metadata["trace_package"] = {
                            "package_id": trace_package_inspection["package_id"],
                            "manifest_sha256": trace_package_inspection["manifest_sha256"],
                            "entry_boundary": trace_package_inspection["entry_boundary"],
                            "entry_trace_kind": trace_package_inspection["entry_trace_kind"],
                            "trace_provenance": trace_package_inspection["trace_provenance"],
                        }
                    if design_space_candidates is not None:
                        metadata["input_files"]["design_space_candidates"] = "input-design-space-candidates.json"
                    try:
                        run_dir.mkdir(parents=True, exist_ok=False)
                        atomic_write_json(run_dir / "run-metadata.json", metadata)
                    except OSError as error:
                        reservation_error = error
                    else:
                        reservation_error = None
                        runs[run_id] = metadata.copy()

        if replay_response is not None:
            if replay_digest != payload_digest:
                return write_error(
                    self,
                    HTTPStatus.CONFLICT,
                    "idempotency_payload_mismatch",
                    "Idempotency-Key was already used with a different request payload.",
                    field_path="/headers/Idempotency-Key",
                    retryable=False,
                )
            return write_json(self, HTTPStatus.OK, replay_response)

        if capacity_reached:
            return write_error(
                self,
                HTTPStatus.TOO_MANY_REQUESTS,
                "run_capacity_reached",
                f"The local bridge already has {MAX_ACTIVE_RUNS} active run(s). Wait for completion and retry.",
                retryable=True,
            )

        if reservation_error is not None:
            return write_error(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                "idempotency_reservation_failed",
                f"Could not reserve durable run metadata: {reservation_error}",
                retryable=True,
            )

        try:
            if trace_package_candidate is not None and trace_package_inspection is not None:
                resolved_scenario = materialize_trace_package_inputs(
                    run_dir,
                    SCENARIOS[scenario_id],
                    manifest_path=trace_package_candidate.manifest_path,
                    manifest_sha256=trace_package_inspection["manifest_sha256"],
                    source_mode=trace_package_inspection["trace_provenance"]["source_mode"],
                    entry_boundary=trace_package_inspection["entry_boundary"],
                    entry_trace_kind=trace_package_inspection["entry_trace_kind"],
                )
            elif custom_inputs is not None:
                resolved_scenario = materialize_custom_inputs(
                    run_dir, SCENARIOS[scenario_id], custom_inputs
                )
            else:
                resolved_scenario = materialize_inputs(
                    run_dir, SCENARIOS[scenario_id], overrides
                )
            resolved_scenario["design_space_candidates"] = materialize_design_space_candidates(
                run_dir,
                design_space_candidates,
            )
            metadata["status"] = "running"
            atomic_write_json(run_dir / "run-metadata.json", metadata)
        except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            metadata["status"] = "failed"
            metadata["finished_at"] = now()
            metadata["error"] = f"Could not prepare run inputs: {error}"
            try:
                atomic_write_json(run_dir / "run-metadata.json", metadata)
            except OSError:
                pass
            with runs_lock:
                runs[run_id] = metadata.copy()
            return write_json(
                self,
                HTTPStatus.ACCEPTED,
                creation_response(metadata, idempotent_replay=False),
            )

        with runs_lock:
            runs[run_id] = metadata.copy()

        start_run_execution(run_id, resolved_scenario, fidelity_policy)
        return write_json(
            self,
            HTTPStatus.ACCEPTED,
            creation_response(metadata, idempotent_replay=False),
        )

    def plan_agent_scenario(self) -> None:
        """Ask the configured assistant model for one scenario plan.

        The reply is a proposal only: this endpoint writes no document and creates no run.  Every proposed
        parameter is validated against the published parameter catalogue before it is returned, and a hidden
        reasoning trace inside the provider reply is dropped by the provider adapter instead of being
        returned or retained.
        """
        # Model calls must carry an explicit browser/session binding.  The
        # legacy process-wide selection scope is retained only for direct
        # Python compatibility; HTTP model routes fail closed when a
        # caller omits the binding so one tab cannot inherit another
        # user's selected model.
        try:
            scope = assistant_model_scope(self, required=True)
        except ValueError as error:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_assistant_model_session",
                str(error),
                field_path="/headers/X-TileSim-Assistant-Session",
                retryable=False,
            )
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_REQUEST_BYTES:
                raise ValueError("Request body must be between 1 byte and 2.1 MB.")
            request = json.loads(self.rfile.read(length), parse_constant=reject_nonfinite_json)
            if not isinstance(request, dict):
                raise ValueError("Request body must be a JSON object.")
            instruction = assistant_model.validate_instruction(request.get("instruction"))
        except (ValueError, json.JSONDecodeError) as error:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_assistant_instruction",
                str(error),
                field_path="/instruction",
                retryable=False,
            )
        try:
            plan = assistant_model.plan(instruction, scope=scope)
        except ProviderTimeoutError:
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "assistant_model_timeout",
                "The assistant model channel did not answer within its configured timeout.",
                retryable=True,
            )
        except ProviderError:
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "assistant_model_unavailable",
                "The assistant model channel is unavailable.",
                retryable=True,
            )
        plan["schema_set_revision"] = SCHEMA_SET_REVISION
        return write_json(self, HTTPStatus.OK, plan)

    def classify_agent_intent(self) -> None:
        """Return a model proposal constrained to the caller's published page catalog."""
        raw_scope = self.headers.get(assistant_model.SELECTION_SCOPE_HEADER, "").strip()
        try:
            scope = assistant_model_scope(self, required=True)
        except ValueError as error:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_assistant_model_session",
                str(error),
                field_path="/headers/X-TileSim-Assistant-Session",
                retryable=False,
            )
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_REQUEST_BYTES:
                raise ValueError("Request body is outside the supported size limit.")
            request = json.loads(self.rfile.read(length), parse_constant=reject_nonfinite_json)
            if not isinstance(request, dict):
                raise ValueError("Request body must be a JSON object.")
            required = {"schema_identity", "contract_revision", "session_id", "user_goal", "current_page", "page_catalog", "run_id", "run_context_revision", "backend_identity", "schema_set_revision", "input_snapshot_digest"}
            if set(request) != required or request.get("schema_identity") != agent_intent.REQUEST_SCHEMA_IDENTITY or request.get("contract_revision") != agent_intent.CONTRACT_REVISION:
                raise ValueError("Intent request does not match the published contract.")
            if request.get("session_id") != raw_scope:
                raise ValueError("Intent request session_id must match the assistant session scope.")
            if not isinstance(request["user_goal"], str) or not request["user_goal"].strip() or len(request["user_goal"]) > 20_000:
                raise ValueError("Intent goal is invalid.")
            # Intent classification is bound to this Bridge instance, not to
            # an arbitrary identity object supplied by a browser or model.
            # A stale backend must fail before any Provider call or response
            # mirroring can occur.
            current_backend_identity = harness_backend_identity()
            agent_intent.validate_request(request, SCHEMA_SET_REVISION, current_backend_identity)
        except (ValueError, json.JSONDecodeError, ProviderStructuredOutputError):
            return write_error(self, HTTPStatus.BAD_REQUEST, "invalid_agent_intent_request", "The intent request is invalid.", retryable=False)
        try:
            result = agent_intent.classify(
                request,
                SCHEMA_SET_REVISION,
                expected_backend_identity=current_backend_identity,
                scope=scope,
            )
        except ProviderTimeoutError:
            return write_error(self, HTTPStatus.SERVICE_UNAVAILABLE, "agent_intent_provider_timeout", "The intent model is unavailable.", retryable=True)
        except ProviderError:
            return write_error(self, HTTPStatus.SERVICE_UNAVAILABLE, "agent_intent_provider_unavailable", "The intent model is unavailable.", retryable=True)
        return write_json(self, HTTPStatus.OK, result)

    def stream_agent_scenario_chat(self) -> None:
        """Answer one conversation turn as a server-sent event stream.

        The client replays the transcript it already shows, the model answers, and every visible answer
        delta is forwarded as it arrives so the panel can render the answer while it is being written.
        The stream ends with one validated plan event; nothing here writes a document or creates a run.

        A request that cannot be validated, and a Bridge with no channel configured, are refused with an
        ordinary JSON response *before* the stream starts, so a client can fall back to its local rules
        without having to parse a half-open stream.
        """
        try:
            scope = assistant_model_scope(self, required=True)
        except ValueError as error:
            return write_error(self, HTTPStatus.BAD_REQUEST, "invalid_assistant_model_session", str(error), field_path="/headers/X-TileSim-Assistant-Session", retryable=False)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_REQUEST_BYTES:
                raise ValueError("Request body must be between 1 byte and 2.1 MB.")
            request = json.loads(self.rfile.read(length), parse_constant=reject_nonfinite_json)
            if not isinstance(request, dict):
                raise ValueError("Request body must be a JSON object.")
        except (ValueError, json.JSONDecodeError) as error:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_assistant_conversation",
                str(error),
                field_path="/messages",
                retryable=False,
            )
        # The transcript and the panel values are validated one at a time so the reported field path
        # names the field that actually failed, which is what a client uses to point at its own input.
        try:
            conversation = assistant_model.validate_conversation(request.get("messages"))
        except ValueError as error:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_assistant_conversation",
                str(error),
                field_path="/messages",
                retryable=False,
            )
        try:
            panel_values = assistant_model.validate_panel_values(request.get("panel_values"))
        except ValueError as error:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_assistant_conversation",
                str(error),
                field_path="/panel_values",
                retryable=False,
            )
        try:
            # Capture one immutable config before opening the SSE response.  The stream must not
            # re-read a mutable session selection after another tab switches its model.
            config = assistant_model.require_channel(scope)
        except ProviderTimeoutError:
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "assistant_model_timeout",
                "The assistant model channel did not answer within its configured timeout.",
                retryable=True,
            )
        except ProviderError:
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "assistant_model_unavailable",
                "The assistant model channel is unavailable.",
                retryable=True,
            )

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        add_contract_headers(self)
        add_cors_headers(self)
        self.end_headers()

        try:
            truncated = False
            for event, data in assistant_model.stream_events(conversation, panel_values, config=config):
                if event == "plan":
                    # Stamped here for the same reason the one-shot route stamps it: a plan is a
                    # contract-bound payload, and a client has to be able to tell which published
                    # contract set judged the values it is being offered.
                    data = {**data, "schema_set_revision": SCHEMA_SET_REVISION}
                if event == "truncated":
                    truncated = True
                write_sse_event(self, event=event, data=data)
            if not truncated:
                write_sse_event(
                    self,
                    event="done",
                    data={"schema_version": assistant_model.CHAT_SCHEMA_VERSION},
                )
        except ProviderTimeoutError:
            write_sse_event(
                self,
                event="error",
                data={
                    "schema_version": assistant_model.CHAT_SCHEMA_VERSION,
                    "code": "assistant_model_timeout",
                    "message": "模型没有在限定时间内答完。",
                    "retryable": True,
                },
            )
        except ProviderError:
            write_sse_event(
                self,
                event="error",
                data={
                    "schema_version": assistant_model.CHAT_SCHEMA_VERSION,
                    "code": "assistant_model_unavailable",
                    "message": "模型通道暂时不可用。",
                    "retryable": True,
                },
            )
        except (BrokenPipeError, ConnectionResetError, OSError):
            return

    def stream_agent_result_analysis(self) -> None:
        """Stream a read-only answer grounded in the current run's report projection."""

        try:
            scope = assistant_model_scope(self, required=True)
        except ValueError as error:
            return write_error(self, HTTPStatus.BAD_REQUEST, "invalid_assistant_model_session", str(error), field_path="/headers/X-TileSim-Assistant-Session", retryable=False)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_REQUEST_BYTES:
                raise ValueError("Request body must be between 1 byte and 2.1 MB.")
            request = json.loads(self.rfile.read(length), parse_constant=reject_nonfinite_json)
            if not isinstance(request, dict):
                raise ValueError("Request body must be a JSON object.")
        except (ValueError, json.JSONDecodeError) as error:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_result_analysis_request",
                str(error),
                field_path="/messages",
                retryable=False,
            )
        try:
            conversation = assistant_model.validate_conversation(request.get("messages"))
        except ValueError as error:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_result_analysis_request",
                str(error),
                field_path="/messages",
                retryable=False,
            )
        try:
            context = assistant_model.validate_result_analysis_context(request.get("context"))
        except ValueError as error:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_result_analysis_request",
                str(error),
                field_path="/context",
                retryable=False,
            )
        try:
            config = assistant_model.require_channel(scope)
        except ProviderTimeoutError:
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "assistant_model_timeout",
                "The assistant model channel did not answer within its configured timeout.",
                retryable=True,
            )
        except ProviderError:
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "assistant_model_unavailable",
                "The assistant model channel is unavailable.",
                retryable=True,
            )

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        add_contract_headers(self)
        add_cors_headers(self)
        self.end_headers()

        try:
            truncated = False
            for event, data in assistant_model.stream_result_analysis_events(conversation, context, config=config):
                if event == "truncated":
                    truncated = True
                write_sse_event(self, event=event, data=data)
            if not truncated:
                write_sse_event(
                    self,
                    event="done",
                    data={"schema_version": assistant_model.RESULT_ANALYSIS_CHAT_SCHEMA_VERSION},
                )
        except ProviderTimeoutError:
            write_sse_event(
                self,
                event="error",
                data={
                    "schema_version": assistant_model.RESULT_ANALYSIS_CHAT_SCHEMA_VERSION,
                    "code": "assistant_model_timeout",
                    "message": "模型没有在限定时间内答完。",
                    "retryable": True,
                },
            )
        except ProviderError:
            write_sse_event(
                self,
                event="error",
                data={
                    "schema_version": assistant_model.RESULT_ANALYSIS_CHAT_SCHEMA_VERSION,
                    "code": "assistant_model_unavailable",
                    "message": "模型通道暂时不可用。",
                    "retryable": True,
                },
            )
        except (BrokenPipeError, ConnectionResetError, OSError):
            return

    def list_assistant_models(self) -> None:
        """Read the model identities the configured assistant service publishes.

        Read-only, and the read is made with the credential this process already holds, so the key
        never leaves the backend and never reaches a browser.  The route is optional like the rest of
        the channel: a Bridge with no channel configured, or one whose service refuses the read,
        answers with an error, and a client that does not trust the reply simply keeps the identity it
        already had.
        """
        try:
            scope = assistant_model_scope(self, required=True)
            catalogue = assistant_model.build_catalogue(scope=scope)
        except ValueError as error:
            return write_error(self, HTTPStatus.BAD_REQUEST, "invalid_assistant_model_session", str(error), field_path="/headers/X-TileSim-Assistant-Session", retryable=False)
        except ProviderTimeoutError:
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "assistant_model_timeout",
                "The assistant model channel did not answer within its configured timeout.",
                retryable=True,
            )
        except ProviderStructuredOutputError:
            # The service answered, but not with a catalogue this Bridge can read.  Retrying the very
            # same read would fail the very same way, so this one is deliberately not retryable.
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "assistant_model_catalogue_unreadable",
                "The assistant model channel did not publish a readable model list.",
                retryable=False,
            )
        except ProviderError:
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "assistant_model_unavailable",
                "The assistant model channel is unavailable.",
                retryable=True,
            )
        catalogue["schema_set_revision"] = SCHEMA_SET_REVISION
        return write_json(self, HTTPStatus.OK, catalogue)

    def select_agent_assistant_model(self) -> None:
        """Make one model identity the identity this assistant session uses.

        The switch takes effect for the next request in this session without restarting anything, and the reply says
        plainly that it was **not persisted**, because the saved configuration belongs to the
        launcher.  Nothing here writes a document and nothing here creates a run.
        """
        try:
            scope = assistant_model_scope(self, required=True)
        except ValueError as error:
            return write_error(self, HTTPStatus.BAD_REQUEST, "invalid_assistant_model_session", str(error), field_path="/headers/X-TileSim-Assistant-Session", retryable=False)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_REQUEST_BYTES:
                raise ValueError("Request body must be between 1 byte and 2.1 MB.")
            request = json.loads(self.rfile.read(length), parse_constant=reject_nonfinite_json)
            if not isinstance(request, dict):
                raise ValueError("Request body must be a JSON object.")
        except (ValueError, json.JSONDecodeError) as error:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_assistant_model_selection",
                str(error),
                field_path="/model",
                retryable=False,
            )
        try:
            selection = assistant_model.select_model(request.get("model"), scope=scope)
        except ValueError as error:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_assistant_model_selection",
                str(error),
                field_path="/model",
                retryable=False,
            )
        except ProviderTimeoutError:
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "assistant_model_timeout",
                "The assistant model channel did not answer within its configured timeout.",
                retryable=True,
            )
        except ProviderError:
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "assistant_model_unavailable",
                "The assistant model channel is unavailable.",
                retryable=True,
            )
        selection["schema_set_revision"] = SCHEMA_SET_REVISION
        return write_json(self, HTTPStatus.OK, selection)

    def preview_agent_run_intake(self) -> None:
        """Read-only Run Intake v2 preview.

        No lock, no run reservation and no persistence: the endpoint validates and judges
        and nothing else.  HTTP status separates transport outcomes only - 200 means the
        published contract judged the submission (including a rejected verdict, which
        stays inside the typed body), 400 means the submission could not be validated
        against the published contract, and 503 means the published contract facts needed
        for a judgement are unavailable.
        """
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_REQUEST_BYTES:
                raise RequestValidationError(
                    "Run Intake preview request body must be between 1 byte and 2.1 MB.", "/"
                )
            document = json.loads(
                self.rfile.read(length), parse_constant=reject_nonfinite_json
            )
        except (ValueError, json.JSONDecodeError) as error:
            validation = request_validation_error(error)
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_run_intake_preview_request",
                str(validation),
                field_path=validation.field_path,
                retryable=False,
                nested_schema_identity=validation.nested_schema_identity,
            )
        try:
            payload = run_intake_service.preview_request_payload(document)
        except RequestValidationError as error:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_run_intake_preview_request",
                str(error),
                field_path=error.field_path,
                retryable=False,
                nested_schema_identity=error.nested_schema_identity,
            )
        try:
            profile_records = run_intake_profile_records()
        except (OSError, RuntimeError, ValueError) as error:
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "run_intake_preview_unavailable",
                f"The published Phase 2 Profile record set is unavailable: {error}",
                retryable=False,
            )
        try:
            result = run_intake_service.preview_run_intake(
                payload, profile_records=profile_records
            )
        except RequestValidationError as error:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_run_intake_preview_request",
                str(error),
                field_path=error.field_path,
                retryable=False,
                nested_schema_identity=error.nested_schema_identity,
            )
        except (OSError, RuntimeError, ValueError) as error:
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "run_intake_preview_unavailable",
                f"The published Agent orchestration Phase 2 contract facts are unavailable: {error}",
                retryable=False,
            )
        return write_json(self, HTTPStatus.OK, result)

    def run_week7_operation(self, operation_id: str) -> None:
        if not (TILESIM_CLI.is_file() and os.access(TILESIM_CLI, os.X_OK)):
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "cli_unavailable",
                "TileSimCLI is not available to the bridge.",
                retryable=True,
            )
        backend = backend_identity()
        if not backend["versions_match"]:
            return write_error(
                self,
                HTTPStatus.SERVICE_UNAVAILABLE,
                "backend_identity_mismatch",
                "The deployed TileSim source and CLI identity do not match.",
                retryable=True,
            )
        if not week7_operation_lock.acquire(blocking=False):
            return write_error(
                self,
                HTTPStatus.TOO_MANY_REQUESTS,
                "week7_capacity_reached",
                "Another Week 7 evidence operation is active.",
                retryable=True,
            )
        try:
            payload = execute_week7_operation(operation_id)
        except week7.Week7ExecutionError as error:
            return write_error(
                self,
                HTTPStatus.GATEWAY_TIMEOUT if error.code == "week7_operation_timeout" else HTTPStatus.BAD_GATEWAY,
                error.code,
                error.message,
                retryable=error.retryable,
            )
        finally:
            week7_operation_lock.release()
        return write_json(self, HTTPStatus.OK, payload)

    def get_run(self, run_id: str) -> None:
        run = run_snapshot(run_id)
        if run is None:
            return write_error(self, HTTPStatus.NOT_FOUND, "run_not_found", "Run was not found.", retryable=False)
        return write_json(self, HTTPStatus.OK, public_run(run))

    def get_run_events(self, run_id: str) -> None:
        raw_last_event_id = self.headers.get("Last-Event-ID", "").strip()
        if raw_last_event_id and raw_last_event_id not in {"0", "1", "2"}:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_last_event_id",
                "Last-Event-ID must be 0, 1, or 2.",
                field_path="/headers/Last-Event-ID",
                retryable=False,
            )
        last_event_id = int(raw_last_event_id or "0")
        run = run_snapshot(run_id)
        if run is None:
            return write_error(self, HTTPStatus.NOT_FOUND, "run_not_found", "Run was not found.", retryable=False)

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        add_contract_headers(self)
        add_cors_headers(self)
        self.end_headers()

        try:
            if is_terminal_run(run):
                if last_event_id < 2:
                    write_sse_event(self, event="run", event_id="2", data=public_run(run))
                return
            if last_event_id < 1:
                write_sse_event(self, event="run", event_id="1", data=public_run(run))

            deadline = time.monotonic() + SSE_WAIT_TIMEOUT_SECONDS
            heartbeat_at = time.monotonic() + SSE_HEARTBEAT_SECONDS
            while time.monotonic() < deadline:
                time.sleep(0.1)
                run = run_snapshot(run_id)
                if run is None:
                    return
                if is_terminal_run(run):
                    write_sse_event(self, event="run", event_id="2", data=public_run(run))
                    return
                if time.monotonic() >= heartbeat_at:
                    self.wfile.write(b": keep-alive\n\n")
                    self.wfile.flush()
                    heartbeat_at = time.monotonic() + SSE_HEARTBEAT_SECONDS
            write_sse_event(self, event="timeout", data={"run_id": run_id})
        except (BrokenPipeError, ConnectionResetError, OSError):
            return

    def rename_run(self, run_id: str) -> None:
        run_dir = safe_run_directory(run_id)
        if run_dir is None:
            return write_error(self, HTTPStatus.NOT_FOUND, "run_not_found", "Run was not found.", retryable=False)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_REQUEST_BYTES:
                raise ValueError("Request body must be between 1 byte and 2.1 MB.")
            request = json.loads(self.rfile.read(length))
            if not isinstance(request, dict):
                raise ValueError("Request body must be a JSON object.")
            run_name = validate_run_name(request.get("run_name"))
        except (ValueError, json.JSONDecodeError) as error:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "invalid_run_name_request",
                str(error),
                field_path="/run_name",
                retryable=False,
            )

        try:
            with metadata_lock:
                metadata = read_json_file(run_dir / "run-metadata.json")
                if not metadata:
                    stored = persisted_run(run_id)
                    metadata = {
                        key: value
                        for key, value in (stored or {}).items()
                        if key not in {"report_paths", "digest"}
                    }
                metadata["run_id"] = run_id
                metadata["run_name"] = run_name
                atomic_write_json(run_dir / "run-metadata.json", metadata)
        except OSError as error:
            return write_error(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                "run_name_write_failed",
                f"Could not save run name: {error}",
            )
        with runs_lock:
            if run_id in runs:
                runs[run_id]["run_name"] = run_name
        return write_json(self, HTTPStatus.OK, {"run_id": run_id, "run_name": run_name})

    def delete_run(self, run_id: str) -> None:
        """Delete one terminal run and all of its local artifacts."""
        raw_run_dir = RUNS_ROOT / run_id
        if raw_run_dir.is_symlink():
            return write_error(
                self, HTTPStatus.NOT_FOUND, "run_not_found", "Run was not found.", retryable=False
            )
        run_dir = safe_run_directory(run_id)
        if run_dir is None:
            return write_error(
                self, HTTPStatus.NOT_FOUND, "run_not_found", "Run was not found.", retryable=False
            )

        with runs_lock:
            run = runs.get(run_id)
            if run is None:
                run = persisted_run(run_id)
            if run is None:
                return write_error(
                    self, HTTPStatus.NOT_FOUND, "run_not_found", "Run was not found.", retryable=False
                )
            if run.get("status") in {"preparing", "running"}:
                return write_error(
                    self,
                    HTTPStatus.CONFLICT,
                    "run_active",
                    "A run can only be deleted after it reaches a terminal state.",
                    retryable=True,
                )
            if run.get("status") not in {"completed", "failed", "incomplete"}:
                return write_error(
                    self,
                    HTTPStatus.CONFLICT,
                    "run_not_terminal",
                    "A run can only be deleted after its terminal status is recorded.",
                    retryable=False,
                )
        # Filesystem artifacts are only one part of the user-owned evidence
        # graph. Resolve and erase Agent Harness associations before removing
        # the run directory. The four SQLite stores cannot share a transaction;
        # a partial result is therefore surfaced as retryable
        # ``deletion_incomplete`` and leaves the run available for retry.
        principal = self.headers.get("X-TileSim-Principal", "local-user").strip() or "local-user"
        workspace_id = self.headers.get("X-TileSim-Workspace", "local-workspace").strip() or "local-workspace"
        deletion_key = self.headers.get("Idempotency-Key", "").strip() or f"run-delete:{run_id}"
        deletion = agent_deletion_coordinator.delete_resource(
            resource_id=run_id,
            idempotency_key=deletion_key,
            principal=principal,
            workspace_id=workspace_id,
        )
        if deletion.get("status") == "deletion_incomplete":
            return write_json(
                self,
                HTTPStatus.CONFLICT,
                {
                    "run_id": run_id,
                    "deleted": False,
                    "status": "deletion_incomplete",
                    "retryable": True,
                    "deletion": deletion,
                },
            )
        with runs_lock:
            runs.pop(run_id, None)

        try:
            with metadata_lock:
                shutil.rmtree(run_dir)
        except FileNotFoundError:
            return write_error(
                self, HTTPStatus.NOT_FOUND, "run_not_found", "Run was not found.", retryable=False
            )
        except OSError as error:
            return write_error(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                "run_delete_failed",
                f"Could not delete local run artifacts: {error}",
                retryable=True,
            )
        return write_json(self, HTTPStatus.OK, {"run_id": run_id, "deleted": True})

    def create_evidence_analysis(self, run_id: str) -> None:
        run_dir = safe_run_directory(run_id)
        if run_dir is None:
            return write_error(
                self, HTTPStatus.NOT_FOUND, "run_not_found", "Run was not found.", retryable=False
            )
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_EVIDENCE_AGENT_REQUEST_BYTES:
                raise evidence_agent.EvidenceAgentContractError(
                    "input_too_large",
                    "Evidence Agent request body must be between 1 byte and 1.5 MB.",
                    "/",
                )
            request = json.loads(self.rfile.read(length), parse_constant=reject_nonfinite_json)
            if not isinstance(request, dict):
                raise evidence_agent.EvidenceAgentContractError(
                    "unsupported_schema", "Evidence Agent request must be a JSON object.", "/"
                )
            idempotency_key = idempotency_key_for(self)
            payload_digest = evidence_agent.canonical_sha256(request)
            manifest = artifact_manifest_for(run_id, run_dir)
            documents = evidence_agent_artifact_documents(run_dir, manifest)
            evidence_agent.validate_request(
                request,
                path_run_id=run_id,
                schema_set_revision=SCHEMA_SET_REVISION,
                artifact_manifest=manifest,
                artifact_documents=documents,
                current_backend_identity=backend_identity(),
            )
        except evidence_agent.EvidenceAgentContractError as error:
            return write_error(
                self,
                error.http_status,
                error.reason_code,
                str(error),
                field_path=error.field_path,
                retryable=False,
            )
        except RequestValidationError as error:
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "unsupported_schema",
                str(error),
                field_path=error.field_path,
                retryable=False,
            )
        except run_repository.ArtifactManifestValidationError as error:
            return write_error(
                self,
                HTTPStatus.CONFLICT,
                "citation_not_resolvable",
                str(error),
                retryable=False,
            )
        except (ValueError, json.JSONDecodeError):
            return write_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "unsupported_schema",
                "Evidence Agent request is not valid strict JSON.",
                field_path="/",
                retryable=False,
            )

        if not evidence_agent_operation_lock.acquire(blocking=False):
            return write_error(
                self,
                HTTPStatus.TOO_MANY_REQUESTS,
                "concurrency_limit",
                "The single read-only evidence Agent operation slot is occupied.",
                retryable=True,
            )
        try:
            status, response, _ = evidence_agent_service.terminal_analysis(
                run_dir=run_dir,
                request=request,
                artifact_documents=documents,
                idempotency_key=idempotency_key,
                payload_digest=payload_digest,
                schema_set_revision=SCHEMA_SET_REVISION,
                provider_runtime=evidence_agent_provider,
                read_json=read_json_file,
                atomic_write_json=atomic_write_json,
            )
        except evidence_agent_service.EvidenceAgentIdempotencyConflict as error:
            return write_error(
                self,
                HTTPStatus.CONFLICT,
                "idempotency_payload_mismatch",
                str(error),
                field_path="/headers/Idempotency-Key",
                retryable=False,
            )
        except evidence_agent_service.EvidenceAgentTerminalNotRetained as error:
            return write_error(
                self,
                HTTPStatus.CONFLICT,
                "terminal_result_not_retained",
                str(error),
                field_path="/headers/Idempotency-Key",
                retryable=False,
            )
        except (OSError, ValueError) as error:
            return write_error(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                "terminal_recovery_failed",
                str(error),
                retryable=False,
            )
        finally:
            evidence_agent_operation_lock.release()
        return write_json(self, HTTPStatus(status), response)

    def get_reports(self, run_id: str) -> None:
        with runs_lock:
            run = runs.get(run_id)
        if run is None:
            run = persisted_run(run_id)
        if run is None:
            return write_error(self, HTTPStatus.NOT_FOUND, "run_not_found", "Run was not found.", retryable=False)
        if run["status"] != "completed":
            return write_error(
                self,
                HTTPStatus.CONFLICT,
                "run_not_completed",
                "Run has not completed.",
                retryable=True,
            )
        reports = load_reports(run)
        if "run" not in reports:
            return write_error(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                "primary_artifact_invalid",
                "The completed run no longer has a valid primary report artifact.",
                retryable=False,
            )
        return write_json(self, HTTPStatus.OK, {"run_id": run_id, "reports": reports})

    def get_json_artifact(self, run_id: str, artifact: str) -> None:
        run_dir = safe_run_directory(run_id)
        if run_dir is None:
            return write_error(self, HTTPStatus.NOT_FOUND, "run_not_found", "Run was not found.", retryable=False)
        path = json_artifact_paths_for(run_dir).get(artifact)
        if path is None:
            return write_error(
                self,
                HTTPStatus.NOT_FOUND,
                "artifact_not_found",
                "JSON artifact was not found.",
                field_path="/artifact_id",
                retryable=False,
            )
        try:
            inspected = run_repository.inspect_artifact(
                run_id, path, JSON_ARTIFACT_DEFINITIONS[artifact]
            )
        except run_repository.ArtifactContractError as error:
            return write_error(
                self,
                HTTPStatus.CONFLICT,
                f"artifact_{error.reason}",
                str(error),
                field_path=error.json_pointer,
                retryable=False,
            )
        return write_json_artifact_body(self, inspected["body"])

    def get_artifact_manifest(self, run_id: str) -> None:
        run_dir = safe_run_directory(run_id)
        if run_dir is None:
            return write_error(self, HTTPStatus.NOT_FOUND, "run_not_found", "Run was not found.", retryable=False)
        try:
            manifest = artifact_manifest_for(run_id, run_dir)
        except run_repository.ArtifactManifestValidationError as error:
            return write_error(
                self,
                HTTPStatus.CONFLICT,
                "artifact_manifest_invalid",
                str(error),
                retryable=False,
            )
        return write_json(self, HTTPStatus.OK, manifest)

    def list_runs(self) -> None:
        with runs_lock:
            active = {run_id: public_run(run) for run_id, run in runs.items()}
        for run_dir in RUNS_ROOT.iterdir():
            if not run_dir.is_dir() or run_dir.name in active:
                continue
            stored = persisted_run(run_dir.name)
            if stored is not None:
                active[run_dir.name] = public_run(stored)
        ordered = sorted(active.values(), key=lambda run: run.get("created_at", ""), reverse=True)
        return write_json(self, HTTPStatus.OK, {"runs": ordered[:20]})


def main() -> None:
    RUNS_ROOT.mkdir(parents=True, exist_ok=True)
    try:
        port = int(os.environ.get("TILESIM_WEB_PORT", "5173"))
    except ValueError as error:
        raise SystemExit("TILESIM_WEB_PORT must be an integer from 1 to 65535.") from error
    if not 1 <= port <= 65_535:
        raise SystemExit("TILESIM_WEB_PORT must be an integer from 1 to 65535.")
    server = ThreadingHTTPServer(("127.0.0.1", port), BridgeHandler)
    print(f"TileSim Web bridge listening at http://127.0.0.1:{port} (UI: {STATIC_ROOT}, CLI: {TILESIM_CLI})")
    server.serve_forever()


if __name__ == "__main__":
    if sys.argv[1:] == ["--print-source-state-digest"]:
        value = worktree_state_digest()
        if value == "unknown":
            raise SystemExit("Could not calculate the TileSim source-state digest.")
        print(value)
    elif sys.argv[1:] == ["--print-schema-set-revision"]:
        print(SCHEMA_SET_REVISION)
    else:
        main()
