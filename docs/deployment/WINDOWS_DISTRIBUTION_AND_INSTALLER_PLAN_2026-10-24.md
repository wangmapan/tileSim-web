# TileSim Web Windows 发布与安装器方案

> 版本：2026-10-24
> 状态：当前实施依据；这是方案，不代表安装器已经完成。
> 适用范围：Windows 10/11 x64、单机 loopback 工作台。多人远程服务、账号体系、GPU 集群和移动端不在本方案内。

## 结论先行

第一版同时生成两个交付物，但只维护一套 payload。安装器是包含 payload 的完整离线安装器；后续才考虑下载器模式：

```text
TileSimWebSetup-<version>-x64.exe       # 普通测试人员使用，首选入口
TileSimWebRuntime-<version>-x64.zip     # 内网/离线/问题复现使用
tilesim-workbench-release.json          # 联合版本与摘要清单
SHA256SUMS                              # 交付物摘要
```

安装器和 ZIP 必须来自同一个不可变 payload，不能分别从开发机目录拼装。安装器的目标是“用户无需 Git、Node、pnpm、Python、CMake 或 C++ 工具链即可启动”；如果某一版仍要求用户编译后端，就只能标为源码部署版，不能对外称为一键安装版。

### 后端运行时的首版决策

当前后端 `D:\tileSim\CMakeLists.txt` 虽然有 `TileSimCLI` 的 install target，但本机可见的 `build-tr1-wsl\TileSimCLI` 是 ELF，现有 `scripts/start-backend.ps1` 也明确要求 WSL、发行版和 `python3`。因此首版不假设 Windows 原生 CLI 已存在，采用以下门槛：

1. **首个可交付版本：预构建 WSL runtime。** CI 在固定 Ubuntu/WSL 环境构建并测试 CLI、Bridge 和资源文件，生成可校验的 rootfs 或导入包；安装器调用 `wsl --import`，用户不编译源码。
2. **后续优化：Windows native runtime。** 只有当 CI 能生成并在干净 Windows 上运行 `TileSimCLI.exe`，并通过最小 smoke case、CTest 选定门禁、依赖收集和 SHA-256 校验，才把 `runtime_kind` 切换为 `windows-native`。
3. **禁止的第三条路：** 安装器在用户电脑上 clone、CMake、CTest 或构建后端。这仍是开发者 bootstrap，不是可复制的测试发行包。

WSL 方案仍需要 Windows 的 WSL2/虚拟化能力；这必须在安装器预检中明确显示。若目标测试机无法启用 WSL，则该版本应报告“不支持当前机器”，而不是静默退回源码构建。

## 代码事实与现状边界

以下是本方案落笔前按源码核对的事实：

