# Windows 工作台启动器构建与回滚

当前仓库根目录的 `启动TileSim工作台.exe` 是 Tauri 2 工作台，源码在
`tools/workbench-launcher/`。`tools/launcher/tilesim_launcher.py` 是历史 Tk 实现，
不能再用 PyInstaller 将它覆盖到根目录。旧 `tools/launcher/build-launcher.ps1` 已转发到 Tauri 构建入口。

## 构建

需要 Windows 10/11、Node.js 20+、pnpm 11.19.0、Rust stable MSVC、Visual Studio C++ Build Tools / Windows SDK
和 WebView2 Evergreen Runtime。先安装锁定依赖，再运行：

```powershell
pnpm install --frozen-lockfile
.\tools\workbench-launcher\build-launcher.ps1
```

脚本依次运行 Rust fmt、严格 Clippy、Rust 单元测试、启动器 Vitest 与独立 4187 fixture E2E，
构建 Tauri/NSIS，再对根目录候选 EXE 执行 packaged self-check。只有检查通过才原子替换
`启动TileSim工作台.exe`；旧 EXE 保留在被 Git 忽略的 `runtime/launcher-fallback/`。
自检验证从 EXE 所在目录找到 checkout、固定脚本、内置 Node、WebView2，且不读取 credential、
不访问 Provider、不触碰 5173。构建本身不执行部署。

概览页只有两个日常入口：

- “一键启动工作台”：已有清单且服务就绪时只打开网页；服务未运行时验证并启动已有 release，成功后打开网页；
  首次没有部署清单时转为本地部署确认。
- “重新部署当前代码”调用 `scripts/deploy-local-backend.ps1 -SourceRoot <所选后端 Git 工作树>`，
  使用该后端与当前 Web checkout 文件（含未提交改动），不 fetch/push、不切换分支。

重新部署须先确认，验证发布成功并通过服务健康检查后打开网页；会重启 127.0.0.1:5173。
“部署设置”保留仓库目录和 WSL 配置；“高级操作”折叠区中的“更新并部署最新 main”
仍调用 `scripts/update-backend.ps1`，拉取后端 `origin/main` 并使用独立部署工作树，另可停止服务。
启动或部署运行时，页面顶部显示当前脚本阶段、持续计时、最近一行脱敏输出和动态进度条；
“操作日志”可查看本次会话的完整输出。进度条是**进行中指示**，不是按时间估算的百分比，
脚本没有提供可靠的总工作量；完成或失败后显示结果，失败时解决办法优先显示。

后端 CTest 由两个部署入口串行执行，并使用 CTest `--repeat until-pass:2` 对单个瞬态失败重试一次；若同一测试再次失败，部署仍以非零结果终止并保留原有回滚语义。
启动器不会调用桌面个人 `.cmd`，也不会强制结束 Vite/Playwright 等开发进程。

## 回滚

先确认构建和部署均未运行、启动器窗口已关闭。定位
`runtime/launcher-fallback/启动TileSim工作台.previous-<时间>-<进程>.exe`，
核对其哈希与预期版本，再复制回仓库根目录的原文件名。保留 fallback，
并使用 `--self-check-file <runtime 内的输出路径>` 验证恢复的 EXE；不要运行部署来验证启动器回滚。
回滚启动器不回滚 deployment manifest 或 immutable release。
