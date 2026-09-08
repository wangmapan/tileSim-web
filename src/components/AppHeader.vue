<script setup>
import { computed, ref } from "vue";
import { FileUp, Languages, Menu } from "@lucide/vue";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";
import ThemeSwitcher from "./ThemeSwitcher.vue";
import AppearanceToggle from "./AppearanceToggle.vue";

const { state, currentTitle, importFiles, notify } = useDashboard();
const { isEnglish, t, toggleLocale } = useI18n();
const importInput = ref(null);
const headerKickers = {
  overview: "实验结果",
  execution: "实验结果",
  metrics: "实验结果",
  fabric: "实验结果",
  attribution: "实验结果",
  validation: "实验结果",
  design_space: "方案探索",
  history: "实验管理",
  evidence_agent: "辅助解释",
  evidence_lab: "证据工具",
  experiment: "实验配置",
};
const headerKicker = computed(() => headerKickers[state.view] || "TILESIM");

async function onImport(event) {
  const files = [...(event.target.files || [])];
  if (!files.length) return;
  try {
    await importFiles(files);
  } catch (error) {
    notify(t("导入失败：{message}", { message: error.message }), "danger");
  } finally {
    event.target.value = "";
  }
}
</script>

<template>
  <header class="app-header">
    <button class="icon-button mobile-only" :aria-label="t('打开导航')" @click="state.mobileNavOpen = true">
      <Menu :size="21" />
    </button>
    <div class="page-heading">
      <p>{{ t(headerKicker) }}</p>
      <div>
        <h1>{{ state.view === "experiment" ? t("新建实验") : t(currentTitle) }}</h1>
      </div>
    </div>
    <div class="header-actions">
      <slot />
      <AppearanceToggle />
      <ThemeSwitcher />
      <button
        class="button button--ghost language-toggle"
        type="button"
        :aria-label="isEnglish ? t('切换到中文') : t('切换到英文')"
        :title="isEnglish ? t('切换到中文') : t('切换到英文')"
        @click="toggleLocale"
      >
        <Languages :size="16" />
        <span>{{ isEnglish ? "中文" : "EN" }}</span>
      </button>
      <button class="button button--ghost" type="button" :aria-label="t('导入报告')" @click="importInput?.click()">
        <FileUp :size="16" aria-hidden="true" />
        <span class="desktop-label">{{ t("导入报告") }}</span>
      </button>
      <input ref="importInput" type="file" accept="application/json,.json" multiple hidden @change="onImport" />
    </div>
  </header>
</template>
