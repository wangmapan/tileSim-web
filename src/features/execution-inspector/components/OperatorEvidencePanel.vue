<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { RouterLink, routeLocationKey, type LocationQuery } from "vue-router";
import type { ApiManifestResponse, ArtifactManifestResponse } from "../../../contracts/bridge-api";
import { fetchVerifiedArtifact } from "../../run-evidence";
import { queryClient } from "../../../lib/query-client";
import { artifactEvidenceRoute } from "../../inspect-artifact";
import { normalizeOperatorEvidence, evidenceValue, type OperatorEvidence } from "../model/operator-evidence";
import SourceSemanticsPanel from "./SourceSemanticsPanel.vue";
const props = defineProps<{
  runId: string | null;
  backendIdentity: string;
  schemaSetRevision: string;
  artifactManifest: ArtifactManifestResponse | null;
  bridgeManifest: ApiManifestResponse | null;
  cursorPs?: string;
  fragmentId?: string;
}>();
const emit = defineEmits<{ seek: [time: string] }>();
const route = inject(routeLocationKey, null) || { query: {} as LocationQuery },
  chosen = ref(""),
  filter = ref("all"),
  page = ref(0);
const entry = computed(() => props.artifactManifest?.artifacts.find((e) => e.artifact_id === "request-attribution"));
const query = useQuery(
  {
    queryKey: computed(() => [
      "operator-evidence",
      props.runId,
      props.backendIdentity,
      props.schemaSetRevision,
      entry.value?.sha256,
    ]),
    enabled: computed(() => Boolean(props.runId && entry.value && props.artifactManifest?.run_id === props.runId)),
    queryFn: async () => {
      if (entry.value!.schema_identity !== "tilesim.request_attribution.v1") throw new Error("unsupported_schema");
      if (BigInt(entry.value!.bytes) > 16000000n) throw new Error("partial · artifact 超过当前查看预算");
      return fetchVerifiedArtifact(props.runId!, entry.value!, {
        backendRevision: props.backendIdentity,
        manifest: props.bridgeManifest,
      });
    },
    retry: false,
  },
  queryClient,
);
const records = computed(() =>
  props.artifactManifest?.run_id === props.runId && !query.error.value
    ? normalizeOperatorEvidence(query.data.value)
    : [],
);
const dependencies = computed(() =>
  records.value
    .map((r) => ({
      id: r.fragmentId,
      dependency:
        r.attributes.dependency_fragment_ids ||
        r.attributes.execution_dependency_fragment_ids ||
        r.attributes.scheduling_dependency_fragment_ids,
    }))
    .filter((r) => r.dependency !== undefined),
);
const filtered = computed(() =>
  records.value.filter(
    (r) =>
      filter.value === "all" ||
      r.attributes.kernel_view === filter.value ||
      r.attributes.kernel_strategy === filter.value ||
      (filter.value === "tilelang_source" && Boolean(r.attributes.source_kernel_sha256)),
  ),
);
const rows = computed(() => filtered.value.slice(page.value * 30, (page.value + 1) * 30));
const selected = computed(() => records.value.find((r) => r.id === chosen.value || r.fragmentId === chosen.value));
const bufferEvidence = computed(() =>
  Object.entries(selected.value?.attributes || {}).filter(
    ([key]) => key.startsWith("buffer_") || key.startsWith("output_buffer_") || key.startsWith("execution_buffer_"),
  ),
);
watch(
  () => props.fragmentId || route.query.fragment,
  (id) => {
    if (typeof id === "string") chosen.value = id;
  },
  { immediate: true },
);
watch(filter, () => (page.value = 0));
watch(
  () => props.runId,
  () => {
    chosen.value = typeof route.query.fragment === "string" ? route.query.fragment : "";
    page.value = 0;
  },
);
function rawTarget(row: OperatorEvidence) {
  return artifactEvidenceRoute({
    runId: props.runId!,
    artifactId: "request-attribution",
    sha256: entry.value!.sha256,
    pointer: row.pointer,
  });
}
function replayTarget(row: OperatorEvidence) {
  return {
    path: "/replay",
    query: {
      run: props.runId,
      fragment: row.fragmentId,
      cursor_ps: row.startPs,
      artifact_sha256: entry.value?.sha256,
      backend_identity: props.backendIdentity,
      schema_revision: props.schemaSetRevision,
    },
  };
}
const detailKeys = [
  "kernel_view",
  "kernel_block_count",
  "kernel_wave_count",
  "kernel_resident_blocks_per_unit",
  "kernel_launch_begin_ps",
  "kernel_launch_end_ps",
  "compute_service_ps",
  "memory_service_ps",
  "kernel_modeled_memory_bytes",
  "scalar_flops",
  "flop_count",
  "kernel_launch_id",
  "kernel_grid",
  "kernel_tile_shape",
  "kernel_dtype",
  "kernel_strategy_source",
  "dependency_fragment_ids",
  "scheduling_dependency_fragment_ids",
  "output_admission_policy",
  "output_admission_data_ready_ps",
  "output_admission_gate_ready_ps",
  "output_admission_wait_ps",
  "kernel_launch_queue_delay_ps",
  "kernel_internal_wait_ps",
  "kernel_configuration",
  "kernel_implementation_id",
  "descriptor_fingerprint",
  "kernel_timing_evidence",
  "source_selection_id",
  "source_operator_instance",
  "source_program_sha256",
  "source_kernel_sha256",
  "source_operation_id",
  "source_operation_kind",
  "tensor_offset",
  "tensor_extent",
  "declared_service_ps",
  "queue_wait_ps",
  "contention_delay_ps",
  "resource_lane",
  "placement_id",
  "execution_rank",
  "tp_rank",
  "partition_reference",
  "partition_program_id",
  "partition_source_mode",
  "partition_source_kind",
  "partition_calibration_level",
  "partition_allowed_claim_scope",
  "execution_buffer_wait_ps",
  "execution_buffer_output_bytes",
  "execution_buffer_pool_capacity_bytes",
  "source_cost_scope",
  "profile_source_mode",
  "profile_calibration_level",
  "profile_claim_scope",
];
</script>
<template>
  <section class="operator-evidence" aria-label="算子 Kernel 执行片段证据">
    <header>
      <h3>算子 / Kernel / 执行片段</h3>
      <span>{{ records.length }} 条已报告资源操作</span>
    </header>
    <p>
      已报告证据回放。声明成本、CPU 源码语义与合成一致性不能用作 GPU 数值正确性、真实 Trace 校准或 held-out
      validation。重叠片段窗口及重复 launch bytes 不可累加成 Kernel 时延；证据范围以原始记录为准。
    </p>
    <SourceSemanticsPanel
      v-for="artifactId in ['input-execution', 'source-semantics'] as const"
      :key="artifactId"
      :artifact-id="artifactId"
      :run-id="runId"
      :backend-identity="backendIdentity"
      :schema-set-revision="schemaSetRevision"
      :artifact-manifest="artifactManifest"
      :bridge-manifest="bridgeManifest"
    />
    <p v-if="artifactManifest && artifactManifest.run_id !== runId" role="alert">
      unsupported_schema · 工件清单 run 身份不匹配
    </p>
    <p v-else-if="!entry">missing · 当前运行未提供 request-attribution 工件</p>
    <p v-else-if="query.isPending.value">pending · 正在校验工件 SHA256</p>
    <p v-else-if="query.error.value" role="alert">error · {{ query.error.value.message }}</p>
    <p v-else-if="!records.length">expected_absence · 工件中没有可展示的资源操作</p>
    <template v-if="records.length">
      <details>
        <summary>已报告依赖图 / partition reference</summary>
        <ul>
          <li v-for="row in dependencies.slice(0, 100)" :key="row.id">
            <code>{{ evidenceValue(row.dependency) }} → {{ row.id }}</code>
          </li>
        </ul>
        <p v-if="!dependencies.length">not_covered · 资源工件没有独立报告依赖边；完整片段保留原始 pointer。</p>
        <p v-if="dependencies.length > 100">partial · 此预览显示前 100 条，完整记录可在原始证据检查。</p>
      </details>
      <label
        >观察粒度<select v-model="filter">
          <option value="all">全部</option>
          <option value="aggregate">aggregate</option>
          <option value="expanded">expanded</option>
          <option value="tilelang_source">TileLang source</option>
        </select></label
      >
      <p v-if="cursorPs">
        共享回放游标：<code>{{ cursorPs }} ps</code>
      </p>
      <div class="operator-evidence-scroll">
        <table>
          <thead>
            <tr>
              <th>fragment / operation</th>
              <th>request / instance</th>
              <th>Rank / lane</th>
              <th>start → done (ps)</th>
              <th>state / evidence</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.id"
              :data-active="
                cursorPs && row.startPs && row.endPs
                  ? BigInt(cursorPs) >= BigInt(row.startPs) && BigInt(cursorPs) <= BigInt(row.endPs)
                  : false
              "
            >
              <td>
                <button
                  type="button"
                  @click="
                    chosen = row.id;
                    if (row.startPs) emit('seek', row.startPs);
                  "
                >
                  {{ row.kind }}</button
                ><code :title="row.fragmentId">{{ row.fragmentId }}</code>
              </td>
              <td>
                {{ row.requestId || "missing" }}<br />{{
                  row.attributes.source_operator_instance || row.attributes.operation_kind || "missing"
                }}
              </td>
              <td>
                {{ evidenceValue(row.attributes.tp_rank ?? row.attributes.execution_rank) }} /
                {{ evidenceValue(row.attributes.resource_lane ?? row.attributes.placement_id) }}
              </td>
              <td>{{ row.startPs || "missing" }} → {{ row.endPs || "missing" }}</td>
              <td>
                {{ row.state }}<br /><RouterLink :to="rawTarget(row)">原始证据</RouterLink> ·
                <RouterLink :to="replayTarget(row)">回放片段</RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="operator-evidence-pager">
        <button type="button" :disabled="page === 0" @click="page--">上一页</button
        ><span>{{ page + 1 }} / {{ Math.max(1, Math.ceil(filtered.length / 30)) }}</span
        ><button type="button" :disabled="(page + 1) * 30 >= filtered.length" @click="page++">下一页</button>
      </div>
      <section v-if="selected" tabindex="0" aria-label="执行片段详情">
        <h4 :title="selected.fragmentId">{{ selected.fragmentId }}</h4>
        <p>
          operation ID：<code>{{ selected.id }}</code> · completion state：{{ selected.state }} · reported interval：{{
            selected.startPs ?? "missing"
          }}
          → {{ selected.endPs ?? "missing" }} ps · duration：{{
            selected.startPs !== null && selected.endPs !== null
              ? String(BigInt(selected.endPs) - BigInt(selected.startPs)) + " ps（报告区间差）"
              : "missing"
          }}
        </p>
        <p>
          <RouterLink :to="rawTarget(selected)">原始证据 Pointer {{ selected.pointer }}</RouterLink> ·
          <RouterLink
            :to="{
              ...replayTarget(selected),
              path: '/execution',
              query: { ...replayTarget(selected).query, request_id: selected.requestId },
            }"
            >对应请求 / operator</RouterLink
          >
        </p>
        <dl>
          <template v-for="key in detailKeys" :key="key"
            ><dt>{{ key }}</dt>
            <dd :title="evidenceValue(selected.attributes[key])">
              {{ evidenceValue(selected.attributes[key]) }}
            </dd></template
          >
        </dl>
        <details v-if="bufferEvidence.length" open>
          <summary>已报告 buffer pool / capacity / occupancy / release</summary>
          <dl>
            <template v-for="[key, value] in bufferEvidence" :key="key"
              ><dt>{{ key }}</dt>
              <dd>{{ evidenceValue(value) }}</dd></template
            >
          </dl>
        </details>
        <details>
          <summary>完整记录 / dependencies / buffers</summary>
          <pre>{{ JSON.stringify(selected.raw, null, 2) }}</pre>
        </details>
      </section>
    </template>
  </section>
