"""Durable run metadata and allow-listed artifact persistence."""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import threading
import uuid
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path


class ArtifactContractError(ValueError):
    def __init__(self, reason: str, message: str, *, schema_identity: str = "", json_pointer: str = "/"):
        super().__init__(message)
        self.reason = reason
        self.schema_identity = schema_identity
        self.json_pointer = json_pointer


class ArtifactManifestValidationError(ValueError):
    pass


def load_reports(run: dict, artifact_definitions: dict) -> dict:
    reports = {}
    definitions_by_report_kind = {
        definition["report_kind"]: definition
        for definition in artifact_definitions.values()
        if definition["report_kind"] is not None
    }
    for kind, path in run["report_paths"].items():
        definition = definitions_by_report_kind.get(kind)
        if definition is None:
            continue
        try:
            if path.is_file():
                inspected = inspect_artifact(run["run_id"], path, definition)
                if inspected["content_status"] == "ready":
                    reports[kind] = inspected["value"]
        except ArtifactContractError:
            # An optional artifact that is malformed, unsupported, or run-mismatched is excluded.
            continue
    return reports


def report_paths_for(run_dir: Path, report_file_names: dict) -> dict[str, Path]:
    return {kind: run_dir / file_name for kind, file_name in report_file_names.items()}


def json_artifact_paths_for(run_dir: Path, artifact_definitions: dict) -> dict[str, Path]:
    """Return only the JSON artifacts that the browser may preview."""
    return {
        artifact_id: run_dir / definition["file_name"]
        for artifact_id, definition in artifact_definitions.items()
    }


def json_schema_identity(value: object) -> str:
    if not isinstance(value, dict):
        return ""
    contract_version = value.get("contract_version")
    if isinstance(contract_version, str):
        return contract_version
    schema_version = value.get("schema_version")
    return schema_version if isinstance(schema_version, str) else ""


def resolve_json_pointer(value: object, pointer: str) -> object:
    if pointer == "":
        return value
    if not pointer.startswith("/"):
        raise KeyError(pointer)
    current = value
    for raw_segment in pointer[1:].split("/"):
        segment = raw_segment.replace("~1", "/").replace("~0", "~")
        if isinstance(current, dict) and segment in current:
            current = current[segment]
        elif isinstance(current, list) and segment.isdigit() and int(segment) < len(current):
            current = current[int(segment)]
        else:
            raise KeyError(pointer)
    return current


def _contract_error(message: str, pointer: str) -> None:
    raise ArtifactContractError(
        "contract_violation", message, json_pointer=pointer
    )


def _validate_f7_ref(
    ref: object,
    *,
    run_id: str,
    artifact_id: str,
    schema_identity: str,
    json_pointer: str,
    subject_kind: str,
    subject_id: str,
    pointer: str,
) -> None:
    typed_ids = {
        "candidate": "candidate_id",
        "fabric_domain": "fabric_domain_id",
        "objective": "objective_id",
        "executed_s6_knob": "knob_id",
    }
    if not isinstance(ref, dict):
        _contract_error("EvidenceRef must be an object.", pointer)
    subject = ref.get("subject")
    if (
        ref.get("run_id") != run_id
        or ref.get("artifact_id") != artifact_id
        or ref.get("schema_identity") != schema_identity
        or ref.get("json_pointer") != json_pointer
        or ref.get("availability")
        not in {
            "available",
            "partial",
            "run_scope_only",
            "not_applicable",
            "missing",
            "not_covered",
            "unsupported_schema",
            "unresolved_not_executed",
        }
        or not isinstance(subject, dict)
        or subject.get("kind") != subject_kind
        or subject.get("id") != subject_id
        or subject.get(typed_ids[subject_kind]) != subject_id
    ):
        _contract_error(
            "EvidenceRef identity, Pointer, availability, or typed subject does not match its target.",
            pointer,
        )


def _validate_topology_contract(value: dict, run_id: str) -> None:
    provenance = value.get("provenance")
    if not isinstance(provenance, dict) or provenance.get("source_mode") not in {
        "real_trace",
        "synthetic_trace",
        "compatibility_harness_trace",
    }:
        _contract_error("Topology provenance is missing or unsupported.", "/provenance")
    for field in ("calibration_level", "allowed_claim_scope"):
        if not isinstance(provenance.get(field), str) or not provenance[field]:
            _contract_error(f"Topology provenance {field} is required.", f"/provenance/{field}")
    domains = value.get("topology", {}).get("domains")
    if not isinstance(domains, list):
        _contract_error("Topology domains must be an array.", "/topology/domains")
    seen: set[str] = set()
    for index, domain in enumerate(domains):
        pointer = f"/topology/domains/{index}"
        if not isinstance(domain, dict):
            _contract_error("Topology domain must be an object.", pointer)
        domain_id = domain.get("domain_id")
        if not isinstance(domain_id, str) or not domain_id or domain_id in seen:
            _contract_error("Topology domain_id values must be nonempty and unique.", f"{pointer}/domain_id")
        seen.add(domain_id)
        subject = domain.get("subject")
        if (
            domain.get("domain_kind") != domain.get("domain_type")
            or domain.get("json_pointer") != pointer
            or domain.get("provenance") != provenance
            or not isinstance(subject, dict)
            or subject.get("kind") != "fabric_domain"
            or subject.get("id") != domain_id
            or subject.get("fabric_domain_id") != domain_id
        ):
            _contract_error(
                "Topology domain kind, subject identity, Pointer, or provenance is inconsistent.",
                pointer,
            )
    if value.get("run_id") != run_id:
        _contract_error("Topology run_id does not match the manifest run.", "/run_id")


