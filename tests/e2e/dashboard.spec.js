import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { fixtureCase } from "../helpers/fixtures";
import { createF8ExperimentDescriptor, f8Capabilities, f8SchemaRevision } from "../fixtures/experiment-descriptor";
import { createEvidenceAgentDescriptor, f9DescriptorRevision } from "../fixtures/evidence-agent-descriptor";

const runId = "run-fixture-f1";

const week7EvidenceMap = {
  schema_version: "tilesim.s9.report_field_evidence_map.v1alpha1",
  status: "pass",
  rules: [
    {
      report_kind: "tail_cause_chain_report",
      field_path: "attribution_ranking.share",
      source_object: "TailAttributionRankRecord[].score_ps",
      computation_rule: "Normalize every positive score by the same total score.",
      validation_check: "attribution_share_conservation",
      allowed_claim: "A relative ranking, not unexplained wall time.",
    },
  ],
};

const week7Calibration = {
  schema_version: "tilesim.calibration.workflow_report.v1alpha1",
  report_id: "fixture-calibration-workflow",
  manifest_id: "week7-offline-calibration-assets-v1",
  status: "passed",
  evidence_tier: "offline_fixture_consistency",
  allowed_claim_scope: "workflow_consistency_only",
  scopes: [
    {
      subsystem: "S6",
      fit_scope: "link",
      input_unit: "predicted_us",
      observed_unit: "observed_us",
      operating_region: { fabric: "offline_reference", topology: "two_endpoint" },
      calibration_sample_count: 4,
      held_out_sample_count: 2,
      selected_model: { model_kind: "affine", slope: 1.02, intercept: 0.1, selection_mae: 0 },
      held_out_mae: 0,
      held_out_p95_relative_error: 0,
      held_out_max_relative_error: 0,
      relative_error_budget: 0.02,
      error_budget_passed: true,
      calibration_asset_ids: ["link_calibration_fixture_v1"],
      calibration_asset_sha256: ["39f5aa9d5f449ec33ab8494bd9c5bc9d436ae36ed9c7044fb6bd501495737159"],
      held_out_asset_ids: ["link_held_out_fixture_v1"],
      held_out_asset_sha256: ["797a483707454b4719df29873d4825d47404748ebfc5748314b879096d3d997c"],
    },
  ],
  errors: [],
};

const week7Orchestration = {
  schema_version: "tilesim.agent.orchestration_report.v1alpha1",
  intent_id: "week7-synthetic-s1-s6-example",
  status: "completed",
  run_instance_id: "week7-synthetic-s1-s6-example::fnv1a64:test",
  frozen_configuration_digest: "fnv1a64:test",
  simulation_result_status: "partial",
  simulation_result_digest: "fnv1a64:result",
  tool_calls: ["parse_intent", "validate_constraints", "freeze_configuration", "execute_range", "query_artifacts"].map(
    (tool_name, index) => ({
      sequence: index + 1,
      tool_name,
      status: "passed",
      input_digest: `fnv1a64:input-${index + 1}`,
      output_reference: index === 4 ? "artifact_count=4" : `output-${index + 1}`,
    }),
  ),
  artifact_results: [
    { artifact_id: "execution_envelope", state: "ready", payload_digest: "fnv1a64:execution" },
    { artifact_id: "metrics_report", state: "ready", payload_digest: "fnv1a64:metrics" },
  ],
  errors: [],
};

function artifactFor(fixture, artifact) {
  return {
    "input-runtime-trace": fixture.inputs.runtime_trace,
    "input-topology": fixture.inputs.topology,
    "run-result": fixture.reports.run
      ? { ...fixture.reports.run, summary: { ...fixture.reports.run.summary, run_id: runId } }
      : null,
    metrics: fixture.reports.metrics,
    validation: fixture.reports.validation,
    "tail-cause-chain": fixture.reports.tail,
    "execution-envelope": fixture.reports.execution_envelope,
    "design-space": fixture.reports.design_space,
    "week8-run-evidence": fixture.reports.run_bound_des_evidence,
  }[artifact];
}

function artifactManifestEntries(fixture) {
  const definitions = [
    ["input-runtime-trace", null],
    ["input-topology", null],
    ["run-result", "run"],
    ["metrics", "metrics"],
    ["validation", "validation"],
    ["tail-cause-chain", "tail"],
    ["execution-envelope", "execution_envelope"],
    ["design-space", "design_space"],
    ["week8-run-evidence", "run_bound_des_evidence"],
  ];
  return definitions.flatMap(([artifactId, reportKind]) => {
    const value = artifactFor(fixture, artifactId);
    if (value === undefined || value === null) return [];
    const body = JSON.stringify(value);
    return [
      {
        artifact_id: artifactId,
        report_kind: reportKind,
        file_name: `${artifactId}.json`,
        media_type: "application/json",
        bytes: Buffer.byteLength(body),
        sha256: createHash("sha256").update(body).digest("hex"),
        schema_identity: value.contract_version || value.schema_version || "",
        contract_status: [
          "wind_tunnel.run.v1alpha1",
          "design_space.report.v1alpha1",
          "tilesim.design_space_report.v1",
          "tilesim.s6_topology_input.v1",
          "tilesim.metrics_report.v1",
          "tilesim.validation_report.v1",
          "tilesim.tail_cause_chain_report.v1",
          "tilesim.s7_execution_envelope.v1",
          "tilesim.s7_run_bound_des_evidence.v1",
        ].includes(value.contract_version || value.schema_version || "")
          ? "supported"
          : "legacy_compatibility",
      },
    ];
  });
}

function addWeek8Contracts(fixture, linkedRequestId) {
  const requestSubject = { kind: "request", id: linkedRequestId, request_id: linkedRequestId };
  const requestEvidence = {
    run_id: runId,
    artifact_id: "metrics",
    schema_identity: "tilesim.metrics_report.v1",
    json_pointer: "/request_metrics/0",
    availability: "available",
    subject: requestSubject,
  };
  Object.assign(fixture.reports.metrics, {
    schema_version: "tilesim.metrics_report.v1",
    run_id: runId,
    percentile_subjects: [
      {
        metric_kind: "end_to_end_latency_ps",
        percentile: 99,
        value_ps: "9007199254740993123",
        selection_rule: "nearest_rank_backend_selected",
        selection_semantics: "single_request",
        selected_request_id: linkedRequestId,
        member_request_ids: [linkedRequestId],
        subject_refs: [requestSubject],
      },
    ],
  });
  fixture.reports.metrics.system_summary.phase_fabric_contributions.forEach((phase) => {
    phase.not_s5_collective = !phase.collective_id;
  });
  Object.assign(fixture.reports.execution_envelope, {
    schema_version: "tilesim.s7_execution_envelope.v1",
    run_id: runId,
    evidence_refs: [],
  });
  Object.assign(fixture.reports.execution_envelope.stages[0], {
    subject_refs: [requestSubject],
    evidence_refs: [requestEvidence],
  });
  Object.assign(fixture.reports.validation, {
    schema_version: "tilesim.validation_report.v1",
    run_id: runId,
  });
  Object.assign(fixture.reports.validation.checks[0], {
    subject_refs: [requestSubject],
    evidence_refs: [requestEvidence],
  });
  Object.assign(fixture.reports.tail, {
    schema_version: "tilesim.tail_cause_chain_report.v1",
    run_id: runId,
  });
  Object.assign(fixture.reports.tail.cause_chain[0], {
    cause_id: "cause-week8-e2e",
    subject_refs: [requestSubject],
    evidence_refs: [requestEvidence],
  });
  Object.assign(fixture.reports.tail.attribution_ranking[0], {
    attribution_id: "attribution-week8-e2e",
    subject_refs: [requestSubject],
    evidence_refs: [requestEvidence],
  });
  const provenance = {
    source_mode: "synthetic_trace",
    calibration_level: "uncalibrated",
    allowed_claim_scope: "synthetic_consistency",
  };
  fixture.reports.run_bound_des_evidence = {
    schema_version: "tilesim.s7_run_bound_des_evidence.v1",
    run_id: runId,
    requested_fidelity: "des",
    resolved_fidelity: "des",
    execution_mode: "partitioned_des",
    fallback: { policy: "single_process_reference", used: false, reason: "" },
    provenance,
    state_summary: {
      schema_version: "tilesim.simulation.partitioned_des_state_summary.v1",
      logical_time_ps: "9007199254740993123",
      partition_count: 2,
      committed_event_count: 151,
      pending_event_count: 0,
      stream_record_count: 2,
      total_stream_record_count: 2,
      stream_records_truncated: false,
      provenance,
    },
    differential: {
      compared: true,
      matched: true,
      partitioned_digest: "fixture-partitioned-digest",
      reference_digest: "fixture-reference-digest",
      mismatch_code: "",
    },
    stream: { record_count: 2, total_record_count: 2, truncated: false, records: [] },
    checkpoint: {
      archive_schema_identity: "tilesim.simulation.partitioned_des_checkpoint_archive.v1",
      archive_digest: "fixture-archive-digest",
      partition_configuration_digest: "fixture-partition-config-digest",
      checkpoint_logical_time_ps: "9007199254740993123",
      committed_event_count: 151,
      pending_event_count: 0,
      completed_identity_count: 1,
      subject_version_count: 1,
      payload_availability: "not_exposed",
      provenance,
    },
  };
}

