<script setup>
import { FileUp, Languages, Menu, Plus } from "@lucide/vue";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";
import ThemeSwitcher from "./ThemeSwitcher.vue";
import AppearanceToggle from "./AppearanceToggle.vue";

const { state, currentTitle, setView, importFiles, notify } = useDashboard();
const { isEnglish, t, toggleLocale } = useI18n();

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
    <Transition name="heading-swap" mode="out-in">
      <div :key="`${state.view}:${isEnglish}`" class="page-heading">
        <p>{{ state.view === "experiment" ? "EXPERIMENT BUILDER" : "EVIDENCE WORKSPACE" }}</p>
        <h1>{{ state.view === "experiment" ? t("新建实验") : t(currentTitle) }}</h1>
      </div>
    </Transition>
    <div class="header-actions">
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
      <label class="button button--ghost">
        <FileUp :size="16" />
        <span class="desktop-label">{{ t("导入报告") }}</span>
        <input type="file" accept="application/json,.json" multiple @change="onImport" />
      </label>
      <button v-if="state.view !== 'experiment'" class="button button--primary" @click="setView('experiment')">
        <Plus :size="16" />{{ t("新建实验") }}
      </button>
    </div>
  </header>
</template>
