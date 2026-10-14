<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronDown, ChevronRight, SlidersHorizontal } from "@lucide/vue";
import { useI18n } from "../../i18n";
import {
  describeBounds,
  advancedRuntimePolicyKeys,
  policyField,
  type BoundsText,
  type SchemaFieldMeta,
} from "./input-schema-meta";
import {
  parseJsonDocument,
  patchJsonDocument,
  runtimePolicyOf,
  StructuredInputError,
  type JsonObject,
} from "./structured-input";

const props = withDefaults(defineProps<{ modelValue: string; fieldPath?: string }>(), { fieldPath: "" });
const emit = defineEmits<{ (event: "update:modelValue", value: string): void }>();
const { t } = useI18n();

const POLICY_LABEL_SOURCE: Record<string, string> = {
  batch_scheduler: "调度策略",
  max_batch_size: "批大小上限",
  kv_capacity_tokens: "KV 容量",
  max_active_requests: "并发请求上限",
  initial_kv_tokens: "开局 KV 占用",
  kv_admission_watermark: "KV 准入水位",
  long_context_threshold_tokens: "长上下文阈值",
  decode_penalty_per_threshold: "每档解码减速",
  prefill_starvation_threshold_ps: "prefill 饿死阈值",
  pd_handoff_delay_ps: "PD 交接延迟",
  pd_handoff_queue_service_ps: "PD 交接队列服务时间",
  kv_page_size_tokens: "KV 页大小",
  kv_fragmentation_overhead: "KV 碎片开销",
  fabric_backpressure_active: "Fabric 反压开关",
  fabric_backpressure_delay_us: "Fabric 反压延迟",
  fabric_backpressure_throttle_threshold_us: "Fabric 反压节流阈值",
  fabric_backpressure_prefill_batch_limit: "Fabric 反压 prefill 批上限",
};

// Mirrors the missing-field fallbacks in D:/tileSim/src/Core/LayerAdapters.cpp
// (S1 runtime policy parser). Display only: omission remains omission in JSON.
const BACKEND_POLICY_DEFAULTS: Readonly<Record<string, number | boolean>> = {
  prefill_starvation_threshold_ps: 0,
  pd_handoff_delay_ps: 0,
  pd_handoff_queue_service_ps: 0,
  kv_page_size_tokens: 16,
  kv_fragmentation_overhead: 0,
  fabric_backpressure_active: false,
  fabric_backpressure_delay_us: 0,
  fabric_backpressure_throttle_threshold_us: 0,
  fabric_backpressure_prefill_batch_limit: 1,
};

function backendDefault(field: SchemaFieldMeta): string {
  const value = BACKEND_POLICY_DEFAULTS[field.key];
  const unit = field.key.endsWith("_ps")
    ? " ps"
    : field.key.endsWith("_us")
      ? " us"
      : field.key === "kv_page_size_tokens"
        ? " tokens"
        : "";
  return `${value}${unit}`;
}

function isOmitted(field: SchemaFieldMeta): boolean {
  return field.key in BACKEND_POLICY_DEFAULTS && policy.value?.[field.key] === undefined;
}

function policyLabel(key: string): string {
  const source = POLICY_LABEL_SOURCE[key];
  return source ? t(source) : key;
}

/**
 * Expanded by default: the block's whole point is to expose the nine keys the
 * knobs cannot reach, so hiding them behind a click would just add friction.
 * The toggle is still there for anyone who wants the quick-control tab short.
 */
const showAdvanced = ref(true);
const localError = ref("");

const parsed = computed(() => parseJsonDocument(props.modelValue, "Runtime trace"));
const documentValue = computed<JsonObject | null>(() => (parsed.value.ok ? parsed.value.value : null));
const policy = computed<JsonObject | null>(() => (documentValue.value ? runtimePolicyOf(documentValue.value) : null));
/**
 * Only the keys the quick-control knobs cannot reach. The eight keys the knobs
 * also own are deliberately absent: rendering them here painted the same
 * parameters twice on one screen, and the knobs already mirror into `policy`.
 */
const advancedFields = computed(() => advancedRuntimePolicyKeys.map((key) => policyField(key)));

/** Every value is written through a whole-document patch so unknown keys survive. */
function commit(mutate: (draft: JsonObject) => void) {
  try {
    emit("update:modelValue", patchJsonDocument(props.modelValue, "Runtime trace", mutate));
    localError.value = "";
  } catch (error) {
    localError.value = error instanceof StructuredInputError ? error.message : String(error);
  }
}

function boundsHint(field: SchemaFieldMeta): BoundsText {
  return describeBounds(field, t("整数"));
}

/** Refuses out-of-contract input instead of writing a document the contract rejects. */
function numericValue(field: SchemaFieldMeta, raw: string): number | null | "invalid" {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return "invalid";
  if (field.integerOnly && !Number.isInteger(value)) return "invalid";
  if (field.minimum !== null && value < field.minimum) return "invalid";
  if (field.exclusiveMinimum !== null && value <= field.exclusiveMinimum) return "invalid";
  if (field.maximum !== null && value > field.maximum) return "invalid";
  return value;
}

