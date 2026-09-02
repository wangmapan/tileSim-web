<script setup lang="ts">
import { Lightbulb, Route } from "@lucide/vue";
import type { GuideDefinition } from "../schema";
import { openGuidedHelp } from "../state";
import { useI18n } from "../../../i18n";
import KeyTakeaway from "./KeyTakeaway.vue";

defineProps<{ guide: GuideDefinition }>();
const { t } = useI18n();

function start(guide: GuideDefinition, event: MouseEvent) {
  openGuidedHelp(guide.id, event.currentTarget as HTMLElement);
}
</script>

<template>
  <section class="page-primer" :aria-label="t(guide.title)" :data-help-anchor="`${guide.id}-primer`">
    <div class="page-primer__icon"><Lightbulb :size="21" aria-hidden="true" /></div>
    <div class="page-primer__copy">
      <small>{{ t("先看这里") }}</small>
      <strong>{{ t(guide.title) }}</strong>
      <p>{{ t(guide.description) }}</p>
      <KeyTakeaway :text="guide.takeaway" />
    </div>
    <button type="button" class="button button--secondary page-primer__start" @click="start(guide, $event)">
      <Route :size="16" aria-hidden="true" />{{ t("开始逐步指引") }}
    </button>
  </section>
</template>
