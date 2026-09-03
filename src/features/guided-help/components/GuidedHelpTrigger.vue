<script setup lang="ts">
import { CircleHelp } from "@lucide/vue";
import type { GuideId } from "../schema";
import { openGuidedHelp } from "../state";
import { useI18n } from "../../../i18n";

withDefaults(defineProps<{ guideId: GuideId; label?: string }>(), { label: "查看使用指引" });
const { t } = useI18n();

function open(guideId: GuideId, event: MouseEvent) {
  openGuidedHelp(guideId, event.currentTarget as HTMLElement);
}
</script>

<template>
  <button type="button" class="guided-help-trigger" @click="open(guideId, $event)">
    <CircleHelp :size="15" aria-hidden="true" />{{ t(label) }}
  </button>
</template>
