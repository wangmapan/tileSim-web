<script setup>
import { Activity, Network, Waves } from "@lucide/vue";
import EmptyState from "../components/EmptyState.vue";
import StatCard from "../components/StatCard.vue";
import { formatNumber, formatPercent } from "../lib/format";
import { useDashboard } from "../store/dashboard";

const { state } = useDashboard();
const domains = () => state.bundle.metrics?.system_summary?.fabric_domain_utilization || [];
</script>

<template>
  <EmptyState v-if="!domains().length" title="没有 Fabric 域数据" />
  <div v-else class="view-stack">
    <section class="stat-grid stat-grid--three">
      <StatCard
        label="总体利用率"
        :value="formatPercent(state.bundle.metrics.system_summary?.fabric_utilization_ratio)"
        hint="跨活跃 Fabric 域"
        accent
      />
      <StatCard
        label="最大背压"
        :value="`${formatNumber(state.bundle.metrics.system_summary?.max_fabric_backpressure_delay_us)} µs`"
        hint="当前观测窗口"
      />
      <StatCard label="活跃域" :value="formatNumber(domains().length, 0)" hint="Scale-up / Scale-out" />
    </section>

    <section class="domain-grid">
      <article v-for="domain in domains()" :key="domain.domain_id" class="panel domain-card">
        <header>
          <div class="domain-icon"><Network :size="19" /></div>
          <div>
            <small>FABRIC DOMAIN</small>
            <h2>{{ domain.domain_id }}</h2>
          </div>
          <strong>{{ formatPercent(domain.utilization_ratio) }}</strong>
        </header>
        <div class="utilization-track">
          <span :style="{ width: `${Math.min((domain.utilization_ratio || 0) * 100, 100)}%` }"></span>
        </div>
        <dl>
          <div>
            <dt><Activity :size="14" />执行记录</dt>
            <dd>{{ formatNumber(domain.record_count, 0) }}</dd>
          </div>
          <div>
            <dt><Waves :size="14" />队列延迟</dt>
            <dd>{{ formatNumber(domain.queue_delay_us) }} µs</dd>
          </div>
          <div>
            <dt>拥塞延迟</dt>
            <dd>{{ formatNumber(domain.congestion_delay_us) }} µs</dd>
          </div>
          <div>
            <dt>运行时间</dt>
            <dd>{{ formatNumber(domain.runtime_us) }} µs</dd>
          </div>
        </dl>
      </article>
    </section>

    <article class="panel">
      <header class="panel-header">
        <div>
          <p class="section-kicker">DOMAIN COMPARISON</p>
          <h2>域明细</h2>
          <p>利用率描述模拟 Fabric 的占用，不等同于真实集群链路计数器。</p>
        </div>
      </header>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>域</th>
              <th class="numeric">记录数</th>
              <th class="numeric">利用率</th>
              <th class="numeric">队列延迟</th>
              <th class="numeric">拥塞延迟</th>
              <th class="numeric">运行时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="domain in domains()" :key="domain.domain_id">
              <td>
                <strong>{{ domain.domain_id }}</strong>
              </td>
              <td class="numeric">{{ formatNumber(domain.record_count, 0) }}</td>
              <td class="numeric">{{ formatPercent(domain.utilization_ratio) }}</td>
              <td class="numeric">{{ formatNumber(domain.queue_delay_us) }} µs</td>
              <td class="numeric">{{ formatNumber(domain.congestion_delay_us) }} µs</td>
              <td class="numeric">{{ formatNumber(domain.runtime_us) }} µs</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </div>
</template>
