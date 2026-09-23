<script setup>
import { Braces, Cpu, Database, Network, PackageSearch, RotateCcw, SlidersHorizontal, Table2 } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useI18n } from "../../i18n";
import DeviceInventoryForm from "./DeviceInventoryForm.vue";
import DomainInventoryForm from "./DomainInventoryForm.vue";
import RequestTableForm from "./RequestTableForm.vue";
import RuntimePolicyForm from "./RuntimePolicyForm.vue";
import TopologyGraphEditor from "./TopologyGraphEditor.vue";
import { clearParticipants, patchJsonDocument, rewriteParticipants, writeControlPointer } from "./structured-input";

const form = defineModel("form", { type: Object, required: true });
const mode = defineModel("mode", { type: String, required: true });
const runtimeJson = defineModel("runtimeJson", { type: String, required: true });
const topologyJson = defineModel("topologyJson", { type: String, required: true });
/**
 * Off until the user turns the structured editors on from the quick-control tab.
 * While it is off this panel keeps emitting `overrides` exactly as it did
 * before, so nothing about the quick-control path changes by itself — the
 * channel only moves to `custom_inputs` once the knobs alone can no longer
 * express what the user asked for.
 */
const structuredInput = defineModel("structuredInput", { type: Boolean, default: false });
const props = defineProps({
  surface: { type: Object, required: true },
  controlGroups: { type: Array, required: true },
  fieldPath: { type: String, default: "" },
  compact: { type: Boolean, default: false },
});
defineEmits([
  "reset-controls",
  "load-template",
  "load-bundle",
  "load-json-file",
  "use-structured-input",
  "disable-structured-input",
]);
const { t } = useI18n();
const showFieldContracts = ref(false);
const pairingPrompt = ref(null);
const structuredNotice = ref("");
const structuredNoticeTone = ref("info");
const controlFields = computed(() => (props.controlGroups || []).flatMap((group) => group.fields));

/**
 * R3: shrinking or growing the device inventory changes nothing on its own —
 * the shipped template pins `participants` to gpu0..gpu3, and only an omitted
 * participants list makes the engine derive members from the inventory by
 * tp_degree. So the change is surfaced with two explicit choices instead of
 * being applied silently.
 */
function onDeviceCountChange(payload) {
  if (!payload.ids.length) return;
  if (!runtimeJson.value.trim()) {
    structuredNoticeTone.value = "warning";
    structuredNotice.value = t("设备清单已变化，但 runtime trace 还是空的：加载模板后再决定请求表里的参与设备怎么办。");
    return;
  }
  pairingPrompt.value = { ids: payload.ids };
}

function onBlockNotice(payload) {
  structuredNoticeTone.value = payload.tone;
  structuredNotice.value = payload.message;
}

function applyPairing(kind) {
  const ids = pairingPrompt.value?.ids || [];
  const outcome = { count: 0, missing: 0 };
  try {
    if (kind === "participants") {
      runtimeJson.value = patchJsonDocument(runtimeJson.value, "Runtime trace", (draft) => {
        outcome.count = rewriteParticipants(draft, ids);
      });
      structuredNoticeTone.value = "info";
      structuredNotice.value = t("已把 {count} 条请求的参与设备改成 {devices}。并行卡数不会跟着变，请自行核对。", {
        count: outcome.count,
        devices: ids.join("、"),
      });
    } else {
      runtimeJson.value = patchJsonDocument(runtimeJson.value, "Runtime trace", (draft) => {
        const result = clearParticipants(draft);
        outcome.count = result.cleared;
        outcome.missing = result.missingTpDegree;
      });
      structuredNoticeTone.value = "info";
      structuredNotice.value = t("已清空 {count} 条请求的参与设备；其中 {missing} 条没填并行卡数，需要补上。", {
        count: outcome.count,
        missing: outcome.missing,
      });
    }
  } catch (error) {
    structuredNoticeTone.value = "warning";
    structuredNotice.value = error instanceof Error ? error.message : String(error);
  }
  pairingPrompt.value = null;
}

/**
 * The knobs and the policy form both claim the same keys once the structured
 * editor is open, so an edited knob is mirrored into the document immediately.
 * Only the changed knob is written, which leaves values typed directly into the
 * form alone. `lastKnobs` is a local snapshot because a deep watcher reports the
 * same (already mutated) object for both the new and the old value.
 */
