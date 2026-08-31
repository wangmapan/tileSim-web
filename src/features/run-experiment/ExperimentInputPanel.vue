<script setup>
import { Braces, Cpu, Database, Network, RotateCcw, SlidersHorizontal } from "@lucide/vue";
import { useI18n } from "../../i18n";

const form = defineModel("form", { type: Object, required: true });
const mode = defineModel("mode", { type: String, required: true });
const runtimeJson = defineModel("runtimeJson", { type: String, required: true });
const topologyJson = defineModel("topologyJson", { type: String, required: true });
defineProps({
  surface: { type: Object, required: true },
  controlGroups: { type: Array, required: true },
  fieldPath: { type: String, default: "" },
});
defineEmits(["reset-controls", "load-template", "load-bundle", "load-json-file"]);
const { t } = useI18n();
</script>

<template>
  <article class="panel form-section">
    <header class="form-section-title">
      <span>02</span>
      <div>
        <h2>{{ t("输入方式") }}</h2>
        <p>{{ t("快捷控制适合对比实验；JSON 适合精确复现。") }}</p>
      </div>
    </header>
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
    </div>

    <div v-if="mode === 'controls'" class="control-sections">
      <section v-for="group in controlGroups" :key="group.subsystem" class="schema-control-group">
        <header>
          <Cpu v-if="group.subsystem === 'S1'" :size="17" />
          <Database v-else-if="group.subsystem === 'S0'" :size="17" />
          <Network v-else :size="17" />
          <div>
            <strong>{{ group.title }}</strong
            ><small>{{ group.subsystem }} · {{ t(group.detail) }}</small>
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
            <small class="field-help"
              ><code>{{ field.fieldId }}</code> · <code>{{ field.requestJsonPointer }}</code></small
            >
            <small v-if="!field.available" class="field-error">{{ field.unavailableReason }}</small>
            <small v-if="fieldPath === field.requestJsonPointer" class="field-error">{{
              field.requestJsonPointer
            }}</small>
          </label>
        </div>
        <small class="schema-source-note">
          {{ group.fields[0]?.contractStatus }} ·
          {{
            group.fields[0]?.contractStatus === "backend_descriptor" ? t("正式后端参数描述契约") : t("旧版兼容参数描述")
          }}
        </small>
      </section>
    </div>

    <div v-else class="json-editor-section">
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
        <label
          ><span
            >Fabric topology JSON
            <label class="inline-file"
              >{{ t("导入")
              }}<input
                type="file"
                accept="application/json,.json"
                @change="$emit('load-json-file', $event, 'topology')" /></label></span
          ><textarea
            v-model="topologyJson"
            spellcheck="false"
            :aria-invalid="fieldPath === '/custom_inputs/topology'"
            :placeholder="t('加载模板或粘贴 Fabric topology')"
          ></textarea>
        </label>
      </div>
    </div>
  </article>
</template>
