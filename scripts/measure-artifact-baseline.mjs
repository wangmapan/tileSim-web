import { performance } from "node:perf_hooks";
import process from "node:process";
import { createLargeLineArtifact, largeArtifactFixtureSpec } from "../tests/performance/large-artifact-fixture.mjs";

function elapsed(start) {
  return Number((performance.now() - start).toFixed(3));
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(3));
}

function logicalLineCount(text) {
  let count = 1;
  for (let index = 0; index < text.length; index += 1) if (text.charCodeAt(index) === 10) count += 1;
  return count;
}

function measureCurrentPipeline(rawText) {
  globalThis.gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  const parseStart = performance.now();
  const parsed = JSON.parse(rawText);
  const parseMs = elapsed(parseStart);

  const formatStart = performance.now();
  const formatted = JSON.stringify(parsed, null, 2);
  const formatMs = elapsed(formatStart);

  const searchStart = performance.now();
  const matches = formatted
    .split("\n")
    .filter((line) => line.toLowerCase().includes(largeArtifactFixtureSpec.searchNeedle));
  const searchMs = elapsed(searchStart);
  return {
    parseMs,
    formatMs,
    searchMs,
    totalMs: Number((parseMs + formatMs + searchMs).toFixed(3)),
    heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore,
    formattedCharacters: formatted.length,
    formattedLines: logicalLineCount(formatted),
    matchCount: matches.length,
  };
}

const fixtureStart = performance.now();
const rawText = createLargeLineArtifact();
const fixtureMs = elapsed(fixtureStart);
measureCurrentPipeline(rawText);
const samples = Array.from({ length: 5 }, () => measureCurrentPipeline(rawText));
const representative = samples[0];

const result = {
  schema_version: "tilesim.web.artifact_baseline.v1",
  measured_at: new Date().toISOString(),
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
  fixture: {
    recipe: "large-artifact-fixture.mjs#createLargeLineArtifact",
    source_bytes: Buffer.byteLength(rawText),
    source_lines: rawText.split("\n").length,
    formatted_characters: representative.formattedCharacters,
    formatted_lines: representative.formattedLines,
    lossless_integer_representation: "decimal string",
  },
  current_main_thread_pipeline_ms: {
    samples: samples.length,
    fixture_generation: fixtureMs,
    parse_median: median(samples.map((sample) => sample.parseMs)),
    pretty_format_median: median(samples.map((sample) => sample.formatMs)),
    first_search_median: median(samples.map((sample) => sample.searchMs)),
    parse_format_search_total_median: median(samples.map((sample) => sample.totalMs)),
    total_samples: samples.map((sample) => sample.totalMs),
  },
  memory: { heap_delta_bytes_median: median(samples.map((sample) => sample.heapDeltaBytes)) },
  current_render_model: {
    element: "pre",
    rendered_logical_lines: representative.formattedLines,
    virtualized: false,
    note: "Browser paint/layout and interaction latency are not represented by this Node baseline.",
  },
  search: { query: largeArtifactFixtureSpec.searchNeedle, match_count: representative.matchCount },
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
