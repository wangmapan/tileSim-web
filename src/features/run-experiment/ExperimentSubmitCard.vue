<script setup>
import { LoaderCircle, Play } from "@lucide/vue";
import { useI18n } from "../../i18n";

defineProps({
  canRun: Boolean,
  submitting: Boolean,
  runStatus: { type: String, default: "" },
});
defineEmits(["submit"]);
const { t } = useI18n();
</script>

<template>
  <div class="run-submit-actions" :aria-label="t('运行操作')">
    <button class="button button--primary run-submit" :disabled="!canRun" @click="$emit('submit')">
      <LoaderCircle v-if="submitting" class="spin" :size="17" /><Play v-else :size="17" />{{
        submitting ? t("正在运行") : t("运行 TileSim 模拟")
      }}
    </button>
    <p v-if="runStatus" class="run-progress" role="status">{{ runStatus }}</p>
  </div>
</template>
