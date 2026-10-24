# Local bridge contract

## 阶段 5 Local-Dev 受控批处理（2026-10-24 当前事实）

Bridge 当前同时提供 `2026-10-19.wpd.v1` 受控优化和 `2026-10-19.wpe.v1` 批处理入口。批处理 tool registry 为
`2026-10-19.tools.v3`，优化 tool registry 为 `2026-10-19.tools.v2`；两者都只接受显式 `local_dev=true`、单并发和人工批准。
批处理使用独立 SQLite WAL 保存有界的 batch/candidate/approval/checkpoint/event/lease/summary 元数据，所有副作用仍委托
正式 `POST /api/agent/executions`，不新增 `/api/runs`、shell、任意路径/URL、外部 MCP/A2A 或无人值守生产入口。

阶段 5 收尾判定为 `LOCAL_PHASE5_PASS`，仅表示 local-dev 语义闭合，不是生产 GO。候选、失败/时间/运行/重试预算、暂停恢复、
lease/heartbeat、SSE contiguous replay、unknown outcome 的 `recovery_required` 与 `manual_intervention_required` 边界均保持
fail-closed；结果固定为 `local_dev` / `synthetic_trace` / `exploratory` / `not_for_production`。当前 schema-set revision 为
`sha256:dd9fad27c1d5591a79a16211f701f5725a711163bb284d960b99cca020064b4e`，Provider live acceptance、真实硬件、独立
evidence/citation review 和生产 GO 仍为 `production_acceptance_pending`。

## 阶段 4 Local-Dev 受控优化（已由阶段 5 扩展）

Bridge 的 `2026-10-19.wpd.v1` 优化入口只接受显式 `local_dev=true` 和人工批准，使用独立 SQLite WAL 保存有界 session/candidate/
approval/iteration/evaluation/checkpoint/event/summary 记录。候选经现有 Stage-2 validator 后才可提交正式 `/api/agent/executions`；不允许
直接调用 `/api/runs`、任意 shell/路径/URL、外部 MCP/A2A 或自动批准。结果必须通过 Stage-3 result reference、artifact identity、SHA/bytes、
JSON Pointer 和 synthetic provenance 校验，未知结果 fail closed 为 `recovery_required`。所有结果标记
`local_dev` / `synthetic_trace` / `exploratory` / `not_for_production`，生产 acceptance 仍为 `production_acceptance_pending`。

## Agent Harness 阶段 2（2026-10-18，历史记录）

> 本节及“代码职责”下的阶段 0/3A/3B 段落保留 dated contract 事实；它们不覆盖上方 2026-10-24 当前事实。

Bridge 发布 draft/validation/approval successor revision `2026-10-18.wpb.v1`，保留 WP-A
`2026-10-17.wpa.v1` 的兼容读取语义。正式 identity 为
`tilesim.agent_harness.experiment_draft.v2`、`tilesim.agent_harness.draft_validation_report.v1` 和
`tilesim.agent_harness.approval.v2`。新增 API 覆盖 draft 创建/读取/校验/删除/events 以及 approval
创建/读取/reject/revoke；所有写请求要求 `Idempotency-Key`，并绑定 principal、workspace、input snapshot、
schema-set、backend identity、policy 和精确 digest。draft/validation/approval 全流程固定返回
`would_create_run=false`，不调用 TileSimCLI、`/api/runs`、run queue 或 artifact materializer。当前 canonical schema-set revision 为
`sha256:c7a23b668d29415315e1eca4fd8dc0a5ebdff908b8420a6e187f33cc710efb42`。

SQLite WAL 只保留 digest、身份、状态和有界展示摘要，不保存完整 run request、credential、hidden reasoning、Provider raw
response 或未展示 artifact。approval 支持 pending/approved/rejected/expired/revoked/stale、单次消费 replay fence；
删除、过期、验证报告替换和 identity 漂移都会阻断后续批准。submit/cancel/retry/resume/autonomous optimization 仍未开放，
Provider acceptance 仍为 `live_acceptance_pending`。

bridge 在 `127.0.0.1:5173` 上托管构建后的前端和受控 API。它不会接受任意 shell 命令、任意文件路径或写入 TileSim 核心仓库。

默认端口为 5173；部署前临时验证可通过 `TILESIM_WEB_PORT` 选择其他 loopback 端口，监听地址始终固定为 `127.0.0.1`。

