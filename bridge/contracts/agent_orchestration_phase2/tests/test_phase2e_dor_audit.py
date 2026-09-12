import json
import re
import unittest
from pathlib import Path

from bridge.contracts.agent_orchestration_phase2.registry import (
    FAMILIES,
    build_profile_binding,
    build_snapshot,
    executable_combinations,
    load_registry,
    query_profiles,
    validate_snapshot,
)


ROOT = Path(__file__).parents[4]
FIXTURE = Path(__file__).with_name("fixtures") / "phase2e-dor-audit.json"


class Phase2EDoRAuditTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
        cls.registry = load_registry()
        cls.manifest = json.loads(
            (ROOT / "bridge" / "contracts" / "agent_orchestration_phase2" / "manifest.json").read_text(encoding="utf-8")
        )

    def test_profile_data_is_source_traceable_but_not_available(self):
        self.assertEqual(tuple(self.registry["profile_families"]), FAMILIES)
        available = 0
        findings = set()
        for family in FAMILIES:
            entries = self.registry["records"][family]
            self.assertEqual(len(entries), 1)
            entry = entries[0]
            profile = entry["profile"]
            source = self.registry["sources"][profile["source_reference"]]
            self.assertTrue(source["uri"])
            self.assertTrue(source["license"])
            self.assertTrue(profile["valid_regime"]["constraints"])
            self.assertIn(profile["lifecycle"]["status"], {"available", "deprecated", "expired", "revoked", "unavailable"})
            self.assertEqual(entry["runtime_status"], "unavailable")
            self.assertFalse(entry["agent_exposed"])
            available += entry["runtime_status"] == "available"
            if entry["runtime_status"] != "available":
                findings.add("profile_runtime_unavailable")
            if profile["calibration_status"] == "missing":
                findings.add("calibration_missing")
            if profile["held_out_validation_status"] == "missing":
                findings.add("held_out_missing")
            if profile["calibration_status"] != "calibrated" and profile["allowed_claim_scope"] == "real_calibrated_validation":
                findings.add("claim_scope_mismatch")
            for fact in profile["facts"].values():
                provenance = fact["provenance"]
                self.assertIn(provenance["source_reference"], self.registry["sources"])
                if provenance["kind"] == "observed" and source["kind"] != "real_trace":
                    findings.add("provenance_kind_mismatch")
        self.assertEqual(available, 0)
        self.assertTrue(set(self.fixture["required_findings"]).issuperset(findings))
        self.assertIn("provenance_kind_mismatch", findings)
        self.assertIn("claim_scope_mismatch", findings)

    def test_synthetic_and_reviewed_sources_do_not_upgrade_claims(self):
        for family in FAMILIES:
            profile = self.registry["records"][family][0]["profile"]
            source = self.registry["sources"][profile["source_reference"]]
            if source["kind"] in {"synthetic_trace", "compatibility_harness_trace", "user_input"}:
                self.assertNotEqual(profile["calibration_status"], "calibrated")
                self.assertNotEqual(profile["held_out_validation_status"], "validated")
                self.assertIn(profile["allowed_claim_scope"], {"exploration", "synthetic_consistency"})

    def test_contracts_are_published_as_schemas_only(self):
        self.assertEqual(self.manifest["runtime_status"], "contract_only")
        self.assertEqual(self.manifest["calculator_status"], "receipt_contract_only")
        self.assertEqual(self.manifest["validation_report_status"], "schema_and_validator_only")
        self.assertEqual(self.manifest["create_run_acceptance"], "not_accepted_by_current_api")
        self.assertEqual(len(self.manifest["typed_receipt_identities"]), 7)
        report_schema = json.loads(
            (ROOT / "bridge" / "contracts" / "agent_orchestration_phase2" / "schemas" / "validation-report.schema.json").read_text(encoding="utf-8")
        )
        self.assertNotIn("approval", report_schema["properties"])

    def test_binding_snapshot_and_combination_do_not_claim_execution(self):
        ids = {family: self.registry["records"][family][0]["profile"]["profile_id"] for family in FAMILIES}
        binding = build_profile_binding(ids)
        self.assertEqual(set(ids), set(FAMILIES))
        self.assertEqual(len(query_profiles()), 0)
        self.assertEqual(executable_combinations(), [])
        snapshot = build_snapshot()
        validate_snapshot(snapshot)
        snapshot["registry_revision"] = "sha256:" + "0" * 64
        with self.assertRaises(ValueError):
            validate_snapshot(snapshot)
        self.assertTrue(binding["binding_digest"].startswith("sha256:"))

    def test_uint64_data_is_canonical_and_overflow_is_an_audit_finding(self):
        maximum = 18446744073709551615
        uint64_names = {
            "parameter_count", "layer_count", "hidden_size", "memory_capacity_bytes",
            "interconnect_endpoints", "endpoint_count", "link_latency_ps", "request_count",
        }
        for family in FAMILIES:
            for name, fact in self.registry["records"][family][0]["profile"]["facts"].items():
                if name in uint64_names:
                    value = fact["value"]
                    self.assertIsInstance(value, str)
                    self.assertRegex(value, r"^(0|[1-9][0-9]{0,19})$")
                    self.assertLessEqual(int(value), maximum)
        validator = (ROOT / "bridge" / "contracts" / "agent_orchestration_phase2" / "validator.py").read_text(encoding="utf-8")
        self.assertIn("MAX_U64", validator)
        self.assertIn("_u64", validator)
        self.assertIn("uint64_validator_boundary_gap", self.fixture["required_findings"])

    def test_no_phase2_frontend_mock_or_agent_exposure(self):
        src = ROOT / "src"
        matches = []
        for path in src.rglob("*"):
            if path.is_file() and path.suffix in {".ts", ".tsx", ".js", ".vue"}:
                text = path.read_text(encoding="utf-8", errors="ignore")
                if "orchestration-profiles" in text or "agent_orchestration_profile_registry" in text:
                    matches.append(path)
        self.assertEqual(matches, [])
        self.assertIn("no_phase2_frontend_mock_or_exposure", self.fixture["required_findings"])


if __name__ == "__main__":
    unittest.main()
