<script setup lang="ts">
import { computed, ref } from "vue";
import { Server, Plus, Trash2 } from "@lucide/vue";
import { useI18n } from "../../i18n";
import { topologyDeviceFields, topologyDeviceMaxItems, type SchemaFieldMeta } from "./input-schema-meta";
import {
  deviceIdsOf,
  deviceReferences,
  parseJsonDocument,
  patchJsonDocument,
  removeDevice,
  renameDevice,
  setDeviceCount,
  topologyDevicesOf,
  StructuredInputError,
  type DeviceCountChange,
  type JsonObject,
} from "./structured-input";

const props = withDefaults(defineProps<{ modelValue: string; fieldPath?: string }>(), { fieldPath: "" });
const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
  (event: "notice", payload: { tone: "info" | "warning"; message: string }): void;
  (event: "device-count-change", payload: { ids: string[] }): void;
}>();
const { t } = useI18n();

/**
 * Plain-language labels. The contract key stays available as a hover tooltip so
 * the field can still be matched against a backend diagnostic Pointer.
 */
const DEVICE_LABEL_SOURCE: Record<string, string> = {
  device_id: "设备编号",
  device_type: "设备类型",
  group_id: "分组编号",
};

const editableFields: SchemaFieldMeta[] = topologyDeviceFields.filter((field) => field.kind === "string");
/** Non-string device fields (if the contract ever adds one) are reported, not silently dropped. */
const unrenderedFields = computed(() => topologyDeviceFields.filter((field) => field.kind !== "string"));

function deviceLabel(meta: SchemaFieldMeta): string {
  const source = DEVICE_LABEL_SOURCE[meta.key];
  return source ? t(source) : meta.key;
}

const localError = ref("");
const parsed = computed(() => parseJsonDocument(props.modelValue, "Fabric topology"));
const documentValue = computed<JsonObject | null>(() => (parsed.value.ok ? parsed.value.value : null));
const devices = computed<unknown[] | null>(() => (documentValue.value ? topologyDevicesOf(documentValue.value) : null));
const rowIndexes = computed(() => (devices.value || []).map((_, index) => index));
const deviceCount = computed(() => devices.value?.length ?? 0);

