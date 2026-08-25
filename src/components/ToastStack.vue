<script setup>
import { AlertCircle, CheckCircle2, Info, X } from "@lucide/vue";
import { useDashboard } from "../store/dashboard";

const { state, dismissToast } = useDashboard();
const icons = { positive: CheckCircle2, danger: AlertCircle, neutral: Info, warning: AlertCircle };
</script>

<template>
  <div class="toast-stack" aria-live="polite">
    <div v-for="toast in state.toasts" :key="toast.id" class="toast" :class="`toast--${toast.tone}`">
      <component :is="icons[toast.tone] || Info" :size="18" />
      <span>{{ toast.message }}</span>
      <button aria-label="关闭提示" @click="dismissToast(toast.id)"><X :size="15" /></button>
    </div>
  </div>
</template>
