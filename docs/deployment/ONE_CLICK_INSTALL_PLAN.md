# TileSim Web 一键安装交付计划（兼容入口）

> 计划日期：2026-10-15  
> 目标平台：Windows 10/11 x64，电脑端本地工作台。  
> 目标用户：没有 Node、pnpm、Git、Python 或 C++ 开发环境的实验人员。  
> 关联调查：[部署就绪度调查](DEPLOYMENT_READINESS.md)。

> **当前决策（2026-10-24）**：本文件保留为 2026-10-15 计划的兼容入口。当前唯一实施依据是
> [`WINDOWS_DISTRIBUTION_AND_INSTALLER_PLAN_2026-10-24.md`](WINDOWS_DISTRIBUTION_AND_INSTALLER_PLAN_2026-10-24.md)。
> 两者出现差异时，以新方案为准；尤其是第一版同时交付签名安装器和同源离线 ZIP，后端首版先采用预构建 WSL runtime，
> 当前 Tauri EXE 仍不是可独立分发的完整运行时。

## 目标和边界

最终用户应当只需要：

1. 下载一个带版本号的 `TileSimWebSetup-x.y.z.exe`；
2. 双击安装并接受许可；
3. 等待安装器完成环境检查、运行时安装和健康检查；
4. 点击“启动工作台”。

安装完成后，用户不应再执行 `pnpm install`、`pnpm build`、CMake、CTest、Git worktree 或手工编辑 deployment manifest。模型服务继续作为可选配置；没有模型 Key 时，基础仿真和报告功能仍应可用。

本计划只覆盖“每个人在自己的 Windows 电脑上运行本地工作台”。多人网络访问、账号体系、远程 GPU 集群和云端服务需要另立部署项目，不能通过把当前 Bridge 监听地址改成 `0.0.0.0` 直接实现。

## 先确定交付形态

现有 `启动TileSim工作台.exe` 是定位 checkout 的 Tauri 启动器，不是完整运行时（`docs/deployment/LAUNCHER_BUILD_DEPLOYMENT_ROLLBACK.md:3-20`）。一键安装必须新增“发行包”，不能把这个 EXE 单独改名后发送给用户。

建议同时保留两条产品线：

| 产品线                      | 面向对象       | 用户动作                                       | 是否需要开发工具                                |
| --------------------------- | -------------- | ---------------------------------------------- | ----------------------------------------------- |
| Developer bootstrap         | 开发者、维护者 | clone 两个仓库后运行 `bootstrap-workbench.ps1` | 需要 Node、pnpm、Git、WSL、CMake/C++            |
| Windows Workbench Installer | 实验人员       | 下载安装器并运行向导                           | 不需要 Node、pnpm、Git、CMake；安装器负责运行时 |

第一阶段同时生成 Windows Workbench Installer 和同源离线 ZIP。安装器面向普通测试人员，ZIP 面向内网、离线安装和问题复现；
两者共享同一不可变 payload，不能分别从开发机目录拼装。具体构建、签名、WSL rootfs、DPAPI 配置和回滚门槛见当前方案。

## 推荐的最终安装架构

### 发行物

每个版本必须生成以下文件：

```text
TileSimWebSetup-<version>-x64.exe       # 用户安装器，签名
TileSimWebRuntime-<version>-x64.zip     # 内部调试/离线介质，可选
tilesim-workbench-release.json          # 联合 release manifest
SHA256SUMS                              # 所有发行物摘要
```

联合 manifest 固定以下身份，不能依赖用户电脑上的 Git：

```json
{
  "schema_version": "tilesim.workbench.release.v1",
  "version": "2026.10.15",
  "web_source_revision": "<40-char commit>",
  "backend_source_revision": "<40-char commit>",
  "schema_set_revision": "sha256:<digest>",
  "web_release_digest": "<digest>",
  "bridge_digest": "<digest>",
  "static_digest": "<digest>",
  "tilesim_cli_digest": "<digest>",
  "runtime_kind": "wsl-prebuilt|windows-native",
  "minimum_windows_build": "<build>",
  "installer_digest": "<digest>"
}
```

### 安装目录与用户数据

程序文件和用户数据分离，避免升级覆盖实验结果：

```text
%ProgramFiles%\TileSim\Workbench\releases\<release-id>\  # 不可变程序文件
%ProgramFiles%\TileSim\Workbench\current.json             # 当前 release 指针
%LocalAppData%\TileSim\runs\                              # 用户运行与报告
%LocalAppData%\TileSim\config\                            # 机器本地配置
%LocalAppData%\TileSim\logs\                              # 启动、升级和 Bridge 日志
```

当前脚本把 manifest 写成带机器路径的 `runtime/backend-current.json`（`scripts/update-backend.ps1:232-257`、`scripts/deploy-local-backend.ps1:322-346`）。安装版需要改为“安装根目录相对路径 + 用户数据绝对路径”，禁止复制开发机 manifest。

### 后端运行时策略

