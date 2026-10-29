"""Contract and durable endpoint tests for the independent LangGraph flow API."""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest import mock

from repositories.agent_flows import AgentFlowStore
from services.agent_flow import (
    AgentFlowError,
    AgentFlowService,
    FLOW_CONTRACT_REVISION,
    FLOW_ERROR_SCHEMA_IDENTITY,
    FLOW_RESUME_SCHEMA_IDENTITY,
    FLOW_START_SCHEMA_IDENTITY,
    _validate_durable_projection_state,
    canonical_sha256,
)
from services.agent_orchestrator import new_state as graph_new_state
from services.agent_orchestrator import resume as graph_resume
from services.agent_orchestrator import run_until_pause as graph_run_until_pause


BACKEND = {
    "backend_revision": "backend-rev",
    "backend_branch": "main",
    "source_revision": "source-rev",
    "build_revision": "build-rev",
    "source_state_digest": "sha256:" + "1" * 64,
    "build_state_digest": "sha256:" + "1" * 64,
    "state_digests_match": True,
    "versions_match": True,
    "deployment_mode": "local_dev",
}


def start_request(*, intent: str = "configuration_draft", schema_revision: str = "sha256:" + "2" * 64) -> dict:
    request = {
        "schema_identity": FLOW_START_SCHEMA_IDENTITY,
        "contract_revision": FLOW_CONTRACT_REVISION,
        "session_id": "session-test",
        "user_goal": "Prepare a local configuration draft.",
        "intent": intent,
        "run_id": None,
        "run_context_revision": None,
        "backend_identity": BACKEND,
        "schema_set_revision": schema_revision,
        "input_snapshot_digest": None,
        "artifact_bindings": [],
    }
    if intent in {"user_report", "existing_run_analysis"}:
        request["input_snapshot_digest"] = "sha256:" + "9" * 64
    if intent == "navigation":
        request.update(
            {
                "allowed_pages": ["metrics"],
                "allowed_actions": ["navigate"],
                "authorization_id": "authz-test-navigation",
                "authorization_budget": {
                    "max_navigation_attempts": 3,
                    "max_model_calls": 1,
                    "max_tool_calls_per_round": 1,
                    "max_run_creations": 1,
                    "max_execution_time_ms": 30_000,
                },
            }
        )
        request["authorization_digest"] = canonical_sha256(
            {
                "authorization_id": request["authorization_id"],
                "budget": request["authorization_budget"],
                "allowed_pages": request["allowed_pages"],
                "allowed_actions": request["allowed_actions"],
            }
        )
    return request


def refresh_navigation_authorization(request: dict) -> dict:
    request["authorization_digest"] = canonical_sha256(
        {
            "authorization_id": request["authorization_id"],
            "budget": request["authorization_budget"],
            "allowed_pages": sorted(request.get("allowed_pages") or []),
            "allowed_actions": sorted(request.get("allowed_actions") or []),
        }
    )
    return request


def resume_authorization_fields(flow: dict) -> dict:
    authorization = flow.get("authorization") or {}
    return {
        "authorization_id": authorization.get("authorization_id"),
        "authorization_digest": authorization.get("authorization_digest"),
        "authorization_budget": authorization.get("budget"),
    }


def revoke_request(flow: dict) -> dict:
    return {
        "schema_identity": "tilesim.agent_flow.revoke_request.v1",
        "contract_revision": FLOW_CONTRACT_REVISION,
        "flow_id": flow["flow_id"],
        "session_id": flow["session_id"],
        "current_binding": flow["binding"],
        "current_event_sequence": flow["event_sequence"],
        **resume_authorization_fields(flow),
    }


class AgentFlowServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.store = AgentFlowStore(Path(self.temporary.name) / "flows.sqlite")
        self.service = AgentFlowService(
            self.store,
            schema_set_revision="sha256:" + "2" * 64,
            backend_identity_provider=lambda: BACKEND,
        )

    def tearDown(self) -> None:
        self.store.close()
        self.temporary.cleanup()

    def test_start_waits_for_draft_confirmation_and_resume_is_durable(self) -> None:
        flow, replay = self.service.start(start_request(), principal="local-user", workspace_id="local-workspace", idempotency_key="start-key-001")
        self.assertFalse(replay)
        self.assertEqual(flow["status"], "waiting_user")
        self.assertEqual(flow["pending_action"], "confirm_draft")
        self.assertEqual(flow["event_sequence"], 1)
        resume = {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": flow["flow_id"],
            "session_id": flow["session_id"],
            "action": "confirm_draft",
            "pending_action": "confirm_draft",
            "current_binding": flow["binding"],
            "current_event_sequence": 1,
        }
        updated, replay = self.service.resume(flow["flow_id"], resume, principal="local-user", workspace_id="local-workspace", idempotency_key="resume-key-001")
        self.assertFalse(replay)
        self.assertEqual(updated["status"], "draft_ready")
        self.assertEqual(updated["event_sequence"], 2)
        self.assertEqual(updated["events"][0]["sequence"], 2)
        repeated, replay = self.service.resume(flow["flow_id"], resume, principal="local-user", workspace_id="local-workspace", idempotency_key="resume-key-001")
        self.assertTrue(replay)
        self.assertEqual(repeated["status"], "draft_ready")

    def test_navigation_state_round_trips_through_status_and_event(self) -> None:
        request = start_request(intent="navigation")
        request.update(
            {
                "current_page": "overview",
                "current_page_capabilities": ["overview"],
                "current_context_revision": "ctx-1",
                "run_id": "run-navigation",
                "run_context_revision": "ctx-1",
                "required_capabilities": ["metrics"],
                "allowed_pages": ["metrics", "fabric"],
                "allowed_actions": ["navigate"],
                "navigation_attempts": 1,
                "max_navigation_attempts": 2,
            }
        )
        refresh_navigation_authorization(request)
        flow, replay = self.service.start(
            request,
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="start-navigation-001",
        )
        self.assertFalse(replay)
        self.assertEqual(flow["current_page"], "overview")
        self.assertEqual(flow["allowed_pages"], ["fabric", "metrics"])
        self.assertEqual(flow["navigation_attempts"], 1)
        fetched = self.service.get(flow["flow_id"], principal="local-user", workspace_id="local-workspace")
        self.assertEqual(fetched["max_navigation_attempts"], 2)
        _, events = self.service.events(flow["flow_id"], principal="local-user", workspace_id="local-workspace")
        self.assertEqual(events[0]["state"]["visited_pages"], [])

    def test_navigation_authorization_digest_and_budget_are_durable_and_immutable(self) -> None:
        request = start_request(intent="navigation")
        request.update(
            {
                "current_page": "overview",
                "current_page_capabilities": ["overview"],
                "current_context_revision": "ctx-auth-1",
                "run_id": "run-auth",
                "run_context_revision": "ctx-auth-1",
                "required_capabilities": ["metrics"],
                "allowed_pages": ["metrics"],
                "allowed_actions": ["navigate"],
                "navigation_attempts": 0,
                "max_navigation_attempts": 2,
            }
        )
        refresh_navigation_authorization(request)
        flow, _ = self.service.start(request, principal="local-user", workspace_id="local-workspace", idempotency_key="start-navigation-auth-001")
        authorization = flow["authorization"]
        self.assertEqual(authorization["authorization_id"], request["authorization_id"])
        self.assertEqual(authorization["authorization_digest"], request["authorization_digest"])
        self.assertEqual(authorization["budget"], request["authorization_budget"])
        self.assertEqual(authorization["remaining"]["max_navigation_attempts"], 3)
        self.assertEqual(authorization["usage"]["model_calls"], 1)
        self.assertEqual(authorization["remaining"]["max_model_calls"], 0)
        _, events = self.service.events(flow["flow_id"], principal="local-user", workspace_id="local-workspace")
        self.assertEqual(events[0]["state"]["authorization"]["authorization_digest"], request["authorization_digest"])
        changed = dict(request)
        changed["authorization_budget"] = {**request["authorization_budget"], "max_navigation_attempts": 1}
        with self.assertRaises(AgentFlowError) as raised:
            self.service.start(changed, principal="local-user", workspace_id="local-workspace", idempotency_key="start-navigation-auth-002")
        self.assertEqual(raised.exception.code, "authorization_digest_mismatch")
        resume = {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": flow["flow_id"],
            "session_id": flow["session_id"],
            "action": "confirm_navigation",
            "pending_action": "confirm_navigation",
            "current_binding": flow["binding"],
            "current_event_sequence": 1,
            **resume_authorization_fields(flow),
        }
        resume["authorization_digest"] = "sha256:" + "f" * 64
        with self.assertRaises(AgentFlowError) as raised:
            self.service.resume(flow["flow_id"], resume, principal="local-user", workspace_id="local-workspace", idempotency_key="resume-navigation-auth-001")
        self.assertEqual(raised.exception.code, "authorization_stale")

    def test_execution_time_budget_is_server_ledger_and_expiry_stops_resume(self) -> None:
        request = start_request(intent="navigation")
        request.update(
            {
                "current_page": "overview",
                "current_page_capabilities": ["overview"],
                "current_context_revision": "ctx-time-1",
                "run_id": "run-time",
                "run_context_revision": "ctx-time-1",
                "required_capabilities": ["metrics"],
                "allowed_pages": ["metrics"],
                "allowed_actions": ["navigate"],
                "navigation_attempts": 0,
                "max_navigation_attempts": 1,
                "authorization_budget": {
                    "max_navigation_attempts": 1,
                    "max_model_calls": 1,
                    "max_tool_calls_per_round": 1,
                    "max_run_creations": 1,
                    "max_execution_time_ms": 1,
                },
            }
        )
        refresh_navigation_authorization(request)
        flow, _ = self.service.start(
            request,
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="start-navigation-time-budget-001",
        )
        # Simulate a process restart / a long-lived approval pause.  The
        # browser cannot forge this timestamp; it is owned by the durable row.
        self.store._connection.execute(
            "UPDATE agent_flows SET created_at=? WHERE flow_id=?",
            ("2020-01-01T00:00:00+00:00", flow["flow_id"]),
        )
        confirm = {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": flow["flow_id"],
            "session_id": flow["session_id"],
            "action": "confirm_navigation",
            "pending_action": "confirm_navigation",
            "current_binding": flow["binding"],
            "current_event_sequence": flow["event_sequence"],
            **resume_authorization_fields(flow),
        }
        expired, replay = self.service.resume(
            flow["flow_id"],
            confirm,
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="resume-navigation-time-budget-001",
        )
        self.assertFalse(replay)
        self.assertEqual(expired["status"], "failed")
        self.assertEqual(expired["terminal_reason"], "execution_time_budget_exhausted")
        self.assertEqual(expired["authorization"]["status"], "exhausted")
        self.assertGreaterEqual(expired["authorization"]["usage"]["execution_time_ms"], 1)
        self.assertEqual(expired["authorization"]["remaining"]["max_execution_time_ms"], 0)
        with self.assertRaises(AgentFlowError) as raised:
            self.service.resume(
                flow["flow_id"],
                {
                    **confirm,
                    "pending_action": None,
                    "current_binding": expired["binding"],
                    "current_event_sequence": expired["event_sequence"],
                },
                principal="local-user",
                workspace_id="local-workspace",
                idempotency_key="resume-navigation-time-budget-002",
            )
        self.assertEqual(raised.exception.code, "authorization_inactive")

    def test_status_projection_marks_paused_expired_authorization_without_mutating_flow(self) -> None:
        request = start_request(intent="navigation")
        request.update(
            {
                "current_page": "overview",
                "current_page_capabilities": ["overview"],
                "current_context_revision": "ctx-get-time-1",
                "run_id": "run-get-time",
                "run_context_revision": "ctx-get-time-1",
                "required_capabilities": ["metrics"],
                "allowed_pages": ["metrics"],
                "allowed_actions": ["navigate"],
                "navigation_attempts": 0,
                "max_navigation_attempts": 1,
                "authorization_budget": {
                    "max_navigation_attempts": 1,
                    "max_model_calls": 1,
                    "max_tool_calls_per_round": 1,
                    "max_run_creations": 1,
                    "max_execution_time_ms": 1,
                },
            }
        )
        refresh_navigation_authorization(request)
        flow, _ = self.service.start(
            request,
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="start-navigation-get-time-001",
        )
        self.store._connection.execute(
            "UPDATE agent_flows SET created_at=? WHERE flow_id=?",
            ("2020-01-01T00:00:00+00:00", flow["flow_id"]),
        )
        projected = self.service.get(flow["flow_id"], principal="local-user", workspace_id="local-workspace")
        self.assertEqual(projected["status"], "waiting_user")
        self.assertEqual(projected["authorization"]["status"], "exhausted")
        self.assertEqual(projected["authorization"]["remaining"]["max_execution_time_ms"], 0)
        # GET is a projection only: the durable cursor and pending action are
        # unchanged until a mutating resume persists the terminal outcome.
        stored = self.store.get(flow["flow_id"])
        self.assertIsNotNone(stored)
        self.assertEqual(stored["sequence"], flow["event_sequence"])
        self.assertEqual(stored["state"].get("authorization_status"), "active")

    def test_terminal_flow_freezes_execution_time_projection(self) -> None:
        request = start_request(intent="navigation")
        request.update(
            {
                "current_page": "overview",
                "current_page_capabilities": ["overview"],
                "current_context_revision": "ctx-freeze-1",
                "run_id": "run-freeze",
                "run_context_revision": "ctx-freeze-1",
                "required_capabilities": ["metrics"],
                "allowed_pages": ["metrics"],
                "allowed_actions": ["navigate"],
                "navigation_attempts": 0,
                "max_navigation_attempts": 1,
            }
        )
        refresh_navigation_authorization(request)
        flow, _ = self.service.start(
            request,
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="start-navigation-freeze-001",
        )
        confirm = {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": flow["flow_id"],
            "session_id": flow["session_id"],
            "action": "confirm_navigation",
            "pending_action": "confirm_navigation",
            "current_binding": flow["binding"],
            "current_event_sequence": flow["event_sequence"],
            **resume_authorization_fields(flow),
        }
        armed, _ = self.service.resume(
            flow["flow_id"], confirm, principal="local-user", workspace_id="local-workspace", idempotency_key="resume-navigation-freeze-001"
        )
        completed, _ = self.service.resume(
            flow["flow_id"],
            {
                **confirm,
                "pending_action": None,
                "current_binding": armed["binding"],
                "current_event_sequence": armed["event_sequence"],
                "navigation_observation": {
                    "target_page": "metrics",
                    "actual_page": "metrics",
                    "page_correct": True,
                    "current_page_capabilities": ["metrics"],
                    "current_run_id": "run-freeze",
                    "current_context_revision": "ctx-freeze-1",
                    "failure_type": None,
                    "retry_allowed": False,
                    "visited_pages": ["metrics"],
                    "navigation_attempts": 1,
                },
            },
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="resume-navigation-freeze-002",
        )
        committed_usage = completed["authorization"]["usage"]["execution_time_ms"]
        self.store._connection.execute(
            "UPDATE agent_flows SET created_at=? WHERE flow_id=?",
            ("2020-01-01T00:00:00+00:00", flow["flow_id"]),
        )
        projected = self.service.get(flow["flow_id"], principal="local-user", workspace_id="local-workspace")
        self.assertEqual(projected["status"], "completed")
        self.assertEqual(projected["authorization"]["usage"]["execution_time_ms"], committed_usage)

    def test_navigation_observation_cannot_exceed_tool_budget(self) -> None:
        request = start_request(intent="navigation")
        request.update(
            {
                "current_page": "overview",
                "current_page_capabilities": ["overview"],
                "current_context_revision": "ctx-tool-budget-1",
                "run_id": "run-tool-budget",
                "run_context_revision": "ctx-tool-budget-1",
                "required_capabilities": ["metrics"],
                "allowed_pages": ["metrics", "fabric"],
                "allowed_actions": ["navigate"],
                "navigation_attempts": 0,
                "max_navigation_attempts": 2,
            }
        )
        refresh_navigation_authorization(request)
        flow, _ = self.service.start(
            request,
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="start-navigation-tool-budget-001",
        )
        confirm = {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": flow["flow_id"],
            "session_id": flow["session_id"],
            "action": "confirm_navigation",
            "pending_action": "confirm_navigation",
            "current_binding": flow["binding"],
            "current_event_sequence": flow["event_sequence"],
            **resume_authorization_fields(flow),
        }
        armed, _ = self.service.resume(
            flow["flow_id"],
            confirm,
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="resume-navigation-tool-budget-arm-001",
        )
        observation_request = {
            **confirm,
            "pending_action": None,
            "current_binding": armed["binding"],
            "current_event_sequence": armed["event_sequence"],
            "navigation_observation": {
                "target_page": "metrics",
                "actual_page": "overview",
                "page_correct": False,
                "current_page_capabilities": ["overview"],
                "current_run_id": "run-tool-budget",
                "current_context_revision": "ctx-tool-budget-1",
                "failure_type": "navigation_error",
                "retry_allowed": True,
                "visited_pages": ["metrics", "fabric"],
                "navigation_attempts": 2,
            },
        }
        with self.assertRaises(AgentFlowError) as raised:
            self.service.resume(
                flow["flow_id"],
                observation_request,
                principal="local-user",
                workspace_id="local-workspace",
                idempotency_key="resume-navigation-tool-budget-001",
            )
        self.assertEqual(raised.exception.code, "tool_call_budget_exhausted")
        self.assertEqual(self.store.get(flow["flow_id"])["sequence"], armed["event_sequence"])

    def test_authorization_revoke_is_atomic_terminal_and_idempotent(self) -> None:
        request = start_request(intent="navigation")
        request.update(
            {
                "current_page": "overview",
                "current_page_capabilities": ["overview"],
                "current_context_revision": "ctx-revoke-1",
                "run_id": "run-revoke",
                "run_context_revision": "ctx-revoke-1",
                "required_capabilities": ["metrics"],
                "allowed_pages": ["metrics"],
                "allowed_actions": ["navigate"],
                "navigation_attempts": 0,
                "max_navigation_attempts": 2,
            }
        )
        refresh_navigation_authorization(request)
        flow, replay = self.service.start(
            request,
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="start-navigation-revoke-001",
        )
        self.assertFalse(replay)
        body = revoke_request(flow)
        revoked, replay = self.service.revoke_authorization(
            flow["flow_id"],
            body,
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="revoke-navigation-001",
        )
        self.assertFalse(replay)
        self.assertEqual(revoked["action"], "revoke_authorization")
        self.assertEqual(revoked["flow"]["status"], "cancelled")
        self.assertEqual(revoked["flow"]["terminal_reason"], "authorization_revoked")
        self.assertEqual(revoked["flow"]["authorization"]["status"], "revoked")
        self.assertEqual(revoked["events"][0]["sequence"], 2)

        repeated, replay = self.service.revoke_authorization(
            flow["flow_id"],
            body,
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="revoke-navigation-001",
        )
        self.assertTrue(replay)
        self.assertEqual(repeated, revoked)
        with self.assertRaises(AgentFlowError) as raised:
            self.service.resume(
                flow["flow_id"],
                {
                    **{
                        "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
                        "contract_revision": FLOW_CONTRACT_REVISION,
                        "flow_id": flow["flow_id"],
                        "session_id": flow["session_id"],
                        "action": "confirm_navigation",
                        "pending_action": "confirm_navigation",
                        "current_binding": flow["binding"],
                        "current_event_sequence": 1,
                    },
                    **resume_authorization_fields(flow),
                },
                principal="local-user",
                workspace_id="local-workspace",
                idempotency_key="resume-after-revoke-001",
            )
        self.assertIn(raised.exception.code, {"authorization_inactive", "terminal_mutation"})

    def test_authorization_revoke_rejects_cross_principal_and_stale_cursor(self) -> None:
        request = start_request(intent="navigation")
        request.update(
            {
                "current_page": "overview",
                "current_page_capabilities": ["overview"],
                "current_context_revision": "ctx-revoke-2",
                "run_id": "run-revoke-2",
                "run_context_revision": "ctx-revoke-2",
                "required_capabilities": ["metrics"],
                "allowed_pages": ["metrics"],
                "allowed_actions": ["navigate"],
                "navigation_attempts": 0,
                "max_navigation_attempts": 2,
            }
        )
        refresh_navigation_authorization(request)
        flow, _ = self.service.start(request, principal="local-user", workspace_id="local-workspace", idempotency_key="start-navigation-revoke-002")
        body = revoke_request(flow)
        with self.assertRaisesRegex(AgentFlowError, "not owned"):
            self.service.revoke_authorization(flow["flow_id"], body, principal="other", workspace_id="local-workspace", idempotency_key="revoke-navigation-002")
        stale = {**body, "current_event_sequence": 0}
        with self.assertRaises(AgentFlowError) as raised:
            self.service.revoke_authorization(flow["flow_id"], stale, principal="local-user", workspace_id="local-workspace", idempotency_key="revoke-navigation-003")
        self.assertEqual(raised.exception.code, "event_sequence_mismatch")

    def test_old_contract_rows_are_not_silently_reemitted_as_v2(self) -> None:
        flow, _ = self.service.start(
            start_request(),
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="start-old-contract-001",
        )
        self.store._connection.execute(
            "UPDATE agent_flows SET contract_revision=? WHERE flow_id=?",
            ("2026-10-25.flow.v1", flow["flow_id"]),
        )
        with self.assertRaises(AgentFlowError) as raised:
            self.service.get(flow["flow_id"], principal="local-user", workspace_id="local-workspace")
        self.assertEqual(raised.exception.code, "contract_revision_mismatch")

    def test_navigation_start_rejects_unpublished_page_and_non_integer_budget(self) -> None:
        for field, value in (("allowed_pages", ["not-a-page"]), ("max_navigation_attempts", 1.5)):
            with self.subTest(field=field):
                request = start_request()
                request[field] = value
                with self.assertRaises(AgentFlowError) as raised:
                    self.service.start(
                        request,
                        principal="local-user",
                        workspace_id="local-workspace",
                        idempotency_key=f"start-navigation-invalid-{field}",
                    )
                self.assertEqual(raised.exception.code, "invalid_field")

    def test_navigation_start_binds_graph_attempt_budget_to_authorization(self) -> None:
        request = start_request(intent="navigation")
        request.update(
            {
                "current_page": "overview",
                "current_page_capabilities": ["overview"],
                "current_context_revision": "ctx-budget-bind-1",
                "run_id": "run-budget-bind",
                "run_context_revision": "ctx-budget-bind-1",
                "required_capabilities": ["metrics"],
                "allowed_pages": ["metrics"],
                "allowed_actions": ["navigate"],
                # The signed authorization below permits one attempt, while
                # this unsigned graph field tries to widen the loop.
                "navigation_attempts": 0,
                "max_navigation_attempts": 3,
                "authorization_budget": {
                    "max_navigation_attempts": 1,
                    "max_model_calls": 1,
                    "max_tool_calls_per_round": 1,
                    "max_run_creations": 1,
                    "max_execution_time_ms": 30_000,
                },
            }
        )
        refresh_navigation_authorization(request)
        with self.assertRaises(AgentFlowError) as raised:
            self.service.start(
                request,
                principal="local-user",
                workspace_id="local-workspace",
                idempotency_key="start-navigation-budget-bind-001",
            )
        self.assertEqual(raised.exception.code, "authorization_budget_mismatch")
        self.assertEqual(raised.exception.field_path, "/max_navigation_attempts")

    def test_navigation_confirmation_and_observations_are_durable_events(self) -> None:
        request = start_request(intent="navigation")
        request.update(
            {
                "current_page": "overview",
                "current_page_capabilities": ["overview"],
                "current_context_revision": "ctx-1",
                "run_id": "run-navigation",
                "run_context_revision": "ctx-1",
                "required_capabilities": ["fabric"],
                "allowed_pages": ["metrics", "fabric"],
                "allowed_actions": ["navigate"],
                "navigation_attempts": 0,
                "max_navigation_attempts": 2,
            }
        )
        refresh_navigation_authorization(request)
        flow, replay = self.service.start(
            request,
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="start-navigation-flow-001",
        )
        self.assertFalse(replay)
        self.assertEqual(flow["status"], "waiting_user")
        self.assertEqual(flow["pending_action"], "confirm_navigation")
        self.assertEqual(flow["event_sequence"], 1)

        confirm = {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": flow["flow_id"],
            "session_id": flow["session_id"],
            "action": "confirm_navigation",
            "pending_action": "confirm_navigation",
            "current_binding": flow["binding"],
            "current_event_sequence": 1,
            **resume_authorization_fields(flow),
        }
        armed, replay = self.service.resume(
            flow["flow_id"], confirm, principal="local-user", workspace_id="local-workspace", idempotency_key="resume-navigation-confirm-001"
        )
        self.assertFalse(replay)
        self.assertEqual(armed["status"], "waiting_user")
        self.assertIsNone(armed["pending_action"])
        self.assertEqual(armed["event_sequence"], 2)

        failed_observation = {
            "target_page": "metrics",
            "actual_page": "overview",
            "page_correct": False,
            "current_page_capabilities": ["overview"],
            "current_run_id": "run-navigation",
            "current_context_revision": "ctx-1",
            "failure_type": "navigation_error",
            "retry_allowed": True,
            "visited_pages": ["metrics"],
            "navigation_attempts": 1,
        }
        failed = {
            **confirm,
            "pending_action": None,
            "current_binding": armed["binding"],
            "current_event_sequence": 2,
            "navigation_observation": failed_observation,
        }
        retry, replay = self.service.resume(
            flow["flow_id"], failed, principal="local-user", workspace_id="local-workspace", idempotency_key="resume-navigation-observe-001"
        )
        self.assertFalse(replay)
        self.assertEqual(retry["status"], "waiting_user")
        self.assertEqual(retry["pending_action"], "confirm_navigation")
        self.assertEqual(retry["navigation_attempts"], 1)
        self.assertEqual(retry["last_navigation_observation"]["target_page"], "metrics")
        self.assertEqual(retry["navigation_failures"], [{"page": "metrics", "type": "navigation_error"}])

        success = {
            **confirm,
            "pending_action": "confirm_navigation",
            "current_binding": retry["binding"],
            "current_event_sequence": 3,
            "navigation_observation": {
                **failed_observation,
                "target_page": "fabric",
                "actual_page": "fabric",
                "page_correct": True,
                "current_page_capabilities": ["fabric", "run_bound"],
                "current_context_revision": "ctx-2",
                "failure_type": None,
                "retry_allowed": False,
                "visited_pages": ["metrics", "fabric"],
                "navigation_attempts": 2,
            },
        }
        completed, replay = self.service.resume(
            flow["flow_id"], success, principal="local-user", workspace_id="local-workspace", idempotency_key="resume-navigation-observe-002"
        )
        self.assertFalse(replay)
        self.assertEqual(completed["status"], "completed")
        self.assertEqual(completed["terminal_reason"], "navigation_completed")
        self.assertEqual(completed["event_sequence"], 4)
        self.assertEqual(completed["navigation_failures"], [{"page": "metrics", "type": "navigation_error"}])
        _, events = self.service.events(flow["flow_id"], principal="local-user", workspace_id="local-workspace")
        self.assertEqual([event["sequence"] for event in events], [1, 2, 3, 4])

    def test_navigation_observation_rejects_unpublished_or_stale_identity(self) -> None:
        request = start_request(intent="navigation")
        request.update(
            {
                "current_page": "overview",
                "current_page_capabilities": ["overview"],
                "current_context_revision": "ctx-1",
                "run_id": "run-navigation",
                "run_context_revision": "ctx-1",
                "required_capabilities": ["metrics"],
                "allowed_pages": ["metrics"],
                "allowed_actions": ["navigate"],
                "navigation_attempts": 0,
                "max_navigation_attempts": 1,
            }
        )
        refresh_navigation_authorization(request)
        flow, _ = self.service.start(request, principal="local-user", workspace_id="local-workspace", idempotency_key="start-navigation-flow-002")
        confirm = {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": flow["flow_id"],
            "session_id": flow["session_id"],
            "action": "confirm_navigation",
            "pending_action": "confirm_navigation",
            "current_binding": flow["binding"],
            "current_event_sequence": 1,
            **resume_authorization_fields(flow),
        }
        armed, _ = self.service.resume(flow["flow_id"], confirm, principal="local-user", workspace_id="local-workspace", idempotency_key="resume-navigation-confirm-002")
        malformed = {
            **confirm,
            "pending_action": None,
            "current_binding": armed["binding"],
            "current_event_sequence": 2,
            "navigation_observation": {
                "target_page": "https://example.invalid",
                "actual_page": None,
                "page_correct": False,
                "current_page_capabilities": [],
                "current_run_id": None,
                "current_context_revision": "ctx-1",
                "failure_type": "page_mismatch",
                "retry_allowed": False,
                "visited_pages": ["metrics"],
                "navigation_attempts": 1,
            },
        }
        with self.assertRaises(AgentFlowError) as raised:
            self.service.resume(flow["flow_id"], malformed, principal="local-user", workspace_id="local-workspace", idempotency_key="resume-navigation-invalid-002")
        self.assertEqual(raised.exception.code, "invalid_field")

    def test_run_bound_navigation_requires_run_binding(self) -> None:
        request = start_request(intent="navigation")
        request.update(
            {
                "current_page": "overview",
                "current_page_capabilities": ["overview"],
                "current_context_revision": "ctx-1",
                "required_capabilities": ["metrics"],
                "allowed_pages": ["metrics"],
                "allowed_actions": ["navigate"],
                "navigation_attempts": 0,
                "max_navigation_attempts": 1,
            }
        )
        refresh_navigation_authorization(request)
        with self.assertRaises(AgentFlowError) as raised:
            self.service.start(request, principal="local-user", workspace_id="local-workspace", idempotency_key="start-navigation-run-binding-001")
        self.assertEqual(raised.exception.code, "binding_required")

    def test_resume_rejects_action_that_does_not_match_pending_checkpoint(self) -> None:
        flow, _ = self.service.start(
            start_request(),
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="start-cross-action-001",
        )
        resume = {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": flow["flow_id"],
            "session_id": flow["session_id"],
            "action": "clarify_intent",
            "intent": "explain",
            "pending_action": "confirm_draft",
            "current_binding": flow["binding"],
            "current_event_sequence": 1,
        }
        with self.assertRaises(AgentFlowError) as raised:
            self.service.resume(
                flow["flow_id"],
                resume,
                principal="local-user",
                workspace_id="local-workspace",
                idempotency_key="resume-cross-action-001",
            )
        self.assertEqual(raised.exception.code, "pending_action_mismatch")
        self.assertEqual(raised.exception.field_path, "/action")
        self.assertEqual(self.store.get(flow["flow_id"])["sequence"], 1)

    def test_report_flow_carries_verified_evidence_boundary_to_confirmation(self) -> None:
        request = start_request(intent="user_report")
        request.update(
            {
                "run_id": "run-report",
                "run_context_revision": "ctx-report",
                "evidence_status": "deterministic_fallback",
                "artifact_bindings": [
                    {
                        "artifact_id": "metrics",
                        "schema_identity": "tilesim.metrics_report.v1",
                        "sha256": "3" * 64,
                        "bytes": "12",
                    }
                ],
            }
        )
        flow, replay = self.service.start(
            request,
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="start-report-001",
        )
        self.assertFalse(replay)
        self.assertEqual(flow["status"], "waiting_user")
        self.assertEqual(flow["pending_action"], "confirm_report")
        self.assertEqual(flow["evidence"]["status"], "deterministic_fallback")

    def test_run_bound_flow_requires_input_snapshot_digest(self) -> None:
        request = start_request(intent="user_report")
        request.update(
            {
                "run_id": "run-report-no-snapshot",
                "run_context_revision": "ctx-report-no-snapshot",
                "artifact_bindings": [],
                "input_snapshot_digest": None,
            }
        )
        with self.assertRaises(AgentFlowError) as raised:
            self.service.start(
                request,
                principal="local-user",
                workspace_id="local-workspace",
                idempotency_key="start-report-no-snapshot",
            )
        self.assertEqual(raised.exception.code, "binding_required")
        self.assertEqual(raised.exception.field_path, "/binding/input_snapshot_digest")

    def test_artifact_digest_rejects_revision_prefix(self) -> None:
        request = start_request(intent="user_report")
        request.update(
            {
                "run_id": "run-report-prefix",
                "run_context_revision": "ctx-report-prefix",
                "artifact_bindings": [
                    {
                        "artifact_id": "metrics",
                        "schema_identity": "tilesim.metrics_report.v1",
                        "sha256": "sha256:" + "4" * 64,
                        "bytes": "12",
                    }
                ],
            }
        )
        with self.assertRaisesRegex(AgentFlowError, "64-character hexadecimal"):
            self.service.start(
                request,
                principal="local-user",
                workspace_id="local-workspace",
                idempotency_key="start-report-prefix",
            )

    def test_start_idempotency_replays_and_payload_mismatch_fails_closed(self) -> None:
        flow, _ = self.service.start(start_request(), principal="local-user", workspace_id="local-workspace", idempotency_key="start-key-002")
        replay, is_replay = self.service.start(start_request(), principal="local-user", workspace_id="local-workspace", idempotency_key="start-key-002")
        self.assertTrue(is_replay)
        self.assertEqual(flow["flow_id"], replay["flow_id"])
        changed = start_request()
        changed["session_id"] = "another-session"
        with self.assertRaisesRegex(AgentFlowError, "different flow payload"):
            self.service.start(changed, principal="local-user", workspace_id="local-workspace", idempotency_key="start-key-002")

    def test_start_idempotent_retry_does_not_execute_graph_again(self) -> None:
        with mock.patch("services.agent_flow.run_until_pause", wraps=graph_run_until_pause) as run:
            first, replay = self.service.start(
                start_request(),
                principal="local-user",
                workspace_id="local-workspace",
                idempotency_key="start-key-runtime-fence",
            )
            second, replayed = self.service.start(
                start_request(),
                principal="local-user",
                workspace_id="local-workspace",
                idempotency_key="start-key-runtime-fence",
            )
        self.assertFalse(replay)
        self.assertTrue(replayed)
        self.assertEqual(first["flow_id"], second["flow_id"])
        self.assertEqual(run.call_count, 1)

    def test_stale_binding_and_cross_principal_are_rejected(self) -> None:
        flow, _ = self.service.start(start_request(), principal="local-user", workspace_id="local-workspace", idempotency_key="start-key-003")
        stale = dict(flow["binding"])
        stale["schema_set_revision"] = "sha256:" + "3" * 64
        resume = {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": flow["flow_id"], "session_id": flow["session_id"],
            "action": "confirm_draft", "pending_action": "confirm_draft",
            "current_binding": stale, "current_event_sequence": 1,
        }
        with self.assertRaisesRegex(AgentFlowError, "schema-set revision"):
            self.service.resume(flow["flow_id"], resume, principal="local-user", workspace_id="local-workspace", idempotency_key="resume-key-003")
        with self.assertRaisesRegex(AgentFlowError, "not owned"):
            self.service.get(flow["flow_id"], principal="other", workspace_id="local-workspace")

    def test_start_does_not_substitute_missing_backend_or_schema_identity(self) -> None:
        for field, value in (("backend_identity", None), ("schema_set_revision", None)):
            request = start_request()
            request[field] = value
            with self.subTest(field=field), self.assertRaises(AgentFlowError) as raised:
                self.service.start(
                    request,
                    principal="local-user",
                    workspace_id="local-workspace",
                    idempotency_key=f"start-invalid-{field}",
                )
            self.assertEqual(raised.exception.code, "invalid_field")
            self.assertEqual(raised.exception.field_path, f"/binding/{field}")

    def test_start_enforces_published_string_bounds_and_closed_artifact_binding(self) -> None:
        oversized_goal = {**start_request(), "user_goal": "x" * 20_001}
        with self.assertRaisesRegex(AgentFlowError, "length") as raised:
            self.service.start(
                oversized_goal,
                principal="local-user",
                workspace_id="local-workspace",
                idempotency_key="start-length-001",
            )
        self.assertEqual(raised.exception.field_path, "/user_goal")

        unknown_artifact_field = {
            **start_request(intent="user_report"),
            "run_id": "run-report-bounds",
            "run_context_revision": "ctx-report-bounds",
            "artifact_bindings": [
                {
                    "artifact_id": "metrics",
                    "schema_identity": "tilesim.metrics_report.v1",
                    "sha256": "a" * 64,
                    "bytes": "12",
                    "unexpected": True,
                }
            ],
        }
        with self.assertRaisesRegex(AgentFlowError, "unknown") as raised:
            self.service.start(
                unknown_artifact_field,
                principal="local-user",
                workspace_id="local-workspace",
                idempotency_key="start-artifact-001",
            )
        self.assertEqual(raised.exception.field_path, "/binding/artifact_bindings/0/unexpected")

    def test_start_matches_schema_string_limits_and_rejects_non_string_enum(self) -> None:
        malformed = start_request()
        malformed["intent"] = []
        with self.assertRaises(AgentFlowError) as raised:
            self.service.start(
                malformed,
                principal="local-user",
                workspace_id="local-workspace",
                idempotency_key="start-intent-type-001",
            )
        self.assertEqual(raised.exception.code, "unsupported_intent")
        self.assertEqual(raised.exception.field_path, "/intent")

    def test_resume_enforces_published_string_and_cursor_types(self) -> None:
        flow, _ = self.service.start(
            start_request(),
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="start-resume-bounds-001",
        )
        base = {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": flow["flow_id"],
            "session_id": flow["session_id"],
            "action": "confirm_draft",
            "pending_action": "confirm_draft",
            "current_binding": flow["binding"],
            "current_event_sequence": 1,
        }
        for field, value in (
            ("clarification", "x" * 20_001),
            ("reason", "x" * 2_001),
            ("approval_digest", 123),
            ("current_event_sequence", True),
        ):
            with self.subTest(field=field):
                with self.assertRaises(AgentFlowError) as raised:
                    self.service.resume(
                        flow["flow_id"],
                        {**base, field: value},
                        principal="local-user",
                        workspace_id="local-workspace",
                        idempotency_key=f"resume-bounds-{field}",
                    )
                self.assertEqual(raised.exception.code, "invalid_field")
                self.assertEqual(raised.exception.field_path, f"/{field}")

    def test_resume_rejects_intent_that_does_not_match_durable_flow(self) -> None:
        flow, _ = self.service.start(
            start_request(),
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="start-intent-001",
        )
        resume = {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": flow["flow_id"],
            "session_id": flow["session_id"],
            "action": "confirm_draft",
            "intent": "user_report",
            "pending_action": "confirm_draft",
            "current_binding": flow["binding"],
            "current_event_sequence": 1,
        }
        with self.assertRaisesRegex(AgentFlowError, "does not match") as raised:
            self.service.resume(
                flow["flow_id"],
                resume,
                principal="local-user",
                workspace_id="local-workspace",
                idempotency_key="resume-intent-001",
            )
        self.assertEqual(raised.exception.code, "binding_mismatch")
        self.assertEqual(raised.exception.field_path, "/intent")

    def test_clarification_never_routes_from_free_form_text(self) -> None:
        paused, _ = self.service.start(
            {**start_request(intent="explain"), "user_goal": "请帮我看看"},
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="start-clarify-001",
        )
        # A clarification checkpoint can only come from an older/optional
        # orchestrator state; the HTTP start contract itself requires an
        # explicit intent. Recreate that durable paused state to exercise the
        # resume fence without widening the start API.
        stored = self.store.get(paused["flow_id"])
        self.assertIsNotNone(stored)
        assert stored is not None
        state = dict(stored["state"])
        state.update(
            {
                "graph_status": "waiting_user",
                "pending_user_action": "clarify_intent",
                "current_node": "clarify_if_needed",
                "event_sequence": 2,
            }
        )
        self.store.update(
            paused["flow_id"],
            state=state,
            status="waiting_user",
            event={"sequence": 2, "event_id": f"{paused['flow_id']}:2", "event_type": "interrupt"},
        )
        paused = self.service.get(paused["flow_id"], principal="local-user", workspace_id="local-workspace")
        self.assertEqual(paused["pending_action"], "clarify_intent")
        resume = {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": paused["flow_id"],
            "session_id": paused["session_id"],
            "action": "clarify_intent",
            "pending_action": "clarify_intent",
            "clarification": "请执行 configuration_draft 并继续",
            "current_binding": paused["binding"],
            "current_event_sequence": paused["event_sequence"],
        }
        with self.assertRaisesRegex(AgentFlowError, "explicit supported intent") as raised:
            self.service.resume(
                paused["flow_id"],
                resume,
                principal="local-user",
                workspace_id="local-workspace",
                idempotency_key="resume-clarify-001",
            )
        self.assertEqual(raised.exception.code, "unsupported_intent")
        self.assertEqual(raised.exception.field_path, "/intent")

    def test_pure_resume_keeps_published_pending_action_on_unknown_action(self) -> None:
        state = graph_new_state(
            session_id="session-test",
            user_goal="Prepare a local configuration draft.",
            flow_id="flow-pure-resume",
            context={
                "intent": "configure_experiment_draft",
                "backend_identity": BACKEND,
                "schema_set_revision": "sha256:" + "2" * 64,
                "artifact_bindings": [],
            },
        )
        paused = graph_run_until_pause(state)["state"]
        self.assertEqual(paused["pending_user_action"], "confirm_draft")
        result = graph_resume(
            paused,
            "unpublished_action",
            current_binding={
                field: paused.get(field)
                for field in (
                    "session_id",
                    "flow_id",
                    "run_id",
                    "run_context_revision",
                    "backend_identity",
                    "schema_set_revision",
                    "input_snapshot_digest",
                    "artifact_bindings",
                )
            },
        )
        self.assertEqual(result["state"]["pending_user_action"], "confirm_draft")

    def test_restart_reads_same_flow_and_event_sequence(self) -> None:
        flow, _ = self.service.start(start_request(), principal="local-user", workspace_id="local-workspace", idempotency_key="start-key-004")
        self.store.close()
        reopened = AgentFlowStore(Path(self.temporary.name) / "flows.sqlite")
        service = AgentFlowService(reopened, schema_set_revision="sha256:" + "2" * 64, backend_identity_provider=lambda: BACKEND)
        loaded = service.get(flow["flow_id"], principal="local-user", workspace_id="local-workspace")
        self.assertEqual(loaded["event_sequence"], 1)
        self.assertEqual(loaded["binding"]["flow_id"], flow["flow_id"])
        reopened.close()
        self.store = AgentFlowStore(Path(self.temporary.name) / "flows.sqlite")

    def test_durable_projection_rejects_malformed_checkpoint_counters(self) -> None:
        """GET/restart must fail closed instead of coercing bad durable values."""

        flow, _ = self.service.start(
            start_request(),
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="start-projection-corruption",
        )
        original = self.store.get(flow["flow_id"])
        self.assertIsNotNone(original)
        original_state = original["state"]

        corruptions = {
            "event_sequence_string": {"event_sequence": "1"},
            "navigation_attempts_negative": {"navigation_attempts": -1},
            "model_calls_string": {"model_calls": "1"},
            "execution_time_string": {"execution_time_ms": "oops"},
        }
        for label, updates in corruptions.items():
            with self.subTest(label=label):
                state = {**original_state, **updates}
                self.store._connection.execute(
                    "UPDATE agent_flows SET state_json=? WHERE flow_id=?",
                    (json.dumps(state, ensure_ascii=False, sort_keys=True, separators=(",", ":")), flow["flow_id"]),
                )
                with self.assertRaises(AgentFlowError) as raised:
                    self.service.get(flow["flow_id"], principal="local-user", workspace_id="local-workspace")
                self.assertEqual(raised.exception.code, "langgraph_checkpoint_mismatch")
                self.assertEqual(raised.exception.status, 409)

        # A restart reads the same SQLite row and must expose the same
        # fail-closed behavior rather than turning corruption into HTTP 500.
        state = {**original_state, "event_sequence": "1"}
        self.store._connection.execute(
            "UPDATE agent_flows SET state_json=? WHERE flow_id=?",
            (json.dumps(state, ensure_ascii=False, sort_keys=True, separators=(",", ":")), flow["flow_id"]),
        )
        self.store.close()
        reopened = AgentFlowStore(Path(self.temporary.name) / "flows.sqlite")
        restarted = AgentFlowService(
            reopened,
            schema_set_revision="sha256:" + "2" * 64,
            backend_identity_provider=lambda: BACKEND,
        )
        with self.assertRaises(AgentFlowError) as raised:
            restarted.get(flow["flow_id"], principal="local-user", workspace_id="local-workspace")
        self.assertEqual(raised.exception.code, "langgraph_checkpoint_mismatch")
        self.assertEqual(raised.exception.status, 409)
        reopened.close()
        self.store = AgentFlowStore(Path(self.temporary.name) / "flows.sqlite")

    def test_durable_projection_revalidates_navigation_observation_constraints(self) -> None:
        state = {
            "event_sequence": 1,
            "current_page": "overview",
            "current_page_capabilities": ["overview"],
            "required_capabilities": ["fabric"],
            "allowed_pages": ["metrics", "fabric"],
            "allowed_actions": ["navigate"],
            "visited_pages": ["metrics"],
            "navigation_attempts": 1,
            "max_navigation_attempts": 1,
            "model_calls": 0,
            "tool_calls_per_round": 0,
            "run_creations": 0,
            "execution_time_ms": 0,
            "last_navigation_observation": {
                "target_page": "metrics",
                "actual_page": "metrics",
                "page_correct": True,
                "current_page_capabilities": ["metrics"],
                "current_run_id": None,
                "current_context_revision": None,
                "failure_type": None,
                "retry_allowed": False,
                "visited_pages": ["metrics"],
                "navigation_attempts": 1,
            },
        }
        with self.assertRaises(AgentFlowError) as raised:
            _validate_durable_projection_state(state, record_sequence=1)
        self.assertEqual(raised.exception.code, "langgraph_checkpoint_mismatch")

        state["last_navigation_observation"]["current_page_capabilities"] = ["fabric"]
        state["last_navigation_observation"]["navigation_attempts"] = 2
        with self.assertRaises(AgentFlowError) as raised:
            _validate_durable_projection_state(state, record_sequence=1)
        self.assertEqual(raised.exception.code, "langgraph_checkpoint_mismatch")

    def test_backend_identity_change_blocks_resume_and_read(self) -> None:
        flow, _ = self.service.start(start_request(), principal="local-user", workspace_id="local-workspace", idempotency_key="start-key-005")
        changed_backend = {**BACKEND, "source_revision": "changed"}
        changed = AgentFlowService(self.store, schema_set_revision="sha256:" + "2" * 64, backend_identity_provider=lambda: changed_backend)
        with self.assertRaisesRegex(AgentFlowError, "different backend"):
            changed.get(flow["flow_id"], principal="local-user", workspace_id="local-workspace")

    def test_flow_path_identity_matches_published_pattern(self) -> None:
        for method in ("get", "events"):
            with self.subTest(method=method), self.assertRaises(AgentFlowError) as raised:
                getattr(self.service, method)(
                    "not-a-published-flow-id",
                    principal="local-user",
                    workspace_id="local-workspace",
                )
            self.assertEqual(raised.exception.code, "invalid_field")
            self.assertEqual(raised.exception.field_path, "/flow_id")

        with self.assertRaises(AgentFlowError) as raised:
            self.service.resume(
                "not-a-published-flow-id",
                {},
                principal="local-user",
                workspace_id="local-workspace",
                idempotency_key="resume-invalid-flow",
            )
        self.assertEqual(raised.exception.code, "invalid_field")
        self.assertEqual(raised.exception.field_path, "/flow_id")

    def test_resume_idempotency_is_atomic_for_concurrent_callers(self) -> None:
        flow, _ = self.service.start(
            start_request(),
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="start-key-006",
        )
        resume = {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": flow["flow_id"],
            "session_id": flow["session_id"],
            "action": "confirm_draft",
            "pending_action": "confirm_draft",
            "current_binding": flow["binding"],
            "current_event_sequence": 1,
        }

        def invoke() -> tuple[dict, bool]:
            return self.service.resume(
                flow["flow_id"],
                resume,
                principal="local-user",
                workspace_id="local-workspace",
                idempotency_key="resume-key-006",
            )

        with ThreadPoolExecutor(max_workers=2) as executor:
            first, second = list(executor.map(lambda _: invoke(), range(2)))
        self.assertCountEqual([first[1], second[1]], [False, True])
        self.assertEqual(first[0]["flow_id"], second[0]["flow_id"])
        self.assertEqual(self.service.get(flow["flow_id"], principal="local-user", workspace_id="local-workspace")["event_sequence"], 2)

    def test_optional_runtime_resume_is_not_invoked_twice_for_same_key(self) -> None:
        calls = 0
        calls_lock = threading.Lock()

        class Runtime:
            def start(self, state):
                return graph_run_until_pause(state)

            def resume(self, flow_id, action, *, current_binding, intent=None):
                nonlocal calls
                with calls_lock:
                    calls += 1
                stored = self_store.get(flow_id)
                assert stored is not None
                return graph_resume(stored["state"], action, current_binding=current_binding, intent=intent)

        self_store = self.store
        service = AgentFlowService(
            self.store,
            schema_set_revision="sha256:" + "2" * 64,
            backend_identity_provider=lambda: BACKEND,
            runtime=Runtime(),
            runtime_mode="langgraph_sqlite_local",
        )
        flow, _ = service.start(start_request(), principal="local-user", workspace_id="local-workspace", idempotency_key="start-runtime-resume")
        resume = {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": flow["flow_id"],
            "session_id": flow["session_id"],
            "action": "confirm_draft",
            "pending_action": "confirm_draft",
            "current_binding": flow["binding"],
            "current_event_sequence": 1,
        }

        def invoke() -> tuple[dict, bool]:
            return service.resume(
                flow["flow_id"],
                resume,
                principal="local-user",
                workspace_id="local-workspace",
                idempotency_key="resume-runtime-fence",
            )

        with ThreadPoolExecutor(max_workers=2) as executor:
            first, second = list(executor.map(lambda _: invoke(), range(2)))
        self.assertCountEqual([first[1], second[1]], [False, True])
        self.assertEqual(calls, 1)

    def test_optional_runtime_resume_refreshes_state_before_different_key(self) -> None:
        calls = 0

        class Runtime:
            def start(self, state):
                return graph_run_until_pause(state)

            def resume(self, flow_id, action, *, current_binding, intent=None):
                nonlocal calls
                calls += 1
                stored = self_store.get(flow_id)
                assert stored is not None
                return graph_resume(stored["state"], action, current_binding=current_binding, intent=intent)

        self_store = self.store
        service = AgentFlowService(
            self.store,
            schema_set_revision="sha256:" + "2" * 64,
            backend_identity_provider=lambda: BACKEND,
            runtime=Runtime(),
            runtime_mode="langgraph_sqlite_local",
        )
        flow, _ = service.start(start_request(), principal="local-user", workspace_id="local-workspace", idempotency_key="start-runtime-refresh")
        resume = {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": flow["flow_id"],
            "session_id": flow["session_id"],
            "action": "confirm_draft",
            "pending_action": "confirm_draft",
            "current_binding": flow["binding"],
            "current_event_sequence": 1,
        }
        service.resume(flow["flow_id"], resume, principal="local-user", workspace_id="local-workspace", idempotency_key="resume-runtime-refresh-a")
        with self.assertRaisesRegex(AgentFlowError, "pending action"):
            service.resume(flow["flow_id"], resume, principal="local-user", workspace_id="local-workspace", idempotency_key="resume-runtime-refresh-b")
        self.assertEqual(calls, 1)

    def test_optional_runtime_usage_counters_are_preserved_and_budgeted(self) -> None:
        """Runtime-reported calls must reach the durable authorization ledger."""

        def navigation_request(max_model_calls: int) -> dict:
            request = start_request(intent="navigation")
            request.update(
                {
                    "current_page": "overview",
                    "current_page_capabilities": ["overview"],
                    "current_context_revision": "ctx-runtime-usage-1",
                    "required_capabilities": [],
                    "allowed_pages": ["design_space"],
                    "allowed_actions": ["navigate"],
                    "navigation_attempts": 0,
                    "max_navigation_attempts": 3,
                    "authorization_budget": {
                        "max_navigation_attempts": 3,
                        "max_model_calls": max_model_calls,
                        "max_tool_calls_per_round": 3,
                        "max_run_creations": 1,
                        "max_execution_time_ms": 30_000,
                    },
                }
            )
            return refresh_navigation_authorization(request)

        class Runtime:
            def __init__(self, flow_store):
                self.flow_store = flow_store

            def start(self, state):
                return graph_run_until_pause(state)

            def resume(self, flow_id, action, *, current_binding, intent=None):
                stored = self.flow_store.get(flow_id)
                assert stored is not None
                result = graph_resume(stored["state"], action, current_binding=current_binding, intent=intent)
                result["state"]["model_calls"] = 2
                result["state"]["run_creations"] = 1
                return result

        service = AgentFlowService(
            self.store,
            schema_set_revision="sha256:" + "2" * 64,
            backend_identity_provider=lambda: BACKEND,
            runtime=Runtime(self.store),
            runtime_mode="langgraph_sqlite_local",
        )
        flow, _ = service.start(
            navigation_request(2),
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="start-runtime-usage-001",
        )
        resume = {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": flow["flow_id"],
            "session_id": flow["session_id"],
            "action": "confirm_navigation",
            "pending_action": "confirm_navigation",
            "current_binding": flow["binding"],
            "current_event_sequence": flow["event_sequence"],
            **resume_authorization_fields(flow),
        }
        updated, replay = service.resume(
            flow["flow_id"],
            resume,
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="resume-runtime-usage-001",
        )
        self.assertFalse(replay)
        self.assertEqual(updated["authorization"]["usage"]["model_calls"], 2)
        self.assertEqual(updated["authorization"]["usage"]["run_creations"], 1)
        self.assertEqual(updated["authorization"]["remaining"]["max_model_calls"], 0)
        self.assertEqual(updated["authorization"]["remaining"]["max_run_creations"], 0)

        over_budget_store = AgentFlowStore(Path(self.temporary.name) / "flows-over-budget.sqlite")
        over_budget_service = AgentFlowService(
            over_budget_store,
            schema_set_revision="sha256:" + "2" * 64,
            backend_identity_provider=lambda: BACKEND,
            runtime=Runtime(over_budget_store),
            runtime_mode="langgraph_sqlite_local",
        )
        try:
            over_budget, _ = over_budget_service.start(
                navigation_request(1),
                principal="local-user",
                workspace_id="local-workspace",
                idempotency_key="start-runtime-usage-002",
            )
            over_resume = {**resume, "flow_id": over_budget["flow_id"], "current_binding": over_budget["binding"], "current_event_sequence": over_budget["event_sequence"], **resume_authorization_fields(over_budget)}
            with self.assertRaises(AgentFlowError) as raised:
                over_budget_service.resume(
                    over_budget["flow_id"],
                    over_resume,
                    principal="local-user",
                    workspace_id="local-workspace",
                    idempotency_key="resume-runtime-usage-002",
                )
            self.assertEqual(raised.exception.code, "authorization_budget_exhausted")
            self.assertEqual(over_budget_service.store.get(over_budget["flow_id"])["sequence"], over_budget["event_sequence"])
        finally:
            over_budget_service.store.close()

    def test_optional_runtime_cannot_drop_or_widen_authorization_envelope(self) -> None:
        """A checkpoint is not allowed to issue or broaden Bridge permissions."""

        def navigation_request() -> dict:
            request = start_request(intent="navigation")
            request.update(
                {
                    "current_page": "overview",
                    "current_page_capabilities": ["overview"],
                    "current_context_revision": "ctx-runtime-authz-1",
                    "required_capabilities": [],
                    "allowed_pages": ["design_space"],
                    "allowed_actions": ["navigate"],
                    "navigation_attempts": 0,
                    "max_navigation_attempts": 3,
                    "authorization_budget": {
                        "max_navigation_attempts": 3,
                        "max_model_calls": 2,
                        "max_tool_calls_per_round": 1,
                        "max_run_creations": 1,
                        "max_execution_time_ms": 30_000,
                    },
                }
            )
            return refresh_navigation_authorization(request)

        class Runtime:
            def __init__(self, flow_store, mutation):
                self.flow_store = flow_store
                self.mutation = mutation

            def start(self, state):
                return graph_run_until_pause(state)

            def resume(self, flow_id, action, *, current_binding, intent=None):
                stored = self.flow_store.get(flow_id)
                assert stored is not None
                result = graph_resume(stored["state"], action, current_binding=current_binding, intent=intent)
                self.mutation(result["state"])
                return result

        resume_action = lambda flow: {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": flow["flow_id"],
            "session_id": flow["session_id"],
            "action": "confirm_navigation",
            "pending_action": "confirm_navigation",
            "current_binding": flow["binding"],
            "current_event_sequence": flow["event_sequence"],
            **resume_authorization_fields(flow),
        }

        for label, mutation in (
            ("drop_digest", lambda state: state.pop("authorization_digest", None)),
            ("widen_pages", lambda state: state.update({"allowed_pages": ["design_space", "metrics"]})),
        ):
            with self.subTest(label=label):
                store = AgentFlowStore(Path(self.temporary.name) / f"flows-runtime-authz-{label}.sqlite")
                service = AgentFlowService(
                    store,
                    schema_set_revision="sha256:" + "2" * 64,
                    backend_identity_provider=lambda: BACKEND,
                    runtime=Runtime(store, mutation),
                    runtime_mode="langgraph_sqlite_local",
                )
                try:
                    flow, _ = service.start(
                        navigation_request(),
                        principal="local-user",
                        workspace_id="local-workspace",
                        idempotency_key=f"start-runtime-authz-{label}",
                    )
                    with self.assertRaises(AgentFlowError) as raised:
                        service.resume(
                            flow["flow_id"],
                            resume_action(flow),
                            principal="local-user",
                            workspace_id="local-workspace",
                            idempotency_key=f"resume-runtime-authz-{label}",
                        )
                    self.assertEqual(raised.exception.code, "langgraph_checkpoint_mismatch")
                    persisted = store.get(flow["flow_id"])
                    assert persisted is not None
                    self.assertEqual(persisted["sequence"], flow["event_sequence"])
                    self.assertEqual(persisted["state"].get("authorization_digest"), flow["authorization"]["authorization_digest"])
                    self.assertEqual(persisted["state"].get("allowed_pages"), ["design_space"])
                finally:
                    store.close()

    def test_checkpoint_ahead_of_bridge_fails_closed_after_lost_transition(self) -> None:
        calls = 0

        class Runtime:
            def start(self, state):
                return graph_run_until_pause(state)

            def resume(self, flow_id, action, *, current_binding, intent=None):
                nonlocal calls
                calls += 1
                stored = self_store.get(flow_id)
                assert stored is not None
                if calls == 1:
                    return graph_resume(stored["state"], action, current_binding=current_binding, intent=intent)
                state = dict(stored["state"])
                state.update(
                    {
                        "graph_status": "refused",
                        "terminal_reason": "flow_is_not_waiting_for_user",
                        "pending_user_action": None,
                        "current_node": "terminal",
                    }
                )
                return {
                    "state": state,
                    "event": {
                        "sequence": int(stored["sequence"]) + 1,
                        "type": "terminal",
                        "node": "terminal",
                        "reason": "flow_is_not_waiting_for_user",
                        "status": "refused",
                    },
                }

        self_store = self.store
        service = AgentFlowService(
            self.store,
            schema_set_revision="sha256:" + "2" * 64,
            backend_identity_provider=lambda: BACKEND,
            runtime=Runtime(),
            runtime_mode="langgraph_sqlite_local",
        )
        flow, _ = service.start(start_request(), principal="local-user", workspace_id="local-workspace", idempotency_key="start-runtime-crash")
        resume = {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": flow["flow_id"],
            "session_id": flow["session_id"],
            "action": "confirm_draft",
            "pending_action": "confirm_draft",
            "current_binding": flow["binding"],
            "current_event_sequence": 1,
        }
        original_transition = self.store.transition_resume
        failed_once = True

        def fail_after_runtime(*args, **kwargs):
            nonlocal failed_once
            if failed_once:
                failed_once = False
                raise RuntimeError("simulated process loss after checkpoint commit")
            return original_transition(*args, **kwargs)

        self.store.transition_resume = fail_after_runtime  # type: ignore[method-assign]
        with self.assertRaisesRegex(RuntimeError, "simulated process loss"):
            service.resume(flow["flow_id"], resume, principal="local-user", workspace_id="local-workspace", idempotency_key="resume-runtime-crash")
        self.store.transition_resume = original_transition  # type: ignore[method-assign]
        with self.assertRaises(AgentFlowError) as raised:
            service.resume(flow["flow_id"], resume, principal="local-user", workspace_id="local-workspace", idempotency_key="resume-runtime-crash")
        self.assertEqual(raised.exception.code, "langgraph_checkpoint_mismatch")
        self.assertEqual(self.store.get(flow["flow_id"])["sequence"], 1)
        self.assertEqual(calls, 2)

    def test_resume_transition_rolls_back_state_and_replay_record_together(self) -> None:
        flow, _ = self.service.start(
            start_request(),
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="start-key-007",
        )
        stored = self.store.get(flow["flow_id"])
        assert stored is not None
        next_state = dict(stored["state"])
        next_state["event_sequence"] = 2
        next_event = {"sequence": 2, "event_id": f"{flow['flow_id']}:2", "event_type": "state_changed"}
        with self.assertRaisesRegex(RuntimeError, "response construction failed"):
            self.store.transition_resume(
                flow["flow_id"],
                "resume-key-007",
                "sha256:" + "7" * 64,
                state=next_state,
                status="draft_ready",
                event=next_event,
                response_factory=lambda _: (_ for _ in ()).throw(RuntimeError("response construction failed")),
            )
        unchanged = self.store.get(flow["flow_id"])
        assert unchanged is not None
        self.assertEqual(unchanged["sequence"], 1)
        events = self.store.events(flow["flow_id"], after_sequence=0)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["sequence"], 1)
        replay, found = self.store.get_resume_record(flow["flow_id"], "resume-key-007", "sha256:" + "7" * 64)
        self.assertFalse(found)
        self.assertIsNone(replay)

    def test_resume_transition_duplicate_event_is_a_contract_conflict(self) -> None:
        flow, _ = self.service.start(
            start_request(),
            principal="local-user",
            workspace_id="local-workspace",
            idempotency_key="start-key-008",
        )
        stored = self.store.get(flow["flow_id"])
        assert stored is not None
        next_state = dict(stored["state"])
        next_state["event_sequence"] = 2
        next_event = {"sequence": 2, "event_id": f"{flow['flow_id']}:2", "event_type": "state_changed"}
        self.store.transition_resume(
            flow["flow_id"],
            "resume-key-008-a",
            "sha256:" + "8" * 64,
            state=next_state,
            status="draft_ready",
            event=next_event,
            response_factory=lambda record: {"flow_id": record["flow_id"]},
        )
        duplicate_state = dict(next_state)
        duplicate_state["event_sequence"] = 3
        duplicate_event = {"sequence": 3, "event_id": f"{flow['flow_id']}:2", "event_type": "state_changed"}
        with self.assertRaisesRegex(RuntimeError, "already exists") as raised:
            self.store.transition_resume(
                flow["flow_id"],
                "resume-key-008-b",
                "sha256:" + "9" * 64,
                state=duplicate_state,
                status="draft_ready",
                event=duplicate_event,
                response_factory=lambda record: {"flow_id": record["flow_id"]},
            )
        self.assertEqual(getattr(raised.exception, "code", None), "event_out_of_order")
        unchanged = self.store.get(flow["flow_id"])
        assert unchanged is not None
        self.assertEqual(unchanged["sequence"], 2)
        self.assertIsNone(self.store.get_resume_record(flow["flow_id"], "resume-key-008-b", "sha256:" + "9" * 64)[0])


