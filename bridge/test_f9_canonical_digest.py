"""Python side of the cross-language F9 canonical digest golden gate."""

from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from contracts.evidence_agent import canonical_json_text, canonical_sha256, snapshot_material


FIXTURE = Path(__file__).parent / "fixtures" / "f9-canonical-digest-golden.json"


def materialize_integers(value: object, pointers: list[str]) -> object:
    value = copy.deepcopy(value)
    for pointer in pointers:
        tokens = pointer.lstrip("/").split("/")
        target = value
        for token in tokens[:-1]:
            target = target[int(token)] if isinstance(target, list) else target[token]
        last = tokens[-1]
        if isinstance(target, list):
            target[int(last)] = int(target[int(last)], 10)
        else:
            target[last] = int(target[last], 10)
    return value


class CanonicalDigestGoldenTest(unittest.TestCase):
    def test_python_matches_all_golden_vectors_losslessly(self) -> None:
        fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
        self.assertEqual(fixture["schema_version"], "tilesim.bridge.canonical_digest_golden.v1")
        for case in fixture["cases"]:
            with self.subTest(case=case["id"]):
                value = materialize_integers(case["value"], case["integer_json_pointers"])
                self.assertEqual(canonical_json_text(value), case["expected_canonical_json"])
                self.assertEqual(canonical_sha256(value), case["expected_sha256"])

    def test_binary_float_is_rejected(self) -> None:
        with self.assertRaisesRegex(TypeError, "floating-point"):
            canonical_json_text({"unsafe": 0.1})

    def test_snapshot_material_uses_request_identity_and_excludes_untrusted_fields(self) -> None:
        request = {
            "schema_version": "tilesim.bridge.evidence_agent_request.v1",
            "schema_set_revision": "sha256:" + "1" * 64,
            "run_id": "run-golden",
            "structured_report_schema_identity": "tilesim.web.structured-performance-report.v2",
            "snapshot_reference": {"schema_version": "tilesim.bridge.evidence_snapshot_reference.v1"},
            "artifact_allow_list": [{"bytes": 9_007_199_254_740_993_123}],
            "locale": "zh-CN",
            "task_kind": "explain_p99",
            "client_request_id": "client-one",
            "user_question": {"content": "first"},
        }
        material = snapshot_material(request)
        self.assertEqual(material["schema_version"], request["schema_version"])
        changed = copy.deepcopy(request)
        changed.update(locale="en-US", task_kind="explain_tail", client_request_id="client-two")
        changed["user_question"] = {"content": "second"}
        self.assertEqual(canonical_sha256(material), canonical_sha256(snapshot_material(changed)))


if __name__ == "__main__":
    unittest.main()
