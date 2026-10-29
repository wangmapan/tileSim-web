<script setup lang="ts">
import { CircleHelp } from "@lucide/vue";
import { useId } from "vue";
import { useI18n } from "../i18n";

const props = withDefaults(
  defineProps<{
    text: string;
    label?: string;
    interactive?: boolean;
    placement?: "start" | "center" | "end";
  }>(),
  { label: "", interactive: true, placement: "center" },
);

const { t } = useI18n();
const tooltipId = useId();
</script>

<template>
  <span class="inline-help">
    <button
      v-if="props.interactive"
      type="button"
      class="inline-help__trigger"
      :aria-label="props.label || t('查看说明')"
      :aria-describedby="tooltipId"
      aria-haspopup="true"
      @click.stop.prevent
    >
      <CircleHelp :size="15" :stroke-width="1.9" aria-hidden="true" />
    </button>
    <span
      v-else
      class="inline-help__trigger inline-help__trigger--passive"
      role="img"
      :aria-label="props.label || t('查看说明')"
      :aria-describedby="tooltipId"
    >
      <CircleHelp :size="15" :stroke-width="1.9" aria-hidden="true" />
    </span>
    <span :id="tooltipId" class="inline-help__bubble" :class="`inline-help__bubble--${props.placement}`" role="tooltip">
      {{ props.text }}
    </span>
  </span>
</template>

<style scoped>
.inline-help {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  vertical-align: middle;
  margin-left: 5px;
}

.inline-help__trigger {
  display: inline-grid;
  width: 20px;
  height: 20px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 999px;
  color: var(--muted);
  background: transparent;
  cursor: help;
  transition:
    color var(--motion-fast, 120ms) var(--ease-standard, ease),
    background-color var(--motion-fast, 120ms) var(--ease-standard, ease);
}

.inline-help__trigger:hover,
.inline-help__trigger:focus-visible {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  outline: none;
}

.inline-help__bubble {
  position: absolute;
  display: none;
  z-index: 30;
  top: calc(100% + 8px);
  left: 50%;
  width: max-content;
  max-width: min(360px, 42vw);
  padding: 8px 10px;
  border: 1px solid var(--line-strong);
  border-radius: 7px;
  color: var(--ink);
  background: var(--surface, var(--panel, #fff));
  box-shadow: 0 8px 24px color-mix(in srgb, var(--ink) 14%, transparent);
  font-size: var(--text-xs, 12px);
  font-weight: 400;
  line-height: 1.55;
  white-space: normal;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transform: translate(-50%, -3px);
  transition:
    opacity var(--motion-fast, 120ms) var(--ease-standard, ease),
    transform var(--motion-fast, 120ms) var(--ease-standard, ease),
    visibility var(--motion-fast, 120ms) var(--ease-standard, ease);
}

.inline-help__bubble::before {
  position: absolute;
  top: -5px;
  left: 50%;
  width: 8px;
  height: 8px;
  border-top: 1px solid var(--line-strong);
  border-left: 1px solid var(--line-strong);
  background: var(--surface, var(--panel, #fff));
  content: "";
  transform: translateX(-50%) rotate(45deg);
}

.inline-help__bubble--start {
  left: 0;
  transform: translate(0, -3px);
}

.inline-help__bubble--start::before {
  left: 10px;
  transform: rotate(45deg);
}

.inline-help__bubble--end {
  right: 0;
  left: auto;
  transform: translate(0, -3px);
}

.inline-help__bubble--end::before {
  right: 10px;
  left: auto;
  transform: rotate(45deg);
}

.inline-help:hover .inline-help__bubble,
.inline-help:focus-within .inline-help__bubble {
  display: block;
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, 0);
}

.inline-help:hover .inline-help__bubble--start,
.inline-help:focus-within .inline-help__bubble--start,
.inline-help:hover .inline-help__bubble--end,
.inline-help:focus-within .inline-help__bubble--end {
  transform: translate(0, 0);
}

@media (max-width: 720px) {
  .inline-help__bubble {
    right: 0;
    left: auto;
    max-width: min(300px, calc(100vw - 44px));
    transform: translate(0, -3px);
  }

  .inline-help__bubble::before {
    right: 7px;
    left: auto;
    transform: translateX(0) rotate(45deg);
  }

  .inline-help__bubble--start {
    right: auto;
    left: 0;
  }

  .inline-help__bubble--start::before {
    right: auto;
    left: 10px;
    transform: rotate(45deg);
  }

  .inline-help:hover .inline-help__bubble,
  .inline-help:focus-within .inline-help__bubble {
    transform: translate(0, 0);
  }
}
</style>