</template>
<style scoped>
.operator-evidence {
  margin-top: 20px;
  border-top: 1px solid var(--line);
  padding-top: 15px;
  min-width: 0;
}
.operator-evidence header {
  display: flex;
  gap: 15px;
  align-items: center;
}
.operator-evidence h3 {
  font-size: 15px;
}
.operator-evidence p,
.operator-evidence span,
.operator-evidence label {
  font-size: 12px;
  line-height: 1.6;
}
.operator-evidence-scroll {
  overflow-x: auto;
}
.operator-evidence table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
  font-size: 12px;
}
.operator-evidence td,
.operator-evidence th {
  padding: 9px;
  text-align: left;
  border-bottom: 1px solid var(--line);
}
.operator-evidence td code {
  display: block;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.operator-evidence tr[data-active="true"] {
  background: var(--accent-soft);
}
.operator-evidence-pager {
  display: flex;
  gap: 12px;
  margin: 10px 0;
}
.operator-evidence dl {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) 2fr;
  gap: 6px;
  font-size: 12px;
}
.operator-evidence dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-family: Consolas, monospace;
}
.operator-evidence dt {
  overflow-wrap: anywhere;
  color: var(--muted);
}
.operator-evidence pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 400px;
  overflow: auto;
  font-size: 11px;
}
.operator-evidence h4 {
  overflow-wrap: anywhere;
}
.operator-evidence :focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
