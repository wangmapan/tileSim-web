<script setup lang="ts">
import type {
  AgentTypedBlock,
  DeterministicValidationIssue,
  DraftFieldValue,
} from "../../entities/agent-orchestration";

defineProps<{ blocks: readonly AgentTypedBlock[] }>();

const emit = defineEmits<{
  answer: [payload: { question_id: string; option_id: string; serialized_value: string }];
  apply: [blockId: string];
}>();

const knownBlockTypes = new Set([
  "user_message",
  "assistant_message",
  "explanation",
  "capability_result",
  "draft_summary",
  "validation_result",
  "clarification",
  "unsupported",
  "parameter_edits",
  "formal_error",
]);

const fieldLabels: Record<string, string> = {
  "s0.workload.message_size_multiplier": "通信负载倍率",
  "s1.runtime.batch_scheduler": "调度策略",
  "s1.runtime.max_batch_size": "最大 batch",
  "s1.runtime.kv_capacity_tokens": "KV 容量",
  "s6.fabric.scale_up_bandwidth_gbps": "纵向扩展网络带宽",
  "s6.fabric.scale_up_latency_us": "纵向扩展网络时延",
  "s6.fabric.scale_out_bandwidth_gbps": "横向扩展网络带宽",
  "s6.fabric.scale_out_latency_us": "横向扩展网络时延",
};

function isKnownBlock(block: AgentTypedBlock): boolean {
  return knownBlockTypes.has(String((block as { block_type?: unknown }).block_type));
}

function fieldLabel(fieldId: string): string {
  return fieldLabels[fieldId] || "当前参数";
}

function valueText(value: DraftFieldValue | null): string {
  return value?.value_type === "null" || value === null ? "未设置" : value.serialized_value;
}

function issueTone(issue: DeterministicValidationIssue): string {
  if (issue.blocking || issue.severity === "error") return "danger";
  if (issue.status === "unknown" || issue.status === "stale") return "warning";
  return "neutral";
}

function capabilityHeading(blockType: "capability_result" | "unsupported"): string {
  return blockType === "unsupported" ? "当前能力不支持" : "能力检查结果";
}

/**
 * The per-value reasons of one plan, in the order the values are shown.
 *
 * Only a model proposal carries them, and only for the values that survived
 * planning, so a reason is never shown next to a value the panel did not offer.
 */
function reasonRows(block: {
  edits: readonly { path: string; label: string }[];
  reasons?: Readonly<Record<string, string>>;
}): { path: string; label: string; reason: string }[] {
  const reasons = block.reasons;
  if (!reasons) return [];
  return block.edits
    .filter((edit) => Boolean(reasons[edit.path]))
    .map((edit) => ({ path: edit.path, label: edit.label, reason: reasons[edit.path] }));
}
</script>

