# TileSim 工作台启动器

本目录保存可重复构建的 Windows GUI 启动器源码。启动器不是仓库部署的前置条件；新用户应先按 `docs/getting-started/AI_DEPLOYMENT_AND_HANDOFF.md` 完成 bootstrap。

源码模式：

```powershell
py -3 .\tools\launcher\tilesim_launcher.py
```

构建单文件 EXE：

```powershell
.\tools\launcher\build-launcher.ps1
```

默认产物为前端仓库根目录下被 Git 忽略的 `启动TileSim工作台.exe`。可用 `-OutputDirectory` 和
`-ExecutableName` 指定其他分发位置和文件名。脚本固定 PyInstaller 版本、使用隔离环境，将当前 Node.js
运行时嵌入单文件 EXE，并验证 Windows GUI
subsystem 并运行打包后自检。

打包后的启动器优先从 EXE 所在目录或显式 `TILESIM_WEB_ROOT` 定位 Web checkout；源码模式从脚本所在仓库定位。
后端源码和 deployment worktree 默认位于 Web 仓库同级的 `tileSim/`、`tileSim-backend/`，不依赖固定盘符或用户名。

功能包括：

- 查看当前 deployment/release/schema identity；
- 配置可选 Evidence Agent 模型服务；
- 启动已验证的 immutable release；
- 拉取后端 `origin/main` 并在独立 worktree 构建、验证、部署；
- 请求管理员权限修复 WSL 服务。

API Key 使用 Windows 当前用户 DPAPI，保存在被忽略的 `runtime/evidence-agent.local.json`，不会进入命令参数、日志、浏览器或 Git。状态检查和构建在后台线程运行，写操作单槽；操作未结束时禁止关闭窗口。
