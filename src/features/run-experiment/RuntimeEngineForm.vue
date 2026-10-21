<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "../../i18n";
import InlineHelp from "../../components/InlineHelp.vue";
import {
  dynamicEngineIssue,
  engineModeOf,
  RUN_ENGINE_PROFILES,
  type RunEngine,
  type RunEngineMode,
} from "./runtime-engine";
import { parseJsonDocument, patchJsonDocument, type JsonObject } from "./structured-input";

const props = defineProps<{ modelValue: string; fieldPath?: string }>();
const emit = defineEmits<{ (event: "update:modelValue", value: string): void }>();
const { t } = useI18n();
const error = ref("");
const parsed = computed(() => parseJsonDocument(props.modelValue, "Runtime trace"));
const documentValue = computed(() => (parsed.value.ok ? parsed.value.value : null));
const mode = computed(() => (documentValue.value ? engineModeOf(documentValue.value) : "generic"));
const dynamicIssue = computed(() =>
  mode.value === "dynamic" && documentValue.value ? dynamicEngineIssue(documentValue.value) : null,
);
const engine = computed(() => documentValue.value?.engine_type as RunEngine | undefined);
const selectedEngine = ref<RunEngine>("vllm");
const availableFeatures = computed<readonly string[]>(() =>
  engine.value && engine.value in RUN_ENGINE_PROFILES ? RUN_ENGINE_PROFILES[engine.value].features : [],
);

function chooseMode(next: RunEngineMode) {
  if (!documentValue.value) return;
  const rows = Array.isArray(documentValue.value.requests) ? (documentValue.value.requests as JsonObject[]) : [];
  const allDynamic = rows.length > 0 && rows.every((row) => row.phase === "request");
  const allReplay =
    rows.length > 0 &&
    rows.every((row) => row.phase === undefined || row.phase === "prefill" || row.phase === "decode");
  if ((next === "dynamic" && !allDynamic) || (next !== "dynamic" && !allReplay)) {
    error.value = t(
      next === "dynamic"
        ? "先在请求表逐条显式设为 request；不会把已观测 prefill/decode 回放静默改成动态请求。"
        : "先显式编辑所有请求阶段；不会把动态请求改写成已观测回放。",
    );
    return;
  }
  const updated = patchJsonDocument(props.modelValue, "Runtime trace", (draft) => {
    if (next === "generic") {
      delete draft.engine_type;
      delete draft.engine_semantic_version;
      delete draft.requested_features;
    } else {
      const chosen = engine.value && engine.value in RUN_ENGINE_PROFILES ? engine.value : selectedEngine.value;
      draft.engine_type = chosen;
      draft.engine_semantic_version = RUN_ENGINE_PROFILES[chosen].version;
      if (!Array.isArray(draft.requested_features)) draft.requested_features = [];
    }
  });
  // Keep the explicit engine selection as a draft, but derive any input error
  // from the current document so correcting a field clears its old message.
  error.value = "";
  emit("update:modelValue", updated);
}

function chooseEngine(event: Event) {
  selectedEngine.value = (event.target as HTMLSelectElement).value as RunEngine;
  if (mode.value !== "generic") {
    emit(
      "update:modelValue",
      patchJsonDocument(props.modelValue, "Runtime trace", (draft) => {
        draft.engine_type = selectedEngine.value;
        draft.engine_semantic_version = RUN_ENGINE_PROFILES[selectedEngine.value].version;
        draft.requested_features = [];
      }),
    );
  }
}

function toggleFeature(feature: string, checked: boolean) {
  emit(
    "update:modelValue",
    patchJsonDocument(props.modelValue, "Runtime trace", (draft) => {
      const current = Array.isArray(draft.requested_features) ? (draft.requested_features as string[]) : [];
      draft.requested_features = checked
        ? [...new Set([...current, feature])]
        : current.filter((item) => item !== feature);
    }),
  );
}
</script>

<template>
  <section class="structured-block" :aria-label="t('推理引擎语义模型')">
    <header class="structured-block__header">
      <strong>{{ t("推理引擎语义模型") }}</strong>
      <InlineHelp
        :text="
          t(
            '这是仿真中的版本化运行时语义，不会启动真实推理服务。DES 是独立请求保真度，实际 resolved fidelity 以运行结果为准。',
          )
        "
      />
    </header>
    <p v-if="!parsed.ok" role="alert">{{ parsed.error }}</p>
    <template v-else>
      <label
        ><span
          >{{ t("运行语义")
          }}<InlineHelp
            :text="
              mode === 'generic'
                ? t('batch_scheduler 控制通用运行时；缺省为 decode_priority。')
                : mode === 'dynamic'
                  ? t(
                      '由所选画像调度；policy.batch_scheduler 不覆盖画像。先填写正数容量、请求 token、足额 KV 与 TP/参与设备。',
                    )
                  : t('回放按观测记录顺序，不会重新执行引擎调度；请勿将合成记录标作真实观测。')
            "
        /></span>
        <select
          data-engine-mode
          :value="mode"
          @change="chooseMode(($event.target as HTMLSelectElement).value as RunEngineMode)"
        >
          <option value="generic">{{ t("通用运行时（旧默认）") }}</option>
          <option value="dynamic">{{ t("版本化引擎动态请求") }}</option>
          <option value="replay">{{ t("已观测阶段回放（保留顺序）") }}</option>
        </select>
      </label>
      <label
        ><span
          >{{ t("引擎画像")
          }}<InlineHelp :text="t('vllm.0.6.tilesim_pd.v1 未开放：缺少完整放置、handoff 与 dense host 前置。')"
        /></span>
        <select data-engine-profile :value="mode === 'generic' ? selectedEngine : engine" @change="chooseEngine">
          <option v-for="(profile, key) in RUN_ENGINE_PROFILES" :key="key" :value="key">
            {{ key }} · {{ profile.version }}
          </option>
        </select>
      </label>
      <template v-if="mode !== 'generic'">
        <label v-for="feature in availableFeatures" :key="feature">
          <input
            type="checkbox"
            :checked="(documentValue?.requested_features as string[] | undefined)?.includes(feature)"
            @change="toggleFeature(feature, ($event.target as HTMLInputElement).checked)"
          />
          {{ feature }}
        </label>
      </template>
      <p v-if="error || dynamicIssue || fieldPath?.startsWith('/custom_inputs/runtime_trace/engine_')" role="alert">
        {{ error || (dynamicIssue ? `${dynamicIssue.path}: ${dynamicIssue.message}` : fieldPath) }}
      </p>
    </template>
  </section>
</template>
