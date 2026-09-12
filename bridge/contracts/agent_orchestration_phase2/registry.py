"""Fail-closed Phase 2D Profile v2 registry.

The registry is deliberately separate from the immutable Phase 2A Capability
Catalog.  It publishes source-backed profile records for inspection and
binding, but it never upgrades the Phase 2C runtime to executable status.
"""

from __future__ import annotations

import copy
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping

from .validator import ContractValidationError, canonical_digest, validate_contract

ROOT = Path(__file__).parent
REGISTRY_IDENTITY = "tilesim.bridge.agent_orchestration_profile_registry.v1"
SNAPSHOT_IDENTITY = "tilesim.bridge.agent_orchestration_profile_snapshot.v1"
BINDING_IDENTITY = "tilesim.bridge.agent_orchestration_profile_binding.v1"
FAMILIES = ("model", "engine", "device", "topology", "workload")
PROFILE_IDENTITIES = {
    family: f"tilesim.bridge.agent_orchestration_{family}_profile.v2"
    for family in FAMILIES
}
SCHEMA_FILES = {family: ROOT / "schemas" / f"{family}-profile.schema.json" for family in FAMILIES}
_PUBLIC_NOW = "2026-09-12T00:00:00+00:00"


def _fact(value: Any, unit: str | None, source: str, field: str, scope: str) -> dict[str, Any]:
    return {
        "value": value,
        "unit": unit,
        "provenance": {
            "kind": "observed" if source.startswith("hf_") else "externally_specified",
            "source_reference": source,
            "source_field": field,
            "evidence_scope": scope,
        },
    }


def _profile_base(family: str, profile_id: str, name: str, description: str, source: str,
                  source_kind: str, license_id: str, regime: str, scope: str, facts: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema_identity": PROFILE_IDENTITIES[family],
        "schema_revision": "",
        "profile_family": family,
        "profile_id": profile_id,
        "profile_revision": "",
        "canonical_digest": "",
        "display": {"name": name, "description": description, "labels": ["phase2d", family, "source-backed"]},
        "source_reference": source,
        "source_kind": source_kind,
        "license": {"spdx_id": license_id, "redistribution_allowed": license_id != "NOASSERTION"},
        "valid_regime": {"description": regime, "constraints": [regime]},
        "lifecycle": {"introduced_at": _PUBLIC_NOW, "updated_at": _PUBLIC_NOW, "expires_at": None, "status": "available"},
        "calibration_status": "missing",
        "calibration_binding": None,
        "held_out_validation_status": "missing",
        "held_out_validation_binding": None,
        "allowed_claim_scope": scope,
        "sensitivity": "public",
        "visibility": "catalog",
        "facts": facts,
    }


