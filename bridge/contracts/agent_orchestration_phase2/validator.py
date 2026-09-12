from __future__ import annotations

import hashlib, json, re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).with_name("schemas")
SHA = re.compile(r"^sha256:[0-9a-f]{64}$")
U64 = re.compile(r"^(0|[1-9][0-9]{0,19})$")
DEC = re.compile(r"^-?(0|[1-9][0-9]*)(\.[0-9]+)?$")
MAX_U64 = 18446744073709551615
IDENTITIES = {
    "tilesim.bridge.agent_orchestration_profile_binding.v1",
    "tilesim.bridge.agent_orchestration_run_intake.v2",
    "tilesim.bridge.agent_orchestration_validation_report.v1",
    "tilesim.bridge.agent_orchestration_calculator_receipt_envelope.v1",
    "tilesim.bridge.agent_orchestration_idempotency_retention_policy.v1",
    "tilesim.bridge.agent_orchestration_model_profile.v2",
    "tilesim.bridge.agent_orchestration_engine_profile.v2",
    "tilesim.bridge.agent_orchestration_device_profile.v2",
    "tilesim.bridge.agent_orchestration_topology_profile.v2",
    "tilesim.bridge.agent_orchestration_workload_profile.v2",
}
RECEIPT_TYPES = {"model_weight_memory","kv_capacity","parallelism","placement","collective_network","workload_distribution","slo_budget"}
RECEIPT_IDS = {f"tilesim.bridge.agent_orchestration_{x}_receipt.v1" for x in RECEIPT_TYPES}

class ContractValidationError(ValueError):
    def __init__(self, message: str, path: str = "/"):
        super().__init__(message); self.path = path

