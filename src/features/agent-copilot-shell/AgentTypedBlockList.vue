<script setup lang="ts">
import assistantAvatar from "../../assets/atuo-avatar.svg";
import userAvatar from "../../assets/user-avatar.svg";
import type {
  AgentTypedBlock,
  DeterministicValidationIssue,
  DraftFieldValue,
} from "../../entities/agent-orchestration";
import { agentPageDirectory } from "../../entities/navigation/model";

const props = withDefaults(
  defineProps<{
    blocks: readonly AgentTypedBlock[];
    /** Prevent duplicate durable flow transitions while the first click is in flight. */
    flowResumePending?: boolean;
  }>(),
  { flowResumePending: false },
);

const emit = defineEmits<{
  answer: [payload: { question_id: string; option_id: string; serialized_value: string }];
  apply: [blockId: string];
  "report-confirm": [blockId: string];
  "flow-resume": [
    payload: {
      blockId: string;
      action: "clarify_intent" | "confirm_report" | "confirm_draft" | "confirm_navigation" | "cancel" | "reject";
      intent?: "explain" | "existing_run_analysis" | "user_report" | "configuration_draft";
    },
  ];
  "navigation-confirm": [blockId: string];
  "navigation-cancel": [blockId: string];
  start: [task: "capabilities" | "configure" | "analyze"];
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
  "report_action",
  "agent_navigation",
  "agent_flow",
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

function pageLabel(pageId: string): string {
  return agentPageDirectory.find((page) => page.page_id === pageId)?.display_label || "目标页面";
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

function flowStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    created: "已建立",
    running: "处理中",
    waiting_user: "等待确认",
    draft_ready: "草案已准备",
    completed: "已完成",
    stale: "已过期",
    refused: "已拒绝",
    cancelled: "已取消",
    failed: "处理失败",
  };
  return labels[status] || "状态未知";
}