## API

- `GET /api/manifest`：API version、schema-set revision、错误/工件清单 schema 和已知报告 identity。
- `GET /api/health`：bridge、CLI、核心仓库与前端构建状态，并返回实际的 `backend_revision`、`backend_branch` 与 `tilesim_root`，用于核验网页当前连接的代码版本。
- `GET /api/catalog`：白名单场景、fidelity policy 与输入模式。
- `GET /api/experiment-schema`：返回绑定当前 schema-set 的 F8 实验参数 descriptor；字段身份、JSON Pointer、范围、单位与 capability predicate 均由 Bridge 发布。
- `GET /api/trace-packages`：从 `TILESIM_TRACE_PACKAGE_ROOT` 的固定目录布局发现 package，并返回经 TileSimCLI 检查的身份、入口边界、trace kind、provenance 与 artifact 完整性；不返回服务器路径。
- `POST /api/trace-packages/{package_id}/inspect`：按稳定 package ID 重新调用 `TileSimCLI inspect-trace-package`，并返回绑定当前 schema-set revision 的检查结果。
- `GET /api/agent/evidence-capabilities`：返回 F9 read-only evidence Agent 的 provider、model、版本、能力、降级和执行语义；当前生产 Provider 未配置，结构化状态为 `unavailable`。
- `GET /api/templates/{scenario}`：受控场景的输入模板。
- `POST /api/runs`：提交结构化覆盖参数、一对受限 JSON 输入或稳定 `trace_package_id`；要求 8–128 字符的 `Idempotency-Key`。Trace-package 与 overrides、custom inputs、design-space candidates 互斥。
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
- `POST /api/agent/optimization/sessions`、`GET /api/agent/optimization/sessions`：创建或列出 local-dev 优化 session。
- `GET /api/agent/optimization/sessions/{session_id}`、`/events`：读取优化 session detail 和事件回放。
- `POST /api/agent/optimization/sessions/{session_id}/candidates/{candidate_id}/approve`：批准单个候选。
- `POST /api/agent/optimization/sessions/{session_id}/{action}`：执行受控 pause/resume/cancel/retry。
- `POST /api/agent/batches`、`GET /api/agent/batches`、`GET /api/agent/batches/{batch_id}`：创建、列出和读取批处理。
- `GET /api/agent/batches/{batch_id}/events`：读取批处理事件，可用 `Last-Event-ID` 进行连续回放。
- `POST /api/agent/batches/{batch_id}/approve`、`POST /api/agent/batches/{batch_id}/{action}`：批准并执行受控 start/pause/resume/cancel/retry。

请求体最大 2.1 MB；单份自定义输入最大 1 MB。跨域只允许本地 Vite 开发地址，生产页面与 API 使用同源访问。

Bridge 默认只允许 1 个 `preparing/running` 任务，避免多标签页并发启动多个 TileSimCLI 耗尽本机资源。容量已满时，新 idempotency key 返回 retryable `429 run_capacity_reached`；相同 key 的恢复请求仍返回原 run。开发者可通过 `TILESIM_MAX_ACTIVE_RUNS` 显式提高上限。

## Trace-package 快速原型

受控根目录通过 `TILESIM_TRACE_PACKAGE_ROOT` 配置，固定布局为
`<root>/<package-directory>/trace_package.json`。浏览器只能提交满足 HTTP 安全约束的稳定
`package_id`，不能提交绝对路径、相对路径或上传内容。根目录、package 目录、manifest 及
package 内文件如包含 symlink/junction，或解析后逃逸受控目录，均失败关闭；manifest 的 Bridge
发现上限为 1 MiB，完整语义与 SHA-256 校验仍由后端 TracePackageAdapter 权威执行。

catalog 只有在受控根目录、TileSim 根目录和 TileSimCLI 均可用时才发布
`capability.available=true`。每次创建 run 前都会重新 inspect；执行命令使用参数数组传递
`run --trace-package <manifest> --topology <allow-listed topology> --to S6`，不传 `--trace`，也不传
固定 `--from`。Bridge 在执行前后复核 manifest SHA-256，检查后发生变化时以
`trace_package_changed` 失败终止。

