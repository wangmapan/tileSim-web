"""Pure authorization and decision-loop regression tests.

These tests intentionally inject model/tool callables.  They do not start the
Bridge, touch a provider, or write an optimization store.
"""

from __future__ import annotations

import copy
import json
import os
import unittest
from unittest.mock import patch

from agent_harness.authorization import (
    PROVENANCE,
    authorization_digest,
    issue_authorization,
    revoke_authorization,
    validate_authorization,
    verify_authorization,
)
from agent_harness.contracts import canonical_sha256
from agent_harness.tools import TOOL_DEFINITIONS, _closed_input, catalog, validate_tool_arguments
from services.agent_loop import authorize_action, build_agent_messages, run_agent_turn
from agent_harness.optimization import OptimizationError, build_attempt_history


BACKEND = {"backend_revision": "backend-test", "deployment_mode": "local_dev"}
SCHEMA_REVISION = "sha256:" + "a" * 64


def _session() -> dict:
    return {
        "session_id": "opt-test",
        "principal": "local-user",
        "workspace_id": "local-workspace",
        "schema_set_revision": SCHEMA_REVISION,
        "backend_identity": BACKEND,
        "input_snapshot_digest": canonical_sha256({"scenario": "test"}),
        "objective": {"metric_path": "/metrics/throughput", "direction": "maximize"},
    }


_EXPLICIT_AGENT_BUDGET = {
    "max_rounds": 5,
    "max_runs": 5,
    "max_seconds": 900,
    "max_failures": 2,
    "max_model_calls": 24,
    "max_tool_calls_per_round": 4,
    "max_navigation_attempts": 4,
    "max_run_creations": 1,
    "max_execution_time_ms": 900_000,
}
_EXPLICIT_ALLOWED_PAGES = ["overview", "metrics", "execution", "replay"]
_EXPLICIT_ALLOWED_ACTIONS = ["explain", "navigate", "analyze", "report", "draft", "execute"]


def _authorization(*, grants: list[dict] | None = None, budget: dict | None = None, autonomy_level: str = "bounded_autonomous") -> dict:
    return issue_authorization(
        session=_session(),
        grants=grants or [{"pointer": "/devices/0/width", "min": 1, "max": 64, "step": 2, "kind": "int"}],
        objective={"metric_path": "/metrics/throughput", "direction": "maximize", "minimum_improvement": 0.01, "plateau_rounds": 3},
        budget=budget or dict(_EXPLICIT_AGENT_BUDGET),
        tool_allowlist=["get_capability_catalog", "query_verified_metrics"],
        autonomy_level=autonomy_level,
        issued_by="local-user",
        allowed_pages=list(_EXPLICIT_ALLOWED_PAGES),
        allowed_actions=list(_EXPLICIT_ALLOWED_ACTIONS),
    )


