"""Candidate generation boundary for automatic exploration.

The local phase deliberately uses a deterministic scanner.  The optional
model adapter implements the same interface, but it can only return a closed
structured parameter change set and is never the default.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
import copy
import hashlib
import json
import math
from typing import Any, Mapping, Protocol

from agent_harness.contracts import canonical_sha256, validate_document
from providers.assistant_model import AssistantModelCandidateProvider


MODEL_CANDIDATE_CONTRACT_REVISION = "2026-11-02.wpi.v1"
MODEL_CANDIDATE_SCHEMA_IDENTITY = "tilesim.agent_harness.exploration_model_candidate.v1"
MODEL_CONTEXT_SCHEMA_IDENTITY = "tilesim.agent_harness.exploration_model_context.v1"
MODEL_CANDIDATE_MODE_ENV = "TILESIM_EXPLORATION_MODEL_CANDIDATES"
MODEL_CANDIDATE_MODE_ENV_ALIAS = "TILESIM_AGENT_EXPLORATION_MODEL_CANDIDATES"
NORMALIZED_MODEL_CANDIDATE_REASON = "模型根据已授权历史结果生成下一候选"


class ModelCandidateError(ValueError):
    """A model proposal could not be accepted at the candidate boundary."""


def model_candidate_mode_enabled(environ: Mapping[str, str] | None = None) -> bool:
    """Return the explicit opt-in state without reading assistant credentials."""

    values = environ if environ is not None else __import__("os").environ
    return any(
        values.get(name, "").strip().lower() in {"1", "true", "on", "yes"}
        for name in (MODEL_CANDIDATE_MODE_ENV, MODEL_CANDIDATE_MODE_ENV_ALIAS)
    )


class ModelCandidateProvider(Protocol):
    """Small injection point for a structured model adapter.

    The provider receives a redacted, immutable context projection and must
    return the closed proposal DTO.  It never receives an executor, shell,
    path, URL, or tool handle.
    """

    def generate(self, context: Mapping[str, Any]) -> Mapping[str, Any]: ...


def build_model_context(state: Mapping[str, Any]) -> dict[str, Any]:
    """Build the only context a model candidate provider is allowed to see."""

    objective = state.get("objective") if isinstance(state.get("objective"), Mapping) else {}
    budget = state.get("budget") if isinstance(state.get("budget"), Mapping) else {}
    candidates = [
        dict(item)
        for item in state.get("deployment_candidates", [])
        if isinstance(item, Mapping)
        and item.get("published") is True
        and item.get("executable") is True
        and item.get("status", "published") == "published"
        and _deployment_matches_fixed_resources(state, item)
    ]
    grants = [dict(item) for item in state.get("parameter_grants", []) if isinstance(item, Mapping)]
    history: list[dict[str, Any]] = []
    for item in state.get("candidate_history", []):
        if not isinstance(item, Mapping):
            continue
        history.append({
            "candidate_id": item.get("candidate_id"),
            "candidate_digest": item.get("candidate_digest"),
            "run_id": item.get("run_id"),
            "run_idempotency_key": item.get("run_idempotency_key"),
            "sequence": item.get("sequence"),
            "origin": item.get("origin"),
            "config": copy.deepcopy(item.get("config")),
            "changed_fields": copy.deepcopy(item.get("changed_fields", [])),
            "deployment_candidate_id": item.get("deployment_candidate_id"),
            "scenario_id": item.get("scenario_id"),
            "candidate_summary": copy.deepcopy(item.get("candidate_summary") or item.get("deployment_candidate_summary")),
            "run_strategy": copy.deepcopy(item.get("run_strategy")),
            "scenario_results": copy.deepcopy((item.get("evaluation") or {}).get("scenario_evaluations", []))
            if isinstance(item.get("evaluation"), Mapping) else [],
            "evaluation": copy.deepcopy(item.get("evaluation")),
        })
    summary = state.get("summary") if isinstance(state.get("summary"), Mapping) else {}
    raw_evaluations = state.get("evaluations")
    if not isinstance(raw_evaluations, list):
        raw_evaluations = state.get("candidate_evaluations")
    evaluations = [copy.deepcopy(item) for item in (raw_evaluations if isinstance(raw_evaluations, list) else []) if isinstance(item, Mapping)]
    # During an active loop the final summary has not been materialized yet.
    # Project any ledger rows missing from a partial checkpoint projection so
    # the next model call sees every completed candidate exactly once.
    known_evaluation_ids = {
        item.get("candidate_id")
        for item in evaluations
        if isinstance(item, Mapping) and isinstance(item.get("candidate_id"), str)
    }
    for item in history:
        if item.get("candidate_id") in known_evaluation_ids:
            continue
        evaluation = item.get("evaluation") if isinstance(item.get("evaluation"), Mapping) else {}
        nested = evaluation.get("evaluation") if isinstance(evaluation.get("evaluation"), Mapping) else evaluation
        objective = evaluation.get("objective") if isinstance(evaluation.get("objective"), Mapping) else {}
        if not isinstance(nested, Mapping):
            nested = {}
        evaluations.append({
            **copy.deepcopy(dict(nested)),
            "candidate_id": item.get("candidate_id"),
            "deployment_candidate_id": item.get("deployment_candidate_id"),
            "scenario_results": copy.deepcopy(evaluation.get("scenario_evaluations", [])),
            "objective_value": nested.get("objective_value", objective.get("value")),
            "direction": nested.get("direction", objective.get("direction", "minimize")),
            "eligible": nested.get("eligible", objective.get("eligible", False)) is True,
        })
        known_evaluation_ids.add(item.get("candidate_id"))
    pareto_candidates = copy.deepcopy(summary.get("pareto_candidates", []))
    if not pareto_candidates:
        try:
            from agent_harness.exploration_planning import pareto_front

            pareto_candidates = [
                row.get("candidate_id")
                for row in pareto_front([row for row in evaluations if row.get("eligible") is True])
                if isinstance(row, Mapping) and isinstance(row.get("candidate_id"), str)
            ]
        except (ImportError, KeyError, TypeError, ValueError):
            # Context construction must remain bounded even when an older
            # checkpoint has an incomplete evaluation projection.
            pareto_candidates = []
    used_model_calls = int(state.get("model_calls", 0) or 0)
    used_runs = int(state.get("run_count", 0) or 0)
    remaining = {
        "rounds": max(0, int(budget.get("max_rounds", 0) or 0) - int(state.get("round_count", 0) or 0)),
        "runs": max(0, int(budget.get("max_runs", 0) or 0) - used_runs),
        "model_calls": max(0, int(budget.get("max_model_calls", 0) or 0) - used_model_calls),
        "tool_calls_this_round": max(0, int(budget.get("max_tool_calls_per_round", 0) or 0) - int(state.get("tool_calls_this_round", 0) or 0)),
    }
    context = _redact_model_context({
        "schema_identity": MODEL_CONTEXT_SCHEMA_IDENTITY,
        "contract_revision": MODEL_CANDIDATE_CONTRACT_REVISION,
        "schema_set_revision": state.get("schema_set_revision"),
        "fixed_resources": copy.deepcopy(state.get("fixed_resources") or (state.get("context_snapshot") or {}).get("fixed_resources", {})),
        "deployment_candidates": candidates,
        "authorized_parameter_grants": grants,
        "run_strategy": copy.deepcopy(state.get("run_strategy")),
        "workload_scenarios": copy.deepcopy(state.get("workload_scenarios", [])),
        "executed_candidates": history,
        "candidate_evaluations": copy.deepcopy(evaluations),
        "current_best": {
            "candidate_id": state.get("best_candidate_id"),
            "value": state.get("best_value"),
        },
        "pareto_candidates": pareto_candidates,
        "remaining_budget": remaining,
        "objective": copy.deepcopy(objective),
    })
    # A digest is useful for audit records and makes context replay explicit.
    context["context_digest"] = canonical_sha256({key: value for key, value in context.items() if key != "context_digest"})
    validate_document(
        "exploration_model_context",
        context,
        expected_schema_set_revision=state.get("schema_set_revision"),
    )
    return context


def _contains_forbidden(value: Any) -> bool:
    forbidden = {
        "model", "model_name", "model_id", "device", "device_type", "gpu", "gpu_type", "gpu_count",
        "tensor_parallel", "pipeline_parallel", "expert_parallel", "physical_kv", "kv_policy",
        "collective_algorithm", "profile", "shell", "path", "url", "tool", "command",
    }
    if isinstance(value, Mapping):
        return any(str(key).lower() in forbidden or _contains_forbidden(item) for key, item in value.items())
    if isinstance(value, list):
        return any(_contains_forbidden(item) for item in value)
    return False


def _redact_model_context(value: Any) -> Any:
    """Remove execution handles from the provider projection."""

    forbidden_keys = {
        "shell", "path", "url", "uri", "href", "endpoint", "base_url", "tool", "tool_call",
        "tool_calls", "command", "cli", "executable_path",
    }
    if isinstance(value, Mapping):
        return {
            str(key): _redact_model_context(item)
            for key, item in value.items()
            if str(key).lower() not in forbidden_keys
        }
    if isinstance(value, list):
        return [_redact_model_context(item) for item in value]
    return copy.deepcopy(value)


def _published_deployment(state: Mapping[str, Any], candidate_id: Any) -> dict[str, Any] | None:
    if not isinstance(candidate_id, str) or not candidate_id:
        return None
    for item in state.get("deployment_candidates", []):
        if (
            isinstance(item, Mapping)
            and item.get("candidate_id") == candidate_id
            and item.get("published") is True
            and item.get("executable") is True
            and item.get("status", "published") == "published"
        ):
            return copy.deepcopy(dict(item))
    return None


def _apply_changes(base: Any, changes: Mapping[str, Any]) -> Any:
    result = copy.deepcopy(base)
    for pointer, value in changes.items():
        tokens = str(pointer).lstrip("/").split("/")
        cursor = result
        for token in tokens[:-1]:
            token = token.replace("~1", "/").replace("~0", "~")
            cursor = cursor[int(token)] if isinstance(cursor, list) else cursor[token]
        leaf = tokens[-1].replace("~1", "/").replace("~0", "~")
        if isinstance(cursor, list):
            cursor[int(leaf)] = copy.deepcopy(value)
        else:
            cursor[leaf] = copy.deepcopy(value)
    return result


def _pointer_value(document: Any, pointer: str) -> tuple[bool, Any]:
    """Read one RFC 6901 pointer without creating or mutating state."""

    if not isinstance(pointer, str) or not pointer.startswith("/"):
        return False, None
    current = document
    for raw_token in pointer[1:].split("/"):
        token = raw_token.replace("~1", "/").replace("~0", "~")
        if isinstance(current, Mapping):
            if token not in current:
                return False, None
            current = current[token]
        elif isinstance(current, list):
            try:
                index = int(token)
            except (TypeError, ValueError):
                return False, None
            if index < 0 or index >= len(current):
                return False, None
            current = current[index]
        else:
            return False, None
    return True, current


def _value_allowed(value: Any, grant: Mapping[str, Any]) -> bool:
    """Mirror the domain grant check before a model proposal is materialized."""

    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    try:
        numeric = float(value)
        minimum = float(grant["min"])
        maximum = float(grant["max"])
        step = float(grant["step"])
    except (KeyError, TypeError, ValueError):
        return False
    if not all(math.isfinite(item) for item in (numeric, minimum, maximum, step)):
        return False
    if grant.get("kind") in {"int", "integer"} and (not isinstance(value, int) or isinstance(value, bool)):
        return False
    if not minimum <= numeric <= maximum or step <= 0:
        return False
    offset = (numeric - minimum) / step
    return abs(offset - round(offset)) <= 1e-9


def _deployment_matches_fixed_resources(state: Mapping[str, Any], deployment: Mapping[str, Any] | None) -> bool:
    """Reject a published candidate whose declared binding contradicts the plan."""

    if not isinstance(deployment, Mapping):
        return True
    fixed = state.get("fixed_resources")
    binding = deployment.get("resource_binding")
    if not isinstance(fixed, Mapping) or not isinstance(binding, Mapping):
        return True
    aliases = {
        "model": ("model", "model_id", "model_name"),
        "engine": ("engine", "engine_id", "inference_engine"),
        "gpu_type": ("gpu_type", "device_type", "accelerator"),
        "gpu_count": ("gpu_count", "device_count", "cards"),
    }
    for canonical, names in aliases.items():
        fixed_value = next((fixed[name] for name in names if name in fixed), None)
        binding_value = next((binding[name] for name in names if name in binding), None)
        if fixed_value is not None and binding_value is not None and fixed_value != binding_value:
            return False
    return True


def _candidate_digest(state: Mapping[str, Any], changes: Mapping[str, Any], deployment: Mapping[str, Any] | None, run_strategy: Mapping[str, Any] | None) -> str:
    return canonical_sha256({
        "session_id": state.get("session_id"),
        "config": _apply_changes(state.get("base_config", {}), changes),
        "deployment_candidate_id": deployment.get("candidate_id") if isinstance(deployment, Mapping) else None,
        "run_strategy": copy.deepcopy(dict(run_strategy)) if isinstance(run_strategy, Mapping) else None,
    })


class CandidateGenerator(ABC):
    @abstractmethod
    def generate(self, state: Mapping[str, Any]) -> dict[str, Any]: ...


class DeterministicCandidateGenerator(CandidateGenerator):
    """Bounded parameter scan used by the local synthetic runtime."""

    source = "确定性扫描"

    def generate(self, state: Mapping[str, Any]) -> dict[str, Any]:
        # Deployment planning is a capability projection.  When present, the
        # published candidates and the frozen strategy are the outer scan
        # dimensions; the parameter grants still decide which request fields
        # may change.  This keeps model text and arbitrary topology out of the
        # execution path.
        raw_deployments = state.get("deployment_candidates")
        deployments = [
            item for item in state.get("deployment_candidates", [])
            if isinstance(item, Mapping)
            and item.get("published") is True
            and item.get("executable") is True
            and item.get("status", "published") == "published"
            and _deployment_matches_fixed_resources(state, item)
        ]
        if isinstance(raw_deployments, list) and not deployments:
            return {"available": False, "source": self.source, "reason": "能力目录没有与固定资源匹配的已发布且可执行部署候选"}
        if deployments:
            strategies = state.get("run_strategies")
            explicit_strategy = isinstance(state.get("run_strategy"), Mapping) or isinstance(strategies, list)
            if not isinstance(strategies, list) or not strategies:
                strategy = state.get("run_strategy")
                strategies = [strategy] if isinstance(strategy, Mapping) else [{}]
            attempted = {
                str(item.get("combination_key"))
                for item in state.get("candidate_history", [])
                if isinstance(item, Mapping) and item.get("combination_key")
            }
            grants = state.get("parameter_grants") or []
            aliases = {
                "batch_scheduler": ("batch_scheduler", "scheduler"),
                "max_batch_size": ("max_batch_size",),
                "kv_cache_capacity_tokens": ("kv_cache_capacity_tokens", "kv_cache_capacity"),
                "message_size_multiplier": ("message_size_multiplier",),
            }
            for deployment in deployments:
                deployment_id = deployment.get("candidate_id")
                if not isinstance(deployment_id, str) or not deployment_id:
                    continue
                for strategy in strategies:
                    strategy = dict(strategy) if isinstance(strategy, Mapping) else {}
                    strategy_values = {key: value for key, value in strategy.items() if key not in {"schema_identity", "contract_revision", "schema_set_revision"}}
                    possible_changes: list[dict[str, Any]] = []
                    if not explicit_strategy:
                        # Compatibility path for the original authorized
                        # parameter scanner: enumerate every value for each
                        # published deployment before moving to the next one.
                        for grant in grants:
                            pointer = grant.get("pointer") if isinstance(grant, Mapping) else None
                            if not isinstance(pointer, str):
                                continue
                            current_value = state["base_config"]
                            for token in pointer.strip("/").split("/"):
                                current_value = current_value[int(token)] if isinstance(current_value, list) else current_value[token]
                            span = max(1, int(round((grant["max"] - grant["min"]) / grant["step"])))
                            values = [grant["min"] + index * grant["step"] for index in range(span + 1)]
                            ordered = list(reversed(values)) if state["objective"]["direction"] == "minimize" else values
                            possible_changes.extend({pointer: next_value} for next_value in ordered if next_value != current_value)
                    else:
                        changes: dict[str, Any] = {}
                        for strategy_key, strategy_value in strategy_values.items():
                            for grant in grants:
                                pointer = grant.get("pointer") if isinstance(grant, Mapping) else None
                                if isinstance(pointer, str) and pointer.rsplit("/", 1)[-1] in aliases.get(strategy_key, (strategy_key,)):
                                    changes[pointer] = strategy_value
                                    break
                        possible_changes = [changes] if changes else []
                    for changes in possible_changes:
                        if _candidate_digest(state, changes, deployment, strategy) in {
                            str(item.get("candidate_digest"))
                            for item in state.get("candidate_history", [])
                            if isinstance(item, Mapping) and item.get("candidate_digest")
                        }:
                            continue
                        combination_key = "deployment:" + deployment_id + ":strategy:" + hashlib.sha256(json.dumps({**strategy_values, "changes": changes}, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
                        if combination_key in attempted:
                            continue
                        if changes:
                            return {
                            "available": True,
                            "source": self.source,
                            "changes": changes,
                            "deployment_candidate": copy.deepcopy(dict(deployment)),
                            "run_strategy": copy.deepcopy(strategy),
                            "combination_key": combination_key,
                            "reason": "按后端已发布部署候选、已确认工作负载策略和授权运行参数确定性扫描",
                        }
        grants = state.get("parameter_grants") or []
        current = state["base_config"]
        attempted: set[str] = set()
        for prior in state.get("candidate_history", []):
            if isinstance(prior, Mapping):
                attempted.add(repr(prior.get("config", {})))
        for grant in grants:
            pointer = grant["pointer"]
            value = current
            for token in pointer.strip("/").split("/"):
                value = value[int(token)] if isinstance(value, list) else value[token]
            span = max(1, int(round((grant["max"] - grant["min"]) / grant["step"])))
            values = [grant["min"] + index * grant["step"] for index in range(span + 1)]
            ordered = list(reversed(values)) if state["objective"]["direction"] == "minimize" else values
            for next_value in ordered:
                if next_value == value:
                    continue
                config = copy.deepcopy(current)
                cursor = config
                tokens = pointer.strip("/").split("/")
                for token in tokens[:-1]:
                    cursor = cursor[int(token)] if isinstance(cursor, list) else cursor[token]
                leaf = tokens[-1]
                if isinstance(cursor, list):
                    cursor[int(leaf)] = next_value
                else:
                    cursor[leaf] = next_value
                if repr(config) not in attempted:
                    return {
                        "available": True,
                        "source": self.source,
                        "changes": {pointer: next_value},
                        "reason": "在全部已授权参数范围内按确定性顺序扫描",
                    }
        if not grants:
            return {"available": False, "source": self.source, "reason": "没有未尝试的参数值"}
        return {"available": False, "source": self.source, "reason": "没有未尝试的参数值"}


class ModelCandidateGenerator(CandidateGenerator):
    """Structured model proposal adapter with deterministic fallback.

    Instantiating this class is the explicit opt-in.  The graph's default
    generator remains :class:`DeterministicCandidateGenerator`.  A provider
    proposal is never passed directly to the domain state machine: this class
    resolves the deployment reference, checks the closed proposal shape and
    returns only authorized JSON-pointer changes.
    """

    source = "模型辅助候选"
    uses_model = True

    def __init__(
        self,
        provider: ModelCandidateProvider,
        *,
        fallback: CandidateGenerator | None = None,
        schema_set_revision: str | None = None,
    ) -> None:
        if callable(getattr(provider, "generate", None)):
            self.provider = provider
        elif callable(provider):
            self.provider = type("CallableModelProvider", (), {"generate": staticmethod(provider)})()
        else:
            raise TypeError("model candidate provider must expose generate(context)")
        self.fallback = fallback or DeterministicCandidateGenerator()
        self.schema_set_revision = schema_set_revision

    def _fallback(self, state: Mapping[str, Any], reason: str) -> dict[str, Any]:
        try:
            result = dict(self.fallback.generate(state))
        except Exception as error:
            return {
                "available": False,
                "source": getattr(self.fallback, "source", "确定性扫描"),
                "reason": "确定性候选生成器不可用",
                "fallback_from_model": True,
                "model_failure_reason": reason,
                "fallback_failure_reason": str(error),
            }
        result.setdefault("fallback_from_model", True)
        result.setdefault("model_failure_reason", reason)
        return result

    def _validate_proposal(self, state: Mapping[str, Any], raw: Mapping[str, Any], context: Mapping[str, Any]) -> dict[str, Any]:
        if not isinstance(raw, Mapping):
            raise ModelCandidateError("model proposal must be an object")
        required = {"schema_identity", "contract_revision", "schema_set_revision", "deployment_candidate_id", "changes", "reason", "source"}
        missing = sorted(required - set(raw))
        if missing:
            raise ModelCandidateError(f"model proposal is missing a required field: {missing[0]}")
        allowed = {
            "schema_identity", "contract_revision", "schema_set_revision", "deployment_candidate_id",
            "changes", "reason", "source",
        }
        unknown = sorted(set(raw) - allowed)
        if unknown:
            raise ModelCandidateError(f"model proposal contains an unknown field: {unknown[0]}")
        normalized_raw = {
            "schema_identity": raw.get("schema_identity", MODEL_CANDIDATE_SCHEMA_IDENTITY),
            "contract_revision": raw.get("contract_revision", MODEL_CANDIDATE_CONTRACT_REVISION),
            "schema_set_revision": raw.get("schema_set_revision", self.schema_set_revision or state.get("schema_set_revision")),
            "deployment_candidate_id": raw.get("deployment_candidate_id"),
            "changes": raw.get("changes"),
            "reason": raw.get("reason"),
            "source": raw.get("source", "model"),
        }
        validate_document(
            "exploration_model_candidate",
            normalized_raw,
            expected_schema_set_revision=self.schema_set_revision or state.get("schema_set_revision"),
        )
        if raw.get("schema_identity", MODEL_CANDIDATE_SCHEMA_IDENTITY) != MODEL_CANDIDATE_SCHEMA_IDENTITY:
            raise ModelCandidateError("model proposal schema identity is not published")
        if raw.get("contract_revision", MODEL_CANDIDATE_CONTRACT_REVISION) != MODEL_CANDIDATE_CONTRACT_REVISION:
            raise ModelCandidateError("model proposal contract revision is not current")
        expected_revision = self.schema_set_revision or state.get("schema_set_revision")
        if expected_revision and raw.get("schema_set_revision", expected_revision) != expected_revision:
            raise ModelCandidateError("model proposal schema-set revision is stale")
        if raw.get("source", "model") != "model":
            raise ModelCandidateError("model proposal source must be model")
        if _contains_forbidden(raw):
            raise ModelCandidateError("model proposal contains a protected or executable field")
        changes = raw.get("changes")
        if not isinstance(changes, Mapping) or not changes:
            raise ModelCandidateError("model proposal changes must be a non-empty object")
        if len(changes) > 64:
            raise ModelCandidateError("model proposal changes exceed the closed bound")
        forbidden_tokens = {
            "model", "model_name", "model_id", "device", "device_type", "gpu", "gpu_type", "gpu_count",
            "tensor_parallel", "pipeline_parallel", "expert_parallel", "physical_kv", "physical_kv_strategy",
            "kv_policy", "collective_algorithm", "profile", "shell", "path", "url", "tool", "command",
        }
        for pointer in changes:
            if any(token.lower() in forbidden_tokens for token in str(pointer).strip("/").split("/")):
                raise ModelCandidateError("model proposal changes a protected deployment field")
        grants = {grant.get("pointer") for grant in state.get("parameter_grants", []) if isinstance(grant, Mapping)}
        if any(not isinstance(pointer, str) or pointer not in grants for pointer in changes):
            raise ModelCandidateError("model proposal changes are outside the authorized parameter grants")
        grant_by_pointer = {
            grant.get("pointer"): grant
            for grant in state.get("parameter_grants", [])
            if isinstance(grant, Mapping) and isinstance(grant.get("pointer"), str)
        }
        for pointer, value in changes.items():
            found, current_value = _pointer_value(state.get("base_config", {}), pointer)
            if not found:
                raise ModelCandidateError("model proposal pointer is absent from the frozen baseline")
            grant = grant_by_pointer.get(pointer)
            if not isinstance(grant, Mapping) or not _value_allowed(value, grant):
                raise ModelCandidateError("model proposal value is outside the authorized grant")
            if current_value == value:
                raise ModelCandidateError("model proposal does not change the frozen baseline")
        deployment = _published_deployment(state, raw.get("deployment_candidate_id"))
        deployments = [item for item in state.get("deployment_candidates", []) if isinstance(item, Mapping)]
        if isinstance(state.get("deployment_candidates"), list) and not any(
            isinstance(item, Mapping)
            and item.get("published") is True
            and item.get("executable") is True
            and item.get("status", "published") == "published"
            for item in state.get("deployment_candidates", [])
        ):
            raise ModelCandidateError("the bound capability catalog has no published executable deployment candidate")
        if deployments and deployment is None:
            raise ModelCandidateError("model proposal deployment candidate is not published and executable")
        if deployment is None and raw.get("deployment_candidate_id") is not None:
            raise ModelCandidateError("model proposal deployment candidate is unavailable")
        if not _deployment_matches_fixed_resources(state, deployment):
            raise ModelCandidateError("model proposal deployment candidate does not match fixed resources")
        proposed_digest = _candidate_digest(state, changes, deployment, state.get("run_strategy") if isinstance(state.get("run_strategy"), Mapping) else None)
        combination_key = "model:" + canonical_sha256({
            "deployment_candidate_id": deployment.get("candidate_id") if deployment else None,
            "changes": dict(changes),
        })
        if any(
            isinstance(item, Mapping)
            and (item.get("candidate_digest") == proposed_digest or item.get("combination_key") == combination_key)
            for item in state.get("candidate_history", [])
        ):
            raise ModelCandidateError("model proposal duplicates an executed candidate")
        return {
            "available": True,
            "source": self.source,
            "changes": copy.deepcopy(dict(changes)),
            "deployment_candidate": deployment,
            "run_strategy": copy.deepcopy(state.get("run_strategy")) if isinstance(state.get("run_strategy"), Mapping) else None,
            "combination_key": combination_key,
            # The raw model explanation is transient.  The ledger receives a
            # fixed normalized reason plus a digest in model_proposal, never
            # arbitrary model text.
            "reason": NORMALIZED_MODEL_CANDIDATE_REASON,
            "model_context_digest": context.get("context_digest"),
            "model_proposal": {
                "schema_identity": MODEL_CANDIDATE_SCHEMA_IDENTITY,
                "contract_revision": MODEL_CANDIDATE_CONTRACT_REVISION,
                "schema_set_revision": expected_revision,
                "deployment_candidate_id": deployment.get("candidate_id") if deployment else None,
                "changes": copy.deepcopy(dict(changes)),
                # The model's prose is transient.  Do not add a private
                # field here: this object is persisted as the published
                # exploration-model-candidate DTO and must remain closed.
                "source": "model",
            },
        }

    def generate(self, state: Mapping[str, Any]) -> dict[str, Any]:
        try:
            context = build_model_context(state)
        except Exception as error:
            return self._fallback(state, f"model context unavailable: {error}")
        try:
            proposal = self.provider.generate(copy.deepcopy(context))
            return self._validate_proposal(state, proposal, context)
        except Exception as error:
            # Provider failures are deliberately opaque to the executor.  The
            # deterministic fallback can still produce an ordinary candidate;
            # if it cannot, the graph marks the session for human handling.
            return self._fallback(state, str(error))
