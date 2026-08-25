<script setup>
import { computed, reactive, ref } from "vue";
import {
  AlertCircle,
  Braces,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Database,
  LoaderCircle,
  Network,
  Play,
  RotateCcw,
  SlidersHorizontal,
} from "@lucide/vue";
import { bridgeApi } from "../lib/api";
import { useDashboard } from "../store/dashboard";

const { state, applyBundle, setView, loadHistory, notify } = useDashboard();
const mode = ref("controls");
const submitting = ref(false);
const runStatus = ref("");
const runtimeJson = ref("");
const topologyJson = ref("");
const form = reactive({
  scenario_id: "s1_des_example",
  fidelity_policy: "des",
  gpu_participation_mode: "gpu_free",
  run_name: "",
  scheduler: "decode_priority",
  max_batch: 2,
  kv_capacity: 4096,
  message_multiplier: 1,
  scale_up_bandwidth: 450,
  scale_up_latency: 0.8,
  scale_out_bandwidth: 200,
  scale_out_latency: 4,
});
const canRun = computed(() => state.bridge.available && !submitting.value);

function resetControls() {
  Object.assign(form, {
    scheduler: "decode_priority",
    max_batch: 2,
    kv_capacity: 4096,
    message_multiplier: 1,
    scale_up_bandwidth: 450,
    scale_up_latency: 0.8,
    scale_out_bandwidth: 200,
    scale_out_latency: 4,
  });
}

async function loadTemplate() {
  try {
    const template = await bridgeApi.getTemplate(form.scenario_id);
    runtimeJson.value = JSON.stringify(template.runtime_trace, null, 2);
    topologyJson.value = JSON.stringify(template.topology, null, 2);
    notify("已加载当前场景模板。", "positive");
  } catch (error) {
    notify(`加载模板失败：${error.message}`, "danger");
  }
}

function parseCustomInputs() {
  if (!runtimeJson.value.trim() || !topologyJson.value.trim())
    throw new Error("请同时提供 Runtime trace 与 Fabric topology JSON。");
  const runtime_trace = JSON.parse(runtimeJson.value);
  const topology = JSON.parse(topologyJson.value);
  if (!runtime_trace || Array.isArray(runtime_trace) || !topology || Array.isArray(topology))
    throw new Error("两份输入的根节点都必须是 JSON 对象。");
  return { runtime_trace, topology };
}

function validateControls() {
  const bounds = [
    [form.max_batch, 1, 64, "最大 batch"],
    [form.kv_capacity, 256, 1000000, "KV 容量"],
    [form.message_multiplier, 0.25, 8, "通信负载倍率"],
    [form.scale_up_bandwidth, 25, 2000, "Scale-up 带宽"],
    [form.scale_up_latency, 0.05, 100, "Scale-up 延迟"],
    [form.scale_out_bandwidth, 10, 2000, "Scale-out 带宽"],
    [form.scale_out_latency, 0.1, 500, "Scale-out 延迟"],
  ];
  for (const [value, min, max, label] of bounds)
    if (!Number.isFinite(Number(value)) || value < min || value > max)
      throw new Error(`${label} 应在 ${min}–${max} 之间。`);
}

async function pollRun(runId) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
    const run = await bridgeApi.getRun(runId);
    runStatus.value = run.status === "running" ? `运行中 · 已等待 ${attempt + 1} 秒` : run.status;
    if (run.status === "running") continue;
    if (run.status !== "completed") throw new Error(run.error || "模拟任务没有完成。");
    return bridgeApi.getReports(runId);
  }
  throw new Error("等待模拟结果超时。");
}

