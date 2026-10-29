"""Run Intake v2 identity/revision registry, compatibility judging and retention rules.

Read-only and side-effect free: this module never persists data, never creates a run and
never touches the run lifecycle (WP-2C-01a write boundary).

All JSON Schema work is delegated to :mod:`.validator` (``validate_contract``,
``IDENTITIES``, ``canonical_digest``, ``ContractValidationError``); no schema rule is
re-implemented here.

The compatibility vocabulary is frozen from the published Phase 2A acceptance fixture
``bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/compatibility-matrix.json``
(``scenario`` / ``expected`` / ``error_code``).  ``test_server.py`` asserts these constants
still equal that fixture.  No code may be invented: if a case needs a code that the fixture
does not publish, the work stops and is reported as a blocker instead.

Resolution detail tokens (stable, and the only place where two rows of the same code are
told apart):

* ``missing_contract_identity`` — ``nested_intake_identity_missing``
* ``unknown_contract_identity`` — ``identity_not_registered``
* ``unknown_contract_revision`` — ``revision_missing`` / ``revision_not_registered`` /
  ``revision_registry_missing`` / ``expected_revision_mismatch``
* ``mixed_contract_version`` — ``legacy_field_present`` / ``legacy_nested_profile_identity``
* ``unsupported_contract_identity`` — ``successor_identity_on_v1_route`` /
  ``identity_not_served_by_route``
* ``explicit_migration_required`` — ``explicit_v1_identity``
* ``unknown_nested_identity`` — ``pre_phase2_server_generation``
* ``idempotency_payload_mismatch`` — ``payload_changed`` / ``version_changed`` /
  ``profile_revision_changed`` / ``retained_record_digest_missing``
* ``validation_report_stale`` — ``self_declared_stale`` / ``stale_binding_changed`` /
  ``stale_binding_unverified``
"""

from __future__ import annotations

import copy
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Mapping

from ..experiment_descriptor import CREATE_RUN_SCHEMA_IDENTITY
from .validator import (
    IDENTITIES,
    ContractValidationError,
    canonical_digest,
    validate_contract,
)

SCHEMA_ROOT = Path(__file__).with_name("schemas")
ROOT = Path(__file__).parent
PROFILE_FAMILIES = ("model", "engine", "device", "topology", "workload")

RUN_INTAKE_IDENTITY = "tilesim.bridge.agent_orchestration_run_intake.v2"
PROFILE_BINDING_IDENTITY = "tilesim.bridge.agent_orchestration_profile_binding.v1"
VALIDATION_REPORT_IDENTITY = "tilesim.bridge.agent_orchestration_validation_report.v1"
RETENTION_POLICY_IDENTITY = (
    "tilesim.bridge.agent_orchestration_idempotency_retention_policy.v1"
)
CREATE_RUN_IDENTITY = CREATE_RUN_SCHEMA_IDENTITY

# These registry/snapshot identities predate the compatibility-judgement API below.
# They remain read-only Phase 2D projections; neither identity is an executable
# profile or a Run Intake v2 route.
REGISTRY_IDENTITY = "tilesim.bridge.agent_orchestration_profile_registry.v1"
SNAPSHOT_IDENTITY = "tilesim.bridge.agent_orchestration_profile_snapshot.v1"
BINDING_IDENTITY = PROFILE_BINDING_IDENTITY

# Keep the historical registry-test/public helper name as a compatibility
# alias.  The canonical implementation name is PROFILE_FAMILIES; exposing the
# alias avoids an import-time failure without introducing another vocabulary
# or changing the Phase 2 contract.
FAMILIES = PROFILE_FAMILIES
SCHEMA_FILES = {
    family: SCHEMA_ROOT / f"{family}-profile.schema.json"
    for family in PROFILE_FAMILIES
}
_PUBLIC_NOW = "2026-09-12T00:00:00+00:00"
PROFILE_IDENTITY_V2 = {
    family: f"tilesim.bridge.agent_orchestration_{family}_profile.v2"
    for family in PROFILE_FAMILIES
}
# Legacy Profile identities, published by ``bridge/contracts/openapi.json`` as the
# ``agent_orchestration_capability.profile_schema_identities`` accept set; a nested
# reference that still names one of these is a mixed-version payload.
PROFILE_IDENTITIES_V1 = frozenset(
    f"tilesim.bridge.agent_orchestration_{family}_profile.v1"
    for family in PROFILE_FAMILIES
)

# --- dispatcher routes ---------------------------------------------------------------
# Registry-internal labels for the three dispatch generations the compatibility matrix
# talks about.  They are not contract identities.
ROUTE_NESTED_INTAKE_V2 = "nested_run_intake_v2"
ROUTE_LEGACY_NESTED_INTAKE = "legacy_nested_intake_server"
ROUTE_CREATE_RUN_V1 = "create_run_v1"
ROUTES = (ROUTE_NESTED_INTAKE_V2, ROUTE_LEGACY_NESTED_INTAKE, ROUTE_CREATE_RUN_V1)

# --- frozen compatibility vocabulary (source: compatibility-matrix.json) -------------
COMPATIBILITY_SCENARIOS = (
    "old_client_to_new_server",
    "new_client_to_old_server",
    "v1_to_successor",
    "successor_to_v1",
    "identity_missing",
    "unknown_identity",
    "unknown_revision",
    "mixed_version_payload",
    "exact_replay",
    "payload_mismatch",
    "retained_historical_run",
    "stale_profile_binding",
)
COMPATIBILITY_EXPECTATIONS = (
    "accept_v1_unchanged",
    "reject",
    "reject_no_implicit_upgrade",
    "reject_no_downgrade",
    "accept_exact_replay",
    "accept_exact_replay_original_identity",
)
COMPATIBILITY_ERROR_CODES = (
    "unknown_nested_identity",
    "explicit_migration_required",
    "unsupported_contract_identity",
    "missing_contract_identity",
    "unknown_contract_identity",
    "unknown_contract_revision",
    "mixed_contract_version",
    "idempotency_payload_mismatch",
    "validation_report_stale",
)

# --- frozen Profile fail-closed vocabulary (source: fixtures/semantic-cases.json) -----
PROFILE_FAIL_CLOSED_SCENARIOS = (
    "missing",
    "unknown",
    "unavailable",
    "ambiguous",
    "expired",
    "revision_mismatch",
    "digest_mismatch",
    "incompatible",
    "calibration_missing",
    "execution_evidence_missing",
)
PROFILE_FAIL_CLOSED_CODES = (
    "profile_missing",
    "unknown_profile",
    "profile_unavailable",
    "profile_ambiguous",
    "profile_expired",
    "profile_revision_mismatch",
    "profile_digest_mismatch",
    "profile_combination_incompatible",
    "calibration_missing",
    "execution_evidence_missing",
)

