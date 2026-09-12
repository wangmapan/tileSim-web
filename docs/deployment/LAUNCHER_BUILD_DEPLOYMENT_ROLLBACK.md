# Windows 工作台启动器构建、发布与回滚

## 范围与职责

新启动器采用 Tauri 2、Vue 3、TypeScript、Vite 和 Rust。Rust 层只允许四类固定能力：读取本地公开状态、运行 typed deployment operation、选择后端仓库目录、用系统浏览器打开固定的 `http://127.0.0.1:5173/`。它不提供任意 shell、process、filesystem 或远程导航能力。

现有 PowerShell 脚本继续唯一拥有以下语义：Windows Current User DPAPI、deployment manifest、immutable release、独立 WSL deployment worktree、revision/source-path 绑定的后端构建缓存，以及启动、更新和 WSL 修复流程。此次迁移没有改变这些 contract，也没有改变仿真、Trace 或证据语义。

## 固定版本与构建条件

- Windows 10/11 x64；
- Node.js 20 或更高，当前验证版本为 24.19.0；
- pnpm 11.19.0（`packageManager` 固定）；
- Rust stable MSVC，最低 Rust 1.85；
- Tauri Rust crate 2.11.5、`tauri-build` 2.6.3；
- `@tauri-apps/api` 2.11.1、Tauri CLI 2.11.4；
- Visual Studio 2022 C++ Build Tools 和 Windows SDK；
- WebView2 Evergreen Runtime。

本次本机原生验收使用 Rust/Cargo `1.98.1`、Visual Studio Build Tools 2022 `17.14.40`、Windows SDK `10.0.26100.0` 和 WebView2 `152.0.4191.66`。

Tauri CLI 可只读检查本机条件：

```powershell
pnpm launcher:tauri:info
```

不要让构建脚本自动安装系统级依赖。缺少 Rust、Build Tools 或 WebView2 时，按 CLI 给出的官方入口安装后再重试。

## 干净 clone 构建

```powershell
git clone https://github.com/wangmapan/tileSim-web.git
Set-Location tileSim-web
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile --config.auto-install-peers=false
.\tools\workbench-launcher\build-launcher.ps1
```

第一次具备 Cargo 的构建必须生成并提交 `tools/workbench-launcher/src-tauri/Cargo.lock`，此后 production 构建应使用该锁文件。没有该文件时只能称为源码可行性审计，不能称为可重复原生构建已通过。

构建脚本默认执行：

1. 通过 `Resolve-TileSimNode` 选择 Node，并以 `TILESIM_BUNDLED_NODE_SOURCE` 只传入当前构建进程；
2. `cargo fmt --check`、`cargo clippy --all-targets --all-features -- -D warnings`、`cargo test`；
3. launcher Vitest 和 4187 fixture Playwright；
4. Tauri production build 与 NSIS bundle；
5. Windows GUI subsystem 检查；
6. 根目录 candidate packaged self-check；
7. 验收通过后原子发布根目录中文 EXE，并将上一版 Tauri EXE 保留为 ignored fallback。

构建产物均被 Git 忽略：Web dist、Rust target/gen、runtime 检查结果、candidate、根目录 EXE 和 fallback。

## Packaged self-check

```powershell
.\启动TileSim工作台.exe --self-check-file .\runtime\launcher-self-check.json
Get-Content -Raw .\runtime\launcher-self-check.json
```

self-check 只检查 checkout、必需脚本、deployment manifest 是否存在、内置 Node 摘要和执行、无 Node PATH 解析以及 WebView2。它明确输出 `credentials_read=false`、`provider_accessed=false`、`port_5173_touched=false`；不会读取任何模型 credential，不会访问 Provider，也不会连接、停止、重启或替换 5173。

合格结果要求：

- `ready=true`；
- `resolved_from_executable_directory=true`；
- `required_scripts_present=true`；
- `bundled_node_runtime=true`；
- `node_without_path=true`；
- `webview2_available=true`；
- 三个安全负面字段均为 `false`。

## 发布、旧实现退役和 Tauri fallback

默认入口仍是 `<tileSim-web>/启动TileSim工作台.exe`。新 candidate 在替换前必须通过 self-check。若已有入口，构建脚本使用同卷原子替换，并将旧文件保存为：

```text
runtime/launcher-fallback/启动TileSim工作台.previous-<timestamp>-<pid>.exe
```

Tauri production build、packaged self-check、原生窗口截图和 Windows 路径兼容回归已完成。经项目所有者授权，旧 `tools/launcher/` 和 `D:\tileSim-web\启动TileSim工作台.exe` 已退役；不再把 Tkinter 作为回滚路径。fallback 仍不得加入 Git，fixture 验收也不得替代 native packaged 验收。

已验收产物：

- 根目录中文 EXE：`104,746,496` bytes，SHA-256 `F9E1BA2A3BD7882AC2EEBDF26C2ED324A9E9717CA63A14398D4AF79428807DD8`；
- NSIS：`TileSim 工作台_0.1.0_x64-setup.exe`，`26,040,697` bytes，SHA-256 `182462A2A6F4608CA535BF0A53E2B9F333FBC24342A597E7CB14BAA7F795DE6F`；
- packaged self-check：`ready=true`，从 EXE 目录解析 checkout、内置 Node、无 Node PATH 和 WebView2 均通过；
- 上一版 Tauri fallback：`runtime/launcher-fallback/启动TileSim工作台.previous-20260912-103905-25724.exe`；
- 原生浅色与深色窗口截图：保存在被 Git 忽略的 `runtime/launcher-tauri-build/native-light.png` 与 `native-dark.png`。

## 回滚

先确认没有启动器构建或部署任务正在运行。选择 `runtime/launcher-fallback/` 中需要恢复的版本，复制到根目录 candidate 名称，验证文件存在后再替换根目录入口。不要删除 fallback，直到恢复后的启动器已完成 self-check。

若尚未生成 fallback，应从已发布的 Tauri 构建产物或对应 Git revision 重建，不得恢复已退役的 Tkinter 实现。回滚启动器不会回滚 deployment manifest 或 release；后端 release 回滚仍使用既有部署流程。不要用启动器回滚掩盖 deployment identity 或 schema 不一致。

## 安全与运维确认

- API Key 不进入 Vue 响应式状态、DOM、日志、命令参数或技术详情，只经固定 PowerShell stdin 流程进入 DPAPI；
- Rust 请求中的 Key 用后自动清零；应用关闭或刷新后不保留明文；
- Base URL 只允许 HTTPS 或 loopback HTTP，并拒绝 URL user-info、query 和 fragment；
- CSP 只允许本地资源和 Tauri IPC；capability 仅 `core:default`；
- 修改型操作使用单槽竞争保护，stdout/stderr 在 Rust 和前端均限制为 400 行、单行 4000 字符；
- 固定 PowerShell 脚本通过参数数组调用系统目录下的 Windows PowerShell；
- 运行中关闭窗口会提示等待，当前版本不提供不安全的强制取消。
