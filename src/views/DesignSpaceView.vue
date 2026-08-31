<script setup lang="ts">
import { AlertTriangle, ArrowRight, GitCompareArrows, Layers3, Route } from "@lucide/vue";
import { computed } from "vue";
import ArtifactEvidenceLink from "../components/ArtifactEvidenceLink.vue";
import EmptyState from "../components/EmptyState.vue";
import StatCard from "../components/StatCard.vue";
import StatusPill from "../components/StatusPill.vue";
import { formatNumber, statusLabel } from "../lib/format";
import { useDashboard } from "../store/dashboard";
import {
  buildDesignSpaceAnalysis,
  buildF7Capabilities,
  createDesignSpacePresentation,
  unresolvedCandidateKnobs,
} from "../features/f7-analysis";
import { useI18n } from "../i18n";

const { state } = useDashboard();
const { t } = useI18n();
const report = computed(() => state.bundle.design_space);
const candidates = computed(() => report.value?.candidates || report.value?.ranking || []);
const formalAnalysis = computed(() => buildDesignSpaceAnalysis(report.value, state.artifactManifest));
const f7Capabilities = computed(() =>
  buildF7Capabilities(report.value, state.artifactManifest, state.bundle.metrics, state.inputs.topology),
);
const unresolvedKnobs = computed(() => unresolvedCandidateKnobs(candidates.value));
const { rankDelta, metricValue, boundRange, candidateKnobEntries, candidateLinks, capabilityTitle, capabilityDetail } =
  createDesignSpacePresentation(t);

function candidateEvidence(index: number) {
  return formalAnalysis.value.candidates[index] || null;
}

function displayedKnobValue(value: unknown, availability: string) {
  if (availability !== "available") return t(availability === "not_applicable" ? "不适用" : "未执行");
  return formatNumber(value);
}
</script>

