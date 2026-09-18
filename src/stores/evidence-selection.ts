import { computed, ref } from "vue";
import { defineStore } from "pinia";

export function isEvidenceRequestId(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 512) return false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return false;
  }
  return true;
}

export const useEvidenceSelectionStore = defineStore("evidence-selection", () => {
  const runId = ref<string | null>(null);
  const requestId = ref<string | null>(null);
  const hasSelection = computed(() => Boolean(runId.value && requestId.value));

  function clear() {
    runId.value = null;
    requestId.value = null;
  }

  function select(nextRunId: string, nextRequestId: string) {
    if (!/^run-[\w-]+$/.test(nextRunId) || !isEvidenceRequestId(nextRequestId)) {
      clear();
      return;
    }
    runId.value = nextRunId;
    requestId.value = nextRequestId;
  }

  function synchronizeRoute(nextRunId: string | null, routeRequestId: unknown) {
    if (!nextRunId) {
      clear();
      return;
    }
    if (runId.value !== nextRunId) {
      runId.value = nextRunId;
      requestId.value = isEvidenceRequestId(routeRequestId) ? routeRequestId : null;
      return;
    }
    if (isEvidenceRequestId(routeRequestId)) requestId.value = routeRequestId;
  }

  function requestForRun(nextRunId: string | null) {
    return nextRunId && runId.value === nextRunId ? requestId.value : null;
  }

  return { runId, requestId, hasSelection, clear, select, synchronizeRoute, requestForRun };
});
