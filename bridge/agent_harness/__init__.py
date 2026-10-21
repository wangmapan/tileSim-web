"""Durable, fail-closed Agent Harness backend primitives.

The package is deliberately independent of the TileSim simulator.  It owns
operation state, replayable events, checkpoints, permissions and read-only
tool dispatch at the Bridge boundary.
"""

from .contracts import CONTRACT_REVISION, SCHEMA_SET_IDENTITY

__all__ = ["CONTRACT_REVISION", "SCHEMA_SET_IDENTITY"]
