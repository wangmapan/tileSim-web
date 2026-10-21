"""Create redacted Stage 3A Provider/reviewer preparation documents.

The command never starts Bridge, creates a run, or treats a capability probe
as acceptance.  It writes only identity/status/digest manifests outside the
repository by default.  ``--run-probe`` is explicit and only uses the
existing authenticated Provider adapter when its complete configuration is
already present in the environment.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

from agent_harness.acceptance_prep import (
    build_evidence_review_package,
    build_provider_acceptance_manifest,
    deployment_identity_diagnostic,
    write_preparation_document,
)
from agent_harness.contracts import EXECUTION_CONTRACT_REVISION, canonical_sha256
from contracts import evidence_agent
from contracts.schema_set import compute_schema_set_revision
from providers.evidence_agent import ProviderRuntime


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", help="External directory for the two redacted preparation documents.")
    parser.add_argument("--tilesim-root", default=os.environ.get("TILESIM_ROOT"))
    parser.add_argument("--tilesim-cli", default=os.environ.get("TILESIM_CLI"))
    parser.add_argument(
        "--deployment-manifest",
        default=os.environ.get("TILESIM_DEPLOYMENT_MANIFEST"),
        help="Explicit deployment manifest path; defaults to the local runtime manifest when present.",
    )
    parser.add_argument("--run-probe", action="store_true", help="Explicitly run the existing authenticated capability probe if configured.")
    args = parser.parse_args(argv)

    web_root = Path(__file__).resolve().parents[1]
    contract_root = web_root / "bridge" / "contracts"
    schema_set_revision = compute_schema_set_revision(contract_root)
    deployment_manifest_path = Path(args.deployment_manifest) if args.deployment_manifest else web_root / "runtime" / "backend-current.json"
    runtime = ProviderRuntime.from_environment()
    provider_identity = runtime.config.public_identity if runtime.config is not None else None
    backend_identity = {
        "source_revision": "not_supplied",
        "build_revision": "not_supplied",
        "state_digests_match": False,
        "versions_match": False,
    }
    if args.tilesim_root and args.tilesim_cli:
        from infra.identity import backend_identity as read_backend_identity

        identity = read_backend_identity(Path(args.tilesim_root), Path(args.tilesim_cli), deployment_manifest_path)
        backend_identity = {key: value for key, value in identity.items() if key not in {"tilesim_root", "tilesim_cli", "deployment_manifest"}}
    deployment_identity = deployment_identity_diagnostic(
        current_schema_set_revision=schema_set_revision,
        deployment_manifest_path=deployment_manifest_path,
        backend_identity=backend_identity,
    )
    probe = {"state": "not_run", "reason": "Provider configuration is not available." if runtime.config is None else "Explicit --run-probe was not supplied."}
    if args.run_probe and runtime.config is not None:
        if deployment_identity["status"] != "matched":
            probe = {
                "state": "blocked",
                "degradation_state": "deployment_identity_mismatch",
                "reason": "Capability probe was not started because deployment identity is not matched.",
            }
        else:
            capability = runtime.capability(force=True)
            probe = {
                "state": "passed" if capability.available else "failed",
                "degradation_state": capability.degradation_state,
                "reason": "Authenticated capability probe completed; acceptance repetition is still required.",
            }
    command_digest = canonical_sha256({"argv": sys.argv if argv is None else [sys.argv[0], *argv], "tool": "stage3a-acceptance-prep"})
    acceptance = build_provider_acceptance_manifest(
        schema_set_revision=schema_set_revision,
        backend_identity=backend_identity,
        descriptor_identity=evidence_agent.DESCRIPTOR_SCHEMA_IDENTITY,
        descriptor_revision=evidence_agent.DESCRIPTOR_REVISION,
        prompt_template_revision=evidence_agent.PROMPT_TEMPLATE_REVISION,
        policy_revision=evidence_agent.POLICY_REVISION,
        provider_identity=provider_identity,
        capability_probe=probe,
        deployment_identity=deployment_identity,
        command_digest=command_digest,
        reason="Provider is not configured; no live acceptance repetition was executed." if runtime.config is None else "Capability probe is not acceptance; live repetitions and human review remain pending.",
    )
    review = build_evidence_review_package(
        schema_set_revision=schema_set_revision,
        acceptance_manifest_digest=acceptance["manifest_digest"],
    )
    output_dir = Path(args.output_dir) if args.output_dir else Path(tempfile.mkdtemp(prefix="tilesim-stage3a-acceptance-prep-"))
    acceptance_path = output_dir / "provider-acceptance-manifest.json"
    review_path = output_dir / "evidence-citation-review-package.json"
    write_preparation_document(acceptance_path, acceptance)
    write_preparation_document(review_path, review)
    print(json.dumps({
        "output_dir": str(output_dir),
        "provider_state": acceptance["acceptance"]["state"],
        "review_state": review["review"]["state"],
        "deployment_identity": deployment_identity,
        "acceptance_manifest": str(acceptance_path),
        "review_package": str(review_path),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
