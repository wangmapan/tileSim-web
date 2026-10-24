# TileSim Web：AI 部署与接手手册

> 当前复核日期：2026-10-24
>
> 当前工作树部署状态：`deployment_ready_to_retry`（最近一次 102/102 CTest 已通过；此前启动器因把 Rust `target` 构建产物计入 Web 源码摘要而误报变化，现已修复）

## 当前事实（2026-10-24）

- 本仓库当前 `HEAD=2e73864`，工作树含既有未提交代码/文档改动；本手册的 clean-clone 记录和下方 dated 数字不能当作当前发布候选。
- 启动器仍以后端 CTest 为硬门禁；用户最新日志显示 102/102 CTest、Bridge、Web 测试和生产构建均通过，失败发生在收尾的 Web 源码摘要校验。
- 该误报已修复：`scripts/release-traceability.mjs` 不再把 `target` 等开发/运行产物目录计入 Web 源码摘要；真正的源文件变化仍会阻止部署。可重新运行启动器验证。
- 不得跳过 CTest、手工把失败写成成功、修改只读的 `D:\tileSim` 后端仓库，或停止/重启用户可能正在使用的 `127.0.0.1:5173`。

## 1. 仓库交付边界

面向测试人员的 Windows 安装器/离线 ZIP 方案见
[`WINDOWS_DISTRIBUTION_AND_INSTALLER_PLAN_2026-10-24.md`](../deployment/WINDOWS_DISTRIBUTION_AND_INSTALLER_PLAN_2026-10-24.md)。
当前已实现的是可审计的 ZIP payload 组装/校验基线（`doctor.ps1`、`package-windows-release.ps1`、
`install-windows-runtime.ps1`、`smoke-windows-release.ps1`）和 Bridge packaged identity；它们还不是可交付给测试人员的完整安装器。
在 P0/P1 门槛、WSL import/health smoke、签名和干净 Windows 验收完成前，本手册下面的 Git/Node/WSL bootstrap
仍是唯一已部署的完整部署路径。不能把根目录 Tauri EXE、`dist/` 或 `runtime/backend-current.json` 单独交给其他人。

本仓库包含完整前端、Python Bridge、契约、生成代码、测试和部署工具，但不复制 C++ TileSim 后端或外部大模型。完整仿真部署需要联网克隆公开后端；bootstrap 会自动完成。离线且只有 Web 仓库时，可构建和运行 fixture 测试，但不能创建真实 simulation run。

外部模型只用于 Evidence Agent，是可选配置。未配置模型时，基础仿真、报告、证据和 Phase 1 本地参数草案仍可使用。

## 面向测试包维护者的一键发布入口

维护者现在可以直接双击仓库根目录的 [`发布Windows测试包.cmd`](../../发布Windows测试包.cmd)，或在 PowerShell 执行：

```powershell
.\scripts\publish-windows-release.ps1
```

脚本会自动读取 `package.json` 版本号，发现旁边的 `D:\tileSim` 和 `D:\tileSim\docs\examples`，运行 Windows/x64/磁盘预检，调用统一的 ZIP 组装器，并在结束时打开 `runtime\windows-release`。代码更新后不需要改脚本；重新运行即可生成新版本。默认 `wsl-prebuilt` 模式找不到 rootfs 或 runtime metadata 时会提示输入路径；若已经通过独立 clean-machine gate 验证 Windows 原生 CLI，可使用：

```powershell
.\发布Windows测试包.cmd `
  -RuntimeKind windows-native `
  -BackendCliPath D:\tileSim\build-ca1\Release\TileSimCLI.exe
```

脚本也会从常见的 `build-ca1\Release`、`build-dv1-utf8\Release` 和 `build\Release` 位置自动发现 `TileSimCLI.exe`。默认会执行发布前校验和 Web 生产构建；只有临时开发包才应显式传入 `-AllowDirty`、`-SkipValidation` 或 `-SkipWebBuild`。输出包括 `TileSimWebRuntime-<version>-x64.zip`、`tilesim-workbench-release.json` 和 `SHA256SUMS`。`pnpm publish:windows <same parameters>` 是等价的命令行入口（不要额外加入 `--`，否则某些 pnpm/PowerShell 组合会把它当成未知参数）。

当前入口生成的是经过清单和 SHA-256 校验的离线 ZIP，不是可对外宣称“下载后点击即用”的完整安装器；manifest 会明确标记 `runtime_zip_only_installer_pending`。真正交付测试人员前仍需完成 WSL import/native runtime、签名 launcher、安装/升级/回滚和干净 Windows 验收。API Key 不会进入 ZIP：目标配置路径为 `%LocalAppData%\TileSim\config\evidence-agent.local.json`，Base URL、模型名和 API Key 应由启动器设置页填写，API Key 以当前 Windows 用户 DPAPI 保存。

