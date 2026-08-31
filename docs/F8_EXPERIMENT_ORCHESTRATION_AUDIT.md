# F8 schema-driven experiment orchestration audit

**Date**: 2026-08-31  
**Status**: formal frontend descriptor integration validated locally and live  
**Live schema-set revision**: `sha256:b1136c7acf028d9bcf0e28ed9744f68bce6faa0b00c40342337c99abbe611159`  
**Descriptor revision**: `sha256:fe6d389035f9ca5f15f68a2ec65292c49f1e6bdc79e35d95b1acd641f8bcee96`

## Contract facts available now

- `create-run-request.schema.json` formally defines the allowed top-level scenario, requested fidelity, GPU
  participation mode, run name, mutually exclusive `overrides`/`custom_inputs`, and optional
  `design_space_candidates`.
- `/api/catalog` advertises scenarios, fidelity policies, input modes, design-space modes, and GPU participation
  modes at runtime; all of these run-surface arrays are typed in OpenAPI.
- `/api/capabilities` supplies the default GPU mode, dependency availability, cycle scope, and a typed `run_surface`
  object.
- Bridge validation errors carry exact `field_path` JSON Pointers. Idempotency-Key recovery and SSE/poll recovery
  already prevent ambiguous reconnects from starting a second run.
- The post-run validation report remains the source for resolved fidelity; a requested fidelity is not displayed as
  the resolved result.

## Frontend batch delivered

- The create-run JSON Schema is emitted as a generated TypeScript constant and checked for contract drift.
- Scenario, requested-fidelity, GPU, and input-mode options are the intersection of the generated request schema and
  runtime catalog/capabilities. Values not present in that intersection cannot be submitted.
- S0 workload, S1 runtime-policy, and S6 Fabric controls now use one descriptor collection for rendering, default
  reset, validation, exact request JSON Pointer, and request serialization.
- The exact request object produced by the submit path is shown as a JSON preview; the preview and submitted object
  come from the same builder.
- Frontend validation and backend `field_path` use the same Pointer, and the matching control receives
  `aria-invalid=true`.
- A formal descriptor reports `contract_status=supported`. `frontend_compatibility` is retained only for an
  explicitly unversioned legacy Bridge and cannot claim complete F8 closure.

## Formal descriptor integration

- `GET /api/experiment-schema` is consumed as `tilesim.bridge.experiment_descriptor.v1`.
- The manifest revision, descriptor payload revision, and response header revision must be identical; stale or missing
  identity fails closed and is never read from a cached descriptor.
- The eight controls use `field_id` as form identity and `request_json_pointer` as their only request mapping. The
  descriptor supplies enum, range, integer constraint, step, unit, display order, applicability, and structured
  capability predicate.
- `explicit_default_available=false` leaves every formal override unset, so the generated request omits it. The old
  populated values remain only in the explicitly labelled unversioned Bridge compatibility path.
- S2/S3/S4/S5 render as `not_exposed`; Cycle, real trace, and compatibility harness trace render as unavailable.
- The closed create-run/custom-input/design-space schemas are compiled into browser-safe generated validators. Invalid
  nested fields and `additionalProperties` fail before submission.
- Backend `error.field_path` focuses a field only after an exact unique Pointer match. Unknown or ambiguous Pointers
  surface a contract error and do not guess a control.

## Live deployment closure

After explicit user authorization, `D:\tileSim-week8` was deployed to `127.0.0.1:5173`. Health reports
`execution_ready=true`, `versions_match=true`, and `state_digests_match=true`. Manifest, descriptor payload, and
`X-TileSim-Schema-Set-Revision` all report the live schema-set revision above; the descriptor exposes exactly eight
parameters and the expected descriptor revision. All four read-only live Week 8/F7/F8 Playwright tests pass.

## Closed backend contract gaps

The backend/Bridge now publishes the previously requested versioned parameter descriptor contract with:

- stable `field_id` and exact create-run `json_pointer`;
- canonical `subsystem` (`S0-S6`) and form group/order metadata;
- value type, enum values, inclusive minimum/maximum, integer constraint, step, and display unit;
- required/optional state and explicit default semantics;
- capability predicate and unsupported reason;
- allowed input/source modes and provenance constraints;
- requested-fidelity options and their availability predicate;
- scenario/template binding plus schema/revision identity so a stale descriptor fails closed.

The OpenAPI now types the runtime fields returned by `/api/catalog` and `/api/capabilities`:

- `input_modes`;
- `design_space_modes`;
- `gpu_participation_modes`;
- `run_surface.gpu_participation_modes`;
- `run_surface.design_space_modes`;
- cycle-hotspot request availability and reason.

The `overrides`, `custom_inputs`, and `design_space_candidates` properties now use closed nested `$ref` schemas.

## Forbidden frontend closure shortcuts

- Do not infer parameter support from template fields, previously successful runs, CLI help text, or Bridge Python
  implementation.
- Do not synthesize defaults from the first enum value or a visually convenient number.
- Do not enable a control because a dependency executable exists unless the run-surface contract explicitly marks
  the request as submit-ready.
- Do not translate backend enums, JSON Pointers, IDs, schema identities, source modes, or fidelity values.
- Do not claim resolved fidelity, provenance, calibration, or held-out validation before the corresponding run
  reports are loaded and validated.

## Validation scope

Unit/component and fixture Playwright cover formal descriptor rendering, omitted defaults, closed request/design-space
validation, duplicate stable identity, stale response revision, structured capability predicates, source/fidelity
availability, exact Pointer focus, request preview equivalence, accessibility, and desktop overflow. The same checks
also pass against the deployed 5173 service.

## Verification

- generated contract drift, dependency boundaries, TypeScript, ESLint, production build, and diff checks passed;
- 158/158 frontend unit/component tests passed;
- 23/23 desktop fixture Playwright tests passed;
- 4/4 live Week 8/F7/F8 Playwright tests passed against `127.0.0.1:5173`;
- repo-wide `format:check` remains blocked by five pre-existing unformatted F8 Bridge contract files. They were not
  modified because this frontend task explicitly forbids Bridge changes.
