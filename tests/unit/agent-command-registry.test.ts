import { describe, expect, it } from "vitest";
import { createAgentCommandRegistry } from "../../src/entities/agent-command";
import type { AgentParameterApplyResult, AgentParameterEdit } from "../../src/entities/agent-command";

/**
 * The command channel is the only way the sidebar reaches a page's form, so the
 * question it has to get right is *which* page answers. The experiment pages sit
 * inside `KeepAlive`: a page the user has navigated away from is still
 * registered, so "last registration wins" would let it answer for a catalogue it
 * no longer publishes.
 */

const edit: AgentParameterEdit = {
  path: "overrides/runtime/max_batch_size",
  label: "最大批大小",
  target: "control",
  fieldId: "s1.runtime.max_batch_size",
  previous: "4",
  next: "8",
  value: 8,
};

function handler(pageId: string): (edits: readonly AgentParameterEdit[]) => AgentParameterApplyResult {
  return (edits) => ({
    receipts: edits.map((item) => ({
      path: item.path,
      label: item.label,
      previous: item.previous,
      next: item.next,
      status: "applied" as const,
      reason: "",
    })),
    channelMoved: false,
    note: pageId,
  });
}

describe("agent command registry", () => {
  it("reports unavailability instead of throwing when no page owns the form", () => {
    const registry = createAgentCommandRegistry();

    expect(registry.available()).toBe(false);
    const result = registry.apply([edit]);
    expect(result.receipts).toEqual([]);
    expect(result.note).toContain("没有可以写入的参数面板");
  });

  it("answers through the page that declared itself live", () => {
    const registry = createAgentCommandRegistry();
    registry.register("experiment", handler("experiment"));
    registry.register("lightweight-prepare", handler("lightweight-prepare"));

    expect(registry.apply([edit]).note).toBe("lightweight-prepare");
    registry.activate("experiment");
    expect(registry.apply([edit]).note).toBe("experiment");
  });

  it("ignores an activation for a page that never registered", () => {
    const registry = createAgentCommandRegistry();
    registry.register("experiment", handler("experiment"));

    registry.activate("lightweight-prepare");

    // The caller must be able to trust `available()`: staying truthful here is
    // what keeps the edit entry point from being offered with nothing behind it.
    expect(registry.available()).toBe(true);
    expect(registry.apply([edit]).note).toBe("experiment");
  });

  it("falls back to the remaining page when the live one releases", () => {
    const registry = createAgentCommandRegistry();
    const releaseExperiment = registry.register("experiment", handler("experiment"));
    registry.register("lightweight-prepare", handler("lightweight-prepare"));
    registry.activate("experiment");

    releaseExperiment();

    expect(registry.apply([edit]).note).toBe("lightweight-prepare");
    // Activating a released page must not manufacture a live owner again.
    registry.activate("experiment");
    expect(registry.available()).toBe(true);
    expect(registry.apply([edit]).note).toBe("lightweight-prepare");
  });

  it("does not call a page with an empty edit list", () => {
    const registry = createAgentCommandRegistry();
    let called = 0;
    registry.register("experiment", () => {
      called += 1;
      return { receipts: [], channelMoved: false, note: "experiment" };
    });

    const result = registry.apply([]);

    expect(called).toBe(0);
    expect(result.receipts).toEqual([]);
    expect(result.note).toContain("没有任何通过校验的改动");
  });

  it("refuses an empty provider id", () => {
    const registry = createAgentCommandRegistry();
    expect(() => registry.register("", handler("nobody"))).toThrowError("agent_parameter_provider_id_required");
    expect(registry.available()).toBe(false);
  });
});
