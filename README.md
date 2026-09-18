# TileSim Web

TileSim Web 是 TileSim 的电脑端实验、证据分析与 Agent 编排工作台。仓库包含完整 Vue 前端、Python Bridge、版本化契约、生成代码、测试、Windows/WSL 部署脚本和启动器源码。

## 从干净克隆开始

完整仿真还需要 TileSim 后端。Bootstrap 会在 Web 仓库同级目录克隆后端、安装锁定的前端依赖、构建并验证后端与 Web，然后生成不可变本地 release：

```powershell
git clone https://github.com/wangmapan/tileSim-web.git
Set-Location tileSim-web
corepack enable
.\scripts\bootstrap-workbench.ps1
```

对外分发前，Web 发行提交和 Capability Catalog 引用的后端 execution-evidence revision 必须已发布到相应远端；
bootstrap 会在完整部署前验证该 revision 可达性并失败关闭。当前发布状态见[部署与接手手册](docs/getting-started/AI_DEPLOYMENT_AND_HANDOFF.md)。

默认目录为同级的 `tileSim-web/`、`tileSim/` 和 `tileSim-backend/`。只验证并构建前端可运行：

```powershell
.\scripts\bootstrap-workbench.ps1 -BuildOnly
```

API Key、运行结果、deployment manifest、release snapshot 和构建产物不会进入 Git。Evidence Agent 的外部模型服务是可选能力，不影响基础工作台安装。

需要图形启动器时，在前端仓库内执行：

```powershell
.\tools\launcher\build-launcher.ps1
```

产物为仓库根目录下的 `启动TileSim工作台.exe`。EXE 从自身目录定位前端，不应复制到独立的团队资料目录。

## AI 接手

1. [AGENTS.md](AGENTS.md)
2. [文档总入口](docs/README.md)
3. [当前 AI 交接](docs/AI_HANDOFF.md)
4. [部署与接手手册](docs/getting-started/AI_DEPLOYMENT_AND_HANDOFF.md)
5. 当前任务对应的架构、契约、功能和测试

不要用 `docs/archive/` 中的阶段记录覆盖当前事实。

## 日常命令

```powershell
pnpm dev
pnpm build
.\scripts\start-workbench.ps1
.\scripts\update-backend.ps1
```

服务地址：<http://127.0.0.1:5173>。开发地址：<http://127.0.0.1:4173>。

## 完整门禁

```powershell
pnpm contracts:check
pnpm docs:check
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

详细依赖、部署模式、故障恢复、安全边界和 AI 验收流程见[部署与接手手册](docs/getting-started/AI_DEPLOYMENT_AND_HANDOFF.md)。