当前决策不是“先让用户编译”，而是先交付可校验的预构建 WSL runtime：本机可见的 `D:\tileSim\build-tr1-wsl\TileSimCLI`
是 ELF，且现有 `scripts/start-backend.ps1` 明确通过 WSL 的 `python3` 启动 Bridge。因此第一版安装器携带固定、带摘要的
WSL rootfs/导入包，调用 `wsl --import`，不在用户电脑执行 CMake、CTest 或 Git。安装器必须检测 WSL2、虚拟化、发行版
状态、权限和可用空间，并支持重启后继续。

后续只有在 CI 能生成并在干净 Windows 上通过 smoke、选定 CTest、依赖收集和 SHA-256 校验的 `TileSimCLI.exe` 后，才把
manifest 的 `runtime_kind` 切换为 `windows-native`，并移除 WSL rootfs。上述门槛完成前，不能把“下载源码后本机编译”称为一键安装。

## 安装器工作流

### 阶段 A：预检

安装器启动后先显示可行动的检查结果，不要安装到一半才报错：

- Windows 版本、x64 架构、可用磁盘空间；
- 管理员权限和安装目录写入权限；
- WSL 状态、虚拟机平台和目标发行版（仅 WSL 方案）；
- 5173 是否被占用；占用时提供“使用其他本地端口”或明确退出提示；
- 既有 TileSim 安装、当前 release 和可回滚版本；
- 网络、代理和下载空间；
- WebView2 Runtime；
- 运行时包的签名和 SHA-256。

预检应提供 `诊断报告` 按钮，导出不含 API Key 的 JSON，便于支持人员定位失败原因。新增 `scripts/doctor.ps1` 或等价 Rust 命令，开发者和安装器共用同一检查逻辑。

### 阶段 B：安装不可变运行时

1. 下载或读取本地离线介质；
2. 校验签名、manifest 和每个 payload digest；
3. 将 Web `dist/`、Bridge、CLI、固定资源复制到临时目录；
4. 完成全量文件清单校验后，原子改名为 `releases/<release-id>`；
5. 写入新 `current.json`，此时旧 release 仍保留；
6. 生成机器本地配置，禁止写入源码 checkout 和 Git 元数据。

所有失败都必须删除临时目录并保留旧版本，不得留下一个看似安装成功但 health 不可用的半成品。

### 阶段 C：配置和首次启动

安装器为 Bridge 写入固定的运行参数：

- release 根目录；
- 用户数据根目录；
- TileSimCLI 路径和 digest；
- 端口和 loopback 监听地址；
- schema-set revision；
- trace package 根目录（如启用）。

用户只在需要时配置 Evidence Agent。API Key 继续使用当前 Windows 用户 DPAPI 保存，安装器和日志不显示明文。配置文件不能进入 release snapshot。

### 阶段 D：安装验收

安装器必须在打开网页前完成：

1. Bridge 启动；
2. `GET /api/health` 返回 `execution_ready=true`、`versions_match=true`；
3. `GET /api/manifest` 与联合 release manifest 的 Web、Bridge、schema identity 一致；
4. 运行一个最小无 GPU smoke case，确认 CLI、输入物化、报告读取和 runs 写入正常；
5. 记录安装日志和最终 release digest；
6. 创建开始菜单/桌面快捷方式，快捷方式只指向安装器管理的启动命令。

只有以上步骤成功，界面才显示“安装完成”。

## 升级、卸载和回滚

### 升级

- 下载新 manifest 和 payload，先在临时目录完整校验；
- 保留当前 release 和最近一个可回滚 release；
- 停止旧 Bridge，切换 `current.json`，启动新 Bridge；
- 重新执行 health、manifest 和最小 smoke case；
- 失败时自动把 `current.json` 指回旧 release，并恢复旧服务；
- 升级不删除 `runs/`，需要 schema migration 时先备份再执行。

### 卸载

卸载向导明确区分：

- 删除程序文件；
- 保留用户运行数据；
- 用户确认后删除全部 runs、日志和模型配置。

默认保留用户数据，避免卸载误删实验结果。卸载前导出一个带版本和 schema identity 的备份包。

### 回滚

回滚对象是“完整 release + manifest + Bridge 配置”，不能只替换启动器 EXE。现有文档已经指出启动器回滚不会回滚 deployment manifest 或 immutable release（`docs/deployment/LAUNCHER_BUILD_DEPLOYMENT_ROLLBACK.md:38-44`），安装版必须把这三者绑定成一个操作。

## 分阶段实施计划

### P0：先达到可发布基线

目标：让团队拥有一个可信的版本，而不是包装当前工作树。

- 关闭或登记当前 7 项测试失败、20 项格式失败；
- 建立 Web/TileSim 联合 release manifest 和版本 tag；
- 在 CI 的全新 Windows 环境中执行完整构建、Bridge/前端门禁和最小 smoke case；
- 固化后端 CLI 的构建产物、运行库和 SHA-256；
- 确定支持的 Windows build、CPU 指令集、WSL 版本和最低磁盘空间；
- 禁止把 `runtime/backend-current.json`、开发机路径和未提交文件纳入发行物。