<template>
  <div v-if="blocks.length" class="agent-block-list">
    <article
      v-for="block in blocks"
      :key="block.block_id"
      class="agent-block"
      :data-block-type="block.block_type"
      :role="block.block_type === 'formal_error' || !isKnownBlock(block) ? 'alert' : undefined"
    >
      <template v-if="block.block_type === 'user_message'">
        <p class="agent-block__eyebrow">你</p>
        <p class="agent-block__body agent-block__utterance">{{ block.text }}</p>
      </template>

      <template v-else-if="block.block_type === 'assistant_message'">
        <p class="agent-block__eyebrow">{{ block.model_id ? `助手 · ${block.model_id}` : "助手" }}</p>
        <p v-if="block.text" class="agent-block__body agent-block__answer">{{ block.text }}</p>
        <p v-else-if="block.streaming" class="agent-block__body agent-block__answer agent-block__answer--waiting">
          正在想…
        </p>
        <p v-if="block.streaming" class="agent-block__streaming" role="status">正在写回答…</p>
        <p v-else-if="block.error" class="agent-block__body agent-block__answer-note">{{ block.error }}</p>
      </template>

      <template v-else-if="block.block_type === 'explanation'">
        <p class="agent-block__eyebrow">理解结果</p>
        <h3>{{ block.title }}</h3>
        <p class="agent-block__body">{{ block.body }}</p>
      </template>

      <template v-else-if="block.block_type === 'capability_result' || block.block_type === 'unsupported'">
        <p class="agent-block__eyebrow">理解结果</p>
        <h3>{{ capabilityHeading(block.block_type) }}</h3>
        <ul v-if="block.result.understood.length" class="agent-block__plain-list">
          <li v-for="item in block.result.understood" :key="item">{{ item }}</li>
        </ul>
        <section
          v-if="block.result.unsupported_items.length"
          class="agent-block__section agent-block__section--warning"
        >
          <h4>限制</h4>
          <ul>
            <li v-for="item in block.result.unsupported_items" :key="`${item.capability}:${item.text}`">
              <strong>{{ item.text }}</strong>
              <span>{{ item.capability }}</span>
            </li>
          </ul>
        </section>
        <section v-if="block.result.safe_next_actions.length" class="agent-block__section">
          <h4>下一步</h4>
          <ul>
            <li v-for="item in block.result.safe_next_actions" :key="item">{{ item }}</li>
          </ul>
        </section>
        <details class="agent-block__details">
          <summary>专业详情</summary>
          <dl>
            <div>
              <dt>reason code</dt>
              <dd>{{ block.result.reason_code }}</dd>
            </div>
            <template v-for="item in block.result.unsupported_items" :key="`${item.text}:gap`">
              <div v-if="item.gap_id">
                <dt>Gap</dt>
                <dd>{{ item.gap_id }}</dd>
              </div>
            </template>
          </dl>
        </details>
      </template>

      <template v-else-if="block.block_type === 'draft_summary'">
        <p class="agent-block__eyebrow">建议修改</p>
        <h3>{{ block.draft.task_summary }}</h3>
        <p class="agent-block__draft-notice">这是草案，尚未创建运行。</p>
        <ul class="agent-block__diff-list">
          <li v-for="item in block.draft.diff" :key="`${item.field_id}:${item.request_json_pointer}`">
            <span>{{ fieldLabel(item.field_id) }}</span>
            <strong>
              <template v-if="item.change === 'replace'">{{ valueText(item.original_value) }} → </template>
              {{ valueText(item.proposed_value) }}<small v-if="item.unit"> · {{ item.unit }}</small>
            </strong>
          </li>
        </ul>
        <section v-if="block.draft.unresolved.length" class="agent-block__section agent-block__section--warning">
          <h4>限制</h4>
          <ul>
            <li v-for="item in block.draft.unresolved" :key="item">{{ item }}</li>
          </ul>
        </section>
        <details class="agent-block__details">
          <summary>草案字段与身份</summary>
          <dl>
            <div>
              <dt>目标请求</dt>
              <dd>{{ block.draft.target_request_identity }}</dd>
            </div>
            <div>
              <dt>catalog revision</dt>
              <dd>{{ block.draft.catalog_revision }}</dd>
            </div>
            <div>
              <dt>snapshot revision</dt>
              <dd>{{ block.draft.capability_snapshot_revision }}</dd>
            </div>
            <div>
              <dt>schema-set revision</dt>
              <dd>{{ block.draft.schema_set_revision }}</dd>
            </div>
          </dl>
          <table>
            <thead>
              <tr>
                <th>field_id</th>
                <th>Pointer</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="field in block.draft.fields" :key="field.field_id">
                <td>{{ field.field_id }}</td>
                <td>{{ field.request_json_pointer }}</td>
                <td>{{ field.value_source }}</td>
              </tr>
            </tbody>
          </table>
        </details>
      </template>

      <template v-else-if="block.block_type === 'validation_result'">
        <p class="agent-block__eyebrow">限制和下一步</p>
        <h3>确定性校验：{{ block.overall }}</h3>
        <p v-if="!block.issues.length" class="agent-block__body">当前没有校验问题；草案仍不会自动创建运行。</p>
        <ol v-else class="agent-block__issue-list">
          <li v-for="issue in block.issues" :key="issue.issue_id" :data-tone="issueTone(issue)">
            <strong>{{ issue.message }}</strong>
            <span v-if="issue.repair_candidates.length">
              可选下一步：{{ issue.repair_candidates.map((candidate) => candidate.label).join("；") }}
            </span>
            <details>
              <summary>规则详情</summary>
              <code>{{ issue.rule_id }} · {{ issue.status }}</code>
              <code v-if="issue.field_ids.length">{{ issue.field_ids.join(" · ") }}</code>
            </details>
          </li>
        </ol>
      </template>

      <template v-else-if="block.block_type === 'clarification'">
        <p class="agent-block__eyebrow">下一步</p>
        <h3>需要补充的信息</h3>
        <ol class="agent-block__question-list">
          <li v-for="question in block.questions" :key="question.question_id">
            <p>{{ question.prompt }}</p>
            <div v-if="question.options.length" class="agent-block__options">
              <button
                v-for="option in question.options"
                :key="option.option_id"
                type="button"
                @click="
                  emit('answer', {
                    question_id: question.question_id,
                    option_id: option.option_id,
                    serialized_value: option.serialized_value,
                  })
                "
              >
                {{ option.label }}
              </button>
            </div>
            <details class="agent-block__details">
              <summary>为何需要澄清</summary>
              <code>{{ question.reason_code }}</code>
            </details>
          </li>
        </ol>
      </template>

      <template v-else-if="block.block_type === 'parameter_edits'">
        <p class="agent-block__eyebrow">{{ block.title ? "推荐方案" : "参数改动" }}</p>
        <h3>
          {{ block.title || (block.receipts ? "已写入面板" : `待写入 ${block.edits.length} 项`) }}
        </h3>
        <p v-if="block.rationale" class="agent-block__body">{{ block.rationale }}</p>
        <p v-if="!block.receipts && block.edits.length" class="agent-block__draft-notice">
          还没写进面板；确认无误后按下按钮才会写入。写入不会创建运行。
        </p>
        <template v-else-if="block.receipts">
          <p class="agent-block__draft-notice">已写入面板；没有创建运行。</p>
          <p v-if="block.channelMoved" class="agent-block__draft-notice">
            已同时把提交改走「自定义输入」通道：这些参数只在自定义输入里生效。
          </p>
        </template>
        <ul v-if="block.edits.length" class="agent-block__diff-list">
          <li v-for="item in block.edits" :key="item.path">
            <span>
              {{ item.label }}
              <br />
              <small>{{ item.path }}</small>
            </span>
            <strong>
              <template v-if="item.previous !== null">{{ item.previous }} → </template>
              {{ item.next }}
            </strong>
          </li>
        </ul>
        <section v-if="reasonRows(block).length" class="agent-block__section">
          <h4>为什么这么设</h4>
          <ul>
            <li v-for="item in reasonRows(block)" :key="`reason:${item.path}`">
              <strong>{{ item.label }}</strong>
              <span>{{ item.reason }}</span>
            </li>
          </ul>
        </section>
        <section v-if="block.rejected.length" class="agent-block__section agent-block__section--warning">
          <h4>没有写（校验未通过）</h4>
          <ul>
            <li v-for="item in block.rejected" :key="`rejected:${item.raw}`">
              <strong>{{ item.raw }}</strong>
              <span>{{ item.reason }}</span>
            </li>
          </ul>
        </section>
        <section v-if="block.unknown.length" class="agent-block__section agent-block__section--warning">
          <h4>没有看懂</h4>
          <ul>
            <li v-for="item in block.unknown" :key="`unknown:${item.raw}`">
              <strong>{{ item.raw }}</strong>
              <span>{{ item.reason }}</span>
            </li>
          </ul>
        </section>
        <div v-if="!block.receipts && block.edits.length" class="agent-block__options">
          <button type="button" @click="emit('apply', block.block_id)">应用到面板</button>
        </div>
        <p v-if="block.receipts && block.note" class="agent-block__body">{{ block.note }}</p>
        <section
          v-if="block.receipts && block.receipts.some((item) => item.status === 'rejected')"
          class="agent-block__section"
        >
          <h4>面板拒绝了这几项</h4>
          <ul>
            <li v-for="item in block.receipts.filter((entry) => entry.status === 'rejected')" :key="`r:${item.path}`">
              <strong>{{ item.label }}</strong>
              <span>{{ item.reason }}</span>
            </li>
          </ul>
        </section>
      </template>

      <template v-else-if="block.block_type === 'formal_error'">
        <p class="agent-block__eyebrow">限制</p>
        <h3>当前结果无法继续处理</h3>
        <p class="agent-block__body">{{ block.message }}</p>
        <section class="agent-block__section">
          <h4>下一步</h4>
          <p>{{ block.safe_next_action }}</p>
        </section>
        <details class="agent-block__details">
          <summary>错误详情</summary>
          <code>{{ block.code }}</code>
        </details>
      </template>

      <template v-else-if="!isKnownBlock(block)">
        <p class="agent-block__eyebrow">限制</p>
        <h3>无法显示的结果块</h3>
        <p class="agent-block__body">返回内容不属于当前冻结的类型集合，已安全忽略。</p>
        <p class="agent-block__next">下一步：刷新能力快照或联系集成负责人核对契约版本。</p>
      </template>
    </article>
  </div>

  <div v-else class="agent-block-empty" role="status">
    <strong>从当前页面开始</strong>
    <p>
      描述你要跑的场景，例如「低延迟在线服务」「单卡冒烟」「长上下文压力」，助手会先给一份推荐方案供你确认；也可以直接写「参数
      = 值」，或询问页面含义。
    </p>
  </div>
