# TileSim Web：AI 部署与接手手册

> 事实日期：2026-09-11
>
> 当前公开发布状态：`published_clean_clone_verified`

## 1. 仓库交付边界

本仓库包含完整前端、Python Bridge、契约、生成代码、测试和部署工具，但不复制 C++ TileSim 后端或外部大模型。完整仿真部署需要联网克隆公开后端；bootstrap 会自动完成。离线且只有 Web 仓库时，可构建和运行 fixture 测试，但不能创建真实 simulation run。

外部模型只用于 Evidence Agent，是可选配置。未配置模型时，基础仿真、报告、证据和 Phase 1 本地参数草案仍可使用。

截至事实日期，完整 Web 交付已进入 `https://github.com/wangmapan/tileSim-web.git` 的 `main`，后端已进入
`https://github.com/lqf0624/tileSim.git` 的 `main`。Capability Catalog 绑定的不可变后端证据 revision
`7e5a8c6a5cf738bd24608b440a61b62dee8d1881` 可由公开后端解析，并保留在公开
`codex/phase0d-backend-evidence-clean` 分支。其他用户可以只依赖这两个公开仓库和下述系统工具完成本地部署；
无需维护者本机的未提交文件、运行数据或凭据。

2026-09-11 已在一个全新临时目录从两个 GitHub 远端克隆并执行完整 bootstrap。验证结果为后端 63/63 CTest、
前端 506 passed/8 skipped、生产构建和 immutable release 全部通过，最终模式为
`validated_deployment_without_restart`。验证使用 `-NoRestart`，未启动、停止或替换 5173。Web 部署功能基线为
`b2958e796eb8e3b7bb8bd7cc95d8972195571d4d`，后端为
`a876859a44f660c4627dab495034d52b4ae61f57`。

## 2. 环境要求

- Windows 10/11、Node.js 20+、Corepack、pnpm 11；
- 完整仿真部署还需要 Git、WSL2（默认 `Ubuntu-24.04`），以及 WSL 内后端 `scripts/build_wsl.sh` 所需的
  CMake/C++/Python 工具链；
- 首次安装可访问 GitHub、npm registry 和 Playwright 下载源。

仓库可位于任意 Windows 盘符。脚本从 checkout 动态解析路径，从 PATH 查找 Node，并在 WSL 当前用户缓存目录构建，不依赖特定用户名。

## 3. 干净克隆与一键部署

```powershell
git clone https://github.com/wangmapan/tileSim-web.git
Set-Location tileSim-web
corepack enable
.\scripts\bootstrap-workbench.ps1
```

Bootstrap 会验证工具链、克隆 `https://github.com/lqf0624/tileSim.git`、安装 Playwright Chromium、建立独立 deployment worktree、运行后端 CTest 和 Web/Bridge 门禁、构建 `dist/`，最后生成 immutable release 和 manifest。默认目录：

```text
<workspace>/tileSim-web
<workspace>/tileSim
<workspace>/tileSim-backend
```

完整部署会先核对 Capability Catalog 中每个后端 evidence revision 是否能由后端 Git 仓库解析。当前默认公开远端已满足该门禁。
若将来 catalog 与后端发布不同步，脚本会在构建前停止；维护者应先发布缺失 revision，或显式传入一个已经包含该 revision 的可信
`-BackendRepositoryRoot`。这不是可跳过的安装检查。

自定义目录：

```powershell
.\scripts\bootstrap-workbench.ps1 `
  -BackendRepositoryRoot E:\TileSim\backend-source `
  -BackendDeploymentRoot E:\TileSim\backend-release `
  -WslDistro Ubuntu-24.04
