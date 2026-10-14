<script setup lang="ts">
import JsonArtifactPanel from "../components/JsonArtifactPanel.vue";
import { useI18n } from "../i18n";

const { t } = useI18n();
</script>

<template>
  <div class="view-stack raw-evidence-view">
    <p class="raw-evidence-note">
      {{ t("按工件查看原始 JSON；使用搜索、Pointer 和身份信息复核页面结论。") }}
    </p>
    <JsonArtifactPanel initially-open />
  </div>
</template>
