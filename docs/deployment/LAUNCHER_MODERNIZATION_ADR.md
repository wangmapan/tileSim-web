# ADR：Windows 工作台启动器现代化

**状态**：接受，代码实现可继续；本机原生构建门禁阻塞  
**事实日期**：2026-09-11  
**范围**：Windows 本地工作台启动、部署适配、模型服务配置和环境诊断；不改变主站、Bridge、部署 manifest 或仿真契约

## 决策

采用 Tauri 2、Vue 3、TypeScript、Vite、Rust command layer、Vitest、Playwright Web fixture 和 Windows WebView2。新实现放在 `tools/workbench-launcher/`，旧 `tools/launcher/` 和当前根目录 Python/Tkinter EXE 在功能对等与打包验收完成前继续保留。

Rust 层只暴露固定的 typed command，并通过参数数组调用已存在的 PowerShell 入口。部署、不可变 release、manifest、DPAPI、WSL worktree 和构建缓存语义仍由现有脚本拥有；启动器不复制这些语义，也不提供任意 shell、文件系统或远程页面能力。

本次迁移不属于目标推理系统五层或仿真执行与控制平面。它只是本地开发与部署工作台，不改变任何模拟粒度、仿真保真度、Trace provenance 或证据范围。

## 方案比较

| 方案           | 优点                                                                                                                                     | 主要风险                                                                            | 结论                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 当前 Tkinter   | 已部署、标准库依赖少、单文件打包已验证                                                                                                   | 交互、可访问性、响应式、主题和自动化测试能力不足；继续扩展会积累大量平台特例        | 保留为临时 fallback，不继续作为主实现扩展                 |
| PySide6 / Qt 6 | 原生控件成熟、离线运行直接、无需 WebView2                                                                                                | 打包体积与许可/分发复杂度更高；与现有 Vue/TypeScript 能力栈分离；Web fixture 复用弱 | 仅当 Tauri 的硬条件被事实证明无法满足时再由项目所有者决定 |
| Tauri 2        | 安装体积和权限面小于 Electron；Vue/TypeScript 可复用；Rust 可形成窄 command allowlist；WebView2 支持成熟的键盘、DPI、主题和 fixture 测试 | Windows 构建依赖 Rust/MSVC/WebView2；需显式解决内置 Node、单 EXE 入口和关闭窗口行为 | 采用                                                      |
| Electron       | Web 技术成熟、自动化生态完整                                                                                                             | 明确不符合项目要求；运行时与打包体积更大；扩大 Node/process 权限面                  | 拒绝                                                      |

## 七项硬条件技术尖峰

1. **保留根目录入口**：production build 生成固定内部名的 Windows GUI executable，构建脚本在验证后复制为仓库根目录 `启动TileSim工作台.exe`。EXE 仍从自身目录定位 Web checkout。
2. **运行时不依赖系统 Node PATH**：构建时读取通过 `Resolve-TileSimNode` 验证的 Node executable，将字节嵌入 Rust binary；运行时按内容摘要提取到被 Git 忽略的用户级 launcher runtime，再通过进程级 `TILESIM_NODE` 传给 PowerShell。
3. **继续使用现有 Node 机制**：不修改部署脚本的 Node 发现顺序。Rust 只注入 `TILESIM_NODE`，`deployment-common.psm1` 仍是唯一解析入口。Node 不作为可接收任意参数的前端 sidecar command 暴露。
4. **从 EXE 目录解析 checkout**：优先验证 `current_exe().parent()` 下的固定脚本集合；开发模式才回退到编译期仓库路径。无有效 checkout 时失败关闭。
5. **不开放任意命令执行**：前端只能发送 Rust enum 定义的操作；脚本名、开关、WSL 发行版和目录均按操作单独验证。Rust 使用 `Command::args`，不拼接 shell command，不启用 Tauri shell plugin。
6. **可重复构建与 packaged self-check**：固定 pnpm 版本和 Tauri/Rust crate 版本；构建脚本验证 GUI subsystem、根目录定位、脚本集合、manifest presence、内置 Node、无 Node PATH 的 `Resolve-TileSimNode`、WebView2 检测，以及 self-check 没有读取 credential、访问 Provider 或触碰 5173。
7. **干净 clone 可构建**：文档列出 Node/pnpm、Rust stable MSVC toolchain、Visual Studio C++ Build Tools 和 WebView2 Evergreen Runtime；构建不依赖维护者路径。旧启动器在迁移期仍可按原说明构建。

上述设计满足技术可行性门禁，没有发现必须改用 PySide6 的产品级阻塞。当前电脑缺失的构建工具属于环境门禁，不改变架构结论。

