"""Canonical execution-replay artifact binding and evidence-boundary tests."""

import json
import tempfile
import unittest
from pathlib import Path

import server
from repositories import runs


class ExecutionReplayContractTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.run_id = "run-execution-replay-test"
        self.directory = Path(self.temp.name) / self.run_id
        self.directory.mkdir()
        self.definition = server.JSON_ARTIFACT_DEFINITIONS["execution-replay"]
        self.path = self.directory / self.definition["file_name"]

    def payload(self):
        return {
            "schema_version": "tilesim.execution_replay.v1",
            "run_id": self.run_id,
            "start_time_ps": 10,
            "finish_time_ps": 30,
            "end_time_ps": 30,
            "fabric": {
                "scenario_name": "fixture",
                "end_to_end_latency_us": 0.0,
                "timeline": [{
                    "request_id": "req-1",
                    "collective_id": "collective-1",
                    "phase_id": "phase-1",
                    "module_id": "fabric-1",
                    "domain_id": "domain-1",
                    "start_time_ps": 10,
                    "finish_time_ps": 30,
                    "actual_path": ["gpu-0", "gpu-1"],
                    "link_endpoints": {"link-1": {"source": "gpu-0", "destination": "gpu-1"}},
                    "execution_events": [{
                        "kind": "route_selected",
                        "phase_id": "phase-1",
                        "link_id": "",
                        "port_id": "",
                        "time_ps": 10,
                        "attempt": 0,
                    }],
                }],
                "module_stats": [{
                    "module_id": "fabric-1",
                    "module_kind": "scale_out",
                    "fidelity_level": "des",
                    "total_bytes": 64,
                    "total_queue_delay_us": 0.0,
                    "total_congestion_delay_us": 0.0,
                    "total_runtime_us": 0.0,
                    "total_algorithm_rounds": 1.0,
                    "transfers_executed": 1,
                }],
                "fallback_reasons": [],
                "hotspots": [],
            },
            "collective_steps": [{
                "step_id": "step-1",
                "collective_id": "collective-1",
                "phase_id": "phase-1",
                "phase": "allreduce",
                "round": 0,
                "chunk": 0,
                "start_time_ps": 10,
                "end_time_ps": 30,
                "source_device": "gpu-0",
                "destination_device": "gpu-1",
                "bytes": 64,
                "dependencies": [],
                "state": "completed",
            }],
        }

    def test_ready_artifact_is_run_bound_and_manifested(self):
        self.path.write_text(json.dumps(self.payload()), encoding="utf-8")
        inspected = runs.inspect_artifact(self.run_id, self.path, self.definition)
        self.assertEqual(inspected["schema_identity"], "tilesim.execution_replay.v1")
        manifest = server.artifact_manifest_for(self.run_id, self.directory)
        self.assertEqual(manifest["artifacts"][0]["artifact_id"], "execution-replay")

    def test_path_and_event_shape_fail_closed(self):
        payload = self.payload()
        payload["fabric"]["timeline"][0]["actual_path"] = "gpu-0 -> gpu-1"
        self.path.write_text(json.dumps(payload), encoding="utf-8")
        with self.assertRaises(runs.ArtifactContractError) as failure:
            runs.inspect_artifact(self.run_id, self.path, self.definition)
        self.assertEqual(failure.exception.json_pointer, "/fabric/timeline/0/actual_path")

    def test_run_binding_mismatch_is_rejected(self):
        payload = self.payload()
        payload["run_id"] = "run-other"
        self.path.write_text(json.dumps(payload), encoding="utf-8")
        with self.assertRaises(runs.ArtifactContractError) as failure:
            runs.inspect_artifact(self.run_id, self.path, self.definition)
        self.assertEqual(failure.exception.reason, "run_binding_mismatch")

    def test_module_stats_retain_uint64_bytes_above_safe_integer(self):
        payload = self.payload()
        payload["fabric"]["module_stats"][0]["total_bytes"] = 9007199254740993
        self.path.write_text(json.dumps(payload), encoding="utf-8")
        inspected = runs.inspect_artifact(self.run_id, self.path, self.definition)
        self.assertEqual(
            inspected["value"]["fabric"]["module_stats"][0]["total_bytes"],
            9007199254740993,
        )

    def test_module_stats_reject_non_integer_bytes(self):
        payload = self.payload()
        payload["fabric"]["module_stats"][0]["total_bytes"] = 9007199254740992.5
        self.path.write_text(json.dumps(payload), encoding="utf-8")
        with self.assertRaises(runs.ArtifactContractError) as failure:
            runs.inspect_artifact(self.run_id, self.path, self.definition)
        self.assertEqual(
            failure.exception.json_pointer,
            "/fabric/module_stats/0/total_bytes",
        )

    def test_ready_empty_timeline_is_a_valid_no_path_outcome(self):
        payload = self.payload()
        payload["start_time_ps"] = 0
        payload["finish_time_ps"] = 0
        payload["end_time_ps"] = 0
        payload["fabric"]["timeline"] = []
        payload["fabric"]["fallback_reasons"] = ["route_unavailable"]
        payload["collective_steps"] = []
        self.path.write_text(json.dumps(payload), encoding="utf-8")
        inspected = runs.inspect_artifact(self.run_id, self.path, self.definition)
        self.assertEqual(inspected["content_status"], "ready")
        manifest = server.artifact_manifest_for(self.run_id, self.directory)
        self.assertEqual(manifest["artifacts"][0]["schema_identity"], "tilesim.execution_replay.v1")


if __name__ == "__main__":
    unittest.main()
