import copy
import unittest

from bridge.contracts.agent_orchestration_phase2.registry import (
    FAMILIES,
    build_profile_binding,
    build_snapshot,
    executable_combinations,
    load_registry,
    query_profiles,
    validate_registry,
    validate_snapshot,
)
from bridge.contracts.agent_orchestration_phase2.validator import ContractValidationError


class Phase2DRegistryTests(unittest.TestCase):
    def setUp(self):
        self.registry = load_registry()

    def test_one_source_backed_record_per_family(self):
        self.assertEqual(tuple(self.registry["profile_families"]), FAMILIES)
        for family in FAMILIES:
            entry = self.registry["records"][family][0]
            profile = entry["profile"]
            self.assertEqual(profile["profile_family"], family)
            self.assertTrue(profile["canonical_digest"].startswith("sha256:"))
            self.assertTrue(profile["profile_revision"].startswith("sha256:"))
            self.assertIn(profile["source_reference"], self.registry["sources"])
            self.assertFalse(entry["agent_exposed"])
            self.assertFalse(entry["calculator_eligible"])
            self.assertFalse(entry["ranking_eligible"])

    def test_deterministic_registry_and_snapshot_digest(self):
        self.assertEqual(self.registry, load_registry())
        snapshot = build_snapshot()
        validate_snapshot(snapshot)
        self.assertEqual(snapshot, build_snapshot())

    def test_unknown_expired_revoked_and_visibility_are_excluded(self):
        self.assertEqual([], query_profiles(family="does-not-exist", include_unavailable=True))
        self.assertEqual([], query_profiles())
        self.assertEqual([], query_profiles(visibility="private", include_unavailable=True))

    def test_digest_and_revision_drift_fail_closed(self):
        broken = copy.deepcopy(self.registry)
        broken["records"]["model"][0]["profile"]["facts"]["hidden_size"]["value"] = "4097"
        with self.assertRaises(ContractValidationError):
            validate_registry(broken)
        snapshot = build_snapshot()
        snapshot["registry_revision"] = "sha256:" + "0" * 64
        with self.assertRaises(ContractValidationError):
            validate_snapshot(snapshot)

    def test_missing_source_license_or_provenance_fails_closed(self):
        for mutation in ("source", "license", "provenance"):
            broken = copy.deepcopy(self.registry)
            if mutation == "source":
                broken["sources"].pop("hf_mistral_7b_v01_config")
            elif mutation == "license":
                broken["records"]["device"][0]["profile"]["license"]["spdx_id"] = "Apache-2.0"
            else:
                broken["records"]["workload"][0]["profile"]["facts"]["request_count"]["provenance"].pop("source_field")
            with self.assertRaises(Exception):
                validate_registry(broken)

    def test_binding_is_complete_but_not_executable(self):
        ids = {family: self.registry["records"][family][0]["profile"]["profile_id"] for family in FAMILIES}
        binding = build_profile_binding(ids)
        self.assertEqual(binding["schema_identity"], "tilesim.bridge.agent_orchestration_profile_binding.v1")
        self.assertEqual(set(ids), set(FAMILIES))
        self.assertEqual(executable_combinations(), [])

    def test_uint64_values_remain_decimal_strings(self):
        for family in FAMILIES:
            for fact in self.registry["records"][family][0]["profile"]["facts"].values():
                if fact["unit"] in {"parameters", "layers", "elements", "bytes", "links", "devices", "ps", "requests"}:
                    self.assertIsInstance(fact["value"], str)

    def test_synthetic_records_cannot_claim_calibration_or_held_out(self):
        for family in ("topology", "workload"):
            profile = self.registry["records"][family][0]["profile"]
            self.assertNotEqual(profile["calibration_status"], "calibrated")
            self.assertNotEqual(profile["held_out_validation_status"], "validated")
            self.assertIn(profile["allowed_claim_scope"], ("exploration", "synthetic_consistency"))


if __name__ == "__main__":
    unittest.main()
