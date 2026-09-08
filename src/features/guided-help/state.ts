import { nextTick, readonly, ref } from "vue";
import type { GuideId } from "./schema";

const open = ref(false);
const activeGuideId = ref<GuideId>("overview");
const stepIndex = ref(0);
let returnFocus: HTMLElement | null = null;

export function openGuidedHelp(guideId: GuideId, trigger?: HTMLElement | null) {
  activeGuideId.value = guideId;
  stepIndex.value = 0;
  returnFocus = trigger || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  open.value = true;
}

export function selectHelpTopic(guideId: GuideId) {
  activeGuideId.value = guideId;
  stepIndex.value = 0;
}

export function closeGuidedHelp(restoreFocus = true) {
  open.value = false;
  const target = returnFocus;
  returnFocus = null;
  if (restoreFocus)
    void nextTick(() => {
      if (target?.isConnected) target.focus();
    });
}

export function useGuidedHelpState() {
  return {
    open: readonly(open),
    activeGuideId: readonly(activeGuideId),
    stepIndex,
  };
}
