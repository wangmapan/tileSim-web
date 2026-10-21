<script setup>
import { RotateCcw } from "@lucide/vue";
import { computed } from "vue";
import { useI18n } from "../../i18n";
import InlineHelp from "../../components/InlineHelp.vue";

const designSpaceJson = defineModel({ type: String, required: true });
const props = defineProps({ fieldPath: { type: String, default: "" } });
defineEmits(["load-json-file"]);
const { t } = useI18n();
const hasDesignSpaceError = computed(
  () => props.fieldPath === "/design_space_candidates" || props.fieldPath.startsWith("/design_space_candidates/"),
);

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
        <h2>{{ t("设计空间候选") }}</h2>
        <InlineHelp
          :text="t('可选。需要自定义候选时再展开；仅支持网络与通信参数，最终范围与执行预算由 Bridge 校验。')"
          :interactive="false"
        />
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
        :aria-invalid="hasDesignSpaceError"
        :placeholder="t('可选：tilesim.design_space.candidates.v1 或 v2')"
      ></textarea>
      <div class="design-manifest-summary" aria-live="polite">
        <div>
          <strong>{{ manifestSummary.mode === "built_in" ? t("内置合成候选集") : t("自定义候选 manifest") }}</strong>
          <small v-if="manifestSummary.mode === 'built_in'">
            {{ t("留空使用内置候选。") }}
          </small>
          <small v-else-if="manifestSummary.error">{{
            t("JSON 尚不可解析：{message}", { message: manifestSummary.error })
          }}</small>
          <small v-else>tilesim.design_space.candidates.v1</small>
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
    </div>
  </details>
</template>