# --- stale-binding vocabulary (source: validation-report.schema.json + fixture) -------
# ``checked_bindings`` names are frozen from the published validation report fixture
# ``fixtures/valid/validation-report.json``; the reason codes are the schema enum.
STALE_CHECKED_BINDINGS = (
    "profile_revision_and_digest",
    "capability_snapshot",
    "backend_and_schema_revision",
    "validation_policy",
    "calculator_algorithm",
    "workload_template",
    "compiled_request",
    "approval",
)
STALE_REASON_BINDING = {
    "profile_revision_and_digest": "profile_revision_or_digest_changed",
    "capability_snapshot": "capability_snapshot_changed",
    "backend_and_schema_revision": "backend_or_schema_revision_changed",
    "validation_policy": "validation_policy_changed",
    "calculator_algorithm": "calculator_algorithm_changed",
    "workload_template": "workload_template_changed",
    "compiled_request": "compiled_request_changed",
    "approval": "approval_missing_or_expired",
}
STALE_REASONS = tuple(
    STALE_REASON_BINDING[binding] for binding in STALE_CHECKED_BINDINGS
)
STALE_REPORT_SELF_DECLARED = (
    "validation_report_stale",
    "stale_binding_unverified",
    "stale_binding_changed",
)

_UNVERIFIED = object()


@dataclass(frozen=True)
class Judgement:
    """One compatibility verdict.

    ``expected`` is the ``expected`` value of the matching compatibility matrix row (or
    ``None`` when no published row applies), and ``code`` the published ``error_code``.
    ``accepted`` is always the negation of "the matrix row demands a rejection".
    """

    accepted: bool
    code: str | None
    detail: str
    scenario: str | None = None
    expected: str | None = None
    field_path: str = "/"
    message: str = ""
    facts: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        matrix_accepts = self.expected is None or self.expected.startswith("accept")
        if self.accepted != matrix_accepts:
            raise ContractValidationError(
                f"judgement {self.detail!r} contradicts expectation {self.expected!r}",
                self.field_path,
            )
        if self.code is not None and self.code not in COMPATIBILITY_ERROR_CODES:
            raise ContractValidationError(
                f"unpublished compatibility code {self.code!r}", self.field_path
            )
        if self.expected is not None and self.expected not in COMPATIBILITY_EXPECTATIONS:
            raise ContractValidationError(
                f"unpublished compatibility expectation {self.expected!r}", self.field_path
            )
        if self.scenario is not None and self.scenario not in COMPATIBILITY_SCENARIOS:
            raise ContractValidationError(
                f"unpublished compatibility scenario {self.scenario!r}", self.field_path
            )
        if self.accepted and self.code is not None:
            raise ContractValidationError(
                "an accepted judgement cannot carry an error code", self.field_path
            )

    def as_dict(self) -> dict[str, Any]:
        return {
            "accepted": self.accepted,
            "code": self.code,
            "scenario": self.scenario,
            "expected": self.expected,
            "detail": self.detail,
            "field_path": self.field_path,
            "message": self.message,
            "facts": dict(self.facts),
        }


def _accept(
    detail: str,
    *,
    scenario: str | None = None,
    expected: str | None = None,
    message: str = "",
    facts: Mapping[str, Any] | None = None,
) -> Judgement:
    return Judgement(
        accepted=True,
        code=None,
        detail=detail,
        scenario=scenario,
        expected=expected,
        message=message,
        facts=dict(facts or {}),
    )


def _reject(
    code: str,
    detail: str,
    *,
    scenario: str | None = None,
    expected: str = "reject",
    message: str,
    field_path: str = "/",
    facts: Mapping[str, Any] | None = None,
) -> Judgement:
    return Judgement(
        accepted=False,
        code=code,
        detail=detail,
        scenario=scenario,
        expected=expected,
        field_path=field_path,
        message=message,
        facts=dict(facts or {}),
    )


@dataclass(frozen=True)
class ProfileBindingResolution:
    """Outcome of resolving the five Profile references against available records.

    ``resolved`` is ``False`` whenever any family produced an issue; an unresolved
    binding must never yield a candidate list or a ranking.
    """

    resolved: bool
    issues: tuple[dict[str, Any], ...]
    records_available: Mapping[str, int]

    def as_dict(self) -> dict[str, Any]:
        return {
            "resolved": self.resolved,
            "issues": [dict(issue) for issue in self.issues],
            "records_available": dict(self.records_available),
            "planning_status": "blocked" if not self.resolved else "unknown",
        }


def _profile_issue(
    code: str,
    message: str,
    field_path: str,
    *,
    safe_next_action: str,
) -> dict[str, Any]:
    if code not in PROFILE_FAIL_CLOSED_CODES:
        raise ContractValidationError(
            f"unpublished Profile fail-closed code {code!r}", field_path
        )
    return {
        "code": code,
        "message": message,
        "field_path": field_path,
        "blocking": True,
        "safe_next_action": safe_next_action,
    }


# --- published revision / policy tables ---------------------------------------------


def published_schema_revisions() -> dict[str, str]:
    """Derive the published revision of every registered identity.

    The published package records only a package revision in JSON, so per-identity
    revisions are derived from the checked-in schema documents with
    ``validator.canonical_digest`` - the same function the proposal fixtures used to
    build their ``schema_revision`` values.  Read-only; no file is written.
    """
    revisions: dict[str, str] = {}
    for path in sorted(SCHEMA_ROOT.glob("*.schema.json")):
        document = json.loads(path.read_text(encoding="utf-8"))
        identity = document.get("x-tilesim-schema-identity")
        if identity is None:
            continue
        revisions[identity] = canonical_digest(document)
    if set(revisions) != set(IDENTITIES):
        raise ContractValidationError(
            "published schema documents do not cover every registered Agent orchestration "
            "identity",
            "/schema_revision",
        )
    return revisions


def _normalize_revision_table(
    revisions: Mapping[str, Any] | None,
) -> dict[str, frozenset[str]]:
    source = published_schema_revisions() if revisions is None else revisions
    if not isinstance(source, Mapping):
        raise ContractValidationError("revision table must be a mapping", "/schema_revision")
    table: dict[str, frozenset[str]] = {}
    for identity, value in source.items():
        if not isinstance(identity, str) or not isinstance(value, (str, Iterable)):
            raise ContractValidationError("invalid revision table entry", "/schema_revision")
        if isinstance(value, str):
            table[identity] = frozenset((value,))
        else:
            entries = tuple(value)
            if not entries or any(not isinstance(item, str) for item in entries):
                raise ContractValidationError(
                    "invalid revision table entry", "/schema_revision"
                )
            table[identity] = frozenset(entries)
    return table


def registered_revision(
    identity: str, *, registered_revisions: Mapping[str, Any] | None = None
) -> str | None:
    """Return the single registered revision for an identity, or ``None`` when ambiguous."""
    table = _normalize_revision_table(registered_revisions)
    values = table.get(identity)
    if values is None or len(values) != 1:
        return None
    return next(iter(values))