def _validate_design_space_contract(value: dict, run_id: str) -> None:
    if value.get("execution_scope") != "S6_only":
        _contract_error("Design-space execution_scope must remain S6_only.", "/execution_scope")
    provenance = value.get("provenance")
    if (
        not isinstance(provenance, dict)
        or provenance.get("source_mode") != value.get("candidate_source_mode")
        or provenance.get("calibration_level") != value.get("candidate_calibration_level")
        or provenance.get("allowed_claim_scope") != value.get("candidate_allowed_claim_scope")
    ):
        _contract_error("Design-space provenance fields are inconsistent.", "/provenance")
    if provenance.get("source_mode") == "synthetic_trace" and (
        value.get("validation_lane") != "synthetic_consistency"
        or value.get("evidence_tier") != "synthetic_consistency"
    ):
        _contract_error("Synthetic provenance cannot be upgraded.", "/evidence_tier")
    pareto_front_id = value.get("pareto_front_id")
    objective_set_id = value.get("objective_set_id")
    if not isinstance(pareto_front_id, str) or not pareto_front_id:
        _contract_error("pareto_front_id is required.", "/pareto_front_id")
    if not isinstance(objective_set_id, str) or not objective_set_id:
        _contract_error("objective_set_id is required.", "/objective_set_id")
    candidates = value.get("candidates")
    if not isinstance(candidates, list):
        _contract_error("Design-space candidates must be an array.", "/candidates")
    if value.get("candidate_count") != len(candidates):
        _contract_error("candidate_count does not match candidates.", "/candidate_count")
    candidate_ids: dict[str, int] = {}
    for index, candidate in enumerate(candidates):
        candidate_id = candidate.get("candidate_id") if isinstance(candidate, dict) else None
        if not isinstance(candidate_id, str) or not candidate_id or candidate_id in candidate_ids:
            _contract_error("candidate_id values must be nonempty and unique.", f"/candidates/{index}/candidate_id")
        candidate_ids[candidate_id] = index

    dominance: dict[str, set[str]] = {candidate_id: set() for candidate_id in candidate_ids}
    for index, candidate in enumerate(candidates):
        candidate_id = candidate["candidate_id"]
        pointer = f"/candidates/{index}"
        if (
            candidate.get("pareto_front_id") != pareto_front_id
            or candidate.get("objective_set_id") != objective_set_id
        ):
            _contract_error(
                "Candidate Pareto and objective-set identities must match the report.",
                f"{pointer}/pareto_front_id",
            )
        subjects = candidate.get("subject_refs")
        if (
            not isinstance(subjects, list)
            or len(subjects) != 1
            or subjects[0].get("kind") != "candidate"
            or subjects[0].get("id") != candidate_id
            or subjects[0].get("candidate_id") != candidate_id
        ):
            _contract_error("Candidate subject_ref does not match candidate_id.", f"{pointer}/subject_refs")
        refs = candidate.get("evidence_refs")
        if not isinstance(refs, list) or len(refs) != 1:
            _contract_error("Candidate must have one canonical record EvidenceRef.", f"{pointer}/evidence_refs")
        _validate_f7_ref(
            refs[0], run_id=run_id, artifact_id="design-space",
            schema_identity="tilesim.design_space_report.v1", json_pointer=pointer,
            subject_kind="candidate", subject_id=candidate_id,
            pointer=f"{pointer}/evidence_refs/0",
        )
        navigation = candidate.get("navigation")
        if (
            not isinstance(navigation, dict)
            or navigation.get("navigation_scope") != "artifact_record"
            or navigation.get("bridge_run_id") is not None
            or not isinstance(navigation.get("backend_run_instance_id"), str)
            or not navigation["backend_run_instance_id"]
            or navigation.get("parent_run_id") != run_id
            or navigation.get("candidate_id") != candidate_id
        ):
            _contract_error(
                "Internal candidate instances must use artifact_record navigation with null bridge_run_id.",
                f"{pointer}/navigation",
            )
        _validate_f7_ref(
            navigation.get("record_ref"), run_id=run_id, artifact_id="design-space",
            schema_identity="tilesim.design_space_report.v1", json_pointer=pointer,
            subject_kind="candidate", subject_id=candidate_id,
            pointer=f"{pointer}/navigation/record_ref",
        )
        if candidate.get("requested_fidelity") not in {"analytical", "des"} or candidate.get(
            "resolved_fidelity"
        ) not in {"analytical", "des"}:
            _contract_error("Candidate fidelity cannot be upgraded to Cycle.", f"{pointer}/resolved_fidelity")

        objectives = candidate.get("objectives")
        if not isinstance(objectives, list):
            _contract_error("Candidate objectives must be an array.", f"{pointer}/objectives")
        objective_ids: set[str] = set()
        objectives_complete = len(objectives) >= 2
        for objective_index, objective in enumerate(objectives):
            objective_pointer = f"{pointer}/objectives/{objective_index}"
            objective_id = objective.get("objective_id") if isinstance(objective, dict) else None
            if (
                not isinstance(objective_id, str)
                or not objective_id
                or objective_id in objective_ids
                or objective.get("direction") not in {"minimize", "maximize"}
            ):
                _contract_error("Pareto objective ID or direction is invalid.", objective_pointer)
            objective_ids.add(objective_id)
            if not isinstance(objective.get("unit"), str) or not objective["unit"]:
                _contract_error("Objective unit is required.", f"{objective_pointer}/unit")
            metric_kind = objective.get("metric_kind")
            if metric_kind == "p99_latency" and (
                objective.get("direction") != "minimize" or objective.get("unit") != "us"
            ):
                _contract_error(
                    "P99 latency objective must minimize microseconds.",
                    f"{objective_pointer}/direction",
                )
            if metric_kind == "throughput" and (
                objective.get("direction") != "maximize"
                or objective.get("unit") != "requests_per_second"
            ):
                _contract_error(
                    "Throughput objective must maximize requests per second.",
                    f"{objective_pointer}/direction",
                )
            availability = objective.get("availability")
            if availability not in {"available", "missing", "not_applicable", "not_covered"}:
                _contract_error("Objective availability is invalid.", f"{objective_pointer}/availability")
            objectives_complete = (
                objectives_complete
                and availability == "available"
                and isinstance(objective.get("value"), (int, float))
                and not isinstance(objective.get("value"), bool)
                and math.isfinite(objective["value"])
            )
            _validate_f7_ref(
                objective.get("evidence_ref"), run_id=run_id, artifact_id="design-space",
                schema_identity="tilesim.design_space_report.v1", json_pointer=objective_pointer,
                subject_kind="objective", subject_id=f"{candidate_id}::{objective_id}",
                pointer=f"{objective_pointer}/evidence_ref",
            )
            if objective["evidence_ref"].get("availability") != availability:
                _contract_error(
                    "Objective EvidenceRef availability must match its record.",
                    f"{objective_pointer}/evidence_ref/availability",
                )
        if not objectives_complete and candidate.get("pareto_member") is not None:
            _contract_error("Missing objectives require unevaluated Pareto membership.", f"{pointer}/pareto_member")

        knobs = candidate.get("executed_s6_knobs")
        if not isinstance(knobs, list):
            _contract_error("executed_s6_knobs must be an array.", f"{pointer}/executed_s6_knobs")
        knob_ids: set[str] = set()
        for knob_index, knob in enumerate(knobs):
            knob_pointer = f"{pointer}/executed_s6_knobs/{knob_index}"
            knob_id = knob.get("knob_id") if isinstance(knob, dict) else None
            availability = knob.get("availability") if isinstance(knob, dict) else None
            if (
                not isinstance(knob_id, str)
                or not knob_id
                or knob_id in knob_ids
                or knob.get("subsystem") != "S6"
                or not isinstance(knob.get("unit"), str)
                or not knob["unit"]
                or availability not in {"available", "not_applicable", "unresolved_not_executed"}
            ):
                _contract_error("Executed S6 knob identity, unit, or availability is invalid.", knob_pointer)
            knob_ids.add(knob_id)
            if availability == "available" and knob.get("value") is None:
                _contract_error("Available executed knob requires a value.", f"{knob_pointer}/value")
            if availability != "available" and any(
                knob.get(field) is not None for field in ("value", "requested_value", "resolved_value")
            ):
                _contract_error(
                    "Unavailable executed knob cannot carry an executed value.",
                    f"{knob_pointer}/value",
                )
            value_type = knob.get("value_type")
            if value_type not in {"uint64", "real", "string"}:
                _contract_error("Executed knob value_type is invalid.", f"{knob_pointer}/value_type")
            if value_type == "uint64" and availability == "available":
                for field in ("value", "requested_value", "resolved_value"):
                    field_value = knob.get(field)
                    if (
                        isinstance(field_value, bool)
                        or not isinstance(field_value, int)
                        or field_value < 0
                        or field_value > 18_446_744_073_709_551_615
                    ):
                        _contract_error(
                            "uint64 knob values must remain exact JSON integers.",
                            f"{knob_pointer}/{field}",
                        )
            stable_knob_id = f"{candidate_id}::{knob_id}"
            _validate_f7_ref(
                knob.get("source_ref"), run_id=run_id, artifact_id="design-space",
                schema_identity="tilesim.design_space_report.v1",
                json_pointer=f"{knob_pointer}/requested_value",
                subject_kind="executed_s6_knob", subject_id=stable_knob_id,
                pointer=f"{knob_pointer}/source_ref",
            )
            _validate_f7_ref(
                knob.get("evidence_ref"), run_id=run_id, artifact_id="design-space",
                schema_identity="tilesim.design_space_report.v1",
                json_pointer=f"{knob_pointer}/resolved_value",
                subject_kind="executed_s6_knob", subject_id=stable_knob_id,
                pointer=f"{knob_pointer}/evidence_ref",
            )
            if (
                knob["source_ref"].get("availability") != availability
                or knob["evidence_ref"].get("availability") != availability
            ):
                _contract_error(
                    "Executed knob EvidenceRef availability must match its record.",
                    f"{knob_pointer}/evidence_ref/availability",
                )

        dominated_by = candidate.get("dominated_by_candidate_ids")
        if not isinstance(dominated_by, list) or len(dominated_by) != len(set(dominated_by)):
            _contract_error("dominated_by_candidate_ids must be unique.", f"{pointer}/dominated_by_candidate_ids")
        for other in dominated_by:
            if other == candidate_id or other not in candidate_ids:
                _contract_error("Dominance reference is self-referential or dangling.", f"{pointer}/dominated_by_candidate_ids")
            dominance[candidate_id].add(other)
        if (candidate.get("pareto_member") is True and dominated_by) or (
            candidate.get("pareto_member") is False and not dominated_by
        ):
            _contract_error("Pareto membership conflicts with dominance references.", f"{pointer}/pareto_member")

    for index, candidate in enumerate(candidates):
        pointer = f"/candidates/{index}"
        candidate_id = candidate["candidate_id"]
        dominates = candidate.get("dominates_candidate_ids")
        if not isinstance(dominates, list) or len(dominates) != len(set(dominates)):
            _contract_error(
                "dominates_candidate_ids must be unique.",
                f"{pointer}/dominates_candidate_ids",
            )
        for other in dominates:
            if other == candidate_id or other not in candidate_ids:
                _contract_error(
                    "Dominates reference is self-referential or dangling.",
                    f"{pointer}/dominates_candidate_ids",
                )
            target = candidates[candidate_ids[other]]
            if candidate_id not in target.get("dominated_by_candidate_ids", []):
                _contract_error(
                    "dominates and dominated_by declarations must be reciprocal.",
                    f"{pointer}/dominates_candidate_ids",
                )

    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(candidate_id: str) -> None:
        if candidate_id in visiting:
            _contract_error("Dominance relationships contain a cycle.", "/candidates")
        if candidate_id in visited:
            return
        visiting.add(candidate_id)
        for other in dominance[candidate_id]:
            visit(other)
        visiting.remove(candidate_id)
        visited.add(candidate_id)

    for candidate_id in candidate_ids:
        visit(candidate_id)