class AuthorizationTests(unittest.TestCase):
    def test_validate_authorization_is_closed_and_side_effect_free(self) -> None:
        request = {
            "autonomy_level": "bounded_autonomous",
            "parameter_grants": [{"pointer": "/devices/0/width", "min": 1, "max": 64, "step": 1, "kind": "int"}],
            "objective": {"metric_path": "/metrics/throughput", "direction": "maximize"},
            "budget": {
                "max_rounds": 2,
                "max_runs": 2,
                "max_seconds": 60,
                "max_failures": 1,
                "max_model_calls": 2,
                "max_tool_calls_per_round": 1,
                "max_navigation_attempts": 1,
                "max_run_creations": 1,
                "max_execution_time_ms": 60_000,
            },
            "tool_allowlist": ["query_verified_metrics"],
            "allowed_pages": ["overview", "metrics"],
            "allowed_actions": ["explain", "navigate"],
            "ttl_seconds": 120,
        }
        normalized = validate_authorization(request, session=_session())
        self.assertEqual(normalized["autonomy_level"], "bounded_autonomous")
        self.assertEqual(normalized["budget"]["max_rounds"], 2)
        self.assertEqual(normalized["budget"]["max_model_calls"], 2)
        self.assertEqual(normalized["budget"]["max_tool_calls_per_round"], 1)
        with self.assertRaisesRegex(ValueError, "closed"):
            validate_authorization({**request, "principal": "forged"}, session=_session())

    def test_authorization_digest_covers_all_fields(self) -> None:
        document = _authorization()
        self.assertEqual(document["authorization_digest"], authorization_digest(document))
        changed = copy.deepcopy(document)
        changed["budget"]["max_runs"] += 1
        self.assertNotEqual(document["authorization_digest"], authorization_digest(changed))
        self.assertEqual(verify_authorization(changed, session=_session(), principal="local-user", workspace_id="local-workspace", schema_set_revision=SCHEMA_REVISION, backend_identity=BACKEND)["code"], "authorization_digest_mismatch")

    def test_authorization_rejects_unknown_fields_even_after_digest_recompute(self) -> None:
        document = _authorization()
        document["future_permission"] = True
        document["authorization_digest"] = authorization_digest(document)
        verified = verify_authorization(
            document,
            session=_session(),
            principal="local-user",
            workspace_id="local-workspace",
            schema_set_revision=SCHEMA_REVISION,
            backend_identity=BACKEND,
        )
        self.assertEqual(verified, {"valid": False, "code": "unknown_field"})

        nested = _authorization()
        nested["protected"]["future_identity"] = "unexpected"
        nested["authorization_digest"] = authorization_digest(nested)
        verified_nested = verify_authorization(
            nested,
            session=_session(),
            principal="local-user",
            workspace_id="local-workspace",
            schema_set_revision=SCHEMA_REVISION,
            backend_identity=BACKEND,
        )
        self.assertEqual(verified_nested, {"valid": False, "code": "unknown_field"})

    def test_authorization_allowlist_is_closed_at_pure_function_boundary(self) -> None:
        with self.assertRaisesRegex(ValueError, "unpublished"):
            validate_authorization(
                {
                    "tool_allowlist": ["not_a_published_tool"],
                    "objective": {"metric_path": "/metrics/throughput", "direction": "maximize"},
                    "budget": dict(_EXPLICIT_AGENT_BUDGET),
                    "allowed_pages": list(_EXPLICIT_ALLOWED_PAGES),
                    "allowed_actions": list(_EXPLICIT_ALLOWED_ACTIONS),
                },
                session=_session(),
            )
        with self.assertRaisesRegex(ValueError, "unpublished"):
            issue_authorization(
                session=_session(),
                grants=[],
                objective={"metric_path": "/metrics/throughput", "direction": "maximize"},
                budget=dict(_EXPLICIT_AGENT_BUDGET),
                tool_allowlist=["not_a_published_tool"],
                autonomy_level="bounded_autonomous",
                issued_by="local-user",
                allowed_pages=list(_EXPLICIT_ALLOWED_PAGES),
                allowed_actions=list(_EXPLICIT_ALLOWED_ACTIONS),
            )

    def test_authorization_verifies_all_identity_bindings(self) -> None:
        document = _authorization()
        self.assertTrue(verify_authorization(document, session=_session(), principal="local-user", workspace_id="local-workspace", schema_set_revision=SCHEMA_REVISION, backend_identity=BACKEND)["valid"])
        self.assertEqual(verify_authorization(document, session=_session(), principal="other", workspace_id="local-workspace", schema_set_revision=SCHEMA_REVISION, backend_identity=BACKEND)["code"], "principal_mismatch")

    def test_legacy_authorization_without_call_limits_fails_closed(self) -> None:
        document = _authorization()
        document["budget"].pop("max_model_calls")
        document["authorization_digest"] = authorization_digest(document)
        verified = verify_authorization(
            document,
            session=_session(),
            principal="local-user",
            workspace_id="local-workspace",
            schema_set_revision=SCHEMA_REVISION,
            backend_identity=BACKEND,
        )
        self.assertEqual(verified, {"valid": False, "code": "invalid_budget"})

    def test_agent_call_limits_require_positive_bounded_integers(self) -> None:
        for field, values in {
            "max_model_calls": (0, -1, 1.5, 61),
            "max_tool_calls_per_round": (0, -1, 1.5, 5),
            "max_navigation_attempts": (0, -1, 1.5, 9),
            "max_run_creations": (0, -1, 1.5, 2),
            "max_execution_time_ms": (0, -1, 1.5, 3_600_001),
        }.items():
            for value in values:
                with self.subTest(field=field, value=value):
                    with self.assertRaisesRegex(ValueError, "outside the local-dev bound"):
                        validate_authorization(
                            {
                                "budget": {
                                    "max_rounds": 1,
                                    "max_runs": 1,
                                    "max_seconds": 1,
                                    "max_failures": 1,
                                    "max_model_calls": value if field == "max_model_calls" else 1,
                                    "max_tool_calls_per_round": value if field == "max_tool_calls_per_round" else 1,
                                    "max_navigation_attempts": value if field == "max_navigation_attempts" else 1,
                                    "max_run_creations": value if field == "max_run_creations" else 1,
                                    "max_execution_time_ms": value if field == "max_execution_time_ms" else 1,
                                },
                                "objective": {"metric_path": "/metrics/throughput", "direction": "maximize"},
                                "tool_allowlist": ["query_verified_metrics"],
                                "allowed_pages": list(_EXPLICIT_ALLOWED_PAGES),
                                "allowed_actions": list(_EXPLICIT_ALLOWED_ACTIONS),
                            },
                            session=_session(),
                        )

    def test_agent_call_limits_and_navigation_allowlists_are_required(self) -> None:
        for field in (
            "max_model_calls",
            "max_tool_calls_per_round",
            "max_navigation_attempts",
            "max_run_creations",
            "max_execution_time_ms",
        ):
            with self.subTest(field=field):
                budget = dict(_EXPLICIT_AGENT_BUDGET)
                budget.pop(field)
                with self.assertRaisesRegex(ValueError, "required"):
                    validate_authorization(
                        {
                            "budget": budget,
                            "objective": {"metric_path": "/metrics/throughput", "direction": "maximize"},
                            "tool_allowlist": ["query_verified_metrics"],
                            "allowed_pages": list(_EXPLICIT_ALLOWED_PAGES),
                            "allowed_actions": list(_EXPLICIT_ALLOWED_ACTIONS),
                        },
                        session=_session(),
                    )
        for field in ("allowed_pages", "allowed_actions"):
            with self.subTest(field=field):
                request = {
                    "budget": dict(_EXPLICIT_AGENT_BUDGET),
                    "objective": {"metric_path": "/metrics/throughput", "direction": "maximize"},
                    "tool_allowlist": ["query_verified_metrics"],
                    "allowed_pages": list(_EXPLICIT_ALLOWED_PAGES),
                    "allowed_actions": list(_EXPLICIT_ALLOWED_ACTIONS),
                }
                request.pop(field)
                with self.assertRaisesRegex(ValueError, "unpublished or malformed"):
                    validate_authorization(request, session=_session())

    def test_revoke_is_idempotent_and_fails_closed(self) -> None:
        document = _authorization()
        revoked = revoke_authorization(document, actor="local-user")
        self.assertEqual(revoked["status"], "revoked")
        self.assertEqual(revoke_authorization(revoked, actor="local-user")["authorization_digest"], revoked["authorization_digest"])
        self.assertEqual(verify_authorization(revoked, session=_session(), principal="local-user", workspace_id="local-workspace", schema_set_revision=SCHEMA_REVISION, backend_identity=BACKEND)["code"], "authorization_inactive")

    def test_internal_authorization_stop_is_mapped_to_published_union(self) -> None:
        # ``authorization_revoked`` is an audit marker, not a member of the
        # already-published optimization stop-reason schema.  The adapter must
        # keep the payload schema-valid while retaining the marker in detail.
        import server

        stop = server._optimization_stop_reason("opt-test", "authorization_revoked", "Authorization was revoked.")
        self.assertEqual(stop["reason"], "objective_unavailable")
        self.assertIn("authorization_revoked", stop["detail"])

    def test_signed_run_and_execution_time_budgets_stop_before_submission(self) -> None:
        import server
        authorization = _authorization(
            budget={**_EXPLICIT_AGENT_BUDGET, "max_run_creations": 1, "max_execution_time_ms": 60_000}
        )
        run_exhausted = server._optimization_authorization_budget_stop(
            {"session_id": "opt-test", "run_count": 1, "created_at": "2099-01-01T00:00:00+00:00"},
            authorization,
        )
        self.assertIsNotNone(run_exhausted)
        self.assertEqual(run_exhausted["reason"], "budget_exhausted")
        time_exhausted = server._optimization_authorization_budget_stop(
            {"session_id": "opt-test", "run_count": 0, "created_at": "2020-01-01T00:00:00+00:00"},
            authorization,
        )
        self.assertIsNotNone(time_exhausted)
        self.assertEqual(time_exhausted["reason"], "budget_exhausted")

    def test_formal_submission_requires_signed_execute_action(self) -> None:
        import server
        authorization = _authorization()
        self.assertTrue(server._optimization_authorized_execution(authorization))
        authorization["allowed_actions"] = ["analyze", "draft", "navigate"]
        self.assertFalse(server._optimization_authorized_execution(authorization))