<template>
  <EmptyState v-if="!report" title="没有设计空间报告" />
  <div v-else class="view-stack design-space-view">
    <section class="stat-grid stat-grid--three">
      <StatCard
        :label="t('候选数量')"
        :value="formatNumber(report.candidate_count, 0)"
        :hint="t('候选包含后端内部运行实例 ID，不等同于可导航的 Bridge run')"
        accent
      />
      <StatCard
        :label="t('DES 晋升')"
        :value="formatNumber(report.promoted_candidate_count, 0)"
        hint="Top-K / SLO / uncertainty / tail risk"
      />
      <StatCard
        :label="t('执行范围')"
        :value="report.execution_scope || 'unknown'"
        :hint="t('当前只执行 S6 候选变量')"
      />
    </section>

    <section class="design-scope-banner">
      <AlertTriangle :size="19" />
      <div>
        <strong>{{ t("候选证据边界：{lane}", { lane: statusLabel(report.validation_lane) }) }}</strong>
        <p>{{ report.claim_scope_summary }}</p>
        <small v-if="unresolvedKnobs.length">
          {{
            t("未执行变量：{fields}。这些字段不会影响当前候选数值或仿真语义。", { fields: unresolvedKnobs.join(", ") })
          }}
        </small>
      </div>
      <StatusPill :value="report.evidence_tier" />
    </section>

    <section v-if="formalAnalysis.navigationScope" class="panel f7-formal-summary">
      <header>
        <div>
          <p class="section-kicker">FORMAL F7 CONTRACT</p>
          <h2>{{ t("Pareto 与 artifact-record 证据") }}</h2>
          <p>{{ t("候选仅导航到当前 run 的 design-space artifact 记录；backend instance 不是 Bridge run。") }}</p>
        </div>
        <StatusPill :value="formalAnalysis.availability" />
      </header>
      <dl>
        <div>
          <dt>pareto_front_id</dt>
          <dd>{{ formalAnalysis.paretoFrontId }}</dd>
        </div>
        <div>
          <dt>objective_set_id</dt>
          <dd>{{ formalAnalysis.objectiveSetId }}</dd>
        </div>
        <div>
          <dt>navigation_scope</dt>
          <dd>{{ formalAnalysis.navigationScope }}</dd>
        </div>
      </dl>
    </section>

    <section class="panel f7-capability-panel">
      <header class="panel-header">
        <div>
          <p class="section-kicker">F7 CONTRACT CAPABILITIES</p>
          <h2>{{ t("Fabric 与设计空间契约状态") }}</h2>
          <p>{{ t("available 只表示可展示后端事实；contract_gap 项不会由前端排序、计算或文本解析补齐。") }}</p>
        </div>
      </header>
      <div class="f7-capability-grid">
        <article v-for="capability in f7Capabilities" :key="capability.key">
          <header>
            <strong>{{ capabilityTitle(capability) }}</strong>
            <StatusPill :value="capability.availability" />
          </header>
          <p>{{ capabilityDetail(capability) }}</p>
          <ArtifactEvidenceLink v-if="capability.sourcePath" :source-path="capability.sourcePath" />
          <small v-if="capability.opaqueValues.length">
            {{ t("检测到 {count} 个 opaque link；仅原样显示，不解析。", { count: capability.opaqueValues.length }) }}
          </small>
        </article>
      </div>
    </section>

    <article class="panel">
      <header class="panel-header panel-header--row">
        <div>
          <p class="section-kicker">FIDELITY FUNNEL</p>
          <h2>{{ t("候选排名与选择性 DES") }}</h2>
          <p>{{ t("排名以报告中的确定性 final_rank 为准；promotion hint 仅作输入备注。") }}</p>
        </div>
        <div class="panel-count"><Layers3 :size="16" />{{ candidates.length }} candidates</div>
      </header>
      <div class="table-wrap">
        <table class="design-space-table">
          <thead>
            <tr>
              <th>{{ t("排名 / 候选") }}</th>
              <th>{{ t("执行层级") }}</th>
              <th class="numeric">P95</th>
              <th class="numeric">P99</th>
              <th>{{ t("晋升依据") }}</th>
              <th>{{ t("排名变化") }}</th>
              <th>Pareto</th>
              <th>{{ t("候选证据") }}</th>
              <th>{{ t("共同状态 / 停止原因") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(candidate, candidateIndex) in candidates" :key="candidate.candidate_id">
              <td>
                <div class="candidate-identity">
                  <span>#{{ candidate.final_rank || "—" }}</span>
                  <div>
                    <strong>{{ candidate.name || candidate.candidate_id }}</strong
                    ><small>{{ candidate.candidate_id }}</small>
                  </div>
                </div>
              </td>
              <td>
                <StatusPill :value="candidate.resolved_fidelity" />
                <small class="candidate-run-id">{{
                  candidate.des_run_instance_id || candidate.analytical_run_instance_id
                }}</small>
              </td>
              <td class="numeric">{{ formatNumber(candidate.projected_p95_latency_us) }} µs</td>
              <td class="numeric">{{ formatNumber(candidate.projected_p99_latency_us) }} µs</td>
              <td>
                <strong>{{ candidate.promotion_reason || "not_promoted" }}</strong>
                <small v-if="candidate.promotion_hint">hint: {{ candidate.promotion_hint }}</small>
              </td>
              <td>
                <span class="rank-change"><GitCompareArrows :size="14" />{{ rankDelta(candidate) }}</span>
                <small>Analytical #{{ candidate.analytical_rank || "—" }}</small>
              </td>
              <td>
                <StatusPill
                  :value="
                    candidate.pareto_member === true ? 'pareto_member' : candidate.dominance_status || 'not_evaluated'
                  "
                />
                <small>{{ candidate.dominance_reason_code || t("未报告") }}</small>
              </td>
              <td>
                <ArtifactEvidenceLink
                  v-if="candidateEvidence(candidateIndex)?.evidence.sourcePath"
                  :source-path="candidateEvidence(candidateIndex)?.evidence.sourcePath"
                  label="候选证据"
                />
                <small v-else>{{ candidateEvidence(candidateIndex)?.availability || "legacy_compatibility" }}</small>
              </td>
              <td>
                <span class="state-divergence">
                  <Route :size="14" />
                  {{
                    candidate.first_state_divergence?.present
                      ? `index ${candidate.first_state_divergence.index}`
                      : t("无分歧")
                  }}
                </span>
                <small>{{ candidate.stop_reason || "unknown" }}</small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>

    <section class="candidate-detail-list" :aria-label="t('候选完整证据')">
      <details
        v-for="(candidate, index) in candidates"
        :key="`${candidate.candidate_id}-details`"
        class="panel candidate-detail"
        :open="index === 0"
      >
        <summary>
          <span class="candidate-detail-rank">#{{ candidate.final_rank || "—" }}</span>
          <span>
            <strong>{{ candidate.name || candidate.candidate_id }}</strong>
            <small>{{ candidate.candidate_id }} · Analytical #{{ candidate.analytical_rank || "—" }}</small>
          </span>
          <StatusPill :value="candidate.resolved_fidelity" />
          <span class="candidate-detail-tail">P99 {{ metricValue(candidate.projected_p99_latency_us, "µs") }}</span>
        </summary>

        <div class="candidate-detail-body">
          <section>
            <h3>{{ t("完整性能指标") }}</h3>
            <dl class="candidate-fact-grid">
              <div>
                <dt>{{ t("筛选分数") }}</dt>
                <dd>{{ metricValue(candidate.screening_score) }}</dd>
              </div>
              <div>
                <dt>TTFT</dt>
                <dd>
                  {{ metricValue(candidate.projected_ttft_us, "µs", candidate.metric_availability?.ttft !== false) }}
                </dd>
              </div>
              <div>
                <dt>TPOT</dt>
                <dd>
                  {{ metricValue(candidate.projected_tpot_us, "µs", candidate.metric_availability?.tpot !== false) }}
                </dd>
              </div>
              <div>
                <dt>P95</dt>
                <dd>{{ metricValue(candidate.projected_p95_latency_us, "µs") }}</dd>
              </div>
              <div>
                <dt>P99</dt>
                <dd>{{ metricValue(candidate.projected_p99_latency_us, "µs") }}</dd>
              </div>
              <div>
                <dt>{{ t("吞吐") }}</dt>
                <dd>{{ metricValue(candidate.projected_throughput_requests_per_second, "req/s") }}</dd>
              </div>
              <div>
                <dt>{{ t("P95 确定性区间") }}</dt>
                <dd>{{ boundRange(candidate, "p95") }}</dd>
              </div>
              <div>
                <dt>{{ t("P99 确定性区间") }}</dt>
                <dd>{{ boundRange(candidate, "p99") }}</dd>
              </div>
            </dl>
            <p class="candidate-detail-note">
              {{ t("指标来源") }}：{{ candidate.metric_source || t("未知") }} ·
              {{ candidate.deterministic_bounds_us?.method || t("未报告区间方法") }}
            </p>
          </section>

          <section>
            <h3>{{ t("晋级与共同状态") }}</h3>
            <dl class="candidate-fact-grid">
              <div>
                <dt>{{ t("请求 fidelity") }}</dt>
                <dd>{{ candidate.requested_fidelity || "—" }}</dd>
              </div>
              <div>
                <dt>{{ t("实际 fidelity") }}</dt>
                <dd>{{ candidate.resolved_fidelity || "—" }}</dd>
              </div>
              <div>
                <dt>{{ t("晋升依据") }}</dt>
                <dd>{{ candidate.promotion_reason || "not_promoted" }}</dd>
              </div>
              <div>
                <dt>promotion hint</dt>
                <dd>{{ candidate.promotion_hint || "—" }}</dd>
              </div>
              <div>
                <dt>{{ t("首个状态分歧") }}</dt>
                <dd>
                  {{
                    candidate.first_state_divergence?.present
                      ? `index ${candidate.first_state_divergence.index}`
                      : t("无分歧")
                  }}
                </dd>
              </div>
              <div>
                <dt>{{ t("停止原因") }}</dt>
                <dd>{{ candidate.stop_reason || "—" }}</dd>
              </div>
            </dl>
            <p v-if="candidate.first_state_divergence?.state_schema" class="candidate-detail-note">
              state schema: <code>{{ candidate.first_state_divergence.state_schema }}</code>
            </p>
            <dl class="candidate-run-links">
              <div v-if="candidate.navigation">
                <dt>{{ t("后端运行实例") }}</dt>
                <dd>{{ candidate.navigation.backend_run_instance_id }}</dd>
              </div>
              <div v-if="candidate.navigation" class="candidate-bridge-boundary">
                <dt>Bridge run</dt>
                <dd>{{ t("不适用；仅 artifact_record 导航") }}</dd>
              </div>
              <div>
                <dt>Analytical run</dt>
                <dd>{{ candidate.analytical_run_instance_id || t("未生成") }}</dd>
              </div>
              <div>
                <dt>DES run</dt>
                <dd>{{ candidate.des_run_instance_id || t("未生成") }}</dd>
              </div>
            </dl>
            <ArtifactEvidenceLink
              v-if="candidateEvidence(index)?.evidence.sourcePath"
              :source-path="candidateEvidence(index)?.evidence.sourcePath"
              label="候选证据"
            />
          </section>

          <section v-if="candidate.objectives?.length" class="candidate-formal-evidence">
            <h3>{{ t("Pareto objectives") }}</h3>
            <p class="candidate-detail-note">
              {{ t("方向、数值、单位与 availability 均来自后端；前端不重算 Pareto。") }}
            </p>
            <div class="candidate-contract-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>objective_id</th>
                    <th>{{ t("方向") }}</th>
                    <th class="numeric">{{ t("数值") }}</th>
                    <th>availability</th>
                    <th>{{ t("证据") }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(objective, objectiveIndex) in candidate.objectives" :key="objective.objective_id">
                    <td>
                      <code>{{ objective.objective_id }}</code>
                    </td>
                    <td>{{ objective.direction }}</td>
                    <td class="numeric">
                      {{ objective.availability === "available" ? formatNumber(objective.value) : t("不适用") }}
                      {{ objective.unit }}
                    </td>
                    <td>{{ objective.availability }}</td>
                    <td>
                      <ArtifactEvidenceLink
                        v-if="candidateEvidence(index)?.objectiveReferences[objectiveIndex]?.sourcePath"
                        :source-path="candidateEvidence(index)?.objectiveReferences[objectiveIndex]?.sourcePath"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section v-if="candidate.executed_s6_knobs?.length" class="candidate-formal-evidence">
            <h3>{{ t("实际执行的 S6 knobs") }}</h3>
            <p class="candidate-detail-note">
              {{ t("requested 与 resolved 分开显示；not_applicable 不会被替换为零或默认值。") }}
            </p>
            <div class="candidate-contract-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>knob_id</th>
                    <th>{{ t("请求值") }}</th>
                    <th>{{ t("解析值") }}</th>
                    <th>availability</th>
                    <th>{{ t("证据") }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(knob, knobIndex) in candidate.executed_s6_knobs" :key="knob.knob_id">
                    <td>
                      <code>{{ knob.knob_id }}</code>
                    </td>
                    <td>{{ displayedKnobValue(knob.requested_value, knob.availability) }} {{ knob.unit }}</td>
                    <td>{{ displayedKnobValue(knob.resolved_value, knob.availability) }} {{ knob.unit }}</td>
                    <td>{{ knob.availability }}</td>
                    <td>
                      <span class="fabric-evidence-actions">
                        <ArtifactEvidenceLink
                          v-if="candidateEvidence(index)?.knobRequestedReferences[knobIndex]?.sourcePath"
                          :source-path="candidateEvidence(index)?.knobRequestedReferences[knobIndex]?.sourcePath"
                          label="请求值证据"
                        />
                        <ArtifactEvidenceLink
                          v-if="candidateEvidence(index)?.knobResolvedReferences[knobIndex]?.sourcePath"
                          :source-path="candidateEvidence(index)?.knobResolvedReferences[knobIndex]?.sourcePath"
                          label="解析值证据"
                        />
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3>{{ t("候选来源与证据边界") }}</h3>
            <dl class="candidate-run-links">
              <div>
                <dt>provenance</dt>
                <dd>{{ candidate.candidate_provenance || t("未报告") }}</dd>
              </div>
              <div>
                <dt>validation lane</dt>
                <dd>{{ candidate.validation_lane || report.validation_lane || t("未知") }}</dd>
              </div>
              <div>
                <dt>evidence tier</dt>
                <dd>{{ candidate.evidence_tier || report.evidence_tier || t("未知") }}</dd>
              </div>
              <div>
                <dt>claim scope</dt>
                <dd>{{ candidate.claim_scope_summary || report.claim_scope_summary || t("未报告") }}</dd>
              </div>
            </dl>
            <dl v-if="candidateLinks(candidate).length" class="candidate-run-links candidate-run-links--evidence">
              <div class="candidate-opaque-warning">
                <dt>contract status</dt>
                <dd>{{ t("以下是后端 opaque link 字符串，不是可导航 EvidenceRef。") }}</dd>
              </div>
              <div v-for="[label, value] in candidateLinks(candidate)" :key="label">
                <dt>{{ label }}</dt>
                <dd>{{ value }}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3>{{ t("候选参数执行状态") }}</h3>
            <dl class="candidate-knob-grid">
              <div v-for="[key, value] in candidateKnobEntries(candidate)" :key="key">
                <dt>{{ key }}</dt>
                <dd>{{ value }}</dd>
              </div>
            </dl>
            <p class="candidate-detail-note">
              {{ t("只有 S6 参数参与当前候选执行；unresolved_not_executed 不是默认值，也不参与排名。") }}
            </p>
          </section>

          <section v-if="candidate.subsystem_attribution?.length" class="candidate-attribution">
            <h3>{{ t("子系统归因证据") }}</h3>
            <div
              v-for="(item, itemIndex) in candidate.subsystem_attribution"
              :key="`${item.subsystem}-${item.reason}-${itemIndex}`"
            >
              <strong>{{ item.subsystem || "unknown" }} · {{ item.reason || "reported" }}</strong>
              <span v-if="typeof item.score_ps === 'number'">{{ formatNumber(item.score_ps) }} ps</span>
              <p>{{ item.detail }}</p>
            </div>
          </section>
        </div>
      </details>
    </section>

    <section class="design-evidence-grid">
      <article class="panel">
        <header>
          <Route :size="18" /><strong>{{ t("候选来源") }}</strong>
        </header>
        <dl>
          <div>
            <dt>{{ t("来源方式") }}</dt>
            <dd>{{ report.candidate_source }}</dd>
          </div>
          <div>
            <dt>source mode</dt>
            <dd>{{ report.candidate_source_mode || "synthetic_trace" }}</dd>
          </div>
          <div>
            <dt>calibration</dt>
            <dd>{{ report.candidate_calibration_level || "uncalibrated" }}</dd>
          </div>
          <div>
            <dt>claim scope</dt>
            <dd>{{ report.candidate_allowed_claim_scope || "exploratory_s6_only" }}</dd>
          </div>
          <div>
            <dt>design-space lane</dt>
            <dd>{{ report.design_space_lane || "unknown" }}</dd>
          </div>
          <div>
            <dt>screening tier</dt>
            <dd>{{ report.screening_tier || "Analytical" }}</dd>
          </div>
          <div>
            <dt>manifest</dt>
            <dd>{{ report.manifest_id || t("内置合成候选集") }}</dd>
          </div>
          <div>
            <dt>manifest validation</dt>
            <dd>{{ report.manifest_validation_status || "not_applicable" }}</dd>
          </div>
          <div v-if="report.manifest_validation_detail">
            <dt>{{ t("校验说明") }}</dt>
            <dd>{{ report.manifest_validation_detail }}</dd>
          </div>
          <div>
            <dt>{{ t("Fidelity 解析") }}</dt>
            <dd>
              {{ report.resolved_fidelity_scope_status || "unknown" }} ·
              {{ report.resolved_fidelity_dominant_subsystem || "unknown" }} ·
              {{ report.resolved_fidelity_dominant_resolution || "unknown" }}
            </dd>
          </div>
        </dl>
      </article>
      <article class="panel">
        <header>
          <GitCompareArrows :size="18" /><strong>{{ t("Analytical / DES 分歧") }}</strong>
        </header>
        <div v-if="report.analytical_vs_des_disagreements?.length" class="disagreement-list">
          <p v-for="item in report.analytical_vs_des_disagreements" :key="item.candidate_id">
            <strong>{{ item.candidate_id }}</strong>
            <span>#{{ item.analytical_rank }} <ArrowRight :size="13" /> #{{ item.des_rank }}</span>
            <small>{{ item.detail }}</small>
          </p>
        </div>
        <p v-else class="design-empty-note">{{ t("本次候选没有报告 Analytical/DES 排名变化。") }}</p>
      </article>
    </section>
  </div>
</template>
