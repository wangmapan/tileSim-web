"""Fail-closed, idempotent erasure across the Agent-owned stores.

The stores are separate SQLite databases and therefore cannot share one
transaction.  This coordinator records the result of every store attempt in
the returned audit projection.  A failed store is never reported as deleted;
retrying the same request is safe because each store's permanent deletion is
idempotent and treats an already absent resource as success.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any, Mapping

try:
    from agent_harness.contracts import canonical_sha256
except ImportError:  # pragma: no cover
    from ..agent_harness.contracts import canonical_sha256


STORE_ORDER = ("harness", "batch", "optimization", "flow")


def _store_error(error: BaseException) -> dict[str, Any]:
    code = str(getattr(error, "code", "deletion_store_failed"))
    permission_error = code in {"principal_mismatch", "workspace_mismatch", "operation_access_denied", "forbidden", "permission_denied"}
    return {
        "status": "forbidden" if permission_error else "failed",
        "code": code,
        "retryable": False if permission_error else bool(getattr(error, "retryable", True)),
        "detail": str(error)[:240],
    }


def delete_across_stores(
    *,
    resource_id: str,
    targets: Mapping[str, str | list[str] | tuple[str, ...] | None],
    stores: Mapping[str, Any],
    principal: str | None = None,
    workspace_id: str | None = None,
) -> dict[str, Any]:
    """Delete one explicitly identified resource from all four stores.

    ``targets`` is deliberately explicit: a caller must first resolve the
    resource's associations and may not pass a broad principal/workspace
    delete.  ``None`` means the store has no associated record and is retained
    as an auditable ``not_applicable`` result.  Missing store bindings are a
    protocol failure, not an implicit success.
    """
    if not isinstance(resource_id, str) or not resource_id.strip():
        return {"status": "invalid_request", "code": "resource_id_required", "resource_id": resource_id, "stores": {}}
    results: dict[str, dict[str, Any]] = {}
    failed = False
    touched = False
    deleted_any = False
    for store_name in STORE_ORDER:
        raw_target = targets.get(store_name)
        target_ids = [] if raw_target is None else ([raw_target] if isinstance(raw_target, str) else list(raw_target))
        if not target_ids:
            results[store_name] = {"status": "not_applicable", "resource_id": None}
            continue
        touched = True
        store = stores.get(store_name)
        delete_method = getattr(store, "purge_operation_graph_permanently", None) if store is not None else None
        if delete_method is None:
            delete_method = getattr(store, "delete_permanently", None) if store is not None else None
        if store_name == "harness" and store is not None:
            delete_method = getattr(store, "purge_operation_graph_permanently", delete_method)
        if not callable(delete_method):
            results[store_name] = {"status": "failed", "code": "deletion_store_unavailable", "retryable": True, "resource_id": target_ids}
            failed = True
            continue
        store_results = []
        for target_id in target_ids:
            try:
                result = delete_method(target_id, principal=principal, workspace_id=workspace_id)
                if not isinstance(result, dict) or result.get("status") not in {"deleted", "not_found", "forbidden"}:
                    store_results.append({"status": "failed", "code": "invalid_store_deletion_result", "retryable": True, "resource_id": target_id})
                    failed = True
                else:
                    deleted_any = deleted_any or result.get("status") == "deleted"
                    store_results.append({**result, "resource_id": target_id})
            except Exception as error:  # store-specific errors are returned, never swallowed as success
                store_results.append({**_store_error(error), "resource_id": target_id})
                failed = True
        if any(item.get("status") in {"failed", "forbidden"} for item in store_results):
            failed = True
        results[store_name] = store_results[0] if len(store_results) == 1 else {"status": "failed" if any(item.get("status") == "failed" for item in store_results) else ("forbidden" if any(item.get("status") == "forbidden" for item in store_results) else "deleted"), "resources": store_results}
    if failed:
        permission_failure = any(
            value.get("status") == "forbidden"
            or any(item.get("status") == "forbidden" for item in value.get("resources", []))
            for value in results.values()
            if isinstance(value, dict)
        )
        non_permission_failure = any(
            value.get("status") == "failed"
            or any(item.get("status") == "failed" for item in value.get("resources", []))
            for value in results.values()
            if isinstance(value, dict)
        )
        status = "deletion_incomplete" if non_permission_failure or not permission_failure else "permission_denied"
    elif not touched or not deleted_any:
        status = "not_found"
    else:
        status = "deleted"
    return {
        "status": status,
        "resource_id": resource_id,
        "stores": results,
        "retryable": status == "deletion_incomplete",
        "provenance": {
            "deployment_mode": "local_dev",
            "source_mode": "synthetic_trace",
            "claim_scope": "exploratory",
            "production_status": "not_for_production",
        },
    }


class AgentDeletionCoordinator:
    """Durable idempotency journal for the non-atomic four-store protocol."""

    def __init__(self, stores: Mapping[str, Any], journal_path: str | Path):
        self.stores = stores
        self.path = Path(journal_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._db = sqlite3.connect(str(self.path), check_same_thread=False, isolation_level=None)
        self._db.row_factory = sqlite3.Row
        self._db.execute("PRAGMA busy_timeout=5000")
        self._db.execute(
            "CREATE TABLE IF NOT EXISTS deletion_requests (idempotency_key TEXT PRIMARY KEY, payload_digest TEXT NOT NULL, resource_id TEXT NOT NULL, status TEXT NOT NULL, result_json TEXT NOT NULL, updated_at TEXT NOT NULL)"
        )
        self._resolution_errors: dict[str, dict[str, Any]] = {}

    def close(self) -> None:
        with self._lock:
            self._db.close()

    def resolve_targets(self, resource_id: str) -> dict[str, list[str]]:
        """Resolve exact store-owned IDs before starting deletion.

        A run may be referenced by several Agent records.  Resolution is
        explicit and read-only; the deletion phase then receives only those
        IDs, so an arbitrary principal/workspace cannot trigger a broad purge.
        """
        resolved: dict[str, list[str]] = {name: [] for name in STORE_ORDER}
        errors: dict[str, dict[str, Any]] = {}
        for name, store in self.stores.items():
            if name not in resolved:
                continue
            try:
                direct = store.get(resource_id) if callable(getattr(store, "get", None)) else None
                if direct is not None:
                    resolved[name].append(resource_id)
                finder = getattr(store, {"harness": "operation_ids_for_run", "batch": "batch_ids_for_run", "optimization": "session_ids_for_run", "flow": "flow_ids_for_run"}.get(name, ""), None)
                if callable(finder):
                    resolved[name].extend(str(item) for item in finder(resource_id))
            except Exception as error:
                # Resolution failure is handled by the deletion call as an
                # unavailable store; never guess an ID from an exception.
                errors[name] = _store_error(error)
                continue
            resolved[name] = sorted(set(resolved[name]))
        self._resolution_errors = errors
        return resolved

    def delete_resource(
        self,
        *,
        resource_id: str,
        idempotency_key: str,
        principal: str | None = None,
        workspace_id: str | None = None,
    ) -> dict[str, Any]:
        targets = self.resolve_targets(resource_id)
        resolution_errors = dict(self._resolution_errors)
        result = self.delete(
            resource_id=resource_id,
            targets=targets,
            idempotency_key=idempotency_key,
            principal=principal,
            workspace_id=workspace_id,
            _preflight_errors=resolution_errors,
        )
        return result

    def delete(
        self,
        *,
        resource_id: str,
        targets: Mapping[str, str | list[str] | tuple[str, ...] | None],
        idempotency_key: str,
        principal: str | None = None,
        workspace_id: str | None = None,
        _preflight_errors: Mapping[str, dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        if not isinstance(idempotency_key, str) or not idempotency_key.strip():
            return {"status": "invalid_request", "code": "idempotency_key_required", "resource_id": resource_id}
        # The association set is expected to shrink after a partial delete;
        # binding the idempotency digest to the first resolved target list
        # would turn a safe retry into a false payload conflict.  Resource and
        # owner identity remain immutable fences.
        digest = canonical_sha256({"resource_id": resource_id, "principal": principal, "workspace_id": workspace_id})
        with self._lock:
            row = self._db.execute("SELECT * FROM deletion_requests WHERE idempotency_key=?", (idempotency_key,)).fetchone()
            if row is not None:
                if row["payload_digest"] != digest:
                    return {"status": "conflict", "code": "idempotency_payload_mismatch", "resource_id": resource_id}
                # A completed deletion is a stable replay.  Incomplete
                # requests intentionally re-enter the protocol below so a
                # caller can retry only the stores that previously failed.
                if row["status"] == "deleted":
                    return json.loads(row["result_json"])
            else:
                self._db.execute(
                    "INSERT INTO deletion_requests(idempotency_key,payload_digest,resource_id,status,result_json,updated_at) VALUES(?,?,?,?,?,datetime('now'))",
                    (idempotency_key, digest, resource_id, "pending", "{}"),
                )
        if _preflight_errors:
            # Association resolution is a read-only preflight. Do not delete
            # a subset of stores while another store's graph is unknown.
            stores_result = {
                name: ({**_preflight_errors[name], "resource_id": None} if name in _preflight_errors else {"status": "not_attempted", "code": "preflight_failed", "resource_id": None})
                for name in STORE_ORDER
            }
            permission_only = all(value.get("status") == "forbidden" for value in _preflight_errors.values())
            result = {
                "status": "permission_denied" if permission_only else "deletion_incomplete",
                "resource_id": resource_id,
                "stores": stores_result,
                "retryable": not permission_only,
                "provenance": {
                    "deployment_mode": "local_dev",
                    "source_mode": "synthetic_trace",
                    "claim_scope": "exploratory",
                    "production_status": "not_for_production",
                },
            }
        else:
            result = delete_across_stores(
                resource_id=resource_id,
                targets=targets,
                stores=self.stores,
                principal=principal,
                workspace_id=workspace_id,
            )
        with self._lock:
            self._db.execute(
                "UPDATE deletion_requests SET status=?,result_json=?,updated_at=datetime('now') WHERE idempotency_key=?",
                (result.get("status", "deletion_incomplete"), json.dumps(result, ensure_ascii=False, sort_keys=True), idempotency_key),
            )
        return result


__all__ = ["STORE_ORDER", "AgentDeletionCoordinator", "delete_across_stores"]
