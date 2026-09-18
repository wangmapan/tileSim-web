# Phase 0B 正式契约漂移审计

> 报告状态：`read_only_audit`；不发布或修改正式契约
>
> 事实日期：2026-09-08（Asia/Shanghai）
>
> 审计 Agent：`phase0b_contract_drift_audit`
>
> 独占 worktree / branch：`D:\tileSim-worktrees\phase0b-contract-drift-audit` / `codex/ao-phase0b-drift`

## 1. 结论

`GAP-CONTRACT-DRIFT-001` 当前不能关闭，也不能重新分类为单纯的“旧部署版本差异”。审计期间只读 GET 证明，
`127.0.0.1:5173` 已经运行 Web source `09e95b0efd37c04c00a8c5310cc3c47f89cf3f42`、后端
`09c22c0efff890253a1eacf403c2979f56fd9ba6`、schema-set
`sha256:2214c4eae8361bc46fce52163832eb0ba9b9438692c2ff147cbd1b56a2df2af8` 和 experiment descriptor
revision `sha256:1ef962150e0cfa19d27116a3176f23881f7a790cd23b8ef4ebaf3e7885aef4f1`。这与当前
`D:\tileSim-web` 中的未提交 F8 contract 源码一致，而不是 Phase 0 记录的旧 `eb6c0d…` / `de97e5…` 状态。
health 报告的 `deployed_at` 为 `2026-09-08T17:59:51.5082343+08:00`。本审计没有执行该部署，也没有停止、
重启或替换服务。

部署对齐没有消除兼容性问题。当前工作树直接改变了
`tilesim.design_space.s6_candidates.v1` 的可接受 payload 集，并通过仍名为
`tilesim.bridge.create_run_request.v1` 的入口执行新的拒绝规则。至少五类由 Web HEAD 正式接受的旧 payload 会被当前
源码拒绝。因此“create-run family 字符串仍为 v1”不等于 backward-compatible；若这些规则是目标行为，必须发布正式
successor 或同时保留旧 v1 语义。当前独立 `bridge/test_f8_schemas.mjs` 还保留旧合法 fixture，针对当前 Schema 运行失败，
说明 F8 owner 的完整测试交接没有闭合。

Phase 1 不应绑定运行中 5173，也不应绑定未提交的 `2214c4…` 作为耐久源码基线。目标必须是一个经过 owner/兼容评审、
测试闭合且可由 Git 唯一复现的源码 revision；在此之前，Phase 0 的不可变 HEAD `09e95b0…` 及其
`eb6c0d…` / `de97e5…` 只能作为旧 v1 兼容基线，Phase 1 DoR 仍被本 Gap 阻塞。

## 2. 职责、输入与输出

本 Agent 只负责 deployed / Web HEAD / 当前工作树的 F8 契约差异、旧 payload/客户端兼容性、canonical/idempotency
不变量、owner 证据和目标基线建议。唯一写入是本文；没有修改现有 F8 contract、proposal、正式 Schema、generated
client、UI、后端或主工作树。

输入 contract：

- Web HEAD：`09e95b0efd37c04c00a8c5310cc3c47f89cf3f42`；
- 后端 HEAD：`09c22c0efff890253a1eacf403c2979f56fd9ba6`；
- HEAD schema-set：`sha256:eb6c0dc921faa53789c053dfef99b82d1a5eb0499cb244e364178eab43e7095c`；
- HEAD experiment descriptor：`tilesim.bridge.experiment_descriptor.v1` /
  `sha256:de97e5fe0aae2ae1c5ffeeda7a0a56fd23c6a56aa28c3746eead00d89c68d059`；
- create-run：`tilesim.bridge.create_run_request.v1`；
- Evidence Agent descriptor：`tilesim.bridge.evidence_agent_descriptor.v2` /
  `sha256:5f78ed33e20c131f672af53368c5ca950f41d63fd2e8f5301757d1f42debe357`；request/response/citation/
  snapshot-reference 均保持 v1；
- Phase 0 proposal、独立 Eval、八字段后端执行追踪矩阵和累计链测试。

输出 contract：本文是 development audit evidence，不是 OpenAPI/Schema/capability snapshot，也没有新 identity、revision
或 digest。

## 3. 必读输入完成情况