def _raw_profiles() -> dict[str, dict[str, Any]]:
    return {
        "model": _profile_base(
            "model", "mistralai.mistral-7b-v0.1", "Mistral 7B v0.1",
            "Public model configuration facts used for structural simulation inputs.", "hf_mistral_7b_v01_config",
            "reviewed_registry", "Apache-2.0", "Mistral-7B-v0.1 configuration and model-card facts; no timing claim.",
            "real_calibrated_validation", {
                "architecture": _fact("MistralForCausalLM", None, "hf_mistral_7b_v01_config", "architecture", "exploration"),
                "parameter_count": _fact("7241732096", "parameters", "hf_mistral_7b_v01_model_card", "parameter_count", "exploration"),
                "layer_count": _fact("32", "layers", "hf_mistral_7b_v01_config", "num_hidden_layers", "exploration"),
                "hidden_size": _fact("4096", "elements", "hf_mistral_7b_v01_config", "hidden_size", "exploration"),
                "expert_structure": _fact("dense", None, "hf_mistral_7b_v01_config", "architectures", "exploration"),
                "tensor_layout": _fact("bfloat16; grouped-query attention", None, "hf_mistral_7b_v01_config", "torch_dtype,num_key_value_heads", "exploration"),
            }),
        "engine": _profile_base(
            "engine", "vllm.0.6.semantic.v1", "TileSim vLLM semantic profile",
            "Backend-local semantic subset; not a complete commercial engine capability declaration.", "tilesim_backend_engine_semantic_profile",
            "reviewed_registry", "NOASSERTION", "TileSim backend semantic subset for vLLM 0.6; execution evidence is absent.",
            "exploration", {
                "engine_name": _fact("vllm", None, "tilesim_backend_engine_semantic_profile", "engine_type", "exploration"),
                "engine_version": _fact("0.6", None, "tilesim_backend_engine_semantic_profile", "semantic_version", "exploration"),
                "semantic_profile": _fact("vllm.0.6.semantic.v1", None, "tilesim_backend_engine_semantic_profile", "semantic_version", "exploration"),
                "batching_policy": _fact("decode_first_continuous_batch", None, "tilesim_backend_engine_semantic_profile", "scheduler_kind,ordered_decisions", "exploration"),
                "supported_features": _fact(["continuous_batching", "chunked_prefill", "prefix_cache", "preemption_recompute"], None, "tilesim_backend_engine_semantic_profile", "supported_features", "exploration"),
            }),
        "device": _profile_base(
            "device", "nvidia.a100-80gb-sxm", "NVIDIA A100 80GB SXM structural profile",
            "Vendor structural specification only; no measured timing or compute claim.", "nvidia_a100_80gb_sxm_spec",
            "vendor_specification", "NOASSERTION", "A100 80GB SXM structural specification; calibration and held-out validation absent.",
            "exploration", {
                "device_model": _fact("NVIDIA A100 80GB SXM", None, "nvidia_a100_80gb_sxm_spec", "product_name", "exploration"),
                "memory_capacity_bytes": _fact("85899345920", "bytes", "nvidia_a100_80gb_sxm_spec", "memory_capacity", "exploration"),
                "compute_profile_reference": _fact("vendor_structural_only", None, "nvidia_a100_80gb_sxm_spec", "compute_profile", "exploration"),
                "interconnect_endpoints": _fact("12", "links", "nvidia_a100_80gb_sxm_spec", "nvlink_links", "exploration"),
            }),
        "topology": _profile_base(
            "topology", "generic-hierarchical-fabric.4gpu", "Generic four-device hierarchical fabric",
            "Compatibility-harness topology fixture; not a physical-system calibration.", "tilesim_modular_fabric_fixture",
            "compatibility_harness_trace", "NOASSERTION", "TileSim modular fabric compatibility fixture; synthetic consistency only.",
            "synthetic_consistency", {
                "topology_kind": _fact("generic_hierarchical_fabric", None, "tilesim_modular_fabric_fixture", "topology.topology_name", "synthetic_consistency"),
                "endpoint_count": _fact("4", "devices", "tilesim_modular_fabric_fixture", "topology.devices", "synthetic_consistency"),
                "link_bandwidth_gbps": _fact("450", "Gbps", "tilesim_modular_fabric_fixture", "scale_up.bandwidth_gbps", "synthetic_consistency"),
                "link_latency_ps": _fact("800000", "ps", "tilesim_modular_fabric_fixture", "scale_up.latency_us", "synthetic_consistency"),
                "routing_policy": _fact("module_binding_with_fallback", None, "tilesim_modular_fabric_fixture", "topology.domains.failure_policy", "synthetic_consistency"),
            }),
        "workload": _profile_base(
            "workload", "s0-synthetic-example.seed7", "TileSim synthetic workload example",
            "No-GPU-dependency workload fixture for semantic and consistency tests.", "tilesim_s0_synthetic_workload_example",
            "synthetic_trace", "NOASSERTION", "Synthetic workload example; not real-trace ground truth.",
            "synthetic_consistency", {
                "template_kind": _fact("s0_synthetic_profile", None, "tilesim_s0_synthetic_workload_example", "synthetic_profile.request_id_prefix", "synthetic_consistency"),
                "request_count": _fact("4", "requests", "tilesim_s0_synthetic_workload_example", "synthetic_profile.request_count", "synthetic_consistency"),
                "input_tokens": _fact("128-256", "tokens/request", "tilesim_s0_synthetic_workload_example", "synthetic_profile.prompt_tokens_min,max", "synthetic_consistency"),
                "output_tokens": _fact("1-4", "tokens/request", "tilesim_s0_synthetic_workload_example", "synthetic_profile.decode_tokens_min,max", "synthetic_consistency"),
                "arrival_process": _fact("deterministic_burst_seed7", None, "tilesim_s0_synthetic_workload_example", "synthetic_profile.seed,base_interarrival_ps,burst_size", "synthetic_consistency"),
            }),
    }


