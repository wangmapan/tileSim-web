<script setup>
import { computed } from "vue";
import { useI18n } from "../../i18n";
import InlineHelp from "../../components/InlineHelp.vue";
const props = defineProps({
  capabilities: { type: Object, required: true },
  bridge: { type: Object, required: true },
  surface: { type: Object, required: true },
  manifest: { type: Object, default: null },
  compact: { type: Boolean, default: false },
});
const { t } = useI18n();
const identity = computed(() => props.bridge.identity || {});
const unavailableDependencyCount = computed(
  () =>
    [
      props.capabilities.dependencies?.gpu_hardware,
      props.capabilities.dependencies?.verilator_cycle,
      props.capabilities.dependencies?.astra_sim,
    ].filter((dependency) => !dependency?.available).length,
);

function shortRevision(value) {
  const text = String(value || t("未知"));
  return text.length > 12 ? text.slice(0, 12) : text;
}

function statusClass(value) {
  return value === true ? "available" : "unavailable";
}
</script>

<template>
  <details class="panel form-section capability-panel capability-disclosure">
    <summary class="form-section-title">
      <span>{{ t("能力") }}</span>
      <h2>{{ t("执行依赖与边界") }}</h2>
      <div class="capability-disclosure-state">
        <span :class="surface.contractStatus === 'supported' ? 'available' : 'partial'">{{
          surface.contractStatus
        }}</span>
        <span :class="statusClass(identity.execution_ready)">
          {{ identity.execution_ready ? t("执行就绪") : t("禁止执行") }}
        </span>
        <small v-if="unavailableDependencyCount">
          {{ t("{count} 项扩展能力不可用", { count: unavailableDependencyCount }) }}
        </small>
      </div>
    </summary>
    <div class="capability-disclosure-body">
      <div class="capability-grid">
        <section>
          <strong>{{ t("GPU 硬件") }}</strong>
          <span :class="capabilities.dependencies?.gpu_hardware?.available ? 'available' : 'unavailable'">
            {{ capabilities.dependencies?.gpu_hardware?.available ? t("可用") : t("不可用") }}
          </span>
          <small>{{ capabilities.dependencies?.gpu_hardware?.reason || t("尚未发现") }}</small>
        </section>
        <section>
          <strong>{{ t("Hotspot Cycle") }}<InlineHelp :text="t('仅覆盖信用链路热点，不代表全栈 Cycle。')" /></strong>
          <span :class="capabilities.dependencies?.verilator_cycle?.available ? 'available' : 'unavailable'">
            {{ capabilities.dependencies?.verilator_cycle?.available ? t("RTL 已构建") : t("未构建") }}
          </span>
          <small>{{
            capabilities.dependencies?.verilator_cycle?.version ||
            capabilities.dependencies?.verilator_cycle?.reason ||
            t("尚未发现")
          }}</small>
        </section>
        <section>
          <strong>{{ t("ASTRA 外部后端") }}</strong>
          <span :class="capabilities.dependencies?.astra_sim?.available ? 'available' : 'unavailable'">
            {{ capabilities.dependencies?.astra_sim?.available ? t("可用") : t("不可用") }}
          </span>
          <small>{{ capabilities.dependencies?.astra_sim?.reason || t("未配置真实 executable/Chakra root") }}</small>
        </section>
      </div>
      <section class="experiment-schema-panel">
        <header>
          <strong>{{ t("实验编排契约") }}</strong>
          <span :class="surface.contractStatus === 'supported' ? 'available' : 'partial'">{{
            surface.contractStatus
          }}</span>
        </header>
        <dl class="experiment-schema-grid">
          <div>
            <dt>schema_set_revision</dt>
            <dd>{{ manifest?.schema_set_revision || t("缺失") }}</dd>
          </div>
          <div>
            <dt>request_schema</dt>
            <dd>{{ surface.schemaId }}</dd>
          </div>
          <div>
            <dt>descriptor_id</dt>
            <dd>{{ surface.descriptorId }}</dd>
          </div>
          <div>
            <dt>descriptor_revision</dt>
            <dd>{{ surface.descriptorRevision }}</dd>
          </div>
          <div>
            <dt>input_modes</dt>
            <dd>{{ surface.inputModes.join(" · ") || t("缺失") }}</dd>
          </div>
          <div>
            <dt>design_space_modes</dt>
            <dd>{{ surface.designSpaceModes.join(" · ") || t("缺失") }}</dd>
          </div>
        </dl>
        <div v-if="surface.contractGaps.length" class="experiment-contract-gaps">
          <strong>{{ surface.contractStatus === "contract_error" ? t("契约错误，提交已关闭") : t("兼容降级") }}</strong>
          <code v-for="gap in surface.contractGaps" :key="gap">{{ gap }}</code>
        </div>
        <div class="experiment-contract-gaps">
          <strong>{{ t("参数覆盖") }}</strong>
          <code v-for="item in surface.coverage" :key="item.subsystem">
            {{ item.subsystem }}={{ item.status }}<template v-if="item.reason"> · {{ item.reason }}</template>
          </code>
        </div>
        <div class="experiment-contract-gaps">
          <strong>
            {{ t("请求 fidelity 可用性") }}
            <InlineHelp :text="t('resolved fidelity 仅从运行后的 execution envelope 与 validation 读取。')" />
          </strong>
          <code v-for="option in surface.fidelityOptions" :key="option.value">
            {{ option.value }}={{ option.available ? "available" : "unavailable"
            }}<template v-if="option.reason"> · {{ option.reason }}</template>
          </code>
        </div>
        <div class="experiment-contract-gaps">
          <strong>{{ t("输入来源与允许声明") }}</strong>
          <code v-for="option in surface.sourceModeOptions" :key="option.value">
            {{ option.value }}={{ option.available ? "available" : "unavailable" }} · {{ option.claimScope
            }}<template v-if="option.reason"> · {{ option.reason }}</template>
          </code>
        </div>
      </section>

      <section class="backend-identity-panel">
        <header>
          <strong>{{ t("本地后端部署身份") }}</strong>
          <span :class="statusClass(identity.execution_ready)">
            {{ identity.execution_ready ? t("执行就绪") : t("禁止执行") }}
          </span>
        </header>
        <dl class="backend-identity-grid">
          <div>
            <dt>{{ t("部署方式") }}</dt>
            <dd>
              {{ identity.deployment_mode || t("未托管") }}
              <small>{{ identity.deployment_ref || identity.backend_branch || t("未知") }}</small>
            </dd>
          </div>
          <div>
            <dt>{{ t("后端分支") }}</dt>
            <dd>
              {{ identity.backend_branch || t("未知") }}
              <small>{{ identity.deployed_at || t("时间未知") }}</small>
            </dd>
          </div>
          <div>
            <dt>{{ t("源码版本") }}</dt>
            <dd :title="identity.source_revision">
              {{ shortRevision(identity.source_revision) }}
              <small :title="identity.source_state_digest">
                state {{ shortRevision(identity.source_state_digest) }}
              </small>
            </dd>
          </div>
          <div>
            <dt>{{ t("CLI 构建版本") }}</dt>
            <dd :title="identity.build_revision">
              {{ shortRevision(identity.build_revision) }}
              <small :title="identity.build_state_digest">
                state {{ shortRevision(identity.build_state_digest) }}
              </small>
            </dd>
          </div>
          <div>
            <dt>{{ t("版本一致性") }}<InlineHelp :text="t('源码 revision 与 CLI build revision 必须一致。')" /></dt>
            <dd>
              <span :class="statusClass(identity.versions_match)">{{
                identity.versions_match ? t("一致") : t("不一致")
              }}</span>
            </dd>
          </div>
          <div>
            <dt>{{ t("工作树摘要") }}<InlineHelp :text="t('源码变化后会关闭执行。')" /></dt>
            <dd>
              <span :class="statusClass(identity.state_digests_match)">{{
                identity.state_digests_match ? t("一致") : t("不一致")
              }}</span>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </details>
</template>
