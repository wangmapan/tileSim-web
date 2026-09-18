"""Read-only Run Intake v2 preview service.

Single entry point for "validate + judge + assemble a typed result".  The service never
creates a run, never writes ``runs/``, never imports ``repositories/runs.py`` and never
touches the run lifecycle.

Backend lowering issues are passed through verbatim: ``code`` / ``message`` /
``field_path`` / ``blocking`` / ``safe_next_action`` are never merged, rewritten or
fabricated.  A backend issue that does not carry all five fields is a fail-closed
request-validation failure, not a filled-in placeholder.

Error shape reuses the existing Bridge pattern: ``contracts.validation``
``RequestValidationError`` carrying ``field_path`` and ``nested_schema_identity``, which
``api/responses.py::write_error(nested_schema_identity=...)`` already renders.  No new
error schema is introduced, and this module registers no route: it only exposes the
HTTP-surface entry point :func:`preview_run_intake_request`, which validates the published
``tilesim.bridge.agent_orchestration_run_intake_preview_request.v1`` envelope and then
delegates to :func:`preview_run_intake`.  ``bridge/server.py`` owns the route.

A rejected compatibility verdict is a *judged* outcome, not a transport failure: the
endpoint returns the typed result with HTTP 200 and lets ``judgement.accepted`` /
``judgement.code`` carry the verdict, so a 4xx never swallows the Profile issues and
persistence facts the browser needs.  The error envelope is reserved for submissions the
published contract cannot judge at all.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping, Sequence

from contracts.agent_orchestration_phase2 import registry
from contracts.validation import RequestValidationError

CONTRACT_PACKAGE_ROOT = (
    Path(__file__).resolve().parents[1] / "contracts" / "agent_orchestration_phase2"
)
MANIFEST_PATH = CONTRACT_PACKAGE_ROOT / "manifest.json"

RUN_INTAKE_SERVICE_ID = "agent_orchestration_run_intake_preview"
RUN_INTAKE_ISSUE_FIELDS = (
    "code",
    "message",
    "field_path",
    "blocking",
    "safe_next_action",
)
PLANNING_STATUS = ("blocked", "unknown")
PREVIEW_REQUEST_FIELDS = ("intake",)


def published_profile_records() -> dict[str, tuple[Mapping[str, Any], ...]]:
    """Read the published Phase 2 manifest ``profile_records`` (read-only).

    The published package currently declares five empty record sets, so every Profile
    reference resolves fail closed as ``profile_missing``.  This function never invents
    a record.
    """
    try:
        document = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RequestValidationError(
            "The published Phase 2 Agent orchestration manifest is unavailable.",
            "/profile_records",
            nested_schema_identity=registry.PROFILE_BINDING_IDENTITY,
        ) from error
    records = document.get("profile_records")
    if not isinstance(records, Mapping) or set(records) != set(registry.PROFILE_FAMILIES):
        raise RequestValidationError(
            "The published manifest does not declare exactly the five Profile families.",
            "/profile_records",
            nested_schema_identity=registry.PROFILE_BINDING_IDENTITY,
        )
    for family in registry.PROFILE_FAMILIES:
        if not isinstance(records[family], list):
            raise RequestValidationError(
                f"The published manifest {family} profile records must be a list.",
                f"/profile_records/{family}",
                nested_schema_identity=registry.PROFILE_BINDING_IDENTITY,
            )
    return {family: tuple(records[family]) for family in registry.PROFILE_FAMILIES}


def normalize_backend_issues(
    issues: "Sequence[Mapping[str, Any]]",
) -> tuple[Mapping[str, Any], ...]:
    """Validate the five RunIntakeIssue fields without rewriting any value."""
    if isinstance(issues, (str, bytes)) or not isinstance(issues, Sequence):
        raise RequestValidationError(
            "Backend lowering issues must be a sequence of objects.",
            "/issues",
            nested_schema_identity=registry.RUN_INTAKE_IDENTITY,
        )
    normalized: list[Mapping[str, Any]] = []
    for index, issue in enumerate(issues):
        if not isinstance(issue, Mapping):
            raise RequestValidationError(
                f"Backend lowering issue {index} must be an object.",
                f"/issues/{index}",
                nested_schema_identity=registry.RUN_INTAKE_IDENTITY,
            )
        missing = [name for name in RUN_INTAKE_ISSUE_FIELDS if name not in issue]
        if missing:
            raise RequestValidationError(
                f"Backend lowering issue {index} is missing {missing[0]}; the service "
                "never fabricates RunIntakeIssue fields.",
                f"/issues/{index}/{missing[0]}",
                nested_schema_identity=registry.RUN_INTAKE_IDENTITY,
            )
        if not isinstance(issue["blocking"], bool):
            raise RequestValidationError(
                f"Backend lowering issue {index} blocking must be boolean.",
                f"/issues/{index}/blocking",
                nested_schema_identity=registry.RUN_INTAKE_IDENTITY,
            )
        normalized.append(dict(issue))
    return tuple(normalized)


class RunIntakePreviewService:
    """Validate, judge and assemble; nothing else."""

    def __init__(
        self,
        *,
        registered_revisions: Mapping[str, Any] | None = None,
        profile_records: Mapping[str, Any] | None = None,
    ) -> None:
        self._registered_revisions = registered_revisions
        self._profile_records = profile_records

    def _revision_table(self) -> Mapping[str, Any] | None:
        return self._registered_revisions

    def preview(
        self,
        payload: Mapping[str, Any] | None,
        *,
        route: str = registry.ROUTE_NESTED_INTAKE_V2,
        expected_revision: str | None = None,
        profile_records: Mapping[str, Any] | None = None,
        backend_issues: "Sequence[Mapping[str, Any]]" = (),
        idempotency: Mapping[str, Any] | None = None,
        claim_requires_calibration: bool = False,
    ) -> dict[str, Any]:
        """Return one typed preview result for a submission.

        A rejected compatibility verdict is returned, not raised, so the endpoint layer
        can map published codes onto HTTP statuses.  Schema-invalid submissions are
        request-validation failures instead, because the published compatibility matrix
        publishes no code for them.
        """
        if payload is not None and not isinstance(payload, Mapping):
            raise RequestValidationError(
                "Run Intake v2 payload must be a JSON object.",
                "/",
                nested_schema_identity=registry.RUN_INTAKE_IDENTITY,
            )
        try:
            verdict = registry.judge_route(
                payload,
                route=route,
                registered_revisions=self._revision_table(),
                expected_revision=expected_revision,
            )
            issues = normalize_backend_issues(backend_issues)
        except registry.ContractValidationError as error:
            raise RequestValidationError(
                str(error),
                error.path,
                nested_schema_identity=registry.RUN_INTAKE_IDENTITY,
            ) from error

        policy = registry.published_retention_policy_facts()
        result: dict[str, Any] = {
            "service": RUN_INTAKE_SERVICE_ID,
            "route": route,
            "run_creation": "not_performed",
            "run_acceptance": "not_accepted_by_current_api",
            "judgement": verdict.as_dict(),
            "intake": None,
            "profile_binding": None,
            "idempotency": None,
            "backend_issues": [dict(issue) for issue in issues],
            "planning_status": "blocked",
            "persistence": {
                "write_capability": "absent",
                "forbidden_persistence": list(policy["forbidden_persistence"]),
                "idempotency": dict(policy["idempotency"]),
                "retention": dict(policy["retention"]),
            },
        }
        if not verdict.accepted or payload is None:
            return result

        identity = payload.get("schema_identity")
        if identity is not None:
            result["intake"] = {
                "identity": identity,
                "revision": payload.get("schema_revision"),
                "intake_id": payload.get("intake_id"),
                "declared_canonical_digest": payload.get("canonical_digest"),
                "requested_fidelity": payload.get("requested_fidelity"),
                "gpu_participation_mode": payload.get("gpu_participation_mode"),
                "trace_source_mode": (payload.get("trace_source") or {}).get("mode"),
            }

        if identity == registry.RUN_INTAKE_IDENTITY:
            resolution = self._resolve_profile_binding(
                payload, profile_records, claim_requires_calibration
            )
            result["profile_binding"] = resolution.as_dict()
            result["planning_status"] = (
                "blocked" if not resolution.resolved else "unknown"
            )

        if idempotency is not None:
            result["idempotency"] = self._judge_idempotency(
                idempotency, payload, identity
            ).as_dict()
        return result

    def _resolve_profile_binding(
        self,
        payload: Mapping[str, Any],
        profile_records: Mapping[str, Any] | None,
        claim_requires_calibration: bool,
    ) -> registry.ProfileBindingResolution:
        records = profile_records
        if records is None:
            records = self._profile_records
        if records is None:
            records = published_profile_records()
        try:
            return registry.evaluate_profile_binding(
                payload["profile_binding"],
                profile_records=records,
                claim_requires_calibration=claim_requires_calibration,
            )
        except registry.ContractValidationError as error:
            raise RequestValidationError(
                str(error),
                error.path,
                nested_schema_identity=registry.PROFILE_BINDING_IDENTITY,
            ) from error

    def _judge_idempotency(
        self,
        idempotency: Mapping[str, Any],
        payload: Mapping[str, Any],
        identity: Any,
    ) -> registry.Judgement:
        if not isinstance(idempotency, Mapping) or "stored" not in idempotency:
            raise RequestValidationError(
                "Idempotency facts must be an object carrying an explicit stored record "
                "or null; the service never assumes a free key.",
                "/idempotency",
                nested_schema_identity=registry.RUN_INTAKE_IDENTITY,
            )
        digest = idempotency.get("payload_digest")
        if digest is None:
            digest = registry.canonical_payload_digest(payload)
        if not isinstance(digest, str):
            raise RequestValidationError(
                "Idempotency payload_digest must be a string.",
                "/idempotency/payload_digest",
                nested_schema_identity=registry.RUN_INTAKE_IDENTITY,
            )
        try:
            return registry.evaluate_idempotency(
                idempotency["stored"],
                {
                    "canonical_payload_digest": digest,
                    "identity": identity,
                    "revision": payload.get("schema_revision"),
                },
            )
        except registry.ContractValidationError as error:
            raise RequestValidationError(
                str(error),
                error.path,
                nested_schema_identity=registry.RUN_INTAKE_IDENTITY,
            ) from error


def preview_request_payload(document: object) -> Mapping[str, Any] | None:
    """Validate the published preview request envelope and return the nested payload.

    Only client-owned members are accepted.  ``expected_revision``, the registered revision
    table, ``profile_records``, backend lowering issues, ``claim_requires_calibration`` and
    the dispatcher route are all fixed by the server, so an envelope that names any of them
    is refused instead of silently ignored - a client must not be able to forge an accepted
    or Profile-resolved verdict.  An explicit ``intake: null`` is the expected-absence case
    (the create-run v1 accept set is unchanged); an omitted ``intake`` member is a missing
    value and stays a request-validation failure.
    """
    if not isinstance(document, Mapping):
        raise RequestValidationError(
            "Run Intake preview request must be a JSON object.",
            "/",
            nested_schema_identity=registry.RUN_INTAKE_IDENTITY,
        )
    if "intake" not in document:
        raise RequestValidationError(
            "Run Intake preview request must carry an explicit intake member; an omitted "
            "member is a missing value, not the expected absence of a nested payload.",
            "/intake",
            nested_schema_identity=registry.RUN_INTAKE_IDENTITY,
        )
    unknown = sorted(set(document) - set(PREVIEW_REQUEST_FIELDS))
    if unknown:
        raise RequestValidationError(
            f"{unknown[0]} is not a client-owned Run Intake preview member; server-owned "
            "judging inputs are refused rather than ignored.",
            f"/{unknown[0]}",
            nested_schema_identity=registry.RUN_INTAKE_IDENTITY,
        )
    return document["intake"]


def preview_run_intake(
    payload: Mapping[str, Any] | None,
    *,
    route: str = registry.ROUTE_NESTED_INTAKE_V2,
    expected_revision: str | None = None,
    registered_revisions: Mapping[str, Any] | None = None,
    profile_records: Mapping[str, Any] | None = None,
    backend_issues: "Sequence[Mapping[str, Any]]" = (),
    idempotency: Mapping[str, Any] | None = None,
    claim_requires_calibration: bool = False,
) -> dict[str, Any]:
    """Module-level entry point; endpoint registration belongs to WP-2C-01b."""
    return RunIntakePreviewService(
        registered_revisions=registered_revisions,
        profile_records=profile_records,
    ).preview(
        payload,
        route=route,
        expected_revision=expected_revision,
        profile_records=profile_records,
        backend_issues=backend_issues,
        idempotency=idempotency,
        claim_requires_calibration=claim_requires_calibration,
    )


def preview_run_intake_request(
    document: object,
    *,
    profile_records: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """HTTP-surface entry point: validate the envelope, then preview the nested payload.

    ``preview_run_intake_request`` returns the same typed result as
    :func:`preview_run_intake`; the endpoint adds, removes and rewrites nothing.
    """
    return preview_run_intake(
        preview_request_payload(document), profile_records=profile_records
    )
