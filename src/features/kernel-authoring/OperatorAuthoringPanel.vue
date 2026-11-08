<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { bridgeApi } from "../../lib/api";
import { queryClient } from "../../lib/query-client";
import type { CreateRunRequest } from "../../contracts/bridge-api";
import { ExecutionPartitionEditor, partitionPreview } from "../execution-partition-editor";
import StructuredFields from "../../components/ExecutionInputFields.vue";
import {
  cloneDocument,
  escapePointer,
  operations,
  parseExecution,
  patchExecution,
  validateExecution,
  type Document,
  type SourceMode,
} from "./model";
const props = defineProps<{
  backendIdentity: string;
  revision: string;
  request: CreateRunRequest | null;
  runtimeJson: string;
  topologyJson: string;
}>();
const emit = defineEmits<{
  change: [input: CreateRunRequest["execution_input"] | null, ready: boolean];
  example: [custom: Document];
}>();
const query = useQuery(
  {
    queryKey: computed(() => ["operator-execution", props.backendIdentity, props.revision]),
    queryFn: async () => {
      const value = await bridgeApi.operatorExecution();
      if (
        value.schema_version !== "tilesim.bridge.operator_execution.v1" ||
        value.schema_set_revision !== props.revision
      )
        throw new Error("unsupported_schema · descriptor identity/revision mismatch");
      const identity = [
        "source_revision",
        "build_revision",
        "source_state_digest",
        "build_state_digest",
        "deployment_ref",
      ]
        .map((key) => value.backend_identity[key])
        .filter((v) => typeof v === "string" && v.length)
        .join("|");
      if (identity !== props.backendIdentity)
        throw new Error("unavailable · backend identity changed; refresh Bridge identity");
      return value;
    },
    enabled: computed(() => Boolean(props.revision)),
    retry: false,
  },
  queryClient,
);
const mode = ref<SourceMode>("default"),
  document = ref<Document | null>(null),
  selected = ref(""),
  json = ref(""),
  jsonError = ref(""),
  validation = ref<Document | null>(null),
  validationError = ref(""),
  validating = ref(false),
  validatedRequest = ref("");
const fieldErrors = ref<Record<string, string>>({});
function fieldInvalid(path: string, message: string) {
  if (message) fieldErrors.value[path] = message;
  else delete fieldErrors.value[path];
  validatedRequest.value = "";
  validation.value = null;
}
const labels: Record<SourceMode, string> = {
  default: "默认模型执行",
  kernel_strategy: "Kernel 策略配置",
  tilelang_source: "TileLang 源码 Kernel",
  execution_partition: "执行划分程序",
};
const modeFacts: Record<
  SourceMode,
  { fidelity: string; phases: string; operators: string; ranks: string; network: string; recovery: string }
