<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter, type RouteLocationRaw } from "vue-router";
import { guideFor } from "../catalog";
import {
  isGuideInScope,
  routedGuideIds,
  type GuideId,
  type GuideScope,
  type HelpAnchor,
  type RoutedGuideId,
} from "../schema";
import { closeGuidedHelp, selectHelpTopic, useGuidedHelpState } from "../state";

const GuidedStepPanel = defineAsyncComponent(() => import("./GuidedStepPanel.vue"));
const props = withDefaults(defineProps<{ defaultGuideId: GuideId; scope?: GuideScope }>(), {
  scope: "professional",
});
const { open, activeGuideId } = useGuidedHelpState();
const guide = computed(() => (isGuideInScope(activeGuideId.value, props.scope) ? guideFor(activeGuideId.value) : null));
const availableAnchors = ref<HelpAnchor[]>([]);
const route = useRoute();
const router = useRouter();

function firstString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

function lightweightQuery(): Record<string, string> {
  const query: Record<string, string> = {};
  const run = firstString(route.query.run);
  // Run-bound lightweight pages may encode the run only in the canonical
  // `/lightweight/runs/:runId` path.  Carry that path identity into related
  // help destinations (especially Results) so opening a help link never
  // drops the run context and falls back to the empty state.
  const paramRun = firstString(route.params.runId);
  const carriedRun = run && /^run-[\w-]+$/.test(run) ? run : paramRun;
  if (carriedRun && /^run-[\w-]+$/.test(carriedRun)) query.run = carriedRun;
  for (const key of ["artifact_sha256", "schema_set_revision", "from"] as const) {
    const value = firstString(route.query[key]);
    if (value) query[key] = value;
  }
  return query;
}

function destination(name: RoutedGuideId): RouteLocationRaw | null {
  if (!isGuideInScope(name, props.scope)) return null;
  if (name.startsWith("lightweight")) {
    const query = lightweightQuery();
    if (name !== "lightweight_run") return { name, query };
    const runId = firstString(route.params.runId) || firstString(route.query.run);
    if (!runId || !/^run-[\w-]+$/.test(runId)) return null;
    return { name, params: { runId }, query };
  }
  const query = ["experiment", "history", "evidence_lab"].includes(name)
    ? {}
    : {
        run: route.query.run,
        evidence_request: route.query.evidence_request,
      };
  return { name, query };
}
const pageHref = computed(() => {
  if (!guide.value || !(routedGuideIds as readonly string[]).includes(guide.value.id)) return null;
  const target = destination(guide.value.id as RoutedGuideId);
  return target ? router.resolve(target).href : null;
});
const relatedHref = computed(() => {
  const target = guide.value ? destination(guide.value.next.routeName) : null;
  return target ? router.resolve(target).href : null;
});

let releaseAnchorFocus: (() => void) | undefined;
onBeforeUnmount(() => {
  releaseAnchorFocus?.();
  if (open.value) closeGuidedHelp(false);
});

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
  const target = destination(name);
  if (!target) return;
  closeGuidedHelp(false);
  await router.push(target);
}

function selectTopic(guideId: GuideId) {
  if (isGuideInScope(guideId, props.scope)) selectHelpTopic(guideId);
}

watch(
  () => props.defaultGuideId,
  () => {
    if (open.value) closeGuidedHelp();
  },
);
watch(
  [open, activeGuideId, () => props.scope],
  async ([isOpen, selectedGuideId]) => {
    if (!isOpen) return;
    if (!isGuideInScope(selectedGuideId as GuideId, props.scope)) {
      closeGuidedHelp(false);
      return;
    }
    await nextTick();
    if (!open.value) return;
    availableAnchors.value =
      guide.value?.steps
        .filter((step) => document.querySelector(`[data-help-anchor="${step.anchor}"]`))
        .map((step) => step.anchor) || [];
  },
  { immediate: true },
);
</script>

<template>
  <Teleport to="body">
    <GuidedStepPanel
      v-if="open && guide"
      :guide="guide"
      :context-guide-id="defaultGuideId"
      :scope="scope"
      :available-anchors="availableAnchors"
      :page-href="pageHref"
      :related-href="relatedHref"
      @close="closeGuidedHelp()"
      @select="selectTopic"
      @locate="locate"
      @navigate="navigate"
    />
  </Teleport>
</template>