class ToolAndDecisionTests(unittest.TestCase):
    def test_propose_mode_keeps_model_loop_but_not_auto_submit(self) -> None:
        import server

        session = {"authorization": {"autonomy_level": "human_approves_each"}}
        with patch.dict(os.environ, {"TILESIM_AGENT_TOOLS": "on", "TILESIM_AGENT_AUTONOMY": "propose"}, clear=False):
            self.assertTrue(server._optimization_agent_enabled(session))
            self.assertFalse(server._optimization_autonomous_enabled(session))

    def test_catalog_schema_matches_gateway(self) -> None:
        published = {item["tool_name"]: item["input_schema"] for item in catalog(schema_set_revision=SCHEMA_REVISION, backend_identity=BACKEND)["tools"]}
        self.assertEqual(set(published), set(TOOL_DEFINITIONS))
        for name, definition in TOOL_DEFINITIONS.items():
            schema = published[name]
            self.assertFalse(schema["additionalProperties"])
            if name == "get_capability_catalog":
                self.assertEqual(schema["properties"], {})
                validate_tool_arguments(name, {})
                _closed_input(definition, {})
            else:
                self.assertEqual(set(schema["required"]), {"run_id"})

    def test_schema_violation_rejects_unknown_argument(self) -> None:
        called: list[str] = []
        with self.assertRaisesRegex(ValueError, "closed"):
            validate_tool_arguments("get_capability_catalog", {"shell": True})
        with self.assertRaisesRegex(ValueError, "closed"):
            _closed_input(TOOL_DEFINITIONS["get_capability_catalog"], {"shell": True})
        authorization = _authorization()
        verdict = authorize_action(authorization=authorization, action={"kind": "inspect", "tool_name": "get_capability_catalog", "arguments": {"shell": True}}, state={})
        self.assertEqual(verdict["code"], "schema_violation")
        self.assertEqual(called, [])

    def test_authorize_action_checks_tool_grant_before_tool_arguments(self) -> None:
        authorization = _authorization()
        verdict = authorize_action(
            authorization=authorization,
            action={
                "kind": "inspect",
                "tool_name": "get_run_status",
                "arguments": {"shell": True},
            },
            state={},
        )
        self.assertEqual(verdict["code"], "tool_not_authorized")

    def test_decision_primitives_require_their_explicit_action_grant(self) -> None:
        analyze_denied = copy.deepcopy(_authorization())
        analyze_denied["allowed_actions"] = ["draft", "execute"]
        self.assertEqual(
            authorize_action(
                authorization=analyze_denied,
                action={"kind": "inspect", "tool_name": "get_capability_catalog", "arguments": {}},
                state={},
            )["code"],
            "action_not_allowed",
        )
        draft_denied = copy.deepcopy(_authorization())
        draft_denied["allowed_actions"] = ["analyze", "execute"]
        self.assertEqual(
            authorize_action(
                authorization=draft_denied,
                action={"kind": "propose_candidate", "config": {"/devices/0/width": 3}},
                state={},
            )["code"],
            "action_not_allowed",
        )

    def test_optimization_metadata_tool_is_not_advertised_as_dispatchable(self) -> None:
        authorization = _authorization()
        authorization["tool_allowlist"] = ["get_draft"]
        verdict = authorize_action(
            authorization=authorization,
            action={"kind": "inspect", "tool_name": "get_draft", "arguments": {}},
            state={},
        )
        self.assertEqual(verdict["verdict"], "deny")
        self.assertEqual(verdict["code"], "tool_not_authorized")

    def test_authorize_action_order_and_candidate_guards(self) -> None:
        authorization = _authorization()
        self.assertEqual(authorize_action(authorization=authorization, action={"kind": "propose_candidate", "config": {"/devices/0/width": 2}}, state={})["code"], "step_misaligned")
        self.assertEqual(authorize_action(authorization=authorization, action={"kind": "propose_candidate", "config": {"/devices/0/height": 4}}, state={})["code"], "parameter_out_of_grant")
        protected = copy.deepcopy(authorization)
        protected["parameter_grants"] = [{"pointer": "/source_mode", "min": 0, "max": 1, "step": 1, "kind": "int"}]
        self.assertEqual(authorize_action(authorization=protected, action={"kind": "propose_candidate", "config": {"/source_mode": 1}}, state={})["code"], "protected_field")
        protected["parameter_grants"] = [{"pointer": "/resolved_fidelity", "min": 0, "max": 1, "step": 1, "kind": "int"}]
        self.assertEqual(authorize_action(authorization=protected, action={"kind": "propose_candidate", "config": {"/resolved_fidelity": 1}}, state={})["code"], "protected_field")
        exhausted = copy.deepcopy(authorization)
        exhausted["budget"]["max_runs"] = 1
        self.assertEqual(authorize_action(authorization=exhausted, action={"kind": "propose_candidate", "config": {"/devices/0/width": 3}}, state={"run_count": 1})["code"], "budget_exhausted")

    def test_autonomous_tool_payload_carries_snapshot_fence(self) -> None:
        import server

        authorization = _authorization()
        session = {**_session(), "authorization": authorization}
        with patch.object(server, "SCHEMA_SET_REVISION", SCHEMA_REVISION), patch.object(server, "harness_backend_identity", return_value=BACKEND):
            payload = server._optimization_authorized_tool_payload(
                session=session,
                authorization=authorization,
                tool_name="get_run_status",
                arguments={"run_id": "run-bound"},
                idempotency_key="tool-key",
            )
        self.assertEqual(payload["snapshot_digest"], _session()["input_snapshot_digest"])
        self.assertEqual(payload["principal"], "local-user")
        mismatched = {**session, "input_snapshot_digest": canonical_sha256({"scenario": "other"})}
        with patch.object(server, "SCHEMA_SET_REVISION", SCHEMA_REVISION), patch.object(server, "harness_backend_identity", return_value=BACKEND):
            with self.assertRaises(server.OptimizationError) as caught:
                server._optimization_authorized_tool_payload(
                    session=mismatched,
                    authorization=authorization,
                    tool_name="get_run_status",
                    arguments={"run_id": "run-bound"},
                    idempotency_key="tool-key",
                )
        self.assertEqual(caught.exception.code, "snapshot_mismatch")

    def test_duplicate_candidate_and_objective_mismatch_are_denied(self) -> None:
        authorization = _authorization()
        action = {"kind": "propose_candidate", "config": {"/devices/0/width": 3}, "metric_path": "/metrics/latency"}
        self.assertEqual(authorize_action(authorization=authorization, action=action, state={})["code"], "objective_mismatch")
        digest = canonical_sha256(action["config"])
        action["metric_path"] = "/metrics/throughput"
        self.assertEqual(authorize_action(authorization=authorization, action=action, state={"candidate_digests": [digest]})["code"], "duplicate_candidate")
        action["candidate_digest"] = "sha256:" + "f" * 64
        self.assertEqual(authorize_action(authorization=authorization, action=action, state={"candidate_digests": [digest]})["code"], "duplicate_candidate")

    def test_agent_loop_dispatches_only_after_allow_and_is_bounded(self) -> None:
        authorization = _authorization()
        tool_calls: list[dict] = []
        events: list[tuple[str, dict]] = []
        seen_tools: list[dict] = []

        def model_call(messages, tools, state):
            seen_tools.extend(tools)
            return {"kind": "inspect", "tool_name": "get_capability_catalog", "arguments": {}}

        def tool_dispatch(**kwargs):
            tool_calls.append(kwargs)
            return {"outcome": "succeeded", "result": {"available": True}}

        result = run_agent_turn(authorization=authorization, state={}, model_call=model_call, tool_dispatch=tool_dispatch, limits={"max_tool_calls_per_round": 2, "max_model_calls": 2}, emit=lambda kind, payload: events.append((kind, payload)))
        self.assertEqual(len(tool_calls), 2)
        self.assertEqual(len({item["idempotency_key"] for item in tool_calls}), 1)
        self.assertEqual(seen_tools[0]["type"], "function")
        self.assertEqual(seen_tools[0]["function"]["parameters"]["additionalProperties"], False)
        self.assertEqual(result["stop"], "tool_budget_exhausted")
        self.assertTrue(any(kind == "agent.tool_result" for kind, _ in events))

    def test_agent_loop_never_repairs_missing_signed_call_limits(self) -> None:
        authorization = _authorization()
        authorization["budget"].pop("max_tool_calls_per_round")
        authorization["authorization_digest"] = authorization_digest(authorization)
        calls: list[int] = []
        result = run_agent_turn(
            authorization=authorization,
            state={},
            model_call=lambda *_args, **_kwargs: calls.append(1),
            tool_dispatch=lambda *_args, **_kwargs: self.fail("invalid authorization must not dispatch"),
            limits={},
        )
        self.assertEqual(result["stop"], "authorization_invalid")
        self.assertEqual(calls, [])

    def test_agent_loop_limits_are_capped_by_signed_authorization(self) -> None:
        authorization = _authorization(budget={**_EXPLICIT_AGENT_BUDGET, "max_model_calls": 1, "max_tool_calls_per_round": 1})
        calls: list[int] = []
        result = run_agent_turn(
            authorization=authorization,
            state={},
            model_call=lambda *_args, **_kwargs: (calls.append(1) or {"kind": "inspect", "tool_name": "get_capability_catalog", "arguments": {}}),
            tool_dispatch=lambda *_args, **_kwargs: {"outcome": "succeeded"},
            limits={"max_model_calls": 60, "max_tool_calls_per_round": 4},
        )
        self.assertEqual(len(calls), 1)
        self.assertEqual(result["stop"], "tool_budget_exhausted")

    def test_security_tool_error_stops_before_another_model_call(self) -> None:
        authorization = _authorization()
        calls: list[int] = []

        class AuthorizationInactive(RuntimeError):
            code = "authorization_inactive"

        def model_call(messages, tools, state):
            calls.append(1)
            return {"kind": "inspect", "tool_name": "get_capability_catalog", "arguments": {}}

        def tool_dispatch(**kwargs):
            raise AuthorizationInactive("revoked while deciding")

        result = run_agent_turn(
            authorization=authorization,
            state={},
            model_call=model_call,
            tool_dispatch=tool_dispatch,
            limits={"max_tool_calls_per_round": 4, "max_model_calls": 4},
        )
        self.assertEqual(calls, [1])
        self.assertEqual(result["security_error"], "authorization_inactive")
        self.assertEqual(result["stop"], "authorization_revoked")
        self.assertEqual(result["decision"]["kind"], "stop")

    def test_decision_union_rejects_unknown_fields(self) -> None:
        authorization = _authorization()
        unknown_stop = authorize_action(
            authorization=authorization,
            action={"kind": "stop", "reason": "needs_human", "shell": True},
            state={},
        )
        self.assertEqual(unknown_stop["code"], "schema_violation")
        unknown_candidate = authorize_action(
            authorization=authorization,
            action={"kind": "propose_candidate", "config": {"/devices/0/width": 3}, "shell": True},
            state={},
        )
        self.assertEqual(unknown_candidate["code"], "schema_violation")

    def test_server_security_fence_does_not_enter_rule_fallback(self) -> None:
        import server

        authorization = _authorization()
        session = {
            **_session(),
            "authorization": authorization,
            "active_operation_id": "operation-1",
            "created_at": "2099-01-01T00:00:00+00:00",
        }
        candidate = {
            "candidate_id": "candidate-1",
            "candidate_digest": "sha256:" + "b" * 64,
            "config": {"/devices/0/width": 3},
        }
        with (
            patch.object(server.optimization_store, "get", return_value=session),
            patch.object(server.optimization_store, "candidates", return_value=[candidate]),
            patch.object(server.optimization_store, "record_agent_turn"),
            patch.object(server, "build_attempt_history", return_value={"entries": [], "history_digest": "sha256:" + "c" * 64, "truncated": False, "omitted_count": 0}),
            patch.object(server, "verify_authorization", return_value={"valid": True}),
            patch.object(server, "run_agent_turn", return_value={
                "decision": {"kind": "stop", "reason": "authorization_revoked", "security_error": "authorization_inactive"},
                "security_error": "authorization_inactive",
                "observations": [],
                "denials": 0,
                "stop": "authorization_revoked",
                "model_calls": 1,
            }),
            patch.object(server, "_optimization_next_candidate", side_effect=AssertionError("security failure must not use rule fallback")),
        ):
            next_candidate, stop_reason = server._optimization_agent_next_candidate(session, candidate, {"objective": {"value": 1}})
        self.assertIsNone(next_candidate)
        self.assertIsInstance(stop_reason, dict)
        self.assertIn("authorization/identity fence failed", stop_reason["detail"])

    def test_server_provider_error_uses_explicit_rule_fallback(self) -> None:
        import server

        authorization = _authorization()
        session = {
            **_session(),
            "authorization": authorization,
            "active_operation_id": "operation-1",
            "created_at": "2026-01-01T00:00:00+00:00",
        }
        candidate = {
            "candidate_id": "candidate-1",
            "candidate_digest": "sha256:" + "b" * 64,
            "config": {"/devices/0/width": 2},
        }
        fallback = {"candidate_id": "candidate-rule", "origin": "rule"}
        with (
            patch.object(server.optimization_store, "get", return_value=session),
            patch.object(server.optimization_store, "candidates", return_value=[candidate]),
            patch.object(server.optimization_store, "record_agent_turn") as record_turn,
            patch.object(server, "build_attempt_history", return_value={"entries": [], "history_digest": "sha256:" + "c" * 64, "truncated": False, "omitted_count": 0}),
            patch.object(server, "verify_authorization", return_value={"valid": True}),
            patch.object(server, "run_agent_turn", return_value={
                "decision": {"kind": "stop", "reason": "needs_human"},
                "observations": [{"kind": "model_error", "code": "provider_error"}],
                "denials": 0,
                "stop": "needs_human",
                "model_calls": 1,
            }),
            patch.object(server, "_optimization_next_candidate", return_value=(fallback, None)) as fallback_call,
        ):
            next_candidate, stop_reason = server._optimization_agent_next_candidate(session, candidate, {"objective": {"value": 1}})
        self.assertIs(next_candidate, fallback)
        self.assertIsNone(stop_reason)
        fallback_call.assert_called_once()
        receipt = record_turn.call_args.args[1]
        self.assertEqual(receipt["authorization_digest"], authorization["authorization_digest"])
        self.assertEqual(receipt["max_model_calls"], authorization["budget"]["max_model_calls"])
        self.assertEqual(receipt["max_tool_calls_per_round"], authorization["budget"]["max_tool_calls_per_round"])

    def test_server_model_duplicate_candidate_waits_for_user(self) -> None:
        """A duplicate model proposal must not become a completed session."""
        import server

        authorization = _authorization()
        session = {
            **_session(),
            "authorization": authorization,
            "active_operation_id": "operation-1",
            "created_at": "2099-01-01T00:00:00+00:00",
        }
        candidate = {
            "candidate_id": "candidate-1",
            "candidate_digest": "sha256:" + "b" * 64,
            "config": {"/devices/0/width": 3},
        }
        with (
            patch.object(server.optimization_store, "get", return_value=session),
            patch.object(server.optimization_store, "candidates", return_value=[candidate]),
            patch.object(server.optimization_store, "record_agent_turn"),
            patch.object(server, "build_attempt_history", return_value={"entries": [], "history_digest": "sha256:" + "c" * 64, "truncated": False, "omitted_count": 0}),
            patch.object(server, "verify_authorization", return_value={"valid": True}),
            patch.object(server, "run_agent_turn", return_value={
                "decision": {"kind": "propose_candidate", "config": {"/devices/0/width": 3}},
                "observations": [],
                "denials": 0,
                "stop": None,
                "model_calls": 1,
            }),
            patch.object(server, "_optimization_next_candidate", side_effect=AssertionError("duplicate model proposal must not enter fallback")),
        ):
            next_candidate, stop_reason = server._optimization_agent_next_candidate(
                session,
                candidate,
                {"objective": {"value": 1}},
            )
        self.assertIsNone(next_candidate)
        self.assertEqual(stop_reason["_wait_for_user"], True)
        self.assertEqual(stop_reason["code"], "duplicate_candidate")

    def test_server_rule_fallback_duplicate_waits_without_creating_candidate(self) -> None:
        import server

        session = {
            **_session(),
            "created_at": "2099-01-01T00:00:00+00:00",
            "budget": {"max_iterations": 5, "max_runs": 5, "max_seconds": 900, "max_failures": 2},
            "run_count": 0,
        }
        candidate = {"candidate_id": "candidate-current", "config": {"devices": [{"width": 3}]}}
        duplicate = {"candidate_id": "candidate-existing", "config": {"devices": [{"width": 4}]}}
        with (
            patch.object(server.optimization_store, "get", return_value=session),
            patch.object(server.optimization_store, "candidates", return_value=[candidate, duplicate]),
            patch.object(server, "_stage2_validate_payload", return_value=("valid", [], [], [], {}, [])),
        ):
            next_candidate, stop_reason = server._optimization_next_candidate(
                session,
                candidate,
                {"objective": {"direction": "maximize"}},
            )
        self.assertIsNone(next_candidate)
        self.assertEqual(stop_reason["_wait_for_user"], True)
        self.assertEqual(stop_reason["code"], "duplicate_candidate")

    def test_agent_loop_reports_cumulative_model_call_cursor(self) -> None:
        authorization = _authorization()
        decisions = iter((
            {"kind": "inspect", "tool_name": "get_capability_catalog", "arguments": {}},
            {"kind": "stop", "reason": "needs_human"},
        ))
        result = run_agent_turn(
            authorization=authorization,
            state={"model_calls": 1},
            model_call=lambda *_args, **_kwargs: next(decisions),
            tool_dispatch=lambda *args, **kwargs: {"outcome": "succeeded"},
            limits={"max_tool_calls_per_round": 2, "max_model_calls": 2},
        )
        self.assertEqual(result["model_calls"], 2)
        blocked = run_agent_turn(
            authorization=authorization,
            state={"model_calls": result["model_calls"]},
            model_call=lambda *_args, **_kwargs: self.fail("model budget must be durable across rounds"),
            tool_dispatch=lambda *args, **kwargs: self.fail("tool must not run after model budget"),
            limits={"max_tool_calls_per_round": 2, "max_model_calls": 2},
        )
        self.assertEqual(blocked["stop"], "model_call_limit")

    def test_provider_error_degrades_without_store_write(self) -> None:
        authorization = _authorization()
        events: list[str] = []
        result = run_agent_turn(authorization=authorization, state={}, model_call=lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("provider offline")), tool_dispatch=lambda *args, **kwargs: self.fail("tool must not run"), limits={"max_tool_calls_per_round": 4}, emit=lambda kind, _payload: events.append(kind))
        self.assertEqual(result["stop"], "needs_human")
        self.assertIn("agent.degraded", events)
        self.assertEqual(result["tool_calls_used"], 0)
        self.assertEqual(result["remaining_budget"]["model_calls"], authorization["budget"]["max_model_calls"] - 1)
        self.assertEqual(result["remaining_budget"]["tool_calls_per_round"], authorization["budget"]["max_tool_calls_per_round"])

    def test_usage_projection_is_present_on_authorization_error(self) -> None:
        authorization = _authorization()
        authorization["budget"].pop("max_tool_calls_per_round")
        authorization["authorization_digest"] = authorization_digest(authorization)
        result = run_agent_turn(
            authorization=authorization,
            state={},
            model_call=lambda *_args, **_kwargs: self.fail("invalid authorization must stop before model"),
            tool_dispatch=lambda *_args, **_kwargs: self.fail("invalid authorization must not dispatch"),
            limits={},
        )
        self.assertEqual(result["stop"], "authorization_invalid")
        self.assertEqual(result["tool_calls_used"], 0)
        self.assertIn("remaining_budget", result)
        self.assertIsNone(result["remaining_budget"])

    def test_usage_projection_counts_dispatched_tools_and_remaining_budget(self) -> None:
        authorization = _authorization(
            budget={
                "max_rounds": 5,
                "max_runs": 5,
                "max_seconds": 900,
                "max_failures": 2,
                "max_model_calls": 2,
                "max_tool_calls_per_round": 2,
                "max_navigation_attempts": 4,
                "max_run_creations": 1,
                "max_execution_time_ms": 900_000,
            }
        )
        result = run_agent_turn(
            authorization=authorization,
            state={},
            model_call=lambda *_args, **_kwargs: {"kind": "inspect", "tool_name": "get_capability_catalog", "arguments": {}},
            tool_dispatch=lambda *_args, **_kwargs: {"outcome": "succeeded"},
            limits={"max_model_calls": 2, "max_tool_calls_per_round": 2},
        )
        self.assertEqual(result["stop"], "tool_budget_exhausted")
        self.assertEqual(result["tool_calls_used"], 2)
        self.assertEqual(result["remaining_budget"]["model_calls"], 0)
        self.assertEqual(result["remaining_budget"]["tool_calls_per_round"], 0)

    def test_ask_user_is_a_bounded_interactive_decision(self) -> None:
        authorization = _authorization()
        events: list[tuple[str, dict]] = []
        result = run_agent_turn(
            authorization=authorization,
            state={},
            model_call=lambda *_args, **_kwargs: {"kind": "ask_user", "question": "请确认目标"},
            tool_dispatch=lambda *args, **kwargs: self.fail("ask_user must not dispatch a tool"),
            limits={"max_tool_calls_per_round": 4},
            emit=lambda kind, payload: events.append((kind, payload)),
        )
        self.assertEqual(result["decision"]["kind"], "ask_user")
        self.assertEqual(result["decision"]["question"], "请确认目标")
        self.assertEqual(result["stop"], "请确认目标")
        self.assertIn(("agent.step", {"kind": "ask_user", "reason": "请确认目标"}), events)

    def test_three_denials_emit_degraded_and_stop(self) -> None:
        authorization = _authorization()
        decisions = iter((
            {"kind": "propose_candidate", "config": {"/devices/0/width": 65}},
            {"kind": "propose_candidate", "config": {"/devices/0/width": 65}},
            {"kind": "propose_candidate", "config": {"/devices/0/width": 65}},
        ))
        events: list[str] = []
        result = run_agent_turn(authorization=authorization, state={}, model_call=lambda *_args, **_kwargs: next(decisions), tool_dispatch=lambda *args, **kwargs: None, limits={"max_tool_calls_per_round": 4}, emit=lambda kind, _payload: events.append(kind))
        self.assertEqual(result["stop"], "consecutive_denials")
        self.assertEqual(result["denials"], 3)
        self.assertIn("agent.degraded", events)

    def test_malformed_tool_arguments_are_schema_denials(self) -> None:
        authorization = _authorization()
        decisions = iter(
            (
                {
                    "kind": "stop",
                    "reason": "needs_human",
                    "parse_error": "invalid_tool_arguments",
                },
                {"kind": "propose_candidate", "config": {"/devices/0/width": 3}},
            )
        )
        dispatched: list[dict] = []
        events: list[tuple[str, dict]] = []
        result = run_agent_turn(
            authorization=authorization,
            state={},
            model_call=lambda *_args, **_kwargs: next(decisions),
            tool_dispatch=lambda *args, **kwargs: dispatched.append(kwargs),
            limits={"max_tool_calls_per_round": 4},
            emit=lambda kind, payload: events.append((kind, payload)),
        )
        self.assertEqual(result["decision"]["kind"], "propose_candidate")
        self.assertEqual(result["denials"], 1)
        self.assertEqual(dispatched, [])
        self.assertTrue(any(payload.get("code") == "schema_violation" for kind, payload in events if kind == "agent.verdict"))

    def test_messages_are_bounded_and_preserve_provenance(self) -> None:
        authorization = _authorization()
        messages = build_agent_messages(
            authorization=authorization,
            state={"run_count": 1, "current_candidate_config": {"secret": "must-not-appear"}},
            observations=["x" * 5000] * 10,
        )
        self.assertEqual(len(messages), 2)
        self.assertIn(PROVENANCE["source_mode"], messages[0]["content"])
        self.assertLessEqual(len(messages[1]["content"]), 6 * 1200 + 200)
        self.assertNotIn("must-not-appear", messages[1]["content"])
        self.assertNotIn("current_candidate_config", messages[1]["content"])

    def test_verified_observation_is_seeded_into_first_model_prompt(self) -> None:
        authorization = _authorization()
        captured: list[dict] = []

        def model_call(*, messages, tools, state):
            captured.extend(messages)
            return {"kind": "stop", "reason": "needs_human"}

        run_agent_turn(
            authorization=authorization,
            state={
                "run_id": "run-verified-1",
                "initial_observations": [{"kind": "verified_evaluation", "evidence": {"run_id": "run-verified-1"}}],
            },
            model_call=model_call,
            tool_dispatch=lambda *args, **kwargs: self.fail("stop must not dispatch"),
            limits={"max_tool_calls_per_round": 1},
        )
        self.assertIn("run-verified-1", captured[1]["content"])

    def test_attempt_history_is_bounded_and_does_not_copy_candidate_config(self) -> None:
        session = _session()
        candidate = {
            "candidate_id": "candidate-history-1",
            "session_id": session["session_id"],
            "principal": session["principal"],
            "workspace_id": session["workspace_id"],
            "snapshot_digest": session["input_snapshot_digest"],
            "schema_set_revision": session["schema_set_revision"],
            "backend_identity": session["backend_identity"],
            "candidate_digest": canonical_sha256({"candidate": 1}),
            "sequence": 0,
            "config": {"/devices/0/width": 17, "/credentials/api_key": "must-not-appear"},
            "diff": {"changed_fields": ["/devices/0/width", "/credentials/api_key"]},
            "status": "completed",
        }
        evaluation = {
            "session_id": session["session_id"],
            "candidate_id": candidate["candidate_id"],
            "objective": {"metric_path": "/metrics/throughput", "value": 12.5, "unit": "requests/s", "status": "verified"},
            "evidence": [{"run_id": "run-history-1", "manifest_digest": "sha256:" + "b" * 64, "json_pointer": "/metrics/throughput", "tool_output_digest": "sha256:" + "c" * 64}],
        }
        history = build_attempt_history(session=session, candidates=[candidate], evaluations=[evaluation])
        self.assertEqual(history["entries"][0]["metric"]["unit"], "requests/s")
        self.assertEqual(history["entries"][0]["changes"][0]["path"], "/devices/0/width")
        self.assertNotIn("must-not-appear", json.dumps(history, ensure_ascii=False))
        messages = build_agent_messages(authorization=_authorization(), state={"attempt_history": history["entries"], "attempt_history_digest": history["history_digest"]}, observations=[])
        self.assertNotIn("must-not-appear", messages[1]["content"])
        self.assertNotIn('"config"', messages[1]["content"])

    def test_attempt_history_identity_and_invalid_evidence_fail_closed(self) -> None:
        session = _session()
        candidate = {
            "candidate_id": "candidate-history-2", "session_id": session["session_id"],
            "principal": session["principal"], "workspace_id": session["workspace_id"],
            "snapshot_digest": session["input_snapshot_digest"], "schema_set_revision": session["schema_set_revision"],
            "backend_identity": session["backend_identity"], "candidate_digest": "sha256:" + "d" * 64,
            "sequence": 1, "config": {"/devices/0/width": 19}, "status": "failed",
        }
        with self.assertRaisesRegex(OptimizationError, "another session"):
            build_attempt_history(session=session, candidates=[{**candidate, "session_id": "other-session"}], evaluations=[])
        with self.assertRaisesRegex(OptimizationError, "evidence"):
            build_attempt_history(session=session, candidates=[candidate], evaluations=[{"session_id": session["session_id"], "candidate_id": candidate["candidate_id"], "objective": {"metric_path": "/metrics/throughput"}, "evidence": [{"run_id": "run-only"}]}])

    def test_attempt_history_rejects_invalid_objective_or_metric(self) -> None:
        session = _session()
        candidate = {
            "candidate_id": "candidate-history-invalid-objective",
            "session_id": session["session_id"],
            "principal": session["principal"],
            "workspace_id": session["workspace_id"],
            "snapshot_digest": session["input_snapshot_digest"],
            "schema_set_revision": session["schema_set_revision"],
            "backend_identity": session["backend_identity"],
            "candidate_digest": "sha256:" + "e" * 64,
            "sequence": 0,
            "config": {"/devices/0/width": 2},
            "status": "completed",
        }
        with self.assertRaisesRegex(OptimizationError, "objective"):
            build_attempt_history(session={**session, "objective": {"direction": "maximize"}}, candidates=[candidate], evaluations=[])
        with self.assertRaisesRegex(OptimizationError, "metric value"):
            build_attempt_history(
                session=session,
                candidates=[candidate],
                evaluations=[
                    {
                        "session_id": session["session_id"],
                        "candidate_id": candidate["candidate_id"],
                        "objective": {"metric_path": "/metrics/throughput", "value": float("nan")},
                    }
                ],
            )

    def test_attempt_history_truncation_is_deterministic(self) -> None:
        session = _session()
        candidates = []
        for index in range(4):
            candidates.append({
                "candidate_id": f"candidate-history-{index}", "session_id": session["session_id"],
                "principal": session["principal"], "workspace_id": session["workspace_id"],
                "snapshot_digest": session["input_snapshot_digest"], "schema_set_revision": session["schema_set_revision"],
                "backend_identity": session["backend_identity"], "candidate_digest": "sha256:" + format(index + 10, "064x"),
                "sequence": index, "config": {"/devices/0/width": index + 1}, "status": "failed",
            })
        first = build_attempt_history(session=session, candidates=candidates, evaluations=[], max_entries=2, max_total_chars=10000)
        second = build_attempt_history(session=session, candidates=list(reversed(candidates)), evaluations=[], max_entries=2, max_total_chars=10000)
        self.assertTrue(first["truncated"])
        self.assertEqual(first, second)
        self.assertEqual(first["omitted_count"], 2)

    def test_attempt_history_budget_covers_scope_and_digest(self) -> None:
        session = _session()
        with self.assertRaisesRegex(OptimizationError, "scope"):
            build_attempt_history(session=session, candidates=[], evaluations=[], max_total_chars=100)


if __name__ == "__main__":
    unittest.main()
