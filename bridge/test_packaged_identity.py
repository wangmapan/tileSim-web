import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from infra import identity


class PackagedIdentityTests(unittest.TestCase):
    def test_packaged_manifest_is_identity_without_git_checkout(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            manifest_path = root / "release.json"
            manifest_path.write_text(
                json.dumps(
                    {
                        "schema_version": "tilesim.workbench.release.v1",
                        "release_id": "0.3.0-abcdef123456",
                        "version": "0.3.0",
                        "deployment_mode": "packaged",
                        "backend_source_revision": "a" * 40,
                        "web_source_revision": "b" * 40,
                        "schema_set_revision": "sha256:" + "c" * 64,
                        "runtime_kind": "windows-native",
                        "tilesim_cli_digest": "d" * 64,
                    }
                ),
                encoding="utf-8",
            )
            with mock.patch.dict(os.environ, {"TILESIM_PACKAGE_ROOT": str(root)}, clear=False), mock.patch(
                "infra.identity.git_value", return_value="unknown"
            ):
                result = identity.backend_identity(root / "resources", root / "TileSimCLI.exe", manifest_path)
            self.assertEqual(result["backend_revision"], "a" * 40)
            self.assertEqual(result["source_revision"], "a" * 40)
            self.assertEqual(result["build_revision"], "a" * 40)
            self.assertTrue(result["versions_match"])
            self.assertEqual(result["deployment_mode"], "packaged")
            self.assertEqual(result["release_id"], "0.3.0-abcdef123456")
            self.assertEqual(result["tilesim_cli_digest"], "d" * 64)


if __name__ == "__main__":
    unittest.main()
