/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("../../src/lib/api/transport", () => ({ apiRequest }));

import { observeExplorationEvents } from "../../src/features/agent-exploration/api";

describe("exploration event observer isolation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiRequest.mockReset();
  });

  it("keeps B alive when A is aborted after A terminal delivery", async () => {
    const calls = new Map<string, number>();
    apiRequest.mockImplementation(async (path: string) => {
      const id = path.includes("explore-a") ? "a" : "b";
      const count = (calls.get(id) || 0) + 1;
      calls.set(id, count);
      if (id === "a") return { events: [{ sequence: 1 }], terminal: true };
      return count === 1 ? { events: [{ sequence: 1 }], terminal: false } : { events: [{ sequence: 2 }], terminal: true };
    });
    const aController = new AbortController();
    const bController = new AbortController();
    const aEvents: boolean[] = [];
    const bEvents: boolean[] = [];
    const a = observeExplorationEvents("explore-a", (_events, terminal) => {
      aEvents.push(terminal);
      aController.abort();
    }, aController.signal);
    const b = observeExplorationEvents("explore-b", (_events, terminal) => {
      bEvents.push(terminal);
      if (terminal) bController.abort();
    }, bController.signal);
    await Promise.resolve();
    await Promise.resolve();
    await vi.runOnlyPendingTimersAsync();
    await Promise.all([a, b]);
    expect(aEvents).toEqual([true]);
    expect(bEvents).toEqual([false, true]);
    expect(bController.signal.aborted).toBe(true);
  });

  it("retains the after cursor and rejects a sequence gap", async () => {
    apiRequest.mockResolvedValueOnce({ events: [{ sequence: 1 }], terminal: false }).mockResolvedValueOnce({ events: [{ sequence: 3 }], terminal: false });
    const controller = new AbortController();
    const observed: unknown[] = [];
    const promise = observeExplorationEvents("explore-gap", (events) => observed.push(...events), controller.signal);
    const rejected = expect(promise).rejects.toThrow("exploration_event_gap");
    await Promise.resolve();
    await Promise.resolve();
    await vi.runOnlyPendingTimersAsync();
    await rejected;
    expect(apiRequest.mock.calls[1][0]).toContain("after=1");
    expect(observed).toHaveLength(1);
  });
});
