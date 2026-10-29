"""Pure safety tests for the optional single-agent orchestration adapter."""

from __future__ import annotations

import unittest
from copy import deepcopy

from services.agent_orchestrator import (
    LangGraphCheckpointerRequired,
    LangGraphDependencyUnavailable,
    binding_matches,
    build_langgraph_graph,
    langgraph_runtime_status,
    new_state,
    execute_navigation_cycle,
    _validate_navigation_history,
    page_directory,
    resume,
    run_until_pause,
    select_navigation_target,
)


ARTIFACT = {
    "artifact_id": "metrics",
    "schema_identity": "tilesim.metrics.v1",
    "sha256": "a" * 64,
    "bytes": 12,
}


def report_context(**overrides):
    context = {
        "session_id": "session-1",
        "flow_id": "flow-test",
        "run_id": "run-1",
        "run_context_revision": "context-1",
        "backend_identity": {"backend_id": "bridge", "revision": "b"},
        "schema_set_revision": "sha256:" + "c" * 64,
        "input_snapshot_digest": "sha256:" + "9" * 64,
        "artifact_bindings": [ARTIFACT],
        "evidence_status": "validated",
        "validation": {"status": "valid"},
    }
    context.update(overrides)
    return context


def state_binding(state):
    return {
        field: state.get(field)
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
    }


