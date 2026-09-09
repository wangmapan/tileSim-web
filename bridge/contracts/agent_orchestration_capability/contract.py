"""Immutable, non-self-referential Agent orchestration capability publication."""

from __future__ import annotations

import copy
import hashlib
import json
import re
from pathlib import Path
from typing import Any, Mapping

CATALOG_IDENTITY = "tilesim.bridge.agent_orchestration_capability_catalog.v1"
SNAPSHOT_IDENTITY = "tilesim.bridge.agent_orchestration_capability_snapshot.v1"
_SHA = re.compile(r"^sha256:[0-9a-f]{64}$")
_GIT = re.compile(r"^[0-9a-f]{40}$")
_CATALOG_PATH = Path(__file__).with_name("catalog-content.json")
_SCHEMA_PATH = Path(__file__).with_name("schemas")
_EXPOSED = (
    "s0.workload.message_size_multiplier",
    "s1.runtime.batch_scheduler",
    "s1.runtime.max_batch_size",
    "s1.runtime.kv_capacity_tokens",
    "s6.fabric.scale_up_bandwidth_gbps",
    "s6.fabric.scale_up_latency_us",
    "s6.fabric.scale_out_bandwidth_gbps",
    "s6.fabric.scale_out_latency_us",
)
_NESTED = (
    "tilesim.design_space.s6_candidates.v1",
    "tilesim.design_space.s6_candidates.v2",
)
_RELEASE_KEYS = {
    "web_source_revision",
    "web_build_revision",
    "backend_revision",
    "schema_set_revision",
    "experiment_descriptor_revision",
    "catalog_revision",
    "contract_package_revision",
}
_SNAPSHOT_BINDING_KEYS = _RELEASE_KEYS | {
    "web_source_identity",
    "backend_identity",
    "experiment_descriptor_identity",
    "create_run_identity",
    "nested_design_space_identities",
    "default_nested_design_space_identity",
}


def _canonical(value: Any) -> str:
    if value is None or isinstance(value, (str, bool)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, int) and not isinstance(value, bool):
        if value < 0 or value > 9007199254740991:
            raise ValueError("canonical capability JSON only accepts safe integers")
        return str(value)
    if isinstance(value, float):
        raise ValueError("canonical capability JSON forbids floating point values")
    if isinstance(value, list):
        return "[" + ",".join(_canonical(item) for item in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value, key=lambda item: tuple(map(ord, item)))
        return "{" + ",".join(f"{_canonical(key)}:{_canonical(value[key])}" for key in keys) + "}"
    raise TypeError(f"unsupported canonical value: {type(value).__name__}")


def canonical_sha256(value: Any) -> str:
    return "sha256:" + hashlib.sha256(_canonical(value).encode("utf-8")).hexdigest()


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def load_catalog() -> dict[str, Any]:
    try:
        catalog = json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError("capability catalog is unavailable or malformed") from exc
    validate_catalog(catalog)
    return copy.deepcopy(catalog)


def _schema_documents() -> dict[str, Any]:
    documents = {}
    for path in sorted(_SCHEMA_PATH.glob("*.schema.json")):
        document = json.loads(path.read_text(encoding="utf-8"))
        documents[document["$id"].rsplit("/", 1)[-1]] = document
    _require(len(documents) == 9, "capability contract package must contain nine schemas")
    return documents