开始审计前完整读取了用户列出的 22 类输入：两个仓库及本 worktree 的 `AGENTS.md`/`AI_HANDOFF.md`，AO 文档
README、00、01、03、04、05、11、12、14、15、17、18，Phase 0 proposal 全目录（全部 Schema、valid/invalid fixtures、
canonical 实现与 vectors），Phase 0 Eval 报告、fixture 和 oracle，后端 Markdown/JSON 追踪矩阵与累计链测试，以及当前
experiment descriptor、create-run、manifest/schema-set 生成路径、F8 contract/generated/Web diff 和相关测试。

## 4. 初始状态与文件 ownership

两个仓库的初始 HEAD 与用户给定事实一致。`D:\tileSim-web` 和 `D:\tileSim` 均已有未提交改动；本审计没有清理、
覆盖、stash、reset 或 checkout 这些内容。Web worktree list 中没有可识别的 F8 专用 worktree/branch，且未提交 diff 没有
commit author；Windows 文件 owner 也不能证明任务 owner。因此只按仓库规范把责任域确定为 `Bridge + Integration/F8`，
不能虚构个人或 Agent owner。

| 文件/状态面                                            | 本阶段 owner 证据                                              | 本 Agent 权限与结果               |
| ------------------------------------------------------ | -------------------------------------------------------------- | --------------------------------- |
| `docs/development/PHASE0B_CONTRACT_DRIFT_AUDIT.md`     | Phase 0B 提示词明确分配给 Drift Agent                          | 新建，唯一写入                    |
| F8 descriptor/create-run/validation/execution contract | Gap Register 标记 `Bridge + Integration`；文件位于 F8 正式路径 | 只读；未确认具体 owner handoff    |
| OpenAPI 根、schema-set、manifest、generated clients    | AO-15 与 Phase 0B 提示词指定主集成 Agent 单槽拥有              | 只读                              |
| Phase 0B capability/Profile publication candidate      | `phase0b_catalog_publication` 独占 worktree                    | 只读                              |
| Phase 0B runtime fixtures/oracle                       | `phase0b_runtime_eval` 独占 worktree                           | 只读                              |
| 后端八字段执行事实                                     | `D:\tileSim` 源码、矩阵和测试为权威来源                        | 只读                              |
| `127.0.0.1:5173`                                       | 用户服务                                                       | 仅 GET；未部署、写 run 或操作进程 |

F8 核心 14 个 modified contract/generated/UI/test 文件在两次 SHA-256/mtime 采样间完全一致；这只能证明审计窗口内未观察到
继续写入，不能替代 owner 的明确完成交接。共享 `bridge/test_server.py` 同时含 Phase 0 相邻层测试和 F8 改动，是集成冲突
热点。

## 5. 三个 release state

| 状态                         | Web / backend                              | schema-set         | experiment descriptor   | create-run | 解释                                              |
| ---------------------------- | ------------------------------------------ | ------------------ | ----------------------- | ---------- | ------------------------------------------------- |
| Web HEAD 原始 contract       | `09e95b0…` / `09c22c0…`                    | `sha256:eb6c0dc…`  | v1 / `sha256:de97e5fe…` | v1         | Git 可复现的旧兼容基线                            |
| 当前 `D:\tileSim-web` 工作树 | HEAD 仍为 `09e95b0…`，含未提交 F8 diff     | `sha256:2214c4ea…` | v1 / `sha256:1ef96215…` | v1         | 不是 commit/release revision                      |
| 审计时 5173                  | Web source `09e95b0…` / backend `09c22c0…` | `sha256:2214c4ea…` | v1 / `sha256:1ef96215…` | v1         | 与当前 contract identity 对齐；已不再是旧部署状态 |

5173 manifest 仍发布 Evidence descriptor v2 / `5f78ed33…` 和 Evidence request/response/citation/snapshot-reference v1。
本审计只读取 `/api/health`、`/api/manifest` 和 `/api/experiment-schema`，没有查询或调用 Provider。

## 6. 逐 payload / 字段兼容矩阵

分类可叠加；`breaking` 表示 Web HEAD 接受的 payload 在当前相同 v1 identity 下被拒绝或含义改变。

