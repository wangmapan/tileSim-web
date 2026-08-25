<script setup>
import { computed } from "vue";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "@lucide/vue";
import { formatNumber, statusLabel } from "../lib/format";
import { useDashboard } from "../store/dashboard";

const { state } = useDashboard();
const selected = computed(() =>
  state.history.selected
    .map((id) => ({
      id,
      run: state.history.runs.find((item) => item.run_id === id),
      data: state.history.comparisons[id],
    }))
    .filter((item) => item.data),
);

function metric(item, key) {
  const reports = item?.data?.artifacts || {};
  const metrics = reports.metrics || {};
  const run = reports.run || {};
  const values = {
    end_to_end_latency_us: run.summary?.end_to_end_latency_us,
    throughput: metrics.summary?.throughput_requests_per_second,
    ttft_p95: metrics.tail_latency_summary?.ttft_ps?.p95_ps,
    e2e_p95: metrics.tail_latency_summary?.end_to_end_latency_ps?.p95_ps,
    backpressure: metrics.system_summary?.max_fabric_backpressure_delay_us,
  };
  return values[key];
}

function outcome(a, b, lower = true) {
  if (typeof a !== "number" || typeof b !== "number" || a === b) return "neutral";
  return b < a === lower ? "improved" : "worsened";
}

function delta(a, b) {
  if (typeof a !== "number" || typeof b !== "number") return "—";
  return `${b - a >= 0 ? "+" : ""}${formatNumber(b - a)}`;
}

function percentDelta(a, b) {
  if (typeof a !== "number" || !a || typeof b !== "number") return "—";
  return `${formatNumber(Math.abs(((b - a) / a) * 100))}%`;
}

const measurements = [
  ["端到端延迟", "end_to_end_latency_us", "µs", true],
  ["吞吐", "throughput", "req/s", false],
  ["TTFT P95", "ttft_p95", "ps", true],
  ["端到端 P95", "e2e_p95", "ps", true],
  ["最大 Fabric 背压", "backpressure", "µs", true],
];

const settings = [
  ["调度策略", "batch_scheduler"],
  ["最大 batch", "max_batch_size"],
  ["最大活跃请求", "max_active_requests"],
  ["KV 容量", "kv_capacity_tokens"],
  ["KV 准入水位", "kv_admission_watermark"],
  ["Fabric 背压", "fabric_backpressure_active"],
  ["背压阈值", "fabric_backpressure_throttle_threshold_us"],
];

function setting(item, key) {
  return item?.data?.input?.runtime_trace?.policy?.[key];
}
function requestMap(item) {
  return new Map(
    (item?.data?.artifacts?.metrics?.request_metrics || []).map((request) => [request.request_id, request]),
  );
}
const requestIds = computed(() =>
  selected.value.length === 2
    ? [...new Set([...requestMap(selected.value[0]).keys(), ...requestMap(selected.value[1]).keys()])]
    : [],
);
</script>

