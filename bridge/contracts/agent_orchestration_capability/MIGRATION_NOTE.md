# Phase 0C capability publication migration

The Phase 0B publication candidate was migrated into this formal, additive contract family. The immutable catalog content is stored separately from the runtime snapshot envelope. Catalog and schema digests are derived from canonical content with self-digest fields removed; they therefore do not embed or chase a future Git commit.

`build_snapshot(release_metadata)` injects source/build revisions at runtime and fails closed for missing, unknown, or drifted metadata. Each invocation returns a fresh validated object. The service exposes the eight execution-closed fields only; model, engine, device, topology, workload selection, parallel degrees, physical KV policy, collective algorithm, and SLO remain structured `not_exposed` capabilities. Profile family schemas are published while actual profile data remains zero and unavailable.

The static catalog is evidence-scoped to exploration and synthetic consistency. Calibration and held-out validation remain denied/missing. This module does not modify the OpenAPI root, schema-set manifest, generated clients, F8 contracts, UI, or Evidence Agent.
