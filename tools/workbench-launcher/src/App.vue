<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import ConfirmDialog from "./components/ConfirmDialog.vue";
import ErrorPanel from "./components/ErrorPanel.vue";
import StatusMark from "./components/StatusMark.vue";
import { createLauncherBridge } from "./bridge";
import {
  appendBoundedLog,
  initialOperationState,
  isOperationActive,
  phaseLabel,
  reduceOperation,
} from "./operationMachine";
import type { LauncherSnapshot, OperationRequest, PageId, StatusTone } from "./types";

const bridge = createLauncherBridge();
const pages: Array<{ id: PageId; label: string; short: string }> = [
  { id: "overview", label: "概览", short: "概览" },
  { id: "deployment", label: "部署设置", short: "部署" },
  { id: "model", label: "模型服务", short: "模型" },
  { id: "diagnostics", label: "环境诊断", short: "诊断" },
  { id: "logs", label: "操作日志", short: "日志" },
];

const storedPage = localStorage.getItem("tilesim.launcher.page") as PageId | null;
const currentPage = ref<PageId>(pages.some((page) => page.id === storedPage) ? storedPage! : "overview");
const storedTheme = localStorage.getItem("tilesim.launcher.theme");
const theme = ref(storedTheme === "dark" ? "dark" : "light");
const snapshot = ref<LauncherSnapshot>();
const loading = ref(true);
const refreshError = ref("");
const openError = ref("");
const operation = reactive(initialOperationState());
const logs = ref<string[]>([]);
const recentLines = ref<string[]>([]);
const operationKind = ref<"start" | "deploy_local" | "deploy" | null>(null);
const startedAt = ref(0);
const clockNow = ref(0);
let clockTimer: ReturnType<typeof setTimeout> | undefined;
const mainRegion = ref<HTMLElement>();
const logRegion = ref<HTMLElement>();
const apiKeyInput = ref<HTMLInputElement>();
const modelForm = ref<HTMLFormElement>();
const backendRepository = ref("");
const backendDeployment = ref("");
const wslDistro = ref("Ubuntu-24.04");
const baseUrl = ref("");
const modelName = ref("gpt-5.6-sol");
const timeoutMs = ref(30_000);
const formErrors = reactive<Record<string, string>>({});
const unlisten = ref<() => void>();
const lastTrigger = ref<HTMLElement>();
const lastOperationKind = ref<OperationRequest["kind"] | null>(null);
const confirm = ref<{
  title: string;
  description: string;
  confirmLabel: string;
  dangerous?: boolean;
  request: OperationRequest;
} | null>(null);

const active = computed(() => isOperationActive(operation.phase));
const elapsed = computed(() => {
  const milliseconds = active.value
    ? Math.max(operation.elapsedMs, clockNow.value - startedAt.value)
    : operation.elapsedMs;
  return `${(milliseconds / 1000).toFixed(1)} 秒`;
});
const operationTitle = computed(() => {
  if (operationKind.value === "start") return "启动工作台";
  if (operationKind.value === "deploy_local") return "部署当前代码";
  return "更新并部署最新 main";
});
const serviceTone = computed<StatusTone>(() => {
  if (!snapshot.value) return "neutral";
  return snapshot.value.service.state === "ready"
    ? "positive"
    : snapshot.value.service.state === "degraded"
      ? "danger"
      : "warning";
});
const readinessCount = computed(
  () => snapshot.value?.environment.filter((item) => item.status === "ready").length ?? 0,
);
const shortRevision = (value: string | null) => value?.slice(0, 12) || "—";

watch(theme, (value) => {
  document.documentElement.dataset.appearance = value;
  localStorage.setItem("tilesim.launcher.theme", value);
});
watch(currentPage, (value) => localStorage.setItem("tilesim.launcher.page", value));

function applySnapshot(value: LauncherSnapshot) {
  snapshot.value = value;
  backendRepository.value ||= value.paths.backendRepository;
  backendDeployment.value ||= value.paths.backendDeployment;
  baseUrl.value = value.model.baseUrl;
  modelName.value = value.model.model || "gpt-5.6-sol";
  timeoutMs.value = value.model.timeoutMs || 30_000;
}

