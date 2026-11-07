"""Planning-only boundary for deployment-aware automatic exploration.

The planner is intentionally side-effect free.  It turns a partial user
description and a read-only capability snapshot into either a bounded
clarification result or a user-confirmable draft.  It never claims that a
deployment profile is executable unless the backend marked that profile as
published and executable.
"""

from __future__ import annotations

import copy
import math
import re
from typing import Any, Mapping, Sequence

from .contracts import canonical_sha256

PLANNING_CONTRACT_REVISION = "2026-11-01.wph.v1"
PLANNING_POLICY_REVISION = "tilesim.agent_harness.deployment_exploration.policy.v1"
# Direct domain callers do not own the Bridge manifest.  The HTTP service always
# supplies the live revision; this bounded placeholder keeps standalone planner
# tests and previews structurally valid without claiming a deployed revision.
DEFAULT_SCHEMA_SET_REVISION = "sha256:" + "0" * 64
PLANNING_SCHEMA_IDENTITIES = {
    name: f"tilesim.agent_harness.deployment_exploration_{name}.v1"
    for name in (
        "fixed_resources",
        "deployment_candidate",
        "workload_scenario",
        "run_strategy",
        "objective",
        "constraint",
        "aggregation",
        "recommendation",
        "plan",
        "confirmation",
        "evaluation",
    )
}
PLANNING_DOCUMENT_FIELDS: dict[str, frozenset[str]] = {
    "fixed_resources": frozenset({"schema_identity", "contract_revision", "schema_set_revision", "model", "engine", "gpu_type", "gpu_count", "precision", "node_count", "resource_budget"}),
    "deployment_candidate": frozenset({"schema_identity", "contract_revision", "schema_set_revision", "candidate_id", "status", "published", "executable", "resource_binding", "gpu_groups", "parallelism", "placement", "topology", "evidence_refs"}),
    "workload_scenario": frozenset({"schema_identity", "contract_revision", "schema_set_revision", "scenario_id", "arrival_rate", "concurrency", "input_tokens", "output_tokens", "burst_mode", "description"}),
    "run_strategy": frozenset({"schema_identity", "contract_revision", "schema_set_revision", "batch_scheduler", "max_batch_size", "kv_cache_capacity_tokens", "message_size_multiplier"}),
    "objective": frozenset({"schema_identity", "contract_revision", "schema_set_revision", "primary_objective", "constraints", "aggregation"}),
    "constraint": frozenset({"schema_identity", "contract_revision", "schema_set_revision", "metric_path", "operator", "threshold", "unit"}),
    "aggregation": frozenset({"schema_identity", "contract_revision", "schema_set_revision", "rule", "scenario_ids"}),
    "recommendation": frozenset({"schema_identity", "contract_revision", "schema_set_revision", "recommendation_id", "field", "value", "source", "reason", "confirmed", "confirmed_by"}),
    "plan": frozenset({"schema_identity", "contract_revision", "schema_set_revision", "policy_revision", "status", "missing", "questions", "recommendations", "unsupported_fields", "message", "fixed_resources", "deployment_candidates", "workload_scenarios", "run_strategy", "objective", "confirmation", "draft_digest", "would_create_run", "would_claim_slot"}),
    "confirmation": frozenset({"schema_identity", "contract_revision", "schema_set_revision", "confirmed", "confirmed_by", "confirmed_at", "source"}),
    "evaluation": frozenset({"schema_identity", "contract_revision", "schema_set_revision", "candidate_id", "eligible", "reason", "objective_value", "direction", "aggregation", "scenario_evaluations", "constraints", "evidence_refs"}),
}

