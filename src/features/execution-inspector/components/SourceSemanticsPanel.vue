<script setup lang="ts">
import { computed, ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { RouterLink } from "vue-router";
import type { ApiManifestResponse, ArtifactManifestResponse } from "../../../contracts/bridge-api";
import type { ExecutionDocument as Document } from "../../../contracts/execution-authoring";
import { queryClient } from "../../../lib/query-client";
import { fetchVerifiedArtifact } from "../../run-evidence";
import { artifactEvidenceRoute } from "../../inspect-artifact";
import { evidenceValue } from "../model/operator-evidence";
const props = defineProps<{
  runId: string | null;
  backendIdentity: string;
  schemaSetRevision: string;
  artifactManifest: ArtifactManifestResponse | null;
  bridgeManifest: ApiManifestResponse | null;
  artifactId: "source-semantics" | "input-execution";
}>();
const entry = computed(() => props.artifactManifest?.artifacts.find((e) => e.artifact_id === props.artifactId));
const query = useQuery(
  {
    queryKey: computed(() => [
      "operator-input-evidence",
      props.runId,
      props.backendIdentity,
      props.schemaSetRevision,
      props.artifactId,
      entry.value?.sha256,
    ]),
    enabled: computed(() => !!entry.value && !!props.runId && props.artifactManifest?.run_id === props.runId),
    queryFn: async () => {
      const expected =
        props.artifactId === "source-semantics"
          ? "tilesim.bridge.source_semantics.v1"
          : "tilesim.bridge.execution_input_snapshot.v1";
      if (entry.value!.schema_identity !== expected) throw new Error("unsupported_schema");
      if (BigInt(entry.value!.bytes) > 16000000n) throw new Error("partial · exceeds viewing budget");
      return (await fetchVerifiedArtifact(props.runId!, entry.value!, {
        backendRevision: props.backendIdentity,
        manifest: props.bridgeManifest,
      })) as Document;
    },
    retry: false,
  },
  queryClient,
);
const cpuKeys = [
  "completed",
  "termination",
  "output_valid",
  "source_sha256",
  "source_selected",
  "mapping_group_size",
  "completion_time_ps",
  "tasks_completed",
  "operations_completed",
  "committed_events",
  "transferred_bytes",
  "flops",
  "acquisitions",
  "releases",
  "all_buffers_free",
  "restored_events",
  "executed_events_this_run",
  "semantic_error",
  "failure_event",
  "cost_scope",
  "claim_scope",
];
const page = ref(0);
const target = computed(() =>
  entry.value && props.runId
    ? artifactEvidenceRoute({
        runId: props.runId,
        artifactId: props.artifactId,
        sha256: entry.value.sha256,
        pointer: "",
      })
    : null,
);
</script>
<template>
  <details v-if="entry" class="source-evidence">
    <summary>
      {{
        artifactId === "source-semantics"
          ? "TileLang CPU 语义结果 / 独立 timeline"
          : "运行输入 / Kernel / source selection / provenance"
      }}
    </summary>
    <p v-if="artifactManifest?.run_id !== runId" role="alert">unsupported_schema · 工件清单 run 身份不匹配</p>
    <p v-else-if="query.isPending.value">pending · 校验工件 SHA256</p>
    <p v-else-if="query.error.value" role="alert">{{ query.error.value.message }}</p>
    <template v-if="query.data.value && !query.error.value && artifactManifest?.run_id === runId">
      <p>
        <RouterLink v-if="target" :to="target">原始输入与证据</RouterLink> · artifact SHA256
        <code :title="entry.sha256">{{ entry.sha256 }}</code>
      </p>
      <p>
        配置 SHA256 <code>{{ query.data.value.config_sha256 }}</code>
      </p>
      <template v-if="artifactId === 'input-execution'">
        <p>
          source mode：{{ query.data.value.input.mode }} · model：{{ query.data.value.dense_execution.model_id }} /
          {{ query.data.value.dense_execution.model_revision }}
        </p>
        <pre>{{
          JSON.stringify(
            query.data.value.input.kernel_execution ||
              query.data.value.input.execution_partition_program ||
              query.data.value.sources,
            null,
            2,
          )
        }}</pre>
        <details
          v-for="selection in query.data.value.dense_execution.tilelang_kernels || []"
          :key="selection.selection_id"
        >
          <summary>{{ selection.selection_id }} · {{ selection.phase }} / {{ selection.operation }}</summary>
          <p>
            instances：{{ evidenceValue(selection.instances) }} · output_policy：{{
              evidenceValue(selection.output_policy)
            }}
            · output_buffer_slots：{{ evidenceValue(selection.output_buffer_slots) }} · output_admission_policy：{{
              evidenceValue(selection.output_admission_policy)
            }}
          </p>
          <p>显式 Rank：{{ evidenceValue(Object.keys(selection.rank_programs || {})) }}</p>
          <pre>{{ JSON.stringify(selection.rank_cost_profiles || {}, null, 2) }}</pre>
        </details>
      </template>
      <template v-else>
        <p>
          独立 CPU 数值语义检查，时间从自身原点开始。下表不是 Dense 模型运行时间线，不与共享回放游标叠加，不证明 GPU
          执行或数值正确性。
        </p>
        <section
          v-for="row in query.data.value.results"
          :key="row.selection_id + row.rank"
          aria-label="TileLang CPU 语义结果"
        >
          <h4>{{ row.selection_id }} / {{ row.rank }} · {{ row.status }}</h4>
          <p>{{ row.reason }}</p>
          <dl v-if="row.result">
            <template v-for="key in cpuKeys" :key="key"
              ><dt>{{ key }}</dt>
              <dd>{{ evidenceValue(row.result[key]) }}</dd></template
            >
          </dl>
          <div v-if="row.result" class="source-timeline">
            <table>
              <thead>
                <tr>
                  <th>event / action</th>
                  <th>time / phase (start / begin / done)</th>
                  <th>worker / task / k</th>
                  <th>slot / state / owner / copy mask</th>
                  <th>queue / resource / dependencies</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(event, i) in row.result.timeline.slice(page * 40, (page + 1) * 40)" :key="i">
                  <td>{{ evidenceValue(event.id) }} / {{ evidenceValue(event.kind) }}</td>
                  <td>{{ evidenceValue(event.time_ps) }} / {{ evidenceValue(event.phase) }}</td>
                  <td>
                    {{ evidenceValue(event.worker) }} / {{ evidenceValue(event.task) }} / {{ evidenceValue(event.k) }}
                  </td>
                  <td>
                    {{ evidenceValue(event.slot) }} / {{ evidenceValue(event.slot_state) }} /
                    {{ evidenceValue(event.owner_task) }}:{{ evidenceValue(event.owner_k) }} /
                    {{ evidenceValue(event.copy_done_mask) }}
                  </td>
                  <td>
                    {{ evidenceValue(event.queue_wait_ps) }} / {{ evidenceValue(event.resource) }} /
                    {{ evidenceValue(event.dependencies) }}
                  </td>
                </tr>
              </tbody>
            </table>
            <button type="button" :disabled="page === 0" @click="page--">上一页</button> {{ page + 1 }}
            <button type="button" :disabled="(page + 1) * 40 >= row.result.timeline.length" @click="page++">
              下一页
            </button>
            <details>
              <summary>完整 CPU result 与 timeline</summary>
              <pre>{{ JSON.stringify(row.result, null, 2) }}</pre>
            </details>
          </div>
        </section>
      </template>
    </template>
  </details>
</template>
<style scoped>
.source-evidence {
  border-top: 1px solid var(--line);
  margin-top: 12px;
  padding-top: 12px;
  font-size: 12px;
  min-width: 0;
}
.source-evidence summary {
  cursor: pointer;
  font-weight: 600;
}
.source-evidence p,
.source-evidence dd {
  overflow-wrap: anywhere;
}
.source-evidence dl {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) 2fr;
  gap: 6px;
}
.source-evidence dd {
  margin: 0;
  font-family: var(--font-mono);
}
.source-evidence pre {
  max-height: 340px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.source-timeline {
  overflow: auto;
  max-width: 100%;
}
.source-timeline table {
  min-width: 900px;
  width: 100%;
  border-collapse: collapse;
}
.source-timeline td,
.source-timeline th {
  padding: 8px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  max-width: 240px;
  overflow-wrap: anywhere;
}
.source-evidence :focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