async function refreshSnapshot() {
  loading.value = true;
  refreshError.value = "";
  try {
    applySnapshot(await bridge.getSnapshot());
  } catch (error) {
    refreshError.value = `无法读取本地状态。请打开环境诊断并确认 Web checkout 完整。${String(error)}`;
  } finally {
    loading.value = false;
  }
}

function selectPage(page: PageId) {
  currentPage.value = page;
  nextTick(() => mainRegion.value?.focus());
}

function beginConfirmed(request: OperationRequest, title: string, description: string, trigger: Event) {
  if (active.value) return;
  lastTrigger.value = trigger.currentTarget as HTMLElement;
  confirm.value = { title, description, confirmLabel: "确认继续", dangerous: true, request };
}

function tickClock() {
  clockNow.value = Date.now();
  if (active.value) clockTimer = window.setTimeout(tickClock, 250);
}

function markOperationPending(message: string) {
  if (clockTimer) clearTimeout(clockTimer);
  operationKind.value = null;
  recentLines.value = [];
  startedAt.value = Date.now();
  clockNow.value = startedAt.value;
  Object.assign(operation, {
    operationId: null,
    sequence: 0,
    phase: "checking_environment",
    message,
    elapsedMs: 0,
    error: null,
  });
  clockTimer = window.setTimeout(tickClock, 250);
}

async function markOperationBlocked(error: unknown) {
  if (clockTimer) clearTimeout(clockTimer);
  const structured = error as Partial<{
    category: string;
    action: string;
    technicalDetail: string;
  }>;
  Object.assign(operation, {
    ...initialOperationState(),
    phase: "blocked",
    message: "操作已阻止",
    error: {
      category: structured.category ?? "操作竞争",
      action: structured.action ?? "等待当前任务完成后再试。",
      technicalDetail: structured.technicalDetail ?? String(error),
    },
  });
  await nextTick();
  lastTrigger.value?.focus();
}

async function runConfirmed() {
  const pending = confirm.value;
  confirm.value = null;
  if (!pending || active.value) return;
  await runRequest(pending.request);
}

async function runRequest(request: OperationRequest) {
  if (active.value) return;
  lastOperationKind.value = request.kind;
  markOperationPending("正在建立安全操作上下文…");
  if (request.kind === "start" || request.kind === "deploy_local" || request.kind === "deploy") {
    operationKind.value = request.kind;
    await nextTick();
    mainRegion.value?.scrollTo?.({ top: 0 });
  }
  try {
    const result = await bridge.runOperation(request);
    operation.operationId ??= result.operationId;
  } catch (error) {
    lastOperationKind.value = null;
    await markOperationBlocked(error);
  }
}

async function startService(event: Event) {
  if (active.value || !snapshot.value) return;
  openError.value = "";
  lastTrigger.value = event.currentTarget as HTMLElement;
  if (!snapshot.value?.deployment.manifestPresent) {
    await deployLocal(event);
    return;
  }
  if (snapshot.value.service.state === "ready") {
    operationKind.value = null;
    Object.assign(operation, initialOperationState());
    try {
      await bridge.openWorkbench();
    } catch (error) {
      openError.value = `无法打开浏览器，请检查默认浏览器设置后重试。${String(error)}`;
    }
    return;
  }
  await runRequest({ kind: "start", wslDistro: wslDistro.value.trim() || "Ubuntu-24.04" });
}

async function stopService(event: Event) {
  beginConfirmed(
    { kind: "stop", wslDistro: wslDistro.value.trim() || "Ubuntu-24.04" },
    "停止本地服务？",
    "只停止 TileSim Web 的 127.0.0.1:5173 桥接服务，不关闭 WSL，也不修改部署文件。",
    event,
  );
}

async function deploy(event: Event) {
  if (!backendRepository.value.trim()) {
    formErrors.backendRepository = "请选择后端仓库目录。";
    await nextTick();
    document.querySelector<HTMLInputElement>("#backend-repository")?.focus();
    return;
  }
  beginConfirmed(
    {
      kind: "deploy",
      backendRepository: backendRepository.value.trim(),
      backendDeployment: backendDeployment.value.trim(),
      wslDistro: wslDistro.value.trim() || "Ubuntu-24.04",
    },
    "更新并部署最新 main？",
    "将获取后端 origin/main，在独立部署工作树中构建、测试、发布 immutable release，完成后重启本地服务。",
    event,
  );
}

