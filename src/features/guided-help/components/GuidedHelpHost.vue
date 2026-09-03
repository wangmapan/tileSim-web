<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "../../../i18n";
import { guideFor } from "../catalog";
import type { GuideId } from "../schema";
import { closeGuidedHelp, useGuidedHelpState } from "../state";
import GuidedStepPanel from "./GuidedStepPanel.vue";

const props = defineProps<{ defaultGuideId: GuideId }>();
const { open, activeGuideId, stepIndex } = useGuidedHelpState();
const guide = computed(() => guideFor(activeGuideId.value));
const targetAvailable = ref(false);
const liveMessage = ref("");
const router = useRouter();
const { t } = useI18n();
let highlighted: HTMLElement | null = null;
let temporaryTabIndex: HTMLElement | null = null;

function clearTarget() {
  highlighted?.removeAttribute("data-help-active");
  highlighted = null;
  if (temporaryTabIndex) temporaryTabIndex.removeAttribute("tabindex");
  temporaryTabIndex = null;
}

function currentTarget() {
  const anchor = guide.value?.steps[stepIndex.value]?.anchor;
  if (!anchor) return null;
  return document.querySelector<HTMLElement>(`[data-help-anchor="${anchor}"]`);
}

async function revealTarget() {
  await nextTick();
  clearTarget();
  const target = currentTarget();
  targetAvailable.value = Boolean(target);
  if (!target || !guide.value) {
    liveMessage.value = t("此步骤对应的内容在当前页面状态下暂不可见。");
    return;
  }
  highlighted = target;
  target.setAttribute("data-help-active", "true");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
  liveMessage.value = t("第 {current} 步：{title}", {
    current: stepIndex.value + 1,
    title: guide.value.steps[stepIndex.value]?.title || "",
  });
}

function locateTarget() {
  const target = currentTarget();
  if (!target) return;
  if (!target.matches("a[href], button, input, select, textarea, [tabindex]")) {
    target.setAttribute("tabindex", "-1");
    temporaryTabIndex = target;
  }
  target.focus({ preventScroll: true });
}

function previous() {
  stepIndex.value = Math.max(0, stepIndex.value - 1);
}

function next() {
  if (!guide.value) return;
  if (stepIndex.value >= guide.value.steps.length - 1) close();
  else stepIndex.value += 1;
}

function close() {
  clearTarget();
  closeGuidedHelp();
}

async function navigate() {
  if (!guide.value) return;
  const destination = guide.value.next.routeName;
  close();
  await router.push({ name: destination });
}

function onEscape(event: KeyboardEvent) {
  if (event.defaultPrevented || event.key !== "Escape" || !open.value) return;
  event.preventDefault();
  close();
}

watch(
  () => props.defaultGuideId,
  (nextGuideId) => {
    if (open.value && activeGuideId.value !== nextGuideId) close();
  },
);

watch([open, activeGuideId, stepIndex], ([isOpen]) => {
  if (isOpen) void revealTarget();
  else clearTarget();
});

watch(open, (isOpen, wasOpen) => {
  if (!isOpen || wasOpen) return;
  void nextTick(() => document.querySelector<HTMLButtonElement>(".guided-step-panel__header .icon-button")?.focus());
});

onMounted(() => window.addEventListener("keydown", onEscape));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onEscape);
  clearTarget();
});
</script>

<template>
  <Teleport to="body">
    <GuidedStepPanel
      v-if="open && guide"
      :guide="guide"
      :step-index="stepIndex"
      :target-available="targetAvailable"
      @close="close"
      @skip="close"
      @previous="previous"
      @next="next"
      @locate="locateTarget"
      @navigate="navigate"
    />
    <p class="visually-hidden" aria-live="polite" aria-atomic="true">{{ liveMessage }}</p>
  </Teleport>
</template>