def _validate_metrics_topology_refs(value: dict, run_id: str, path: Path) -> None:
    domains = value.get("system_summary", {}).get("fabric_domain_utilization", [])
    if not isinstance(domains, list):
        _contract_error("Metrics Fabric domains must be an array.", "/system_summary/fabric_domain_utilization")
    if not domains:
        return
    topology_path = path.parent / "input-topology.json"
    try:
        topology = json.loads(topology_path.read_bytes())
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ArtifactContractError(
            "contract_violation", "Metrics topology reference target is unavailable.",
            json_pointer="/system_summary/fabric_domain_utilization",
        ) from error
    if topology.get("schema_version") != "tilesim.s6_topology_input.v1" or topology.get("run_id") != run_id:
        _contract_error("Metrics topology target identity or run binding is invalid.", "/system_summary/fabric_domain_utilization")
    seen: set[str] = set()
    for index, domain in enumerate(domains):
        pointer = f"/system_summary/fabric_domain_utilization/{index}"
        domain_id = domain.get("domain_id") if isinstance(domain, dict) else None
        if not isinstance(domain_id, str) or not domain_id or domain_id in seen:
            _contract_error("Metrics Fabric domain IDs must be nonempty and unique.", f"{pointer}/domain_id")
        seen.add(domain_id)
        subjects = domain.get("subject_refs")
        if (
            not isinstance(subjects, list)
            or len(subjects) != 1
            or not isinstance(subjects[0], dict)
            or subjects[0].get("kind") != "fabric_domain"
            or subjects[0].get("id") != domain_id
            or subjects[0].get("fabric_domain_id") != domain_id
        ):
            _contract_error(
                "Metrics Fabric-domain subject does not match domain_id.",
                f"{pointer}/subject_refs",
            )
        ref = domain.get("topology_domain_ref")
        if not isinstance(ref, dict):
            _contract_error("Metrics Fabric domain requires topology_domain_ref.", f"{pointer}/topology_domain_ref")
        target_pointer = ref.get("json_pointer")
        try:
            target = resolve_json_pointer(topology, target_pointer)
        except (KeyError, TypeError) as error:
            raise ArtifactContractError(
                "contract_violation", "topology_domain_ref is dangling.",
                json_pointer=f"{pointer}/topology_domain_ref/json_pointer",
            ) from error
        _validate_f7_ref(
            ref, run_id=run_id, artifact_id="input-topology",
            schema_identity="tilesim.s6_topology_input.v1", json_pointer=target_pointer,
            subject_kind="fabric_domain", subject_id=domain_id,
            pointer=f"{pointer}/topology_domain_ref",
        )
        if (
            not isinstance(target, dict)
            or target.get("domain_id") != domain_id
            or target.get("subject") != ref.get("subject")
            or target.get("json_pointer") != target_pointer
        ):
            _contract_error("Metrics/topology Fabric-domain subject mismatch.", f"{pointer}/topology_domain_ref")


