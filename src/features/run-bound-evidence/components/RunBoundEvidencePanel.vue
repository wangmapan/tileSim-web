<script setup lang="ts">
import { AlertTriangle, ArrowRight, Braces, ChevronDown, GitBranch, Link2, Network } from "@lucide/vue";
import { computed, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import ArtifactEvidenceLink from "../../../components/ArtifactEvidenceLink.vue";
import type { ArtifactManifestResponse } from "../../../lib/api";
import type { ReportBundle, RunInputs } from "../../../contracts/report-model";
import { useI18n } from "../../../i18n";
import { formatNumber } from "../../../lib/format";
import { buildRunBoundEvidenceChain } from "../model";
import type { RunBoundAvailability, RunBoundEvidenceNode } from "../types";

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
  { name: "attribution", label: "请求证据" },
  { name: "execution", label: "分层结果" },
  { name: "validation", label: "验证边界" },
] as const;
const visiblePageLinks = computed(() => pageLinks.filter((page) => page.name !== route.name));
const peerNodes = computed(
  () => peerSubsystems.map((id) => nodeMap.value.get(id)).filter(Boolean) as RunBoundEvidenceNode[],
);
const outputNodes = computed(
  () => outputSubsystems.map((id) => nodeMap.value.get(id)).filter(Boolean) as RunBoundEvidenceNode[],
);
const visibleOutputIdCount = 3;
const visibleOutputReferenceCount = 2;

function isCurrentPercentileSubject(subject: { memberRequestIds: string[] }) {
  return Boolean(props.selectedRequestId && subject.memberRequestIds.includes(props.selectedRequestId));
}

