<script setup lang="ts">
import { X } from "@lucide/vue";
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "../i18n";

const { t } = useI18n();
const props = defineProps<{ open: boolean; title?: string }>();
const emit = defineEmits<{ close: [] }>();
const card = ref<HTMLElement | null>(null);
const titleId = `modal-title-${crypto.randomUUID()}`;
let previousFocus: HTMLElement | null = null;

function focusableElements() {
  return Array.from(
    card.value?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ) || [],
  ).filter((element) => !element.hidden && element.getClientRects().length > 0);
}

function restoreBackground() {
  const shell = document.querySelector<HTMLElement>(".app-shell");
  if (shell) shell.inert = false;
}

function close() {
  emit("close");
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    return;
  }
  if (event.key !== "Tab") return;
  const elements = focusableElements();
  if (!elements.length) {
    event.preventDefault();
    card.value?.focus();
    return;
  }
  const first = elements[0];
  const last = elements[elements.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

watch(
  () => props.open,
  async (open) => {
    const shell = document.querySelector<HTMLElement>(".app-shell");
    if (open) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (shell) shell.inert = true;
      await nextTick();
      const autofocus = card.value?.querySelector<HTMLElement>("[autofocus]");
      (autofocus || focusableElements()[0] || card.value)?.focus();
    } else {
      restoreBackground();
      previousFocus?.focus();
      previousFocus = null;
    }
  },
);

onBeforeUnmount(restoreBackground);
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open" class="modal-layer" @click.self="close">
        <section
          ref="card"
          class="modal-card"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
          @keydown="onKeydown"
        >
          <header>
            <h2 :id="titleId">{{ title }}</h2>
            <button class="icon-button" :aria-label="t('关闭')" @click="close"><X :size="18" /></button>
          </header>
          <slot />
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
