import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export class EvidenceOracleError extends Error {
  constructor(code, detail, context = {}) {
    super(detail);
    this.name = "EvidenceOracleError";
    this.code = code;
    this.context = context;
  }
}

const GIT_REVISION = /^[0-9a-f]{40}$/;
const SYNTHETIC_CLASS = "synthetic_deterministic_execution";
const ALLOWED_SYNTHETIC_CLAIMS = new Set(["exploration", "synthetic_consistency"]);

export const evidenceAnchors = Object.freeze({
  "tests/test_week4_cumulative_flow.cpp::larger-message differential": [
    'trace_name = "week4_cumulative_larger_message"',
    "message_size_bytes *= 2",
    "larger_message_result.resource_semantic_report.completion_time_ps >",
    "larger_message_result.execution_envelope.end_time_ps >",
  ],
  "tests/test_week4_cumulative_flow.cpp::lower-bandwidth differential": [
    'trace_name = "week4_cumulative_lower_bandwidth"',
    "bandwidth_gbps = 50.0",
    'override_params["bandwidth_gbps"]',
    "lower_bandwidth_result.resource_semantic_report.completion_time_ps >",
    "lower_bandwidth_result.execution_result.fabric_report.end_to_end_latency_us >",
  ],
  "tests/test_week4_cumulative_flow.cpp::higher-latency differential": [
    'trace_name = "week4_cumulative_higher_latency"',
    "latency_us = 5.0",
    'override_params["latency_us"]',
    "higher_latency_result.resource_semantic_report.completion_time_ps >",
    "higher_latency_result.metrics_report.end_to_end_latency_distribution.p99_ps >",
  ],
  "tests/test_runtime_batch_lowering.cpp::fifo versus decode-priority ordering": [
    'trace_name = "fifo_policy"',
    'batch_scheduler = "fifo"',
    'trace_name = "decode_priority_policy"',
    'batch_scheduler = "decode_priority"',
    'execution_group_id == "prefill::prefill_fifo"',
    'execution_group_id == "decode::decode_fifo"',
  ],
  "tests/test_runtime_batch_lowering.cpp::multi-request batch membership": [
    'trace_name = "multi_decode"',
    'execution_group_id == "decode::decode_a+decode_b"',
    "collectives.size() == 2",
  ],
  "tests/test_runtime_batch_lowering.cpp::KV pressure and admission cases": [
    'trace_name = "runtime_reject"',
    "kv_capacity_tokens = 512",
    'detail == "kv_capacity_exceeded"',
    'trace_name = "runtime_memory_backpressure"',
    'detail == "kv_pressure_admission_limit"',
  ],
  "tests/test_modular_fabric.cpp::scale-out analytical module execution": [
    '"module_name": "generic_scale_out_analytical"',
    'has_factory("generic_scale_out_analytical")',
    'report.module_stats.count("so0") == 1',
    "report.end_to_end_latency_us > 0.0",
  ],
});

function fail(code, detail, context = {}) {
  throw new EvidenceOracleError(code, detail, context);
}

