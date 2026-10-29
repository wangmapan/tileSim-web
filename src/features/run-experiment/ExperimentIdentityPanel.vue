<script setup>
import { useI18n } from "../../i18n";
import InlineHelp from "../../components/InlineHelp.vue";
const form = defineModel("form", { type: Object, required: true });
const props = defineProps({
  surface: { type: Object, required: true },
  fieldPath: { type: String, default: "" },
  compact: { type: Boolean, default: false },
});
const { t } = useI18n();
</script>

<template>
  <article class="panel form-section experiment-identity-panel">
    <header class="form-section-title">
      <span>01</span>
      <h2>{{ t("实验身份") }}</h2>
    </header>
    <div class="form-grid form-grid--identity">
      <label class="field field--wide">
        <span
          >{{ t("实验名称") }} <small>{{ t("可选") }}</small></span
        >
        <input
          v-model="form.run_name"
          maxlength="80"
          :aria-invalid="fieldPath === '/run_name'"
          :placeholder="props.compact ? undefined : t('例如：FIFO · batch 1 · 同时到达')"
        />
      </label>
      <label class="field">
        <span
          >{{ t("受控场景")
          }}<InlineHelp
            v-if="form.scenario_id === 'dense_des_package'"
            :text="t('此拓扑仅用于经验证的 Trace package；逐请求归因还需要 dense DES、设备和网络证据。')"
        /></span>
        <select v-model="form.scenario_id" :aria-invalid="fieldPath === '/scenario_id'">
          <option v-for="scenario in surface.scenarios" :key="scenario.value" :value="scenario.value">
            {{ t(scenario.label) }}
          </option>
        </select>
      </label>
      <label class="field">
        <span
          >{{ t("请求 fidelity")
          }}<InlineHelp v-if="!props.compact" :text="t('以运行后的验证报告为准')" :label="t('查看 fidelity 说明')"
        /></span>
        <select v-model="form.fidelity_policy" :aria-invalid="fieldPath === '/fidelity_policy'">
          <option v-for="fidelity in surface.fidelityPolicies" :key="fidelity" :value="fidelity">
            {{ fidelity }}
          </option>
        </select>
      </label>
      <label class="field">
        <span
          >{{ t("GPU 参与方式")
          }}<InlineHelp v-if="!props.compact" :text="t('真实网络观测仅作为证据')" :label="t('查看 GPU 参与说明')"
        /></span>
        <select v-model="form.gpu_participation_mode" :aria-invalid="fieldPath === '/gpu_participation_mode'">
          <option v-for="gpuMode in surface.gpuParticipationModes" :key="gpuMode" :value="gpuMode">
            {{ gpuMode }}
          </option>
        </select>
      </label>
    </div>
  </article>
</template>