class AgentOrchestratorTests(unittest.TestCase):
    def test_navigation_history_rejects_unknown_or_unauthorized_pages_without_repairing_it(self):
        self.assertEqual(
            _validate_navigation_history(["metrics", "not-a-page"], ["metrics", "fabric"]),
            "visited_page_not_published",
        )
        self.assertEqual(
            _validate_navigation_history(["metrics", "metrics"], ["metrics", "fabric"]),
            "visited_pages_duplicate",
        )
        self.assertEqual(
            _validate_navigation_history(["metrics"], ["fabric"]),
            "visited_page_not_authorized",
        )

    def test_navigation_cycle_rejects_unknown_allowlist_entries_and_extra_actions(self):
        base = new_state(
            session_id="session-1",
            user_goal="查看指标",
            context={
                "allowed_pages": ["metrics", "fabric"],
                "allowed_actions": ["navigate"],
                "max_navigation_attempts": 2,
            },
        )
        unknown_page = execute_navigation_cycle(
            base,
            ["metrics"],
            allowed_pages=["metrics", "deleted-page"],
            navigate=lambda page: self.fail("invalid allowlist must not navigate"),
            read_context=lambda: self.fail("invalid allowlist must not read context"),
        )
        self.assertEqual(unknown_page["state"]["terminal_reason"], "navigation_allowlist_invalid")

        extra_action_state = deepcopy(base)
        extra_action_state["allowed_actions"] = ["navigate", "execute"]
        extra_action = execute_navigation_cycle(
            extra_action_state,
            ["metrics"],
            navigate=lambda page: self.fail("extra action grant must not navigate"),
            read_context=lambda: self.fail("extra action grant must not read context"),
        )
        self.assertEqual(extra_action["state"]["terminal_reason"], "navigation_action_not_authorized")

    def test_navigation_cycle_fails_closed_on_corrupt_history(self):
        state = new_state(
            session_id="session-1",
            user_goal="查看指标",
            context={
                "allowed_pages": ["metrics", "fabric"],
                "allowed_actions": ["navigate"],
                "max_navigation_attempts": 2,
                "visited_pages": ["metrics", "deleted-page"],
            },
        )
        # new_state is intentionally a bounded constructor; simulate a
        # corrupted durable checkpoint after construction so execute_navigation
        # must reject it instead of filtering the unknown entry.
        state["visited_pages"] = ["metrics", "deleted-page"]
        result = execute_navigation_cycle(
            state,
            ["metrics", "fabric"],
            navigate=lambda page: self.fail("corrupt history must not navigate"),
            read_context=lambda: self.fail("corrupt history must not read context"),
        )
        self.assertEqual(result["state"]["graph_status"], "refused")
        self.assertEqual(result["state"]["terminal_reason"], "navigation_history_invalid")
        self.assertEqual(result["state"]["visited_pages"], ["metrics", "deleted-page"])

    def test_navigation_target_is_closed_and_never_repeats_visited_pages(self):
        self.assertIn({"page_id": "metrics", "route_name": "metrics", "capabilities": ["metrics", "run_bound"]}, page_directory())
        self.assertEqual(
            select_navigation_target(
                [{"page_id": "not-a-page"}, {"page_id": "metrics"}, {"page_id": "fabric"}],
                allowed_pages=["metrics", "fabric"],
                visited_pages=["metrics"],
            ),
            "fabric",
        )
        self.assertIsNone(select_navigation_target(["https://evil.example", "router.push"], allowed_pages=["overview"]))

    def test_navigation_failure_replans_to_another_authorized_candidate(self):
        state = new_state(
            session_id="session-1",
            user_goal="查看指标",
            context={
                "run_id": "run-1",
                "run_context_revision": "context-1",
                "allowed_pages": ["metrics", "fabric"],
                "allowed_actions": ["navigate"],
                "max_navigation_attempts": 2,
            },
        )
        attempts = []
        observations = iter(
            [
                {"page_id": "overview", "run_id": "run-1", "context_revision": "context-1", "capabilities": []},
                {"page_id": "fabric", "run_id": "run-1", "context_revision": "context-1", "capabilities": ["fabric"]},
            ]
        )

        def navigate(page):
            attempts.append(page)
            if page == "metrics":
                raise RuntimeError("fixture navigation failure")

        result = execute_navigation_cycle(
            state,
            ["metrics", "fabric"],
            navigate=navigate,
            read_context=lambda: next(observations),
        )
        self.assertEqual(attempts, ["metrics", "fabric"])
        self.assertEqual(result["state"]["current_page"], "fabric")
        self.assertTrue(result["state"]["last_navigation_observation"]["page_correct"])
        self.assertEqual(result["state"]["last_navigation_observation"]["visited_pages"], ["metrics", "fabric"])
        self.assertEqual(result["state"]["last_navigation_observation"]["navigation_attempts"], 2)
        self.assertEqual(result["state"]["navigation_attempts"], 2)
        self.assertEqual(result["state"]["visited_pages"], ["metrics", "fabric"])

    def test_navigation_budget_exhaustion_and_no_safe_candidate_wait_for_user(self):
        state = new_state(
            session_id="session-1",
            user_goal="查看页面",
            context={"allowed_pages": ["metrics", "fabric"], "allowed_actions": ["navigate"], "max_navigation_attempts": 1},
        )
        attempts = []
        result = execute_navigation_cycle(
            state,
            ["metrics", "fabric"],
            navigate=lambda page: attempts.append(page),
            read_context=lambda: {"page_id": "overview", "capabilities": []},
        )
        self.assertEqual(result["state"]["graph_status"], "waiting_user")
        self.assertEqual(result["state"]["terminal_reason"], "navigation_budget_exhausted")
        self.assertEqual(attempts, ["metrics"])
        state_without_candidate = {**state, "visited_pages": ["metrics"]}
        result = execute_navigation_cycle(
            state_without_candidate,
            ["metrics"],
            navigate=lambda page: self.fail("no navigation expected"),
            read_context=lambda: {},
            allowed_pages=["metrics"],
            max_attempts=1,
        )
        self.assertEqual(result["state"]["terminal_reason"], "navigation_no_safe_candidate")

    def test_navigation_context_identity_change_is_stale(self):
        state = new_state(
            session_id="session-1",
            user_goal="查看指标",
            context={
                "run_id": "run-1",
                "run_context_revision": "context-1",
                "allowed_pages": ["metrics"],
                "allowed_actions": ["navigate"],
                "max_navigation_attempts": 2,
            },
        )
        result = execute_navigation_cycle(
            state,
            ["metrics"],
            navigate=lambda page: None,
            read_context=lambda: {"page_id": "metrics", "run_id": "run-2", "context_revision": "context-2", "capabilities": ["metrics"]},
        )
        self.assertEqual(result["state"]["graph_status"], "stale")
        self.assertEqual(result["state"]["terminal_reason"], "run_binding_changed_during_navigation")

    def _langgraph_runtime(self):
        """Load the optional backend without making stdlib Bridge tests fail."""

        if not langgraph_runtime_status()["available"]:
            self.skipTest("LangGraph optional test dependency is not installed")
        from langgraph.checkpoint.memory import InMemorySaver
        from langgraph.types import Command

        return InMemorySaver, Command

    def test_report_interrupts_and_resumes_only_after_confirmation(self):
        state = new_state(
            session_id="session-1",
            user_goal="生成结果解读报告",
            context=report_context(intent="generate_user_run_report"),
        )
        paused = run_until_pause(state)["state"]
        self.assertEqual(paused["graph_status"], "waiting_user")
        self.assertEqual(paused["pending_user_action"], "confirm_report")
        self.assertEqual(paused["report_status"], "not_started")

        completed = resume(paused, "confirm_report", current_binding=report_context())["state"]
        self.assertEqual(completed["graph_status"], "completed")
        self.assertEqual(completed["report_status"], "ready")
        self.assertEqual(completed["terminal_reason"], "read_only_result_ready")

    def test_cancel_and_refuse_have_explicit_terminal_states(self):
        state = new_state(
            session_id="session-1",
            user_goal="导出结果报告",
            context=report_context(intent="generate_user_run_report"),
        )
        paused = run_until_pause(state)["state"]
        binding = report_context()
        self.assertEqual(resume(paused, "cancel", current_binding=binding)["state"]["graph_status"], "cancelled")
        self.assertEqual(resume(paused, "reject", current_binding=binding)["state"]["graph_status"], "refused")

    def test_direct_resume_requires_binding_for_cancel_reject_and_confirmation(self):
        state = new_state(
            session_id="session-1",
            user_goal="生成结果解读报告",
            context=report_context(intent="generate_user_run_report"),
        )
        paused = run_until_pause(state)["state"]
        for action in ("cancel", "reject", "confirm_report"):
            with self.subTest(action=action):
                result = resume(paused, action)["state"]
                self.assertEqual(result["graph_status"], "waiting_user")
                self.assertEqual(result["pending_user_action"], "confirm_report")
                self.assertEqual(result["last_event"]["reason"], "binding_required")
                self.assertEqual(result["report_status"], "not_started")

    def test_cross_pending_action_keeps_published_waiting_state(self):
        paused = run_until_pause(
            new_state(
                session_id="session-1",
                user_goal="准备配置草案",
                context={"intent": "configure_experiment_draft", **report_context(run_id=None, run_context_revision=None)},
            )
        )["state"]
        self.assertEqual(paused["pending_user_action"], "confirm_draft")
        result = resume(paused, "clarify_intent", current_binding=state_binding(paused), intent="explain_current_page")["state"]
        self.assertEqual(result["graph_status"], "waiting_user")
        self.assertEqual(result["pending_user_action"], "confirm_draft")
        self.assertEqual(result["last_event"]["reason"], "wrong_pending_action")

    def test_direct_clarification_resume_requires_binding(self):
        paused = run_until_pause(new_state(session_id="session-1", user_goal="帮我看看"))["state"]
        result = resume(paused, "clarify_intent", intent="explain_current_page")["state"]
        self.assertEqual(result["graph_status"], "waiting_user")
        self.assertEqual(result["pending_user_action"], "clarify_intent")
        self.assertEqual(result["last_event"]["reason"], "binding_required")

    def test_missing_binding_never_invents_unpublished_pending_action(self):
        paused = run_until_pause(
            new_state(
                session_id="session-1",
                user_goal="生成结果解读报告",
                context=report_context(intent="generate_user_run_report"),
            )
        )["state"]
        paused["pending_user_action"] = "not-published"
        result = resume(paused, "confirm_report")["state"]
        self.assertIsNone(result["pending_user_action"])

    def test_stale_binding_blocks_resume_without_side_effect(self):
        state = new_state(
            session_id="session-1",
            user_goal="生成结果解读报告",
            context=report_context(intent="generate_user_run_report"),
        )
        paused = run_until_pause(state)["state"]
        changed = report_context(run_id="run-2")
        result = resume(paused, "confirm_report", current_binding=changed)["state"]
        self.assertEqual(result["graph_status"], "stale")
        self.assertEqual(result["terminal_reason"], "binding_changed_before_resume")
        self.assertEqual(result["report_status"], "not_started")

    def test_rejected_artifact_validation_is_fail_closed_before_approval(self):
        state = new_state(
            session_id="session-1",
            user_goal="分析当前结果",
            context=report_context(intent="analyze_existing_run", validation={"status": "artifact_mismatch", "reason": "artifact_sha_mismatch"}),
        )
        result = run_until_pause(state)["state"]
        self.assertEqual(result["graph_status"], "refused")
        self.assertEqual(result["terminal_reason"], "evidence_validation_rejected")

    def test_unsupported_schema_is_refused_before_approval(self):
        state = new_state(
            session_id="session-1",
            user_goal="分析当前结果",
            context=report_context(intent="analyze_existing_run", validation={"status": "unsupported_schema"}),
        )
        result = run_until_pause(state)["state"]
        self.assertEqual(result["graph_status"], "refused")
        self.assertEqual(result["terminal_reason"], "unsupported_schema")

    def test_provider_unavailable_uses_deterministic_fallback(self):
        state = new_state(
            session_id="session-1",
            user_goal="分析当前结果",
            context=report_context(intent="analyze_existing_run", evidence_status="provider_unavailable"),
        )
        result = run_until_pause(state)["state"]
        self.assertEqual(result["graph_status"], "completed")
        self.assertEqual(result["evidence_status"], "deterministic_fallback")

    def test_partial_and_truncated_evidence_stays_explicitly_limited(self):
        for evidence_status in ("partial", "truncated"):
            with self.subTest(evidence_status=evidence_status):
                state = new_state(
                    session_id="session-1",
                    user_goal="生成结果解读报告",
                    context=report_context(
                        intent="generate_user_run_report",
                        evidence_status=evidence_status,
                    ),
                )
                paused = run_until_pause(state)["state"]
                self.assertEqual(paused["graph_status"], "waiting_user")
                self.assertEqual(paused["report_status"], "ready_with_limitations")
                completed = resume(paused, "confirm_report", current_binding=report_context(**{"evidence_status": evidence_status}))["state"]
                self.assertEqual(completed["graph_status"], "completed")
                self.assertEqual(completed["report_status"], "ready_with_limitations")

    def test_artifact_bytes_accepts_lossless_decimal_string_only(self):
        valid = report_context(artifact_bindings=[{**ARTIFACT, "bytes": "18446744073709551615"}])
        paused = run_until_pause(
            new_state(
                session_id="session-1",
                user_goal="生成结果解读报告",
                context=report_context(
                    intent="generate_user_run_report",
                    artifact_bindings=valid["artifact_bindings"],
                ),
            )
        )["state"]
        self.assertEqual(paused["graph_status"], "waiting_user")

        for invalid_bytes in ("01", "-1", "1.0", "", -1, 1.0, None):
            with self.subTest(invalid_bytes=invalid_bytes):
                result = run_until_pause(
                    new_state(
                        session_id="session-1",
                        user_goal="生成结果解读报告",
                        context=report_context(
                            intent="generate_user_run_report",
                            artifact_bindings=[{**ARTIFACT, "bytes": invalid_bytes}],
                        ),
                    )
                )["state"]
                self.assertEqual(result["graph_status"], "refused")
                self.assertEqual(result["terminal_reason"], "artifact_identity_missing")

    def test_unsupported_execution_never_reaches_confirmation(self):
        state = new_state(
            session_id="session-1",
            user_goal="创建运行并执行实验",
            context=report_context(intent="unsupported_execution_request"),
        )
        result = run_until_pause(state)["state"]
        self.assertEqual(result["graph_status"], "refused")
        self.assertEqual(result["terminal_reason"], "execution_not_supported_read_only")

    def test_unsupported_execution_stays_refused_even_with_authorization(self):
        state = new_state(
            session_id="session-1",
            user_goal="创建运行并执行实验",
            context=report_context(
                intent="unsupported_execution_request",
                authorization_digest="sha256:" + "a" * 64,
            ),
        )
        result = run_until_pause(state)["state"]
        self.assertEqual(result["graph_status"], "refused")
        self.assertEqual(result["terminal_reason"], "execution_not_supported_read_only")

    def test_draft_is_confirmed_without_execution(self):
        state = new_state(
            session_id="session-1",
            user_goal="配置实验草案",
            context={"intent": "configure_experiment_draft"},
        )
        paused = run_until_pause(state)["state"]
        completed = resume(paused, "confirm_draft", current_binding=state_binding(paused))["state"]
        self.assertEqual(completed["graph_status"], "draft_ready")
        self.assertEqual(completed["terminal_reason"], "draft_ready_no_execution")
        self.assertEqual(completed["report_status"], "not_applicable")

    def test_binding_compares_all_resume_identities(self):
        state = new_state(session_id="session-1", user_goal="x", context=report_context())
        self.assertTrue(binding_matches(state, report_context()))
        for field, value in (("session_id", "session-2"), ("flow_id", "flow-other")):
            changed = report_context(**{field: value})
            self.assertFalse(binding_matches(state, changed), field)
        for field, value in (
            ("run_context_revision", "context-2"),
            ("schema_set_revision", "sha256:" + "d" * 64),
            ("input_snapshot_digest", "sha256:" + "e" * 64),
            ("artifact_bindings", [{**ARTIFACT, "bytes": 13}]),
        ):
            changed = report_context(**{field: value})
            self.assertFalse(binding_matches(state, changed), field)

    def test_unknown_intent_waits_for_clarification(self):
        state = new_state(session_id="s", user_goal="帮我看看")
        result = run_until_pause(state)["state"]
        self.assertEqual(result["graph_status"], "waiting_user")
        self.assertEqual(result["pending_user_action"], "clarify_intent")

    def test_unknown_intent_never_uses_keyword_fallback(self):
        # A model-classification failure must not be converted into an
        # execution/report/configuration route by the deterministic graph.
        for goal in ("创建运行并执行实验", "生成结果报告", "配置一个草案", "说明当前页面"):
            with self.subTest(goal=goal):
                state = new_state(session_id="s", user_goal=goal)
                result = run_until_pause(state)["state"]
                self.assertEqual(result["graph_status"], "waiting_user")
                self.assertEqual(result["pending_user_action"], "clarify_intent")
                self.assertEqual(result["intent"], "")

    def test_transition_engine_has_no_run_or_configuration_side_effect(self):
        state = new_state(session_id="s", user_goal="说明当前页面")
        before = deepcopy(state)
        result = run_until_pause(state)["state"]
        self.assertEqual(state, before)
        self.assertNotIn("create_run_request", result)
        self.assertNotIn("configuration_patch", result)
        self.assertIsNone(result.get("run_id"))

    def test_langgraph_dependency_is_explicitly_fail_closed(self):
        status = langgraph_runtime_status()
        if status["available"]:
            with self.assertRaises(LangGraphCheckpointerRequired):
                build_langgraph_graph()
        else:
            with self.assertRaises(LangGraphDependencyUnavailable):
                build_langgraph_graph()

    def test_real_langgraph_interrupt_and_confirm_report(self):
        InMemorySaver, Command = self._langgraph_runtime()
        context = report_context(intent="generate_user_run_report")
        graph = build_langgraph_graph(checkpointer=InMemorySaver())
        config = {"configurable": {"thread_id": "langgraph-report-confirm"}}

        paused = graph.invoke(
            new_state(session_id="session-1", user_goal="生成结果解读报告", context=context),
            config,
        )
        self.assertIn("__interrupt__", paused)
        self.assertEqual(paused["graph_status"], "running")
        snapshot = graph.get_state(config)
        self.assertEqual(snapshot.next, ("await_user_confirmation",))
        self.assertEqual(snapshot.tasks[0].interrupts[0].value["pending_user_action"], "confirm_report")

        completed = graph.invoke(
            Command(resume={"action": "confirm_report", "current_binding": context}),
            config,
        )
        self.assertNotIn("__interrupt__", completed)
        self.assertEqual(completed["graph_status"], "completed")
        self.assertEqual(completed["report_status"], "ready")
        self.assertEqual(completed["terminal_reason"], "read_only_result_ready")

    def test_real_langgraph_cancel_and_refuse_are_terminal(self):
        InMemorySaver, Command = self._langgraph_runtime()
        for action, expected_status, expected_reason in (
            ("cancel", "cancelled", "user_cancelled"),
            ("reject", "refused", "user_refused"),
        ):
            with self.subTest(action=action):
                context = report_context(intent="generate_user_run_report")
                graph = build_langgraph_graph(checkpointer=InMemorySaver())
                config = {"configurable": {"thread_id": f"langgraph-{action}"}}
                graph.invoke(
                    new_state(session_id="session-1", user_goal="导出结果报告", context=context),
                    config,
                )
                result = graph.invoke(Command(resume={"action": action, "current_binding": context}), config)
                self.assertEqual(result["graph_status"], expected_status)
                self.assertEqual(result["terminal_reason"], expected_reason)
                self.assertEqual(result["report_status"], "not_started")

    def test_real_langgraph_stale_binding_is_fail_closed(self):
        InMemorySaver, Command = self._langgraph_runtime()
        context = report_context(intent="generate_user_run_report")
        graph = build_langgraph_graph(checkpointer=InMemorySaver())
        config = {"configurable": {"thread_id": "langgraph-stale"}}
        graph.invoke(
            new_state(session_id="session-1", user_goal="生成结果解读报告", context=context),
            config,
        )
        changed = report_context(run_context_revision="context-2")
        result = graph.invoke(
            Command(resume={"action": "confirm_report", "current_binding": changed}),
            config,
        )
        self.assertEqual(result["graph_status"], "stale")
        self.assertEqual(result["terminal_reason"], "binding_changed_before_resume")
        self.assertEqual(result["report_status"], "not_started")

    def test_real_langgraph_preserves_clarification_pause_and_resume_contract(self):
        InMemorySaver, Command = self._langgraph_runtime()
        graph = build_langgraph_graph(checkpointer=InMemorySaver())
        config = {"configurable": {"thread_id": "langgraph-clarify"}}
        paused = graph.invoke(
            new_state(session_id="session-1", user_goal="帮我看看"),
            config,
        )
        self.assertIn("__interrupt__", paused)
        self.assertEqual(paused["graph_status"], "running")
        snapshot = graph.get_state(config)
        self.assertEqual(snapshot.next, ("clarify_if_needed",))
        self.assertEqual(snapshot.tasks[0].interrupts[0].value["pending_user_action"], "clarify_intent")
        result = graph.invoke(
            Command(
                resume={
                    "action": "clarify_intent",
                    "intent": "explain_current_page",
                    "current_binding": state_binding(snapshot.values),
                }
            ),
            config,
        )
        self.assertNotIn("__interrupt__", result)
        self.assertEqual(result["graph_status"], "completed")
        self.assertEqual(result["intent"], "explain_current_page")
        self.assertEqual(result["terminal_reason"], "read_only_result_ready")

    def test_real_langgraph_invalid_clarification_keeps_interrupt_for_retry(self):
        InMemorySaver, Command = self._langgraph_runtime()
        graph = build_langgraph_graph(checkpointer=InMemorySaver())
        config = {"configurable": {"thread_id": "langgraph-clarify-retry"}}
        graph.invoke(new_state(session_id="session-1", user_goal="帮我看看"), config)

        snapshot = graph.get_state(config)
        invalid = graph.invoke(
            Command(
                resume={
                    "action": "clarify_intent",
                    "intent": "not-supported",
                    "current_binding": state_binding(snapshot.values),
                }
            ),
            config,
        )
        self.assertIn("__interrupt__", invalid)
        # LangGraph persists the state from immediately before the node is
        # re-entered; the interrupt payload, rather than a returned state,
        # carries the durable waiting action during this retry.
        self.assertEqual(invalid["graph_status"], "running")
        self.assertEqual(graph.get_state(config).next, ("clarify_if_needed",))

        valid = graph.invoke(
            Command(
                resume={
                    "action": "clarify_intent",
                    "intent": "explain_current_page",
                    "current_binding": state_binding(graph.get_state(config).values),
                }
            ),
            config,
        )
        self.assertNotIn("__interrupt__", valid)
        self.assertEqual(valid["graph_status"], "completed")
        self.assertEqual(valid["intent"], "explain_current_page")

    def test_real_langgraph_missing_binding_keeps_interrupt_for_retry(self):
        InMemorySaver, Command = self._langgraph_runtime()
        graph = build_langgraph_graph(checkpointer=InMemorySaver())
        config = {"configurable": {"thread_id": "langgraph-binding-required"}}
        graph.invoke(new_state(session_id="session-1", user_goal="帮我看看"), config)

        missing = graph.invoke(
            Command(resume={"action": "clarify_intent", "intent": "explain_current_page"}),
            config,
        )
        self.assertIn("__interrupt__", missing)
        self.assertEqual(graph.get_state(config).next, ("clarify_if_needed",))

    def test_real_langgraph_wrong_confirmation_action_keeps_interrupt_for_retry(self):
        InMemorySaver, Command = self._langgraph_runtime()
        context = report_context(intent="generate_user_run_report")
        graph = build_langgraph_graph(checkpointer=InMemorySaver())
        config = {"configurable": {"thread_id": "langgraph-confirm-retry"}}
        graph.invoke(new_state(session_id="session-1", user_goal="生成结果解读报告", context=context), config)

        invalid = graph.invoke(Command(resume={"action": "confirm_draft", "current_binding": context}), config)
        self.assertIn("__interrupt__", invalid)
        self.assertEqual(invalid["graph_status"], "running")
        self.assertEqual(graph.get_state(config).next, ("await_user_confirmation",))

        valid = graph.invoke(
            Command(resume={"action": "confirm_report", "current_binding": context}),
            config,
        )
        self.assertNotIn("__interrupt__", valid)
        self.assertEqual(valid["graph_status"], "completed")
        self.assertEqual(valid["report_status"], "ready")


if __name__ == "__main__":
    unittest.main()