let lastKnobs = { ...(form.value.parameterValues || {}) };
watch(
  () => form.value.parameterValues,
  () => {
    const current = { ...(form.value.parameterValues || {}) };
    const changed = new Set(Object.keys(current).filter((fieldId) => current[fieldId] !== lastKnobs[fieldId]));
    Object.keys(lastKnobs).forEach((fieldId) => {
      if (!(fieldId in current)) changed.add(fieldId);
    });
    lastKnobs = current;
    if (!structuredInput.value || !changed.size) return;
    const notes = [];
    for (const field of controlFields.value) {
      if (!changed.has(field.fieldId)) continue;
      const raw = current[field.fieldId];
      const value = raw === undefined || raw === null || raw === "" ? undefined : raw;
      const result = writeControlPointer({
        runtimeJson: runtimeJson.value,
        topologyJson: topologyJson.value,
        pointer: field.requestJsonPointer,
        value,
      });
      runtimeJson.value = result.runtimeJson;
      topologyJson.value = result.topologyJson;
      if (result.note) notes.push(result.note);
    }
    if (notes.length) {
      structuredNoticeTone.value = "warning";
      structuredNotice.value = notes.map((note) => note.message).join(" ");
    }
  },
  { deep: true },
);

watch(mode, (next) => {
  if (next !== "controls") pairingPrompt.value = null;
});
</script>

