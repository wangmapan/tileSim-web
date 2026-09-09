import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from contracts.agent_orchestration_capability.contract import (  # noqa: E402
    build_snapshot,
    canonical_sha256,
    load_catalog,
    validate_release_binding,
)


class CapabilityContractTests(unittest.TestCase):
    def setUp(self):
        catalog = load_catalog()
        self.release = {
            "web_source_revision": "a" * 40,
            "web_build_revision": "b" * 40,
            "backend_revision": "c" * 40,
            "schema_set_revision": "sha256:" + "1" * 64,
            "experiment_descriptor_revision": "sha256:" + "2" * 64,
            "catalog_revision": catalog["catalog_revision"],
            "contract_package_revision": catalog["contract_package_revision"],
        }

    def test_catalog_and_snapshot_digest_closure(self):
        snapshot = build_snapshot(self.release)
        self.assertEqual(snapshot["snapshot_revision"], snapshot["snapshot_digest"])
        self.assertEqual(snapshot["release_binding"]["default_nested_design_space_identity"], "tilesim.design_space.s6_candidates.v1")
        self.assertEqual(len(snapshot["catalog"]["agent_exposed_field_ids"]), 8)
        self.assertEqual(len(snapshot["catalog"]["not_exposed_capabilities"]), 9)
        self.assertTrue(all(records == [] for records in snapshot["catalog"]["profile_records"].values()))
        serialized = str(snapshot).lower()
        for forbidden in ("credential", "api_key", "provider_response", "artifact_payload", "user_question"):
            self.assertNotIn(forbidden, serialized)

    def test_missing_unknown_and_drift_metadata_fail_closed(self):
        for key in ("backend_revision", "catalog_revision"):
            bad = dict(self.release)
            del bad[key]
            with self.assertRaises(ValueError):
                build_snapshot(bad)
        bad = dict(self.release)
        bad["web_source_revision"] = "unknown"
        with self.assertRaises(ValueError):
            build_snapshot(bad)
        bad = dict(self.release)
        bad["catalog_revision"] = "sha256:" + "f" * 64
        with self.assertRaises(ValueError):
            build_snapshot(bad)

    def test_snapshot_is_fresh_and_not_shared(self):
        first = build_snapshot(self.release)
        first["catalog"]["agent_exposed_field_ids"].clear()
        second = build_snapshot(self.release)
        self.assertEqual(len(second["catalog"]["agent_exposed_field_ids"]), 8)

    def test_uint64_and_float_policy(self):
        self.assertEqual(canonical_sha256({"n": 9007199254740991})[:7], "sha256:")
        with self.assertRaises(ValueError):
            canonical_sha256({"n": 9007199254740992})
        with self.assertRaises(ValueError):
            canonical_sha256({"n": 1.25})


if __name__ == "__main__":
    unittest.main()