MAX_CLARIFICATION_QUESTIONS = 3
SUPPORTED_METRICS = {
    # Legacy local-synthetic runtime fixture. It is not exposed by the
    # production capability catalog; keeping the alias lets the isolated
    # LangGraph harness exercise lifecycle semantics without fabricating a
    # Provider metric.
    "/metrics/x",
    "/latency/ttft/p50",
    "/latency/ttft/p95",
    "/latency/ttft/p99",
    "/latency/per_token/p50",
    "/latency/per_token/p95",
    "/latency/per_token/p99",
    "/latency/itl/p50",
    "/latency/itl/p95",
    "/latency/itl/p99",
    "/latency/end_to_end/p50",
    "/latency/end_to_end/p95",
    "/latency/end_to_end/p99",
    "/throughput/requests_per_second",
    "/throughput/output_tokens_per_second",
    "/throughput/total_tokens_per_second",
    "/queueing/wait_ms",
    "/prefill/wait_ms",
    "/decode/wait_ms",
    "/communication/wait_ms",
    "/resources/kv_cache_utilization",
    "/resources/gpu_utilization",
    "/reliability/success_rate",
    "/reliability/failure_rate",
    "/reliability/error_rate",
    "/reliability/timeout_rate",
    "/reliability/rejection_rate",
}
UNSUPPORTED_DEPLOYMENT_FIELDS = {
    "model",
    "model_id",
    "device",
    "device_type",
    "gpu_type",
    "gpu_count",
    "tensor_parallel",
    "pipeline_parallel",
    "expert_parallel",
    "physical_kv_strategy",
    "collective_algorithm",
}


class PlanningError(ValueError):
    def __init__(self, code: str, message: str, *, field_path: str = "/") -> None:
        super().__init__(message)
        self.code = code
        self.field_path = field_path


