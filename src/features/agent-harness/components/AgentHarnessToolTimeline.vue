<script setup lang="ts">
import type { AgentHarnessToolOutcome } from "../../../lib/api/agent-harness";

export interface AgentHarnessToolTimelineItem {
  id: string;
  tool_name: string;
  tool_revision: string;
  outcome: AgentHarnessToolOutcome | "pending" | "unavailable" | "not_applicable";
  operation_id: string;
  turn_id: string;
  run_id: string | null;
  scope: string;
  started_at: string | null;
  finished_at: string | null;
  error_code?: string | null;
  field_path?: string | null;
  artifact_summary?: string | null;
  artifact_id?: string | null;
  artifact_schema?: string | null;
  artifact_sha256?: string | null;
  artifact_bytes?: string | null;
  artifact_pointer?: string | null;
}

withDefaults(defineProps<{ items?: readonly AgentHarnessToolTimelineItem[] }>(), { items: () => [] });

function outcomeLabel(outcome: AgentHarnessToolTimelineItem["outcome"]): string {
  const labels: Record<AgentHarnessToolTimelineItem["outcome"], string> = {
    succeeded: "已完成",
    rejected: "已拒绝",
    retryable_failure: "可重试失败",
    terminal_failure: "终止失败",
    unknown_outcome: "结果未知，需要恢复",
    pending: "进行中",
    unavailable: "不可用",
    not_applicable: "不适用",
  };
  return labels[outcome];
}
</script>

<template>
  <section class="agent-harness-tool-timeline" aria-label="Agent Harness 只读工具调用时间线">
    <h3>只读工具调用</h3>
    <p v-if="!items.length" class="agent-harness-tool-timeline__empty">尚未读取工具结果。</p>
    <ol v-else>
      <li v-for="item in items" :key="item.id" :data-outcome="item.outcome">
        <header>
          <strong>{{ item.tool_name }}</strong>
          <span>{{ outcomeLabel(item.outcome) }}</span>
        </header>
        <dl>
          <div>
            <dt>revision</dt>
            <dd>
              <code>{{ item.tool_revision }}</code>
            </dd>
          </div>
          <div>
            <dt>scope</dt>
            <dd>
              <code>{{ item.scope }}</code>
            </dd>
          </div>
          <div>
            <dt>operation / turn</dt>
            <dd>
              <code>{{ item.operation_id }} / {{ item.turn_id }}</code>
            </dd>
          </div>
          <div>
            <dt>run</dt>
            <dd>
              <code>{{ item.run_id || "未绑定" }}</code>
            </dd>
          </div>
          <div v-if="item.started_at">
            <dt>开始</dt>
            <dd>{{ item.started_at }}</dd>
          </div>
          <div v-if="item.finished_at">
            <dt>结束</dt>
            <dd>{{ item.finished_at }}</dd>
          </div>
          <div v-if="item.artifact_summary">
            <dt>verified record</dt>
            <dd>{{ item.artifact_summary }}</dd>
          </div>
          <div v-if="item.artifact_id">
            <dt>artifact</dt>
            <dd>
              <code>{{ item.artifact_id }}</code>
            </dd>
          </div>
          <div v-if="item.artifact_schema">
            <dt>schema</dt>
            <dd>
              <code>{{ item.artifact_schema }}</code>
            </dd>
          </div>
          <div v-if="item.artifact_sha256">
            <dt>SHA-256</dt>
            <dd>
              <code>{{ item.artifact_sha256 }}</code>
            </dd>
          </div>
          <div v-if="item.artifact_bytes">
            <dt>bytes</dt>
            <dd>
              <code>{{ item.artifact_bytes }}</code>
            </dd>
          </div>
          <div v-if="item.artifact_pointer">
            <dt>JSON Pointer</dt>
            <dd>
              <code>{{ item.artifact_pointer }}</code>
            </dd>
          </div>
        </dl>
        <p v-if="item.error_code" role="alert">
          <strong>{{ item.error_code }}</strong
          >{{ item.field_path || "" }}
        </p>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.agent-harness-tool-timeline {
  display: grid;
  gap: 0.5rem;
}
.agent-harness-tool-timeline h3 {
  margin: 0;
  font-size: 0.85rem;
}
.agent-harness-tool-timeline ol {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.agent-harness-tool-timeline li {
  display: grid;
  gap: 0.35rem;
  padding: 0.65rem;
  border: 1px solid var(--line, #d9e0e5);
  border-radius: 0.55rem;
}
.agent-harness-tool-timeline li header {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}
.agent-harness-tool-timeline li dl {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  font-size: 0.72rem;
}
.agent-harness-tool-timeline li dl > div {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}
.agent-harness-tool-timeline dt {
  color: var(--muted, #687783);
}
.agent-harness-tool-timeline dd {
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
}
.agent-harness-tool-timeline code {
  overflow-wrap: anywhere;
}
.agent-harness-tool-timeline p {
  margin: 0;
  font-size: 0.75rem;
}
.agent-harness-tool-timeline li > p {
  color: var(--danger, #a33131);
}
.agent-harness-tool-timeline__empty {
  color: var(--muted, #687783);
}
</style>