async function deployLocal(event: Event) {
  if (!backendRepository.value.trim()) {
    formErrors.backendRepository = "请选择后端仓库目录。";
    selectPage("deployment");
    await nextTick();
    document.querySelector<HTMLInputElement>("#backend-repository")?.focus();
    return;
  }
  beginConfirmed(
    {
      kind: "deploy_local",
      backendRepository: backendRepository.value.trim(),
      wslDistro: wslDistro.value.trim() || "Ubuntu-24.04",
    },
    "部署当前本地工作树？",
    `后端：${backendRepository.value.trim()}；Web：${snapshot.value?.paths.webRoot ?? "当前 checkout"}。` +
      "将使用两处当前文件（包括未提交改动）构建和验证，不 fetch、不 push、不切换分支；发布后重启 127.0.0.1:5173。" +
      "请先确认没有其他任务持续改写源码；启动器不会强制结束开发进程。",
    event,
  );
}

async function repairWsl(event: Event) {
  beginConfirmed(
    { kind: "repair_wsl", wslDistro: wslDistro.value.trim() || "Ubuntu-24.04" },
    "请求管理员权限修复 WSL？",
    "Windows 将显示管理员授权提示。启动器只调用仓库内固定的 WSL 修复入口。",
    event,
  );
}

function validBaseUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname))
    );
  } catch {
    return false;
  }
}

async function saveModel(event: Event) {
  Object.keys(formErrors).forEach((key) => delete formErrors[key]);
  if (!validBaseUrl(baseUrl.value.trim())) {
    formErrors.baseUrl = "请填写 HTTPS 地址，或 loopback HTTP 地址。";
  }
  if (!modelName.value.trim()) formErrors.modelName = "请填写准确的模型名。";
  const submittedKey = apiKeyInput.value?.value ?? "";
  const keepExistingKey = !submittedKey && Boolean(snapshot.value?.model.protectedKeyPresent);
  if (!submittedKey && !keepExistingKey) formErrors.apiKey = "首次配置必须填写 API Key。";
  const firstError = modelForm.value?.querySelector<HTMLElement>("[aria-invalid='true']");
  if (Object.keys(formErrors).length) {
    await nextTick();
    (firstError ?? modelForm.value?.querySelector<HTMLElement>("[aria-invalid='true']"))?.focus();
    return;
  }
  const submitter = event instanceof SubmitEvent ? event.submitter : null;
  lastTrigger.value = submitter instanceof HTMLElement ? submitter : (event.currentTarget as HTMLElement);
  if (apiKeyInput.value) apiKeyInput.value.value = "";
  const request: OperationRequest = {
    kind: "save_model",
    baseUrl: baseUrl.value.trim(),
    model: modelName.value.trim(),
    timeoutMs: timeoutMs.value,
    apiKey: submittedKey || null,
    keepExistingKey,
  };
  markOperationPending("正在通过 Windows DPAPI 安全保存…");
  try {
    const result = await bridge.runOperation(request);
    operation.operationId ??= result.operationId;
  } catch (error) {
    await markOperationBlocked(error);
  } finally {
    request.apiKey = null;
  }
}

async function chooseBackendDirectory() {
  const selected = await bridge.pickBackendDirectory(backendRepository.value);
  if (selected) {
    backendRepository.value = selected;
    formErrors.backendRepository = "";
  }
}

function handleOperationEvent(event: Parameters<typeof reduceOperation>[1]) {
  const previousActive = active.value;
  Object.assign(operation, reduceOperation({ ...operation }, event));
  if (event.logLine) {
    logs.value = appendBoundedLog(logs.value, event.logLine);
    recentLines.value = appendBoundedLog(recentLines.value, event.logLine, 2);
  }
  if (previousActive && !isOperationActive(event.phase)) {
    if (clockTimer) clearTimeout(clockTimer);
    const completedKind = lastOperationKind.value;
    lastOperationKind.value = null;
    void refreshSnapshot();
    if (event.phase === "succeeded" && (completedKind === "start" || completedKind === "deploy_local")) {
      // Both scripts wait for the bridge health check before succeeding.
      window.setTimeout(() => {
        void bridge.openWorkbench().catch((error) => {
          openError.value = `服务已就绪，但无法自动打开浏览器。请点击“一键启动工作台”重试。${String(error)}`;
        });
        void refreshSnapshot();
      }, 350);
    }
    nextTick(() => lastTrigger.value?.focus());
  }
}

