<script setup lang="ts">
import type { AgentHarnessApprovalV2 } from "../../../lib/api/agent-harness";
import { agentHarnessApprovalStatusLabel } from "../presentation";

defineProps<{ approval?: AgentHarnessApprovalV2 | null; canAct?: boolean }>();
const emit = defineEmits<{ approve: []; reject: []; revoke: [] }>();
</script>

<template>
  <section class="agent-harness-approval" :data-status="approval?.status || 'pending'" aria-labelledby="approval-title">
    <header>
      <div>
        <p class="agent-harness-eyebrow">Manual approval</p>
        <h3 id="approval-title">人工审批</h3>
      </div>
      <span role="status">{{ approval ? agentHarnessApprovalStatusLabel(approval.status) : "待创建审批" }}</span>
    </header>
    <p class="agent-harness-approval__notice">审批只改变草案/审批状态，不会启动实验或创建 TileSim run。</p>
    <dl v-if="approval">
      <div>
        <dt>approval</dt>
        <dd>
          <code>{{ approval.approval_id }}</code>
        </dd>
      </div>
      <div>
        <dt>draft</dt>
        <dd>
          <code>{{ approval.draft_id }}</code>
        </dd>
      </div>
      <div>
        <dt>validation</dt>
        <dd>
          <code>{{ approval.validation_id }}</code>
        </dd>
      </div>
      <div>
        <dt>approval digest</dt>
        <dd>
          <code>{{ approval.approval_digest }}</code>
        </dd>
      </div>
      <div>
        <dt>principal / workspace</dt>
        <dd>
          <code>{{ approval.principal }}</code> / <code>{{ approval.workspace_id }}</code>
        </dd>
      </div>
      <div>
        <dt>policy / schema</dt>
        <dd>
          <code>{{ approval.policy_revision }}</code> / <code>{{ approval.schema_set_revision }}</code>
        </dd>
      </div>
      <div>
        <dt>expiry</dt>
        <dd>
          <time :datetime="approval.expires_at">{{ approval.expires_at }}</time>
        </dd>
      </div>
    </dl>
    <p v-if="approval?.single_use">单次使用审批；已消费：{{ approval.consumed ? "是" : "否" }}</p>
    <div v-if="canAct && !approval" class="agent-harness-approval__actions">
      <button type="button" @click="emit('approve')">创建审批</button>
    </div>
    <div v-else-if="canAct && approval?.status === 'approved'" class="agent-harness-approval__actions">
      <button type="button" @click="emit('reject')">拒绝审批</button
      ><button type="button" @click="emit('revoke')">撤销审批</button>
    </div>
  </section>
</template>

<style scoped>
.agent-harness-approval {
  display: grid;
  gap: 0.6rem;
  padding: 0.75rem;
  border: 1px solid var(--line, #d9e0e5);
  border-radius: 0.6rem;
}
.agent-harness-approval header,
.agent-harness-approval dl > div {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}
.agent-harness-approval h3,
.agent-harness-approval p {
  margin: 0;
}
.agent-harness-approval h3 {
  font-size: 0.9rem;
}
.agent-harness-approval p {
  color: var(--muted, #687783);
  font-size: 0.76rem;
}
.agent-harness-approval dl {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  font-size: 0.75rem;
}
.agent-harness-approval dt {
  color: var(--muted, #687783);
}
.agent-harness-approval dd {
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
}
.agent-harness-approval__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
