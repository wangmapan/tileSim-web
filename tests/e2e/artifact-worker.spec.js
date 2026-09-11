import { expect, test } from "@playwright/test";
import { createLargeLineArtifact, largeArtifactFixtureSpec } from "../performance/large-artifact-fixture.mjs";

test("14 MB artifact indexing and search stay off the desktop main thread", async ({ page }) => {
  // The 30-second Playwright lifecycle is not the performance SLO for this
  // intentionally large fixture. The assertions below remain the acceptance
  // gates for complete Worker indexing, result correctness, search latency,
  // and main-thread responsiveness.
  test.slow();
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"performance-harness"}' }),
  );
  await page.goto("/experiment", { waitUntil: "domcontentloaded" });
  const rawText = createLargeLineArtifact();
  const result = await page.evaluate(
    async ({ raw, schemaVersion, query }) => {
      const { ArtifactIndexWorkerClient } =
        await import("/src/features/inspect-artifact/client/artifact-index-client.ts");
      const client = new ArtifactIndexWorkerClient();
      let mainThreadTicks = 0;
      const interval = window.setInterval(() => {
        mainThreadTicks += 1;
      }, 20);
      const indexStart = performance.now();
      const indexed = await client.index(
        {
          runId: "run-performance-f5b",
          artifactId: "performance-fixture",
          sha256: "a".repeat(64),
          schemaIdentity: schemaVersion,
        },
        raw,
      );
      const indexMs = performance.now() - indexStart;
      const searchStart = performance.now();
      const searched = await client.search(query, 200);
      const searchMs = performance.now() - searchStart;
      const firstWindow = await client.readLines(1, 300);
      const matchWindow = await client.readLines(searched.matches[0].lineNumber, 1);
      const located = await client.locatePointer(searched.matches[0].pointer);
      window.clearInterval(interval);
      client.dispose();
      return {
        mainThreadTicks,
        indexMs,
        searchMs,
        lineCount: indexed.lineCount,
        pointerCount: indexed.pointerCount,
        matchCount: searched.totalMatches,
        matchPointer: searched.matches[0]?.pointer,
        returnedFormattedText: Object.hasOwn(indexed, "formattedText"),
        windowLineCount: firstWindow.lines.length,
        matchWindowText: matchWindow.lines[0]?.text,
        locatedLine: located.match?.lineNumber,
      };
    },
    {
      raw: rawText,
      schemaVersion: largeArtifactFixtureSpec.schemaVersion,
      query: largeArtifactFixtureSpec.searchNeedle,
    },
  );

  expect(result.lineCount).toBe(599_975);
  expect(result.pointerCount).toBe(499_978);
  expect(result.matchCount).toBe(1);
  expect(result.matchPointer).toBe("/records/87654/request_id");
  expect(result.returnedFormattedText).toBe(false);
  expect(result.windowLineCount).toBe(300);
  expect(result.matchWindowText).toContain(largeArtifactFixtureSpec.searchNeedle);
  expect(result.locatedLine).toBeGreaterThan(500_000);
  expect(result.searchMs).toBeLessThan(500);
  expect(result.mainThreadTicks).toBeGreaterThan(5);
});