async function submit() {
  submitting.value = true;
  runStatus.value = "正在校验输入";
  try {
    const payload = {
      scenario_id: form.scenario_id,
      fidelity_policy: form.fidelity_policy,
      gpu_participation_mode: form.gpu_participation_mode,
      run_name: form.run_name.trim(),
    };
    if (mode.value === "controls") {
      validateControls();
      payload.overrides = {
        runtime: {
          batch_scheduler: form.scheduler,
          max_batch_size: Number(form.max_batch),
          kv_capacity_tokens: Number(form.kv_capacity),
        },
        workload: { message_size_multiplier: Number(form.message_multiplier) },
        fabric: {
          scale_up_bandwidth_gbps: Number(form.scale_up_bandwidth),
          scale_up_latency_us: Number(form.scale_up_latency),
          scale_out_bandwidth_gbps: Number(form.scale_out_bandwidth),
          scale_out_latency_us: Number(form.scale_out_latency),
        },
      };
    } else payload.custom_inputs = parseCustomInputs();
    runStatus.value = "正在提交受控模拟任务";
    const created = await bridgeApi.createRun(payload);
    runStatus.value = `任务已创建 · ${created.run_id}`;
    const reports = await pollRun(created.run_id);
    applyBundle(reports.reports, {
      runId: created.run_id,
      runName: created.run_name || form.run_name || created.run_id,
    });
    await loadHistory({ quiet: true });
    notify("模拟已完成，完整报告已载入。", "positive");
    setView("overview");
  } catch (error) {
    runStatus.value = `运行失败：${error.message}`;
    notify(runStatus.value, "danger");
  } finally {
    submitting.value = false;
  }
}

async function loadJsonFile(event, target) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const value = JSON.parse(await file.text());
    if (target === "runtime") runtimeJson.value = JSON.stringify(value, null, 2);
    else topologyJson.value = JSON.stringify(value, null, 2);
  } catch (error) {
    notify(`导入失败：${error.message}`, "danger");
  } finally {
    event.target.value = "";
  }
}

async function loadBundle(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const value = JSON.parse(await file.text());
    if (!value.runtime_trace || !value.topology) throw new Error("输入包必须包含 runtime_trace 和 topology。");
    runtimeJson.value = JSON.stringify(value.runtime_trace, null, 2);
    topologyJson.value = JSON.stringify(value.topology, null, 2);
  } catch (error) {
    notify(`导入输入包失败：${error.message}`, "danger");
  } finally {
    event.target.value = "";
  }
}
</script>