| 事实                          | 当前代码证据                                                                                                                                                            | 对发行版的含义                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 启动器不是完整产品包          | `tools/workbench-launcher/src-tauri/src/runtime.rs` 的 `resolve_web_root()` 从 EXE 旁查找 `scripts/`；`build-launcher.ps1` 只构建 Tauri/NSIS 启动器                     | 不能只发送根目录 EXE                                                                        |
| Bridge 是 Python 进程         | `scripts/start-backend.ps1` 使用 `wsl.exe ... python3 bridge/server.py`                                                                                                 | payload 必须含 Python/WSL 运行环境，或把 Bridge 编译成经过验证的 sidecar                    |
| Bridge 依赖安装路径和后端资源 | `bridge/server.py` 在导入时计算 `WEB_ROOT`、`STATIC_ROOT`、`TILESIM_ROOT`、`TILESIM_CLI`、`DEPLOYMENT_MANIFEST`，场景还读取后端 `docs/examples`                         | 必须改为安装根目录相对路径 + 用户数据绝对路径                                               |
| 当前服务绑定 loopback         | `bridge/server.py` 的 `main()` 使用 `127.0.0.1`，端口来自 `TILESIM_WEB_PORT`，默认 5173                                                                                 | 只支持单机；安装器不能把端口暴露到 `0.0.0.0`                                                |
| 前端端口假设固定              | `src/lib/api/transport.ts` 对 5173/4173 使用同源 `/api`，其他端口回退到 `http://127.0.0.1:5173/api`                                                                     | 首版固定 5173；可配置端口必须同时改 Bridge、启动器和前端 API root 逻辑并增加 E2E            |
| 模型设置已有安全路径          | `tools/workbench-launcher/src/App.vue` 提供 Base URL、模型名、超时和 API Key；`scripts/evidence-agent-settings.psm1` 使用 `ConvertFrom-SecureString` 写 `api_key_dpapi` | 可复用现有 UI/校验，但配置文件不能继续放 release checkout 的 `runtime/`                     |
| Assistant 目前依赖环境变量    | `bridge/providers/assistant_model.py` 读取 `TILESIM_ASSISTANT_*`；`start-backend.ps1` 通过 `WSLENV` 转发                                                                | 安装版需要由启动器解密用户配置后，在 Bridge 进程生命周期内注入，不把密钥写命令行或 manifest |
| 已有 immutable release 能力   | `scripts/release-snapshot.mjs` 固化 `bridge/` 和 `dist/` 文件清单、字节数和 SHA-256                                                                                     | 可复用为 payload 的内容寻址和升级回滚基础，但它目前仍带开发机路径语义                       |
| Tauri 已生成 NSIS             | `tools/workbench-launcher/src-tauri/tauri.conf.json` 的 `bundle.targets` 为 `nsis`                                                                                      | 可继续使用 Tauri/NSIS，但需新增真正的 payload 安装、预检和回滚逻辑                          |

当前已开始实现可重复的 ZIP payload 基线：`scripts/doctor.ps1` 提供机器可读预检，`scripts/package-windows-release.ps1` 组装同源 payload、release manifest、SHA-256 清单和 ZIP，`scripts/install-windows-runtime.ps1` 可从 ZIP 或解压目录校验 payload 并执行 staging/current/previous 指针事务，`scripts/smoke-windows-release.ps1` 可对已启动 Bridge 做 health/manifest identity smoke；Bridge 已能在 `TILESIM_PACKAGE_ROOT` 下从 release manifest 读取 packaged identity。上述链路已做脚本语法、组装/解压/哈希和 Bridge 单测，但仍未实现或验收：签名的联合安装器、WSL rootfs 发布流水线、WSL `--import`、安装器自动启动与 health/smoke 集成、安装失败/升级失败产品级恢复、SBOM、干净机器安装验收，以及 DPAPI 配置迁移。新文档不得把这些内容写成现成功能。

## 发行包布局

外部交付物解压后的 payload 使用固定相对路径，不携带开发机绝对路径、`.git`、用户 credential 或测试缓存：

```text
payload/
  app/
    web/dist/                         # Vite 静态产物
    bridge/                           # Bridge 源码与 contracts
    backend/resources/                # docs/examples、固定 trace/profile 资源
    trace-packages/                   # 仅纳入发布清单声明的包
  runtime/
    launcher/TileSimWorkbench.exe     # 已签名 Tauri 启动器
    node/node.exe                     # 仅在 launcher/sidecar 仍需要时纳入
    wsl/tilesim-rootfs.tar             # runtime_kind=wsl-prebuilt 时；外层 ZIP/安装器负责压缩
  release.json                         # payload 内联合 manifest
  SHA256SUMS
```

安装后的程序与数据分离：

```text
%ProgramFiles%\TileSim\Workbench\releases\<release-id>\  # 只读、不可变程序文件
%ProgramFiles%\TileSim\Workbench\current.json             # 原子切换的当前版本指针
%LocalAppData%\TileSim\config\                            # 用户配置（含 DPAPI 密文）
%LocalAppData%\TileSim\runs\                              # 运行与报告
%LocalAppData%\TileSim\logs\                              # 启动、安装、升级日志
%LocalAppData%\TileSim\wsl\                               # 导入的发行版标识/状态
```

卸载默认删除程序 release 和 launcher，保留 `config/`、`runs/`、`logs/`；向导必须提供单独的“同时删除用户数据”确认。升级不得写入旧 release，不得覆盖当前运行目录中的实验结果。

