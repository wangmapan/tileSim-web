<script setup lang="ts">
import { Bot, DatabaseZap, RefreshCw, ShieldAlert } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import type { Week7EvidenceBundle } from "../features/week7-evidence";
import { fetchWeek7Evidence } from "../features/week7-evidence";
import { formatNumber, formatPercent } from "../lib/format";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";

const { state } = useDashboard();
const { t } = useI18n();
const data = ref<Week7EvidenceBundle | null>(null);
const loading = ref(false);
const loadError = ref("");

const queryContext = computed(() => {
  const identity = state.bridge.identity;
  return {
    backendIdentity: [
      identity?.source_revision,
      identity?.build_revision,
      identity?.source_state_digest,
      identity?.build_state_digest,
      identity?.deployment_ref,
    ]
      .filter((value): value is string => Boolean(value))
      .join("|"),
    schemaRevision: state.bridge.manifest?.schema_set_revision || "unknown",
  };
});

function displayError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function load(refresh = false) {
  loading.value = true;
  loadError.value = "";
  try {
    data.value = await fetchWeek7Evidence(queryContext.value, { refresh });
  } catch (error) {
    loadError.value = displayError(error);
  } finally {
    loading.value = false;
  }
}

function operatingRegion(region: Record<string, string>) {
  return Object.entries(region)
    .map(([key, value]) => `${key}=${value}`)
    .join(" · ");
}

onMounted(() => void load());
</script>

