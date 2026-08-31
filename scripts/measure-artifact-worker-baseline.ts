import { performance } from "node:perf_hooks";
import process from "node:process";
import {
  artifactLineWindow,
  buildArtifactTextIndex,
  searchArtifactTextIndex,
} from "../src/features/inspect-artifact/model/artifact-index";
import { createLargeLineArtifact, largeArtifactFixtureSpec } from "../tests/performance/large-artifact-fixture.mjs";

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

const rawText = createLargeLineArtifact();
const samples = [];
for (let sample = 0; sample < 5; sample += 1) {
  const indexStart = performance.now();
  const index = buildArtifactTextIndex(rawText, largeArtifactFixtureSpec.schemaVersion);
  const indexMs = performance.now() - indexStart;
  const searchStart = performance.now();
  const result = await searchArtifactTextIndex(index, largeArtifactFixtureSpec.searchNeedle, 200);
  const searchMs = performance.now() - searchStart;
  const windowStart = performance.now();
  const lineWindow = artifactLineWindow(index, result.matches[0]?.lineNumber || 1, 120);
  const lineWindowMs = performance.now() - windowStart;
  samples.push({
    index_ms: Number(indexMs.toFixed(3)),
    first_search_ms: Number(searchMs.toFixed(3)),
    line_window_ms: Number(lineWindowMs.toFixed(3)),
    line_window_count: lineWindow.length,
    formatted_lines: index.lineOffsets.length,
    pointer_count: index.pointerToLine.size,
    match_count: result.totalMatches,
    match_pointer: result.matches[0]?.pointer || null,
  });
}

process.stdout.write(
  `${JSON.stringify(
    {
      schema_version: "tilesim.web.artifact_virtual_baseline.v1",
      measured_at: new Date().toISOString(),
      runtime: { node: process.version, platform: process.platform, arch: process.arch },
      fixture: {
        source_bytes: Buffer.byteLength(rawText),
        source_lines: largeArtifactFixtureSpec.lineCount,
        search_query: largeArtifactFixtureSpec.searchNeedle,
      },
      samples,
      median: {
        index_ms: median(samples.map((sample) => sample.index_ms)),
        first_search_ms: median(samples.map((sample) => sample.first_search_ms)),
        line_window_ms: median(samples.map((sample) => sample.line_window_ms)),
      },
      budget: {
        first_search_ms: 500,
        maximum_dom_lines: 300,
        passed:
          samples.every((sample) => sample.first_search_ms < 500) &&
          samples.every((sample) => sample.line_window_count <= 300),
      },
      note: "Measures index, search, and line-window algorithms in vite-node; browser Worker transfer, main-thread responsiveness, and DOM size are covered separately.",
    },
    null,
    2,
  )}\n`,
);
