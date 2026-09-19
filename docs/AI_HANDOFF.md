# TileSim Web AI Handoff

**事实日期**：2026-09-17（下文历史记录）／2026-09-19（本机实测基线，见「2026-09-19 仓库与基线更正」）

**产品范围**：电脑网页端、local Bridge、版本化契约和 Windows/WSL 本地部署

**当前状态**：Phase 1 全局 Agent 侧栏与八字段本地草案已发布；Phase 2A/2B 契约已正式发布并提交（`4d7f9fa`）；后端 Phase 2C
Run Intake Lowering 已落地，Bridge 侧 Run Intake v2 **只读预览**端点（WP-2C-01a/01b，工作树未提交）已注册但仍未与 lowering
接线；五类 Profile 真实记录仍为 `0/unavailable`，因此 Phase 2 的执行与数据侧仍被阻塞；未部署 5173

## 2026-09-19 仓库与基线更正（**优先于下文所有 revision 与测试数字**）

本节由 2026-09-19 的只读盘点得出，未改动任何代码、契约或运行态。**下文所有 `HEAD`/revision 表述与门禁数字均为历史记录，读取时以本节为准。**

### git 真实状态（2026-09-18「本地历史不可恢复」的表述需收窄）

- 实际 `HEAD` = `11cef6b`（`chore(recovery): restore phase 2 docs, registry test and launcher-safe deployment scripts`），
  其父为 `c303ac2`（`feat(workbench): restore lightweight workbench shell, topology editor and 2026-09-17 work`）。
  本地仅有这两个提交，`c303ac2` 是根提交。
- **已发布的远端历史在本机对象库里是完好的**：`refs/remotes/origin/main` = `4d7f9fa` 可解析（`git log origin/main` 正常，
  其树含 636 个受跟踪文件）。即 2026-09-18 那次对象库清空**没有**毁掉已发布历史。
- 真正丢失且**不可恢复**的是当时尚未推送的 3 个本地提交：`446f21d`、`290d1c8`、`9b2d39b`。
  已实测救援目录 `C:\Users\mapanwang\_tilesim_rescue`：`tilesim-web-backup.git` 只含 `refs/heads/main = 11cef6b`
  （恢复之后才建立的镜像），`dotgit_backup/.git` 不含任何 ref —— **两处备份都没有这三个提交**。
- 本地 `main` 与 `origin/main` **没有共同祖先**（`git merge-base` 为空）。文件层面本地是严格超集：
  `git diff --diff-filter=D origin/main main` 命中 **0** 个文件，本地相对远端新增 100 个文件、182 个文件改动；
  `git ls-tree -r` 计数为本地 736 / 远端 636。**后续任何 push 决策都必须先处理这两条无关联历史。**
- `git worktree list` 现只剩 `D:/tileSim-web`；工作树 clean；其余 `origin/codex/*` 分支引用仍在。

### 文档卫生

- 本文件此前残留两个合并冲突标记（`>>>>>>> Stashed changes` 与 `<<<<<<< Updated upstream`），已随本节同一批次清除；
  它们也是本文件唯一的 prettier 不合规来源。紧随本节的「双工作台方案状态」与「Phase 2D handoff」两节来自当时的
  stash 侧内容，属**历史阶段记录**。
- 以下文件仍引用本机已不可解析的提交号 `446f21d` / `4d7f9fa` / `290d1c8` / `9b2d39b`，应作为历史证据阅读，
  **不要**用它们做 `git` 定位：本文件、`AGENTS.md`、`docs/getting-started/AI_DEPLOYMENT_AND_HANDOFF.md`、
  `docs/architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md`、`docs/F9_AGENT_ORCHESTRATION/` 下的 `01`、`12`、
  `14`、`24` 与 `README.md`，以及 `docs/archive/agent-orchestration/phase-records/` 下的 `21`、`22`。

### 2026-09-19 实测门禁（本机，`HEAD` = `11cef6b`，工作树 clean）

| 门禁                                              | 实测                                                       | 本文下文历史值    |
| ------------------------------------------------- | ---------------------------------------------------------- | ----------------- |
| Web Vitest（`vitest run`）                        | **721 passed / 8 skipped，79 files**                       | 596 / 8，70 files |
| Bridge `python -m unittest test_server.py`        | **Ran 143 tests / OK，exit 0**                             | 143（一致）       |
| `generate-contract-types.mjs --check`             | exit 0                                                     | —                 |
| `generate-bridge-client.mjs --check`              | exit 0（既有 `unknown format "date-time"` 为提示，非错误） | —                 |
| `check-doc-links.mjs`（`docs:check`）             | exit 0，**62 篇活跃 Markdown**                             | 43 篇             |
| `check-frontend-dependencies.mjs`（`deps:check`） | exit 0，**290 源文件**                                     | 255               |
| `vue-tsc --noEmit`                                | exit 0                                                     | —                 |
| Playwright 全量 e2e                               | **not-run**（本轮未执行；上批 49/57 中 1 条失败仍未定性）  | —                 |

- Vitest 必须用**原始 PATH** 运行：前插 `/usr/bin:/bin` 会让 GNU tar 遮蔽 bsdtar，使
  `tests/oracles/phase0d-evidence-reproducibility*` 出现唯一红灯（本轮原始 PATH 下为 5/5 绿）。
- 本机无 C++ 工具链且 `wsl.exe` 被安全策略阻断，后端 CTest 与后端构建门禁一律 `not-run`。

### 运行态

- `127.0.0.1:5173` **未监听**（2026-09-19 实测 `listening=False`）。当前没有工作台服务在运行；
  部署与启停仍只能由人工执行，未获授权不得操作。

