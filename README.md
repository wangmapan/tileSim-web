# TileSim Web

TileSim Web 是独立于 `D:\tileSim` 的本地仿真实验与证据分析工作台。前端使用 Vue 3 + Vite；Python bridge 负责提供白名单 API、调用本地 `TileSimCLI`，并把每次运行的输入与报告保存到 `runs/`。

## AI 接手

后续 AI 按以下顺序读取：

1. [`AGENTS.md`](AGENTS.md)
2. [`docs/AI_HANDOFF.md`](docs/AI_HANDOFF.md)
3. 当前任务涉及的代码和测试

`docs/development/` 是历史验证证据，不代表当前状态。当前 F0-F6A 已验证，下一阶段是 F6B run-bound S7/S8/S9 联动；产品只维护电脑网页端。

## 首次安装

需要 Node.js 20 或更高版本，以及 pnpm：

```powershell
pnpm install
pnpm build
```

构建产物写入 `dist/`。bridge 会优先托管 `dist/`；如果尚未构建，则只回退到源码目录供开发排查。

## 后端部署与日常启动

先读取 `runtime/backend-current.json` 或请求 `/api/health` 确认当前部署来源，不要直接运行更新脚本。当前用户服务使用 **本地快照模式**，来源为 `D:\tileSim` 的本地 `main`：

```powershell
Invoke-RestMethod http://127.0.0.1:5173/api/health | ConvertTo-Json -Depth 8
```

### 模式 A：内容摘要绑定的本地快照（当前模式）

仅在用户明确要求重新部署时执行：

```powershell
.\scripts\deploy-local-backend.ps1 -SourceRoot D:\tileSim
```

该模式在构建前后核对完整工作树摘要，并在 Bridge 启动与每次执行前同时核验源码摘要和构建摘要。部署后若后端工作树继续变化，执行接口会失败闭合，重新部署后才会恢复。不要用独立 worktree 模式覆盖用户正在验证的本地改动。

### 模式 B：干净的 `origin/main` 独立 worktree

需要明确切回提交版本时，更新脚本使用 `D:\tileSim-backend`，不会切换日常开发目录 `D:\tileSim`：

```powershell
.\scripts\update-backend.ps1
```

脚本会依次刷新主线、更新独立 worktree、使用提交专属构建目录编译、运行 TileSim 和 Web 测试、执行一次前端生产构建、写入部署清单，并且只在全部通过后重启 Bridge。该操作会替换 5173 的后端来源，必须由用户授权。

部署目录允许保留一个完全未跟踪的 `trace_gen/` 附属树，但仅限目标提交本身不管理该路径时。其他未提交修改仍会阻断更新；如果目标提交包含 `trace_gen/`，脚本也会停止并保留现有附属树，避免静默覆盖。

仅按当前部署清单重新启动 bridge：

```powershell
.\scripts\start-backend.ps1
```

也可以在 WSL 中手工启动 bridge，但手工启动必须同时提供源码、CLI 与构建版本；缺少版本清单时执行 API 会拒绝运行，避免源码与二进制错配。

```bash
TILESIM_ROOT=/mnt/d/tileSim-backend \
TILESIM_CLI=/home/mapanwang/tilesim-backend-builds/<commit>/TileSimCLI \
TILESIM_BUILD_REVISION=<commit> \
TILESIM_DEPLOYMENT_MANIFEST=/mnt/d/tileSim-web/runtime/backend-current.json \
python3 /mnt/d/tileSim-web/bridge/server.py
```

启动后打开：

<http://127.0.0.1:5173>

前端源码修改后运行：

```powershell
pnpm build
```

开发时可同时启动 bridge 与 Vite：

```powershell
pnpm dev
```

开发页面位于 <http://127.0.0.1:4173>，`/api` 会代理到 bridge。

## 验证

```powershell
pnpm contracts:check
pnpm deps:check
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm build
pnpm test:e2e
Push-Location bridge
python -m py_compile server.py test_server.py api/responses.py contracts/validation.py contracts/run_request.py infra/identity.py repositories/runs.py services/execution.py services/week7.py
python -m unittest test_server.py
Pop-Location
git diff --check
```

## 功能边界

- 可配置调度、batch、KV、通信负载与 Scale-up/Scale-out 参数。
- 可直接编辑或导入 Runtime trace 与 Fabric topology JSON。
- 可导入、查看、恢复和对比本地运行报告。
- 报告导入会校验 Trace 身份，避免混合不同运行的证据。
- 页面逐项展示来源、校准状态、允许声明范围和各子系统实际 fidelity。
- 顶部可一键切换中文与英文；语言选择会在浏览器中持久化，原始 JSON、证据 ID 和字段路径保持不变。
- 分层结果页按 `S0 -> S1 -> S2 -> {S3,S4,S5} -> S6` 展示当前后端报告，并按需展开真实关联记录。
- Week 7 证据工作台展示固定的 S8 offline calibration workflow、S9 字段血缘和确定性五步编排；它是 backend-global 示例，不等于当前 run 的证据，也不是生成根因或建议的语言 Agent。
- S9 `attribution_audit` 在归因页和结构化导出中保留守恒、份额、传播完整度与 issues。
- Week 7 三个固定操作共享 Bridge 单槽，前端按顺序执行，避免并发触发 retryable 429。
- 浏览器缓存只保存当前视图、运行 ID 和对比选择，不缓存报告正文。

当前受控执行场景仍为 `S1 → S6`。合成 Trace 只能支持一致性和探索性比较，不能替代真实校准或 held-out 验证。

分层结果的字段来源和证据边界见 [结果界面说明](docs/WEEK6_RESULTS_UI.md)，Week 7 固定证据链见 [Week 7 界面说明](docs/WEEK7_EVIDENCE_UI.md)；当前任务、债务和接手步骤见 [AI Handoff](docs/AI_HANDOFF.md)；后续阶段见 [开发计划](docs/FRONTEND_DEVELOPMENT_PLAN.md)。当前前端不包含 PR4 Trace 功能。

## 目录

```text
src/app/          Router 与应用装配
src/contracts/    外部报告与 Bridge 契约
src/adapters/     版本化报告到 view model 的适配
src/entities/     dashboard 与 navigation 领域模型
src/features/     实验、证据、历史、artifact 与 execution inspector
src/views/        路由页面编排；只使用 feature 公共入口
src/components/   跨页面界面组件
src/stores/       workspace、session、bridge、history 和 Pinia 实例
src/store/        useDashboard 兼容 controller、状态组装与持久化
src/lib/          API transport、QueryClient、格式化和报告工具
bridge/api/       HTTP response adapter
bridge/contracts/ OpenAPI、JSON Schema 与请求校验
bridge/services/  输入物化与 CLI 执行 workflow
bridge/repositories/ run metadata 与 artifact persistence
bridge/infra/     Git、部署和 runtime identity
runs/             本地运行产物（不进入 Git）
runtime/          当前后端部署清单（不进入 Git）
scripts/          后端更新与启动脚本
```
