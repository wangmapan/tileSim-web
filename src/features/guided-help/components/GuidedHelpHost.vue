<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { guideFor } from "../catalog";
import { routedGuideIds, type GuideId, type HelpAnchor, type RoutedGuideId } from "../schema";
import { closeGuidedHelp, selectHelpTopic, useGuidedHelpState } from "../state";

const GuidedStepPanel = defineAsyncComponent(() => import("./GuidedStepPanel.vue"));
const props = defineProps<{ defaultGuideId: GuideId }>();
const { open, activeGuideId } = useGuidedHelpState();
const guide = computed(() => guideFor(activeGuideId.value));
const availableAnchors = ref<HelpAnchor[]>([]);
const route = useRoute();
const router = useRouter();

function destination(name: RoutedGuideId) {
  const query = ["experiment", "history", "evidence_lab"].includes(name)
    ? {}
    : {
        run: route.query.run,
        evidence_request: route.query.evidence_request,
      };
  return { name, query };
}
const pageHref = computed(() =>
  guide.value && (routedGuideIds as readonly string[]).includes(guide.value.id)
    ? router.resolve(destination(guide.value.id as RoutedGuideId)).href
    : null,
);
const relatedHref = computed(() => (guide.value ? router.resolve(destination(guide.value.next.routeName)).href : ""));

let releaseAnchorFocus: (() => void) | undefined;
onBeforeUnmount(() => releaseAnchorFocus?.());

async function locate(anchor: HelpAnchor) {
  releaseAnchorFocus?.();
  closeGuidedHelp(false);
  await nextTick();
  const target = document.querySelector<HTMLElement>(`[data-help-anchor="${anchor}"]`);
  if (!target) return;
  for (let ancestor = target.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
  }
  target.scrollIntoView({ behavior: "auto", block: "center" });
  const temporaryFocus = !target.matches("a[href], button, input, select, textarea, [tabindex]");
  if (temporaryFocus) {
    target.setAttribute("tabindex", "-1");
    const release = () => {
      target.removeAttribute("tabindex");
      target.removeEventListener("blur", release);
      releaseAnchorFocus = undefined;
    };
    releaseAnchorFocus = release;
    target.addEventListener("blur", release, { once: true });
  }
  target.focus({ preventScroll: true });
}

async function navigate(related: boolean) {
  if (!guide.value) return;
  const name = related ? guide.value.next.routeName : (guide.value.id as RoutedGuideId);
  closeGuidedHelp(false);
  await router.push(destination(name));
}

watch(
  () => props.defaultGuideId,
  () => {
    if (open.value) closeGuidedHelp();
  },
);
watch([open, activeGuideId], async ([isOpen]) => {
  if (!isOpen) return;
  await nextTick();
  if (!open.value) return;
  availableAnchors.value =
    guide.value?.steps
      .filter((step) => document.querySelector(`[data-help-anchor="${step.anchor}"]`))
      .map((step) => step.anchor) || [];
});
</script>

<template>
  <Teleport to="body">
    <GuidedStepPanel
      v-if="open && guide"
      :guide="guide"
      :context-guide-id="defaultGuideId"
      :available-anchors="availableAnchors"
      :page-href="pageHref"
      :related-href="relatedHref"
      @close="closeGuidedHelp()"
      @select="selectHelpTopic"
      @locate="locate"
      @navigate="navigate"
    />
  </Teleport>
</template>
