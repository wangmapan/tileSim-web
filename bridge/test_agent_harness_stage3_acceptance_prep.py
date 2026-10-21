"""Tests for redacted Stage 3A acceptance/reviewer preparation assets."""

from __future__ import annotations

import copy
import unittest

from agent_harness.acceptance_prep import (
    AcceptancePreparationError,
    build_evidence_review_package,
    build_provider_acceptance_manifest,
    deployment_identity_diagnostic,
    validate_provider_acceptance_manifest,
)
from providers.evidence_agent import ProviderRuntime


class Stage3AcceptancePreparationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.kwargs = {
            "schema_set_revision": "sha256:" + "a" * 64,
            "backend_identity": {"source_revision": "review", "build_revision": "review"},
            "descriptor_identity": "tilesim.bridge.evidence_agent_descriptor.v2",
            "descriptor_revision": "sha256:" + "b" * 64,
            "prompt_template_revision": "tilesim.evidence_agent.prompt_template.v3",
            "policy_revision": "tilesim.evidence_agent.read_only_policy.v2",
        }

    def test_unconfigured_provider_is_pending_and_redacted(self) -> None:
        manifest = build_provider_acceptance_manifest(**self.kwargs)
        self.assertEqual(manifest["acceptance"]["state"], "live_acceptance_pending")
        self.assertEqual(manifest["capability_probe"]["state"], "not_run")
        self.assertEqual(manifest["acceptance"]["success_repetition_count"], 0)
        self.assertFalse(manifest["retention"]["credential_persisted"])
        self.assertNotIn("api_key", repr(manifest))
        validate_provider_acceptance_manifest(manifest)

    def test_accepted_manifest_requires_probe_success_repetition_and_review(self) -> None:
        deployment_identity = {
            "status": "matched",
            "manifest_path": "C:/review/backend-current.json",
            "manifest_present": True,
            "manifest_schema_set_revision": self.kwargs["schema_set_revision"],
            "source_schema_set_revision": self.kwargs["schema_set_revision"],
            "schema_set_match": True,
            "source_revision": "review",
            "build_revision": "review",
            "source_build_revision_match": True,
            "source_state_digest": "sha256:" + "c" * 64,
            "build_state_digest": "sha256:" + "c" * 64,
            "source_build_state_digest_match": True,
            "backend_versions_match": True,
            "identity_match": True,
        }
        manifest = build_provider_acceptance_manifest(**self.kwargs, deployment_identity=deployment_identity)
        accepted = copy.deepcopy(manifest)
        accepted["acceptance"]["state"] = "accepted"
        accepted["capability_probe"] = {"state": "passed"}
        accepted["reviewer_state"] = "completed"
        accepted["cases"][0].update({"state": "passed", "repetition": 1})
        accepted.pop("manifest_digest")
        from agent_harness.contracts import canonical_sha256

        accepted["manifest_digest"] = canonical_sha256(accepted)
        validate_provider_acceptance_manifest(accepted)
        rejected = copy.deepcopy(accepted)
        rejected["cases"][0]["repetition"] = 0
        rejected.pop("manifest_digest")
        rejected["manifest_digest"] = canonical_sha256(rejected)
        with self.assertRaises(AcceptancePreparationError):
            validate_provider_acceptance_manifest(rejected)

    def test_review_package_stays_not_run_without_human_review(self) -> None:
        acceptance = build_provider_acceptance_manifest(**self.kwargs)
        package = build_evidence_review_package(
            schema_set_revision=self.kwargs["schema_set_revision"],
            acceptance_manifest_digest=acceptance["manifest_digest"],
        )
        self.assertEqual(package["review"]["state"], "not_run")
        self.assertEqual(package["review"]["reviewer_count"], 0)
        self.assertFalse(package["retention"]["claim_payload_persisted"])

    def test_forbidden_provider_payload_is_rejected(self) -> None:
        with self.assertRaises(AcceptancePreparationError):
            build_provider_acceptance_manifest(**self.kwargs, capability_probe={"state": "failed", "raw_response": {}})

    def test_deployment_schema_mismatch_is_explicit_and_fail_closed(self) -> None:
        from pathlib import Path
        from tempfile import TemporaryDirectory

        with TemporaryDirectory() as root:
            manifest_path = Path(root) / "backend-current.json"
            manifest_path.write_text(
                '{"schema_set_revision":"sha256:' + "d" * 64 + '","source_revision":"r1","build_revision":"r1",'
                '"source_state_digest":"sha256:' + "e" * 64 + '","build_state_digest":"sha256:' + "e" * 64 + '"}',
                encoding="utf-8",
            )
            diagnostic = deployment_identity_diagnostic(
                current_schema_set_revision=self.kwargs["schema_set_revision"],
                deployment_manifest_path=manifest_path,
                backend_identity={
                    "source_revision": "r1",
                    "build_revision": "r1",
                    "source_state_digest": "sha256:" + "e" * 64,
                    "build_state_digest": "sha256:" + "e" * 64,
                    "versions_match": True,
                },
            )
        self.assertEqual(diagnostic["status"], "deployment_schema_mismatch")
        self.assertFalse(diagnostic["schema_set_match"])
        self.assertFalse(diagnostic["identity_match"])

    def test_missing_state_digest_is_incomplete_and_fail_closed(self) -> None:
        from pathlib import Path
        from tempfile import TemporaryDirectory

        with TemporaryDirectory() as root:
            manifest_path = Path(root) / "backend-current.json"
            manifest_path.write_text(
                '{"schema_set_revision":"' + self.kwargs["schema_set_revision"] + '",'
                '"source_revision":"r1","build_revision":"r1"}',
                encoding="utf-8",
            )
            diagnostic = deployment_identity_diagnostic(
                current_schema_set_revision=self.kwargs["schema_set_revision"],
                deployment_manifest_path=manifest_path,
                backend_identity={
                    "source_revision": "r1",
                    "build_revision": "r1",
                    "versions_match": True,
                },
            )
        self.assertEqual(diagnostic["status"], "deployment_identity_incomplete")
        self.assertIsNone(diagnostic["source_build_state_digest_match"])
        self.assertFalse(diagnostic["identity_match"])

    def test_launcher_configuration_not_inherited_stays_not_run(self) -> None:
        runtime = ProviderRuntime.from_environment({})
        self.assertIsNone(runtime.config)
        self.assertEqual(runtime.capability().degradation_state, "not_configured")

    def test_configured_process_exposes_only_public_provider_identity(self) -> None:
        runtime = ProviderRuntime.from_environment(
            {
                "TILESIM_EVIDENCE_AGENT_PROVIDER": "tilesim_json_https_v1",
                "TILESIM_EVIDENCE_AGENT_ENDPOINT": "https://provider.example.test/evidence",
                "TILESIM_EVIDENCE_AGENT_API_KEY": "secret-value-never-returned",
                "TILESIM_EVIDENCE_AGENT_MODEL": "review-model",
                "TILESIM_EVIDENCE_AGENT_MODEL_REVISION": "review-model-r1",
            }
        )
        self.assertIsNotNone(runtime.config)
        public_identity = runtime.config.public_identity
        self.assertEqual(public_identity["provider_id"], "tilesim_json_https_v1")
        self.assertNotIn("api_key", public_identity)
        self.assertNotIn("secret-value-never-returned", repr(public_identity))


if __name__ == "__main__":
    unittest.main()