def _schema_revision(family: str) -> str:
    return canonical_digest(json.loads(SCHEMA_FILES[family].read_text(encoding="utf-8")))


def seal_profile(profile: Mapping[str, Any]) -> dict[str, Any]:
    """Return a deterministic profile with schema/profile/canonical digests sealed."""
    value = copy.deepcopy(dict(profile))
    family = value["profile_family"]
    value["schema_revision"] = _schema_revision(family)
    value["profile_revision"] = ""
    value["canonical_digest"] = ""
    digest = canonical_digest(value)
    value["canonical_digest"] = digest
    value["profile_revision"] = canonical_digest(value)
    return value


def _validate_typed_facts(profile: Mapping[str, Any]) -> None:
    required = {
        "model": {"architecture", "parameter_count", "layer_count", "hidden_size", "expert_structure", "tensor_layout"},
        "engine": {"engine_name", "engine_version", "semantic_profile", "batching_policy", "supported_features"},
        "device": {"device_model", "memory_capacity_bytes", "compute_profile_reference", "interconnect_endpoints"},
        "topology": {"topology_kind", "endpoint_count", "link_bandwidth_gbps", "link_latency_ps", "routing_policy"},
        "workload": {"template_kind", "request_count", "input_tokens", "output_tokens", "arrival_process"},
    }[profile["profile_family"]]
    facts = profile["facts"]
    if set(facts) != required:
        raise ContractValidationError("profile required facts mismatch", "/facts")
    for name in ("parameter_count", "layer_count", "hidden_size", "memory_capacity_bytes", "interconnect_endpoints", "endpoint_count", "link_latency_ps", "request_count"):
        if name in facts and (not isinstance(facts[name]["value"], str) or not facts[name]["value"].isdigit()):
            raise ContractValidationError("typed uint64 fact must be decimal string", f"/facts/{name}/value")


def _source_catalog() -> dict[str, dict[str, Any]]:
    return {
        "hf_mistral_7b_v01_config": {"kind": "reviewed_registry", "uri": "https://huggingface.co/mistralai/Mistral-7B-v0.1/resolve/27d67f1b5f57dc0953326b2601d68371d40ea8da/config.json", "revision": "27d67f1b5f57dc0953326b2601d68371d40ea8da", "license": "Apache-2.0", "claim_scope": "exploration"},
        "hf_mistral_7b_v01_model_card": {"kind": "reviewed_registry", "uri": "https://huggingface.co/mistralai/Mistral-7B-v0.1", "revision": "27d67f1b5f57dc0953326b2601d68371d40ea8da", "license": "Apache-2.0", "claim_scope": "exploration"},
        "tilesim_backend_engine_semantic_profile": {"kind": "reviewed_registry", "uri": "D:/tileSim/src/S1_Runtime/EngineSemanticProfile.cpp", "revision": "working-tree", "license": "NOASSERTION", "claim_scope": "exploration"},
        "nvidia_a100_80gb_sxm_spec": {"kind": "vendor_specification", "uri": "https://www.nvidia.com/en-us/data-center/a100/", "revision": "public-specification", "license": "NOASSERTION", "claim_scope": "exploration"},
        "tilesim_modular_fabric_fixture": {"kind": "compatibility_harness_trace", "uri": "D:/tileSim/docs/examples/modular_fabric_scenario.json", "revision": "working-tree", "license": "NOASSERTION", "claim_scope": "synthetic_consistency"},
        "tilesim_s0_synthetic_workload_example": {"kind": "synthetic_trace", "uri": "D:/tileSim/docs/examples/s0_synthetic_workload.json", "revision": "working-tree", "license": "NOASSERTION", "claim_scope": "synthetic_consistency"},
    }