### WSL runtime 的内部布局

`wsl-prebuilt` 版本把需要在 Linux 侧读取的内容放在导入 rootfs 的 ext4 文件系统，而不是安装后从 `/mnt/d` 回读开发机 checkout：

```text
/opt/tilesim/bin/TileSimCLI
/opt/tilesim/app/bridge/
/opt/tilesim/app/web/dist/
/opt/tilesim/app/contracts/
/opt/tilesim/backend/resources/
```

启动器使用 `wsl.exe --import <managed-distro> <data-dir> <rootfs.tar>`，再以固定的
`python3 /opt/tilesim/app/bridge/server.py` 入口启动；`TILESIM_ROOT`、`TILESIM_CLI`、Bridge manifest 和静态根目录都指向
`/opt/tilesim` 下的发布路径。`wsl --import` 的输入格式在打包验收中固定为 tar；不要把 `.tar.zst` 当作 `wsl.exe` 的直接输入。
用户 `runs/`、日志和 DPAPI 配置仍放在 Windows 用户目录，按显式环境变量映射到 Bridge，且不得写回 rootfs。每个 release 使用唯一受管理的发行版名和目录，升级成功前不删除旧发行版。

## 联合 release manifest

每次发布只生成一个权威 manifest；版本号、Web、Bridge、后端、schema-set 和运行时种类必须绑定：

```json
{
  "schema_version": "tilesim.workbench.release.v1",
  "version": "0.3.0",
  "web_source_revision": "<40-char commit>",
  "backend_source_revision": "<40-char commit>",
  "schema_set_revision": "sha256:<64-hex>",
  "web_release_digest": "sha256:<64-hex>",
  "bridge_digest": "sha256:<64-hex>",
  "static_digest": "sha256:<64-hex>",
  "tilesim_cli_digest": "sha256:<64-hex>",
  "runtime_kind": "wsl-prebuilt",
  "minimum_windows_build": "19045",
  "minimum_webview2": "Evergreen",
  "payload_bytes": 0,
  "installer_digest": "sha256:<64-hex>",
  "signature": { "algorithm": "Authenticode", "thumbprint": "<publisher>" }
}
```

`release.json` 不得包含 `api_key`、DPAPI 密文、用户路径或运行结果。`backend_source_revision` 在无 Git 的安装版由打包阶段写入，Bridge 必须从该 manifest 读取发布 identity；不能继续调用 `git rev-parse` 后因源码不存在而返回 `unknown`，否则 `versions_match` 会始终为 false。

同时生成：

- `SHA256SUMS`：覆盖安装器、ZIP、payload 文件和 rootfs；
- SBOM：记录 Node、Python/WSL、Tauri、Bridge 和 CLI 的版本与许可证；
- Authenticode 签名：安装器和启动器必须签名；签名失败阻断上传；
- `release-notes.json`：只写版本、已知限制、最低系统和回滚说明，不写 credential。

## API Key 与 Base URL 配置

### 用户体验

首次启动时，启动器显示“模型服务（可选）”页；基础仿真和报告不依赖模型。页面提供：

- Base URL（HTTPS；HTTP 仅允许 loopback）；
- 模型名（必须与服务返回的 identity 完全一致）；
- API Key（密码输入，保存后立即清空）；
- 30/60/120 秒超时；
- 保存、清除和测试连接；
- 当前状态：未配置、已保存、探针可用、探针失败。

这与现有 `App.vue` 的字段和校验保持一致，不能在 Web 页面里把 key 放入 localStorage、URL、普通日志或前端 store。模型调用未配置时，Bridge `/api/agent/assistant-model` 和 Evidence Agent descriptor 应继续返回明确的 unavailable，而不是阻塞工作台启动。

### 存储和进程边界

配置文件迁移到：

```text
%LocalAppData%\TileSim\config\evidence-agent.local.json
```

保留当前 schema v1 的字段语义：`provider`、`base_url`、`model`、`model_revision`、`timeout_ms`、`probe_cache_seconds`、`api_key_dpapi`、`api_key_protection`。其中：

