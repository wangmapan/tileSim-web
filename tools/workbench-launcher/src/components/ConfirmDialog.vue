<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";

const props = defineProps<{
  title: string;
  description: string;
  confirmLabel: string;
  dangerous?: boolean;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const cancelButton = ref<HTMLButtonElement>();
const confirmButton = ref<HTMLButtonElement>();

onMounted(async () => {
  await nextTick();
  cancelButton.value?.focus();
});

function keepFocusInside(event: KeyboardEvent) {
  if (event.shiftKey && document.activeElement === cancelButton.value) {
    event.preventDefault();
    confirmButton.value?.focus();
  } else if (!event.shiftKey && document.activeElement === confirmButton.value) {
    event.preventDefault();
    cancelButton.value?.focus();
  }
}
</script>

<template>
  <div class="dialog-layer" role="presentation" @mousedown.self="emit('cancel')">
    <section
      class="dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-description"
      @keydown.esc="emit('cancel')"
      @keydown.tab="keepFocusInside"
    >
      <div class="dialog__signal" :class="{ 'dialog__signal--danger': props.dangerous }" aria-hidden="true">!</div>
      <div>
        <h2 id="confirm-title">{{ props.title }}</h2>
        <p id="confirm-description">{{ props.description }}</p>
      </div>
      <footer>
        <button ref="cancelButton" type="button" class="button button--secondary" @click="emit('cancel')">返回</button>
        <button
          ref="confirmButton"
          type="button"
          class="button"
          :class="props.dangerous ? 'button--danger' : 'button--primary'"
          @click="emit('confirm')"
        >
          {{ props.confirmLabel }}
        </button>
      </footer>
    </section>
  </div>
</template>