function createEvidenceAgentTerminal(request, mode = "completed") {
  const descriptor = { ...createEvidenceAgentDescriptor(true), schema_set_revision: f8SchemaRevision };
  const artifact = request.artifact_allow_list.find((entry) => entry.allowed_records.length > 0);
  const record = artifact?.allowed_records[0];
  const citation =
    artifact && record
      ? {
          schema_version: "tilesim.bridge.evidence_agent_citation.v1",
          run_id: request.run_id,
          artifact_id: artifact.artifact_id,
          schema_identity: artifact.schema_identity,
          sha256: artifact.sha256,
          json_pointer: record.json_pointer,
          subject: record.subject,
          citation_role: "direct_fact",
          availability: "available",
        }
      : null;
  const scope = request.snapshot_reference.evidence_scope;
  const claims = citation
    ? [
        {
          claim_id: `claim-${mode}`,
          claim_kind: "numeric_fact",
          text: "This atomic claim is bound to the exact verified fixture record.",
          citations: [citation],
          scope: {
            source_mode: scope.source_mode,
            requested_fidelity: scope.requested_fidelity,
            resolved_fidelity: scope.resolved_fidelity,
            execution_mode: scope.execution_mode,
            resource_semantics_relation: "S3_S4_S5_peer",
            causal_subsystems: ["S1", "S6"],
            attribution_semantics: "not_applicable",
            recommendation_semantics: "not_applicable",
          },
        },
      ]
    : [];
  const terminal = {
    schema_version: "tilesim.bridge.evidence_agent_response.v1",
    schema_set_revision: f8SchemaRevision,
    request_id: `agent-fixture-${mode}`,
    client_request_id: request.client_request_id,
    run_id: request.run_id,
    input_snapshot_digest: request.input_snapshot_digest,
    completion_state: mode,
    provider: descriptor.provider,
    revisions: descriptor.revisions,
    claims,
    refusal: null,
    partial: mode === "partial",
    truncated: mode === "truncated",
    degradation: { state: "none", reason_code: "none" },
    audit_summary: {
      operations: ["verified_snapshot_read", "citation_resolution"],
      tool_invocation_count: 2,
      hidden_reasoning_returned: false,
    },
    generated_at: "2026-08-31T00:00:00.000Z",
    persistence: {
      mode: "run_local_terminal_metadata_only",
      retained_until: null,
      snapshot_payload_retained: false,
      user_question_retained: false,
    },
    staleness: {
      state: mode === "stale" ? "stale" : "current_at_generation",
      binding_fields: ["run_id", "input_snapshot_digest", "schema_set_revision", "backend_identity"],
    },
  };
  if (mode === "stale") terminal.completion_state = "completed";
  const reasonByMode = {
    failed: "unsupported_schema",
    refused: "insufficient_evidence",
    provider_unavailable: "provider_unavailable",
    timeout: "timeout",
    cancelled: "cancelled",
  };
  if (reasonByMode[mode]) {
    terminal.completion_state = mode === "provider_unavailable" ? "refused" : mode;
    terminal.claims = [];
    terminal.refusal = {
      reason_code: reasonByMode[mode],
      detail: `fixture_${reasonByMode[mode]}`,
      retryable: ["provider_unavailable", "timeout"].includes(mode),
    };
    terminal.degradation = { state: reasonByMode[mode], reason_code: reasonByMode[mode] };
  }
  return terminal;
}

function addFormalF7Contracts(fixture) {
  const provenance = {
    source_mode: "synthetic_trace",
    calibration_level: "uncalibrated",
    allowed_claim_scope: "exploratory_s6_only",
  };
  const subject = (kind, id, identityKey) => ({ kind, id, [identityKey]: id });
  const reference = (pointer, kind, id, artifactId = "design-space") => ({
    run_id: runId,
    artifact_id: artifactId,
    schema_identity:
      artifactId === "input-topology" ? "tilesim.s6_topology_input.v1" : "tilesim.design_space_report.v1",
    json_pointer: pointer,
    availability: "available",
    subject: subject(
      kind,
      id,
      {
        candidate: "candidate_id",
        objective: "objective_id",
        executed_s6_knob: "knob_id",
        fabric_domain: "fabric_domain_id",
      }[kind],
    ),
  });
  const candidateId = "candidate-formal-f7";
  const candidateRef = reference("/candidates/0", "candidate", candidateId);
  fixture.reports.design_space = {
    schema_version: "tilesim.design_space_report.v1",
    contract_version: "tilesim.design_space_report.v1",
    run_id: runId,
    report_id: "design-space-formal-f7",
    execution_scope: "S6_only",
    candidate_source_mode: "synthetic_trace",
    candidate_calibration_level: "uncalibrated",
    candidate_allowed_claim_scope: "exploratory_s6_only",
    provenance,
    validation_lane: "synthetic_consistency",
    evidence_tier: "synthetic_consistency",
    claim_scope_summary: "Synthetic S6-only consistency; not held-out validation.",
    pareto_front_id: "pareto-formal-f7",
    objective_set_id: "objectives-formal-f7",
    candidate_count: 1,
    candidates: [
      {
        candidate_id: candidateId,
        requested_fidelity: "analytical",
        resolved_fidelity: "des",
        subject_refs: [subject("candidate", candidateId, "candidate_id")],
        evidence_refs: [candidateRef],
        navigation: {
          navigation_scope: "artifact_record",
          bridge_run_id: null,
          backend_run_instance_id: "backend-formal-f7",
          parent_run_id: runId,
          candidate_id: candidateId,
          record_ref: candidateRef,
        },
        pareto_front_id: "pareto-formal-f7",
        objective_set_id: "objectives-formal-f7",
        pareto_member: true,
        dominated_by_candidate_ids: [],
        dominates_candidate_ids: [],
        dominance_status: "non_dominated",
        dominance_reason_code: "no_candidate_strictly_dominates",
        objectives: [
          {
            objective_id: "p99_latency",
            metric_kind: "p99_latency",
            direction: "minimize",
            value: 12.5,
            unit: "us",
            availability: "available",
            evidence_ref: reference("/candidates/0/objectives/0", "objective", `${candidateId}::p99_latency`),
          },
          {
            objective_id: "throughput",
            metric_kind: "throughput",
            direction: "maximize",
            value: 128,
            unit: "requests_per_second",
            availability: "available",
            evidence_ref: reference("/candidates/0/objectives/1", "objective", `${candidateId}::throughput`),
          },
        ],
        executed_s6_knobs: [
          {
            knob_id: "release_interval",
            subsystem: "S6",
            value_type: "uint64",
            value: "9007199254740993",
            unit: "ps",
            availability: "available",
            requested_value: "9007199254740993",
            resolved_value: "9007199254740993",
            source_ref: reference(
              "/candidates/0/executed_s6_knobs/0/requested_value",
              "executed_s6_knob",
              `${candidateId}::release_interval`,
            ),
            evidence_ref: reference(
              "/candidates/0/executed_s6_knobs/0/resolved_value",
              "executed_s6_knob",
              `${candidateId}::release_interval`,
            ),
          },
        ],
      },
    ],
  };
  fixture.inputs.topology = {
    schema_version: "tilesim.s6_topology_input.v1",
    run_id: runId,
    provenance,
    topology: {
      topology_name: "formal-f7-topology",
      devices: [{ device_id: "gpu-0" }],
      module_bindings: [{ module_id: "fabric-0" }],
      domains: [
        {
          domain_id: "scale-up",
          domain_type: "scale_up",
          domain_kind: "scale_up",
          subject: subject("fabric_domain", "scale-up", "fabric_domain_id"),
          json_pointer: "/topology/domains/0",
          provenance,
          member_devices: ["gpu-0"],
          module_binding: "fabric-0",
        },
      ],
    },
  };
  fixture.reports.metrics.system_summary.fabric_domain_utilization[0].topology_domain_ref = reference(
    "/topology/domains/0",
    "fabric_domain",
    "scale-up",
    "input-topology",
  );
}

