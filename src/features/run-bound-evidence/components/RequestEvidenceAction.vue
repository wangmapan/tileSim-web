<script setup lang="ts">
import { ScanSearch } from "@lucide/vue";
import { useRouter } from "vue-router";
import { useI18n } from "../../../i18n";

const props = defineProps<{ runId: string | null; requestId: string }>();
const emit = defineEmits<{ requestSelected: [requestId: string] }>();
const router = useRouter();
const { t } = useI18n();

function selectRequest() {
  if (!props.runId) return;
  emit("requestSelected", props.requestId);
  void router.push({
    name: "attribution",
    query: { run: props.runId, evidence_request: props.requestId },
  });
}
</script>

<template>
  <button
    v-if="runId"
    class="request-evidence-action"
    type="button"
    :aria-label="t('联动请求 {requestId}', { requestId })"
    @click="selectRequest"
  >
    <ScanSearch :size="13" />{{ t("查看证据链") }}
  </button>
</template>