```

仅构建前端：

```powershell
.\scripts\bootstrap-workbench.ps1 -BuildOnly -SkipBrowserInstall
pnpm preview
```

该模式不检查 WSL、不克隆后端，也不启动或停止 5173。

### 图形启动器

完成 bootstrap 后，可在前端仓库中构建本机图形启动器：

```powershell
.\tools\workbench-launcher\build-launcher.ps1
```

默认产物为 `<tileSim-web>/启动TileSim工作台.exe`，并被 Git 忽略。打包后的 EXE 从自身目录定位前端仓库；
不要将它放入独立的团队资料目录，否则仓库迁移或多 checkout 环境下容易指向错误版本。启动器可以启动已有 release，
也可以拉取后端 `origin/main`、重新验证并部署。WSL 构建缓存同时绑定后端 revision 和 deployment 源码路径，
因此不同 clone/worktree 不会复用错误的 CMake source cache。构建脚本会把当前 Node.js 运行时嵌入 EXE；从资源管理器
双击启动时不依赖其继承的 PATH。Tauri production build 需要 Rust stable MSVC、Cargo、Visual Studio C++ Build Tools/Windows SDK 和 WebView2；完整条件、自检与回滚步骤见
[`../deployment/LAUNCHER_BUILD_DEPLOYMENT_ROLLBACK.md`](../deployment/LAUNCHER_BUILD_DEPLOYMENT_ROLLBACK.md)。旧 Tkinter 源码和已有 EXE 在新打包验收完成前继续保留。

## 4. 日常运行

```powershell
.\scripts\start-workbench.ps1
.\scripts\update-backend.ps1
.\scripts\deploy-local-backend.ps1 -SourceRoot <backend-worktree>
```

`update-backend.ps1` 会完整验证、固化并切换 release；`deploy-local-backend.ps1` 只用于明确验证未提交后端工作树。两者可能停止或重启 5173，AI 未获部署授权时不得执行，应用 `-NoRestart`、fixture 或隔离端口。

## 5. 可选模型配置

```powershell
.\scripts\configure-evidence-agent.ps1
.\scripts\configure-evidence-agent.ps1 -Action Show
```

Key 只经隐藏输入进入脚本，以 Windows 当前用户 DPAPI 密文保存在 `runtime/evidence-agent.local.json`。不要把 key 放进命令参数、日志、截图、issue 或 AI 对话。换电脑或 Windows 用户后必须重新配置。

## 6. 不进入 Git 的运行态

- `node_modules/`：由 lockfile 恢复；
- `dist/`：由构建生成；
- `runtime/`：manifest、release、模型设置和临时构建；
- `runs/`：用户运行输入和报告；
- `test-results/`、`playwright-report/`、`coverage/`：测试产物。

“仓库可部署”表示源码和可重复构建步骤完整，不表示运行数据、凭据或已编译后端随 clone 迁移。

## 7. AI 接手协议

1. 完整读取 `AGENTS.md`、`docs/README.md`、`docs/AI_HANDOFF.md`；
2. 读取目标模块公共入口、contract、adapter 和测试；
3. 检查 `git status --short --branch`、`git worktree list`，保护用户改动；
4. 区分 review、实现和部署授权；
5. 页面开发使用 fixture，Bridge 使用临时端口；
6. 未获授权不操作 5173、不读取 Provider credential；
7. 不以 archive、fixture 或 synthetic consistency 证明 live/calibrated/held-out；
8. view 只编排，跨 feature 走公开入口，canonical request/citation/uint64/provenance 不复制实现。

## 8. 验收命令

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

Skipped deployed/live tests必须单列，不能计作 passed。后端语义变更还需 WSL Linux-first module、相邻层和累计链测试。

## 9. 常见故障

- Node 不可用：确认 `node --version` 为 20+ 且在 PATH。
- pnpm 不可用：运行 `corepack enable` 后重新安装。
- WSL 不可用：运行 `wsl --status`、`wsl -l -v`，必要时使用 `scripts/repair-wsl-service.ps1`。
- 没有 manifest：先运行 bootstrap 或 `update-backend.ps1 -NoRestart`。
- identity 不一致：不要手改 manifest，重新走完整部署或恢复上一 immutable release。
- Provider unavailable：基础工作台仍可用；只在需要 Evidence Agent 时重新配置。
