<script setup lang="ts">
import { AlertTriangle, Braces, ChevronDown, GitBranch, Link2 } from "@lucide/vue";
import { computed, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import ArtifactEvidenceLink from "../../../components/ArtifactEvidenceLink.vue";
import type { ArtifactManifestResponse } from "../../../lib/api";
import type { ReportBundle, RunInputs } from "../../../contracts/report-model";
import { useI18n } from "../../../i18n";
import { formatNumber } from "../../../lib/format";
import { buildRunBoundEvidenceChain } from "../model";
import type { RunBoundAvailability, RunBoundEvidenceNode } from "../types";
import PercentileSubjects from "./PercentileSubjects.vue";
import EvidenceNode from "./EvidenceNode.vue";

const props = defineProps<{
  runId: string | null;
  bundle: ReportBundle;
  inputs: RunInputs;
  artifactManifest: ArtifactManifestResponse | null;
  selectedRequestId: string | null;
}>();
const emit = defineEmits<{ requestSelected: [requestId: string] }>();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const chain = computed(() =>
  buildRunBoundEvidenceChain({
    runId: props.runId,
    requestId: props.selectedRequestId,
    bundle: props.bundle,
    inputs: props.inputs,
    artifactManifest: props.artifactManifest,
  }),
);
const nodeMap = computed(() => new Map(chain.value.nodes.map((node) => [node.subsystem, node])));
const peerSubsystems: RunBoundEvidenceNode["subsystem"][] = ["S3", "S4", "S5"];
const outputSubsystems: RunBoundEvidenceNode["subsystem"][] = ["S7", "S8", "S9"];
const pageLinks = [
  { name: "metrics", label: "性能指标" },
  { name: "attribution", label: "慢请求原因" },
  { name: "execution", label: "执行过程" },
  { name: "validation", label: "结果可信度" },
] as const;
const visiblePageLinks = computed(() => pageLinks.filter((page) => page.name !== route.name));
const peerNodes = computed(
  () => peerSubsystems.map((id) => nodeMap.value.get(id)).filter(Boolean) as RunBoundEvidenceNode[],
);
const outputNodes = computed(
  () => outputSubsystems.map((id) => nodeMap.value.get(id)).filter(Boolean) as RunBoundEvidenceNode[],
);
function routeQuery(requestId: string) {
  return { run: props.runId || undefined, evidence_request: requestId };
}

function chooseRequest(event: Event, replace = false) {
  if (!props.runId) return;
  const requestId = (event.target as HTMLSelectElement).value;
  if (!requestId) return;
  emit("requestSelected", requestId);
  void router[replace ? "replace" : "push"]({
    name: route.name || "execution",
    query: { ...route.query, ...routeQuery(requestId) },
  });
}

function chooseExplicitRequest(requestId: string) {
  if (!props.runId) return;
  emit("requestSelected", requestId);
  void router.push({
    name: route.name || "execution",
    query: { ...route.query, ...routeQuery(requestId) },
  });
}

watch(
  () =>
    [
      props.runId,
      chain.value.requestOptions.map((option) => `${option.requestId}:${option.isTailExplainedEntity}`).join("\u0000"),
    ] as const,
  ([runId]) => {
    if (!runId || props.selectedRequestId) return;
    const explicitTail = chain.value.requestOptions.find((option) => option.isTailExplainedEntity);
    if (!explicitTail) return;
    emit("requestSelected", explicitTail.requestId);
    void router.replace({
      name: route.name || "execution",
      query: { ...route.query, ...routeQuery(explicitTail.requestId) },
    });
  },
  { immediate: true },
);

function statusLabel(node: { availability: RunBoundAvailability }) {
  const labels = {
    available: "已绑定",
    partial: "部分证据",
    run_scope_only: "仅 run 级",
    not_applicable: "不适用",
    missing: "缺失",
    ambiguous_reference: "引用不唯一",
    invalid_reference: "引用无效",
    artifact_identity_missing: "缺少 artifact 身份",
    unsupported_schema: "不支持的 Schema",
    legacy_compatibility: "兼容只读",
    contract_gap: "契约缺口",
  } as const;
  return t(labels[node.availability]);
}
</script>

<template>
  <section
    class="panel run-bound-evidence-panel"
    aria-labelledby="run-bound-evidence-title"
    data-help-anchor="attribution-chain"
  >
    <header class="panel-header panel-header--row">
      <div>
        <h2 id="run-bound-evidence-title">{{ t("请求证据链") }}</h2>
      </div>
      <label class="run-bound-request-picker" data-help-anchor="attribution-request">
        <span>{{ t("请求") }}</span>
        <select
          :value="selectedRequestId || ''"
          :disabled="!runId || !chain.requestOptions.length"
          @change="chooseRequest"
        >
          <option value="" disabled>{{ t("请选择请求") }}</option>
          <option v-for="option in chain.requestOptions" :key="option.requestId" :value="option.requestId">
            {{ option.requestId }}{{ option.isTailExplainedEntity ? ` · ${t("归因报告对象")}` : "" }}
          </option>
        </select>
      </label>
    </header>

    <PercentileSubjects
      :subjects="chain.percentileSubjects"
      :selected-request-id="selectedRequestId"
      @request-selected="chooseExplicitRequest"
    />

    <div v-if="!runId" class="run-bound-message" role="status">
      <AlertTriangle :size="18" />
      <p>{{ t("当前内容没有 Bridge run ID，不能建立带 SHA-256 的 run-bound 证据链。") }}</p>
    </div>
    <div v-else-if="!selectedRequestId" class="run-bound-message" role="status">
      <Braces :size="18" />
      <p>{{ t("选择一个后端 request_id 后查看可验证的关联；前端不会自行挑选 P99 request。") }}</p>
    </div>

    <template v-else>
      <div class="run-bound-identity-strip">
        <span><GitBranch :size="14" />{{ runId }}</span>
        <span><Link2 :size="14" />{{ selectedRequestId }}</span>
        <span :class="{ warning: chain.contractState !== 'versioned' }">
          {{
            chain.contractState === "compatibility_unversioned"
              ? t("compatibility contract · 未版本化")
              : chain.contractState === "unsupported_schema"
                ? t("unsupported schema · 失败关闭")
                : t("版本化 contract")
          }}
        </span>
      </div>

      <nav class="run-bound-page-links" :aria-label="t('请求证据页面导航')">
        <RouterLink
          v-for="page in visiblePageLinks"
          :key="page.name"
          :to="{ name: page.name, query: routeQuery(selectedRequestId) }"
        >
          {{ t(page.label) }}
        </RouterLink>
      </nav>

      <div class="run-bound-flow" role="region" tabindex="0" :aria-label="t('请求与资源证据关联')">
        <EvidenceNode
          v-if="nodeMap.get('S1')"
          :node="nodeMap.get('S1')!"
          :status-label="statusLabel(nodeMap.get('S1')!)"
        />
        <section class="run-bound-peer-group" :aria-label="t('并列资源语义')">
          <small>{{ t("并列资源语义") }}</small>
          <EvidenceNode
            v-for="node in peerNodes"
            :key="node.subsystem"
            :node="node"
            :status-label="statusLabel(node)"
          />
        </section>
        <EvidenceNode
          v-if="nodeMap.get('S6')"
          :node="nodeMap.get('S6')!"
          :status-label="statusLabel(nodeMap.get('S6')!)"
        />
      </div>

      <section class="run-bound-output-grid" :aria-label="t('执行与证据记录')">
        <h3>{{ t("执行与证据记录") }}</h3>
        <p class="run-bound-output-boundary">
          {{ t("以下记录不作为延迟因果来源。") }}
        </p>
        <EvidenceNode
          v-for="node in outputNodes"
          :key="node.subsystem"
          :node="node"
          :status-label="statusLabel(node)"
          output
        />
      </section>

      <details v-if="chain.gaps.length" class="run-bound-gaps">
        <summary><AlertTriangle :size="16" />{{ t("关联契约与降级详情") }}</summary>
        <ul>
          <li v-for="gap in chain.gaps" :key="gap">{{ t(gap) }}</li>
        </ul>
      </details>
    </template>

    <details v-if="runId" class="week8-execution-panel" :class="`availability--${chain.week8Execution.availability}`">
      <summary>
        <div>
          <strong>{{ t("执行详情") }}</strong>
        </div>
        <span>{{ statusLabel({ availability: chain.week8Execution.availability }) }}</span>
        <ChevronDown :size="17" />
      </summary>
      <div class="week8-execution-body">
        <p>{{ t(chain.week8Execution.detail) }}</p>
        <template v-if="chain.week8Execution.executionMode">
          <dl class="week8-execution-grid">
            <div>
              <dt>{{ t("请求 fidelity") }}</dt>
              <dd>{{ chain.week8Execution.requestedFidelity }}</dd>
            </div>
            <div>
              <dt>{{ t("解析 fidelity") }}</dt>
              <dd>{{ chain.week8Execution.resolvedFidelity }}</dd>
            </div>
            <div>
              <dt>{{ t("执行模式") }}</dt>
              <dd>{{ chain.week8Execution.executionMode }}</dd>
            </div>
            <div v-if="chain.week8Execution.provenance">
              <dt>{{ t("来源模式") }}</dt>
              <dd>{{ chain.week8Execution.provenance.sourceMode }}</dd>
            </div>
          </dl>
          <section v-if="chain.week8Execution.fallback" class="week8-execution-block">
            <strong>{{ t("Fallback") }}</strong>
            <code>{{ chain.week8Execution.fallback.policy }}</code>
            <span>{{ chain.week8Execution.fallback.used ? t("已使用") : t("未使用") }}</span>
            <p v-if="chain.week8Execution.fallback.reason">{{ chain.week8Execution.fallback.reason }}</p>
          </section>
          <dl v-if="chain.week8Execution.stateSummary" class="week8-execution-grid">
            <div>
              <dt>logical_time_ps</dt>
              <dd>{{ formatNumber(chain.week8Execution.stateSummary.logicalTimePs) }}</dd>
            </div>
            <div>
              <dt>partition_count</dt>
              <dd>{{ formatNumber(chain.week8Execution.stateSummary.partitionCount) }}</dd>
            </div>
            <div>
              <dt>committed_event_count</dt>
              <dd>{{ formatNumber(chain.week8Execution.stateSummary.committedEventCount) }}</dd>
            </div>
            <div>
              <dt>pending_event_count</dt>
              <dd>{{ formatNumber(chain.week8Execution.stateSummary.pendingEventCount) }}</dd>
            </div>
          </dl>
          <div class="week8-execution-columns">
            <section v-if="chain.week8Execution.differential" class="week8-execution-block">
              <strong>{{ t("差分校验") }}</strong>
              <span>{{ chain.week8Execution.differential.compared ? t("已比较") : t("未比较") }}</span>
              <span>{{ chain.week8Execution.differential.matched ? t("一致") : t("不一致") }}</span>
              <code>{{ chain.week8Execution.differential.partitionedDigest }}</code>
              <code>{{ chain.week8Execution.differential.referenceDigest }}</code>
              <p v-if="chain.week8Execution.differential.mismatchCode">
                {{ chain.week8Execution.differential.mismatchCode }}
              </p>
            </section>
            <section v-if="chain.week8Execution.stream" class="week8-execution-block">
              <strong>{{ t("事件流摘要") }}</strong>
              <span>
                {{ formatNumber(chain.week8Execution.stream.recordCount) }} /
                {{ formatNumber(chain.week8Execution.stream.totalRecordCount) }}
              </span>
              <span>{{ chain.week8Execution.stream.truncated ? t("已截断") : t("未截断") }}</span>
            </section>
            <section v-if="chain.week8Execution.checkpoint" class="week8-execution-block">
              <strong>{{ t("Checkpoint metadata") }}</strong>
              <code>{{ chain.week8Execution.checkpoint.archiveSchemaIdentity }}</code>
              <code>{{ chain.week8Execution.checkpoint.archiveDigest }}</code>
              <span>
                checkpoint_logical_time_ps ·
                {{ formatNumber(chain.week8Execution.checkpoint.checkpointLogicalTimePs) }}
              </span>
              <span>
                {{ t("计数") }} · {{ formatNumber(chain.week8Execution.checkpoint.committedEventCount) }} /
                {{ formatNumber(chain.week8Execution.checkpoint.pendingEventCount) }} /
                {{ formatNumber(chain.week8Execution.checkpoint.completedIdentityCount) }} /
                {{ formatNumber(chain.week8Execution.checkpoint.subjectVersionCount) }}
              </span>
              <span>payload · {{ chain.week8Execution.checkpoint.payloadAvailability }}</span>
            </section>
          </div>
          <ArtifactEvidenceLink
            v-if="chain.week8Execution.reference"
            :source-path="chain.week8Execution.reference.sourcePath"
            :label="chain.week8Execution.reference.label"
          />
        </template>
      </div>
    </details>
  </section>
</template>
