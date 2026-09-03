# Frontend Stable Candidate Audit · 2026-09-02

## Scope

This audit reviewed the four local commits after the remote branch tip, with extra attention to the previously parallel
Evidence Agent, visualization, and guided-help workstreams. It covered source boundaries, generated contracts, dependency
security, unit/component tests, Bridge tests, production build, desktop Playwright, and all primary desktop routes.

## Issues closed

1. Removed the unreferenced legacy `src/components/PagePrimer.vue`. The routed application uses the guided-help-owned
   `src/features/guided-help/components/PagePrimer.vue`; keeping both created an ambiguous ownership boundary.
2. Removed 38 duplicate English catalog keys left across the shared catalog and parallel workstream catalogs. Ten duplicates
   had different values and therefore depended on object-spread order. Runtime wording was preserved, each key now has one
   owner, and a regression test enforces that invariant.
3. Upgraded ECharts from 6.0.0 to 6.1.0, the patched release for `GHSA-fgmj-fm8m-jvvx`. The application continues to use
   tree-shaken `echarts/core` imports and the existing runtime/renderer split.

No credential literal matching the configured Provider key pattern is tracked. Runtime Provider configuration remains outside
version control; only the approved `TILESIM_EVIDENCE_AGENT_*` variable names are referenced by scripts.

## Stable candidate evidence

- contracts drift check: passed
- frontend dependency boundaries: 186 source files passed after removal of the dead component
- typecheck, ESLint, Prettier, production build: passed
- frontend unit/component: 265/265 passed
- Bridge Python discovery: 78/78 passed
- Bridge server suite: 64/64 passed
- F7/F8/F9 Schema and OpenAPI inventory: passed, including the 36-case F9 catalog
- Python/Node canonical digest: 2/2 golden vectors passed
- desktop fixture Playwright: 29/29 passed; 5 live-deployment cases skipped by design
- primary-route browser audit: 11/11 routes loaded without alerts, horizontal overflow, stuck busy state, or console errors
- isolated release rehearsal: real run completed, invalid CLI failed closed, immutable snapshot and run restored successfully
- production dependency audit: no known production vulnerabilities after the ECharts upgrade
- `git diff --check`: passed

## Deployment and remaining gates

The audit delta is a source stable candidate and was not redeployed to `127.0.0.1:5173`. The currently deployed immutable Web
snapshot remains `d538aceb85095b27d17b4abe9ebb5946157bd381`, backed by Week 8 revision
`4a536cc081abb20567c19ab9e94e6139f5008333`, schema set
`sha256:92acce87f4f611893fafb2bf81dd1fa4fac509316ea2b5215a60f1995688871e`, and descriptor revision
`sha256:5f78ed33e20c131f672af53368c5ca950f41d63fd2e8f5301757d1f42debe357`.

The stable candidate itself passed `tilesim.web.release_rehearsal.v1` on isolated port `58173`; release digest
`13c87c6846debfa84ce7c03d3ce6eed97dc7b36c6811d3929c73b27e14ce9405` completed real run
`run-20260902-141146-20233a97`, rejected the injected missing-CLI candidate, and restored the same completed run.

The authenticated Provider capability probe is available, but no live Evidence Agent question was sent during this audit.
Live repetitions remain 0. F9 still requires success/refusal/timeout acceptance, repeated safety/refusal evaluation, and the
two-reviewer citation entailment review before it can be marked validated. Synthetic consistency remains distinct from held-out
real-trace validation.