function git(repository, args, options = {}) {
  return execFileSync("git", ["-C", repository, ...args], {
    encoding: options.binary ? null : (options.encoding ?? "utf8"),
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
}

function gitObjectExists(repository, object) {
  const result = spawnSync("git", ["-C", repository, "cat-file", "-e", object], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.status === 0;
}

function repositoryPath(repositoryIdentity, repositories) {
  if (!Object.hasOwn(repositories, repositoryIdentity)) {
    fail("unknown_evidence_repository", `Unknown evidence repository: ${repositoryIdentity}`, {
      repository: repositoryIdentity,
    });
  }
  const candidate = repositories[repositoryIdentity];
  if (!existsSync(candidate)) {
    fail("evidence_repository_unavailable", `Evidence repository is unavailable: ${candidate}`, {
      repository: repositoryIdentity,
    });
  }
  return realpathSync(candidate);
}

function safeWorktreePath(repository, gitPath) {
  if (typeof gitPath !== "string" || !gitPath || isAbsolute(gitPath) || gitPath.includes("\\")) {
    fail("invalid_evidence_path", `Evidence path must be a repository-relative POSIX path: ${gitPath}`);
  }
  const candidate = resolve(repository, ...gitPath.split("/"));
  const remainder = relative(repository, candidate);
  if (!remainder || remainder === ".." || remainder.startsWith(`..${sep}`) || isAbsolute(remainder)) {
    fail("invalid_evidence_path", `Evidence path escapes or names the repository root: ${gitPath}`);
  }
  return candidate;
}

function missingAnchors(content, anchors) {
  return anchors.filter((anchor) => !content.includes(anchor));
}

export function validateEvidenceReference(reference, options) {
  if (!reference || typeof reference !== "object" || Array.isArray(reference)) {
    fail("invalid_execution_evidence", "Execution evidence must be an object.");
  }
  const repository = repositoryPath(reference.repository, options.repositories);
  if (typeof reference.revision !== "string" || !GIT_REVISION.test(reference.revision)) {
    fail("unknown_evidence_revision", `Invalid evidence revision: ${reference.revision}`, {
      revision: reference.revision,
    });
  }
  if (!gitObjectExists(repository, `${reference.revision}^{commit}`)) {
    fail("unknown_evidence_revision", `Evidence revision does not exist: ${reference.revision}`, {
      revision: reference.revision,
    });
  }
  safeWorktreePath(repository, reference.path);
  if (!gitObjectExists(repository, `${reference.revision}:${reference.path}`)) {
    fail("execution_evidence_path_missing", "Evidence path does not exist in the referenced commit.", {
      revision: reference.revision,
      path: reference.path,
    });
  }
  const anchorKey = `${reference.path}::${reference.test_case}`;
  const anchors = options.anchors?.[anchorKey];
  if (!Array.isArray(anchors) || anchors.length === 0) {
    fail("unknown_execution_test_case", `No independent oracle is registered for ${anchorKey}.`, {
      path: reference.path,
      test_case: reference.test_case,
    });
  }
  const committed = git(repository, ["show", `${reference.revision}:${reference.path}`]);
  const committedMissing = missingAnchors(committed, anchors);
  if (committedMissing.length > 0) {
    const worktreePath = safeWorktreePath(repository, reference.path);
    const dirty = existsSync(worktreePath) ? readFileSync(worktreePath, "utf8") : "";
    const dirtyMissing = missingAnchors(dirty, anchors);
    if (dirtyMissing.length === 0) {
      fail(
        "dirty_only_execution_evidence",
        "The test case exists only in the working tree, not in the referenced commit.",
        {
          revision: reference.revision,
          path: reference.path,
          test_case: reference.test_case,
          missing_committed_anchors: committedMissing,
        },
      );
    }
    fail("execution_evidence_test_case_missing", "The referenced commit does not contain the declared test case.", {
      revision: reference.revision,
      path: reference.path,
      test_case: reference.test_case,
      missing_anchors: committedMissing,
    });
  }
  return {
    repository: reference.repository,
    revision: reference.revision,
    path: reference.path,
    test_case: reference.test_case,
  };
}

function validateSyntheticScope(descriptor, evidence) {
  if (evidence.evidence_class !== SYNTHETIC_CLASS) return;
  const state = descriptor.capability_state ?? {};
  if (state.calibrated?.state !== "denied") {
    fail("synthetic_calibration_upgrade", "Synthetic execution evidence cannot affirm calibration.");
  }
  if (state.held_out_validated?.state !== "denied") {
    fail("synthetic_held_out_upgrade", "Synthetic execution evidence cannot affirm held-out validation.");
  }
  const invalidClaim = (descriptor.claim_scope_ceiling ?? []).find((claim) => !ALLOWED_SYNTHETIC_CLAIMS.has(claim));
  if (invalidClaim) {
    fail("synthetic_claim_scope_upgrade", `Synthetic execution evidence cannot publish claim scope: ${invalidClaim}`);
  }
}

export function validateCatalogEvidence(catalog, options) {
  const verified = [];
  const errors = [];
  const descriptors = catalog?.parameter_descriptors;
  if (!Array.isArray(descriptors)) {
    return {
      verified,
      errors: [new EvidenceOracleError("invalid_capability_catalog", "parameter_descriptors must be an array")],
    };
  }
  for (const descriptor of descriptors) {
    const evidenceItems = descriptor.execution_evidence;
    if (!Array.isArray(evidenceItems) || evidenceItems.length === 0) {
      errors.push(
        new EvidenceOracleError("execution_evidence_missing", `Missing execution evidence: ${descriptor.field_id}`, {
          field_id: descriptor.field_id,
        }),
      );
      continue;
    }
    for (const evidence of evidenceItems) {
      try {
        validateSyntheticScope(descriptor, evidence);
        verified.push({ field_id: descriptor.field_id, ...validateEvidenceReference(evidence, options) });
      } catch (error) {
        if (!(error instanceof EvidenceOracleError)) throw error;
        errors.push(
          new EvidenceOracleError(error.code, error.message, {
            field_id: descriptor.field_id,
            ...error.context,
          }),
        );
      }
    }
  }
  return { verified, errors };
}

function canonical(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (Number.isSafeInteger(value) && value >= 0) return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${canonical(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  fail("unsupported_canonical_value", `Unsupported catalog canonical value: ${String(value)}`);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function showJson(repository, revision, gitPath) {
  return JSON.parse(git(repository, ["show", `${revision}:${gitPath}`]));
}

function pythonJsonDigest(rawDocuments) {
  const program = [
    "import hashlib,json,sys",
    "raw=json.load(sys.stdin)",
    "value={key:json.loads(text) for key,text in raw.items()}",
    "encoded=json.dumps(value,sort_keys=True,separators=(',',':')).encode('utf-8')",
    "print('sha256:'+hashlib.sha256(encoded).hexdigest())",
  ].join(";");
  const result = spawnSync("python", ["-X", "utf8", "-c", program], {
    input: JSON.stringify(rawDocuments),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) fail("python_digest_failed", result.stderr.trim() || "Python schema-set digest failed.");
  return result.stdout.trim();
}

function committedDescriptorRevision(repository, revision) {
  const source = git(repository, ["show", `${revision}:bridge/contracts/experiment_descriptor.py`]);
  const program = [
    "import json,sys",
    "source=json.load(sys.stdin)",
    "namespace={'__name__':'__main__'}",
    "exec(compile(source,'experiment_descriptor.py','exec'),namespace)",
    "print(namespace['DESCRIPTOR_REVISION'])",
  ].join(";");
  const result = spawnSync("python", ["-X", "utf8", "-c", program], {
    input: JSON.stringify(source),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) fail("descriptor_revision_failed", result.stderr.trim() || "Descriptor revision failed.");
  return result.stdout.trim();
}

function extractRevision(repository, revision, destination) {
  const archive = git(repository, ["archive", "--format=tar", revision], { binary: true });
  const result = spawnSync("tar", ["-xf", "-", "-C", destination], {
    input: archive,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0)
    fail("web_revision_extract_failed", result.stderr.trim() || "Could not extract Web revision.");
}

function verifyGeneratedFiles(extractedRoot, sourceRoot) {
  const sourceModules = join(sourceRoot, "node_modules");
  if (!existsSync(sourceModules))
    fail("node_modules_unavailable", "node_modules is required for generated drift checks.");
  symlinkSync(sourceModules, join(extractedRoot, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  for (const script of ["scripts/generate-contract-types.mjs", "scripts/generate-bridge-client.mjs"]) {
    const result = spawnSync(process.execPath, [script, "--check"], {
      cwd: extractedRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.status !== 0) {
      fail("generated_contract_drift", `${script} reported drift.`, { stderr: result.stderr.trim() });
    }
  }
}

function buildCommittedSnapshot(extractedRoot, releaseMetadata) {
  const program = [
    "import json,sys",
    "sys.path.insert(0,'.')",
    "from contracts.agent_orchestration_capability.contract import build_snapshot",
    "print(json.dumps(build_snapshot(json.load(sys.stdin)),sort_keys=True,separators=(',',':'))) ",
  ].join(";");
  const result = spawnSync("python", ["-X", "utf8", "-c", program], {
    cwd: join(extractedRoot, "bridge"),
    input: JSON.stringify(releaseMetadata),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) fail("runtime_snapshot_failed", result.stderr.trim() || "Runtime snapshot build failed.");
  return JSON.parse(result.stdout);
}

export function verifyCommittedWebRelease({
  webRepository,
  webRevision,
  backendRepository,
  backendRevision,
  checkGenerated = true,
}) {
  const webRoot = realpathSync(webRepository);
  const backendRoot = realpathSync(backendRepository);
  if (!GIT_REVISION.test(webRevision) || !gitObjectExists(webRoot, `${webRevision}^{commit}`)) {
    fail("unknown_web_revision", `Unknown Web revision: ${webRevision}`);
  }
  if (!GIT_REVISION.test(backendRevision) || !gitObjectExists(backendRoot, `${backendRevision}^{commit}`)) {
    fail("unknown_backend_revision", `Unknown backend revision: ${backendRevision}`);
  }

  const catalogPath = "bridge/contracts/agent_orchestration_capability/catalog-content.json";
  const catalogRaw = git(webRoot, ["show", `${webRevision}:${catalogPath}`]);
  const catalog = JSON.parse(catalogRaw);
  const material = structuredClone(catalog);
  delete material.catalog_revision;
  delete material.catalog_digest;
  const catalogRevision = sha256(canonical(material));
  if (catalog.catalog_revision !== catalogRevision || catalog.catalog_digest !== catalogRevision) {
    fail("catalog_digest_mismatch", "Committed catalog revision/digest is not reproducible.");
  }

  const capabilitySchemaPrefix = "bridge/contracts/agent_orchestration_capability/schemas/";
  const capabilitySchemaPaths = git(webRoot, [
    "ls-tree",
    "-r",
    "--name-only",
    webRevision,
    "--",
    capabilitySchemaPrefix,
  ])
    .trim()
    .split(/\r?\n/u)
    .filter((name) => name.endsWith(".schema.json"));
  const packageDocuments = Object.fromEntries(
    capabilitySchemaPaths
      .map((gitPath) => showJson(webRoot, webRevision, gitPath))
      .map((document) => [document.$id.split("/").at(-1), document]),
  );
  if (Object.keys(packageDocuments).length !== 9)
    fail("contract_package_incomplete", "Expected nine capability schemas.");
  const packageRevision = sha256(canonical(packageDocuments));
  if (catalog.contract_package_revision !== packageRevision) {
    fail("contract_package_digest_mismatch", "Committed capability contract package digest is not reproducible.");
  }

  const contractPaths = git(webRoot, ["ls-tree", "-r", "--name-only", webRevision, "--", "bridge/contracts"])
    .trim()
    .split(/\r?\n/u)
    .filter((name) => name.endsWith(".json"));
  const rawContractDocuments = Object.fromEntries(
    contractPaths.map((gitPath) => [
      gitPath.slice("bridge/contracts/".length),
      git(webRoot, ["show", `${webRevision}:${gitPath}`]),
    ]),
  );
  const schemaSetRevision = pythonJsonDigest(rawContractDocuments);
  const descriptorRevision = committedDescriptorRevision(webRoot, webRevision);

  if (catalogRaw.includes(webRevision)) {
    fail("self_referential_web_revision", "The catalog embeds the Web commit that contains it.");
  }
  const evidence = validateCatalogEvidence(catalog, {
    repositories: { "D:/tileSim": backendRoot },
    anchors: evidenceAnchors,
  });
  if (evidence.errors.length > 0) {
    fail("committed_execution_evidence_invalid", "Committed catalog contains unreproducible execution evidence.", {
      errors: evidence.errors.map(serializeError),
    });
  }
  if (evidence.verified.some((item) => item.revision !== backendRevision)) {
    fail("backend_revision_binding_mismatch", "Not all execution evidence references the authorized backend revision.");
  }

  const temporaryRoot = mkdtempSync(join(tmpdir(), "tilesim-phase0d-web-"));
  try {
    extractRevision(webRoot, webRevision, temporaryRoot);
    if (checkGenerated) verifyGeneratedFiles(temporaryRoot, webRoot);
    const releaseMetadata = {
      web_source_revision: webRevision,
      web_build_revision: webRevision,
      backend_revision: backendRevision,
      schema_set_revision: schemaSetRevision,
      experiment_descriptor_revision: descriptorRevision,
      catalog_revision: catalogRevision,
      contract_package_revision: packageRevision,
    };
    const snapshot = buildCommittedSnapshot(temporaryRoot, releaseMetadata);
    if (
      snapshot.release_binding.web_source_revision !== webRevision ||
      snapshot.release_binding.web_build_revision !== webRevision ||
      snapshot.release_binding.backend_revision !== backendRevision ||
      snapshot.release_binding.schema_set_revision !== schemaSetRevision ||
      snapshot.release_binding.catalog_revision !== catalogRevision ||
      snapshot.release_binding.contract_package_revision !== packageRevision
    ) {
      fail("runtime_snapshot_binding_mismatch", "Runtime snapshot did not preserve injected release metadata.");
    }
    const alternate = buildCommittedSnapshot(temporaryRoot, {
      ...releaseMetadata,
      web_source_revision: "0".repeat(40),
      web_build_revision: "0".repeat(40),
    });
    if (alternate.catalog.catalog_revision !== snapshot.catalog.catalog_revision) {
      fail("self_referential_catalog_digest", "Catalog digest depends on runtime Web release metadata.");
    }
    if (alternate.snapshot_revision === snapshot.snapshot_revision) {
      fail("snapshot_revision_not_release_bound", "Snapshot revision did not change with injected release metadata.");
    }
    return {
      web_revision: webRevision,
      backend_revision: backendRevision,
      catalog_revision: catalogRevision,
      contract_package_revision: packageRevision,
      schema_set_revision: schemaSetRevision,
      experiment_descriptor_revision: descriptorRevision,
      snapshot_revision: snapshot.snapshot_revision,
      verified_evidence_count: evidence.verified.length,
      generated_drift_check: checkGenerated ? "passed" : "not_run",
    };
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

export function serializeError(error) {
  return { code: error.code, detail: error.message, ...error.context };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function runCli() {
  const oracleRoot = dirname(fileURLToPath(import.meta.url));
  const webRoot = resolve(oracleRoot, "..", "..");
  const backendRoot = resolve(argument("--backend") ?? join(webRoot, "..", "tileSim"));
  const webRevision = argument("--web-revision");
  if (webRevision) {
    const backendRevision = argument("--backend-revision");
    if (!backendRevision) fail("backend_revision_required", "--backend-revision is required with --web-revision.");
    console.log(
      JSON.stringify(
        verifyCommittedWebRelease({
          webRepository: webRoot,
          webRevision,
          backendRepository: backendRoot,
          backendRevision,
          checkGenerated: !process.argv.includes("--skip-generated"),
        }),
        null,
        2,
      ),
    );
    return;
  }
  const catalogPath = resolve(
    argument("--catalog") ??
      join(webRoot, "bridge", "contracts", "agent_orchestration_capability", "catalog-content.json"),
  );
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  const result = validateCatalogEvidence(catalog, {
    repositories: { "D:/tileSim": backendRoot },
    anchors: evidenceAnchors,
  });
  console.log(
    JSON.stringify(
      {
        status: result.errors.length === 0 ? "passed" : "failed",
        verified_count: result.verified.length,
        error_count: result.errors.length,
        errors: result.errors.map(serializeError),
      },
      null,
      2,
    ),
  );
  if (result.errors.length > 0) process.exitCode = 1;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    if (!(error instanceof EvidenceOracleError)) throw error;
    console.error(JSON.stringify({ status: "failed", errors: [serializeError(error)] }, null, 2));
    process.exitCode = 1;
  }
}
