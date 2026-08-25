<script setup>
import {
  Activity,
  ChartNoAxesCombined,
  FlaskConical,
  Gauge,
  History,
  Network,
  PanelLeftClose,
  ShieldCheck,
} from "@lucide/vue";
import { navItems, useDashboard } from "../store/dashboard";

const { state, setView, checkBridge } = useDashboard();
const icons = {
  overview: Gauge,
  metrics: ChartNoAxesCombined,
  fabric: Network,
  attribution: Activity,
  validation: ShieldCheck,
  history: History,
};
</script>

<template>
  <aside class="app-sidebar" :class="{ 'is-open': state.mobileNavOpen }">
    <div class="sidebar-brand">
      <div class="brand-glyph" aria-hidden="true"><span></span><span></span><span></span></div>
      <div><strong>TileSim</strong><small>仿真实验台</small></div>
      <button class="icon-button mobile-only" aria-label="关闭导航" @click="state.mobileNavOpen = false">
        <PanelLeftClose :size="19" />
      </button>
    </div>

    <button class="new-run-button" @click="setView('experiment')">
      <FlaskConical :size="17" />
      <span>新建实验</span>
    </button>

    <nav aria-label="主导航">
      <p class="nav-caption">分析工作区</p>
      <button
        v-for="item in navItems"
        :key="item.id"
        class="nav-link"
        :class="{ active: state.view === item.id }"
        @click="setView(item.id)"
      >
        <component :is="icons[item.id]" :size="18" stroke-width="1.8" />
        <span
          ><strong>{{ item.label }}</strong
          ><small>{{ item.description }}</small></span
        >
      </button>
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
        ><strong>{{ state.bridge.checking ? "正在检查" : state.bridge.title }}</strong
        ><small>{{ state.bridge.detail }}</small></span
      >
    </button>
  </aside>
  <button
    v-if="state.mobileNavOpen"
    class="nav-backdrop mobile-only"
    aria-label="关闭导航"
    @click="state.mobileNavOpen = false"
  ></button>
</template>
