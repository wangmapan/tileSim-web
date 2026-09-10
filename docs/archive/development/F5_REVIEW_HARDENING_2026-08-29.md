# F5 Review Hardening

**日期**：2026-08-29  
**范围**：电脑网页端、local Bridge；未重启或替换 5173

## 关闭的问题

- 断连 deep link 不再把 URL run ID 写成已加载身份；页面显示持久、可翻译的证据未加载提示。
- Overview 原始工件改为 artifact manifest 驱动，移除私有 metadata 和缺失可选工件的 404 入口。
- Pointer 不存在时在完整 JSON 上方保留错误；关闭面板取消搜索、释放 Worker、原文和精确 Query cache。
- 历史对比的“清除全部”进入 store action 并持久化。
- Modal 完成 Escape、focus trap、background inert 和 focus restore；主题 listbox 完成方向键、Home/End 和焦点恢复。
- danger/warning toast 改为持久提示，普通提示延长到 6 秒且 hover/focus 暂停。
- 离开实验页会 abort 前端 SSE/轮询，后端任务继续；页面明确告知后台运行。
- Bridge 默认限制 1 个活动 TileSimCLI；不同 key 的并发任务返回 retryable 429，相同 key 仍幂等恢复。

## 新增回归

- disconnected deep-link identity
- manifest-only artifact links
- missing Pointer persistent alert
- theme listbox keyboard navigation
- modal Escape/focus restore
- comparison clear persistence
- Bridge distinct-run capacity

## 验证基线

- Frontend：92/92
- Bridge：29/29
- Desktop Playwright：16/16
- TypeScript、ESLint、Prettier、dependency boundaries、contract drift、production build 和 `git diff --check`：通过

## 保留债务

- 结构化报告仍在主线程同步生成完整 HTML。
- 多个大型工件的浏览器级内存趋势需要后续独立性能门禁。
- `JsonArtifactPanel.vue`、execution CSS 和 i18n 词典仍需在不破坏 feature 边界的前提下渐进拆分。
