"""Trusted AST lowering, immutable run inputs and CLI-backed admission.

Uploaded Python is only data. The separately maintained backend parser is invoked
in an isolated Python process; the uploaded module is never imported or evaluated.
"""
from __future__ import annotations

import copy
import hashlib
import json
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

from contracts.validation import RequestValidationError

MODES = ("kernel_strategy", "tilelang_source", "execution_partition")
_cache = {}
_lock = threading.Lock()

def reject_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise RequestValidationError("Duplicate JSON field: " + key, "/execution_input")
        result[key] = value
    return result


def digest(value):
    return "sha256:" + hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest()


def lower_source(source, root: Path, path: str):
    parser = root / "scripts/kernel_bridge/tilelang.py"
    if not parser.is_file():
        raise RequestValidationError("Trusted backend AST parser unavailable", path)
    with tempfile.TemporaryDirectory(prefix="tilesim-source-") as tmp:
        folder = Path(tmp)
        (folder / "source.py").write_text(source["source_text"], encoding="utf-8", newline="\n")
        (folder / "arguments.json").write_text(json.dumps(source["arguments"]), encoding="utf-8")
        script = (
            "import importlib.util,json,sys;from pathlib import Path;"
            "s=importlib.util.spec_from_file_location('trusted_tilelang_parser',sys.argv[1]);"
            "m=importlib.util.module_from_spec(s);s.loader.exec_module(m);"
            "p=m.parse_program(Path(sys.argv[2]),json.loads(Path(sys.argv[3]).read_text()),"
            "materialize_payload=sys.argv[4]=='materialized');"
            "p['source']['path']='uploaded-source.py';print(json.dumps(p))"
        )
        try:
            result = subprocess.run([sys.executable, "-I", "-B", "-c", script, str(parser), str(folder / "source.py"), str(folder / "arguments.json"), source["payload_mode"]], capture_output=True, timeout=30, check=False)
        except (OSError, subprocess.TimeoutExpired) as error:
            raise RequestValidationError("AST lowering unavailable: " + str(error), path) from error
        if result.returncode:
            raise RequestValidationError(result.stderr.decode("utf-8", errors="replace")[-3000:], path)
        return json.loads(result.stdout)


def prepare(value, root: Path):
    frozen = copy.deepcopy(value)
    dense = copy.deepcopy(frozen["dense_execution"])
    mode = frozen["mode"]
    summaries = []
    if mode == "kernel_strategy":
        dense["kernel_execution"] = frozen["kernel_execution"]
    elif mode == "tilelang_source":
        dense["tilelang_model_dtype"] = frozen["tilelang_model_dtype"]
        dense["tilelang_kernels"] = []
        for i, selection in enumerate(frozen["tilelang_kernels"]):
            path = f"/execution_input/tilelang_kernels/{i}"
            lowered = {k: v for k, v in selection.items() if k not in {"source", "rank_programs", "rank_cost_profiles_json"}}
            lowered["program"] = lower_source(selection["source"], root, path + "/source")
            if "rank_programs" in selection:
                lowered["rank_programs"] = {rank: lower_source(source, root, path + "/rank_programs/" + rank) for rank, source in selection["rank_programs"].items()}
            if "rank_cost_profiles_json" in selection:
                # No path or unchecked text is passed to the CLI: parse the asset,
                # then let the backend validate exact source/device/cost bindings.
                try:
                    lowered["rank_cost_profiles"] = json.loads(selection["rank_cost_profiles_json"], object_pairs_hook=reject_duplicate_keys)
                except ValueError as error:
                    raise RequestValidationError("Invalid rank cost JSON", path + "/rank_cost_profiles_json") from error
            program = lowered["program"]
            summaries.append({"selection_id": selection["selection_id"], "source_sha256": program["source"]["sha256"], "source_selected": program["source"]["selected"], "parameters": program["parameters"], "lowering": program.get("lowering"), "input_values": program.get("input_values"), "cost_scope": program["cost_scope"], "claim_scope": program["claim_scope"], "program_sha256": digest(program), "payload_mode": selection["source"]["payload_mode"]})
            dense["tilelang_kernels"].append(lowered)
    return {"input": frozen, "dense_execution": dense, "config_sha256": digest(value), "sources": summaries}


