# TileSim Web AI Handoff

**事实日期**：2026-09-11

**产品范围**：电脑网页端、local Bridge、版本化契约和 Windows/WSL 本地部署

**当前状态**：Phase 1 全局 Agent 侧栏、八字段本地草案、可移植部署入口与文档治理已发布；公开仓库干净克隆的完整部署已验证；未部署 5173

## 1. 必读

1. `AGENTS.md`
2. `docs/README.md`
3. 本文件
4. `docs/getting-started/AI_DEPLOYMENT_AND_HANDOFF.md`
5. 当前模块 contract、公共入口和 tests

`docs/archive/` 只用于追溯，不是当前事实来源。

## 2. 当前代码事实

- Vue 前端、Python Bridge、OpenAPI/JSON Schema、generated contracts、fixture/E2E 和 immutable release 工具均在本仓库。
- 完整仿真运行仍依赖独立 TileSim 后端仓库；bootstrap 可自动克隆。Evidence Agent 外部模型为可选配置。
- Web 集成交付、部署可移植性修复和对应回归已进入公开 `origin/main`；公开部署功能基线为
  `b2958e796eb8e3b7bb8bd7cc95d8972195571d4d`。
- 后端公开 `origin/main` 为 `a876859a44f660c4627dab495034d52b4ae61f57`。Capability Catalog 引用的不可变证据
  revision `7e5a8c6a5cf738bd24608b440a61b62dee8d1881` 可由该公开仓库解析，并保留在公开
  `codex/phase0d-backend-evidence-clean` 分支。
- 公开发布状态为 `published_clean_clone_verified`。2026-09-11 从 GitHub 全新克隆 Web 与后端后，完整
  bootstrap 在 `-NoRestart` 模式通过：后端 63/63 CTest、前端 506 passed/8 skipped、生产构建与
  immutable release 均成功；完整部署仍必须保留后端 evidence revision gate。
- Phase 0D 已发布 Capability Catalog/Profile Schema v1；八个 `agent_exposed` 字段有 execution closure，五类真实 Profile 仍为 `0/unavailable`，没有 calibration 或 held-out validation。
- Phase 1 右侧 Agent 栏是单轮、确定性的本地草案 Copilot，不连接模型、不创建 run、不持久化对话。它只接受正式八字段，对模型、设备、卡数、TP/PP/EP、placement、物理 KV、集合通信算法和 SLO 失败关闭。
- Evidence Agent descriptor 保持 `tilesim.bridge.evidence_agent_descriptor.v2`；request/response/citation/snapshot 保持 v1。
- create-run 顶层保持 `tilesim.bridge.create_run_request.v1`，nested design-space v1/v2 双版本行为不变。
- F9 live model repetitions 仍为 0；fake/fixture 只证明 contract 和 synthetic consistency。人工 citation entailment 尚未完成。

Phase 1 详细状态见 `docs/F9_AGENT_ORCHESTRATION/19_PHASE1_WEB_LOCAL_ACCEPTANCE.md`，Agent 长期路线见该目录的 README 与 Gap Register。

## 3. 不可破坏边界

- 不 reset、clean、覆盖用户未提交改动；没有授权不 commit/push。
- `127.0.0.1:5173` 是用户服务；没有明确部署授权不停止、不重启、不替换。
- 不读取或输出 `TILESIM_EVIDENCE_AGENT_*` 的值，不把 credential 写入仓库、日志或命令行。
- 前端不得重算模拟指标、补造 claim、升级 provenance/fidelity 或用 fixture 关闭 live/calibration/held-out Gap。
- uint64 ps/bytes/count 保持无损；requested/resolved fidelity 分离；资源语义模块保持并列；正式 citation 绑定 run/artifact/schema/SHA/Pointer/stable subject。
- Evidence 两类 409 都锁定原 key，只有显式 discard 才能开始新分析；不得自动重新调用 Provider。

## 4. 代码地图

```text
src/app/                         Router 与装配
src/contracts/                   Bridge/report contract 与 generated code
src/adapters/                    versioned payload -> stable view model
src/entities/agent-*/            Agent 本地 typed domain/context
src/features/agent-*/            Copilot Shell、intent compiler 与集成
src/features/run-experiment/     descriptor 表单和唯一 request builder
src/features/evidence-agent/     正式 Evidence Agent 展示与提交编排
src/views/                        页面编排
bridge/contracts/                OpenAPI、Schema 与正式校验
bridge/services/                 执行、capability、Evidence workflow
bridge/providers/                固定 Provider adapter
scripts/                         bootstrap、构建、部署、回滚和启动
tools/launcher/                  可选 Windows GUI 启动器源码
docs/F9_AGENT_ORCHESTRATION/     Agent 编排 current baseline、Gap、路线和验收
docs/archive/                    历史记录
```

## 5. 部署事实

- Web checkout 可位于任意 Windows 目录；脚本不得写死本机用户名或盘符。
- `scripts/bootstrap-workbench.ps1` 是干净 clone 的入口。
- 默认后端源码和 deployment worktree 是 Web checkout 的同级 `tileSim/` 与 `tileSim-backend/`，均可通过参数覆盖。
- Windows GUI 启动器由 `tools/launcher/build-launcher.ps1` 构建到 Web 根目录的 `启动TileSim工作台.exe`；
  frozen launcher 从 EXE 所在目录定位 checkout，WSL build cache 同时绑定 revision 与 deployment 源码路径。
- `runtime/`、`runs/`、`dist/`、`node_modules/` 都不进入 Git。
- 部署脚本使用 immutable `bridge + dist` snapshot；health 必须绑定 source/build/release/schema identity。

## 6. 当前优先级

1. 不自动进入 Phase 2。先审计五类 Profile、模型/设备/引擎选择、TP/PP/EP、物理 KV、工作负载与网络累计链 DoR。
2. 后续正式多轮 Agent 需要 Conversation、Draft、Validation、Clarification、Approval、Workflow、RAG 和工具 contract；不要在浏览器内存模拟关闭 Gap。
3. 文档变更继续按 `docs/README.md` 分类；结束阶段、一次性提示词和旧证据只进入 `docs/archive/`。

## 7. 完整门禁

以 `AGENTS.md` 为准。模块测试先行，最后运行 contracts、dependency、typecheck、Vitest、lint、format、build、Bridge unittest、fixture E2E 和 `git diff --check`。需要 deployed/live 服务的测试必须保持独立并准确报告 skip。

## 8. 交接报告必填

- changed files 和职责边界；
- identity/revision 是否变化；
- canonical、uint64、stale、409、502/503/504、citation 与 retention 回归；
- fixture/live/calibration/held-out 各自状态；
- 全部门禁和 skipped 项；
- 是否操作 5173、credential、Provider、run、commit 和 push。
