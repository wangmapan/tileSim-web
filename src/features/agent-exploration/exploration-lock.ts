import { computed, ref } from "vue";
import { listExplorations } from "./api";
import type { AgentHarnessExplorationSession } from "../../contracts/generated/agent-harness";
import { isExplorationActiveState } from "./types";
const activeExplorationId = ref<string | null>(null);
const locked = ref(false);
const binding = ref<{ contextRevision: string | null; runId: string | null } | null>(null);
const expired = ref(false);
const STORAGE_KEY = "tilesim.agent-exploration-lock";
export function shouldUnlockAfterCancel(state: unknown): boolean {
  return state === "cancelled";
}
function persist(): void {
  if (typeof localStorage === "undefined") return;
  if (!activeExplorationId.value) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: activeExplorationId.value, ...binding.value }));
}
export function useExplorationLock() {
  return {
    activeExplorationId: computed(() => activeExplorationId.value),
    locked: computed(() => locked.value),
    binding: computed(() => binding.value),
    expired: computed(() => expired.value),
    lock: (id: string, session?: Partial<Pick<AgentHarnessExplorationSession, "context_revision" | "run_id">>) => {
      activeExplorationId.value = id;
      locked.value = true;
      binding.value = { contextRevision: session?.context_revision || null, runId: session?.run_id || null };
      expired.value = false;
      persist();
    },
    unlock: () => {
      activeExplorationId.value = null;
      locked.value = false;
      binding.value = null;
      expired.value = false;
      persist();
    },
    restore: async (): Promise<AgentHarnessExplorationSession | null> => {
      let listed: Awaited<ReturnType<typeof listExplorations>>;
      try {
        listed = await listExplorations();
      } catch {
        // A refresh must not resurrect an unverifiable stale lock. The next
        // explicit exploration request will establish a fresh server binding.
        activeExplorationId.value = null;
        locked.value = false;
        binding.value = null;
        expired.value = false;
        persist();
        return null;
      }
      const candidate = listed.sessions.find(
        (session) => isExplorationActiveState(session.state) && Boolean(session.authorization_id),
      );
      // An authorization can complete while the initial list request is still
      // in flight. Keep the lock established by that authorization when the
      // older response still reports waiting_authorization (or omits the
      // session entirely); a later durable query will reconcile the state.
      if (
        !candidate &&
        activeExplorationId.value &&
        locked.value &&
        listed.sessions.every(
          (session) =>
            session.session_id !== activeExplorationId.value ||
            session.state === "waiting_authorization",
        )
      ) {
        return null;
      }
      if (!candidate) {
        activeExplorationId.value = null;
        locked.value = false;
        binding.value = null;
        expired.value = false;
        persist();
        return null;
      }
      activeExplorationId.value = candidate.session_id;
      locked.value = true;
      binding.value = { contextRevision: candidate.context_revision, runId: candidate.run_id || null };
      expired.value = false;
      persist();
      return candidate;
    },
    checkContext: (contextRevision: string | null, runId: string | null) => {
      const mismatch = Boolean(binding.value && ((binding.value.contextRevision && binding.value.contextRevision !== contextRevision) || (binding.value.runId && binding.value.runId !== runId)));
      expired.value = mismatch;
      return !mismatch;
    },
  };
}
