import { beforeEach, describe, expect, it, vi } from "vitest";

const { listExplorations } = vi.hoisted(() => ({ listExplorations: vi.fn() }));
vi.mock("../../src/features/agent-exploration/api", () => ({ listExplorations }));

import { useExplorationLock } from "../../src/features/agent-exploration/exploration-lock";

const session = (state: string, authorization_id: string | null = "auth-1") =>
  ({
    session_id: `explore-${state}`,
    state,
    authorization_id,
    context_revision: "ctx-1",
    run_id: null,
  }) as never;

describe("exploration lock lifecycle", () => {
  beforeEach(() => {
    listExplorations.mockReset();
    useExplorationLock().unlock();
  });

  it("does not restore waiting authorization", async () => {
    listExplorations.mockResolvedValue({ sessions: [session("waiting_authorization", null)] });
    expect(await useExplorationLock().restore()).toBeNull();
    expect(useExplorationLock().locked.value).toBe(false);
  });

  it.each([
    "completed",
    "cancelled",
    "parameter_validation_failed",
    "run_failed",
    "authorization_expired",
    "authorization_revoked",
    "budget_exhausted",
    "context_expired",
    "recovery_required",
    "manual_intervention_required",
  ])("does not restore terminal state %s", async (state) => {
    listExplorations.mockResolvedValue({ sessions: [session(state)] });
    expect(await useExplorationLock().restore()).toBeNull();
    expect(useExplorationLock().locked.value).toBe(false);
  });

  it("restores only an authorized active session", async () => {
    listExplorations.mockResolvedValue({ sessions: [session("waiting_authorization", null), session("waiting_run")] });
    const restored = await useExplorationLock().restore();
    expect(restored?.state).toBe("waiting_run");
    expect(useExplorationLock().activeExplorationId.value).toBe("explore-waiting_run");
  });

  it("marks context changes expired without unlocking", () => {
    const lock = useExplorationLock();
    lock.lock("explore-context", { context_revision: "ctx-1", run_id: "run-1" });
    expect(lock.checkContext("ctx-2", "run-1")).toBe(false);
    expect(lock.expired.value).toBe(true);
    expect(lock.locked.value).toBe(true);
    expect(lock.checkContext("ctx-1", "run-2")).toBe(false);
    expect(lock.locked.value).toBe(true);
  });

  it("clears stale local state when activity lookup fails", async () => {
    const lock = useExplorationLock();
    lock.lock("stale-exploration", { context_revision: "ctx-1", run_id: null });
    listExplorations.mockRejectedValue(new Error("bridge unavailable"));
    expect(await lock.restore()).toBeNull();
    expect(lock.locked.value).toBe(false);
  });
});
