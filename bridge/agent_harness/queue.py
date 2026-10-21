"""Bounded single-host worker lifecycle for harness operations."""

from __future__ import annotations

import queue as queue_module
import sqlite3
import threading
import time
import uuid
from dataclasses import dataclass
from typing import Callable

from .store import DurableHarnessStore, HarnessStoreError


@dataclass
class QueueConfig:
    max_active: int = 1
    visibility_timeout_seconds: float = 30.0
    max_attempts: int = 3
    backoff_base_seconds: float = 0.25


class HarnessQueue:
    """A bounded worker queue; it is deliberately not a distributed scheduler."""

    def __init__(self, store: DurableHarnessStore, *, config: QueueConfig | None = None,
                 handler: Callable[[str], None] | None = None):
        self.store = store
        self.config = config or QueueConfig()
        self.handler = handler or (lambda _operation_id: None)
        self._queue: queue_module.Queue[str] = queue_module.Queue(maxsize=max(1, self.config.max_active * 8))
        self._semaphore = threading.BoundedSemaphore(max(1, self.config.max_active))
        self._stop = threading.Event()
        self.worker_id = f"worker-{uuid.uuid4().hex[:12]}"
        self._thread = threading.Thread(target=self._run, name="tilesim-agent-harness-worker", daemon=True)
        self._thread.start()

    def submit(self, operation_id: str) -> None:
        try:
            self._queue.put_nowait(operation_id)
        except queue_module.Full as error:
            raise HarnessStoreError("queue_capacity_reached", "The bounded local operation queue is full.", retryable=True) from error

    def has_capacity(self) -> bool:
        """Return a conservative capacity check used before consuming approval."""
        return not self._queue.full()

    def stop(self) -> None:
        self._stop.set()
        try:
            self._queue.put_nowait("")
        except queue_module.Full:
            pass
        self._thread.join(timeout=2)

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                self.store.recover_expired_leases()
            except sqlite3.ProgrammingError:
                # A test or controlled Bridge shutdown may close the durable
                # store just after the stop signal.  Do not resurrect a worker
                # against a closed connection.
                break
            try:
                operation_id = self._queue.get(timeout=0.2)
            except queue_module.Empty:
                continue
            if not operation_id:
                self._queue.task_done()
                continue
            with self._semaphore:
                try:
                    operation = self.store.get_operation(operation_id)
                except sqlite3.ProgrammingError:
                    break
                if not operation or operation.get("workflow_state") == "cancelled":
                    self._queue.task_done()
                    continue
                try:
                    self.store.claim_lease(operation_id, worker_id=self.worker_id, visibility_timeout_seconds=self.config.visibility_timeout_seconds)
                    self.store.transition(operation_id, "running", expected={"queued", "retrying"})
                    self.handler(operation_id)
                    self.store.release_lease(operation_id, worker_id=self.worker_id)
                except (HarnessStoreError, sqlite3.ProgrammingError):
                    # A cancel/terminal fence can win between lease claim and
                    # the worker transition.  Always release the lease on
                    # that path so restart recovery does not wait for a stale
                    # visibility timeout.
                    try:
                        self.store.release_lease(operation_id, worker_id=self.worker_id)
                    except (HarnessStoreError, sqlite3.ProgrammingError):
                        pass
                except Exception as error:
                    try:
                        current = self.store.get_operation(operation_id)
                    except sqlite3.ProgrammingError:
                        break
                    attempt = int((current or {}).get("attempt_count", 0)) + 1
                    if attempt < self.config.max_attempts:
                        try:
                            self.store.transition(operation_id, "retrying", error={"code": "worker_failure", "message": str(error)[:256], "retryable": True}, expected={"running"})
                            time.sleep(self.config.backoff_base_seconds * (2 ** max(0, attempt - 1)))
                            self.submit(operation_id)
                        except (HarnessStoreError, sqlite3.ProgrammingError):
                            pass
                    try:
                        self.store.release_lease(operation_id, worker_id=self.worker_id)
                    except (HarnessStoreError, sqlite3.ProgrammingError):
                        pass
                    else:
                        try:
                            self.store.transition(operation_id, "failed", error={"code": "worker_failure", "message": str(error)[:256], "retryable": False}, expected={"running"})
                        except (HarnessStoreError, sqlite3.ProgrammingError):
                            pass
            self._queue.task_done()
