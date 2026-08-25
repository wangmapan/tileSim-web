# Local bridge contract

bridge 在 `127.0.0.1:5173` 上托管构建后的前端和受控 API。它不会接受任意 shell 命令、任意文件路径或写入 TileSim 核心仓库。

## API

- `GET /api/health`：bridge、CLI、核心仓库与前端构建状态，并返回实际的 `backend_revision`、`backend_branch` 与 `tilesim_root`，用于核验网页当前连接的代码版本。
- `GET /api/catalog`：白名单场景、fidelity policy 与输入模式。
- `GET /api/templates/{scenario}`：受控场景的输入模板。
- `POST /api/runs`：提交结构化覆盖参数或一对受限 JSON 输入。
- `GET /api/runs/{id}`：读取任务状态。
- `GET /api/runs/{id}/reports`：读取完整报告包。
- `GET /api/runs/{id}/files/{artifact}`：查看白名单 JSON 工件。
- `POST /api/runs/{id}/name`：修改本地实验名称。
- `GET /api/runs`：列出最近 20 次运行。

请求体最大 2.1 MB；单份自定义输入最大 1 MB。跨域只允许本地 Vite 开发地址，生产页面与 API 使用同源访问。

每次运行都会物化独立的输入文件并写入 `D:\tileSim-web\runs\run-*`。完成或失败状态同时更新到 `run-metadata.json`，因此 bridge 重启后仍能恢复可靠状态。

受控运行要求 `source_revision == build_revision`。两者不一致时 `/api/health` 返回 `execution_ready: false`，`POST /api/runs` 返回 503；使用 `scripts/update-backend.ps1` 完成一致性部署后才会恢复执行。