## 安全与留存边界

- API Key 只从非受控、非响应式 password input 取出一次，经 Tauri invoke 进入 Rust 后立即写入现有 `configure-evidence-agent.ps1 -ApiKeyFromStdin` 的 stdin；不进入命令参数、日志、stdout、错误详情、snapshot 或持久化 UI state。
- 保留现有 Key 时只发送 `KeepExistingKey`，前端不读取 DPAPI blob。
- Base URL 仍由现有 PowerShell 模块执行 HTTPS/loopback 校验；Rust 和前端再做同方向的早期校验，但不替代脚本门禁。
- CSP 只允许本地资源；不启用远程导航、Tauri shell plugin 或宽泛 filesystem/process capability。
- 只持久化主题、最后页面和窗口偏好；操作日志不持久化，并采用固定行数和单行长度上限。
- friendly error formatter 在进入 UI 前对 Windows/WSL 路径和 credential-like 文本脱敏。stdout 永远作为纯文本显示。
- 修改型操作使用单槽状态机。刷新/健康检查可并行，但不能改变当前 deployment operation ID 或 phase。
- 现有部署脚本没有安全 cancellation contract，因此本版不强杀子进程；运行中关闭窗口会提示，界面明确显示“当前版本暂不支持安全取消”。

## 视觉参考原则

本次只提炼可转移原则，不复制品牌、独特构图或资产。

| 来源与界面                                   | 可转移原则                                             | TileSim 适配                                                  | 不复制                                       |
| -------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- | -------------------------------------------- |
| GitHub Desktop 文档中的 Windows Options 左栏 | 稳定的左侧任务分类、右侧一次只处理一类设置             | 六个本地运维页面，主要操作每页最多一个                        | GitHub 品牌、菜单层级和橙色教程标注          |
| Grafana Dashboard/文档导航                   | 高密度信息通过行、分组和按需详情表达，而不是重复大卡片 | 概览使用状态带和紧凑定义表；SHA、路径、identity 放专业详情    | 仪表盘面板网格、营销导航和虚构监控数据       |
| Raycast Windows Root Search / Manual         | 键盘路径可见、动作与结果紧邻、状态简洁                 | 全量 Tab/Shift+Tab、Enter/Space、Escape、滚动键和底部任务状态 | 搜索启动器交互模型、品牌快捷键和浮动玻璃效果 |

浅色和深色均沿用 TileSim 主站的 Segoe UI / Microsoft YaHei UI、低圆角、细边框、克制蓝色强调和语义状态色。800×600 时左栏收窄为短标签/可滚动区域，主要操作保持可达；更宽窗口恢复完整说明。状态同时使用文字与形状，不以颜色作为唯一信息载体。

## 基线与本机构建门禁

迁移前基线 `32a8703d66d9b4acd5ca6e4661a5608f6ce33720`：

- launcher/deployment 专用 Vitest：2 files、10 tests 全部通过；
- 当前 `启动TileSim工作台.exe` self-check：exit 0，能定位 checkout、内置 Node 和必需脚本；
- Node `v24.19.0`、pnpm `11.19.0`、Git `2.45.1.windows.1` 可用；
- WSL2 `Ubuntu-24.04` 可见且正在运行；后端仓库与 deployment worktree 可发现；
- 未发现 Rust/Cargo、Visual Studio C++ Build Tools、WebView2 Evergreen Runtime，`npx` 不在 PATH。

因此可以完成源码、Web fixture、Vitest、Playwright 和文档实现，但本机暂时不能声称以下门禁通过：`cargo fmt`、`cargo clippy`、`cargo test`、Tauri production build、native window 截图、packaged self-check、新 EXE 大小与 SHA-256。不得通过未经授权安装系统依赖来掩盖这些阻塞项。

## 回滚

迁移期间不覆盖或删除旧源码和旧 EXE。若新构建未通过或运行异常，继续使用由 `tools/launcher/build-launcher.ps1` 生成的 Python/Tkinter `启动TileSim工作台.exe`。新构建脚本在替换根目录入口前应将旧 EXE 移到被忽略的 `runtime/launcher-fallback/`，并提供恢复命令；该备份不进入 Git。

## 影响

- 部署脚本、manifest schema、contract identity 和 5173 服务语义保持不变。
- 新增一套独立 launcher 前端和 Rust command layer，以及专用 fixture/E2E。
- 原生交付的最终验收仍依赖在具备 Rust stable MSVC、MSVC Build Tools 与 WebView2 的 Windows 机器上执行完整门禁。
