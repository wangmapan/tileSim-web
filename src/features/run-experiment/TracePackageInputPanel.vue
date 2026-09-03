<script setup lang="ts">
import { computed } from "vue";
import { PackageSearch, RefreshCw, ShieldCheck, TriangleAlert } from "@lucide/vue";
import type { TracePackageCatalogResponse } from "../../lib/api";
import { useI18n } from "../../i18n";

const props = defineProps<{
  catalog: TracePackageCatalogResponse | null;
  status: "idle" | "loading" | "success" | "error";
  error: string;
  selectedPackageId: string;
  inspecting: boolean;
  inspectError: string;
  fieldPath: string;
}>();
const emit = defineEmits<{
  select: [packageId: string];
  inspect: [];
  refresh: [];
}>();
const { t } = useI18n();

const selectedPackage = computed(
  () => props.catalog?.packages.find((item) => item.package_id === props.selectedPackageId) ?? null,
);
</script>

<template>
  <article class="panel form-section trace-package-panel">
    <header class="form-section-title">
      <span><PackageSearch :size="18" /></span>
      <div>
        <h2>{{ t("Trace package") }}</h2>
        <p>{{ t("从 Bridge 受控目录选择已经过 TileSimCLI 检查的语义 Trace 包。") }}</p>
      </div>
      <button class="text-button" :disabled="status === 'loading'" @click="emit('refresh')">
        <RefreshCw :size="14" :class="{ spin: status === 'loading' }" />{{ t("刷新目录") }}
      </button>
    </header>

    <div v-if="status === 'loading'" class="trace-package-state" role="status">
      {{ t("正在发现和检查 Trace package…") }}
    </div>
    <div v-else-if="status === 'error'" class="service-warning">
      <TriangleAlert :size="18" />
      <div>
        <strong>{{ t("Trace package catalog 加载失败") }}</strong>
        <p>{{ error }}</p>
      </div>
    </div>
    <div v-else-if="catalog && !catalog.capability.available" class="service-warning">
      <TriangleAlert :size="18" />
      <div>
        <strong>{{ t("Trace package 能力不可用") }}</strong>
        <p>
          <code>{{ catalog.capability.reason }}</code>
        </p>
      </div>
    </div>
    <div v-else-if="catalog && catalog.packages.length === 0" class="trace-package-state">
      <strong>{{ t("受控目录中没有可发现的 Trace package") }}</strong>
      <small v-if="catalog.discovery_errors.length">
        {{ catalog.discovery_errors.map((item) => item.code).join(" · ") }}
      </small>
    </div>
    <template v-else-if="catalog">
      <div class="trace-package-list" role="list" :aria-invalid="fieldPath === '/trace_package_id'">
        <button
          v-for="item in catalog.packages"
          :key="item.package_id"
          type="button"
          role="listitem"
          :class="{ selected: item.package_id === selectedPackageId }"
          @click="emit('select', item.package_id)"
        >
          <span>
            <strong>{{ item.package_id }}</strong>
            <small>{{ item.producer?.name || t("身份不可用") }} · {{ item.producer?.version || "—" }}</small>
          </span>
          <span :class="item.submission_available ? 'available' : 'unavailable'">
            {{ item.submission_available ? t("可提交") : t("不可提交") }}
          </span>
        </button>
      </div>

      <section v-if="selectedPackage" class="trace-package-detail">
        <header>
          <div>
            <strong>{{ selectedPackage.package_id }}</strong>
            <small>{{ selectedPackage.inspect_status }}</small>
          </div>
          <button class="button button--secondary" :disabled="inspecting" @click="emit('inspect')">
            <RefreshCw :size="14" :class="{ spin: inspecting }" />{{ t("重新检查") }}
          </button>
        </header>
        <dl class="experiment-schema-grid">
          <div>
            <dt>producer</dt>
            <dd>{{ selectedPackage.producer?.name || "—" }} / {{ selectedPackage.producer?.version || "—" }}</dd>
          </div>
          <div>
            <dt>experiment_id</dt>
            <dd>{{ selectedPackage.experiment_id || "—" }}</dd>
          </div>
          <div>
            <dt>physical_run_id</dt>
            <dd>{{ selectedPackage.physical_run_id || "—" }}</dd>
          </div>
          <div>
            <dt>boundary</dt>
            <dd>{{ selectedPackage.entry_boundary || "—" }}</dd>
          </div>
          <div>
            <dt>trace kind</dt>
            <dd>{{ selectedPackage.entry_trace_kind || "—" }}</dd>
          </div>
          <div>
            <dt>source mode</dt>
            <dd>{{ selectedPackage.trace_provenance?.source_mode || "—" }}</dd>
          </div>
          <div>
            <dt>calibration level</dt>
            <dd>{{ selectedPackage.trace_provenance?.calibration_level || "—" }}</dd>
          </div>
          <div>
            <dt>allowed claim scope</dt>
            <dd>{{ selectedPackage.trace_provenance?.allowed_claim_scope || "—" }}</dd>
          </div>
          <div>
            <dt>manifest SHA-256</dt>
            <dd>{{ selectedPackage.manifest_sha256 }}</dd>
          </div>
        </dl>
        <div class="trace-package-integrity">
          <ShieldCheck v-if="selectedPackage.artifact_integrity.complete" :size="17" />
          <TriangleAlert v-else :size="17" />
          <p>
            <strong
              >{{ t("Artifact 完整性") }} ·
              {{ selectedPackage.artifact_integrity.complete ? t("完整") : t("失败") }}</strong
            >
            <small>
              {{ selectedPackage.artifact_integrity.semantic_artifact_count }}/6 · SHA-256={{
                selectedPackage.artifact_integrity.sha256_verified
              }}
              · entry={{ selectedPackage.artifact_integrity.entry_trace_verified }}
            </small>
          </p>
        </div>
        <p v-if="!selectedPackage.submission_available" class="field-error">
          {{ selectedPackage.unavailable_reason }}；{{ t("首版仅开放 synthetic_trace，不构成校准或留出验证证据。") }}
        </p>
        <p v-for="item in selectedPackage.inspect_errors" :key="item.code" class="field-error">
          <code>{{ item.code }}</code> {{ item.message }}
        </p>
        <p v-if="inspectError" class="field-error">{{ inspectError }}</p>
        <p v-if="fieldPath === '/trace_package_id'" class="field-error">/trace_package_id</p>
      </section>
    </template>
  </article>
</template>
