# TileSim Web

TileSim Web 是独立于 `D:\tileSim` 的本地仿真实验与证据分析工作台。前端使用 Vue 3 + Vite；Python bridge 负责提供白名单 API、调用本地 `TileSimCLI`，并把每次运行的输入与报告保存到 `runs/`。

## 首次安装

需要 Node.js 20 或更高版本，以及 pnpm：

```powershell
pnpm install
pnpm build
```

构建产物写入 `dist/`。bridge 会优先托管 `dist/`；如果尚未构建，则只回退到源码目录供开发排查。

## 后端更新与日常启动

执行后端使用独立 worktree `D:\tileSim-backend`，不会跟随日常开发目录 `D:\tileSim` 切换分支。首次部署或代码更新时运行：

```powershell
.\scripts\update-backend.ps1 -Ref origin/main
```

脚本会依次更新独立 worktree、使用提交专属构建目录编译、运行 TileSim/PR4/Web 测试、写入部署清单，并且只在全部通过后重启 bridge。若暂时要部署尚未合入主线的本地集成分支，可明确指定；本地可解析的目标不会访问远端：

```powershell
.\scripts\update-backend.ps1 -Ref codex/pr4-web-backend
```

仅按当前部署清单重新启动 bridge：

```powershell
.\scripts\start-backend.ps1
```

也可以在 WSL 中手工启动 bridge，但手工启动必须同时提供源码、CLI 与构建版本；缺少版本清单时执行 API 会拒绝运行，避免源码与二进制错配。

```bash
TILESIM_ROOT=/mnt/d/tileSim-backend \
TILESIM_CLI=/home/mapanwang/tilesim-backend-builds/<commit>/TileSimCLI \
TILESIM_BUILD_REVISION=<commit> \
TILESIM_DEPLOYMENT_MANIFEST=/mnt/d/tileSim-web/runtime/backend-current.json \
python3 /mnt/d/tileSim-web/bridge/server.py
```

启动后打开：

<http://127.0.0.1:5173>

前端源码修改后运行：

```powershell
pnpm build
```

开发时可同时启动 bridge 与 Vite：

```powershell
pnpm dev
```

开发页面位于 <http://127.0.0.1:4173>，`/api` 会代理到 bridge。

## 验证

```powershell
pnpm test
pnpm build
python -m py_compile bridge/server.py
```

## 功能边界

- 可配置调度、batch、KV、通信负载与 Scale-up/Scale-out 参数。
- 可直接编辑或导入 Runtime trace 与 Fabric topology JSON。
- 可导入、查看、恢复和对比本地运行报告。
- 报告导入会校验 Trace 身份，避免混合不同运行的证据。
- 页面逐项展示来源、校准状态、允许声明范围和各子系统实际 fidelity。
- 浏览器缓存只保存当前视图、运行 ID 和对比选择，不缓存报告正文。

当前受控执行场景仍为 `S1 → S6`。合成 Trace 只能支持一致性和探索性比较，不能替代真实校准或 held-out 验证。

## 目录

```text
src/components/   通用界面组件
src/views/        页面级功能
src/lib/          API、格式化与报告适配
src/store/        工作区状态与恢复逻辑
bridge/           本地白名单 API 与 CLI 调用
runs/             本地运行产物（不进入 Git）
runtime/          当前后端部署清单（不进入 Git）
scripts/          后端更新与启动脚本
```
