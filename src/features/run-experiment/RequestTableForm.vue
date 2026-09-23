<script setup lang="ts">
import { computed, ref } from "vue";
import { Copy, ListOrdered, Plus, Trash2 } from "@lucide/vue";
import { useI18n } from "../../i18n";
import {
  describeBounds,
  runtimeRequestFields,
  runtimeRequestMaxItems,
  runtimeRequestMinItems,
  type SchemaFieldMeta,
} from "./input-schema-meta";
import {
  appendRequestRow,
  duplicateRequestRow,
  formatParticipantsText,
  parseJsonDocument,
  parseParticipantsText,
  patchJsonDocument,
  removeRequestRow,
  runtimeRequestsOf,
  StructuredInputError,
  validateRuntimeRequests,
  type JsonObject,
} from "./structured-input";

const props = withDefaults(defineProps<{ modelValue: string; fieldPath?: string }>(), { fieldPath: "" });
const emit = defineEmits<{ (event: "update:modelValue", value: string): void }>();
const { t } = useI18n();

/**
 * Which request keys get a control. Attributes (type, bounds, enum, maxItems)
 * always come from the schema-derived metadata; this list is only "what the
 * table shows", and every key is checked against the contract at setup time.
 */
const REQUEST_COLUMN_KEYS = [
  "request_id",
  "arrival_time_ps",
  "phase",
  "prompt_tokens",
  "decode_tokens",
  "kv_tokens",
  "tp_degree",
  "participants",
] as const;

/** Plain-language column labels; the contract key stays in the header tooltip. */
const REQUEST_LABEL_SOURCE: Record<string, string> = {
  request_id: "请求编号",
  arrival_time_ps: "到达时间",
  phase: "阶段",
  prompt_tokens: "输入 token 数",
  decode_tokens: "输出 token 数",
  kv_tokens: "KV token 数",
  tp_degree: "并行卡数",
  participants: "参与设备",
};

const metadataByKey = new Map(runtimeRequestFields.map((field) => [field.key, field]));
const columns: SchemaFieldMeta[] = REQUEST_COLUMN_KEYS.map((key) => {
  const meta = metadataByKey.get(key);
  if (!meta) throw new Error(`request column ${key} is not declared by runtime-trace-input.schema.json`);
  return meta;
});

function columnLabel(meta: SchemaFieldMeta): string {
  const source = REQUEST_LABEL_SOURCE[meta.key];
  return source ? t(source) : meta.key;
}

const localError = ref("");
const parsed = computed(() => parseJsonDocument(props.modelValue, "Runtime trace"));
const documentValue = computed<JsonObject | null>(() => (parsed.value.ok ? parsed.value.value : null));
const requests = computed<unknown[] | null>(() =>
  documentValue.value ? runtimeRequestsOf(documentValue.value) : null,
);
const validation = computed(() => validateRuntimeRequests(requests.value));
const rowCount = computed(() => requests.value?.length ?? 0);
const rowIndexes = computed(() => (requests.value || []).map((_, index) => index));
const exposedKeys = new Set<string>(REQUEST_COLUMN_KEYS);

function commit(mutate: (draft: JsonObject) => void) {
  try {
    emit("update:modelValue", patchJsonDocument(props.modelValue, "Runtime trace", mutate));
    localError.value = "";
  } catch (error) {
    localError.value = error instanceof StructuredInputError ? error.message : String(error);
  }
}

