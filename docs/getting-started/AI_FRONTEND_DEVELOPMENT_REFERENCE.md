# TileSim Web：前端开发 AI 参考（接手一页图）

> **事实日期**：2026-09-23（本文所有数字为当日实测；旧文档里的数字不可与此相减）
>
> **本文定位**：给「接下来要改前端代码的 AI」的一份**路由 + 硬约束 + 可跑命令**速查。
>
> **本文不替代、也不复制**下列文档，冲突时以它们为准：
>
> - [`AGENTS.md`](../../AGENTS.md)：仓库规则、代码边界、证据边界与**完整门禁清单**（权威）。
> - [`docs/AI_HANDOFF.md`](../AI_HANDOFF.md)：**当前事实来源**（版本、阶段、风险、最近改动）。
> - [`docs/README.md`](../README.md)：文档树入口与活跃文档索引。
> - [`getting-started/AI_DEPLOYMENT_AND_HANDOFF.md`](AI_DEPLOYMENT_AND_HANDOFF.md)：干净克隆、部署、启动器。
> - [`F9_AGENT_ORCHESTRATION/15_MODULE_BOUNDARIES_AND_PARALLEL_DEVELOPMENT.md`](../F9_AGENT_ORCHESTRATION/15_MODULE_BOUNDARIES_AND_PARALLEL_DEVELOPMENT.md)：多 Agent 并行时的独占范围与合并顺序。

## 当前复核覆盖（2026-10-13）

- 本文中的路由、代码规模和 2026-09-23 门禁表是历史接手快照；当前事实以 [`docs/AI_HANDOFF.md`](../AI_HANDOFF.md) 的第十二阶段及 2026-10-13 文档复核为准。
- 当前前端已对齐并展示后端已提供的 S0–S5 package 边界：S0 dense attribution、S1 四类 runtime 工件、S2 execution/kernel、S3 memory、S4 device、S5 collective。页面只展示 Bridge/CLI 返回的 boundary、provenance、fidelity、Fabric 和 artifact 状态，不推断未提供的指标。
- 当前未完成的项目不等同于前端契约错位：全仓格式红、Bridge discovery 导入错误、后端 CTest 回归和全量 E2E snapshot drift 分别按门禁责任边界记录；S2–S5 完整深链/刷新/原始证据入口若未重新复跑，必须标为 `not-run`。
- 轻量/专业配置页的“可编辑目录”与后端实际执行能力分开：前端可以为结构化输入提供安全的草案、集合规模和标量叶字段，但不得暗示后端尚未接入的 Profile、真实 GPU 或 Run Intake v2 已可执行。

## 0. 30 秒上手（本机实测）

- **本机没有 pnpm**（`pnpm ABSENT`）。文档与 `package.json` 里的 `pnpm xxx` 要看懂，但**执行时用 `node` 直调**
  （§6 给了逐条等价命令）。不要为了跑门禁去装 pnpm。
- **前端不依赖后端即可开发**：`node_modules/` 已就绪，直接起 Vite 或跑 fixture 即可；只有需要真数据时才碰 5173。
- **改动前后至少跑这四条**（只查你动过的文件，见 §6.2）：`vitest` → `vue-tsc` → `eslint` → `prettier --check`。
- **两个"看着像坏了、其实不是"的坑**先记住：PATH 顺序（§8.1）、`prettier` 全仓既有红（§8.2）。

## 1. 技术栈与入口

| 项          | 事实                                                                           |
| ----------- | ------------------------------------------------------------------------------ |
| 框架        | Vue 3 + `<script setup>` + TypeScript；Vite 构建                               |
| 路由        | `src/app/router.ts`（Vue Router；`src/app/providers.ts` 是应用级 provider）    |
| 全局壳      | `src/App.vue`（含右侧助手侧栏的全局挂载与页面上下文发布）                      |
| 应用内 i18n | `src/i18n/`（`index.ts` + `english-catalog.ts` + `workstreams/`）              |
| 主题        | `src/theme/`、`src/styles/`、`src/components/ThemeSwitcher.vue`                |
| 源码规模    | `src/` 共 **309 个** `.ts/.vue/.js` 文件、约 **111,354** 行（2026-09-23 实测） |

## 2. 代码地图（`src/`）

