<script setup>
import { CheckCircle2, ChevronRight, LoaderCircle, Play } from "@lucide/vue";
import { useI18n } from "../../i18n";

defineProps({
  mode: { type: String, required: true },
  form: { type: Object, required: true },
  designSpaceJson: { type: String, required: true },
  canRun: Boolean,
  submitting: Boolean,
  runStatus: { type: String, default: "" },
  requestPreview: { type: Object, required: true },
  surface: { type: Object, required: true },
  tracePackage: { type: Object, default: null },
});
defineEmits(["submit", "back"]);
const { t } = useI18n();
</script>

<template>
  <aside class="run-submit-card">
    <p class="section-kicker">RUN EXPERIMENT</p>
    <h2>{{ t("确认并运行") }}</h2>
    <dl>
      <div>
        <dt>{{ t("边界") }}</dt>
        <dd>{{ mode === "trace_package" ? `${tracePackage?.entry_boundary || "—"} → S6` : "S1 → S6" }}</dd>
      </div>
      <div>
        <dt>{{ t("宿主") }}</dt>
        <dd>S7 hosted</dd>
      </div>
      <div>
        <dt>{{ t("输入") }}</dt>
        <dd>
          {{ mode === "controls" ? t("受控参数") : mode === "json" ? "JSON pair" : tracePackage?.package_id || "—" }}
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
          {{ mode === "trace_package" ? "NOT COMBINED" : designSpaceJson.trim() ? "EXTERNAL MANIFEST" : "BUILT-IN S6" }}
        </dd>
      </div>
      <div>
        <dt>{{ t("编排契约") }}</dt>
        <dd>{{ surface.contractStatus }}</dd>
      </div>
    </dl>
    <details class="experiment-request-preview">
      <summary>{{ t("查看等价 JSON request") }}</summary>
      <pre v-if="requestPreview.text">{{ requestPreview.text }}</pre>
      <p v-else class="request-preview-error">
        <code>{{ requestPreview.error?.fieldPath || "contract_gap" }}</code>
        {{ requestPreview.error?.message || t("请求不可提交。") }}
      </p>
    </details>
    <div class="run-scope-note">
      <CheckCircle2 :size="16" />
      <p>{{ t("产物只写入") }} <code>tileSim-web/runs</code>{{ t("，不会修改核心仓库。") }}</p>
    </div>
    <button class="button button--primary button--wide run-submit" :disabled="!canRun" @click="$emit('submit')">
      <LoaderCircle v-if="submitting" class="spin" :size="17" /><Play v-else :size="17" />{{
        submitting ? t("正在运行") : t("运行 TileSim 模拟")
      }}
    </button>
    <p v-if="runStatus" class="run-progress">{{ runStatus }}</p>
    <button class="text-button back-link" @click="$emit('back')">
      {{ submitting ? t("返回当前报告（任务继续在后台运行）") : t("返回当前报告") }}<ChevronRight :size="14" />
    </button>
  </aside>
</template>