</template>

<style scoped>
.agent-block-list {
  display: grid;
}

.agent-block {
  min-width: 0;
  padding: 16px 14px;
  border-bottom: 1px solid var(--line);
  color: var(--ink);
}

.agent-block[data-block-type="formal_error"],
.agent-block:not([data-block-type="explanation"]):last-child {
  background: color-mix(in srgb, var(--surface-subtle) 86%, var(--panel));
}

.agent-block__eyebrow {
  margin: 0 0 4px;
  color: var(--accent);
  font-size: var(--text-micro);
  font-weight: 700;
  letter-spacing: 0.04em;
}

.agent-block h3,
.agent-block h4,
.agent-block p {
  overflow-wrap: anywhere;
}

.agent-block h3 {
  margin: 0;
  font-size: var(--text-lg);
  line-height: 1.4;
}

.agent-block h4 {
  margin: 0 0 5px;
  font-size: var(--text-sm);
}

.agent-block__body,
.agent-block__next {
  margin: 7px 0 0;
  color: var(--ink-soft);
}

/* The conversation. The user's own turn is marked so a long answer can still be attributed at a
   glance, and the answer is pre-wrapped because the model writes it with its own line breaks. */
.agent-block[data-block-type="user_message"] {
  border-left: 3px solid var(--accent);
  background: color-mix(in srgb, var(--surface-muted) 62%, var(--panel));
}

