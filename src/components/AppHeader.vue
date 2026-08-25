<script setup>
import { FileUp, Menu, Plus } from "@lucide/vue";
import { useDashboard } from "../store/dashboard";

const { state, currentTitle, setView, importFiles, notify } = useDashboard();

async function onImport(event) {
  const files = [...(event.target.files || [])];
  if (!files.length) return;
  try {
    await importFiles(files);
  } catch (error) {
    notify(`导入失败：${error.message}`, "danger");
  } finally {
    event.target.value = "";
  }
}
</script>

<template>
  <header class="app-header">
    <button class="icon-button mobile-only" aria-label="打开导航" @click="state.mobileNavOpen = true">
      <Menu :size="21" />
    </button>
    <div class="page-heading">
      <p>{{ state.view === "experiment" ? "EXPERIMENT BUILDER" : "EVIDENCE WORKSPACE" }}</p>
      <h1>{{ state.view === "experiment" ? "新建实验" : currentTitle }}</h1>
    </div>
    <div class="header-actions">
      <label class="button button--ghost" aria-label="导入 JSON 报告">
        <FileUp :size="16" />
        <span class="desktop-label">导入报告</span>
        <input type="file" accept="application/json,.json" multiple @change="onImport" />
      </label>
      <button v-if="state.view !== 'experiment'" class="button button--primary" @click="setView('experiment')">
        <Plus :size="16" />新建实验
      </button>
    </div>
  </header>
</template>