运行私有 metadata 保存 package ID、manifest SHA-256、入口边界、trace kind 和原始 provenance，
但 manifest 路径不进入浏览器可见 run 或 artifact 接口。当前仅允许
`source_mode=synthetic_trace` 提交；`real_trace` 与 `compatibility_harness_trace` 可以在 catalog 中
显示，但状态为 unavailable。该原型只证明工作负载抽象与负载描述语言模块生成的六类 Trace
package 可以通过 Bridge 进入统一仿真内核模块，并复用既有报告、History 与 Evidence 展示链；
synthetic fixture 只属于契约和流程一致性证据，不构成真实设备校准、独立留出验证或硬件 fidelity。

完整实现、边界和验证方法见 `docs/features/traces/TRACE_PACKAGE_WEB_PROTOTYPE.md`。

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

设计空间 manifest 以 JSON 内容提交，bridge 不接受浏览器传来的任意本地路径。当前候选溯源固定为
`source_mode=synthetic_trace`、`calibration_level=uncalibrated`、`allowed_claim_scope=exploratory`。
内容会经过根字段和候选字段 allow-list、类型/范围、有限数、精确整数、唯一 ID、唯一执行输入和总 transfer budget
校验；仅修改 `uncertainty_score` 或 `tail_risk` 不会产生新的执行候选。DES 请求还会在提交前计算 Analytical 初筛、
风险触发晋级和 top-k 保留项的合计执行预算，然后物化为 run-local `input-design-space-candidates.json`。每次运行都会
收集 `design-space.json`；未提交 manifest 时使用后端内置的 S6-only synthetic candidates。

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

## F9B/F9C read-only evidence Agent

F9B 是 S9 的只读解释输出面，不产生新的模拟因果或 fidelity。它绑定既有
`S0 -> S1 -> S2 -> {S3,S4,S5} -> S6` 证据，保持 S3/S4/S5 并列；S7 只作为执行宿主，
S8/S9 不能进入 latency causal ranking。正式 identity 为：

- descriptor：`tilesim.bridge.evidence_agent_descriptor.v2`
- request：`tilesim.bridge.evidence_agent_request.v1`
- response：`tilesim.bridge.evidence_agent_response.v1`
- citation：`tilesim.bridge.evidence_agent_citation.v1`
- snapshot reference：`tilesim.bridge.evidence_snapshot_reference.v1`
- 输入 compatibility contract：`tilesim.web.structured-performance-report.v2`

F9C 在 `providers/evidence_agent.py` 增加 TileSim-owned 固定 JSON/HTTPS Provider 边界。Provider
未通过真实 authenticated capability probe 时，capability 仍正式返回
`availability=unavailable`、`provider.configured=false`，analysis endpoint 返回正式 response contract、
`completion_state=refused` 和 `reason_code=provider_unavailable`；自动测试中的 fake Provider 只验证
adapter/contract，不代表 live Agent closure。Bridge 只读取以下环境变量，不回退使用通用 SDK 变量：

- `TILESIM_EVIDENCE_AGENT_PROVIDER`：`tilesim_json_https_v1` 或版本化
  `tilesim_newapi_openai_v1`
- `TILESIM_EVIDENCE_AGENT_ENDPOINT`：固定 HTTPS endpoint；明文 HTTP 仅允许 loopback
- `TILESIM_EVIDENCE_AGENT_API_KEY`：Bearer secret，只从进程环境读取
- `TILESIM_EVIDENCE_AGENT_MODEL`
- `TILESIM_EVIDENCE_AGENT_MODEL_REVISION`
- 可选 `TILESIM_EVIDENCE_AGENT_TIMEOUT_MS`（1–120000）
- 可选 `TILESIM_EVIDENCE_AGENT_PROBE_CACHE_SECONDS`（0–3600）

配置完整还不代表 available。Bridge 会向同一固定 endpoint 发送最小
`tilesim.evidence_agent_provider.v1` capability probe，并精确核对 protocol、capability、provider、model
和 model revision；认证失败、transport 失败、identity 不匹配、redirect 或错误响应都保持 unavailable。
endpoint 不得包含 userinfo、query 或 fragment，run、artifact、用户问题和 Provider 输出均不能更改目标。

