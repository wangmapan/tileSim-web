<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "../../../i18n";
import type { ArtifactVirtualLine } from "../model/worker-contract";

const props = defineProps<{
  totalLines: number;
  lines: ArtifactVirtualLine[];
  activeLine: number | null;
  showPointers: boolean;
  revision: number;
}>();

const emit = defineEmits<{
  requestWindow: [startLine: number, lineCount: number];
}>();

const { t } = useI18n();
const scrollElement = ref<HTMLElement | null>(null);
const rowHeight = 22;
const windowSize = 120;
const overscan = 24;
let animationFrame = 0;
let lastRequestedStart = 0;

const spacerHeight = computed(() => Math.max(1, props.totalLines * rowHeight));
const viewerHeight = computed(() => Math.min(560, Math.max(120, props.totalLines * rowHeight)));
const windowOffset = computed(() => ((props.lines[0]?.lineNumber ?? 1) - 1) * rowHeight);
const loadedStart = computed(() => props.lines[0]?.lineNumber ?? 0);
const loadedEnd = computed(() => props.lines.at(-1)?.lineNumber ?? 0);

function boundedStart(startLine: number) {
  const maximum = Math.max(1, props.totalLines - windowSize + 1);
  return Math.min(maximum, Math.max(1, Math.floor(startLine)));
}

function requestWindow(startLine: number, force = false) {
  if (!props.totalLines) return;
  const start = boundedStart(startLine);
  if (!force && start === lastRequestedStart) return;
  lastRequestedStart = start;
  emit("requestWindow", start, Math.min(windowSize, props.totalLines - start + 1));
}

function requestVisibleWindow() {
  const element = scrollElement.value;
  if (!element || !props.totalLines) return;
  const firstVisible = Math.floor(element.scrollTop / rowHeight) + 1;
  const visibleCount = Math.max(1, Math.ceil(element.clientHeight / rowHeight));
  const visibleEnd = Math.min(props.totalLines, firstVisible + visibleCount - 1);
  if (
    !props.lines.length ||
    firstVisible < loadedStart.value + overscan / 2 ||
    visibleEnd > loadedEnd.value - overscan / 2
  ) {
    requestWindow(firstVisible - overscan);
  }
}

function onScroll() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(() => {
    animationFrame = 0;
    requestVisibleWindow();
  });
}

function scrollToLine(lineNumber: number) {
  if (!props.totalLines) return;
  const line = Math.min(props.totalLines, Math.max(1, Math.floor(lineNumber)));
  requestWindow(line - overscan, true);
  void nextTick(() => {
    scrollElement.value?.scrollTo({ top: (line - 1) * rowHeight });
  });
}

function onKeydown(event: KeyboardEvent) {
  const element = scrollElement.value;
  if (!element) return;
  if (event.key === "PageDown") element.scrollTop += element.clientHeight - rowHeight;
  else if (event.key === "PageUp") element.scrollTop -= element.clientHeight - rowHeight;
  else if (event.key === "Home") element.scrollTop = 0;
  else if (event.key === "End") element.scrollTop = Math.max(0, spacerHeight.value - element.clientHeight);
  else return;
  event.preventDefault();
  requestVisibleWindow();
}

watch(
  () => props.revision,
  () => {
    lastRequestedStart = 0;
    if (scrollElement.value) scrollElement.value.scrollTop = 0;
    requestWindow(1, true);
  },
);

onMounted(() => requestWindow(1, true));

onBeforeUnmount(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
});

defineExpose({ scrollToLine });
</script>

<template>
  <div
    ref="scrollElement"
    class="artifact-virtual-viewer"
    :class="{ 'artifact-virtual-viewer--pointers': showPointers }"
    :style="{ height: viewerHeight + 'px' }"
    role="region"
    :aria-label="t('JSON 虚拟行浏览器')"
    tabindex="0"
    @scroll="onScroll"
    @keydown="onKeydown"
  >
    <div class="artifact-virtual-spacer" :style="{ height: spacerHeight + 'px' }" aria-hidden="true"></div>
    <div class="artifact-virtual-lines" :style="{ transform: 'translateY(' + windowOffset + 'px)' }">
      <div
        v-for="line in lines"
        :key="line.lineNumber"
        class="artifact-virtual-line"
        :class="{ 'artifact-virtual-line--active': line.lineNumber === activeLine }"
        :aria-current="line.lineNumber === activeLine ? 'true' : undefined"
      >
        <span class="artifact-line-number">{{ line.lineNumber }}</span>
        <span
          v-if="showPointers"
          class="artifact-line-pointer"
          :title="line.pointer === '' ? t('根 Pointer') : line.pointer || undefined"
          >{{ line.pointer === "" ? t("根 Pointer") : line.pointer || "—" }}</span
        >
        <code class="artifact-line-text">{{ line.text }}</code>
        <span v-if="line.truncated" class="artifact-line-truncated">{{ t("本行窗口已截断") }}</span>
      </div>
    </div>
  </div>
</template>