def _validate_runtime_evidence(value: dict, schema_identity: str) -> None:
    """Validate the fields the runtime evidence views and references consume."""
    def nonnegative_integer(item: object, pointer: str) -> None:
        if type(item) is not int or item < 0 or item > 18_446_744_073_709_551_615:
            _contract_error("Runtime evidence requires a uint64 integer.", pointer)

    if schema_identity in {"tilesim.s1_runtime_event_trace.v1", "tilesim.s1_runtime_analysis.v1"}:
        if not isinstance(value.get("trace_name"), str):
            _contract_error("Runtime trace_name is required.", "/trace_name")
        events = value.get("events")
        if not isinstance(events, list):
            _contract_error("Runtime events must be an array.", "/events")
        for index, event in enumerate(events):
            pointer = f"/events/{index}"
            if not isinstance(event, dict) or any(not isinstance(event.get(field), str) for field in ("kind", "request_id", "batch_id")):
                _contract_error("Runtime event identity is invalid.", pointer)
            if not isinstance(event.get("batch_request_ids"), list) or any(not isinstance(member, str) for member in event["batch_request_ids"]):
                _contract_error("Runtime batch request identities are invalid.", pointer + "/batch_request_ids")
            if len(event["batch_request_ids"]) != len(set(event["batch_request_ids"])):
                _contract_error("Runtime batch request identities must be unique.", pointer + "/batch_request_ids")
            for field in ("event_time_ps", "logical_step", "kv_tokens", "active_requests"):
                nonnegative_integer(event.get(field), pointer + "/" + field)
    if schema_identity in {"tilesim.s1_runtime_event_summary.v1", "tilesim.s1_runtime_analysis.v1"}:
        summary = value.get("summary") if schema_identity.endswith("analysis.v1") else value
        if not isinstance(summary, dict):
            _contract_error("Runtime summary is required.", "/summary")
        for field in ("has_events", "monotonic_time_order", "contiguous_logical_steps"):
            if type(summary.get(field)) is not bool:
                _contract_error("Runtime summary flag is invalid.", ("/summary" if summary is not value else "") + "/" + field)
        for field in ("total_events", "first_event_time_ps", "last_event_time_ps", "peak_active_requests"):
            nonnegative_integer(summary.get(field), ("/summary" if summary is not value else "") + "/" + field)
    if schema_identity in {"tilesim.s1_runtime_request_summaries.v1", "tilesim.s1_runtime_analysis.v1"}:
        requests = value.get("requests")
        if not isinstance(requests, list):
            _contract_error("Runtime requests must be an array.", "/requests")
        seen = set()
        for index, request in enumerate(requests):
            pointer = f"/requests/{index}"
            request_id = request.get("request_id") if isinstance(request, dict) else None
            if not isinstance(request_id, str) or not request_id or request_id in seen:
                _contract_error("Runtime request identity is missing or duplicated.", pointer + "/request_id")
            seen.add(request_id)
            for field in ("arrival_time_ps", "admit_time_ps", "first_batch_issue_time_ps", "first_token_time_ps", "completion_time_ps", "final_kv_tokens"):
                nonnegative_integer(request.get(field), pointer + "/" + field)