| 对象 / JSON Pointer 或规则                                                        | HEAD → 当前变化                                                                           | 分类                                                                             | 旧 payload / 客户端影响                                                                                                               |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| experiment descriptor `/source_mode_options[synthetic_trace]/allowed_claim_scope` | `synthetic_consistency_and_exploratory_s6_only` → `synthetic_consistency_and_exploratory` | payload canonicalization change；semantic behavior change                        | descriptor Schema 只要求字符串，旧结构 validator 可接受；语义范围文字被放宽，绑定旧 descriptor revision 的客户端应 fail closed/reload |
| design-space `/calibration_level`                                                 | `uncalibrated \| partially_calibrated` → `uncalibrated`                                   | validation tightening；breaking                                                  | 旧 `partially_calibrated` 新 key 请求从接受变为拒绝                                                                                   |
| design-space `/allowed_claim_scope`                                               | 五值集合 → 仅 `exploratory`                                                               | validation tightening；breaking                                                  | `exploratory_s6_only`、`synthetic_consistency(_only)`、`workflow_consistency_only` 旧 payload 被拒绝                                  |
| candidate `/oversubscription_factor`                                              | minimum `0.000001` → `1`                                                                  | validation tightening；breaking                                                  | `[0.000001,1)` 的旧 payload 被拒绝                                                                                                    |
| canonical candidate uniqueness                                                    | 旧 tuple 含 `uncertainty_score`、`tail_risk`；新 tuple 只含六个执行输入                   | payload canonicalization change；semantic behavior change；breaking              | 仅风险 metadata 不同的两个旧候选从 distinct 变为 duplicate                                                                            |
| DES promotion aggregate budget                                                    | 新增 `total + promoted + top-k reserve <= 100000`；`fidelity_policy=des` 启用             | validation tightening；semantic behavior change；breaking                        | 旧单次 screening budget 内的 DES manifest 仍可能被拒；`default` 不启用此额外预算                                                      |
| `validate_run_request`                                                            | 把 fidelity 是否为 `des` 传入 design-space validator                                      | semantic behavior change；breaking（DES 子面）                                   | 顶层 create-run v1 未改名，但相同 payload 的接受集合发生变化                                                                          |
| CLI nonzero public `error`                                                        | 通用消息 → 最多 1000 字符的压平 stderr 尾部                                               | additive response detail；semantic behavior change；security/retention `unknown` | JSON shape 仍为字符串；旧客户端结构兼容，但公开/持久化内容改变，需 stderr 数据分类审查                                                |
| generated TS/validators                                                           | 与收紧后的 Schema 同步                                                                    | generated / documentation-only relative to source contract                       | 不是独立兼容决策；证明生成物反映当前 contract                                                                                         |
| Web request precheck                                                              | 增加与后端相同的 uniqueness/promotion budget 检查                                         | semantic behavior change；additive validation                                    | 新客户端更早拒绝；旧客户端提交后由 Bridge 拒绝                                                                                        |
| Panel/help/fallback 文案                                                          | 子 Pointer 错误高亮、固定 provenance 帮助、fallback `exploratory`                         | documentation/UI-only；additive backward-compatible                              | 不改变 wire shape，但跟随新语义                                                                                                       |
| OpenAPI/manifest shape                                                            | 文件/字段结构未改；schema-set 内容 digest 改变                                            | identity/revision update                                                         | 客户端必须绑定新 schema-set；不能用旧 schema-set 声称相同 contract                                                                    |

### 6.1 实测旧 payload 结果

同一组纯 validator payload 分别在 HEAD worktree 和当前主工作树运行，未创建 run：

| Case                                                     | HEAD   | 当前   |
| -------------------------------------------------------- | ------ | ------ |
| 新最小 `uncalibrated + exploratory + oversubscription=1` | ACCEPT | ACCEPT |
| `partially_calibrated`                                   | ACCEPT | REJECT |
| `allowed_claim_scope=exploratory_s6_only`                | ACCEPT | REJECT |
| `oversubscription_factor=0.5`                            | ACCEPT | REJECT |
| 仅 uncertainty/tail-risk 不同的候选对                    | ACCEPT | REJECT |
| request_count=50001 且触发 DES promotion                 | ACCEPT | REJECT |

