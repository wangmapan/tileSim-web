"""Canonical identity of the checked-in Bridge contract set."""

import hashlib
import json
from pathlib import Path


def compute_schema_set_revision(contract_root: Path) -> str:
    documents = {}
    for path in sorted(contract_root.rglob("*.json")):
        value = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(value, dict):
            raise ValueError(f"Bridge contract must be a JSON object: {path}")
        documents[path.relative_to(contract_root).as_posix()] = value
    canonical = json.dumps(documents, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return "sha256:" + hashlib.sha256(canonical).hexdigest()