def materialize(run_dir: Path, scenario: dict, prepared: dict):
    trace = json.loads(scenario["trace"].read_bytes())
    trace["dense_execution"] = prepared["dense_execution"]
    scenario["trace"].write_text(json.dumps(trace, ensure_ascii=False, indent=2), encoding="utf-8")
    snapshot = {"schema_version": "tilesim.bridge.execution_input_snapshot.v1", "run_id": run_dir.name, **prepared}
    (run_dir / "input-execution.json").write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    mode = prepared["input"]["mode"]
    if mode == "execution_partition":
        path = run_dir / "input-execution-partitions.json"
        path.write_text(json.dumps(prepared["input"]["execution_partition_program"], ensure_ascii=False, indent=2), encoding="utf-8")
        scenario["execution_partitions"] = path
    scenario["operator_execution_mode"] = mode
    scenario["runtime_evidence_applicable"] = True
    scenario["request_attribution_applicable"] = True
    return scenario


def source_semantics(run_dir: Path, cli: Path, root: Path):
    """Independent CPU numerical oracle; never substituted for Dense DES timing."""
    snapshot = json.loads((run_dir / "input-execution.json").read_bytes())
    rows = []
    for i, selection in enumerate(snapshot["dense_execution"].get("tilelang_kernels", [])):
        programs = {"representative": selection["program"], **selection.get("rank_programs", {})}
        for j, (rank, program) in enumerate(programs.items()):
            row = dict(selection_id=selection["selection_id"], rank=rank, program_sha256=digest(program))
            if program.get("input_values") == "not_materialized_execution_structure_v1":
                row.update(status="not_covered", reason="Structure-only program has no CPU numerical payload; Dense execution remains valid.", result=None)
            else:
                with tempfile.TemporaryDirectory(prefix="tilesim-cpu-semantics-") as tmp:
                    path, output = Path(tmp) / "program.json", Path(tmp) / "result.json"
                    path.write_text(json.dumps(program), encoding="utf-8")
                    command = [str(cli), "run-kernel-program", "--trace", str(path), "--out", str(output)]
                    try:
                        completed = subprocess.run(command, cwd=root, capture_output=True, timeout=60, check=False)
                        result = json.loads(output.read_bytes()) if output.is_file() else None
                        if result and result.get("schema_version") != "tilesim.tilelang_kernel_result.v1":
                            raise ValueError("Unsupported CPU result schema")
                        row.update(status="completed" if completed.returncode == 0 and result and result.get("completed") else "failed", reason=completed.stderr.decode("utf-8", errors="replace")[-2000:], result=result)
                    except (OSError, ValueError, subprocess.TimeoutExpired) as error:
                        row.update(status="error", reason=str(error), result=None)
            rows.append(row)
    if rows:
        (run_dir / "source-semantics.json").write_text(json.dumps(dict(schema_version="tilesim.bridge.source_semantics.v1", run_id=run_dir.name, time_domain="independent_cpu_semantics_not_dense_timeline", config_sha256=snapshot["config_sha256"], results=rows), ensure_ascii=False, indent=2), encoding="utf-8")


def evidence_records(envelope):
    records = []
    def visit(value):
        if isinstance(value, dict):
            if isinstance(value.get("attributes"), dict):
                records.append(value)
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)
    visit(envelope)
    return records


def consumption_error(envelope, mode, expected=None):
    records = evidence_records(envelope)
    if mode == "execution_partition":
        return None if envelope.get("partition_operations") else "Backend did not report imported partition operations; refusing fallback."
    key = "kernel_strategy" if mode == "kernel_strategy" else "source_kernel_sha256"
    hit = any((r["attributes"].get(key) == "explicit" if mode == "kernel_strategy" else bool(r["attributes"].get(key))) for r in records)
    if not hit:
        return f"Backend did not report {key}; refusing fallback."
    if expected and mode == "kernel_strategy":
        consumed = {a.get("execution_phase", "") + "/" + a.get("operation_kind", "").rsplit("::", 1)[-1]
                    for row in records if (a := row["attributes"]).get("kernel_strategy") == "explicit"}
        missing = set(expected["kernel_execution"]["operations"]) - consumed
        if missing:
            return "Configured selectors were not consumed: " + ", ".join(sorted(missing)) + "; refusing fallback."
    if expected and mode == "tilelang_source":
        consumed = {row["attributes"].get("source_selection_id") for row in records if row["attributes"].get("source_kernel_sha256")}
        missing = {selection["selection_id"] for selection in expected["tilelang_kernels"]} - consumed
        if missing:
            return "Configured source selections were not consumed: " + ", ".join(sorted(missing)) + "; refusing fallback."
    return None


