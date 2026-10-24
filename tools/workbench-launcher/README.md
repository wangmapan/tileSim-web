# TileSim Tauri 工作台启动器

本目录是当前 Windows 工作台的 Tauri 2 + Vue 3 + TypeScript + Vite + Rust 源码。它只负责本地状态呈现、输入校验和调用固定 PowerShell 入口；部署、immutable release、manifest、DPAPI、WSL worktree 与构建缓存语义仍由 `scripts/` 拥有。

这里构建出的 NSIS/EXE 目前仍是开发者 checkout 启动器：它依赖旁边的 `scripts/`、Web checkout、WSL deployment
manifest 和后端工作树，不能单独发送给没有开发环境的测试人员。真正的安装器、同源离线 ZIP 和预构建 runtime
方案见 [`docs/deployment/WINDOWS_DISTRIBUTION_AND_INSTALLER_PLAN_2026-10-24.md`](../../docs/deployment/WINDOWS_DISTRIBUTION_AND_INSTALLER_PLAN_2026-10-24.md)。

启动器保存模型服务配置时，开发 checkout 继续使用 `runtime/evidence-agent.local.json`；检测到 packaged release
（或设置 `TILESIM_PACKAGE_ROOT`）后改写到 `%LocalAppData%\TileSim\config\evidence-agent.local.json`，API Key
仍只以当前 Windows 用户 DPAPI 密文保存。当前 ZIP payload 仍标记 `runtime_zip_only_installer_pending`，不能当作完整安装器发送。

## Web fixture

fixture 固定使用 `127.0.0.1:4187`，不连接、停止或替换 5173：

```powershell
pnpm launcher:dev --mode fixture
pnpm launcher:test
pnpm launcher:test:e2e
```

## Tauri 开发模式

需要 Rust stable MSVC、Cargo、Visual Studio C++ Build Tools/Windows SDK 和 WebView2 Evergreen Runtime。Node 由现有解析入口选择，并在编译时嵌入 executable：

```powershell
Import-Module .\scripts\deployment-common.psm1 -Force
$env:TILESIM_BUNDLED_NODE_SOURCE = Resolve-TileSimNode
pnpm launcher:tauri:dev
```

开发结束后可清除当前 PowerShell 进程中的临时变量：

```powershell
Remove-Item Env:TILESIM_BUNDLED_NODE_SOURCE
```

## Production build

```powershell
.\tools\workbench-launcher\build-launcher.ps1
```

构建脚本运行 Rust、组件和 fixture E2E 门禁，生成 NSIS bundle，并先以根目录 candidate 执行 packaged self-check。只有 candidate 能从自身目录定位 checkout、在 PATH 不含 Node 时解析内置 Node、检测 WebView2，且确认未读 credential、未访问 Provider、未触碰 5173，才会发布为根目录 `启动TileSim工作台.exe`。

若根目录已有旧启动器，替换时会原子备份到被 Git 忽略的 `runtime/launcher-fallback/`。完整环境准备、回滚和验收状态见：

- `docs/deployment/LAUNCHER_BUILD_DEPLOYMENT_ROLLBACK.md`

本地代码重新部署默认启用安全的增量复用：启动器把 `-ReuseVerifiedArtifacts` 传给
`deploy-local-backend.ps1`，脚本仅在后端源码/build/CLI SHA-256/CTest、WSL 发行版和 Web immutable release
身份全部匹配时复用；Web 有变化时仍做契约 drift、Bridge 测试/编译和生产构建。身份无法证明时自动走完整流程。
部署设置中的“强制完整验证”对应完整构建、CTest、Bridge/Web 测试和 Web 构建；脚本直接调用时默认仍是完整流程。

旧 Python/Tkinter 实现已在 Tauri 原生验收和路径兼容回归通过后退役。回滚使用 `runtime/launcher-fallback/` 中由构建脚本原子保留的上一版 Tauri EXE。