| 目录                                    | 职责                                                                                                                              | 谁能被谁引用                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `views/`                                | 页面编排（19 个 view）。**只编排**                                                                                                | 可 import `features` 的**公共 `index.ts`**，不直连 `bridgeApi`      |
| `features/`                             | 18 个业务模块，**每个都有公共 `index.ts`**（已实测 18/18）                                                                        | feature 之间只经对方 `index.ts` 协作                                |
| `components/`                           | 跨页面通用组件                                                                                                                    | `ui/` 子目录**不得**访问 store / feature / Bridge API / 报告 schema |
| `store/`                                | `dashboard*.ts` = **兼容 controller**                                                                                             | `src/store/dashboard.ts` 是兼容层，**不要把状态重新集中进去**       |
| `stores/`                               | Pinia stores（见 §4）                                                                                                             | workspace / session / history / bridge / lightweight / evidence-*   |
| `lib/`                                  | `api.ts`（Bridge 客户端）、`query-client.ts`（TanStack Query）、`format.js`、`reports.ts`                                         | —                                                                   |
| `contracts/`                            | `bridge-api.ts`、`report-model.ts`、`lossless-json.ts`、`generated/`（生成物）、`schemas/`                                        | `lossless-json.ts` 负责 64 位 ps/bytes 的无损 JSON 路径             |
| `entities/`                             | 领域模型与本地 typed 契约（`agent-context`、`agent-command`、`agent-orchestration`、`dashboard`、`evidence-agent`、`navigation`） | —                                                                   |
| `adapters/`、`data/`、`app/`、`assets/` | 适配层、静态数据、应用装配、资源                                                                                                  | —                                                                   |

### 2.1 feature 模块清单与规模（2026-09-23 实测，按行数降序）

| feature                     | 文件/行数  | 一句话职责                                                            |
| --------------------------- | ---------- | --------------------------------------------------------------------- |
| `run-experiment`            | 28 / 7,879 | 实验设置页；参数面、结构化输入、拓扑编辑器                            |
| `execution-inspector`       | 15 / 2,771 | 执行检视                                                              |
| `report-coverage`           | 15 / 2,617 | 报告覆盖度                                                            |
| `lightweight-workbench`     | 22 / 2,403 | 轻量工作台（Learn/Tasks/Prepare/Run/Results）                         |
| `evidence-agent`            | 15 / 2,175 | Evidence Agent 前端                                                   |
| `agent-copilot-shell`       | 7 / 2,027  | 右侧助手栏壳（Entry 懒加载 + Shell 四态 + Composer + TypedBlockList） |
| `agent-intent-compiler`     | 10 / 1,907 | 确定性意图编译、别名、单位归一、澄清                                  |
| `run-bound-evidence`        | 14 / 1,816 | run 维度证据                                                          |
| `guided-help`               | 24 / 1,630 | 页面引导（**归属这里**，不要写回 navigation model）                   |
| `structured-report`         | 6 / 1,048  | 结构化报告导出                                                        |
| `inspect-artifact`          | 7 / 955    | artifact 查看                                                         |
| `f7-analysis`               | 3 / 679    | F7 fabric 分析                                                        |
| `experiment-draft`          | 3 / 477    | 实验草案                                                              |
| `agent-copilot-integration` | 4 / 368    | 能力投影、block 组装、stale 标记                                      |
| `bridge-status`             | 3 / 136    | Bridge 状态                                                           |
| `run-evidence`              | 2 / 115    | 证据入口                                                              |
| `week7-evidence`            | 2 / 73     | Week 7 证据                                                           |
| `run-history`               | 2 / 29     | 历史入口                                                              |

## 3. 页面 ↔ 路由 ↔ view

