# Local bridge contract

bridge 在 `127.0.0.1:5173` 上托管构建后的前端和受控 API。它不会接受任意 shell 命令、任意文件路径或写入 TileSim 核心仓库。

默认端口为 5173；部署前临时验证可通过 `TILESIM_WEB_PORT` 选择其他 loopback 端口，监听地址始终固定为 `127.0.0.1`。

## API

- `GET /api/manifest`：API version、schema-set revision、错误/工件清单 schema 和已知报告 identity。
- `GET /api/health`：bridge、CLI、核心仓库与前端构建状态，并返回实际的 `backend_revision`、`backend_branch` 与 `tilesim_root`，用于核验网页当前连接的代码版本。
- `GET /api/catalog`：白名单场景、fidelity policy 与输入模式。
- `GET /api/experiment-schema`：返回绑定当前 schema-set 的 F8 实验参数 descriptor；字段身份、JSON Pointer、范围、单位与 capability predicate 均由 Bridge 发布。
- `GET /api/agent/evidence-capabilities`：返回 F9 read-only evidence Agent 的 provider、model、版本、能力、降级和执行语义；当前生产 Provider 未配置，结构化状态为 `unavailable`。
- `GET /api/templates/{scenario}`：受控场景的输入模板。
- `POST /api/runs`：提交结构化覆盖参数或一对受限 JSON 输入；要求 8–128 字符的 `Idempotency-Key`，可附带严格的 `tilesim.design_space.s6_candidates.v1` 候选 manifest 对象。
- `GET /api/runs/{id}`：读取任务状态。
- `GET /api/runs/{id}/events`：SSE 状态流；事件 ID `1` 表示 active、`2` 表示 terminal，使用 `Last-Event-ID` 恢复。
- `GET /api/runs/{id}/reports`：读取完整 run-bound 报告包，包括可用的 execution envelope、S8 validation 和 S9 metrics/attribution；前端据此展示分层结果。
- `GET /api/week7/evidence-map`：运行固定的只读 S9 字段证据映射命令。
- `POST /api/week7/calibration-example`：只运行仓库内置 offline calibration fixture。
- `POST /api/week7/orchestration-example`：只运行仓库内置 synthetic intent 的确定性五步编排。
- `GET /api/runs/{id}/artifacts`：读取 allow-list 工件清单、字节数、SHA-256、schema identity 和 report kind。
- `GET /api/runs/{id}/files/{artifact}`：查看白名单 JSON 工件。
- `POST /api/runs/{id}/name`：修改本地实验名称。
- `POST /api/runs/{id}/agent/evidence-analyses`：针对当前 run 的已验证 artifact snapshot 提交同步终态 evidence analysis；要求独立 `Idempotency-Key`。
- `GET /api/runs`：列出最近 20 次运行。

请求体最大 2.1 MB；单份自定义输入最大 1 MB。跨域只允许本地 Vite 开发地址，生产页面与 API 使用同源访问。

Bridge 默认只允许 1 个 `preparing/running` 任务，避免多标签页并发启动多个 TileSimCLI 耗尽本机资源。容量已满时，新 idempotency key 返回 retryable `429 run_capacity_reached`；相同 key 的恢复请求仍返回原 run。开发者可通过 `TILESIM_MAX_ACTIVE_RUNS` 显式提高上限。

Week 7 三个固定操作另共享一个非阻塞单槽，容量满返回 retryable `429 week7_capacity_reached`。前端必须按 evidence map、calibration、orchestration 顺序请求；不要使用并发请求自撞容量门禁。它们属于 backend-global fixture，不绑定当前 run，进入对应页面也不应清除当前 run。

## 契约来源

`bridge/contracts/openapi.json` 是 endpoint、版本、报告文件映射和 Bridge 行为元数据的唯一来源；`bridge/contracts/schemas/` 保存请求与响应 JSON Schema。Bridge 启动时读取这些文件并以全部契约文档计算 `schema_set_revision`。F8 的 8 个可提交参数由 `contracts/experiment_descriptor.py` 单点定义，descriptor 和 Python validation 都从同一组定义派生；Schema contract test 逐字段核对 JSON Pointer、enum、range 和 integer 约束，拒绝 Python/Schema 漂移。

