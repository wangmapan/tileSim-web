<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { RouterView, useRoute } from "vue-router";
import AppHeader from "./components/AppHeader.vue";
import AppSidebar from "./components/AppSidebar.vue";
import EvidenceStrip from "./components/EvidenceStrip.vue";
import ToastStack from "./components/ToastStack.vue";
import UnsupportedSchemaView from "./views/UnsupportedSchemaView.vue";
import { useDashboard } from "./store/dashboard";
import { unsupportedSchemaReports } from "./lib/reports";
import { useI18n } from "./i18n";
import { useEvidenceSelectionStore } from "./stores/evidence-selection";

const activeRoute = useRoute();
const { state, initialize, synchronizeNavigation } = useDashboard();
const unsupported = computed(() => unsupportedSchemaReports(state.bundle));
const rejectedUnsupported = computed(
  () => state.artifactManifest?.rejected_artifacts.filter((item) => item.reason === "unsupported_schema") || [],
);
const showUnsupported = computed(
  () =>
    (unsupported.value.length > 0 || rejectedUnsupported.value.length > 0) &&
    !["experiment", "history", "evidence_lab"].includes(state.view),
);
const { t } = useI18n();
const evidenceSelection = useEvidenceSelectionStore();

const requestedRunId = computed(() => navigationSnapshot().runId);
const navigationUnavailable = computed(
  () =>
    Boolean(requestedRunId.value) &&
    requestedRunId.value !== state.runId &&
    !state.busy &&
    !state.bridge.checking &&
    !state.bridge.connected,
);

function navigationSnapshot() {
  const value = Array.isArray(activeRoute.query.run) ? activeRoute.query.run[0] : activeRoute.query.run;
  return {
    view: typeof activeRoute.name === "string" ? activeRoute.name : "overview",
    runId: typeof value === "string" && /^run-[\w-]+$/.test(value) ? value : null,
  };
}

watch(
  () => activeRoute.fullPath,
  () => {
    const navigation = navigationSnapshot();
    void synchronizeNavigation(navigation.view, navigation.runId);
  },
);
watch(
  () => [state.runId, activeRoute.query.evidence_request] as const,
  ([runId, requestId]) => evidenceSelection.synchronizeRoute(runId, requestId),
  { immediate: true },
);
onMounted(() => initialize(navigationSnapshot()));
</script>

<template>
  <div class="app-shell">
    <AppSidebar />
    <main class="app-main">
      <AppHeader />
      <div class="workspace">
        <section v-if="navigationUnavailable" class="navigation-error" role="alert">
          <strong>{{ t("无法载入链接中的运行") }}</strong>
          <span>{{
            t("本地 Bridge 当前未连接，因此没有展示 {runId} 的证据；下方仍是先前已验证的内容。", {
              runId: requestedRunId || "—",
            })
          }}</span>
        </section>
        <EvidenceStrip v-if="!['experiment', 'evidence_lab'].includes(state.view)" />
        <RouterView v-slot="{ Component, route }">
          <Transition name="view-fade" mode="out-in">
            <component :is="showUnsupported ? UnsupportedSchemaView : Component" :key="String(route.name)" />
          </Transition>
        </RouterView>
      </div>
    </main>
    <ToastStack />
    <div v-if="state.busy" class="global-busy" :aria-label="t('正在载入')"><span></span></div>
  </div>
</template>