## 双工作台方案状态

`docs/features/lightweight-workbench/LIGHTWEIGHT_WORKBENCH_PLAN.md` 是当前唯一轻量工作台产品基线。轻量版必须支持新建实验、必要配置、校验、正式 run、运行状态、结果摘要和真实图表；相比专业版只减少复杂信息，不减少工作台闭环。L6R fixture 只证明 UI/路由/状态机/契约映射，不构成 Provider、live、calibration、held-out 证据。现有 Agent、Bridge、Provider、schema、权限和失败语义边界保持不变；专业版现有路由、表单、Agent、Evidence 和 run 状态仍是回归基线。

L6R 后续 UI remediation 已完成 P0/P1/P2/P3：`/lightweight` 负责开始/继续，`/lightweight/prepare` 直接承接新建实验，独立“任务”和“学习”入口已从主导航移除；旧 `/lightweight/tasks` 仅兼容重定向到配置页，旧 `/lightweight/learn` 仅兼容重定向到轻量首页，并且只携带合法工作台 query。教程、字段解释和证据边界收敛到右上角“页面帮助”；轻量版和专业版复用帮助基础设施，但 topic、搜索分组和路由定位按 workspace scope 完全分域，任何一侧都不得显示或跳转到另一侧的帮助主题。运行页突出后端状态、下一步动作和恢复元信息，结果页按结论→证据→细节展示并保留 resolved fidelity、provenance、artifact/schema 身份。首页已移除教程式副文案，主流程只保留状态、证据和可执行动作。fixture 桌面 E2E 已恢复为可执行用例，验证提交、状态推进、刷新恢复、artifact 校验、合法 0 与 missing、失败边界和专业版往返；当前全量 frontend（639 passed/8 skipped）、Bridge（91 tests）和完整桌面 fixture E2E（63 passed/6 skipped）门禁通过，skipped 项均为 live deployment/Provider 能力相关，fixture 仍不构成 live/calibration/held-out 证据。

轻量 run/results 深链统一等待共享 Bridge manifest/schema bootstrap；bootstrap 失败时 fail closed，不在缺少 manifest/schema 上下文时走 legacy evidence 读取路径。共享 readiness promise 会去重 App shell 与页面自身的并发 bootstrap 请求。

专业版现有的同一个右侧 `TileSim 助手` 现复用于轻量工作台，不新增第二套 Agent UI、会话或请求链。轻量配置页通过 `run-experiment` 公共 adapter 发布同一组正式八字段和当前页面上下文，轻量运行/结果页只从合法 run 路由或 query 建立 run context；模式切换时保留同一助手状态，但旧页面 context 必须失效并替换。该助手仍是单轮、确定性的本地草案 Copilot：可以解释和生成草案，但不写入表单、不自行创建 run、不调用 Provider，也不把 synthetic/fixture 证据升级为 live、calibration 或 held-out。

本轮在专业版和轻量版的 JSON 输入模式中加入 canonical topology request 可视化编辑器：设备节点可拖动调整前端布局，连接模式支持点选或拖拽创建显式 `links`，边属性可编辑/删除，domain 成员关系以只读虚线展示；`links` 按当前后端 `LinkSpec` 语义表示无向物理连接，前端不绘制方向箭头，也不允许同一 domain 的反向重复边；布局坐标不会写入提交 JSON，未实现设备/domain CRUD，也未修改 Bridge、schema、Profile registry 或 API surface。拓扑专项单元/组件测试为 29/29 passed，新增 desktop pointer E2E 通过（含拖动、建边、反向重复保护、属性编辑、删除和无 `x/y` 断言）。

## Phase 2D handoff

- 新增 `bridge/contracts/agent_orchestration_phase2/registry.py` 与 registry tests；它独立于 v1 Capability Catalog，发布五类 source-backed Profile v2 record、snapshot 和完整 binding。
- 所有记录均 `runtime_status=unavailable`、`agent_exposed=false`、calculator/ranking 不可用；校准和 held-out 缺失，Phase 2C lowering 继续 fail closed。
- registry 校验 source/license/regime、字段 provenance、生命周期、visibility/sensitivity、canonical digest、revision drift 和 stale snapshot；不得把 synthetic/compatibility 记录升级为真实校准证据。
- Phase 2D/2E handoff 本身不新增 calculator、Agent orchestration receipt UI、RAG、多轮、审批、Workflow、SSE/cancellation；不操作 5173、不读取 credential、不调用 Provider、不创建正式 run。当前拓扑图编辑器属于 S6 JSON 输入工作台，不改变该 Phase 2 边界。Phase 2E 不启动。

## 1. 必读

1. `AGENTS.md`
2. `docs/README.md`
3. 本文件
4. `docs/getting-started/AI_DEPLOYMENT_AND_HANDOFF.md`
5. 当前模块 contract、公共入口和 tests

`docs/archive/` 只用于追溯，不是当前事实来源。Agent 编排模块的阶段记录（Phase 1 验收、Phase 2 DoR 审计、Phase 2A 候选、
Phase 2B 发布）已归档到 `docs/archive/agent-orchestration/phase-records/`。

## 2. 当前代码事实

- Vue 前端、Python Bridge、OpenAPI/JSON Schema、generated contracts、fixture/E2E 和 immutable release 工具均在本仓库。
- 完整仿真运行仍依赖独立 TileSim 后端仓库；bootstrap 可自动克隆。Evidence Agent 外部模型为可选配置。
- Web 集成交付、部署可移植性修复和对应回归已进入公开 `origin/main`；本仓库 `HEAD == origin/main ==`
  `4d7f9fa3c330b7d6f287d12da853ec2bf481b0cb`。