_ATTRIBUTION_TARGETS = {
    "metrics/request_metrics": ("request", "request_id"),
    "evidence/des_events": ("des_event", "event_id"),
    "evidence/resource_operations": ("resource_operation", "operation_id"),
    "evidence/network_demands": ("network_demand", "demand_id"),
    "evidence/fabric/timeline": ("fabric_phase", "phase_id"),
}


def _validate_request_attribution(value: dict, run_id: str, path: Path) -> None:
    """Check backend identities and self-contained references before publication."""
    schema = "tilesim.request_attribution.v1"
    embedded = value.get("metrics")
    evidence = value.get("evidence")
    requests = value.get("requests")
    if not isinstance(embedded, dict) or embedded.get("run_id") != run_id or embedded.get("schema_version") != "tilesim.metrics_report.v1":
        _contract_error("Embedded request metrics are not bound to this run.", "/metrics/run_id")
    if not isinstance(evidence, dict) or evidence.get("run_id") != run_id or not evidence.get("des_committed_event_digest"):
        _contract_error("Dense DES evidence is missing or belongs to another run.", "/evidence/run_id")
    if not isinstance(requests, list) or not requests:
        _contract_error("Ready attribution requires nonempty request reports.", "/requests")
    metric_rows = embedded.get("request_metrics")
    if not isinstance(metric_rows, list) or not metric_rows:
        _contract_error("Attribution requires request metric identities.", "/metrics/request_metrics")
    metric_ids = [row.get("request_id") if isinstance(row, dict) else None for row in metric_rows]
    if any(not isinstance(id, str) or not id for id in metric_ids) or len(set(metric_ids)) != len(metric_ids):
        _contract_error("Request metric identities must be nonempty and unique.", "/metrics/request_metrics")
    try:
        external = json.loads((path.parent / "metrics.json").read_bytes())
        external_ids = [row["request_id"] for row in external["request_metrics"]]
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError) as error:
        raise ArtifactContractError("contract_violation", "Metrics identity target is unavailable.", json_pointer="/metrics/request_metrics") from error
    if external.get("run_id") != run_id or external.get("schema_version") != embedded["schema_version"] or external_ids != metric_ids:
        _contract_error("Attribution request identities disagree with the run metrics artifact.", "/metrics/request_metrics")
    for prefix, (_, id_key) in _ATTRIBUTION_TARGETS.items():
        if prefix.startswith("metrics/"):
            continue
        try:
            rows = resolve_json_pointer(value, "/" + prefix)
        except KeyError:
            _contract_error("Attribution evidence collection is absent.", "/" + prefix)
        if not isinstance(rows, list) or not rows:
            _contract_error("Dense attribution requires actual resource and network evidence.", "/" + prefix)
        ids = [row.get(id_key) if isinstance(row, dict) else None for row in rows]
        if any(not isinstance(id, str) or not id for id in ids) or len(set(ids)) != len(ids):
            _contract_error("Attribution evidence IDs must be nonempty and unique.", "/" + prefix)

    def check_refs(owner: dict, pointer: str, request_id: str, *, interval: bool = False) -> None:
        subjects = owner.get("subject_refs")
        refs = owner.get("evidence_refs")
        if (not interval and not isinstance(subjects, list)) or not isinstance(refs, list) or not refs:
            _contract_error("Attribution requires subject and evidence references.", pointer)
        subject_pairs = {
            (subject.get("kind"), subject.get("id"))
            for subject in (subjects or []) if isinstance(subject, dict)
        }
        if not interval and ("request", request_id) not in subject_pairs:
            _contract_error("Attribution subject does not identify its request.", pointer + "/subject_refs")
        for index, ref in enumerate(refs):
            ref_path = f"{pointer}/evidence_refs/{index}"
            if not isinstance(ref, dict) or ref.get("run_id") != run_id or ref.get("artifact_id") != "request_attribution" or ref.get("schema_identity") != schema or ref.get("availability") != "available":
                _contract_error("Attribution evidence identity does not match this artifact.", ref_path)
            target_pointer = ref.get("json_pointer")
            match = re.fullmatch(r"/((?:metrics/request_metrics|evidence/des_events|evidence/resource_operations|evidence/network_demands|evidence/fabric/timeline))/([0-9]+)", target_pointer) if isinstance(target_pointer, str) else None
            if not match:
                _contract_error("Attribution evidence pointer is not an allowed target.", ref_path + "/json_pointer")
            target_kind, id_key = _ATTRIBUTION_TARGETS[match.group(1)]
            try:
                target = resolve_json_pointer(value, target_pointer)
            except KeyError as error:
                raise ArtifactContractError("contract_violation", "Attribution evidence pointer is dangling.", json_pointer=ref_path + "/json_pointer") from error
            subject = ref.get("subject")
            target_id = target.get(id_key) if isinstance(target, dict) else None
            if not isinstance(subject, dict) or subject.get("kind") != target_kind or subject.get("id") != target_id or (not interval and (target_kind, target_id) not in subject_pairs):
                _contract_error("Attribution evidence target and subject disagree.", ref_path + "/subject")
            if target_kind == "request" and target_id != request_id:
                _contract_error("Attribution metric reference belongs to another request.", ref_path + "/subject")

    report_ids = set()
    seen_requests = set()
    for index, report in enumerate(requests):
        pointer = f"/requests/{index}"
        if not isinstance(report, dict) or report.get("run_id") != run_id or report.get("schema_version") != "tilesim.tail_cause_chain_report.v1":
            _contract_error("Request report identity is invalid.", pointer)
        entity = report.get("explained_entity")
        request_id = entity.get("id") if isinstance(entity, dict) and entity.get("kind") == "request" else None
        report_id = report.get("report_id")
        if not isinstance(request_id, str) or request_id not in metric_ids or request_id in seen_requests or not isinstance(report_id, str) or not report_id.startswith(run_id + "::request_critical_path::") or report_id in report_ids:
            _contract_error("Request attribution identity is absent, duplicated, or not in metrics.", pointer + "/explained_entity")
        seen_requests.add(request_id)
        report_ids.add(report_id)
        for field in ("cause_chain", "attribution_ranking"):
            rows = report.get(field)
            if not isinstance(rows, list) or not rows:
                _contract_error("Request attribution has no cause chain or ranking.", pointer + "/" + field)
            for row_index, row in enumerate(rows):
                if not isinstance(row, dict):
                    _contract_error("Attribution row must be an object.", f"{pointer}/{field}/{row_index}")
                row_path = f"{pointer}/{field}/{row_index}"
                check_refs(row, row_path, request_id)
                if field == "cause_chain":
                    for part_index, part in enumerate(row.get("network_intervals", [])):
                        if not isinstance(part, dict):
                            _contract_error("Network interval must be an object.", row_path + "/network_intervals")
                        check_refs(part, f"{row_path}/network_intervals/{part_index}", request_id, interval=True)
    if seen_requests != set(metric_ids):
        _contract_error("Attribution and metrics request sets differ.", "/requests")


