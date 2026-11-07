"""Operator admission and real CLI integration; never touches the serving Bridge."""
import copy
import json
import os
from pathlib import Path
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from unittest import mock

from contracts.execution_input import check, SCHEMA
from contracts.run_request import validate_run_request
from contracts.validation import RequestValidationError
from services import operator_execution as operators

ROOT = Path(os.environ.get("TILESIM_TEST_ROOT", "D:/tileSim"))
CLI = Path(os.environ.get("TILESIM_TEST_CLI", str(ROOT / "build-msys-topology-20261031/TileSimCLI.exe")))
FIXTURE = Path(__file__).parents[1] / "tests/fixtures/operator-execution.json"


def explicit_rank_input(examples):
    value = copy.deepcopy(examples["tilelang_source"])
    value["dense_execution"]["explicit_rank_execution"] = True
    selection = value["tilelang_kernels"][0]
    selection["source"]["arguments"].update(K=4, block_N=4, use_persistent_primitive=True)
    selection.update(rank_programs={rank: copy.deepcopy(selection["source"]) for rank in ("gpu0", "gpu1")},
                     output_policy="tile_ready_allreduce", output_buffer_slots=2, output_admission_policy="safe_window_v1")
    return value


def communicating_partition_input(examples):
    value = copy.deepcopy(examples["execution_partition"])
    program = value["execution_partition_program"]
    program["buffers"] = {"scratch": dict(placement="gpu0", capacity_bytes=256)}
    window = program["windows"][0]
    for kind, parent in (("allreduce", "compute"), ("sendrecv", "allreduce")):
        node = copy.deepcopy(window["partition"]["slices"][0])
        node.update(local_partition_id=kind, operation_kind=kind, dependency_partition_ids=[parent], completion_condition="collective_completed")
        window["partition"]["slices"].append(node)
        window["resources"][kind] = dict(kind=kind, participants=["gpu0", "gpu1"], bytes=128, chunk_bytes=0)
    window["buffer_edges"] = [dict(producer="compute", consumers=["allreduce"], pool="scratch", bytes=128)]
    window["partition"]["evidence"]["inferred_fields"] += ["buffers", "buffer_edges"]
    return value


class OperatorContractTest(unittest.TestCase):
    def setUp(self):
        fixture = json.loads(FIXTURE.read_bytes())
        self.custom, self.examples = fixture["custom_inputs"], fixture["examples"]

    def validate(self, value):
        return validate_run_request(dict(scenario_id="s1_des_example", fidelity_policy="des", custom_inputs=self.custom, execution_input=value), scenario_ids={"s1_des_example"}, fidelity_policies={"des"}, gpu_participation_modes={"gpu_free"})

    def test_each_formal_mode_is_admitted_by_schema(self):
        for value in self.examples.values():
            self.assertEqual(self.validate(value).execution_input["mode"], value["mode"])

    def test_closed_sources_and_resource_contract(self):
        value = copy.deepcopy(self.examples["kernel_strategy"])
        value["execution_partition_program"] = self.examples["execution_partition"]["execution_partition_program"]
        with self.assertRaises(RequestValidationError): self.validate(value)
        value = copy.deepcopy(self.examples["execution_partition"])
        value["execution_partition_program"]["windows"][0]["resources"]["compute"]["completion_time_ps"] = 0
        with self.assertRaises(RequestValidationError): self.validate(value)

    def test_dtype_resource_and_evidence_errors_keep_pointer(self):
        for field,value in (("dtype","bf16"),("threads",1023),("shared_bytes",1000000),("source","compiler_metadata")):
            document = copy.deepcopy(self.examples["kernel_strategy"])
            document["kernel_execution"]["operations"]["prefill/norm_qkv"]["strategy"][field] = value
            with self.assertRaises(RequestValidationError) as error: self.validate(document)
            self.assertIn("/execution_input/kernel_execution/operations/", error.exception.field_path)

    def test_exact_uint64_is_preserved(self):
        document = copy.deepcopy(self.examples["execution_partition"])
        document["execution_partition_program"]["windows"][0]["resources"]["compute"]["flops"] = "9007199254740993"
        clean = self.validate(document).execution_input
        self.assertEqual(clean["execution_partition_program"]["windows"][0]["resources"]["compute"]["flops"], 9007199254740993)
        document["execution_partition_program"]["windows"][0]["resources"]["compute"]["flops"] = "18446744073709551616"
        with self.assertRaises(RequestValidationError): self.validate(document)

    def test_no_silent_fallback_and_explicit_null_rejected(self):
        with self.assertRaises(RequestValidationError): self.validate(None)
        self.assertIsNotNone(operators.consumption_error({}, "kernel_strategy"))
        self.assertIsNotNone(operators.consumption_error({}, "tilelang_source"))
        self.assertIsNotNone(operators.consumption_error({}, "execution_partition"))

    def test_duplicate_json_selector_is_rejected(self):
        with self.assertRaises(RequestValidationError):
            json.loads('{"prefill/norm_qkv":{},"prefill/norm_qkv":{}}', object_pairs_hook=operators.reject_duplicate_keys)

    def test_partial_consumption_is_not_success(self):
        report={"resources":[{"attributes":{"kernel_strategy":"explicit","execution_phase":"prefill","operation_kind":"layer_0::norm_qkv"}}]}
        value=copy.deepcopy(self.examples['kernel_strategy'])
        self.assertIsNone(operators.consumption_error(report,'kernel_strategy',value))
        value['kernel_execution']['operations']['decode/norm_qkv']=value['kernel_execution']['operations']['prefill/norm_qkv']
        self.assertIn('decode/norm_qkv',operators.consumption_error(report,'kernel_strategy',value))