- 后端本地 `main` 为 `ba11e6fdb69af046dc7597e5ef5732cce029cfbe`（含 Phase 2C 与 dense timing）；后端公开
  `origin/main` 仍为 `7b2b1cff52fdab21575609be170c3856f120120b`，即后端本地领先 2 个提交、尚未 push。
  Capability Catalog 引用的不可变证据 revision `7e5a8c6a5cf738bd24608b440a61b62dee8d1881` 可由该公开仓库解析，
  并保留在公开 `codex/phase0d-backend-evidence-clean` 分支。
- 公开发布状态为 `published_clean_clone_verified`。2026-09-11 从 GitHub 全新克隆 Web 与后端后，完整 bootstrap 在
  `-NoRestart` 模式通过（该次为后端 63/63 CTest、前端 506 passed/8 skipped）。这是**带日期的历史证据**；完整部署仍必须
  保留后端 evidence revision gate。
- 2026-09-18 本轮实测门禁（含工作树未提交的 WP-2C-01a/01b、WP-2C-02 服务层、WP-2C-06、WP-2D-01 与 WP-2D-04）：
  Web Vitest **595 passed / 8 skipped**（70 files）、Bridge `unittest` **143 passed**、`vue-tsc` / `eslint src tests
scripts bridge` / `vite build` / `contracts:check` / `docs:check`（43 篇）/ `deps:check`（255 源文件）/
  `git diff --check` 全部 passed。**Playwright 全量首次取得干净 tally**：
  `node node_modules/@playwright/test/cli.js test --workers=1 --reporter=list` → **51 passed / 6 skipped / 0 failed，
  exit 0，7.1m，无 worker 强杀**；6 条 skipped 全部是 `live-week8.spec.js` 的 deployed-Bridge 用例（需部署环境）。
  `dashboard.spec.js:2079` 在定向 ×3 与全量 ×1 下**全部通过**。
  此前「全量 2079 变红 + worker 卡死」的红已定因为 `src/store/dashboard.ts:103-137` 的 busy 泄漏竞态，登记为
  **`DEF-BUSY-RACE-001`**，**已由 `WP-2D-04` A 部修复并关闭**（认领令牌：`state.busy` 全仓唯一写点收敛到
  `dashboard-state.ts:63`）。完整分析与验收判定见覆盖度文档 §6.1.2 / §6.4.1。`eslint .` 仓库级 10 条错误全部落在
  **未跟踪**的 `output/playwright/*.js`（用户草稿）。后端 CTest 与 fixture Playwright 全量本轮未复跑
  （本机无 C++ 工具链），必须标记为 `not-run`。本仓库 `HEAD` 仍为 `4d7f9fa`，以上改动尚未提交。
- **2026-09-18 `WP-2D-05` 后的复测（须与上一条一起读；门禁数字已更新）**：Web Vitest **596 passed / 8 skipped**
  （70 files，+1 = 本包新增用例），`vue-tsc` / `eslint src tests scripts bridge` / `prettier` / `vite build` /
  `contracts:check` / `docs:check`（43 篇）/ `deps:check`（255）/ `git diff --check` 全部 0，Bridge 143 不变。
  **e2e 再次取得干净 tally**：`--workers=1 --reporter=list` → **51 passed / 6 skipped / 0 failed，exit 0，6.4m，
  无 worker 强杀**，覆盖全部 57 条（含 `large-artifact-worker` 的 `artifact-worker.spec.js:4:1`，`ok 57`）。
  **worker 收尾卡死是间歇性既有环境缺陷、未根除**：同一会话另有 3 次运行在用例全部零失败后出现
  `worker-1 process did not exit within 300000ms after stop, force-killed it`，其中 1 次是把 `WP-2D-05` 的改动
  **逆操作回退**后跑的 A/B 对照（现象完全相同，回退已实测 `renderStatusCell = 0` / `lib/format = 0` / 旧表达式复原）
  → **与代码改动无关**。卡死落在 `desktop → large-artifact-worker` 项目切换处时，那 1 条会 `not-reached`，
  必须另起一次完整运行覆盖，**不得把 `not-reached` 当作通过**。
  **纪律**：全量 e2e 不得与其它重量级门禁并发跑——并发时曾出现 `dashboard.spec.js:2079` 的
  `toHaveURL(/\/metrics\?run=run-fixture-f1$/)` 偶发失败（收到 `/metrics`），空载定向 ×3 全部 `ok` / `EXIT=0`。
