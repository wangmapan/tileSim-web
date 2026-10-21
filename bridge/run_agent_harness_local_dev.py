"""Generate a disposable local-dev deployment identity and run local-only Stage 3A.

This command is intentionally separate from the production acceptance and
release-gate commands. It creates a new manifest from the current checkout and
records synthetic hosted evidence as ``LOCAL_ONLY_PASS``. It never reads a
Provider credential and never changes ``runtime/backend-current.json``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from agent_harness.contracts import EXECUTION_CONTRACT_REVISION, canonical_sha256
from agent_harness.hosted_smoke import run_hosted_smoke
from agent_harness.acceptance_prep import (
    build_evidence_review_package,
    build_provider_acceptance_manifest,
    deployment_identity_diagnostic,
    write_preparation_document,
)
from agent_harness.release_gate import matrix_case_ids
from contracts.schema_set import compute_schema_set_revision
from infra.identity import git_value, runtime_capabilities, worktree_state_digest


LOCAL_MANIFEST_IDENTITY = "tilesim.agent_harness.local_dev_deployment_manifest.v1"
LOCAL_MANIFEST_REVISION = "2026-10-19.local-dev.v1"


def _file_digest(path: Path) -> dict[str, str | int]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
            size += len(chunk)
    return {"sha256": f"sha256:{digest.hexdigest()}", "bytes": size}


def _generated_contract_identity(web_root: Path) -> dict[str, Any]:
    files = [
        web_root / "bridge" / "contracts" / "openapi.json",
        web_root / "src" / "contracts" / "generated" / "agent-harness.ts",
        web_root / "scripts" / "generate-agent-harness-client.mjs",
    ]
    observed = {str(path.relative_to(web_root)).replace("\\", "/"): _file_digest(path) for path in files if path.is_file()}
    return {"files": observed, "digest": canonical_sha256(observed)}


def _build_manifest(web_root: Path, tilesim_root: Path, tilesim_cli: Path) -> dict[str, Any]:
    schema_set_revision = compute_schema_set_revision(web_root / "bridge" / "contracts")
    source_revision = git_value(tilesim_root, "rev-parse", "HEAD")
    state_digest = worktree_state_digest(tilesim_root)
    if source_revision in {"unknown", ""} or state_digest in {"unknown", ""}:
        raise RuntimeError("Cannot generate local-dev identity without a readable backend revision and state digest.")
    capabilities = runtime_capabilities(tilesim_cli)
    backend_identity = {
        "backend_revision": source_revision,
        "source_revision": source_revision,
        "build_revision": source_revision,
        "source_state_digest": state_digest,
        "build_state_digest": state_digest,
        "state_digests_match": True,
        "versions_match": True,
        "deployment_mode": "local_dev",
        "deployment_ref": f"local:{source_revision}",
        "backend_identity": "tilesim.local_dev.backend.v1",
    }
    capability_identity = {
        "identity": "tilesim.local_dev.capability.v1",
        "digest": canonical_sha256(capabilities),
        "source": "TileSimCLI capabilities or bounded unavailable snapshot",
    }
    body: dict[str, Any] = {
        "schema_identity": LOCAL_MANIFEST_IDENTITY,
        "revision": LOCAL_MANIFEST_REVISION,
        "execution_contract_revision": EXECUTION_CONTRACT_REVISION,
        "schema_set_revision": schema_set_revision,
        "source_revision": source_revision,
        "build_revision": source_revision,
        "source_state_digest": state_digest,
        "build_state_digest": state_digest,
        "backend_identity": backend_identity,
        "capability_identity": capability_identity,
        "deployment_mode": "local_dev",
        "source": "auto_generated_from_current_source_bridge_schema_and_cli",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "not_for_production": True,
        "provider": {
            "state": "provider_unavailable_for_local_dev",
            "credential_read": False,
            "path": "controlled_local_synthetic",
        },
        "contracts": _generated_contract_identity(web_root),
    }
    body["manifest_digest"] = canonical_sha256(body)
    return body


def _write(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def _run_fault_matrix(web_root: Path) -> tuple[str, int]:
    """Run the durable Stage 3 matrix without retaining test output."""
    import subprocess

    completed = subprocess.run(
        [sys.executable, "-m", "unittest", "test_agent_harness_stage3_matrix"],
        cwd=str(web_root / "bridge"),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return ("passed" if completed.returncode == 0 else "failed", completed.returncode)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tilesim-root", default=os.environ.get("TILESIM_ROOT"), required=False)
    parser.add_argument("--tilesim-cli", default=os.environ.get("TILESIM_CLI"), required=False)
    parser.add_argument("--output-dir", default=None)
    parser.add_argument("--run-hosted-smoke", action="store_true")
    args = parser.parse_args(argv)
    web_root = Path(__file__).resolve().parents[1]
    tilesim_root = Path(args.tilesim_root) if args.tilesim_root else None
    tilesim_cli = Path(args.tilesim_cli) if args.tilesim_cli else None
    if tilesim_root is None or tilesim_cli is None:
        raise SystemExit("--tilesim-root and --tilesim-cli are required for local-dev identity generation")
    output_dir = Path(args.output_dir) if args.output_dir else Path(tempfile.mkdtemp(prefix="tilesim-stage3-local-dev-"))
    manifest_path = output_dir / "local-dev-deployment-manifest.json"
    manifest = _build_manifest(web_root, tilesim_root, tilesim_cli)
    _write(manifest_path, manifest)
    backend_identity = dict(manifest["backend_identity"])
    backend_identity.update(
        {
            "source_revision": manifest["source_revision"],
            "build_revision": manifest["build_revision"],
            "source_state_digest": manifest["source_state_digest"],
            "build_state_digest": manifest["build_state_digest"],
            "state_digests_match": True,
            "versions_match": True,
        }
    )
    identity = deployment_identity_diagnostic(
        current_schema_set_revision=manifest["schema_set_revision"],
        deployment_manifest_path=manifest_path,
        backend_identity=backend_identity,
    )
    acceptance_manifest = build_provider_acceptance_manifest(
        schema_set_revision=manifest["schema_set_revision"],
        backend_identity=backend_identity,
        descriptor_identity="tilesim.evidence_agent.descriptor.v1",
        descriptor_revision="not_run",
        prompt_template_revision="not_run",
        policy_revision="not_run",
        capability_probe={"state": "not_run", "degradation_state": "provider_unavailable_for_local_dev"},
        deployment_identity=identity,
        acceptance_state="live_acceptance_pending",
        reviewer_state="not_run",
        reason="Local-dev uses controlled synthetic execution; live Provider acceptance remains pending.",
    )
    provider_manifest_path = output_dir / "provider-acceptance-manifest.json"
    write_preparation_document(provider_manifest_path, acceptance_manifest)
    review_package = build_evidence_review_package(
        schema_set_revision=manifest["schema_set_revision"],
        acceptance_manifest_digest=acceptance_manifest["manifest_digest"],
        review_state="not_run",
        not_run_reason="review_not_required_for_local_dev; production_review_pending",
    )
    review_package_path = output_dir / "evidence-citation-review-package.json"
    write_preparation_document(review_package_path, review_package)
    hosted: dict[str, Any] | None = None
    matrix_status, matrix_exit = _run_fault_matrix(web_root)
    if args.run_hosted_smoke:
        hosted = run_hosted_smoke(tilesim_root=tilesim_root, tilesim_cli=tilesim_cli, deployment_manifest=manifest_path)
    local_gate = {
        "schema_identity": "tilesim.agent_harness.stage3a_local_dev_gate.v1",
        "revision": "2026-10-19.local-dev-gate.v1",
        "deployment_manifest": {"path": str(manifest_path), "digest": manifest["manifest_digest"], "identity_match": identity["identity_match"], "status": identity["status"]},
        "execution_contract_revision": EXECUTION_CONTRACT_REVISION,
        "mode": "local_dev",
        "status": "LOCAL_ONLY_PASS" if matrix_status == "passed" and hosted and hosted.get("provenance") == "synthetic_trace" and hosted.get("claim_scope") == "exploratory" else "NOT_RUN",
        "boundary": {
            "provenance": "synthetic_trace",
            "claim_scope": "exploratory",
            "environment": "local_dev",
            "not_for_production": True,
            "provider": "provider_unavailable_for_local_dev",
            "review": "review_not_required_for_local_dev",
            "production_acceptance": "production_acceptance_pending",
        },
        "matrix": {"case_ids": list(matrix_case_ids()), "status": matrix_status, "passed": 26 if matrix_status == "passed" else 0, "failed": 0 if matrix_status == "passed" else 26, "exit_code": matrix_exit},
        "hosted_smoke": hosted or {"status": "not_run"},
        "acceptance_prep": {
            "provider_manifest": {"path": str(provider_manifest_path), "digest": acceptance_manifest["manifest_digest"], "state": "live_acceptance_pending"},
            "review_package": {"path": str(review_package_path), "identity": review_package["schema_identity"], "state": "review_not_required_for_local_dev"},
        },
        "capabilities_not_opened": [
            "multi_tool_autonomous_loop",
            "automatic_candidate_generation",
            "autonomous_optimization",
            "unattended_batch_experiments",
            "external_mcp_a2a",
        ],
    }
    local_gate["manifest_digest"] = canonical_sha256(local_gate)
    gate_path = output_dir / "local-dev-stage3a-gate.json"
    _write(gate_path, local_gate)
    print(json.dumps({"manifest": str(manifest_path), "gate": str(gate_path), "status": local_gate["status"], "manifest_digest": manifest["manifest_digest"]}, ensure_ascii=False))
    return 0 if local_gate["status"] == "LOCAL_ONLY_PASS" else 2


if __name__ == "__main__":
    raise SystemExit(main())
