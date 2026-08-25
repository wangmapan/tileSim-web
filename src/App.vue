<script setup>
import { computed, onMounted } from "vue";
import AppHeader from "./components/AppHeader.vue";
import AppSidebar from "./components/AppSidebar.vue";
import EvidenceStrip from "./components/EvidenceStrip.vue";
import ToastStack from "./components/ToastStack.vue";
import AttributionView from "./views/AttributionView.vue";
import ExperimentView from "./views/ExperimentView.vue";
import FabricView from "./views/FabricView.vue";
import HistoryView from "./views/HistoryView.vue";
import MetricsView from "./views/MetricsView.vue";
import OverviewView from "./views/OverviewView.vue";
import ValidationView from "./views/ValidationView.vue";
import { useDashboard } from "./store/dashboard";

const { state, initialize } = useDashboard();
const views = {
  overview: OverviewView,
  metrics: MetricsView,
  fabric: FabricView,
  attribution: AttributionView,
  validation: ValidationView,
  history: HistoryView,
  experiment: ExperimentView,
};
const activeView = computed(() => views[state.view] || OverviewView);

onMounted(initialize);
</script>

<template>
  <div class="app-shell">
    <AppSidebar />
    <main class="app-main">
      <AppHeader />
      <div class="workspace">
        <EvidenceStrip v-if="state.view !== 'experiment'" />
        <Transition name="view-fade" mode="out-in">
          <component :is="activeView" :key="state.view" />
        </Transition>
      </div>
    </main>
    <ToastStack />
    <div v-if="state.busy" class="global-busy" aria-label="正在载入"><span></span></div>
  </div>
</template>
