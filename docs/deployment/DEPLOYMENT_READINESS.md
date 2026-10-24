# TileSim Web 部署就绪度调查

> 调查日期：2026-10-15  
> 调查范围：当前 `D:\tileSim-web` 工作树、前端构建、Python Bridge、Windows/WSL 部署脚本和现有发布文档。  
> 结论强度：每条结论标注为【文档明写】、【代码可证】或【本轮实测】。

> **历史调查声明（2026-10-24）**：本文保留 2026-10-15 的调查证据，不是当前发布状态；当前 Windows
> 安装器、离线 ZIP、预构建 WSL runtime、DPAPI 配置和实现门槛以
> [`WINDOWS_DISTRIBUTION_AND_INSTALLER_PLAN_2026-10-24.md`](WINDOWS_DISTRIBUTION_AND_INSTALLER_PLAN_2026-10-24.md) 为准。

## 结论

TileSim Web **可以构建前端静态产物，也具备一套 Windows + WSL 的本地部署流程**；它还没有形成可以直接交给其他人双击安装、迁移到任意服务器，或供多人通过网络访问的独立发行包。

当前适合的交付方式是：把 Web 仓库和独立的 TileSim 后端仓库一起交付，让使用者在 Windows 10/11 上按 bootstrap 流程重新构建。若只交付 `dist/`、根目录 EXE 或 `runtime/backend-current.json`，无法获得完整可执行环境。

调查开始时工作树有 49 个未提交修改（本报告新增两份文档后变为 51 个），Vitest 有 7 项失败，Prettier 全仓检查有 20 个文件失败，因此**当前状态不能标记为发布候选**。历史文档中 2026-09-11 的 clean clone 验证仍是 dated 证据，不能替代本轮对当前工作树的发布验收。

## 本轮实测证据