function flowEvidenceLabel(status: string): string {
  const labels: Record<string, string> = {
    validated: "已校验证据",
    deterministic_fallback: "本地确定性整理",
    partial: "证据不完整",
    truncated: "证据已截断",
    missing: "缺少证据",
    provider_unavailable: "模型通道不可用",
  };
  return labels[status] || "证据状态未知";
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

function hasAppliedReceipt(block: { receipts?: readonly { status: string }[] | null }): boolean {
  return Boolean(block.receipts?.some((receipt) => receipt.status === "applied"));
}

const blockTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatBlockTime(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : blockTimeFormatter.format(date);
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
      <div
        v-if="block.block_type !== 'user_message' && block.block_type !== 'assistant_message'"
        class="agent-block__assistant-mark"
        aria-hidden="true"
      >
        <img :src="assistantAvatar" alt="" width="28" height="28" />
      </div>
      <div
        v-if="
          block.block_type !== 'user_message' &&
          block.block_type !== 'assistant_message' &&
          formatBlockTime(block.created_at)
        "
        class="agent-block__meta agent-block__meta--assistant"
        aria-label="小拓回复时间"
      >
        <span class="agent-block__meta-name">小拓</span>
        <time class="agent-block__time" :datetime="block.created_at">{{ formatBlockTime(block.created_at) }}</time>
      </div>
      <template v-if="block.block_type === 'user_message'">
        <div class="agent-block__speaker">
          <img :src="userAvatar" alt="" aria-hidden="true" width="28" height="28" />
          <p class="agent-block__eyebrow">用户</p>
          <time v-if="formatBlockTime(block.created_at)" class="agent-block__time" :datetime="block.created_at">
            {{ formatBlockTime(block.created_at) }}
          </time>
        </div>
        <p class="agent-block__body agent-block__utterance">{{ block.text }}</p>
      </template>

      <template v-else-if="block.block_type === 'assistant_message'">
        <div class="agent-block__speaker">
          <img :src="assistantAvatar" alt="" aria-hidden="true" width="28" height="28" />
          <p class="agent-block__eyebrow">{{ block.model_id ? `小拓 · ${block.model_id}` : "小拓" }}</p>
          <time v-if="formatBlockTime(block.created_at)" class="agent-block__time" :datetime="block.created_at">
            {{ formatBlockTime(block.created_at) }}
          </time>
        </div>
        <p v-if="block.text" class="agent-block__body agent-block__answer">{{ block.text }}</p>
        <p v-else-if="block.streaming" class="agent-block__body agent-block__answer agent-block__answer--waiting">
          正在想…
        </p>
        <p v-if="block.streaming" class="agent-block__streaming" role="status" aria-live="off">正在写回答…</p>
        <p v-else-if="block.error" class="agent-block__body agent-block__answer-note">{{ block.error }}</p>
      </template>

      <template v-else-if="block.block_type === 'explanation'">
        <p class="agent-block__eyebrow">理解结果</p>
        <h3>{{ block.title }}</h3>
        <p class="agent-block__body agent-block__body--guidance">{{ block.body }}</p>
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
          {{
            block.title ||
            (block.receipts
              ? hasAppliedReceipt(block)
                ? "已写入面板"
                : "面板拒绝了方案"
              : `待写入 ${block.edits.length} 项`)
          }}
        </h3>
        <p v-if="block.rationale" class="agent-block__body">{{ block.rationale }}</p>
        <details v-if="block.jsonPreview" class="agent-block__details agent-block__json-preview">
          <summary>查看将要写入的 JSON（确认后一次性应用）</summary>
          <p class="agent-block__body">这是当前页面校验后的输入草案；尚未写入，也不会创建运行。</p>
          <section v-if="block.jsonPreview.overridesJson" class="agent-block__json-preview-section">
            <h4>overrides（快捷控制）</h4>
            <pre tabindex="0"><code>{{ block.jsonPreview.overridesJson }}</code></pre>
          </section>
          <section v-if="block.jsonPreview.runtimeJson" class="agent-block__json-preview-section">
            <h4>runtime_trace</h4>
            <pre tabindex="0"><code>{{ block.jsonPreview.runtimeJson }}</code></pre>
          </section>
          <section v-if="block.jsonPreview.topologyJson" class="agent-block__json-preview-section">
            <h4>topology</h4>
            <pre tabindex="0"><code>{{ block.jsonPreview.topologyJson }}</code></pre>
          </section>
        </details>
        <section v-if="block.warnings?.length" class="agent-block__section agent-block__section--warning">
          <h4>结构化输入提示</h4>
          <ul>
            <li v-for="(item, index) in block.warnings" :key="`warning:${index}`">{{ item }}</li>
          </ul>
        </section>
        <p v-if="block.incomplete?.length" class="agent-block__draft-notice" role="alert">
          方案不完整，已禁止应用。请补齐以下参数后重新生成；当前面板没有写入任何改动。
        </p>
        <section v-if="block.incomplete?.length" class="agent-block__section agent-block__section--warning">
          <h4>待修正的参数</h4>
          <ul>
            <li v-for="(item, index) in block.incomplete" :key="`incomplete:${index}`">{{ item }}</li>
          </ul>
        </section>
        <p
          v-if="
            !block.receipts &&
            (block.edits.length || block.structuredInputs) &&
            !block.incomplete?.length &&
            !block.rejected.length &&
            !block.unknown.length
          "
          class="agent-block__draft-notice"
        >
          还没写进面板；确认无误后按下按钮才会写入。写入不会创建运行。
        </p>
        <template v-else-if="block.receipts">
          <p class="agent-block__draft-notice">
            {{ hasAppliedReceipt(block) ? "已写入面板；没有创建运行。" : "没有写入面板；没有创建运行。" }}
          </p>
          <p v-if="block.channelMoved" class="agent-block__draft-notice">
            已同时把提交改走「自定义输入」通道：这些参数只在自定义输入里生效。
          </p>
        </template>
        <ul v-if="block.edits.length" class="agent-block__diff-list">
          <li v-for="item in block.edits" :key="item.path">
            <span>
              {{ item.label }}
              <details class="agent-block__field-details">
                <summary>字段位置</summary>
                <code>{{ item.path }}</code>
              </details>
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
        <section
          v-if="block.rejected.length && !block.incomplete?.length"
          class="agent-block__section agent-block__section--warning"
        >
          <h4>没有写（校验未通过）</h4>
          <ul>
            <li v-for="item in block.rejected" :key="`rejected:${item.raw}`">
              <strong>{{ item.raw }}</strong>
              <span>{{ item.reason }}</span>
            </li>
          </ul>
        </section>
        <section
          v-if="block.unknown.length && !block.incomplete?.length"
          class="agent-block__section agent-block__section--warning"
        >
          <h4>没有看懂</h4>
          <ul>
            <li v-for="item in block.unknown" :key="`unknown:${item.raw}`">
              <strong>{{ item.raw }}</strong>
              <span>{{ item.reason }}</span>
            </li>
          </ul>
        </section>
        <div
          v-if="
            !block.receipts &&
            (block.edits.length || block.structuredInputs) &&
            !block.incomplete?.length &&
            !block.rejected.length &&
            !block.unknown.length
          "
          class="agent-block__options"
        >
          <button type="button" @click="emit('apply', block.block_id)">
            {{ block.structuredInputs || block.jsonPreview ? "应用 JSON 草案到输入" : "应用到面板" }}
          </button>
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

      <template v-else-if="block.block_type === 'report_action'">
        <p class="agent-block__eyebrow">结果解读报告</p>
        <h3>{{ block.title }}</h3>
        <p class="agent-block__body">{{ block.detail }}</p>
        <p v-if="block.status === 'pending'" class="agent-block__draft-notice">需要你确认后才会生成并下载文件。</p>
        <p v-else-if="block.status === 'confirmed'" class="agent-block__body">
          已确认；报告下载由当前结果页的公共导出入口执行。
        </p>
        <p v-else-if="block.status === 'stale'" class="agent-block__body">
          当前运行或页面上下文已变化，请回到结果页重新发起。
        </p>
        <p v-else-if="block.status === 'failed'" class="agent-block__body">报告生成失败，请先检查结果页的证据边界。</p>
        <button
          v-if="block.status === 'pending'"
          type="button"
          class="button button--secondary"
          @click="emit('report-confirm', block.block_id)"
        >
          生成结果解读报告
        </button>
        <details class="agent-block__details">
          <summary>查看当前运行绑定</summary>
          <code>{{ block.run_id }} · {{ block.context_revision }}</code>
        </details>
      </template>

      <template v-else-if="block.block_type === 'agent_flow'">
        <p class="agent-block__eyebrow">助手流程 · {{ flowStatusLabel(block.status) }}</p>
        <h3>{{ block.title }}</h3>
        <p class="agent-block__body">{{ block.detail }}</p>
        <p v-if="block.user_goal" class="agent-block__body">请求：{{ block.user_goal }}</p>
        <p v-if="block.local_notice" class="agent-block__body agent-block__body--warning" role="alert">
          {{ block.local_notice }}
        </p>
        <details class="agent-block__details agent-block__flow-details">
          <summary>查看处理状态</summary>
          <div class="agent-block__flow-meta" :data-status="block.status">
            <span>{{ block.phase }}</span>
            <span>{{ flowEvidenceLabel(block.evidence_status) }}</span>
            <span v-if="block.report_status !== 'not_started'">报告：{{ block.report_status }}</span>
          </div>
        </details>
        <section v-if="block.pending_action" class="agent-block__section agent-block__section--warning">
          <h4>需要确认</h4>
          <p class="agent-block__body">{{ block.pending_action.prompt }}</p>
          <small>{{ block.pending_action.reason }}</small>
          <div class="agent-block__options">
            <button
              v-if="block.pending_action.action === 'confirm_report'"
              type="button"
              :disabled="props.flowResumePending"
              :aria-busy="props.flowResumePending"
              @click="emit('flow-resume', { blockId: block.block_id, action: 'confirm_report' })"
            >
              {{ props.flowResumePending ? "处理中…" : "确认整理报告" }}
            </button>
            <p v-else-if="block.pending_action.action === 'confirm_navigation'" class="agent-block__body">
              页面导航已由上方的导航卡确认；这里不会再次要求批准。
            </p>
            <button
              v-else-if="block.pending_action.action === 'confirm_draft'"
              type="button"
              :disabled="props.flowResumePending"
              :aria-busy="props.flowResumePending"
              @click="emit('flow-resume', { blockId: block.block_id, action: 'confirm_draft' })"
            >
              {{ props.flowResumePending ? "处理中…" : "确认生成草案" }}
            </button>
            <template v-else-if="block.pending_action.action === 'clarify_intent'">
              <button
                v-for="option in block.pending_action.intent_options || []"
                :key="option.intent"
                type="button"
                :disabled="props.flowResumePending"
                :aria-busy="props.flowResumePending"
                @click="
                  emit('flow-resume', { blockId: block.block_id, action: 'clarify_intent', intent: option.intent })
                "
              >
                {{ option.label }}
              </button>
            </template>
            <button
              type="button"
              class="button button--secondary"
              :disabled="props.flowResumePending"
              :aria-busy="props.flowResumePending"
              @click="emit('flow-resume', { blockId: block.block_id, action: 'cancel' })"
            >
              取消
            </button>
          </div>
        </section>
        <p v-if="block.status === 'stale'" class="agent-block__body" role="alert">
          当前页面、运行或 schema 身份已变化，流程不能继续；请重新发起。
        </p>
        <p v-else-if="block.status === 'refused'" class="agent-block__body" role="alert">
          当前请求被安全边界拒绝，不会创建运行、修改配置或调用执行接口。
        </p>
        <p v-else-if="block.status === 'cancelled'" class="agent-block__body">流程已取消，未产生执行副作用。</p>
      </template>

      <template v-else-if="block.block_type === 'agent_navigation'">
        <p class="agent-block__eyebrow">页面导航建议</p>
        <h3>{{ block.status === 'succeeded' ? '已打开目标页面' : '可以帮你打开相关页面' }}</h3>
        <p class="agent-block__body">{{ block.detail }}</p>
        <ul v-if="block.target_pages.length" class="agent-block__plain-list">
          <li v-for="page in block.target_pages" :key="page">{{ pageLabel(page) }}</li>
        </ul>
        <button
          v-if="block.status === 'pending'"
          type="button"
          class="button button--primary"
          @click="emit('navigation-confirm', block.block_id)"
        >
          打开页面
        </button>
        <button
          v-if="block.status === 'pending' || block.status === 'running'"
          type="button"
          class="button button--secondary"
          :disabled="props.flowResumePending && block.status === 'pending'"
          :aria-busy="props.flowResumePending && block.status === 'pending'"
          @click="emit('navigation-cancel', block.block_id)"
        >
          停止这条建议
        </button>
        <p v-if="block.status === 'stale' || block.status === 'failed'" class="agent-block__body" role="alert">
          页面身份或上下文发生变化，未继续导航；请重新描述你的目标。
        </p>
        <details v-if="block.observation" class="agent-block__details">
          <summary>导航观察</summary>
          <p>{{ block.observation.failure_type || (block.observation.page_correct ? '已到达目标页面' : '页面未匹配') }}</p>
          <p>已尝试 {{ block.observation.navigation_attempts }} 次</p>
        </details>
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
    <div class="agent-block__speaker">
      <img :src="assistantAvatar" alt="" aria-hidden="true" width="28" height="28" />
      <strong>小拓</strong>
    </div>
    <p>你好，我可以帮你了解当前页面、准备实验草案，或解读已有运行结果。先选一个入口，也可以直接输入你的问题。</p>
    <div class="agent-block-empty__choices" aria-label="选择助手任务">
      <button type="button" data-task="capabilities" @click="emit('start', 'capabilities')">
        <strong>了解助手能做什么</strong>
        <small>先看能力、示例和边界</small>
      </button>
      <button type="button" data-task="configure" @click="emit('start', 'configure')">
        <strong>从实验配置开始</strong>
        <small>用一句话生成可校验的草案</small>
      </button>
      <button type="button" data-task="analyze" @click="emit('start', 'analyze')">
        <strong>从已有结果开始</strong>
        <small>查看重点、证据和后续建议</small>
      </button>
    </div>
    <small>涉及修改时，助手会先把建议讲清楚，再请你确认。</small>
  </div>
</template>

<style scoped>
.agent-block-list {
  display: grid;
  gap: 16px;
  min-width: 0;
  max-width: 100%;
  padding: 18px 14px 26px;
}

.agent-block {
  min-width: 0;
  padding: 0 0 2px;
  color: var(--ink);
}

.agent-block:not([data-block-type="user_message"]):not([data-block-type="assistant_message"]) {
  position: relative;
  padding: 14px 14px 14px 48px;
  border: 1px solid color-mix(in srgb, var(--accent) 17%, var(--line));
  border-radius: 11px;
  background: color-mix(in srgb, var(--surface-subtle) 84%, var(--panel));
  box-shadow: var(--shadow-hairline);
  animation: agent-block-in 360ms var(--ease-emphasized) both;
}

.agent-block:not([data-block-type="user_message"]):not([data-block-type="assistant_message"])::after {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  content: "";
  opacity: 0.55;
}

.agent-block[data-block-type="formal_error"] {
  border-color: color-mix(in srgb, var(--danger) 42%, var(--line));
  background: color-mix(in srgb, var(--danger-soft) 35%, var(--panel));
}

.agent-block__eyebrow {
  margin: 0 0 4px;
  color: var(--accent);
  font-size: var(--text-micro);
  font-weight: 700;
  letter-spacing: 0.04em;
}

.agent-block__speaker {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-bottom: 4px;
}

.agent-block__speaker img {
  flex: none;
  width: 28px;
  height: 28px;
}

.agent-block__speaker .agent-block__eyebrow {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.agent-block__time {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: var(--text-micro);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  letter-spacing: 0;
}

.agent-block__speaker .agent-block__time {
  margin-left: auto;
}

.agent-block__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 92%;
  margin: 0 0 7px;
  color: var(--muted);
  font-size: var(--text-micro);
}

.agent-block__assistant-mark {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 28px;
  height: 28px;
  padding: 3px;
  border: 1px solid color-mix(in srgb, var(--accent) 36%, var(--line));
  border-radius: 9px;
  background: var(--accent-soft);
}

.agent-block__assistant-mark img {
  display: block;
  width: 28px;
  height: 28px;
}

.agent-block__meta-name {
  color: var(--accent-ink);
  font-weight: 700;
}

.agent-block-empty__choices {
  display: grid;
  gap: 8px;
  margin: 16px 0 10px;
}

.agent-block-empty__choices button {
  display: grid;
  gap: 2px;
  min-height: 38px;
  padding: 7px 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink);
  background: var(--panel);
  cursor: pointer;
  text-align: left;
  transition:
    transform var(--motion-interaction) var(--ease-emphasized),
    border-color var(--motion-fast) var(--ease-standard),
    background-color var(--motion-fast) var(--ease-standard),
    box-shadow var(--motion-interaction) var(--ease-standard);
}

.agent-block-empty__choices button strong {
  color: inherit;
  font-size: var(--text-sm);
  font-weight: 700;
}

.agent-block-empty__choices button small {
  color: var(--muted);
  font-size: var(--text-xs);
  line-height: 1.35;
}

.agent-block-empty__choices button:hover,
.agent-block-empty__choices button:focus-visible {
  border-color: var(--accent);
  background: var(--surface-muted);
}
.agent-block-empty__choices button:hover {
  transform: translateX(3px);
  box-shadow: var(--shadow-hairline);
}

.agent-block-empty > small {
  color: var(--muted);
  line-height: 1.5;
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

.agent-block__body--guidance {
  white-space: pre-wrap;
}

/* Keep the conversation asymmetric: the user's turn ends at the right edge while the assistant
   stays anchored to the left. This makes speaker changes legible without adding another card. */
.agent-block[data-block-type="user_message"] {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  padding: 0;
  border: 0;
  background: transparent;
}

.agent-block[data-block-type="user_message"] .agent-block__speaker {
  width: min(86%, 44rem);
  flex-direction: row-reverse;
  justify-content: flex-start;
  margin: 0 0 4px;
}

.agent-block[data-block-type="user_message"] .agent-block__time {
  color: color-mix(in srgb, var(--on-accent, #10201f) 86%, var(--accent));
}

.agent-block__utterance {
  max-width: min(86%, 44rem);
  margin: 0;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--line-strong));
  border-radius: 13px 13px 3px 13px;
  color: var(--on-accent, #10201f);
  background: var(--accent);
  font-weight: 600;
  line-height: 1.55;
  overflow-wrap: anywhere;
  box-shadow: var(--shadow-hairline);
  transition:
    transform var(--motion-interaction) var(--ease-emphasized),
    box-shadow var(--motion-interaction) var(--ease-standard);
}

.agent-block__utterance:hover {
  box-shadow: var(--shadow);
  transform: translateY(-1px);
}

.agent-block[data-block-type="assistant_message"] .agent-block__speaker {
  width: min(92%, 44rem);
  padding: 7px 9px 0;
}

.agent-block[data-block-type="assistant_message"] .agent-block__answer,
.agent-block[data-block-type="assistant_message"] .agent-block__answer-note,
.agent-block[data-block-type="assistant_message"] .agent-block__streaming {
  max-width: min(92%, 44rem);
  margin-left: 36px;
  padding: 11px 13px;
  border: 1px solid color-mix(in srgb, var(--accent) 19%, var(--line));
  border-radius: 4px 13px 13px 13px;
  background: color-mix(in srgb, var(--panel) 90%, var(--accent-soft));
  box-shadow: var(--shadow-hairline);
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
  position: relative;
  margin: 8px 0 0;
  color: var(--accent);
  font-size: var(--text-micro);
  font-weight: 650;
}

.agent-block__streaming::after {
  display: inline-block;
  width: 1.2em;
  overflow: hidden;
  vertical-align: bottom;
  content: "…";
  animation: agent-typing-dots 1.1s steps(4, end) infinite;
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

.agent-block__field-details {
  margin-top: 4px;
  color: var(--muted);
  font-size: var(--text-micro);
}

.agent-block__field-details summary {
  color: var(--muted);
}

.agent-block__field-details code {
  display: block;
  margin-top: 4px;
  color: var(--ink-soft);
  font: inherit;
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

.agent-block__json-preview-section {
  margin-top: 10px;
}

.agent-block__json-preview-section h4 {
  margin-bottom: 4px;
}

.agent-block__json-preview-section pre {
  max-height: 280px;
  margin: 0;
  padding: 9px;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  color: var(--ink-soft);
  background: var(--canvas);
  font: var(--text-micro) / 1.45 var(--font-mono);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
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

.agent-block__flow-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  color: var(--ink-soft);
  font-size: var(--text-micro);
}

.agent-block__flow-meta span {
  padding: 3px 7px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-subtle);
}

.agent-block__flow-meta[data-status="stale"],
.agent-block__flow-meta[data-status="refused"],
.agent-block__flow-meta[data-status="failed"] {
  color: var(--danger-ink);
}

.agent-block__flow-meta[data-status="waiting_user"],
.agent-block__flow-meta[data-status="draft_ready"] {
  color: var(--warning-ink);
}

.agent-block-empty {
  display: grid;
  place-content: center;
  gap: 4px;
  min-height: 236px;
  padding: 32px 24px;
  color: var(--muted);
  text-align: center;
}

.agent-block-empty::before {
  width: 46px;
  height: 4px;
  margin: 0 auto 10px;
  border-radius: 999px;
  background: var(--accent);
  content: "";
}

.agent-block-empty strong {
  color: var(--ink);
}

.agent-block-empty p {
  max-width: 46ch;
  margin: 0;
  line-height: 1.65;
}

@keyframes agent-block-in {
  from {
    opacity: 0;
    transform: translateY(7px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes agent-typing-dots {
  0% {
    width: 0;
  }
  50% {
    width: 1.2em;
  }
  100% {
    width: 1.2em;
  }
}

@media (prefers-reduced-motion: reduce) {
  .agent-block,
  .agent-block__streaming::after {
    animation: none;
  }
}
</style>