def inspect_artifact(run_id: str, path: Path, definition: dict) -> dict:
    try:
        body = path.read_bytes()
        value = json.loads(body)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ArtifactContractError("invalid_json", "Artifact is not valid JSON.") from error
    if not isinstance(value, dict):
        raise ArtifactContractError("invalid_json", "Artifact root must be a JSON object.")

    descriptor_id = definition.get("descriptor_artifact_id")
    if descriptor_id and value.get("state") == "expected_absence":
        if value.get("run_id") != run_id:
            raise ArtifactContractError("run_binding_mismatch", "Descriptor run binding does not match.", schema_identity=json_schema_identity(value), json_pointer="/run_id")
        if value.get("schema_version") != "tilesim.wind_tunnel_artifact_descriptor.v1":
            raise ArtifactContractError("unsupported_schema", "Descriptor schema identity is unsupported.", schema_identity=json_schema_identity(value), json_pointer="/schema_version")
        if (
            set(value) != {"schema_version", "run_id", "artifact_id", "state", "evidence_requirement", "absence_reason", "detail"}
            or value.get("artifact_id") != descriptor_id
            or value.get("absence_reason") != "not_expected_for_boundary"
            or any(not isinstance(value.get(key), str) or not value[key] for key in ("evidence_requirement", "detail"))
        ):
            _contract_error("Expected-absence descriptor is invalid.", "/artifact_id")
        return {"body": body, "value": value, "schema_identity": "tilesim.wind_tunnel_artifact_descriptor.v1", "contract_status": "supported", "content_status": "expected_absence"}

    schema_identity = json_schema_identity(value)
    supported_identities = definition.get("schema_identities", [])
    if supported_identities:
        if schema_identity in supported_identities:
            contract_status = "supported"
        elif schema_identity in definition.get("legacy_schema_identities", []):
            contract_status = "legacy_compatibility"
        elif not schema_identity and definition.get("allow_legacy_unversioned", False):
            contract_status = "legacy_compatibility"
        else:
            raise ArtifactContractError(
                "unsupported_schema",
                "Artifact schema identity is not supported by this Bridge schema set.",
                schema_identity=schema_identity,
                json_pointer="/schema_version",
            )
    else:
        contract_status = "not_applicable"

    run_id_pointer = definition.get("run_id_pointer")
    if run_id_pointer and contract_status == "supported":
        try:
            artifact_run_id = resolve_json_pointer(value, run_id_pointer)
        except KeyError as error:
            raise ArtifactContractError(
                "run_binding_mismatch",
                "Supported artifact is missing its declared run binding.",
                schema_identity=schema_identity,
                json_pointer=run_id_pointer,
            ) from error
        if artifact_run_id != run_id:
            raise ArtifactContractError(
                "run_binding_mismatch",
                "Artifact run binding does not match the manifest run.",
                schema_identity=schema_identity,
                json_pointer=run_id_pointer,
            )
    if definition.get("forbid_self_sha256", False) and any(
        field in value for field in ("sha256", "artifact_sha256", "self_sha256")
    ):
        raise ArtifactContractError(
            "self_hash_cycle",
            "Artifact must not embed its own SHA-256; the manifest is authoritative.",
            schema_identity=schema_identity,
            json_pointer="/sha256",
        )
    if contract_status == "supported":
        if schema_identity == "tilesim.s6_topology_input.v1":
            _validate_topology_contract(value, run_id)
        elif schema_identity == "tilesim.design_space_report.v1":
            _validate_design_space_contract(value, run_id)
        elif schema_identity == "tilesim.metrics_report.v1":
            _validate_metrics_topology_refs(value, run_id, path)
        elif schema_identity in {
            "tilesim.s1_runtime_event_trace.v1", "tilesim.s1_runtime_event_summary.v1",
            "tilesim.s1_runtime_request_summaries.v1", "tilesim.s1_runtime_analysis.v1",
        }:
            _validate_runtime_evidence(value, schema_identity)
        elif schema_identity == "tilesim.request_attribution.v1":
            _validate_request_attribution(value, run_id, path)
    return {
        "body": body,
        "value": value,
        "schema_identity": schema_identity,
        "contract_status": contract_status,
        "content_status": "ready",
    }