def canonical_payload_digest(payload: Any) -> str:
    """Canonical digest of a submission, reusing ``validator.canonical_digest``."""
    return canonical_digest(payload)


def published_retention_policy_facts() -> dict[str, Any]:
    """Read the frozen idempotency/retention semantics out of the published schema."""
    document = json.loads(
        (SCHEMA_ROOT / "idempotency-retention-policy.schema.json").read_text(
            encoding="utf-8"
        )
    )
    properties = document["properties"]
    return {
        "identity": document["x-tilesim-schema-identity"],
        "canonicalization_identity": properties["canonicalization_identity"]["const"],
        "idempotency": {
            name: value["const"]
            for name, value in properties["idempotency"]["properties"].items()
        },
        "retention": {
            name: value["const"]
            for name, value in properties["retention"]["properties"].items()
        },
        "forbidden_persistence": tuple(
            properties["forbidden_persistence"]["items"]["enum"]
        ),
    }


def forbidden_persistence() -> tuple[str, ...]:
    """The forbidden-persistence set published by the retention policy schema."""
    return tuple(published_retention_policy_facts()["forbidden_persistence"])


def assert_no_forbidden_persistence(
    attempted_keys: Iterable[str], *, policy: Mapping[str, Any] | None = None
) -> tuple[str, ...]:
    """Fail closed when a record would persist a forbidden field.

    Returns the offending keys (empty when the record is allowed).  When ``policy`` is
    supplied it is validated with ``validate_contract`` first, so the forbidden set can
    only come from a published policy document.
    """
    if policy is not None:
        validate_contract(policy)
        allowed = tuple(policy["forbidden_persistence"])
    else:
        allowed = forbidden_persistence()
    offending = tuple(sorted(set(attempted_keys) & set(allowed)))
    if offending:
        raise ContractValidationError(
            "forbidden persistence: " + ", ".join(offending), "/forbidden_persistence"
        )
    return offending


# --- identity / revision / version resolution ---------------------------------------


def _mixed_contract_version_path(payload: Mapping[str, Any]) -> str | None:
    """Locate a v1/v2 splicing signal inside a successor intake payload.

    Only explicit signals are used: a legacy ``schema_version`` field next to
    ``schema_identity``, or a nested Profile reference that still names a legacy Profile
    identity.  Version is never inferred from field shape.
    """
    if "schema_version" in payload:
        return "/schema_version"
    profile_binding = payload.get("profile_binding")
    if isinstance(profile_binding, Mapping):
        for family in PROFILE_FAMILIES:
            reference = profile_binding.get(family)
            if isinstance(reference, Mapping) and (
                reference.get("identity") in PROFILE_IDENTITIES_V1
            ):
                return f"/profile_binding/{family}/identity"
    nested_references = (
        ("/workload/template_reference", payload.get("workload"), "template_reference"),
        (
            "/topology_network_binding/topology_reference",
            payload.get("topology_network_binding"),
            "topology_reference",
        ),
    )
    for pointer, container, key in nested_references:
        if not isinstance(container, Mapping):
            continue
        reference = container.get(key)
        if isinstance(reference, Mapping) and reference.get("identity") in PROFILE_IDENTITIES_V1:
            return pointer + "/identity"
    return None


def judge_route(
    payload: Mapping[str, Any] | None,
    *,
    route: str = ROUTE_NESTED_INTAKE_V2,
    registered_revisions: Mapping[str, Any] | None = None,
    expected_revision: str | None = None,
) -> Judgement:
    """Judge one dispatch decision, in matrix order.

    ``payload`` is the nested Agent orchestration payload (``None`` means the v1 request
    carried no nested payload at all, which stays on the untouched v1 path).

    Raises ``ContractValidationError`` when an accepted identity fails schema
    validation - that is a request-validation failure owned by
    ``contracts.validation.RequestValidationError`` at the service layer, not a
    compatibility code.
    """
    if route not in ROUTES:
        raise ContractValidationError(f"unknown dispatcher route {route!r}", "/route")
    if payload is not None and not isinstance(payload, Mapping):
        return _reject(
            "missing_contract_identity",
            "nested_intake_identity_missing",
            scenario="identity_missing",
            message="The nested Agent orchestration payload is not a JSON object, so it "
            "carries no identity.",
            field_path="/",
        )

    identity = payload.get("schema_identity") if payload is not None else None

    if identity is None:
        if payload is None or route == ROUTE_CREATE_RUN_V1:
            return _accept(
                "v1_request_without_nested_intake",
                scenario="old_client_to_new_server",
                expected="accept_v1_unchanged",
                message="No nested Agent orchestration identity is present; the published "
                "create-run v1 accept set is unchanged.",
            )
        return _reject(
            "missing_contract_identity",
            "nested_intake_identity_missing",
            scenario="identity_missing",
            message="A nested Agent orchestration payload must carry schema_identity; the "
            "successor intake provides no omission default.",
            field_path="/schema_identity",
        )

    if route == ROUTE_LEGACY_NESTED_INTAKE:
        return _reject(
            "unknown_nested_identity",
            "pre_phase2_server_generation",
            scenario="new_client_to_old_server",
            message=f"A server generation without the published Phase 2 package cannot "
            f"resolve the nested identity {identity!r}.",
            field_path="/schema_identity",
        )

    if route == ROUTE_CREATE_RUN_V1:
        if identity in IDENTITIES:
            return _reject(
                "unsupported_contract_identity",
                "successor_identity_on_v1_route",
                scenario="successor_to_v1",
                expected="reject_no_downgrade",
                message="The create-run v1 route does not accept a successor Agent "
                "orchestration payload; there is no downgrade path.",
                field_path="/schema_identity",
            )
        return _reject(
            "unknown_contract_identity",
            "identity_not_registered",
            scenario="unknown_identity",
            message=f"Unknown schema identity {identity!r}.",
            field_path="/schema_identity",
        )

    if identity == CREATE_RUN_IDENTITY:
        return _reject(
            "explicit_migration_required",
            "explicit_v1_identity",
            scenario="v1_to_successor",
            expected="reject_no_implicit_upgrade",
            message="The create-run v1 identity is not upgraded implicitly; an explicit "
            "migration is required.",
            field_path="/schema_identity",
        )
    if identity != RUN_INTAKE_IDENTITY:
        if identity in IDENTITIES:
            return _reject(
                "unsupported_contract_identity",
                "identity_not_served_by_route",
                scenario="successor_to_v1",
                expected="reject_no_downgrade",
                message=f"The nested Run Intake v2 route does not serve {identity!r}.",
                field_path="/schema_identity",
            )
        return _reject(
            "unknown_contract_identity",
            "identity_not_registered",
            scenario="unknown_identity",
            message=f"Unknown schema identity {identity!r}.",
            field_path="/schema_identity",
        )

    table = _normalize_revision_table(registered_revisions)
    registered = table.get(identity)
    revision = payload.get("schema_revision")
    if revision is None:
        return _reject(
            "unknown_contract_revision",
            "revision_missing",
            scenario="unknown_revision",
            message="The published Run Intake v2 contract requires schema_revision.",
            field_path="/schema_revision",
        )
    if registered is None:
        return _reject(
            "unknown_contract_revision",
            "revision_registry_missing",
            scenario="unknown_revision",
            message=f"No published revision is registered for {identity!r}; refusing to "
            f"interpret the payload.",
            field_path="/schema_revision",
        )
    if not isinstance(revision, str) or revision not in registered:
        return _reject(
            "unknown_contract_revision",
            "revision_not_registered",
            scenario="unknown_revision",
            message=f"schema_revision {revision!r} is not a registered revision of "
            f"{identity!r}.",
            field_path="/schema_revision",
            facts={"registered_revisions": sorted(registered)},
        )
    if expected_revision is not None and revision != expected_revision:
        return _reject(
            "unknown_contract_revision",
            "expected_revision_mismatch",
            scenario="unknown_revision",
            message="schema_revision does not match the revision pinned by the caller.",
            field_path="/schema_revision",
            facts={
                "expected_revision": expected_revision,
                "received_revision": revision,
            },
        )

    mixed_path = _mixed_contract_version_path(payload)
    if mixed_path is not None:
        return _reject(
            "mixed_contract_version",
            "legacy_field_present"
            if mixed_path == "/schema_version"
            else "legacy_nested_profile_identity",
            scenario="mixed_version_payload",
            message="The payload splices legacy and successor contract versions; only a "
            "self-consistent Run Intake v2 combination is allowed.",
            field_path=mixed_path,
        )

    validate_contract(payload)
    return _accept(
        "registered_run_intake_v2",
        message="Run Intake v2 identity, revision and schema are consistent.",
        facts={"identity": identity, "revision": revision},
    )