function updateNumeric(field: SchemaFieldMeta, event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  const value = numericValue(field, raw);
  if (value === "invalid") {
    localError.value = t("{field} 超出契约范围：{hint}", {
      field: field.key,
      hint: describeBounds(field).title,
    });
    return;
  }
  commit((draft) => {
    const target = runtimePolicyOf(draft);
    if (!target) throw new StructuredInputError("runtime trace 缺少 policy 对象。");
    if (value === null) delete target[field.key];
    else target[field.key] = value;
  });
}

function updateEnum(field: SchemaFieldMeta, event: Event) {
  const raw = (event.target as HTMLSelectElement).value;
  commit((draft) => {
    const target = runtimePolicyOf(draft);
    if (!target) throw new StructuredInputError("runtime trace 缺少 policy 对象。");
    if (raw === "") delete target[field.key];
    else target[field.key] = raw;
  });
}

function updateBoolean(field: SchemaFieldMeta, event: Event) {
  const raw = (event.target as HTMLSelectElement).value;
  commit((draft) => {
    const target = runtimePolicyOf(draft);
    if (!target) throw new StructuredInputError("runtime trace 缺少 policy 对象。");
    if (raw === "") delete target[field.key];
    else target[field.key] = raw === "true";
  });
}

function displayValue(field: SchemaFieldMeta): string {
  const value = policy.value?.[field.key];
  if (value === undefined || value === null) return "";
  return String(value);
}

function fieldPathFor(key: string): string {
  return `/custom_inputs/runtime_trace/policy/${key}`;
}
</script>

<template>
  <section class="structured-block structured-block--policy" :aria-label="t('进阶运行策略')">
    <header class="structured-block__header">
      <SlidersHorizontal :size="16" />
      <div>
        <strong>{{ t("进阶运行策略") }}</strong>
        <small>{{
          t("只放旋钮管不到的 {count} 个参数；浅色数字是后端缺省值，不写入输入 JSON。填写后覆盖，清空则恢复缺省值。", {
            count: advancedFields.length,
          })
        }}</small>
      </div>
    </header>

    <p v-if="!parsed.ok" class="structured-note structured-note--warning" role="alert">{{ parsed.error }}</p>
    <p v-else-if="!policy" class="structured-note structured-note--warning" role="alert">
      {{ t("runtime trace 缺少 policy 对象，运行策略暂不可编辑。") }}
    </p>

    <template v-else>
      <button
        type="button"
        class="text-button policy-advanced-toggle"
        :aria-expanded="showAdvanced"
        @click="showAdvanced = !showAdvanced"
      >
        <component :is="showAdvanced ? ChevronDown : ChevronRight" :size="14" />
        {{ showAdvanced ? t("收起进阶参数") : t("展开进阶参数（{count} 项）", { count: advancedFields.length }) }}
      </button>

      <div v-if="showAdvanced" class="policy-grid policy-grid--advanced">
        <label
          v-for="field in advancedFields"
          :key="field.key"
          class="policy-field"
          :class="{ 'policy-field--invalid': fieldPath === fieldPathFor(field.key) }"
          :data-input-path="fieldPathFor(field.key)"
        >
          <span :title="field.key">
            {{ policyLabel(field.key) }}
            <small v-if="isOmitted(field)">{{
              t("后端默认 {value}（未写入）", { value: backendDefault(field) })
            }}</small>
          </span>
          <select
            v-if="field.kind === 'enum'"
            :value="displayValue(field)"
            :title="boundsHint(field).title"
            :aria-invalid="fieldPath === fieldPathFor(field.key)"
            @change="updateEnum(field, $event)"
          >
            <option value="">{{ t("未设置（省略字段）") }}</option>
            <option v-for="option in field.enumValues" :key="option" :value="option">{{ option }}</option>
          </select>
          <select
            v-else-if="field.kind === 'boolean'"
            :value="displayValue(field)"
            :title="boundsHint(field).title"
            :aria-invalid="fieldPath === fieldPathFor(field.key)"
            @change="updateBoolean(field, $event)"
          >
            <option value="">{{ t("后端默认 {value}（省略字段）", { value: backendDefault(field) }) }}</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
          <input
            v-else
            :value="displayValue(field)"
            :placeholder="field.key in BACKEND_POLICY_DEFAULTS ? String(BACKEND_POLICY_DEFAULTS[field.key]) : undefined"
            type="number"
            step="any"
            :title="boundsHint(field).title"
            :aria-invalid="fieldPath === fieldPathFor(field.key)"
            @change="updateNumeric(field, $event)"
          />
          <small class="policy-field__hint">{{ boundsHint(field).text }}</small>
        </label>
      </div>

      <p v-if="localError" class="structured-note structured-note--error" role="alert">{{ localError }}</p>
    </template>
  </section>
</template>
