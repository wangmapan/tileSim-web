# TileSim Web AI Startup Card

本文件适用于 `D:\tileSim-web`。后端 canonical 架构同时遵守 `D:\tileSim\AGENTS.md`。

## 1. 开始前必读

按顺序读取：

1. `AGENTS.md`
2. `docs/AI_HANDOFF.md`
3. 部署或交接任务读取 `docs/getting-started/AI_DEPLOYMENT_AND_HANDOFF.md`
4. 当前任务涉及的架构、契约、功能说明、代码和测试
5. 仅在需要追溯时读取 `docs/archive/`

`docs/AI_HANDOFF.md` 是当前事实来源；阶段文档是历史证据，不能用旧状态覆盖当前状态。

## 2. 当前状态

- F0-F8 与 F10 发布机制已验证；F9 descriptor v2 已部署且 authenticated capability probe 返回 available，live Provider acceptance 与人工 citation entailment review 尚未执行。F9 Phase 1 侧栏、Phase 2A/2B 契约与后端 Phase 2C lowering 已完成，Bridge 侧 Run Intake v2 路由尚未接线。
- 当前门禁基线（2026-09-18 实测；该批工作包已于同日**本地提交**，`HEAD` = `446f21d`，但**推送被本机网络策略阻断**——详见 `docs/AI_HANDOFF.md` 的 2026-09-18 发布批次条目）：Web Vitest **596 passed / 8 skipped**（70 files）、Bridge `unittest` **143 passed**、`vue-tsc` / `vite build` / `contracts:check` / `docs:check`（43 篇）/ `deps:check`（255 源文件）/ `git diff --check` passed。`dashboard.spec.js:2079` 的 busy 泄漏竞态 `DEF-BUSY-RACE-001` 已由 `WP-2D-04` 修复并关闭（`state.busy` 全仓唯一写点收敛到 `src/store/dashboard-state.ts:63`）。`WP-2D-05`（2026-09-18）后再次取得干净 tally：`--workers=1 --reporter=list` → **51 passed / 6 skipped / 0 failed，exit 0，6.4m，无 worker 强杀**，覆盖全部 57 条（含 `large-artifact-worker`）。**但 worker 收尾卡死是间歇性既有环境缺陷、未根除**：同一会话另有 3 次运行在用例全部零失败后出现 `worker-1 process did not exit within 300000ms after stop, force-killed it`，其中 1 次是把 `WP-2D-05` 改动**逆操作回退**后跑的 A/B 对照（现象完全相同）→ 与代码改动无关；卡死落在 `desktop → large-artifact-worker` 项目切换处时该 1 条会 `not-reached`，须另起一次完整运行覆盖，不得当作通过。**纪律：全量 e2e 不得与其它重量级门禁并发跑**（并发曾致 `:2079` 的 URL 断言偶发失败，空载定向 ×3 全绿）。后端 CTest 与 fixture Playwright 全量本轮未复跑（本机无 C++ 工具链），按 `not-run` 报告。F9 live model repetitions 仍为 0。
- 工作台展示覆盖度（C0 36 项 + 第 7b 条）已由 `WP-2D-01` 补齐并验收，五态 `availability` 语义已恢复；判定见 `docs/architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md` §6.1.1。五态语义残留收口（行级 `cell()`、`LayerRecordTable`）与缺陷 `DEF-BUSY-RACE-001` 由 `WP-2D-04` 完成，判定见同文档 §6.4.1。§6.4.1 登记的「导出 HTML 状态列」经 §6.4.2 裁定为真缺陷，**已由 `WP-2D-05` 修复并验收（判定见 §6.5.1）**：导出状态列改为与屏幕同规则（已报告状态走 `statusLabel()` + `statusTone()`；未报告 / `unknown` 走共享 `missing` 态，不再出 `—` 或裸 `unknown`）。同批另两条残留（裸字典二元渲染、`buildList()` 容器口径）已裁定**维持现状**，口径见 §6.4.2，**不得**以「统一五态」为由改动。
- 五类正式 Profile records 仍为 `0/unavailable`；Phase 2 的数据侧与执行侧仍被阻塞，不得新增 `agent_exposed` 字段。
- 产品范围只包含电脑网页端；不要为移动端增加实现或验收工作。
- 2026-09-18 实测：工作树 clean，本地 `HEAD` = `446f21d`，**领先 `origin/main` 3 个提交且未推送**（本机无法访问 `github.com`，系统代理返回 502、直连被 reset）。2026-09-17 时曾实测 `HEAD == origin/main`。若出现未提交改动（用户或其他 Agent 的），保留它们，不 reset、不清理、不擅自提交。
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
- 文档变更遵守 `docs/README.md`：当前状态只写入 `docs/AI_HANDOFF.md` 与模块 current baseline；结束阶段时把 dated
  记录移入 `docs/archive/`，不把旧测试数字原地改写成当前数字。
- 不把 `runs/`、`runtime/`、`dist/` 或测试结果加入版本控制。

## 6. 完整门禁

```powershell
pnpm contracts:check
pnpm docs:check
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