<template>
  <div class="view-stack week7-view">
    <section class="week7-hero">
      <div>
        <p class="section-kicker">WEEK 7 · S8 / S9 / AGENT</p>
        <h2>{{ t("校准、证据血缘与确定性编排") }}</h2>
        <p>
          {{
            t(
              "直接读取最新本地 TileSim 的内置只读示例，展示后端实际报告；页面不重算指标，也不接受任意路径或 CLI 参数。",
            )
          }}
        </p>
      </div>
      <button class="button button--secondary" type="button" :disabled="loading" @click="load(true)">
        <RefreshCw :size="16" :class="{ 'is-spinning': loading }" />
        {{ loading ? t("正在读取") : t("刷新证据") }}
      </button>
    </section>

    <section class="week7-boundary" role="note">
      <ShieldAlert :size="21" />
      <div>
        <strong>{{ t("当前证据边界") }}</strong>
        <p>
          {{
            t(
              "校准结果仅证明离线 fixture 工作流一致性，不是 H100、CUDA、NCCL、DCGM 或 PAPI 的真实测量，不能据此生成保真度百分比或真实 held-out fidelity 声明。",
            )
          }}
        </p>
      </div>
    </section>

    <section v-if="loadError" class="navigation-error" role="alert">
      <strong>{{ t("Week 7 证据读取失败") }}</strong>
      <span>{{ loadError }}</span>
      <button class="button button--secondary button--small" type="button" @click="load(true)">{{ t("重试") }}</button>
    </section>

    <section v-if="loading && !data" class="panel week7-loading" aria-live="polite">
      <span class="week7-loading-dot"></span>
      <p>{{ t("正在运行固定的只读证据工作流…") }}</p>
    </section>

    <template v-if="data">
      <article class="panel week7-section">
        <header class="panel-header week7-section-header">
          <div class="week7-heading-icon"><DatabaseZap :size="19" /></div>
          <div>
            <p class="section-kicker">S8 · CALIBRATION</p>
            <h2>{{ t("离线校准工作流") }}</h2>
            <p>{{ t("模型选择与 held-out fixture 评估相互隔离；资产 ID 和哈希保持可审计。") }}</p>
          </div>
          <span class="status-pill" :class="data.calibration.status === 'passed' ? 'status-pill--positive' : ''">
            {{ data.calibration.status }}
          </span>
        </header>

        <dl class="week7-summary-grid">
          <div>
            <dt>{{ t("证据层级") }}</dt>
            <dd>{{ data.calibration.evidence_tier }}</dd>
          </div>
          <div>
            <dt>{{ t("允许声明范围") }}</dt>
            <dd>{{ data.calibration.allowed_claim_scope }}</dd>
          </div>
          <div>
            <dt>{{ t("清单 ID") }}</dt>
            <dd>{{ data.calibration.manifest_id }}</dd>
          </div>
          <div>
            <dt>{{ t("校准范围数") }}</dt>
            <dd>{{ data.calibration.scopes.length }}</dd>
          </div>
        </dl>

        <div class="table-wrap week7-table-wrap">
          <table class="week7-table week7-calibration-table">
            <thead>
              <tr>
                <th>{{ t("子系统 / 范围") }}</th>
                <th>{{ t("仿射模型") }}</th>
                <th>{{ t("样本") }}</th>
                <th>{{ t("Held-out 相对误差") }}</th>
                <th>{{ t("资产证据") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="scope in data.calibration.scopes" :key="`${scope.subsystem}:${scope.fit_scope}`">
                <td>
                  <strong>{{ scope.subsystem }} · {{ scope.fit_scope }}</strong>
                  <small>{{ operatingRegion(scope.operating_region) }}</small>
                  <small>{{ scope.input_unit }} → {{ scope.observed_unit }}</small>
                </td>
                <td>
                  <strong>{{ scope.selected_model.model_kind }}</strong>
                  <small>slope {{ formatNumber(scope.selected_model.slope) }}</small>
                  <small>intercept {{ formatNumber(scope.selected_model.intercept) }}</small>
                </td>
                <td>
                  <span>{{ t("校准 {count}", { count: scope.calibration_sample_count }) }}</span>
                  <small>{{ t("留出 {count}", { count: scope.held_out_sample_count }) }}</small>
                </td>
                <td>
                  <strong>{{ t("P95 {value}", { value: formatPercent(scope.held_out_p95_relative_error) }) }}</strong>
                  <small>{{ t("最大 {value}", { value: formatPercent(scope.held_out_max_relative_error) }) }}</small>
                  <small>{{ t("预算 {value}", { value: formatPercent(scope.relative_error_budget) }) }}</small>
                  <span class="status-pill" :class="scope.error_budget_passed ? 'status-pill--positive' : ''">
                    {{ scope.error_budget_passed ? t("通过") : t("未通过") }}
                  </span>
                </td>
                <td>
                  <details class="week7-assets">
                    <summary>{{ t("查看 ID 与 SHA-256") }}</summary>
                    <div>
                      <strong>calibration</strong>
                      <code v-for="(asset, index) in scope.calibration_asset_ids" :key="asset">
                        {{ asset }} · {{ scope.calibration_asset_sha256[index] }}
                      </code>
                      <strong>held_out_validation</strong>
                      <code v-for="(asset, index) in scope.held_out_asset_ids" :key="asset">
                        {{ asset }} · {{ scope.held_out_asset_sha256[index] }}
                      </code>
                    </div>
                  </details>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel week7-section">
        <header class="panel-header week7-section-header">
          <div class="week7-heading-icon"><DatabaseZap :size="19" /></div>
          <div>
            <p class="section-kicker">S9 · REPORT FIELD EVIDENCE MAP</p>
            <h2>{{ t("报告字段证据血缘") }}</h2>
            <p>{{ t("逐字段说明来源对象、计算规则、验证门禁和允许声明；这是一张关系表，不是性能数值图。") }}</p>
          </div>
          <span class="status-pill status-pill--positive">{{ data.evidenceMap.status }}</span>
        </header>
        <div class="table-wrap week7-table-wrap">
          <table class="week7-table week7-evidence-table">
            <thead>
              <tr>
                <th>{{ t("报告 / 字段") }}</th>
                <th>{{ t("来源对象") }}</th>
                <th>{{ t("计算规则") }}</th>
                <th>{{ t("验证门禁") }}</th>
                <th>{{ t("允许声明") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rule in data.evidenceMap.rules" :key="`${rule.report_kind}:${rule.field_path}`">
                <td>
                  <strong>{{ rule.report_kind }}</strong
                  ><code>{{ rule.field_path }}</code>
                </td>
                <td>{{ rule.source_object }}</td>
                <td>{{ rule.computation_rule }}</td>
                <td>
                  <code>{{ rule.validation_check }}</code>
                </td>
                <td>{{ rule.allowed_claim }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel week7-section">
        <header class="panel-header week7-section-header">
          <div class="week7-heading-icon"><Bot :size="19" /></div>
          <div>
            <p class="section-kicker">DETERMINISTIC AGENT ORCHESTRATION</p>
            <h2>{{ t("固定工具调用编排") }}</h2>
            <p>{{ t("这是可复现的五步结构化编排，不是生成具体原因或优化建议的自然语言 Agent。") }}</p>
          </div>
          <span class="status-pill" :class="data.orchestration.status === 'completed' ? 'status-pill--positive' : ''">
            {{ data.orchestration.status }}
          </span>
        </header>

        <dl class="week7-summary-grid week7-agent-summary">
          <div>
            <dt>intent_id</dt>
            <dd>{{ data.orchestration.intent_id }}</dd>
          </div>
          <div>
            <dt>run_instance_id</dt>
            <dd>{{ data.orchestration.run_instance_id }}</dd>
          </div>
          <div>
            <dt>frozen_configuration_digest</dt>
            <dd>{{ data.orchestration.frozen_configuration_digest }}</dd>
          </div>
          <div>
            <dt>simulation_result_status</dt>
            <dd>
              <span class="status-pill status-pill--warning">{{ data.orchestration.simulation_result_status }}</span>
            </dd>
          </div>
        </dl>

        <ol class="week7-timeline">
          <li v-for="call in data.orchestration.tool_calls" :key="call.sequence">
            <span>{{ call.sequence }}</span>
            <div>
              <small>{{ call.status }}</small>
              <strong>{{ call.tool_name }}</strong>
              <code>{{ call.input_digest }}</code>
              <p>{{ call.output_reference }}</p>
            </div>
          </li>
        </ol>

        <div class="week7-artifacts">
          <article v-for="artifact in data.orchestration.artifact_results" :key="artifact.artifact_id">
            <div>
              <strong>{{ artifact.artifact_id }}</strong
              ><span class="status-pill status-pill--positive">{{ artifact.state }}</span>
            </div>
            <code>{{ artifact.payload_digest }}</code>
          </article>
        </div>
      </article>
    </template>
  </div>
</template>
