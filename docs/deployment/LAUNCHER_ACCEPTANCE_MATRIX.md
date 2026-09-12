# Windows 工作台启动器验收矩阵

更新日期：2026-09-11。本文记录 Tauri 迁移的当前可验证事实，不把 fixture、一致性检查或源码审计写成原生打包通过。

## 功能对等

| 能力                                  | 旧 Tkinter | 新 Tauri 实现                                            | 当前证据                                                  |
| ------------------------------------- | ---------- | -------------------------------------------------------- | --------------------------------------------------------- |
| 服务健康状态与下一步                  | 有         | 概览首屏、诊断和只读健康检查                             | Vue/Vitest/fixture E2E 通过                               |
| deployment identity 与 revision       | 有         | 首屏摘要，完整值位于“专业详情”                           | fixture E2E 通过                                          |
| CTest/Web 验证状态                    | 有         | 关键状态条与 manifest 读取                               | fixture E2E 通过                                          |
| Evidence Agent 配置状态               | 有         | 只读取公开 `Show` 输出，不读取 Key                       | 源码审计与既有 DPAPI tests 通过                           |
| Base URL、模型、超时                  | 有         | typed form 与 Rust 双层校验                              | component/E2E 与 Rust tests 通过                          |
| API Key DPAPI 保存/保留               | 有         | Key 不进入 Vue state，经 stdin 调固定脚本                | DPAPI tests、fixture secret regression 与 Rust tests 通过 |
| 后端仓库选择                          | 有         | Windows folder picker，仅返回明确选择目录                | 源码审计、Rust 构建通过；未打开原生 picker                |
| deployment worktree                   | 有         | 固定为 Web checkout 同级 `tileSim-backend`，UI 只读      | Rust allowlist 源码审计                                   |
| WSL 发行版                            | 有         | 名称 allowlist；启动、部署、修复均传 typed 参数          | fixture 交互与 Rust tests 通过                            |
| 启动/重启并打开                       | 有         | 二次确认后调用固定 `start-workbench.ps1`                 | fixture E2E 通过；未触碰 5173                             |
| 只打开网页                            | 有         | `ShellExecuteW` 打开固定 loopback URL                    | fixture E2E 与原生构建通过；按保护规则未点击              |
| 更新并部署 main                       | 有         | 参数数组调用 `update-backend.ps1`，展示分阶段状态        | fixture success/error E2E 通过；未真实部署                |
| 修复 WSL                              | 有         | 二次确认后调用固定 `request-wsl-repair.ps1`              | UI/源码审计；未请求管理员权限                             |
| 刷新状态                              | 有         | 与修改状态分离，可安全并行                               | fixture E2E 通过                                          |
| 后台长任务/防重复                     | 有         | Rust AtomicBool 单槽，operation ID + sequence            | component/E2E 与 Rust competition test 通过               |
| 正式错误与脱敏详情                    | 有         | 先给解决办法，详情可展开复制                             | fixture error/axe 与 Rust redaction tests 通过            |
| 日志留存上限                          | 有         | 前后端各 400 行，单行 4000 字符，会话结束不持久化        | Vitest 与 Rust tests 通过                                 |
| EXE 目录定位 checkout                 | 有         | executable directory 优先，candidate self-check 强制验证 | packaged self-check 通过                                  |
| 内置 Node、无 Node PATH               | 有         | build-time embed、摘要目录提取、`TILESIM_NODE` 注入      | deployment regression 与新 EXE packaged self-check 通过   |
| build cache 绑定 revision/source path | 有         | 不复制语义，继续使用既有 PowerShell 实现                 | 既有 deployment portability test 通过                     |

## 交互与视觉 QA inventory

| 状态或控制                  | 功能检查                                        | 视觉检查                            | 结果                                      |
| --------------------------- | ----------------------------------------------- | ----------------------------------- | ----------------------------------------- |
| 浅色概览首屏                | 状态、唯一主要操作、下一步、详情折叠            | 1440×900 与常规桌面截图             | 通过                                      |
| 深色模型设置                | Base URL/model/timeout/Key、保存、状态          | 深色对比和表单层级截图              | 通过                                      |
| 左侧六项导航                | 鼠标、Tab、Shift+Tab、Enter、Space              | 选中轨道、窄栏短标签                | 通过                                      |
| 主区域滚动                  | wheel、原生 scrollbar、PageUp/PageDown/Home/End | 800×600 展开诊断详情                | 通过                                      |
| 危险操作确认                | 初始焦点在“返回”、Escape、焦点回到触发点        | 深色 modal、遮罩和按钮层级          | 通过                                      |
| 操作状态机                  | 运行中禁用重复提交，完成恢复焦点                | 底部阶段、消息、耗时                | 通过                                      |
| 表单错误                    | 聚焦首错、HTTPS/loopback 提示                   | 错误色不作为唯一信息                | 通过                                      |
| 失败面板                    | 解决办法优先、技术详情展开/复制                 | 深色失败态截图                      | 通过                                      |
| 环境诊断                    | Git/WSL/Node/WebView2/manifest 与中文路径       | 800×600 高密度列表、纵向滚动        | 通过                                      |
| 操作日志                    | 独立滚动、清空、400 行裁剪                      | 深色代码区和长文本换行              | Vitest/源码审计通过                       |
| 主题                        | 浅/深切换并只持久化非敏感偏好                   | 两个主题截图                        | 通过                                      |
| reduced motion              | 媒体查询禁用旋转/过渡                           | 自动检查                            | 通过                                      |
| 高对比可识别                | 状态形状 + 文本；axe color contrast             | 浅色侧栏与深色状态                  | axe 通过                                  |
| 800×600、1024×768、1440×900 | 主操作可达、无横向裁切、状态栏在界内            | viewport screenshots/numeric bounds | 通过                                      |
| 150%、200% device scale     | 主操作可见、焦点可见、无横向溢出                | 确定性 Chromium device scale        | 通过；原生 Tauri 构建通过，未切换系统 DPI |
| 原生浅色/深色窗口           | 首屏、导航、状态、主题切换                      | 1182×790 Windows.Graphics.Capture   | 两个主题逐图通过                          |