`pnpm contracts:generate` 从相同文件生成 `src/contracts/generated/bridge-contracts.ts` 和 `bridge-client.ts`。前端的 `api.ts` 只负责 transport fallback、legacy 兼容、SSE 恢复和工件完整性校验。修改 endpoint 或 DTO 后必须执行 `pnpm contracts:generate`，门禁使用 `pnpm contracts:check` 拒绝生成漂移。

API 响应携带 `X-Request-ID`、`X-TileSim-API-Version` 和 `X-TileSim-Schema-Set-Revision`。错误使用 `tilesim.bridge.error.v1`，包含稳定 code、消息、精确 JSON Pointer 和 retryable 标志。前端只允许 GET 在 transport failure 时切换 API root；POST 不切换 root，同一序列化 payload 的显式重试复用原 idempotency key。

同一 key 和同一 canonical JSON payload 返回原 run；同一 key 配不同 payload 返回 409。执行开始前，key、payload SHA-256 和 Bridge 实例身份会通过临时文件加原子替换写入私有 `run-metadata.json`。该文件不属于浏览器 artifact allow-list。新 Bridge 发现旧实例遗留的 `preparing/running` 且没有主报告时，会以 `bridge_execution_interrupted` 收敛为失败终态，不会无限等待。

执行故障使用稳定的私有持久化终态：timeout 为 `cli_timeout`，启动错误为 `cli_execution_error`，非零退出为 `cli_nonzero_exit`，零退出但缺少合法主报告为 `cli_missing_primary_artifact`。失败运行产生的合法 partial artifact 仍会进入工件清单；缺失或损坏 JSON 不会被枚举。持久化恢复不会把已记录的 failed 状态仅因主报告文件存在而改写为 completed。

completed run 的损坏可选报告会被忽略，不影响其余合法报告；主 run artifact 缺失或损坏时 reports endpoint 返回 `primary_artifact_invalid`。run 终态与重命名使用同一 metadata lock，避免并发 read-modify-write 丢失字段。

版本化前端先固定 `/api/manifest` 的 schema-set revision，再读取 artifact manifest。报告与输入从 allow-list artifact endpoint 加载，并逐项校验 SHA-256 和 schema identity；revision、hash 或 identity 不一致时失败关闭。未版本化的旧 Bridge 仍只支持历史报告的只读兼容路径。

## F6B / Week 8 run-bound artifacts

DES run 会向 CLI 传递 Bridge `run_id`，并额外收集固定工件
`week8-run-evidence.json`（artifact ID `week8-run-evidence`，schema identity
`tilesim.s7_run_bound_des_evidence.v1`）。`default` fidelity 不请求该 DES-only
工件；requested fidelity、resolved fidelity 和实际 execution mode 始终分开。

当前受支持的 F6B report identities 为：

- `metrics.json` → `tilesim.metrics_report.v1`
- `tail-cause-chain.json` → `tilesim.tail_cause_chain_report.v1`
- `execution-envelope.json` → `tilesim.s7_execution_envelope.v1`
- `validation.json` → `tilesim.validation_report.v1`
- `week8-run-evidence.json` → `tilesim.s7_run_bound_des_evidence.v1`

artifact manifest 使用 `tilesim.bridge.artifact_manifest.v2`。每个有效条目包含固定
artifact ID、文件名、report kind、media type、精确字节数、SHA-256、schema identity
和 `contract_status`。unsupported schema、run binding mismatch、非法 JSON 和 self-hash
cycle 不会进入有效条目，而是出现在 `rejected_artifacts`；直接读取相应工件返回结构化
409 错误。legacy unversioned 报告仅标记为 `legacy_compatibility`，不得声称 F6B 完整闭合。

工件 SHA-256 只由 manifest 绑定。`week8-run-evidence.json` 顶层不得嵌入自身 SHA-256。
Bridge 在发送浏览器工件时复用已经校验的原始字节，因此 response body 与 manifest
的 bytes/SHA-256 完全一致。