因此当前变化不是纯 documentation、纯 additive 或只改变 revision 字符串，而是相同 nested v1 identity 的实际 breaking
change。`pnpm contracts:check` 和 generated types 一致并不能证明语义兼容。

## 7. create-run、canonical payload 与幂等

`tilesim.bridge.create_run_request.v1` family 字符串保持不变，顶层八字段 Pointer、scenario、GPU participation 和基础输入模式
没有在本 F8 diff 中改变。但 nested `tilesim.design_space.s6_candidates.v1` 及运行时校验被直接收紧，所以 create-run v1 的
完整接受集合不再 backward-compatible。

`request_payload_digest` 实现及 canonical JSON 逻辑没有变化：解析后的 request 继续按 key 排序、UTF-8、紧凑 JSON 计算
SHA-256。POST 流程在新请求 deterministic validation 之前先按 Idempotency-Key 查找已保留 run：

- 同 key / 同 exact canonical payload：若旧 run metadata 仍保留，先匹配原 digest并精确 replay，即使该 payload 对新 key
  已不再通过当前 validator；
- 同 key / 不同 payload：在重新校验或副作用前返回 `409 idempotency_payload_mismatch`；
- 新 key / 旧 v1 payload：进入当前 validator，可能因上述收紧返回 400；
- 本 diff 没有改变 digest material、key 格式、reservation 或 replay 顺序。

针对 HEAD 和当前源码的幂等单元测试均通过。不过这只能证明 replay/conflict 不变量，没有修复新 key 下的旧客户端破坏。

## 8. F8 owner 状态与目标源码基线

可验证证据只有：改动全部位于 `D:\tileSim-web` main 工作树、HEAD 未变、核心文件在审计采样间稳定、5173 已部署同一
schema/descriptor identity，以及 AO-14/AO-15 将责任域归给 Bridge + Integration。没有 commit、分支、worktree 或交接文档
能证明具体个人/Agent owner，也没有批准“直接重定义 v1”的证据。因此 owner 状态是：

- responsibility domain：`Bridge + Integration/F8`；
- named owner：`unknown / handoff_not_verified`；
- writing state：审计窗口内 `no_change_observed`，但 `completion_not_verified`；
- release state：已部署 dirty-source contract snapshot，但 Git 中尚无可引用的发布 commit；
- compatibility state：`breaking_under_reused_v1_identity`；
- test state：局部 Python/Vitest/生成漂移检查通过，独立 F8 Schema runner 失败。

建议目标：若这些 F8 规则确为所需后端修复，至少发布 `tilesim.design_space.s6_candidates.v2`；随后二选一：

1. create-run v1 同时接受旧 nested v1 和新 nested v2，使顶层 family 保持 additive；或
2. 发布 `tilesim.bridge.create_run_request.v2`，保留旧 v1 的旧语义与迁移窗口。

experiment descriptor 的 shape 未破坏，可继续使用 descriptor v1 family + 新 content revision，但其 claim-scope 语义必须经
owner 评审且明确不是保真度升级。CLI stderr 公开/持久化改动应单独做 security/retention review。

Phase 1 的最终源码绑定应指向上述决策落地后的 Git commit、由该 commit 计算的 schema-set/descriptor，以及同一 publication
candidate/catalog/generated tests；不应指向当前 dirty tree 或把 5173 当前 revision当源码 revision。决策前只可用 HEAD
`09e95b0…` + `eb6c0d…` + `de97e5…` 作为旧 v1 对照基线，不能宣布 Phase 1 DoR。

## 9. GAP-CONTRACT-DRIFT-001 关闭条件

必须同时满足：

1. 具体 F8 owner 完成可审计 handoff，并确认上述规则是保留、修正还是撤销；
2. 不再在 `tilesim.design_space.s6_candidates.v1` 下破坏旧 payload：恢复旧语义，或发布 successor/dual-version migration；
3. 明确 create-run v1 是否保留，并用 old client → new server、new client → old server、same key/same payload、same key/different
   payload fixtures证明策略；
4. 目标源码成为 Git 可复现 revision，并冻结 schema-set、experiment descriptor、create-run 和 nested manifest identity；
5. `bridge/test_f8_schemas.mjs`、Bridge F8 tests、Web adapter tests、`pnpm contracts:check` 和 generated drift tests全部通过；
6. CLI stderr 新行为完成数据分类、redaction、长度、持久化和用户可见性评审，或从本契约批次分离；
7. capability source、snapshot、generated types 和 tests绑定同一最终 revision；
8. 文档把 5173 与源码分别记录；无需为关闭 Gap 再部署 5173，且 Phase 1 fixture开发不依赖该服务。

