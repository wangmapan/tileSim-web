<script setup lang="ts">
import { AlertTriangle } from "@lucide/vue";
import { computed } from "vue";
import JsonArtifactPanel from "../components/JsonArtifactPanel.vue";
import { unsupportedSchemaReports } from "../lib/reports";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";

const { state } = useDashboard();
const { t } = useI18n();
const reports = computed(() => unsupportedSchemaReports(state.bundle));
const rejected = computed(
  () => state.artifactManifest?.rejected_artifacts.filter((item) => item.reason === "unsupported_schema") || [],
);
const hasInvalidSchema = computed(() => reports.value.some((item) => item.status === "invalid_schema"));
</script>

<template>
  <div class="view-stack">
    <section class="gap-panel unsupported-schema-notice" role="alert" data-help-anchor="unsupported_schema-notice">
      <header>
        <AlertTriangle :size="19" />
        <div>
          <strong>{{ hasInvalidSchema ? t("报告未通过兼容 schema 校验") : t("结构化视图尚未适配该报告版本") }}</strong>
          <p>
            {{
              t(
                "报告原始字段保持完整。更新 schema 或 versioned adapter 前，不会把未知结构显示为空页面或套用旧字段解释。",
              )
            }}
          </p>
        </div>
      </header>
      <ul data-help-anchor="unsupported_schema-identities">
        <li v-for="item in reports" :key="item.kind">
          <code>{{ item.kind }}</code
          >：<code>{{ item.schema || "legacy_unversioned" }}</code>
          <small v-if="item.issues.length">{{ item.issues.join("；") }}</small>
        </li>
        <li v-for="item in rejected" :key="item.artifact_id">
          <code>{{ item.artifact_id }}</code
          >：<code>{{ item.schema_identity || "unknown" }}</code>
          <small>{{ item.reason }} · {{ item.json_pointer || "/" }}</small>
        </li>
      </ul>
      <p v-if="rejected.length && !reports.length">
        {{ t("Bridge 已拒绝不受支持的 artifact；前端不会下载或套用旧 Schema。") }}
      </p>
    </section>
    <div v-if="reports.length" data-help-anchor="unsupported_schema-raw">
      <JsonArtifactPanel />
    </div>
    <p class="scope-callout" data-help-anchor="unsupported_schema-next">
      {{ t("下一步可以打开其他已支持的运行，或等待对应版本适配。") }}
    </p>
  </div>
</template>