def validate_planning_document(name: str, document: Mapping[str, Any]) -> dict[str, Any]:
    """Closed-world validation for planning records before persistence or display."""
    if name not in PLANNING_SCHEMA_IDENTITIES:
        raise PlanningError("unknown_schema_identity", "Planning schema identity is not published.", field_path="/schema_identity")
    if not isinstance(document, Mapping):
        raise PlanningError("invalid_document", "Planning document must be an object.")
    unknown = sorted(set(document) - set(PLANNING_DOCUMENT_FIELDS[name]))
    if unknown:
        raise PlanningError("unknown_field", "Planning documents use closed-world fields.", field_path=f"/{unknown[0]}")
    if document.get("schema_identity") != PLANNING_SCHEMA_IDENTITIES[name]:
        raise PlanningError("schema_revision_mismatch", "Planning schema identity is not current.", field_path="/schema_identity")
    if document.get("contract_revision") != PLANNING_CONTRACT_REVISION:
        raise PlanningError("schema_revision_mismatch", "Planning contract revision is not current.", field_path="/contract_revision")
    schema_set_revision = document.get("schema_set_revision")
    if not isinstance(schema_set_revision, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", schema_set_revision):
        raise PlanningError("schema_revision_mismatch", "Planning schema-set revision is invalid.", field_path="/schema_set_revision")
    return dict(document)


def _copy(value: Any) -> Any:
    return copy.deepcopy(value)


def _nonempty(value: Any, path: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise PlanningError("invalid_field", "Expected a non-empty string.", field_path=path)
    return value.strip()


def _mapping(value: Any, path: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise PlanningError("invalid_field", "Expected an object.", field_path=path)
    return value


def _pointer(value: Any, path: str) -> str:
    value = _nonempty(value, path)
    if not value.startswith("/") or value == "/" or any(not re.fullmatch(r"(?:[^~/]|~[01])*$", token) for token in value[1:].split("/")):
        raise PlanningError("invalid_metric_path", "Metric paths must be non-root JSON Pointers.", field_path=path)
    return value


def _finite_number(value: Any, path: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)):
        raise PlanningError("invalid_number", "Expected a finite number.", field_path=path)
    return float(value)


def _field(value: Mapping[str, Any], names: Sequence[str]) -> Any:
    for name in names:
        if name in value and value[name] not in (None, ""):
            return value[name]
    return None


def _recommendation(rec_id: str, field: str, value: Any, reason: str, schema_set_revision: str) -> dict[str, Any]:
    return {
        "schema_identity": PLANNING_SCHEMA_IDENTITIES["recommendation"],
        "contract_revision": PLANNING_CONTRACT_REVISION,
        "schema_set_revision": schema_set_revision,
        "recommendation_id": rec_id,
        "field": field,
        "value": _copy(value),
        "source": "system_recommendation",
        "reason": reason,
        "confirmed": False,
    }


def _question(question_id: str, missing: str, why: str, recommendation: dict[str, Any] | None) -> dict[str, Any]:
    return {
        "question_id": question_id,
        "field": missing,
        "prompt": f"请确认{missing}。{why}",
        "recommendation": _copy(recommendation) if recommendation else None,
        "next_action": "确认推荐值或提供你的值后继续生成实验草案。",
    }


def _normalise_fixed_resources(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, Mapping):
        return None
    aliases = {
        "model": ("model", "model_id", "model_name"),
        "engine": ("engine", "engine_id", "inference_engine"),
        "gpu_type": ("gpu_type", "device_type", "accelerator"),
        "gpu_count": ("gpu_count", "device_count", "cards"),
    }
    result: dict[str, Any] = {}
    for canonical, names in aliases.items():
        found = _field(value, names)
        if found is not None:
            result[canonical] = _copy(found)
    for name in ("precision", "node_count", "resource_budget"):
        if name in value and value[name] not in (None, ""):
            result[name] = _copy(value[name])
    return result


def _extract_fixed_resources(context: Mapping[str, Any], supplied: Mapping[str, Any]) -> dict[str, Any] | None:
    for value in (supplied.get("fixed_resources"), context.get("fixed_resources"), context.get("resources")):
        normalised = _normalise_fixed_resources(value)
        if normalised:
            return normalised
    run_request = context.get("run_request")
    if isinstance(run_request, Mapping):
        normalised = _normalise_fixed_resources(run_request)
        if normalised:
            return normalised
        custom = run_request.get("custom_inputs")
        if isinstance(custom, Mapping):
            for section in custom.values():
                normalised = _normalise_fixed_resources(section)
                if normalised:
                    return normalised
    return None


def _normalise_scenarios(value: Any, schema_set_revision: str) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    result: list[dict[str, Any]] = []
    for index, item in enumerate(value[:16]):
        if not isinstance(item, Mapping):
            continue
        scenario_id = item.get("scenario_id") or item.get("id") or f"scenario-{index + 1}"
        allowed = {"arrival_rate", "concurrency", "input_tokens", "output_tokens", "burst_mode", "description"}
        result.append({"schema_identity": PLANNING_SCHEMA_IDENTITIES["workload_scenario"], "contract_revision": PLANNING_CONTRACT_REVISION, "schema_set_revision": schema_set_revision, "scenario_id": str(scenario_id), **{str(k): _copy(v) for k, v in item.items() if k in allowed}})
    return result


_RUN_STRATEGY_FIELDS = {"batch_scheduler", "max_batch_size", "kv_cache_capacity_tokens", "message_size_multiplier"}


def _normalise_run_strategy(value: Any, schema_set_revision: str) -> dict[str, Any] | None:
    """Normalize only parameters published by the current run-strategy contract."""
    if not isinstance(value, Mapping):
        return None
    unknown = sorted(set(value) - _RUN_STRATEGY_FIELDS)
    if unknown:
        raise PlanningError("unsupported_run_strategy_field", "当前运行策略只开放已发布的批处理、KV Cache 和消息大小参数。", field_path=f"/run_strategy/{unknown[0]}")
    result: dict[str, Any] = {
        "schema_identity": PLANNING_SCHEMA_IDENTITIES["run_strategy"],
        "contract_revision": PLANNING_CONTRACT_REVISION,
        "schema_set_revision": schema_set_revision,
    }
    for key, item in value.items():
        if key in {"max_batch_size", "kv_cache_capacity_tokens"}:
            if isinstance(item, bool) or not isinstance(item, int) or item < 1:
                raise PlanningError("invalid_run_strategy", "运行策略中的容量必须是正整数。", field_path=f"/run_strategy/{key}")
        elif key == "message_size_multiplier":
            item = _finite_number(item, f"/run_strategy/{key}")
            if item <= 0:
                raise PlanningError("invalid_run_strategy", "消息大小倍率必须大于零。", field_path=f"/run_strategy/{key}")
        elif key == "batch_scheduler":
            item = _nonempty(item, f"/run_strategy/{key}")
        result[key] = _copy(item)
    return result if len(result) > 3 else None


def _published_candidates(value: Any, schema_set_revision: str) -> list[dict[str, Any]]:
    if isinstance(value, Mapping):
        # Capability projections commonly wrap the published list under a
        # descriptive key.  The wrapper is still read-only authority; a
        # request body can never provide this catalog.
        for key in ("deployment_candidates", "candidates", "profiles"):
            if key in value:
                value = value[key]
                break
    if not isinstance(value, list):
        return []
    result: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, Mapping):
            continue
        status = item.get("status") or item.get("availability") or item.get("execution_status")
        published = item.get("published") is True or status in {"published", "executable", "available", "ready"}
        executable = item.get("executable") is True or status in {"executable", "available", "ready"}
        if published and executable and isinstance(item.get("candidate_id"), str):
            allowed = {"candidate_id", "status", "published", "executable", "resource_binding", "gpu_groups", "parallelism", "placement", "topology", "evidence_refs"}
            result.append({"schema_identity": PLANNING_SCHEMA_IDENTITIES["deployment_candidate"], "contract_revision": PLANNING_CONTRACT_REVISION, "schema_set_revision": schema_set_revision, **{str(k): _copy(v) for k, v in item.items() if k in allowed}})
    return result


def _objective(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, Mapping):
        return None
    primary = value.get("primary_objective") if isinstance(value.get("primary_objective"), Mapping) else value
    path = primary.get("metric_path") if isinstance(primary, Mapping) else None
    direction = primary.get("direction") if isinstance(primary, Mapping) else None
    if path is None or direction is None:
        return None
    return {"metric_path": _pointer(path, "/objective/primary_objective/metric_path"), "direction": direction}


def _constraints(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, Mapping):
        return []
    raw = value.get("constraints")
    if not isinstance(raw, list):
        return []
    result = []
    for index, item in enumerate(raw[:16]):
        if not isinstance(item, Mapping):
            continue
        path = _pointer(item.get("metric_path"), f"/objective/constraints/{index}/metric_path")
        operator = item.get("operator")
        if operator not in {"<", "<=", "=", ">=", ">"}:
            raise PlanningError("invalid_constraint", "Unsupported constraint operator.", field_path=f"/objective/constraints/{index}/operator")
        result.append({"metric_path": path, "operator": operator, "threshold": _finite_number(item.get("threshold"), f"/objective/constraints/{index}/threshold")})
    return result


def plan_exploration(*, context: Mapping[str, Any], request: Mapping[str, Any] | None = None, schema_set_revision: str = DEFAULT_SCHEMA_SET_REVISION) -> dict[str, Any]:
    """Return a clarification or a confirmable draft without side effects."""

    context = _mapping(context, "/context")
    supplied = _mapping(request or {}, "/request")
    fixed = _extract_fixed_resources(context, supplied)
    scenarios = _normalise_scenarios(supplied.get("workload_scenarios") or context.get("workload_scenarios"), schema_set_revision)
    run_strategy = _normalise_run_strategy(
        supplied.get("run_strategy") or context.get("run_strategy"), schema_set_revision
    )
    objective = _objective(supplied.get("objective") or context.get("objective"))
    constraints = _constraints(supplied.get("objective") or context.get("objective") or supplied)
    unsupported_metrics: list[str] = []
    if isinstance(objective, Mapping) and objective.get("metric_path") not in SUPPORTED_METRICS:
        unsupported_metrics.append(str(objective.get("metric_path")))
    for constraint in constraints:
        if constraint.get("metric_path") not in SUPPORTED_METRICS:
            unsupported_metrics.append(str(constraint.get("metric_path")))
    # Deployment candidates are a backend capability projection.  Never accept
    # a model-supplied list as authority: request candidates are ignored unless
    # the Bridge context also published the corresponding catalog.
    candidate_source = context.get("deployment_candidates") or context.get("capability_catalog")
    candidates = _published_candidates(candidate_source, schema_set_revision)
    candidate_catalog_published = "deployment_candidates" in context or "capability_catalog" in context
    requested_candidate_ids = supplied.get("deployment_candidate_ids")
    if isinstance(requested_candidate_ids, list) and requested_candidate_ids:
        requested = {item for item in requested_candidate_ids if isinstance(item, str)}
        candidates = [item for item in candidates if item.get("candidate_id") in requested]
    recommendations: list[dict[str, Any]] = []
    questions: list[dict[str, Any]] = []
    if not fixed or any(key not in fixed for key in ("model", "engine", "gpu_type", "gpu_count")):
        rec = _recommendation("fixed-resources", "固定资源", {"model": "当前页面已选模型", "engine": "当前页面已选引擎", "gpu_type": "当前页面已选 GPU 类型", "gpu_count": 1}, "部署方案比较必须在固定资源下进行，避免把资源变化误判为方案收益。", schema_set_revision)
        recommendations.append(rec)
        questions.append(_question("fixed-resources", "模型、引擎、GPU 类型和卡数", "这些值决定可比较的部署候选。", rec))
    if not candidates:
        rec = _recommendation("deployment-candidates", "部署候选", "后端已发布候选", "第一版只比较后端已发布且有执行闭环的候选，不允许助手生成 GPU 拓扑或并行方式。", schema_set_revision)
        recommendations.append(rec)
        questions.append(_question("deployment-candidates", "可用部署候选", "未发布的 Profile 不能进入执行队列。", rec))
    if not scenarios:
        rec = _recommendation("workload-scenarios", "工作负载场景", [{"scenario_id": "low"}, {"scenario_id": "medium"}, {"scenario_id": "high"}], "低、中、高三个场景可以避免单一负载下的偶然最优。", schema_set_revision)
        recommendations.append(rec)
        questions.append(_question("workload-scenarios", "请求负载场景", "需要知道方案在哪些请求条件下比较。", rec))
    if objective is None:
        rec = _recommendation("primary-objective", "主要优化指标", {"metric_path": "/latency/end_to_end/p99", "direction": "minimize"}, "端到端 P99 能覆盖尾延迟，是默认服务质量目标。", schema_set_revision)
        recommendations.append(rec)
        questions.append(_question("primary-objective", "主要优化指标和方向", "没有主要目标就无法确定方案排序。", rec))
    unsupported = sorted(set(supplied) & UNSUPPORTED_DEPLOYMENT_FIELDS)
    if unsupported or unsupported_metrics:
        return {
            "schema_identity": PLANNING_SCHEMA_IDENTITIES["plan"], "contract_revision": PLANNING_CONTRACT_REVISION, "schema_set_revision": schema_set_revision,
            "policy_revision": PLANNING_POLICY_REVISION, "status": "unsupported", "missing": [],
            "questions": [], "recommendations": [], "unsupported_fields": [*unsupported, *unsupported_metrics],
            "message": "当前能力目录尚未开放该部署参数或指标；可运行范围是固定资源下选择后端已发布部署候选，再探索批处理和 KV Cache 等运行参数，并使用已发布的延迟、吞吐、排队、资源和可靠性指标。",
            "fixed_resources": fixed,
            "deployment_candidates": candidates,
            "workload_scenarios": scenarios,
            "run_strategy": run_strategy,
            "would_create_run": False, "would_claim_slot": False,
        }
    if candidate_catalog_published and not candidates:
        return {
            "schema_identity": PLANNING_SCHEMA_IDENTITIES["plan"], "contract_revision": PLANNING_CONTRACT_REVISION, "schema_set_revision": schema_set_revision,
            "policy_revision": PLANNING_POLICY_REVISION, "status": "unsupported", "missing": [],
            "questions": [], "recommendations": [], "unsupported_fields": ["部署候选"],
            "message": "当前能力目录没有已发布且可执行的部署候选；可运行范围是等待后端发布候选后，在固定资源下比较部署方案，再探索批处理和 KV Cache 等运行参数。",
            "fixed_resources": fixed,
            "deployment_candidates": candidates,
            "workload_scenarios": scenarios,
            "run_strategy": run_strategy,
            "would_create_run": False, "would_claim_slot": False,
        }
    if questions:
        questions = questions[:MAX_CLARIFICATION_QUESTIONS]
        question_ids = {question.get("question_id") for question in questions if isinstance(question, Mapping)}
        recommendations = [
            recommendation for recommendation in recommendations
            if recommendation.get("recommendation_id") in question_ids or not question_ids
        ][:MAX_CLARIFICATION_QUESTIONS]
        return {
            "schema_identity": PLANNING_SCHEMA_IDENTITIES["plan"], "contract_revision": PLANNING_CONTRACT_REVISION, "schema_set_revision": schema_set_revision,
            "policy_revision": PLANNING_POLICY_REVISION, "status": "needs_clarification", "missing": [q["field"] for q in questions],
            "questions": questions, "recommendations": recommendations, "unsupported_fields": [],
            "message": "信息不足，先确认下面的关键条件；确认前不会创建运行、调用执行器或占用实验槽位。",
            "fixed_resources": fixed,
            "deployment_candidates": candidates,
            "workload_scenarios": scenarios,
            "run_strategy": run_strategy,
            "would_create_run": False, "would_claim_slot": False,
        }
    draft = {
        "schema_identity": PLANNING_SCHEMA_IDENTITIES["plan"], "contract_revision": PLANNING_CONTRACT_REVISION, "schema_set_revision": schema_set_revision,
        "policy_revision": PLANNING_POLICY_REVISION, "status": "awaiting_confirmation", "fixed_resources": fixed,
        "deployment_candidates": candidates, "workload_scenarios": scenarios,
        "run_strategy": run_strategy,
        "objective": {"primary_objective": objective, "constraints": constraints, "aggregation": "all_scenarios"},
        "recommendations": recommendations, "confirmation": None, "would_create_run": False, "would_claim_slot": False,
    }
    if isinstance(fixed, dict):
        draft["fixed_resources"] = {
            "schema_identity": PLANNING_SCHEMA_IDENTITIES["fixed_resources"],
            "contract_revision": PLANNING_CONTRACT_REVISION,
            "schema_set_revision": schema_set_revision,
            **fixed,
        }
    draft["objective"] = {
        "schema_identity": PLANNING_SCHEMA_IDENTITIES["objective"],
        "contract_revision": PLANNING_CONTRACT_REVISION,
        "schema_set_revision": schema_set_revision,
        "primary_objective": objective,
        "constraints": [
            {"schema_identity": PLANNING_SCHEMA_IDENTITIES["constraint"], "contract_revision": PLANNING_CONTRACT_REVISION, "schema_set_revision": schema_set_revision, **constraint}
            for constraint in constraints
        ],
        # The runtime objective contract keeps aggregation as a closed enum;
        # the scenario IDs remain in the workload_scenarios collection.
        "aggregation": "all_scenarios",
    }
    draft["draft_digest"] = canonical_sha256(draft)
    return draft


def confirm_exploration_plan(plan: Mapping[str, Any], *, principal: str, confirmation: Mapping[str, Any]) -> dict[str, Any]:
    """Freeze a plan only after the user explicitly confirms its values."""

    if not isinstance(plan, Mapping):
        raise PlanningError("invalid_plan", "Exploration plan must be an object.", field_path="/plan")
    try:
        validate_planning_document("plan", plan)
    except PlanningError:
        raise
    if plan.get("status") != "awaiting_confirmation":
        raise PlanningError("plan_not_confirmable", "Only a pending plan can be confirmed.")
    supplied_digest = plan.get("draft_digest")
    if not isinstance(supplied_digest, str) or supplied_digest != canonical_sha256({k: v for k, v in plan.items() if k != "draft_digest"}):
        raise PlanningError("plan_digest_mismatch", "The planning draft changed; please request a fresh plan.", field_path="/draft_digest")
    principal = _nonempty(principal, "/principal")
    if not isinstance(confirmation, Mapping) or confirmation.get("confirmed") is not True:
        raise PlanningError("confirmation_required", "The user must explicitly confirm the exploration plan.", field_path="/confirmation/confirmed")
    unknown_confirmation = sorted(set(confirmation) - {"confirmed", "confirmed_at", "source"})
    if unknown_confirmation:
        raise PlanningError("unknown_field", "Confirmation uses closed-world fields.", field_path=f"/confirmation/{unknown_confirmation[0]}")
    if confirmation.get("source", "user") != "user":
        raise PlanningError("confirmation_invalid", "Only a user confirmation can freeze the exploration plan.", field_path="/confirmation/source")
    normalized_confirmation = {
        "schema_identity": PLANNING_SCHEMA_IDENTITIES["confirmation"],
        "contract_revision": PLANNING_CONTRACT_REVISION,
        "schema_set_revision": str(plan.get("schema_set_revision") or DEFAULT_SCHEMA_SET_REVISION),
        "confirmed": True,
        "confirmed_by": principal,
        "confirmed_at": confirmation.get("confirmed_at"),
        "source": "user",
    }
    validate_planning_document("confirmation", normalized_confirmation)
    frozen = _copy(dict(plan))
    for recommendation in frozen.get("recommendations", []):
        recommendation["confirmed"] = True
        recommendation["confirmed_by"] = principal
    frozen["confirmation"] = normalized_confirmation
    frozen["status"] = "draft_ready"
    frozen["would_create_run"] = False
    frozen["would_claim_slot"] = False
    frozen["draft_digest"] = canonical_sha256({k: v for k, v in frozen.items() if k != "draft_digest"})
    return frozen


def _pointer_value(document: Any, pointer: str) -> Any:
    current = document
    for token in pointer.lstrip("/").split("/"):
        token = token.replace("~1", "/").replace("~0", "~")
        if not isinstance(current, Mapping) or token not in current:
            return None
        current = current[token]
    return current


def _aggregate(values: list[float], rule: str) -> float:
    if not values:
        raise PlanningError("metric_missing", "A required metric is missing.")
    if rule == "mean": return sum(values) / len(values)
    if rule == "max": return max(values)
    if rule == "min": return min(values)
    if rule == "p95": return sorted(values)[max(0, math.ceil(len(values) * .95) - 1)]
    return values[0]


def evaluate_multi_metric(*, candidate_id: str, objective: Mapping[str, Any], scenario_results: Sequence[Mapping[str, Any]], schema_set_revision: str = DEFAULT_SCHEMA_SET_REVISION) -> dict[str, Any]:
    """Evaluate all scenarios, reject hard-constraint violations, and retain evidence."""

    primary = _mapping(objective.get("primary_objective"), "/objective/primary_objective")
    metric_path = _pointer(primary.get("metric_path"), "/objective/primary_objective/metric_path")
    direction = primary.get("direction")
    if direction not in {"minimize", "maximize"}:
        raise PlanningError("invalid_objective", "Objective direction is invalid.", field_path="/objective/primary_objective/direction")
    aggregation = objective.get("aggregation", "all_scenarios")
    rule = "mean" if aggregation in {"mean", "all_scenarios"} else str(aggregation)
    constraints = objective.get("constraints", [])
    values: list[float] = []
    constraint_results: list[dict[str, Any]] = []
    scenario_evaluations: list[dict[str, Any]] = []
    missing_required = False
    for row in scenario_results:
        metrics = row.get("metrics") if isinstance(row, Mapping) else None
        if not isinstance(metrics, Mapping) or row.get("status") not in {"completed", "success", "verified"}:
            return {"schema_identity": PLANNING_SCHEMA_IDENTITIES["evaluation"], "contract_revision": PLANNING_CONTRACT_REVISION, "schema_set_revision": schema_set_revision, "candidate_id": candidate_id, "eligible": False, "reason": "required_metric_unavailable", "scenario_evaluations": scenario_evaluations, "constraints": constraint_results}
        if row.get("run_id") is not None and (not isinstance(row.get("evidence") or row.get("evidence_refs"), list) or not (row.get("evidence") or row.get("evidence_refs"))):
            return {"schema_identity": PLANNING_SCHEMA_IDENTITIES["evaluation"], "contract_revision": PLANNING_CONTRACT_REVISION, "schema_set_revision": schema_set_revision, "candidate_id": candidate_id, "eligible": False, "reason": "required_evidence_unavailable", "scenario_evaluations": scenario_evaluations, "constraints": constraint_results}
        value = _pointer_value(metrics, metric_path)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)):
            return {"schema_identity": PLANNING_SCHEMA_IDENTITIES["evaluation"], "contract_revision": PLANNING_CONTRACT_REVISION, "schema_set_revision": schema_set_revision, "candidate_id": candidate_id, "eligible": False, "reason": "required_metric_unavailable", "scenario_evaluations": scenario_evaluations, "constraints": constraint_results}
        value = float(value); values.append(value)
        row_constraints: list[dict[str, Any]] = []
        for constraint in constraints:
            path = _pointer(constraint.get("metric_path"), "/objective/constraints/metric_path")
            actual = _pointer_value(metrics, path)
            threshold = _finite_number(constraint.get("threshold"), "/objective/constraints/threshold")
            operator = constraint.get("operator")
            passed = isinstance(actual, (int, float)) and not isinstance(actual, bool) and {"<": actual < threshold, "<=": actual <= threshold, "=": math.isclose(float(actual), threshold), ">=": actual >= threshold, ">": actual > threshold}.get(operator, False)
            if not isinstance(actual, (int, float)) or isinstance(actual, bool) or not math.isfinite(float(actual)):
                missing_required = True
            result = {"metric_path": path, "operator": operator, "threshold": threshold, "actual": actual, "passed": passed}
            row_constraints.append(result); constraint_results.append(result)
        scenario_evaluations.append({"scenario_id": row.get("scenario_id"), "run_id": row.get("run_id"), "metric_path": row.get("metric_path", metric_path), "primary_value": value, "constraints": row_constraints, "evidence_refs": _copy(row.get("evidence") or row.get("evidence_refs") or [])})
    objective_value = _aggregate(values, rule)
    eligible = all(item["passed"] for item in constraint_results)
    return {"schema_identity": PLANNING_SCHEMA_IDENTITIES["evaluation"], "contract_revision": PLANNING_CONTRACT_REVISION, "schema_set_revision": schema_set_revision, "candidate_id": candidate_id, "eligible": eligible and not missing_required, "reason": None if eligible and not missing_required else ("required_metric_unavailable" if missing_required else "hard_constraint_failed"), "objective_value": objective_value, "direction": direction, "aggregation": aggregation, "scenario_evaluations": scenario_evaluations, "constraints": constraint_results, "evidence_refs": [evidence for row in scenario_results for evidence in (row.get("evidence") or row.get("evidence_refs") or []) if isinstance(evidence, Mapping)]}