def _artifact_entries(run_id: str, run_dir: Path, artifact_definitions: dict) -> tuple[list[dict], list[dict]]:
    artifacts = []
    rejected_artifacts = []
    for artifact_id, definition in artifact_definitions.items():
        path = run_dir / definition["file_name"]
        if not path.is_file():
            continue
        try:
            inspected = inspect_artifact(run_id, path, definition)
        except ArtifactContractError as error:
            rejected_artifacts.append(
                {
                    "artifact_id": artifact_id,
                    "file_name": definition["file_name"],
                    "reason": error.reason,
                    "schema_identity": error.schema_identity,
                    "json_pointer": error.json_pointer,
                }
            )
            continue
        body = inspected["body"]
        artifacts.append(
            {
                "artifact_id": artifact_id,
                "report_kind": definition["report_kind"],
                "file_name": definition["file_name"],
                "media_type": "application/json",
                "bytes": len(body),
                "sha256": hashlib.sha256(body).hexdigest(),
                "schema_identity": inspected["schema_identity"],
                "contract_status": inspected["contract_status"],
                "content_status": inspected["content_status"],
            }
        )
    return artifacts, rejected_artifacts


def validate_artifact_manifest(
    manifest: dict,
    run_id: str,
    run_dir: Path,
    *,
    artifact_definitions: dict,
    artifact_manifest_schema: str,
    api_version: str,
    schema_set_revision: str,
) -> None:
    expected_artifacts, expected_rejections = _artifact_entries(
        run_id, run_dir, artifact_definitions
    )
    expected_top_level = {
        "schema_version": artifact_manifest_schema,
        "api_version": api_version,
        "schema_set_revision": schema_set_revision,
        "run_id": run_id,
    }
    for field, expected in expected_top_level.items():
        if manifest.get(field) != expected:
            raise ArtifactManifestValidationError(f"Artifact manifest {field} mismatch.")
    if manifest.get("artifacts") != expected_artifacts:
        raise ArtifactManifestValidationError(
            "Artifact manifest bytes, SHA-256, identity, status, or allow-list entries mismatch."
        )
    if manifest.get("rejected_artifacts") != expected_rejections:
        raise ArtifactManifestValidationError("Artifact manifest rejection set mismatch.")


def artifact_manifest_for(
    run_id: str,
    run_dir: Path,
    *,
    artifact_definitions: dict,
    artifact_manifest_schema: str,
    api_version: str,
    schema_set_revision: str,
) -> dict:
    artifacts, rejected_artifacts = _artifact_entries(run_id, run_dir, artifact_definitions)
    manifest = {
        "schema_version": artifact_manifest_schema,
        "api_version": api_version,
        "schema_set_revision": schema_set_revision,
        "run_id": run_id,
        "artifacts": artifacts,
        "rejected_artifacts": rejected_artifacts,
    }
    validate_artifact_manifest(
        manifest,
        run_id,
        run_dir,
        artifact_definitions=artifact_definitions,
        artifact_manifest_schema=artifact_manifest_schema,
        api_version=api_version,
        schema_set_revision=schema_set_revision,
    )
    return manifest


def safe_run_directory(run_id: str, runs_root: Path) -> Path | None:
    if not run_id.startswith("run-") or Path(run_id).name != run_id:
        return None
    candidate = (runs_root / run_id).resolve()
    return candidate if candidate.parent == runs_root.resolve() and candidate.is_dir() else None