function handleScrollKeys(event: KeyboardEvent) {
  if (event.target !== mainRegion.value) return;
  const region = mainRegion.value;
  if (!region) return;
  const delta = Math.max(240, region.clientHeight * 0.78);
  if (event.key === "PageDown") region.scrollBy({ top: delta, behavior: "auto" });
  else if (event.key === "PageUp") region.scrollBy({ top: -delta, behavior: "auto" });
  else if (event.key === "Home") region.scrollTo({ top: 0 });
  else if (event.key === "End") region.scrollTo({ top: region.scrollHeight });
  else return;
  event.preventDefault();
}

async function closeTransient() {
  if (confirm.value) {
    confirm.value = null;
    await nextTick();
    lastTrigger.value?.focus();
  }
}

onMounted(async () => {
  document.documentElement.dataset.appearance = theme.value;
  unlisten.value = await bridge.onOperationEvent(handleOperationEvent);
  await refreshSnapshot();
});

onBeforeUnmount(() => {
  if (clockTimer) clearTimeout(clockTimer);
  unlisten.value?.();
});
</script>

<template>
  <div class="shell" @keydown.esc="closeTransient">
    <aside class="sidebar" aria-label="工作台导航">
      <header class="brand">
        <span class="brand__mark" aria-hidden="true">TS</span>
        <span><strong>TileSim</strong><small>Windows 工作台</small></span>
      </header>
      <nav>
        <button
          v-for="page in pages"
          :key="page.id"
          type="button"
          class="nav-item"
          :class="{ 'nav-item--active': currentPage === page.id }"
          :aria-label="page.label"
          :aria-current="currentPage === page.id ? 'page' : undefined"
          @click="selectPage(page.id)"
        >
          <span class="nav-item__rail" aria-hidden="true"></span>
          <span class="nav-item__full" aria-hidden="true">{{ page.label }}</span>
          <span class="nav-item__short" aria-hidden="true">{{ page.short }}</span>
        </button>
      </nav>
      <div class="sidebar__service">
        <StatusMark :tone="serviceTone" :label="snapshot?.service.label ?? '读取状态…'" />
        <small>{{ snapshot?.paths.webRoot ?? "正在定位 Web checkout" }}</small>
      </div>
    </aside>

    <div class="workspace">
      <header class="topbar">
        <div>
          <p>本地控制台</p>
          <h1>{{ pages.find((page) => page.id === currentPage)?.label }}</h1>
        </div>
        <div class="topbar__actions">
          <span class="version">v{{ snapshot?.launcherVersion ?? "—" }}</span>
          <button
            type="button"
            class="icon-button"
            :aria-label="theme === 'light' ? '切换到深色主题' : '切换到浅色主题'"
            @click="theme = theme === 'light' ? 'dark' : 'light'"
          >
            {{ theme === "light" ? "深" : "浅" }}
          </button>
        </div>
      </header>

      <main ref="mainRegion" class="main-region" tabindex="0" aria-label="当前页面内容" @keydown="handleScrollKeys">
        <div v-if="loading && !snapshot" class="loading-state" role="status">正在读取本地工作台状态…</div>
        <section v-else-if="refreshError" class="page-stack">
          <ErrorPanel category="状态读取失败" :action="refreshError" technical-detail="launcher snapshot unavailable" />
          <button type="button" class="button button--primary" @click="refreshSnapshot">重新读取</button>
        </section>

        <template v-else-if="snapshot">
          <ErrorPanel
            v-if="operation.error"
            class="operation-error"
            :category="operation.error.category"
            :action="operation.error.action"
            :technical-detail="operation.error.technicalDetail"
          />
          <section
            v-if="operationKind && operation.phase !== 'idle'"
            class="surface operation-progress"
            :class="{
              'operation-progress--active': active,
              'operation-progress--failed': operation.phase === 'failed' || operation.phase === 'blocked',
            }"
            aria-label="操作进度"
          >
            <div class="operation-progress__heading">
              <div>
                <p class="eyebrow">{{ active ? "正在进行" : "本次操作" }}</p>
                <h2>{{ operationTitle }}</h2>
              </div>
              <span class="operation-progress__elapsed">已用 {{ elapsed }}</span>
            </div>
            <div class="operation-progress__phase" role="status" aria-live="polite">
              <strong>{{ phaseLabel[operation.phase] }}</strong>
              <span v-if="active">{{ operation.message }}</span>
            </div>
            <div
              v-if="active"
              class="operation-progress__track"
              role="progressbar"
              :aria-label="`${operationTitle}：${phaseLabel[operation.phase]}`"
            >
              <span></span>
            </div>
            <div class="operation-progress__footer">
              <span>{{ recentLines.at(-1) ?? (active ? "等待脚本输出…" : "可在操作日志中查看本次输出。") }}</span>
              <button type="button" class="text-button" @click="selectPage('logs')">查看完整日志 →</button>
            </div>
          </section>
          <section v-if="currentPage === 'overview'" class="page-stack" aria-labelledby="overview-heading">
            <div class="hero-row">
              <div>
                <p class="eyebrow">当前状态</p>
                <h2 id="overview-heading">{{ snapshot.service.label }}</h2>
                <p>{{ snapshot.service.guidance }}</p>
              </div>
              <div class="hero-actions">
                <button type="button" class="button button--primary" :disabled="active" @click="startService">
                  一键启动工作台
                </button>
                <button type="button" class="button button--secondary" :disabled="active" @click="deployLocal">
                  重新部署当前代码
                </button>
              </div>
            </div>
            <aside v-if="openError" class="notice notice--warning" role="alert">{{ openError }}</aside>

            <div class="status-strip" aria-label="关键状态">
              <article>
                <span>部署</span>
                <strong>{{ snapshot.deployment.manifestPresent ? "已验证" : "尚未部署" }}</strong>
              </article>
              <article>
                <span>后端验证</span>
                <strong>{{ snapshot.deployment.ctestStatus ?? "无记录" }}</strong>
              </article>
              <article>
                <span>Web 验证</span>
                <strong>{{ snapshot.deployment.webTestStatus ?? "无记录" }}</strong>
              </article>
              <article>
                <span>模型服务</span>
                <strong>{{ snapshot.model.configured ? "已配置" : "可选，未配置" }}</strong>
              </article>
            </div>

            <section class="surface next-step">
              <div>
                <p class="eyebrow">建议下一步</p>
                <h3>{{ snapshot.deployment.manifestPresent ? "日常使用直接启动" : "首次启动需要部署" }}</h3>
                <p>
                  {{
                    snapshot.deployment.manifestPresent
                      ? "服务已就绪时直接打开网页；未运行时验证并启动已有版本。代码修改后点击“重新部署当前代码”，会构建、测试并重启本地服务。"
                      : "点击“一键启动工作台”将先确认本地部署；部署使用当前后端与 Web 文件，包括未提交改动。"
                  }}
                </p>
              </div>
              <button type="button" class="text-button" @click="selectPage('deployment')">部署设置 →</button>
            </section>

            <details class="surface details-block">
              <summary>专业详情</summary>
              <dl class="detail-grid">
                <div>
                  <dt>Deployment identity</dt>
                  <dd>{{ snapshot.deployment.identity ?? "—" }}</dd>
                </div>
                <div>
                  <dt>后端 source/build</dt>
                  <dd>
                    {{ shortRevision(snapshot.deployment.sourceRevision) }} /
                    {{ shortRevision(snapshot.deployment.buildRevision) }}
                  </dd>
                </div>
                <div>
                  <dt>Web revision</dt>
                  <dd>{{ shortRevision(snapshot.deployment.webRevision) }}</dd>
                </div>
                <div>
                  <dt>Schema set</dt>
                  <dd>{{ snapshot.deployment.schemaRevision ?? "—" }}</dd>
                </div>
              </dl>
            </details>
          </section>

          <section v-else-if="currentPage === 'deployment'" class="page-stack" aria-labelledby="deployment-heading">
            <header class="page-header">
              <p class="eyebrow">按需调整</p>
              <h2 id="deployment-heading">部署设置</h2>
              <p>日常启动和本地代码重新部署都在概览页完成。这里设置后端仓库与 WSL 环境。</p>
            </header>
            <div class="form-grid">
              <label class="field field--wide">
                <span>后端仓库目录</span>
                <span class="field__with-button">
                  <input
                    id="backend-repository"
                    v-model="backendRepository"
                    autocomplete="off"
                    :disabled="active"
                    :aria-invalid="Boolean(formErrors.backendRepository)"
                    aria-describedby="backend-repository-error"
                  />
                  <button
                    type="button"
                    class="button button--secondary"
                    :disabled="active"
                    @click="chooseBackendDirectory"
                  >
                    选择…
                  </button>
                </span>
                <small id="backend-repository-error" :class="{ 'field-error': formErrors.backendRepository }">
                  {{ formErrors.backendRepository || "允许包含空格和中文；必须是用户明确选择的 Git 仓库。" }}
                </small>
              </label>
              <label class="field">
                <span>部署工作树</span>
                <input v-model="backendDeployment" autocomplete="off" readonly aria-readonly="true" />
                <small>由启动器固定为 Web checkout 同级的 tileSim-backend 工作树。</small>
              </label>
              <label class="field">
                <span>WSL 发行版</span>
                <input v-model="wslDistro" autocomplete="off" :disabled="active" />
              </label>
            </div>
            <aside class="notice notice--warning">
              <strong>部署会重启本地服务</strong>
              <span
                >本地部署使用当前后端与 Web 文件（含未提交改动），不拉取远端；确认后构建、测试、发布并重启
                127.0.0.1:5173。运行期间不提供强制取消。</span
              >
            </aside>
            <details class="surface details-block">
              <summary>高级操作：远端更新与停止服务</summary>
              <div class="button-row">
                <button type="button" class="button button--secondary" :disabled="active" @click="deploy">
                  更新并部署最新 main
                </button>
                <button
                  type="button"
                  class="button button--secondary"
                  :disabled="active || snapshot.service.state === 'stopped'"
                  @click="stopService"
                >
                  停止服务
                </button>
              </div>
              <p class="advanced-note">远端更新会获取 origin/main 并使用独立部署工作树；这不是部署当前未提交代码。</p>
            </details>
          </section>

          <section v-else-if="currentPage === 'model'" class="page-stack" aria-labelledby="model-heading">
            <header class="page-header">
              <p class="eyebrow">可选能力</p>
              <h2 id="model-heading">模型服务设置</h2>
              <p>API Key 通过 Windows 当前用户 DPAPI 保存，不会出现在页面状态、日志或命令参数中。</p>
            </header>
            <form ref="modelForm" class="form-grid" novalidate @submit.prevent="saveModel">
              <label class="field field--wide">
                <span>Base URL</span>
                <input
                  id="model-base-url"
                  v-model="baseUrl"
                  inputmode="url"
                  autocomplete="url"
                  :disabled="active"
                  :aria-invalid="Boolean(formErrors.baseUrl)"
                  aria-describedby="base-url-error"
                />
                <small id="base-url-error" :class="{ 'field-error': formErrors.baseUrl }">
                  {{ formErrors.baseUrl || "仅 HTTPS，或 127.0.0.1 / localhost loopback HTTP。" }}
                </small>
              </label>
              <label class="field">
                <span>模型名</span>
                <input
                  id="model-name"
                  v-model="modelName"
                  autocomplete="off"
                  :disabled="active"
                  :aria-invalid="Boolean(formErrors.modelName)"
                />
                <small :class="{ 'field-error': formErrors.modelName }">{{
                  formErrors.modelName || "与服务返回的 model 完全一致。"
                }}</small>
              </label>
              <label class="field">
                <span>请求超时</span>
                <select v-model="timeoutMs" :disabled="active">
                  <option :value="30000">30 秒</option>
                  <option :value="60000">60 秒</option>
                  <option :value="120000">120 秒</option>
                </select>
              </label>
              <label class="field field--wide">
                <span>API Key</span>
                <input
                  id="model-api-key"
                  ref="apiKeyInput"
                  type="password"
                  autocomplete="new-password"
                  :disabled="active"
                  :aria-invalid="Boolean(formErrors.apiKey)"
                  aria-describedby="api-key-help"
                />
                <small id="api-key-help" :class="{ 'field-error': formErrors.apiKey }">
                  {{
                    formErrors.apiKey ||
                    (snapshot.model.protectedKeyPresent
                      ? "留空将保留当前 DPAPI Key；页面不会读取或显示已保存内容。"
                      : "首次配置需要填写；提交后输入框立即清空。")
                  }}
                </small>
              </label>
              <div class="primary-row field--wide">
                <StatusMark
                  :tone="snapshot.model.configured ? 'positive' : 'neutral'"
                  :label="snapshot.model.configured ? '配置已保存' : '尚未配置'"
                />
                <button type="submit" class="button button--primary" :disabled="active">保存模型设置</button>
              </div>
            </form>
          </section>

          <section v-else-if="currentPage === 'diagnostics'" class="page-stack" aria-labelledby="diagnostics-heading">
            <header class="page-header page-header--with-action">
              <div>
                <p class="eyebrow">只读检查</p>
                <h2 id="diagnostics-heading">环境诊断</h2>
                <p>{{ readinessCount }} / {{ snapshot.environment.length }} 项就绪。诊断不会访问模型 Provider。</p>
              </div>
              <button type="button" class="button button--primary" :disabled="loading" @click="refreshSnapshot">
                刷新状态
              </button>
            </header>
            <ul class="diagnostic-list">
              <li v-for="item in snapshot.environment" :key="item.id">
                <StatusMark
                  :tone="item.status === 'ready' ? 'positive' : item.status === 'missing' ? 'danger' : 'warning'"
                  :label="item.status === 'ready' ? '就绪' : item.status === 'missing' ? '缺失' : '注意'"
                />
                <div>
                  <strong>{{ item.label }}</strong
                  ><span>{{ item.summary }}</span
                  ><small v-if="item.detail">{{ item.detail }}</small>
                </div>
              </li>
            </ul>
            <button type="button" class="button button--secondary repair-button" :disabled="active" @click="repairWsl">
              修复 WSL…
            </button>
            <details class="surface details-block">
              <summary>路径发现结果</summary>
              <dl class="detail-grid">
                <div>
                  <dt>Web checkout</dt>
                  <dd>{{ snapshot.paths.webRoot }}</dd>
                </div>
                <div>
                  <dt>后端仓库</dt>
                  <dd>{{ snapshot.paths.backendRepository }}</dd>
                </div>
                <div>
                  <dt>部署工作树</dt>
                  <dd>{{ snapshot.paths.backendDeployment }}</dd>
                </div>
              </dl>
            </details>
          </section>

          <section v-else class="page-stack logs-page" aria-labelledby="logs-heading">
            <header class="page-header page-header--with-action">
              <div>
                <p class="eyebrow">当前会话</p>
                <h2 id="logs-heading">操作日志</h2>
                <p>最多保留最近 400 行；关闭或刷新应用后不会留存。</p>
              </div>
              <button type="button" class="button button--secondary" @click="logs = []">清空显示</button>
            </header>
            <pre ref="logRegion" class="log-region" tabindex="0" aria-label="操作日志内容">{{
              logs.length ? logs.join("\n") : "当前会话尚无操作日志。"
            }}</pre>
          </section>
        </template>
      </main>

      <footer class="statusbar" aria-live="polite">
        <span class="statusbar__phase" :class="{ 'statusbar__phase--active': active }">
          {{ phaseLabel[operation.phase] }}
        </span>
        <span>{{ operation.message }}</span>
        <span class="statusbar__elapsed">{{ elapsed }}</span>
      </footer>
    </div>

    <ConfirmDialog
      v-if="confirm"
      :title="confirm.title"
      :description="confirm.description"
      :confirm-label="confirm.confirmLabel"
      :dangerous="confirm.dangerous"
      @cancel="closeTransient"
      @confirm="runConfirmed"
    />
  </div>
</template>
