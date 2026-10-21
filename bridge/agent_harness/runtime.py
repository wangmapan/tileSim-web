"""Small internal operation facade used by Bridge handlers and tests."""

from __future__ import annotations

from typing import Any

from .store import DurableHarnessStore, HarnessStoreError


def start_operation(store: DurableHarnessStore, **kwargs: Any) -> tuple[dict[str, Any], bool]:
    return store.create_operation(**kwargs)


def get_operation(store: DurableHarnessStore, operation_id: str) -> dict[str, Any] | None:
    return store.get_operation(operation_id)


def list_operations(store: DurableHarnessStore, *, limit: int = 50) -> list[dict[str, Any]]:
    return store.list_operations(limit=limit)


def cancel_operation(store: DurableHarnessStore, operation_id: str) -> dict[str, Any]:
    operation = store.get_operation(operation_id)
    if operation is None:
        raise HarnessStoreError("operation_not_found", "Operation was not found.")
    return store.transition(operation_id, "cancelled", cancellation_fence=f"fence-{operation_id}")


def resume_operation(store: DurableHarnessStore, operation_id: str) -> dict[str, Any]:
    return store.transition(operation_id, "queued", expected={"recovery_required"})


def retry_operation(store: DurableHarnessStore, operation_id: str) -> dict[str, Any]:
    operation = store.get_operation(operation_id)
    if not operation:
        raise HarnessStoreError("operation_not_found", "Operation was not found.")
    last_error = operation.get("last_error") or {}
    if last_error.get("unknown_outcome"):
        raise HarnessStoreError("unknown_side_effect", "Unknown outcome cannot be retried.", unknown_outcome=True)
    if not last_error.get("retryable", False):
        raise HarnessStoreError("retry_not_allowed", "Only an explicitly retryable failure may be retried.")
    return store.transition(operation_id, "retrying", expected={"failed"})


def inspect_checkpoint(store: DurableHarnessStore, checkpoint_id: str) -> dict[str, Any] | None:
    return store.get_checkpoint(checkpoint_id)
