from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from canonical_json import canonical_json_text, canonical_sha256, digest_material


ROOT = Path(__file__).resolve().parent
PROPOSAL_ROOT = ROOT.parent


def materialize_integers(value: object, pointers: list[str]) -> object:
    result = copy.deepcopy(value)
    for pointer in pointers:
        tokens = pointer.lstrip("/").split("/")
        target = result
        for token in tokens[:-1]:
            target = target[int(token)] if isinstance(target, list) else target[token]
        last = tokens[-1]
        if isinstance(target, list):
            target[int(last)] = int(target[int(last)], 10)
        else:
            target[last] = int(target[last], 10)
    return result


class CanonicalDigestTest(unittest.TestCase):
    def test_vectors(self) -> None:
        vectors = json.loads((ROOT / "canonical-digest-vectors.proposal.jsonc").read_text(encoding="utf-8"))
        self.assertEqual(vectors["canonicalization"], "tilesim.bridge.canonical_json.v1")
        for case in vectors["cases"]:
            with self.subTest(case=case["id"]):
                value = materialize_integers(case["value"], case["integer_json_pointers"])
                self.assertEqual(canonical_json_text(value), case["expected_canonical_json"])
                self.assertEqual(canonical_sha256(value), case["expected_sha256"])

    def test_valid_fixture_digests(self) -> None:
        for path in sorted((PROPOSAL_ROOT / "fixtures" / "valid").glob("*.proposal.jsonc")):
            document = json.loads(path.read_text(encoding="utf-8"))
            with self.subTest(path=path.name):
                self.assertEqual(canonical_sha256(digest_material(document)), document["canonical_digest"])

    def test_binary_float_and_self_digest_are_rejected(self) -> None:
        with self.assertRaisesRegex(TypeError, "floating-point"):
            canonical_json_text({"unsafe": 0.1})
        with self.assertRaisesRegex(ValueError, "exclude canonical_digest"):
            digest_material({"canonical_digest": "x", "digest_material_fields": ["canonical_digest"]})


if __name__ == "__main__":
    unittest.main()