- Base URL、模型和超时可以明文 JSON 保存；
- API Key 只能由当前 Windows 用户 DPAPI 保护；不复制到 release、ZIP、manifest、诊断报告、crash dump 或备份包；
- 保存时先写同目录临时文件并原子替换，继承现有 `Write-EvidenceAgentSettings` 语义；
- 启动器读取 DPAPI 密文，在启动 Bridge 前短暂注入 `TILESIM_EVIDENCE_AGENT_*` 与 `TILESIM_ASSISTANT_*`；不放命令行参数，不持久化解密后的值；
- 日志只记录 host、状态码、request id 和稳定错误码，不记录 Authorization、请求体或响应体；
- “清除配置”应删除 DPAPI 密文并重启 Bridge，使两个模型通道同时变为 unavailable。

Base URL 的 `/v1` 与 `/v1/chat/completions` 规范必须继续由共享解析器处理，防止重复拼接；远程 HTTP 必须拒绝。配置测试只验证 endpoint、模型 identity 和 descriptor，不把完整模型响应写入诊断包。

## 安装、首次启动和升级流程

### 安装器预检

安装器在写入任何 release 前显示可行动结果：

1. Windows build、x64、WebView2、可用空间（程序、rootfs、升级临时空间分别计算）；
2. 安装目录写权限与当前用户/管理员模式；
3. WSL2、虚拟化、目标发行版名称和 `wsl --status`（仅 `wsl-prebuilt`）；
4. 5173 是否被占用，且不结束不属于 TileSim 的进程；
5. 网络、代理、下载/离线介质完整性；
6. 安装器签名、manifest 签名和所有 payload SHA-256；
7. 既有 TileSim 安装、当前 release 和可回滚 release。

预检失败必须给出修复建议，并可导出不含 credential 的诊断 JSON。建议新增 `scripts/doctor.ps1` 的机器可读核心，由开发者 bootstrap、安装器和启动器共用。

### 安装和验收

1. 读取在线 payload 或完整 ZIP；验证签名、manifest 和每个文件摘要。
2. 解压到 `%ProgramFiles%\TileSim\Workbench\.staging-<id>`，不得直接覆盖 `current`。
3. `wsl --import` 到临时发行版（或安装 Windows native CLI）；校验 CLI digest、资源清单和 Bridge contracts。
4. 原子改名为 `releases/<release-id>`，写入新的 `current.json`；旧 release 保留。
5. 按用户数据目录生成运行配置，启动 Bridge；固定监听 `127.0.0.1:5173`。
6. 等待并验证 `GET /api/health`：CLI 可用、`execution_ready=true`、`versions_match=true`。
7. 验证 `GET /api/manifest` 与联合 manifest 的 schema-set、Web release、Bridge/static digest 一致。
8. 执行一个无 GPU 的最小 smoke case，确认输入物化、CLI、报告读取和 `runs/` 写入。
9. 只有以上步骤全通过才创建开始菜单/桌面快捷方式并打开工作台；失败删除 staging，恢复旧 `current.json` 和旧服务。

### 升级和回滚

- 下载/读取新版本时先在 staging 完整校验，不修改用户配置；
- 停止旧 Bridge，切换 `current.json`，启动新 Bridge，重复 health/manifest/smoke；
- 新版本任何一步失败，指针回到旧 release，恢复旧 WSL 实例或 CLI，用户 `runs/` 不变；
- 至少保留当前版本和最近一个已验证版本；清理更旧版本前先显示占用空间；
- 回滚对象是 release + Bridge 运行参数 + WSL/runtime identity 的整体，不是单独替换 EXE；
- 升级 schema 需要先备份用户数据，并为每个迁移提供版本号、幂等性和失败恢复。

## CI 一键构建流水线

### 当前可执行的 ZIP 基线

维护者的一键入口是仓库根目录的 `发布Windows测试包.cmd`（或 `scripts/publish-windows-release.ps1`）。它会读取版本号、
自动发现旁边的 `D:\tileSim` 与 `docs\examples`，先运行 `doctor.ps1`，再调用本节的统一组装器；代码更新后直接再次运行即可。
默认 `wsl-prebuilt` 模式在缺少 rootfs/metadata 时交互询问路径；`windows-native` 模式可传入或自动发现
`TileSimCLI.exe`：