# --- idempotency and retention -------------------------------------------------------


def _idempotency_facts(
    record: Mapping[str, Any] | None, *, label: str
) -> dict[str, Any]:
    if not isinstance(record, Mapping):
        raise ContractValidationError(
            f"{label} idempotency facts must be a mapping", "/headers/Idempotency-Key"
        )
    digest = record.get("canonical_payload_digest")
    if digest is not None and not isinstance(digest, str):
        raise ContractValidationError(
            f"{label} canonical_payload_digest must be a string", "/headers/Idempotency-Key"
        )
    return {
        "canonical_payload_digest": digest,
        "identity": record.get("identity"),
        "revision": record.get("revision"),
    }


def evaluate_idempotency(
    stored: Mapping[str, Any] | None,
    payload: Mapping[str, Any],
    *,
    current_revision: str | None = None,
) -> Judgement:
    """Judge a replayed Idempotency-Key against the published retention policy.

    ``stored`` is the retained record (``None`` when the key is free), ``payload`` the
    incoming idempotency facts.  Same key and same canonical payload is an exact replay;
    same key with any change is a 409 payload mismatch and the original key stays locked.
    No record is written and no state is mutated.
    """
    policy = published_retention_policy_facts()
    incoming = _idempotency_facts(payload, label="incoming")
    if incoming["canonical_payload_digest"] is None:
        raise ContractValidationError(
            "incoming idempotency facts require canonical_payload_digest",
            "/headers/Idempotency-Key",
        )
    if stored is None:
        return _accept(
            "new_idempotency_key",
            message="No retained record exists for this Idempotency-Key.",
            facts={"retention": policy["idempotency"]["same_key_same_payload"]},
        )

    retained = _idempotency_facts(stored, label="retained")
    if retained["canonical_payload_digest"] is None:
        return _reject(
            "idempotency_payload_mismatch",
            "retained_record_digest_missing",
            scenario="payload_mismatch",
            message="The retained record has no canonical payload digest; the key stays "
            "locked.",
            field_path="/headers/Idempotency-Key",
        )
    if retained["canonical_payload_digest"] != incoming["canonical_payload_digest"]:
        if retained["identity"] != incoming["identity"]:
            detail = "version_changed"
        elif retained["revision"] != incoming["revision"]:
            detail = "profile_revision_changed"
        else:
            detail = "payload_changed"
        return _reject(
            "idempotency_payload_mismatch",
            detail,
            scenario="payload_mismatch",
            message="Idempotency-Key was already used with a different canonical payload.",
            field_path="/headers/Idempotency-Key",
            facts={"expected_behaviour": policy["idempotency"]["same_key_different_payload"]},
        )
    if (
        retained["identity"] != incoming["identity"]
        or retained["revision"] != incoming["revision"]
    ):
        return _reject(
            "idempotency_payload_mismatch",
            "version_changed"
            if retained["identity"] != incoming["identity"]
            else "profile_revision_changed",
            scenario="payload_mismatch",
            message="The retained record binds a different nested identity or revision "
            "than the replay request.",
            field_path="/headers/Idempotency-Key",
            facts={"expected_behaviour": policy["idempotency"]["version_change"]},
        )

    resolved_current = current_revision
    if resolved_current is None and isinstance(incoming["identity"], str):
        resolved_current = registered_revision(incoming["identity"])
    if resolved_current is not None and incoming["revision"] != resolved_current:
        return _accept(
            "exact_replay_original_identity",
            scenario="retained_historical_run",
            expected="accept_exact_replay_original_identity",
            message="The retained run replays under its original contract identity and "
            "revision; the server does not reinterpret the payload.",
            facts={
                "retained_revision": incoming["revision"],
                "current_revision": resolved_current,
            },
        )
    return _accept(
        "exact_replay",
        scenario="exact_replay",
        expected="accept_exact_replay",
        message="Same key with the same canonical payload is an exact replay.",
        facts={"retention": policy["idempotency"]["same_key_same_payload"]},
    )


# --- Profile binding fail-closed resolution ------------------------------------------


