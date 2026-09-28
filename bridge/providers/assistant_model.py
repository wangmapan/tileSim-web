"""Assistant model channel: scenario planning for the right-side Agent panel.

This adapter is deliberately **separate** from the read-only evidence Provider
(:mod:`providers.evidence_agent`), because the two have different contracts:

* a hidden reasoning trace is **dropped**.  The evidence adapter rejects a reply that carries one; this
  adapter uses only ``choices[0].message.content`` and never reads, returns, stores, or logs a trace.  The
  repository-wide forbidden-persistence list stays satisfied because nothing here persists the trace.
* every proposed parameter is validated against :mod:`contracts.parameter_surface`, the addressable
  surface derived from the same contract schemas the page builds its editors from, so an invented
  parameter name or an out-of-range value never leaves this module.  The surface covers the whole form,
  not just the thirteen ``overrides`` knobs: the top-level fields, every ``runtime_trace`` policy and
  request field, every topology element field, and the size of a collection - which is how a caller
  changes the device count.
* this module never writes a document, never submits a run, and never creates a run.
* a **multi-turn** transcript may be replayed (see :func:`validate_conversation`).  Only the user and
  assistant roles are accepted, so a client cannot inject a system message and the parameter catalogue
  always stays owned by this module.
* the streamed variant forwards ``prose`` events (the model's own answer, re-sent in full each time) and
  one final ``plan`` event.  The transcript itself is never persisted: it lives in the browser and is
  replayed by the client, not stored by the Bridge.
* the model identity can be **switched for the lifetime of this process** (see :func:`select_model`),
  which is what lets the panel offer the service's own model catalogue instead of asking an operator to
  retype an identity.  The switch is deliberately session-scoped and is reported as such: the saved
  configuration belongs to the launcher, and nothing in this module writes it.

Configuration is read from the process environment that the Windows launcher forwards into WSL
(``TILESIM_ASSISTANT_BASE_URL``, ``TILESIM_ASSISTANT_API_KEY``, ``TILESIM_ASSISTANT_MODEL``,
``TILESIM_ASSISTANT_TIMEOUT_MS``).  The credential is never persisted and never appears in a message or a log
line: :class:`AssistantModelConfig` excludes it from ``repr``.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from typing import Any, Iterator
from urllib.parse import urlsplit, urlunsplit

from contracts import parameter_surface

from .evidence_agent import (
    ProviderConfig,
    ProviderError,
    ProviderStructuredOutputError,
    ProviderUnavailableError,
    ProviderTimeoutError,
    get_json,
    open_json_stream,
    post_json,
)

PROTOCOL = "tilesim.assistant_model.v1"
DESCRIPTOR_SCHEMA_VERSION = "tilesim.bridge.assistant_model_descriptor.v1"
PLAN_SCHEMA_VERSION = "tilesim.bridge.assistant_model_plan.v1"
CHAT_SCHEMA_VERSION = "tilesim.bridge.assistant_model_chat.v1"
CATALOGUE_SCHEMA_VERSION = "tilesim.bridge.assistant_model_catalogue.v1"
SELECTION_SCHEMA_VERSION = "tilesim.bridge.assistant_model_selection.v1"
PROVIDER_ID = "tilesim_assistant_openai_v1"

BASE_URL_ENV = "TILESIM_ASSISTANT_BASE_URL"
API_KEY_ENV = "TILESIM_ASSISTANT_API_KEY"
MODEL_ENV = "TILESIM_ASSISTANT_MODEL"
TIMEOUT_ENV = "TILESIM_ASSISTANT_TIMEOUT_MS"

DEFAULT_TIMEOUT_MS = 120_000
MINIMUM_TIMEOUT_MS = 1_000
MAXIMUM_TIMEOUT_MS = 600_000

MAXIMUM_INSTRUCTION_CHARACTERS = 2_000
# The cap exists to bound one answer, not to decide how much of the surface a plan may name. It was
# 20 while only thirteen knobs were addressable; with element addresses ("set every device") a
# coherent whole-set plan legitimately exceeds that, and a plan truncated at 20 would contradict its
# own rationale - a live run asked for eight devices and lost every fabric setting to the cap.
MAXIMUM_SETTINGS = 64
MAXIMUM_TITLE_CHARACTERS = 80
MAXIMUM_RATIONALE_CHARACTERS = 600
MAXIMUM_REASON_CHARACTERS = 240

# Multi-turn chat bounds.  A conversation is bounded in messages *and* in characters so one request
# cannot grow a prompt without limit, and the answer is bounded so a runaway model cannot fill the
# client's memory before the stream is closed.
MAXIMUM_CONVERSATION_MESSAGES = 12
MAXIMUM_CONVERSATION_CHARACTERS = 12_000
MAXIMUM_ANSWER_CHARACTERS = 24_000
MAXIMUM_PANEL_VALUES = 128
MAXIMUM_PANEL_VALUE_CHARACTERS = 120

# Bounds for the model catalogue the service publishes.  The identity bound matches the one the
# configuration reader applies, so a catalogue entry and a configured identity are held to one rule.
MAXIMUM_MODEL_ID_CHARACTERS = 200
MAXIMUM_MODEL_IDENTITIES = 500

CONVERSATION_ROLES = frozenset({"user", "assistant"})
PANEL_VALUE_KEY_PATTERN = re.compile(r"[A-Za-z0-9_]{1,64}\Z")

# The model this process is currently using, when a panel selection replaced the configured one.
#
# It is one reference to an immutable string, so a reader in another request thread sees either the
# previous identity or the new one and never a half-written value.  It is deliberately *not* written
# anywhere: the saved configuration is owned by the launcher, and this process only ever holds its own
# choice until it is restarted.
_session_model: str | None = None

# The answer is prose plus one trailing settings block.  The fence is the marker the client is told
# about; `_visible_prose` holds a partially streamed fence back so it never leaks into the prose.
SETTINGS_FENCE = "```"

SYSTEM_PROMPT = (
    "You are the TileSim experiment-planning assistant for the prepare page of a GPU performance "
    "simulator. You receive one natural-language scenario and the complete list of parameters the "
    "simulator accepts, with the range or the allowed values of each one.\n"
    "Rules:\n"
    "1. The `key` must be one of the addresses listed below, written exactly as listed. An address "
    "containing `[i]` names an element, so write the real index instead of `[i]` (the first element is "
    "0). An address listed under 集合规模 IS a collection's size: its value is the number of elements, "
    "so use that address to add or remove GPUs and never invent a `device_count` field.\n"
    "2. Every value must respect the stated range or the stated allowed values, and an integer parameter "
    "keeps an integer value.\n"
    "3. Choose a coherent whole set for the scenario, not one isolated tweak. Decide the trade-off between "
    "throughput and latency explicitly.\n"
    "When increasing topology/devices, include every requested new device's device_type and group_id, "
    "and any requested runtime_trace/requests[i]/tp_degree. A device group_id alone does not define "
    "links or domains; never claim a complete connected fabric without explicit link/domain data. "
    "If the full required set cannot fit or cannot be expressed by these scalar addresses, explain "
    "the gap honestly instead of presenting a partial plan as complete.\n"
    "4. For every parameter write one short sentence saying why that value serves this scenario and what it "
    "does to throughput or to latency.\n"
    "5. If the request cannot be honoured from this list, say so plainly and name the address that would "
    "have to serve it; never invent an address.\n"
    "6. Write the title, the rationale and every why sentence in Simplified Chinese.\n"
    "7. Return one JSON object and nothing else: no markdown, no commentary, no tool calls. The shape is\n"
    '{"title": string, "rationale": string, "settings": [{"key": string, "value": string, "why": string}]}'
)

# The streaming prompt asks for the same plan, but written after a readable answer instead of as the
# whole reply.  The prose is the model's own answer - the thing a user watches arrive - and is
# deliberately the only text that is forwarded; a hidden reasoning delta is never read (see
# `_delta_content`).
CHAT_SYSTEM_PROMPT = (
    "你是 TileSim 实验配置页的助手，服务于一个 GPU 性能模拟器的参数准备页。"
    "你会收到一段多轮对话：用户可能描述一个场景、追问上一条建议、要求换一种取舍，或只是问一个问题。\n"
    "回答规则：\n"
    "1. 先用简体中文写一段可以直接阅读的回答。先给结论，再逐条说明每个参数为什么这样设、"
    "它对吞吐或延迟有什么影响；如果用户只是在追问，就回答问题。不要写标题层级，不要罗列无关内容。\n"
    "2. 回答的最后，用一个 ```json 代码块给出完整的参数方案，格式是\n"
    '{"title": string, "rationale": string, "settings": [{"key": string, "value": string, "why": string}]}\n'
    "3. key 必须是下面列出的地址，原样照抄。含 [i] 的地址表示元素，把 [i] 换成真实下标（第一个是 0）。"
    "列在「集合规模」下的地址写的就是元素个数 —— 要增减显卡就改 topology/devices，不要另找一个不存在的字段。\n"
    "4. 每个值必须满足给定的范围或取值列表，整数参数必须给整数。\n"
    "扩容 topology/devices 时，列出所有新增设备的 device_type 和 group_id，并列出请求所需的 "
    "runtime_trace/requests[i]/tp_degree。group_id 不能替代 links/domains；没有明确链路和域数据时，"
    "不得宣称互联拓扑已完整。若条数上限或可写字段无法覆盖完整方案，明确说明缺口，不要声称已配置完成。\n"
    "5. 如果这件事用下面的地址办不到，就直说办不到，并点名本该由哪个地址承担；不要编造地址。\n"
    "6. 如果不打算改任何参数（例如用户只是在提问），把 settings 写成空数组。\n"
    "7. json 代码块必须放在最后，代码块之后不要再写任何内容。\n"
    "可用参数清单：\n"
)



@dataclass(frozen=True)
class AssistantModelConfig:
    endpoint: str
    api_key: str = field(repr=False)
    model: str
    timeout_ms: int

    @property
    def public_identity(self) -> dict[str, Any]:
        return {
            "configured": True,
            "provider_id": PROVIDER_ID,
            "model_id": self.model,
            "model_revision": self.model,
        }


@dataclass(frozen=True)
class ParameterRule:
    """How one published parameter accepts a value.

    The rule is not the catalogue: :mod:`contracts.parameter_surface` owns which
    addresses exist and what they are called, and this class is only the
    value-side half of the answer, so the two can never disagree about a range.
    """

    key: str
    field_id: str
    subsystem: str
    group_id: str
    value_type: str
    unit: str
    enum_values: tuple[str, ...] = ()
    minimum: float | None = None
    maximum: float | None = None
    integer_only: bool = False
    max_length: int | None = None


def _format_number(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return repr(float(value))


def _build_rules() -> dict[str, ParameterRule]:
    """One rule per address on the surface, keyed by its element form.

    The key is the address with its index placeholder (``topology/devices[i]/
    device_type``) rather than a concrete index, so an address is looked up once
    however many elements the document happens to hold.
    """

    rules: dict[str, ParameterRule] = {}
    for address in parameter_surface.SURFACE_ADDRESSES:
        rules[address.path] = ParameterRule(
            key=address.key,
            field_id=address.field_id or "",
            subsystem=address.target,
            group_id=address.group,
            value_type=address.kind,
            unit=address.unit,
            enum_values=address.enum_values,
            minimum=address.minimum,
            maximum=address.maximum,
            integer_only=address.integer_only,
            max_length=address.max_length,
        )
    return rules


PARAMETER_RULES: dict[str, ParameterRule] = _build_rules()


def parameter_catalogue_text() -> str:
    """The whole addressable surface, as the text a model is given."""

    return parameter_surface.surface_catalogue_text()


def _chat_completions_endpoint(endpoint: str) -> str:
    parsed = urlsplit(endpoint)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ProviderUnavailableError("The assistant model Base URL is not an absolute HTTP(S) URL.")
    normalized_path = parsed.path.rstrip("/")
    if normalized_path in {"", "/v1"}:
        normalized_path = "/v1/chat/completions"
    elif normalized_path != "/v1/chat/completions":
        raise ProviderUnavailableError(
            "The assistant model Base URL must be an origin, /v1, or the fixed /v1/chat/completions path."
        )
    return urlunsplit((parsed.scheme, parsed.netloc, normalized_path, "", ""))


def _models_endpoint(endpoint: str) -> str:
    """Return the catalogue endpoint that sits beside the chat endpoint this module derived.

    Both addresses are taken from the same configured origin, so the catalogue and the conversation
    can never end up pointing at two different services.
    """

    parsed = urlsplit(endpoint)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ProviderUnavailableError("The assistant model Base URL is not an absolute HTTP(S) URL.")
    return urlunsplit((parsed.scheme, parsed.netloc, "/v1/models", "", ""))


def _resolve_timeout_ms(raw: str | None) -> int:
    if raw is None or raw.strip() == "":
        return DEFAULT_TIMEOUT_MS
    try:
        parsed = int(raw, 10)
    except ValueError as error:
        raise ProviderUnavailableError("The assistant model timeout is not an integer.") from error
    if not MINIMUM_TIMEOUT_MS <= parsed <= MAXIMUM_TIMEOUT_MS:
        raise ProviderUnavailableError("The assistant model timeout is outside its supported range.")
    return parsed


def validate_model_id(raw: Any) -> str:
    """Validate one model identity structurally and return it unchanged.

    An identity is one token: it is placed in the JSON body the model service receives, so interior
    whitespace and control characters are refused instead of trimmed.  Whether the service actually
    serves the identity is the service's own judgement and is never guessed here.
    """

    if not isinstance(raw, str):
        raise ValueError("The model identity must be one string.")
    model = raw.strip()
    if not model:
        raise ValueError("The model identity cannot be empty.")
    if len(model) > MAXIMUM_MODEL_ID_CHARACTERS:
        raise ValueError(
            f"The model identity must be at most {MAXIMUM_MODEL_ID_CHARACTERS} characters."
        )
    if any(character.isspace() or ord(character) < 32 for character in model):
        raise ValueError("The model identity must be one token without whitespace.")
    return model


def session_model() -> str | None:
    """The model in force because of a panel selection, or ``None`` for the configured identity."""

    return _session_model


def select_session_model(model: str) -> None:
    """Make one already-validated identity the model this process uses."""

    global _session_model
    _session_model = model


def clear_session_model() -> None:
    """Drop a panel selection, so the configured identity is read again."""

    global _session_model
    _session_model = None


def config_from_environment() -> AssistantModelConfig | None:
    """Return the channel configuration, or ``None`` when the channel is not configured at all.

    A model the panel selected for this process takes the place of the configured identity, so a
    switch is honoured by the very next request without restarting anything.  Every other part of the
    configuration - the endpoint, the credential, the timeout - always comes from the environment.
    """

    base_url = os.environ.get(BASE_URL_ENV, "").strip()
    api_key = os.environ.get(API_KEY_ENV, "")
    configured_model = os.environ.get(MODEL_ENV, "").strip()
    if not base_url and not api_key and not configured_model:
        return None
    missing = [
        name
        for name, value in (
            (BASE_URL_ENV, base_url),
            (API_KEY_ENV, api_key),
            (MODEL_ENV, configured_model),
        )
        if not value
    ]
    if missing:
        raise ProviderUnavailableError("The assistant model channel is only partially configured.")
    try:
        model = validate_model_id(_session_model if _session_model is not None else configured_model)
    except ValueError as error:
        # A structural identity error is a misconfiguration, and the descriptor reports a
        # misconfiguration rather than failing a request, so it keeps the provider error class that
        # every caller of this function already handles.
        raise ProviderUnavailableError(str(error)) from error
    return AssistantModelConfig(
        endpoint=_chat_completions_endpoint(base_url),
        api_key=api_key,
        model=model,
        timeout_ms=_resolve_timeout_ms(os.environ.get(TIMEOUT_ENV)),
    )


def _provider_config(config: AssistantModelConfig) -> ProviderConfig:
    return ProviderConfig(
        provider_id=PROVIDER_ID,
        endpoint=config.endpoint,
        api_key=config.api_key,
        model_id=config.model,
        model_revision=config.model,
        timeout_ms=config.timeout_ms,
    )


def build_descriptor() -> dict[str, Any]:
    """Describe the channel for the client without ever exposing the credential."""

    try:
        config = config_from_environment()
    except ProviderError as error:
        return {
            "schema_version": DESCRIPTOR_SCHEMA_VERSION,
            "protocol": PROTOCOL,
            "availability": "unavailable",
            "configured": False,
            "degradation_state": "misconfigured",
            "detail": str(error),
            "provider": {
                "configured": False,
                "provider_id": "not_configured",
                "model_id": "not_configured",
                "model_revision": "not_configured",
            },
            "limits": _limits(),
        }
    if config is None:
        return {
            "schema_version": DESCRIPTOR_SCHEMA_VERSION,
            "protocol": PROTOCOL,
            "availability": "unavailable",
            "configured": False,
            "degradation_state": "not_configured",
            "detail": "No assistant model channel is configured for this Bridge process.",
            "provider": {
                "configured": False,
                "provider_id": "not_configured",
                "model_id": "not_configured",
                "model_revision": "not_configured",
            },
            "limits": _limits(),
        }
    return {
        "schema_version": DESCRIPTOR_SCHEMA_VERSION,
        "protocol": PROTOCOL,
        "availability": "available",
        "configured": True,
        "degradation_state": "available",
        "detail": "The assistant model channel is configured for this Bridge process.",
        "provider": config.public_identity,
        "limits": _limits(),
    }


def _limits() -> dict[str, Any]:
    return {
        "maximum_instruction_characters": MAXIMUM_INSTRUCTION_CHARACTERS,
        "maximum_settings": MAXIMUM_SETTINGS,
    }


def _extract_model_identities(reply: dict[str, Any]) -> list[str]:
    """Read the identities out of an OpenAI-compatible ``/v1/models`` document.

    Only the ``id`` of each entry is read, and an entry this module cannot read is skipped rather than
    repaired.  A catalogue with no readable identity is refused, because an empty list would be
    indistinguishable from a service that publishes nothing and would silently empty the panel.
    """

    data = reply.get("data")
    if not isinstance(data, list):
        raise ProviderStructuredOutputError("The model service did not publish a model list.")
    identities: list[str] = []
    seen: set[str] = set()
    for entry in data:
        candidate = entry.get("id") if isinstance(entry, dict) else entry
        if not isinstance(candidate, str):
            continue
        identity = candidate.strip()
        if not identity or identity in seen or len(identity) > MAXIMUM_MODEL_ID_CHARACTERS:
            continue
        seen.add(identity)
        identities.append(identity)
        if len(identities) >= MAXIMUM_MODEL_IDENTITIES:
            break
    if not identities:
        raise ProviderStructuredOutputError("The model service published no model identity.")
    return identities


def build_catalogue(*, transport=None) -> dict[str, Any]:
    """Read the model identities the configured service publishes.

    The read uses the credential the channel already holds, so the key stays inside this process and
    never reaches a browser.  Nothing is cached: the caller decides when a refresh is worth a request.
    """

    config = require_channel()
    send = transport if transport is not None else get_json
    reply = send(_provider_config(config), _models_endpoint(config.endpoint))
    models = _extract_model_identities(reply)
    return {
        "schema_version": CATALOGUE_SCHEMA_VERSION,
        "protocol": PROTOCOL,
        "provider_id": PROVIDER_ID,
        "models": models,
        "count": len(models),
        "selected_model": config.model,
        "session_override": _session_model is not None,
    }


def select_model(raw: Any) -> dict[str, Any]:
    """Make one model identity the identity this process will use from the next request on.

    The choice is **session-scoped on purpose**.  The saved configuration belongs to the launcher, and
    this module never writes it, so the reply states plainly that nothing was persisted: a panel
    selection is a live experiment, and the launcher remains where an identity is made permanent.
    Nothing here writes a document and nothing here creates a run.
    """

    model = validate_model_id(raw)
    previous = require_channel().model
    select_session_model(model)
    return {
        "schema_version": SELECTION_SCHEMA_VERSION,
        "protocol": PROTOCOL,
        "provider_id": PROVIDER_ID,
        "selected_model": model,
        "previous_model": previous,
        "in_force": True,
        "persisted": False,
        "session_only": True,
    }


def validate_instruction(raw: Any) -> str:
    if not isinstance(raw, str):
        raise ValueError("The instruction must be one string.")
    instruction = raw.strip()
    if not instruction:
        raise ValueError("The instruction cannot be empty.")
    if len(instruction) > MAXIMUM_INSTRUCTION_CHARACTERS:
        raise ValueError(
            f"The instruction must be at most {MAXIMUM_INSTRUCTION_CHARACTERS} characters."
        )
    return instruction


def validate_conversation(raw: Any) -> list[dict[str, str]]:
    """Validate the multi-turn transcript the client replays.

    Only the two conversational roles are accepted: a client cannot inject a system message, so the
    catalogue and the policy stay owned by this module.  The transcript must end with the user's turn,
    because it is the question the model is being asked to answer.
    """

    if not isinstance(raw, list) or not raw:
        raise ValueError("The conversation must be a non-empty list of messages.")
    if len(raw) > MAXIMUM_CONVERSATION_MESSAGES:
        raise ValueError(
            f"The conversation must carry at most {MAXIMUM_CONVERSATION_MESSAGES} messages."
        )
    messages: list[dict[str, str]] = []
    total = 0
    for candidate in raw:
        if not isinstance(candidate, dict):
            raise ValueError("Every conversation message must be one object.")
        role = candidate.get("role")
        if role not in CONVERSATION_ROLES:
            raise ValueError("Every conversation message must use the user or the assistant role.")
        content = candidate.get("content")
        if not isinstance(content, str):
            raise ValueError("Every conversation message must carry textual content.")
        content = content.strip()
        if not content:
            raise ValueError("A conversation message cannot be empty.")
        if len(content) > MAXIMUM_INSTRUCTION_CHARACTERS:
            raise ValueError(
                f"Every conversation message must be at most {MAXIMUM_INSTRUCTION_CHARACTERS} characters."
            )
        total += len(content)
        if total > MAXIMUM_CONVERSATION_CHARACTERS:
            raise ValueError(
                f"The conversation must be at most {MAXIMUM_CONVERSATION_CHARACTERS} characters in total."
            )
        messages.append({"role": role, "content": content})
    if messages[-1]["role"] != "user":
        raise ValueError("The conversation must end with one user message.")
    return messages


def validate_panel_values(raw: Any) -> dict[str, str]:
    """Validate the current panel values the client attaches as context.

    These are shown to the model as text and are never executed, ranged-checked, or written anywhere, so
    the check here is structural: a bounded set of short bare parameter names with short scalar values.
    A value the user never set simply does not appear.
    """

    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise ValueError("The panel values must be one object.")
    if len(raw) > MAXIMUM_PANEL_VALUES:
        raise ValueError(f"At most {MAXIMUM_PANEL_VALUES} panel values may be sent.")
    values: dict[str, str] = {}
    for key, value in raw.items():
        if not isinstance(key, str) or not PANEL_VALUE_KEY_PATTERN.match(key):
            raise ValueError("A panel value key must be a short parameter name.")
        if not isinstance(value, str) or len(value) > MAXIMUM_PANEL_VALUE_CHARACTERS:
            raise ValueError(
                f"A panel value must be a string of at most {MAXIMUM_PANEL_VALUE_CHARACTERS} characters."
            )
        values[key] = value.strip()
    return values


def require_channel() -> AssistantModelConfig:
    """Return the channel configuration, refusing the request when the channel is not configured.

    Called before a stream starts so an unconfigured Bridge answers with one ordinary error response
    instead of an event stream that immediately carries an error.
    """

    config = config_from_environment()
    if config is None:
        raise ProviderUnavailableError("No assistant model channel is configured.")
    return config



def _final_message_content(reply: Any) -> tuple[str, str]:
    """Return ``(served_model, content)``.

    A reasoning trace is not read here on purpose: it is dropped rather than returned, so it can never be
    persisted, echoed to the client, or written to a log line.
    """

    if not isinstance(reply, dict):
        raise ProviderStructuredOutputError("The assistant model did not return one JSON object.")
    choices = reply.get("choices")
    if not isinstance(choices, list) or len(choices) != 1 or not isinstance(choices[0], dict):
        raise ProviderStructuredOutputError("The assistant model did not return one completion choice.")
    message = choices[0].get("message")
    if not isinstance(message, dict) or message.get("role") != "assistant":
        raise ProviderStructuredOutputError("The assistant model did not return one assistant message.")
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise ProviderStructuredOutputError("The assistant model returned an empty answer.")
    served_model = reply.get("model")
    return (served_model if isinstance(served_model, str) else "", content.strip())


def _strip_code_fence(content: str) -> str:
    text = content.strip()
    if not text.startswith("```"):
        return text
    lines = text.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip().startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()


def _parse_plan_object(content: str) -> dict[str, Any]:
    try:
        parsed = json.loads(_strip_code_fence(content))
    except json.JSONDecodeError as error:
        raise ProviderStructuredOutputError(
            "The assistant model answer was not one strict JSON object."
        ) from error
    if not isinstance(parsed, dict):
        raise ProviderStructuredOutputError("The assistant model answer was not one JSON object.")
    return parsed


def _clip(value: Any, limit: int) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()[:limit]


def _normalize_value(rule: ParameterRule, raw: Any) -> tuple[str | None, str | None]:
    """Return ``(canonical_value, rejection_reason)`` for one proposed parameter value."""

    if raw is None or isinstance(raw, (dict, list)):
        return None, "value_not_scalar"
    if rule.enum_values:
        if isinstance(raw, bool):
            return None, "value_not_scalar"
        candidate = raw if isinstance(raw, str) else str(raw)
        candidate = candidate.strip()
        if candidate not in rule.enum_values:
            return None, "value_outside_enum"
        return candidate, None
    if rule.value_type == "boolean":
        # A JSON boolean and the two words are the same answer; anything else is
        # refused rather than coerced, because guessing here would flip a switch
        # the caller never named.
        if isinstance(raw, bool):
            return ("true" if raw else "false"), None
        text = (raw if isinstance(raw, str) else str(raw)).strip().lower()
        if text in {"true", "1", "yes"}:
            return "true", None
        if text in {"false", "0", "no"}:
            return "false", None
        return None, "value_not_boolean"
    if rule.value_type == "string":
        if not isinstance(raw, str):
            return None, "value_not_text"
        if rule.max_length is not None and len(raw) > rule.max_length:
            return None, "value_too_long"
        return raw, None
    if isinstance(raw, bool):
        return None, "value_not_scalar"
    try:
        numeric = float(raw if isinstance(raw, (int, float)) else str(raw).strip())
    except (TypeError, ValueError):
        return None, "value_not_numeric"
    if numeric != numeric or numeric in {float("inf"), float("-inf")}:
        return None, "value_not_finite"
    if rule.integer_only and not numeric.is_integer():
        return None, "value_not_integer"
    if rule.minimum is not None and numeric < rule.minimum:
        return None, "value_below_minimum"
    if rule.maximum is not None and numeric > rule.maximum:
        return None, "value_above_maximum"
    return _format_number(numeric), None


def _validated_plan(proposal: dict[str, Any]) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    """Bind a model's settings block to the surface, dropping what it cannot mean.

    The address a model wrote is resolved against the surface and reported back
    in its canonical document-relative form, so the page receives the address it
    publishes even when the model shortened it.  A key the surface does not
    carry, or an element address with no index, is dropped with that reason
    instead of being repaired.
    """

    settings: list[dict[str, str]] = []
    dropped: list[dict[str, str]] = []
    seen: set[str] = set()
    raw_settings = proposal.get("settings")
    if not isinstance(raw_settings, list):
        return settings, dropped
    for candidate in raw_settings:
        if not isinstance(candidate, dict):
            continue
        raw_key = candidate.get("key")
        if not isinstance(raw_key, str) or not raw_key.strip():
            continue
        resolution = parameter_surface.resolve_address(raw_key)
        if resolution.address is None or not resolution.path:
            dropped.append({"key": raw_key.strip(), "reason": resolution.reason or "unknown_parameter"})
            continue
        key = resolution.path
        rule = PARAMETER_RULES.get(resolution.address.path)
        if rule is None:
            dropped.append({"key": key, "reason": "unknown_parameter"})
            continue
        if key in seen:
            continue
        value, reason = _normalize_value(rule, candidate.get("value"))
        if reason is not None or value is None:
            dropped.append({"key": key, "reason": reason or "value_not_scalar"})
            continue
        if len(settings) >= MAXIMUM_SETTINGS:
            dropped.append({"key": key, "reason": "settings_limit_exceeded"})
            continue
        seen.add(key)
        settings.append({"key": key, "value": value, "why": _clip(candidate.get("why"), MAXIMUM_REASON_CHARACTERS)})
    return settings, dropped


def _delta_content(chunk: Any) -> str:
    """Return the visible answer delta of one upstream chunk, or an empty string.

    Only ``choices[].delta.content`` is read.  A streamed reasoning delta
    (``delta.reasoning_content`` / ``delta.reasoning``) is deliberately ignored rather than read and
    dropped: it is never returned to the client, never written to a log line, and never stored.
    """

    if not isinstance(chunk, dict):
        return ""
    choices = chunk.get("choices")
    if not isinstance(choices, list):
        return ""
    parts: list[str] = []
    for choice in choices:
        if not isinstance(choice, dict):
            continue
        delta = choice.get("delta")
        if not isinstance(delta, dict):
            continue
        content = delta.get("content")
        if isinstance(content, str) and content:
            parts.append(content)
    return "".join(parts)


def iter_completion_chunks(config: AssistantModelConfig, payload: dict) -> Iterator[dict]:
    """Yield the parsed upstream stream chunks of one assistant-model request.

    The upstream reply is one server-sent-event stream of OpenAI-compatible chat-completion chunks; this
    reader turns each ``data:`` line into the object it carries.  Nothing is accumulated here, so the
    caller can forward a delta before the next one has arrived.
    """

    response = open_json_stream(_provider_config(config), payload)
    try:
        if response.headers.get_content_type() != "text/event-stream":
            raise ProviderStructuredOutputError("The assistant model did not answer with a stream.")
        try:
            for raw_line in response:
                line = raw_line.decode("utf-8", errors="replace").strip()
                if not line or line.startswith(":") or not line.startswith("data:"):
                    continue
                data = line[len("data:") :].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue
                if isinstance(chunk, dict):
                    yield chunk
        except (TimeoutError, OSError) as error:
            if isinstance(error, TimeoutError):
                raise ProviderTimeoutError("The assistant model timed out mid-answer.") from error
            raise ProviderUnavailableError("The assistant model stream was interrupted.") from error
    finally:
        try:
            response.close()
        except OSError:
            pass


def _visible_prose(answer: str) -> str:
    """The prose part of an answer that is still arriving.

    A settings block is opened by a fence, so everything after the fence belongs to the plan rather than
    to the readable answer.  A trailing run of backticks is held back because it may be the first half of
    a fence split across two deltas; it is released as soon as the next delta shows it was prose after
    all.

    Trailing whitespace is trimmed for the same reason the finished answer trims it: the newline that a
    fence pushed in front of it is layout, not prose, and trimming here keeps the streamed text identical
    to the prose the plan is bound to instead of emitting one phantom delta that only adds a line break.
    """

    fence = answer.find(SETTINGS_FENCE)
    if fence >= 0:
        return answer[:fence].rstrip()
    without_trailing_backticks = answer.rstrip("`")
    return answer[: len(without_trailing_backticks)].rstrip()


def _split_prose_and_settings(answer: str) -> tuple[str, str | None]:
    """Split a finished answer into ``(prose, settings_text)``.

    ``settings_text`` is ``None`` when the answer carried no settings block at all - the model simply
    answered in prose - and an empty string when a block was opened but never closed.
    """

    fence = answer.find(SETTINGS_FENCE)
    if fence < 0:
        return answer.strip(), None
    prose = answer[:fence].strip()
    remainder = answer[fence + len(SETTINGS_FENCE) :]
    newline = remainder.find("\n")
    if newline < 0:
        return prose, ""
    remainder = remainder[newline + 1 :]
    closing = remainder.find(SETTINGS_FENCE)
    if closing >= 0:
        remainder = remainder[:closing]
    return prose, remainder.strip()


def _plan_from_answer(
    *,
    config: AssistantModelConfig,
    settings_text: str | None,
    served_model: str,
    instruction: str,
) -> dict[str, Any]:
    """Bind a finished streamed answer into one validated plan.

    An unreadable settings block is reported as ``settings_unparsed`` rather than repaired, and a prose
    answer with no settings block is ``prose_only``: in both cases no parameter is proposed, because a
    value this module could not read must never reach the panel.
    """

    proposal: dict[str, Any] = {}
    answer_state = "prose_only"
    if settings_text is not None and settings_text.strip():
        answer_state = "settings_unparsed"
        try:
            proposal = _parse_plan_object(settings_text)
        except ProviderStructuredOutputError:
            proposal = {}
        else:
            if isinstance(proposal.get("settings"), list):
                answer_state = "settings"
    settings, dropped = _validated_plan(proposal)
    return {
        "schema_version": PLAN_SCHEMA_VERSION,
        "protocol": PROTOCOL,
        "provider_id": PROVIDER_ID,
        "model_id": config.model,
        "served_model": served_model,
        "instruction": instruction,
        "answer_state": answer_state,
        "title": _clip(proposal.get("title"), MAXIMUM_TITLE_CHARACTERS),
        "rationale": _clip(proposal.get("rationale"), MAXIMUM_RATIONALE_CHARACTERS),
        "settings": settings,
        "dropped": dropped,
        "applied": False,
        "executed": False,
    }


def _conversation_payload(
    conversation: list[dict[str, str]],
    panel_values: dict[str, str],
) -> list[dict[str, str]]:
    """Build the upstream message list: the system prompt plus the replayed transcript.

    The parameter catalogue is owned by this module and the current panel values are read-only context,
    so both travel in the system message - the user turns are replayed exactly as the client sent them.
    """

    context = "可用参数清单：\n" + parameter_catalogue_text()
    # The cap travels with the catalogue so a model can spend its budget instead of losing entries to
    # it: an entry dropped for being one over the limit is invisible to the reader of the answer.
    context += f"\n\n一次最多给出 {MAXIMUM_SETTINGS} 条设置，超出的会被丢弃；请挑影响最大的写。"
    if panel_values:
        lines = "\n".join(f"- {key} = {value}" for key, value in panel_values.items())
        context += (
            "\n\n当前面板的取值（未列出的参数表示未设置，或该参数在当前页面不可用）：\n" + lines
        )
    messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT + context}]
    messages.extend({"role": turn["role"], "content": turn["content"]} for turn in conversation)
    return messages


def stream_events(
    conversation: list[dict[str, str]],
    panel_values: dict[str, str],
    *,
    transport=None,
) -> Iterator[tuple[str, dict[str, Any]]]:
    """Answer one conversation turn as a stream of ``(event_name, payload)`` pairs.

    The events are ``prose`` (the readable answer so far, re-sent in full on every delta so a client
    never has to reassemble deltas), ``plan`` (the validated plan of a finished answer) and nothing else:
    failures are raised and turned into one ``error`` event by the caller, which keeps the transport
    mapping in the HTTP layer instead of here.
    """

    config = require_channel()
    send = transport if transport is not None else iter_completion_chunks
    payload = {
        "model": config.model,
        "messages": _conversation_payload(conversation, panel_values),
        "stream": True,
    }
    answer = ""
    emitted = 0
    served_model = ""
    for chunk in send(config, payload):
        model_id = chunk.get("model")
        if isinstance(model_id, str) and model_id:
            served_model = model_id
        delta = _delta_content(chunk)
        if not delta:
            continue
        answer += delta
        if len(answer) > MAXIMUM_ANSWER_CHARACTERS:
            answer = answer[:MAXIMUM_ANSWER_CHARACTERS]
            break
        visible = _visible_prose(answer)
        if len(visible) > emitted:
            emitted = len(visible)
            yield ("prose", {"schema_version": CHAT_SCHEMA_VERSION, "text": visible})

    # The very last delta may have released a backtick that was held back while it could still have
    # been the start of a fence, so the final prose is emitted once more when it grew.
    prose, settings_text = _split_prose_and_settings(answer)
    if len(prose) > emitted:
        yield ("prose", {"schema_version": CHAT_SCHEMA_VERSION, "text": prose})
    yield (
        "plan",
        _plan_from_answer(
            config=config,
            settings_text=settings_text,
            served_model=served_model,
            instruction=conversation[-1]["content"],
        ),
    )


def plan(instruction: str, *, transport=None) -> dict[str, Any]:
    """Ask the model for one scenario plan and validate it against the parameter catalogue."""

    config = config_from_environment()
    if config is None:
        raise ProviderUnavailableError("No assistant model channel is configured.")
    send = transport if transport is not None else post_json
    payload = {
        "model": config.model,
        "messages": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT
                + "\n\n可用参数清单：\n"
                + parameter_catalogue_text()
                + f"\n\n一次最多给出 {MAXIMUM_SETTINGS} 条设置，超出的会被丢弃；请挑影响最大的写。",
            },
            {"role": "user", "content": "场景：" + instruction},
        ],
        "response_format": {"type": "json_object"},
        "stream": False,
    }
    reply = send(_provider_config(config), payload)
    served_model, content = _final_message_content(reply)
    proposal = _parse_plan_object(content)
    settings, dropped = _validated_plan(proposal)
    return {
        "schema_version": PLAN_SCHEMA_VERSION,
        "protocol": PROTOCOL,
        "provider_id": PROVIDER_ID,
        "model_id": config.model,
        "served_model": served_model,
        "instruction": instruction,
        # A one-shot reply is nothing but the settings object, so there is no separate prose answer.
        "answer_state": "settings",
        "title": _clip(proposal.get("title"), MAXIMUM_TITLE_CHARACTERS),
        "rationale": _clip(proposal.get("rationale"), MAXIMUM_RATIONALE_CHARACTERS),
        "settings": settings,
        "dropped": dropped,
        "applied": False,
        "executed": False,
    }