截至 2026-09-11 的公开交付验证，完整 Web 交付已进入 `https://github.com/wangmapan/tileSim-web.git` 的 `main`，后端已进入
`https://github.com/lqf0624/tileSim.git` 的 `main`。Capability Catalog 绑定的不可变后端证据 revision
`7e5a8c6a5cf738bd24608b440a61b62dee8d1881` 可由公开后端解析，并保留在公开
`codex/phase0d-backend-evidence-clean` 分支。其他用户可以只依赖这两个公开仓库和下述系统工具完成本地部署；
无需维护者本机的未提交文件、运行数据或凭据。

2026-09-11 已在一个全新临时目录从两个 GitHub 远端克隆并执行完整 bootstrap。验证结果为后端 63/63 CTest、
前端 506 passed/8 skipped、生产构建和 immutable release 全部通过，最终模式为
`validated_deployment_without_restart`。验证使用 `-NoRestart`，未启动、停止或替换 5173。该次验证的 Web 部署功能基线为
`b2958e796eb8e3b7bb8bd7cc95d8972195571d4d`，后端为
`a876859a44f660c4627dab495034d52b4ae61f57`。以上数字是 **2026-09-11 的 dated 验证记录**，不是当前基线。

2026-09-17 revision 实测（**历史记录**）：Web `HEAD == origin/main ==`
`4d7f9fa3c330b7d6f287d12da853ec2bf481b0cb`；后端公开 `origin/main` 为
`7b2b1cff52fdab21575609be170c3856f120120b`，后端本地 `main` 为
`ba11e6fdb69af046dc7597e5ef5732cce029cfbe`（领先 2 个提交、尚未 push）。本节之后描述的部署步骤与要求不变。

**2026-09-19 更新**：2026-09-18 本机对象库清空后重建的孤儿线**已接回并推送完成** —— `origin/main` 由 `4d7f9fa`
**快进**到本地线的最新提交（历史为一条直线，**未使用 `force`**）；重建线的原始提交 `11cef6b` / `c303ac2`
保留在远端分支 `recovery/orphan-main-11cef6b`、**仍可解析**；三个未推送的本地提交
`446f21d` / `290d1c8` / `9b2d39b` 不可解析且不可恢复（内容已随快照进入远端）。部署步骤与要求不变。
完整更正见 `docs/AI_HANDOFF.md` 的「2026-09-19 仓库与基线更正」。

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
.\tools\launcher\build-launcher.ps1
```

兼容构建入口现在转到 `tools/workbench-launcher/build-launcher.ps1`（Tauri 2，不再使用 PyInstaller）。
默认产物为 `<tileSim-web>/启动TileSim工作台.exe`，并被 Git 忽略。打包后的 EXE 从自身目录定位前端仓库；
不要将它放入独立的团队资料目录，否则仓库迁移或多 checkout 环境下容易指向错误版本。启动器可以启动已有 release，
也可以拉取后端 `origin/main`、重新验证并部署。WSL 构建缓存同时绑定后端 revision 和 deployment 源码路径，
因此不同 clone/worktree 不会复用错误的 CMake source cache。构建脚本会把当前 Node.js 运行时嵌入 EXE；从资源管理器
双击启动时不依赖其继承的 PATH。PowerShell 部署脚本本身仍要求 Node.js 20+。
概览页的“一键启动工作台”启动已有验证版本（服务就绪则只打开网页）；首次无部署清单时先确认本地部署。
“重新部署当前代码”调用仓库内 `deploy-local-backend.ps1 -SourceRoot <所选后端>`，使用后端与 Web 当前文件
（含未提交改动），不 fetch/push、不切换分支；经确认后按源码和 release identity 复用已验证构建，或对变化部分执行验证，
再发布、重启 5173 并打开网页。快速路径无法证明 identity 一致时自动回退完整流程；部署页可勾选“强制完整验证”重新运行
后端构建、CTest、Bridge/Web 测试和 Web 构建。
远端 `origin/main` 更新与停止服务仍可在“部署设置”的折叠“高级操作”中使用。
启动器不调用个人桌面 `.cmd`、不强制结束 Vite/Playwright。打包门禁与回退见
[`LAUNCHER_BUILD_DEPLOYMENT_ROLLBACK.md`](../deployment/LAUNCHER_BUILD_DEPLOYMENT_ROLLBACK.md)。

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

Key 只经隐藏输入进入设置页/脚本，以 Windows 当前用户 DPAPI 密文保存：开发 checkout 使用 `runtime/evidence-agent.local.json`，packaged release 使用 `%LocalAppData%\TileSim\config\evidence-agent.local.json`。不要把 key 放进命令参数、日志、截图、issue 或 AI 对话。换电脑或 Windows 用户后必须重新配置。

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

**前端开发任务**另见 [`AI_FRONTEND_DEVELOPMENT_REFERENCE.md`](AI_FRONTEND_DEVELOPMENT_REFERENCE.md)：代码地图、
路由 ↔ view 对照、状态归属、契约与生成物规则、无 pnpm 环境的等价可跑命令与实测门禁基线。

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