def evaluate_profile_binding(
    binding: Mapping[str, Any],
    *,
    profile_records: Mapping[str, Any],
    claim_requires_calibration: bool = False,
) -> ProfileBindingResolution:
    """Resolve the five Profile references against the records that actually exist.

    Empty record sets fail closed as ``profile_missing``.  No candidate, ranking or
    fallback value is produced.  ``profile_combination_incompatible`` and
    ``execution_evidence_missing`` are not decided here: they need the WP-2C-03 domain
    and lowering context and must not be guessed.
    """
    if not isinstance(binding, Mapping):
        raise ContractValidationError("profile binding must be an object", "/profile_binding")
    if not isinstance(profile_records, Mapping):
        raise ContractValidationError(
            "profile records must be a mapping", "/profile_binding"
        )

    issues: list[dict[str, Any]] = []
    missing_families = [family for family in PROFILE_FAMILIES if family not in binding]
    for family in missing_families:
        issues.append(
            _profile_issue(
                "profile_missing",
                f"The profile binding carries no {family} reference.",
                f"/profile_binding/{family}",
                safe_next_action=(
                    "Provide a reviewed Profile Binding that names all five published "
                    "Profile families."
                ),
            )
        )
    if issues:
        return ProfileBindingResolution(
            resolved=False,
            issues=tuple(issues),
            records_available={
                family: len(profile_records.get(family) or ())
                for family in PROFILE_FAMILIES
            },
        )

    validate_contract(binding)

    for family in PROFILE_FAMILIES:
        reference = binding[family]
        field_path = f"/profile_binding/{family}"
        records = profile_records.get(family) or ()
        if not records:
            issues.append(
                _profile_issue(
                    "profile_missing",
                    f"No published {family} Profile v2 record exists, so the "
                    f"{family} reference cannot be resolved.",
                    field_path,
                    safe_next_action=(
                        "Import an authorized, license-reviewed profile record through "
                        "the reviewed Phase 2C data path; do not substitute product "
                        "marketing values or LLM knowledge."
                    ),
                )
            )
            continue
        for record in records:
            if not isinstance(record, Mapping):
                raise ContractValidationError(
                    f"{family} profile records must be objects", field_path
                )
            validate_contract(record)
        profile_id = reference.get("profile_id")
        matches = [
            record for record in records if record.get("profile_id") == profile_id
        ]
        if len(matches) > 1:
            issues.append(
                _profile_issue(
                    "profile_ambiguous",
                    f"More than one {family} record resolves {profile_id!r}.",
                    field_path,
                    safe_next_action="Retire the duplicate record so exactly one "
                    "revision is resolvable.",
                )
            )
            continue
        if not matches:
            issues.append(
                _profile_issue(
                    "unknown_profile",
                    f"No {family} record resolves {profile_id!r}.",
                    field_path,
                    safe_next_action="Publish the referenced profile record or correct "
                    "the reference.",
                )
            )
            continue
        record = matches[0]
        status = (record.get("lifecycle") or {}).get("status")
        if status in {"unavailable", "revoked"}:
            issues.append(
                _profile_issue(
                    "profile_unavailable",
                    f"The {family} record {profile_id!r} is {status}.",
                    field_path,
                    safe_next_action="Select an available profile record.",
                )
            )
            continue
        if status == "expired":
            issues.append(
                _profile_issue(
                    "profile_expired",
                    f"The {family} record {profile_id!r} is expired.",
                    field_path,
                    safe_next_action="Re-publish the profile record after review.",
                )
            )
            continue
        if record.get("profile_revision") != reference.get("revision"):
            issues.append(
                _profile_issue(
                    "profile_revision_mismatch",
                    f"The {family} record revision differs from the bound revision.",
                    field_path,
                    safe_next_action="Rebind the reference to the current profile "
                    "revision.",
                )
            )
            continue
        if record.get("canonical_digest") != reference.get("digest"):
            issues.append(
                _profile_issue(
                    "profile_digest_mismatch",
                    f"The {family} record digest differs from the bound digest.",
                    field_path,
                    safe_next_action="Rebind the reference to the verified profile "
                    "digest.",
                )
            )
            continue
        if claim_requires_calibration and record.get("calibration_status") != "calibrated":
            issues.append(
                _profile_issue(
                    "calibration_missing",
                    f"The {family} record is not calibrated for the requested claim.",
                    field_path,
                    safe_next_action="Lower the claim scope to the available evidence.",
                )
            )

    return ProfileBindingResolution(
        resolved=not issues,
        issues=tuple(issues),
        records_available={
            family: len(profile_records.get(family) or ())
            for family in PROFILE_FAMILIES
        },
    )


# --- Validation Report staleness -----------------------------------------------------


def derive_recorded_bindings(report: Mapping[str, Any]) -> dict[str, Any]:
    """Extract the binding facts a Validation Report records about itself.

    ``workload_template`` and ``approval`` are not recorded by the published report
    schema, so they stay ``None`` and the caller must supply the report-time value when it
    asks for full verification.
    """
    if not isinstance(report, Mapping):
        raise ContractValidationError("validation report must be an object", "/")
    receipts = report.get("calculator_receipts") or ()
    return {
        "profile_revision_and_digest": _reference_tuple(
            report.get("profile_snapshot_binding")
        ),
        "capability_snapshot": _reference_tuple(report.get("capability_snapshot_binding")),
        "backend_and_schema_revision": (
            (report.get("backend_binding") or {}).get("backend_revision"),
            (report.get("backend_binding") or {}).get("schema_set_revision"),
        ),
        "validation_policy": report.get("validation_policy_revision"),
        "calculator_algorithm": tuple(
            receipt.get("algorithm_revision")
            for receipt in receipts
            if isinstance(receipt, Mapping)
        ),
        "workload_template": None,
        "compiled_request": (
            (report.get("compiled_request_preview") or {}).get("target_identity"),
            (report.get("compiled_request_preview") or {}).get("target_revision"),
            (report.get("compiled_request_preview") or {}).get(
                "canonical_payload_digest"
            ),
        ),
        "approval": None,
    }


def _reference_tuple(reference: Any) -> tuple[Any, Any, Any] | None:
    if not isinstance(reference, Mapping):
        return None
    return (
        reference.get("identity"),
        reference.get("revision"),
        reference.get("digest"),
    )


def evaluate_validation_report_staleness(
    report: Mapping[str, Any],
    *,
    current_bindings: Mapping[str, Any],
    recorded_bindings: Mapping[str, Any] | None = None,
) -> Judgement:
    """Judge whether a Validation Report may still be used.

    Fail closed: a self-declared stale report, a binding that changed, a binding the
    report never checked, or a binding the caller cannot verify all reject with
    ``validation_report_stale``.  Nothing is refreshed and nothing is written.
    """
    validate_contract(report)
    declared = (report.get("stale_binding") or {}).get("checked_bindings") or ()
    unchecked = [
        binding for binding in STALE_CHECKED_BINDINGS if binding not in set(declared)
    ]
    if unchecked:
        raise ContractValidationError(
            "validation report does not declare every stale-binding check: "
            + ", ".join(unchecked),
            "/stale_binding/checked_bindings",
        )

    stale_binding = report["stale_binding"]
    if stale_binding["is_stale"] or stale_binding["reasons"]:
        return _reject(
            "validation_report_stale",
            "self_declared_stale",
            scenario="stale_profile_binding",
            message="The Validation Report declares itself stale.",
            field_path="/stale_binding",
            facts={"reasons": list(stale_binding["reasons"])},
        )

    recorded = derive_recorded_bindings(report)
    if recorded_bindings is not None:
        if not isinstance(recorded_bindings, Mapping):
            raise ContractValidationError(
                "recorded bindings must be a mapping", "/stale_binding"
            )
        recorded.update(
            {
                binding: value
                for binding, value in recorded_bindings.items()
                if value is not None
            }
        )

    unverified: list[str] = []
    reasons: list[str] = []
    for binding in STALE_CHECKED_BINDINGS:
        current = current_bindings.get(binding, _UNVERIFIED)
        if current is _UNVERIFIED or current is None:
            unverified.append(binding)
            continue
        if recorded.get(binding) is None:
            unverified.append(binding)
            continue
        if current != recorded[binding]:
            reasons.append(STALE_REASON_BINDING[binding])
    if unverified:
        return _reject(
            "validation_report_stale",
            "stale_binding_unverified",
            scenario="stale_profile_binding",
            message="The Validation Report cannot be confirmed fresh because some bound "
            "facts were not verified.",
            field_path="/stale_binding",
            facts={"unverified_bindings": unverified},
        )
    if reasons:
        return _reject(
            "validation_report_stale",
            "stale_binding_changed",
            scenario="stale_profile_binding",
            message="A bound fact changed after the Validation Report was produced.",
            field_path="/stale_binding",
            facts={"reasons": reasons},
        )
    return _accept(
        "stale_binding_verified",
        message="Every declared binding still matches the current release facts.",
    )