```powershell
.\发布Windows测试包.cmd `
  -RuntimeKind windows-native `
  -BackendCliPath D:\tileSim\build-ca1\Release\TileSimCLI.exe
```

该入口只负责生成可审计的 ZIP 交付物；它不会把未实现的安装器伪装成 EXE，也不会把 API Key 复制到 payload。模型配置目标位置为
`%LocalAppData%\TileSim\config\evidence-agent.local.json`，由 packaged launcher 的设置页填写 Base URL、模型和 API Key，
其中 API Key 使用 Windows 当前用户 DPAPI。

在 Web 工作树已经通过发布门禁、后端 runtime metadata 和资源目录已准备好时，维护者可以运行：

```powershell
pnpm doctor:windows -RuntimeKind wsl-prebuilt -SkipPortCheck
pnpm release:windows `
  -Version 0.3.0 `
  -BackendSourceRoot D:\tileSim `
  -RuntimeMetadataPath D:\artifacts\tilesim-runtime.json `
  -WslRootfsTar D:\artifacts\tilesim-rootfs.tar `
  -BackendResourceRoot D:\tileSim\docs\examples
```

该命令生成同源 `TileSimWebRuntime-<version>-x64.zip`、payload 内 `release.json`/`PAYLOAD-SHA256SUMS` 和外层
`SHA256SUMS`。可用 `pnpm install:windows-runtime -PayloadZipPath ... -Mode validate` 做离线校验，再用
`pnpm smoke:windows-release -ReleaseManifestPath ...` 验证已经启动的 Bridge。当前命令会明确拒绝伪装成完整安装器的
`-InstallerPath`，并把 manifest 标记为 `runtime_zip_only_installer_pending`；WSL import、launcher 嵌入和签名安装器
仍属于后续 P1 工作，不能把这个 ZIP 对外宣传为点击即用安装包。

维护者只需在一个版本 tag 或手动 workflow 中执行：

```text
checkout Web commit + backend commit
  -> pnpm install --frozen-lockfile
  -> contracts:check / docs:check / deps:check / typecheck / test / lint / build
  -> Bridge py_compile + unittest
  -> WSL backend configure/build + selected CTest + TileSimCLI smoke
  -> build immutable Web/Bridge snapshot
  -> assemble backend resources and WSL rootfs (or native CLI)
  -> generate release.json, SHA256SUMS and SBOM
  -> sign installer and launcher
  -> install/upgrade/rollback smoke in clean Windows VM
  -> publish EXE + ZIP + manifests only when every gate passes