| 检查                                                                                   | 结果                                                                                                                   | 含义                                                                            |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm build`                                                                           | 通过；Vite 转换 2878 个模块，生成 118 个文件，约 12.55 MB                                                              | 前端可以生成生产静态资源。【本轮实测】                                          |
| `pnpm exec vite preview --host 127.0.0.1 --port 4174`                                  | `/` 返回 HTTP 200；访问 `/api/health` 经代理返回 HTTP 500（5173 未运行）                                               | 静态页面可服务，但前端不能代替 Bridge。【本轮实测】                             |
| `python bridge/server.py`（临时 55173 端口）                                           | `/`、`/api/health`、`/api/manifest` 均返回 200；`execution_ready=false`、`versions_match=false`、`cli_available=false` | Bridge 可以启动，但没有匹配的后端 CLI 就不能执行仿真。【本轮实测】              |
| `pnpm contracts:check`                                                                 | 通过，schema revision 为 `sha256:aa9e305651fa1731de47b034fec27f2ea19089651119302c21b3698c1a97b327`                     | 生成契约与 Bridge schema-set 没有漂移。【本轮实测】                             |
| `pnpm docs:check`、`node scripts/check-frontend-dependencies.mjs`、Bridge `py_compile` | 全部通过                                                                                                               | 文档链接、前端依赖边界和 Python 语法通过。【本轮实测】                          |
| `pnpm typecheck`、`pnpm lint`、`git diff --check`                                      | 通过；lint 有 2 条既有 warning                                                                                         | 类型、静态检查和 diff 空白通过。【本轮实测】                                    |
| `pnpm test`                                                                            | 101 个文件：1060 passed、8 skipped、7 failed                                                                           | 当前工作树不能作为全绿发布候选；失败集中在文案/展示契约和组件断言。【本轮实测】 |
| `pnpm format:check`                                                                    | 20 个文件失败                                                                                                          | 完整格式门禁仍未关闭。【本轮实测】                                              |

本轮没有调用会停止或重启 5173 的完整 bootstrap/deploy 流程，也没有修改运行数据和现有用户服务。`docs/getting-started/AI_DEPLOYMENT_AND_HANDOFF.md:19-21` 记录的 2026-09-11 clean clone 验证应作为历史证据阅读。

## 目前已经具备的能力

### 前端构建

- `package.json:5-13` 固定了 `pnpm@11.19.0`、Node `>=20` 和 `build`/`preview` 入口。
- `vite.config.js:6-23` 固定开发端口 4173、生产目标 `es2022`、源码 map 和 ECharts 分块策略。
- `pnpm build` 会生成 `dist/index.html` 和前端资源；Bridge 在 `bridge/server.py:71-85` 检测到 `dist/index.html` 后把它作为静态根目录。

这意味着“从源码得到浏览器静态资源”已经成立，但这不是完整应用包。

### 本机集成部署

- `scripts/bootstrap-workbench.ps1:1-64` 会检查 Node、pnpm、Git 和 WSL，克隆后端、安装锁定前端依赖，再调用 `update-backend.ps1`。
- `scripts/update-backend.ps1:170-266` 会创建后端 deployment worktree、在 WSL 中运行 `scripts/build_wsl.sh` 和 CTest，执行 Bridge/Web 检查，生成 Web immutable release，并写入 deployment manifest。
- `scripts/start-backend.ps1:49-104` 启动 immutable Web snapshot 和 WSL Bridge；`scripts/start-backend.ps1:150-168` 通过 `/api/health` 与 `/api/manifest` 比对前后端 revision、digest、release 和 schema identity。
- `scripts/update-backend.ps1:274-297`、`scripts/deploy-local-backend.ps1:360-378` 已有失败时恢复旧 manifest 并尝试恢复旧 Bridge 的逻辑。
- `scripts/release-snapshot.mjs:45-151` 对 `bridge/` 和 `dist/` 做文件清单、字节数和 SHA-256 固化。

这套流程对“同一台 Windows 机器上的可追溯本地部署”是有工程基础的。

### 可选模型能力

Evidence Agent 是可选能力；基础仿真、报告和证据页面不要求外部模型。配置脚本会把 API Key 以 Windows 当前用户 DPAPI 密文写入被 Git 忽略的 `runtime/evidence-agent.local.json`（`docs/getting-started/AI_DEPLOYMENT_AND_HANDOFF.md:120-124`）。换电脑或 Windows 用户必须重新配置，密文不能作为通用发行物复制。

## 让其他人部署前必须准备什么

完整仿真部署目前是 **Windows + WSL 本地模式**，不是跨平台部署。

| 类别         | 必需条件                                                                 | 证据/限制                                                                                                 |
| ------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 操作系统     | Windows 10/11、WSL2，默认发行版 `Ubuntu-24.04`                           | `docs/getting-started/AI_DEPLOYMENT_AND_HANDOFF.md:38-43`；`scripts/start-backend.ps1:10-23` 强制检查 WSL |
| Windows 工具 | Git、Node.js 20+、Corepack、pnpm 11                                      | `scripts/bootstrap-workbench.ps1:17-48`；pnpm 版本由 `package.json:5` 固定                                |
| WSL 工具链   | CMake、C++ 编译器/链接器、Python 3、CTest，以及后端构建脚本需要的库      | `D:\tileSim\scripts\build_wsl.sh:8-27` 只做 g++ sanity check 和 CMake/build，没有替使用者安装系统包       |
| 网络         | GitHub、npm registry、Playwright Chromium 下载源                         | `docs/getting-started/AI_DEPLOYMENT_AND_HANDOFF.md:41`                                                    |
| 仓库         | Web 仓库 + 可解析 Capability Catalog 所引用 revision 的 TileSim 后端仓库 | `scripts/deployment-common.psm1:94-110` 会在缺 revision 时失败关闭                                        |
| 运行目录     | 可写的 `runtime/`、`runs/` 和 WSL 构建缓存                               | `.gitignore:4-13` 将这些目录排除在 Git 外；它们不会随 clone 迁移                                          |
| 模型（可选） | Provider endpoint、模型名和 API Key；换机器重新配置                      | `scripts/configure-evidence-agent.ps1:80-108`、DPAPI 约束                                                 |

最短的官方路径是：

```powershell
git clone https://github.com/wangmapan/tileSim-web.git
Set-Location tileSim-web
corepack enable
.\scripts\bootstrap-workbench.ps1
```

该命令是“从源码在目标机重建”，不是下载一个已经包含 C++ CLI 和运行环境的安装包。

## 当前欠缺与风险

### P0：当前没有可签收的发布候选

1. **工作树不干净。** 当前分支是 `codex/experiment-layout-polish`，HEAD 为 `cc98e88`，有 49 个未提交修改。deployment manifest 也指向本机 `D:\tileSim`（`runtime/backend-current.json`），不能作为其他人的输入。
2. **当前门禁未全绿。** `pnpm test` 有 7 项失败，`pnpm format:check` 有 20 个文件失败。必须先决定这些失败哪些应修复、哪些应从发布候选中排除并记录原因。
3. **Web 与后端仍是两个仓库、两个 revision。** bootstrap 能校验 catalog 引用，但没有单一 release tag 或可下载的联合发行清单让接收者直接获得已验证的 Web/TileSim 配对。

### P0：依赖安装不是自包含的

1. **没有 Python 依赖声明。** 仓库没有 `requirements.txt`、`pyproject.toml` 或环境文件；Bridge 目前只使用标准库，但 Python 最低版本、编码环境和 WSL 系统包没有在机器可执行的锁定文件中声明。
2. **没有 WSL 工具链安装器。** `build_wsl.sh` 假设 `g++`、CMake、CTest 和后端依赖已存在；新用户需要自己配置 WSL、Ubuntu 包和可能的权限。
3. **没有容器交付路径。** 仓库没有 Dockerfile、Compose、CI workflow 或跨平台服务入口；Linux/macOS 用户没有受支持的等价 bootstrap。

### P1：目前不是独立安装包

1. **根目录 EXE 不能单独复制。** `docs/deployment/LAUNCHER_BUILD_DEPLOYMENT_ROLLBACK.md:3-20` 和 `tools/workbench-launcher/build-launcher.ps1:74-136` 说明启动器会从自身目录定位 checkout、脚本和内置 Node；它不是包含 Web、Bridge、TileSimCLI 和 WSL 的 self-contained binary。
2. **NSIS/EXE 构建环境很重。** 还需要 Rust stable MSVC、Visual Studio C++ Build Tools/Windows SDK 和 WebView2（`docs/deployment/LAUNCHER_BUILD_DEPLOYMENT_ROLLBACK.md:9-20`）。接收者仍需仓库和后端环境，才能真正启动工作台。
3. **manifest 与 snapshot 带绝对路径。** `scripts/update-backend.ps1:232-257`、`scripts/deploy-local-backend.ps1:322-346` 写入 Windows/WSL 的 source、release、CLI 和 manifest 路径；复制到另一台机器必须重新部署，不能直接搬运 `runtime/`。

### P1：当前只支持单机 loopback 使用

1. Bridge 在 `bridge/server.py:1803-1810` 固定绑定 `127.0.0.1`，前端默认只访问 `/api` 或 `http://127.0.0.1:5173/api`（`src/lib/api/transport.ts:14-21`）。
2. CORS 只允许 Vite 开发源 `127.0.0.1:4173` 和 `localhost:4173`（`bridge/api/responses.py:27-33`）；没有反向代理、TLS、用户认证、租户隔离或远程 API 配置。
3. Bridge 只有进程内并发限制和本地 `runs/` 持久化，没有服务注册、开机自启、日志轮转、备份/恢复和多用户生命周期管理。