> = {
  default: {
    fidelity: "沿用实验配置与后端 descriptor",
    phases: "沿用场景",
    operators: "默认模型已发布算子",
    ranks: "沿用场景准入",
    network: "沿用拓扑与后端能力",
    recovery: "not_covered",
  },
  kernel_strategy: {
    fidelity: "DES",
    phases: "prefill / decode",
    operators: operations.join(" / "),
    ranks: "条件支持 · CLI 验证模型参与方",
    network: "条件支持 · 由正式拓扑与 CLI 验证",
    recovery: "not_covered",
  },
  tilelang_source: {
    fidelity: "DES + 独立 CPU 语义检查",
    phases: "prefill / decode",
    operators: operations.join(" / "),
    ranks: "代表 Rank / 显式同构 TP2",
    network: "operator_barrier / 条件性 allreduce",
    recovery: "not_covered",
  },
  execution_partition: {
    fidelity: "DES",
    phases: "prefill / decode",
    operators: "显式 slices；不推断模型算子",
    ranks: "device / participants 显式绑定",
    network: "allreduce / sendrecv",
    recovery: "not_covered",
  },
};
const traceProvenance = computed(() => {
  try {
    return parseExecution(props.runtimeJson).trace_provenance || {};
  } catch {
    return {};
  }
});
const currentStatus = computed(() =>
  mode.value === "default"
    ? { status: "available", reason: "使用原模型执行，不附加执行来源" }
    : query.data.value?.modes[mode.value],
);
const deviceIds = computed(() => {
  try {
    return parseExecution(props.topologyJson).topology.devices.map((d: Document) => d.device_id);
  } catch {
    return [];
  }
});
const issues = computed(() => {
  if (!document.value) return [];
  try {
    const issues = [
      ...validateExecution(document.value),
      ...Object.entries(fieldErrors.value).map(([path, message]) => ({ path: "/execution_input" + path, message })),
    ];
    return issues.length || mode.value !== "execution_partition"
      ? issues
      : [...issues, ...partitionPreview(document.value.execution_partition_program, deviceIds.value).issues];
  } catch (error) {
    return [{ path: "/execution_input", message: String(error) }];
  }
});
const requestText = computed(() => JSON.stringify(props.request));
const ready = computed(
  () =>
    mode.value === "default" ||
    (!jsonError.value &&
      !issues.value.length &&
      currentStatus.value?.status === "available" &&
      validatedRequest.value === requestText.value &&
      Boolean(validation.value)),
);
watch(
  [document, ready, mode],
  () =>
    emit(
      "change",
      mode.value === "default" ? null : (document.value as CreateRunRequest["execution_input"]),
      ready.value,
    ),
  { deep: true, immediate: true },
);
watch([requestText, () => props.backendIdentity, () => props.revision], () => {
  validatedRequest.value = "";
  validation.value = null;
  validationError.value = "";
});
let editingJson = false;
watch(
  document,
  () => {
    if (!editingJson) {
      json.value = JSON.stringify(document.value, null, 2);
      jsonError.value = "";
    }
  },
  { deep: true, flush: "sync" },
);
watch(
  () => query.data.value,
  () => {
    if (mode.value !== "default" && !document.value) choose(mode.value);
  },
);
function choose(next: SourceMode) {
  mode.value = next;
  sourceIndex.value = 0;
  selected.value = "";
  validation.value = null;
  validatedRequest.value = "";
  jsonError.value = "";
  fieldErrors.value = {};
  if (next === "default") {
    document.value = null;
    return;
  }
  const example = query.data.value?.examples?.[next];
  document.value = example ? cloneDocument(example) : null;
  json.value = JSON.stringify(document.value, null, 2);
}
function patch(path: string, value: unknown) {
  delete fieldErrors.value[path];
  if (document.value) document.value = patchExecution(document.value, path, value);
}
function jsonChange(text: string) {
  json.value = text;
  try {
    const next = parseExecution(text);
    if (next.mode !== mode.value) throw new Error("高级 JSON mode 必须与选中来源一致");
    const invalid = validateExecution(next);
    if (invalid.length) throw new Error(invalid.map((i) => `${i.path} · ${i.message}`).join("\n"));
    editingJson = true;
    document.value = next;
    editingJson = false;
    fieldErrors.value = {};
    jsonError.value = "";
  } catch (error) {
    jsonError.value = String(error);
    emit("change", document.value as CreateRunRequest["execution_input"], false);
  }
}
const strategyRows = computed(
  () => Object.entries(document.value?.kernel_execution?.operations || {}) as [string, Document][],
);
const selectedStrategy = computed(() => document.value?.kernel_execution?.operations[selected.value]);
function renameSelector(phase: string, operation: string) {
  const next = phase + "/" + operation;
  if (!document.value || next === selected.value) return;
  if (document.value.kernel_execution.operations[next]) {
    validationError.value = `/execution_input/kernel_execution/operations/${escapePointer(next)} · selector 重复`;
    return;
  }
  const copy = cloneDocument(document.value);
  copy.kernel_execution.operations[next] = copy.kernel_execution.operations[selected.value];
  delete copy.kernel_execution.operations[selected.value];
  selected.value = next;
  document.value = copy;
}
function addStrategy(copy = false) {
  if (!document.value) return;
  const source = selectedStrategy.value || strategyRows.value[0]?.[1];
  const selector = ["prefill", "decode"]
    .flatMap((p) => operations.map((o) => p + "/" + o))
    .find((k) => !document.value!.kernel_execution.operations[k]);
  if (!selector || !source) return;
  const next = cloneDocument(document.value);
  next.kernel_execution.operations[selector] = cloneDocument(source);
  if (!copy) next.kernel_execution.operations[selector].strategy.implementation_id = "declared-strategy-v1";
  document.value = next;
  selected.value = selector;
}
async function file(event: Event, path: string, jsonFile = false) {
  const input = event.target as HTMLInputElement;
  const source = input.files?.[0];
  if (!source) return;
  if (source.size > 1000000) {
    validationError.value = "文件超过 1 MB";
    return;
  }
  try {
    const text = await source.text();
    patch(path, jsonFile ? parseExecution(text) : text);
  } catch (error) {
    fieldInvalid(path, String(error));
    validationError.value = String(error);
  }
  input.value = "";
}
async function validate() {
  if (!props.request || issues.value.length || jsonError.value) return;
  const text = requestText.value;
  const identity = props.backendIdentity,
    revision = props.revision;
  validating.value = true;
  validationError.value = "";
  try {
    const result = await bridgeApi.validateOperatorExecution(props.request);
    if (text === requestText.value && identity === props.backendIdentity && revision === props.revision) {
      validation.value = result;
      validatedRequest.value = text;
    }
  } catch (error) {
    validationError.value = String(error);
  } finally {
    validating.value = false;
  }
}
const selectionCount = computed(() =>
  mode.value === "kernel_strategy"
    ? strategyRows.value.length
    : mode.value === "tilelang_source"
      ? document.value?.tilelang_kernels?.length
      : document.value?.execution_partition_program?.windows?.length,
);
const unboundOperators = computed(() => {
  if (!document.value || !["kernel_strategy", "tilelang_source"].includes(mode.value)) return "expected_absence";
  const layers = document.value.dense_execution?.layers;
  if (!Number.isSafeInteger(layers) || layers < 1 || layers > 4096) return "missing";
  try {
    const requests = parseExecution(props.runtimeJson).requests as Document[];
    const phases = ["prefill", "decode"].filter((phase) =>
      requests.some((r) => BigInt(r[phase === "prefill" ? "prompt_tokens" : "decode_tokens"] || 0) > 0n),
    );
    let unbound = 0;
    for (const phase of phases)
      for (const operation of operations) {
        const instances =
          operation === "final_norm_lm_head"
            ? [operation]
            : Array.from({ length: layers }, (_, i) => `layer_${i}::${operation}`);
        for (const id of instances) {
          const bound =
            mode.value === "kernel_strategy"
              ? !!document.value.kernel_execution.operations[`${phase}/${operation}`]
              : document.value.tilelang_kernels.some(
                  (s: Document) =>
                    s.phase === phase && s.operation === operation && (!s.instances.length || s.instances.includes(id)),
                );
          if (!bound) unbound++;
        }
      }
    return String(unbound);
  } catch {
    return "missing";
  }
});
const sourceIndex = ref(0);
const sourceSelection = computed(() => document.value?.tilelang_kernels?.[sourceIndex.value]);
const sourcePath = computed(() => `/tilelang_kernels/${sourceIndex.value}`);
// A declared model catalog for choosing bindings; CLI admission remains authoritative.
const instanceCatalog = computed<string[]>(() => {
  const op = sourceSelection.value?.operation,
    layers = document.value?.dense_execution?.layers;
  if (!operations.includes(op) || !Number.isSafeInteger(layers) || layers < 1 || layers > 4096) return [];
  return op === "final_norm_lm_head" ? [op] : Array.from({ length: layers }, (_, i) => `layer_${i}::${op}`);
});
function toggleInstance(id: string, checked: boolean) {
  const instances = sourceSelection.value.instances as string[];
  patch(
    `${sourcePath.value}/instances`,
    checked ? [...new Set([...instances, id])] : instances.filter((x) => x !== id),
  );
}
function saveDraft() {
  if (!document.value) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(document.value, null, 2)], { type: "application/json" }));
  const link = globalThis.document.createElement("a");
  link.href = url;
  link.download = `tilesim-${mode.value}-draft.json`;
  link.click();
  URL.revokeObjectURL(url);
}
const sourceBlocked = computed<Record<string, Record<string, string>>>(() => {
  const selection = sourceSelection.value;
  let requests: Document[] = [];
  try {
    requests = parseExecution(props.runtimeJson).requests || [];
  } catch {
    /* No valid requests yet. */
  }
  const reason =
    currentStatus.value?.status !== "available"
      ? "后端 capability 不可用"
      : !["attention_output", "activation_down"].includes(selection?.operation)
        ? "仅支持 attention_output / activation_down"
        : !requests.length || requests.some((r) => r.tp_degree !== 2 || r.participants?.length !== 2)
          ? "要求实际 TP2 请求与两个 participants"
          : "";
  const blocked: Record<string, Record<string, string>> = { output_policy: {}, output_admission_policy: {} };
  if (reason) blocked.output_policy.tile_ready_allreduce = reason;
  if (!(selection?.output_buffer_slots > 0))
    blocked.output_admission_policy.safe_window_v1 = "要求正数 output_buffer_slots";
  return blocked;
});
</script>
<template>
  <section class="operator-authoring" aria-label="算子与 Kernel">
    <header>
      <h2>算子与 Kernel</h2>
    </header>
    <ol class="operator-steps">
      <li>1 选择执行来源</li>
      <li>2 编辑算子 / Kernel</li>
      <li>3 运行前校验</li>
      <li>4 提交仿真</li>
    </ol>
    <div class="operator-layout">
      <div class="operator-main">
        <fieldset class="operator-source">
          <legend>执行来源 · 互斥</legend>
          <label v-for="(label, key) in labels" :key="key"
            ><input type="radio" name="execution-source" :value="key" :checked="mode === key" @change="choose(key)" />{{
              label
            }}</label
          >
        </fieldset>
        <p v-if="query.isPending.value" role="status">pending · 正在读取并探测后端能力</p>
        <p v-else-if="query.error.value" role="alert">unavailable · {{ query.error.value.message }}</p>
        <div class="operator-capability">
          <strong>{{ currentStatus?.status || "unavailable" }}</strong
          ><span>{{ currentStatus?.reason || "当前 Bridge 未声明此能力" }}</span>
          <details>
            <summary>当前来源能力范围</summary>
            <dl>
              <dt>支持 fidelity</dt>
              <dd>{{ modeFacts[mode].fidelity }}</dd>
              <dt>可用 phase</dt>
              <dd>{{ modeFacts[mode].phases }}</dd>
              <dt>可用 operator</dt>
              <dd>{{ modeFacts[mode].operators }}</dd>
              <dt>真实 Trace</dt>
              <dd>不要求 · synthetic_trace</dd>
              <dt>多 Rank</dt>
              <dd>{{ modeFacts[mode].ranks }}</dd>
              <dt>网络通信</dt>
              <dd>{{ modeFacts[mode].network }}</dd>
              <dt>恢复</dt>
              <dd>{{ modeFacts[mode].recovery }}</dd>
            </dl>
          </details>
        </div>
        <template v-if="mode !== 'default' && document">
          <p class="operator-warning">未校准 · synthetic_trace · 声明成本不代表 GPU 实测</p>
          <button
            type="button"
            :disabled="!query.data.value?.custom_inputs"
            @click="emit('example', query.data.value!.custom_inputs!)"
          >
            载入匹配的合成请求与拓扑示例
          </button>
          <details>
            <summary>模型 / device / 效率配置</summary>
            <StructuredFields
              :value="document.dense_execution"
              path="/dense_execution"
              @change="patch"
              @invalid="fieldInvalid"
            />
          </details>
          <template v-if="mode === 'kernel_strategy'">
            <div class="operator-toolbar">
              <strong>Kernel 策略表</strong><button type="button" @click="addStrategy()">新增策略</button
              ><button type="button" @click="addStrategy(true)">复制策略</button
              ><button
                type="button"
                :disabled="!selected || strategyRows.length <= 1"
                @click="
                  document = {
                    ...document,
                    kernel_execution: {
                      ...document.kernel_execution,
                      operations: Object.fromEntries(strategyRows.filter(([key]) => key !== selected)),
                    },
                  };
                  selected = '';
                "
              >
                删除策略
              </button>
            </div>
            <p>aggregate = 整 Kernel；expanded = CTA/Tile 片段。selector 按类别覆盖，精确实例暂不覆盖。</p>
            <div class="operator-scroll">
              <table class="operator-strategies">
                <thead>
                  <tr>
                    <th>phase / operator</th>
                    <th>instances</th>
                    <th>view</th>
                    <th>dtype</th>
                    <th>tile / threads</th>
                    <th>stages / memory</th>
                    <th>source / status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="[key, s] in strategyRows" :key="key">
                    <td>
                      <button type="button" @click="selected = key">{{ key }}</button>
                    </td>
                    <td>全部</td>
                    <td>{{ s.view }}</td>
                    <td>{{ s.strategy.dtype }}</td>
                    <td>
                      {{ s.strategy.tile_m }}×{{ s.strategy.tile_n }}×{{ s.strategy.tile_k }} / {{ s.strategy.threads }}
                    </td>
                    <td>{{ s.strategy.pipeline_stages }} / {{ s.strategy.memory_policy }}</td>
                    <td>{{ s.strategy.source }} / {{ issues.length ? "error" : "pending" }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <details>
              <summary>硬件资源限制</summary>
              <StructuredFields
                :value="document.kernel_execution.hardware"
                path="/kernel_execution/hardware"
                @change="patch"
                @invalid="fieldInvalid"
              />
            </details>
            <section v-if="selectedStrategy" aria-label="Kernel 策略详情">
              <h3>{{ selected }}</h3>
              <div class="operator-fields">
                <label
                  >phase<select
                    aria-label="Kernel selector phase"
                    :value="selected.split('/')[0]"
                    @change="renameSelector(($event.target as HTMLSelectElement).value, selected.split('/')[1])"
                  >
                    <option>prefill</option>
                    <option>decode</option>
                  </select></label
                >
                <label
                  >operator<select
                    aria-label="Kernel selector operator"
                    :value="selected.split('/')[1]"
                    @change="renameSelector(selected.split('/')[0], ($event.target as HTMLSelectElement).value)"
                  >
                    <option v-for="op in operations" :key="op">{{ op }}</option>
                  </select></label
                >
              </div>
              <StructuredFields
                :value="selectedStrategy"
                :path="`/kernel_execution/operations/${escapePointer(selected)}`"
                @change="patch"
                @invalid="fieldInvalid"
              /><label
                >source_reference<input
                  :value="selectedStrategy.strategy.source_reference || ''"
                  @change="
                    patch(
                      `/kernel_execution/operations/${escapePointer(selected)}/strategy/source_reference`,
                      ($event.target as HTMLInputElement).value,
                    )
                  " /></label
              ><label
                >launch_grid [x,y,z]<input
                  :value="JSON.stringify(selectedStrategy.strategy.launch_grid || [])"
                  @change="
                    (event) => {
                      try {
                        patch(
                          `/kernel_execution/operations/${escapePointer(selected)}/strategy/launch_grid`,
                          JSON.parse((event.target as HTMLInputElement).value),
                        );
                      } catch {
                        fieldInvalid(
                          `/kernel_execution/operations/${escapePointer(selected)}/strategy/launch_grid`,
                          'launch_grid 必须是 JSON 数组',
                        );
                        validationError = 'launch_grid 必须是 JSON 数组';
                      }
                    }
                  "
              /></label>
            </section>
            <p>不支持 persistent / Split-K / 任意映射 / PTX/SASS / 自动调优。</p>
          </template>
          <template v-if="mode === 'tilelang_source' && sourceSelection">
            <p>源码未执行 · 仅支持严格源码子集 · 不调用 GPU 编译器；AST lowering / CPU 语义由受限入口完成。</p>
            <StructuredFields
              :value="{ tilelang_model_dtype: document.tilelang_model_dtype }"
              @change="patch"
              @invalid="fieldInvalid"
            />
            <div class="operator-toolbar">
              <label
                >source selection<select v-model="sourceIndex" aria-label="source selection">
                  <option v-for="(selection, i) in document.tilelang_kernels" :key="i" :value="i">
                    {{ selection.selection_id }}
                  </option>
                </select></label
              ><button
                type="button"
                @click="
                  patch('/tilelang_kernels', [
                    ...document.tilelang_kernels,
                    {
                      ...cloneDocument(sourceSelection),
                      selection_id: 'selection-' + (document.tilelang_kernels.length + 1),
                    },
                  ]);
                  sourceIndex = document.tilelang_kernels.length - 1;
                "
              >
                新增源码选择</button
              ><button
                type="button"
                :disabled="document.tilelang_kernels.length <= 1"
                @click="
                  patch(
                    '/tilelang_kernels',
                    document.tilelang_kernels.filter((_: unknown, i: number) => i !== sourceIndex),
                  );
                  sourceIndex = 0;
                "
              >
                删除源码选择
              </button>
            </div>

            <label class="operator-file"
              >上传 TileLang 源码<input
                type="file"
                accept=".py,.txt"
                @change="file($event, `${sourcePath}/source/source_text`)"
            /></label>
            <label class="operator-field wide"
              >源码输入区<textarea
                aria-label="TileLang 源码"
                spellcheck="false"
                :value="sourceSelection.source.source_text"
                @input="patch(`${sourcePath}/source/source_text`, ($event.target as HTMLTextAreaElement).value)"
              />
            </label>
            <label class="operator-file"
              >上传 arguments JSON<input
                type="file"
                accept=".json"
                @change="file($event, `${sourcePath}/source/arguments`, true)"
            /></label>
            <details open>
              <summary>arguments / 参数结构摘要</summary>
              <StructuredFields
                :value="sourceSelection.source.arguments"
                :path="`${sourcePath}/source/arguments`"
                @change="patch"
                @invalid="fieldInvalid"
              />
            </details>
            <label
              >arguments JSON<textarea
                aria-label="TileLang arguments JSON"
                :value="JSON.stringify(sourceSelection.source.arguments, null, 2)"
                @change="
                  (event) => {
                    try {
                      patch(
                        `${sourcePath}/source/arguments`,
                        parseExecution((event.target as HTMLTextAreaElement).value),
                      );
                    } catch (error) {
                      fieldInvalid(`${sourcePath}/source/arguments`, String(error));
                      validationError = String(error);
                    }
                  }
                "
              />
            </label>
            <h3>operator 绑定与输出策略</h3>
            <fieldset class="operator-instances">
              <legend>operator instances · CLI 验证实际命中</legend>
              <label
                ><input
                  type="checkbox"
                  :checked="sourceSelection.instances.length === 0"
                  @change="
                    patch(
                      `${sourcePath}/instances`,
                      ($event.target as HTMLInputElement).checked ? [] : instanceCatalog.slice(0, 1),
                    )
                  "
                />全部实例（空选择数组）</label
              >
              <label v-for="id in instanceCatalog" :key="id"
                ><input
                  type="checkbox"
                  :checked="sourceSelection.instances.includes(id)"
                  @change="toggleInstance(id, ($event.target as HTMLInputElement).checked)"
                />{{ id }}</label
              >
              <p v-if="!instanceCatalog.length">not_covered · 声明模型未列出实例，可在 JSON 中绑定后由 CLI 校验。</p>
              <p v-if="sourceSelection.instances.some((id: string) => !instanceCatalog.includes(id))">
                error · 存在不属于声明模型的实例；不会自动替换。
              </p>
            </fieldset>
            <StructuredFields
              :value="
                Object.fromEntries(
                  Object.entries(sourceSelection).filter(
                    ([key]) => !['source', 'rank_programs', 'rank_cost_profiles_json', 'instances'].includes(key),
                  ),
                )
              "
              :path="sourcePath"
              :blocked-options="sourceBlocked"
              :readonly-fields="
                !document.dense_execution.explicit_rank_execution ||
                !sourceSelection.rank_programs ||
                sourceSelection.output_policy !== 'tile_ready_allreduce'
                  ? { output_buffer_slots: '要求显式 TP2、完整 rank_programs、tile_ready_allreduce' }
                  : {}
              "
              @change="patch"
              @invalid="fieldInvalid"
            />
            <label
              >payload_mode<select
                :aria-label="`${sourcePath}/source/payload_mode`"
                :value="sourceSelection.source.payload_mode"
                @change="patch(`${sourcePath}/source/payload_mode`, ($event.target as HTMLSelectElement).value)"
              >
                <option>structure_only</option>
                <option>materialized</option>
              </select></label
            >
            <p>structure_only 不要求数值 payload；CPU 语义、合成一致性、真实 Trace 与校准分别计证。</p>
            <dl class="operator-source-checks">
              <dt>结构合法</dt>
              <dd>{{ issues.length ? "error · 查看字段路径" : "available · 前端合同检查通过" }}</dd>
              <dt>形状可覆盖</dt>
              <dd>
                {{
                  issues.some((i) => i.message.includes("形状"))
                    ? "error"
                    : "partial · 分块已检查，模型调用形状由 CLI 核验"
                }}
              </dd>
              <dt>数值 payload 可物化</dt>
              <dd>
                {{
                  sourceSelection.source.arguments.K > 128 ||
                  sourceSelection.source.arguments.M * sourceSelection.source.arguments.N > 4096 ||
                  sourceSelection.source.arguments.M *
                    sourceSelection.source.arguments.N *
                    sourceSelection.source.arguments.K >
                    1048576
                    ? "not_covered · 超出数值预算，仍可选择结构模式"
                    : "partial · 预算内，AST parser 最终核验"
                }}
              </dd>
              <dt>仅结构模式可用</dt>
              <dd>
                {{
                  sourceSelection.source.payload_mode === "structure_only"
                    ? "available · 不要求数值 payload"
                    : "expected_absence · 显式选择 materialized"
                }}
              </dd>
              <dt>后端可执行</dt>
              <dd>{{ ready ? "available · 当前请求 CLI 验证通过" : "pending · 保存草案可用，提交尚未准入" }}</dd>
            </dl>
            <details>
              <summary>高级 Rank / 成本 / output admission</summary>
              <p>rank_programs、rank_cost_profiles 与 device placement 必须完整匹配；由 CLI 准入。</p>
              <StructuredFields
                :value="document.dense_execution"
                path="/dense_execution"
                @change="patch"
                @invalid="fieldInvalid"
              /><button
                type="button"
                @click="
                  patch(`${sourcePath}/rank_programs`, {
                    gpu0: cloneDocument(sourceSelection.source),
                    gpu1: cloneDocument(sourceSelection.source),
                  })
                "
              >
                添加显式 gpu0 / gpu1 rank_programs</button
              ><StructuredFields
                v-if="sourceSelection.rank_programs"
                :value="sourceSelection.rank_programs"
                :path="`${sourcePath}/rank_programs`"
                @change="patch"
                @invalid="fieldInvalid"
              /><label
                >rank_cost_profiles JSON<textarea
                  :value="sourceSelection.rank_cost_profiles_json || ''"
                  @change="patch(`${sourcePath}/rank_cost_profiles_json`, ($event.target as HTMLTextAreaElement).value)"
                />
              </label>
            </details>
            <small class="operator-contract"
              ><code>tilesim.tilelang_kernel_program.v1</code> · <code>declared_async_ring_v1</code> ·
              <code>bounded_integer_A3K5mod7_B2N3mod5_v1</code> / <code>not_materialized_execution_structure_v1</code>
            </small>
          </template>
          <ExecutionPartitionEditor
            v-if="mode === 'execution_partition'"
            :program="document.execution_partition_program"
            :device-ids="deviceIds"
            @change="patch('/execution_partition_program', $event)"
            @invalid="(path, message) => fieldInvalid('/execution_partition_program' + path, message)"
          />
          <details>
            <summary>JSON 高级编辑 · 同一配置</summary>
            <textarea
              aria-label="执行输入 JSON"
              :value="json"
              @input="jsonChange(($event.target as HTMLTextAreaElement).value)"
            />
          </details>
          <p v-if="jsonError" role="alert">/execution_input · {{ jsonError }}</p>
          <ul v-if="issues.length" class="operator-errors">
            <li v-for="(issue, i) in issues" :key="i">
              <code>{{ issue.path }}</code> {{ issue.message }}
            </li>
          </ul>
          <div class="operator-toolbar">
            <button type="button" @click="saveDraft">保存配置草案 JSON</button>
            <button
              type="button"
              :disabled="
                validating || !!issues.length || !!jsonError || !request || currentStatus?.status !== 'available'
              "
              @click="validate"
            >
              {{ validating ? "pending · CLI 校验中" : "运行前校验（真实 CLI）" }}</button
            ><span>{{ ready ? "available · 当前请求已验证" : "pending · 尚未通过当前请求校验" }}</span>
          </div>
          <pre v-if="validationError" role="alert">{{ validationError }}</pre>
          <details v-if="validation" open>
            <summary>AST / lowering / CLI 准入结果</summary>
            <section
              v-for="source in validation.sources || []"
              :key="source.selection_id"
              aria-label="已验证源码程序摘要"
            >
              <h4>{{ source.selection_id }} · {{ source.source_selected }}</h4>
              <dl class="operator-source-checks">
                <template
                  v-for="key in ['M', 'N', 'K', 'block_M', 'block_N', 'block_K', 'stages', 'workers', 'threads']"
                  :key="key"
                >
                  <dt>{{ key }}</dt>
                  <dd>
                    {{
                      source.parameters?.[key === "stages" ? "num_stages" : key === "workers" ? "sm_num" : key] ??
                      "missing"
                    }}
                  </dd>
                </template>
                <dt>source SHA256</dt>
                <dd :title="source.source_sha256">
                  <code>{{ source.source_sha256 }}</code>
                </dd>
                <dt>program SHA256</dt>
                <dd :title="source.program_sha256">
                  <code>{{ source.program_sha256 }}</code>
                </dd>
                <dt>selected function</dt>
                <dd>{{ source.source_selected }}</dd>
                <dt>lowering version</dt>
                <dd>{{ source.lowering?.version ?? source.lowering ?? "missing" }}</dd>
                <dt>input values</dt>
                <dd>{{ source.input_values }}</dd>
                <dt>cost scope</dt>
                <dd>{{ source.cost_scope }}</dd>
                <dt>claim scope</dt>
                <dd>{{ source.claim_scope }}</dd>
              </dl>
            </section>
            <details>
              <summary>完整 CLI 校验收据</summary>
              <pre>{{ JSON.stringify(validation, null, 2) }}</pre>
            </details>
          </details>
        </template>
      </div>
      <aside class="operator-summary">
        <h3>运行前证据摘要</h3>
        <dl>
          <dt>backend identity</dt>
          <dd :title="backendIdentity">{{ backendIdentity }}</dd>
          <dt>schema_set_revision</dt>
          <dd :title="revision">{{ revision || "missing" }}</dd>
          <dt>source mode</dt>
          <dd>{{ mode }}</dd>
          <dt>model / revision</dt>
          <dd>
            {{ document?.dense_execution?.model_id || "默认模型" }} /
            {{ document?.dense_execution?.model_revision || "missing" }}
          </dd>
          <dt>选择数量</dt>
          <dd>{{ selectionCount ?? "expected_absence" }}</dd>
          <dt>未覆盖 operator</dt>
          <dd :title="'按声明模型与请求阶段统计未绑定策略/源码的实例；不代表未执行。实际覆盖以 CLI 证据为准。'">
            {{ unboundOperators }} · 声明目录中未绑定
          </dd>
          <dt>验证错误</dt>
          <dd>{{ issues.length + (jsonError ? 1 : 0) }}</dd>
          <dt>provenance · 输入声明</dt>
          <dd>{{ traceProvenance.source_mode || "missing" }} / {{ traceProvenance.calibration_level || "missing" }}</dd>
          <dt>requested fidelity</dt>
          <dd>{{ mode === "default" ? "沿用实验配置" : "DES" }}</dd>
          <dt>resolved fidelity / actual backend</dt>
          <dd>运行完成后读取后端证据</dd>
          <dt>allowed claim scope</dt>
          <dd>
            {{ validation?.claim_scope || traceProvenance.allowed_claim_scope || "missing" }} · 声明成本保持未校准
          </dd>
        </dl>
        <details>
          <summary>证据边界</summary>
          <p>
            声明成本不是 measured latency；CPU 源码语义不是 GPU numerical correctness；当前无真实 Trace 校准或 held-out
            validation。
          </p>
        </details>
        <button type="button" @click="query.refetch()">刷新能力</button>
      </aside>
    </div>
  </section>
</template>
<style src="./operator-authoring.css"></style>
