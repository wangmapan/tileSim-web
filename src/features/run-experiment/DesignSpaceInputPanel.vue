<script setup>
import { RotateCcw } from "@lucide/vue";
import { computed } from "vue";
import { useI18n } from "../../i18n";

const designSpaceJson = defineModel({ type: String, required: true });
defineProps({ fieldPath: { type: String, default: "" } });
defineEmits(["load-json-file"]);
const { t } = useI18n();

const manifestSummary = computed(() => {
  if (!designSpaceJson.value.trim()) return { mode: "built_in", candidateCount: 3, transferCount: null, error: "" };
  try {
    const manifest = JSON.parse(designSpaceJson.value);
    const candidates = Array.isArray(manifest?.candidates) ? manifest.candidates : [];
    const transferCount = candidates.reduce((total, candidate) => {
      const count = candidate && Number.isInteger(candidate.request_count) ? candidate.request_count : 0;
      return total + count;
    }, 0);
    return { mode: "manifest", candidateCount: candidates.length, transferCount, error: "" };
  } catch (error) {
    return { mode: "invalid", candidateCount: 0, transferCount: 0, error: error.message };
  }
});
</script>

<template>
  <details class="panel form-section design-space-disclosure" :open="Boolean(designSpaceJson)">
    <summary class="form-section-title">
      <span>03</span>
      <div>
        <h2>{{ t("S6 设计空间候选") }}</h2>
        <p>{{ t("默认使用内置候选；仅在需要自定义 S6 manifest 时展开。") }}</p>
      </div>
      <div class="design-space-disclosure-state">
        <strong>{{ manifestSummary.mode === "built_in" ? t("内置合成候选集") : t("自定义候选 manifest") }}</strong>
        <small>{{ manifestSummary.candidateCount }} / 256 {{ t("候选") }}</small>
      </div>
    </summary>
    <div class="json-editor-section design-space-input">
      <div class="json-toolbar">
        <button v-if="designSpaceJson" class="text-button" @click="designSpaceJson = ''">
          <RotateCcw :size="14" />{{ t("恢复内置候选集") }}
        </button>
        <label class="button button--ghost"
          >{{ t("导入 candidate manifest")
          }}<input
            type="file"
            accept="application/json,.json"
            @change="$emit('load-json-file', $event, 'design-space')"
        /></label>
      </div>
      <textarea
        v-model="designSpaceJson"
        spellcheck="false"
        :aria-invalid="fieldPath === '/design_space_candidates'"
        :placeholder="t('可选：tilesim.design_space.s6_candidates.v1')"
      ></textarea>
      <div class="design-manifest-summary" aria-live="polite">
        <div>
          <strong>{{ manifestSummary.mode === "built_in" ? t("内置合成候选集") : t("自定义候选 manifest") }}</strong>
          <small v-if="manifestSummary.mode === 'built_in'">
            {{ t("留空时由后端执行内置的 3 个 S6 候选。") }}
          </small>
          <small v-else-if="manifestSummary.error">{{
            t("JSON 尚不可解析：{message}", { message: manifestSummary.error })
          }}</small>
          <small v-else>tilesim.design_space.s6_candidates.v1</small>
        </div>
        <span :class="{ invalid: manifestSummary.candidateCount < 1 || manifestSummary.candidateCount > 256 }">
          {{ manifestSummary.candidateCount }} / 256 {{ t("候选") }}
        </span>
        <span
          v-if="manifestSummary.transferCount !== null"
          :class="{ invalid: manifestSummary.transferCount < 1 || manifestSummary.transferCount > 100000 }"
        >
          {{ manifestSummary.transferCount.toLocaleString() }} / 100,000 transfers
        </span>
      </div>
      <p class="field-help">
        {{
          t(
            "仅支持 S6 bandwidth、latency、oversubscription、request/message 和 release interval；S1/S3/S4/S5 变量保持 unresolved_not_executed。",
          )
        }}
      </p>
      <p class="field-help">
        {{ t("前端预算提示用于尽早发现问题；字段、范围、去重和最终执行预算仍由 Bridge 与 TileSimCLI 失败关闭校验。") }}
      </p>
    </div>
  </details>
</template>
