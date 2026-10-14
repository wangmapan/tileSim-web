<script setup>
import { ChevronRight, LoaderCircle, Play } from "@lucide/vue";
import { computed } from "vue";
import { useI18n } from "../../i18n";

const props = defineProps({
  mode: { type: String, required: true },
  form: { type: Object, required: true },
  designSpaceJson: { type: String, required: true },
  canRun: Boolean,
  submitting: Boolean,
  runStatus: { type: String, default: "" },
  requestPreview: { type: Object, required: true },
  surface: { type: Object, required: true },
  tracePackage: { type: Object, default: null },
  bridgeAvailable: { type: Boolean, default: true },
});
defineEmits(["submit", "back"]);
const { t } = useI18n();
const contractLabel = computed(() => {
  if (!props.bridgeAvailable) return t("等待本地服务");
  const value = String(props.surface.contractStatus || "");
  return (
    {
      supported: t("可执行"),
      legacy_compatibility: t("兼容模式"),
      contract_error: t("契约错误"),
    }[value] || value
  );
});
const inputLabel = computed(() => {
  if (props.mode === "controls") return t("受控参数");
  if (props.mode === "json") return t("JSON 输入");
  return props.tracePackage?.package_id || "—";
});
const designSpaceLabel = computed(() => {
  if (props.mode === "trace_package") return t("不合并");
  return props.designSpaceJson.trim() ? t("外部清单") : t("内置 S6");
});
</script>

<template>
  <aside class="run-submit-card" :aria-label="t('确认并运行')">
    <h2>{{ t("确认并运行") }}</h2>
    <dl>
      <div>
        <dt>{{ t("边界") }}</dt>
        <dd>{{ mode === "trace_package" ? `${tracePackage?.entry_boundary || "—"} → S6` : "S1 → S6" }}</dd>
      </div>
      <div>
        <dt>{{ t("输入") }}</dt>
        <dd>
          {{ inputLabel }}
        </dd>
      </div>
      <div>
        <dt>{{ t("请求 fidelity") }}</dt>
        <dd>{{ form.fidelity_policy.toUpperCase() }}</dd>
      </div>
      <div>
        <dt>{{ t("GPU 模式") }}</dt>
        <dd>GPU-FREE</dd>
      </div>
      <div>
        <dt>{{ t("设计空间") }}</dt>
        <dd>
          {{ designSpaceLabel }}
        </dd>
      </div>
      <div>
        <dt>{{ t("编排契约") }}</dt>
        <dd>{{ contractLabel }}</dd>
      </div>
    </dl>
    <details class="experiment-request-preview">
      <summary>{{ t("查看等价 JSON request") }}</summary>
      <!--
        The preview scrolls once the request carries a whole trace and topology
        (`custom_inputs`), and a scrollable region has to be reachable without a
        pointer — hence the explicit tab stop and accessible name.
      -->
      <pre v-if="requestPreview.text" tabindex="0" role="region" :aria-label="t('等价 JSON request')">{{
        requestPreview.text
      }}</pre>
      <p v-else class="request-preview-error">
        <code>{{ requestPreview.error?.fieldPath || "contract_gap" }}</code>
        {{ requestPreview.error?.message || t("请求不可提交。") }}
      </p>
    </details>
    <button class="button button--primary button--wide run-submit" :disabled="!canRun" @click="$emit('submit')">
      <LoaderCircle v-if="submitting" class="spin" :size="17" /><Play v-else :size="17" />{{
        submitting ? t("正在运行") : t("运行 TileSim 模拟")
      }}
    </button>
    <p v-if="!canRun && !runStatus && !bridgeAvailable" class="run-submit__disabled-note">
      {{ t("连接本地服务后可运行") }}
    </p>
    <p v-if="runStatus" class="run-progress">{{ runStatus }}</p>
    <button class="text-button back-link" @click="$emit('back')">
      {{ submitting ? t("返回当前报告（任务继续在后台运行）") : t("返回当前报告") }}<ChevronRight :size="14" />
    </button>
  </aside>
</template>