def build_registry() -> dict[str, Any]:
    records: dict[str, list[dict[str, Any]]] = {family: [] for family in FAMILIES}
    for family, raw in _raw_profiles().items():
        profile = seal_profile(raw)
        records[family].append({
            "profile": profile,
            "record_status": "conditional",
            "runtime_status": "unavailable",
            "execution_status": "missing",
            "agent_exposed": False,
            "calculator_eligible": False,
            "ranking_eligible": False,
        })
    material = {"schema_identity": REGISTRY_IDENTITY, "publication_status": "published", "profile_families": list(FAMILIES), "records": records, "sources": _source_catalog(), "fail_closed": ["unknown_identity", "revision_drift", "digest_mismatch", "expired", "revoked", "visibility_mismatch", "sensitivity_mismatch", "missing_calibration", "missing_held_out_validation"]}
    digest = canonical_digest(material)
    material["registry_revision"] = digest
    material["registry_digest"] = digest
    validate_registry(material)
    return material


def validate_registry(registry: Mapping[str, Any]) -> None:
    if registry.get("schema_identity") != REGISTRY_IDENTITY or registry.get("publication_status") != "published":
        raise ContractValidationError("unknown or unpublished registry", "/schema_identity")
    if tuple(registry.get("profile_families", ())) != FAMILIES:
        raise ContractValidationError("profile family order mismatch", "/profile_families")
    records = registry.get("records")
    sources = registry.get("sources")
    if not isinstance(records, dict) or not isinstance(sources, dict):
        raise ContractValidationError("registry records and sources are required", "/records")
    for family in FAMILIES:
        if not isinstance(records.get(family), list) or len(records[family]) != 1:
            raise ContractValidationError("registry must contain one published record per family", f"/records/{family}")
        entry = records[family][0]
        profile = entry.get("profile")
        validate_contract(profile, expected_revision=_schema_revision(family))
        _validate_typed_facts(profile)
        if profile["source_reference"] not in sources:
            raise ContractValidationError("profile source is not catalogued", f"/records/{family}/profile/source_reference")
        source = sources[profile["source_reference"]]
        if source["kind"] != profile["source_kind"]:
            raise ContractValidationError("profile/source kind mismatch", f"/records/{family}/profile/source_kind")
        if source["license"] != profile["license"]["spdx_id"]:
            raise ContractValidationError("profile/source license mismatch", f"/records/{family}/profile/license")
        if entry.get("agent_exposed") is not False or entry.get("calculator_eligible") is not False or entry.get("ranking_eligible") is not False:
            raise ContractValidationError("unvalidated profile cannot be exposed or ranked", f"/records/{family}")
        for fact_name, fact in profile["facts"].items():
            if fact["provenance"]["source_reference"] not in sources:
                raise ContractValidationError("fact provenance source is not catalogued", f"/records/{family}/profile/facts/{fact_name}")
        resealed = seal_profile(profile)
        if resealed["canonical_digest"] != profile["canonical_digest"] or resealed["profile_revision"] != profile["profile_revision"]:
            raise ContractValidationError("profile digest mismatch", f"/records/{family}/profile")
    material = copy.deepcopy(dict(registry)); material.pop("registry_revision", None); material.pop("registry_digest", None)
    expected = canonical_digest(material)
    if registry.get("registry_revision") != expected or registry.get("registry_digest") != expected:
        raise ContractValidationError("registry digest mismatch", "/registry_digest")


def load_registry() -> dict[str, Any]:
    return copy.deepcopy(build_registry())


