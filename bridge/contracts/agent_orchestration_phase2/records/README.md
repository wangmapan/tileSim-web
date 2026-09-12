# Phase 2D Profile records

The checked-in record source is `../registry.py`. It materializes one sealed,
deterministically ordered record for each of the five published Profile v2
families, together with the source catalog. Records are sealed at load time so
schema revision, profile revision, and canonical digest are always derived from
the exact source code and published schemas; no generated or runtime artifact is
required. `load_registry()` and the read-only Bridge endpoints are the only
supported query paths.
