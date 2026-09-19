<script setup lang="ts">
import { useI18n } from "../../../i18n";

const { t } = useI18n();

type EmptyStateKind = "bridge" | "run" | "draft";

const props = withDefaults(
  defineProps<{
    kind: EmptyStateKind;
    title?: string;
    detail?: string;
  }>(),
  { title: undefined, detail: undefined },
);

const copy: Record<EmptyStateKind, { title: string; detail: string; action: string }> = {
  bridge: {
    title: "暂时无法连接到 Bridge",
    detail: "校验和提交暂时关闭。确认 Bridge 可用后，再回到这里创建运行。",
    action: "了解连接限制",
  },
  run: {
    title: "还没有可查看的运行",
    detail: "完成一次正式 run 后，合法且可验证的结果会显示在这里。",
    action: "查看使用限制",
  },
  draft: {
    title: "当前页面还没有草案",
    detail: "填写基础配置后可保存当前草案并继续校验；已提交 run 会按 run ID 恢复。",
    action: "页面帮助",
  },
};
</script>

<template>
  <section class="lightweight-empty-state" role="status" aria-live="polite">
    <p class="section-kicker">{{ t("空状态") }}</p>
    <h2>{{ t(props.title ?? copy[props.kind].title) }}</h2>
    <p>{{ t(props.detail ?? copy[props.kind].detail) }}</p>
    <span class="lightweight-empty-state__action">{{ t(copy[props.kind].action) }}</span>
  </section>
</template>

<style scoped>
.lightweight-empty-state {
  display: grid;
  gap: 10px;
  padding: clamp(22px, 4vw, 34px);
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-panel);
  background: var(--surface-subtle);
}
.lightweight-empty-state h2 {
  margin: 0;
  font-size: 22px;
}
.lightweight-empty-state p:not(.section-kicker) {
  max-width: 650px;
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}
.lightweight-empty-state__action {
  color: var(--accent);
  font-size: var(--text-sm);
  font-weight: 650;
}
</style>