<template>
  <article class="panel form-section">
    <header class="form-section-title">
      <span>02</span>
      <div>
        <h2>{{ t("输入方式") }}</h2>
        <p v-if="!props.compact">{{ t("快捷控制适合对比实验；JSON 适合精确复现。") }}</p>
      </div>
    </header>
    <div class="experiment-input-toolbar">
      <div class="segmented-control">
        <button
          :class="{ active: mode === 'controls' }"
          :disabled="!surface.inputModes.includes('controls')"
          @click="mode = 'controls'"
        >
          <SlidersHorizontal :size="16" />{{ t("快捷控制") }}
        </button>
        <button
          :class="{ active: mode === 'json' }"
          :disabled="!surface.inputModes.includes('json')"
          @click="mode = 'json'"
        >
          <Braces :size="16" />{{ t("JSON 输入") }}
        </button>
        <button
          :class="{ active: mode === 'trace_package' }"
          :disabled="!surface.inputModes.includes('trace_package')"
          @click="mode = 'trace_package'"
        >
          <PackageSearch :size="16" />{{ t("Trace package") }}
        </button>
      </div>
      <button
        v-if="mode === 'controls'"
        class="text-button"
        :aria-pressed="showFieldContracts"
        @click="showFieldContracts = !showFieldContracts"
      >
        <Braces :size="14" />{{ showFieldContracts ? t("隐藏字段契约") : t("显示字段契约") }}
      </button>
    </div>

    <div v-if="mode === 'controls'" class="control-sections">
      <section v-for="group in controlGroups" :key="group.subsystem" class="schema-control-group">
        <header>
          <Cpu v-if="group.subsystem === 'S1'" :size="17" />
          <Database v-else-if="group.subsystem === 'S0'" :size="17" />
          <Network v-else :size="17" />
          <div>
            <strong>{{ group.title }}</strong
            ><small v-if="!props.compact">{{ group.subsystem }} · {{ t(group.detail) }}</small>
          </div>
          <button v-if="group.subsystem === 'S1'" class="text-button" @click="$emit('reset-controls')">
            <RotateCcw :size="14" />{{ t("清除可选参数") }}
          </button>
        </header>
        <div class="form-grid">
          <label
            v-for="field in group.fields"
            :key="field.fieldId"
            class="field"
            :class="{ 'field--invalid': fieldPath === field.requestJsonPointer }"
            :data-field-id="field.fieldId"
            :data-field-path="field.requestJsonPointer"
          >
            <span
              >{{ t(field.label) }} <small v-if="field.unit">{{ field.unit }}</small></span
            >
            <select
              v-if="field.kind === 'select'"
              v-model="form.parameterValues[field.fieldId]"
              :disabled="!field.available"
              :aria-invalid="fieldPath === field.requestJsonPointer"
            >
              <option v-if="!field.explicitDefaultAvailable" :value="undefined">{{ t("未设置（省略字段）") }}</option>
              <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
            </select>
            <input
              v-else
              v-model.number="form.parameterValues[field.fieldId]"
              type="number"
              :disabled="!field.available"
              :min="field.minimum"
              :max="field.maximum"
              :step="field.step"
              :placeholder="field.explicitDefaultAvailable ? undefined : t('未设置（省略字段）')"
              :aria-invalid="fieldPath === field.requestJsonPointer"
            />
            <small v-if="showFieldContracts || fieldPath === field.requestJsonPointer" class="field-help"
              ><code>{{ field.fieldId }}</code> · <code>{{ field.requestJsonPointer }}</code></small
            >
            <small v-if="!field.available" class="field-error">{{ field.unavailableReason }}</small>
            <small v-if="fieldPath === field.requestJsonPointer" class="field-error">{{
              field.requestJsonPointer
            }}</small>
          </label>
        </div>
        <small v-if="showFieldContracts" class="schema-source-note">
          {{ group.fields[0]?.contractStatus }} ·
          {{
            group.fields[0]?.contractStatus === "backend_descriptor" ? t("正式后端参数描述契约") : t("旧版兼容参数描述")
          }}
        </small>
      </section>

      <section class="structured-area">
        <header class="structured-block__header structured-area__header">
          <Table2 :size="17" />
          <div>
            <strong>{{ t("每个请求 / 显卡数量 / 拓扑连线") }}</strong>
            <small>{{
              t("旋钮只有 {count} 个参数，装不下请求表和设备清单；这三样只能走 custom_inputs，启用后本次提交改用它。", {
                count: controlFields.length,
              })
            }}</small>
          </div>
          <button
            v-if="!structuredInput"
            type="button"
            class="button button--secondary structured-entry-button"
            :disabled="!surface.inputModes.includes('json')"
            @click="$emit('use-structured-input')"
          >
            <Table2 :size="15" />{{ t("用表单配置全部输入 →") }}
          </button>
          <button v-else type="button" class="text-button" @click="$emit('disable-structured-input')">
            <RotateCcw :size="14" />{{ t("停用，回到只用旋钮") }}
          </button>
        </header>

        <p v-if="structuredInput" class="structured-note structured-note--info" role="status">
          {{
            t(
              "本次提交方式：结构化输入（custom_inputs）。上方旋钮改的参数会同步写入 policy，Fabric 参数写入 module_bindings。",
            )
          }}
        </p>
        <p
          v-if="structuredNotice"
          class="structured-note"
          :class="`structured-note--${structuredNoticeTone}`"
          role="status"
        >
          {{ structuredNotice }}
        </p>
        <div v-if="pairingPrompt" class="structured-note structured-note--warning" role="alert">
          <p>
            {{
              t("设备清单现在是 {count} 张卡。只加卡而不改请求不会改变结果，请选择如何处理请求表：", {
                count: pairingPrompt.ids.length,
              })
            }}
          </p>
          <div class="structured-actions">
            <button type="button" class="button button--secondary" @click="applyPairing('participants')">
              {{ t("① 把每条请求的参与设备改成新集合") }}
            </button>
            <button type="button" class="button button--secondary" @click="applyPairing('clear')">
              {{ t("② 清空参与设备，保留并行卡数") }}
            </button>
            <button type="button" class="text-button" @click="pairingPrompt = null">{{ t("稍后再说") }}</button>
          </div>
        </div>

        <div v-if="structuredInput" class="structured-stack">
          <template v-if="runtimeJson.trim()">
            <RuntimePolicyForm v-model="runtimeJson" :field-path="fieldPath" />
            <RequestTableForm v-model="runtimeJson" :field-path="fieldPath" />
          </template>
          <p v-else class="structured-note structured-note--warning" role="alert">
            {{ t("runtime trace 还是空的。请先点「用表单配置全部输入」载入场景模板，或到「JSON 输入」页签粘贴内容。") }}
          </p>
          <DeviceInventoryForm
            v-model="topologyJson"
            :field-path="fieldPath"
            @notice="onBlockNotice"
            @device-count-change="onDeviceCountChange"
          />
          <DomainInventoryForm v-model="topologyJson" :field-path="fieldPath" @notice="onBlockNotice" />
          <!-- Mouse-only: the quick-control tab never shows a raw JSON box. -->
          <TopologyGraphEditor v-model="topologyJson" :field-path="fieldPath" :show-json="false" />
        </div>
      </section>
    </div>

    <div v-else-if="mode === 'json'" class="json-editor-section">
      <div class="json-toolbar">
        <button class="button button--secondary" @click="$emit('load-template')">
          <Database :size="15" />{{ t("加载场景模板") }}
        </button>
        <label class="button button--ghost"
          >{{ t("导入完整输入包")
          }}<input type="file" accept="application/json,.json" @change="$emit('load-bundle', $event)"
        /></label>
      </div>
      <div class="json-grid">
        <label
          ><span
            >Runtime trace JSON
            <label class="inline-file"
              >{{ t("导入")
              }}<input
                type="file"
                accept="application/json,.json"
                @change="$emit('load-json-file', $event, 'runtime')" /></label></span
          ><textarea
            v-model="runtimeJson"
            spellcheck="false"
            :aria-invalid="fieldPath === '/custom_inputs/runtime_trace'"
            :placeholder="t('加载模板或粘贴 S1 runtime trace')"
          ></textarea>
        </label>
        <div class="topology-input-column">
          <!--
            The JSON tab owns typing: the graph is a read-only preview that
            follows the textarea, so topology input happens in exactly one way —
            editing this JSON. The import button stays because it is the file
            equivalent of the "导入" control the runtime textarea already has.
          -->
          <TopologyGraphEditor v-model="topologyJson" :field-path="fieldPath" read-only />
          <label class="inline-file topology-import"
            >{{ t("导入拓扑 JSON")
            }}<input type="file" accept="application/json,.json" @change="$emit('load-json-file', $event, 'topology')"
          /></label>
        </div>
      </div>
    </div>
    <div v-else class="trace-package-state">
      {{ t("从下方受控目录选择 package；浏览器不会发送或显示服务器文件路径。") }}
    </div>
  </article>
</template>
