"""Proposal-local implementation of tilesim.bridge.canonical_json.v1."""

from __future__ import annotations

import hashlib
import json


def canonical_json_text(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        raise TypeError("canonical JSON forbids binary floating-point values")
    if isinstance(value, list):
        return "[" + ",".join(canonical_json_text(item) for item in value) + "]"
    if isinstance(value, dict):
        if not all(isinstance(key, str) for key in value):
            raise TypeError("canonical JSON object keys must be strings")
        return "{" + ",".join(
            canonical_json_text(key) + ":" + canonical_json_text(value[key])
            for key in sorted(value, key=lambda item: tuple(ord(character) for character in item))
        ) + "}"
    raise TypeError(f"unsupported canonical JSON type: {type(value).__name__}")


def canonical_sha256(value: object) -> str:
    return "sha256:" + hashlib.sha256(canonical_json_text(value).encode("utf-8")).hexdigest()


def digest_material(document: dict) -> dict:
    fields = document["digest_material_fields"]
    if "canonical_digest" in fields or len(fields) != len(set(fields)):
        raise ValueError("digest material fields must be unique and exclude canonical_digest")
    missing = [field for field in fields if field not in document]
    if missing:
        raise ValueError(f"digest material fields are missing: {missing}")
    return {field: document[field] for field in fields}