探索性场景包括：远程明文 HTTP、URL 内嵌凭据/查询参数、首次配置缺 Key、deployment worktree 本地修改、快速重复提交、运行中 Escape 和长中文路径。fixture 不连接正式 Provider，不创建 simulation run。

## 安全与留存

| 断言                                                     | 证据                                     | 状态                        |
| -------------------------------------------------------- | ---------------------------------------- | --------------------------- |
| Key 不进入 DOM、日志、HTML snapshot                      | component + Playwright secret regression | 通过                        |
| Key 不进入 Rust args                                     | `typed_arguments_never_include_secret`   | Rust test 通过              |
| Key 经 stdin 后清零                                      | `Zeroizing<String>` + explicit zeroize   | Rust test 通过              |
| Current User DPAPI 与保留已有 Key                        | 既有 `launcher-config.test.js`           | 通过                        |
| credential/path technical detail 脱敏                    | Rust formatter tests                     | Rust tests 通过             |
| 不持久化日志或 Key                                       | 仅 theme/page 使用 localStorage          | component test/源码审计通过 |
| 无宽泛 Tauri shell/filesystem/process 权限               | capability 仅 `core:default`             | Tauri info/源码审计通过     |
| 本地 CSP、无远程页面导航                                 | `tauri.conf.json`                        | Tauri info/源码审计通过     |
| self-check 不读 credential、不访问 Provider、不触碰 5173 | packaged JSON 显式负面字段               | 新 EXE 通过                 |

## 当前门禁状态

- `pnpm typecheck`：通过；
- launcher ESLint：通过；
- `pnpm test`：主站 65 files / 509 passed / 8 条既有条件性 skip，随后 launcher 3 files / 10 passed；
- launcher Vitest：3 files / 10 tests 通过；
- launcher fixture Playwright：14 tests 通过；
- launcher Web production build：通过；
- 主站 fixture Playwright：默认 5 worker 最终重跑为 45 passed / 5 个资源超时 / 6 条 deployed live skip，`pnpm test:e2e` 原命令不能记为通过；同分支早先单 worker 完整运行 50 passed / 6 skip，最终单 worker 重跑为 49 passed / 1 个 30 秒资源超时 / 6 skip；唯一超时的 14 MB Worker 用例在单独 60 秒诊断预算下 37.7 秒通过；
- Tauri CLI config/info：可解析，WebView2 152.0.4191.66 可用；
- deployment portability：1 file / 9 tests 通过，包含 Rust verbatim drive path 转 WSL path 回归；
- Rust stable MSVC 1.98.1、Visual Studio Build Tools 2022 17.14.40、Windows SDK 10.0.26100.0：安装并验证；
- `cargo fmt --check`：通过；严格 clippy：通过；`cargo test`：12/12 通过；`Cargo.lock`：已生成；
- Tauri production build 与 NSIS：通过；NSIS 安装包 `26,040,697` bytes，SHA-256 `182462A2A6F4608CA535BF0A53E2B9F333FBC24342A597E7CB14BAA7F795DE6F`；
- packaged self-check：通过，`ready=true`、内置 Node SHA-256 `3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237`、无 Node PATH 与三个安全负面断言均通过；
- 原生 Windows 截图：浅色/深色逐图通过，保存在 ignored runtime；
- 新 EXE：`D:\tileSim-web-launcher-tauri-v2\启动TileSim工作台.exe` 与正式入口 `D:\tileSim-web\启动TileSim工作台.exe`，`104,746,496` bytes，SHA-256 `F9E1BA2A3BD7882AC2EEBDF26C2ED324A9E9717CA63A14398D4AF79428807DD8`；上一版 Tauri EXE 已原子保存在 ignored `runtime/launcher-fallback/`。

## 负面确认

本轮没有部署、停止、重启或替换 `127.0.0.1:5173`；没有读取或输出任何 `TILESIM_EVIDENCE_AGENT_*` 值；没有读取 API Key、调用 live Provider 或创建正式 simulation run；没有修改主站业务页面、Router、Evidence Agent、Agent Copilot、部署 manifest/identity contract、仿真/Trace/证据语义。经项目所有者明确授权，旧 Tkinter 源码已从分支删除；主工作树旧入口 `D:\tileSim-web\启动TileSim工作台.exe` 已在新 Tauri 路径兼容与 packaged self-check 通过后移入 Windows 回收站。
