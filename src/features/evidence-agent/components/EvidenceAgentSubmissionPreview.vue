<script setup lang="ts">
import { Clock3, FileCheck2, ShieldCheck } from "@lucide/vue";
import { computed } from "vue";
import { useI18n } from "../../../i18n";

const props = defineProps<{
  requestId: string | null;
  citationLocationCount: number;
  citationArtifactCount: number;
  sourceMode: string;
  calibrationLevel: string;
  allowedClaimScope: string;
  requestedFidelity: string;
  resolvedFidelity: string;
  executionMode: string;
  timeoutMs: number;
}>();
const { isEnglish, t } = useI18n();

const trustSummary = computed(() => {
  if (props.sourceMode === "real_trace") {
    return isEnglish.value
      ? "Captured real-world data, bounded by the declared calibration and allowed claim scope."
      : "真实采集数据；结论仍受声明的校准等级和可用范围约束。";
  }
  if (props.sourceMode === "synthetic_trace") {
    return isEnglish.value
      ? "Synthetic evidence only; it does not become held-out validation or real-hardware fidelity."
      : "仅为合成证据；不能升级为真实留出验证或真实硬件 fidelity。";
  }
  if (props.sourceMode === "compatibility_harness_trace") {
    return isEnglish.value
      ? "Compatibility-harness evidence only; it is not a real-trace fidelity source."
      : "仅为兼容性辅助证据；不是 real trace fidelity 来源。";
  }
  return isEnglish.value ? "The evidence scope is not ready." : "证据可信范围尚未就绪。";
});
const evidenceSummary = computed(() =>
  isEnglish.value
    ? `${props.citationLocationCount} exact citation locations across ${props.citationArtifactCount} artifacts`
    : `${props.citationLocationCount} 个精确引用位置，来自 ${props.citationArtifactCount} 份 artifact`,
);
const waitSummary = computed(() => {
  const seconds = Math.ceil(props.timeoutMs / 1000);
  return isEnglish.value
    ? `Synchronous wait, service limit ${seconds} seconds; no automatic background retry.`
    : `同步等待，服务上限 ${seconds} 秒；不会自动后台重试。`;
});
</script>

<template>
  <section
    class="evidence-agent-submission-preview"
    :aria-label="isEnglish ? 'Review before submitting' : '提交前确认'"
  >
    <header>
      <strong>{{ isEnglish ? "Review before submitting" : "提交前确认" }}</strong>
      <small>{{
        isEnglish ? "The following boundary is frozen for this request." : "以下边界将绑定到本次请求。"
      }}</small>
    </header>
    <dl>
      <div>
        <dt>{{ t("当前请求") }}</dt>
        <dd>
          <code>{{ requestId || "request_not_selected" }}</code>
        </dd>
      </div>
      <div>
        <dt><FileCheck2 :size="15" />{{ isEnglish ? "Citable evidence" : "可引用证据" }}</dt>
        <dd>{{ evidenceSummary }}</dd>
      </div>
      <div>
        <dt><ShieldCheck :size="15" />{{ isEnglish ? "Evidence scope" : "数据可信范围" }}</dt>
        <dd>{{ trustSummary }}</dd>
      </div>
      <div>
        <dt><Clock3 :size="15" />{{ isEnglish ? "Expected wait" : "等待预期" }}</dt>
        <dd>{{ waitSummary }}</dd>
      </div>
    </dl>
    <details>
      <summary>{{ t("专业详情") }}</summary>
      <dl class="evidence-agent-preview-contract">
        <div>
          <dt>source_mode</dt>
          <dd>
            <code>{{ sourceMode }}</code>
          </dd>
        </div>
        <div>
          <dt>calibration_level</dt>
          <dd>
            <code>{{ calibrationLevel }}</code>
          </dd>
        </div>
        <div>
          <dt>allowed_claim_scope</dt>
          <dd>
            <code>{{ allowedClaimScope }}</code>
          </dd>
        </div>
        <div>
          <dt>requested_fidelity</dt>
          <dd>
            <code>{{ requestedFidelity }}</code>
          </dd>
        </div>
        <div>
          <dt>resolved_fidelity</dt>
          <dd>
            <code>{{ resolvedFidelity }}</code>
          </dd>
        </div>
        <div>
          <dt>execution_mode</dt>
          <dd>
            <code>{{ executionMode }}</code>
          </dd>
        </div>
        <div>
          <dt>timeout_ms</dt>
          <dd>
            <code>{{ timeoutMs }}</code>
          </dd>
        </div>
      </dl>
    </details>
  </section>
</template>