function rowAt(index: number): JsonObject | null {
  const value = devices.value?.[index];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

function cellValue(index: number, key: string): string {
  const value = rowAt(index)?.[key];
  return value === undefined || value === null ? "" : String(value);
}

function deviceId(index: number): string {
  return cellValue(index, "device_id");
}

function describeReferences(references: { domains: string[]; links: number[] }): string {
  const parts: string[] = [];
  if (references.domains.length) parts.push(`domains: ${references.domains.join("、")}`);
  if (references.links.length) parts.push(`links: ${references.links.map((index) => `#${index + 1}`).join("、")}`);
  return parts.join("；");
}

/**
 * Reads the device list out of the patched text. `props.modelValue` still holds
 * the previous value until the parent re-renders, so the emitted payload must be
 * derived from the new text rather than from `devices`.
 */
function announceDeviceIds(next: string) {
  const nextDocument = parseJsonDocument(next, "Fabric topology");
  emit("device-count-change", { ids: nextDocument.ok ? deviceIdsOf(nextDocument.value) : [] });
}

function applyDeviceCount(event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  const count = Number(raw);
  if (!Number.isInteger(count)) {
    localError.value = t("卡数必须是整数。");
    return;
  }
  try {
    // The mutator runs inside the patch helper, so the result is collected in a
    // box: a plain `let` would stay narrowed to `null` at the use site.
    const outcome: { change: DeviceCountChange | null } = { change: null };
    const next = patchJsonDocument(props.modelValue, "Fabric topology", (draft) => {
      outcome.change = setDeviceCount(draft, count);
    });
    emit("update:modelValue", next);
    localError.value = "";
    const change = outcome.change;
    if (change && (change.removed.length || change.cleaned.length)) {
      const cleanedText = change.cleaned.length
        ? change.cleaned.map((references) => describeReferences(references)).join(" / ")
        : t("无");
      emit("notice", {
        tone: "warning",
        message: t("卡数减少，已删除 {removed}，并清理了引用：{cleaned}", {
          removed: change.removed.join("、"),
          cleaned: cleanedText,
        }),
      });
    }
    announceDeviceIds(next);
  } catch (error) {
    localError.value = error instanceof StructuredInputError ? error.message : String(error);
  }
}

/** The count box handles bulk changes; this button adds exactly one device. */
function addOneDevice() {
  const outcome: { change: DeviceCountChange | null } = { change: null };
  try {
    const next = patchJsonDocument(props.modelValue, "Fabric topology", (draft) => {
      outcome.change = setDeviceCount(draft, deviceCount.value + 1);
    });
    emit("update:modelValue", next);
    localError.value = "";
    const added = outcome.change?.added || [];
    if (added.length) {
      emit("notice", {
        tone: "info",
        message: t("已新增设备 {device}，设备类型默认 GPU；记得把它勾进需要的域。", { device: added.join("、") }),
      });
    }
    announceDeviceIds(next);
  } catch (error) {
    localError.value = error instanceof StructuredInputError ? error.message : String(error);
  }
}

function updateField(field: SchemaFieldMeta, index: number, event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  if (field.key === "device_id") {
    const next = raw.trim();
    const current = deviceId(index);
    if (next === current) return;
    if (!next) {
      localError.value = t("设备编号不能为空。");
      return;
    }
    try {
      const updated = patchJsonDocument(props.modelValue, "Fabric topology", (draft) =>
        renameDevice(draft, current, next),
      );
      emit("update:modelValue", updated);
      localError.value = "";
      emit("notice", {
        tone: "info",
        message: t("已把 {from} 改名为 {to}，并同步更新了 domains 与 links 中的引用。", { from: current, to: next }),
      });
      announceDeviceIds(updated);
    } catch (error) {
      localError.value = error instanceof StructuredInputError ? error.message : String(error);
    }
    return;
  }
  const value = raw.trim();
  try {
    const updated = patchJsonDocument(props.modelValue, "Fabric topology", (draft) => {
      const target = topologyDevicesOf(draft)?.[index];
      if (!target || typeof target !== "object" || Array.isArray(target)) return;
      // Optional string fields with maxLength: an empty box means "omit the key".
      if (!value) delete (target as JsonObject)[field.key];
      else (target as JsonObject)[field.key] = value;
    });
    emit("update:modelValue", updated);
    localError.value = "";
    announceDeviceIds(updated);
  } catch (error) {
    localError.value = error instanceof StructuredInputError ? error.message : String(error);
  }
}

function dropDevice(index: number) {
  const target = deviceId(index);
  if (!target) return;
  const references = documentValue.value ? deviceReferences(documentValue.value, target) : { domains: [], links: [] };
  try {
    const updated = patchJsonDocument(props.modelValue, "Fabric topology", (draft) => {
      removeDevice(draft, target);
    });
    emit("update:modelValue", updated);
    localError.value = "";
    if (references.domains.length || references.links.length) {
      emit("notice", {
        tone: "warning",
        message: t("删除 {device} 时它仍被引用（{refs}），已一并从 domains 与 links 中移除。", {
          device: target,
          refs: describeReferences(references),
        }),
      });
    } else {
      emit("notice", { tone: "info", message: t("已删除 {device}。", { device: target }) });
    }
    announceDeviceIds(updated);
  } catch (error) {
    localError.value = error instanceof StructuredInputError ? error.message : String(error);
  }
}

function cellPath(index: number, key: string): string {
  return `/custom_inputs/topology/topology/devices/${index}/${key}`;
}
</script>

<template>
  <section class="device-inventory" :aria-label="t('设备清单')">
    <header class="structured-block__header">
      <Server :size="16" />
      <div>
        <strong>{{ t("设备清单") }}</strong>
        <small>{{
          t("最多 {max} 台。新增设备按 gpu0、gpu1 的顺序命名，自动跳过重名。", { max: topologyDeviceMaxItems })
        }}</small>
      </div>
      <label class="device-inventory__count"
        ><span>{{ t("卡数") }}</span
        ><input
          type="number"
          min="0"
          :max="topologyDeviceMaxItems"
          step="1"
          :value="deviceCount"
          :aria-label="t('卡数')"
          @change="applyDeviceCount"
      /></label>
      <button type="button" class="button button--secondary" @click="addOneDevice">
        <Plus :size="15" />{{ t("新增设备") }}
      </button>
    </header>

    <p v-if="!parsed.ok" class="structured-note structured-note--warning" role="alert">{{ parsed.error }}</p>
    <p v-else-if="!devices" class="structured-note structured-note--warning" role="alert">
      {{ t("topology JSON 缺少 devices 数组，设备清单暂不可编辑。") }}
    </p>
    <p v-else-if="!devices.length" class="structured-note">{{ t("当前没有设备。把「卡数」改为大于 0 即可新增。") }}</p>

    <ul v-else class="device-inventory__rows">
      <li v-for="index in rowIndexes" :key="`device-row-${index}`" class="device-inventory-row">
        <span class="device-inventory-row__index">{{ index + 1 }}</span>
        <label
          v-for="field in editableFields"
          :key="`${index}-${field.key}`"
          :data-input-path="cellPath(index, field.key)"
          :title="field.key"
        >
          <span>{{ deviceLabel(field) }}</span>
          <input
            type="text"
            spellcheck="false"
            :value="cellValue(index, field.key)"
            :aria-label="`${deviceLabel(field)} ${index + 1}`"
            :aria-invalid="fieldPath === cellPath(index, field.key)"
            @change="updateField(field, index, $event)"
          />
        </label>
        <button
          type="button"
          class="icon-button"
          :aria-label="t('删除设备 {device}', { device: deviceId(index) })"
          @click="dropDevice(index)"
        >
          <Trash2 :size="14" />
        </button>
      </li>
    </ul>

    <p v-if="localError" class="structured-note structured-note--error" role="alert">{{ localError }}</p>
    <p v-else-if="unrenderedFields.length" class="structured-note structured-note--warning">
      {{
        t("契约里还有 {count} 个非字符串设备字段没有控件，请直接在原始 JSON 里编辑：{fields}", {
          count: unrenderedFields.length,
          fields: unrenderedFields.map((field) => field.key).join("、"),
        })
      }}
    </p>
  </section>
</template>
