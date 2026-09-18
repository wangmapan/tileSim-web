<script setup lang="ts">
import { Braces, ChevronLeft, ChevronRight, Clipboard, ExternalLink, Search } from "@lucide/vue";
import { computed, inject, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { routeLocationKey } from "vue-router";
import {
  ArtifactIndexWorkerClient,
  ArtifactVirtualViewer,
  inspectArtifactText,
  parseArtifactEvidenceQuery,
  rawArtifactUrl,
  releaseArtifactText,
  type ArtifactEvidenceTarget,
  type ArtifactLineMatch,
  type ArtifactVirtualLine,
} from "../features/inspect-artifact";
import { formatNumber } from "../lib/format";
import { useDashboard } from "../store/dashboard";
import type { ReportKind } from "../contracts/report-model";
import { useI18n } from "../i18n";
import { GuidedHelpTrigger } from "../features/guided-help";

interface ArtifactDefinition {
  id: string;
  kind?: ReportKind;
  label: string;
  value: () => unknown;
}

const { state, notify } = useDashboard();
const { t } = useI18n();
const route = inject(routeLocationKey, null);
const selectedArtifact = ref("run-result");
const query = ref("");
const loading = ref(false);
const searching = ref(false);
const rawText = ref("");
const totalLines = ref(0);
const windowLines = ref<ArtifactVirtualLine[]>([]);
const windowRevision = ref(0);
const showPointers = ref(true);
const searchMatches = ref<ArtifactLineMatch[]>([]);
const activeMatchIndex = ref(-1);
const searchMatchCount = ref<number | null>(null);
const searchTruncated = ref(false);
const indexStats = ref<{ lineCount: number; pointerCount: number; durationMs: number } | null>(null);
const indexError = ref("");
const evidenceError = ref("");
const detailsOpen = ref(false);
const detailsElement = ref<HTMLDetailsElement | null>(null);
const virtualViewer = ref<{ scrollToLine: (lineNumber: number) => void } | null>(null);
const evidenceTarget = ref<ArtifactEvidenceTarget | null>(null);
const evidenceLine = ref<number | null>(null);
const evidencePointer = ref("");
const workerClient = new ArtifactIndexWorkerClient();
let loadRevision = 0;
let windowLoadRevision = 0;
let searchRevision = 0;
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let lastEvidenceSignature = "";
let suppressToggleLoad = false;

const definitions: ArtifactDefinition[] = [
  { id: "input-runtime-trace", label: "S1 输入 · Runtime trace", value: () => state.inputs?.runtime_trace },
  { id: "input-topology", label: "S6 输入 · Topology", value: () => state.inputs?.topology },
  { id: "run-result", kind: "run", label: "运行结果 · Run", value: () => state.bundle.run },
  { id: "metrics", kind: "metrics", label: "指标 · Metrics", value: () => state.bundle.metrics },
  { id: "validation", kind: "validation", label: "验证 · Validation", value: () => state.bundle.validation },
  { id: "tail-cause-chain", kind: "tail", label: "归因 · Tail cause", value: () => state.bundle.tail },
  {
    id: "execution-envelope",
    kind: "execution_envelope",
    label: "宿主 · Execution envelope",
    value: () => state.bundle.execution_envelope,
  },
  {
    id: "design-space",
    kind: "design_space",
    label: "设计空间 · Design space",
    value: () => state.bundle.design_space,
  },
];

function definitionValue(definition: ArtifactDefinition): unknown {
  return definition.value() || (definition.kind ? state.bundle.unsupported?.[definition.kind] : null);
}

const availableDefinitions = computed(() => {
  const manifested = new Set(state.artifactManifest?.artifacts.map((artifact) => artifact.artifact_id) || []);
  return definitions.filter((definition) => definitionValue(definition) || manifested.has(definition.id));
});
const currentDefinition = computed(
  () => definitions.find((definition) => definition.id === selectedArtifact.value) || definitions[0],
);
const currentValue = computed(() => definitionValue(currentDefinition.value) || null);
const activeLine = computed(
  () => searchMatches.value[activeMatchIndex.value]?.lineNumber ?? evidenceLine.value ?? null,
);

function valueSchemaIdentity(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  if (typeof record.contract_version === "string") return record.contract_version;
  return typeof record.schema_version === "string" ? record.schema_version : "";
}

async function localTextHash(text: string) {
  if (!globalThis.crypto?.subtle) return "f".repeat(64);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function resetIndexedView() {
  rawText.value = "";
  totalLines.value = 0;
  windowLines.value = [];
  windowRevision.value += 1;
  windowLoadRevision += 1;
  searchMatches.value = [];
  activeMatchIndex.value = -1;
  evidenceLine.value = null;
  searchMatchCount.value = null;
  searchTruncated.value = false;
  indexStats.value = null;
  indexError.value = "";
  evidenceError.value = "";
}

function evidenceQueryContext() {
  const backendIdentity = state.bridge.identity;
  return {
    backendRevision:
      (typeof backendIdentity?.source_revision === "string" && backendIdentity.source_revision) ||
      (typeof backendIdentity?.build_revision === "string" && backendIdentity.build_revision) ||
      "unknown",
    manifest: state.bridge.manifest,
  };
}

function releaseCurrentArtifact() {
  loadRevision += 1;
  searchRevision += 1;
  if (searchTimer) clearTimeout(searchTimer);
  workerClient.cancelSearch();
  workerClient.dispose();
  if (state.runId) {
    releaseArtifactText(state.runId, selectedArtifact.value, state.artifactManifest, evidenceQueryContext());
  }
  resetIndexedView();
  loading.value = false;
  searching.value = false;
}

async function loadWindow(startLine: number, lineCount: number) {
  const artifactRevision = loadRevision;
  const requestRevision = ++windowLoadRevision;
  try {
    const response = await workerClient.readLines(startLine, lineCount);
    if (artifactRevision !== loadRevision || requestRevision !== windowLoadRevision) return;
    windowLines.value = response.lines;
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      indexError.value = error instanceof Error ? error.message : String(error);
    }
  }
}

function activateMatch(index: number) {
  if (!searchMatches.value.length) return;
  activeMatchIndex.value = (index + searchMatches.value.length) % searchMatches.value.length;
  virtualViewer.value?.scrollToLine(searchMatches.value[activeMatchIndex.value].lineNumber);
}

watch(
  availableDefinitions,
  (definitions) => {
    if (definitions.length && !definitions.some((definition) => definition.id === selectedArtifact.value)) {
      selectedArtifact.value = definitions[0].id;
      query.value = "";
    }
  },
  { immediate: true },
);

async function loadCurrent() {
  const revision = ++loadRevision;
  resetIndexedView();
  loading.value = true;
  try {
    const entry = state.artifactManifest?.artifacts.find((artifact) => artifact.artifact_id === selectedArtifact.value);
    if (state.artifactManifest && !entry) throw new Error(t("该工件不在当前运行的可信清单中。"));
    if (
      evidenceTarget.value?.artifactId === selectedArtifact.value &&
      entry &&
      entry.sha256.toLowerCase() !== evidenceTarget.value.sha256
    ) {
      throw new Error(t("证据链接的 SHA-256 与当前工件清单不一致。"));
    }
    let text = "";
    if (state.runId) {
      text = await inspectArtifactText(
        state.runId,
        selectedArtifact.value,
        state.artifactManifest,
        evidenceQueryContext(),
      );
    } else if (currentValue.value) {
      text = JSON.stringify(currentValue.value);
    }
    if (!text) return;
    if (revision !== loadRevision) return;
    rawText.value = text;
    const response = await workerClient.index(
      {
        runId: state.runId || "local-import",
        artifactId: selectedArtifact.value,
        sha256: entry?.sha256 || (await localTextHash(text)),
        schemaIdentity: entry?.schema_identity || valueSchemaIdentity(currentValue.value),
      },
      text,
    );
    if (revision !== loadRevision) return;
    totalLines.value = response.lineCount;
    indexStats.value = {
      lineCount: response.lineCount,
      pointerCount: response.pointerCount,
      durationMs: response.durationMs,
    };
    windowRevision.value += 1;
    if (evidenceTarget.value?.artifactId === selectedArtifact.value) {
      const located = await workerClient.locatePointer(evidenceTarget.value.pointer);
      if (revision !== loadRevision) return;
      if (!located.match) {
        evidenceError.value = t("当前工件中不存在 JSON Pointer：{pointer}", {
          pointer: evidenceTarget.value.pointer || t("根 Pointer"),
        });
        return;
      }
      evidenceLine.value = located.match.lineNumber;
      evidencePointer.value = evidenceTarget.value.pointer;
      await nextTick();
      virtualViewer.value?.scrollToLine(located.match.lineNumber);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    indexError.value = error instanceof Error ? error.message : String(error);
    notify(t("读取完整 JSON 失败：{message}", { message: indexError.value }), "danger");
  } finally {
    if (revision === loadRevision) loading.value = false;
  }
}

async function copyJson() {
  if (!rawText.value) return;
  try {
    await navigator.clipboard.writeText(rawText.value);
    notify(t("完整 JSON 已复制。"), "positive");
  } catch {
    notify(t("浏览器未允许复制，请使用原始 JSON 链接。"), "danger");
  }
}

function onToggle(event: Event) {
  if (!(event.currentTarget instanceof HTMLDetailsElement)) return;
  detailsOpen.value = event.currentTarget.open;
  if (suppressToggleLoad) {
    suppressToggleLoad = false;
    return;
  }
  if (detailsOpen.value) void loadCurrent();
  else releaseCurrentArtifact();
}

function onArtifactChange() {
  query.value = "";
  evidenceTarget.value = null;
  evidenceLine.value = null;
  evidencePointer.value = "";
  void loadCurrent();
}

watch(
  [() => route?.fullPath || "", () => state.artifactManifest],
  async () => {
    const target = parseArtifactEvidenceQuery(route?.query || {});
    if (!target || target.runId !== state.runId) return;
    const entry = state.artifactManifest?.artifacts.find((artifact) => artifact.artifact_id === target.artifactId);
    if (!entry) return;
    const signature = [target.runId, target.artifactId, target.sha256, target.pointer, entry.sha256].join("::");
    if (signature === lastEvidenceSignature) return;
    lastEvidenceSignature = signature;
    evidenceTarget.value = target;
    evidencePointer.value = target.pointer;
    selectedArtifact.value = target.artifactId;
    query.value = "";
    await nextTick();
    if (detailsElement.value && !detailsElement.value.open) {
      suppressToggleLoad = true;
      detailsElement.value.open = true;
    }
    detailsOpen.value = true;
    if (entry.sha256.toLowerCase() !== target.sha256) {
      resetIndexedView();
      indexError.value = t("证据链接的 SHA-256 与当前工件清单不一致。");
      return;
    }
    await loadCurrent();
  },
  { immediate: true, flush: "post" },
);

watch(
  () => state.runId,
  () => {
    if (detailsOpen.value) void loadCurrent();
  },
);

watch(query, (value) => {
  searchRevision += 1;
  const revision = searchRevision;
  if (searchTimer) clearTimeout(searchTimer);
  searchMatches.value = [];
  activeMatchIndex.value = -1;
  searchMatchCount.value = null;
  searchTruncated.value = false;
  if (!value.trim() || !totalLines.value) {
    workerClient.cancelSearch();
    searching.value = false;
    return;
  }
  searchTimer = setTimeout(async () => {
    searching.value = true;
    try {
      const response = await workerClient.search(value, 200);
      if (revision !== searchRevision) return;
      searchMatches.value = response.matches;
      searchMatchCount.value = response.totalMatches;
      searchTruncated.value = response.truncated;
      if (response.matches.length) activateMatch(0);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        notify(
          t("搜索 JSON 失败：{message}", { message: error instanceof Error ? error.message : String(error) }),
          "danger",
        );
      }
    } finally {
      if (revision === searchRevision) searching.value = false;
    }
  }, 120);
});

onBeforeUnmount(releaseCurrentArtifact);
</script>

<template>
  <details ref="detailsElement" class="panel json-artifact-panel" @toggle="onToggle">
    <summary data-help-anchor="raw_evidence-open">
      <span
        ><Braces :size="18" /><span
          ><strong>{{ t("完整 JSON 证据") }}</strong
          ><small>{{ t("8 类工件全部按原字段查看") }}</small></span
        ></span
      >
      <span>{{ t("按需加载") }}</span>
    </summary>
    <div class="json-artifact-body">
      <GuidedHelpTrigger guide-id="raw_evidence" label="原始证据帮助" />
      <header>
        <label data-help-anchor="raw_evidence-artifact">
          <small>{{ t("选择工件") }}</small>
          <select v-model="selectedArtifact" @change="onArtifactChange">
            <option v-for="artifact in availableDefinitions" :key="artifact.id" :value="artifact.id">
              {{ t(artifact.label) }}
            </option>
          </select>
        </label>
        <label class="json-search-field" data-help-anchor="raw_evidence-search">
          <small>{{ t("搜索字段或值") }}</small>
          <span
            ><Search :size="15" /><input v-model="query" type="search" :placeholder="t('例如 device_latency_us')"
          /></span>
        </label>
        <button class="button button--secondary" :disabled="!rawText" @click="copyJson">
          <Clipboard :size="15" />{{ t("复制完整 JSON") }}
        </button>
        <a
          v-if="state.runId"
          class="button button--secondary"
          :href="rawArtifactUrl(state.runId, selectedArtifact)"
          target="_blank"
          rel="noopener"
        >
          {{ t("原始文件") }}<ExternalLink :size="14" />
        </a>
      </header>
      <div class="json-artifact-meta" data-help-anchor="raw_evidence-verify">
        <span>{{
          loading ? t("正在读取并建立索引…") : t("{count} 个字符", { count: formatNumber(rawText.length, 0) })
        }}</span>
        <span v-if="indexStats">{{
          t("Worker 已索引 {lines} 行 / {pointers} 个 Pointer", {
            lines: formatNumber(indexStats.lineCount, 0),
            pointers: formatNumber(indexStats.pointerCount, 0),
          })
        }}</span>
        <span v-if="searching">{{ t("正在搜索索引…") }}</span>
        <span v-else-if="searchMatchCount !== null">{{ t("{count} 个匹配行", { count: searchMatchCount }) }}</span>
        <span>{{
          query ? t("搜索会定位并高亮匹配行；复制与原始文件保持完整") : t("仅按视口加载行；复制与原始文件保持完整")
        }}</span>
        <span v-if="searchTruncated">{{ t("可导航前 200 条匹配，匹配总数保持准确") }}</span>
      </div>
      <div v-if="evidenceLine !== null" class="artifact-evidence-target" role="status">
        {{
          t("已定位证据：{pointer} · 第 {line} 行", {
            pointer: evidencePointer || t("根 Pointer"),
            line: evidenceLine,
          })
        }}
      </div>
      <div v-if="evidenceError" class="json-artifact-alert" role="alert">
        {{ evidenceError }}
      </div>
      <div v-if="indexError && totalLines" class="json-artifact-alert" role="alert">
        {{ t("Worker 处理失败：{message}。浏览内容仍可查看，但当前操作未完成。", { message: indexError }) }}
      </div>
      <div v-if="totalLines" class="artifact-viewer-toolbar">
        <label class="artifact-pointer-toggle">
          <input v-model="showPointers" type="checkbox" />
          <span>{{ t("显示 JSON Pointer") }}</span>
        </label>
        <nav v-if="searchMatches.length" class="artifact-search-nav" :aria-label="t('匹配行导航')">
          <button type="button" :aria-label="t('上一个匹配')" @click="activateMatch(activeMatchIndex - 1)">
            <ChevronLeft :size="15" />
          </button>
          <span>{{
            t("第 {current} / {count} 个可导航匹配", {
              current: activeMatchIndex + 1,
              count: searchMatches.length,
            })
          }}</span>
          <button type="button" :aria-label="t('下一个匹配')" @click="activateMatch(activeMatchIndex + 1)">
            <ChevronRight :size="15" />
          </button>
        </nav>
      </div>
      <ArtifactVirtualViewer
        v-if="totalLines"
        ref="virtualViewer"
        :total-lines="totalLines"
        :lines="windowLines"
        :active-line="activeLine"
        :show-pointers="showPointers"
        :revision="windowRevision"
        @request-window="loadWindow"
      />
      <div v-else-if="indexError" class="json-artifact-empty json-artifact-empty--error">
        {{ t("Worker 处理失败：{message}。仍可复制完整 JSON 或打开原始文件。", { message: indexError }) }}
      </div>
      <div v-else class="json-artifact-empty">
        {{ loading ? t("正在加载完整 JSON…") : t("该工件不存在或尚未载入。") }}
      </div>
    </div>
  </details>
</template>
