<script setup lang="ts">
import type { EvidenceAgentDescriptorResponse } from "../../../contracts/bridge-api";
import { useI18n } from "../../../i18n";

defineProps<{ descriptor: EvidenceAgentDescriptorResponse }>();
const { t } = useI18n();
</script>

<template>
  <details class="panel evidence-agent-identity-disclosure">
    <summary>
      <span>
        <strong>{{ t("服务版本与模型详情") }}</strong>
        <small>{{ t("仅在排查问题或复现实验时查看。") }}</small>
      </span>
    </summary>
    <div class="evidence-agent-identity-grid">
      <div>
        <small>{{ t("Descriptor") }}</small
        ><code>{{ descriptor.schema_version }}</code>
      </div>
      <div>
        <small>{{ t("Schema revision") }}</small
        ><code>{{ descriptor.schema_set_revision }}</code>
      </div>
      <div>
        <small>{{ t("Descriptor revision") }}</small
        ><code>{{ descriptor.descriptor_revision }}</code>
      </div>
      <div>
        <small>{{ t("Provider / model") }}</small
        ><code>{{ descriptor.provider.provider_id }} / {{ descriptor.provider.model_id }}</code>
      </div>
      <div>
        <small>{{ t("Model revision") }}</small
        ><code>{{ descriptor.provider.model_revision }}</code>
      </div>
    </div>
  </details>
</template>
