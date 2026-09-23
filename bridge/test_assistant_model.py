"""Unit tests for :mod:`providers.assistant_model`.

Run from the ``bridge`` directory: ``python -m unittest test_assistant_model``.
No test here opens a socket: every provider reply is injected through the ``transport`` hook.
"""

from __future__ import annotations

import json
import os
import unittest

from contracts.experiment_descriptor import PARAMETER_DEFINITIONS
from providers import assistant_model


ENVIRONMENT = {
    "TILESIM_ASSISTANT_BASE_URL": "https://ai-pixel.online",
    "TILESIM_ASSISTANT_API_KEY": "unit-test-credential",
    "TILESIM_ASSISTANT_MODEL": "deepseek-v4-flash",
    "TILESIM_ASSISTANT_TIMEOUT_MS": "120000",
}
REASONING_SENTINEL = "hidden-reasoning-sentinel-must-never-be-returned"


def build_reply(content: str, *, reasoning: str | None = None, model: str = "deepseek-v4-flash") -> dict:
    message: dict = {"role": "assistant", "content": content}
    if reasoning is not None:
        message["reasoning_content"] = reasoning
    return {
        "id": "chatcmpl-unit-test",
        "model": model,
        "choices": [{"index": 0, "finish_reason": "stop", "message": message}],
    }


def plan_document(settings: list[dict], *, title: str = "方案", rationale: str = "理由") -> str:
    return json.dumps({"title": title, "rationale": rationale, "settings": settings}, ensure_ascii=False)


class AssistantModelEnvironmentTest(unittest.TestCase):
    """Configuration, endpoint normalization and the public descriptor."""

    def setUp(self) -> None:
        self.saved = {name: os.environ.pop(name, None) for name in ENVIRONMENT}

    def tearDown(self) -> None:
        for name, value in self.saved.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value

    def configure(self, **overrides: str) -> None:
        merged = dict(ENVIRONMENT)
        merged.update(overrides)
        for name, value in merged.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value

    def test_channel_is_unconfigured_without_environment(self) -> None:
        self.assertIsNone(assistant_model.config_from_environment())
        descriptor = assistant_model.build_descriptor()
        self.assertEqual(descriptor["availability"], "unavailable")
        self.assertFalse(descriptor["configured"])
        self.assertEqual(descriptor["degradation_state"], "not_configured")
        self.assertEqual(descriptor["provider"]["provider_id"], "not_configured")

    def test_partial_configuration_is_reported_as_misconfigured(self) -> None:
        self.configure(TILESIM_ASSISTANT_API_KEY=None)
        with self.assertRaises(assistant_model.ProviderUnavailableError):
            assistant_model.config_from_environment()
        descriptor = assistant_model.build_descriptor()
        self.assertEqual(descriptor["degradation_state"], "misconfigured")
        self.assertEqual(descriptor["availability"], "unavailable")

    def test_base_url_is_normalized_to_one_chat_completions_endpoint(self) -> None:
        for candidate in ("https://ai-pixel.online", "https://ai-pixel.online/", "https://ai-pixel.online/v1"):
            self.configure(TILESIM_ASSISTANT_BASE_URL=candidate)
            config = assistant_model.config_from_environment()
            self.assertIsNotNone(config)
            self.assertEqual(config.endpoint, "https://ai-pixel.online/v1/chat/completions")
        self.configure(TILESIM_ASSISTANT_BASE_URL="https://ai-pixel.online/v1/chat/completions")
        config = assistant_model.config_from_environment()
        self.assertIsNotNone(config)
        self.assertEqual(config.endpoint, "https://ai-pixel.online/v1/chat/completions")
        self.configure(TILESIM_ASSISTANT_BASE_URL="https://ai-pixel.online/responses")
        with self.assertRaises(assistant_model.ProviderUnavailableError):
            assistant_model.config_from_environment()

    def test_timeout_has_a_default_and_a_supported_range(self) -> None:
        self.configure(TILESIM_ASSISTANT_TIMEOUT_MS=None)
        config = assistant_model.config_from_environment()
        self.assertIsNotNone(config)
        self.assertEqual(config.timeout_ms, assistant_model.DEFAULT_TIMEOUT_MS)
        for rejected in ("999", "600001", "not-a-number"):
            self.configure(TILESIM_ASSISTANT_TIMEOUT_MS=rejected)
            with self.assertRaises(assistant_model.ProviderUnavailableError):
                assistant_model.config_from_environment()

    def test_model_identity_must_be_one_token(self) -> None:
        self.configure(TILESIM_ASSISTANT_MODEL="deepseek v4 flash")
        with self.assertRaises(assistant_model.ProviderUnavailableError):
            assistant_model.config_from_environment()

    def test_descriptor_never_exposes_the_credential(self) -> None:
        self.configure()
        descriptor = assistant_model.build_descriptor()
        self.assertEqual(descriptor["availability"], "available")
        self.assertEqual(descriptor["provider"]["model_id"], "deepseek-v4-flash")
        self.assertNotIn(ENVIRONMENT["TILESIM_ASSISTANT_API_KEY"], json.dumps(descriptor))
        self.assertEqual(descriptor["limits"]["maximum_settings"], assistant_model.MAXIMUM_SETTINGS)

    def test_catalogue_covers_every_published_parameter_and_more(self) -> None:
        # The thirteen `overrides` knobs are the published parameter catalogue, and the surface is a
        # superset of it: the assistant can address everything the panel can write, not only the knobs.
        published = {definition.request_json_pointer.lstrip("/") for definition in PARAMETER_DEFINITIONS}
        surface = set(assistant_model.PARAMETER_RULES)
        self.assertTrue(published)
        self.assertTrue(published.issubset(surface), sorted(published - surface))
        self.assertTrue(surface - published)
        catalogue = assistant_model.parameter_catalogue_text()
        for path in published:
            self.assertIn(path, catalogue)
        self.assertIn("starvation_aware", catalogue)

    def test_catalogue_reaches_what_the_knobs_alone_could_never_name(self) -> None:
        # Every one of these is writable on the page and used to be answered with "no such parameter".
        surface = set(assistant_model.PARAMETER_RULES)
        for path in (
            "gpu_participation_mode",
            "run_name",
            "topology/devices",
            "runtime_trace/requests",
            "runtime_trace/policy/fabric_backpressure_active",
            "runtime_trace/requests[i]/tp_degree",
            "topology/devices[i]/device_type",
            "topology/module_bindings[i]/override_params/queue_factor",
        ):
            self.assertIn(path, surface)

    def test_the_surface_never_offers_a_field_the_page_refuses(self) -> None:
        # A reference key and a container are both outside one scalar assignment, so neither may be
        # advertised: an address the page rejects would come back as a confusing per-value refusal.
        surface = set(assistant_model.PARAMETER_RULES)
        for path in (
            "topology/devices[i]/device_id",
            "topology/domains[i]/domain_id",
            "topology/domains[i]/module_binding",
            "topology/module_bindings[i]/module_name",
            "topology/links[i]/src_device",
            "topology/links[i]/dst_device",
            "topology/domains[i]/member_devices",
            "runtime_trace/requests[i]/participants",
        ):
            self.assertNotIn(path, surface)


