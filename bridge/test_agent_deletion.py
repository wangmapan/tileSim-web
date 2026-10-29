from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from agent_harness.batch import BatchStore
from agent_harness.optimization import OptimizationStore
from agent_harness.store import DurableHarnessStore
from repositories.agent_flows import AgentFlowStore
from services.agent_deletion import AgentDeletionCoordinator, delete_across_stores


class _FailingStore:
    def __init__(self, fail: bool = True):
        self.fail = fail

    def delete_permanently(self, resource_id: str, **_kwargs):
        if self.fail:
            raise RuntimeError("injected store failure")
        return {"status": "deleted", "store": "fake", "resource_id": resource_id}


class _ForbiddenError(RuntimeError):
    code = "principal_mismatch"
    retryable = False


class _ForbiddenStore:
    def delete_permanently(self, resource_id: str, **_kwargs):
        raise _ForbiddenError(f"forbidden: {resource_id}")


class _ResolutionFailureStore:
    def __init__(self):
        self.fail_resolution = True
        self.delete_calls = 0

    def get(self, resource_id: str):
        if self.fail_resolution:
            raise RuntimeError("association lookup unavailable")
        return None

    def delete_permanently(self, resource_id: str, **_kwargs):
        self.delete_calls += 1
        return {"status": "deleted", "resource_id": resource_id}


class _ResolvableStore:
    def __init__(self):
        self.delete_calls = 0

    def get(self, resource_id: str):
        return {"resource_id": resource_id}

    def delete_permanently(self, resource_id: str, **_kwargs):
        self.delete_calls += 1
        return {"status": "deleted", "resource_id": resource_id}


class _SoftAndPermanentStore:
    """Guard against routing user erasure through the retention API."""

    def __init__(self):
        self.calls: list[str] = []

    def get(self, resource_id: str):
        return {"resource_id": resource_id}

    def delete_operation(self, resource_id: str, **_kwargs):
        self.calls.append("soft")
        return {"status": "deleted", "resource_id": resource_id}

    def purge_operation_graph_permanently(self, resource_id: str, **_kwargs):
        self.calls.append("permanent")
        return {"status": "deleted", "resource_id": resource_id}

    def delete_permanently(self, resource_id: str, **_kwargs):
        self.calls.append("legacy-permanent")
        return {"status": "deleted", "resource_id": resource_id}


class AgentDeletionTests(unittest.TestCase):
    def test_user_erasure_prefers_explicit_permanent_graph_purge(self):
        harness = _SoftAndPermanentStore()
        stores = {
            "harness": harness,
            "batch": _FailingStore(False),
            "optimization": _FailingStore(False),
            "flow": _FailingStore(False),
        }
        result = delete_across_stores(
            resource_id="resource",
            targets={name: "resource" for name in stores},
            stores=stores,
        )
        self.assertEqual(result["status"], "deleted")
        self.assertEqual(harness.calls, ["permanent"])

    def test_all_store_results_are_explicit_and_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stores = {
                "harness": DurableHarnessStore(root / "harness.sqlite3"),
                "batch": BatchStore(root / "batch.sqlite3"),
                "optimization": OptimizationStore(root / "optimization.sqlite3"),
                "flow": AgentFlowStore(root / "flow.sqlite3"),
            }
            targets = {name: f"resource-{name}" for name in stores}
            try:
                result = delete_across_stores(resource_id="resource", targets=targets, stores=stores)
                self.assertEqual(result["status"], "not_found")
                self.assertEqual({item["status"] for item in result["stores"].values()}, {"not_found"})
                retry = delete_across_stores(resource_id="resource", targets=targets, stores=stores)
                self.assertEqual(retry["status"], "not_found")
            finally:
                for store in stores.values():
                    store.close()

    def test_partial_failure_is_not_reported_as_success_and_can_retry(self):
        stores = {
            "harness": _FailingStore(),
            "batch": _FailingStore(False),
            "optimization": _FailingStore(False),
            "flow": _FailingStore(False),
        }
        targets = {name: f"resource-{name}" for name in stores}
        result = delete_across_stores(resource_id="resource", targets=targets, stores=stores)
        self.assertEqual(result["status"], "deletion_incomplete")
        self.assertEqual(result["stores"]["harness"]["status"], "failed")
        stores["harness"].fail = False
        retry = delete_across_stores(resource_id="resource", targets=targets, stores=stores)
        self.assertEqual(retry["status"], "deleted")

    def test_missing_association_is_distinguished(self):
        stores = {name: _FailingStore(False) for name in ("harness", "batch", "optimization", "flow")}
        result = delete_across_stores(
            resource_id="resource",
            targets={"harness": None, "batch": "batch-resource", "optimization": None, "flow": None},
            stores=stores,
        )
        self.assertEqual(result["status"], "deleted")
        self.assertEqual(result["stores"]["harness"]["status"], "not_applicable")

    def test_permission_failure_is_distinct_from_retryable_store_failure(self):
        stores = {
            "harness": _ForbiddenStore(),
            "batch": _FailingStore(False),
            "optimization": _FailingStore(False),
            "flow": _FailingStore(False),
        }
        targets = {name: f"resource-{name}" for name in stores}
        result = delete_across_stores(resource_id="resource", targets=targets, stores=stores)
        self.assertEqual(result["status"], "permission_denied")
        self.assertEqual(result["stores"]["harness"]["status"], "forbidden")
        self.assertFalse(result["stores"]["harness"]["retryable"])

        stores["batch"] = _FailingStore(True)
        mixed = delete_across_stores(resource_id="resource", targets=targets, stores=stores)
        self.assertEqual(mixed["status"], "deletion_incomplete")

    def test_resolution_failure_is_preflight_and_does_not_partially_delete(self):
        with tempfile.TemporaryDirectory() as directory:
            failing = _ResolutionFailureStore()
            resolvable = _ResolvableStore()
            stores = {"harness": failing, "batch": resolvable, "optimization": _FailingStore(False), "flow": _FailingStore(False)}
            coordinator = AgentDeletionCoordinator(stores, Path(directory) / "deletion.sqlite3")
            try:
                first = coordinator.delete_resource(resource_id="resource", idempotency_key="preflight-01")
                self.assertEqual(first["status"], "deletion_incomplete")
                self.assertEqual(resolvable.delete_calls, 0)
                failing.fail_resolution = False
                second = coordinator.delete_resource(resource_id="resource", idempotency_key="preflight-01")
                self.assertEqual(second["status"], "deleted")
                self.assertEqual(resolvable.delete_calls, 1)
            finally:
                coordinator.close()

    def test_deletion_journal_replays_completed_result_after_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "deletion.sqlite3"
            stores = {name: _FailingStore(False) for name in ("harness", "batch", "optimization", "flow")}
            targets = {name: f"resource-{name}" for name in stores}
            first = AgentDeletionCoordinator(stores, path)
            result = first.delete(resource_id="resource", targets=targets, idempotency_key="delete-restart-01")
            self.assertEqual(result["status"], "deleted")
            first.close()
            second = AgentDeletionCoordinator(stores, path)
            replay = second.delete(resource_id="resource", targets=targets, idempotency_key="delete-restart-01")
            self.assertEqual(replay, result)
            second.close()


if __name__ == "__main__":
    unittest.main()