F6B schema 将 ps/bytes/count 的 `uint64` 标记为 lossless JSON integer，并将生成的
TypeScript 表示指定为 `bigint`。前端必须使用无损整数解析路径；原生 `JSON.parse`
产生的 JavaScript `number` 不能满足该契约。Bridge/Python 不会把整数转换为浮点数。

设计空间 manifest 以 JSON 内容提交，bridge 不接受浏览器传来的任意本地路径。内容会经过根字段和候选字段 allow-list、类型/范围、有限数、精确整数、唯一 ID、唯一规范输入和总 transfer budget 校验，然后物化为 run-local `input-design-space-candidates.json`。每次运行都会收集 `design-space.json`；未提交 manifest 时使用后端内置的 S6-only synthetic candidates。

网页中的设计空间证据固定显示 `execution_scope=S6_only`。候选 ranking 保持 `synthetic_consistency`，不会因为基础运行连接了 real-trace 或 held-out 报告而自动升级。

## F7 Fabric / design-space artifacts

F7 增加两个受支持的版本化 identity：

- `design-space.json`（artifact ID `design-space`）→ `tilesim.design_space_report.v1`
- `input-topology.json`（artifact ID `input-topology`）→ `tilesim.s6_topology_input.v1`

`design-space.json` 由后端声明 `pareto_front_id`、`objective_set_id`、每个候选的
`pareto_member`、dominance refs、objective direction/value/unit，以及实际进入 S6
Analytical/DES 执行的 `executed_s6_knobs`。候选导航固定为
`navigation_scope=artifact_record`；`bridge_run_id` 为 null，
`backend_run_instance_id` 只标识父 run 内的后端实例，不能用作 Bridge run URL。

候选、objective 和 executed knob 的 EvidenceRef 分别定位到
`/candidates/{index}`、`/candidates/{index}/objectives/{index}` 和
`/candidates/{index}/executed_s6_knobs/{index}/...`。数组位置不是实体身份；Bridge
先要求 stable ID 唯一，再验证 Pointer 目标的 typed subject 完全一致。

Bridge 在物化 `input-topology.json` 时为每个 domain 增加稳定
`fabric_domain` subject、`/topology/domains/{index}` Pointer 和 provenance。
`metrics.json` 的 `/system_summary/fabric_domain_utilization/{index}` 通过
`topology_domain_ref` 精确引用该 topology record，禁止按同名、时间接近或数组下标猜测。

F7 artifact 继续由 `tilesim.bridge.artifact_manifest.v2` 绑定固定文件名、原始 bytes、
SHA-256、schema identity 和 parent `run_id`。`design_space.report.v1alpha1` 只标为
`legacy_compatibility`。duplicate/dangling/wrong Pointer、subject mismatch、错误 Pareto
方向或 dominance cycle、unsupported schema、run mismatch、self-hash、uint64 越界、
synthetic 或 Cycle promotion 均失败关闭。

## F8 schema-driven experiment orchestration

`GET /api/experiment-schema` 返回 `tilesim.bridge.experiment_descriptor.v1`，并同时绑定
`schema_set_revision`、独立 `descriptor_revision` 和
`tilesim.bridge.create_run_request.v1`。稳定 `field_id` 和
`request_json_pointer` 是参数身份；显示名称、数组位置和文本相似度均不是关联依据。

正式受控参数面只有 S0 的 1 个 workload 字段、S1 的 3 个 runtime 字段和 S6 的 4 个
Fabric 字段。S2/S3/S4/S5 明确为 `not_exposed`，不会从模板或后端内部同名字段推断为可提交。
所有参数都只适用于 `controls` 输入模式；当前无跨场景正式默认值，因此
`explicit_default_available=false`，前端不得自行补造默认值。

`create-run-request.schema.json` 通过 closed `$ref` 绑定：

- `run-overrides.schema.json` → `tilesim.bridge.run_overrides.v1`
- `runtime-trace-input.schema.json` → `tilesim.bridge.s1_runtime_trace_input.v1`
- `topology-request-input.schema.json` → `tilesim.bridge.s6_topology_request_input.v1`
- `design-space-candidates.schema.json` → `tilesim.design_space.s6_candidates.v1`

