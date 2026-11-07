<script setup lang="ts">
import type { ExplorationDetail } from "../types";
import { isExplorationTerminalState } from "../types";
defineProps<{ detail: ExplorationDetail }>();
defineEmits<{ pause: []; resume: []; cancel: [] }>();
const stateLabels: Record<string, string> = {
  waiting_authorization: "等待授权",
  exploring: "生成候选",
  waiting_run: "等待实验完成",
  comparing: "比较最佳方案",
  paused: "已暂停",
  completed: "已完成",
  cancelled: "已停止",
  budget_exhausted: "预算用尽",
  recovery_required: "需要恢复",
  run_failed: "实验失败",
  context_expired: "页面上下文已过期",
  parameter_validation_failed: "参数校验失败",
  authorization_expired: "授权已过期",
  authorization_revoked: "授权已撤销",
  manual_intervention_required: "需要人工处理",
};
const canControl = (state: unknown) => !isExplorationTerminalState(state);
</script>
<template>
  <section class="agent-exploration-progress" data-agent-exploration-progress>
    <header>
      <h3>自动探索进度</h3>
      <strong>{{ stateLabels[detail.session.state] || detail.session.state }}</strong>
    </header>
    <p>
      当前轮次 {{ detail.session.current_round }} / {{ detail.session.budget.max_rounds }} · 已完成实验
      {{ detail.session.run_count }}
    </p>
    <p v-if="detail.candidate">
      当前候选：{{ detail.candidate.sequence }}（{{ detail.candidate.origin === "rule" ? "确定性扫描" : "结构化模型候选" }}，{{ detail.candidate.metric_verified ? "指标已验证" : "等待指标" }}）
    </p>
    <p v-if="detail.session.best_candidate_id">
      当前最佳方案：已验证的第 {{ detail.session.current_round }} 轮方案 · 指标
      {{ detail.summary?.best_value ?? "等待结果" }}
    </p>
    <p v-if="detail.session.stop_reason">停止原因：{{ detail.session.stop_reason.detail }}</p>
    <div v-if="canControl(detail.session.state)">
      <button v-if="detail.session.state === 'paused'" type="button" @click="$emit('resume')">继续</button>
      <button v-else type="button" @click="$emit('pause')">暂停</button>
      <button type="button" @click="$emit('cancel')">停止</button>
    </div>
  </section>
</template>