def validate_catalog(catalog: Mapping[str, Any]) -> None:
    _require(isinstance(catalog, dict), "catalog must be an object")
    _require(catalog.get("schema_identity") == CATALOG_IDENTITY, "unknown catalog identity")
    _require(catalog.get("publication_status") == "published", "catalog is not published")
    _require(_SHA.match(str(catalog.get("catalog_revision", ""))) is not None, "invalid catalog revision")
    material = copy.deepcopy(dict(catalog))
    material.pop("catalog_revision", None)
    material.pop("catalog_digest", None)
    expected = canonical_sha256(material)
    _require(catalog.get("catalog_digest") == expected and catalog.get("catalog_revision") == expected, "catalog digest mismatch")
    schemas = _schema_documents()
    _require(catalog.get("contract_package_revision") == canonical_sha256(schemas), "contract package digest mismatch")
    parameter_revision = canonical_sha256(schemas["parameter-descriptor.schema.json"])
    _require(catalog.get("parameter_descriptor_schema_revision") == parameter_revision and catalog.get("parameter_descriptor_schema_digest") == parameter_revision, "parameter schema digest mismatch")
    _require(tuple(catalog.get("agent_exposed_field_ids", ())) == _EXPOSED, "agent-exposed field closure mismatch")
    descriptors = catalog.get("parameter_descriptors")
    _require(isinstance(descriptors, list) and tuple(item.get("field_id") for item in descriptors) == _EXPOSED, "parameter descriptors mismatch")
    for descriptor in descriptors:
        state = descriptor.get("capability_state", {})
        _require(all(state.get(name, {}).get("state") == "affirmed" for name in ("described", "accepted", "validated", "lowered", "executed", "observable", "agent_exposed")), "capability state is incomplete")
        _require(state.get("calibrated", {}).get("state") == "denied", "calibration cannot be affirmed")
        _require(state.get("held_out_validated", {}).get("state") == "denied", "held-out validation cannot be affirmed")
        _require(descriptor.get("execution_evidence"), f"missing execution evidence: {descriptor.get('field_id')}")
        _require(tuple(descriptor.get("claim_scope_ceiling", ())) == ("exploration", "synthetic_consistency"), "claim scope exceeds evidence")
    kv = descriptors[3]
    _require(kv["field_id"] == "s1.runtime.kv_capacity_tokens" and kv.get("applicability", {}).get("status") == "conditional", "KV capability must remain conditional")
    _require("gap_kv_001_logical_admission_only" in kv.get("reason_codes", ()), "GAP-KV-001 binding is missing")
    for descriptor in descriptors[6:]:
        _require(descriptor.get("resolved_fidelity") == "Analytical", "scale-out capability must remain Analytical")
    profiles = catalog.get("profile_families")
    _require(isinstance(profiles, list) and [item.get("family") for item in profiles] == ["model", "engine", "device", "topology", "workload"], "profile families mismatch")
    for profile in profiles:
        _require(profile.get("actual_profile_count") == 0 and profile.get("runtime_availability") == "unavailable", "profile data must remain unavailable")
        _require("profile_missing" in profile.get("reason_codes", []), "profile missing reason is required")
        schema_revision = canonical_sha256(schemas[f"{profile['family']}-profile.schema.json"])
        _require(profile.get("schema_revision") == schema_revision and profile.get("schema_digest") == schema_revision, "profile schema digest mismatch")
    records = catalog.get("profile_records")
    _require(isinstance(records, dict) and set(records) == {"model", "engine", "device", "topology", "workload"}, "profile record families mismatch")
    _require(all(value == [] for value in records.values()), "actual profile records must remain empty")
    not_exposed = catalog.get("not_exposed_capabilities", [])
    _require(len(not_exposed) == 9, "not-exposed capability closure mismatch")
    _require(all(item.get("state") == "not_exposed" and item.get("reason_code") == "not_exposed_to_agent" for item in not_exposed), "a prohibited capability is exposed")


