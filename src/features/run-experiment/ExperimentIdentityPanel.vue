<script setup>
import { useI18n } from "../../i18n";
const form = defineModel("form", { type: Object, required: true });
defineProps({
  surface: { type: Object, required: true },
  fieldPath: { type: String, default: "" },
});
const { t } = useI18n();
</script>

<template>
  <article class="panel form-section">
    <header class="form-section-title">
      <span>01</span>
      <div>
        <h2>{{ t("实验身份") }}</h2>
        <p>{{ t("给这次运行一个易于在历史记录中识别的名称。") }}</p>
      </div>
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
          :placeholder="t('例如：FIFO · batch 1 · 同时到达')"
        />
      </label>
      <label class="field">
        <span>{{ t("受控场景") }}</span>
        <select v-model="form.scenario_id" :aria-invalid="fieldPath === '/scenario_id'">
          <option v-for="scenario in surface.scenarios" :key="scenario.value" :value="scenario.value">
            {{ scenario.label }}
          </option>
        </select>
      </label>
      <label class="field">
        <span>{{ t("请求 fidelity") }}</span>
        <select v-model="form.fidelity_policy" :aria-invalid="fieldPath === '/fidelity_policy'">
          <option v-for="fidelity in surface.fidelityPolicies" :key="fidelity" :value="fidelity">
            {{ fidelity }}
          </option>
        </select>
        <small class="field-help">{{ t("实际解析结果以验证报告为准") }}</small>
      </label>
      <label class="field">
        <span>{{ t("GPU 参与方式") }}</span>
        <select v-model="form.gpu_participation_mode" :aria-invalid="fieldPath === '/gpu_participation_mode'">
          <option v-for="gpuMode in surface.gpuParticipationModes" :key="gpuMode" :value="gpuMode">
            {{ gpuMode }}
          </option>
        </select>
        <small class="field-help">{{ t("数值输出不会驱动仿真语义；真实网络观测只进入 S8 证据通道") }}</small>
      </label>
    </div>
  </article>
</template>
