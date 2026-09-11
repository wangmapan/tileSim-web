# TileSim Tauri 工作台启动器

本目录是 Windows 工作台的新实现：Tauri 2 + Vue 3 + TypeScript + Vite + Rust。它只负责本地状态呈现、输入校验和调用固定 PowerShell 入口；部署、immutable release、manifest、DPAPI、WSL worktree 与构建缓存语义仍由 `scripts/` 拥有。

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
- `docs/deployment/LAUNCHER_ACCEPTANCE_MATRIX.md`

旧 Python/Tkinter 源码继续保留在 `tools/launcher/`，直到新 EXE 完成独立原生验收。