在这些条件满足前，Gap 保持 `open/blocking`。当前阻塞原因不是 deployed/source identity 不同，而是 owner/发布基线不可审计、
同 v1 breaking change 和测试闭包失败。

## 10. 测试与结果

已运行：

- HEAD `python bridge/server.py --print-schema-set-revision`：`sha256:eb6c0d…`；
- 当前 `python bridge/server.py --print-schema-set-revision`：`sha256:2214c4…`；
- HEAD/current descriptor constant：分别 `de97e5…` / `1ef962…`，create-run 均为 v1；
- 5173 GET health/manifest/experiment-schema：3/3 HTTP 200，header/payload schema-set 为 `2214c4…`；
- 纯 validator compatibility matrix：6 cases，HEAD 6/6 接受；当前仅新最小 case接受，5 个旧 case按预期拒绝；
- HEAD targeted Bridge tests：17/17；
- 当前 targeted Bridge tests：21/21；
- 当前 `pnpm exec vitest run tests/unit/experiment-schema.test.ts`：11/11；
- 当前 `pnpm contracts:check`：通过；
- 当前 `node bridge/test_f8_schemas.mjs`：失败于旧 fixture
  `allowed_claim_scope=exploratory_s6_only` 不再满足 current const `exploratory`；
- 两次 F8 核心文件 SHA-256/mtime 采样：14/14 无变化。

调试过程中一次 targeted unittest 命令使用了两个不存在的方法名，产生 2 个 unittest loader errors；随后用实际方法名重跑，
相关 21 个当前测试全部通过。该命令错误不是产品测试失败；独立 F8 Schema runner 的失败是真实未关闭门禁。

未运行：全仓 Web/Bridge/E2E/后端门禁（由主集成 Agent 在全部写入结束后运行）；live deployment tests、live Provider、真实
校准、独立 held-out 验证和人工 citation entailment（均不在本审计授权内）。没有把跳过或未运行解释为通过。

## 11. 安全、留存与来源

- 只读 GET 没有产生 simulation run 或 Provider 调用；
- 未读取、记录或输出任何 `TILESIM_EVIDENCE_AGENT_*`；
- 未读取 credential、Provider response、用户问题、artifact payload 或 hidden reasoning；
- 未修改 Evidence Agent v2/v1、两类 409、502/503/504、stale/citation/fidelity/provenance 语义；
- Phase 0 fixture/synthetic consistency 仍不是 calibration 或 held-out evidence；
- 当前 CLI stderr 改动会把压平且截断的 stderr 尾部放入持久 run metadata/public error。仅有 1000 字符上限不足以证明无敏感
  路径或输入泄漏，因此安全/留存结论保持 `unknown` 并阻止静默吸收；
- 报告没有复制私有主设计资料，只引用仓库可见事实和 runtime GET 结果。

## 12. Changed files、操作声明与建议集成顺序

Changed files：

- `docs/development/PHASE0B_CONTRACT_DRIFT_AUDIT.md`（本报告，仅专属 worktree）。

明确声明：未触碰 `D:\tileSim-web` 主工作树、任何现有 F8 contract/UI/generated 文件、proposal 或后端；未部署、停止、
重启或替换 5173；未 POST run；未调用 live Provider；未读取 credential；未 reset、clean、stash、commit 或 push。

建议集成顺序：

1. 主集成 Agent先确认 F8 named owner 和 intended semantics；
2. F8 owner 提交 successor/兼容迁移 proposal及旧/新客户端矩阵；
3. 单槽 contract owner 冻结正式 Schema/identity，再生成 clients/validators；
4. 重跑独立 F8 Schema、Bridge、Web 和幂等测试；
5. capability publication candidate 重新绑定最终 backend/schema/descriptor/create-run revisions；
6. runtime Eval 独立验证 drift fail-closed；
7. 主集成 Agent最后更新 Gap/DoR 并运行全仓门禁。

本 Agent 到此停止写入，不进入 Phase 1。
