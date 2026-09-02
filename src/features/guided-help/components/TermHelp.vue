<script setup lang="ts">
import { ChevronDown } from "@lucide/vue";
import { nextTick, ref, useId } from "vue";
import { useI18n } from "../../../i18n";

withDefaults(
  defineProps<{
    label: string;
    count?: number;
  }>(),
  { count: undefined },
);

const expanded = ref(false);
const trigger = ref<HTMLButtonElement | null>(null);
const panelId = `term-help-${useId().replaceAll(":", "")}`;
const { t } = useI18n();

function toggle() {
  expanded.value = !expanded.value;
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape" || !expanded.value) return;
  event.preventDefault();
  expanded.value = false;
  void nextTick(() => trigger.value?.focus());
}
</script>

<template>
  <section class="term-help" @keydown="onKeydown">
    <button
      ref="trigger"
      type="button"
      class="term-help__trigger"
      :aria-expanded="expanded"
      :aria-controls="panelId"
      @click="toggle"
    >
      <span
        >{{ t(label) }}<small v-if="count !== undefined">{{ count }}</small></span
      >
      <ChevronDown :size="16" aria-hidden="true" />
    </button>
    <div v-show="expanded" :id="panelId" class="term-help__body">
      <slot />
    </div>
  </section>
</template>
