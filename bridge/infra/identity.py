"""Git, deployment-manifest, and TileSimCLI capability discovery."""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
from pathlib import Path

from contracts.experiment_descriptor import PARAMETER_FIELD_IDS


# Local backend checkouts commonly keep several side-by-side CMake snapshots
# (for example ``build-kv1`` and ``build-tr1-wsl``) next to the source tree.
# They are generated artifacts rather than source state.  Git only excludes
# them when the checkout's .gitignore contains the matching pattern; keeping
# the deployment digest defensive here prevents a dirty checkout from reading
# gigabytes of build output during every Bridge identity lookup.
GENERATED_DIRECTORY_EXCLUDES = ("build-*/",)


def controlled_run_surface() -> dict:
    """Stable web submission capabilities; executable discovery cannot upgrade them."""
    return {
        "gpu_participation_modes": ["gpu_free"],
        "input_modes": ["controls", "json", "trace_package"],
        "design_space_modes": ["built_in_synthetic", "strict_s6_manifest"],
        "source_modes": ["synthetic_trace"],
        "override_parameter_subsystems": ["S0", "S1", "S6"],
        "override_parameter_field_ids": list(PARAMETER_FIELD_IDS),
        "cycle_hotspot_request_available": False,
        "cycle_hotspot_request_reason": "explicit_s6_cycle_hotspot_request_surface_not_exposed",
        "real_trace_submission_available": False,
        "compatibility_harness_submission_available": False,
        "real_network_observation_channel": "S8_evidence_only",
    }


def resolve_linked_git_dir(root: Path) -> Path | None:
    metadata = root / ".git"
    if metadata.is_dir():
        return metadata
    try:
        pointer = metadata.read_text(encoding="utf-8").strip()
    except OSError:
        return None
    if not pointer.lower().startswith("gitdir:"):
        return None
    raw = pointer.split(":", 1)[1].strip().replace("\\", "/")
    drive_path = re.fullmatch(r"([A-Za-z]):/(.*)", raw)
    if drive_path and os.name != "nt":
        return Path("/mnt") / drive_path.group(1).lower() / drive_path.group(2)
    candidate = Path(raw)
    return candidate if candidate.is_absolute() else (root / candidate).resolve()


def git_command(root: Path, *args: str) -> list[str]:
    git_dir = resolve_linked_git_dir(root)
    command = ["git", "-C", str(root), *args]
    if git_dir is not None:
        command = ["git", f"--git-dir={git_dir}", f"--work-tree={root}", *args]
    return command