def staleness_reason(binding: str) -> str:
    """Published stale reason for a checked binding name."""
    if binding not in STALE_REASON_BINDING:
        raise ContractValidationError(
            f"unknown stale-binding check {binding!r}", "/stale_binding/checked_bindings"
        )
    return STALE_REASON_BINDING[binding]


# --- Phase 2D read-only registry compatibility surface -----------------------------
#
# The registry was later extended with route/revision judgements, but the published
# Phase 2D read-only endpoints and their tests still use this small materialization
# API.  Keep it as a projection over the same checked-in schemas.  It deliberately
# exposes conditional, non-executable records only; no function below enables
# calculator, ranking, agent_exposed or create-run behaviour.


def _fact(
    value: Any,
    unit: str | None,
    source: str,
    field: str,
    scope: str,
) -> dict[str, Any]:
    return {
        "value": value,
        "unit": unit,
        "provenance": {
            # A reviewed registry/configuration source is not a measurement
            # observation.  Keep provenance conservative so a structural fact
            # cannot be promoted into calibration evidence by its label.
            "kind": "externally_specified",
            "source_reference": source,
            "source_field": field,
            "evidence_scope": scope,
        },
    }


def _profile_base(
    family: str,
    profile_id: str,
    name: str,
    description: str,
    source: str,
    source_kind: str,
    license_id: str,
    regime: str,
    scope: str,
    facts: dict[str, Any],
) -> dict[str, Any]:
    return {
        "schema_identity": PROFILE_IDENTITY_V2[family],
        "schema_revision": "",
        "profile_family": family,
        "profile_id": profile_id,
        "profile_revision": "",
        "canonical_digest": "",
        "display": {
            "name": name,
            "description": description,
            "labels": ["phase2d", family, "source-backed"],
        },
        "source_reference": source,
        "source_kind": source_kind,
        "license": {"spdx_id": license_id, "redistribution_allowed": license_id != "NOASSERTION"},
        "valid_regime": {"description": regime, "constraints": [regime]},
        "lifecycle": {
            "introduced_at": _PUBLIC_NOW,
            "updated_at": _PUBLIC_NOW,
            "expires_at": None,
            "status": "available",
        },
        "calibration_status": "missing",
        "calibration_binding": None,
        "held_out_validation_status": "missing",
        "held_out_validation_binding": None,
        "allowed_claim_scope": scope,
        "sensitivity": "public",
        "visibility": "catalog",
        "facts": facts,
    }


def _raw_profiles() -> dict[str, dict[str, Any]]:
    return {
        "model": _profile_base(
            "model",
            "mistralai.mistral-7b-v0.1",
            "Mistral 7B v0.1",
            "Public model configuration facts used for structural simulation inputs.",
            "hf_mistral_7b_v01_config",
            "reviewed_registry",
            "Apache-2.0",
            "Mistral-7B-v0.1 configuration and model-card facts; no timing claim.",
            # Public structural configuration facts do not establish timing,
            # calibration, or held-out validation.  Keep this record at the
            # exploratory claim ceiling even though its source is reviewed.
            "exploration",
            {
                "architecture": _fact("MistralForCausalLM", None, "hf_mistral_7b_v01_config", "architecture", "exploration"),
                "parameter_count": _fact("7241732096", "parameters", "hf_mistral_7b_v01_model_card", "parameter_count", "exploration"),
                "layer_count": _fact("32", "layers", "hf_mistral_7b_v01_config", "num_hidden_layers", "exploration"),
                "hidden_size": _fact("4096", "elements", "hf_mistral_7b_v01_config", "hidden_size", "exploration"),
                "expert_structure": _fact("dense", None, "hf_mistral_7b_v01_config", "architectures", "exploration"),
                "tensor_layout": _fact("bfloat16; grouped-query attention", None, "hf_mistral_7b_v01_config", "torch_dtype,num_key_value_heads", "exploration"),
            },
        ),
        "engine": _profile_base(
            "engine",
            "vllm.0.6.semantic.v1",
            "TileSim vLLM semantic profile",
            "Backend-local semantic subset; not a complete commercial engine capability declaration.",
            "tilesim_backend_engine_semantic_profile",
            "reviewed_registry",
            "NOASSERTION",
            "vLLM 0.6 semantic subset; execution evidence is absent.",
            "exploration",
            {
                "engine_name": _fact("vllm", None, "tilesim_backend_engine_semantic_profile", "engine_type", "exploration"),
                "engine_version": _fact("0.6", None, "tilesim_backend_engine_semantic_profile", "semantic_version", "exploration"),
                "semantic_profile": _fact("vllm.0.6.semantic.v1", None, "tilesim_backend_engine_semantic_profile", "semantic_version", "exploration"),
                "batching_policy": _fact("decode_first_continuous_batch", None, "tilesim_backend_engine_semantic_profile", "scheduler_kind,ordered_decisions", "exploration"),
                "supported_features": _fact(["continuous_batching", "chunked_prefill", "prefix_cache", "preemption_recompute"], None, "tilesim_backend_engine_semantic_profile", "supported_features", "exploration"),
            },
        ),
        "device": _profile_base(
            "device",
            "nvidia.a100-80gb-sxm",
            "NVIDIA A100 80GB SXM structural profile",
            "Vendor structural specification only; no measured timing or compute claim.",
            "nvidia_a100_80gb_sxm_spec",
            "vendor_specification",
            "NOASSERTION",
            "A100 80GB SXM structural specification; calibration and held-out validation absent.",
            "exploration",
            {
                "device_model": _fact("NVIDIA A100 80GB SXM", None, "nvidia_a100_80gb_sxm_spec", "product_name", "exploration"),
                "memory_capacity_bytes": _fact("85899345920", "bytes", "nvidia_a100_80gb_sxm_spec", "memory_capacity", "exploration"),
                "compute_profile_reference": _fact("vendor_structural_only", None, "nvidia_a100_80gb_sxm_spec", "compute_profile", "exploration"),
                "interconnect_endpoints": _fact("12", "links", "nvidia_a100_80gb_sxm_spec", "nvlink_links", "exploration"),
            },
        ),
        "topology": _profile_base(
            "topology",
            "generic-hierarchical-fabric.4gpu",
            "Generic four-device hierarchical fabric",
            "Compatibility-harness topology fixture; not a physical-system calibration.",
            "tilesim_modular_fabric_fixture",
            "compatibility_harness_trace",
            "NOASSERTION",
            "TileSim modular fabric compatibility fixture; synthetic consistency only.",
            "synthetic_consistency",
            {
                "topology_kind": _fact("generic_hierarchical_fabric", None, "tilesim_modular_fabric_fixture", "topology.topology_name", "synthetic_consistency"),
                "endpoint_count": _fact("4", "devices", "tilesim_modular_fabric_fixture", "topology.devices", "synthetic_consistency"),
                "link_bandwidth_gbps": _fact("450", "Gbps", "tilesim_modular_fabric_fixture", "scale_up.bandwidth_gbps", "synthetic_consistency"),
                "link_latency_ps": _fact("800000", "ps", "tilesim_modular_fabric_fixture", "scale_up.latency_us", "synthetic_consistency"),
                "routing_policy": _fact("module_binding_with_fallback", None, "tilesim_modular_fabric_fixture", "topology.domains.failure_policy", "synthetic_consistency"),
            },
        ),
        "workload": _profile_base(
            "workload",
            "s0-synthetic-example.seed7",
            "TileSim synthetic workload example",
            "No-GPU-dependency workload fixture for semantic and consistency tests.",
            "tilesim_s0_synthetic_workload_example",
            "synthetic_trace",
            "NOASSERTION",
            "Synthetic workload example; not real-trace ground truth.",
            "synthetic_consistency",
            {
                "template_kind": _fact("s0_synthetic_profile", None, "tilesim_s0_synthetic_workload_example", "synthetic_profile.request_id_prefix", "synthetic_consistency"),
                "request_count": _fact("4", "requests", "tilesim_s0_synthetic_workload_example", "synthetic_profile.request_count", "synthetic_consistency"),
                "input_tokens": _fact("128-256", "tokens/request", "tilesim_s0_synthetic_workload_example", "synthetic_profile.prompt_tokens_min,max", "synthetic_consistency"),
                "output_tokens": _fact("1-4", "tokens/request", "tilesim_s0_synthetic_workload_example", "synthetic_profile.decode_tokens_min,max", "synthetic_consistency"),
                "arrival_process": _fact("deterministic_burst_seed7", None, "tilesim_s0_synthetic_workload_example", "synthetic_profile.seed,base_interarrival_ps,burst_size", "synthetic_consistency"),
            },
        ),
    }


