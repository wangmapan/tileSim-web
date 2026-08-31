const DEFAULT_LINE_COUNT = 100_000;
const MINIMUM_BYTES = 10 * 1024 * 1024;

function paddedIndex(index) {
  return String(index).padStart(6, "0");
}

export function createLargeLineArtifact(lineCount = DEFAULT_LINE_COUNT) {
  if (!Number.isInteger(lineCount) || lineCount < 6) throw new RangeError("lineCount must be an integer >= 6");
  const recordCount = lineCount - 5;
  const lines = ["{", '  "schema_version": "tilesim.performance.fixture.v1",', '  "records": ['];
  for (let index = 0; index < recordCount; index += 1) {
    const id = paddedIndex(index);
    const comma = index === recordCount - 1 ? "" : ",";
    lines.push(
      `    {"request_id":"req-${id}","timestamp_ps":"9007199254740${id}","domain":"fabric","message":"deterministic-large-artifact-sample-${id}"}${comma}`,
    );
  }
  lines.push("  ]", "}");
  const text = lines.join("\n");
  if (lineCount === DEFAULT_LINE_COUNT && new TextEncoder().encode(text).byteLength < MINIMUM_BYTES) {
    throw new Error("The canonical large artifact fixture must remain at least 10 MiB.");
  }
  return text;
}

export function createLongLineArtifact(bytes = MINIMUM_BYTES) {
  const prefix = '{"schema_version":"tilesim.performance.long-line.v1","payload":"';
  const suffix = '"}';
  return `${prefix}${"x".repeat(Math.max(0, bytes - prefix.length - suffix.length))}${suffix}`;
}

export function createLosslessIntegerArtifact() {
  return '{"schema_version":"tilesim.performance.lossless.v1","time_ps":"900719925474099312345"}';
}

export function createUnknownSchemaArtifact() {
  return '{"schema_version":"tilesim.performance.unknown.v999","future_field":"must-remain-visible"}';
}

export const largeArtifactFixtureSpec = Object.freeze({
  schemaVersion: "tilesim.performance.fixture.v1",
  lineCount: DEFAULT_LINE_COUNT,
  minimumBytes: MINIMUM_BYTES,
  searchNeedle: "req-087654",
});