def git_value(root: Path, *args: str) -> str:
    try:
        completed = subprocess.run(
            git_command(root, *args),
            text=True,
            capture_output=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return "unknown"
    return completed.stdout.strip() if completed.returncode == 0 and completed.stdout.strip() else "unknown"


def worktree_state_digest(root: Path) -> str:
    """Hash the effective tracked/untracked source state without changing Git state."""
    try:
        revision = subprocess.run(git_command(root, "rev-parse", "HEAD"), capture_output=True, timeout=60, check=False)
        tracked_diff = subprocess.run(
            git_command(root, "diff", "--binary", "--no-ext-diff", "HEAD"),
            capture_output=True,
            timeout=60,
            check=False,
        )
        exclude_args = ["--exclude-standard"]
        for pattern in GENERATED_DIRECTORY_EXCLUDES:
            exclude_args.extend(("--exclude", pattern))
        untracked = subprocess.run(
            git_command(root, "ls-files", "--others", *exclude_args, "-z"),
            capture_output=True,
            timeout=60,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return "unknown"
    if revision.returncode != 0 or tracked_diff.returncode != 0 or untracked.returncode != 0:
        return "unknown"

    digest = hashlib.sha256()
    digest.update(b"tilesim.worktree_state.v1\0")
    digest.update(revision.stdout.strip())
    digest.update(b"\0tracked-diff\0")
    digest.update(tracked_diff.stdout)
    digest.update(b"\0untracked\0")
    for raw_path in filter(None, untracked.stdout.split(b"\0")):
        path = root / os.fsdecode(raw_path)
        digest.update(len(raw_path).to_bytes(8, "big"))
        digest.update(raw_path)
        if path.is_symlink():
            try:
                payload = os.fsencode(os.readlink(path))
            except OSError:
                return "unknown"
            digest.update(b"symlink\0")
            digest.update(len(payload).to_bytes(8, "big"))
            digest.update(payload)
            continue
        try:
            source = path.open("rb")
        except OSError:
            digest.update(b"missing\0")
            digest.update((0).to_bytes(8, "big"))
            continue
        with source:
            try:
                before = os.fstat(source.fileno())
                digest.update(b"file\0")
                digest.update(before.st_size.to_bytes(8, "big"))
                bytes_read = 0
                while chunk := source.read(1024 * 1024):
                    digest.update(chunk)
                    bytes_read += len(chunk)
                after = os.fstat(source.fileno())
            except OSError:
                return "unknown"
            if (
                bytes_read != before.st_size
                or after.st_size != before.st_size
                or after.st_mtime_ns != before.st_mtime_ns
            ):
                return "unknown"
    return digest.hexdigest()


def deployment_manifest(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def backend_identity(tilesim_root: Path, tilesim_cli: Path, manifest_path: Path) -> dict:
    manifest = deployment_manifest(manifest_path)
    packaged = bool(
        os.environ.get("TILESIM_PACKAGE_ROOT")
        or manifest.get("deployment_mode") == "packaged"
        or manifest.get("schema_version") == "tilesim.workbench.release.v1"
    )
    git_source_revision = git_value(tilesim_root, "rev-parse", "HEAD")
    source_revision = (
        str(manifest.get("backend_source_revision"))
        if packaged and manifest.get("backend_source_revision")
        else git_source_revision
    )
    build_revision = (
        os.environ.get("TILESIM_BUILD_REVISION")
        or manifest.get("build_revision")
        or (manifest.get("backend_source_revision") if packaged else None)
        or "unknown"
    )
    declared_state_digest = manifest.get("source_state_digest", "")
    build_state_digest = os.environ.get("TILESIM_BUILD_STATE_DIGEST") or manifest.get("build_state_digest", "")
    source_state_digest = worktree_state_digest(tilesim_root) if declared_state_digest and not packaged else ""
    state_digests_match = not declared_state_digest or (
        source_state_digest != "unknown"
        and source_state_digest == declared_state_digest
        and build_state_digest == declared_state_digest
    )
    versions_match = (
        source_revision != "unknown"
        and build_revision != "unknown"
        and source_revision == build_revision
        and state_digests_match
    )
    branch = git_value(tilesim_root, "branch", "--show-current") if not packaged else "unknown"
    result = {
        "tilesim_root": str(tilesim_root),
        "tilesim_cli": str(tilesim_cli),
        "backend_revision": source_revision,
        "backend_branch": branch if branch != "unknown" else manifest.get("source_ref", "packaged" if packaged else "detached"),
        "source_revision": source_revision,
        "build_revision": build_revision,
        "source_state_digest": source_state_digest,
        "build_state_digest": build_state_digest,
        "state_digests_match": state_digests_match,
        "versions_match": versions_match,
        "deployment_mode": manifest.get("deployment_mode", "packaged" if packaged else "unmanaged"),
        "deployment_ref": manifest.get("source_ref") or manifest.get("release_id", "unknown"),
        "deployed_at": manifest.get("deployed_at") or manifest.get("created_at", "unknown"),
        "deployment_manifest": str(manifest_path),
    }
    for field in (
        "web_source_revision",
        "web_source_state_digest",
        "web_build_digest",
        "web_release_identity",
        "web_release_digest",
        "web_bridge_digest",
        "web_static_digest",
        "schema_set_revision",
    ):
        if manifest.get(field):
            result[field] = manifest[field]
    for field in ("release_id", "version", "runtime_kind", "tilesim_cli_digest", "rootfs_sha256"):
        if manifest.get(field):
            result[field] = manifest[field]
    return result


def runtime_capabilities(tilesim_cli: Path) -> dict:
    unavailable = {
        "schema_version": "tilesim.runtime_capabilities.v1",
        "default_gpu_participation_mode": "gpu_free",
        "cycle_scope": "S6_hotspot_refinement_only",
        "dependencies": {
            "gpu_hardware": {"available": False, "version": "", "reason": "TileSimCLI_capability_discovery_unavailable"},
            "verilator_cycle": {"available": False, "version": "", "reason": "TileSimCLI_capability_discovery_unavailable"},
            "astra_sim": {
                "available": False,
                "version": "",
                "reason": "real_ASTRA_executable_and_Chakra_root_not_configured",
            },
        },
        "run_surface": controlled_run_surface(),
    }
    if not (tilesim_cli.is_file() and os.access(tilesim_cli, os.X_OK)):
        return unavailable
    try:
        completed = subprocess.run(
            [str(tilesim_cli), "capabilities"], text=True, capture_output=True, timeout=5, check=False
        )
        discovered = json.loads(completed.stdout)
    except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError):
        return unavailable
    if completed.returncode != 0 or discovered.get("schema_version") != unavailable["schema_version"]:
        return unavailable
    discovered["run_surface"] = controlled_run_surface()
    return discovered