.agent-block__utterance {
  color: var(--ink);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.agent-block__answer {
  white-space: pre-wrap;
}

.agent-block__answer--waiting {
  color: var(--muted);
}

.agent-block__answer-note {
  color: var(--warning-ink);
}

.agent-block__streaming {
  margin: 8px 0 0;
  color: var(--accent);
  font-size: var(--text-micro);
}

.agent-block__draft-notice {
  margin: 10px 0;
  padding: 8px 10px;
  border-left: 3px solid var(--warning);
  color: var(--warning-ink);
  background: var(--warning-soft);
  font-size: var(--text-xs);
  font-weight: 650;
}

.agent-block__plain-list,
.agent-block__section ul,
.agent-block__diff-list,
.agent-block__issue-list,
.agent-block__question-list {
  margin: 9px 0 0;
  padding-left: 20px;
}

.agent-block__plain-list li,
.agent-block__section li,
.agent-block__issue-list li,
.agent-block__question-list li {
  margin-top: 5px;
}

.agent-block__section {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}

.agent-block__section p {
  margin: 0;
}

.agent-block__section--warning {
  color: var(--warning-ink);
}

.agent-block__section li {
  display: grid;
  gap: 2px;
}

.agent-block__section li span {
  color: var(--muted);
  font-size: var(--text-xs);
}

.agent-block__diff-list {
  display: grid;
  gap: 7px;
  padding: 0;
  list-style: none;
}

.agent-block__diff-list li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding-bottom: 7px;
  border-bottom: 1px solid var(--line);
}

.agent-block__diff-list li > span {
  min-width: 0;
  color: var(--ink-soft);
  overflow-wrap: anywhere;
}

.agent-block__diff-list strong {
  flex: none;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;
}

.agent-block__diff-list small {
  color: var(--muted);
  font: inherit;
}

.agent-block__issue-list {
  display: grid;
  gap: 8px;
  padding: 0;
  list-style: none;
}

.agent-block__issue-list > li {
  display: grid;
  gap: 3px;
  padding: 9px 10px;
  border-left: 3px solid var(--line-strong);
  background: var(--surface-subtle);
}

.agent-block__issue-list > li[data-tone="danger"] {
  border-left-color: var(--danger);
}

.agent-block__issue-list > li[data-tone="warning"] {
  border-left-color: var(--warning);
}

.agent-block__issue-list span {
  color: var(--muted);
  font-size: var(--text-xs);
}

.agent-block__issue-list details,
.agent-block__details {
  color: var(--muted);
  font-size: var(--text-micro);
}

.agent-block__details {
  margin-top: 10px;
}

.agent-block details summary {
  width: max-content;
  max-width: 100%;
  cursor: pointer;
  overflow-wrap: anywhere;
}

.agent-block__details dl {
  display: grid;
  gap: 5px;
  margin: 8px 0;
}

.agent-block__details dl > div {
  display: grid;
  grid-template-columns: minmax(80px, 0.35fr) minmax(0, 1fr);
  gap: 8px;
}

.agent-block__details dd {
  min-width: 0;
  margin: 0;
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}

.agent-block__details table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-family: var(--font-mono);
}

.agent-block__details th,
.agent-block__details td {
  padding: 5px;
  border: 1px solid var(--line);
  text-align: left;
  overflow-wrap: anywhere;
}

.agent-block__question-list {
  padding: 0;
  list-style: none;
}

.agent-block__question-list p {
  margin: 0;
}

.agent-block__options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.agent-block__options button {
  min-height: 32px;
  padding: 5px 9px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink);
  background: var(--panel);
  cursor: pointer;
}

.agent-block__options button:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.agent-block-empty {
  display: grid;
  place-content: center;
  gap: 4px;
  min-height: 160px;
  padding: 24px;
  color: var(--muted);
  text-align: center;
}

.agent-block-empty strong {
  color: var(--ink);
}

.agent-block-empty p {
  max-width: 46ch;
  margin: 0;
}
</style>
