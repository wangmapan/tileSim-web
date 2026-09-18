import { computed, reactive, ref } from "vue";
import { defineStore } from "pinia";
import { isWorkspaceView, navItems, type WorkspaceView } from "../entities/navigation/model";
import type { ExperimentSubmissionState } from "../entities/dashboard/types";

const experimentSubmissionKey = "tilesim-web.experiment-submission.v1";

function emptyExperimentSubmission(): ExperimentSubmissionState {
  return { payloadText: "", idempotencyKey: "", runId: "" };
}

function restoreExperimentSubmission(): ExperimentSubmissionState {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(experimentSubmissionKey) || "null");
    if (
      saved &&
      typeof saved.payloadText === "string" &&
      typeof saved.idempotencyKey === "string" &&
      typeof saved.runId === "string"
    ) {
      return saved;
    }
  } catch {
    // Session recovery is optional.
  }
  return emptyExperimentSubmission();
}

export const useSessionStore = defineStore("session", () => {
  const view = ref<WorkspaceView>("overview");
  const busy = ref(false);
  const mobileNavOpen = ref(false);
  const toasts = reactive<Array<{ id: string; message: string; tone: string }>>([]);
  const toastTimers = new Map<string, number>();
  const experimentSubmission = reactive(restoreExperimentSubmission());
  const currentTitle = computed(() => navItems.find((item) => item.id === view.value)?.label || "新建实验");

  function setCurrentView(value: unknown) {
    view.value = isWorkspaceView(value) ? value : "overview";
    mobileNavOpen.value = false;
  }

  function notify(message: string, tone = "neutral") {
    const id = crypto.randomUUID();
    toasts.push({ id, message, tone });
    if (tone !== "danger" && tone !== "warning") resumeToast(id);
  }

  function dismissToast(id: string) {
    pauseToast(id);
    const index = toasts.findIndex((toast) => toast.id === id);
    if (index >= 0) toasts.splice(index, 1);
  }

  function pauseToast(id: string) {
    const timer = toastTimers.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    toastTimers.delete(id);
  }

  function resumeToast(id: string) {
    const toast = toasts.find((item) => item.id === id);
    if (!toast || toast.tone === "danger" || toast.tone === "warning" || toastTimers.has(id)) return;
    toastTimers.set(
      id,
      window.setTimeout(() => dismissToast(id), 6000),
    );
  }

  function updateExperimentSubmission(updates: Partial<ExperimentSubmissionState>) {
    Object.assign(experimentSubmission, updates);
    try {
      window.sessionStorage.setItem(experimentSubmissionKey, JSON.stringify(experimentSubmission));
    } catch {
      // The Pinia store still survives view navigation.
    }
  }

  function clearExperimentSubmission() {
    Object.assign(experimentSubmission, emptyExperimentSubmission());
    try {
      window.sessionStorage.removeItem(experimentSubmissionKey);
    } catch {
      // Session recovery is optional.
    }
  }

  return {
    view,
    busy,
    mobileNavOpen,
    toasts,
    experimentSubmission,
    currentTitle,
    setCurrentView,
    notify,
    dismissToast,
    pauseToast,
    resumeToast,
    updateExperimentSubmission,
    clearExperimentSubmission,
  };
});
