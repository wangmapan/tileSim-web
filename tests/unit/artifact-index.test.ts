import { describe, expect, it } from "vitest";
import {
  ArtifactIndexError,
  artifactLineMatch,
  artifactLineWindow,
  buildArtifactTextIndex,
  searchArtifactTextIndex,
} from "../../src/features/inspect-artifact/model/artifact-index";

const raw = JSON.stringify({
  schema_version: "tilesim.test.v1",
  items: [{ device_latency_us: 12, "a/b~c": "needle" }],
  unsafe_time_ps: "900719925474099312345",
});

describe("artifact worker index model", () => {
  it("formats JSON and maps escaped JSON Pointers to stable lines", () => {
    const index = buildArtifactTextIndex(raw, "tilesim.test.v1");
    expect(index.schemaIdentity).toBe("tilesim.test.v1");
    expect(index.pointerToLine.get("/items/0/device_latency_us")).toBe(5);
    expect(index.pointerToLine.get("/items/0/a~1b~0c")).toBe(6);
    expect(artifactLineMatch(index, 5)).toMatchObject({ pointer: "/items/0/device_latency_us" });
    expect(index.formattedText).toContain('"900719925474099312345"');
  });

  it("searches asynchronously with bounded previews and exact total counts", async () => {
    const index = buildArtifactTextIndex(raw, "tilesim.test.v1");
    const result = await searchArtifactTextIndex(index, "needle", 1);
    expect(result).toMatchObject({ totalMatches: 1, truncated: false });
    expect(result.matches[0]).toMatchObject({ pointer: "/items/0/a~1b~0c", lineNumber: 6 });

    const long = buildArtifactTextIndex(JSON.stringify({ payload: "x".repeat(2000) }));
    const longResult = await searchArtifactTextIndex(long, "xxx", 1);
    expect(longResult.matches[0].preview.length).toBeLessThanOrEqual(601);
  });

  it("returns bounded virtual line windows and marks long lines as truncated", () => {
    const index = buildArtifactTextIndex(JSON.stringify({ payload: "x".repeat(5000), tail: true }));
    const lines = artifactLineWindow(index, 1, 500);
    expect(lines).toHaveLength(4);
    expect(lines.every((line) => line.text.length <= 4000)).toBe(true);
    expect(lines.find((line) => line.pointer === "/payload")).toMatchObject({ truncated: true });
    expect(artifactLineWindow(index, 2, 1)[0]).toMatchObject({
      lineNumber: 2,
      pointer: "/payload",
    });
    const manyLines = buildArtifactTextIndex(JSON.stringify(Array.from({ length: 400 }, (_, value) => value)));
    expect(artifactLineWindow(manyLines, 1, 500)).toHaveLength(300);
  });

  it("fails schema mismatches closed and observes cancellation", async () => {
    expect(() => buildArtifactTextIndex(raw, "tilesim.test.v2")).toThrowError(ArtifactIndexError);
    const index = buildArtifactTextIndex(raw, "tilesim.test.v1");
    await expect(searchArtifactTextIndex(index, "needle", 10, () => true)).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
