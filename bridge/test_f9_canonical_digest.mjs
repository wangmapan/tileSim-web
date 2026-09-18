import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(root, "fixtures", "f9-canonical-digest-golden.json"), "utf8"));

function compareCodePoints(left, right) {
  const a = Array.from(left, (character) => character.codePointAt(0));
  const b = Array.from(right, (character) => character.codePointAt(0));
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}

function canonical(value) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "bigint") return value.toString(10);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      throw new TypeError("Canonical JSON requires a finite lossless number.");
    }
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort(compareCodePoints)
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  throw new TypeError(`Unsupported canonical type: ${typeof value}`);
}

function materializeIntegers(value, pointers) {
  value = structuredClone(value);
  for (const pointer of pointers) {
    const tokens = pointer.slice(1).split("/");
    let target = value;
    for (const token of tokens.slice(0, -1)) target = target[Array.isArray(target) ? Number(token) : token];
    const last = tokens.at(-1);
    target[Array.isArray(target) ? Number(last) : last] = BigInt(target[Array.isArray(target) ? Number(last) : last]);
  }
  return value;
}

assert.equal(fixture.schema_version, "tilesim.bridge.canonical_digest_golden.v1");
for (const vector of fixture.cases) {
  const value = materializeIntegers(vector.value, vector.integer_json_pointers);
  const text = canonical(value);
  assert.equal(text, vector.expected_canonical_json, vector.id);
  assert.equal(
    `sha256:${crypto.createHash("sha256").update(text, "utf8").digest("hex")}`,
    vector.expected_sha256,
    vector.id,
  );
}

console.log(`F9 canonical digest golden vectors passed in Node (${fixture.cases.length} cases).`);
