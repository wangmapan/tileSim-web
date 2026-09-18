function compareUnicodeCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0) || 0);
  const rightPoints = Array.from(right, (character) => character.codePointAt(0) || 0);
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    if (leftPoints[index] !== rightPoints[index]) return leftPoints[index] - rightPoints[index];
  }
  return leftPoints.length - rightPoints.length;
}

function canonicalValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "bigint") return value.toString(10);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON forbids NaN and Infinity.");
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw new TypeError("Canonical JSON requires lossless integer input.");
    }
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort(compareUnicodeCodePoints);
    return `{${keys
      .map((key) => {
        if (record[key] === undefined) throw new TypeError(`Canonical JSON forbids undefined at ${key}.`);
        return `${JSON.stringify(key)}:${canonicalValue(record[key])}`;
      })
      .join(",")}}`;
  }
  throw new TypeError(`Canonical JSON cannot encode ${typeof value}.`);
}

export function canonicalJson(value: unknown): string {
  return canonicalValue(value);
}

export async function sha256Prefixed(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("SHA-256 is unavailable in this browser.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}
