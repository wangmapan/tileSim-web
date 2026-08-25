<script setup>
import { ArrowDown, ArrowUp, TimerReset } from "@lucide/vue";
import EmptyState from "../components/EmptyState.vue";
import StatCard from "../components/StatCard.vue";
import StatusPill from "../components/StatusPill.vue";
import { formatNumber } from "../lib/format";
import { useDashboard } from "../store/dashboard";

const { state } = useDashboard();
</script>

<template>
  <EmptyState v-if="!state.bundle.metrics" title="没有性能指标报告" />
  <div v-else class="view-stack">
    <section class="stat-grid">
      <StatCard
        label="吞吐"
        :value="`${formatNumber(state.bundle.metrics.summary?.throughput_requests_per_second)} req/s`"
        :hint="`${state.bundle.metrics.summary?.completed_request_count || 0}/${state.bundle.metrics.summary?.request_count || 0} 请求完成`"
        accent
      />
      <StatCard
        label="TTFT P95"
        :value="`${formatNumber(state.bundle.metrics.tail_latency_summary?.ttft_ps?.p95_ps)} ps`"
        :hint="`P99 ${formatNumber(state.bundle.metrics.tail_latency_summary?.ttft_ps?.p99_ps)} ps`"
      />
      <StatCard
        label="TPOT P95"
        :value="`${formatNumber(state.bundle.metrics.tail_latency_summary?.tpot_ps?.p95_ps)} ps`"
        :hint="`P99 ${formatNumber(state.bundle.metrics.tail_latency_summary?.tpot_ps?.p99_ps)} ps`"
      />
      <StatCard
        label="端到端 P95"
        :value="`${formatNumber(state.bundle.metrics.tail_latency_summary?.end_to_end_latency_ps?.p95_ps)} ps`"
        :hint="`P99 ${formatNumber(state.bundle.metrics.tail_latency_summary?.end_to_end_latency_ps?.p99_ps)} ps`"
      />
    </section>

    <article class="panel">
      <header class="panel-header panel-header--row">
        <div>
          <p class="section-kicker">REQUEST METRICS</p>
          <h2>请求级结果</h2>
          <p>每个请求在统一时间轴上的首 token、逐 token 与完成时延。</p>
        </div>
        <div class="panel-count">
          <TimerReset :size="16" />{{ state.bundle.metrics.request_metrics?.length || 0 }} requests
        </div>
      </header>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>请求</th>
              <th>状态</th>
              <th class="numeric">TTFT</th>
              <th class="numeric">TPOT</th>
              <th class="numeric">端到端</th>
              <th class="numeric">Decode steps</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in state.bundle.metrics.request_metrics || []" :key="request.request_id">
              <td>
                <strong>{{ request.request_id }}</strong>
              </td>
              <td><StatusPill :value="request.status" /></td>
              <td class="numeric">{{ formatNumber(request.ttft_ps) }} <small>ps</small></td>
              <td class="numeric">{{ formatNumber(request.tpot_ps) }} <small>ps</small></td>
              <td class="numeric">
                <strong>{{ formatNumber(request.end_to_end_latency_ps) }}</strong> <small>ps</small>
              </td>
              <td class="numeric">{{ formatNumber(request.decode_step_count, 0) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>

    <section class="metric-footnote">
      <ArrowDown :size="17" />
      <p><strong>如何理解这些数字</strong>延迟越低通常越好，但结论必须与证据来源、负载输入和实际 fidelity 一起判断。</p>
      <ArrowUp :size="17" />
    </section>
  </div>
</template>
