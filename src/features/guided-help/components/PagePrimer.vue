<script setup lang="ts">
import { CircleHelp } from "@lucide/vue";
import type { GuideDefinition } from "../schema";
import { openGuidedHelp, useGuidedHelpState } from "../state";
import { useI18n } from "../../../i18n";

defineProps<{ guide: GuideDefinition }>();
const { open } = useGuidedHelpState();
const { t } = useI18n();
</script>

<template>
  <div class="page-primer" :data-help-anchor="`${guide.id}-primer`">
    <button
      class="page-primer-trigger"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="openGuidedHelp(guide.id, $event.currentTarget as HTMLElement)"
    >
      <CircleHelp :size="16" aria-hidden="true" /><span>{{ t("页面帮助") }}</span>
    </button>
  </div>
</template>
