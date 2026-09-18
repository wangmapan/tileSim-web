import { createHash } from "node:crypto";

function compareCodePoints(left: string, right: string): number {
  const a = Array.from(left, (character) => character.codePointAt(0) as number);
  const b = Array.from(right, (character) => character.codePointAt(0) as number);
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}

export function canonicalJsonText(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "bigint") return value.toString(10);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
      throw new TypeError("canonical JSON requires a finite lossless integer or decimal string");
    }
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJsonText).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort(compareCodePoints)
      .map((key) => `${JSON.stringify(key)}:${canonicalJsonText(record[key])}`)
      .join(",")}}`;
  }
  throw new TypeError(`unsupported canonical JSON type: ${typeof value}`);
}

export function canonicalSha256(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJsonText(value), "utf8").digest("hex")}`;
}

export function digestMaterial(document: Record<string, unknown>): Record<string, unknown> {
  const fields = document.digest_material_fields;
  if (!Array.isArray(fields) || !fields.every((field) => typeof field === "string")) {
    throw new TypeError("digest_material_fields must be a string array");
  }
  if (fields.includes("canonical_digest") || new Set(fields).size !== fields.length) {
    throw new TypeError("digest material fields must be unique and exclude canonical_digest");
  }
  return Object.fromEntries(
    fields.map((field) => {
      if (!(field in document)) throw new TypeError(`missing digest material field: ${field}`);
      return [field, document[field]];
    }),
  );
}