class AgentFlowEndpointTest(unittest.TestCase):
    def setUp(self) -> None:
        import server

        self.server_module = server
        self.temporary = tempfile.TemporaryDirectory()
        self.previous_service = server.agent_flow_service
        store = AgentFlowStore(Path(self.temporary.name) / "flows.sqlite")
        self.store = store
        server.agent_flow_service = AgentFlowService(store, schema_set_revision=server.SCHEMA_SET_REVISION, backend_identity_provider=lambda: BACKEND)
        self.httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.BridgeHandler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.httpd.server_port}"

    def tearDown(self) -> None:
        self.httpd.shutdown(); self.httpd.server_close(); self.thread.join(timeout=2)
        self.server_module.agent_flow_service = self.previous_service
        self.store.close(); self.temporary.cleanup()

    def request(self, path: str, *, method: str = "GET", payload: dict | None = None, headers: dict[str, str] | None = None):
        request = urllib.request.Request(self.base_url + path, method=method, headers={"Content-Type": "application/json", **(headers or {})}, data=json.dumps(payload).encode() if payload is not None else None)
        try:
            response = urllib.request.urlopen(request, timeout=10)
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read()), error.headers
        with response:
            body = response.read()
            content_type = response.headers.get("Content-Type", "")
            return response.status, (body.decode() if "text/event-stream" in content_type else json.loads(body)), response.headers

    def test_start_status_events_sse_and_resume(self) -> None:
        request = start_request(schema_revision=self.server_module.SCHEMA_SET_REVISION)
        status, payload, _ = self.request("/api/agent/flows", method="POST", payload=request, headers={"Idempotency-Key": "http-start-001"})
        self.assertEqual(status, 201)
        flow = payload["flow"]
        self.assertEqual(flow["schema_identity"], "tilesim.agent_flow.state.v1")
        status, body, _ = self.request(f"/api/agent/flows/{flow['flow_id']}")
        self.assertEqual(status, 200); self.assertEqual(body["flow"]["flow_id"], flow["flow_id"])
        status, events, _ = self.request(f"/api/agent/flows/{flow['flow_id']}/events", headers={"Last-Event-ID": "0"})
        self.assertEqual(status, 200); self.assertEqual(events["events"][0]["sequence"], 1)
        status, stream, headers = self.request(f"/api/agent/flows/{flow['flow_id']}/events/stream")
        self.assertEqual(status, 200); self.assertIn("text/event-stream", headers.get("Content-Type", "")); self.assertIn("event: flow", stream)
        resume = {
            "schema_identity": FLOW_RESUME_SCHEMA_IDENTITY,
            "contract_revision": FLOW_CONTRACT_REVISION,
            "flow_id": flow["flow_id"], "session_id": flow["session_id"],
            "action": "confirm_draft", "pending_action": "confirm_draft",
            "current_binding": flow["binding"], "current_event_sequence": 1,
        }
        status, resumed, _ = self.request(f"/api/agent/flows/{flow['flow_id']}/resume", method="POST", payload=resume, headers={"Idempotency-Key": "http-resume-001"})
        self.assertEqual(status, 200); self.assertEqual(resumed["flow"]["status"], "draft_ready"); self.assertEqual(len(resumed["events"]), 1)

    def test_authorization_revoke_endpoint_stops_navigation_flow(self) -> None:
        request = start_request(intent="navigation", schema_revision=self.server_module.SCHEMA_SET_REVISION)
        request.update(
            {
                "current_page": "overview",
                "current_page_capabilities": ["overview"],
                "current_context_revision": "ctx-http-revoke",
                "run_id": "run-http-revoke",
                "run_context_revision": "ctx-http-revoke",
                "required_capabilities": ["metrics"],
                "allowed_pages": ["metrics"],
                "allowed_actions": ["navigate"],
                "navigation_attempts": 0,
                "max_navigation_attempts": 2,
            }
        )
        refresh_navigation_authorization(request)
        status, payload, _ = self.request(
            "/api/agent/flows",
            method="POST",
            payload=request,
            headers={"Idempotency-Key": "http-start-revoke-001"},
        )
        self.assertEqual(status, 201)
        flow = payload["flow"]
        body = revoke_request(flow)
        status, revoked, _ = self.request(
            f"/api/agent/flows/{flow['flow_id']}/authorization/revoke",
            method="POST",
            payload=body,
            headers={"Idempotency-Key": "http-revoke-001"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(revoked["action"], "revoke_authorization")
        self.assertEqual(revoked["flow"]["status"], "cancelled")
        self.assertEqual(revoked["flow"]["authorization"]["status"], "revoked")
        status, repeated, _ = self.request(
            f"/api/agent/flows/{flow['flow_id']}/authorization/revoke",
            method="POST",
            payload=body,
            headers={"Idempotency-Key": "http-revoke-001"},
        )
        self.assertEqual(status, 200)
        self.assertTrue(repeated["idempotent_replay"])
        self.assertEqual(repeated["flow"]["event_sequence"], 2)

    def test_scope_and_schema_fail_closed(self) -> None:
        request = start_request(schema_revision=self.server_module.SCHEMA_SET_REVISION)
        status, payload, _ = self.request("/api/agent/flows", method="POST", payload=request, headers={"Idempotency-Key": "http-start-002", "X-TileSim-Scopes": "agent:read_flow"})
        self.assertEqual(status, 403); self.assertEqual(payload["error"]["code"], "scope_denied")
        self.assertEqual(payload["error"]["nested_schema_identity"], FLOW_ERROR_SCHEMA_IDENTITY)
        request["contract_revision"] = "2026-10-24.flow.v1"
        status, payload, _ = self.request("/api/agent/flows", method="POST", payload=request, headers={"Idempotency-Key": "http-start-003"})
        self.assertEqual(status, 409); self.assertEqual(payload["error"]["code"], "contract_revision_mismatch")

    def test_flow_path_identity_rejects_unpublished_shape(self) -> None:
        status, payload, _ = self.request("/api/agent/flows/not-a-published-flow-id")
        self.assertEqual(status, 400)
        self.assertEqual(payload["error"]["code"], "invalid_field")
        self.assertEqual(payload["error"]["field_path"], "/flow_id")

    def test_last_event_id_uses_strict_contract_digits_for_json_and_sse(self) -> None:
        request = start_request(schema_revision=self.server_module.SCHEMA_SET_REVISION)
        status, payload, _ = self.request(
            "/api/agent/flows",
            method="POST",
            payload=request,
            headers={"Idempotency-Key": "http-start-cursor-001"},
        )
        self.assertEqual(status, 201)
        flow_id = payload["flow"]["flow_id"]
        for suffix in ("+1", "-0"):
            with self.subTest(suffix=suffix):
                status, body, _ = self.request(
                    f"/api/agent/flows/{flow_id}/events",
                    headers={"Last-Event-ID": suffix},
                )
                self.assertEqual(status, 400)
                self.assertEqual(body["error"]["code"], "invalid_last_event_id")
                status, body, _ = self.request(
                    f"/api/agent/flows/{flow_id}/events/stream",
                    headers={"Last-Event-ID": suffix},
                )
                self.assertEqual(status, 400)
                self.assertEqual(body["error"]["code"], "invalid_last_event_id")

        # Query fallback is not the published header, but the adapter accepts
        # it for deterministic polling clients and must apply the same fence.
        status, body, _ = self.request(
            f"/api/agent/flows/{flow_id}/events?after_sequence=%2B1",
        )
        self.assertEqual(status, 400)
        self.assertEqual(body["error"]["code"], "invalid_last_event_id")
        status, body, _ = self.request(
            f"/api/agent/flows/{flow_id}/events?after_sequence=",
        )
        self.assertEqual(status, 400)
        self.assertEqual(body["error"]["code"], "invalid_last_event_id")

    def test_invalid_flow_principal_and_scope_use_flow_error_envelope(self) -> None:
        request = start_request(schema_revision=self.server_module.SCHEMA_SET_REVISION)
        status, payload, _ = self.request(
            "/api/agent/flows",
            method="POST",
            payload=request,
            headers={"Idempotency-Key": "http-start-004", "X-TileSim-Scopes": "agent:start_flow,unknown"},
        )
        self.assertEqual(status, 403)
        self.assertEqual(payload["error"]["code"], "unknown_scope")
        self.assertEqual(payload["error"]["nested_schema_identity"], "tilesim.agent_flow.error.v1")

        status, payload, _ = self.request(
            "/api/agent/flows",
            method="POST",
            payload=request,
            headers={"Idempotency-Key": "http-start-005", "X-TileSim-Principal": "bad principal"},
        )
        self.assertEqual(status, 403)
        self.assertEqual(payload["error"]["code"], "principal_invalid")
        self.assertEqual(payload["error"]["nested_schema_identity"], "tilesim.agent_flow.error.v1")
        self.assertEqual(payload["error"]["nested_schema_identity"], FLOW_ERROR_SCHEMA_IDENTITY)


if __name__ == "__main__":
    unittest.main()