<template>
  <div class="experiment-layout">
    <section class="experiment-main">
      <div v-if="!state.bridge.available" class="service-warning">
        <AlertCircle :size="19" />
        <div>
          <strong>本地执行服务未连接</strong>
          <p>{{ state.bridge.detail }}。仍可编辑输入，版本同步后即可提交。</p>
        </div>
      </div>

      <article class="panel form-section">
        <header class="form-section-title">
          <span>01</span>
          <div>
            <h2>实验身份</h2>
            <p>给这次运行一个易于在历史记录中识别的名称。</p>
          </div>
        </header>
        <div class="form-grid form-grid--identity">
          <label class="field field--wide"
            ><span>实验名称 <small>可选</small></span
            ><input v-model="form.run_name" maxlength="80" placeholder="例如：FIFO · batch 1 · 同时到达"
          /></label>
          <label class="field"
            ><span>受控场景</span
            ><select v-model="form.scenario_id">
              <option
                v-for="scenario in state.catalog.scenarios.length
                  ? state.catalog.scenarios
                  : [{ scenario_id: 's1_des_example', label: 'S1 → S6 synthetic runtime example' }]"
                :key="scenario.scenario_id"
                :value="scenario.scenario_id"
              >
                {{ scenario.label }}
              </option>
            </select></label
          >
          <label class="field"
            ><span>请求 fidelity</span
            ><select v-model="form.fidelity_policy">
              <option value="des">DES</option>
              <option value="default">Default</option></select
            ><small class="field-help">实际解析结果以验证报告为准</small></label
          >
          <label class="field"
            ><span>GPU 参与方式</span
            ><select v-model="form.gpu_participation_mode">
              <option value="gpu_free">GPU-free（默认）</option>
              <option value="gpu_assisted_trace" disabled>GPU-assisted Trace（当前执行面未开放）</option>
              <option value="gpu_in_loop" disabled>GPU-in-loop（当前执行面未开放）</option>
            </select>
            <small class="field-help">数值输出不会驱动仿真语义；真实网络观测只进入 S8 证据通道</small></label
          >
        </div>
      </article>

      <article class="panel form-section capability-panel">
        <header class="form-section-title">
          <span>能力</span>
          <div>
            <h2>执行依赖与边界</h2>
            <p>选项来自后端能力发现；不可用能力不会静默降级。</p>
          </div>
        </header>
        <div class="capability-grid">
          <section>
            <strong>GPU 硬件</strong>
            <span :class="state.capabilities.dependencies?.gpu_hardware?.available ? 'available' : 'unavailable'">
              {{ state.capabilities.dependencies?.gpu_hardware?.available ? "可用" : "不可用" }}
            </span>
            <small>{{ state.capabilities.dependencies?.gpu_hardware?.reason || "尚未发现" }}</small>
          </section>
          <section>
            <strong>S6 Hotspot Cycle</strong>
            <span :class="state.capabilities.dependencies?.verilator_cycle?.available ? 'available' : 'unavailable'">
              {{ state.capabilities.dependencies?.verilator_cycle?.available ? "RTL 已构建" : "未构建" }}
            </span>
            <small>
              {{
                state.capabilities.dependencies?.verilator_cycle?.version ||
                state.capabilities.dependencies?.verilator_cycle?.reason ||
                "尚未发现"
              }}
            </small>
          </section>
          <section>
            <strong>ASTRA 外部后端</strong>
            <span :class="state.capabilities.dependencies?.astra_sim?.available ? 'available' : 'unavailable'">
              {{ state.capabilities.dependencies?.astra_sim?.available ? "可用" : "不可用" }}
            </span>
            <small>{{
              state.capabilities.dependencies?.astra_sim?.reason || "未配置真实 executable/Chakra root"
            }}</small>
          </section>
        </div>
        <p class="capability-boundary-note">
          Cycle 仅表示 <strong>S6 信用链路热点细化</strong>，不是全栈 Cycle。当前网页尚未开放显式窗口请求， 因此即使
          Verilator 已构建也不会显示为可提交的 fidelity。
        </p>
      </article>

      <article class="panel form-section">
        <header class="form-section-title">
          <span>02</span>
          <div>
            <h2>输入方式</h2>
            <p>快捷控制适合对比实验；JSON 适合精确复现。</p>
          </div>
        </header>
        <div class="segmented-control">
          <button :class="{ active: mode === 'controls' }" @click="mode = 'controls'">
            <SlidersHorizontal :size="16" />快捷控制</button
          ><button :class="{ active: mode === 'json' }" @click="mode = 'json'"><Braces :size="16" />JSON 输入</button>
        </div>

        <div v-if="mode === 'controls'" class="control-sections">
          <section>
            <header>
              <Cpu :size="17" />
              <div><strong>Runtime policy</strong><small>S1 · 调度、批处理与 KV 准入</small></div>
              <button class="text-button" @click="resetControls"><RotateCcw :size="14" />恢复默认</button>
            </header>
            <div class="form-grid">
              <label class="field"
                ><span>调度策略</span
                ><select v-model="form.scheduler">
                  <option value="decode_priority">Decode priority</option>
                  <option value="fifo">FIFO</option>
                  <option value="fabric_backpressure_aware">Fabric backpressure aware</option>
                </select></label
              ><label class="field"
                ><span>最大 batch</span><input v-model.number="form.max_batch" type="number" min="1" max="64" /></label
              ><label class="field"
                ><span>KV 容量 <small>tokens</small></span
                ><input v-model.number="form.kv_capacity" type="number" min="256" max="1000000" step="256" /></label
              ><label class="field"
                ><span>通信负载倍率</span
                ><input v-model.number="form.message_multiplier" type="number" min="0.25" max="8" step="0.25"
              /></label>
            </div>
          </section>
          <section>
            <header>
              <Network :size="17" />
              <div><strong>Fabric parameters</strong><small>S6 · Scale-up 与 Scale-out</small></div>
            </header>
            <div class="form-grid">
              <label class="field"
                ><span>Scale-up 带宽 <small>Gbps</small></span
                ><input v-model.number="form.scale_up_bandwidth" type="number" min="25" max="2000" /></label
              ><label class="field"
                ><span>Scale-up 延迟 <small>µs</small></span
                ><input v-model.number="form.scale_up_latency" type="number" min="0.05" max="100" step="0.05" /></label
              ><label class="field"
                ><span>Scale-out 带宽 <small>Gbps</small></span
                ><input v-model.number="form.scale_out_bandwidth" type="number" min="10" max="2000" /></label
              ><label class="field"
                ><span>Scale-out 延迟 <small>µs</small></span
                ><input v-model.number="form.scale_out_latency" type="number" min="0.1" max="500" step="0.1"
              /></label>
            </div>
          </section>
        </div>

        <div v-else class="json-editor-section">
          <div class="json-toolbar">
            <button class="button button--secondary" @click="loadTemplate"><Database :size="15" />加载场景模板</button
            ><label class="button button--ghost"
              >导入完整输入包<input type="file" accept="application/json,.json" @change="loadBundle"
            /></label>
          </div>
          <div class="json-grid">
            <label
              ><span
                >Runtime trace JSON
                <label class="inline-file"
                  >导入<input
                    type="file"
                    accept="application/json,.json"
                    @change="loadJsonFile($event, 'runtime')" /></label></span
              ><textarea
                v-model="runtimeJson"
                spellcheck="false"
                placeholder="加载模板或粘贴 S1 runtime trace"
              ></textarea></label
            ><label
              ><span
                >Fabric topology JSON
                <label class="inline-file"
                  >导入<input
                    type="file"
                    accept="application/json,.json"
                    @change="loadJsonFile($event, 'topology')" /></label></span
              ><textarea
                v-model="topologyJson"
                spellcheck="false"
                placeholder="加载模板或粘贴 Fabric topology"
              ></textarea>
            </label>
          </div>
        </div>
      </article>
    </section>

    <aside class="run-submit-card">
      <p class="section-kicker">RUN EXPERIMENT</p>
      <h2>确认并运行</h2>
      <dl>
        <div>
          <dt>边界</dt>
          <dd>S1 → S6</dd>
        </div>
        <div>
          <dt>宿主</dt>
          <dd>S7 hosted</dd>
        </div>
        <div>
          <dt>输入</dt>
          <dd>{{ mode === "controls" ? "受控参数" : "JSON pair" }}</dd>
        </div>
        <div>
          <dt>请求 fidelity</dt>
          <dd>{{ form.fidelity_policy.toUpperCase() }}</dd>
        </div>
        <div>
          <dt>GPU 模式</dt>
          <dd>GPU-FREE</dd>
        </div>
      </dl>
      <div class="run-scope-note">
        <CheckCircle2 :size="16" />
        <p>产物只写入 <code>tileSim-web/runs</code>，不会修改核心仓库。</p>
      </div>
      <button class="button button--primary button--wide run-submit" :disabled="!canRun" @click="submit">
        <LoaderCircle v-if="submitting" class="spin" :size="17" /><Play v-else :size="17" />{{
          submitting ? "正在运行" : "运行 TileSim 模拟"
        }}
      </button>
      <p v-if="runStatus" class="run-progress">{{ runStatus }}</p>
      <button class="text-button back-link" @click="setView('overview')">
        返回当前报告<ChevronRight :size="14" />
      </button>
    </aside>
  </div>
</template>