<template>
  <div v-if="selected.length < 2" class="compare-placeholder">
    <div class="compare-venn"><span>A</span><span>B</span></div>
    <strong>选择两次已完成运行</strong>
    <p>对比指标、输入设置、请求级结果和证据边界。当前已选择 {{ state.history.selected.length }}/2。</p>
  </div>
  <div v-else class="comparison-panel">
    <header class="comparison-header">
      <div>
        <small>BASELINE · A</small><strong>{{ selected[0].run?.run_name || selected[0].id }}</strong>
      </div>
      <ArrowRight :size="20" />
      <div>
        <small>VARIANT · B</small><strong>{{ selected[1].run?.run_name || selected[1].id }}</strong>
      </div>
    </header>

    <section class="comparison-highlights">
      <article
        :class="outcome(metric(selected[0], 'end_to_end_latency_us'), metric(selected[1], 'end_to_end_latency_us'))"
      >
        <component
          :is="
            outcome(metric(selected[0], 'end_to_end_latency_us'), metric(selected[1], 'end_to_end_latency_us')) ===
            'improved'
              ? ArrowDownRight
              : ArrowUpRight
          "
          :size="20"
        />
        <div>
          <small>端到端延迟</small
          ><strong>{{
            percentDelta(metric(selected[0], "end_to_end_latency_us"), metric(selected[1], "end_to_end_latency_us"))
          }}</strong>
          <p>B 相对 A</p>
        </div>
      </article>
      <article :class="outcome(metric(selected[0], 'throughput'), metric(selected[1], 'throughput'), false)">
        <component
          :is="
            outcome(metric(selected[0], 'throughput'), metric(selected[1], 'throughput'), false) === 'improved'
              ? ArrowUpRight
              : ArrowDownRight
          "
          :size="20"
        />
        <div>
          <small>吞吐</small
          ><strong>{{ percentDelta(metric(selected[0], "throughput"), metric(selected[1], "throughput")) }}</strong>
          <p>B 相对 A</p>
        </div>
      </article>
      <article class="neutral">
        <Minus :size="20" />
        <div>
          <small>Fabric 背压变化</small
          ><strong>{{ delta(metric(selected[0], "backpressure"), metric(selected[1], "backpressure")) }} µs</strong>
          <p>B - A</p>
        </div>
      </article>
    </section>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>关键指标</th>
            <th class="numeric">A</th>
            <th class="numeric">B</th>
            <th class="numeric">变化</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in measurements" :key="row[1]">
            <td>
              <strong>{{ row[0] }}</strong>
            </td>
            <td class="numeric">{{ formatNumber(metric(selected[0], row[1])) }} {{ row[2] }}</td>
            <td class="numeric">{{ formatNumber(metric(selected[1], row[1])) }} {{ row[2] }}</td>
            <td class="numeric">
              <span
                class="delta-chip"
                :class="outcome(metric(selected[0], row[1]), metric(selected[1], row[1]), row[3])"
                >{{ delta(metric(selected[0], row[1]), metric(selected[1], row[1])) }} {{ row[2] }}</span
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <details class="detail-section" open>
      <summary>实验设置</summary>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>设置</th>
              <th>A</th>
              <th>B</th>
              <th>判断</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in settings"
              :key="row[1]"
              :class="{ 'changed-row': setting(selected[0], row[1]) !== setting(selected[1], row[1]) }"
            >
              <td>{{ row[0] }}</td>
              <td>{{ setting(selected[0], row[1]) ?? "—" }}</td>
              <td>{{ setting(selected[1], row[1]) ?? "—" }}</td>
              <td>{{ setting(selected[0], row[1]) === setting(selected[1], row[1]) ? "相同" : "关键差异" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>

    <details class="detail-section">
      <summary>请求级结果</summary>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>请求</th>
              <th class="numeric">A TTFT</th>
              <th class="numeric">B TTFT</th>
              <th class="numeric">A 端到端</th>
              <th class="numeric">B 端到端</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="id in requestIds" :key="id">
              <td>
                <strong>{{ id }}</strong>
              </td>
              <td class="numeric">{{ formatNumber(requestMap(selected[0]).get(id)?.ttft_ps) }} ps</td>
              <td class="numeric">{{ formatNumber(requestMap(selected[1]).get(id)?.ttft_ps) }} ps</td>
              <td class="numeric">{{ formatNumber(requestMap(selected[0]).get(id)?.end_to_end_latency_ps) }} ps</td>
              <td class="numeric">{{ formatNumber(requestMap(selected[1]).get(id)?.end_to_end_latency_ps) }} ps</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>

    <details class="detail-section">
      <summary>证据边界</summary>
      <div class="evidence-compare">
        <div v-for="(item, index) in selected" :key="item.id">
          <small>{{ index ? "B" : "A" }}</small>
          <dl>
            <div>
              <dt>来源</dt>
              <dd>{{ statusLabel(item.data.artifacts.validation?.trace_provenance?.source_mode) }}</dd>
            </div>
            <div>
              <dt>校准</dt>
              <dd>{{ statusLabel(item.data.artifacts.validation?.trace_provenance?.calibration_level) }}</dd>
            </div>
            <div>
              <dt>声明范围</dt>
              <dd>{{ statusLabel(item.data.artifacts.validation?.trace_provenance?.allowed_claim_scope) }}</dd>
            </div>
            <div>
              <dt>证据等级</dt>
              <dd>{{ statusLabel(item.data.artifacts.metrics?.evidence_tier) }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </details>

    <p class="comparison-scope">比较只描述两次模拟输出的差异，不等同于真实系统性能承诺。</p>
  </div>
</template>