def _schema_revision(family: str) -> str:
    return canonical_digest(json.loads(SCHEMA_FILES[family].read_text(encoding="utf-8")))


def seal_profile(profile: Mapping[str, Any]) -> dict[str, Any]:
    value = copy.deepcopy(dict(profile))
    family = value["profile_family"]
    value["schema_revision"] = _schema_revision(family)
    value["profile_revision"] = ""
    value["canonical_digest"] = ""
    value["canonical_digest"] = canonical_digest(value)
    value["profile_revision"] = canonical_digest(value)
    return value


def _validate_typed_facts(profile: Mapping[str, Any]) -> None:
    required = {
        "model": {"architecture", "parameter_count", "layer_count", "hidden_size", "expert_structure", "tensor_layout"},
        "engine": {"engine_name", "engine_version", "semantic_profile", "batching_policy", "supported_features"},
        "device": {"device_model", "memory_capacity_bytes", "compute_profile_reference", "interconnect_endpoints"},
        "topology": {"topology_kind", "endpoint_count", "link_bandwidth_gbps", "link_latency_ps", "routing_policy"},
        "workload": {"template_kind", "request_count", "input_tokens", "output_tokens", "arrival_process"},
    }[profile["profile_family"]]
    facts = profile["facts"]
    if set(facts) != required:
        raise ContractValidationError("profile required facts mismatch", "/facts")
    for name in ("parameter_count", "layer_count", "hidden_size", "memory_capacity_bytes", "interconnect_endpoints", "endpoint_count", "link_latency_ps", "request_count"):
        if name in facts and (not isinstance(facts[name]["value"], str) or not facts[name]["value"].isdigit()):
            raise ContractValidationError("typed uint64 fact must be decimal string", f"/facts/{name}/value")


def _source_catalog() -> dict[str, dict[str, Any]]:
    return {
        "hf_mistral_7b_v01_config": {"kind": "reviewed_registry", "uri": "https://huggingface.co/mistralai/Mistral-7B-v0.1/resolve/27d67f1b5f57dc0953326b2601d68371d40ea8da/config.json", "revision": "27d67f1b5f57dc0953326b2601d68371d40ea8da", "license": "Apache-2.0", "claim_scope": "exploration"},
        "hf_mistral_7b_v01_model_card": {"kind": "reviewed_registry", "uri": "https://huggingface.co/mistralai/Mistral-7B-v0.1", "revision": "27d67f1b5f57dc0953326b2601d68371d40ea8da", "license": "Apache-2.0", "claim_scope": "exploration"},
        "tilesim_backend_engine_semantic_profile": {"kind": "reviewed_registry", "uri": "D:/tileSim/src/S1_Runtime/EngineSemanticProfile.cpp", "revision": "working-tree", "license": "NOASSERTION", "claim_scope": "exploration"},
        "nvidia_a100_80gb_sxm_spec": {"kind": "vendor_specification", "uri": "https://www.nvidia.com/en-us/data-center/a100/", "revision": "public-specification", "license": "NOASSERTION", "claim_scope": "exploration"},
        "tilesim_modular_fabric_fixture": {"kind": "compatibility_harness_trace", "uri": "D:/tileSim/docs/examples/modular_fabric_scenario.json", "revision": "working-tree", "license": "NOASSERTION", "claim_scope": "synthetic_consistency"},
        "tilesim_s0_synthetic_workload_example": {"kind": "synthetic_trace", "uri": "D:/tileSim/docs/examples/s0_synthetic_workload.json", "revision": "working-tree", "license": "NOASSERTION", "claim_scope": "synthetic_consistency"},
    }


def build_registry() -> dict[str, Any]:
    records: dict[str, list[dict[str, Any]]] = {family: [] for family in FAMILIES}
    for family, raw in _raw_profiles().items():
        profile = seal_profile(raw)
        records[family].append({
            "profile": profile,
            "record_status": "conditional",
            "runtime_status": "unavailable",
            "execution_status": "missing",
            "agent_exposed": False,
            "calculator_eligible": False,
            "ranking_eligible": False,
        })
    material = {
        "schema_identity": REGISTRY_IDENTITY,
        "publication_status": "published",
        "profile_families": list(FAMILIES),
        "records": records,
        "sources": _source_catalog(),
        "fail_closed": ["unknown_identity", "revision_drift", "digest_mismatch", "expired", "revoked", "visibility_mismatch", "sensitivity_mismatch", "missing_calibration", "missing_held_out_validation"],
    }
    digest = canonical_digest(material)
    material["registry_revision"] = digest
    material["registry_digest"] = digest
    validate_registry(material)
    return material