`tilesim_newapi_openai_v1` 是 TileSim-owned OpenAI-compatible transport adapter，不是 `OPENAI_*` fallback。
endpoint 只能是一个 HTTPS origin、`/v1` 或固定 `/v1/chat/completions`；Bridge 确定性解析为同一个 chat
completion target。该 adapter 使用 JSON response format、固定 system policy、空工具边界，并要求 NewAPI 外层
response 的 `model` 与 `TILESIM_EVIDENCE_AGENT_MODEL`、`TILESIM_EVIDENCE_AGENT_MODEL_REVISION` 三者完全相同。
模型返回 tool call、function call、reasoning content、非完整 JSON 或不同 model 时均失败关闭。当前 adapter 要求
model 与 revision 使用同一精确、非浮动模型 ID。

`scripts/start-evidence-agent.ps1` 通过隐藏输入读取 key，仅在当前启动进程中设置上述专用变量，再由 `WSLENV`
继承给 Bridge；key 不写入命令行、deployment manifest、release snapshot 或仓库。示例：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-evidence-agent.ps1 `
  -Endpoint https://provider.example.invalid `
  -Model exact-model-id
```

需要本机自动重启时，可将同一组 `TILESIM_EVIDENCE_AGENT_*` 配置写入 Git 忽略的
`runtime/evidence-agent.local.json`，并把 API key 保存为当前 Windows 用户绑定的 DPAPI 密文字段
`TILESIM_EVIDENCE_AGENT_API_KEY_DPAPI`。该文件不得进入 release snapshot、deployment manifest 或 Git；
只能由创建它的 Windows 用户在同一主机上解密。启动方式：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-evidence-agent.ps1 `
  -ConfigPath runtime/evidence-agent.local.json
