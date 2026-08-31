import { describe, expect, it } from "vitest";
import {
  buildArtifactTextIndex,
  searchArtifactTextIndex,
} from "../../src/features/inspect-artifact/model/artifact-index";
import {
  createLargeLineArtifact,
  createLongLineArtifact,
  createLosslessIntegerArtifact,
  createUnknownSchemaArtifact,
  largeArtifactFixtureSpec,
} from "../performance/large-artifact-fixture.mjs";

describe("F5A deterministic artifact fixtures", () => {
  it("keeps the canonical corpus at 10 MiB and builds its complete Worker index", async () => {
    const text = createLargeLineArtifact();
    expect(new TextEncoder().encode(text).byteLength).toBeGreaterThanOrEqual(largeArtifactFixtureSpec.minimumBytes);
    expect(text.split("\n")).toHaveLength(largeArtifactFixtureSpec.lineCount);
    expect(text).toContain(largeArtifactFixtureSpec.searchNeedle);
    expect(JSON.parse(text).records).toHaveLength(99_995);
    const index = buildArtifactTextIndex(text, largeArtifactFixtureSpec.schemaVersion);
    expect(index.lineOffsets).toHaveLength(599_975);
    expect(index.pointerToLine.size).toBe(499_978);
    const result = await searchArtifactTextIndex(index, largeArtifactFixtureSpec.searchNeedle, 20);
    expect(result).toMatchObject({ totalMatches: 1, truncated: false });
    expect(result.matches[0].pointer).toBe("/records/87654/request_id");
  });

  it("fixes the long-line, lossless integer, and unknown-schema edge cases", () => {
    const longLine = createLongLineArtifact();
    expect(new TextEncoder().encode(longLine).byteLength).toBe(largeArtifactFixtureSpec.minimumBytes);
    expect(longLine).not.toContain("\n");
    expect(createLosslessIntegerArtifact()).toContain('"900719925474099312345"');
    expect(createUnknownSchemaArtifact()).toContain('"future_field":"must-remain-visible"');
  });
});
