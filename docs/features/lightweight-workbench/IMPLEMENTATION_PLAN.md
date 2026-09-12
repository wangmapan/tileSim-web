# 实施计划（L1b 已完成，后续阶段待批准）

> 2026-09-13：L1b 完成独立轻量 Shell、五项 URL 导航、一级模式切换和占位页；L2 及 Agent/Provider 相关阶段未启动。

本计划只有在产品确认双工作台方案后启动。当前阶段为文档评审，不修改现有原型代码。

## Phase L0：方案冻结与基线（1–2 天）

**输入**：本目录全部方案、当前 `AI_HANDOFF.md`、现有路由/Agent 公共入口。

**工作**：确认首屏入口、路由命名、最近模式策略、轻量任务四类、首个成功路径；记录不做事项和 Agent interface gap。

**DoD**：产品、设计、前端、Agent 负责人签字；`docs:check` 通过；不改变 runtime identity。

## Phase L1：入口与 shell（2–3 天）

**工作**：将 `/` 改为选择页；建立轻量独立 shell 和导航；保留专业 shell、旧 URL 和 run 恢复；接入模式切换偏好。

**DoD**：F-01/F-02/F-07/F-08 通过；专业版关键路由回归；不把轻量入口嵌入专业 Overview。

## Phase L2：任务与学习内容（3–5 天）

**工作**：实现任务首页、概念卡、模板卡、首次引导和空状态；所有模板标注 example/只读/预计耗时。

**DoD**：无术语用户能找到正确任务；引导可跳过/重开；无移动端额外实现。

## Phase L3：Agent 只读工作流（3–5 天）

**工作**：通过公开 `index.ts` 接入 capability snapshot、compiler、typed blocks、redaction；实现理解摘要、澄清、限制、错误和 stale 视图；不复制任何 canonical 逻辑。

**DoD**：F-04/F-05、契约与安全验收通过；Provider/create-run/credential 调用计数为 0。

## Phase L4：专业衔接与证据详情（2–3 天）

**工作**：为摘要增加专业详情链接；绑定 run/artifact/schema/revision；设计 stale、unsupported、not covered 的展开详情。

**DoD**：专业表单、run 状态、Evidence Agent 回归；切换不清除 run-bound state。

## Phase L5：无障碍、测试与发布（3–4 天）

**工作**：组件/Vitest、Playwright fixture、axe、200% zoom、主题/reduced-motion、截图人工审查；执行完整门禁和部署前 diff 审计。

**DoD**：`LIGHTWEIGHT_WORKBENCH_ACCEPTANCE.md` 全部通过；变更清单与回滚步骤可复现；用户确认后才部署 5173。

## 文件边界

预计允许修改：`src/app/router.ts`、`src/App.vue`（仅装配）、`src/views/` 的入口/轻量视图、`src/features/lightweight-workbench/`、对应测试、`src/i18n/workstreams/` 和本目录文档。禁止修改 Agent 内部、Evidence、Bridge contract、后端生产代码、Provider 配置。

## 回滚

按提交粒度回滚轻量入口、路由和 feature 装配，恢复 `/` 到专业版选择逻辑；保留专业版和用户已有改动。回滚前先停止新路由流量（若已部署且获得授权），不使用 `git reset --hard`、`clean` 或覆盖性回滚。

## 风险与缓解

| 风险                         | 缓解                                                   |
| ---------------------------- | ------------------------------------------------------ |
| 原型继续膨胀成错误架构       | L0 冻结 sitemap；每个 PR 对照“并列而非从属”检查        |
| Agent 能力被 UI 误读为可执行 | 所有 CTA 显示只读/未运行；contract 状态直出            |
| 专业版回归                   | 每个阶段运行专业路由 fixture；最终完整门禁             |
| 文案泄露敏感内容             | redaction、非敏感埋点、禁止 raw 持久化                 |
| 未来多轮需求绕过契约         | 以 interface gap 为发布门；新能力先发 contract 再接 UI |

## 每阶段通用 DoR

- 已读取 `AGENTS.md`、`AI_HANDOFF.md`、本目录方案和目标模块公共入口。
- 工作树已有改动已识别；不 reset、clean、stash 或覆盖用户改动。
- 本阶段不需要修改 Bridge contract、Agent 内部、Provider 或后端；若发现需要，立即停止并回到设计评审。
- 测试 fixture 使用独立 Vite/临时端口；未获部署授权不操作 5173。

## 建议提交/审查切片

1. `L1a`：根选择页与路由合同（不含轻量业务）。
2. `L1b`：双 shell 装配与模式切换回归。
3. `L2a`：任务首页/概念内容及 i18n。
4. `L2b`：空状态、等待、帮助和无障碍。
5. `L3a`：公开 Agent adapter 与单元测试。
6. `L3b`：typed block/错误/stale UI。
7. `L4`：run/result 深链接和专业详情衔接。
8. `L5`：E2E、视觉 QA、文档与发布证据。

每个切片应能独立回滚；不把路由重构、Agent 接入和视觉重写压进同一不可审查变更。

## 验证梯度

- 修改组件：相关 Vitest + typecheck。
- 修改路由/shell：路由单测 + 专业/轻量关键 Playwright fixture。
- 修改 Agent adapter：compiler/integration 邻接测试 + unknown/stale/uint64 负向测试。
- 修改文案/样式：i18n、lint、format、axe、200% zoom、深浅主题视觉检查。
- Phase L5：执行 `AGENTS.md` 完整门禁，并单列 skipped/live/calibration/held-out 状态。

## 交付报告必填

- changed files 与每个文件职责；
- 专业/轻量 shell 是否真正分离；
- Agent、Bridge、Provider、identity/revision 是否变化；
- create-run、credential、Provider 调用次数；
- unknown/stale/unsupported/provenance/fidelity/uint64 回归；
- 测试 passed/skipped/failed；
- 是否操作 5173、是否 commit/push、回滚点。
