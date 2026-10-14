"""Run-bound runtime evidence, descriptors, and fail-closed manifest tests."""

import json
import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import server
from repositories import runs
from services import execution


class RuntimeEvidenceContractTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.run_id = "run-runtime-evidence-test"
        self.directory = Path(self.temp.name) / self.run_id
        self.directory.mkdir()
        self.definition = server.JSON_ARTIFACT_DEFINITIONS["runtime-events"]
        self.path = self.directory / self.definition["file_name"]

    def test_schema_revision_is_derived_once_and_manifest_bound(self):
        from contracts.schema_set import compute_schema_set_revision
        self.assertEqual(compute_schema_set_revision(server.CONTRACT_ROOT), server.SCHEMA_SET_REVISION)
        self.assertEqual(server.api_manifest()["schema_set_revision"], server.SCHEMA_SET_REVISION)

    def write(self, value):
        self.path.write_text(json.dumps(value), encoding="utf-8")

    def payload(self):
        return {
            "schema_version": "tilesim.s1_runtime_event_trace.v1",
            "run_id": self.run_id,
            "trace_name": "synthetic-test",
            "events": [{
                "kind": "arrival", "request_id": "r1", "batch_id": "b1",
                "batch_request_ids": ["r1"], "event_time_ps": 9007199254740993,
                "logical_step": 0, "kv_tokens": 1, "active_requests": 1,
            }],
        }

    def test_ready_runtime_artifact_preserves_uint64_and_manifest_identity(self):
        self.write(self.payload())
        inspected = runs.inspect_artifact(self.run_id, self.path, self.definition)
        self.assertEqual(inspected["value"]["events"][0]["event_time_ps"], 9007199254740993)
        self.assertEqual(inspected["content_status"], "ready")
        manifest = runs.artifact_manifest_for(
            self.run_id, self.directory,
            artifact_definitions=server.JSON_ARTIFACT_DEFINITIONS,
            artifact_manifest_schema=server.ARTIFACT_MANIFEST_SCHEMA,
            api_version=server.API_VERSION,
            schema_set_revision=server.SCHEMA_SET_REVISION,
        )
        entry = next(item for item in manifest["artifacts"] if item["artifact_id"] == "runtime-events")
        self.assertEqual(entry["contract_status"], "supported")
        self.assertEqual(entry["content_status"], "ready")
        self.assertEqual(entry["bytes"], self.path.stat().st_size)
        self.assertEqual(len(entry["sha256"]), 64)
        self.write({**self.payload(), "events": []})
        with self.assertRaises(runs.ArtifactManifestValidationError):
            runs.validate_artifact_manifest(
                manifest, self.run_id, self.directory,
                artifact_definitions=server.JSON_ARTIFACT_DEFINITIONS,
                artifact_manifest_schema=server.ARTIFACT_MANIFEST_SCHEMA,
                api_version=server.API_VERSION,
                schema_set_revision=server.SCHEMA_SET_REVISION,
            )

    def test_expected_absence_descriptor_is_not_data_and_is_run_bound(self):
        descriptor = {
            "schema_version": "tilesim.wind_tunnel_artifact_descriptor.v1",
            "run_id": self.run_id, "artifact_id": "runtime_event_trace",
            "state": "expected_absence", "evidence_requirement": "runtime_event_evidence",
            "absence_reason": "not_expected_for_boundary", "detail": "not expected",
        }
        self.write(descriptor)
        inspected = runs.inspect_artifact(self.run_id, self.path, self.definition)
        self.assertEqual(inspected["content_status"], "expected_absence")
        self.assertEqual(inspected["contract_status"], "supported")
        self.write({**descriptor, "run_id": "run-other"})
        with self.assertRaises(runs.ArtifactContractError) as failure:
            runs.inspect_artifact(self.run_id, self.path, self.definition)
        self.assertEqual((failure.exception.reason, failure.exception.json_pointer), ("run_binding_mismatch", "/run_id"))

    def test_corrupt_unknown_schema_bad_uint64_and_missing_file_are_distinct(self):
        for payload, reason, pointer in (
            ({**self.payload(), "schema_version": "unknown"}, "unsupported_schema", "/schema_version"),
            ({**self.payload(), "events": [{**self.payload()["events"][0], "event_time_ps": 2**64}]}, "contract_violation", "/events/0/event_time_ps"),
        ):
            self.write(payload)
            with self.assertRaises(runs.ArtifactContractError) as failure:
                runs.inspect_artifact(self.run_id, self.path, self.definition)
            self.assertEqual((failure.exception.reason, failure.exception.json_pointer), (reason, pointer))
        self.path.write_text("{broken", encoding="utf-8")
        manifest = server.artifact_manifest_for(self.run_id, self.directory)
        self.assertEqual(next(item for item in manifest["rejected_artifacts"] if item["artifact_id"] == "runtime-events")["reason"], "invalid_json")
        self.path.unlink()
        manifest = server.artifact_manifest_for(self.run_id, self.directory)
        self.assertFalse(any(item["artifact_id"] == "runtime-events" for item in manifest["artifacts"] + manifest["rejected_artifacts"]))

    def test_duplicate_request_summaries_are_rejected(self):
        definition = server.JSON_ARTIFACT_DEFINITIONS["runtime-requests"]
        request = {key: 0 for key in ("arrival_time_ps", "admit_time_ps", "first_batch_issue_time_ps", "first_token_time_ps", "completion_time_ps", "final_kv_tokens")}
        request["request_id"] = "duplicate"
        path = self.directory / definition["file_name"]
        path.write_text(json.dumps({"schema_version": "tilesim.s1_runtime_request_summaries.v1", "run_id": self.run_id, "requests": [request, request]}), encoding="utf-8")
        with self.assertRaises(runs.ArtifactContractError) as failure:
            runs.inspect_artifact(self.run_id, path, definition)
        self.assertEqual(failure.exception.json_pointer, "/requests/1/request_id")

    def test_duplicate_event_batch_request_refs_are_rejected(self):
        payload = self.payload()
        payload["events"][0]["batch_request_ids"] = ["r1", "r1"]
        self.write(payload)
        with self.assertRaises(runs.ArtifactContractError) as failure:
            runs.inspect_artifact(self.run_id, self.path, self.definition)
        self.assertEqual(failure.exception.json_pointer, "/events/0/batch_request_ids")

    def test_collector_only_requests_published_s1_trace_and_never_attribution(self):
        run = {"run_id": self.run_id, "status": "running"}
        calls = []
        def runner(command, **_kwargs):
            calls.append(command)
            return execution.subprocess.CompletedProcess(command, 1, stdout=b"{}", stderr=b"failed")
        for scenario in (
            {"from": "S1", "to": "S6", "trace": Path("trace.json"), "topology": Path("topology.json")},
            {"from": "S1", "to": "S6", "trace_package": Path("manifest.json"), "topology": Path("topology.json")},
        ):
            runs_by_id = {self.run_id: run.copy()}
            with mock.patch.object(execution, "trace_package_manifest_matches", return_value=True):
                execution.execute_run(
                    self.run_id, scenario, "des", runs_root=Path(self.temp.name),
                    tilesim_cli=Path("TileSimCLI"), tilesim_root=self.directory,
                    runs=runs_by_id, runs_lock=execution.threading.Lock(),
                    report_paths_for=server.report_paths_for, is_valid_json_file=lambda _: False,
                    update_run_metadata=lambda *_args, **_kwargs: None, now=lambda: "now", process_runner=runner,
                )
            self.assertEqual(runs_by_id[self.run_id]["status"], "failed")
        self.assertIn("--runtime-events-out", calls[0])
        self.assertNotIn("--runtime-events-out", calls[1])
        self.assertTrue(all("--request-attribution-out" not in command for command in calls))

    def test_cli_attribution_error_is_persisted_without_generalizing_code_or_path(self):
        run = {"run_id": self.run_id, "status": "running"}
        output = {
            "report_kind": "wind_tunnel_run_result",
            "status": "failed",
            "error_code": "REQUEST_ATTRIBUTION_REQUEST_ID_DUPLICATED",
            "field_path": "/requests/1/request_id",
            "cause": "S0 workload request r1 duplicates /requests/0/request_id",
            "next_action": "Change the duplicated request_id values, then rerun attribution; no attribution artifact was produced.",
        }
        runner = lambda command, **_kwargs: execution.subprocess.CompletedProcess(
            command, 1, stdout=json.dumps(output).encode("utf-8"), stderr=b"structured failure"
        )
        scenario = {"from": "S0", "to": "S6", "trace": Path("trace.json"), "topology": Path("topology.json"),
                    "request_attribution_applicable": True}
        runs_by_id = {self.run_id: run}
        with mock.patch.object(execution, "trace_package_manifest_matches", return_value=True):
            execution.execute_run(
                self.run_id, scenario, "des", runs_root=Path(self.temp.name),
                tilesim_cli=Path("TileSimCLI"), tilesim_root=self.directory,
                runs=runs_by_id, runs_lock=execution.threading.Lock(),
                report_paths_for=server.report_paths_for, is_valid_json_file=lambda _: True,
                update_run_metadata=lambda *_args, **kwargs: run.update(kwargs), now=lambda: "now",
                process_runner=runner,
            )
        self.assertEqual(runs_by_id[self.run_id]["status"], "failed")
        self.assertEqual(runs_by_id[self.run_id]["failure_code"], "cli_nonzero_exit")
        self.assertEqual(runs_by_id[self.run_id]["cli_error_code"], output["error_code"])
        self.assertEqual(runs_by_id[self.run_id]["cli_field_path"], output["field_path"])
        self.assertEqual(runs_by_id[self.run_id]["cli_next_action"], output["next_action"])
        self.assertNotIn("request_attribution", runs_by_id[self.run_id].get("artifacts", {}))
        self.assertEqual(execution.validated_cli_failure(output, attribution_requested=False), {})
        self.assertEqual(execution.validated_cli_failure(
            {**output, "field_path": "/requests"}, attribution_requested=True), {})

    def attribution_payload(self):
        schema = "tilesim.request_attribution.v1"
        ref = lambda pointer, kind, id: {
            "run_id": self.run_id, "artifact_id": "request_attribution",
            "schema_identity": schema, "json_pointer": pointer,
            "availability": "available", "subject": {"kind": kind, "id": id},
        }
        metric = {"request_id": "r1"}
        subjects = [{"kind": "request", "id": "r1"}, {"kind": "resource_operation", "id": "op1"}]
        cause = {
            "cause_id": self.run_id + "::cause::0", "subject_refs": subjects,
            "evidence_refs": [ref("/metrics/request_metrics/0", "request", "r1"),
                              ref("/evidence/resource_operations/0", "resource_operation", "op1")],
        }
        ranking = {"attribution_id": self.run_id + "::rank::0", "subject_refs": subjects,
                   "evidence_refs": cause["evidence_refs"]}
        return {
            "schema_version": schema, "run_id": self.run_id,
            "metrics": {"schema_version": "tilesim.metrics_report.v1", "run_id": self.run_id,
                        "request_metrics": [metric]},
            "evidence": {"run_id": self.run_id, "des_committed_event_digest": "digest",
                         "des_events": [{"event_id": "event1"}],
                         "resource_operations": [{"operation_id": "op1"}],
                         "network_demands": [{"demand_id": "demand1"}],
                         "fabric": {"timeline": [{"phase_id": "phase1"}]}},
            "requests": [{"schema_version": "tilesim.tail_cause_chain_report.v1",
                          "run_id": self.run_id,
                          "report_id": self.run_id + "::request_critical_path::r1",
                          "explained_entity": {"kind": "request", "id": "r1"},
                          "cause_chain": [cause], "attribution_ranking": [ranking]}],
        }

    def test_attribution_reference_and_manifest_fail_closed(self):
        definition = server.JSON_ARTIFACT_DEFINITIONS["request-attribution"]
        path = self.directory / definition["file_name"]
        payload = self.attribution_payload()
        (self.directory / "metrics.json").write_text(json.dumps(payload["metrics"]), encoding="utf-8")
        def check(value, reason=None, pointer=None):
            path.write_text(json.dumps(value), encoding="utf-8")
            if reason:
                with self.assertRaises(runs.ArtifactContractError) as failure:
                    runs.inspect_artifact(self.run_id, path, definition)
                self.assertEqual((failure.exception.reason, failure.exception.json_pointer), (reason, pointer))
            else:
                self.assertEqual(runs.inspect_artifact(self.run_id, path, definition)["content_status"], "ready")
        check(payload)
        manifest = server.artifact_manifest_for(self.run_id, self.directory)
        entry = next(a for a in manifest["artifacts"] if a["artifact_id"] == "request-attribution")
        self.assertEqual(entry["sha256"], hashlib.sha256(path.read_bytes()).hexdigest())
        self.assertEqual(entry["bytes"], path.stat().st_size)
        check({**payload, "run_id": "run-other"}, "run_binding_mismatch", "/run_id")
        check({**payload, "schema_version": "unknown"}, "unsupported_schema", "/schema_version")
        bad = json.loads(json.dumps(payload))
        bad["requests"][0]["cause_chain"][0]["evidence_refs"][1]["artifact_id"] = "metrics"
        check(bad, "contract_violation", "/requests/0/cause_chain/0/evidence_refs/1")
        bad = json.loads(json.dumps(payload))
        bad["requests"][0]["cause_chain"][0]["evidence_refs"][1]["json_pointer"] = "/evidence/resource_operations/9"
        check(bad, "contract_violation", "/requests/0/cause_chain/0/evidence_refs/1/json_pointer")
        bad = json.loads(json.dumps(payload))
        bad["metrics"]["request_metrics"].append({"request_id": "r1"})
        check(bad, "contract_violation", "/metrics/request_metrics")
        bad = json.loads(json.dumps(payload))
        bad["evidence"]["resource_operations"].append({"operation_id": "op1"})
        check(bad, "contract_violation", "/evidence/resource_operations")
        bad = json.loads(json.dumps(payload))
        bad["evidence"]["run_id"] = "run-other"
        check(bad, "contract_violation", "/evidence/run_id")
        bad = json.loads(json.dumps(payload))
        bad["requests"][0]["cause_chain"][0]["evidence_refs"][1]["subject"]["id"] = "other"
        check(bad, "contract_violation", "/requests/0/cause_chain/0/evidence_refs/1/subject")
        (self.directory / "metrics.json").write_text(json.dumps({**payload["metrics"], "request_metrics": [{"request_id": "other"}]}), encoding="utf-8")
        check(payload, "contract_violation", "/metrics/request_metrics")
        path.write_text("{broken", encoding="utf-8")
        self.assertEqual(next(a for a in server.artifact_manifest_for(self.run_id, self.directory)["rejected_artifacts"] if a["artifact_id"] == "request-attribution")["reason"], "invalid_json")
        path.unlink()
        self.assertFalse(any(a["artifact_id"] == "request-attribution" for a in server.artifact_manifest_for(self.run_id, self.directory)["artifacts"]))

    def test_trace_package_command_uses_inspected_runtime_scope(self):
        calls = []
        def runner(command, **kwargs):
            calls.append(command)
            self.assertEqual(kwargs["timeout"], 300)
            return execution.subprocess.CompletedProcess(command, 1, stdout=b"{}", stderr=b"failed")
        for boundary, dense in (("S0", True), ("S1", False), ("S2", False)):
            scenario = {"to": "S6", "topology": Path("topology.json"),
                        "trace_package": Path("manifest.json"),
                        "runtime_evidence_applicable": boundary in {"S0", "S1"},
                        "request_attribution_applicable": dense}
            with mock.patch.object(execution, "trace_package_manifest_matches", return_value=True):
                execution.execute_run(
                    self.run_id, scenario, "des", runs_root=Path(self.temp.name),
                    tilesim_cli=Path("TileSimCLI"), tilesim_root=self.directory,
                    runs={self.run_id: {"run_id": self.run_id, "status": "running"}},
                    runs_lock=execution.threading.Lock(), report_paths_for=server.report_paths_for,
                    is_valid_json_file=lambda _: False,
                    update_run_metadata=lambda *_args, **_kwargs: None,
                    now=lambda: "now", process_runner=runner,
                )
        self.assertIn("--runtime-events-out", calls[0])
        self.assertIn("--request-attribution-out", calls[0])
        self.assertIn("--runtime-events-out", calls[1])
        self.assertNotIn("--request-attribution-out", calls[1])
        self.assertNotIn("--runtime-events-out", calls[2])


if __name__ == "__main__":
    unittest.main()
