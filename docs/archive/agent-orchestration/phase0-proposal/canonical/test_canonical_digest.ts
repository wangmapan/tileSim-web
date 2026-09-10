import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalJsonText, canonicalSha256 } from "./canonical_json.ts";

const root = dirname(fileURLToPath(import.meta.url));
const vectors = JSON.parse(readFileSync(join(root, "canonical-digest-vectors.proposal.jsonc"), "utf8"));

function materializeIntegers(value: unknown, pointers: string[]): unknown {
  const result = structuredClone(value) as Record<string, unknown>;
  for (const pointer of pointers) {
    const tokens = pointer.slice(1).split("/");
    let target: unknown = result;
    for (const token of tokens.slice(0, -1)) {
      target = (target as Record<string, unknown>)[token];
    }
    const last = tokens.at(-1) as string;
    (target as Record<string, unknown>)[last] = BigInt((target as Record<string, string>)[last]);
  }
  return result;
}

assert.equal(vectors.canonicalization, "tilesim.bridge.canonical_json.v1");
for (const vector of vectors.cases) {
  const value = materializeIntegers(vector.value, vector.integer_json_pointers);
  assert.equal(canonicalJsonText(value), vector.expected_canonical_json, vector.id);
  assert.equal(canonicalSha256(value), vector.expected_sha256, vector.id);
}
assert.throws(() => canonicalJsonText(0.1), /lossless integer/);
console.log(`Phase 0 TypeScript canonical digest vectors passed (${vectors.cases.length} cases).`);