def validate_release_binding(binding: Mapping[str, Any], catalog: Mapping[str, Any]) -> None:
    _require(isinstance(binding, dict), "release metadata must be an object")
    keys = set(binding)
    _require(keys in (_RELEASE_KEYS, _SNAPSHOT_BINDING_KEYS), "release metadata is incomplete or has unknown fields")
    for key in ("web_source_revision", "web_build_revision", "backend_revision"):
        _require(_GIT.match(str(binding.get(key, ""))) is not None, f"invalid {key}")
    for key in ("schema_set_revision", "experiment_descriptor_revision", "catalog_revision", "contract_package_revision"):
        _require(_SHA.match(str(binding.get(key, ""))) is not None, f"invalid {key}")
    if keys == _SNAPSHOT_BINDING_KEYS:
        _require(binding["web_source_identity"] == "tilesim.web.git", "unknown web source identity")
        _require(binding["backend_identity"] == "tilesim.backend.git", "unknown backend identity")
        _require(binding["experiment_descriptor_identity"] == "tilesim.bridge.experiment_descriptor.v1", "unknown descriptor identity")
        _require(binding["create_run_identity"] == "tilesim.bridge.create_run_request.v1", "unknown create-run identity")
        _require(tuple(binding["nested_design_space_identities"]) == _NESTED, "nested design-space identity mismatch")
        _require(binding["default_nested_design_space_identity"] in _NESTED, "unknown default nested design-space identity")
    _require(binding["catalog_revision"] == catalog["catalog_revision"], "catalog revision drift")
    _require(binding["contract_package_revision"] == catalog["contract_package_revision"], "contract package drift")


def build_snapshot(release_metadata: Mapping[str, Any], *, default_nested_design_space_identity: str = _NESTED[0]) -> dict[str, Any]:
    catalog = load_catalog()
    validate_release_binding(release_metadata, catalog)
    _require(default_nested_design_space_identity in _NESTED, "unknown nested design-space identity")
    binding = {
        "web_source_identity": "tilesim.web.git",
        "web_source_revision": release_metadata["web_source_revision"],
        "web_build_revision": release_metadata["web_build_revision"],
        "backend_identity": "tilesim.backend.git",
        "backend_revision": release_metadata["backend_revision"],
        "schema_set_revision": release_metadata["schema_set_revision"],
        "experiment_descriptor_identity": "tilesim.bridge.experiment_descriptor.v1",
        "experiment_descriptor_revision": release_metadata["experiment_descriptor_revision"],
        "create_run_identity": "tilesim.bridge.create_run_request.v1",
        "nested_design_space_identities": list(_NESTED),
        "default_nested_design_space_identity": default_nested_design_space_identity,
        "catalog_revision": release_metadata["catalog_revision"],
        "contract_package_revision": release_metadata["contract_package_revision"],
    }
    snapshot = {
        "schema_identity": SNAPSHOT_IDENTITY,
        "publication_status": "published",
        "snapshot_id": "tilesim.agent-orchestration.capability-snapshot",
        "canonicalization_identity": "tilesim.bridge.canonical_json.v1",
        "catalog": catalog,
        "release_binding": binding,
        "drift_policy": {
            "release_binding_mismatch": "fail_closed",
            "catalog_revision_mismatch": "fail_closed",
            "unknown_identity_or_status": "fail_closed",
        },
    }
    digest_material = copy.deepcopy(snapshot)
    snapshot_digest = canonical_sha256(digest_material)
    snapshot["snapshot_revision"] = snapshot_digest
    snapshot["snapshot_digest"] = snapshot_digest
    validate_snapshot(snapshot)
    return copy.deepcopy(snapshot)


def validate_snapshot(snapshot: Mapping[str, Any]) -> None:
    _require(isinstance(snapshot, dict) and snapshot.get("schema_identity") == SNAPSHOT_IDENTITY, "unknown snapshot identity")
    _require(snapshot.get("publication_status") == "published", "snapshot is not published")
    _require(_SHA.match(str(snapshot.get("snapshot_revision", ""))) is not None, "invalid snapshot revision")
    material = copy.deepcopy(dict(snapshot))
    material.pop("snapshot_revision", None)
    material.pop("snapshot_digest", None)
    expected = canonical_sha256(material)
    _require(snapshot.get("snapshot_digest") == expected and snapshot.get("snapshot_revision") == expected, "snapshot digest mismatch")
    catalog = snapshot.get("catalog")
    validate_catalog(catalog)
    validate_release_binding(snapshot.get("release_binding"), catalog)
