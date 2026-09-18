"""Controlled Trace-package discovery and TileSimCLI inspection."""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path


ProcessRunner = Callable[..., subprocess.CompletedProcess[str]]

TRACE_PACKAGE_SCHEMA_IDENTITY = "tilesim.trace_package.v1alpha1"
CATALOG_SCHEMA_IDENTITY = "tilesim.bridge.trace_package_catalog.v1"
INSPECT_SCHEMA_IDENTITY = "tilesim.bridge.trace_package_inspect.v1"
MANIFEST_FILE_NAME = "trace_package.json"
MAX_MANIFEST_BYTES = 1024 * 1024
INSPECT_TIMEOUT_SECONDS = 15
SAFE_PACKAGE_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}\Z")
REQUIRED_SEMANTIC_ROLES = {
    "request",
    "batch",
    "iteration",
    "tile_execution",
    "kv_cache",
    "network_flow",
}


class TracePackageError(ValueError):
    def __init__(self, code: str, message: str, *, retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.retryable = retryable


@dataclass(frozen=True)
class TracePackageCandidate:
    package_id: str
    manifest_path: Path
    manifest_sha256: str


def _safe_candidate_label(path: Path) -> str:
    name = path.name
    return name if SAFE_PACKAGE_ID.fullmatch(name) else "unavailable_candidate"


def _is_link(path: Path) -> bool:
    if path.is_symlink():
        return True
    is_junction = getattr(path, "is_junction", None)
    return bool(is_junction and is_junction())


def _resolved_root(root: Path | None) -> tuple[Path | None, str | None]:
    if root is None:
        return None, "trace_package_root_not_configured"
    try:
        if _is_link(root):
            return None, "trace_package_root_symlink_rejected"
        resolved = root.resolve(strict=True)
    except OSError:
        return None, "trace_package_root_unavailable"
    if not resolved.is_dir():
        return None, "trace_package_root_unavailable"
    return resolved, None


def _manifest_bytes(manifest: Path) -> bytes:
    if manifest.is_symlink():
        raise TracePackageError(
            "trace_package_symlink_rejected",
            "Trace-package manifests may not be symbolic links.",
        )
    try:
        size = manifest.stat().st_size
    except OSError as error:
        raise TracePackageError(
            "trace_package_manifest_missing",
            "Trace-package manifest is missing.",
        ) from error
    if size > MAX_MANIFEST_BYTES:
        raise TracePackageError(
            "trace_package_manifest_too_large",
            "Trace-package manifest exceeds the 1 MiB Bridge discovery limit.",
        )
    try:
        return manifest.read_bytes()
    except OSError as error:
        raise TracePackageError(
            "trace_package_manifest_unreadable",
            "Trace-package manifest could not be read.",
        ) from error


def _reject_symlink_tree(directory: Path) -> None:
    try:
        for current, directory_names, file_names in os.walk(
            directory,
            followlinks=False,
            onerror=lambda error: (_ for _ in ()).throw(error),
        ):
            current_path = Path(current)
            for name in (*directory_names, *file_names):
                if _is_link(current_path / name):
                    raise TracePackageError(
                        "trace_package_symlink_rejected",
                        "Trace-package contents may not contain symbolic links or junctions.",
                    )
    except TracePackageError:
        raise
    except OSError as error:
        raise TracePackageError(
            "trace_package_manifest_unreadable",
            "Trace-package contents could not be checked safely.",
        ) from error


def _candidate_for_directory(root: Path, directory: Path) -> TracePackageCandidate:
    if _is_link(directory):
        raise TracePackageError(
            "trace_package_symlink_rejected",
            "Trace-package directories may not be symbolic links.",
    )
    try:
        resolved_root = root.resolve(strict=True)
        resolved_directory = directory.resolve(strict=True)
        resolved_directory.relative_to(resolved_root)
    except (OSError, ValueError) as error:
        raise TracePackageError(
            "trace_package_path_escape",
            "Trace-package directory escapes the configured root.",
        ) from error
    if not resolved_directory.is_dir():
        raise TracePackageError(
            "trace_package_layout_invalid",
            "Trace-package root entries must be directories.",
        )
    _reject_symlink_tree(resolved_directory)
    manifest = resolved_directory / MANIFEST_FILE_NAME
    body = _manifest_bytes(manifest)
    try:
        resolved_manifest = manifest.resolve(strict=True)
        resolved_manifest.relative_to(resolved_directory)
    except (OSError, ValueError) as error:
        raise TracePackageError(
            "trace_package_path_escape",
            "Trace-package manifest escapes its package directory.",
        ) from error
    try:
        value = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise TracePackageError(
            "trace_package_manifest_malformed",
            "Trace-package manifest is not valid UTF-8 JSON.",
        ) from error
    package_id = value.get("package_id") if isinstance(value, dict) else None
    if not isinstance(package_id, str) or not SAFE_PACKAGE_ID.fullmatch(package_id):
        raise TracePackageError(
            "trace_package_id_invalid",
            "Trace-package package_id is not a safe stable HTTP identifier.",
        )
    return TracePackageCandidate(
        package_id=package_id,
        manifest_path=resolved_manifest,
        manifest_sha256="sha256:" + hashlib.sha256(body).hexdigest(),
    )


def discover_candidates(root: Path | None) -> tuple[dict[str, TracePackageCandidate], list[dict], str | None]:
    resolved_root, unavailable_reason = _resolved_root(root)
    if resolved_root is None:
        return {}, [], unavailable_reason

    grouped: dict[str, list[TracePackageCandidate]] = {}
    errors: list[dict] = []
    try:
        entries = sorted(resolved_root.iterdir(), key=lambda item: item.name)
    except OSError:
        return {}, [], "trace_package_root_unavailable"
    for entry in entries:
        try:
            candidate = _candidate_for_directory(resolved_root, entry)
            grouped.setdefault(candidate.package_id, []).append(candidate)
        except TracePackageError as error:
            errors.append(
                {
                    "candidate": _safe_candidate_label(entry),
                    "code": error.code,
                    "message": str(error),
                }
            )

    unique: dict[str, TracePackageCandidate] = {}
    for package_id, candidates in grouped.items():
        if len(candidates) != 1:
            errors.append(
                {
                    "candidate": package_id,
                    "code": "duplicate_package_id",
                    "message": "Trace-package package_id is duplicated under the configured root.",
                }
            )
            continue
        unique[package_id] = candidates[0]
    return unique, errors, None


def resolve_candidate(root: Path | None, package_id: str) -> TracePackageCandidate:
    if not SAFE_PACKAGE_ID.fullmatch(package_id):
        raise TracePackageError("trace_package_not_found", "Trace package was not found.")
    candidates, errors, unavailable_reason = discover_candidates(root)
    if unavailable_reason:
        raise TracePackageError(
            unavailable_reason,
            "Trace-package capability is unavailable.",
            retryable=True,
        )
    if any(error["candidate"] == package_id and error["code"] == "duplicate_package_id" for error in errors):
        raise TracePackageError(
            "duplicate_package_id",
            "Trace-package package_id is duplicated and cannot be resolved safely.",
        )
    candidate = candidates.get(package_id)
    if candidate is None:
        raise TracePackageError("trace_package_not_found", "Trace package was not found.")
    return candidate


def inspect_candidate(
    candidate: TracePackageCandidate,
    *,
    tilesim_cli: Path,
    tilesim_root: Path,
    process_runner: ProcessRunner = subprocess.run,
) -> dict:
    command = [
        str(tilesim_cli),
        "inspect-trace-package",
        "--trace-package",
        str(candidate.manifest_path),
    ]
    try:
        completed = process_runner(
            command,
            cwd=tilesim_root,
            text=True,
            capture_output=True,
            timeout=INSPECT_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise TracePackageError(
            "trace_package_inspect_timeout",
            "TileSimCLI Trace-package inspection timed out.",
            retryable=True,
        ) from error
    except OSError as error:
        raise TracePackageError(
            "trace_package_inspect_execution_error",
            "TileSimCLI Trace-package inspection could not be started.",
            retryable=True,
        ) from error

    try:
        report = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise TracePackageError(
            "trace_package_inspect_invalid_output",
            "TileSimCLI Trace-package inspection did not return JSON.",
        ) from error
    if not isinstance(report, dict) or report.get("report_kind") != "trace_package_intake":
        raise TracePackageError(
            "trace_package_inspect_invalid_output",
            "TileSimCLI Trace-package inspection returned an unsupported report.",
        )
    if completed.returncode != 0:
        raise TracePackageError(
            "trace_package_inspect_nonzero_exit",
            "TileSimCLI Trace-package inspection failed validation.",
        )
    if report.get("valid") is not True:
        raise TracePackageError(
            "trace_package_inspect_invalid_output",
            "TileSimCLI returned success without a valid Trace-package report.",
        )
    if report.get("schema_version") != TRACE_PACKAGE_SCHEMA_IDENTITY:
        raise TracePackageError(
            "trace_package_schema_mismatch",
            "TileSimCLI inspected an unsupported Trace-package schema.",
        )
    if report.get("package_id") != candidate.package_id:
        raise TracePackageError(
            "trace_package_id_mismatch",
            "Inspected Trace-package ID does not match the selected package.",
        )
    provenance = report.get("trace_provenance")
    producer = report.get("producer")
    semantic_roles = report.get("semantic_roles")
    if (
        not isinstance(provenance, dict)
        or not isinstance(producer, dict)
        or set(semantic_roles if isinstance(semantic_roles, list) else []) != REQUIRED_SEMANTIC_ROLES
    ):
        raise TracePackageError(
            "trace_package_inspect_invalid_output",
            "TileSimCLI inspection omitted required package identity or integrity fields.",
        )
    source_mode = provenance.get("source_mode")
    return {
        "package_id": candidate.package_id,
        "producer": {"name": producer.get("name"), "version": producer.get("version")},
        "experiment_id": report.get("experiment_id"),
        "physical_run_id": report.get("physical_run_id"),
        "entry_boundary": report.get("entry_boundary"),
        "entry_trace_kind": report.get("entry_trace_kind"),
        "trace_provenance": provenance,
        "manifest_sha256": candidate.manifest_sha256,
        "inspect_status": "valid",
        "inspect_errors": [],
        "submission_available": source_mode == "synthetic_trace",
        "unavailable_reason": None if source_mode == "synthetic_trace" else "source_mode_not_enabled_in_prototype",
        "artifact_integrity": {
            "complete": True,
            "semantic_artifact_count": len(REQUIRED_SEMANTIC_ROLES),
            "semantic_roles": sorted(REQUIRED_SEMANTIC_ROLES),
            "sha256_verified": True,
            "entry_trace_verified": True,
        },
    }


def inspect_package(
    root: Path | None,
    package_id: str,
    *,
    tilesim_cli: Path,
    tilesim_root: Path,
    process_runner: ProcessRunner = subprocess.run,
) -> tuple[TracePackageCandidate, dict]:
    candidate = resolve_candidate(root, package_id)
    return candidate, inspect_candidate(
        candidate,
        tilesim_cli=tilesim_cli,
        tilesim_root=tilesim_root,
        process_runner=process_runner,
    )


def sanitized_backend_identity(identity: dict) -> dict:
    keys = (
        "source_revision",
        "build_revision",
        "source_state_digest",
        "build_state_digest",
        "versions_match",
        "state_digests_match",
        "deployment_mode",
        "deployment_ref",
    )
    return {key: identity.get(key) for key in keys if key in identity}


def catalog(
    root: Path | None,
    *,
    schema_set_revision: str,
    backend_identity: dict,
    tilesim_cli: Path,
    tilesim_root: Path,
    process_runner: ProcessRunner = subprocess.run,
) -> dict:
    candidates, discovery_errors, unavailable_reason = discover_candidates(root)
    if unavailable_reason is None and not tilesim_root.is_dir():
        unavailable_reason = "tilesim_root_unavailable"
    if unavailable_reason is None and not (
        tilesim_cli.is_file() and os.access(tilesim_cli, os.X_OK)
    ):
        unavailable_reason = "tilesim_cli_unavailable"
    packages: list[dict] = []
    for candidate in candidates.values() if unavailable_reason is None else ():
        try:
            packages.append(
                inspect_candidate(
                    candidate,
                    tilesim_cli=tilesim_cli,
                    tilesim_root=tilesim_root,
                    process_runner=process_runner,
                )
            )
        except TracePackageError as error:
            packages.append(
                {
                    "package_id": candidate.package_id,
                    "manifest_sha256": candidate.manifest_sha256,
                    "inspect_status": "invalid",
                    "inspect_errors": [{"code": error.code, "message": str(error)}],
                    "submission_available": False,
                    "unavailable_reason": error.code,
                    "artifact_integrity": {
                        "complete": False,
                        "semantic_artifact_count": 0,
                        "semantic_roles": [],
                        "sha256_verified": False,
                        "entry_trace_verified": False,
                    },
                }
            )
    return {
        "schema_version": CATALOG_SCHEMA_IDENTITY,
        "trace_package_schema_identity": TRACE_PACKAGE_SCHEMA_IDENTITY,
        "schema_set_revision": schema_set_revision,
        "backend_identity": sanitized_backend_identity(backend_identity),
        "capability": {
            "available": unavailable_reason is None,
            "reason": unavailable_reason,
        },
        "packages": sorted(packages, key=lambda item: item["package_id"]),
        "discovery_errors": discovery_errors,
    }


def inspect_response(item: dict, *, schema_set_revision: str, backend_identity: dict) -> dict:
    return {
        "schema_version": INSPECT_SCHEMA_IDENTITY,
        "trace_package_schema_identity": TRACE_PACKAGE_SCHEMA_IDENTITY,
        "schema_set_revision": schema_set_revision,
        "backend_identity": sanitized_backend_identity(backend_identity),
        "package": item,
    }