- **2026-09-18 发布批次（本文件的新口径）**：指挥方在同一会话内授权了**发布**与**契约变更窗口重开**两件事。
  工作树中已验收但未提交的 7 个工作包（`WP-2C-01a/01b`、`WP-2C-02` 服务层、`WP-2C-06`、`WP-2D-01`、`WP-2D-04`、
  `WP-2D-05`）连同文档与契约生成物**已在本地完成提交**，共 3 个提交：`290d1c8`（Phase 2C 契约与预览路由）、
  `9b2d39b`（工作台 C0 覆盖度 + 两处缺陷收口）、`446f21d`（文档与仓库卫生）。**但推送未完成**：本机对
  `github.com` 的出口被网络策略阻断（系统代理 `127.0.0.1:56943` 对 `CONNECT` 返回 502；绕过代理直连为
  `Connection was reset`；沙箱内外结果相同，连只读的 `git ls-remote` 也失败）。因此 `origin/main` **仍停在
  `4d7f9fa`**，本地领先 **3 个提交未推送**；后端仓库（`D:\tileSim`）本地领先其 `origin/main` 的 **2 个提交**
  （`8839b969` Phase 2C lowering、`ba11e6fd` merge）同样**未推送**。恢复网络后须由人工在两个仓库各执行一次
  `git push origin main`。契约方面：本次提交的契约文件全部来自**已验收的 `WP-2C-01a/01b`**（2 个新 Schema 加
  `openapi.json` / `manifest.json` / `bridge-api.schema.json`），使 `SCHEMA_SET_REVISION` 由
  `sha256:518f4da9…e43ece`（86 json）变为 `sha256:d498092a…abffab`（88 json），两个值均已按
  `bridge/server.py:135-144` 的算法独立复算；**重开后的窗口尚未被任何工作包使用**（`WP-2D-02` 与 `WP-2C-02a`
  都还没动契约文件）。发布前门禁见下一条。
- **2026-09-18 发布前门禁实测**（本机，`HEAD` 为 `4d7f9fa` + 上述工作树改动）：Web Vitest **70 files /
  596 passed / 8 skipped**、Bridge `unittest` **143 passed / OK**、`py_compile` 通过、`vue-tsc --noEmit`、
  `eslint src tests scripts bridge`、`vite build`（2760 modules）、`contracts:check`、`docs:check`（43 篇）、
  `deps:check`（255 源文件）、`git diff --check` 全部 exit 0。**`prettier --check` 对全部待发布文件有 2 条既有
  不合规**：`bridge/contracts/agent_orchestration_phase2/manifest.json` 与
  `bridge/contracts/schemas/bridge-api.schema.json` —— 已核验其 `HEAD` blob 与工作树逐字节一致且 `HEAD` 版本同样
  不合规（`git hash-object` 与 `git rev-parse HEAD:<path>` 相等），即**属既有状态、非本批次引入**；按 AO-24
  「禁止顺手修 phase2 的 `*.json`」的既有口径**未修**。全量 e2e 结果见下一条。
- **2026-09-18 全量 e2e 实测（本批次唯一未通过的门禁项）**：`--workers=1 --reporter=list` 完整跑完 57 条，
  **49 passed / 1 failed / 6 skipped / 1 did not run，exit 1，6.8m**。6 条 skipped 仍是 `live-week8.spec.js` 的
  deployed-Bridge 用例。1 条 did-not-run 是 `large-artifact-worker` 的 `artifact-worker.spec.js:4:1`：该项目
  `dependencies: ["desktop"]`，而 `desktop` 项目出现失败，故整个依赖项目未运行（**不得当作通过**）。
  唯一失败是 `tests/e2e/dashboard.spec.js:457`「overview keeps a usable first-viewport comparison and keyboard
  route round trips」：`page.locator(".overview-domain-list tr").first().boundingBox()` 返回 `null`，随后
  `bounds.y` 抛 `TypeError`。该断言**紧跟在 `setViewportSize` 之后、没有任何自动重试断言前置**；同文件 `:415`
  的写法不同（先 `await expect(...).toHaveCount(6)` 再测量），而**同一次运行中 `:415` 通过**。
  已核实该用例**在本批次前后都位于 `dashboard.spec.js:457`，本批次对该文件只有 1 处 4 行改动（`:2744` 的 C0-7
  `expected_absence` 文案断言），与本用例无关**；失败时的页面快照也显示「通信域观测」表格及其 `scale-up` 行已渲染，
  说明选择器与数据侧本身正常。**此前 `WP-2D-05` 验收时同一代码曾取得干净 tally（51 passed / 6 skipped / 0 failed），
  本轮未能复现。** 失败后连续 3 次隔离复跑（含 `--repeat-each=3`）**均在零输出状态下被强杀**：Playwright 在非 TTY
  下 stdout 全缓冲、SIGTERM 时缓冲被丢弃，故隔离结果无从判定；同时 `test-results/` 已被后续运行清空，失败产物不可回收。
  **因此本批次 e2e 门禁的结论是：49/57 通过，1 条失败未定性（flake 与回归未区分），不得记为通过。**
  待处置：环境稳定后补一次干净的全量 `--workers=1` 运行；若仍复现，按「`:415` 同款前置自动重试断言」的写法
  单独判定是测试就绪性缺陷还是产品回归（**不得为让用例变绿而放宽、删除或跳过既有断言**）。
- **契约变更窗口已由指挥方于 2026-09-18 显式重开**：本条取代本文件 §2 上文以及 AO-23 §4、AO-24 §8 中
  「窗口已关闭、后续工作包不得再动 `bridge/contracts/**/*.json`」的表述（那两句是当时的裁决记录，不再具约束力）。
  重开后 current live `sha256:d498092a…abffab` **必然作废**。随窗口一并解锁：`WP-2D-02`（C1 采集四个运行期
  工件与 C2 报告 Schema 加固，本仓库）与 `WP-2C-02a`（后端 issue serializer 补全，仓库 `D:\tileSim`）；两者仓库与
  文件集合不相交，可并行派发；`WP-2C-02a` 是 `WP-2C-02b`（端点接线）与 `WP-2C-05`（三个 lowering 标志分开
  显示）的唯一前置。**`WP-2D-02` 的步骤 0 只读探针已完成**，结论见
  `docs/architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md` §6.2.1：是非题为**「不会」**（标准配置下
  `runtime_event_trace` 的 state 恒为 `ready`；39/39 条历史 run 的 `has_runtime_event_trace` 全为 `true`，
  `false` 计数为 0），**但**引入「range 起于 S0/S1 且轨迹不可用 ⇒ 整条 run `exit 1`」的新失败面，
  `WP-2D-02` **必须按方案 B**（接受新语义 + 写成 Bridge 可见事实 + 补锁死测试）显式处理，不得静默接受。
  窗口重开后的首张契约变更必须由单一集成 owner 连同全套级联（`src/contracts/generated/**`、Bridge client、
  各文档 revision 表述）一次性处理。
