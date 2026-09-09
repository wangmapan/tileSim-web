import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from contracts.agent_orchestration_capability import load_catalog  # noqa: E402
from services.capability_catalog import (  # noqa: E402
    CapabilityCatalogService,
    capability_snapshot_response,
)


class CapabilityServiceTests(unittest.TestCase):
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

    def test_local_get_response_is_immutable_and_no_store(self):
        service = CapabilityCatalogService(self.release)
        status, headers, body = capability_snapshot_response(service, self.release)
        self.assertEqual(status, 200)
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertIn(body["snapshot_digest"], headers["ETag"])
        body["catalog"]["agent_exposed_field_ids"].clear()
        self.assertEqual(len(service.snapshot(self.release)["catalog"]["agent_exposed_field_ids"]), 8)

    def test_runtime_release_drift_fails_closed(self):
        service = CapabilityCatalogService(self.release)
        drifted = dict(self.release)
        drifted["schema_set_revision"] = "sha256:" + "9" * 64
        with self.assertRaises(ValueError):
            service.snapshot(drifted)


if __name__ == "__main__":
    unittest.main()
