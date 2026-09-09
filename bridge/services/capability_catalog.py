"""Read-only capability snapshot service with fail-closed release binding."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from contracts.agent_orchestration_capability.contract import build_snapshot


class CapabilityCatalogService:
    def __init__(self, release_metadata: Mapping[str, Any]):
        self._release_metadata = dict(release_metadata)

    def snapshot(self, current_release_metadata: Mapping[str, Any] | None = None) -> dict[str, Any]:
        """Build a fresh validated snapshot; callers cannot mutate service state."""
        if current_release_metadata is not None and dict(current_release_metadata) != self._release_metadata:
            raise ValueError("capability release binding drifted; refetch is denied")
        return build_snapshot(self._release_metadata)


def build_capability_snapshot(release_metadata: Mapping[str, Any]) -> dict[str, Any]:
    return CapabilityCatalogService(release_metadata).snapshot()


def capability_snapshot_response(
    service: CapabilityCatalogService,
    current_release_metadata: Mapping[str, Any],
) -> tuple[int, dict[str, str], dict[str, Any]]:
    """Module-local GET response; endpoint registration belongs to integration."""
    snapshot = service.snapshot(current_release_metadata)
    return (
        200,
        {
            "Cache-Control": "no-store",
            "Content-Type": "application/json; charset=utf-8",
            "ETag": f'"{snapshot["snapshot_digest"]}"',
        },
        snapshot,
    )