function rowAt(index: number): JsonObject | null {
  const value = requests.value?.[index];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

function boundsHint(meta: SchemaFieldMeta): string {
  return describeBounds(meta).text;
}

function updateText(field: SchemaFieldMeta, index: number, event: Event, keepEmpty: boolean) {
  const raw = (event.target as HTMLInputElement).value;
  commit((draft) => {
    const rows = runtimeRequestsOf(draft);
    const row = rows?.[index];
    if (!rows || !row || typeof row !== "object" || Array.isArray(row)) return;
    const target = row as JsonObject;
    const value = raw.trim();
    if (value === "" && !keepEmpty) delete target[field.key];
    else target[field.key] = value;
  });
}

function updateNumeric(field: SchemaFieldMeta, index: number, event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  if (raw.trim() === "") {
    commit((draft) => {
      const row = runtimeRequestsOf(draft)?.[index];
      if (row && typeof row === "object" && !Array.isArray(row)) delete (row as JsonObject)[field.key];
    });
    return;
  }
  const value = Number(raw);
  const invalid =
    !Number.isFinite(value) ||
    (field.integerOnly && !Number.isInteger(value)) ||
    (field.minimum !== null && value < field.minimum) ||
    (field.maximum !== null && value > field.maximum);
  if (invalid) {
    localError.value = t("{field} 超出契约范围：{hint}", {
      field: field.key,
      hint: describeBounds(field, t("整数")).title,
    });
    return;
  }
  commit((draft) => {
    const row = runtimeRequestsOf(draft)?.[index];
    if (row && typeof row === "object" && !Array.isArray(row)) (row as JsonObject)[field.key] = value;
  });
}

function updateEnum(field: SchemaFieldMeta, index: number, event: Event) {
  const raw = (event.target as HTMLSelectElement).value;
  commit((draft) => {
    const row = runtimeRequestsOf(draft)?.[index];
    if (!row || typeof row !== "object" || Array.isArray(row)) return;
    if (raw === "") delete (row as JsonObject)[field.key];
    else (row as JsonObject)[field.key] = raw;
  });
}

function updateParticipants(index: number, event: Event) {
  const list = parseParticipantsText((event.target as HTMLInputElement).value);
  commit((draft) => {
    const row = runtimeRequestsOf(draft)?.[index];
    if (!row || typeof row !== "object" || Array.isArray(row)) return;
    const target = row as JsonObject;
    // An empty list is stored as an absent key: only an omitted participants
    // list lets the engine derive members from the device inventory and
    // tp_degree (D:\tileSim\src\S6_Fabric\ModularFabric.cpp:1242-1253).
    if (!list.length) delete target.participants;
    else target.participants = list;
  });
}

function addRow() {
  commit((draft) => appendRequestRow(draft));
}

function copyRow(index: number) {
  commit((draft) => duplicateRequestRow(draft, index));
}

function dropRow(index: number) {
  commit((draft) => removeRequestRow(draft, index));
}

function cellValue(field: SchemaFieldMeta, index: number): string {
  const value = rowAt(index)?.[field.key];
  if (value === undefined || value === null) return "";
  if (field.kind === "stringArray") return formatParticipantsText(value);
  return String(value);
}

function cellPath(index: number, key: string): string {
  return `/custom_inputs/runtime_trace/requests/${index}/${key}`;
}

function cellInvalid(index: number, key: string): boolean {
  return (
    props.fieldPath === cellPath(index, key) || props.fieldPath === `/custom_inputs/runtime_trace/requests/${index}`
  );
}

/**
 * Keys rows carry but the table does not render. Reported once for the whole
 * table rather than inside each `request_id` cell: the per-row badge wrapped to
 * four lines in a narrow column and told the reader less than the union does.
 */
const hiddenKeys = computed(() => {
  const keys = new Set<string>();
  for (const index of rowIndexes.value) {
    const row = rowAt(index);
    if (!row) continue;
    for (const key of Object.keys(row)) if (!exposedKeys.has(key)) keys.add(key);
  }
  return [...keys];
});
</script>

<template>
  <section class="structured-block structured-block--requests" :aria-label="t('请求表')">
    <header class="structured-block__header">
      <ListOrdered :size="16" />
      <div>
        <strong>{{ t("请求表") }}</strong>
        <small>{{
          t("共 {count} 行，契约允许 {min} ~ {max} 行。", {
            count: rowCount,
            max: runtimeRequestMaxItems,
            min: runtimeRequestMinItems,
          })
        }}</small>
      </div>
      <button type="button" class="button button--secondary" @click="addRow">
        <Plus :size="14" />{{ t("添加请求行") }}
      </button>
    </header>

    <p v-if="!parsed.ok" class="structured-note structured-note--warning" role="alert">{{ parsed.error }}</p>
    <p v-else-if="!requests" class="structured-note structured-note--warning" role="alert">
      {{ t("runtime trace 缺少 requests 数组，请求表暂不可编辑。") }}
    </p>

    <template v-else>
      <ul v-if="validation.issues.length" class="request-issues" role="alert">
        <li v-for="issue in validation.issues" :key="`${issue.index}-${issue.field}-${issue.message}`">
          {{ issue.message }}
        </li>
      </ul>

      <div class="request-table-scroll" tabindex="0" role="region" :aria-label="t('请求表（可横向滚动）')">
        <table class="request-table">
          <thead>
            <tr>
              <th scope="col">{{ t("行") }}</th>
              <th
                v-for="field in columns"
                :key="field.key"
                scope="col"
                :title="`${field.key} · ${describeBounds(field).title}`"
              >
                {{ columnLabel(field) }}
                <small v-if="boundsHint(field)" class="request-table__hint">{{ boundsHint(field) }}</small>
              </th>
              <th scope="col">{{ t("操作") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="index in rowIndexes" :key="`request-row-${index}`">
              <th scope="row">{{ index + 1 }}</th>
              <td
                v-for="field in columns"
                :key="`${index}-${field.key}`"
                :data-input-path="cellPath(index, field.key)"
                :class="{ 'request-table__cell--invalid': cellInvalid(index, field.key) }"
              >
                <select
                  v-if="field.kind === 'enum'"
                  :value="cellValue(field, index)"
                  :aria-label="`${columnLabel(field)} ${index + 1}`"
                  :aria-invalid="cellInvalid(index, field.key)"
                  @change="updateEnum(field, index, $event)"
                >
                  <option value="">{{ t("未设置") }}</option>
                  <option v-for="option in field.enumValues" :key="option" :value="option">{{ option }}</option>
                </select>
                <input
                  v-else-if="field.kind === 'stringArray'"
                  type="text"
                  :value="cellValue(field, index)"
                  spellcheck="false"
                  :aria-label="`${columnLabel(field)} ${index + 1}`"
                  :aria-invalid="cellInvalid(index, field.key)"
                  :placeholder="t('留空＝不写这个字段，由引擎按并行卡数挑设备')"
                  @change="updateParticipants(index, $event)"
                />
                <input
                  v-else-if="field.integerOnly || field.kind === 'number'"
                  type="number"
                  step="any"
                  :value="cellValue(field, index)"
                  :aria-label="`${columnLabel(field)} ${index + 1}`"
                  :aria-invalid="cellInvalid(index, field.key)"
                  @change="updateNumeric(field, index, $event)"
                />
                <input
                  v-else
                  type="text"
                  :value="cellValue(field, index)"
                  spellcheck="false"
                  :aria-label="`${columnLabel(field)} ${index + 1}`"
                  :aria-invalid="cellInvalid(index, field.key)"
                  @change="updateText(field, index, $event, field.required)"
                />
              </td>
              <td class="request-table__actions">
                <button
                  type="button"
                  class="icon-button"
                  :aria-label="t('复制第 {row} 行', { row: index + 1 })"
                  @click="copyRow(index)"
                >
                  <Copy :size="14" />
                </button>
                <button
                  type="button"
                  class="icon-button"
                  :aria-label="t('删除第 {row} 行', { row: index + 1 })"
                  @click="dropRow(index)"
                >
                  <Trash2 :size="14" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="hiddenKeys.length" class="structured-note">
        {{
          t("这 {count} 个字段表格里没有控件，提交时会原样保留：{fields}", {
            count: hiddenKeys.length,
            fields: hiddenKeys.join("、"),
          })
        }}
      </p>

      <p v-if="localError" class="structured-note structured-note--error" role="alert">{{ localError }}</p>
    </template>
  </section>
</template>
