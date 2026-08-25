<script setup>
import { ArrowRight, Braces, Clock3, FileJson, Gauge, Network, Play, ShieldCheck } from "@lucide/vue";
import StatCard from "../components/StatCard.vue";
import StatusPill from "../components/StatusPill.vue";
import { formatNumber, formatPercent } from "../lib/format";
import { rawArtifactUrl } from "../lib/api";
import { useDashboard } from "../store/dashboard";

const { state, runSummary, evidence, setView, filteredRuns, openRun } = useDashboard();
const artifacts = [
  ["input-runtime-trace", "Runtime trace", "输入"],
  ["input-topology", "Fabric topology", "输入"],
  ["run-result", "Run result", "结果"],
  ["metrics", "Metrics", "结果"],
  ["validation", "Validation", "证据"],
  ["tail-cause-chain", "Tail cause chain", "证据"],
  ["execution-envelope", "Execution envelope", "事件"],
  ["metadata", "Run metadata", "元数据"],
];
</script>

<template>
  <div class="view-stack">
    <section v-if="state.isDemo" class="demo-notice">
      <div>
        <Braces :size="18" /><span
          ><strong>正在浏览内置示例</strong>这些数字用于说明界面结构，不是一次新的本地运行。</span
        >
      </div>
      <button class="text-button" @click="setView('history')">打开已有运行<ArrowRight :size="15" /></button>
    </section>

    <section class="overview-hero">
      <div class="hero-copy">
        <p class="section-kicker">RUN SUMMARY</p>
        <div class="hero-status">
          <h2>{{ state.bundle.run?.status === "partial" ? "运行已完成，证据范围受限" : "运行结果已就绪" }}</h2>
          <StatusPill :value="state.bundle.run?.status || 'unknown'" />
        </div>
        <p>
          {{
            state.bundle.metrics?.claim_scope_summary ||
            state.bundle.run?.cause ||
            "打开验证报告以确认本次运行可支持的结论。"
          }}
        </p>
        <div class="hero-actions">
          <button class="button button--primary" @click="setView('metrics')">
            查看性能指标<ArrowRight :size="16" />
          </button>
          <button class="button button--secondary" @click="setView('validation')">
            <ShieldCheck :size="16" />检查证据范围
          </button>
        </div>
      </div>
      <div class="hero-measure">
        <span>端到端模拟窗口</span>
        <strong>{{ formatNumber(runSummary.end_to_end_latency_us) }}</strong>
        <small>微秒 · {{ runSummary.execution_path || "hosted" }} execution</small>
      </div>
    </section>

    <section class="stat-grid">
      <StatCard
        label="吞吐"
        :value="`${formatNumber(state.bundle.metrics?.summary?.throughput_requests_per_second)} req/s`"
        :hint="`${state.bundle.metrics?.summary?.completed_request_count || 0}/${state.bundle.metrics?.summary?.request_count || 0} 请求完成`"
        accent
      />
      <StatCard
        label="运行时事件"
        :value="formatNumber(runSummary.runtime_event_count, 0)"
        hint="S1 runtime evidence"
      />
      <StatCard
        label="Fabric 记录"
        :value="formatNumber(runSummary.fabric_record_count, 0)"
        hint="S6 realization records"
      />
      <StatCard
        label="验证完整度"
        :value="formatPercent(runSummary.validation_completeness)"
        hint="不是准确率或真实保证"
      />
    </section>

    <section class="two-column-layout">
      <article class="panel">
        <header class="panel-header">
          <div>
            <p class="section-kicker">RUN FACTS</p>
            <h2>本次运行</h2>
          </div>
        </header>
        <dl class="fact-list">
          <div>
            <dt><Gauge :size="16" />执行边界</dt>
            <dd>{{ runSummary.range_label || "—" }}</dd>
          </div>
          <div>
            <dt><Network :size="16" />统一宿主</dt>
            <dd>{{ runSummary.host_path || "—" }}</dd>
          </div>
          <div>
            <dt><ShieldCheck :size="16" />证据通道</dt>
            <dd>{{ evidence.lane.replaceAll("_", " ") }}</dd>
          </div>
          <div>
            <dt><Clock3 :size="16" />尾归因</dt>
            <dd>{{ runSummary.has_tail_attribution ? "已生成" : "未生成" }}</dd>
          </div>
        </dl>
      </article>

      <article class="panel next-action-panel">
        <header class="panel-header">
          <div>
            <p class="section-kicker">NEXT ACTION</p>
            <h2>继续实验</h2>
          </div>
        </header>
        <p>复制当前思路，调整调度、batch、KV 或 Fabric 参数，生成一份独立的可对比运行。</p>
        <button class="button button--primary button--wide" @click="setView('experiment')">
          <Play :size="16" />配置新实验
        </button>
      </article>
    </section>

    <article v-if="state.runId" class="panel">
      <header class="panel-header">
        <div>
          <p class="section-kicker">RAW ARTIFACTS</p>
          <h2>原始工件</h2>
          <p>所有链接都指向本次运行的独立目录。</p>
        </div>
      </header>
      <div class="artifact-grid">
        <a
          v-for="artifact in artifacts"
          :key="artifact[0]"
          :href="rawArtifactUrl(state.runId, artifact[0])"
          target="_blank"
          rel="noopener"
          class="artifact-link"
        >
          <FileJson :size="18" /><span
            ><strong>{{ artifact[1] }}</strong
            ><small>{{ artifact[2] }}</small></span
          ><ArrowRight :size="15" />
        </a>
      </div>
    </article>

    <article v-if="state.bridge.available && filteredRuns.length" class="panel compact-recent">
      <header class="panel-header panel-header--row">
        <div>
          <p class="section-kicker">RECENT RUNS</p>
          <h2>最近实验</h2>
        </div>
        <button class="text-button" @click="setView('history')">查看全部<ArrowRight :size="15" /></button>
      </header>
      <div class="recent-list">
        <button v-for="run in filteredRuns.slice(0, 3)" :key="run.run_id" @click="openRun(run.run_id)">
          <span
            ><strong>{{ run.run_name || "未命名实验" }}</strong
            ><small>{{ run.input_mode || "legacy" }} · {{ run.run_id }}</small></span
          >
          <span class="recent-metric">{{ formatNumber(run.digest?.end_to_end_latency_us) }} µs</span
          ><ArrowRight :size="16" />
        </button>
      </div>
    </article>
  </div>
</template>