- **指挥方的数据侧决策（2026-09-18）**：**真实 Profile 数据目前不可得** —— 原话为「目前没有从真实的显卡中
  采集到的数据」。因此 `GAP-PROFILE-SUCCESSOR-001`（`blocked_data`）与 Phase 2 的数据侧/执行侧**继续被阻塞**，
  五类 records 维持 `0/unavailable`，执行侧 fail closed 仍是正确结果。**不得**用规格书参数、宣传峰值、
  LLM 常识或前端静态 JSON 替代真实采集数据；`WP-2C-03/04/05` 与 `WP-2D-03` 在此前提下只能做 fail-closed
  接收与呈现。
- Phase 0D 已发布 Capability Catalog/Profile Schema v1；八个 `agent_exposed` 字段有 execution closure，五类真实 Profile
  仍为 `0/unavailable`，没有 calibration 或 held-out validation。
- Phase 1 右侧 Agent 栏是单轮、确定性的本地草案 Copilot，不连接模型、不创建 run、不持久化对话。它只接受正式八字段，
  对模型、设备、卡数、TP/PP/EP、placement、物理 KV、集合通信算法和 SLO 失败关闭。
- Phase 2A 的隔离候选已由 Phase 2B 正式发布并提交。契约包位于 `bridge/contracts/agent_orchestration_phase2/`，含
  五类 Profile v2、Profile Binding v1、Run Intake v2、Validation Report v1、Calculator Receipt Envelope v1、七类 typed
  receipt identity 与幂等/留存 policy；`package_revision` 为
  `sha256:59373c713f9570db857fabed29ff078e9458f7eeb28f8d559936cc95a3ecc8b6`。
- 2B 的接线范围**只到契约层**：该包只被 `bridge/contracts/openapi.json`、`bridge/contracts/schemas/bridge-api.schema.json`
  与生成物料引用；当初没有任何 Bridge service 导入其 validator。包 manifest 自报 `runtime_status = contract_only`、
  `create_run_acceptance = not_accepted_by_current_api`，五类 `profile_records` 全部为空，包内也没有 `registry.py` 与
  测试源文件（仅有过期 `__pycache__` 残留）。**该形态已被 WP-2C-01a/01b 部分取代**，见下一条。
- WP-2C-01a/01b（工作树未提交，`D:\tileSim-web`）补上了 Phase 2C 的第一条 Bridge 路由，但只做**校验与判定**：
  新增 `bridge/contracts/agent_orchestration_phase2/registry.py`（复用 `validator.py` 的 `IDENTITIES` /
  `validate_contract`，判定码与 `proposals/agent_orchestration_phase2a/fixtures/compatibility-matrix.json` 的
  12 scenario / 6 expectation / 9 错误码一一对应）与 `bridge/services/run_intake.py`，经 `bridge/server.py` 的
  `POST /api/agent/run-intake-preview` 暴露。被拒判定是判定结果而非错误：**HTTP 200 + typed body**
  （`judgement.accepted = false`）；错误信封只保留给 400（信封非法/不可判定）与 503（契约或 Profile 记录不可读）。
  包 manifest 新增 `run_intake_preview` 块，`runtime_status = read_only_preview_registered`、
  `write_capability = absent`、`run_creation = not_performed`、`backend_lowering = not_wired`；
  **包级 `runtime_status` 仍为 `contract_only`**。
- 该批次改动了 `bridge/contracts/**/*.json`（新增请求/响应两个 Schema），因此 live
  `SCHEMA_SET_REVISION` 由 `sha256:518f4da9…e43ece` 变为 `sha256:d498092a…abffab`，`src/contracts/generated/**`
  已重新生成。`tests/fixtures/phase1-agent-orchestration/*.json` 与 `frozen-current-subset.json` **未被改写**；
  `sha256:3211d2df…c15d` 是 Phase 1 冻结值，与 live 值本就不相等。
  **契约变更窗口已关闭**，后续工作包不得再动 `bridge/contracts/**/*.json`。**（本条已于 2026-09-18 作废：
  窗口已由指挥方显式重开，见本文件 §2 上文 2026-09-18 条目；此处保留原文作为当时的裁决记录。）**
- 后端已完成 Phase 2C：`parse_run_intake_v2` / `lower_run_intake_v2`（`include/Core/RunIntakeLowering.h`、
  `src/Core/RunIntakeLowering.cpp`、`tests/test_run_intake_lowering.cpp`）与只读 CLI
  `validate-run-intake --run-intake <json>` / `run-intake-preview`。后端自评 `partial`，执行侧因五类 Profile records
  为空而 fail closed。**Bridge 尚未调用该 lowering**：上述预览端点只做契约校验与兼容判定，不触达 lowering，
  `/api/runs` 仍只接受 create-run v1。
