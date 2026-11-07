import tempfile
import time
import unittest
import threading
from pathlib import Path

from repositories.explorations import ExplorationRepository, ExplorationRepositoryError
from services.exploration_service import ExplorationService, ExplorationServiceError
from services.exploration_worker import ExplorationWorker
from services.run_executor import LocalSyntheticRunExecutor, RunExecutor, RunExecutorUnavailable, RunIntakeExecutor
from services.exploration_graph import ExplorationGraphDependencyError, build_exploration_graph
from agent_harness.exploration_planning import confirm_exploration_plan, plan_exploration


class ControlledExecutor(RunExecutor):
    executor_type = "controlled_synthetic"

    def __init__(self, *, cancel_status="cancelled"):
        self.created = threading.Event()
        self.release_wait = threading.Event()
        self.wait_started = threading.Event()
        self.cancel_status = cancel_status
        self.cancelled = False
        self.wait_calls = 0
        self.last_cancel_identity = None

    def create_run(self, candidate, authorization):
        self.created.set()
        return {"run_id": "controlled-run", "status": "running", "idempotency_key": candidate["run_idempotency_key"]}

    def wait_for_terminal(self, run_identity):
        self.wait_started.set()
        self.wait_calls += 1
        self.release_wait.wait(2)
        if self.cancelled:
            return {"run_id": run_identity["run_id"], "status": "cancelled"}
        return {"run_id": run_identity["run_id"], "status": "completed"}

    def read_verified_metrics(self, run_identity, metric_path):
        return {"run_id": run_identity["run_id"], "status": "verified", "metric_path": metric_path, "value": 1.0, "evidence": [{"run_id": run_identity["run_id"], "json_pointer": metric_path}]}

    def cancel(self, run_identity):
        self.last_cancel_identity = dict(run_identity)
        self.cancelled = self.cancel_status == "cancelled"
        return {"run_id": run_identity["run_id"], "status": self.cancel_status}


class CrashAfterCreateExecutor(ControlledExecutor):
    def create_run(self, candidate, authorization):
        super().create_run(candidate, authorization)
        raise KeyboardInterrupt("simulated process crash after external create")


class CrashAtExecutorStage(ControlledExecutor):
    def __init__(self, stage):
        super().__init__()
        self.stage = stage

    def wait_for_terminal(self, run_identity):
        if self.stage == "wait_run":
            raise KeyboardInterrupt("simulated process crash during wait")
        return super().wait_for_terminal(run_identity) | {"status": "completed"}

    def read_verified_metrics(self, run_identity, metric_path):
        if self.stage == "verified_metric":
            raise KeyboardInterrupt("simulated process crash during metric read")
        return super().read_verified_metrics(run_identity, metric_path)


class ManualWorker(ExplorationWorker):
    def start(self, session_id):
        return None


class FakeRunIntakeTransport:
    def __init__(self):
        self.calls = []
        self.statuses = [{"status": "running"}, {"status": "completed"}]
        self.manifest = {"run_id": "run-formal-1", "artifacts": [{"artifact_id": "metrics", "contract_status": "supported", "content_status": "ready", "sha256": "abc"}]}
        self.metrics = {"summary": {"throughput_requests_per_second": 42.0}}

    def request(self, method, path, *, body=None, headers=None):
        self.calls.append((method, path, body, headers))
        if method == "POST" and path == "/api/runs":
            return 202, {"run_id": "run-formal-1", "status": "preparing"}
        if method == "GET" and path == "/api/runs/run-formal-1":
            return 200, self.statuses.pop(0) if self.statuses else {"status": "completed"}
        if method == "GET" and path.endswith("/artifacts"):
            return 200, self.manifest
        if method == "GET" and path.endswith("/files/metrics"):
            return 200, self.metrics
        if method == "POST" and path.endswith("/cancel"):
            return 200, {"status": "cancelled"}
        return 404, {}


class CancelStatusTransport(FakeRunIntakeTransport):
    def __init__(self, cancel_status):
        super().__init__()
        self.cancel_status = cancel_status

    def request(self, method, path, *, body=None, headers=None):
        if method == "POST" and path.endswith("/cancel"):
            self.calls.append((method, path, body, headers))
            return 200, {"status": self.cancel_status}
        return super().request(method, path, body=body, headers=headers)