因此“让同事在自己的电脑上本地部署”是当前支持目标；“部署到一台服务器后让其他人从浏览器访问”目前不在交付范围内。

### P2：可维护性和接手体验仍不完整

- 没有 `.env.example`；模型、端口和路径配置分散在脚本参数及 `TILESIM_*` 环境变量中。
- 缺少一个统一的 `doctor`/preflight 命令，不能一次输出 Node、pnpm、Python、WSL 发行版、CMake、CLI、磁盘空间、端口和权限状态。
- 发布文档有 clean clone 历史记录，但当前没有 CI 自动从零克隆两个仓库、构建并上传联合 artifact 的持续验证。
- 运行数据在 `runs/`，虽然不会进入 Git，但没有正式的版本升级迁移、保留策略和用户可见备份说明。

## 建议的交付分级

### 现在可以交付：受控的本机开发/实验部署

适用于 Windows 用户，接受首次构建时间较长并允许联网：

1. 交付 Web 仓库和对应后端仓库的明确 commit；不要交付当前 dirty 工作树或本机 `runtime/`。
2. 使用者安装 Node/pnpm、Git、WSL2 Ubuntu 和 C++/CMake/Python 工具链。
3. 运行 `bootstrap-workbench.ps1`，等待 CTest、Bridge 测试、前端测试和生产构建完成。
4. 启动后确认：

   ```powershell
   Invoke-RestMethod http://127.0.0.1:5173/api/health
   Invoke-RestMethod http://127.0.0.1:5173/api/manifest
   ```

   只有 `execution_ready=true`、`versions_match=true`、schema/release identity 与 manifest 一致时，才算该机器部署完成。