async function installFixtureApi(page, fixture, { evidenceAgentConfigured = false, evidenceAgentHandler = null } = {}) {
  let week7OperationActive = false;
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let payload;
    const week7Payload = {
      "/api/week7/evidence-map": week7EvidenceMap,
      "/api/week7/calibration-example": week7Calibration,
      "/api/week7/orchestration-example": week7Orchestration,
    }[path];
    if (week7Payload) {
      if (week7OperationActive) {
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({
            schema_version: "tilesim.bridge.error.v1",
            error: {
              code: "week7_capacity_reached",
              message: "Another Week 7 evidence operation is active.",
              field_path: null,
              retryable: true,
            },
            request_id: "fixture-week7-capacity",
          }),
        });
        return;
      }
      week7OperationActive = true;
      try {
        await new Promise((resolve) => setTimeout(resolve, 25));
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(week7Payload) });
      } finally {
        week7OperationActive = false;
      }
      return;
    }
    if (path === "/api/manifest") {
      payload = {
        schema_version: "tilesim.bridge.manifest.v1",
        api_version: "tilesim.bridge.api.v1",
        schema_set_revision: f8SchemaRevision,
        error_schema_version: "tilesim.bridge.error.v1",
        artifact_manifest_schema_version: "tilesim.bridge.artifact_manifest.v2",
        known_report_schema_identities: {},
        experiment_descriptor: {
          endpoint: "GET /api/experiment-schema",
          schema_identity: "tilesim.bridge.experiment_descriptor.v1",
          create_run_schema_identity: "tilesim.bridge.create_run_request.v1",
        },
        evidence_agent: {
          capability_endpoint: "GET /api/agent/evidence-capabilities",
          analysis_endpoint: "POST /api/runs/{run_id}/agent/evidence-analyses",
          descriptor_schema_identity: "tilesim.bridge.evidence_agent_descriptor.v2",
          descriptor_revision: f9DescriptorRevision,
          request_schema_identity: "tilesim.bridge.evidence_agent_request.v1",
          response_schema_identity: "tilesim.bridge.evidence_agent_response.v1",
          citation_schema_identity: "tilesim.bridge.evidence_agent_citation.v1",
          snapshot_reference_schema_identity: "tilesim.bridge.evidence_snapshot_reference.v1",
          structured_report_schema_identity: "tilesim.web.structured-performance-report.v2",
          idempotency_header: "Idempotency-Key",
          execution_mode: "synchronous_terminal",
        },
        endpoints: {},
        run_creation: {
          idempotency_header: "Idempotency-Key",
          idempotency_required: true,
          payload_identity: "canonical_json_sha256",
        },
        run_events: {
          endpoint: "GET /api/runs/{run_id}/events",
          media_type: "text/event-stream",
          resume_header: "Last-Event-ID",
          event_ids: { active: "1", terminal: "2" },
        },
      };
    } else if (path === "/api/health") {
      payload = {
        cli_available: true,
        execution_ready: true,
        versions_match: true,
        state_digests_match: true,
        source_revision: "fixture-source",
        build_revision: "fixture-source",
        source_state_digest: "fixture-source-state",
        build_state_digest: "fixture-source-state",
        deployment_ref: "fixture:f1",
      };
    } else if (path === "/api/catalog") {
      payload = {
        scenarios: [{ scenario_id: "s1_des_example", label: "S1 → S6 synthetic runtime example" }],
        fidelity_policies: ["des", "default"],
        input_modes: ["controls", "json"],
        design_space_modes: ["built_in_synthetic", "strict_s6_manifest"],
        gpu_participation_modes: ["gpu_free"],
      };
    } else if (path === "/api/capabilities") {
      payload = f8Capabilities;
    } else if (path === "/api/experiment-schema") {
      payload = createF8ExperimentDescriptor();
    } else if (path === "/api/agent/evidence-capabilities") {
      payload = { ...createEvidenceAgentDescriptor(evidenceAgentConfigured), schema_set_revision: f8SchemaRevision };
    } else if (
      path === `/api/runs/${runId}/agent/evidence-analyses` &&
      route.request().method() === "POST" &&
      evidenceAgentHandler
    ) {
      const result = await evidenceAgentHandler({
        request: route.request().postDataJSON(),
        idempotencyKey: route.request().headers()["idempotency-key"],
      });
      await route.fulfill({
        status: result.status,
        contentType: "application/json",
        headers: { "X-TileSim-Schema-Set-Revision": f8SchemaRevision },
        body: JSON.stringify(result.body),
      });
      return;
    } else if (path === "/api/runs") {
      payload = {
        runs: [
          {
            run_id: runId,
            run_name: fixture.id,
            status: "completed",
            input_mode: "fixture",
            created_at: "2026-08-27T00:00:00Z",
          },
        ],
      };
    } else if (path === `/api/runs/${runId}/reports`) {
      payload = { run_id: runId, reports: fixture.reports };
    } else if (path === `/api/runs/${runId}/artifacts`) {
      payload = {
        schema_version: "tilesim.bridge.artifact_manifest.v2",
        api_version: "tilesim.bridge.api.v1",
        schema_set_revision: f8SchemaRevision,
        run_id: runId,
        artifacts: artifactManifestEntries(fixture),
        rejected_artifacts: [],
      };
    } else if (path.startsWith(`/api/runs/${runId}/files/`)) {
      const artifact = decodeURIComponent(path.slice(`/api/runs/${runId}/files/`.length));
      payload = artifactFor(fixture, artifact);
      if (payload === undefined || payload === null) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "missing" }),
        });
        return;
      }
    } else {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "unknown" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: ["/api/experiment-schema", "/api/agent/evidence-capabilities"].includes(path)
        ? { "X-TileSim-Schema-Set-Revision": f8SchemaRevision }
        : {},
      body: JSON.stringify(payload),
    });
  });
}

async function openFixture(page, fixture, view = "execution", apiOptions = {}) {
  const browserFailures = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      browserFailures.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => browserFailures.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 500 && !apiOptions.expectedHttpStatuses?.includes(response.status())) {
      browserFailures.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  await installFixtureApi(page, fixture, apiOptions);
  await page.addInitScript(
    ({ id, initialView }) => {
      localStorage.setItem(
        "tilesim-web.dashboard-state.v2",
        JSON.stringify({ view: initialView, runId: id, comparisonIds: [] }),
      );
    },
    { id: runId, initialView: view },
  );
  const path =
    view === "design_space"
      ? "design-space"
      : view === "evidence_lab"
        ? "evidence-lab"
        : view === "evidence_agent"
          ? "evidence-agent"
          : view;
  await page.goto(`/${path}?run=${runId}`, { waitUntil: "domcontentloaded" });
  return browserFailures;
}

