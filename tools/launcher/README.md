# TileSim 工作台启动器

本目录保留旧 Python/Tk 源码供历史追溯；当前侧栏式 Tauri 启动器源码位于 `tools/workbench-launcher/`。
启动器不是仓库部署的前置条件；新用户应先按 `docs/getting-started/AI_DEPLOYMENT_AND_HANDOFF.md` 完成 bootstrap。

旧版源码模式（不会生成当前 EXE）：

```powershell
py -3 .\tools\launcher\tilesim_launcher.py
```

构建当前 Tauri EXE（兼容入口）：

```powershell
.\tools\launcher\build-launcher.ps1
```

默认产物为前端仓库根目录下被 Git 忽略的 `启动TileSim工作台.exe`。`-OutputDirectory` 和
`-PythonLauncher` 不再支持；不要使用 PyInstaller 覆盖当前 EXE。Tauri 构建条件、测试与原子回退见
[`tools/workbench-launcher/README.md`](../workbench-launcher/README.md)。