| 路由                       | view                                                  | 备注                                      |
| -------------------------- | ----------------------------------------------------- | ----------------------------------------- |
| `/`                        | （重定向）                                            | —                                         |
| `/overview`                | `OverviewView.vue`                                    | 兜底路由也指向它                          |
| `/execution`               | `ExecutionView.vue`                                   | 旧 `evidence_*` 深链转向原始证据          |
| `/raw-evidence`            | `RawEvidenceView.vue`                                 | 独立完整 JSON 与 Pointer 定位             |
| `/metrics`                 | `MetricsView.vue`                                     | —                                         |
| `/fabric`                  | `FabricView.vue`                                      | —                                         |
| `/attribution`             | `AttributionView.vue`                                 | —                                         |
| `/validation`              | `ValidationView.vue`                                  | —                                         |
| `/evidence-agent`          | `EvidenceAgentView.vue`                               | 旧深链兼容，不在主导航                    |
| `/evidence-lab`            | `Week7EvidenceView.vue`                               | —                                         |
| `/design-space`            | `DesignSpaceView.vue`                                 | —                                         |
| `/history`                 | `HistoryView.vue`                                     | —                                         |
| `/experiment`              | `ExperimentView.vue`                                  | **实验设置页**；有页面级 agent 上下文发布 |
| `/lightweight`             | `LightweightWorkbenchView.vue`                        | 轻量工作台                                |
| `/lightweight/learn`       | `LightweightLearnView.vue`                            | —                                         |
| `/lightweight/tasks`       | `LightweightTasksView.vue`                            | —                                         |
| `/lightweight/prepare`     | `LightweightPrepareView.vue`                          | **也有**页面级 agent 上下文发布           |
| `/lightweight/results`     | `LightweightResultsView.vue`                          | —                                         |
| `/lightweight/runs/:runId` | `LightweightRunView.vue`                              | —                                         |
| `/lightweight/status`      | `LightweightRunView.vue`                              | —                                         |
| `/lightweight-workbench`   | （重定向 → `lightweight`）                            | 旧链兼容                                  |
| `/:pathMatch(.*)*`         | （重定向 → `overview`）                               | 兜底                                      |
| —                          | `WorkbenchEntryView.vue`、`UnsupportedSchemaView.vue` | 非路由或特殊态                            |

> ⚠️ **改实验设置页或轻量准备页时，注意它们各自发布「页面上下文」给右侧助手栏**。
> 通用投影与页面发布**共用 provider id `app-shell`**，路由每次变化都会发一次**无参数目录**的通用投影 ⇒
> 两个 publisher **必须每次都发布**（revision 由 keeper 钉住），否则面板会退化成「只解释」。
> 细节见 [`16_RIGHT_SIDE_AGENT_COPILOT_PANEL.md`](../F9_AGENT_ORCHESTRATION/16_RIGHT_SIDE_AGENT_COPILOT_PANEL.md) 末尾三条修订。

## 4. 状态归属（放错地方就是架构问题）

| 状态类型                                         | 归属                                       | 具体文件                                                                                               |
| ------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| server state（远端数据）                         | **TanStack Query**                         | `src/lib/query-client.ts`                                                                              |
| workspace / session / history / bridge / 轻量 UI | **Pinia**                                  | `src/stores/{workspace,session,history,bridge,lightweight,evidence-agent,evidence-selection,pinia}.ts` |
| 兼容 controller                                  | `src/store/`（**只兼容，不新增集中状态**） | `dashboard.ts` / `dashboard-state.ts` / `dashboard-runs.ts` / `dashboard-persistence.ts`               |

- Query key **必须**保留 run ID、backend identity、schema-set revision 和 artifact SHA-256。
- Week 7 的 backend-global query **必须**保留 backend identity 与 schema-set revision；三个固定 CLI 操作共享 Bridge 单槽，前端按 `evidence map → calibration → orchestration` 顺序请求。
- **进入 backend-global 页面不得清除当前 run**；run-bound 与 backend-global state 分开维护。

## 5. 契约与生成物（改之前先读这段）

- **契约 JSON 是整批发布**：`SCHEMA_SET_REVISION` 由 `bridge/server.py` 对 `bridge/contracts/**/*.json`
  （**含 `proposals/`**）整体取哈希 ⇒ 改**任何一个** `.json` 都会级联 revision、前端 fixture、文档。
  只有「契约发布批次」可以触碰，且由**单一集成 owner** 实施。
- 生成物（**绝不手改**，下次生成会覆盖且 `--check` 会红）：

  | 生成物                                                            | 生成器                                |
  | ----------------------------------------------------------------- | ------------------------------------- |
  | `src/contracts/generated/bridge-client.ts`                        | `scripts/generate-bridge-client.mjs`  |
  | `src/contracts/generated/bridge-contracts.ts`                     | `scripts/generate-contract-types.mjs` |
  | `src/contracts/generated/experiment-validators.js`                | 同上（Ajv standalone）                |
  | `src/contracts/generated/create-run-schema.ts`                    | 同上（内联 `minItems`/`maxItems`）    |
  | `src/contracts/generated/*-validators.js`、`report-identities.ts` | 同上                                  |

- 改完契约后：`node scripts/generate-contract-types.mjs && node scripts/generate-bridge-client.mjs`，
  再 `--check` 两遍确认 0（**`--check` 静默 exit 0 = 通过**）。