def preflight(prepared, custom_inputs, *, cli: Path, root: Path):
    """Actually execute the selected input on isolated files before creating a run."""
    with tempfile.TemporaryDirectory(prefix="tilesim-admission-") as tmp:
        folder = Path(tmp)
        trace, topology, envelope = (folder / name for name in ("trace.json", "topology.json", "envelope.json"))
        trace.write_text(json.dumps(custom_inputs["runtime_trace"]), encoding="utf-8")
        topology.write_text(json.dumps(custom_inputs["topology"]), encoding="utf-8")
        scenario = materialize(folder, {"trace": trace, "topology": topology}, prepared)
        attribution = folder / "attribution.json"
        command = [str(cli), "run", "--mode", "dev", "--from", "S1", "--to", "S6", "--trace", str(trace), "--topology", str(topology), "--fidelity-policy", "des", "--execution-envelope-out", str(envelope), "--request-attribution-out", str(attribution)]
        if scenario.get("execution_partitions"):
            command.extend(["--execution-partitions", str(scenario["execution_partitions"])])
        try:
            result = subprocess.run(command, cwd=root, capture_output=True, timeout=60, check=False)
        except (OSError, subprocess.TimeoutExpired) as error:
            raise RequestValidationError("Backend admission unavailable: " + str(error), "/execution_input") from error
        if result.returncode:
            message = result.stdout.decode("utf-8", errors="replace") + result.stderr.decode("utf-8", errors="replace")
            raise RequestValidationError(message[-5000:] or f"CLI exited {result.returncode} without diagnostics", "/execution_input")
        try:
            report = json.loads(envelope.read_bytes())
            if attribution.is_file():
                report["attribution"] = json.loads(attribution.read_bytes())
        except (OSError, ValueError) as error:
            raise RequestValidationError("Backend produced no execution evidence", "/execution_input") from error
        if error := consumption_error(report, prepared["input"]["mode"], prepared["input"]):
            raise RequestValidationError(error, "/execution_input")
        return {"status": "available", "config_sha256": prepared["config_sha256"], "sources": prepared["sources"], "evidence_records": len(evidence_records(report)), "claim_scope": "cpu_source_semantics_and_synthetic_consistency" if prepared["sources"] else "synthetic_consistency", "cost_scope": "declared_uncalibrated_not_compiled_gpu_timing"}