def query_profiles(*, family: str | None = None, visibility: str = "catalog", sensitivity: str = "public", include_unavailable: bool = False) -> list[dict[str, Any]]:
    registry = load_registry()
    families = (family,) if family else FAMILIES
    if any(item not in FAMILIES for item in families):
        return []
    result = []
    for item in families:
        for entry in registry["records"][item]:
            profile = entry["profile"]
            if profile["visibility"] != visibility or profile["sensitivity"] != sensitivity:
                continue
            if profile["lifecycle"]["status"] in {"expired", "revoked", "unavailable"}:
                continue
            if not include_unavailable and entry["runtime_status"] != "available":
                continue
            result.append(copy.deepcopy(entry))
    return result


def build_snapshot() -> dict[str, Any]:
    registry = load_registry()
    material = {"schema_identity": SNAPSHOT_IDENTITY, "publication_status": "published", "registry_identity": REGISTRY_IDENTITY, "registry_revision": registry["registry_revision"], "profile_references": [{"family": family, "profile_id": registry["records"][family][0]["profile"]["profile_id"], "revision": registry["records"][family][0]["profile"]["profile_revision"], "digest": registry["records"][family][0]["profile"]["canonical_digest"]} for family in FAMILIES], "stale_policy": "fail_closed"}
    digest = canonical_digest(material)
    material["snapshot_revision"] = digest
    material["snapshot_digest"] = digest
    return material


def validate_snapshot(snapshot: Mapping[str, Any], *, registry: Mapping[str, Any] | None = None) -> None:
    current = registry or load_registry()
    validate_registry(current)
    if snapshot.get("schema_identity") != SNAPSHOT_IDENTITY or snapshot.get("registry_revision") != current["registry_revision"]:
        raise ContractValidationError("stale profile snapshot", "/registry_revision")
    material = copy.deepcopy(dict(snapshot)); material.pop("snapshot_revision", None); material.pop("snapshot_digest", None)
    expected = canonical_digest(material)
    if snapshot.get("snapshot_revision") != expected or snapshot.get("snapshot_digest") != expected:
        raise ContractValidationError("snapshot digest mismatch", "/snapshot_digest")
    refs = {(family, current["records"][family][0]["profile"]["profile_id"], current["records"][family][0]["profile"]["profile_revision"], current["records"][family][0]["profile"]["canonical_digest"]) for family in FAMILIES}
    actual = {(item.get("family"), item.get("profile_id"), item.get("revision"), item.get("digest")) for item in snapshot.get("profile_references", [])}
    if actual != refs:
        raise ContractValidationError("snapshot profile reference mismatch", "/profile_references")


def build_profile_binding(profile_ids: Mapping[str, str], *, fidelity: str = "DES", gpu_participation_mode: str = "gpu_free") -> dict[str, Any]:
    registry = load_registry()
    refs = {}
    for family in FAMILIES:
        entry = next((item for item in registry["records"][family] if item["profile"]["profile_id"] == profile_ids.get(family)), None)
        if entry is None:
            raise ContractValidationError("unknown profile binding reference", f"/{family}")
        profile = entry["profile"]
        refs[family] = {"family": family, "profile_id": profile["profile_id"], "identity": profile["schema_identity"], "revision": profile["profile_revision"], "digest": profile["canonical_digest"]}
    value = {"schema_identity": BINDING_IDENTITY, "schema_revision": canonical_digest(json.loads((ROOT / "schemas" / "profile-binding.schema.json").read_text(encoding="utf-8"))), "binding_id": "phase2d.profile-binding", "binding_digest": "", **refs, "fidelity": fidelity, "gpu_participation_mode": gpu_participation_mode}
    material = copy.deepcopy(value); material["binding_digest"] = ""
    value["binding_digest"] = canonical_digest(material)
    return value


def executable_combinations() -> list[dict[str, Any]]:
    """No Phase 2D combination is executable until lowering/calibration closes."""
    return []