```

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
task kind、client request ID 或不可信 user question；其中 material `schema_version` 是 request root 的
`tilesim.bridge.evidence_agent_request.v1`，不是内嵌 snapshot reference identity。

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

Provider 输入只投影已验证 allow-list 中的 records；每条 record 携带精确 citation identity 和
`untrusted_verified_artifact_content` 标记。固定 system policy、prompt revision 和 policy revision 来自
Bridge 代码，tools 始终为空。Provider 必须返回正式 response JSON；Bridge 再次核对 request/run/digest、
schema-set、provider/model/revisions、claim ID、citation allow-list、SHA、Pointer、stable subject、
provenance、fidelity 和 subsystem scope。无效 structured output 收敛为 `unsupported_schema`，无效 citation
收敛为现有 `citation_not_allowed`/`citation_not_resolvable`，不会把原始回答作为成功结果返回。

执行采用 `synchronous_terminal`，单槽非阻塞并发门禁，超时语义为 30 秒。同步终态返回后
cancel 为 not applicable，不另设 status/SSE/cancel endpoint。descriptor v2 将恢复语义发布为结构化分支：

- 同 key、同 canonical payload 且当前进程仍持有终态：精确重放，不调用 Provider；
- Bridge 重启后，claim-free Bridge terminal：从
  `tilesim.bridge.evidence_agent_terminal_record.v2` 的 redacted metadata 精确恢复；
- Bridge 重启后，claims-bearing terminal 或 claim-free Provider terminal：返回正式
  `tilesim.bridge.error.v1`、HTTP `409`、`code=terminal_result_not_retained`、
  `field_path=/headers/Idempotency-Key`、`retryable=false`；
- 同 key、不同 canonical payload：返回 HTTP `409`、`code=idempotency_payload_mismatch`，字段路径相同且
  `retryable=false`；
- 所有跨进程不可恢复分支均禁止自动重新调用 Provider。

私有 `agent-evidence-analyses/{sha256(idempotency-key)}.json` 只保存 digest、status、identity、claim count 和
redacted terminal metadata，不保存 user question、snapshot/artifact payload、Provider raw response、
validated model claims、credential 或 hidden reasoning。`/persistence/mode` 明确为
`storage_scope=run_local`、`record_kind=redacted_terminal_metadata_only`；claim-free Bridge terminal 的安全元数据
足以重建原正式 response，claims-bearing result 仅保留不可逆摘要和终态元数据。

Provider/Bridge 终态映射固定为：`502 -> completion_state=failed`、
`503 -> reason_code=provider_unavailable`、`504 -> completion_state=timeout`；三者都使用正式
`tilesim.bridge.evidence_agent_response.v1`，409 则始终使用正式 Bridge error envelope。

稳定 refusal/error reason 覆盖 `insufficient_evidence`、`citation_not_allowed`、
`citation_not_resolvable`、`unsupported_schema`、`stale_schema_revision`、
`run_binding_mismatch`、`ambiguous_reference`、`provenance_scope_violation`、
`fidelity_scope_violation`、`unsafe_tool_request`、`prompt_injection`、`input_too_large`、
`output_truncated`、`provider_unavailable`、`timeout`、`cancelled` 和 `concurrency_limit`。

## 代码职责与历史阶段记录

### Agent Harness 阶段 0 / WP-A（2026-10-17）

Bridge 已发布 `tilesim.agent_harness.*.v1` successor contract，revision 为
`2026-10-17.wpa.v1`。canonical Schema 位于 `contracts/schemas/agent-harness/`，OpenAPI metadata 与
后端-only endpoint 位于 `contracts/openapi.json`，Python facade/validator 为
`contracts/agent_harness.py`，durable store、queue、tool gateway 和 runtime facade 位于
`agent_harness/`。这是 SQLite WAL 单机 MVP，不是分布式队列；当前 Provider 状态为
`live_acceptance_pending`。

只读能力入口为 `/api/agent/harness-capabilities`、`/api/agent/tools` 和四个 allow-listed tools；
operation/checkpoint/approval/event routes 仅接受闭合结构化输入，scope、principal、run/snapshot、manifest
SHA/bytes/Pointer 均 fail closed。阶段 0 只读工具不调用 TileSimCLI；阶段 2/3/4/5 的正式写入边界由各 successor
contract 约束。前端生成客户端位于 `src/contracts/generated/agent-harness.ts`，其 revision 必须与 Bridge 模块和
schema-set drift check 保持一致。

- `server.py`：配置、兼容 wrapper、HTTP 路由和端点协调。
- `api/responses.py`：版本 headers、错误 envelope、CORS、JSON artifact 与 SSE 序列化。
- `contracts/experiment_descriptor.py`：F8 参数、选项、coverage、capability predicate 和 descriptor revision 的单一事实来源。
- `contracts/evidence_agent.py`：F9 descriptor、request/response/citation、snapshot、scope、Pointer/subject 和失败关闭校验。
- `contracts/validation.py`、`contracts/run_request.py`：从正式参数定义派生的字段校验和 validated run command。
- `repositories/runs.py`：run metadata、artifact manifest、恢复、幂等查询和原子写入。
- `services/execution.py`：输入物化、TileSimCLI 参数构建、执行与失败终态收敛。
- `services/week7.py`：Week 7 固定操作 allow-list、路径边界、CLI 调用和登记响应 Schema 校验。
- `providers/evidence_agent.py`：F9 固定 endpoint/config、authenticated probe、只读输入投影与 Provider transport。
- `services/evidence_agent.py`：F9 Provider 执行、输出二次验证、redacted terminal persistence 和幂等恢复。
- `infra/identity.py`：Git worktree、部署清单、源码/构建 identity 和 capabilities。
- `agent_harness/`：正式 successor contract、SQLite durable store、bounded worker、read-only tool gateway、
  side-effect ledger、checkpoint/approval 与恢复 facade。

新端点只在 `server.py` 做路由；校验、持久化、执行或基础设施逻辑应进入对应模块。保留 `server` wrapper 是为了兼容部署脚本和现有故障注入测试，不应在 wrapper 中重新实现业务逻辑。

Bridge 回归包含基础 server/Provider/canonical 测试以及 Agent Harness 阶段 3/4/5 定向测试；精确数字只在对应 dated
交接记录中登记，不在本 README 重复维护。测试使用临时 HTTP 端口或纯函数路径，不操作正在运行的 5173 服务。Week 7
操作不接受请求正文中的路径、命令或参数，并要求 source/build identity 一致；同一时刻最多执行一个 Week 7 操作。CLI 输出会按登记的响应 Schema 校验必需字段、类型、最小值和有限数，同 schema_version 的畸形报告也会失败关闭。

F7 另有 `bridge/test_f7_schemas.mjs`，使用 Ajv 8 的 Draft 2020-12 实现编译
design-space、topology 和 metrics schema，并运行正反例；该测试不生成或修改前端代码。

F8 另有 `bridge/test_f8_schemas.mjs`，使用相同 Ajv 8 Draft 2020-12 路径验证 closed
create-run refs、正式 design-space manifest、descriptor payload、Pointer 可定位性和
OpenAPI 稳定类型；该测试同样不生成或修改前端代码。

F9 另有 `bridge/test_f9_schemas.mjs`，编译 descriptor/request/response/citation/manifest schema，
校验 OpenAPI endpoint 和 metadata，并把
`tests/fixtures/f9-agent-evaluation-cases.json` 的全部 36 个 case 固定为不可删减 hard gate。

受控运行要求 `source_revision == build_revision`。`local_worktree_snapshot` 模式还要求当前 `source_state_digest`、部署清单摘要与构建摘要三者一致。任一门禁不满足时 `/api/health` 返回 `execution_ready: false`，`POST /api/runs` 返回 503；提交版本使用 `scripts/update-backend.ps1`，未提交本地版本使用 `scripts/deploy-local-backend.ps1` 完成一致性部署后才会恢复执行。

两个部署入口都会在切换 manifest 前，将候选运行时 `bridge/` 与 `dist/` 固化到
`runtime/releases/<release-id>`。`start-backend.ps1` 校验 release 文件数、byte count、Bridge/static digest、Web
source/build digest 和 schema-set revision 后才停止旧服务，并从不可变 snapshot 启动；`TILESIM_WEB_STATE_ROOT`
使 `runs/` 保持在 snapshot 外。启动失败时 previous manifest 原子恢复，并尝试从 previous snapshot 重启。部署身份可用
`pnpm release:identity` 与正式 artifact manifest 组合输出；该工具不会读取 Provider 环境变量值。

### Agent Harness 阶段 3A：人工批准后的单次受控执行（历史记录）

Bridge 发布 `2026-10-18.wpc.v1` execution successor contract。唯一提交入口为
`POST /api/agent/executions`；它只接受当前 `validated` 草案、`valid` validation、未过期且未消费的
`approved` 单次 approval，并重新校验 input snapshot、backend identity、schema-set、policy、validator
和 `create_run_request` digest。真正的运行仍只通过现有 `POST /api/runs` 创建，不允许直接调用 shell 或写入
run 目录。

执行操作提供：

- `GET /api/agent/executions/{operation_id}`、`/events`、`/events/stream`、`/result`
- `POST /api/agent/executions/{operation_id}/cancel`
- `POST /api/agent/executions/{operation_id}/retry`
- `POST /api/agent/executions/{operation_id}/resume`

cancel/retry/resume 请求必须使用 `tilesim.agent_harness.execution_mutation_request.v1` 和独立
`Idempotency-Key`；mutation command 与 create-run 共用 side-effect ledger，同 key 重放不会重复改变状态。

状态由 SQLite WAL durable store 和现有 bounded worker 管理，包含 submitted、queued、preparing、running、
waiting_artifacts、completed、failed、cancelled、retrying、recovery_required 和
manual_intervention_required。create-run side effect 写入已有 ledger；未知结果进入
`recovery_required`，禁止盲目重提。操作绑定唯一 `run_id` 和 verified artifact manifest/result reference；
artifact SHA、bytes、schema、run binding 或 manifest 校验失败不会进入 completed。Provider acceptance 仍为
`live_acceptance_pending`，本阶段不开放自主优化或无人值守批量实验。

阶段 3A 收口资产：`test_agent_harness_stage3_matrix.py` 登记并通过 `AH3-F01`–`AH3-F26`，覆盖 admission、幂等、
队列容量、worker/Bridge restart、create-run timeout/non-zero/unknown、event dedupe/sequence、取消迟到结果、
retry/resume、artifact manifest identity、retention/delete 和 terminal fence；现有 hosted HTTP 测试覆盖正式 submit、
status、events、SSE、result、唯一 `/api/runs` 入口、run count 与 ledger。错误保持 bounded code、JSON Pointer、
retryable/unknown_outcome，unknown outcome 进入 `recovery_required`。

仓外临时 hosted smoke 已使用当前源码 synthetic TileSimCLI 在端口 `59123` 完成一次 draft → validation → approval →
execution → run → result，仅一个 run，事件 sequence `1..5`，manifest 的 run/schema/SHA/bytes/provenance/fidelity 可追溯；
同 key replay 不增加 run、不同 payload 返回 409。该结果是 synthetic exploratory，不计 Provider live acceptance。
阶段 3A 仍为 **NO-GO**，直到独立发布审查完成；自主优化、自动候选、多工具自主循环和无人值守实验保持
`unavailable`/`not_exposed`。

### 阶段 3A 独立发布门禁（2026-10-18，历史记录）

正式入口：`python bridge/run_agent_harness_stage3_release_gate.py`；若需复跑仓外 synthetic smoke，附加
`--run-hosted-smoke --tilesim-root <D:\\tileSim> --tilesim-cli <TileSimCLI.exe> --deployment-manifest <manifest>`。
入口使用 `tilesim.agent_harness.stage3a_release_gate.v1`，只向调用方指定的仓外路径写 redacted manifest，并在 Provider pending
或人工 review 未完成时以 NO-GO 退出；不会访问 credential、Provider、5173 或用户 run。测试入口为
`bridge/test_agent_harness_stage3_release_gate.py`，当前 `AH3-F01`–`AH3-F26` 为 26/26 pass，hosted smoke 已复跑并校验
polling/SSE、单 run、replay/conflict、manifest identity/SHA/bytes。Provider acceptance 仍为
`live_acceptance_pending`，人工 evidence/citation review `not_run`，因此不允许进入前端 execution UI。

### 阶段 3A Provider acceptance / 人工 review 准备（2026-10-18，历史记录）

`run_agent_harness_stage3_acceptance_prep.py` 只向仓外目录生成 redacted Provider acceptance manifest 和
evidence/citation review package；默认不调用 Provider、不创建 run、不触碰 5173。manifest/package identity、
revision、敏感字段拒绝和 accepted/completed hard gate 由 `agent_harness/acceptance_prep.py` 覆盖。当前状态保持
Provider `live_acceptance_pending`、capability probe `not_run`/`not_configured`、人工 review `not_run`，所以阶段
3A 仍 **NO-GO**，不得启动阶段 3B execution UI 或阶段 4。

### 2026-10-19 阶段 3 local-dev / 3B（已由阶段 5 扩展的历史记录）

本地个人使用路径通过独立 `local_dev` deployment manifest 完成 `LOCAL_ONLY_PASS`：manifest 由当前 TileSim
checkout、Bridge schema-set、生成客户端和 Windows MSVC CLI 自动生成，identity matching，且不覆盖旧的
`runtime/backend-current.json`。本地验证覆盖 AH3-F01–AH3-F26（26/26）、draft → validation → approval →
execution → `/api/runs` → result、artifact manifest identity、幂等 replay/conflict、SSE/polling replay 和显式
cancel/retry/resume 边界。所有输出固定为 `local_dev`、`synthetic_trace`、`exploratory`、`not_for_production`；
Provider 为 `provider_unavailable_for_local_dev`，生产 acceptance、成功 repetition 和独立生产 review 仍为
`production_acceptance_pending`。

Web 通过 `src/lib/api/agent-harness.ts` 和 `src/features/agent-harness/` 使用正式 WPC endpoint；所有写请求带
`Idempotency-Key`，结果在展示前校验 run/artifact 的 schema、SHA-256、bytes、Pointer 和 provenance。浏览器不创建
run、不以 localStorage/Pinia 保存 operation 真相，不自动重试 unknown outcome。生产阶段 4 的多工具自主循环、自动候选、
自动优化、无人值守批量实验和外部 MCP/A2A 继续保持关闭；本地 bounded optimization 见下节。生产 release-gate 仍应保持 `NO-GO`，即使本地 gate 为
`LOCAL_ONLY_PASS`。

### 2026-10-19 阶段 4 Local-Dev 受控优化（已由阶段 5 扩展的历史记录）

优化协调器使用 `2026-10-19.wpd.v1` 和独立 SQLite WAL store，仅接受显式
`local_dev=true` 的 session；每个 candidate 都要人工 approval，预算、迭代、运行、时间、失败次数和并发均有界。
结果固定标记 `local_dev` / `synthetic_trace` / `exploratory` / `not_for_production`，不会被报告为真实 Provider、硬件校准或生产 GO。
`unknown_outcome` 进入 `recovery_required`；恢复必须显式 acknowledgement 后创建新的 candidate/approval fence，不能原地盲重试。
生产自主优化、无人值守批量实验、MCP/A2A、shell、任意路径/URL和任意写工具均未开放。
