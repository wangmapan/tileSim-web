import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

import {
  EvidenceOracleError,
  evidenceAnchors,
  validateCatalogEvidence,
  validateEvidenceReference,
} from "../oracles/phase0d-evidence-reproducibility.mjs";

const webRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const backendRoot = resolve(webRoot, "..", "tileSim");
const catalogPath = join(webRoot, "bridge", "contracts", "agent_orchestration_capability", "catalog-content.json");
const badBaseline = "09c22c0efff890253a1eacf403c2979f56fd9ba6";

function git(repository, ...args) {
  return execFileSync("git", ["-C", repository, ...args], { encoding: "utf8" }).trim();
}

function fixtureRepository() {
  const repository = mkdtempSync(join(tmpdir(), "tilesim-phase0d-evidence-"));
  git(repository, "init", "--quiet");
  git(repository, "config", "user.name", "TileSim Oracle");
  git(repository, "config", "user.email", "oracle@tilesim.invalid");
  writeFileSync(join(repository, "evidence.cpp"), "committed-anchor\n", "utf8");
  git(repository, "add", "--", "evidence.cpp");
  git(repository, "commit", "--quiet", "-m", "fixture evidence");
  return { repository, revision: git(repository, "rev-parse", "HEAD") };
}

function reference(revision) {
  return {
    repository: "fixture/backend",
    revision,
    path: "evidence.cpp",
    test_case: "committed case",
    evidence_class: "synthetic_deterministic_execution",
  };
}

function expectCode(callback, code) {
  assert.throws(callback, (error) => error instanceof EvidenceOracleError && error.code === code);
}

test("fails closed for unknown repository, revision, path, and test case", () => {
  const fixture = fixtureRepository();
  try {
    const options = {
      repositories: { "fixture/backend": fixture.repository },
      anchors: {
        "evidence.cpp::committed case": ["committed-anchor"],
        "evidence.cpp::missing known case": ["absent-anchor"],
      },
    };
    assert.equal(validateEvidenceReference(reference(fixture.revision), options).revision, fixture.revision);
    expectCode(
      () => validateEvidenceReference({ ...reference(fixture.revision), repository: "unknown/backend" }, options),
      "unknown_evidence_repository",
    );
    expectCode(() => validateEvidenceReference(reference("f".repeat(40)), options), "unknown_evidence_revision");
    expectCode(
      () => validateEvidenceReference({ ...reference(fixture.revision), path: "missing.cpp" }, options),
      "execution_evidence_path_missing",
    );
    expectCode(
      () => validateEvidenceReference({ ...reference(fixture.revision), test_case: "invented case" }, options),
      "unknown_execution_test_case",
    );
    expectCode(
      () => validateEvidenceReference({ ...reference(fixture.revision), test_case: "missing known case" }, options),
      "execution_evidence_test_case_missing",
    );
  } finally {
    rmSync(fixture.repository, { recursive: true, force: true });
  }
});

test("rejects a test case that exists only in the dirty worktree", () => {
  const fixture = fixtureRepository();
  try {
    writeFileSync(join(fixture.repository, "evidence.cpp"), "committed-anchor\ndirty-only-anchor\n", "utf8");
    expectCode(
      () =>
        validateEvidenceReference(reference(fixture.revision), {
          repositories: { "fixture/backend": fixture.repository },
          anchors: { "evidence.cpp::committed case": ["committed-anchor", "dirty-only-anchor"] },
        }),
      "dirty_only_execution_evidence",
    );
  } finally {
    rmSync(fixture.repository, { recursive: true, force: true });
  }
});

test("synthetic execution cannot upgrade calibration, held-out validation, or claim scope", () => {
  const fixture = fixtureRepository();
  try {
    const descriptor = {
      field_id: "fixture.field",
      execution_evidence: [reference(fixture.revision)],
      capability_state: {
        calibrated: { state: "denied" },
        held_out_validated: { state: "denied" },
      },
      claim_scope_ceiling: ["exploration", "synthetic_consistency"],
    };
    const options = {
      repositories: { "fixture/backend": fixture.repository },
      anchors: { "evidence.cpp::committed case": ["committed-anchor"] },
    };
    assert.equal(validateCatalogEvidence({ parameter_descriptors: [descriptor] }, options).errors.length, 0);
    for (const [mutation, code] of [
      [(value) => (value.capability_state.calibrated.state = "affirmed"), "synthetic_calibration_upgrade"],
      [(value) => (value.capability_state.held_out_validated.state = "affirmed"), "synthetic_held_out_upgrade"],
      [(value) => value.claim_scope_ceiling.push("real_calibrated_validation"), "synthetic_claim_scope_upgrade"],
    ]) {
      const invalid = structuredClone(descriptor);
      mutation(invalid);
      assert.equal(validateCatalogEvidence({ parameter_descriptors: [invalid] }, options).errors[0].code, code);
    }
  } finally {
    rmSync(fixture.repository, { recursive: true, force: true });
  }
});

test("current catalog reports only the three known dirty-only 09c22c0 references, or fully closes after rebinding", () => {
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  const result = validateCatalogEvidence(catalog, {
    repositories: { "D:/tileSim": backendRoot },
    anchors: evidenceAnchors,
  });
  const referencedRevisions = new Set(
    catalog.parameter_descriptors.flatMap((descriptor) =>
      descriptor.execution_evidence.map((evidence) => evidence.revision),
    ),
  );
  if (referencedRevisions.size === 1 && referencedRevisions.has(badBaseline)) {
    assert.deepEqual(
      result.errors.map((error) => [error.context.field_id, error.code]),
      [
        ["s0.workload.message_size_multiplier", "dirty_only_execution_evidence"],
        ["s6.fabric.scale_up_bandwidth_gbps", "dirty_only_execution_evidence"],
        ["s6.fabric.scale_up_latency_us", "dirty_only_execution_evidence"],
      ],
    );
    assert.equal(result.verified.length, 5);
  } else {
    assert.deepEqual(
      result.errors.map((error) => ({ code: error.code, context: error.context })),
      [],
    );
    assert.equal(result.verified.length, 8);
  }
});