function hiddenOutputItemCount(node: RunBoundEvidenceNode) {
  return (
    Math.max(0, node.entityIds.length - visibleOutputIdCount) +
    Math.max(0, node.references.length - visibleOutputReferenceCount)
  );
}

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
  <section class="panel run-bound-evidence-panel" aria-labelledby="run-bound-evidence-title">
    <header class="panel-header panel-header--row">
      <div>
        <p class="section-kicker">REQUEST EVIDENCE CHAIN</p>
        <h2 id="run-bound-evidence-title">{{ t("请求级跨子系统证据链") }}</h2>
        <p>{{ t("只使用后端显式 ID；S3、S4、S5 保持并列，缺少契约的跳转会准确降级。") }}</p>
      </div>
      <label class="run-bound-request-picker">
        <span>{{ t("选择 request_id") }}</span>
        <select
          :value="selectedRequestId || ''"
          :disabled="!runId || !chain.requestOptions.length"
          @change="chooseRequest"
        >
          <option value="" disabled>{{ t("请选择请求") }}</option>
          <option v-for="option in chain.requestOptions" :key="option.requestId" :value="option.requestId">
            {{ option.requestId }}{{ option.isTailExplainedEntity ? ` · ${t("S9 解释对象")}` : "" }}
          </option>
        </select>
      </label>
    </header>

    <section v-if="chain.percentileSubjects.length" class="run-bound-percentile-section">
      <header>
        <div>
          <small>PERCENTILE SUBJECTS</small>
          <strong>{{ t("后端选择的 P99 对象") }}</strong>
        </div>
        <p>{{ t("不按延迟排序、数值相等或数组位置推断 request。") }}</p>
      </header>
      <div class="run-bound-percentile-grid">
        <article
          v-for="subject in chain.percentileSubjects"
          :key="subject.key"
          :class="{ 'is-current-request': isCurrentPercentileSubject(subject) }"
          :aria-current="isCurrentPercentileSubject(subject) ? 'true' : undefined"
        >
          <header>
            <code>{{ subject.metricKind }}</code>
            <div class="run-bound-percentile-status">
              <span :class="`availability--${subject.availability}`">{{ subject.semantics }}</span>
              <span v-if="isCurrentPercentileSubject(subject)" class="current-request-marker">
                {{ t("当前 request") }}
              </span>
            </div>
          </header>
          <strong>{{ formatNumber(subject.valuePs) }} ps</strong>
          <p>{{ t(subject.detail) }}</p>
          <small>{{ t("选择规则") }} · {{ subject.selectionRule }}</small>
          <div v-if="subject.memberRequestIds.length" class="run-bound-member-set">
            <code v-for="member in subject.memberRequestIds" :key="member">{{ member }}</code>
          </div>
          <button
            v-if="
              subject.semantics === 'single_request' &&
              subject.selectedRequestId &&
              subject.availability === 'available'
            "
            class="button button--secondary"
            type="button"
            @click="chooseExplicitRequest(subject.selectedRequestId)"
          >
            {{ t("定位 P99 request") }}
          </button>
          <ArtifactEvidenceLink
            v-if="subject.reference"
            :source-path="subject.reference.sourcePath"
            :label="subject.reference.label"
          />
        </article>
      </div>
    </section>

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

      <div class="run-bound-flow" :aria-label="t('S1 到 S6 的请求证据链')">
        <article v-if="nodeMap.get('S1')" class="run-bound-node">
          <header>
            <span>S1</span><strong>{{ t(nodeMap.get("S1")!.title) }}</strong>
          </header>
          <small :class="`availability--${nodeMap.get('S1')!.availability}`">{{
            statusLabel(nodeMap.get("S1")!)
          }}</small>
          <p>{{ t(nodeMap.get("S1")!.detail) }}</p>
          <code v-for="id in nodeMap.get('S1')!.entityIds" :key="id">{{ id }}</code>
          <div class="run-bound-reference-list">
            <ArtifactEvidenceLink
              v-for="item in nodeMap.get('S1')!.references"
              :key="item.sourcePath"
              :source-path="item.sourcePath"
              :label="item.label"
            />
          </div>
        </article>

        <ArrowRight class="run-bound-arrow" :size="18" />
        <section class="run-bound-peer-group">
          <small>RESOURCE SEMANTICS · PEERS</small>
          <article v-for="node in peerNodes" :key="node.subsystem" class="run-bound-node">
            <header>
              <span>{{ node.subsystem }}</span
              ><strong>{{ t(node.title) }}</strong>
            </header>
            <small :class="`availability--${node.availability}`">{{ statusLabel(node) }}</small>
            <p>{{ t(node.detail) }}</p>
            <code v-for="id in node.entityIds" :key="id">{{ id }}</code>
            <ArtifactEvidenceLink
              v-for="item in node.references"
              :key="item.sourcePath"
              :source-path="item.sourcePath"
              :label="item.label"
            />
          </article>
        </section>
        <ArrowRight class="run-bound-arrow" :size="18" />

        <article v-if="nodeMap.get('S6')" class="run-bound-node">
          <header>
            <span>S6</span><strong>{{ t(nodeMap.get("S6")!.title) }}</strong>
          </header>
          <small :class="`availability--${nodeMap.get('S6')!.availability}`">{{
            statusLabel(nodeMap.get("S6")!)
          }}</small>
          <p>{{ t(nodeMap.get("S6")!.detail) }}</p>
          <code v-for="id in nodeMap.get('S6')!.entityIds" :key="id">{{ id }}</code>
          <div class="run-bound-reference-list">
            <ArtifactEvidenceLink
              v-for="item in nodeMap.get('S6')!.references"
              :key="item.sourcePath"
              :source-path="item.sourcePath"
              :label="item.label"
            />
          </div>
        </article>
      </div>

      <div class="run-bound-output-grid">
        <article v-for="node in outputNodes" :key="node.subsystem" class="run-bound-output-node">
          <Network :size="17" />
          <div>
            <header>
              <span>{{ node.subsystem }}</span
              ><strong>{{ t(node.title) }}</strong>
            </header>
            <small :class="`availability--${node.availability}`">{{ statusLabel(node) }}</small>
            <p>{{ t(node.detail) }}</p>
            <code v-for="id in node.entityIds.slice(0, visibleOutputIdCount)" :key="id">{{ id }}</code>
            <ArtifactEvidenceLink
              v-for="item in node.references.slice(0, visibleOutputReferenceCount)"
              :key="item.sourcePath"
              :source-path="item.sourcePath"
              :label="item.label"
            />
            <details v-if="hiddenOutputItemCount(node)" class="run-bound-output-more">
              <summary>
                {{ t("展开完整证据（{count} 项）", { count: hiddenOutputItemCount(node) }) }}
              </summary>
              <code v-for="id in node.entityIds.slice(visibleOutputIdCount)" :key="id">{{ id }}</code>
              <ArtifactEvidenceLink
                v-for="item in node.references.slice(visibleOutputReferenceCount)"
                :key="item.sourcePath"
                :source-path="item.sourcePath"
                :label="item.label"
              />
            </details>
          </div>
        </article>
      </div>

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
