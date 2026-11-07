"""Durable storage for the serial automatic exploration resource.

The repository stores the state-machine projection as JSON so the domain
contract remains the single source of truth.  SQLite WAL and a unique slot
row provide the process-restart and one-active-run guarantees.
"""
from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any


class ExplorationRepositoryError(RuntimeError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class ExplorationRepository:
    def __init__(self, path: str | Path):
        self.path = str(path)
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        with self._connect() as db:
            db.executescript(
                """
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS exploration_sessions (
                  session_id TEXT PRIMARY KEY,
                  principal TEXT NOT NULL,
                  workspace_id TEXT NOT NULL,
                  state_json TEXT NOT NULL,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS exploration_events (
                  session_id TEXT NOT NULL,
                  sequence INTEGER NOT NULL,
                  event_json TEXT NOT NULL,
                  PRIMARY KEY(session_id, sequence)
                );
                CREATE TABLE IF NOT EXISTS exploration_checkpoints (
                  session_id TEXT PRIMARY KEY,
                  checkpoint_json TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS exploration_slot (
                  slot_id INTEGER PRIMARY KEY CHECK(slot_id = 1),
                  session_id TEXT,
                  run_id TEXT,
                  acquired_at TEXT
                );
                CREATE TABLE IF NOT EXISTS exploration_run_effects (
                  idempotency_key TEXT PRIMARY KEY,
                  session_id TEXT NOT NULL,
                  candidate_id TEXT NOT NULL,
                  request_digest TEXT NOT NULL,
                  request_summary_json TEXT NOT NULL,
                  run_id TEXT,
                  executor_type TEXT NOT NULL,
                  submitted_at TEXT NOT NULL,
                  last_confirmed_at TEXT,
                  side_effect_status TEXT NOT NULL,
                  waiting_for TEXT NOT NULL,
                  last_result_json TEXT,
                  result_summary_json TEXT
                );
                INSERT OR IGNORE INTO exploration_slot(slot_id) VALUES (1);
                """
            )
            columns = {row[1] for row in db.execute("PRAGMA table_info(exploration_run_effects)").fetchall()}
            if "last_confirmed_at" not in columns:
                db.execute("ALTER TABLE exploration_run_effects ADD COLUMN last_confirmed_at TEXT")
            if "result_summary_json" not in columns:
                db.execute("ALTER TABLE exploration_run_effects ADD COLUMN result_summary_json TEXT")

    def _connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self.path, timeout=10, isolation_level=None)
        db.row_factory = sqlite3.Row
        return db

    def create(self, state: dict[str, Any]) -> dict[str, Any]:
        state = dict(state)
        state["_state_version"] = 1
        with self._lock, self._connect() as db:
            try:
                db.execute(
                    "INSERT INTO exploration_sessions VALUES (?,?,?,?,?,?)",
                    (state["session_id"], state["principal"], state["workspace_id"], json.dumps(state, ensure_ascii=False), state["created_at"], state["updated_at"]),
                )
            except sqlite3.IntegrityError as exc:
                raise ExplorationRepositoryError("exploration_exists", "Exploration session already exists.") from exc
            self._insert_events(db, state)
        return state

    def _insert_events(self, db: sqlite3.Connection, state: dict[str, Any], after: int = 0) -> None:
        for event in state.get("events", [])[after:]:
            db.execute("INSERT OR IGNORE INTO exploration_events VALUES (?,?,?)", (state["session_id"], event["sequence"], json.dumps(event, ensure_ascii=False)))

    def get(self, session_id: str) -> dict[str, Any] | None:
        with self._lock, self._connect() as db:
            row = db.execute("SELECT state_json FROM exploration_sessions WHERE session_id = ?", (session_id,)).fetchone()
            return json.loads(row[0]) if row else None

    def list(self, principal: str | None = None, workspace_id: str | None = None) -> list[dict[str, Any]]:
        query = "SELECT state_json FROM exploration_sessions"
        args: list[str] = []
        clauses = []
        if principal is not None:
            clauses.append("principal = ?"); args.append(principal)
        if workspace_id is not None:
            clauses.append("workspace_id = ?"); args.append(workspace_id)
        if clauses: query += " WHERE " + " AND ".join(clauses)
        query += " ORDER BY created_at DESC"
        with self._lock, self._connect() as db:
            return [json.loads(row[0]) for row in db.execute(query, args).fetchall()]

    def save(self, state: dict[str, Any], *, expected_version: int | None = None) -> dict[str, Any]:
        with self._lock, self._connect() as db:
            row = db.execute("SELECT state_json FROM exploration_sessions WHERE session_id = ?", (state["session_id"],)).fetchone()
            if row is None:
                raise ExplorationRepositoryError("exploration_not_found", "Exploration session was not found.")
            previous = json.loads(row[0])
            previous_version = int(previous.get("_state_version", 0))
            if expected_version is not None and previous_version != expected_version:
                raise ExplorationRepositoryError("state_version_conflict", "Exploration state changed while an external operation was running.")
            state = dict(state)
            state["_state_version"] = previous_version + 1
            db.execute("UPDATE exploration_sessions SET state_json = ?, updated_at = ? WHERE session_id = ?", (json.dumps(state, ensure_ascii=False), state["updated_at"], state["session_id"]))
            self._insert_events(db, state, len(previous.get("events", [])))
        return state

    def events(self, session_id: str, after: int = 0) -> list[dict[str, Any]]:
        with self._lock, self._connect() as db:
            return [json.loads(row[0]) for row in db.execute("SELECT event_json FROM exploration_events WHERE session_id = ? AND sequence > ? ORDER BY sequence", (session_id, after)).fetchall()]

    def save_checkpoint(self, session_id: str, checkpoint: dict[str, Any]) -> None:
        with self._lock, self._connect() as db:
            db.execute("INSERT INTO exploration_checkpoints(session_id, checkpoint_json) VALUES (?,?) ON CONFLICT(session_id) DO UPDATE SET checkpoint_json=excluded.checkpoint_json", (session_id, json.dumps(checkpoint, ensure_ascii=False)))

    def checkpoint(self, session_id: str) -> dict[str, Any] | None:
        with self._lock, self._connect() as db:
            row = db.execute("SELECT checkpoint_json FROM exploration_checkpoints WHERE session_id = ?", (session_id,)).fetchone()
            return json.loads(row[0]) if row else None

    def state_version(self, session_id: str) -> int:
        state = self.get(session_id)
        if state is None:
            raise ExplorationRepositoryError("exploration_not_found", "Exploration session was not found.")
        return int(state.get("_state_version", 0))

    def claim_slot(self, session_id: str, run_id: str, acquired_at: str) -> None:
        with self._lock, self._connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT session_id FROM exploration_slot WHERE slot_id=1").fetchone()
            if row and row[0] and row[0] != session_id:
                db.execute("ROLLBACK")
                raise ExplorationRepositoryError("exploration_busy", "Another automatic exploration is using the only experiment slot.")
            db.execute("UPDATE exploration_slot SET session_id=?, run_id=?, acquired_at=? WHERE slot_id=1", (session_id, run_id, acquired_at))
            db.execute("COMMIT")

    def release_slot(self, session_id: str) -> None:
        with self._lock, self._connect() as db:
            db.execute("UPDATE exploration_slot SET session_id=NULL, run_id=NULL, acquired_at=NULL WHERE slot_id=1 AND session_id=?", (session_id,))

    def active_slot(self) -> dict[str, Any] | None:
        with self._lock, self._connect() as db:
            row = db.execute("SELECT session_id, run_id, acquired_at FROM exploration_slot WHERE slot_id=1 AND session_id IS NOT NULL").fetchone()
            return dict(row) if row else None

    def save_run_effect(self, effect: dict[str, Any]) -> dict[str, Any]:
        """Persist one formal execution side effect under its idempotency key.

        The key is global to this Bridge. Reusing it for a different request is
        rejected; replaying the same request returns the durable envelope.
        """
        required = ("idempotency_key", "session_id", "candidate_id", "request_digest", "request_summary", "executor_type", "submitted_at", "side_effect_status", "waiting_for")
        missing = next((key for key in required if key not in effect), None)
        if missing:
            raise ExplorationRepositoryError("run_effect_invalid", f"Missing run effect field: {missing}.")
        with self._lock, self._connect() as db:
            row = db.execute("SELECT * FROM exploration_run_effects WHERE idempotency_key = ?", (effect["idempotency_key"],)).fetchone()
            if row is not None:
                existing = dict(row)
                if existing["request_digest"] != effect["request_digest"]:
                    raise ExplorationRepositoryError("idempotency_payload_mismatch", "The idempotency key is bound to a different formal request.")
                return self._decode_run_effect(existing)
            db.execute(
                "INSERT INTO exploration_run_effects (idempotency_key, session_id, candidate_id, request_digest, request_summary_json, run_id, executor_type, submitted_at, last_confirmed_at, side_effect_status, waiting_for, last_result_json, result_summary_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (effect["idempotency_key"], effect["session_id"], effect["candidate_id"], effect["request_digest"], json.dumps(effect["request_summary"], ensure_ascii=False), effect.get("run_id"), effect["executor_type"], effect["submitted_at"], effect.get("last_confirmed_at"), effect["side_effect_status"], effect["waiting_for"], json.dumps(effect.get("last_result"), ensure_ascii=False) if effect.get("last_result") is not None else None, json.dumps(effect.get("result_summary"), ensure_ascii=False) if effect.get("result_summary") is not None else None),
            )
            return dict(effect)

    @staticmethod
    def _decode_run_effect(row: dict[str, Any]) -> dict[str, Any]:
        result = dict(row)
        result["request_summary"] = json.loads(result.pop("request_summary_json"))
        raw = result.pop("last_result_json")
        result["last_result"] = json.loads(raw) if raw else None
        summary = result.pop("result_summary_json", None)
        result["result_summary"] = json.loads(summary) if summary else None
        return result

    def update_run_effect(self, idempotency_key: str, *, side_effect_status: str, waiting_for: str, run_id: str | None = None, last_result: dict[str, Any] | None = None, result_summary: dict[str, Any] | None = None, confirmed_at: str | None = None) -> dict[str, Any]:
        with self._lock, self._connect() as db:
            row = db.execute("SELECT * FROM exploration_run_effects WHERE idempotency_key = ?", (idempotency_key,)).fetchone()
            if row is None:
                raise ExplorationRepositoryError("run_effect_not_found", "Formal execution envelope was not found.")
            db.execute("UPDATE exploration_run_effects SET side_effect_status=?, waiting_for=?, run_id=COALESCE(?, run_id), last_confirmed_at=COALESCE(?, last_confirmed_at), last_result_json=?, result_summary_json=COALESCE(?, result_summary_json) WHERE idempotency_key=?", (side_effect_status, waiting_for, run_id, confirmed_at, json.dumps(last_result, ensure_ascii=False) if last_result is not None else row["last_result_json"], json.dumps(result_summary, ensure_ascii=False) if result_summary is not None else None, idempotency_key))
            updated = db.execute("SELECT * FROM exploration_run_effects WHERE idempotency_key = ?", (idempotency_key,)).fetchone()
            return self._decode_run_effect(dict(updated))

    def run_effect(self, idempotency_key: str) -> dict[str, Any] | None:
        with self._lock, self._connect() as db:
            row = db.execute("SELECT * FROM exploration_run_effects WHERE idempotency_key = ?", (idempotency_key,)).fetchone()
            return self._decode_run_effect(dict(row)) if row else None