def validate_registry(registry: Mapping[str, Any]) -> None:
    if registry.get("schema_identity") != REGISTRY_IDENTITY or registry.get("publication_status") != "published":
        raise ContractValidationError("unknown or unpublished registry", "/schema_identity")
    if tuple(registry.get("profile_families", ())) != FAMILIES:
        raise ContractValidationError("profile family order mismatch", "/profile_families")
    records = registry.get("records")
    sources = registry.get("sources")
    if not isinstance(records, dict) or not isinstance(sources, dict):
        raise ContractValidationError("registry records and sources are required", "/records")
    for family in FAMILIES:
        if not isinstance(records.get(family), list) or len(records[family]) != 1:
            raise ContractValidationError("registry must contain one published record per family", f"/records/{family}")
        entry = records[family][0]
        profile = entry.get("profile")
        validate_contract(profile, expected_revision=_schema_revision(family))
        _validate_typed_facts(profile)
        if profile["source_reference"] not in sources:
            raise ContractValidationError("profile source is not catalogued", f"/records/{family}/profile/source_reference")
        source = sources[profile["source_reference"]]
        if source["kind"] != profile["source_kind"] or source["license"] != profile["license"]["spdx_id"]:
            raise ContractValidationError("profile/source metadata mismatch", f"/records/{family}/profile/source_kind")
        if entry.get("agent_exposed") is not False or entry.get("calculator_eligible") is not False or entry.get("ranking_eligible") is not False:
            raise ContractValidationError("unvalidated profile cannot be exposed or ranked", f"/records/{family}")
        for fact_name, fact in profile["facts"].items():
            if fact["provenance"]["source_reference"] not in sources:
                raise ContractValidationError("fact provenance source is not catalogued", f"/records/{family}/profile/facts/{fact_name}")
        resealed = seal_profile(profile)
        if resealed["canonical_digest"] != profile["canonical_digest"] or resealed["profile_revision"] != profile["profile_revision"]:
            raise ContractValidationError("profile digest mismatch", f"/records/{family}/profile")
    material = copy.deepcopy(dict(registry))
    material.pop("registry_revision", None)
    material.pop("registry_digest", None)
    expected = canonical_digest(material)
    if registry.get("registry_revision") != expected or registry.get("registry_digest") != expected:
        raise ContractValidationError("registry digest mismatch", "/registry_digest")


def load_registry() -> dict[str, Any]:
    return copy.deepcopy(build_registry())


def query_profiles(
    *,
    family: str | None = None,
    visibility: str = "catalog",
    sensitivity: str = "public",
    include_unavailable: bool = False,
) -> list[dict[str, Any]]:
    registry = load_registry()
    families = (family,) if family else FAMILIES
    if any(item not in FAMILIES for item in families):
        return []
    result: list[dict[str, Any]] = []
    for item in families:
        for entry in registry["records"][item]:
            profile = entry["profile"]
            if profile["visibility"] != visibility or profile["sensitivity"] != sensitivity:
                continue
            if profile["lifecycle"]["status"] in {"expired", "revoked", "unavailable"}:
                continue
            if not include_unavailable and entry["runtime_status"] != "available":
                continue
            result.append(copy.deepcopy(entry))
    return result


def build_snapshot() -> dict[str, Any]:
    registry = load_registry()
    material = {
        "schema_identity": SNAPSHOT_IDENTITY,
        "publication_status": "published",
        "registry_identity": REGISTRY_IDENTITY,
        "registry_revision": registry["registry_revision"],
        "profile_references": [
            {
                "family": family,
                "profile_id": registry["records"][family][0]["profile"]["profile_id"],
                "revision": registry["records"][family][0]["profile"]["profile_revision"],
                "digest": registry["records"][family][0]["profile"]["canonical_digest"],
            }
            for family in FAMILIES
        ],
        "stale_policy": "fail_closed",
    }
    digest = canonical_digest(material)
    material["snapshot_revision"] = digest
    material["snapshot_digest"] = digest
    return material


def validate_snapshot(
    snapshot: Mapping[str, Any], *, registry: Mapping[str, Any] | None = None
) -> None:
    current = registry or load_registry()
    validate_registry(current)
    if snapshot.get("schema_identity") != SNAPSHOT_IDENTITY or snapshot.get("registry_revision") != current["registry_revision"]:
        raise ContractValidationError("stale profile snapshot", "/registry_revision")
    material = copy.deepcopy(dict(snapshot))
    material.pop("snapshot_revision", None)
    material.pop("snapshot_digest", None)
    expected = canonical_digest(material)
    if snapshot.get("snapshot_revision") != expected or snapshot.get("snapshot_digest") != expected:
        raise ContractValidationError("snapshot digest mismatch", "/snapshot_digest")
    refs = {
        (
            family,
            current["records"][family][0]["profile"]["profile_id"],
            current["records"][family][0]["profile"]["profile_revision"],
            current["records"][family][0]["profile"]["canonical_digest"],
        )
        for family in FAMILIES
    }
    actual = {
        (item.get("family"), item.get("profile_id"), item.get("revision"), item.get("digest"))
        for item in snapshot.get("profile_references", [])
    }
    if actual != refs:
        raise ContractValidationError("snapshot profile reference mismatch", "/profile_references")


def build_profile_binding(
    profile_ids: Mapping[str, str], *, fidelity: str = "DES", gpu_participation_mode: str = "gpu_free"
) -> dict[str, Any]:
    registry = load_registry()
    refs: dict[str, Any] = {}
    for family in FAMILIES:
        entry = next(
            (item for item in registry["records"][family] if item["profile"]["profile_id"] == profile_ids.get(family)),
            None,
        )
        if entry is None:
            raise ContractValidationError("unknown profile binding reference", f"/{family}")
        profile = entry["profile"]
        refs[family] = {
            "family": family,
            "profile_id": profile["profile_id"],
            "identity": profile["schema_identity"],
            "revision": profile["profile_revision"],
            "digest": profile["canonical_digest"],
        }
    schema_revision = canonical_digest(json.loads((SCHEMA_ROOT / "profile-binding.schema.json").read_text(encoding="utf-8")))
    value = {
        "schema_identity": BINDING_IDENTITY,
        "schema_revision": schema_revision,
        "binding_id": "phase2d.profile-binding",
        "binding_digest": "",
        **refs,
        "fidelity": fidelity,
        "gpu_participation_mode": gpu_participation_mode,
    }
    value["binding_digest"] = canonical_digest(value)
    return value


def executable_combinations() -> list[dict[str, Any]]:
    """No Phase 2D combination is executable until lowering/calibration closes."""
    return []
