<script setup lang="ts">
import { ArrowLeft, ArrowRight, LocateFixed, X } from "@lucide/vue";
import type { GuideDefinition } from "../schema";
import { useI18n } from "../../../i18n";
import KeyTakeaway from "./KeyTakeaway.vue";
import TermHelp from "./TermHelp.vue";

defineProps<{
  guide: GuideDefinition;
  stepIndex: number;
  targetAvailable: boolean;
}>();

const emit = defineEmits<{
  close: [];
  skip: [];
  previous: [];
  next: [];
  locate: [];
  navigate: [];
}>();

const { t } = useI18n();
</script>

<template>
  <aside class="guided-step-panel" role="region" :aria-label="t('页面逐步指引')">
    <header class="guided-step-panel__header">
      <div>
        <small>{{ t("页面逐步指引") }}</small>
        <h2>{{ t(guide.title) }}</h2>
      </div>
      <button type="button" class="icon-button" :aria-label="t('关闭指引')" @click="emit('close')">
        <X :size="18" aria-hidden="true" />
      </button>
    </header>

    <ol class="guided-step-list" :aria-label="t('指引步骤')">
      <li
        v-for="(step, index) in guide.steps"
        :key="step.id"
        :class="{ 'is-current': index === stepIndex, 'is-complete': index < stepIndex }"
        :aria-current="index === stepIndex ? 'step' : undefined"
      >
        <span>{{ index + 1 }}</span
        ><span>{{ t(step.title) }}</span>
      </li>
    </ol>

    <section class="guided-step-panel__current">
      <small>{{ t("第 {current} / {total} 步", { current: stepIndex + 1, total: guide.steps.length }) }}</small>
      <h3>{{ t(guide.steps[stepIndex].title) }}</h3>
      <p>{{ t(guide.steps[stepIndex].body) }}</p>
      <button v-if="targetAvailable" type="button" class="guided-locate-button" @click="emit('locate')">
        <LocateFixed :size="15" aria-hidden="true" />{{ t("定位到页面位置") }}
      </button>
      <p v-else class="guided-target-unavailable" role="status">
        {{ t("此步骤对应的内容在当前页面状态下暂不可见。") }}
      </p>
    </section>

    <KeyTakeaway :text="guide.takeaway" />

    <TermHelp label="术语解释" :count="guide.terms.length">
      <dl class="guided-term-list">
        <div v-for="term in guide.terms" :key="term.id">
          <dt>{{ t(term.term) }}</dt>
          <dd>{{ t(term.definition) }}</dd>
        </div>
      </dl>
    </TermHelp>

    <section class="guided-next-destination">
      <small>{{ t("完成本页后") }}</small>
      <button type="button" class="text-button" @click="emit('navigate')">
        {{ t(guide.next.label) }}<ArrowRight :size="15" aria-hidden="true" />
      </button>
    </section>

    <TermHelp :label="guide.advanced.title">
      <p>{{ t(guide.advanced.body) }}</p>
    </TermHelp>

    <footer class="guided-step-panel__footer">
      <button type="button" class="text-button" @click="emit('skip')">{{ t("跳过指引") }}</button>
      <span>
        <button type="button" class="button button--secondary" :disabled="stepIndex === 0" @click="emit('previous')">
          <ArrowLeft :size="15" aria-hidden="true" />{{ t("上一步") }}
        </button>
        <button type="button" class="button button--primary" @click="emit('next')">
          {{ stepIndex === guide.steps.length - 1 ? t("完成") : t("下一步") }}
          <ArrowRight :size="15" aria-hidden="true" />
        </button>
      </span>
    </footer>
  </aside>
</template>