def example_inputs(root: Path):
    workload = json.loads((root / "docs/examples/tilelang_model/workload.json").read_bytes())
    request = workload["requests"][0]
    request = {k: v for k, v in request.items() if k != "burst_id"}
    request.update(phase="request", decode_tokens=1, kv_tokens=9, tp_degree=1, participants=["gpu0"], message_size_bytes=0)
    policy = {k: v for k, v in workload["runtime_config"].items() if k in {"kv_capacity_tokens", "initial_kv_tokens", "max_active_requests", "max_batch_size", "batch_scheduler", "kv_page_size_tokens", "kv_fragmentation_overhead", "kv_admission_watermark", "long_context_threshold_tokens", "decode_penalty_per_threshold"}}
    trace = {k: workload[k] for k in ("trace_name", "engine_type", "engine_semantic_version", "requested_features", "trace_provenance")}
    trace.update(policy=policy, requests=[request])
    custom = {"runtime_trace": trace, "topology": json.loads((root / "docs/examples/dense_timing/topology.json").read_bytes())}
    dense = workload["dense_execution"]
    efficiency = dict(schema_version="tilesim.kernel_efficiency.v1", compute_units=4, scalar_tflops=10, compute_efficiency=0.75, memory_efficiency=0.8, tile_m=2, tile_n=2, tile_k=2, attention_tile_q=2)
    hw = dict(target_profile_id=dense["device_profile_id"], matrix_dtype="fp16", compute_units=4, threads_per_unit=1024, blocks_per_unit=4, shared_bytes_per_unit=65536, registers_per_unit=65536, threads_per_block=1024)
    strategy = dict(implementation_id="declared-example-v1", source="declared", dtype="fp16", accumulator_dtype="fp32", memory_policy="reload_operands", mapping="output_tile_per_block", tile_m=2, tile_n=2, tile_k=2, threads=128, pipeline_stages=2, shared_bytes=8192, registers_per_thread=32)
    kernel = dict(mode="kernel_strategy", dense_execution={**dense, "kernel_efficiency": efficiency}, kernel_execution=dict(schema_version="tilesim.kernel_execution.v1", hardware=hw, operations={"prefill/norm_qkv": dict(view="expanded", strategy=strategy)}))
    source = dict(source_text=(root / "tests/fixtures/tilelang/example_gemm_persistent.py").read_text(encoding="utf-8"), arguments=json.loads((root / "docs/examples/tilelang_model/arguments_tile2.json").read_bytes()), payload_mode="structure_only")
    tilelang = dict(mode="tilelang_source", dense_execution=copy.deepcopy(dense), tilelang_model_dtype="float16", tilelang_kernels=[dict(selection_id="output-gemm", phase="prefill", operation="attention_output", instances=["layer_0::attention_output"], source=source, output_policy="operator_barrier", output_buffer_slots=0, output_admission_policy="direct_v1")])
    evidence = dict(source_mode="synthetic_trace", source_id="author-example", generation_method="explicit-functional-dag", calibration_level="uncalibrated", allowed_claim_scope="synthetic_consistency", observed_fields=[], inferred_fields=["slices", "resources"])
    partition = dict(schema_version="tilesim.execution_partition_program.v1", program_id="explicit-example", model_id=dense["model_id"], model_revision=dense["model_revision"], windows=[dict(request_id=request["request_id"], phase="prefill", token_begin=0, token_end=8, partition=dict(schema_version="tilesim.execution_partition.v1", partition_reference="synthetic://author-example", source_kind="generated", evidence=evidence, slices=[dict(local_partition_id="compute", operation_kind="declared_device", dependency_partition_ids=[], completion_condition="device_task_completed", token_offsets=[0,8], tensor_shape=[8,8], tensor_offset=[0,0], tensor_extent=[8,8])]), resources={"compute":dict(kind="device", placement="gpu0", stream="default", flops=1024, memory_bytes=256)})])
    return custom, {"kernel_strategy": kernel, "tilelang_source": tilelang, "execution_partition": dict(mode="execution_partition", dense_execution=copy.deepcopy(dense), execution_partition_program=partition)}


def descriptor(*, cli, root, identity, revision):
    response = dict(schema_version="tilesim.bridge.operator_execution.v1", schema_set_revision=revision, backend_identity=identity, modes={}, examples=None, custom_inputs=None)
    try:
        custom, examples = example_inputs(root)
        response.update(examples=examples, custom_inputs=custom)
    except (OSError, ValueError) as error:
        response["modes"] = {mode: dict(status="unavailable", reason=str(error)) for mode in MODES}
        return response
    if not identity.get("versions_match"):
        response["modes"] = {mode: dict(status="unavailable", reason="Backend source/build identity mismatch") for mode in MODES}
        return response
    try:
        key = (str(cli), cli.stat().st_mtime_ns, revision)
        with _lock:
            statuses = _cache.get(key)
            if statuses is None:
                statuses = {}
                for mode in MODES:
                    try:
                        preflight(prepare(examples[mode], root), custom, cli=cli, root=root)
                        statuses[mode] = dict(status="available", reason="Isolated CLI admission and evidence consumption passed")
                    except (ValueError, OSError) as error:
                        statuses[mode] = dict(status="unavailable", reason=str(error))
                _cache[key] = statuses
        response.update(modes=statuses, examples=examples, custom_inputs=custom)
    except (OSError, ValueError) as error:
        response["modes"] = {mode: dict(status="unavailable", reason=str(error)) for mode in MODES}
    return response
