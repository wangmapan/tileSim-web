<script setup>
import {
  Activity,
  Bot,
  ChartNoAxesCombined,
  FlaskConical,
  Gauge,
  History,
  Layers3,
  Network,
  PanelLeftClose,
  ShieldCheck,
  ScanSearch,
  Workflow,
} from "@lucide/vue";
import { computed } from "vue";
import { navItems, useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";

const { state, setView, checkBridge } = useDashboard();
const { t } = useI18n();
const icons = {
  overview: Gauge,
  execution: Workflow,
  metrics: ChartNoAxesCombined,
  fabric: Network,
  design_space: Layers3,
  attribution: Activity,
  validation: ShieldCheck,
  evidence_agent: Bot,
  evidence_lab: ScanSearch,
  history: History,
};
const navGroups = computed(() => {
  const groups = [];
  for (const item of navItems) {
    let group = groups.find((entry) => entry.label === item.group);
    if (!group) {
      group = { label: item.group, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
});
const bridgeDetail = computed(() => {
  const health = state.bridge.identity;
  if (!health) return t("未连接本地执行服务");
  const source =
    health.source_revision && health.source_revision !== "unknown" ? health.source_revision.slice(0, 7) : t("未知");
  const build =
    health.build_revision && health.build_revision !== "unknown" ? health.build_revision.slice(0, 7) : t("未知");
  if (state.bridge.manifest?.legacy_unversioned) {
    return t("API 尚未版本化 · 历史报告可读 · 源码 {source} / CLI {build}", { source, build });
  }
  return t("{deployment} · 源码 {source} / CLI {build}", {
    deployment: health.deployment_ref || health.backend_branch || t("未托管"),
    source,
    build,
  });
});
</script>

<template>
  <aside class="app-sidebar" :class="{ 'is-open': state.mobileNavOpen }">
    <div class="sidebar-brand">
      <div class="brand-glyph" aria-hidden="true"><span></span><span></span><span></span></div>
      <div>
        <strong>TileSim</strong><small>{{ t("仿真实验台") }}</small>
      </div>
      <button class="icon-button mobile-only" :aria-label="t('关闭导航')" @click="state.mobileNavOpen = false">
        <PanelLeftClose :size="19" />
      </button>
    </div>

    <button class="new-run-button" @click="setView('experiment')">
      <FlaskConical :size="17" />
      <span>{{ t("新建实验") }}</span>
    </button>

    <nav :aria-label="t('主导航')">
      <section v-for="group in navGroups" :key="group.label" class="nav-group">
        <p class="nav-caption">{{ t(group.label) }}</p>
        <button
          v-for="item in group.items"
          :key="item.id"
          class="nav-link"
          :class="{ active: state.view === item.id }"
          @click="setView(item.id)"
        >
          <component :is="icons[item.id]" :size="18" stroke-width="1.8" />
          <span
            ><strong>{{ t(item.label) }}</strong
            ><small>{{ t(item.description) }}</small></span
          >
        </button>
      </section>
    </nav>

    <button
      class="bridge-card"
      :class="{ online: state.bridge.available, warning: state.bridge.identity && !state.bridge.synchronized }"
      :title="
        state.bridge.identity ? `${state.bridge.identity.tilesim_root}\n${state.bridge.identity.tilesim_cli}` : ''
      "
      @click="checkBridge"
    >
      <span class="bridge-dot"></span>
      <span
        ><strong>{{ state.bridge.checking ? t("正在检查") : t(state.bridge.title) }}</strong
        ><small>{{ bridgeDetail }}</small></span
      >
    </button>
  </aside>
  <button
    v-if="state.mobileNavOpen"
    class="nav-backdrop mobile-only"
    :aria-label="t('关闭导航')"
    @click="state.mobileNavOpen = false"
  ></button>
</template>
