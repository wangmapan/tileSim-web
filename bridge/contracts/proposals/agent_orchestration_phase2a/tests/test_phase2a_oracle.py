"""Independent Phase 2A proposal oracle; this module has no runtime registration path."""

from __future__ import annotations

import hashlib
import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = ROOT.parents[3]
UINT64_MAX = 18_446_744_073_709_551_615
UINT64_RE = re.compile(r"^(0|[1-9][0-9]{0,19})$")
DECIMAL_RE = re.compile(r"^-?(0|[1-9][0-9]*)(\.[0-9]+)?$")


def load(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def canonical_json(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        raise TypeError("binary floating point is forbidden")
    if isinstance(value, list):
        return "[" + ",".join(canonical_json(item) for item in value) + "]"
    if isinstance(value, dict):
        if any(not isinstance(key, str) for key in value):
            raise TypeError("object keys must be strings")
        return "{" + ",".join(
            canonical_json(key) + ":" + canonical_json(value[key]) for key in sorted(value)
        ) + "}"
    raise TypeError(f"unsupported canonical value: {type(value).__name__}")


def digest(value: object) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def valid_uint64(value: object) -> bool:
    return isinstance(value, str) and bool(UINT64_RE.fullmatch(value)) and int(value) <= UINT64_MAX


class Phase2AProposalOracle(unittest.TestCase):
    def test_strict_json_and_manifest_schema_digests(self) -> None:
        for path in ROOT.rglob("*.json"):
            load(path)
        manifest = load(ROOT / "proposal-manifest.json")
        self.assertEqual(manifest["publication_status"], "proposal_only")
        shared = load(ROOT / manifest["shared_schema"]["schema_file"])
        self.assertEqual(digest(shared), manifest["shared_schema"]["schema_revision"])
        for item in manifest["contracts"]:
            schema = load(ROOT / item["schema_file"])
            self.assertEqual(schema["x-tilesim-contract-status"], "proposal_only")
            self.assertEqual(digest(schema), item["schema_revision"], item["identity"])
            self.assertEqual(schema["x-tilesim-schema-identity"], item["identity"])

    def test_python_canonical_matches_golden_vectors(self) -> None:
        fixture = load(ROOT / "fixtures/canonical/canonical-vectors.json")
        for case in fixture["vectors"]:
            self.assertEqual(canonical_json(case["value"]), case["expected_canonical_json"])
            self.assertEqual(digest(case["value"]), case["expected_sha256"])

    def test_uint64_decimal_and_unit_boundaries(self) -> None:
        fixture = load(ROOT / "fixtures/canonical/canonical-vectors.json")
        for case in fixture["uint64_cases"]:
            accepted = valid_uint64(case["value"])
            self.assertEqual(accepted, case["expected"] == "accept", case)
        units = set(fixture["unit_allow_list"])
        for case in fixture["decimal_cases"]:
            accepted = (
                isinstance(case["value"], str)
                and bool(DECIMAL_RE.fullmatch(case["value"]))
                and case["unit"] in units
            )
            self.assertEqual(accepted, case["expected"] == "accept", case)

    def test_every_profile_fact_has_field_level_provenance(self) -> None:
        for family in ("model", "engine", "device", "topology", "workload"):
            profile = load(ROOT / f"fixtures/valid/{family}-profile.json")["contract"]
            material = dict(profile)
            material.pop("profile_revision")
            material.pop("canonical_digest")
            self.assertEqual(profile["profile_revision"], digest(material))
            self.assertEqual(profile["canonical_digest"], digest(material))
            self.assertIn(profile["source_kind"], {"synthetic_trace", "compatibility_harness_trace"})
            self.assertNotEqual(profile["calibration_status"], "calibrated")
            self.assertNotEqual(profile["held_out_validation_status"], "validated")
            self.assertEqual(profile["allowed_claim_scope"], "synthetic_consistency")
            for name, fact in profile["facts"].items():
                self.assertIn("provenance", fact, f"{family}.{name}")
                self.assertIn(
                    fact["provenance"]["kind"],
                    {"observed", "externally_specified", "inferred", "modelled", "user_supplied"},
                )

        for fixture_name, digest_field in (
            ("profile-binding.json", "binding_digest"),
            ("run-intake.json", "canonical_digest"),
            ("validation-report.json", "report_digest"),
        ):
            contract = load(ROOT / f"fixtures/valid/{fixture_name}")["contract"]
            material = dict(contract)
            actual = material.pop(digest_field)
            self.assertEqual(actual, digest(material))

    def test_compatibility_and_semantic_matrices_are_total(self) -> None:
        matrix = load(ROOT / "fixtures/compatibility-matrix.json")
        expected_scenarios = {
            "old_client_to_new_server", "new_client_to_old_server", "v1_to_successor",
            "successor_to_v1", "identity_missing", "unknown_identity", "unknown_revision",
            "mixed_version_payload", "exact_replay", "payload_mismatch",
            "retained_historical_run", "stale_profile_binding",
        }
        self.assertEqual({case["scenario"] for case in matrix["cases"]}, expected_scenarios)
        self.assertTrue(all("expected" in case and "error_code" in case for case in matrix["cases"]))
        semantic = load(ROOT / "fixtures/semantic-cases.json")
        self.assertEqual(len(semantic["profile_binding_fail_closed"]), 10)
        self.assertEqual(len(semantic["stale_triggers"]), 8)
        binding_cases = load(ROOT / "fixtures/invalid/profile-binding-cases.json")
        self.assertEqual(
            binding_cases["cases"],
            [
                {"case": item["case"], "mutation": binding_cases["cases"][index]["mutation"], "expected_error": item["error_code"]}
                for index, item in enumerate(semantic["profile_binding_fail_closed"])
            ],
        )
        stale = load(ROOT / "fixtures/invalid/stale-validation-report.json")
        self.assertEqual([item["mutation"] for item in stale["cases"]], semantic["stale_triggers"])
        self.assertTrue(all(item["expected_error"] == "validation_report_stale" for item in stale["cases"]))
        self.assertEqual(
            set(semantic["forbidden_persistence"]),
            {"credential", "hidden_reasoning", "raw_provider_response"},
        )

    def test_current_contract_drift_and_proposal_isolation(self) -> None:
        baseline = load(ROOT / "current-formal-baseline.json")
        frozen = load(
            REPOSITORY_ROOT
            / "tests/fixtures/phase1-agent-orchestration/frozen-current-subset.json"
        )
        self.assertEqual(frozen["local_contract_revision"], baseline["phase1_local_identity"])
        self.assertEqual(frozen["schema_set_revision"], baseline["schema_set_revision"])
        self.assertEqual(frozen["catalog_revision"], baseline["capability_catalog"]["revision"])
        self.assertEqual(
            frozen["contract_package_revision"],
            baseline["capability_catalog"]["contract_package_revision"],
        )
        self.assertEqual(
            frozen["experiment_descriptor_revision"],
            baseline["experiment_descriptor"]["revision"],
        )
        catalog = load(
            REPOSITORY_ROOT
            / "bridge/contracts/agent_orchestration_capability/catalog-content.json"
        )
        self.assertEqual(catalog["schema_identity"], baseline["capability_catalog"]["identity"])
        self.assertEqual(catalog["catalog_revision"], baseline["capability_catalog"]["revision"])
        self.assertEqual(
            catalog["contract_package_revision"],
            baseline["capability_catalog"]["contract_package_revision"],
        )
        profiles = {item["family"]: item for item in catalog["profile_families"]}
        for family, expected in baseline["profile_v1"].items():
            profile = profiles[family]
            self.assertEqual([profile["schema_identity"], profile["schema_revision"]], expected)
            self.assertEqual(profile["actual_profile_count"], 0)
            self.assertEqual(profile["runtime_availability"], "unavailable")

        evidence_source = (
            REPOSITORY_ROOT / "bridge/contracts/evidence_agent.py"
        ).read_text(encoding="utf-8")
        for identity in baseline["evidence_identities"].values():
            self.assertIn(identity, evidence_source)

        manifest = load(ROOT / "proposal-manifest.json")
        formal_paths = [REPOSITORY_ROOT / "bridge/contracts/openapi.json"]
        for directory in (
            REPOSITORY_ROOT / "bridge/contracts/schemas",
            REPOSITORY_ROOT / "bridge/contracts/agent_orchestration_capability",
            REPOSITORY_ROOT / "src/contracts/generated",
        ):
            formal_paths.extend(path for path in directory.rglob("*") if path.is_file())
        formal_text = "\n".join(
            path.read_text(encoding="utf-8", errors="ignore") for path in formal_paths
        )
        for contract in manifest["contracts"]:
            self.assertNotIn(contract["identity"], formal_text)


if __name__ == "__main__":
    unittest.main()