def read_json_file(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
    except (OSError, json.JSONDecodeError):
        return {}


def is_valid_json_file(path: Path) -> bool:
    try:
        json.loads(path.read_text(encoding="utf-8"))
        return True
    except (OSError, json.JSONDecodeError):
        return False


def atomic_write_json(path: Path, payload: dict) -> None:
    """Durably replace one JSON file without exposing a partially written document."""
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        with temporary.open("x", encoding="utf-8", newline="\n") as stream:
            stream.write(json.dumps(payload, ensure_ascii=False, indent=2))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        if os.name != "nt":
            try:
                directory_fd = os.open(path.parent, os.O_RDONLY)
                try:
                    os.fsync(directory_fd)
                finally:
                    os.close(directory_fd)
            except OSError:
                # Some WSL-mounted Windows filesystems do not support directory fsync.
                pass
    finally:
        try:
            temporary.unlink()
        except FileNotFoundError:
            pass


def update_run_metadata(
    run_dir: Path,
    *,
    read_json: Callable[[Path], dict] = read_json_file,
    write_json: Callable[[Path, dict], None] = atomic_write_json,
    **updates: object,
) -> None:
    """Keep the durable run status aligned with the in-memory task state."""
    metadata_path = run_dir / "run-metadata.json"
    metadata = read_json(metadata_path)
    if not metadata:
        raise OSError(f"Run metadata is missing or invalid: {metadata_path}")
    metadata.update(updates)
    write_json(metadata_path, metadata)


def run_digest(report_paths: dict[str, Path]) -> dict:
    run_report = read_json_file(report_paths["run"])
    metrics = read_json_file(report_paths["metrics"])
    validation = read_json_file(report_paths["validation"])
    return {
        "end_to_end_latency_us": run_report.get("summary", {}).get("end_to_end_latency_us"),
        "throughput_requests_per_second": metrics.get("summary", {}).get(
            "throughput_requests_per_second"
        ),
        "completed_request_count": metrics.get("summary", {}).get("completed_request_count"),
        "request_count": metrics.get("summary", {}).get("request_count"),
        "validation_lane": validation.get("validation_lane"),
        "evidence_tier": metrics.get("evidence_tier") or validation.get("evidence_tier"),
    }


def persisted_run(
    run_id: str,
    *,
    runs_root: Path,
    report_file_names: dict,
    bridge_instance_id: str,
    now: Callable[[], str],
    write_json: Callable[[Path, dict], None] = atomic_write_json,
) -> dict | None:
    run_dir = safe_run_directory(run_id, runs_root)
    if run_dir is None:
        return None
    report_paths = report_paths_for(run_dir, report_file_names)
    metadata = read_json_file(run_dir / "run-metadata.json")
    has_durable_metadata = bool(metadata)
    if not has_durable_metadata:
        metadata = {
            "run_id": run_id,
            "created_at": datetime.fromtimestamp(run_dir.stat().st_mtime, tz=timezone.utc).isoformat(),
            "scenario_id": "unknown",
            "input_mode": "legacy",
        }
    if (
        metadata.get("status") in {"preparing", "running"}
        and metadata.get("bridge_instance_id")
        and metadata.get("bridge_instance_id") != bridge_instance_id
        and not report_paths["run"].is_file()
    ):
        metadata.update(
            {
                "status": "failed",
                "finished_at": now(),
                "error": "Bridge restarted before the run reached a durable terminal state.",
                "failure_code": "bridge_execution_interrupted",
            }
        )
        try:
            write_json(run_dir / "run-metadata.json", metadata)
        except OSError:
            pass
    metadata["run_id"] = run_id
    if not has_durable_metadata:
        metadata["status"] = "completed" if is_valid_json_file(report_paths["run"]) else "incomplete"
    else:
        metadata["status"] = metadata.get(
            "status",
            "completed" if is_valid_json_file(report_paths["run"]) else "incomplete",
        )
    metadata["report_paths"] = report_paths
    metadata["digest"] = run_digest(report_paths)
    return metadata


def public_run(run: dict) -> dict:
    public = {
        key: value
        for key, value in run.items()
        if key
        not in {
            "report_paths",
            "stdout",
            "stderr",
            "idempotency_key",
            "request_payload_sha256",
            "bridge_instance_id",
            "bridge_pid",
        }
    }
    if "digest" not in public and "report_paths" in run:
        public["digest"] = run_digest(run["report_paths"])
    return public


def idempotent_run(
    key: str,
    *,
    runs: dict[str, dict],
    runs_root: Path,
    load_persisted_run: Callable[[str], dict | None],
) -> dict | None:
    for run in runs.values():
        if run.get("idempotency_key") == key:
            return run
    for run_dir in runs_root.iterdir():
        if not run_dir.is_dir():
            continue
        metadata = read_json_file(run_dir / "run-metadata.json")
        if metadata.get("idempotency_key") == key:
            return load_persisted_run(run_dir.name)
    return None


def creation_response(run: dict, *, idempotent_replay: bool) -> dict:
    public = public_run(run)
    return {
        key: public.get(key)
        for key in (
            "run_id",
            "run_name",
            "status",
            "input_mode",
            "overrides",
            "input_files",
            "design_space_mode",
            "error",
        )
        if key in public
    } | {"idempotent_replay": idempotent_replay}


def run_snapshot(
    run_id: str,
    *,
    runs: dict[str, dict],
    runs_lock: threading.Lock,
    load_persisted_run: Callable[[str], dict | None],
) -> dict | None:
    with runs_lock:
        active = runs.get(run_id)
        snapshot = active.copy() if active is not None else None
    return snapshot if snapshot is not None else load_persisted_run(run_id)


def is_terminal_run(run: dict) -> bool:
    return run.get("status") in {"completed", "failed"}