- **新发现的表示性缺口（2026-09-17 复核，阻塞 Bridge 与 lowering 接线）**：CLI 的 issue 序列化
  （`src/Core/RunIntakeLowering.cpp:253-257`）每个 issue 只输出 `code` / `field_path` / `blocking`（`blocking` 硬编码
  `true`），丢弃 `message` 与 `safe_next_action`；`RunIntakeLoweringResult` 的三个 lowering 标志
  （`workload_lowered` / `execution_lowered` / `runtime_available`）在 stdout 上没有任何出口。而 Bridge 与已发布契约
  的 `backend_issues` 要求五字段齐备且禁止补造，因此当前**没有任何合法方式**把 CLI 输出接进 Bridge 契约。同时
  CLI 用 `exit 1` 表达「被判定为 blocked」并在 stdout 打印 issues JSON——**这是判定结果，不是传输失败**。
  结论：`WP-2C-02` 收窄为服务层调用与失败语义（不接线端点），端点接线另立 `WP-2C-02b`，前置是后端补 serializer
  （**已裁决：走独立后端工作包 `WP-2C-02a`**，见下文「契约窗口重开计划」）或由指挥方重新授权契约窗口；
  `WP-2C-05` 的「三个 lowering 标志分开显示」同样依赖该缺口关闭。
  详见 `docs/F9_AGENT_ORCHESTRATION/24_PHASE2C_WORK_PACKAGE_PROMPTS.md` §4.2 / §4.2.1。
- **工作台展示覆盖度缺口（2026-09-17 审计）**：后端一次 `run` 产出十个规范 artifact 与九段跨层契约链，但
  Bridge 只请求 **7 个报告**；四个运行期工件（`--runtime-events-out` / `--runtime-summary-out` /
  `--runtime-requests-out` / `--runtime-analysis-out`）从未被采集，且 Bridge SSE 只有「运行中/终态」两种事件，
  执行期阶段级进度不可观测。已到达前端的 7 个报告里另有 **36 项字段（另加第 7b 条）已随 artifact 进入 bundle
  却没有任何页面渲染**（含 `partial_artifacts`、`capability_registry`、`contributing_factors`、`error_budget`、
  `pd_disaggregation`、三个 percentile distribution 的 p50/max、`boundary_notes`、
  `run_bound_des_evidence.state_summary` 与逐窗口 `stream_records` 等）。缺口按成本分为四类：
  **C0 纯前端**（零 `bridge/contracts` 改动，可立即开工）、**C1 Bridge 采集**（须改 `openapi.json` 的
  `report_files` / `artifacts`，会改变 `SCHEMA_SET_REVISION`，属已关闭的契约窗口）、**C2 契约面**
  （Bridge 报告 Schema 以 `additionalProperties: true` 兜底，字段展示无契约保障）、**C3 输入面**
  （Run Intake v2 全部字段、工作负载描述语言、provenance 四元、GPU 参与、Cycle 窗口等无编辑入口）。
  审计与 `WP-2D-01` 派发提示词见
  `docs/architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md`；本轮审计未改动任何契约或代码文件。
- **C0 展示缺口已关闭（2026-09-18 验收）**：`WP-2D-01` 补齐 C0 的 36 项 + 第 7b 条并恢复五态
  `availability` 语义。实现入口 `src/features/report-coverage/`（14 文件，公共出口 `index.ts`，被 5 个 view
  按各自 section 挂载），run-bound DES 证据新增 `Week8StreamRecords.vue`。五态单一来源：新
  `availabilityFor()` 只在 `undefined | null` 时求值，缺失态回落 `adapters/dashboard-view-model.ts:4` 的同一个
  `unavailable()`（该函数本次仅加 `export`，逻辑未变）。**判定与完整门禁见覆盖度文档 §6.1.1 / §6.1.2**：
  34 文件（17 新 / 17 改 / 0 删）、`SCHEMA_SET_REVISION` 保持 `sha256:d498092a…abffab` 未变、
  `bridge/contracts` 与 `bridge/**/*.py` 零改动、未新增 `agent_exposed`、定向 Playwright 7 passed。
  因此 **C2 的「等 2D-01 验收」前置已满足**，`WP-2D-02` 只剩「窗口重开 + 步骤 0 探针」两条前置。
- **契约窗口重开计划（2026-09-17 指挥方裁决）**：C1/C2 的 `WP-2D-02` 与后端 issue serializer 缺口的工作包
  `WP-2C-02a` **合并进同一次契约变更窗口**（仓库不同、文件集合不相交，可并行派发）。派发前提有三条：窗口已由
  指挥方显式重开、`WP-2D-01` 已验收、`WP-2D-02` 的**步骤 0 探针**已有结论。窗口重开后 current live
  `sha256:d498092a…abffab` 必然作废。提示词见
  `docs/architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md` §6.2 / §6.3。
- **C1 的风险性质（不得按「多采集一个文件」处理）**：后端在请求了某 artifact 而其 state 为 `unavailable` 时，
  `write_wind_tunnel_artifacts` 返回 false（`src/Core/WindTunnel.cpp:6414-6419`），
  `src/apps/TileSimCLI.cpp:304-309` 随即 `exit 1`，**整条 run 判为失败**。而 `runtime_event_trace` 在
  `--from S1`（Bridge 当前配置）下的 state 恰为 `has_runtime_event_trace ? ready : unavailable`。
  因此追加 `--runtime-events-out` 等四个开关**可能改变 run 终态语义**，`WP-2D-02` 必须先做只读探针再实现。
  另需注意：state 为 `expected_absence` 时后端写入的是 **artifact 描述符 JSON** 而非工件数据
  （`WindTunnel.cpp:6404-6412`），Bridge 与前端都必须能区分二者。