网页提交面只开放 `synthetic_trace`。`real_trace` 和
`compatibility_harness_trace` 仍作为架构 provenance taxonomy 发布，但状态为 unavailable；
请求校验会拒绝这两种 source mode，也会拒绝把 synthetic 输入标成 calibrated/held-out claim。
requested fidelity 只允许 `default` 和 `des`；resolved fidelity 继续来自运行后的 execution
envelope/validation。即使探测到 Verilator，Cycle 仍保持 unavailable，直到另行交付明确的
S6 hotspot request Schema。

`/api/catalog` 和 `/api/capabilities` 已将 input/design-space/GPU modes 及稳定
`run_surface` 字段写入 OpenAPI。前端必须同时核对 manifest、descriptor 和响应 header 的
schema-set revision；不一致时失败关闭。

## F9B read-only evidence Agent

F9B 是 S9 的只读解释输出面，不产生新的模拟因果或 fidelity。它绑定既有
`S0 -> S1 -> S2 -> {S3,S4,S5} -> S6` 证据，保持 S3/S4/S5 并列；S7 只作为执行宿主，
S8/S9 不能进入 latency causal ranking。正式 identity 为：

- descriptor：`tilesim.bridge.evidence_agent_descriptor.v1`
- request：`tilesim.bridge.evidence_agent_request.v1`
- response：`tilesim.bridge.evidence_agent_response.v1`
- citation：`tilesim.bridge.evidence_agent_citation.v1`
- snapshot reference：`tilesim.bridge.evidence_snapshot_reference.v1`
- 输入 compatibility contract：`tilesim.web.structured-performance-report.v2`

当前没有生产 evidence Provider。capability 的 `availability=unavailable`、
`provider.configured=false`，analysis endpoint 返回正式 response contract，
`completion_state=refused` 和 `reason_code=provider_unavailable`；自动测试中的 validator
test double 只验证成功结果的结构，不代表 live Agent closure。

请求不携带浏览器文件路径或任意 URL。snapshot reference 绑定当前 run 的 verified
`tilesim.bridge.artifact_manifest.v2` canonical SHA-256，并冻结 source/build revision、state digest
及其匹配状态；任一 backend identity 变化都会拒绝旧 snapshot。allow-list 中每个 artifact 还必须精确
匹配 manifest 的 run ID、schema identity、原始 bytes 和 SHA-256。每条 allowed record 和
citation 都使用 JSON Pointer 加 stable `subject.kind/id`；数组下标只是在 stable ID 唯一匹配后
得到的位置，不能作为实体身份。legacy artifact 不能进入 F9B supported allow-list。

descriptor 的 `digest_contract` 固定 `tilesim.bridge.canonical_json.v1`：对象键按 Unicode code
point 升序，数组保持原顺序，UTF-8 紧凑 JSON 使用逗号/冒号且无空白，非 ASCII 不转义，整数按
无损 canonical decimal JSON token，非有限数禁止。artifact manifest digest 覆盖完整 verified
manifest；input snapshot digest 只覆盖 descriptor 声明的六个 material 字段，不覆盖 locale、
task kind、client request ID 或不可信 user question。

每个 atomic claim 自带自己的 citations，禁止 answer-level citation fallback。citation 的
`value` 使用 `decimal_string` 和明确 numeric kind 保留 uint64 ps/bytes/count；availability 保持
`available`、`missing`、`expected_absence`、`not_covered`、`unsupported_schema`、
`not_applicable` 六态。P99 subject 明确区分 single request、tie/no-single-request、
not-applicable 和 missing，前端不得排序推断或强选一个 request。

Agent 只允许 `verified_snapshot_read` 和 `citation_resolution`，禁止 shell、路径、任意文件、
HTTP/网络、跨 run history、allow-list 扩张及模拟状态修改。artifact 文本始终是不可信数据，
不会成为系统指令；hidden chain-of-thought 不返回也不持久化。synthetic/compatibility provenance
不能升级为 real、held-out 或 hardware，Analytical/DES 不能升级为 Cycle，reported attribution
不能扩写为新 ranking，recommendation 只能是有引用且未执行的条件草稿。