完成标准：维护者可以从一个版本号下载 Web、Bridge、CLI 和 manifest，并在另一台干净机器上重现相同 identity。

### P1：交付“在线一键安装”

目标：不要求用户安装开发工具，只要求 Windows 和网络。

- 增加 `scripts/doctor.ps1`，输出机器可读诊断结果；
- 增加安装器工程（建议继续使用 Tauri/NSIS 或专用 Windows bootstrapper）；
- 将 Node 运行时、Web 静态资源、Bridge、CLI 和固定资源纳入 payload；
- 将绝对路径 manifest 改为安装根目录相对路径；
- 安装器实现预检、下载、签名/digest 校验、原子切换、health 验收和失败清理；
- 对 WSL 方案实现 rootfs 导入、发行版版本校验和重启续装；
- 提供中文安装日志、复制诊断报告和明确错误修复建议。

完成标准：一台没有 Node/pnpm/Git/CMake 的干净 Windows 机器，用户只运行安装器即可打开工作台并完成最小 smoke case。

### P1：升级和数据安全

- 保留最近两个 immutable release；
- 定义 runs 的 schema migration、备份、恢复和保留策略；
- 实现“更新失败自动回滚”；
- 实现卸载时保留/删除数据的明确选择；
- 对每次安装、升级、回滚记录版本、digest、health 结果和错误码；
- 在安装器中显示当前 Web、Bridge、CLI 和 schema-set 版本。

完成标准：模拟下载损坏、端口冲突、Bridge 启动失败、磁盘不足和中途断电后，旧版本仍可启动，用户 runs 不丢失。

### P2：离线包和长期运维

- 生成包含全部 payload 的离线 ZIP/ISO；
- 支持代理和企业内网镜像；
- 提供企业签名、版本公告和撤回策略；
- 增加日志轮转、磁盘占用提示和运行数据清理工具；
- 评估 Windows 原生 CLI，逐步移除 WSL 依赖。

完成标准：无公网环境使用离线介质完成安装、升级、回滚和诊断。

## 代码与文件改造清单

| 区域                                           | 主要改造                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `scripts/release-*.mjs`                        | 生成联合 manifest、payload inventory、签名和版本化 release bundle                     |
| `scripts/doctor.ps1`                           | 统一预检 Node/WSL/CLI/端口/权限/空间/版本，并输出 JSON                                |
| `scripts/start-backend.ps1`                    | 接受安装根目录和用户数据根目录，取消默认开发机路径，返回结构化 health 结果            |
| `scripts/deploy-local-backend.ps1`             | 保留开发者部署入口，与安装器部署入口分离，禁止安装器依赖 Git worktree                 |
| `bridge/infra/identity.py`、`bridge/server.py` | 支持 release 相对路径、运行时配置文件和安装版数据目录；继续 fail closed 校验 identity |
| `tools/workbench-launcher/src-tauri/`          | 增加安装、升级、回滚、诊断和快捷方式调用；把当前 launcher self-check 扩展为安装后验收 |
| `tests/`、`tools/workbench-launcher/tests/`    | 增加干净机器、安装失败、升级、回滚、非 ASCII 路径、端口冲突和数据保留 E2E             |
| `docs/deployment/`                             | 发布清单、管理员指南、离线安装、故障码和支持流程                                      |

## 验收矩阵

| 场景                               | 必须通过的结果                                           |
| ---------------------------------- | -------------------------------------------------------- |
| 干净 Windows 10/11 x64、无开发工具 | 一次安装器完成并打开工作台                               |
| 已有旧版本和 runs                  | 升级后 runs 可读，旧版本可回滚                           |
| 无网络                             | 离线包可安装；在线安装器给出可复制诊断，不留下半安装状态 |
| WSL 未启用（WSL 方案）             | 安装器明确提示能力和管理员操作，重启后可继续             |
| 5173 被占用                        | 不误杀其他进程；使用配置端口或清晰失败                   |
| 非 ASCII、带空格安装路径           | Bridge、CLI、release snapshot 和 runs 全部可读写         |
| 下载包被篡改                       | digest/签名校验失败，旧 release 不受影响                 |
| Bridge 启动失败                    | 安装失败；旧版本或旧 manifest 可恢复                     |
| 模型未配置                         | 基础工作台可用，Evidence Agent 明确显示可选能力不可用    |
| 卸载                               | 默认保留 runs，并提供显式删除选项                        |

## 交付后的用户说明

用户文档只保留三条主路径：

1. **安装**：下载并运行安装器；
2. **启动**：从开始菜单打开工作台，查看服务状态；
3. **诊断/更新**：点击“检查更新”或“导出诊断报告”。

把 `pnpm`、CMake、CTest、Git worktree、schema drift 和 manifest 细节留在维护者文档中。这样才能让产品体验从“开发者部署脚本”变成“普通用户一键安装”。

## 计划出口

当 P0、P1 的发布基线、安装器和升级回滚验收全部通过后，才可以把交付状态改为 `installable_windows_release`。在此之前，对外只能承诺“Windows + WSL 源码部署”，不能承诺“下载即用”。
