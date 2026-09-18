import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const stableCaseId = /^phase1-[a-z0-9-]+-[0-9]{3}$/;
const validSplits = new Set(["train", "validation", "test", "held_out_adversarial"]);
const expectedPointers = new Map([
  ["s0.workload.message_size_multiplier", "/overrides/workload/message_size_multiplier"],
  ["s1.runtime.batch_scheduler", "/overrides/runtime/batch_scheduler"],
  ["s1.runtime.max_batch_size", "/overrides/runtime/max_batch_size"],
  ["s1.runtime.kv_capacity_tokens", "/overrides/runtime/kv_capacity_tokens"],
  ["s6.fabric.scale_up_bandwidth_gbps", "/overrides/fabric/scale_up_bandwidth_gbps"],
  ["s6.fabric.scale_up_latency_us", "/overrides/fabric/scale_up_latency_us"],
  ["s6.fabric.scale_out_bandwidth_gbps", "/overrides/fabric/scale_out_bandwidth_gbps"],
  ["s6.fabric.scale_out_latency_us", "/overrides/fabric/scale_out_latency_us"],
]);

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(",")}}`;
}

function fail(caseId, expected, actual, minimalReproduction) {
  const error = new Error(
    `[${caseId}] expected=${stableJson(expected)} actual=${stableJson(actual)} minimal_reproduction=${stableJson(minimalReproduction)}`,
  );
  error.case_id = caseId;
  error.expected = expected;
  error.actual = actual;
  error.minimal_reproduction = minimalReproduction;
  throw error;
}

function requireCase(condition, entry, expected, actual) {
  if (!condition) fail(entry.case_id, expected, actual, entry.minimal_reproduction);
}

export function auditPhase1Corpus(corpus, frozenSubset) {
  if (corpus.corpus_identity !== "tilesim.web.eval.agent_orchestration.phase1.intent_corpus.v1") {
    throw new Error("Unexpected Phase 1 corpus identity.");
  }
  if (corpus.dataset_status !== "fixture_synthetic_consistency_only") {
    throw new Error("Phase 1 fixtures must remain synthetic consistency evidence only.");
  }
  if (stableJson(corpus.prohibited_claims) !== stableJson(["live", "calibrated", "held_out_real_validation"])) {
    throw new Error("Phase 1 corpus must explicitly prohibit live/calibrated/held-out-real claims.");
  }
  if (!Array.isArray(corpus.cases) || corpus.cases.length < 100 || corpus.case_count !== corpus.cases.length) {
    throw new Error(`Phase 1 corpus requires at least 100 cases; actual=${corpus.cases?.length ?? "missing"}.`);
  }
  const ids = new Set();
  const splitCounts = Object.fromEntries([...validSplits].map((split) => [split, 0]));
  const coveredFields = new Set();
  let chinese = 0;
  let english = 0;
  let mixed = 0;
  for (const entry of corpus.cases) {
    requireCase(
      stableCaseId.test(entry.case_id) && !ids.has(entry.case_id),
      entry,
      "unique stable case ID",
      entry.case_id,
    );
    ids.add(entry.case_id);
    requireCase(validSplits.has(entry.split), entry, [...validSplits], entry.split);
    splitCounts[entry.split] += 1;
    requireCase(entry.locale === "zh-CN" || entry.locale === "en-US", entry, "zh-CN|en-US", entry.locale);
    requireCase(typeof entry.input === "string" && entry.input.length > 0, entry, "non-empty input", entry.input);
    const hasChinese = /[\u3400-\u9fff]/u.test(entry.input);
    const hasEnglish = /[A-Za-z]/u.test(entry.input);
    chinese += Number(hasChinese);
    english += Number(hasEnglish);
    mixed += Number(hasChinese && hasEnglish);
    requireCase(
      entry.expected && typeof entry.expected.kind === "string",
      entry,
      "structured expected outcome",
      entry.expected,
    );
    requireCase(
      Array.isArray(entry.expected.field_values),
      entry,
      "expected.field_values[]",
      entry.expected?.field_values,
    );
    requireCase(
      Array.isArray(entry.expected.reason_codes),
      entry,
      "expected.reason_codes[]",
      entry.expected?.reason_codes,
    );
    requireCase(
      Array.isArray(entry.forbidden_outcomes) &&
        ["create_run", "provider_call", "live_or_calibrated_claim"].every((item) =>
          entry.forbidden_outcomes.includes(item),
        ),
      entry,
      "forbidden create_run/provider/live claims",
      entry.forbidden_outcomes,
    );
    requireCase(
      entry.minimal_reproduction?.instruction === entry.input &&
        entry.minimal_reproduction?.locale === entry.locale &&
        typeof entry.minimal_reproduction?.context_revision === "string",
      entry,
      "complete minimal reproduction",
      entry.minimal_reproduction,
    );
    requireCase(
      entry.evidence_scope === "fixture_synthetic_consistency_only",
      entry,
      "fixture_synthetic_consistency_only",
      entry.evidence_scope,
    );
    for (const field of entry.expected.field_values) {
      if (expectedPointers.has(field.field_id)) coveredFields.add(field.field_id);
      requireCase(
        typeof field.serialized_value === "string",
        entry,
        "lossless serialized string",
        field.serialized_value,
      );
    }
  }
  if (
    Object.values(splitCounts).some((count) => count === 0) ||
    stableJson(splitCounts) !== stableJson(corpus.splits)
  ) {
    throw new Error(`Eval split mismatch: expected=${stableJson(corpus.splits)} actual=${stableJson(splitCounts)}`);
  }
  if (chinese === 0 || english === 0 || mixed === 0) {
    throw new Error(`Corpus language coverage is incomplete: zh=${chinese}, en=${english}, mixed=${mixed}.`);
  }
  const fixturePointers = new Map(frozenSubset.fields.map((field) => [field.field_id, field.request_json_pointer]));
  if (stableJson([...fixturePointers]) !== stableJson([...expectedPointers])) {
    throw new Error(
      `Frozen field/Pointer set drifted: expected=${stableJson([...expectedPointers])} actual=${stableJson([...fixturePointers])}`,
    );
  }
  if (stableJson([...coveredFields].sort()) !== stableJson([...expectedPointers.keys()].sort())) {
    throw new Error(`Corpus does not cover all eight fields: ${stableJson([...coveredFields].sort())}`);
  }
  return { case_count: corpus.cases.length, split_counts: splitCounts, chinese, english, mixed };
}

function createSurface(frozenSubset) {
  const fields = frozenSubset.fields.map((field) => ({
    fieldId: field.field_id,
    label: field.field_id,
    kind: field.value_type === "enum" ? "select" : "number",
    requestJsonPointer: field.request_json_pointer,
    valueType: field.value_type,
    options: field.enum_values ?? [],
    minimum: field.minimum === undefined ? undefined : Number(field.minimum),
    maximum: field.maximum === undefined ? undefined : Number(field.maximum),
    minimumInclusive: true,
    maximumInclusive: true,
    step: field.value_type === "integer" ? 1 : undefined,
    integer: field.value_type === "integer",
    unit: field.unit,
    required: false,
    explicitDefaultAvailable: false,
    available: true,
    unavailableReason: null,
    applicableInputModes: ["controls"],
    applicableScenarios: ["s1_des_example"],
    contractStatus: "backend_descriptor",
  }));
  return {
    schemaId: "tilesim.bridge.create_run_request.v1",
    descriptorId: "phase1-frozen-fixture",
    descriptorRevision: frozenSubset.experiment_descriptor_revision,
    schemaSetRevision: frozenSubset.schema_set_revision,
    scenarios: [{ value: "s1_des_example", label: "s1_des_example" }],
    fidelityPolicies: ["default", "des"],
    fidelityOptions: [
      { value: "default", available: true, reason: null },
      { value: "des", available: true, reason: null },
    ],
    gpuParticipationModes: ["gpu_free"],
    inputModes: ["controls"],
    designSpaceModes: [],
    sourceModeOptions: [],
    defaultFidelityPolicy: "default",
    defaultGpuParticipationMode: "gpu_free",
    resolvedFidelitySource: "run_execution_envelope_and_validation_reports",
    contractStatus: "supported",
    contractGaps: [],
    contractError: "",
    controlGroups: [
      { groupId: "phase1", subsystem: "S1", title: "Phase 1", detail: "fixture", displayOrder: 1, fields },
    ],
    coverage: [],
    canSubmit: true,
  };
}

/** The caller must inject the existing public run-experiment builder. */
export function runCanonicalEquivalenceVectors(corpus, frozenSubset, buildExperimentRequest) {
  if (typeof buildExperimentRequest !== "function") throw new TypeError("The public request builder is required.");
  const vectors = corpus.cases.filter((entry) => entry.canonical_equivalence);
  if (vectors.length !== expectedPointers.size) {
    throw new Error(`Expected one canonical equivalence vector per frozen field; actual=${vectors.length}.`);
  }
  const surface = createSurface(frozenSubset);
  const coveredPointers = new Set();
  for (const entry of vectors) {
    const vector = entry.canonical_equivalence;
    const actual = buildExperimentRequest({
      form: {
        scenario_id: vector.form.scenario_id,
        fidelity_policy: vector.form.fidelity_policy,
        gpu_participation_mode: vector.form.gpu_participation_mode,
        run_name: vector.form.run_name,
        parameterValues: vector.form.parameter_values,
      },
      mode: "controls",
      surface,
      runtimeJson: "",
      topologyJson: "",
      designSpaceJson: "",
    });
    if (stableJson(actual) !== stableJson(vector.expected_request)) {
      fail(entry.case_id, vector.expected_request, actual, entry.minimal_reproduction);
    }
    const expectedField = entry.expected.field_values[0];
    coveredPointers.add(expectedPointers.get(expectedField.field_id));
  }
  if (stableJson([...coveredPointers].sort()) !== stableJson([...expectedPointers.values()].sort())) {
    throw new Error(`Canonical equivalence vectors do not cover the frozen Pointer set.`);
  }
  return { vector_count: vectors.length, passed: vectors.length };
}

export function readPhase1Fixtures(baseUrl = import.meta.url) {
  const here = new URL("../fixtures/phase1-agent-orchestration/", baseUrl);
  return {
    corpus: JSON.parse(readFileSync(new URL("intent-evaluation-corpus.json", here), "utf8")),
    frozenSubset: JSON.parse(readFileSync(new URL("frozen-current-subset.json", here), "utf8")),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { corpus, frozenSubset } = readPhase1Fixtures();
  const result = auditPhase1Corpus(corpus, frozenSubset);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