class ExplorationRuntimeTests(unittest.TestCase):
    def setUp(self):
        try:
            graph, _ = build_exploration_graph(Path(tempfile.mkdtemp()) / "checkpoints.sqlite")
        except ExplorationGraphDependencyError:
            self.skipTest("LangGraph dependency is not installed in the invoking Python")
        self.root = Path(tempfile.mkdtemp())
        self.schema = "sha256:" + "a" * 64
        self.backend = {"backend_revision": "synthetic"}
        self.repository = ExplorationRepository(self.root / "exploration.sqlite")
        self.worker = ExplorationWorker(self.repository, executor=LocalSyntheticRunExecutor(), graph=graph)
        self.service = ExplorationService(self.repository, schema_set_revision=self.schema, backend_identity=self.backend, worker=self.worker)

    def request(self, *, rounds=2):
        return {
            "context": {"context_revision": "ctx-1", "input_snapshot_digest": "sha256:" + "b" * 64, "schema_set_revision": self.schema, "backend_identity": self.backend, "parameter_catalog_revision": "catalog-1", "current_page": "experiment", "run_id": None, "run_context_revision": None, "available_parameters": ["/x"]},
            "objective": {"metric_path": "/metrics/x", "direction": "minimize"},
            "parameter_grants": [{"pointer": "/x", "min": 1, "max": 4, "step": 1, "kind": "number"}],
            "base_config": {"x": 2},
            "budget": {"max_rounds": rounds, "max_runs": rounds},
        }

    def test_waiting_authorization_and_serial_completion(self):
        created = self.service.create(self.request(), "local-user", "local-workspace")
        self.assertEqual(created["session"]["state"], "waiting_authorization")
        self.service.authorize(created["session"]["session_id"], {}, "local-user", "local-workspace")
        for _ in range(200):
            detail = self.service.get(created["session"]["session_id"], "local-user", "local-workspace")
            if detail["session"]["state"] in {"completed", "run_failed", "recovery_required"}:
                break
            time.sleep(0.01)
        self.assertIn(detail["session"]["state"], {"completed", "budget_exhausted"})
        self.assertEqual(detail["session"]["budget"]["max_concurrency"], 1)
        self.assertIsNone(self.repository.active_slot())

    def test_confirmed_multi_scenario_plan_runs_serially_before_comparison(self):
        context = self.request()["context"]
        context.update({
            "run_request": {"model_id": "model-a", "engine": "engine-a", "gpu_type": "A100", "gpu_count": 1},
            "deployment_candidates": [{"candidate_id": "published-a", "status": "published", "published": True, "executable": True}],
            "workload_scenarios": [{"scenario_id": "low"}, {"scenario_id": "high"}],
        })
        plan = plan_exploration(
            context=context,
            request={"objective": {"metric_path": "/metrics/x", "direction": "minimize"}},
            schema_set_revision=self.schema,
        )
        plan = confirm_exploration_plan(plan, principal="local-user", confirmation={"confirmed": True})
        request = self.request(rounds=1)
        request["budget"] = {"max_rounds": 1, "max_runs": 2}
        request["context"] = context
        request["planning_plan"] = plan
        created = self.service.create(request, "local-user", "local-workspace")
        session_id = created["session"]["session_id"]
        self.service.authorize(session_id, {}, "local-user", "local-workspace")
        for _ in range(300):
            detail = self.service.get(session_id, "local-user", "local-workspace")
            if detail["session"]["state"] in {"completed", "budget_exhausted", "run_failed", "recovery_required"}:
                break
            time.sleep(0.01)
        self.assertEqual(detail["session"]["state"], "budget_exhausted")
        self.assertEqual(detail["session"]["run_count"], 2)
        for _ in range(50):
            if self.repository.active_slot() is None:
                break
            time.sleep(0.01)
        self.assertIsNone(self.repository.active_slot())

    def test_context_and_authorization_are_bound(self):
        created = self.service.create(self.request(), "local-user", "local-workspace")
        with self.assertRaises(ExplorationServiceError):
            self.service.get(created["session"]["session_id"], "other-user", "local-workspace")
        auth = self.service.authorize(created["session"]["session_id"], {}, "local-user", "local-workspace")
        self.assertTrue(auth["authorization"]["authorization_digest"].startswith("sha256:"))
        self.assertEqual(auth["authorization"]["protected"]["context_revision"], "ctx-1")

    def test_unique_slot(self):
        first = self.service.create(self.request(), "local-user", "local-workspace")
        second = self.service.create(self.request(), "local-user", "local-workspace")
        self.repository.claim_slot(first["session"]["session_id"], "run-a", "now")
        with self.assertRaises(ExplorationRepositoryError) as error:
            self.repository.claim_slot(second["session"]["session_id"], "run-b", "now")
        self.assertEqual(error.exception.code, "exploration_busy")

    def test_second_authorization_is_rejected_while_first_session_is_active(self):
        graph, _ = build_exploration_graph(self.root / "delay-checkpoints.sqlite")
        delayed_worker = ExplorationWorker(self.repository, executor=LocalSyntheticRunExecutor(delay_seconds=0.2), graph=graph)
        delayed_service = ExplorationService(
            self.repository,
            schema_set_revision=self.schema,
            backend_identity=self.backend,
            worker=delayed_worker,
        )
        first = delayed_service.create(self.request(rounds=2), "local-user", "local-workspace")
        second = delayed_service.create(self.request(rounds=2), "local-user", "local-workspace")
        delayed_service.authorize(first["session"]["session_id"], {}, "local-user", "local-workspace")
        with self.assertRaises(ExplorationServiceError) as error:
            delayed_service.authorize(second["session"]["session_id"], {}, "local-user", "local-workspace")
        self.assertEqual(error.exception.code, "exploration_busy")

    def test_pause_during_wait_preserves_paused_state(self):
        executor = ControlledExecutor()
        graph, _ = build_exploration_graph(self.root / "pause-checkpoints.sqlite", executor=executor)
        worker = ExplorationWorker(self.repository, executor=executor, graph=graph)
        service = ExplorationService(self.repository, schema_set_revision=self.schema, backend_identity=self.backend, worker=worker)
        created = service.create(self.request(rounds=2), "local-user", "local-workspace")
        sid = created["session"]["session_id"]
        service.authorize(sid, {}, "local-user", "local-workspace")
        self.assertTrue(executor.wait_started.wait(1))
        self.assertEqual(service.action(sid, "pause", "local-user", "local-workspace")["session"]["state"], "paused")
        executor.release_wait.set()
        time.sleep(0.05)
        self.assertEqual(service.get(sid, "local-user", "local-workspace")["session"]["state"], "paused")

    def test_cancel_unknown_keeps_slot_and_blocks_second_session(self):
        executor = ControlledExecutor(cancel_status="unknown")
        graph, _ = build_exploration_graph(self.root / "cancel-checkpoints.sqlite", executor=executor)
        worker = ExplorationWorker(self.repository, executor=executor, graph=graph)
        service = ExplorationService(self.repository, schema_set_revision=self.schema, backend_identity=self.backend, worker=worker)
        first = service.create(self.request(rounds=2), "local-user", "local-workspace")
        second = service.create(self.request(rounds=2), "local-user", "local-workspace")
        service.authorize(first["session"]["session_id"], {}, "local-user", "local-workspace")
        self.assertTrue(executor.wait_started.wait(1))
        stopped = service.action(first["session"]["session_id"], "cancel", "local-user", "local-workspace")
        self.assertEqual(stopped["session"]["state"], "recovery_required")
        self.assertIsNotNone(self.repository.active_slot())
        with self.assertRaises(ExplorationServiceError) as error:
            service.authorize(second["session"]["session_id"], {}, "local-user", "local-workspace")
        self.assertEqual(error.exception.code, "exploration_busy")
        executor.release_wait.set()

    def test_cancel_receives_formal_session_bindings_and_releases_confirmed_run(self):
        executor = ControlledExecutor(cancel_status="cancelled")
        graph, _ = build_exploration_graph(self.root / "cancel-bindings.sqlite", executor=executor)
        worker = ExplorationWorker(self.repository, executor=executor, graph=graph)
        service = ExplorationService(self.repository, schema_set_revision=self.schema, backend_identity=self.backend, worker=worker)
        created = service.create(self.request(rounds=2), "local-user", "local-workspace")
        sid = created["session"]["session_id"]
        service.authorize(sid, {}, "local-user", "local-workspace")
        self.assertTrue(executor.wait_started.wait(1))
        result = service.action(sid, "cancel", "local-user", "local-workspace")
        self.assertEqual(result["session"]["state"], "cancelled")
        self.assertEqual(executor.last_cancel_identity["principal"], "local-user")
        self.assertEqual(executor.last_cancel_identity["workspace_id"], "local-workspace")
        self.assertEqual(executor.last_cancel_identity["schema_set_revision"], self.schema)
        self.assertEqual(executor.last_cancel_identity["backend_identity"], self.backend)
        self.assertIsNone(self.repository.active_slot())
        executor.release_wait.set()

    def test_restart_with_inflight_external_result_enters_recovery_without_second_create(self):
        executor = CrashAfterCreateExecutor()
        graph, _ = build_exploration_graph(self.root / "restart-checkpoints.sqlite", executor=executor)
        worker = ManualWorker(self.repository, executor=executor, graph=graph)
        service = ExplorationService(self.repository, schema_set_revision=self.schema, backend_identity=self.backend, worker=worker)
        created = service.create(self.request(rounds=2), "local-user", "local-workspace")
        sid = created["session"]["session_id"]
        service.authorize(sid, {}, "local-user", "local-workspace")
        with self.assertRaises(KeyboardInterrupt):
            worker._run(sid)
        restarted_graph, _ = build_exploration_graph(self.root / "restart-checkpoints.sqlite", executor=executor)
        restarted = ManualWorker(self.repository, executor=executor, graph=restarted_graph)
        restarted._run(sid)
        state = self.repository.get(sid)
        self.assertEqual(state["status"], "recovery_required")
        self.assertEqual(executor.wait_calls, 0)

    def test_restart_during_wait_and_metric_read_enters_recovery(self):
        for stage in ("wait_run", "verified_metric"):
            with self.subTest(stage=stage):
                repository = ExplorationRepository(self.root / f"repository-{stage}.sqlite")
                executor = CrashAtExecutorStage(stage)
                graph, _ = build_exploration_graph(self.root / f"restart-{stage}.sqlite", executor=executor)
                worker = ManualWorker(repository, executor=executor, graph=graph)
                service = ExplorationService(repository, schema_set_revision=self.schema, backend_identity=self.backend, worker=worker)
                created = service.create(self.request(rounds=2), "local-user", "local-workspace")
                sid = created["session"]["session_id"]
                service.authorize(sid, {}, "local-user", "local-workspace")
                with self.assertRaises(KeyboardInterrupt):
                    worker._run(sid)
                restarted_graph, _ = build_exploration_graph(self.root / f"restart-{stage}.sqlite", executor=executor)
                ManualWorker(repository, executor=executor, graph=restarted_graph)._run(sid)
                self.assertEqual(repository.get(sid)["status"], "recovery_required")

    def test_executor_boundary_keeps_synthetic_provenance_and_evidence_shape(self):
        executor = LocalSyntheticRunExecutor()
        candidate = {"candidate_digest": "candidate-1", "run_idempotency_key": "key-1", "config": {"x": 2}}
        run = executor.create_run(candidate, {"authorization_id": "auth-1"})
        self.assertEqual(run["executor_type"], "local_synthetic")
        self.assertEqual(run["provenance"]["source_mode"], "synthetic_trace")
        self.assertEqual(executor.wait_for_terminal(run)["status"], "completed")
        metric = executor.read_verified_metrics(run, "/metrics/x")
        self.assertEqual(metric["status"], "verified")
        self.assertEqual(metric["artifact_status"], "synthetic_trace_only")
        self.assertEqual(metric["provenance"]["production_status"], "not_for_production")
        self.assertEqual(metric["evidence"][0]["json_pointer"], "/metrics/x")

    def test_run_intake_executor_is_explicitly_unwired(self):
        executor = RunIntakeExecutor()
        with self.assertRaises(RunExecutorUnavailable) as error:
            executor.create_run({}, {})
        self.assertEqual(error.exception.code, "run_intake_executor_not_connected")

    def test_run_intake_executor_uses_formal_request_and_idempotency(self):
        transport = FakeRunIntakeTransport()
        executor = RunIntakeExecutor(transport, poll_interval_seconds=0, max_wait_seconds=1)
        candidate = {"candidate_digest": "sha256:" + "c" * 64, "run_idempotency_key": "exploration:key", "config": {"x": 3}}
        authorization = {"principal": "local-user", "workspace_id": "local-workspace", "parameter_grants": [{"pointer": "/x"}], "run_request": {"scenario_id": "synthetic", "fidelity_policy": "des", "gpu_participation_mode": "gpu_free", "overrides": {"x": 2}}}
        run = executor.create_run(candidate, authorization)
        self.assertEqual(run["run_id"], "run-formal-1")
        self.assertEqual(transport.calls[0][1], "/api/runs")
        self.assertEqual(transport.calls[0][2]["overrides"], {"x": 3})
        self.assertEqual(transport.calls[0][3]["Idempotency-Key"], "exploration:key")
        self.assertEqual(executor.wait_for_terminal(run)["status"], "completed")

    def test_run_intake_projects_only_changed_authorized_field_from_full_template(self):
        transport = FakeRunIntakeTransport()
        executor = RunIntakeExecutor(transport)
        candidate = {
            "candidate_digest": "sha256:" + "1" * 64,
            "run_idempotency_key": "exploration:full-template",
            "config": {"overrides": {"runtime": {"max_batch_size": 3}, "workload": {"message_size_multiplier": 1}}},
            "changed_fields": ["/overrides/runtime/max_batch_size"],
        }
        authorization = {
            "principal": "local-user",
            "workspace_id": "local-workspace",
            "parameter_grants": [{"pointer": "/overrides/runtime/max_batch_size"}],
            "run_request": {
                "scenario_id": "s1_des_example",
                "fidelity_policy": "des",
                "gpu_participation_mode": "gpu_free",
                "overrides": {"runtime": {"max_batch_size": 4}, "workload": {"message_size_multiplier": 1}},
            },
        }
        executor.create_run(candidate, authorization)
        submitted = transport.calls[0][2]
        self.assertEqual(submitted["overrides"]["runtime"]["max_batch_size"], 3)
        self.assertEqual(submitted["overrides"]["workload"]["message_size_multiplier"], 1)

    def test_run_intake_executor_reads_manifest_bound_metric_evidence(self):
        transport = FakeRunIntakeTransport()
        executor = RunIntakeExecutor(transport, poll_interval_seconds=0, max_wait_seconds=1)
        metric = executor.read_verified_metrics({"run_id": "run-formal-1"}, "/summary/throughput_requests_per_second")
        self.assertEqual(metric["status"], "verified")
        self.assertEqual(metric["value"], 42.0)
        self.assertEqual(metric["artifact_status"], "verified_formal_artifact")
        self.assertEqual(metric["evidence"][0]["run_id"], "run-formal-1")
        self.assertTrue(metric["evidence"][0]["manifest_digest"].startswith("sha256:"))

    def test_run_intake_executor_rejects_unauthorized_candidate_field(self):
        executor = RunIntakeExecutor(FakeRunIntakeTransport())
        candidate = {"run_idempotency_key": "key", "config": {"y": 2}}
        auth = {"parameter_grants": [{"pointer": "/x"}], "run_request": {"scenario_id": "synthetic", "overrides": {"x": 1}}}
        with self.assertRaises(ValueError):
            executor.create_run(candidate, auth)

    def test_run_intake_executor_cancel_is_unknown_without_published_endpoint(self):
        executor = RunIntakeExecutor(FakeRunIntakeTransport())
        self.assertEqual(executor.cancel({"run_id": "run-formal-1"})["status"], "unknown")

    def test_run_intake_executor_cancel_uses_explicit_published_endpoint(self):
        transport = FakeRunIntakeTransport()
        executor = RunIntakeExecutor(transport, cancel_path=lambda run_id: f"/api/runs/{run_id}/cancel")
        self.assertEqual(executor.cancel({"run_id": "run-formal-1"})["status"], "cancelled")
        cancel_call = next(call for call in transport.calls if call[0] == "POST" and call[1].endswith("/cancel"))
        self.assertLessEqual(len(cancel_call[3]["Idempotency-Key"]), 128)

    def test_run_intake_cancel_bounds_long_exploration_key_without_changing_binding(self):
        transport = FakeRunIntakeTransport()
        executor = RunIntakeExecutor(transport, cancel_path=lambda run_id: f"/api/runs/{run_id}/cancel")
        identity = {"run_id": "run-formal-1", "idempotency_key": "exploration:" + "x" * 120}
        self.assertEqual(executor.cancel(identity)["status"], "cancelled")
        first = next(call for call in transport.calls if call[0] == "POST" and call[1].endswith("/cancel"))
        self.assertLessEqual(len(first[3]["Idempotency-Key"]), 128)
        transport.calls.clear()
        self.assertEqual(executor.cancel(identity)["status"], "cancelled")
        second = next(call for call in transport.calls if call[0] == "POST" and call[1].endswith("/cancel"))
        self.assertEqual(first[3]["Idempotency-Key"], second[3]["Idempotency-Key"])

    def test_run_intake_cancel_statuses_never_promote_unknown_to_cancelled(self):
        confirmed = RunIntakeExecutor(CancelStatusTransport("confirmed_cancelled"), cancel_path=lambda run_id: f"/api/runs/{run_id}/cancel")
        self.assertEqual(confirmed.cancel({"run_id": "run-formal-1"})["status"], "cancelled")
        terminal = RunIntakeExecutor(CancelStatusTransport("already_terminal"), cancel_path=lambda run_id: f"/api/runs/{run_id}/cancel")
        self.assertEqual(terminal.cancel({"run_id": "run-formal-1"})["status"], "unknown")
        unknown = RunIntakeExecutor(CancelStatusTransport("cancel_unknown"), cancel_path=lambda run_id: f"/api/runs/{run_id}/cancel")
        self.assertEqual(unknown.cancel({"run_id": "run-formal-1"})["status"], "unknown")

    def test_run_intake_cancel_updates_effect_only_when_formal_endpoint_confirms(self):
        repository = ExplorationRepository(self.root / "cancel-envelope.sqlite")
        repository.save_run_effect({"idempotency_key": "exploration:cancel-1", "session_id": "exploration-cancel", "candidate_id": "candidate-cancel", "request_digest": "sha256:" + "f" * 64, "request_summary": {}, "executor_type": "run_intake_v2", "submitted_at": "now", "side_effect_status": "submitted", "waiting_for": "wait_run"})
        transport = FakeRunIntakeTransport()
        executor = RunIntakeExecutor(transport, repository=repository, cancel_path=lambda run_id: f"/api/runs/{run_id}/cancel")
        self.assertEqual(executor.cancel({"run_id": "run-formal-1", "idempotency_key": "exploration:cancel-1"})["status"], "cancelled")
        self.assertEqual(repository.run_effect("exploration:cancel-1")["side_effect_status"], "cancelled")
        unknown_repository = ExplorationRepository(self.root / "cancel-unknown-envelope.sqlite")
        unknown_repository.save_run_effect({"idempotency_key": "exploration:cancel-2", "session_id": "exploration-cancel", "candidate_id": "candidate-cancel", "request_digest": "sha256:" + "f" * 64, "request_summary": {}, "executor_type": "run_intake_v2", "submitted_at": "now", "side_effect_status": "submitted", "waiting_for": "wait_run"})
        unknown_executor = RunIntakeExecutor(FakeRunIntakeTransport(), repository=unknown_repository)
        self.assertEqual(unknown_executor.cancel({"run_id": "run-formal-1", "idempotency_key": "exploration:cancel-2"})["status"], "unknown")
        self.assertEqual(unknown_repository.run_effect("exploration:cancel-2")["side_effect_status"], "cancel_unknown")

    def test_run_intake_envelope_replays_confirmed_create_and_rejects_digest_conflict(self):
        transport = FakeRunIntakeTransport()
        executor = RunIntakeExecutor(transport, poll_interval_seconds=0, max_wait_seconds=1, repository=self.repository)
        candidate = {"candidate_id": "candidate-1", "candidate_digest": "sha256:" + "d" * 64, "run_idempotency_key": "exploration:envelope-1", "config": {"x": 3}}
        authorization = {"principal": "local-user", "workspace_id": "local-workspace", "parameter_grants": [{"pointer": "/x"}], "run_request": {"scenario_id": "synthetic", "overrides": {"x": 2}}, "execution_envelope": {"session_id": "exploration-envelope", "candidate_id": "candidate-1"}}
        first = executor.create_run(candidate, authorization)
        replay = executor.create_run(candidate, authorization)
        self.assertEqual(replay["run_id"], first["run_id"])
        self.assertTrue(replay["replayed"])
        self.assertEqual(len([call for call in transport.calls if call[0] == "POST"]), 1)
        effect = self.repository.run_effect(candidate["run_idempotency_key"])
        self.assertEqual(effect["side_effect_status"], "submitted")
        self.assertEqual(effect["session_id"], "exploration-envelope")
        self.assertEqual(effect["candidate_id"], "candidate-1")
        self.assertEqual(effect["waiting_for"], "wait_run")
        self.assertIsNotNone(effect["last_confirmed_at"])
        self.assertEqual(effect["result_summary"]["run_id"], "run-formal-1")
        conflicting = {**candidate, "config": {"x": 4}}
        with self.assertRaises(ValueError):
            executor.create_run(conflicting, authorization)

    def test_run_intake_create_save_failure_replays_same_key_after_restart(self):
        transport = FakeRunIntakeTransport()
        repository = ExplorationRepository(self.root / "envelope-crash.sqlite")
        executor = RunIntakeExecutor(transport, poll_interval_seconds=0, max_wait_seconds=1, repository=repository)
        original_update = repository.update_run_effect
        failed_once = {"value": False}
        def fail_after_remote_commit(*args, **kwargs):
            if not failed_once["value"] and kwargs.get("side_effect_status") == "submitted":
                failed_once["value"] = True
                raise OSError("simulated local save failure")
            return original_update(*args, **kwargs)
        repository.update_run_effect = fail_after_remote_commit
        candidate = {"candidate_id": "candidate-crash", "candidate_digest": "sha256:" + "e" * 64, "run_idempotency_key": "exploration:crash-1", "config": {"x": 3}}
        authorization = {"parameter_grants": [{"pointer": "/x"}], "run_request": {"scenario_id": "synthetic", "overrides": {"x": 2}}, "execution_envelope": {"session_id": "exploration-crash", "candidate_id": "candidate-crash"}}
        with self.assertRaises(OSError):
            executor.create_run(candidate, authorization)
        restarted = RunIntakeExecutor(transport, poll_interval_seconds=0, max_wait_seconds=1, repository=repository)
        recovered = restarted.create_run(candidate, authorization)
        self.assertEqual(recovered["run_id"], "run-formal-1")
        self.assertTrue(recovered["replayed"])
        self.assertEqual(len([call for call in transport.calls if call[0] == "POST"]), 2)

    def test_run_intake_executor_drives_serial_langgraph_session(self):
        transport = FakeRunIntakeTransport()
        executor = RunIntakeExecutor(transport, poll_interval_seconds=0, max_wait_seconds=1)
        graph, _ = build_exploration_graph(self.root / "formal-integration-checkpoints.sqlite", executor=executor)
        worker = ExplorationWorker(self.repository, executor=executor, graph=graph)
        service = ExplorationService(
            self.repository,
            schema_set_revision=self.schema,
            backend_identity=self.backend,
            worker=worker,
        )
        request = {
            "context": {
                "context_revision": "ctx-formal-1",
                "input_snapshot_digest": "sha256:" + "c" * 64,
                "schema_set_revision": self.schema,
                "backend_identity": self.backend,
                "parameter_catalog_revision": "catalog-1",
                "current_page": "experiment",
                "run_id": None,
                "run_context_revision": None,
                "available_parameters": ["/overrides/runtime/max_batch_size"],
            },
            "objective": {"metric_path": "/summary/throughput_requests_per_second", "direction": "maximize"},
            "parameter_grants": [{"pointer": "/overrides/runtime/max_batch_size", "min": 1, "max": 4, "step": 1, "kind": "number"}],
            "base_config": {"overrides": {"runtime": {"max_batch_size": 4}}},
            "run_request": {
                "scenario_id": "synthetic",
                "fidelity_policy": "des",
                "gpu_participation_mode": "gpu_free",
                "overrides": {"runtime": {"max_batch_size": 4}},
            },
            "budget": {"max_rounds": 1, "max_runs": 1},
        }
        created = service.create(request, "local-user", "local-workspace")
        session_id = created["session"]["session_id"]
        service.authorize(session_id, {}, "local-user", "local-workspace")
        for _ in range(100):
            detail = service.get(session_id, "local-user", "local-workspace")
            if detail["session"]["state"] in {"budget_exhausted", "completed", "recovery_required", "run_failed"}:
                break
            time.sleep(0.01)
        self.assertEqual(detail["session"]["state"], "budget_exhausted")
        paths = [(method, path) for method, path, _, _ in transport.calls]
        self.assertIn(("POST", "/api/runs"), paths)
        self.assertIn(("GET", "/api/runs/run-formal-1/artifacts"), paths)
        self.assertIn(("GET", "/api/runs/run-formal-1/files/metrics"), paths)
        create_call = next(call for call in transport.calls if call[0] == "POST" and call[1] == "/api/runs")
        self.assertTrue(create_call[3]["Idempotency-Key"].startswith("exploration:"))


if __name__ == "__main__":
    unittest.main()