- **前端可用能力 = Bridge descriptor 与生成类型的交集**。descriptor 与文档冲突时，运行时能力 fail closed 并登记 drift。

## 6. 可跑命令（本机无 pnpm 的等价写法）

所有命令在仓库根执行，并**先修正 PATH**（§8.1）：

```bash
export PATH="/c/Windows/System32:/usr/bin:/bin:$PATH"
```

### 6.1 全门禁等价命令

| `package.json` 脚本    | 本机等价命令                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm test`            | `node node_modules/vitest/vitest.mjs run`                                                             |
| `pnpm typecheck`       | `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit`                                                   |
| `pnpm lint`            | `node node_modules/eslint/bin/eslint.js .`                                                            |
| `pnpm format:check`    | `node node_modules/prettier/bin/prettier.cjs --check .`                                               |
| `pnpm build`           | `node node_modules/vite/bin/vite.js build`                                                            |
| `pnpm contracts:check` | `node scripts/generate-contract-types.mjs --check && node scripts/generate-bridge-client.mjs --check` |
| `pnpm docs:check`      | `node scripts/check-doc-links.mjs`                                                                    |
| `pnpm deps:check`      | `node scripts/check-frontend-dependencies.mjs`                                                        |
| `pnpm dev`             | `node node_modules/vite/bin/vite.js --host 127.0.0.1`                                                 |

Bridge 侧（本机可跑，纯 Python）：

```bash
cd bridge && python -m unittest test_server test_assistant_model test_parameter_surface
```

### 6.2 只跑你动过的那部分（推荐，快得多）

```bash
node node_modules/vitest/vitest.mjs run tests/unit/<你的测试>.test.ts     # 单个测试文件
node node_modules/vitest/vitest.mjs run -t "<用例名关键字>"               # 按名字筛
node node_modules/eslint/bin/eslint.js <你改的文件…>
node node_modules/prettier/bin/prettier.cjs --check <你改的文件…>
git diff --check -- <你改的文件…>
```

> **`prettier --check` 只查自己改动的文件**：全仓本来就有约 20 个文件报红（非你造成，见 §8.2）。
> 判「是不是我弄脏的」用 `git show HEAD:<file> | node node_modules/prettier/bin/prettier.cjs --stdin-filepath <file>`
> 对比，比猜可靠。`--write` 之后**务必复核一次**（批量写有竞态）。

### 6.3 e2e（Playwright）

**不要**用 `pnpm test:e2e`（`webServer.command` 是 `pnpm dev`，本机没有 pnpm）。要点：

1. 自己把 Vite fixture 起在 **4173**（`vite.config.js` 固定端口 + strictPort），Playwright 会因
   `reuseExistingServer: true` 复用它。
2. 给 playwright 进程设 `NO_PROXY=127.0.0.1,localhost`（本机 shell 的 `HTTP_PROXY` 会拦）。
3. **浏览器必须用 `channel: "msedge"`**（本机没有独立浏览器下载）；`playwright.config.js` 已如此配置。
4. 跑前清 `test-results/`、查残留 runner；跑后停掉自己起的 4173；**用户自己的 5173 与 Edge 一律不动**。
5. 改动只落在少数页面时，**点 spec 跑子集更容易拿到单次干净 tally**，不必每次全量。

> 完整编排（落盘、超时、判读、卡死清理、失败定性）见项目技能 **`tilesim-e2e-run`**，
> 以及 `<根>/.workbuddy/memory/MEMORY.md` 的 e2e 小节。**权威条数用
> `node node_modules/@playwright/test/cli.js test --list` 现取**，不要凭记忆报总数。

## 7. 当前门禁基线（2026-09-23 实测）

| 门禁                         | 实测结果                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| 前端 Vitest                  | **93 files / 1056 passed / 8 skipped**，exit 0                                               |
| `vue-tsc --noEmit`           | exit 0                                                                                       |
| eslint（改动文件）           | exit 0                                                                                       |
| prettier（改动文件）         | exit 0                                                                                       |
| Bridge `unittest`            | `test_server` 170 + `test_assistant_model` 62 + `test_parameter_surface` 25 = **257 passed** |
| `bridge/test_f8_schemas.mjs` | 1 passed（描述符/契约逐字焊死）                                                              |
| 两个 `generate-* --check`    | exit 0（静默 = 通过）                                                                        |
| `docs:check`                 | exit 0，**61 篇**活跃 Markdown                                                               |
| `deps:check`                 | exit 0，**309** 源文件                                                                       |
| Playwright e2e               | **本轮未复跑**（最近记录见 `AGENTS.md` §2 与技能 `tilesim-e2e-run`）                         |
| 后端 CTest                   | `not-run`（本机无 C++ 工具链，`wsl.exe` 对 AI 硬禁）                                         |

`8 skipped` 里含需要**已部署 Bridge** 的 deployed/live 用例——**skip 不得计作 passed**。

### 最近阶段记录（2026-10-13 文档复核）

- 最近工作树记录的 Web Vitest 为 `1123 passed / 8 skipped`；`typecheck`、`lint`（0 error、2 既有 warning）、`build`、`contracts:check`、`docs:check`、`deps:check` 和 `git diff --check` 通过。该数字来自第十二阶段之后的配置助手/结构化输入批次，不是本次文档复核重新执行的结果。
- 最近记录的定向 CTest 为 `13/13 passed`，Bridge 定向套件为 `275 passed`；Bridge 全量 discovery 仍有 1 项既有 registry 导入错误，全仓 `format:check` 仍有 24 个既有文件失败。
- 最近全量 E2E 记录为 `69 passed / 6 skipped / 4 failed / 1 not-run`；失败项是未更新的既有 desktop screenshot drift，`artifact-worker` 后续单独复跑通过。未将该结果写成全量门禁绿灯。

## 8. 本机特有的坑（会让人误判成代码问题）

### 8.1 PATH 顺序（最易误判）

默认 PATH 把 `/bin:/usr/bin` 排在 `/c/Windows/system32` **之前**，于是 `tar` 解析到 GNU tar 而非 Windows
自带 bsdtar，导致 `tests/unit/phase0d-evidence-reproducibility-oracle.test.mjs` **稳定挂 1 条**。
**修法：`PATH="/c/Windows/System32:/usr/bin:/bin:$PATH"`**。
但 `git`/`python`/`ls` 又需要 `/usr/bin:/bin` 在前——两条规则方向相反，照抄上面那行即可。

### 8.2 prettier 全仓既有红

全仓 `prettier --check .` 本就有约 24 个文件报红（phase2 schema、`bridge-api.schema.json`、
`docs/features/lightweight-workbench/*.md`、`generate-bridge-client.mjs` 等），**不是你造成的**。
自己新增的长行超 `printWidth: 120` 时用 `--write <单个文件>`，再 `git diff` 复核只有预期那几行变化。

### 8.3 其他硬约束与陷阱

| 事项                     | 事实                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `wsl.exe`                | 对 AI **硬禁**；后端 CTest 一律报 `not-run`                                                                               |
| `127.0.0.1:5173`         | 用户可能正在用。**未获明确部署授权不得停止/重启/替换**                                                                    |
| 部署与"用户看到新版"     | 部署 exit 0 ≠ 用户看到新版；启动器无条件占用 5173。以 `GET /api/health` 的 manifest 与首页指纹复核                        |
| `D:\tileSim`（C++ 后端） | **只读**；缺口如实上报，**不得编造** CLI stdout 或用规格值/常识补造数据                                                   |
| git 操作                 | **不 reset / clean / stash / 覆盖式 checkout**；默认**不 commit / 不 push**，改动留工作区                                 |
| 同一文件多个 `Edit`      | **同一消息里对同一文件发多个 `Edit` 会互相覆盖、静默丢改动**（都报 success）⇒ **一文件一次一个 `Edit`**，改完 `grep` 复核 |
| 改了 `.vue`/`.json` 之后 | 旧行号全部失效，引用行号前先重新确认                                                                                      |
| 部署期间                 | **禁止在仓库内写任何文件**（traceability 排除表不含 `.workbuddy/`、`output/`）                                            |
| manifest                 | **不得手工编辑**                                                                                                          |

## 9. 改动前的文档路由（按任务查，别通读）

| 你要做的事                                           | 先读                                                                                                                                                                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 任何任务（先读仓库规则与门禁）                       | [`AGENTS.md`](../../AGENTS.md) → [`docs/AI_HANDOFF.md`](../AI_HANDOFF.md)                                                                                                                                                           |
| 放开/新增实验参数（枚举值或字段）                    | 技能 `tilesim-contract-parameter-expansion`；[`01_CURRENT_BASELINE_AND_GAPS.md`](../F9_AGENT_ORCHESTRATION/01_CURRENT_BASELINE_AND_GAPS.md)                                                                                         |
| 实验设置页的输入面 / 结构化输入 / 拓扑编辑器         | [`01_CURRENT_BASELINE_AND_GAPS.md`](../F9_AGENT_ORCHESTRATION/01_CURRENT_BASELINE_AND_GAPS.md)、`src/features/run-experiment/`                                                                                                      |
| 右侧助手栏、跨页面助手、上下文与 typed blocks        | [`16_RIGHT_SIDE_AGENT_COPILOT_PANEL.md`](../F9_AGENT_ORCHESTRATION/16_RIGHT_SIDE_AGENT_COPILOT_PANEL.md)                                                                                                                            |
| 拆多 Agent 并行开发 / 模块边界与合并顺序             | [`15_MODULE_BOUNDARIES_AND_PARALLEL_DEVELOPMENT.md`](../F9_AGENT_ORCHESTRATION/15_MODULE_BOUNDARIES_AND_PARALLEL_DEVELOPMENT.md)、[`17_..._EXECUTION_PLAYBOOK.md`](../F9_AGENT_ORCHESTRATION/17_DEVELOPER_AI_EXECUTION_PLAYBOOK.md) |
| 后端仿真流程在前端的展示覆盖度（谁显示了、谁没显示） | [`architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md`](../architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md)                                                                                                                     |
| 轻量工作台（Learn/Tasks/Prepare/Run/Results）        | [`features/lightweight-workbench/`](../features/lightweight-workbench/README.md)                                                                                                                                                    |
| 部署、启动器、干净克隆                               | [`getting-started/AI_DEPLOYMENT_AND_HANDOFF.md`](AI_DEPLOYMENT_AND_HANDOFF.md)；技能 `tilesim-local-deploy`                                                                                                                         |
| 跑/判 e2e                                            | 技能 `tilesim-e2e-run`                                                                                                                                                                                                              |
| 验收别的 Agent 交付的工作包                          | 技能 `tilesim-wp-verify`                                                                                                                                                                                                            |
| 把兄弟分支的功能搬到当前分支                         | 技能 `tilesim-branch-feature-port`                                                                                                                                                                                                  |

历史证据（**不是当前事实来源**）在 [`docs/archive/`](../archive/README.md)，只在追溯时读。

## 10. 证据边界：前端不许做的事

以下都是**红线**，违反即破坏契约、安全或证据边界（完整表述见 [`AGENTS.md`](../../AGENTS.md) §3）：

- 前端只展示、校验、索引、排序、分组和做**可追溯的显示级换算**；**不得重算或补造模拟指标**。
- 必须区分 `0`、missing、expected absence、not covered、unsupported schema、not applicable。
- `real_trace`、`synthetic_trace`、`compatibility_harness_trace` **不得相互升级**。
- requested fidelity 与 resolved fidelity **分开显示**；**不得**把 Analytical/DES 描述成 Cycle。
- synthetic consistency **不得**显示为 held-out validation。
- 64 位 ps/bytes 字段**必须**走无损 JSON 路径（`src/contracts/lossless-json.ts`）。
- 不读取、记录或输出任何 Provider credential；不通过开发任务执行 live Provider acceptance。

## 11. 交付纪律

- **不 commit、不 push**（除非明确授权）；改动留工作区。**不 reset / clean / stash**。
- 报告里每条结论带 **`文件:行号`**，**贴真实命令输出**，不许写「应该能过」。
- 结论按 **【文档明写】/【代码可证】/【合理推断】/【项目方口述】** 标注来源强度。
- 越出任务清单的改动**单开一节披露**；「看着像但其实不该动」的数字要说明为什么没动。
- 文档：**当前状态只写入** [`AI_HANDOFF.md`](../AI_HANDOFF.md) 与对应模块 current baseline；
  **旧数字不许原地改写**，历史报告保留原文并移入 `docs/archive/`，新旧并存。

## 12. 本文档的维护

- 新增前端模块、改变代码边界或状态归属时**必须更新本文**（§2、§4）。
- 门禁数字变化只在**有新实测**时才改 §7，并更新「事实日期」；**不要**把本文当成历史账本。
- 本文按 `docs/README.md` 的规则登记在**活跃文档索引**中，且必须从该页可达。