@unittest.skipUnless(CLI.is_file() and ROOT.is_dir(), "Native TileSim fixture CLI not installed")
class NativeOperatorExecutionTest(OperatorContractTest):
    def setUp(self):
        super().setUp()
        self.path_patch = mock.patch.dict(os.environ, {"PATH": "C:/msys64/usr/bin;" + os.environ.get("PATH", "")})
        self.path_patch.start()

    def tearDown(self):
        self.path_patch.stop()

    def test_real_cli_all_modes_and_source_provenance(self):
        for mode, value in self.examples.items():
            prepared = operators.prepare(self.validate(value).execution_input, ROOT)
            result = operators.preflight(prepared, self.custom, cli=CLI, root=ROOT)
            self.assertEqual(result["status"], "available")
            self.assertGreater(result["evidence_records"], 0)
            if mode == "tilelang_source":
                self.assertEqual(result["sources"][0]["source_sha256"], "edabb80537ff22cf487c45f53c97fcef56db246c0a701e3c9ea5990458612aa0")
                self.assertEqual(result["sources"][0]["input_values"], "not_materialized_execution_structure_v1")

    def test_real_explicit_tp2_progressive_finite_output(self):
        self.custom["runtime_trace"]["requests"][0].update(tp_degree=2, participants=["gpu0", "gpu1"])
        value = explicit_rank_input(self.examples)
        prepared = operators.prepare(self.validate(value).execution_input, ROOT)
        self.assertEqual(operators.preflight(prepared, self.custom, cli=CLI, root=ROOT)["status"], "available")

    def test_real_partition_collectives_and_buffer_lifecycle(self):
        self.custom["runtime_trace"]["requests"][0].update(tp_degree=2, participants=["gpu0", "gpu1"])
        value = communicating_partition_input(self.examples)
        prepared = operators.prepare(self.validate(value).execution_input, ROOT)
        self.assertEqual(operators.preflight(prepared, self.custom, cli=CLI, root=ROOT)["status"], "available")

    def test_ast_rejects_unsupported_source_without_executing_it(self):
        source = copy.deepcopy(self.examples["tilelang_source"]["tilelang_kernels"][0]["source"])
        source["source_text"] = "raise RuntimeError('THIS_MUST_NEVER_EXECUTE')"
        with self.assertRaises(RequestValidationError) as error: operators.lower_source(source, ROOT, "/source")
        self.assertIn("TILELANG_FACTORY_REQUIRED", str(error.exception))

    def test_materialized_cpu_result_is_separate_from_dense_timeline(self):
        value=copy.deepcopy(self.examples['tilelang_source'])
        value['tilelang_kernels'][0]['source']['payload_mode']='materialized'
        prepared=operators.prepare(self.validate(value).execution_input,ROOT)
        with tempfile.TemporaryDirectory(prefix='operator-cpu-result-') as tmp:
            folder=Path(tmp)
            (folder/'input-execution.json').write_text(json.dumps(prepared),encoding='utf-8')
            operators.source_semantics(folder,CLI,ROOT)
            report=json.loads((folder/'source-semantics.json').read_bytes())
            self.assertEqual(report['time_domain'],'independent_cpu_semantics_not_dense_timeline')
            row=report['results'][0]
            self.assertEqual(row['status'],'completed',row)
            self.assertTrue(row['result']['output_valid'])
            self.assertEqual(row['result']['source_sha256'],prepared['sources'][0]['source_sha256'])
            self.assertGreater(len(row['result']['timeline']),0)

    def test_payload_limit_does_not_reject_structure_mode(self):
        source = copy.deepcopy(self.examples["tilelang_source"]["tilelang_kernels"][0]["source"])
        source["arguments"]["K"] = 256
        source["arguments"]["block_K"] = 64
        source["payload_mode"] = "materialized"
        with self.assertRaises(RequestValidationError): operators.lower_source(source, ROOT, "/source")
        source["payload_mode"] = "structure_only"
        self.assertEqual(operators.lower_source(source, ROOT, "/source")["input_values"], "not_materialized_execution_structure_v1")

    def test_real_cli_rejects_shape_and_grid_without_fallback(self):
        for mode in ("tilelang_source","kernel_strategy"):
            value = copy.deepcopy(self.examples[mode])
            if mode == "tilelang_source": value["tilelang_kernels"][0]["source"]["arguments"]["M"] = 16
            else: value["kernel_execution"]["operations"]["prefill/norm_qkv"]["strategy"]["launch_grid"] = [1,1,1]
            with self.assertRaises(RequestValidationError): operators.preflight(operators.prepare(value,ROOT),self.custom,cli=CLI,root=ROOT)

    def test_http_create_run_reaches_cli_and_manifest(self):
        import server
        with tempfile.TemporaryDirectory(prefix="operator-http-") as tmp, mock.patch.multiple(server, TILESIM_ROOT=ROOT, TILESIM_CLI=CLI, RUNS_ROOT=Path(tmp)/"runs"), mock.patch.object(server,"backend_identity",return_value={"versions_match":True,"source_revision":"test-bound-native-cli","build_revision":"test-bound-native-cli"}), mock.patch.object(server,"runtime_capabilities",return_value={"run_surface":server.identity.controlled_run_surface()}):
            server.RUNS_ROOT.mkdir()
            httpd=server.ThreadingHTTPServer(("127.0.0.1",0),server.BridgeHandler)
            thread=threading.Thread(target=httpd.serve_forever,daemon=True); thread.start()
            def request(path,body=None,key=None):
                headers={"Content-Type":"application/json"}
                if key: headers["Idempotency-Key"]=key
                req=urllib.request.Request(f"http://127.0.0.1:{httpd.server_port}"+path,data=json.dumps(body).encode() if body else None,headers=headers)
                with urllib.request.urlopen(req,timeout=90) as response: return json.loads(response.read())
            try:
                cases = list(self.examples.items()) + [("explicit_tp2", explicit_rank_input(self.examples)), ("communicating_partition", communicating_partition_input(self.examples))]
                for name,value in cases:
                    custom = copy.deepcopy(self.custom)
                    if name in {"explicit_tp2", "communicating_partition"}:
                        custom["runtime_trace"]["requests"][0].update(tp_degree=2, participants=["gpu0", "gpu1"])
                    body=dict(scenario_id="s1_des_example",fidelity_policy="des",custom_inputs=custom,execution_input=value)
                    run=request("/api/runs",body,"operator-test-"+name)
                    run_id=run["run_id"]
                    deadline=time.monotonic()+60
                    while server.runs[run_id]["status"] in {"preparing","running"} and time.monotonic()<deadline: time.sleep(.05)
                    self.assertEqual(server.runs[run_id]["status"],"completed",server.runs[run_id].get("error"))
                    manifest=request(f"/api/runs/{run_id}/artifacts")
                    ids={e["artifact_id"] for e in manifest["artifacts"]}
                    self.assertIn("input-execution",ids)
                    self.assertIn("request-attribution",ids,manifest.get("rejected_artifacts"))
                    snapshot=json.loads((server.RUNS_ROOT/run_id/"input-execution.json").read_bytes())
                    self.assertEqual(snapshot["input"]["mode"],value["mode"])
                    records = operators.evidence_records(json.loads((server.RUNS_ROOT/run_id/"request-attribution.json").read_bytes()))
                    if name == "explicit_tp2":
                        source = [r["attributes"] for r in records if r["attributes"].get("source_selection_id")]
                        self.assertEqual({a["tp_rank"] for a in source}, {"0", "1"})
                        self.assertTrue(any(r["attributes"].get("output_admission_policy") == "safe_window_v1" for r in records))
                    if name == "communicating_partition":
                        self.assertTrue(any(r["attributes"].get("partition_program_id") == value["execution_partition_program"]["program_id"] for r in records))
                        self.assertTrue(any(a.get("buffer_output_bytes::scratch") == "128" for r in records if (a := r["attributes"])))
                count=len(server.runs)
                rejected=copy.deepcopy(self.examples["tilelang_source"]);rejected["tilelang_kernels"][0]["source"]["arguments"]["M"]=16
                with self.assertRaises(urllib.error.HTTPError):request("/api/runs",dict(scenario_id="s1_des_example",fidelity_policy="des",custom_inputs=self.custom,execution_input=rejected),"operator-rejected")
                self.assertEqual(len(server.runs),count)
            finally:
                httpd.shutdown();httpd.server_close();thread.join(timeout=2)
                server.runs.clear()


if __name__ == "__main__": unittest.main()
