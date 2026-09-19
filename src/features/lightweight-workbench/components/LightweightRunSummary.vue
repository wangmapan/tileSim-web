<script setup lang="ts">
import { computed, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import type { ArtifactManifestResponse } from "../../../contracts/bridge-api";
import type { ReportBundle } from "../../../contracts/report-model";
import { evidenceSummary } from "../../../lib/reports";
import { preserveWorkbenchQuery } from "../model";
import { useI18n } from "../../../i18n";
import { emitLightweightTelemetry } from "../telemetry";

const props = defineProps<{
  bundle: ReportBundle;
  runId: string | null;
  requestedRunId: string | null;
  artifactManifest: ArtifactManifestResponse | null;
  bridgeConnected: boolean;
  bridgeChecking: boolean;
}>();

const route = useRoute();
const { t } = useI18n();
const carriedQuery = computed(() => preserveWorkbenchQuery(route.query));

type SummaryState = "checking" | "missing" | "invalid" | "stale" | "unsupported" | "not_covered" | "available";

const requestedSchema = computed(() => {
  const value = route.query.schema_set_revision;
  return typeof value === "string" ? value : Array.isArray(value) && typeof value[0] === "string" ? value[0] : null;
});
const rawRunQuery = computed(() => {
  const value = route.query.run;
  return Array.isArray(value) ? value[0] : value;
});
const requestedArtifact = computed(() => {
  const value = route.query.artifact_sha256;
  return typeof value === "string" ? value : Array.isArray(value) && typeof value[0] === "string" ? value[0] : null;
});

const state = computed<SummaryState>(() => {
  if (rawRunQuery.value !== undefined && rawRunQuery.value !== null && props.requestedRunId === null) return "invalid";
  if (props.bridgeChecking) return "checking";
  if (!props.bridgeConnected) return "missing";
  if (props.requestedRunId === null && props.runId === null) return "missing";
  if (props.requestedRunId !== null && props.requestedRunId !== props.runId) return "checking";
  if (!props.runId || !/^run-[\w-]+$/.test(props.runId)) return "invalid";
  // The manifest is the trust boundary for a run-bound summary. Never pair a
  // report bundle with a manifest from another run (or with an unverified
  // bundle that has no manifest at all).
  if (!props.artifactManifest) return "not_covered";
  if (props.artifactManifest.run_id !== props.runId) return "stale";
  if (requestedSchema.value && props.artifactManifest?.schema_set_revision !== requestedSchema.value) return "stale";
  if (requestedArtifact.value) {
    const matches = props.artifactManifest?.artifacts.some((entry) => entry.sha256 === requestedArtifact.value);
    if (!props.artifactManifest || !matches) return "stale";
  }
  if (props.artifactManifest.artifacts.some((entry) => entry.contract_status === "legacy_compatibility"))
    return "unsupported";
  if (props.artifactManifest?.rejected_artifacts.some((item) => item.reason === "unsupported_schema"))
    return "unsupported";
  if (Object.values(props.bundle.compatibility).some((item) => item?.supported === false)) return "unsupported";
  if (!props.bundle.run) return "not_covered";
  return "available";
});

const stateCopy: Record<SummaryState, { title: string; detail: string }> = {
  checking: { title: "正在确认已有 run", detail: "只读取已有证据；确认完成前不会显示推测性结果。" },
  missing: { title: "还没有可查看的 run", detail: "完成一次正式 run 后，轻量版会展示合法且可验证的结果。" },
  invalid: { title: "run 链接无效", detail: "仅接受 run-* 格式的合法标识；未发起任何读取请求。" },
  stale: { title: "结果上下文已过期", detail: "artifact 或 schema revision 与当前证据不一致，未展示摘要。" },
  unsupported: { title: "结果包含不支持的 schema", detail: "当前版本无法验证这些报告，未把它们当作成功结果。" },
  not_covered: { title: "该 run 没有可覆盖的摘要", detail: "缺少受支持的 run 报告，轻量版不会补造结论。" },
  available: { title: "已有 run 摘要", detail: "以下字段直接来自已验证报告；轻量版不会重新计算指标。" },
};

const summary = computed(() => props.bundle.run?.summary || null);
const evidence = computed(() => evidenceSummary(props.bundle));
watch(state, (value) => {
  if (value !== "checking") {
    emitLightweightTelemetry("lightweight_result_state", {
      state: value,
      provenance_class: value === "available" ? evidence.value.sourceMode : "unavailable",
      latency_bucket: "unknown",
    });
  }
});
const artifactLabel = computed(() => requestedArtifact.value || props.artifactManifest?.artifacts[0]?.sha256 || "—");
const fidelityEntries = computed(() => props.bundle.run?.resolved_fidelity_profile?.entries || []);
const fidelityLabel = computed(() =>
  fidelityEntries.value.length
    ? fidelityEntries.value
        .map((entry) => `${entry.subsystem}: ${entry.requested_fidelity || "—"} → ${entry.actual_fidelity || "—"}`)
        .join("；")
    : "—",
);
</script>

<template>
  <section
    class="lightweight-run-summary"
    aria-labelledby="lightweight-run-summary-title"
    data-testid="lightweight-run-summary"
  >
    <div class="lightweight-run-summary__heading">
      <div>
        <p class="section-kicker">结果摘要</p>
        <h2 id="lightweight-run-summary-title">{{ t(stateCopy[state].title) }}</h2>
      </div>
      <span class="lightweight-run-summary__state" :data-state="state">{{ state }}</span>
    </div>
    <p class="lightweight-run-summary__detail">{{ t(stateCopy[state].detail) }}</p>

    <dl v-if="state === 'available' && summary" class="lightweight-run-summary__facts">
      <div>
        <dt>run</dt>
        <dd>
          <code>{{ runId }}</code>
        </dd>
      </div>
      <div>
        <dt>trace</dt>
        <dd>{{ summary.trace_name || "—" }}</dd>
      </div>
      <div>
        <dt>状态</dt>
        <dd>{{ props.bundle.run?.status || "—" }}</dd>
      </div>
      <div>
        <dt>范围</dt>
        <dd>{{ summary.range_label || "—" }}</dd>
      </div>
      <div>
        <dt>schema revision</dt>
        <dd>
          <code>{{ props.artifactManifest?.schema_set_revision || requestedSchema || "—" }}</code>
        </dd>
      </div>
      <div>
        <dt>artifact</dt>
        <dd>
          <code>{{ artifactLabel }}</code>
        </dd>
      </div>
      <div>
        <dt>证据层</dt>
        <dd>{{ evidence.tier }}</dd>
      </div>
      <div>
        <dt>来源</dt>
        <dd>{{ evidence.sourceMode }}</dd>
      </div>
      <div>
        <dt>校准</dt>
        <dd>{{ evidence.calibration }}</dd>
      </div>
      <div>
        <dt>声明范围</dt>
        <dd>{{ evidence.claimScope }}</dd>
      </div>
      <div>
        <dt>请求/实际保真度</dt>
        <dd>{{ fidelityLabel }}</dd>
      </div>
    </dl>

    <div v-if="state === 'available'" class="lightweight-run-summary__actions">
      <RouterLink class="button button--secondary" :to="{ name: 'overview', query: carriedQuery }"
        >在专业版查看详情</RouterLink
      >
      <span>只读跳转会保留 run、artifact、schema revision 和来源标记。</span>
    </div>
  </section>
</template>

<style scoped>
.lightweight-run-summary {
  display: grid;
  gap: 14px;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--panel);
}
.lightweight-run-summary__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.lightweight-run-summary h2 {
  margin: 0;
  font-size: 22px;
}
.lightweight-run-summary__detail {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
}
.lightweight-run-summary__state {
  padding: 4px 8px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}
.lightweight-run-summary__state[data-state="available"] {
  color: var(--success-ink, var(--ink));
  border-color: var(--success, var(--line-strong));
}
.lightweight-run-summary__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 18px;
  margin: 0;
}
.lightweight-run-summary__facts div {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.lightweight-run-summary__facts dt {
  color: var(--muted);
  font-size: var(--text-xs);
}
.lightweight-run-summary__facts dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.lightweight-run-summary__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.lightweight-run-summary__actions span {
  color: var(--muted);
  font-size: var(--text-sm);
}
@media (max-width: 560px) {
  .lightweight-run-summary__facts {
    grid-template-columns: 1fr;
  }
  .lightweight-run-summary__heading {
    flex-direction: column;
  }
}
</style>
