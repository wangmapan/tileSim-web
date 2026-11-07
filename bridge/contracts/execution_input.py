"""Closed, schema-driven execution input validation (no user code execution)."""
from __future__ import annotations

import copy
import json
import math
import re
from pathlib import Path

from .validation import RequestValidationError

SCHEMA = json.loads((Path(__file__).parent / "schemas/execution-input.schema.json").read_text(encoding="utf-8"))


def pointer(path, key):
    return path + "/" + str(key).replace("~", "~0").replace("/", "~1")


def check(value, schema, path="/execution_input"):
    """Interpret the bounded contract vocabulary; semantic admission remains the CLI's job."""
    def reject(message, at=path):
        raise RequestValidationError(message, at)
    if "$ref" in schema:
        check(value, SCHEMA["$defs"][schema["$ref"].split("/")[-1]], path)
        return
    if schema.get("x-uint64"):
        if type(value) not in (int, str) or not str(value).isdigit() or int(value) > 18446744073709551615 or int(value) < schema["anyOf"][0].get("minimum", 0):
            reject("Expected an exact uint64 integer")
    if "const" in schema and value != schema["const"]:
        reject("Expected " + str(schema["const"]))
    if "enum" in schema and value not in schema["enum"]:
        reject("Unsupported value; expected " + ", ".join(map(str, schema["enum"])))
    kind = schema.get("type")
    if kind:
        matches = {"object": isinstance(value, dict), "array": isinstance(value, list),
                   "string": isinstance(value, str), "boolean": type(value) is bool,
                   "integer": type(value) is int, "number": type(value) in (int, float)}
        if not matches.get(kind, False):
            reject("Expected " + kind)
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                reject("Required field", pointer(path, key))
        for key, child in value.items():
            child_schema = schema.get("properties", {}).get(key)
            if child_schema is None:
                child_schema = schema.get("additionalProperties", True)
            if child_schema is False:
                reject("Unsupported field", pointer(path, key))
            if isinstance(child_schema, dict):
                check(child, child_schema, pointer(path, key))
            if "propertyNames" in schema:
                check(key, schema["propertyNames"], pointer(path, key))
        if len(value) < schema.get("minProperties", 0) or len(value) > schema.get("maxProperties", math.inf):
            reject("Object size outside contract limits")
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0) or len(value) > schema.get("maxItems", math.inf):
            reject("Array size outside contract limits")
        if schema.get("uniqueItems") and len({json.dumps(x, sort_keys=True) for x in value}) != len(value):
            reject("Duplicate identities")
        for i, item in enumerate(value):
            check(item, schema.get("items", {}), pointer(path, i))
    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0) or len(value) > schema.get("maxLength", math.inf):
            reject("String size outside contract limits")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            reject("Invalid selector or integer spelling")
    if type(value) in (int, float):
        if not math.isfinite(value) or value < schema.get("minimum", -math.inf) or value > schema.get("maximum", math.inf):
            reject("Value outside contract limits")
        if "exclusiveMinimum" in schema and value <= schema["exclusiveMinimum"]:
            reject("Value must exceed " + str(schema["exclusiveMinimum"]))
    for keyword in ("oneOf", "anyOf"):
        if keyword in schema:
            successes = 0
            for alternative in schema[keyword]:
                try:
                    check(value, alternative, path)
                    successes += 1
                except RequestValidationError:
                    pass
            if not successes or (keyword == "oneOf" and successes != 1):
                reject("Configuration must match exactly one declared source/resource mode")
    if "not" in schema:
        try:
            check(value, schema["not"], path)
        except RequestValidationError:
            pass
        else:
            reject("Mutually exclusive execution sources cannot be combined")


def validate_execution_input(value, custom_inputs, *, scenario_id, fidelity_policy):
    if value is None:
        return None
    check(value, SCHEMA)
    if custom_inputs is None or scenario_id != "s1_des_example" or fidelity_policy != "des":
        raise RequestValidationError("Execution authoring requires explicit custom inputs and the S1→S6 DES scenario.", "/execution_input")
    clean = copy.deepcopy(value)
    def normalize(document, node):
        if "$ref" in node:
            return normalize(document, SCHEMA["$defs"][node["$ref"].split("/")[-1]])
        if node.get("x-uint64"):
            return int(document)
        for keyword in ("oneOf", "anyOf"):
            if keyword in node:
                for alternative in node[keyword]:
                    try:
                        check(document, alternative)
                    except RequestValidationError:
                        continue
                    merged = {**{k: v for k, v in node.items() if k != keyword}, **alternative}
                    merged["properties"] = {**node.get("properties", {}), **alternative.get("properties", {})}
                    return normalize(document, merged)
        if isinstance(document, dict):
            return {k: normalize(v, node.get("properties", {}).get(k, node.get("additionalProperties", {})) if isinstance(node.get("properties", {}).get(k, node.get("additionalProperties", {})), dict) else {}) for k, v in document.items()}
        if isinstance(document, list):
            return [normalize(v, node.get("items", {})) for v in document]
        return document
    clean = normalize(clean, SCHEMA)
    requests = custom_inputs["runtime_trace"]["requests"]
    for i, request in enumerate(requests):
        if request.get("phase") != "request":
            raise RequestValidationError("Dense execution requires dynamic request rows (phase=request).", f"/custom_inputs/runtime_trace/requests/{i}/phase")
        if request.get("model_id") != value["dense_execution"]["model_id"]:
            raise RequestValidationError("Request model_id must match the dense model.", f"/custom_inputs/runtime_trace/requests/{i}/model_id")
    if clean["mode"] == "kernel_strategy":
        dense, kernel = clean["dense_execution"], clean["kernel_execution"]
        hw = kernel["hardware"]
        if "kernel_efficiency" not in dense or hw["target_profile_id"] != dense["device_profile_id"] or hw["compute_units"] != dense["kernel_efficiency"]["compute_units"]:
            raise RequestValidationError("Hardware identity/compute units must match dense kernel_efficiency.", "/execution_input/kernel_execution/hardware")
        for selector, selection in kernel["operations"].items():
            path = pointer("/execution_input/kernel_execution/operations", selector)
            s = selection["strategy"]
            if s["dtype"] != hw["matrix_dtype"]:
                raise RequestValidationError("dtype differs from hardware.matrix_dtype", path + "/strategy/dtype")
            if s["threads"] % 32 or s["threads"] > min(hw["threads_per_block"], hw["threads_per_unit"]) or s["shared_bytes"] > hw["shared_bytes_per_unit"] or s["threads"] * s["registers_per_thread"] > hw["registers_per_unit"]:
                raise RequestValidationError("Strategy exceeds hardware resource limits", path + "/strategy")
            if s["source"] != "declared" and not s.get("source_reference"):
                raise RequestValidationError("Non-declared strategy requires source_reference", path + "/strategy/source_reference")
            if s["source"] == "launch_observation" and "launch_grid" not in s:
                raise RequestValidationError("Launch observation requires launch_grid", path + "/strategy/launch_grid")
    return clean
