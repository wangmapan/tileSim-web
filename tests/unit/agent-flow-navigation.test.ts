import { describe, expect, it, vi } from "vitest";
import {
  isAgentNavigationAuthorization,
  recoverAgentNavigation,
  selectAgentNavigationCandidate,
} from "../../src/features/agent-flow/navigation";

describe("agent navigation executor", () => {
  it("accepts only the closed navigation authorization shape", () => {
    const authorization = {
      max_navigation_attempts: 3,
      max_model_calls: 1,
      max_tool_calls_per_round: 1,
      max_run_creations: 1,
      max_execution_time_ms: 30_000,
      allowed_pages: ["metrics"],
      allowed_actions: ["navigate"],
    };
    expect(isAgentNavigationAuthorization(authorization)).toBe(true);
    expect(isAgentNavigationAuthorization({ ...authorization, allowed_actions: ["execute"] })).toBe(false);
    expect(isAgentNavigationAuthorization({ ...authorization, extra: true })).toBe(false);
  });

  it("does not execute without an explicit navigate action grant", async () => {
    await expect(
      recoverAgentNavigation(["metrics"], {
        allowedPages: ["metrics"],
        allowedActions: [],
        maxAttempts: 1,
        maxExecutionTimeMs: 30_000,
        navigate: vi.fn(),
        readContext: vi.fn(),
      }),
    ).rejects.toThrow("navigation_action_not_authorized");
  });

  it("accepts only published, authorized and unvisited page ids", () => {
    expect(
      selectAgentNavigationCandidate(["https://example.invalid", "metrics", "fabric"], {
        allowedPages: ["metrics", "fabric"],
        requiredCapabilities: ["fabric"],
        visitedPages: [],
      }),
    ).toBe("fabric");
    expect(
      selectAgentNavigationCandidate(["metrics", "fabric"], {
        allowedPages: ["metrics", "fabric"],
        requiredCapabilities: [],
        visitedPages: ["metrics", "fabric"],
      }),
    ).toBeNull();
  });

  it("fails closed when durable navigation history contains an unknown page", async () => {
    await expect(
      recoverAgentNavigation(["metrics"], {
        allowedPages: ["metrics"],
        allowedActions: ["navigate"],
        visitedPages: ["metrics", "page-invented-by-model"],
        navigationAttempts: 2,
        maxAttempts: 3,
        maxExecutionTimeMs: 30_000,
        navigate: vi.fn(),
        readContext: vi.fn(),
      }),
    ).rejects.toThrow("navigation_history_invalid");
  });

  it("replans after a failed page and does not repeat a visited page", async () => {
    const navigate = vi.fn(async (page: string) => {
      if (page === "metrics") throw new Error("fixture navigation failure");
    });
    const readContext = vi
      .fn()
      .mockResolvedValueOnce({
        page_id: "overview",
        context_revision: "ctx-1",
        run_ref: { run_id: "run-1", revision: "ctx-1" },
        capabilities: [],
      })
      .mockResolvedValueOnce({
        page_id: "fabric",
        context_revision: "ctx-1",
        run_ref: { run_id: "run-1", revision: "ctx-1" },
        capabilities: ["fabric"],
      });

    const result = await recoverAgentNavigation(["metrics", "fabric"], {
      allowedPages: ["metrics", "fabric"],
      allowedActions: ["navigate"],
      maxAttempts: 2,
      maxExecutionTimeMs: 30_000,
      expectedRunId: "run-1",
      expectedContextRevision: "ctx-1",
      navigate,
      readContext,
    });
    expect(result.status).toBe("navigated");
    expect(navigate.mock.calls.map(([page]) => page)).toEqual(["metrics", "fabric"]);
    expect(result.failures[0]?.failure_type).toBe("navigation_error");
  });

  it("stops stale when the page publishes a changed run identity", async () => {
    const controller = new AbortController();
    const onObservation = vi.fn().mockResolvedValue("stale" as const);
    const result = await recoverAgentNavigation(["metrics"], {
      allowedPages: ["metrics"],
      allowedActions: ["navigate"],
      maxAttempts: 2,
      maxExecutionTimeMs: 30_000,
      expectedRunId: "run-1",
      expectedContextRevision: "ctx-1",
      navigate: vi.fn(),
      readContext: vi.fn().mockResolvedValue({
        page_id: "metrics",
        context_revision: "ctx-2",
        run_ref: { run_id: "run-2", revision: "ctx-2" },
        capabilities: ["metrics"],
      }),
      signal: controller.signal,
      onObservation,
    });
    expect(result.status).toBe("stale");
    expect(result.observation?.failure_type).toBe("stale_identity");
    expect(onObservation).toHaveBeenCalledTimes(1);
  });

  it("stops the local loop before trying a second candidate when cancelled", async () => {
    const controller = new AbortController();
    const navigate = vi.fn(async (page: string) => {
      if (page === "metrics") throw new Error("fixture navigation failure");
    });
    const onObservation = vi.fn(async () => {
      controller.abort();
      return "continue" as const;
    });
    await expect(
      recoverAgentNavigation(["metrics", "fabric"], {
        allowedPages: ["metrics", "fabric"],
        allowedActions: ["navigate"],
        maxAttempts: 2,
        maxExecutionTimeMs: 30_000,
        navigate,
        readContext: vi.fn(),
        onObservation,
        signal: controller.signal,
      }),
    ).rejects.toThrow("navigation_cancelled");
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(onObservation).toHaveBeenCalledTimes(1);
  });

  it("continues from the durable visited-page cursor and cumulative budget", async () => {
    const navigate = vi.fn(async () => {
      throw new Error("fixture navigation failure");
    });
    const result = await recoverAgentNavigation(["metrics", "fabric"], {
      allowedPages: ["metrics", "fabric"],
      allowedActions: ["navigate"],
      visitedPages: ["metrics"],
      navigationAttempts: 1,
      maxAttempts: 2,
      maxExecutionTimeMs: 30_000,
      navigate,
      readContext: vi.fn().mockResolvedValue({
        route_name: "overview",
        context_revision: "ctx-1",
        run_id: null,
        capabilities: [],
      }),
    });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("fabric");
    expect(result.status).toBe("waiting_user");
    expect(result.observation?.navigation_attempts).toBe(2);
    expect(result.observation?.visited_pages).toEqual(["metrics", "fabric"]);
  });

  it("rejects an inconsistent durable navigation cursor instead of resetting it", async () => {
    await expect(
      recoverAgentNavigation(["metrics"], {
        allowedPages: ["metrics"],
        allowedActions: ["navigate"],
        visitedPages: ["metrics"],
        navigationAttempts: 0,
        maxAttempts: 2,
        maxExecutionTimeMs: 30_000,
        navigate: vi.fn(),
        readContext: vi.fn(),
      }),
    ).rejects.toThrow("navigation_history_invalid");
  });

  it("bounds a hanging navigation adapter by the execution-time budget", async () => {
    const result = await recoverAgentNavigation(["metrics"], {
      allowedPages: ["metrics"],
      allowedActions: ["navigate"],
      maxAttempts: 2,
      maxExecutionTimeMs: 5,
      navigate: () => new Promise<void>(() => undefined),
      readContext: vi.fn(),
    });
    expect(result.status).toBe("waiting_user");
    expect(result.observation?.failure_type).toBe("navigation_error");
    expect(result.observation?.retry_allowed).toBe(false);
  });

  it("does not offer a retry after a context read exhausts the execution budget", async () => {
    const result = await recoverAgentNavigation(["metrics"], {
      allowedPages: ["metrics"],
      allowedActions: ["navigate"],
      maxAttempts: 2,
      maxExecutionTimeMs: 5,
      navigate: vi.fn(),
      readContext: () => new Promise<never>(() => undefined),
    });
    expect(result.status).toBe("waiting_user");
    expect(result.observation?.failure_type).toBe("context_unavailable");
    expect(result.observation?.retry_allowed).toBe(false);
  });
});
