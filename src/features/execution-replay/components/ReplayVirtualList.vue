<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

/**
 * Small fixed-row virtual window used by replay evidence lists.
 *
 * The source array remains owned by the caller and is never sliced here.  The
 * component only controls which row range is mounted, while top/bottom spacer
 * heights preserve the scroll geometry.  This is deliberately slot based so
 * tables can keep their native semantics and route rows can keep their
 * existing controls and evidence links.
 */
const props = withDefaults(
  defineProps<{
    total: number;
    rowHeight: number;
    activeIndex?: number | null;
    overscan?: number;
    minHeight?: number;
    maxHeight?: number;
    ariaLabel?: string;
    role?: "list" | "region";
  }>(),
  {
    activeIndex: null,
    overscan: 8,
    minHeight: 180,
    maxHeight: 420,
    ariaLabel: "可滚动证据列表",
    role: "list",
  },
);

const scrollElement = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
let animationFrame = 0;

const viewportHeight = computed(() => {
  const elementHeight = scrollElement.value?.clientHeight || props.maxHeight;
  return Math.max(1, elementHeight);
});
const visibleRows = computed(() => Math.max(1, Math.ceil(viewportHeight.value / props.rowHeight)));
const startIndex = computed(() => {
  const candidate = Math.floor(scrollTop.value / props.rowHeight) - props.overscan;
  return Math.max(0, Math.min(Math.max(0, props.total - 1), candidate));
});
const endIndex = computed(() => Math.min(props.total, startIndex.value + visibleRows.value + props.overscan * 2));
const topSpacerHeight = computed(() => startIndex.value * props.rowHeight);
const bottomSpacerHeight = computed(() => Math.max(0, (props.total - endIndex.value) * props.rowHeight));
const viewportStyle = computed(() => ({
  height: `${Math.min(props.maxHeight, Math.max(props.minHeight, props.total * props.rowHeight))}px`,
}));

const emit = defineEmits<{ rangeChange: [startIndex: number, endIndex: number] }>();

function updateScrollTop() {
  const element = scrollElement.value;
  if (!element) return;
  scrollTop.value = element.scrollTop;
  emit("rangeChange", startIndex.value, endIndex.value);
}

function onScroll() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(() => {
    animationFrame = 0;
    updateScrollTop();
  });
}

function scrollToIndex(index: number) {
  const element = scrollElement.value;
  if (!element || !props.total) return;
  const bounded = Math.max(0, Math.min(props.total - 1, Math.floor(index)));
  const top = bounded * props.rowHeight;
  const bottom = top + props.rowHeight;
  if (top < element.scrollTop) element.scrollTop = top;
  else if (bottom > element.scrollTop + element.clientHeight) element.scrollTop = bottom - element.clientHeight;
  updateScrollTop();
}

function onKeydown(event: KeyboardEvent) {
  const element = scrollElement.value;
  if (!element) return;
  const amount = Math.max(props.rowHeight, element.clientHeight - props.rowHeight);
  if (event.key === "PageDown") element.scrollTop += amount;
  else if (event.key === "PageUp") element.scrollTop -= amount;
  else if (event.key === "Home") element.scrollTop = 0;
  else if (event.key === "End") element.scrollTop = Math.max(0, props.total * props.rowHeight - element.clientHeight);
  else return;
  event.preventDefault();
  updateScrollTop();
}

watch(
  () => props.activeIndex,
  (index) => {
    if (index === null || index === undefined || index < 0 || index >= props.total) return;
    void nextTick(() => scrollToIndex(index));
  },
  { immediate: true },
);

watch(
  () => props.total,
  () => {
    if (!props.total || !scrollElement.value) return;
    const maxScroll = Math.max(0, props.total * props.rowHeight - scrollElement.value.clientHeight);
    if (scrollElement.value.scrollTop > maxScroll) scrollElement.value.scrollTop = maxScroll;
    updateScrollTop();
  },
);

onMounted(() => {
  updateScrollTop();
  if (props.activeIndex !== null && props.activeIndex !== undefined) scrollToIndex(props.activeIndex);
});

onBeforeUnmount(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
});

defineExpose({ scrollToIndex });
</script>

<template>
  <div
    ref="scrollElement"
    class="replay-virtual-list"
    :style="viewportStyle"
    :role="role"
    :aria-label="ariaLabel"
    :aria-setsize="role === 'list' ? total : undefined"
    tabindex="0"
    @scroll="onScroll"
    @keydown="onKeydown"
  >
    <slot
      :start-index="startIndex"
      :end-index="endIndex"
      :top-spacer-height="topSpacerHeight"
      :bottom-spacer-height="bottomSpacerHeight"
    />
  </div>
</template>

<style scoped>
.replay-virtual-list {
  width: 100%;
  min-width: 0;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  contain: strict;
}

.replay-virtual-list:focus-visible {
  outline: 2px solid var(--accent-hover);
  outline-offset: -2px;
}

.replay-virtual-list :deep([aria-hidden="true"]) {
  pointer-events: none;
  user-select: none;
}
</style>