```

构建脚本建议新增：

- `scripts/build-windows-runtime.ps1`：编排构建，不读取开发机 `runtime/backend-current.json`；
- `scripts/package-windows-release.ps1`：组装 payload、生成 manifest/hash/SBOM；
- `scripts/doctor.ps1`：预检并输出 JSON；
- `scripts/install-windows-runtime.ps1`：供安装器调用的幂等安装/升级/回滚核心；
- `scripts/smoke-windows-release.ps1`：在临时端口/临时用户数据根执行 health、manifest 和最小 run。

CI 必须从干净 checkout 读取两个固定 revision；不能把开发机 `.git`、未提交文件、`runtime/`、`runs/`、模型配置或测试结果复制进 payload。发布前保存构建日志和 manifest，但对外日志要做 secret scrub。

## 故障策略

| 故障                 | 用户看到的结果                                        | 处理规则                               |
| -------------------- | ----------------------------------------------------- | -------------------------------------- |
| WebView2 缺失        | 安装阻断并给出 Microsoft 安装提示                     | 不打开半成品                           |
| WSL/虚拟化未启用     | 明确显示“此版本需要 WSL2”，提供管理员操作和重启后继续 | 不自动下载源码、不伪造 execution ready |
| 5173 被占用          | 显示占用 PID/建议关闭或改为未来支持的端口配置         | 不结束未知进程；首版固定端口时直接阻断 |
| 无网络/代理失败      | 在线安装器停止在预检；完整 ZIP 可继续                 | 保留旧版本和 staging                   |
| 磁盘不足/权限不足    | 安装前报告所需空间和目录                              | 不删除 runs/config                     |
| digest/签名不匹配    | 安装拒绝，记录 artifact 名称和稳定错误码              | 不切换 current                         |
| Bridge 启动失败      | 回滚旧 release；诊断包不含 key                        | 旧版仍可启动                           |
| 模型 endpoint 不可用 | 工作台照常打开，模型能力显示 unavailable              | 可在设置页重试，不阻塞基础仿真         |
| API Key 无法解密     | 提示当前 Windows 用户重新保存                         | 不打印密文或明文                       |
| 非 ASCII/空格路径    | 发行验收必须覆盖                                      | 失败即阻断发布                         |

## 版本兼容矩阵与发布门槛

每个 manifest 至少声明：`version`、Web/后端 revision、schema-set revision、runtime kind、最低 Windows build、WebView2 要求和数据迁移版本。升级规则：

- 同一 major 且 schema-set 向后兼容：可直接升级；
- schema-set 或 runs schema 不兼容：必须有迁移脚本和备份，否则阻断；
- 后端 CLI、Bridge、静态资源或 schema identity 任一不一致：health 失败并回滚；
- `wsl-prebuilt` 与 `windows-native` 不允许静默互换，需独立 smoke 与迁移说明；
- F9 Provider live acceptance、真实硬件、citation/evidence review 仍按现有 GO/NO-GO 规则，不因安装器通过而自动升级为生产能力。

对外“可下载即用”的发布门槛是：干净 Windows 10/11 x64 VM、无 Git/Node/pnpm/Python/CMake/C++、按文档完成 WebView2/WSL 前置（若版本需要），安装器完成并打开工作台，health/manifest/smoke 全绿，升级失败可回滚，用户数据保留。未达到门槛时只能发布给开发者的源码 bootstrap 包。

## 分阶段工作包

### P0：可重复构建基线

- 建立 Web + TileSim 联合版本和 manifest schema；
- 固定 CI Windows/WSL 构建机与后端资源清单；
- 产出可运行的 WSL rootfs，并验证无需用户 CMake/CTest；
- 改造 Bridge identity，使无 Git 的 packaged mode 使用 manifest revision；
- 增加 doctor、payload inventory、secret scrub 和 clean VM smoke。

### P1：安装器与配置迁移

- 以现有 Tauri 2/NSIS 为 signed bootstrapper 和启动器外壳，新增 Rust 安装核心（预检、payload 校验、staging、`wsl --import`、current 指针、health smoke 和回滚）；不要依赖用户的 PowerShell、Node 或 Git；
- 把 Web、Bridge、CLI/rootfs、资源、contracts 和 launcher 放进同一 payload；
- 将 config/runs/logs 移到 `%LocalAppData%\TileSim`；
- 把现有 DPAPI 设置、模型探针、assistant 环境转发接到安装版路径；
- 实现原子 current 指针、旧版保留、失败回滚、卸载数据选择。

### P2：离线与运维

- 发布完整 ZIP 和企业代理/离线介质；
- 增加签名轮换、撤回、SBOM、日志轮转和诊断导出；
- 评估 Windows native `TileSimCLI.exe`，通过门槛后缩短安装时间并移除 WSL 依赖；
- 增加非 ASCII 路径、端口冲突、断电、杀进程和升级迁移 E2E。

## 对外用户说明（达到发布门槛后）

1. 下载 `TileSimWebSetup-<version>-x64.exe` 并双击；
2. 按预检提示启用 WebView2/WSL（若该版本需要）；
3. 安装完成后打开“模型服务”，填写 Base URL、模型名和 API Key；
4. 从开始菜单启动工作台；模型未配置时基础仿真仍可使用；
5. 需要离线安装或提交问题时使用同版本 ZIP 和诊断报告。

在实现上述 P0/P1 并完成干净机器验收前，用户文档必须明确写“当前版本仍需 Windows + WSL 源码部署”，不能写“下载后点击即用”。