def pareto_front(evaluations: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    eligible = [row for row in evaluations if row.get("eligible") is True]
    if not eligible:
        return []
    # A planner may supply a vector of independent objective values.  The
    # legacy scalar field remains the default so existing sessions keep their
    # deterministic ordering.  A row is dominated only when another eligible
    # row is at least as good in every dimension and strictly better in one.
    def vector(row: Mapping[str, Any]) -> list[tuple[float, str]]:
        raw = row.get("objective_values") or row.get("metric_values")
        if isinstance(raw, Mapping):
            directions = row.get("directions") if isinstance(row.get("directions"), Mapping) else {}
            return [(float(value), str(directions.get(key, "maximize"))) for key, value in sorted(raw.items()) if isinstance(value, (int, float)) and not isinstance(value, bool)]
        if isinstance(raw, list):
            directions = row.get("directions") or row.get("objective_directions")
            return [
                (float(value), str(directions[index] if isinstance(directions, list) and index < len(directions) else "maximize"))
                for index, value in enumerate(raw)
                if isinstance(value, (int, float)) and not isinstance(value, bool)
            ]
        return [(float(row["objective_value"]), str(row.get("direction", "maximize")))] if isinstance(row.get("objective_value"), (int, float)) else []
    front: list[dict[str, Any]] = []
    for candidate in eligible:
        dominated = False
        for other in eligible:
            if other is candidate: continue
            left, right = vector(candidate), vector(other)
            if not left or len(left) != len(right):
                continue
            comparisons = []
            for (value, direction), (other_value, _other_direction) in zip(left, right):
                comparisons.append((other_value >= value, other_value > value) if direction == "maximize" else (other_value <= value, other_value < value))
            if all(item[0] for item in comparisons) and any(item[1] for item in comparisons):
                dominated = True; break
        if not dominated: front.append(_copy(dict(candidate)))
    return front