class AssistantModelPlanTest(unittest.TestCase):
    """One scenario plan, validated against the published parameter catalogue."""

    def setUp(self) -> None:
        self.saved = {name: os.environ.pop(name, None) for name in ENVIRONMENT}
        for name, value in ENVIRONMENT.items():
            os.environ[name] = value
        self.payloads: list[dict] = []

    def tearDown(self) -> None:
        for name, value in self.saved.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value

    def plan_with(self, reply: object, instruction: str = "跑一个低延迟在线服务") -> dict:
        def transport(config, payload):  # noqa: ANN001, ANN202
            self.config = config
            self.payloads.append(payload)
            if isinstance(reply, Exception):
                raise reply
            return reply

        return assistant_model.plan(instruction, transport=transport)

    def test_plan_returns_one_validated_plan(self) -> None:
        result = self.plan_with(
            build_reply(
                plan_document(
                    [
                        {"key": "max_batch_size", "value": "4", "why": "控制单批规模以压住尾延迟。"},
                        {"key": "batch_scheduler", "value": "decode_priority", "why": "让解码优先。"},
                        {"key": "kv_admission_watermark", "value": "0.9", "why": "留出余量。"},
                    ],
                    title="低延迟在线服务",
                    rationale="以尾延迟优先，牺牲一部分吞吐。",
                )
            )
        )
        self.assertEqual(result["title"], "低延迟在线服务")
        self.assertEqual(result["schema_version"], assistant_model.PLAN_SCHEMA_VERSION)
        self.assertEqual(result["model_id"], "deepseek-v4-flash")
        self.assertEqual(result["served_model"], "deepseek-v4-flash")
        self.assertEqual(
            [item["key"] for item in result["settings"]],
            [
                "overrides/runtime/max_batch_size",
                "overrides/runtime/batch_scheduler",
                "overrides/runtime/kv_admission_watermark",
            ],
        )
        self.assertEqual(result["settings"][0]["value"], "4")
        self.assertEqual(result["settings"][0]["why"], "控制单批规模以压住尾延迟。")
        self.assertEqual(result["dropped"], [])
        self.assertFalse(result["applied"])
        self.assertFalse(result["executed"])

    def test_prompt_carries_the_catalogue_and_the_scenario(self) -> None:
        self.plan_with(build_reply(plan_document([])), instruction="8 卡 70B 长文档混合负载")
        payload = self.payloads[0]
        self.assertEqual(payload["model"], "deepseek-v4-flash")
        self.assertEqual(payload["response_format"], {"type": "json_object"})
        self.assertFalse(payload["stream"])
        self.assertEqual([message["role"] for message in payload["messages"]], ["system", "user"])
        self.assertIn("kv_admission_watermark", payload["messages"][0]["content"])
        self.assertIn("范围 1 ~ 64", payload["messages"][0]["content"])
        self.assertIn("8 卡 70B 长文档混合负载", payload["messages"][1]["content"])

    def test_hidden_reasoning_is_dropped_and_never_returned(self) -> None:
        result = self.plan_with(
            build_reply(
                plan_document([{"key": "max_batch_size", "value": "8", "why": "理由。"}]),
                reasoning=REASONING_SENTINEL,
            )
        )
        serialized = json.dumps(result, ensure_ascii=False)
        self.assertNotIn(REASONING_SENTINEL, serialized)
        self.assertNotIn("reasoning", serialized)
        self.assertEqual(len(result["settings"]), 1)

    def test_reasoning_only_reply_is_an_invalid_answer(self) -> None:
        with self.assertRaises(assistant_model.ProviderStructuredOutputError):
            self.plan_with(build_reply("", reasoning=REASONING_SENTINEL))

    def test_unknown_parameter_is_dropped_instead_of_returned(self) -> None:
        result = self.plan_with(
            build_reply(
                plan_document(
                    [
                        {"key": "max_batch_size", "value": "8", "why": "理由。"},
                        {"key": "turbo_mode", "value": "on", "why": "编造的参数。"},
                    ]
                )
            )
        )
        self.assertEqual([item["key"] for item in result["settings"]], ["overrides/runtime/max_batch_size"])
        self.assertEqual(result["dropped"], [{"key": "turbo_mode", "reason": "unknown_parameter"}])

    def test_a_bare_knob_name_resolves_the_way_the_page_resolves_it(self) -> None:
        # `max_batch_size` is both a knob and a policy key. The knob wins, exactly as the page's own
        # resolver prefers it, so the address handed over is one the page publishes.
        result = self.plan_with(
            build_reply(plan_document([{"key": "max_batch_size", "value": "8", "why": "理由。"}]))
        )
        self.assertEqual([item["key"] for item in result["settings"]], ["overrides/runtime/max_batch_size"])

    def test_an_element_address_needs_an_index(self) -> None:
        result = self.plan_with(
            build_reply(
                plan_document(
                    [
                        {"key": "topology/devices[i]/device_type", "value": "H100", "why": "没有下标。"},
                        {"key": "topology/devices[2]/device_type", "value": "H100", "why": "有下标。"},
                    ]
                )
            )
        )
        self.assertEqual([item["key"] for item in result["settings"]], ["topology/devices[2]/device_type"])
        self.assertEqual(
            result["dropped"],
            [{"key": "topology/devices[i]/device_type", "reason": "address_needs_an_index"}],
        )

    def test_a_collection_size_is_a_parameter_of_its_own(self) -> None:
        # This is the answer to "增加显卡数量": the size of `topology/devices` IS the card count, so
        # it is an address a caller can state rather than a field nobody publishes. The refusals come
        # first because a repeated address keeps its first occurrence - a dropped one is not a
        # duplicate, an accepted one is.
        result = self.plan_with(
            build_reply(
                plan_document(
                    [
                        {"key": "topology/devices", "value": "4096", "why": "超出上限。"},
                        {"key": "topology/devices", "value": "7.5", "why": "不是整数。"},
                        {"key": "topology/devices", "value": "8", "why": "扩容到 8 张卡。"},
                    ]
                )
            )
        )
        self.assertEqual([item["key"] for item in result["settings"]], ["topology/devices"])
        self.assertEqual(result["settings"][0]["value"], "8")
        self.assertEqual(
            [entry["reason"] for entry in result["dropped"]],
            ["value_above_maximum", "value_not_integer"],
        )

    def test_a_text_and_a_switch_are_validated_by_their_own_kind(self) -> None:
        # Neither kind existed while the surface was the thirteen numeric knobs, so a text field used
        # to be rejected as "not a number" and a switch as "not a scalar".
        result = self.plan_with(
            build_reply(
                plan_document(
                    [
                        {"key": "run_name", "value": 42, "why": "不是文本。"},
                        {"key": "runtime_trace/policy/fabric_backpressure_active", "value": "maybe", "why": "不是开关值。"},
                        {"key": "run_name", "value": "8 卡扩容试验", "why": "给这次扩容起个名字。"},
                        {"key": "runtime_trace/policy/fabric_backpressure_active", "value": True, "why": "打开背压。"},
                    ]
                )
            )
        )
        self.assertEqual(
            [item["key"] for item in result["settings"]],
            ["run_name", "runtime_trace/policy/fabric_backpressure_active"],
        )
        self.assertEqual(result["settings"][0]["value"], "8 卡扩容试验")
        self.assertEqual(result["settings"][1]["value"], "true")
        self.assertEqual(
            [entry["reason"] for entry in result["dropped"]],
            ["value_not_text", "value_not_boolean"],
        )

    def test_values_outside_the_published_range_are_dropped(self) -> None:
        result = self.plan_with(
            build_reply(
                plan_document(
                    [
                        {"key": "max_batch_size", "value": "128", "why": "超出上限。"},
                        {"key": "max_batch_size", "value": "0", "why": "低于下限。"},
                        {"key": "max_batch_size", "value": "8.5", "why": "不是整数。"},
                        {"key": "kv_admission_watermark", "value": "1.5", "why": "超出上限。"},
                        {"key": "max_batch_size", "value": "16", "why": "合法。"},
                    ]
                )
            )
        )
        self.assertEqual([item["key"] for item in result["settings"]], ["overrides/runtime/max_batch_size"])
        self.assertEqual(result["settings"][0]["value"], "16")
        reasons = [entry["reason"] for entry in result["dropped"]]
        self.assertEqual(
            reasons,
            ["value_above_maximum", "value_below_minimum", "value_not_integer", "value_above_maximum"],
        )

    def test_enum_values_are_checked_against_the_published_values(self) -> None:
        result = self.plan_with(
            build_reply(
                plan_document(
                    [
                        {"key": "batch_scheduler", "value": "turbo_scheduler", "why": "不在集合里。"},
                        {"key": "batch_scheduler", "value": "fabric_backpressure_aware", "why": "合法。"},
                    ]
                )
            )
        )
        self.assertEqual(result["dropped"], [{"key": "overrides/runtime/batch_scheduler", "reason": "value_outside_enum"}])
        self.assertEqual(result["settings"][0]["value"], "fabric_backpressure_aware")

    def test_numbers_are_normalized_without_trailing_zeros(self) -> None:
        result = self.plan_with(
            build_reply(
                plan_document(
                    [
                        {"key": "scale_up_latency_us", "value": "1.0", "why": "整数写法。"},
                        {"key": "message_size_multiplier", "value": "2.5", "why": "小数写法。"},
                    ]
                )
            )
        )
        self.assertEqual([item["value"] for item in result["settings"]], ["1", "2.5"])

    def test_a_fenced_answer_is_accepted(self) -> None:
        fenced = "```json\n" + plan_document([{"key": "max_batch_size", "value": "8", "why": "理由。"}]) + "\n```"
        result = self.plan_with(build_reply(fenced))
        self.assertEqual(len(result["settings"]), 1)

    def test_duplicate_parameter_keeps_the_first_occurrence(self) -> None:
        result = self.plan_with(
            build_reply(
                plan_document(
                    [
                        {"key": "max_batch_size", "value": "8", "why": "第一次。"},
                        {"key": "max_batch_size", "value": "64", "why": "第二次。"},
                    ]
                )
            )
        )
        self.assertEqual(len(result["settings"]), 1)
        self.assertEqual(result["settings"][0]["value"], "8")

    def test_settings_are_capped(self) -> None:
        # One address per request element, all valid and all distinct, so the cap is the only reason
        # anything can be refused. The cap has to be reachable: a plan that names several elements per
        # collection is normal now, and a truncation the reader never learns about is a plan that
        # contradicts its own rationale.
        budget = assistant_model.MAXIMUM_SETTINGS + 5
        settings = [
            {"key": f"runtime_trace/requests[{index}]/priority_class", "value": "1", "why": "理由。"}
            for index in range(budget)
        ]
        result = self.plan_with(build_reply(plan_document(settings)))
        self.assertEqual(len(result["settings"]), assistant_model.MAXIMUM_SETTINGS)
        self.assertEqual(
            [entry["reason"] for entry in result["dropped"]],
            ["settings_limit_exceeded"] * 5,
        )

    def test_the_cap_travels_with_the_catalogue(self) -> None:
        self.plan_with(build_reply(plan_document([])))
        system = self.payloads[0]["messages"][0]["content"]
        self.assertIn(str(assistant_model.MAXIMUM_SETTINGS), system)

    def test_an_answer_without_settings_returns_an_empty_plan(self) -> None:
        result = self.plan_with(build_reply(plan_document([])))
        self.assertEqual(result["settings"], [])
        self.assertEqual(result["dropped"], [])

    def test_an_empty_or_multi_choice_answer_is_an_invalid_answer(self) -> None:
        with self.assertRaises(assistant_model.ProviderStructuredOutputError):
            self.plan_with(build_reply("   "))
        two_choices = build_reply(plan_document([]))
        two_choices["choices"].append(two_choices["choices"][0])
        with self.assertRaises(assistant_model.ProviderStructuredOutputError):
            self.plan_with(two_choices)
        with self.assertRaises(assistant_model.ProviderStructuredOutputError):
            self.plan_with({"model": "deepseek-v4-flash", "choices": []})

    def test_an_answer_that_is_not_one_json_object_is_an_invalid_answer(self) -> None:
        with self.assertRaises(assistant_model.ProviderStructuredOutputError):
            self.plan_with(build_reply("我认为应该把 batch 调大到 32。"))
        with self.assertRaises(assistant_model.ProviderStructuredOutputError):
            self.plan_with(build_reply("[1, 2, 3]"))

    def test_instruction_validation(self) -> None:
        self.assertEqual(assistant_model.validate_instruction("  低延迟在线服务  "), "低延迟在线服务")
        for rejected in ("", "   ", None, 42, ["a"]):
            with self.assertRaises(ValueError):
                assistant_model.validate_instruction(rejected)
        with self.assertRaises(ValueError):
            assistant_model.validate_instruction("x" * (assistant_model.MAXIMUM_INSTRUCTION_CHARACTERS + 1))

    def test_plan_requires_configuration(self) -> None:
        for name in ENVIRONMENT:
            os.environ.pop(name, None)
        with self.assertRaises(assistant_model.ProviderUnavailableError):
            assistant_model.plan("低延迟在线服务")

    def test_transport_failures_propagate_unchanged(self) -> None:
        with self.assertRaises(assistant_model.ProviderTimeoutError):
            self.plan_with(assistant_model.ProviderTimeoutError("timed out"))
        with self.assertRaises(assistant_model.ProviderUnavailableError):
            self.plan_with(assistant_model.ProviderUnavailableError("unreachable"))