执行采用 `synchronous_terminal`，单槽非阻塞并发门禁，超时语义为 30 秒。同步终态返回后
cancel 为 not applicable，不另设 status/SSE/cancel endpoint。同 key/同 canonical payload 恢复
相同终态；同 key/不同 payload 返回冲突。私有
`agent-evidence-analyses/{sha256(idempotency-key)}.json` 只保存 redacted terminal metadata/result，
不保存 user question、snapshot payload、artifact content 或 hidden reasoning。

稳定 refusal/error reason 覆盖 `insufficient_evidence`、`citation_not_allowed`、
`citation_not_resolvable`、`unsupported_schema`、`stale_schema_revision`、
`run_binding_mismatch`、`ambiguous_reference`、`provenance_scope_violation`、
`fidelity_scope_violation`、`unsafe_tool_request`、`prompt_injection`、`input_too_large`、
`output_truncated`、`provider_unavailable`、`timeout`、`cancelled` 和 `concurrency_limit`。

## 代码职责

- `server.py`：配置、兼容 wrapper、HTTP 路由和端点协调。
- `api/responses.py`：版本 headers、错误 envelope、CORS、JSON artifact 与 SSE 序列化。
- `contracts/experiment_descriptor.py`：F8 参数、选项、coverage、capability predicate 和 descriptor revision 的单一事实来源。
- `contracts/evidence_agent.py`：F9 descriptor、request/response/citation、snapshot、scope、Pointer/subject 和失败关闭校验。
- `contracts/validation.py`、`contracts/run_request.py`：从正式参数定义派生的字段校验和 validated run command。
- `repositories/runs.py`：run metadata、artifact manifest、恢复、幂等查询和原子写入。
- `services/execution.py`：输入物化、TileSimCLI 参数构建、执行与失败终态收敛。
- `services/week7.py`：Week 7 固定操作 allow-list、路径边界、CLI 调用和登记响应 Schema 校验。
- `services/evidence_agent.py`：F9 redacted terminal persistence、幂等恢复及 Provider-unavailable 终态。
- `infra/identity.py`：Git worktree、部署清单、源码/构建 identity 和 capabilities。

新端点只在 `server.py` 做路由；校验、持久化、执行或基础设施逻辑应进入对应模块。保留 `server` wrapper 是为了兼容部署脚本和现有故障注入测试，不应在 wrapper 中重新实现业务逻辑。

当前 Bridge 回归基线为 61 个 unittest，全部使用临时 HTTP 端口，不操作正在运行的 5173 服务。Week 7 操作不接受请求正文中的路径、命令或参数，并要求 source/build identity 一致；同一时刻最多执行一个 Week 7 操作。CLI 输出会按登记的响应 Schema 校验必需字段、类型、最小值和有限数，同 schema_version 的畸形报告也会失败关闭。

F7 另有 `bridge/test_f7_schemas.mjs`，使用 Ajv 8 的 Draft 2020-12 实现编译
design-space、topology 和 metrics schema，并运行正反例；该测试不生成或修改前端代码。

F8 另有 `bridge/test_f8_schemas.mjs`，使用相同 Ajv 8 Draft 2020-12 路径验证 closed
create-run refs、正式 design-space manifest、descriptor payload、Pointer 可定位性和
OpenAPI 稳定类型；该测试同样不生成或修改前端代码。

F9 另有 `bridge/test_f9_schemas.mjs`，编译 descriptor/request/response/citation/manifest schema，
校验 OpenAPI endpoint 和 metadata，并把
`tests/fixtures/f9-agent-evaluation-cases.json` 的全部 36 个 case 固定为不可删减 hard gate。

受控运行要求 `source_revision == build_revision`。`local_worktree_snapshot` 模式还要求当前 `source_state_digest`、部署清单摘要与构建摘要三者一致。任一门禁不满足时 `/api/health` 返回 `execution_ready: false`，`POST /api/runs` 返回 503；提交版本使用 `scripts/update-backend.ps1`，未提交本地版本使用 `scripts/deploy-local-backend.ps1` 完成一致性部署后才会恢复执行。