async function expectNoUnexpectedTextOverflow(page) {
  const offenders = await page.locator("body *").evaluateAll((elements) =>
    elements
      .filter((element) => {
        if (!(element instanceof HTMLElement) || element.clientWidth === 0) return false;
        if (element.matches("pre, select, .artifact-line-pointer") || element.closest("pre")) return false;
        let scrollContainer = element.parentElement;
        while (scrollContainer && scrollContainer !== document.body) {
          if (["auto", "scroll"].includes(getComputedStyle(scrollContainer).overflowX)) return false;
          scrollContainer = scrollContainer.parentElement;
        }
        const style = getComputedStyle(element);
        if (style.clip !== "auto") return false;
        if (["auto", "scroll"].includes(style.overflowX)) return false;
        return element.scrollWidth > element.clientWidth + 1;
      })
      .slice(0, 20)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: element.className,
        text: element.textContent.trim().slice(0, 100),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      })),
  );
  expect(offenders).toEqual([]);
}

test("synthetic evidence view is stable, accessible, and field-complete", async ({ page }, testInfo) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture);
  await expect(page.getByRole("heading", { name: "S0–S6 分层结果" })).toBeVisible();
  await expect(page.locator(".flow-node")).toHaveCount(7);
  await expect(page.locator(".execution-current-selection")).toContainText("S1");
  await expect(page.locator(".run-bound-evidence-panel")).toHaveCount(0);
  await expect(page.locator(".stage-list li")).toHaveCount(3);
  await expect(page.locator('.visualization-panel[data-chart-kind="bar"] .execution-chart svg')).toBeVisible();
  await page.locator(".flow-node").filter({ hasText: "S5" }).click();
  await expect(page.locator(".execution-current-selection")).toContainText("S5");
  await expect(page.locator(".flow-node").filter({ hasText: "S5" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#execution-layer-detail .layer-code")).toHaveText("S5");
  await expect(page.locator('.visualization-panel[data-chart-kind="stacked-bar"] .execution-chart svg')).toBeVisible();
  await expect(
    page.locator('.visualization-panel[data-chart-kind="stacked-bar"] .visualization-rationale'),
  ).toContainText("堆叠");
  await page.locator(".flow-node--fabric").click();
  await expect(page.locator(".layer-visualizations .visualization-panel")).toHaveCount(2);
  await expect(page.locator(".layer-visualizations .visualization-empty")).toHaveCount(0);
  await expect(page.locator(".visualization-panel > footer").first()).toContainText("request_fabric_contributions");
  await expect(page.locator(".evidence-warning")).toContainText("证据边界受限");
  await expect(page.locator(".evidence-warning")).toHaveAttribute("aria-label", /当前结论不能替代真实留出验证/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );

  await page.locator(".json-artifact-panel").evaluate((element) => (element.open = true));
  await page.locator(".json-artifact-panel select").selectOption("metrics");
  await expect(page.locator(".json-artifact-meta")).toContainText("Worker 已索引");
  await page.locator(".json-artifact-panel select").evaluate((select) => {
    select.value = "validation";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    select.value = "metrics";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator(".artifact-line-text").filter({ hasText: "device_latency_us" }).first()).toBeVisible();
  await page.locator(".json-search-field input").fill("device_latency_us");
  await expect(page.locator(".artifact-line-text").filter({ hasText: "device_latency_us" }).first()).toBeVisible();
  await expect(page.locator(".json-artifact-meta")).toContainText("个匹配行");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);

  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  expect(browserFailures).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot(`synthetic-evidence-${testInfo.project.name}.png`, { fullPage: true });
});

test("desktop routes preserve run deep links and browser history", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "execution");
  await expect(page).toHaveURL(new RegExp(`/execution\\?run=${runId}$`));
  await page.getByRole("button", { name: /性能指标/ }).click();
  await expect(page).toHaveURL(new RegExp(`/metrics\\?run=${runId}$`));
  await expect(page.getByRole("heading", { name: "请求级结果" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/execution\\?run=${runId}$`));
  await expect(page.getByRole("heading", { name: "S0–S6 分层结果" })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`/execution\\?run=${runId}$`));
  await expect(page.getByRole("heading", { name: "S0–S6 分层结果" })).toBeVisible();
  expect(browserFailures).toEqual([]);
});

test("F6B request evidence stays run-bound across peer resources and S7-S9 pages", async ({ page }, testInfo) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const longRequestId = `req-${"长请求-LongRequest-".repeat(18)}`;
  fixture.inputs.runtime_trace.requests[0].request_id = longRequestId;
  fixture.reports.metrics.request_metrics[0].request_id = longRequestId;
  fixture.reports.metrics.system_summary.request_fabric_contributions[0].request_id = longRequestId;
  fixture.reports.metrics.system_summary.phase_fabric_contributions.forEach((phase) => {
    phase.request_id = longRequestId;
  });
  fixture.reports.tail.explained_entity.id = longRequestId;
  addWeek8Contracts(fixture, longRequestId);
  const browserFailures = await openFixture(page, fixture, "attribution");

  const panel = page.locator(".run-bound-evidence-panel");
  await expect(panel.getByRole("heading", { name: "请求级跨子系统证据链" })).toBeVisible();
  await expect(panel.locator("select")).toHaveValue(longRequestId);
  await expect.poll(() => new URL(page.url()).searchParams.get("evidence_request")).toBe(longRequestId);
  await expect(panel.locator(".run-bound-peer-group .run-bound-node")).toHaveCount(3);
  await expect(panel.locator(".run-bound-peer-group .run-bound-node").nth(0)).toContainText("S3");
  await expect(panel.locator(".run-bound-peer-group .run-bound-node").nth(1)).toContainText("S4");
  await expect(panel.locator(".run-bound-peer-group .run-bound-node").nth(2)).toContainText("S5");
  await expect(panel.locator(".run-bound-output-node").filter({ hasText: "S7" })).toContainText("已绑定");
  await expect(panel.locator(".run-bound-output-node").filter({ hasText: "S8" })).toContainText("已绑定");
  await expect(panel.locator(".run-bound-output-node").filter({ hasText: "S9" })).toContainText("已绑定");
  await expect(panel.locator(".week8-execution-panel")).toContainText("执行详情");
  await panel.locator(".week8-execution-panel summary").click();
  await expect(panel.locator(".week8-execution-panel")).toContainText("partitioned_des");
  await expect(panel.locator(".week8-execution-panel")).toContainText("synthetic_trace");
  await panel.locator(".week8-execution-panel summary").click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot(`request-evidence-${testInfo.project.name}.png`, { fullPage: true });

  await panel.getByRole("link", { name: "分层结果" }).click();
  await expect(page).toHaveURL(/\/execution\?/);
  expect(new URL(page.url()).searchParams.get("run")).toBe(runId);
  expect(new URL(page.url()).searchParams.get("evidence_request")).toBe(longRequestId);
  await expect(page.locator(".run-bound-evidence-panel")).toHaveCount(0);

  await page.getByRole("button", { name: /^性能指标$/ }).click();
  await expect(page.locator(".run-bound-evidence-panel")).toHaveCount(0);
  await page.getByRole("button", { name: /^验证边界$/ }).click();
  await expect(page.locator(".run-bound-evidence-panel")).toHaveCount(0);
  await page.getByRole("button", { name: /^请求证据$/ }).click();
  await expect(page.locator(".run-bound-evidence-panel")).toHaveCount(1);
  await expect(page.locator(".run-bound-evidence-panel select")).toHaveValue(longRequestId);

  await page.locator(".run-bound-evidence-panel select").focus();
  await expect(page.locator(".run-bound-evidence-panel select")).toBeFocused();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);

  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.getByRole("heading", { name: "Request-bound cross-subsystem evidence chain" })).toBeVisible();
  await expectNoUnexpectedTextOverflow(page);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".run-bound-evidence-panel select")).toHaveValue(longRequestId);
  expect(
    await page
      .locator(".run-bound-page-links a")
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration)),
  ).toBeLessThanOrEqual(0.001);
  expect(browserFailures).toEqual([]);
});

test("F9B read-only Agent exposes formal provider unavailability without mock claims", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addWeek8Contracts(fixture, "req-0");
  const browserFailures = await openFixture(page, fixture, "evidence_agent");

  await expect(page.getByRole("heading", { name: "只读证据 Agent" })).toBeVisible();
  await expect(page.locator(".evidence-agent-unavailable")).toContainText("provider_unavailable");
  await expect(page.getByRole("button", { name: "生成证据草稿" })).toBeDisabled();
  await expect(page.locator(".evidence-agent-claims > li")).toHaveCount(0);
  await expect(page.locator(".evidence-agent-policy-disclosure")).not.toHaveAttribute("open", "");
  await page.locator(".evidence-agent-policy-disclosure > summary").click();
  await expect(page.locator(".evidence-agent-policy-disclosure")).toHaveAttribute("open", "");
  await expect(page.locator(".evidence-agent-identity-grid")).toContainText(
    "tilesim.bridge.evidence_agent_descriptor.v2",
  );
  await expect(page.locator(".evidence-agent-contract-grid")).toContainText("redacted_terminal_metadata_only");
  await expect(page.locator(".evidence-agent-contract-grid")).toContainText("terminal_result_not_retained");
  await expect(page.locator(".evidence-agent-contract-grid")).toContainText("forbidden");
  await expect(page.locator(".evidence-agent-contract-grid")).toContainText("verified_snapshot_read");
  await expect(page.locator(".evidence-agent-contract-grid")).toContainText("S3 · S4 · S5");
  await expect(page.locator(".evidence-agent-contract-grid")).toContainText("S8 · S9");
  await expect(page.locator(".evidence-agent-retention-list li")).toHaveCount(7);
  await expect(page.locator(".evidence-agent-retention-list li")).toHaveText([
    /用户问题.*禁止留存/,
    /snapshot payload.*禁止留存/,
    /artifact payload.*禁止留存/,
    /Provider raw response.*禁止留存/,
    /validated model claims.*禁止留存/,
    /credential.*禁止留存/,
    /hidden reasoning.*禁止留存/,
  ]);
  await expect(page.locator(".evidence-agent-terminal-list li")).toHaveCount(5);
  for (const status of ["HTTP 409", "HTTP 502", "HTTP 503", "HTTP 504"]) {
    await expect(page.locator(".evidence-agent-terminal-list")).toContainText(status);
  }
  await expect(page.locator(".evidence-agent-terminal-list")).toContainText("tilesim.bridge.error.v1");
  await expect(page.locator(".evidence-agent-terminal-list")).toContainText(
    "tilesim.bridge.evidence_agent_response.v1",
  );
  await expect(page.locator(".evidence-agent-terminal-list")).toContainText("field_path=/headers/Idempotency-Key");
  await expect(page.locator(".evidence-agent-terminal-list")).toContainText("retryable=false");
  await expect(page.locator(".evidence-agent-terminal-list")).toContainText(
    "completion_state=refused · reason_code=provider_unavailable",
  );
  const requestSelect = page.locator(".evidence-agent-compose select").first();
  await requestSelect.focus();
  await expect(requestSelect).toBeFocused();
  await requestSelect.selectOption("req-0");
  await expect(requestSelect).toHaveValue("req-0");
  await expect.poll(() => new URL(page.url()).searchParams.get("evidence_request")).toBe("req-0");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );

  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.getByRole("heading", { name: "Read-only evidence Agent" })).toBeVisible();
  await expect(page.locator(".evidence-agent-unavailable")).toContainText("provider_unavailable");
  await expect(page.getByText("Replay and terminal recovery", { exact: true })).toBeVisible();
  await expect(
    page.locator(".evidence-agent-contract-grid").getByText("Metadata-only retention", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Formal HTTP terminals", { exact: true })).toBeVisible();
  await expect(page.getByText("Provider unavailable", { exact: true })).toBeVisible();
  await expect(page.locator(".evidence-agent-retention-list li").first()).toContainText("Retention prohibited");
  await expectNoUnexpectedTextOverflow(page);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "domcontentloaded" });
  expect(
    await page
      .locator(".evidence-agent-contract-card")
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration)),
  ).toBeLessThanOrEqual(0.001);
  expect(browserFailures).toEqual([]);
});

test("Evidence Agent validates citations, terminal states, stale isolation, and recovery boundaries", async ({
  page,
}) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addWeek8Contracts(fixture, "req-0");
  const submissions = [];
  const browserFailures = await openFixture(page, fixture, "evidence_agent", {
    evidenceAgentConfigured: true,
    expectedHttpStatuses: [409, 502, 503, 504],
    evidenceAgentHandler: async ({ request, idempotencyKey }) => {
      const mode = request.user_question.content;
      submissions.push({ mode, idempotencyKey });
      if (mode === "recovery") {
        return {
          status: 409,
          body: {
            schema_version: "tilesim.bridge.error.v1",
            error: {
              code: "terminal_result_not_retained",
              message: "The prior claims terminal was intentionally not retained.",
              field_path: "/headers/Idempotency-Key",
              retryable: false,
            },
            request_id: "fixture-terminal-result-not-retained",
          },
        };
      }
      if (mode === "server-mismatch") {
        return {
          status: 409,
          body: {
            schema_version: "tilesim.bridge.error.v1",
            error: {
              code: "idempotency_payload_mismatch",
              message: "The key is already bound to a different canonical payload.",
              field_path: "/headers/Idempotency-Key",
              retryable: false,
            },
            request_id: "fixture-idempotency-payload-mismatch",
          },
        };
      }
      const status = { failed: 502, provider_unavailable: 503, timeout: 504 }[mode] || 200;
      return { status, body: createEvidenceAgentTerminal(request, mode) };
    },
  });

  await page.locator(".evidence-agent-compose select").first().selectOption("req-0");
  const question = page.locator(".evidence-agent-question textarea");
  const submit = page.getByRole("button", { name: "生成证据草稿" });

  await question.fill("completed");
  await submit.click();
  await expect(page.locator(".evidence-agent-state").last()).toHaveText("待确认草稿");
  await expect(page.locator(".evidence-agent-claims > li")).toHaveCount(1);
  await expect(page.locator(".evidence-agent-citations a")).toHaveAttribute("href", /evidence_pointer=(%2F|\/)/);
  const completedSubmission = submissions.at(-1);
  await submit.click();
  await expect.poll(() => submissions.filter((entry) => entry.mode === "completed").length).toBe(2);
  expect(submissions.at(-1).idempotencyKey).toBe(completedSubmission.idempotencyKey);
  const completedReplayCount = submissions.length;
  await question.fill("different canonical payload");
  await submit.click();
  await expect(page.getByText("幂等键已绑定到不同载荷")).toBeVisible();
  await expect(submit).toBeDisabled();
  expect(submissions).toHaveLength(completedReplayCount);
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(sessionStorage.getItem("tilesim-web.evidence-agent-submission.v1") || "null")),
    )
    .toMatchObject({ idempotencyKey: completedSubmission.idempotencyKey });
  await page.getByRole("button", { name: "明确放弃旧分析并开始新分析" }).click();

  await question.fill("stale");
  await submit.click();
  await expect(page.getByText("结果与当前证据绑定不再匹配")).toBeVisible();
  await expect(page.locator(".evidence-agent-claims > li")).toHaveCount(0);
  await expect(submit).toBeDisabled();
  await page.getByRole("button", { name: "明确放弃当前分析并开始新分析" }).click();

  for (const [mode, label] of [
    ["partial", "部分结果"],
    ["truncated", "输出已截断"],
    ["failed", "Provider 响应失败"],
    ["provider_unavailable", "Provider 未配置"],
    ["timeout", "请求超时"],
  ]) {
    await question.fill(mode);
    await submit.click();
    await expect(page.locator(".evidence-agent-state").last()).toHaveText(label);
    await page.getByRole("button", { name: "明确放弃当前分析并开始新分析" }).click();
  }

  await question.fill("recovery");
  await submit.click();
  await expect(page.getByText("无法恢复先前的 claims 终态")).toBeVisible();
  await expect(page.locator(".evidence-agent-unavailable code")).toHaveText("terminal_result_not_retained");
  await expect(submit).toBeDisabled();
  const recoverySubmission = submissions.at(-1);
  expect(recoverySubmission.mode).toBe("recovery");
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(sessionStorage.getItem("tilesim-web.evidence-agent-submission.v1") || "null")),
    )
    .toMatchObject({ idempotencyKey: recoverySubmission.idempotencyKey });
  await page.waitForTimeout(150);
  expect(submissions.filter((entry) => entry.mode === "recovery")).toHaveLength(1);

  await page.getByRole("button", { name: "明确放弃该终态并开始新分析" }).click();
  await expect(submit).toBeEnabled();
  await expect(page.getByText("无法恢复先前的 claims 终态")).toHaveCount(0);

  await question.fill("server-mismatch");
  await submit.click();
  await expect(page.getByText("幂等键已绑定到不同载荷")).toBeVisible();
  await expect(page.locator(".evidence-agent-unavailable code")).toHaveText("idempotency_payload_mismatch");
  await expect(submit).toBeDisabled();
  const serverMismatchSubmission = submissions.at(-1);
  expect(serverMismatchSubmission.mode).toBe("server-mismatch");
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(sessionStorage.getItem("tilesim-web.evidence-agent-submission.v1") || "null")),
    )
    .toMatchObject({ idempotencyKey: serverMismatchSubmission.idempotencyKey });
  await page.waitForTimeout(150);
  expect(submissions.filter((entry) => entry.mode === "server-mismatch")).toHaveLength(1);
  await page.getByRole("button", { name: "明确放弃旧分析并开始新分析" }).click();
  await expect(submit).toBeEnabled();
  await expect(page.getByText("幂等键已绑定到不同载荷")).toHaveCount(0);
  expect(browserFailures).toEqual([]);
});

test("Week 7 evidence chain exposes calibration, lineage, and deterministic orchestration", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "execution");

  await page.getByRole("button", { name: /校准与血缘/ }).click();
  await expect(page).toHaveURL(/\/evidence-lab$/);
  await expect(page.getByRole("heading", { name: "离线校准工作流" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "报告字段证据血缘" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "固定工具调用编排" })).toBeVisible();
  await expect(page.locator(".week7-section").first()).not.toHaveAttribute("open", "");
  await page.locator(".week7-section").first().locator(":scope > summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".week7-timeline li")).toHaveCount(5);
  await expect(page.getByText("offline_fixture_consistency")).toBeVisible();
  await expect(page.getByText("workflow_consistency_only")).toBeVisible();
  await page.locator(".week7-section").nth(2).locator(":scope > summary").click();
  await expect(page.getByText("partial", { exact: true })).toBeVisible();
  await expect(page.getByText("H100")).toBeVisible();
  await expectNoUnexpectedTextOverflow(page);

  await page.getByRole("button", { name: /性能指标/ }).click();
  await expect(page).toHaveURL(new RegExp(`/metrics\\?run=${runId}$`));
  await expect(page.getByRole("heading", { name: "请求级结果" })).toBeVisible();
  await page.getByRole("button", { name: /校准与血缘/ }).click();
  await expect(page).toHaveURL(/\/evidence-lab$/);
  await expect(page.getByRole("heading", { name: "离线校准工作流" })).toBeVisible();

  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.getByRole("heading", { name: "Offline calibration workflow" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Report-field evidence lineage" })).toBeVisible();
  await expectNoUnexpectedTextOverflow(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/evidence-lab$/);
  await expect(page.getByRole("heading", { name: "Fixed tool-call orchestration" })).toBeVisible();
  expect(browserFailures).toEqual([]);
});

test("disconnected deep links never claim that an unavailable run is loaded", async ({ page }) => {
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, (route) => route.abort("connectionrefused"));
  await page.goto("/execution?run=run-unavailable", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("alert")).toContainText("run-unavailable");
  await expect(page.getByRole("alert")).toContainText("没有展示");
  await expect(page.locator(".evidence-identity strong")).not.toContainText("run-unavailable");
});

test("overview exposes only artifacts present in the trusted manifest", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const expected = artifactManifestEntries(fixture);
  await openFixture(page, fixture, "overview");
  await page.locator(".artifact-disclosure summary").click();

  await expect(page.locator(".artifact-disclosure .artifact-link")).toHaveCount(expected.length);
  await expect(page.locator('.artifact-link[href*="/files/metadata"]')).toHaveCount(0);
  await expect(page.locator('.artifact-link[href*="/files/design-space"]')).toHaveCount(1);
});

test("hash-bound evidence links locate JSON Pointers and survive reload", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "metrics");
  const evidenceLink = page.getByRole("link", { name: "吞吐证据" });
  await expect(evidenceLink).toBeVisible();
  await expectNoUnexpectedTextOverflow(page);
  await evidenceLink.click();

  await expect(page).toHaveURL(/\/execution\?run=run-fixture-f1&evidence_artifact=metrics/);
  await expect(page.locator(".json-artifact-panel")).toHaveAttribute("open", "");
  await expect(page.locator(".artifact-evidence-target")).toContainText("/summary/throughput_requests_per_second");
  await expect(page.locator(".artifact-virtual-line--active")).toContainText("throughput_requests_per_second");

  await page.goBack();
  await expect(page).toHaveURL(/\/metrics\?run=run-fixture-f1$/);
  await page.goForward();
  await expect(page.locator(".artifact-evidence-target")).toContainText("/summary/throughput_requests_per_second");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".artifact-evidence-target")).toContainText("/summary/throughput_requests_per_second");
  await expect(page.locator(".artifact-virtual-line--active")).toContainText("throughput_requests_per_second");

  await page.getByRole("button", { name: /验证边界/ }).click();
  await expect(page.locator(".validation-disclosure").first()).not.toHaveAttribute("open", "");
  await page.locator(".validation-disclosure").filter({ hasText: "验证检查" }).locator("summary").click();
  await expect(page.locator(".check-row .artifact-evidence-link").first()).toBeVisible();
  await expectNoUnexpectedTextOverflow(page);
  await page.getByRole("button", { name: /请求证据/ }).click();
  await page.getByRole("button", { name: "S9 尾延迟归因" }).click();
  await expect(page.locator(".ranking-row .artifact-evidence-link")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "归因守恒与传播审计" })).toBeVisible();
  await expect(page.locator(".attribution-audit")).toContainText("partial_attribution");
  await expect(page.locator(".attribution-audit")).toContainText("required_propagation_node_missing_or_unresolved");
  await expectNoUnexpectedTextOverflow(page);

  await page.goto(
    "/execution?run=run-fixture-f1&evidence_artifact=metrics&evidence_sha=" +
      "b".repeat(64) +
      "&evidence_pointer=%2Fsummary%2Fthroughput_requests_per_second",
  );
  await expect(page.locator(".json-artifact-empty--error")).toContainText("SHA-256");
  expect(browserFailures).toEqual([]);
});

test("a missing evidence Pointer remains visible as a persistent error", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const metrics = artifactManifestEntries(fixture).find((entry) => entry.artifact_id === "metrics");
  await installFixtureApi(page, fixture);
  await page.goto(
    `/execution?run=${runId}&evidence_artifact=metrics&evidence_sha=${metrics.sha256}&evidence_pointer=%2Fnot-present`,
  );

  await expect(page.locator(".json-artifact-alert")).toContainText("/not-present");
  await expect(page.locator(".artifact-virtual-viewer")).toBeVisible();
});

test("Week 6 design space exposes complete candidate evidence without desktop overflow", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "design_space");
  await expect(page.getByRole("heading", { name: "候选排名与选择性 DES" })).toBeVisible();
  await expect(page.locator(".candidate-detail")).toHaveCount(1);
  await expect(page.locator(".candidate-detail").first()).toContainText("fixture-manifest#candidate-0");
  await expect(page.locator(".candidate-detail").first()).toContainText("single_deterministic_run");
  await expect(page.locator(".candidate-attribution")).toContainText("Only S6 Fabric parameters are executed.");
  await expect(page.getByRole("heading", { name: "Fabric 与设计空间契约状态" })).toBeVisible();
  await expect(page.locator(".f7-capability-grid")).toContainText("Pareto membership");
  await expect(page.locator(".f7-capability-grid")).toContainText("contract gap");
  await expect(page.locator(".candidate-opaque-warning")).toContainText("不是可导航 EvidenceRef");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  expect(browserFailures).toEqual([]);
});

test("F7 formal contract exposes Pareto, artifact-record, knob, and topology evidence", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addFormalF7Contracts(fixture);
  const browserFailures = await openFixture(page, fixture, "design_space");
  await expect(page.getByRole("heading", { name: "Pareto 与 artifact-record 证据" })).toBeVisible();
  await expect(page.locator(".f7-formal-summary")).toContainText("pareto-formal-f7");
  await expect(page.locator(".candidate-detail").first()).toContainText("backend-formal-f7");
  await expect(page.locator(".candidate-detail").first()).toContainText("9,007,199,254,740,993 ps");
  const candidateTargets = await page
    .locator(".candidate-detail a.artifact-evidence-link")
    .evaluateAll((links) => links.map((link) => new URL(link.href).searchParams.get("evidence_pointer")));
  expect(candidateTargets).toContain("/candidates/0");
  expect(candidateTargets).toContain("/candidates/0/objectives/0");
  expect(candidateTargets).toContain("/candidates/0/executed_s6_knobs/0/requested_value");
  expect(candidateTargets).toContain("/candidates/0/executed_s6_knobs/0/resolved_value");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  const designAxe = await new AxeBuilder({ page }).analyze();
  expect(designAxe.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);

  await page.goto(`/fabric?run=${runId}`);
  await expect(page.locator(".fabric-topology-gap")).toContainText("正式契约已验证");
  await expect(page.locator(".domain-topology-contract")).toContainText("gpu-0");
  const topologyTarget = await page
    .locator(".domain-topology-contract a.artifact-evidence-link")
    .first()
    .getAttribute("href");
  expect(new URL(topologyTarget, "http://tilesim.local").searchParams.get("evidence_pointer")).toBe(
    "/topology/domains/0",
  );
  await expectNoUnexpectedTextOverflow(page);
  expect(browserFailures).toEqual([]);
});

test("F7 Fabric view preserves backend order and exact metrics evidence", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addWeek8Contracts(fixture, "req-0");
  const browserFailures = await openFixture(page, fixture, "fabric");
  await expect(page.getByRole("heading", { name: "后端报告的主导 Fabric 热点" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "请求级 Fabric contribution" })).toBeVisible();
  await expect(page.locator(".fabric-contract-strip")).not.toHaveAttribute("open", "");
  await expect(page.locator(".fabric-domain-disclosure")).not.toHaveAttribute("open", "");
  await page.locator(".fabric-domain-disclosure summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".fabric-domain-disclosure")).toHaveAttribute("open", "");
  await page.keyboard.press("Enter");
  const requestRow = page.locator(".fabric-request-table tbody tr").first();
  await expect(requestRow).toContainText("req-0");
  await expect(requestRow).toContainText("phase-0");
  await expect(requestRow).toContainText("collective-0");
  const targets = await requestRow.locator("a.artifact-evidence-link").evaluateAll((links) =>
    links.map((link) => {
      const url = new URL(link.href);
      return {
        artifact: url.searchParams.get("evidence_artifact"),
        pointer: url.searchParams.get("evidence_pointer"),
        sha: url.searchParams.get("evidence_sha"),
      };
    }),
  );
  expect(targets.map(({ artifact, pointer }) => ({ artifact, pointer }))).toEqual([
    { artifact: "metrics", pointer: "/system_summary/request_fabric_contributions/0" },
    { artifact: "metrics", pointer: "/system_summary/phase_fabric_contributions/0" },
  ]);
  expect(targets.every(({ sha }) => /^[a-f0-9]{64}$/.test(sha || ""))).toBe(true);
  expect(new Set(targets.map(({ sha }) => sha)).size).toBe(1);
  await expect(page.locator(".fabric-topology-gap")).toContainText("artifact_identity_missing");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);
  expect(browserFailures).toEqual([]);
});

test("language switch updates the desktop workspace and survives reload", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "execution");
  await expect(page.getByRole("heading", { name: "S0–S6 分层结果" })).toBeVisible();

  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.getByRole("heading", { name: "S0–S6 layered results" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Switch to Chinese" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: /Performance metrics/ }).click();
  await expect(page.getByRole("heading", { name: "Per-request results" })).toBeVisible();
  await page.getByRole("button", { name: /Validation boundary/ }).click();
  await expect(page.getByRole("heading", { name: "Resolved fidelity by subsystem" })).toBeVisible();
  await page.locator(".new-run-button").click();
  await expect(page.getByRole("heading", { name: "Review and run" })).toBeVisible();
  await page.getByRole("button", { name: /Layered results/ }).click();
  await expect(page.getByRole("heading", { name: "S0–S6 layered results" })).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "S0–S6 layered results" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expectNoUnexpectedTextOverflow(page);

  await page.getByRole("button", { name: "Switch to Chinese" }).click();
  await expect(page.getByRole("heading", { name: "S0–S6 分层结果" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  expect(browserFailures).toEqual([]);
});

test("light blue theme is the desktop default and the theme choice survives reload", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "experiment");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "blue");
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "light");
  await expect(page.getByRole("button", { name: "切换到深色模式" })).toBeVisible();
  await expect(page.getByRole("button", { name: "选择界面主题，当前：晴空蓝" })).toBeVisible();
  expect(
    await page.locator("html").evaluate((element) => getComputedStyle(element).getPropertyValue("--canvas").trim()),
  ).toBe("#f8fbff");
  await expect(page.locator(".capability-panel")).toBeVisible();
  await expectNoUnexpectedTextOverflow(page);

  const spacing = await page.locator(".capability-panel").evaluate((panel) => {
    const grid = panel.querySelector(".capability-grid");
    const identity = panel.querySelector(".backend-identity-panel");
    const panelBox = panel.getBoundingClientRect();
    const gridBox = grid.getBoundingClientRect();
    const identityBox = identity.getBoundingClientRect();
    return {
      gridInset: gridBox.left - panelBox.left,
      identityInset: identityBox.left - panelBox.left,
    };
  });
  expect(spacing.gridInset).toBeGreaterThanOrEqual(24);
  expect(spacing.identityInset).toBeGreaterThanOrEqual(24);

  await page.getByRole("button", { name: "选择界面主题，当前：晴空蓝" }).click();
  const themeList = page.getByRole("listbox", { name: "选择界面主题" });
  await expect(themeList).toBeVisible();
  await expect(themeList.getByRole("option")).toHaveCount(4);
  await expect(themeList.getByRole("option").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(themeList.getByRole("option").nth(1)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "选择界面主题，当前：晴空蓝" })).toBeFocused();
  await page.getByRole("button", { name: "选择界面主题，当前：晴空蓝" }).click();
  await themeList.getByRole("option", { name: /经典深绿/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "classic");
  await expect(page.getByRole("button", { name: "选择界面主题，当前：经典深绿" })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "classic");

  await page.getByRole("button", { name: "选择界面主题，当前：经典深绿" }).click();
  await page.getByRole("option", { name: /薄荷青/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "mint");
  await page.getByRole("button", { name: "选择界面主题，当前：薄荷青" }).click();
  await page.getByRole("option", { name: /晴空蓝/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "blue");
  expect(browserFailures).toEqual([]);
});

test("F8 experiment builder binds schema options, request preview, and exact error Pointers", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "experiment");

  await expect(page.locator(".capability-disclosure")).not.toHaveAttribute("open", "");
  await page.locator(".capability-disclosure > summary").click();
  await expect(page.locator(".capability-disclosure")).toHaveAttribute("open", "");
  await expect(page.locator(".experiment-schema-panel")).toBeVisible();
  await expect(page.locator(".experiment-schema-panel")).toContainText("实验编排契约");
  await expect(page.locator(".experiment-schema-panel")).toContainText("supported");
  await expect(page.locator(".experiment-schema-panel")).toContainText("S3=not_exposed");
  await expect(page.locator("[data-field-path]")).toHaveCount(8);
  await expect(page.locator(".schema-control-group .field-help code")).toHaveCount(0);

  const latency = page.locator('[data-field-path="/overrides/fabric/scale_out_latency_us"] input');
  await latency.fill("1000");
  await expect(latency).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(".schema-control-group .field-help code")).toHaveCount(2);
  await expect(page.locator("button.run-submit")).toBeDisabled();
  await page.locator(".experiment-request-preview summary").click();
  await expect(page.locator(".request-preview-error code")).toHaveText("/overrides/fabric/scale_out_latency_us");

  await latency.fill("4");
  await page.locator('[data-field-path="/overrides/runtime/batch_scheduler"] select').selectOption("decode_priority");
  const request = JSON.parse((await page.locator(".experiment-request-preview pre").textContent()) || "{}");
  expect(request.overrides.fabric.scale_out_latency_us).toBe(4);
  expect(request.overrides.runtime.batch_scheduler).toBe("decode_priority");
  expect(request.fidelity_policy).toBe("des");
  await expect(page.locator("button.run-submit")).toBeEnabled();

  await page.getByRole("button", { name: "JSON 输入" }).click();
  await expect(page.locator(".request-preview-error code")).toHaveText("/custom_inputs/runtime_trace");
  await expect(page.locator("button.run-submit")).toBeDisabled();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);
  expect(browserFailures).toEqual([]);
});

test("dark appearance preserves palette, chart readability, accessibility, and desktop layout", async ({
  page,
}, testInfo) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "execution");
  await page.getByRole("button", { name: "切换到深色模式" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "blue");
  await expect(page.getByRole("button", { name: "切换到浅色模式" })).toBeVisible();
  expect(
    await page.locator("html").evaluate((element) => getComputedStyle(element).getPropertyValue("--canvas").trim()),
  ).toBe("#09111a");
  await expect
    .poll(() =>
      page.locator(".execution-chart svg text").evaluateAll((items) => items.map((item) => item.getAttribute("fill"))),
    )
    .toContain("#91a5b4");

  await page.getByRole("button", { name: /选择界面主题/ }).click();
  await page.getByRole("option", { name: /薄荷青/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "mint");
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "mint");
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");

  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.getByRole("heading", { name: "S0–S6 layered results" })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  expect(browserFailures).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot(`dark-evidence-${testInfo.project.name}.png`, { fullPage: true });

  await page.locator(".new-run-button").click();
  await expect(page.getByRole("heading", { name: "Review and run" })).toBeVisible();
  await expect(page.locator(".field input").first()).toBeVisible();
  expect(
    await page
      .locator(".field input")
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).not.toBe("rgb(255, 255, 255)");
  const experimentResults = await new AxeBuilder({ page }).analyze();
  expect(experimentResults.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);
});

test("desktop motion is restrained and reduced-motion removes decorative transitions", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "execution");
  await expect(page.getByRole("heading", { name: "S0–S6 分层结果" })).toBeVisible();

  const flowNode = page.locator(".execution-flow > .flow-node").first();
  const defaultMotion = await flowNode.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      animationIterationCount: style.animationIterationCount,
    };
  });
  expect(defaultMotion.animationName).toBe("flow-item-enter");
  expect(parseFloat(defaultMotion.animationDuration)).toBeLessThanOrEqual(0.4);
  expect(defaultMotion.animationIterationCount).toBe("1");
  await flowNode.hover();
  await expect.poll(() => flowNode.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "S0–S6 分层结果" })).toBeVisible();

  const surfaceMotion = await page
    .locator(".view-stack > *")
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        animationDuration: style.animationDuration,
        animationDelay: style.animationDelay,
        transitionDuration: style.transitionDuration,
      };
    });
  expect(parseFloat(surfaceMotion.animationDuration)).toBeLessThanOrEqual(0.001);
  expect(surfaceMotion.animationDelay).toBe("0s");
  expect(
    await page
      .locator(".execution-flow > .flow-node")
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).animationDuration)),
  ).toBeLessThanOrEqual(0.001);

  await page.getByRole("button", { name: /选择界面主题/ }).click();
  const themeList = page.getByRole("listbox", { name: "选择界面主题" });
  await expect(themeList).toBeVisible();
  expect(
    await themeList.evaluate((element) =>
      getComputedStyle(element)
        .transitionDuration.split(",")
        .every((duration) => parseFloat(duration) <= 0.001),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");

  await expectNoUnexpectedTextOverflow(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  expect(browserFailures).toEqual([]);
});

test("rename modal traps focus, closes with Escape, and restores its trigger", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  await openFixture(page, fixture, "history");
  await expect(page.locator(".compare-shell")).toHaveCount(0);
  const compareTrigger = page.getByRole("button", { name: "对比", exact: true }).first();
  await expect(compareTrigger).toBeVisible();
  await compareTrigger.click();
  await expect(page.locator(".compare-shell")).toBeVisible();
  const trigger = page.locator('button[title="重命名"]').first();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "重命名实验" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("input")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("structured performance report exports a readable and machine-readable S0-S9 document", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出结构化报告" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("synthetic-s1-s6-complete-structured-performance-report.html");
  const stream = await download.createReadStream();
  let html = "";
  for await (const chunk of stream) html += chunk.toString();
  expect(html).toContain("TILESIM STRUCTURED PERFORMANCE REPORT");
  expect(html).toContain('id="s0"');
  expect(html).toContain('id="s9"');
  expect(html).toContain('id="appendix"');
  expect(html).toContain('id="tilesim-structured-report"');
  expect(html).toContain("not_generated");
  expect(html).toContain("required_propagation_node_missing_or_unresolved");
  await expect(page.locator(".toast--positive")).toContainText("已导出");
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: fixture.id })).toBeVisible();
  await expect(page.getByRole("heading", { name: "完整性能证据明细" })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);
  expect(browserFailures).toEqual([]);
});

test("unknown schema fails closed to the complete raw report", async ({ page }, testInfo) => {
  const fixture = fixtureCase("unknown-run-schema");
  const browserFailures = await openFixture(page, fixture);
  await expect(page.getByRole("alert")).toContainText("结构化视图尚未适配该报告版本");
  await expect(page.getByRole("alert")).toContainText("wind_tunnel.run.v999");
  await page.locator(".json-artifact-panel").evaluate((element) => (element.open = true));
  await expect(page.locator(".artifact-line-text").filter({ hasText: "must-remain-visible" })).toBeVisible();
  await expectNoUnexpectedTextOverflow(page);
  expect(browserFailures).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot(`unknown-schema-${testInfo.project.name}.png`, { fullPage: true });
});

test("held-out provenance is retained without a synthetic warning", async ({ page }) => {
  const fixture = fixtureCase("held-out-s1-s6");
  const browserFailures = await openFixture(page, fixture);
  await expect(page.locator(".evidence-tags")).toContainText("真实 Trace");
  await expect(page.locator(".evidence-tags")).toContainText("held out validated");
  await expect(page.locator(".evidence-tags")).toContainText("held out validation");
  await expect(page.locator(".evidence-warning")).toHaveCount(0);
  await expectNoUnexpectedTextOverflow(page);
  expect(browserFailures).toEqual([]);
});

test("boundary metrics remain unavailable rather than becoming zero", async ({ page }) => {
  const boundary = fixtureCase("boundary-expected-absence");
  const boundaryFailures = await openFixture(page, boundary, "metrics");
  await expect(page.getByText("不适用").first()).toBeVisible();
  await expect(page.getByText("0/0 请求完成")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  await expectNoUnexpectedTextOverflow(page);
  expect(boundaryFailures).toEqual([]);
});

test("legacy bundles remain readable without invented optional artifacts", async ({ page }) => {
  const legacy = fixtureCase("legacy-missing-optional");
  const legacyFailures = await openFixture(page, legacy, "overview");
  await expect(page.locator(".evidence-identity")).toContainText("fixture-legacy::events");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expectNoUnexpectedTextOverflow(page);
  expect(legacyFailures).toEqual([]);
});
