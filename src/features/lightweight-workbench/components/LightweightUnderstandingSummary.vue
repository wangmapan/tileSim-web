<script setup lang="ts">
import { computed } from "vue";
import type { LightweightAgentViewModel } from "../model";
const props = defineProps<{ result: LightweightAgentViewModel | null }>();

const statusCopy: Record<LightweightAgentViewModel["status"], { label: string; detail: string }> = {
  idle: { label: "尚未处理", detail: "输入一句话后，Agent 会先说明它理解了什么。" },
  draft: { label: "草案", detail: "这是草案，尚未创建运行。" },
  clarification_required: { label: "需要澄清", detail: "信息不足，暂不生成可执行草案。" },
  unknown: { label: "未知字段", detail: "无法确认该字段属于当前公开能力目录。" },
  unsupported: { label: "暂不支持", detail: "这项能力未在当前快照中开放，已安全停止。" },
  validation_error: { label: "校验错误", detail: "草案包含阻塞性校验问题，不能用于创建运行。" },
  stale: { label: "内容已过期", detail: "上下文或能力版本发生变化，请重新提交以获得新的草案结果。" },
  error: { label: "处理失败", detail: "Agent 暂时不可用；原页面状态未被修改。" },
  unavailable: { label: "能力不可用", detail: "当前 Agent 能力目录不可用，无法安全解析请求。" },
  missing: { label: "缺少信息", detail: "还缺少必要信息，暂不生成草案。" },
};
const copy = computed(() => statusCopy[props.result?.status || "idle"]);
const validationIssues = computed(() => {
  const block = props.result?.blocks.find((item) => item.block_type === "validation_result");
  return block?.block_type === "validation_result" ? block.issues : [];
});
const unsupportedItems = computed(() => {
  const block = props.result?.blocks.find(
    (item) => item.block_type === "unsupported" || item.block_type === "capability_result",
  );
  return block && (block.block_type === "unsupported" || block.block_type === "capability_result")
    ? block.result.unsupported_items
    : [];
});
</script>
<template>
  <section v-if="result" class="lightweight-summary" aria-labelledby="understanding-title">
    <div>
      <p class="section-kicker">第三步</p>
      <h2 id="understanding-title">Agent 理解了什么</h2>
      <h3>结论</h3>
      <p class="lightweight-summary__status" :data-status="result.status">{{ copy.label }}</p>
      <p>{{ result.summary || copy.detail }}</p>
    </div>
    <div class="lightweight-summary__notice" role="status">{{ copy.detail }}</div>
    <div v-if="result.fields.length" class="lightweight-field-list">
      <h3>依据：已解析的字段</h3>
      <div v-for="field in result.fields" :key="field.field_id" class="lightweight-field-row">
        <strong>{{ field.field_id }}</strong
        ><span>{{ field.original_value ?? "未设置" }} → {{ field.proposed_value }} {{ field.unit }}</span
        ><small
          >来源：{{ field.source }}<template v-if="field.stale"> · stale</template> · catalog
          {{ field.catalog_revision }} · capability {{ field.capability_snapshot_revision }} · context
          {{ field.context_revision }}</small
        >
      </div>
    </div>
    <div v-else class="lightweight-summary__basis">
      <h3>依据</h3>
      <p>当前没有可验证的字段依据；unknown、unsupported、unavailable 或 stale 不会被解释为成功。</p>
    </div>
    <div v-if="result.missing.length" class="lightweight-callout" role="status">
      <strong>还需要确认（澄清）</strong>
      <ul>
        <li v-for="item in result.missing" :key="item">{{ item }}</li>
      </ul>
    </div>
    <div v-if="unsupportedItems.length" class="lightweight-callout lightweight-callout--danger" role="alert">
      <strong>{{ result.status === "unknown" ? "未知或未覆盖的请求" : "当前不可用的能力" }}</strong>
      <ul>
        <li v-for="item in unsupportedItems" :key="`${item.capability}:${item.text}`">
          {{ item.text }}（{{ item.capability }}）
        </li>
      </ul>
    </div>
    <div v-if="validationIssues.length" class="lightweight-callout lightweight-callout--danger" role="alert">
      <strong>校验问题</strong>
      <ul>
        <li v-for="issue in validationIssues" :key="issue.issue_id">{{ issue.message }}</li>
      </ul>
    </div>
    <section class="lightweight-summary__sections">
      <div>
        <h3>限制</h3>
        <ul>
          <li v-for="item in result.limitations" :key="item">{{ item }}</li>
        </ul>
      </div>
      <div>
        <h3>下一步</h3>
        <p>
          {{
            result.status === "draft"
              ? "检查字段和限制；本草案不会自动创建运行，确认后由工作台提交。"
              : "根据上面的状态补充信息，或返回新建实验页重新开始。"
          }}
        </p>
      </div>
    </section>
  </section>
</template>
<style scoped>
.lightweight-summary {
  display: grid;
  gap: 14px;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--panel);
}
.lightweight-summary h2 {
  margin: 0;
  font-size: 20px;
}
.lightweight-summary h3 {
  margin: 0;
  font-size: 15px;
}
.lightweight-summary__status {
  color: var(--accent) !important;
  font-weight: 700;
}
.lightweight-summary__notice {
  padding: 10px 12px;
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
}
.lightweight-summary p {
  margin: 4px 0 0;
  color: var(--muted);
}
.lightweight-field-list {
  display: grid;
  gap: 8px;
}
.lightweight-field-row {
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-subtle);
}
.lightweight-field-row strong {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  overflow-wrap: anywhere;
}
.lightweight-field-row span {
  font-variant-numeric: tabular-nums;
}
.lightweight-field-row small {
  color: var(--muted);
  overflow-wrap: anywhere;
}
.lightweight-callout {
  padding: 12px;
  border: 1px solid var(--warning);
  border-radius: var(--radius-control);
  background: var(--warning-soft);
}
.lightweight-callout--danger {
  border-color: var(--danger);
  background: var(--danger-soft);
}
.lightweight-callout ul {
  margin: 6px 0 0;
  padding-left: 20px;
}
.lightweight-summary__sections {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
}
.lightweight-summary__sections > div {
  min-width: 0;
}
.lightweight-summary__sections ul {
  margin: 6px 0 0;
  padding-left: 18px;
}
.lightweight-summary__sections p {
  margin: 6px 0 0;
}
@media (max-width: 620px) {
  .lightweight-summary__sections {
    grid-template-columns: 1fr;
  }
}
</style>
