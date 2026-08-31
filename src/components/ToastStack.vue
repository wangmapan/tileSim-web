<script setup>
import { AlertCircle, CheckCircle2, Info, X } from "@lucide/vue";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";

const { state, dismissToast, pauseToast, resumeToast } = useDashboard();
const { t } = useI18n();
const icons = { positive: CheckCircle2, danger: AlertCircle, neutral: Info, warning: AlertCircle };
</script>

<template>
  <TransitionGroup name="toast-shift" tag="div" class="toast-stack">
    <div
      v-for="toast in state.toasts"
      :key="toast.id"
      class="toast"
      :class="`toast--${toast.tone}`"
      :role="toast.tone === 'danger' || toast.tone === 'warning' ? 'alert' : 'status'"
      :aria-live="toast.tone === 'danger' || toast.tone === 'warning' ? 'assertive' : 'polite'"
      @mouseenter="pauseToast(toast.id)"
      @mouseleave="resumeToast(toast.id)"
      @focusin="pauseToast(toast.id)"
      @focusout="resumeToast(toast.id)"
    >
      <component :is="icons[toast.tone] || Info" :size="18" />
      <span>{{ toast.message }}</span>
      <button :aria-label="t('关闭提示')" @click="dismissToast(toast.id)"><X :size="15" /></button>
    </div>
  </TransitionGroup>
</template>