def canonical_digest(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return "sha256:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()

def _err(msg, path="/"): raise ContractValidationError(msg, path)
def _obj(v, path):
    if not isinstance(v, dict): _err("must be an object", path)
def _required(v, fields, path="/"):
    missing = [f for f in fields if f not in v]
    if missing: _err("missing required field: " + missing[0], path + "/" + missing[0])
def _strict(v, allowed, path="/"):
    unknown = set(v) - set(allowed)
    if unknown: _err("unknown field: " + sorted(unknown)[0], path + "/" + sorted(unknown)[0])
def _sha(v, path):
    if not isinstance(v, str) or not SHA.fullmatch(v): _err("invalid sha256", path)
def _id(v, path):
    if not isinstance(v, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,191}", v): _err("invalid stable id", path)
def _u64(v, path, positive=False):
    if not isinstance(v, str) or not U64.fullmatch(v) or int(v) > MAX_U64 or (positive and int(v)==0): _err("invalid uint64 decimal string", path)
def _dec(v, path):
    if not isinstance(v, str) or not DEC.fullmatch(v) or re.fullmatch(r"-0(?:\.0+)?", v): _err("invalid decimal", path)

def _ref(v, path, profile=False):
    _obj(v,path); fields = ["family","profile_id","identity","revision","digest"] if profile else ["identity","revision","digest"]
    _required(v,fields,path); _strict(v,fields,path); _id(v["identity"],path+"/identity"); _sha(v["revision"],path+"/revision"); _sha(v["digest"],path+"/digest")
    if profile: _id(v["profile_id"],path+"/profile_id")

def _provenance(p, path):
    _obj(p,path); _required(p,["kind","source_reference","source_field","evidence_scope"],path); _id(p["source_reference"],path+"/source_reference")
    if p["evidence_scope"] not in {"exploration","synthetic_consistency","limited_extrapolation","similar_regime_conditional_prediction","real_calibrated_validation"}: _err("invalid evidence scope",path+"/evidence_scope")
    if p["kind"] not in {"observed","externally_specified","inferred","modelled","user_supplied"}: _err("invalid provenance kind",path+"/kind")

def _profile(v, identity):
    _obj(v,"/"); _required(v,["schema_identity","schema_revision","profile_family","profile_id","profile_revision","canonical_digest","display","source_reference","source_kind","license","valid_regime","lifecycle","calibration_status","calibration_binding","held_out_validation_status","held_out_validation_binding","allowed_claim_scope","sensitivity","visibility","facts"])
    _strict(v,["schema_identity","schema_revision","profile_family","profile_id","profile_revision","canonical_digest","display","source_reference","source_kind","license","valid_regime","lifecycle","calibration_status","calibration_binding","held_out_validation_status","held_out_validation_binding","allowed_claim_scope","sensitivity","visibility","facts"])
    if v["schema_identity"] != identity: _err("unknown profile identity", "/schema_identity")
    _sha(v["schema_revision"],"/schema_revision"); _id(v["profile_id"],"/profile_id"); _sha(v["profile_revision"],"/profile_revision"); _sha(v["canonical_digest"],"/canonical_digest")
    if v["source_kind"] in {"synthetic_trace","compatibility_harness_trace","user_input"}:
        if v["calibration_status"] == "calibrated" or v["held_out_validation_status"] == "validated": _err("provenance cannot self-promote", "/calibration_status")
        if v["allowed_claim_scope"] not in {"exploration","synthetic_consistency"}: _err("claim scope exceeds provenance", "/allowed_claim_scope")
    if not isinstance(v["facts"],dict) or not v["facts"]: _err("facts required", "/facts")
    for k,f in v["facts"].items():
        _obj(f,"/facts/"+k); _required(f,["value","unit","provenance"],"/facts/"+k); _provenance(f["provenance"],"/facts/"+k+"/provenance")

def validate_contract(value: Any, *, expected_revision: str | None = None) -> dict:
    _obj(value,"/"); identity=value.get("schema_identity")
    if identity not in IDENTITIES: _err("unknown schema identity", "/schema_identity")
    _sha(value.get("schema_revision"),"/schema_revision")
    if expected_revision and value["schema_revision"] != expected_revision: _err("schema revision mismatch", "/schema_revision")
    if identity.endswith("profile.v2"):
        _profile(value, identity); return value
    if identity.endswith("profile_binding.v1"):
        _required(value,["schema_identity","schema_revision","binding_id","binding_digest","model","engine","device","topology","workload","fidelity","gpu_participation_mode"])
        _id(value["binding_id"],"/binding_id"); _sha(value["binding_digest"],"/binding_digest")
        for fam in ("model","engine","device","topology","workload"): _ref(value[fam],"/"+fam,True)
        return value
    if identity.endswith("run_intake.v2"):
        _required(value,["schema_identity","schema_revision","intake_id","canonical_digest","profile_binding","device_count","parallelism","placement","kv_cache","collective_policy","workload","topology_network_binding","requested_fidelity","gpu_participation_mode","trace_source","slos","budget"])
        _id(value["intake_id"],"/intake_id"); _sha(value["canonical_digest"],"/canonical_digest"); validate_contract(value["profile_binding"])
        for k in ("device_count","candidate_count","run_count","simulation_time_ps","wall_time_ps"): 
            if k in value.get("budget",{}): _u64(value["budget"][k],"/budget/"+k)
        if value["trace_source"]["mode"] != "real_trace" and value["trace_source"]["allowed_claim_scope"] not in {"exploration","synthetic_consistency"}: _err("claim scope exceeds trace provenance", "/trace_source/allowed_claim_scope")
        return value
    if identity.endswith("calculator_receipt_envelope.v1"):
        _required(value,["schema_identity","schema_revision","receipt_identity","receipt_revision","receipt_type","calculator_identity","algorithm_revision","input_references","units","result","rounding_policy","assumptions","uncertainty","rule_ids","repair_candidates","claim_scope_ceiling","typed_facts"])
        if value["receipt_type"] not in RECEIPT_TYPES or value["receipt_identity"] not in RECEIPT_IDS: _err("receipt identity/type mismatch", "/receipt_identity")
        _sha(value["receipt_revision"],"/receipt_revision"); _sha(value["algorithm_revision"],"/algorithm_revision")
        r=value["result"]; _obj(r,"/result");
        if r.get("kind") == "exact": _dec(r.get("value"),"/result/value")
        elif r.get("kind") == "interval": _dec(r.get("lower"),"/result/lower"); _dec(r.get("upper"),"/result/upper"); _dec(r.get("confidence"),"/result/confidence")
        elif r.get("kind") != "unknown": _err("invalid result kind", "/result/kind")
        return value
    if identity.endswith("validation_report.v1"):
        _required(value,["schema_identity","schema_revision","report_id","report_digest","input_binding","profile_snapshot_binding","capability_snapshot_binding","backend_binding","validation_policy_revision","overall_status","issues","calculator_receipts","compiled_request_preview","field_to_pointer_map","candidate_plan","budget","claim_scope_ceiling","stale_binding"])
        _id(value["report_id"],"/report_id"); _sha(value["report_digest"],"/report_digest");
        for r in value.get("calculator_receipts",[]): validate_contract(r)
        return value
    if identity.endswith("idempotency_retention_policy.v1"):
        _required(value,["schema_identity","schema_revision","canonicalization_identity","idempotency","retention","forbidden_persistence"])
        if value["canonicalization_identity"] != "tilesim.bridge.canonical_json.v1": _err("unknown canonicalization identity", "/canonicalization_identity")
        if set(value["forbidden_persistence"]) != {"credential","hidden_reasoning","raw_provider_response"}: _err("forbidden persistence set mismatch", "/forbidden_persistence")
        return value
    return value
