<script setup lang="ts">
import { reactive } from "vue";
import type { ExecutionDocument as Document } from "../contracts/execution-authoring";
import { parseJsonLossless } from "../contracts/lossless-json";
const cloneDocument = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const props = defineProps<{
  value: Document;
  path?: string;
  blockedOptions?: Record<string, Record<string, string>>;
  readonlyFields?: Record<string, string>;
}>();
const emit = defineEmits<{ change: [path: string, value: unknown]; invalid: [path: string, message: string] }>();
const errors = reactive<Record<string, string>>({});
const enums: Record<string, string[]> = {
  kind: ["device", "allreduce", "sendrecv"],
  matrix_dtype: ["fp16", "bf16", "fp32"],
  dtype: ["fp16", "bf16", "fp32", "float16", "bfloat16"],
  view: ["aggregate", "expanded"],
  tilelang_model_dtype: ["float16", "bfloat16"],
  phase: ["prefill", "decode"],
  operation: ["norm_qkv", "attention_output", "norm_gate_up", "activation_down", "final_norm_lm_head"],
  source: ["declared", "compiler_metadata", "launch_observation"],
  memory_policy: ["reload_operands", "wave_operand_reuse"],
  mapping: ["output_tile_per_block"],
  accumulator_dtype: ["fp32"],
  accum_dtype: ["float"],
  payload_mode: ["materialized", "structure_only"],
  output_policy: ["operator_barrier", "tile_ready_allreduce"],
  output_admission_policy: ["direct_v1", "safe_window_v1"],
  source_kind: ["generated", "compiler_derived", "observed_trace"],
  completion_condition: ["all_resources_completed", "device_task_completed", "collective_completed"],
};
function fieldPath(key: string) {
  return `${props.path || ""}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
}
function update(key: string, event: Event) {
  const input = event.target as HTMLInputElement;
  let value: unknown = input.value;
  if (typeof props.value[key] === "boolean") value = input.checked;
  else if (typeof props.value[key] === "number") {
    const number = Number(input.value);
    value = Number.isSafeInteger(number) || !Number.isInteger(number) ? number : input.value;
  }
  if (key === "kind" && value !== props.value.kind) {
    emit(
      "change",
      props.path || "",
      value === "device"
        ? { kind: "device", placement: "gpu0", stream: "default", flops: 0, memory_bytes: 0 }
        : { kind: value, participants: ["gpu0", "gpu1"], bytes: 1, chunk_bytes: 0 },
    );
  } else emit("change", fieldPath(key), value);
}
</script>
<template>
  <div class="operator-fields">
    <template v-for="(item, key) in value" :key="key">
      <details v-if="item && typeof item === 'object' && !Array.isArray(item)" class="operator-object">
        <summary>{{ key }}</summary>
        <ExecutionInputFields
          :value="item"
          :path="fieldPath(String(key))"
          :blocked-options="blockedOptions"
          :readonly-fields="readonlyFields"
          @change="(p, v) => emit('change', p, v)"
          @invalid="(p, message) => emit('invalid', p, message)"
        />
      </details>
      <details
        v-else-if="Array.isArray(item) && item.length && typeof item[0] === 'object'"
        class="operator-object"
        open
      >
        <summary>{{ key }} · {{ item.length }}</summary>
        <div v-for="(row, i) in item" :key="i" class="operator-array-row">
          <strong>#{{ i }}</strong
          ><ExecutionInputFields
            :value="row"
            :path="`${fieldPath(String(key))}/${i}`"
            :blocked-options="blockedOptions"
            :readonly-fields="readonlyFields"
            @change="(p, v) => emit('change', p, v)"
            @invalid="(p, message) => emit('invalid', p, message)"
          />
          <button
            type="button"
            :aria-label="`删除 ${key} ${i}`"
            @click="
              emit(
                'change',
                fieldPath(String(key)),
                item.filter((_: unknown, j: number) => i !== j),
              )
            "
          >
            删除
          </button>
        </div>
        <button type="button" @click="emit('change', fieldPath(String(key)), [...item, cloneDocument(item.at(-1))])">
          新增 {{ key }}
        </button>
      </details>
      <label v-else-if="Array.isArray(item)" class="operator-field wide">
        <span>{{ key }} <small>JSON array</small></span>
        <input
          :aria-label="fieldPath(String(key))"
          :value="JSON.stringify(item)"
          @change="
            (event) => {
              try {
                const input = event.target as HTMLInputElement;
                const parsed = parseJsonLossless(input.value);
                if (!Array.isArray(parsed)) throw new Error('array required');
                input.setCustomValidity('');
                errors[key] = '';
                emit('invalid', fieldPath(String(key)), '');
                emit('change', fieldPath(String(key)), parsed);
              } catch {
                (event.target as HTMLInputElement).setCustomValidity('合法 JSON 数组必填');
                errors[key] = '合法 JSON 数组必填';
                emit('invalid', fieldPath(String(key)), errors[key]);
              }
            }
          "
        />
        <small v-if="errors[key]" role="alert">{{ fieldPath(String(key)) }} · {{ errors[key] }}</small>
      </label>
      <label v-else class="operator-field">
        <span :title="fieldPath(String(key))">{{ key }}</span>
        <select
          v-if="enums[key]"
          :aria-label="fieldPath(String(key))"
          :value="item"
          @change="update(String(key), $event)"
        >
          <option
            v-for="option in enums[key]"
            :key="option"
            :value="option"
            :disabled="!!blockedOptions?.[key]?.[option]"
          >
            {{ option }}{{ blockedOptions?.[key]?.[option] ? " · " + blockedOptions[key][option] : "" }}
          </option>
        </select>
        <input
          v-else
          :aria-label="fieldPath(String(key))"
          :type="typeof item === 'boolean' ? 'checkbox' : 'text'"
          :checked="item === true"
          :value="item"
          :readonly="key === 'schema_version' || !!readonlyFields?.[key]"
          @change="update(String(key), $event)"
        />
        <small v-if="readonlyFields?.[key]">{{ readonlyFields[key] }}</small>
      </label>
    </template>
  </div>
</template>