- Evidence Agent descriptor 保持 `tilesim.bridge.evidence_agent_descriptor.v2`；request/response/citation/snapshot 保持 v1。
- create-run 顶层保持 `tilesim.bridge.create_run_request.v1`，nested design-space v1/v2 双版本行为不变。
- F9 live model repetitions 仍为 0；fake/fixture 只证明 contract 和 synthetic consistency。人工 citation entailment 尚未完成。

Agent 编排模块的当前状态见 `docs/F9_AGENT_ORCHESTRATION/README.md` 与
`docs/F9_AGENT_ORCHESTRATION/01_CURRENT_BASELINE_AND_GAPS.md`；下一批工作包见
`docs/F9_AGENT_ORCHESTRATION/23_PHASE2C_WEB_INTEGRATION_PLAN.md`。已归档的阶段记录在
`docs/archive/agent-orchestration/phase-records/`。

## 3. 不可破坏边界

- 不 reset、clean、覆盖用户未提交改动；没有授权不 commit/push。
- `127.0.0.1:5173` 是用户服务；没有明确部署授权不停止、不重启、不替换。
- 不读取或输出 `TILESIM_EVIDENCE_AGENT_*` 的值，不把 credential 写入仓库、日志或命令行。
- 前端不得重算模拟指标、补造 claim、升级 provenance/fidelity 或用 fixture 关闭 live/calibration/held-out Gap。
- uint64 ps/bytes/count 保持无损；requested/resolved fidelity 分离；资源语义模块保持并列；正式 citation 绑定 run/artifact/schema/SHA/Pointer/stable subject。
- Evidence 两类 409 都锁定原 key，只有显式 discard 才能开始新分析；不得自动重新调用 Provider。

## 4. 代码地图

```text
src/app/                         Router 与装配
src/contracts/                   Bridge/report contract 与 generated code
src/adapters/                    versioned payload -> stable view model
src/entities/agent-*/            Agent 本地 typed domain/context
src/features/agent-*/            Copilot Shell、intent compiler 与集成
src/features/run-experiment/     descriptor 表单和唯一 request builder
src/features/evidence-agent/     正式 Evidence Agent 展示与提交编排
src/views/                        页面编排
bridge/contracts/                OpenAPI、Schema 与正式校验
bridge/services/                 执行、capability、Evidence workflow
bridge/providers/                固定 Provider adapter
scripts/                         bootstrap、构建、部署、回滚和启动
tools/launcher/                  可选 Windows GUI 启动器源码
docs/F9_AGENT_ORCHESTRATION/     Agent 编排 current baseline、Gap、路线和验收
docs/archive/                    历史记录
```

## 5. 部署事实

- Web checkout 可位于任意 Windows 目录；脚本不得写死本机用户名或盘符。
- `scripts/bootstrap-workbench.ps1` 是干净 clone 的入口。
- 默认后端源码和 deployment worktree 是 Web checkout 的同级 `tileSim/` 与 `tileSim-backend/`，均可通过参数覆盖。
- Windows GUI 启动器由 `tools/launcher/build-launcher.ps1` 构建到 Web 根目录的 `启动TileSim工作台.exe`；
  frozen launcher 从 EXE 所在目录定位 checkout，WSL build cache 同时绑定 revision 与 deployment 源码路径。
- `runtime/`、`runs/`、`dist/`、`node_modules/` 都不进入 Git。
- 部署脚本使用 immutable `bridge + dist` snapshot；health 必须绑定 source/build/release/schema identity。

## 6. 当前优先级

1. 推进 Phase 2C Web 集成：把已发布的 Run Intake v2 契约接到 Bridge 与后端 lowering 之间。第一批（WP-2C-01a/01b）
   已完成严格路由与只读预览，**不创建 run**；下一批是 `WP-2C-02`，只交付 **Bridge 服务层**的 lowering 只读调用与
   失败语义（须遵守 Week 7 单槽约束：调用方注入同一把锁，`acquire(blocking=False)` 失败即容量已满）。**不接线端点**，
   因为已复核出后端 CLI 的 issue 序列化只有五字段中的三个（见 §2 的表示性缺口）；端点接线属 `WP-2C-02b`，需先关闭
   该缺口。提示词与验收清单见 `docs/F9_AGENT_ORCHESTRATION/24_PHASE2C_WORK_PACKAGE_PROMPTS.md` §4.2 / §6.3，
   工作包见 `docs/F9_AGENT_ORCHESTRATION/23_PHASE2C_WEB_INTEGRATION_PLAN.md`。
2. 不启动 Profile 数据工作、calculator 实现与 Web receipt UI：Phase 2 的数据侧与执行侧仍为 `blocked_*`。先关闭
   `GAP-PROFILE-SUCCESSOR-001`、`GAP-CALCULATOR-001`、`GAP-VALIDATE-001` 及并行、KV、工作负载、网络的累计执行 Gap，
   再重新审计 DoR。
3. 五类 Profile 真实记录为零时不得用产品名称、公开宣传值、LLM 常识或前端静态 JSON 补造能力；关键 unknown 必须阻塞。
4. 后续正式多轮 Agent 需要 Conversation、Draft、Validation、Clarification、Approval、Workflow、RAG 和工具 contract；
   不要在浏览器内存模拟关闭 Gap。`GAP-CLARIFY-001` 的 answer binding 是当前唯一不依赖新契约即可闭环的前端缺口。
5. 文档变更继续按 `docs/README.md` 分类；结束阶段时把 dated 记录移入
   `docs/archive/agent-orchestration/phase-records/`，并把仍然有效的结论折进 `AI_HANDOFF` 与模块 current baseline。