### 目前不能承诺：复制即用的安装包

要支持“下载一个文件后安装”，至少需要把以下内容一起固化并测试：

- 已验证的 Web commit、后端 commit、schema-set revision 和完整 build digest；
- 可迁移的 Bridge/Python runtime 或明确的 Python 安装步骤；
- 已构建的 TileSimCLI 及其运行库，或者在安装器内可靠重建它的工具链；
- 与机器无关的配置生成和首次运行向导；
- 运行数据迁移、备份、卸载、升级和回滚行为；
- 在干净 Windows 机器上的安装器验收，而不是只在源码 checkout 内做 launcher self-check。

### 目前不能承诺：多人网络服务

需要另一个交付项目，至少包括监听地址配置、身份认证、TLS、CORS/反向代理、用户和运行隔离、资源配额、持久化数据库或对象存储、日志与监控、备份恢复，以及真实负载下的并发验收。

## 建议补齐顺序

| 优先级 | 工作包                                     | 验收标准                                                                                          |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| P0     | 建立联合 release manifest 和 tag           | clean clone 能按一个版本号得到固定 Web/TileSim commit；CI 从零执行 bootstrap 并上传可追溯结果     |
| P0     | 修复或登记当前 7 项测试失败、20 项格式失败 | 发布候选执行完整门禁，失败项有明确归属和不跳过的证据                                              |
| P0     | 增加 `doctor` 和依赖安装说明               | 一条命令报告所有版本、WSL/CMake/CLI/端口/权限缺口，并给出下一步                                   |
| P1     | 定义 Python/WSL 运行环境                   | 提供 Python 最低版本、WSL apt 包清单、编码要求和可重复环境文件                                    |
| P1     | 形成真正的 Windows 安装包                  | 新机器只需安装器和明确的后端运行时来源；不要求用户手工准备 checkout 目录                          |
| P1     | 运行数据生命周期                           | 明确 runs 保留、备份、迁移、卸载和跨版本恢复策略                                                  |
| P2     | 网络部署模式                               | 另行设计认证、TLS、租户隔离、反向代理和观测能力；不要把 loopback Bridge 直接暴露到网络            |
| P2     | 模型配置模板                               | 提供不含 secret 的 `.env.example`/配置向导，并把 assistant 与 Evidence Agent 的可选性说明统一起来 |

## 最终判断

- **前端可打包：是。** `pnpm build` 和静态 preview 已验证。
- **单机本地可部署：有条件地是。** Windows + WSL + 后端工具链齐全时，现有脚本能构建、校验、生成 immutable release 并回滚。
- **当前工作树可直接发布：否。** 门禁未全绿，且包含未提交改动和本机路径状态。
- **只发 EXE/dist 就能让别人使用：否。** 还缺后端 CLI、WSL、Bridge 运行目录和匹配 identity。
- **作为多人远程服务：否。** 当前 Bridge 固定 loopback，缺少认证、TLS、持久化和运维能力。

本报告只新增部署调查文档；没有重启 5173、修改用户运行数据、读取模型凭据或改变当前未提交实现。
