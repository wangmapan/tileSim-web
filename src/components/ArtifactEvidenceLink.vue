<script setup lang="ts">
import { ScanSearch } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "../i18n";
import { artifactEvidenceRoute, parseArtifactPointerSource } from "../features/inspect-artifact";
import { useDashboard } from "../store/dashboard";

const props = defineProps<{ sourcePath?: string | null; label?: string }>();
const { state } = useDashboard();
const { t } = useI18n();

const target = computed(() => {
  if (!props.sourcePath) return null;
  const source = parseArtifactPointerSource(props.sourcePath);
  if (!source || !state.runId) return null;
  const entry = state.artifactManifest?.artifacts.find((artifact) => artifact.artifact_id === source.artifactId);
  if (!entry) return null;
  return {
    runId: state.runId,
    artifactId: source.artifactId,
    sha256: entry.sha256,
    pointer: source.pointer,
  };
});
</script>

<template>
  <RouterLink
    v-if="target"
    class="artifact-evidence-link"
    :to="artifactEvidenceRoute(target)"
    :title="t('在完整 JSON 中定位 {pointer}', { pointer: target.pointer || t('根 Pointer') })"
  >
    <ScanSearch :size="13" /><span>{{ label ? t(label) : t("查看原始证据") }}</span>
  </RouterLink>
</template>
