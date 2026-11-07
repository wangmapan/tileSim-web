import { describe, expect, it } from "vitest";
import { normalizeReplayDocument } from "../../src/features/execution-replay";
import {
  defaultReplayLayerVisibility,
  replayEventLayer,
  replayLayerDefinitions,
  replayLayerAvailability,
} from "../../src/features/execution-replay/model/layers";
import {
  executionReplayEnvelopeFixture,
  executionReplayFabricRouteFixture,
  executionReplayFabricRouteTopologyFixture,
  executionReplayRuntimeEvents,
  executionReplayCollectiveStepsFixture,
} from "../fixtures/execution-replay";

function documentFixture() {
  return normalizeReplayDocument({
    runId: "run-execution-replay-fixture",
    envelope: executionReplayEnvelopeFixture,
    runtimeEvents: {
      value: executionReplayRuntimeEvents,
      artifactId: "runtime-events",
      sha256: "a".repeat(64),
      schemaIdentity: "tilesim.s1_runtime_event_trace.v1",
      availability: "available",
    },
    fabricRoutes: {
      value: executionReplayFabricRouteFixture,
      artifactId: "execution-replay",
      sha256: "b".repeat(64),
      schemaIdentity: "tilesim.request_attribution.v1",
      availability: "available",
    },
    topology: {
      value: executionReplayFabricRouteTopologyFixture,
      artifactId: "input-topology",
      sha256: "c".repeat(64),
      schemaIdentity: "tilesim.s6_topology_input.v1",
      availability: "available",
    },
    collectiveSteps: {
      value: executionReplayCollectiveStepsFixture,
      artifactId: "execution-replay",
      sha256: "d".repeat(64),
      schemaIdentity: "tilesim.execution_replay.v1",
      availability: "available",
    },
  });
}

describe("execution replay evidence layers", () => {
  it("derives layer availability and counts from reported evidence", () => {
    const document = documentFixture();
    const definitions = replayLayerDefinitions(document);
    expect(definitions.map((definition) => definition.key)).toEqual([
      "operator", "kernel", "wave", "fragment", "buffer",
      "execution",
      "request",
      "scheduling",
      "kv",
      "device",
      "collective",
      "fabric",
      "topology",
      "output",
    ]);
    expect(definitions.find((definition) => definition.key === "fabric")?.count).toBeGreaterThan(0);
    expect(replayLayerAvailability(document, "output")).toBe("not_covered");
    expect(defaultReplayLayerVisibility(document).output).toBe(false);
  });

  it("classifies runtime events without inventing request, output, or model internals", () => {
    const document = documentFixture();
    const scheduling = document.events.find((event) => ["arrival", "admit", "batch_issue"].includes(event.kind));
    expect(scheduling ? replayEventLayer(scheduling) : null).toBe("scheduling");
    expect(document.events.some((event) => replayEventLayer(event) === "kv")).toBe(true);
    expect(replayLayerAvailability(document, "request")).toBe("not_covered");
  });

  it("keeps visibility as display state and never mutates the normalized evidence", () => {
    const document = documentFixture();
    const before = JSON.stringify(document);
    const visibility = defaultReplayLayerVisibility(document);
    visibility.fabric = false;
    expect(JSON.stringify(document)).toBe(before);
  });
});
