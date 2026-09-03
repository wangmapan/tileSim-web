# TileSim Web AI Startup Card

本文件适用于 `D:\tileSim-web`。后端 canonical 架构同时遵守 `D:\tileSim\AGENTS.md`。

## 1. 开始前必读

按顺序读取：

1. `AGENTS.md`
2. `docs/AI_HANDOFF.md`
3. 稳定版维护或交接任务读取 `docs/NEXT_STABLE_MAINTENANCE_PROMPT.md`
4. 当前任务涉及的代码和测试
5. 仅在需要追溯时读取 `docs/development/`

`docs/AI_HANDOFF.md` 是当前事实来源；阶段文档是历史证据，不能用旧状态覆盖当前状态。

## 2. 当前状态

- F0-F8 与 F10 发布机制已验证；F9 descriptor v2 已部署且 authenticated capability probe 返回 available，live Provider acceptance 与人工 citation entailment review 尚未执行。
- 当前稳定版候选基线：61/61 TileSim CTest、265/265 frontend、78/78 Bridge、29/29 desktop fixture Playwright；上一部署的 5/5 live deployment Playwright 保持历史证据。F9 live model repetitions 仍为 0。
- 产品范围只包含电脑网页端；不要为移动端增加实现或验收工作。
- 前端工作目录可能长期包含 F0-F4 未提交改动。保留用户改动，不 reset、不清理、不擅自提交。
- `127.0.0.1:5173` 可能运行用户正在使用的 Bridge。除非用户明确要求部署，不停止、不重启、不替换它。
- Bridge 测试使用临时端口；Playwright 使用自己的 Vite fixture。

## 3. 证据与架构规则

- 使用 canonical subsystem `S0-S9`。
- flow-layer 显示为 `S0 -> S1 -> S2 -> {S3,S4,S5} -> S6`；S3/S4/S5 是并列资源语义。
- 前端只展示、校验、索引、排序、分组和做可追溯的显示级换算；不得重算或补造模拟指标。
- 区分 `0`、missing、expected absence、not covered、unsupported schema 和 not applicable。
- `real_trace`、`synthetic_trace`、`compatibility_harness_trace` 不得相互升级。
- requested fidelity 和 resolved fidelity 分开显示；不得把 Analytical/DES 描述成 Cycle。
- synthetic consistency 不得显示为 held-out validation。
- 64 位 ps/bytes 字段必须走无损 JSON 路径。

## 4. 代码边界

- view 只做页面编排，不直接调用 `bridgeApi`，也不导入其他 feature 内部文件。
- feature 通过公共 `index.ts` 协作。
- `components/ui` 不访问 store、feature、Bridge API 或报告 schema。
- server state 使用 TanStack Query；workspace/session/history/bridge UI state 使用 Pinia。
- Query key 保留 run ID、backend identity、schema-set revision 和 artifact SHA-256。
- Week 7 backend-global query 必须保留 backend identity 与 schema-set revision；三个固定 CLI 操作共享 Bridge 单槽，前端按 evidence map -> calibration -> orchestration 顺序请求。
- 进入 backend-global 页面不得清除当前 run；run-bound 和 backend-global state 分开维护。
- `src/store/dashboard.ts` 是兼容 controller，不要把状态重新集中进去。
- 页面引导定义归 `src/features/guided-help/` 所有，不要写回 navigation model；并行开发的新英文文案分别写入 `src/i18n/workstreams/`，避免扩大共享 legacy catalog。
- Bridge 依次使用 `api`、`contracts`、`services`、`repositories`、`infra`；`server.py` 只保留配置、兼容 wrapper 和端点协调。
- 保留 `server` wrapper 的测试 patch 接口，尤其是 execution/subprocess 故障注入。

## 5. 修改规则

- 渐进修改，不做无验证的全目录重写。
- 修改 Bridge contract 后运行 `pnpm contracts:generate`，并提交生成结果；普通任务只运行 drift check。
- 修改报告字段、证据解释或 subsystem 范围时，同时更新 UI 说明与开发计划。
- 不把 `runs/`、`runtime/`、`dist/` 或测试结果加入版本控制。

## 6. 完整门禁

```powershell
pnpm contracts:check
pnpm deps:check
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm build
Push-Location bridge
python -m py_compile server.py test_server.py api/responses.py contracts/validation.py contracts/run_request.py infra/identity.py repositories/runs.py services/execution.py services/week7.py
python -m unittest test_server.py
Pop-Location
git diff --check
pnpm test:e2e
```

当前稳定版候选基线：265 个 frontend tests、78 个 Bridge tests、29 个 desktop fixture Playwright tests。live deployment 仍以已部署版本的独立门禁为准。