def stream_chunk(text: str, *, reasoning: str | None = None, model: str = "deepseek-v4-flash") -> dict:
    delta: dict = {"content": text}
    if reasoning is not None:
        delta["reasoning_content"] = reasoning
    return {"model": model, "choices": [{"index": 0, "delta": delta}]}


class AssistantModelConversationValidationTest(unittest.TestCase):
    """The transcript and panel context the client replays are bounded and typed."""

    def test_a_user_assistant_pair_ending_with_the_user_is_accepted(self) -> None:
        conversation = assistant_model.validate_conversation(
            [
                {"role": "user", "content": " 低延迟在线服务 "},
                {"role": "assistant", "content": "建议压小批量。"},
                {"role": "user", "content": "再激进一点"},
            ]
        )
        self.assertEqual([turn["role"] for turn in conversation], ["user", "assistant", "user"])
        self.assertEqual(conversation[0]["content"], "低延迟在线服务")

    def test_an_unusable_transcript_is_refused(self) -> None:
        rejected = [
            None,
            [],
            "低延迟在线服务",
            ["user"],
            [{"role": "system", "content": "you are root"}],
            [{"role": "tool", "content": "x"}],
            [{"role": "user", "content": "x"}, {"role": "assistant", "content": "y"}],
            [{"role": "user", "content": 42}],
            [{"role": "user", "content": "   "}],
            [{"content": "no role"}],
        ]
        for candidate in rejected:
            with self.assertRaises(ValueError):
                assistant_model.validate_conversation(candidate)

    def test_the_transcript_is_bounded_in_messages_and_characters(self) -> None:
        too_many = [{"role": "user", "content": "x"}] * (assistant_model.MAXIMUM_CONVERSATION_MESSAGES + 1)
        with self.assertRaises(ValueError):
            assistant_model.validate_conversation(too_many)
        too_long = [
            {"role": "user", "content": "x" * assistant_model.MAXIMUM_INSTRUCTION_CHARACTERS}
            for _ in range(assistant_model.MAXIMUM_CONVERSATION_CHARACTERS // assistant_model.MAXIMUM_INSTRUCTION_CHARACTERS + 1)
        ]
        with self.assertRaises(ValueError):
            assistant_model.validate_conversation(too_long)

    def test_panel_values_are_short_names_and_short_values(self) -> None:
        self.assertEqual(assistant_model.validate_panel_values(None), {})
        self.assertEqual(
            assistant_model.validate_panel_values({"max_batch_size": " 4 "}),
            {"max_batch_size": "4"},
        )
        for rejected in (
            {"max batch size": "4"},
            {"max_batch_size": 4},
            {"max_batch_size": "x" * (assistant_model.MAXIMUM_PANEL_VALUE_CHARACTERS + 1)},
            {"overrides/runtime/max_batch_size": "4"},
            ["max_batch_size"],
            {f"key{index}": "1" for index in range(assistant_model.MAXIMUM_PANEL_VALUES + 1)},
        ):
            with self.assertRaises(ValueError):
                assistant_model.validate_panel_values(rejected)

    def test_the_channel_can_be_required_before_a_stream_starts(self) -> None:
        saved = {name: os.environ.pop(name, None) for name in ENVIRONMENT}
        try:
            with self.assertRaises(assistant_model.ProviderUnavailableError):
                assistant_model.require_channel()
            for name, value in ENVIRONMENT.items():
                os.environ[name] = value
            self.assertEqual(assistant_model.require_channel().model, "deepseek-v4-flash")
        finally:
            for name, value in saved.items():
                if value is None:
                    os.environ.pop(name, None)
                else:
                    os.environ[name] = value


class AssistantModelStreamTest(unittest.TestCase):
    """One streamed turn: prose while it arrives, then the validated plan."""

    def setUp(self) -> None:
        self.saved = {name: os.environ.pop(name, None) for name in ENVIRONMENT}
        for name, value in ENVIRONMENT.items():
            os.environ[name] = value
        self.payloads: list[dict] = []

    def tearDown(self) -> None:
        for name, value in self.saved.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value

    def stream_with(
        self,
        chunks: object,
        conversation: list[dict[str, str]] | None = None,
        panel_values: dict[str, str] | None = None,
    ) -> list[tuple[str, dict]]:
        def transport(config, payload):  # noqa: ANN001, ANN202
            self.config = config
            self.payloads.append(payload)
            if isinstance(chunks, Exception):
                raise chunks
            return iter(chunks)

        return list(
            assistant_model.stream_events(
                conversation or [{"role": "user", "content": "低延迟在线服务"}],
                panel_values or {},
                transport=transport,
            )
        )

    def prose(self, events: list[tuple[str, dict]]) -> list[str]:
        return [data["text"] for event, data in events if event == "prose"]

    def plan(self, events: list[tuple[str, dict]]) -> dict:
        plans = [data for event, data in events if event == "plan"]
        self.assertEqual(len(plans), 1)
        return plans[0]

    def test_prose_arrives_while_it_is_written_and_the_settings_block_does_not(self) -> None:
        events = self.stream_with(
            [
                stream_chunk("先压小批量。"),
                stream_chunk("并发上限也降一点。"),
                stream_chunk("\n```json\n"),
                stream_chunk(plan_document([{"key": "max_batch_size", "value": "4", "why": "压尾延迟。"}])),
                stream_chunk("\n```"),
            ]
        )
        self.assertEqual(
            self.prose(events),
            ["先压小批量。", "先压小批量。并发上限也降一点。"],
        )
        plan = self.plan(events)
        self.assertEqual(plan["answer_state"], "settings")
        self.assertEqual([item["key"] for item in plan["settings"]], ["overrides/runtime/max_batch_size"])
        self.assertEqual(plan["instruction"], "低延迟在线服务")
        self.assertEqual(plan["served_model"], "deepseek-v4-flash")
        self.assertFalse(plan["applied"])
        self.assertFalse(plan["executed"])

    def test_a_fence_split_across_two_deltas_never_leaks_into_the_prose(self) -> None:
        events = self.stream_with(
            [
                stream_chunk("结论如下。"),
                stream_chunk("``"),
                stream_chunk("`json\n"),
                stream_chunk(plan_document([]) + "\n```"),
            ]
        )
        for text in self.prose(events):
            self.assertNotIn("`", text)
        self.assertEqual(self.plan(events)["answer_state"], "settings")

    def test_a_prose_only_answer_proposes_nothing(self) -> None:
        events = self.stream_with([stream_chunk("当前最大 batch 是 4。"), stream_chunk("它决定了单批规模。")])
        plan = self.plan(events)
        self.assertEqual(plan["answer_state"], "prose_only")
        self.assertEqual(plan["settings"], [])
        self.assertEqual(plan["dropped"], [])

    def test_an_unreadable_settings_block_is_reported_instead_of_repaired(self) -> None:
        events = self.stream_with([stream_chunk("方案如下。\n```json\n"), stream_chunk("{not json")])
        plan = self.plan(events)
        self.assertEqual(plan["answer_state"], "settings_unparsed")
        self.assertEqual(plan["settings"], [])

    def test_a_settings_block_without_a_list_is_not_read_as_settings(self) -> None:
        events = self.stream_with([stream_chunk("方案如下。\n```json\n"), stream_chunk('{"title": "只有标题"}')])
        self.assertEqual(self.plan(events)["answer_state"], "settings_unparsed")

    def test_values_are_validated_exactly_as_in_the_one_shot_route(self) -> None:
        events = self.stream_with(
            [
                stream_chunk(
                    "方案如下。\n```json\n"
                    + plan_document(
                        [
                            {"key": "max_batch_size", "value": "999999", "why": "越界。"},
                            {"key": "invented_parameter", "value": "1", "why": "不存在。"},
                            {"key": "batch_scheduler", "value": "decode_priority", "why": "允许。"},
                        ]
                    )
                    + "\n```"
                )
            ]
        )
        plan = self.plan(events)
        self.assertEqual([item["key"] for item in plan["settings"]], ["overrides/runtime/batch_scheduler"])
        self.assertEqual(
            sorted(item["reason"] for item in plan["dropped"]),
            ["unknown_parameter", "value_above_maximum"],
        )

    def test_a_reasoning_delta_is_never_forwarded_or_returned(self) -> None:
        events = self.stream_with(
            [
                stream_chunk("先压小批量。", reasoning=REASONING_SENTINEL),
                stream_chunk("\n```json\n" + plan_document([]) + "\n```", reasoning=REASONING_SENTINEL),
            ]
        )
        serialized = json.dumps(events, ensure_ascii=False)
        self.assertNotIn(REASONING_SENTINEL, serialized)
        self.assertNotIn("reasoning", serialized)

    def test_a_chunk_without_visible_content_emits_nothing(self) -> None:
        events = self.stream_with([stream_chunk("", reasoning="thinking"), {"model": "x"}, stream_chunk("答。")])
        self.assertEqual(self.prose(events), ["答。"])

    def test_the_request_replays_the_transcript_and_the_panel_values(self) -> None:
        self.stream_with(
            [stream_chunk("好。")],
            conversation=[
                {"role": "user", "content": "跑一个低延迟在线服务"},
                {"role": "assistant", "content": "建议压小批量。"},
                {"role": "user", "content": "再激进一点"},
            ],
            panel_values={"max_batch_size": "4"},
        )
        payload = self.payloads[0]
        self.assertTrue(payload["stream"])
        self.assertEqual(payload["model"], "deepseek-v4-flash")
        self.assertEqual(
            [message["role"] for message in payload["messages"]],
            ["system", "user", "assistant", "user"],
        )
        self.assertIn("再激进一点", payload["messages"][-1]["content"])
        self.assertIn("kv_admission_watermark", payload["messages"][0]["content"])
        self.assertIn("当前面板的取值", payload["messages"][0]["content"])
        self.assertIn("max_batch_size = 4", payload["messages"][0]["content"])
        self.assertNotIn("response_format", payload)

    def test_a_long_answer_is_capped(self) -> None:
        events = self.stream_with([stream_chunk("x" * 4000) for _ in range(4)])
        self.assertLessEqual(
            max(len(text) for text in self.prose(events)),
            assistant_model.MAXIMUM_ANSWER_CHARACTERS,
        )
        self.assertEqual(self.plan(events)["answer_state"], "prose_only")

    def test_streaming_requires_configuration(self) -> None:
        for name in ENVIRONMENT:
            os.environ.pop(name, None)
        with self.assertRaises(assistant_model.ProviderUnavailableError):
            list(assistant_model.stream_events([{"role": "user", "content": "低延迟在线服务"}], {}))

    def test_transport_failures_propagate_unchanged(self) -> None:
        with self.assertRaises(assistant_model.ProviderTimeoutError):
            self.stream_with(assistant_model.ProviderTimeoutError("timed out"))
        with self.assertRaises(assistant_model.ProviderUnavailableError):
            self.stream_with(assistant_model.ProviderUnavailableError("unreachable"))


class AssistantModelCatalogueTest(unittest.TestCase):
    """The published model catalogue and the session-scoped model switch.

    Both are read through the same ``transport`` hook as the rest of this file, so no case here opens
    a socket either.
    """

    def setUp(self) -> None:
        self.saved = {name: os.environ.pop(name, None) for name in ENVIRONMENT}
        for name, value in ENVIRONMENT.items():
            os.environ[name] = value
        self.requests: list[tuple[str, str, str]] = []
        # A switch is process-wide state, so every case starts - and finishes - without one.
        assistant_model.clear_session_model()

    def tearDown(self) -> None:
        assistant_model.clear_session_model()
        for name, value in self.saved.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value

    def catalogue_reply(self, identities: list[str]) -> dict:
        return {
            "object": "list",
            "data": [{"id": identity, "object": "model", "created": 1_700_000_000} for identity in identities],
        }

    def cataloguing(self, reply: dict | None = None, *, error: Exception | None = None) -> dict:
        def transport(config, endpoint):
            self.requests.append((config.endpoint, endpoint, config.api_key))
            if error is not None:
                raise error
            return reply if reply is not None else {}

        return assistant_model.build_catalogue(transport=transport)

    def test_the_catalogue_is_read_beside_the_chat_endpoint_with_the_channel_credential(self) -> None:
        catalogue = self.cataloguing(self.catalogue_reply(["deepseek-v4-flash", "glm-5.1"]))
        self.assertEqual(len(self.requests), 1)
        chat_endpoint, catalogue_endpoint, credential = self.requests[0]
        self.assertEqual(chat_endpoint, "https://ai-pixel.online/v1/chat/completions")
        self.assertEqual(catalogue_endpoint, "https://ai-pixel.online/v1/models")
        self.assertEqual(credential, ENVIRONMENT["TILESIM_ASSISTANT_API_KEY"])
        self.assertEqual(catalogue["schema_version"], "tilesim.bridge.assistant_model_catalogue.v1")
        self.assertEqual(catalogue["protocol"], assistant_model.PROTOCOL)
        self.assertEqual(catalogue["provider_id"], assistant_model.PROVIDER_ID)
        self.assertEqual(catalogue["models"], ["deepseek-v4-flash", "glm-5.1"])
        self.assertEqual(catalogue["count"], 2)
        self.assertEqual(catalogue["selected_model"], "deepseek-v4-flash")
        self.assertFalse(catalogue["session_override"])

    def test_the_catalogue_follows_a_base_url_that_names_one_path(self) -> None:
        for base_url in (
            "https://ai-pixel.online",
            "https://ai-pixel.online/",
            "https://ai-pixel.online/v1",
            "https://ai-pixel.online/v1/chat/completions",
        ):
            os.environ["TILESIM_ASSISTANT_BASE_URL"] = base_url
            self.cataloguing(self.catalogue_reply(["glm-5.1"]))
            self.assertEqual(self.requests[-1][1], "https://ai-pixel.online/v1/models")

    def test_the_catalogue_never_carries_the_credential(self) -> None:
        catalogue = self.cataloguing(self.catalogue_reply(["deepseek-v4-flash"]))
        self.assertNotIn(ENVIRONMENT["TILESIM_ASSISTANT_API_KEY"], json.dumps(catalogue))

    def test_an_entry_without_a_readable_identity_is_skipped_not_repaired(self) -> None:
        reply = {
            "data": [
                {"id": "glm-5.1"},
                {"id": 7},
                {},
                "kimi-k2",
                {"id": "   "},
                {"id": "glm-5.1"},
            ]
        }
        catalogue = self.cataloguing(reply)
        self.assertEqual(catalogue["models"], ["glm-5.1", "kimi-k2"])
        self.assertEqual(catalogue["count"], 2)
        self.assertFalse(catalogue["session_override"])

    def test_a_catalogue_without_any_readable_identity_is_refused(self) -> None:
        for reply in ({"data": []}, {"data": [{"id": 7}]}, {}, {"data": "nope"}):
            with self.assertRaises(assistant_model.ProviderStructuredOutputError):
                self.cataloguing(reply)

    def test_the_identity_list_is_bounded(self) -> None:
        catalogue = self.cataloguing(self.catalogue_reply([f"model-{index}" for index in range(600)]))
        self.assertEqual(catalogue["count"], assistant_model.MAXIMUM_MODEL_IDENTITIES)

    def test_a_catalogue_requires_a_configured_channel(self) -> None:
        for name in ENVIRONMENT:
            os.environ.pop(name, None)
        with self.assertRaises(assistant_model.ProviderUnavailableError):
            assistant_model.build_catalogue(transport=lambda config, endpoint: {})
        self.assertEqual(self.requests, [])

    def test_transport_failures_propagate_unchanged(self) -> None:
        with self.assertRaises(assistant_model.ProviderTimeoutError):
            self.cataloguing(error=assistant_model.ProviderTimeoutError("timed out"))
        with self.assertRaises(assistant_model.ProviderUnavailableError):
            self.cataloguing(error=assistant_model.ProviderUnavailableError("unreachable"))

    def test_switching_the_model_takes_effect_for_the_next_request(self) -> None:
        selection = assistant_model.select_model("  glm-5.1  ")
        self.assertEqual(selection["schema_version"], "tilesim.bridge.assistant_model_selection.v1")
        self.assertEqual(selection["protocol"], assistant_model.PROTOCOL)
        self.assertEqual(selection["provider_id"], assistant_model.PROVIDER_ID)
        self.assertEqual(selection["selected_model"], "glm-5.1")
        self.assertEqual(selection["previous_model"], "deepseek-v4-flash")
        self.assertTrue(selection["in_force"])
        self.assertFalse(selection["persisted"])
        self.assertTrue(selection["session_only"])
        self.assertEqual(assistant_model.session_model(), "glm-5.1")
        self.assertEqual(assistant_model.config_from_environment().model, "glm-5.1")
        self.assertEqual(assistant_model.build_descriptor()["provider"]["model_id"], "glm-5.1")

    def test_the_switch_leaves_the_process_environment_untouched(self) -> None:
        # The saved configuration belongs to the launcher, and a panel selection is not allowed to
        # write it: everything this process reads stays exactly as it was except the identity.
        before = dict(os.environ)
        assistant_model.select_model("glm-5.1")
        self.assertEqual(dict(os.environ), before)
        self.assertEqual(os.environ["TILESIM_ASSISTANT_MODEL"], "deepseek-v4-flash")

    def test_the_catalogue_reports_the_switched_identity(self) -> None:
        assistant_model.select_model("glm-5.1")
        catalogue = self.cataloguing(self.catalogue_reply(["deepseek-v4-flash", "glm-5.1"]))
        self.assertEqual(catalogue["selected_model"], "glm-5.1")
        self.assertTrue(catalogue["session_override"])

    def test_clearing_the_selection_restores_the_configured_identity(self) -> None:
        assistant_model.select_model("glm-5.1")
        assistant_model.clear_session_model()
        self.assertIsNone(assistant_model.session_model())
        self.assertEqual(assistant_model.config_from_environment().model, "deepseek-v4-flash")
        self.assertFalse(assistant_model.build_descriptor()["provider"]["model_id"] == "glm-5.1")

    def test_an_unusable_identity_is_refused_and_changes_nothing(self) -> None:
        for rejected in ("", "   ", "a b", "a\tb", "x" * 201, 7, None, ["glm-5.1"]):
            with self.assertRaises(ValueError):
                assistant_model.select_model(rejected)
        self.assertIsNone(assistant_model.session_model())
        self.assertEqual(assistant_model.config_from_environment().model, "deepseek-v4-flash")

    def test_a_switch_requires_a_configured_channel(self) -> None:
        for name in ENVIRONMENT:
            os.environ.pop(name, None)
        with self.assertRaises(assistant_model.ProviderUnavailableError):
            assistant_model.select_model("glm-5.1")
        self.assertIsNone(assistant_model.session_model())


if __name__ == "__main__":
    unittest.main()
