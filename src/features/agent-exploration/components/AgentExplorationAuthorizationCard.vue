<script setup lang="ts">
import type { AgentHarnessExplorationSession } from "../../../contracts/generated/agent-harness";
defineProps<{ session: AgentHarnessExplorationSession }>();
defineEmits<{ authorize: [] }>();
const labels: Record<string, string> = { experiment: "实验配置页", execution: "运行页", metrics: "结果页" };
</script>
<template>
  <section class="agent-exploration-card" data-agent-exploration-authorization>
    <h3>自动探索授权</h3>
    <dl>
      <div>
        <dt>探索目标</dt>
        <dd>
          {{ session.objective.metric_path }}（{{
            session.objective.direction === "minimize" ? "越小越好" : "越大越好"
          }}）
        </dd>
      </div>
      <div>
        <dt>可调整参数</dt>
        <dd>{{ session.parameter_grants.length }} 个已授权参数（确定性扫描）</dd>
      </div>
      <div>
        <dt>当前页面</dt>
        <dd>{{ labels[session.current_page_id] || session.current_page_id }}</dd>
      </div>
      <div>
        <dt>最大轮次 / 实验数</dt>
        <dd>{{ session.budget.max_rounds }} / {{ session.budget.max_runs }}</dd>
      </div>
      <div>
        <dt>并发数</dt>
        <dd>1（串行）</dd>
      </div>
      <div>
        <dt>模型请求 / 工具请求上限</dt>
        <dd>{{ session.budget.max_model_calls }} / {{ session.budget.max_tool_calls_per_round }}</dd>
      </div>
      <div>
        <dt>最大连续无改进 / 失败数</dt>
        <dd>{{ session.budget.max_no_improvement }} / {{ session.budget.max_failures }}</dd>
      </div>
      <div>
        <dt>指标来源</dt>
        <dd>已验证指标（本地 synthetic）</dd>
      </div>
      <div v-if="session.planning_plan_digest">
        <dt>已确认部署草案</dt>
        <dd>草案摘要 {{ session.planning_plan_digest }}；建议值已由用户确认</dd>
      </div>
    </dl>
    <p>授权后助手会锁定当前页面上下文和参数范围，实验配置期间控件只读。</p>
    <button type="button" @click="$emit('authorize')">允许助手自动探索</button>
  </section>
</template>