6. 与 2C 并行的**不受契约窗口约束**的轨道：`WP-2D-01`（工作台展示覆盖度补齐 · 第一批 C0），只做纯前端渲染
   补齐，不碰 `bridge/contracts/**/*.json`、不碰 Bridge、不新增 artifact 请求，`SCHEMA_SET_REVISION` 必须保持
   `sha256:d498092a…abffab`。范围清单（36 项 + 第 7b 条）与提示词见
   `docs/architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md` §3.1 / §6.1。
   **该包已于 2026-09-18 交付并验收（判定见同文档 §6.1.1）**，五态语义与 36 项 + 第 7b 条全部落地，
   `SCHEMA_SET_REVISION` 实测未变。剩余残留观察（行级 `cell()` 未走五态分派；`LayerRecordTable` /
   `f7-analysis` 仍为二元回退）登记在同一节末尾，属后续条目而非验收阻塞项。
   **上述残留与验收阶段定位的既有缺陷 `DEF-BUSY-RACE-001`（`src/store/dashboard.ts:103-137` 的 busy 泄漏竞态，
   使全量 e2e 长期不可用）已合并为一个无前置的收口工作包 `WP-2D-04`（提示词见同文档 §6.4）。**
   **`WP-2D-04` 已于 2026-09-18 交付并验收（判定见同文档 §6.4.1）：A 部修复使 `DEF-BUSY-RACE-001` 关闭、
   全量 e2e 恢复干净 tally；B-1 / B-2 / B-3 关闭，B-4 判定「无需修改」并经复核成立。**
   该包不占用 `WP-2D-03`（C3 输入面）的编号，2D-03 仍因依赖 Profile 数据而未写提示词。
   同一文件 §6.2（`WP-2D-02`，C1+C2）与 §6.3（`WP-2C-02a`）属**契约开窗批次**，窗口未重开前不得派发；
   `WP-2D-02` 的「等 `WP-2D-01` 验收」前置**已满足**，现只剩「窗口重开 + 步骤 0 探针」。
   `WP-2D-04` 验收后新登记三条残留（`renderKeyValues()` 裸字典仍二元、屏幕与导出的**状态列**文案不一致、
   `buildList()` 容器与单元格在 unsupported_schema 下可不同态），均记在 §6.4.1；
   **指挥方已于 2026-09-18 逐条裁定（§6.4.2）**：① 与 ③ **维持现状**（渲染点无 backend scope，可得状态集恰为
   `{available, missing}`，臆造其余三态属补造；① 的二元 helper 谓词与同站点 `display()` 逐字同源，改用共享解析器
   反而会让 `""` / `"—"` 出现 class 与文案不同源），② **确认是真缺陷并派 `WP-2D-05`**（提示词见同文档 §6.5）：
   导出 HTML 的记录状态列未走屏幕同规则——未报告状态导出成 `—` / `unknown`、已报告状态导出裸 token
   （屏幕经 `statusLabel()` 译出）。
   **`WP-2D-05` 已由指挥方在同一会话内直接实施并验收（判定见同文档 §6.5.1）**：新增 `renderStatusCell()`
   （`render-html.ts:74-90`，调用点 `:100`），已报告状态走 `statusLabel()` / `statusTone()`，未报告与 `unknown`
   走共享 `missing` 态；全仓 `>—</td>` 命中数 0，`record.status` 的处理点只剩屏幕与导出两处且规则一致。
   至此 **B-2「导出与屏幕同文案同 tone」已完全达成**，`record.status || "—"` 这一形态在本仓库已不存在。
   同文档 §6 内**已无「可立即派发」的工作包**：§6.2 / §6.3 等契约窗口重开，`WP-2D-03` 等结构化输入契约与
   Profile 数据。`WP-2D-05` 未占用 `WP-2D-03` 的编号。

## 7. 完整门禁

以 `AGENTS.md` 为准。模块测试先行，最后运行 contracts、dependency、typecheck、Vitest、lint、format、build、Bridge unittest、fixture E2E 和 `git diff --check`。需要 deployed/live 服务的测试必须保持独立并准确报告 skip。

## 8. 交接报告必填

- changed files 和职责边界；
- identity/revision 是否变化；
- canonical、uint64、stale、409、502/503/504、citation 与 retention 回归；
- fixture/live/calibration/held-out 各自状态；
- 全部门禁和 skipped 项；
- 是否操作 5173、credential、Provider、run、commit 和 push。

## 9. Phase 2 契约与 lowering 状态

- Phase 2A 候选已由 Phase 2B 正式发布并提交（`4d7f9fa`）。契约包位于
  `bridge/contracts/agent_orchestration_phase2/`，包含五类 Profile v2、Profile Binding、Run Intake、Validation、
  Calculator Receipt 与幂等/留存 policy。
- 发布覆盖 Schema、严格 validator、manifest 与生成 TypeScript/Ajv。`/api/runs` 仍不接受 Run Intake v2，真实
  Profile、calculator 与 held-out validation 仍 unavailable。WP-2C-01a/01b 已在工作树接入 `registry.py` 并注册
  `POST /api/agent/run-intake-preview`（只读预览），但该端点不做执行路由，见 §2。
- 后端已提交 Phase 2C `parse_run_intake_v2` / `lower_run_intake_v2` 与只读 CLI 入口；执行侧因五类 Profile records
  为空而 fail closed。**Bridge 侧尚未与 lowering 接线**（只读预览端点不触达 lowering）。
- 阶段记录已归档：Phase 1 验收、Phase 2 DoR 审计、Phase 2A 候选、Phase 2B 发布见
  `docs/archive/agent-orchestration/phase-records/`。
