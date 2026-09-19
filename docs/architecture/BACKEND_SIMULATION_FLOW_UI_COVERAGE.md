# 后端仿真流程 × 前端专业工作台 展示覆盖度审计

**事实日期**：2026-09-17
**审计对象**：`D:\tileSim`（后端，只读，`main` = `ba11e6fd`）× `D:\tileSim-web`（前端，`HEAD` = `4d7f9fa`，工作树含未提交的 WP-2C-01a/01b 与 WP-2C-06）
**审计问题**：后端的输入、输出与中间过程，是否都已在前端专业工作台页面有所体现？有哪些需要前端补充？
**本文定位**：架构与数据流审计（`docs/README.md` 分类表中 `architecture/`）。本文**不**重述 Agent 编排的 Gap 登记（见 `../F9_AGENT_ORCHESTRATION/14_CONTRACT_GAP_REGISTER.md`），只处理「后端仿真流程 → 工作台展示」这一条链路。
**下游工作包**：本文 §6 是直接派发物，三个工作包已登记进
[`../F9_AGENT_ORCHESTRATION/24_PHASE2C_WORK_PACKAGE_PROMPTS.md`](../F9_AGENT_ORCHESTRATION/24_PHASE2C_WORK_PACKAGE_PROMPTS.md)
§8.1「并行独立轨道」。§6.1 `WP-2D-01`（C0，可立即派发）、§6.2 `WP-2D-02`（C1+C2，契约开窗批次）、
§6.3 `WP-2C-02a`（后端 issue serializer 补全，与 6.2 共享同一窗口）。

---

## 0. 结论摘要

- 后端一次 `TileSimCLI run` 是一个**十产出物 + 九段跨层契约链 + 十类中间状态机**的完整流水线；其中只有 **7 个报告**经 Bridge 到达前端。四个运行期工件（`runtime-event-trace` / `runtime-event-summary` / `runtime-request-summaries` / `runtime-analysis`）**根本没有被采集**。
- 已到达前端的 7 个报告里，**大量已有字段没有被任何页面渲染**。这些字段已被后端序列化、已随 artifact 经过 SHA-256 与 run-binding 校验、已在 `bundle` 内，只是 View 层未声明或未渲染。
- 因此缺口必须分成**四类成本**，不能混为一谈：

| 类别                   | 含义                                                                              | 是否触发契约变更                                                                                           | 可否立即开工         |
| ---------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------- |
| **C0 纯前端展示缺口**  | 字段已在 run bundle 内、后端已序列化、adapter 甚至已解析，仅 View 未渲染          | **否**（零 `bridge/contracts/**/*.json` 改动）                                                             | **是**               |
| **C1 Bridge 采集缺口** | 后端 CLI 有 `--*-out`，但 Bridge 未请求该工件 → 工件根本不存在                    | **是**（须改 `openapi.json` 的 `report_files` / `artifacts` 并重新生成生成物，`SCHEMA_SET_REVISION` 必变） | 否，需重新开契约窗口 |
| **C2 契约面缺口**      | Bridge 已发布 Schema 以 `additionalProperties: true` 兜底，字段的展示没有契约保障 | 需先扩 Schema，属契约窗口内工作                                                                            | 否                   |
| **C3 输入面缺口**      | 前端无编辑入口，需要新 UI +（多数还需要）新契约                                   | 多数需要                                                                                                   | 否                   |

- **本文给出的新工作包 `WP-2D-01` 只做 C0**：零契约成本、零 Bridge 改动、纯前端渲染补齐。它在窗口关闭期间是唯一不受该约束的推进方向，**已于 2026-09-18 交付并验收**（判定见 §6.1.1）；契约变更窗口**亦已于同日由指挥方显式重开**（见 §5.1、§6.2.1）。
- 本次审计**未修改任何** `bridge/contracts/**`、`.py`、后端仓库文件；`SCHEMA_SET_REVISION` 仍为 `sha256:d498092a…abffab`。
- **C1 不是一次「零风险补采集」**：`WindTunnel.cpp:6414-6419` 规定，请求了某 artifact 而其 state 为
  `unavailable` 时，`write_wind_tunnel_artifacts` 返回 false，`TileSimCLI.cpp:304-309` 随即 `exit 1`，
  **整条 run 判为失败**；而 `runtime_event_trace` 在 `--from S1` 下的 state 恰为
  `has_runtime_event_trace ? ready : unavailable`。因此 `WP-2D-02` 的第一步必须是只读探针，
  先确定「追加四个 `--runtime-*-out` 会不会把原本成功的 run 变成失败」，再决定实现方案（见 §6.2 步骤 0）。
- 三个工作包的分工与前置见 §6：`WP-2D-01`（C0，可立即派发）、`WP-2D-02`（C1+C2，契约开窗批次）、
  `WP-2C-02a`（后端 issue serializer 补全，与 `WP-2D-02` 共享同一窗口、文件集合不相交）。

---

## 1. 后端完整仿真流程

### 1.1 入口命令面（`src/apps/TileSimCLI.cpp`）

| 子命令                                       | 行号    | 作用                                                                                                                         | 是否只读                |
| -------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `run`                                        | 193-317 | 主仿真入口，产出 `WindTunnelRunResult` + 最多 10 个 artifact                                                                 | 写 `--*-out` 指定的文件 |
| `generate`                                   | 159-191 | 由 synthetic S0 输入生成 canonical trace，`--boundary S0..S5`                                                                | 写 `--out`              |
| `evidence-map`                               | 64-67   | 输出 S9 字段级证据映射（report_kind × field_path × source_object × computation_rule × validation_check × allowed_claim）     | 只读                    |
| `capabilities`                               | 100-103 | 输出运行时能力发现结果                                                                                                       | 只读                    |
| `paths`                                      | 105-124 | 输出过渡路径注册表（path_name / classification / preferred_entrypoint / allowed_for_default_execution / retirement_trigger） | 只读                    |
| `inspect-trace-package`                      | 126-136 | 校验并回读 trace package manifest                                                                                            | 只读                    |
| `validate-run-intake` / `run-intake-preview` | 138-157 | Run Intake v2 的 parse + lower 只读校验；**`exit 1` + stdout issues JSON 表示「判定为 blocked」，不是传输失败**              | 只读                    |
| `calibrate`                                  | 69-87   | 载入 calibration asset manifest 并跑校准工作流                                                                               | 只读                    |
| `orchestrate`                                | 89-98   | 跑 Agent 编排 intent 文件                                                                                                    | 只读                    |
| `--scenario <file>`                          | 319-344 | **兼容路径**：直接 Fabric scenario 执行（会打印 warning 指向 `run --from S1 --to S6`）                                       | 只读                    |
| `--layer S6`                                 | 346-361 | **兼容路径**：legacy S6 CLI                                                                                                  | 只读                    |

### 1.2 `run` 的完整输入面（`WindTunnelRunRequest`，`include/Core/WindTunnel.h:28-46`）

| 输入                  | CLI 开关                                                                   | 约束                                                |
| --------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| run 身份              | `--run-id`                                                                 | Bridge 服务端分配                                   |
| 执行模式              | `--mode dev\|real`                                                         | `ExecutionMode`                                     |
| 区间下界              | `--from S0..S5`                                                            | 与 trace package 的 `entry.boundary` 冲突即拒       |
| 区间上界              | `--to`                                                                     | Bridge 固定 `S6`                                    |
| trace 入口（二选一）  | `--trace <file>` / `--trace-package <manifest>`                            | 两者同时给出即拒                                    |
| 拓扑                  | `--topology <file>`                                                        | `Fabric::TopologySpec`                              |
| provenance 四元       | `--source-mode` / `--calibration-level` / `--claim-scope` / `--trace-kind` | 给出时必须与 manifest 一致                          |
| fidelity              | `--fidelity-policy`                                                        | 另有 `fallback_policy`（默认 `fail`）**CLI 未暴露** |
| 设计空间候选          | `--design-space-candidates <manifest>`                                     | 与 trace package 模式互斥                           |
| 产物开关              | 10 个 `--*-out`                                                            | 见 §1.3                                             |
| intent（orchestrate） | `--intent <file>`                                                          | 不属于 `run`                                        |
| 校准资产（calibrate） | `--calibration-assets <manifest>`                                          | 不属于 `run`                                        |
| Run Intake v2         | `--run-intake <json 文件路径>`                                             | 只接受文件路径，不接受内联 JSON                     |

### 1.3 十个规范产物（`WindTunnelArtifactRequest` / `WindTunnelArtifactOutput`）

| 产物               | CLI 开关                       | 内容主体                                                                                                                                                                                   |
| ------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 主运行报告         | `--out`                        | `wind_tunnel.run.v1alpha1`：status/cause/next_action/completeness + summary + resolved_fidelity_profile + multi_granularity_profile + bottleneck_report + partial_artifacts                |
| runtime 事件轨迹   | `--runtime-events-out`         | `S1RuntimeEventTrace`（逐事件：kind/request_id/batch_id/event_time_ps/logical_step/kv_tokens/active_requests/batch_request_ids）                                                           |
| runtime 事件摘要   | `--runtime-summary-out`        | `S1RuntimeEventSummary`（11 类事件计数、reject_reason_counts、peak_active_requests、排序与反馈证据标志、背压策略建议/应用/live-window）                                                    |
| runtime 逐请求摘要 | `--runtime-requests-out`       | `map<request_id, S1RuntimeRequestSummary>`（arrival/admit/first_batch_issue/first_token/kv_handoff/completion 时间、batch_issue_count、decode_step_count、kv_grow_count、final_kv_tokens） |
| runtime 分析       | `--runtime-analysis-out`       | 运行期分析产物（Bridge 与前端**全仓 0 命中**）                                                                                                                                             |
| 指标报告           | `--metrics-report-out`         | `tilesim.metrics_report.v1`                                                                                                                                                                |
| 慢请求归因         | `--tail-report-out`            | `tilesim.tail_cause_chain_report.v1`                                                                                                                                                       |
| 执行信封           | `--execution-envelope-out`     | `tilesim.s7_execution_envelope.v1`                                                                                                                                                         |
| 验证报告           | `--validation-report-out`      | `tilesim.validation_report.v1`                                                                                                                                                             |
| 设计空间报告       | `--design-space-report-out`    | `tilesim.design_space_report.v1`                                                                                                                                                           |
| 运行绑定 DES 证据  | `--run-bound-des-evidence-out` | `tilesim.s7_run_bound_des_evidence.v1`（仅 `--fidelity-policy des` 追加）                                                                                                                  |

> Bridge 实际只请求 7 个（`bridge/services/execution.py:186-226`）。前四个运行期产物**从未被请求** → 见 §3.2 C1-1。

### 1.4 跨层规范契约链（`PlatformContractBundle`，`include/Core/PlatformContracts.h:113-172`）

后端把「中间过程」形式化为一串**可追溯身份对象**，这也是「中间过程」最应该被工作台呈现的骨架：

```text
RequestContract(request_id, model_id, arrival_time_ps)
  -> EngineDecisionContract(decision_id, decision_kind)
  -> ModelExecutionCallContract(call_id)
  -> ExecutionFragmentContract(fragment_id, partition_reference, dependency_fragment_ids)
  -> ResourceOperationContract(operation_id, resource_kind, bytes)
  -> CommunicationDemandContract(demand_id, source/destination_endpoint, bytes)
  -> SimulationEventContract(event_id, subject_id, event_kind, event_time_ps, dependency_event_ids)
  -> RunConfigurationContract(run_id, time_unit=ps, byte_unit=byte)
  -> SimulationResultContract(run_id, result, output_artifact_ids)
```

每个契约对象都带统一 `ContractHeader`：`schema_version` / `contract_kind` / `object_id` / `source_mode` / `gpu_participation_mode` / `fidelity_tier` / `evidence_grade`。

**状态所有权**（`canonical_state_ownership()`，`PlatformContracts.h:188-189`）把 9 个 `TargetStateDomain` 唯一映射到 8 个 `StateOwner`（RequestQueue→InferenceRuntime、LogicalCachePolicy→InferenceRuntime、PhysicalCacheResidency→KvCacheModel、ExecutionProgress→ExecutionSemantics、DeviceResources→DevicePerformanceModel、CollectiveProgress→CollectiveSemantics、NetworkResources→NetworkHardwareResources、GlobalTimeline→SimulationKernel、MetricsAndAttribution→CalibrationValidationAttribution）。**这张所有权表在前端毫无痕迹**，而它正是「谁负责哪块状态」的权威口径。

### 1.5 中间过程对象清单（按模块）

| 模块                       | 权威类型（文件）                                                                                                                                             | 关键中间对象                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 工作负载抽象与负载描述语言 | `S0_Workload/WorkloadDescription.h`                                                                                                                          | `TaskScenarioVariables`（scenario_kind/arrival_process/request_count/prompt·decode token 上下界/measurement 窗口/burst_size/tenant_ids）、`SystemStructureVariables`（model_id/engine_type+semantic_version/device·endpoint·network_domain ids/device_to_endpoint/TP·PP·EP/moe_expert_count/experts_per_token/kv_capacity_tokens）、`ExecutionProcessVariables`（continuous_batching/max_active_requests/max_batch_size/chunked_prefill_tokens/tile_partition_reference/communication_domain_id/moe_routing_mode/offline_routing_source/stages[]）、三类约束族 `ConstraintFamily` + `ConstraintViolation`、**`FieldSource`（field_path + production_mode ∈ {FixedConfig, ReplayFact, DynamicDecision, Derived} + source_reference）**、`WorkloadEvidence`、`FrozenWorkloadConfiguration`（canonical_summary + fingerprint） |
| 推理引擎与服务运行时       | `S1_Runtime/RuntimePolicy.h`、`EngineSemanticProfile.h`、`SimulationTypes.h:311-435`                                                                         | `S1RuntimePolicyConfig`（18 个策略旋钮，含 kv_page_size_tokens/kv_fragmentation_overhead/kv_admission_watermark/fabric_backpressure_* 5 项/prefill_decode_separation）、`EngineSemanticProfile`（decision_triggers/owned_state/ordered_decisions/tie_breaking_rules/cache_interactions/output_contracts/supported_features/**unsupported_features**）、`S1RuntimeEvent`（10 类 `RuntimeEventKind`）、`S1RuntimeEventSummary`、`S1RuntimeRequestSummary`                                                                                                                                                                                                                                                                                                                                                                     |
| 执行语义建模               | `S2_Execution/ExecutionFragmentBuilder.h`、`KernelCompilerLayer.h`                                                                                           | `TilePartitionDescription`（partition_reference + `PartitionSourceKind` ∈ {CompilerDerived, Generated} + slices[]）、`ExecutionFragment`（fragment_id/model_execution_call_id/partition_reference/local_partition_id/operation_kind/**modeling_granularity=tile**/data_begin·end_token/dependency_fragment_ids/expert_assignments/completion_condition）、`OnlineRoutingResolution`、`S2Kernel`（kernel_id/backend/fusion_group_id/launch_stream_id/input_shapes/**tile_shape**/pipeline_stages/num_warps/estimated_latency_us/collectives[]）                                                                                                                                                                                                                                                                              |
| KV Cache 建模              | `S3_Memory/KVCacheStateMachine.h`                                                                                                                            | `KVCacheStateMachineConfig`（capacity_bytes/page_size_bytes/pressure_threshold/enable_eviction）、`KVPhysicalPage`（page_id/content_key/**residency_pool**/content_offset_bytes/valid_bytes/ready_time_ps/last_access_sequence/reference_count）、`KVCacheStepResult`（operations/network_demands/feedback/**evicted_page_ids**/prefix_reused）、`ResourceInvariantReport`                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 设备性能建模               | `S4_Device/DeviceResourceStateMachine.h`、`TileLangSemantics.h`、`GpuParticipation.h`                                                                        | `S4DeviceTraceTask`（device_profile/stream_id/occupancy_ratio/contention_delay_us）、`S4DeviceTaskSummary`、`GpuParticipationExecutionResult`（mode/**commit_state ∈ {NoPhysicalExecution, PhysicalExecutionCommitted, PartiallyCommitted, FullyCommitted}**/retry_safe/communication_demand_emitted/**independent_observation_evidence**）、`GpuExecutionReceipt`                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 集合通信语义               | `S5_Collective/CollectiveStateMachine.h`、`SimulationTypes.h:437-470`                                                                                        | `S5CollectiveTracePhase`（collective_id/collective_type/domain_id/module_binding/participants/dependency_phase_id/parallelism_kind/tp_degree/dependency_kind）、`S5CollectivePhaseSummary`（allgather/allreduce/dependency_linked/multi_participant 计数）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 网络与硬件资源             | `S6_Fabric/ModularFabric.h`                                                                                                                                  | `ModuleStats`（per-module total_bytes/queue_delay/congestion_delay/runtime/transfers_executed/algorithm_rounds/**hotspots[]**）、`ExecutionRecord`（含 `actual_path[]`、`execution_events[]`（10 类 `FabricEventKind`）、**retransmission_count**、**flow_control_stall_count**、serialization_delay_ps、service_busy_time_ps）、`TransferResult`、`HotspotTicket`、`FidelityController::{select,escalate,fallback}_module`、`fallback_reasons[]`                                                                                                                                                                                                                                                                                                                                                                           |
| 统一仿真内核               | `Core/UnifiedSimulationEventIngress.h`、`DeterministicDesKernel.h`、`PartitionedDesKernel.h`、`PartitionedDesCheckpointArchive.h`、`StableBoundaryDesHost.h` | `SimulationEventIngressRecord`（boundary ∈ {Request, InferenceEngineState, ModelExecutionCall, ExecutionFragment, ResourceOperation, CommunicationDemand} + origin ∈ 6 类）、`DesCheckpoint`、`PartitionedDesStateSummary`、`PartitionedDesDifferential`、`PartitionedDesStreamRecord`（window_start/end_ps + committed_event_count + committed_event_digest）                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 资源语义汇合与反馈         | `Core/ResourceConvergence.h`、`ResourceSemanticTypes.h`、`ResourceSemanticOperationContracts.h`                                                              | `ResourceConvergenceReport`（collective_phase_count/pd_handoff_event_count/converged_request_count/**issues[]**）、`ResourceOperationRecord`（contract/owner/operation_kind/state/start·completion_time_ps/dependency_operation_ids/**attributes map**）、`NetworkDemandRecord`（source_module/earliest_ready_time_ps/order_domain/synchronization_scope/completion_condition/dependency_demand_ids）、**`ResourceFeedback`（6 类 kind：OperationCompleted/KvPressureChanged/DataReady/PdHandoffReady/CollectiveCompleted/ModelExecutionCallCompleted）**                                                                                                                                                                                                                                                                   |
| Cycle 细化                 | `Core/CycleRefinementContracts.h`                                                                                                                            | `CycleBoundaryState`（VC 数/队列容量/队列占用/credit/in-flight/round_robin_next_vc/link_pipeline_stages/occupancy/receive_buffer/downstream_remaining_service_cycles/structural_state_hash/**recoverability ∈ {Exact, Bounded, Unrecoverable}**/sensitivity_variant_count）、`CycleWindowRequest`（clock_period_ps/warm_up·measurement·drain cycles/timeout/capture_waveform）、`CycleObservables`（arbitration_grant_count/link_active_cycles/credits_consumed/returned/**flow_control_stall_cycles**/completion_cycles）、`CycleSensitivityRange`、`CycleRefinementCandidate`                                                                                                                                                                                                                                             |
| 校准验证与指标归因         | `S8_Validation/CalibrationWorkflow.h`、`HardwareValidationLayer.h`、`LayerAdapters.h:209-265`                                                                | `CalibrationAsset`（purpose ∈ {Calibration, HeldOutValidation} + kind ∈ {OfflineFixture, RealMeasurement} + operating_region + relative_error_budget + observations[]）、`CalibrationScopeReport`（selected_model{kind,slope,intercept,selection_mae}/held_out_mae/held_out_p95·max_relative_error/error_budget_passed）、`ValidationReport`（**error_budget[]** `LayerErrorBudgetEntry{metric_id,subsystem,observed_value,expected_value,absolute_error,tolerance,unit,status}`、benchmark_manifests、calibration_inputs、open_gaps、des_contract_*）、`ReportFieldEvidenceRule`                                                                                                                                                                                                                                           |
| 场景与探索编排             | `Core/CandidateExploration.h`                                                                                                                                | `CandidateSpaceSpecification`（variables[]/hard_constraints[]/derived_variables[]/generation_budget）、`GeneratedCandidate`（values/derived_values/canonical_digest）、`CandidateRunInstance`（fidelity/input_digest/**三个 `CandidateDeterministicBounds` {point,lower,upper}**/state_schema/state_digests/stop_reason）、`CandidateExecutionRecord`（analytical_run/des_run/**first_state_divergence_index**/unresolved_relationships）、`CandidatePromotionPolicy`（top_k/slo_p99_limit_us/slo_boundary_fraction/uncertainty_threshold/max_execution_transfers）                                                                                                                                                                                                                                                         |
| GPU 参与契约               | `Core/GpuParticipationContracts.h`                                                                                                                           | `GpuEnvironmentManifest`、`GpuTaskFragment`、`GpuExecutionReceipt`、`GpuNetworkObservation`、`GpuCommunicationDemandBatch`、两类 sink 接口（`IGpuCommunicationDemandSink` / `IGpuObservationEvidenceSink`）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### 1.6 执行期可观测性

- Bridge 的 `GET /api/runs/{id}/events`（`bridge/server.py:1124-1172`）只发 **3 种事件**：`run`（id=1 运行中 / id=2 终态）+ heartbeat + `timeout`。**没有任何 S0–S6 阶段级进度事件**。
- 后端 `run` 是一次阻塞式 subprocess（`bridge/services/execution.py:181-226`），全部 artifact 在进程结束后一次性落盘。
- 结论：**「中间过程」在时间维度上不可观测**；工作台只能事后展示静态报告，无法展示阶段推进、事件流或资源时序进度。这是结构性限制，不是渲染遗漏。

---

## 2. 前端展示面现状

见附录 A 的逐页清单。要点：

| 页面                             | 数据来源                                                                     | 覆盖的报告                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview                         | run + metrics                                                                | summary、bottleneck_report、fabric_domain_utilization（前 6 条）                                                                               |
| Execution                        | run + metrics + validation + tail + execution_envelope + input-runtime-trace | S0–S6 层卡片、stage 时间轴、layer record 表、6 类图表                                                                                          |
| Metrics                          | metrics                                                                      | summary、tail_latency_summary、request_metrics、1 张 latency bar                                                                               |
| Fabric                           | metrics.system_summary + input-topology + manifest                           | 背压/利用率/主导域、逐域表、逐请求表、拓扑卡、2 张 stacked-bar                                                                                 |
| Attribution                      | tail + run_bound_des_evidence                                                | 归因排序/审计/原因链、周八证据面板、1 张 bar                                                                                                   |
| Validation                       | validation + evidenceSummary                                                 | provenance 四卡、open_gaps、resolution 矩阵、checks                                                                                            |
| DesignSpace                      | design_space + manifest                                                      | 排名表、候选详情、objectives、executed_s6_knobs、scatter                                                                                       |
| History                          | `GET /runs` + 对比                                                           | digest 2 指标 + 7 项 policy + 逐请求 diff                                                                                                      |
| Experiment                       | descriptor 端点 + `POST /runs`                                               | scenario_id/fidelity_policy/gpu_participation_mode/run_name + 7 个 overrides 指针 + custom_inputs + trace_package_id + design_space_candidates |
| Week7Evidence（`/evidence-lab`） | `/week7/{evidence-map,calibration-example,orchestration-example}`            | S8 校准 fixture、S9 字段证据映射、确定性编排示例（**离线 fixture，不绑定当前 run**）                                                           |
| EvidenceAgent                    | `/agent/evidence-capabilities` + `POST /runs/{id}/agent/evidence-analyses`   | run 内引用、claim/citation、引用校验                                                                                                           |
| UnsupportedSchema                | bundle.unsupported                                                           | **未在 router 注册**，只能被嵌入                                                                                                               |

---

## 3. 覆盖度判定

### 3.1 C0 —— 纯前端展示缺口（数据已在 bundle 内，零契约成本）

> **状态：已关闭（2026-09-18 验收）。** `WP-2D-01` 已按本节清单落地并经指挥方独立复验通过，判定记录见 §6.1 末尾。
> 下表「前端现状」列保留的是**审计当时**（2026-09-17）的事实陈述，用作范围证据，**不代表当前代码状态**；
> 当前实现入口为 `src/features/report-coverage/`（公共出口 `index.ts`）。

以下每一项均已确认：字段由后端序列化（给出 `D:\tileSim` 出处），且已随 artifact 校验后进入 `bundle`；前端**全仓 0 命中**（`src/**/*.{ts,vue}`，排除 `generated/`）。

#### C0-1 主运行报告 `run-result.json` → `bundle.run`

| #   | 字段                                                                                                                                                                                                 | 后端序列化出处                                                            | 前端现状                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | `partial_artifacts[]`（artifact_id/state/evidence_requirement/absence_reason/detail/payload_json）                                                                                                   | `WindTunnel.cpp:5856`                                                     | 0 命中。**「哪些产物没做、为什么没做」完全不可见**                                                |
| 2   | `multi_granularity_profile.capability_registry`（entries: analytical/des/cycle_capability + **des_contract_role** + **des_required_for_host_contract**）                                             | `WindTunnel.cpp:5520-5523`                                                | 0 命中（`capability_registry` 在前端 0 命中）                                                     |
| 3   | `multi_granularity_profile.{des_completion_state,des_contract_state,des_required_subsystem_count,des_satisfied_subsystem_count,des_contract_gaps[],requested_tier_state,unsupported_reason,summary}` | `WindTunnel.h:254-269`                                                    | report-model 只声明 `ImplementationEntry`，上述聚合字段未声明                                     |
| 4   | `bottleneck_report.supporting_artifacts[]`                                                                                                                                                           | `WindTunnel.cpp:5575-5580`                                                | 0 命中（`supporting_artifacts` 前端 0 命中）                                                      |
| 5   | `resolved_fidelity_profile.{has_downgrades,has_fallbacks,has_not_covered,has_expected_absence,claim_scope_summary}`                                                                                  | `WindTunnel.h:76-84`                                                      | 4 个 `has_*` 前端 0 命中                                                                          |
| 6   | `resolved_fidelity_profile.entries[]` 的 `state` / `downgraded` / `fallback` / `not_covered` / `expected_absence` / `claim_scope_impact`                                                             | `WindTunnel.h:62-74`                                                      | `claim_scope_impact` 0 命中；`downgraded` 仅出现在 i18n 词表                                      |
| 7   | `summary.{preferred_entrypoint,host_path,execution_path,has_tail_attribution}`                                                                                                                       | `WindTunnel.h:48-60`                                                      | adapter 已产出（`dashboard-view-model.ts`）但 OverviewView 从未引用                               |
| 7b  | `next_action`（run 顶层裁决字段，与 `cause` 同级；后端在此写明「下一步该做什么」）                                                                                                                   | `WindTunnel.h:284`、`WindTunnel.cpp:5845-5846`（取值构造见 `:6315-6362`） | `report-model.ts` **0 命中**、`OverviewView.vue` **0 命中**（`cause` 已渲染，故这是同层唯一遗漏） |

#### C0-2 指标报告 `metrics.json` → `bundle.metrics`

| #   | 字段                                                                                                                                                                                                                                            | 后端序列化出处                  | 前端现状                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------- |
| 8   | `ttft_ps` / `tpot_ps` / `end_to_end_latency_ps` 三个 `MetricDistributionSummary`（sample_count/p50_ps/p95_ps/p99_ps/**max_ps**）                                                                                                                | `SimulationTypes.cpp:2073`      | 4 个键名 0 命中。**p50 与 max 完全不可见**                                          |
| 9   | `observation_window`（observation_start_time_ps / observation_end_time_ps）                                                                                                                                                                     | `SimulationTypes.cpp:2062`      | 仅导出报告使用，页面未渲染                                                          |
| 10  | `boundary_notes[]`                                                                                                                                                                                                                              | `SimulationTypes.cpp:2224-2229` | 0 命中。**后端明确写下的边界说明（如「观测窗口为 0，吞吐按 0 报告」）在 UI 里丢失** |
| 11  | `has_resource_boundary_evidence` + `resource_boundary_evidence`（source_subsystem/trace_kind/evidence_count/total_bytes/peak_bytes/total·max_estimated_latency_us/dominant_evidence_id/dominant_operation/dominant_profile）                    | `SimulationTypes.h:704-715`     | `resource_boundary_evidence` 0 命中                                                 |
| 12  | `system_summary.pd_disaggregation`（PD 分离：handoff_record_count/handoff_busy_time_ps/handoff_latency·queue·congestion_us/handoff_ready_event_count/**decode_wait_for_handoff_ps**/**decode_wait_after_handoff_ps**/max_* 及 6 个 dominant_*） | `SimulationTypes.cpp:2117-2118` | `pd_disaggregation` 前端 0 命中                                                     |
| 13  | `rejected_request_count`                                                                                                                                                                                                                        | `SimulationTypes.h:746`         | 仅导出报告；Metrics 页请求表与摘要缺失                                              |
| 14  | `request_metrics[].{arrival_time_ps,first_token_time_ps,completion_time_ps,batch_issue_count,has_ttft_sample,has_tpot_sample,has_end_to_end_latency_sample}`                                                                                    | `SimulationTypes.h:562-577`     | 只列 request_id/status/ttft/tpot/e2e/decode_step_count                              |
| 15  | `percentile_subjects` 中 `percentile ∈ {50, 95}` 的条目                                                                                                                                                                                         | `SimulationTypes.cpp:1801`      | 被 `percentile-navigation.ts:106` 过滤，页面只显示 P99                              |
| 16  | `resolution_entries[]` + `resolution_has_{downgrades,fallbacks,not_covered,expected_absence}` + 4 个 `resolution_*_count` + `resolution_dominant_{resolution,subsystem,detail,claim_scope_summary}`                                             | `SimulationTypes.h:760-779`     | `resolution_dominant_*` 与 4 个 `has_*` 前端 0 命中                                 |
| 17  | `metric_scope` / `capability_registry_version` / `capability_registry_entry_count` / `des_required_capability_count`                                                                                                                            | `SimulationTypes.h:737,763-765` | 0 命中                                                                              |
| 18  | `system_summary.{has_fabric_timeline,fabric_busy_time_ps}`                                                                                                                                                                                      | `SimulationTypes.cpp:2078-2081` | `has_fabric_timeline` 0 命中                                                        |

#### C0-3 验证报告 `validation.json` → `bundle.validation`

| #   | 字段                                                                                                                                | 后端序列化出处                    | 前端现状                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 19  | `error_budget[]`（`LayerErrorBudgetEntry`：metric_id/subsystem/observed_value/expected_value/absolute_error/tolerance/unit/status） | `WindTunnel.cpp:2997-2999`        | 0 命中（`Week7EvidenceView` 里的 `error_budget` 是 calibration 的 `relative_error_budget`，不是本字段） |
| 20  | `validation_scope` / `baseline_package_id` / `benchmark_manifests[]` / `calibration_inputs[]`                                       | `LayerAdapters.h:235,240,262-263` | 全部 0 命中                                                                                             |
| 21  | `des_contract_state` / `des_required_subsystem_count` / `des_satisfied_subsystem_count` / `des_contract_gaps[]`                     | `LayerAdapters.h:241-244`         | 全部 0 命中                                                                                             |
| 22  | `resolution_dominant_*` + 4 个 `resolution_has_*` + 4 个计数                                                                        | `LayerAdapters.h:245-257`         | 0 命中                                                                                                  |
| 23  | `evidence_tier` / `validation_lane`                                                                                                 | `LayerAdapters.h:236-237`         | 已算出（`lib/reports.ts:127-139`）但 ValidationView 未渲染                                              |
| 24  | `trace_provenance.{source_id,generation_path,capture_or_generation_time,upstream_tooling,notes}`                                    | `SimulationTypes.h:94-104`        | `generation_path`/`upstream_tooling`/`capture_or_generation_time` 0 命中                                |
| 25  | `checks[].{subject_refs,evidence_refs}`、`resolution_entries[].{subject_refs,evidence_refs}`                                        | `LayerAdapters.h:209-216`         | 未作为可导航引用渲染                                                                                    |

#### C0-4 慢请求归因 `tail-cause-chain.json` → `bundle.tail`

| #   | 字段                                                                                          | 后端序列化出处                  | 前端现状                                                                                                  |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 26  | `symptom` / `explained_entity_kind` / `observation_start_time_ps` / `observation_end_time_ps` | `SimulationTypes.h:539-543`     | `symptom`、`observation_*` 前端 0 命中                                                                    |
| 27  | `contributing_factors[]`（subsystem/factor_code/detail/score）                                | `SimulationTypes.cpp:1972-1974` | `contributing_factors` 前端 0 命中。**「贡献因子」是与 `attribution_ranking` 不同的一层证据，被整体丢弃** |
| 28  | `validation_links[]` / `metric_evidence_links[]` / `resource_evidence_links[]`                | `SimulationTypes.h:556-558`     | 3 个键 0 命中                                                                                             |
| 29  | `unresolved_gaps[]`                                                                           | `SimulationTypes.h:559`         | 0 命中                                                                                                    |

#### C0-5 执行信封 `execution-envelope.json` → `bundle.execution_envelope`

| #   | 字段                                                                                                                                           | 后端序列化出处            | 前端现状                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------- |
| 30  | `notes[]`                                                                                                                                      | `LayerAdapters.h:206`     | 0 命中                                                                      |
| 31  | `envelope_id` / `trace_name` / `start_time_ps` / `end_time_ps` / `has_runtime_event_trace` / `has_tail_cause_chain_report` / `evidence_refs[]` | `LayerAdapters.h:191-205` | `has_runtime_event_trace` 0 命中；`envelope_id`/`trace_name` 仅导出报告使用 |
| 32  | `stages[].{subject_refs,evidence_refs}`                                                                                                        | `LayerAdapters.h:178-187` | 未渲染为可导航引用                                                          |

#### C0-6 运行绑定 DES 证据 `week8-run-evidence.json` → `bundle.run_bound_des_evidence`

| #   | 字段                                                                                                                                                                                                                       | 后端序列化出处                 | 前端现状                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------- |
| 33  | `state_summary`（logical_time_ps/partition_count/synchronization_window_count/committed_event_count/pending_event_count/committed_event_digest/validation_lane/claim_scope/stream_record_count/total_stream_record_count） | `PartitionedDesKernel.h:47-61` | `state_summary` 未渲染（面板只渲染 checkpoint 的计数）                                      |
| 34  | `stream_records[]`（window_start·end_ps / partition_id / committed_event_count / committed_event_digest）                                                                                                                  | `PartitionedDesKernel.h:39-45` | 面板只渲染 `record_count / total_record_count / truncated` 三个聚合值，**逐窗口明细不可见** |
| 35  | `provenance.{calibration_level,allowed_claim_scope,trace_kind,...}`                                                                                                                                                        | `WindTunnel.h:320-333`         | 面板只渲染 `sourceMode`                                                                     |

#### C0-7 展示状态语义

| #   | 问题                                                                                                     | 证据                                                                                     | 期望                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 36  | Overview 与 Metrics 页把 `SourcedValue.availability` 压成两态（`available` / 其余一律 `—` 或「不适用」） | `dashboard-view-model.ts:3-13` 定义了 5 态；`OverviewView` / `MetricsView` 只读 `.value` | 恢复 `available / expected_absence / not_covered / missing / unsupported_schema` 五态，并与 `report-registry` 的 compatibility 状态对齐 |

### 3.2 C1 —— Bridge 采集缺口（需重新开契约窗口）

| #    | 缺口                                                                                                                                                                                                                                                                                                                                                                                 | 证据                                                                                                                 | 后果                                                                                                                                                                                                                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1-1 | **四个运行期工件从未被采集**：`--runtime-events-out` / `--runtime-summary-out` / `--runtime-requests-out` / `--runtime-analysis-out`                                                                                                                                                                                                                                                 | `bridge/services/execution.py:186-226` 只列 7 个 `--*-out`                                                           | 前端无法拿到真实的 `S1RuntimeEventTrace` / `S1RuntimeEventSummary` / 逐请求 `S1RuntimeRequestSummary` / runtime 分析产物。Execution 页的 S1 记录只能由 `input-runtime-trace.requests × metrics.request_metrics` 做**显示级 join**，不是运行期真实事件流                                                                       |
| C1-2 | 上述补齐需修改 `bridge/contracts/openapi.json` 的 `x-tilesim-contract.report_files`（37-45）、`known_report_schema_identities`（27-36）、`artifacts`（46+，10 个条目）+ `bridge/contracts/schemas/*` + 生成物 + `src/lib/api/artifacts.ts:50-102`                                                                                                                                    | 同上                                                                                                                 | **`SCHEMA_SET_REVISION` 必然变化**。当前契约窗口已按 WP-2C-01b 的裁决关闭，须由指挥方显式重新授权                                                                                                                                                                                                                             |
| C1-3 | `run` 报告本身无法携带运行期事件（`S7ExecutionEnvelope.has_runtime_event_trace` 目前恒为 false 的成因）                                                                                                                                                                                                                                                                              | `LayerAdapters.h:202`                                                                                                | 即使不新增 artifact，也可先**如实展示** `has_runtime_event_trace=false`（属 C0-5）                                                                                                                                                                                                                                            |
| C1-4 | **C1 会改变 run 的终态语义，不是单纯的「多采集一个文件」**：后端规定只要请求了某 artifact 而其 state 既非 `ready` 也非 `expected_absence`，工件写入即失败并让 CLI 以 `exit 1` 结束；`runtime_event_trace` 的 state 恰为 `has_runtime_event_trace ? ready : (expects_runtime_trace ? unavailable : expected_absence)`，而 `expects_runtime_trace` 在 Bridge 当前的 `--from S1` 下为真 | `D:\tileSim\src\Core\WindTunnel.cpp:276-278`、`6194-6207`、`6404-6419`；`D:\tileSim\src\apps\TileSimCLI.cpp:304-309` | 若在 runtime 不可用的情况下无条件追加四个 `--runtime-*-out`，原本成功的 run 会变成 `exit 1` 的失败 run。**必须先做只读探针**再决定实现方案（见 §6.2 步骤 0）                                                                                                                                                                  |
| C1-5 | **artifact 描述符 ≠ artifact 数据**：state 为 `expected_absence` 时，写入目标文件的是 artifact 描述符 JSON（无 payload），只有 `ready` 才写真实工件数据                                                                                                                                                                                                                              | `D:\tileSim\src\Core\WindTunnel.cpp:6404-6412`、`6421`                                                               | Bridge 与前端必须能区分「描述符」与「真实工件」；不得把描述符当数据渲染，也不得把无 payload 的文件判为损坏报告                                                                                                                                                                                                                |
| C1-6 | **四个运行期工件无法声明 run 绑定**：其序列化器不写 `schema_version`，也不写 `run_id`                                                                                                                                                                                                                                                                                                | `D:\tileSim\src\Core\WindTunnel.cpp:728+`                                                                            | 不能照抄 `metrics` 的 `run_id_pointer: "/run_id"`——那会让 run-binding 校验必然失败。默认路线是按 `report_kind: null` 的输入型 artifact 登记（不声明 `schema_identities` / `run_id_pointer`，依 `bridge/repositories/runs.py:519-536` 落到 `contract_status = "not_applicable"`）；若要取得契约保障，需后端先补序列化器 header |

### 3.3 C2 —— 契约面缺口

| #    | 缺口                                                                                                                                                                                   | 证据                                                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| C2-1 | Bridge 报告 Schema 是**窄契约**：`metrics-report` 只 `required: [schema_version, run_id, request_metrics, percentile_subjects, system_summary]`，其余全靠 `additionalProperties: true` | `bridge/contracts/schemas/metrics-report.schema.json:7-8` |
| C2-2 | 同理：`validation-report` 只要求 `checks`；`tail-cause-chain-report` 只要求 `cause_chain` + `attribution_ranking`；`execution-envelope` 只要求 `evidence_refs` + `stages`              | 同名 schema 的 `required`                                 |
| C2-3 | 前端实际门禁是 `report-registry.ts` 的 `f6bShapeIssues()`（逐 kind 强制若干数组与无损整数），**不是** JSON Schema                                                                      | `src/adapters/report-registry.ts:68-124`                  |
| C2-4 | 结论：C0 的提升是「把 `additionalProperties` 里的事实提升为一等展示对象」；若要让它们获得契约保障，应同步把相应字段写进 Bridge 报告 Schema（属契约窗口工作）                           |

### 3.4 C3 —— 输入面缺口

| #     | 缺口                                                                                                                                                                                                                                                                                                                                                                   | 证据                                                                                                                |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| C3-1  | **Run Intake v2 全部字段无编辑入口**：profile_binding（model/engine/device/topology/workload/fidelity）、`device_count`、`parallelism.{tensor,pipeline,expert}`、`placement`、`kv_cache`、`collective_policy`、`workload.allowed_overrides[]`、`topology_network_binding`、`requested_fidelity`、`trace_source.{mode,reference,allowed_claim_scope}`、`slos`、`budget` | `bridge/contracts/agent_orchestration_phase2/schemas/run-intake.schema.json:27-166`；`src/**` 中这些键的读写 0 命中 |
| C3-2  | 前端 `previewAgentRunIntake` 客户端方法已生成但**全应用 0 调用点**                                                                                                                                                                                                                                                                                                     | `src/contracts/generated/bridge-client.ts:106-110`                                                                  |
| C3-3  | provenance 四元（`--source-mode` / `--calibration-level` / `--claim-scope` / `--trace-kind`）无入口；trace package 的 provenance 仅只读展示                                                                                                                                                                                                                            | `src/features/run-experiment/TracePackageInputPanel.vue:108-142`                                                    |
| C3-4  | `--mode dev\|real` 无入口（Bridge 硬编码 `dev`）；`--from`/`--to` 固定 `S1`/`S6`（`bridge/server.py:103-104`）                                                                                                                                                                                                                                                         | `execution.py:186-191,196-198`                                                                                      |
| C3-5  | **工作负载描述语言完全不可见**：`TaskScenarioVariables` / `SystemStructureVariables` / `ExecutionProcessVariables` / 三类约束族 / `FieldSource` 生产模式 / `FrozenWorkloadConfiguration.fingerprint`                                                                                                                                                                   | `include/S0_Workload/WorkloadDescription.h`；前端 0 命中                                                            |
| C3-6  | 拓扑只作为自由 JSON 文本输入，`TopologySpec` 的结构（devices/links/domains/module_bindings/routing_policies/transport_policies/calibration_profiles）不可视                                                                                                                                                                                                            | `ModularFabric.h:58-67`；`src/features/run-experiment/ExperimentInputPanel.vue:154-169`                             |
| C3-7  | 引擎语义画像（`EngineSemanticProfile`，含 `unsupported_features`）不可见                                                                                                                                                                                                                                                                                               | `S1_Runtime/EngineSemanticProfile.h:14-26`                                                                          |
| C3-8  | GPU 参与只剩一个 `gpu_free` 枚举；`GpuParticipationExecutionResult` 的 commit_state / 独立观测证据 / receipt 无展示面                                                                                                                                                                                                                                                  | `bridge/contracts/schemas/create-run-request.schema.json:19-22`；`GpuParticipationContracts.h`                      |
| C3-9  | Cycle 窗口无请求入口（只有 capability 的 verilator_cycle 可用性与「网页尚未开放显式窗口请求」文案）                                                                                                                                                                                                                                                                    | `ExperimentCapabilityPanel.vue:60-70,79-84`；`CycleRefinementContracts.h`                                           |
| C3-10 | 每 run 的校准不可触发：`calibrate` 只出现在 Week7Evidence 的固定 fixture，`--calibration-assets` 在 `run` 语境无入口                                                                                                                                                                                                                                                   | `bridge/services/week7.py:34-42`；`Week7EvidenceView.vue`                                                           |
| C3-11 | `orchestrate` 的 intent 无入口（`AgentOrchestrationReport`：intent_id/run_instance_id/frozen_configuration_digest/tool_calls[]/artifact_results[]）                                                                                                                                                                                                                    | `bridge/services/week7.py:43-51`；同上                                                                              |

### 3.5 已覆盖但需注意的部分（避免误判为缺口）

| 项                                                                                                       | 说明                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S9 字段级证据映射 `ReportFieldEvidenceRule`                                                              | 已由 `/week7/evidence-map` + `Week7EvidenceView` 覆盖，但它是**离线固定示例**，不与当前 run 绑定                                                                      |
| S8 校准工作流 `CalibrationWorkflowReport`（scopes/selected_model/held_out_*）                            | 同上，已覆盖但为 fixture；真实 per-run 校准仍 unavailable                                                                                                             |
| `run_bound_des_evidence` 的 fallback / differential / checkpoint                                         | 已渲染（`RunBoundEvidencePanel.vue:246-308`），缺的只是 `state_summary`、逐窗口 `stream_records` 与完整 provenance                                                    |
| `resource_convergence` 的 4 个计数                                                                       | Execution 页已渲染；缺的是 `issues[]`                                                                                                                                 |
| `design_space` 的 `analytical_vs_des_disagreements`、`objectives[]`、`executed_s6_knobs[]`、`navigation` | 已渲染                                                                                                                                                                |
| `fabric_domain_utilization` / `request_fabric_contributions` / `phase_fabric_contributions`              | 已渲染；`ExecutionRecord.execution_events[]` / `actual_path` / `retransmission_count` 等**更细一层**未渲染，但那些不在 artifact 里（属 S7 内存态）→ 归 C1/C2，不在 C0 |

---

## 4. 缺口分级与优先级

| 优先级 | 类别                     | 内容                                                                                                                                           | 工作包与前置                                                                                                                                                                   |
| ------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P0** | C0（36 项 + 第 7b 条）   | 已在手的字段补齐渲染；恢复五态 availability 语义                                                                                               | `WP-2D-01`（§6.1）。无前置。**已交付并验收（2026-09-18），判定见 §6.1**                                                                                                        |
| **P0** | 缺陷 `DEF-BUSY-RACE-001` | `src/store/dashboard.ts:103-137` 的 busy 泄漏竞态：被取代的 run-evidence 同步不再清零 `state.busy`，`.global-busy` 常驻，使全量 e2e 长期不可用 | `WP-2D-04` A 部（§6.4）。无前置                                                                                                                                                | **已交付并验收（2026-09-18），缺陷关闭；全量 e2e 恢复可用**      |
| P1     | 残留（五态语义）         | 行级 `cell()` 不使用五态解析器；`LayerRecordTable` 与导出 HTML 用「不适用」二元回退；`f7-analysis` 契约本身只有布尔                            | `WP-2D-04` B 部（§6.4）。无前置                                                                                                                                                | **已交付并验收：B-1/B-2/B-3 关闭，B-4 判定无需修改（复核成立）** |
| P1     | 残留（导出状态列）       | 导出 HTML 的记录状态列未走屏幕同规则：未报告出 `—` / `unknown`，已报告出裸 token（屏幕经 `statusLabel()` 译出）                                | `WP-2D-05`（§6.5）。无前置                                                                                                                                                     | **已交付并验收（2026-09-18），判定见 §6.5.1**                    |
| P1     | C1-1/C1-2                | 采集四个运行期工件 + 新增执行事件页                                                                                                            | `WP-2D-02`（§6.2）。前置：指挥方重开契约窗口；**且必须先完成步骤 0 探针**（该采集可能改变 run 终态语义，见 §6.2）                                                              |
| P1     | C2-1~C2-4                | 把 C0 中已稳定渲染的字段写进 Bridge 报告 Schema，取得契约保障                                                                                  | 与 C1 合并为同一窗口（同一工作包 `WP-2D-02`）。三条前置**均已满足**：`WP-2D-01` 已验收（2026-09-18）、**窗口已重开（2026-09-18）**、**步骤 0 探针已完成（见 §6.2.1）→ 可派发** |
| P2     | C3-5/C3-6/C3-7           | 工作负载描述语言、拓扑结构、引擎语义画像的结构化只读展示                                                                                       | `WP-2D-03`（提示词未写）。前置：需先有结构化输入契约（或先做只读解析）                                                                                                         |
| P3     | C3-1~~C3-4、C3-8~~C3-11  | Run Intake v2 编辑入口、GPU 参与、Cycle 窗口、per-run 校准与 intent                                                                            | `WP-2D-03`。前置：依赖 Profile 数据与后端表示性缺口关闭；后者由 `WP-2C-02a`（§6.3）关闭                                                                                        |
| —      | 结构性                   | 执行期阶段级可观测性                                                                                                                           | 需后端 CLI 支持流式事件；**不建议**在前端伪造进度                                                                                                                              |

---

## 5. 不受契约窗口约束的推进方向

契约变更窗口**已于 2026-09-18 由指挥方显式重开**（首批受益工作包为 §6.2 `WP-2D-02` 与 §6.3 `WP-2C-02a`；
窗口重开后 current live `SCHEMA_SET_REVISION` 必然作废）。在此之前（WP-2C-01b 裁决至 2026-09-18）窗口为关闭状态，
可立即推进的只有 C0。C0 的 36 项（另加第 7b 条）具备三个特征，使其成为零风险批次（**已于 2026-09-18 由 `WP-2D-01` 全部落地并验收**，实测 `SCHEMA_SET_REVISION` 保持 `sha256:d498092a…abffab` 未变，三条边界的成立已由独立复验确认）：

1. **不碰 `bridge/contracts/**/*.json`** → `SCHEMA_SET_REVISION` 必须保持不变；
2. **不碰 Bridge / 后端** → 不产生任何端点行为变化；
3. **不重算指标** → 只做「已校验 artifact 字段 → 视图」的直通渲染与显示级换算（`identity` / `unit_conversion` / `count`），符合 `AGENTS.md`「前端只展示、校验、索引、排序、分组和做可追溯的显示级换算」的边界。

### 5.1 窗口重开的计划形态（指挥方裁决，2026-09-17）

为避免开两次窗口，C1/C2（`WP-2D-02`）与后端 issue serializer 缺口（`WP-2C-02a`）**合并进同一次契约变更窗口**。
两者共享窗口但文件集合完全不相交，因此可并行派发：

| 项          | 仓库             | 触及文件集合                                                      | 与对方的交叉 |
| ----------- | ---------------- | ----------------------------------------------------------------- | ------------ |
| `WP-2D-02`  | `D:\tileSim-web` | `bridge/contracts/**`、`bridge/services/execution.py`、`src/**`   | 无           |
| `WP-2C-02a` | `D:\tileSim`     | `src/Core/RunIntakeLowering.cpp`、`src/apps/TileSimCLI.cpp`、测试 | 无           |

派发顺序建议：先跑 `WP-2D-02` 的**步骤 0 探针**（只读，决定 C1 是否改变 run 终态语义），再决定 `WP-2D-02`
是否按原范围推进；`WP-2C-02a` 不受该探针影响，可与探针同时进行。

**窗口一旦重开，`SCHEMA_SET_REVISION` 必然变化**（当前 live 值 `sha256:d498092a…abffab` 将作废），
`WP-2D-01` 完成后也必须重新确认 `bridge/contracts/**` 零变化这一条仍然成立——两条轨道不得同时修改同一文件集合。

---

## 6. 派发提示词（可直接复制）

本节的工作包按可派发状态分三类：**§6.1 `WP-2D-01` 与 §6.4 `WP-2D-04`、§6.5 `WP-2D-05` 均已交付并验收**
（分别见 §6.1.1、§6.4.1、§6.5.1），保留作格式基准与历史证据；**§6.2 `WP-2D-02` 与 §6.3 `WP-2C-02a` 共享同一个
契约变更窗口**（指挥方已裁决合并，避免开两次窗口），必须先确认窗口已重开。
残留裁定见 §6.4.2。**截至 2026-09-18，本节内已无「可立即派发」的工作包**——下一步需要的是契约窗口重开的授权
（§6.2 / §6.3）或 `WP-2D-03` 的前置（结构化输入契约 / Profile 数据）。

> **2026-09-18 更新（窗口重开 + 探针完成）**：指挥方已显式授权重开契约变更窗口，且 §6.2 的**步骤 0 只读探针
> 已完成**，结论见 §6.2.1（标准配置下追加四个 `--runtime-*-out` 开关不会使 run 失败；但引入
> 「S0/S1 起且轨迹不可用 ⇒ 整条 run `exit 1`」的新失败面，须按方案 B 显式处理）。
> 因此 **§6.2 `WP-2D-02` 与 §6.3 `WP-2C-02a` 现均已具备派发条件**（两条前置「窗口已重开」「探针结论已知」
> 与「`WP-2D-01` 已验收」全部满足），且二者仓库与文件集合不相交，可并行派发。
> `WP-2D-03` 仍缺结构化输入契约与 Profile 数据，尚不可派发。

### 6.1 `WP-2D-01`（C0，零契约成本，可立即派发）

```text
你是 TileSim Web 仓库（D:\tileSim-web）的前端实现 Agent。本次只做工作包 WP-2D-01「工作台展示覆盖度补齐 · 第一批」，
只覆盖 C0 类缺口（纯前端渲染补齐），不要扩展到 C1/C2/C3，也不要顺手优化无关代码。

背景与依据（必读，按顺序）：
1. D:\tileSim-web\AGENTS.md、D:\tileSim-web\docs\AI_HANDOFF.md；回传格式与退回条件借用
   D:\tileSim-web\docs\F9_AGENT_ORCHESTRATION\24_PHASE2C_WORK_PACKAGE_PROMPTS.md 的第 5 节与第 7 节
   （只借格式，不要执行该文件里的 2C 工作包）
2. D:\tileSim-web\docs\architecture\BACKEND_SIMULATION_FLOW_UI_COVERAGE.md —— 本工作包的需求来源，
   §3.1 的 C0-1 ~ C0-7 就是你的完整范围清单（编号 1-36，另有第 7b 条），§3.5 列了「不要误判为缺口」的项。
3. D:\tileSim-web\docs\architecture\EXECUTION_VISUALIZATION_DESIGN.md
4. src/adapters/report-registry.ts、src/adapters/dashboard-view-model.ts、src/contracts/report-model.ts
5. src/features/execution-inspector/**（尤其 model/build.ts、model/aggregations.ts、model/stats.ts、
   model/visualizations.ts、presentation.ts）
6. src/features/f7-analysis/model.ts、src/features/structured-report/model.ts
7. src/features/run-bound-evidence/**（types.ts、week8-execution.ts、components/RunBoundEvidencePanel.vue）
8. src/lib/reports.ts、src/features/guided-help/guides/*.ts
9. 后端只读参考（禁止修改，只用来核实字段语义与后端出处）：
   D:\tileSim\include\Core\SimulationTypes.h、include\Core\WindTunnel.h、include\Core\LayerAdapters.h、
   include\Core\PartitionedDesKernel.h、include\Core\ResourceConvergence.h、
   include\S0_Workload\WorkloadDescription.h

任务目标：把已经随 run bundle 到达前端、但没有任何页面渲染的后端字段补齐为可读、可追溯、语义正确的展示项。
本工作包**不新增任何数据来源**——所有字段都已在 bundle 内，禁止为此新增 Bridge 调用或 artifact 请求。

必须做的事（按 C0-1 ~ C0-7 分组，逐项落地；清单的 36 条编号 + 第 7b 条必须逐条回答「做了 / 为什么不做」）：
1. 主运行报告（C0-1，第 1-7 条 + **第 7b 条**）：partial_artifacts 的「缺失产物 + 缺失原因」清单；
   multi_granularity_profile.capability_registry 的 analytical/des/cycle 能力与 des_contract_role /
   des_required_for_host_contract；des_* 聚合字段；bottleneck_report.supporting_artifacts；
   resolved_fidelity_profile 的 4 个 has_* 聚合标志与每个 entry 的 state/downgraded/fallback/
   not_covered/expected_absence/claim_scope_impact；summary 的 preferred_entrypoint/host_path/
   execution_path/has_tail_attribution（adapter 已产出，只需渲染）；
   **第 7b 条**：run 顶层 `next_action`——它是后端给出的权威「下一步操作建议」（`WindTunnel.cpp:6315-6362`
   会写出诸如「rerun with --fidelity-policy des」这类具体指引），必须与同层的 `cause` 一并如实渲染，
   不得改写、润色、删减或降级为普通提示文案。
2. 指标报告（C0-2，第 8-18 条）：三个 MetricDistributionSummary 的 sample_count/p50/p95/p99/max；
   observation_window；boundary_notes；resource_boundary_evidence；system_summary.pd_disaggregation 全套；
   rejected_request_count；request_metrics 的时间戳与 sample 标志；percentile_subjects 的 P50/P95 条目
   （不要只展示 P99）；metrics 侧的 resolution_* 聚合与 dominant_*；metric_scope 与 capability_registry 计数；
   system_summary.has_fabric_timeline/fabric_busy_time_ps。
3. 验证报告（C0-3，第 19-25 条）：error_budget 误差预算矩阵（observed/expected/absolute_error/
   tolerance/unit/status）；validation_scope / baseline_package_id / benchmark_manifests / calibration_inputs；
   des_contract_* 聚合；resolution_dominant_* 与 4 个 has_* + 4 个计数；evidence_tier / validation_lane
   （lib/reports.ts 已算出但未渲染）；trace_provenance 的 source_id/generation_path/
   capture_or_generation_time/upstream_tooling/notes；checks 与 resolution_entries 的结构化引用。
4. 慢请求归因（C0-4，第 26-29 条）：symptom / explained_entity_kind / observation_start·end_time_ps；
   contributing_factors（与 attribution_ranking 分开展示，不要合并）；validation_links /
   metric_evidence_links / resource_evidence_links；unresolved_gaps。
5. 执行信封（C0-5，第 30-32 条）：notes；envelope_id / trace_name / start_time_ps / end_time_ps；
   has_runtime_event_trace 与 has_tail_cause_chain_report（这两个是布尔事实，必须如实显示，不得用颜色或
   文案暗示「已采集」）；stages 的 subject_refs / evidence_refs。
6. 运行绑定 DES 证据（C0-6，第 33-35 条）：state_summary 除 checkpoint 外的全部字段；
   stream_records 的逐窗口明细（window_start_ps/window_end_ps/partition_id/committed_event_count/
   committed_event_digest，长列表要分页或折叠，不得静默截断）；provenance 的 calibration_level /
   allowed_claim_scope / trace_kind。
7. 展示状态语义（C0-7，第 36 条）：把 OverviewView 与 MetricsView 对 SourcedValue.availability 的
   两态压缩恢复为 dashboard-view-model.ts:3-13 定义的完整语义
   （available / expected_absence / not_covered / missing / unsupported_schema），
   并保证 UI 上 `0` 与 missing、expected absence、not covered、unsupported schema 五者可区分。

硬性语义要求（违反即退回）：
- 只做展示、校验、索引、排序、分组与可追溯的显示级换算（identity / unit_conversion / count /
  deduplicate）。64 位 ps/bytes 必须走无损 JSON 路径，显示换算保留原始列。
- 禁止重算或补造任何模拟指标；禁止用请求数、总量或平均值推算缺失的逐项数据。
- 禁止把 synthetic consistency 显示为 held-out validation；禁止升级 provenance / fidelity /
  claim scope；禁止把 declaration-only 显示成已采集。
- 每个新展示项必须带 sourcePaths 或等价的字段来源标注，并保持 `availability` 语义；空态必须写明
  「缺失/未覆盖/不适用」三者中是哪一种，不得统一写成「—」。
- 新增文案写入 src/i18n/workstreams/（不要扩大共享 legacy catalog）；页面引导定义归
  src/features/guided-help/ 所有。
- 不得把状态重新集中回 src/store/dashboard.ts；view 只做页面编排，不直接调用 bridgeApi、
  不导入其他 feature 内部文件；feature 之间经公共 index.ts 协作；components/ui 不得访问 store/feature/Bridge/schema。

硬边界（违反即退回）：
- 禁止新增、修改或删除 bridge/contracts/ 下任何 .json；禁止改动任何已发布 identity 或 revision；
  完成后 SCHEMA_SET_REVISION 必须不变（本轮实测前缀 sha256:d498092a）。
- 禁止改动 bridge/ 下任何 .py；禁止新增或修改任何 HTTP 路由；不得产生任何端点行为变化。
- 禁止修改 D:\tileSim（后端仓库）任何文件。
- 禁止新增 artifact 请求或 Bridge 调用；本包不得引入新的数据来源。
- 禁止 commit / push / deploy / stage；禁止 reset、clean、stash 或任何覆盖式 checkout。工作树当前含有多个
  **已验收但未提交**的工作包（WP-2C-01a/01b、WP-2C-02 服务层、WP-2C-06），已在 `bridge/**`、`src/**`、
  `tests/**` 留下改动；这些改动一律**只读保护**，不得回滚、覆盖或代为提交。
- 禁止触碰 127.0.0.1:5173；禁止读取或输出任何 credential；禁止调用 live Provider；禁止创建 run、禁止写 runs/。
- 禁止为了让页面「看起来完整」而放宽 reportCompatibility / f6bShapeIssues 等既有门禁。

完成后运行（本机 `pnpm` 可能不在 PATH；下面的 `./node_modules/.bin/*.CMD` 形式已在本机实测可用，
若你的 shell 不支持 .CMD 再改用等价的 node 直调并说明实际形式）：
  cd d:/tileSim-web && node scripts/generate-contract-types.mjs --check
  cd d:/tileSim-web && node scripts/generate-bridge-client.mjs --check
  cd d:/tileSim-web && node scripts/check-doc-links.mjs
  cd d:/tileSim-web && node scripts/check-frontend-dependencies.mjs
  cd d:/tileSim-web && ./node_modules/.bin/vue-tsc.CMD --noEmit
  cd d:/tileSim-web && ./node_modules/.bin/vitest.CMD run
  cd d:/tileSim-web && ./node_modules/.bin/eslint.CMD src tests scripts bridge
  cd d:/tileSim-web && ./node_modules/.bin/vite.CMD build
  cd d:/tileSim-web && ./node_modules/.bin/prettier.CMD --check <你新增或修改的每一个文件>
  cd d:/tileSim-web && git diff --check
  git status --porcelain bridge/contracts            （必须无变化）

格式约定：仓库当前 `prettier --check .` 有 **37 个既有不合规文件**（`.playwright-cli/`、`output/playwright/`、
phase2 的若干 `*.json`、`.workbuddy/memory/*.md` 等）。它们**不是本工作包造成的，禁止顺手修或 `--write` 全仓**。
你新增或修改的每个文件必须自己 prettier-clean（对该文件跑 `--write` 再 `--check`），且不得产生无关 diff。

测试要求：每个新增展示面至少一条组件或适配器测试；C0-7 的五态语义必须有测试钉死
（0 / missing / expected_absence / not_covered / unsupported_schema 五者互不混淆）；空态文案也要测。
前端基线为 535 passed / 8 skipped，只允许增加，不允许减少或跳过。

按 `24_PHASE2C_WORK_PACKAGE_PROMPTS.md` 第 5 节的七节结构回传，并明确回答：C0 的 36 条 + 第 7b 条各自状态
（done / not-done + 原因）；
SCHEMA_SET_REVISION 是否变化（必须为「否」，并给出实测前缀）；是否新增或修改或删除 bridge/contracts 下
.json（否）；是否新增或修改任何 HTTP 路由（否）；是否修改 bridge/ 下 .py（否）；是否修改 D:\tileSim
任何文件（否）；是否新增 Bridge 调用或 artifact 请求（否）；是否创建 run（否）；是否触碰 5173（否）；
是否 commit 或 push（否）。
```

#### 6.1.1 `WP-2D-01` 验收判定（指挥方，2026-09-18）

**判定：通过。** 范围（C0 的 36 项 + 第 7b 条）全部落地；三条硬边界成立；两条既有红灯均未变差。
下列数字**均为指挥方本机独立实测重算**，不采信回传值。

**改动集（34 个文件，0 删除）**

- 新增 17：`src/features/report-coverage/`（14 文件，约 2570 行）、
  `src/features/run-bound-evidence/components/Week8StreamRecords.vue`、`src/i18n/workstreams/report-coverage.ts`、
  `tests/unit/report-coverage.test.ts`。
- 修改 17：`contracts/report-model.ts`（+282/−9）、`adapters/dashboard-view-model.ts`、run-bound 三文件、
  5 个 view、`styles/analysis.css`（+1）、2 个测试文件、`tests/e2e/dashboard.spec.js`（+4/−2）、2 个截图基线。

**关键实现复核（抽验，非采信）**

- **五态单一来源成立**：新增 `availabilityFor()`（`report-coverage/availability.ts:59`）只在 `undefined | null`
  时求值，缺失态回落到 `adapters/dashboard-view-model.ts:4` 的**同一个** `unavailable()`；`0` / `false` / `[]`
  一律 `available`。`report-coverage.test.ts:57-114` 逐态钉死（5 个标签互不相同 + 精确文案 + 0≠缺失 + 三态可区分
  - unsupported_schema）。
- **视图只经公共出口**：5 个 view 全部 `from "../features/report-coverage"`，无一处深入 `model/` 或 `components/`。
- **字段零遗漏抽验**：43 个代表字段名（`des_required_for_host_contract`、`decode_wait_*`、`error_budget`、
  `stream_record_count`、`stream_records_truncated`、`next_action` 等）在新 model 中全部命中。
- **无新数据源**：新 feature 内 `fetch(` / `bridgeApi` / `useQuery` / `localStorage` **全 0 命中**；`package.json` 未改。
- **第 7b 条落地**：`OverviewView.vue` 末尾 `.run-verdict`，`cause` 与 `next_action` 同 `<dl>` 逐字显示，未降级为提示文案。
- **NULL 而非伪造 0**：`week8-execution.ts` 的 `optionalLossless/optionalString/optionalBoolean` 对后端未写出的字段
  返回 `null`，面板渲染「后端未写出该字段」，符合 `AGENTS.md` 边界。

**契约与边界（实测）**

- `SCHEMA_SET_REVISION` = `sha256:d498092a6865090728f05a920c6f087043714d6a82a233cd492dee87e7abffab`，
  **与 01b 之后完全一致，未变**。复算方式：对工作树 `bridge/contracts/**/*.json`（88 文件）按 `server.py:135-144`
  同一算法重算；同一算法对 `HEAD` 快照（86 文件）得 `sha256:518f4da9…e43ece` → 与 `HEAD` 的差异**全部来自 01a/01b**，
  与 2D-01 无关。
- `git status --porcelain bridge/contracts` 与 2D-01 开工前**逐条相同**（7 条既有项）；`bridge/**/*.py` 的 mtime 为
  09-17 16:50–18:15，**早于** 2D-01 自 09-18 00:08 起的写入。
- `agent_exposed` 只出现在既有 generated 契约与 copilot 编译器里，本 WP **未新增一处**。
- 未创建 run、未写 `runs/`、未触碰 5173、未 commit / push / stage。

**门禁（全部本机实测）**

| 项                                                       | 结果                                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| vitest 全量                                              | **69 files / 580 passed / 8 skipped / 0 failed**（基线 535/8，+45）                     |
| 差额核算                                                 | +45 = 34（`report-coverage.test.ts`）+ 11（`i18n-model-coverage.test.js`）              |
| `vue-tsc --noEmit`                                       | exit 0                                                                                  |
| `eslint src tests scripts bridge`                        | exit 0                                                                                  |
| `eslint .`（仓库级）                                     | 10 errors，**全部落在未跟踪的 `output/playwright/*.js`**（用户草稿）                    |
| `prettier --check`（本次 19 路径）                       | 全通过，零新增 format 债务                                                              |
| `vite build`                                             | exit 0（10.17s）                                                                        |
| `contracts:check` / `docs:check`(43) / `deps:check`(254) | 全 exit 0                                                                               |
| Bridge `unittest`                                        | **Ran 143 tests / OK**                                                                  |
| 2A oracle                                                | 6 tests / 1 failed（既有 `test_current_contract_drift_and_proposal_isolation`，未变差） |
| `git diff --check`                                       | clean                                                                                   |
| Playwright 定向（6 用例 + warmup）                       | **7 passed / exit 0**（1640 / 1763 / 2079 / 2555 / 2719 / 2743）                        |
| Playwright 全量                                          | **incomplete + 1 red**（详见 §6.1.2；非本 WP 引入）                                     |

#### 6.1.2 Playwright 结论与 `DEF-BUSY-RACE-001`（既有缺陷，非本 WP 引入）

**结论：全量 e2e 仍拿不到干净 tally；`dashboard.spec.js:2079` 在套件上下文下可复现变红。两者均已定位到既有缺陷，
与 `WP-2D-01` 无关。**

> **更新（2026-09-18）**：本节的 `DEF-BUSY-RACE-001` 已由 `WP-2D-04` A 部修复并关闭，全量 e2e 已取得干净 tally；
> 本节保留当时的定位过程作为缺陷证据，验收判定见 **§6.4.1**。

**1. 定向 7 条在单 worker 下完整跑完并 exit 0**（46.8s，无收尾挂起），含 4 个截图基线用例与 2079：
「全量跑不完」不是用例本身的问题，也不是新增面板破坏了基线。

**2. 全量两次都在 `dashboard.spec.js:2079` 变红，随后 worker 卡死**

| 跑法        | 进度       | `2079` | 收尾                                                 |
| ----------- | ---------- | ------ | ---------------------------------------------------- |
| `workers=2` | 33/57 后停 | **红** | 两个 worker 均 `did not exit within 300000ms` 被强杀 |
| `workers=1` | 23/57 后停 | **红** | 同上（单 worker 也卡死）                             |
| 定向单跑    | 7/7 完成   | **绿** | 正常 `exit 0`                                        |

**3. 失败根因 = `src/store/dashboard.ts:103-137` 的 busy 泄漏竞态（`DEF-BUSY-RACE-001`）**

失败断言是 `dashboard.spec.js:2095` 的 `await expect(page.locator(".global-busy")).toHaveCount(0)`
（收到 1，重试 14 次 × 5s）。页面快照显示 evidence-lab 已**正常渲染完毕**，只剩 `status "正在载入"`。
`.global-busy` 由 `src/App.vue:330` 的 `v-if="state.busy"` 驱动，`state.busy` 只有两处写入：
`store/dashboard.ts:117/135` 与 `store/dashboard-runs.ts:35/45`。缺陷在**前者**：

```ts
const synchronizationRevision = ++routeSynchronizationRevision; // :104 先自增
...
if (view === "evidence_lab") return;                            // :107 提前返回（revision 已变）
...
try { ... if (synchronizationRevision !== routeSynchronizationRevision) return; ... }
finally { if (synchronizationRevision === routeSynchronizationRevision) state.busy = false; } // :135 被取代时不清零
```

即：一次 run-evidence 同步只要在飞行中被任何后续导航**取代**，`finally` 的相等判断不成立 →
`state.busy` **永久停在 true**，`.global-busy` 一直留在 DOM 里。2079 的路径正是
`openFixture(..., "execution")` 的同步尚未落地时就点了「校准与追踪」（`/evidence-lab`；:107 提前返回但 :104 已 bump
revision）→ 取代 → 泄漏。故它是**时序竞态**：机器空闲时同步先完成 → 绿；套件上下文（dev server 热、上下文多）下同步更慢 → 红。

**归因证据**：`src/store/**` 与 `Week7EvidenceView` 本次**零改动**（`git status` 对应路径为空）；`bridge/**`、契约、
路由全部零改动；2D-01 只增加展示与 `computed`，**不新增任何请求**，无法改变该同步时序。

**处置**：登记为独立缺陷 `DEF-BUSY-RACE-001`，建议单独立小工作包修（把 `finally` 改成「被取代时也清零」，
或改用 busy 计数器 / 守卫）。**不要**顺手在 2D-01 里改 `src/store/`——那会破坏本包「零数据源副作用」的边界。
**该修复已派发为 `WP-2D-04` 的 A 部（§6.4）**。注意 §6.4 的 A-3(iii) 对上面这个朴素写法加了反例约束：
`state.busy` 与 `dashboard-runs.ts:34-47` 的 `openRun()` 共享，无脑清零会把 `openRun` 的飞行态一并抹掉（方向相反的
同类错误），故提示词只钉不变式、不钉具体写法。

**4. worker 收尾卡死是既有环境缺陷**：与 WP-2C-01b 记录的是同一现象（`worker process did not exit within 300000ms`
后被强杀），与红绿无关。若要干净全量 tally，应修 teardown，或固定用 `--workers=1 --reporter=list`。

**与回传不一致之处（已纠正，不影响验收）**

- 回传称「+34 为本 WP、其余为工作树内其他 WP 的未提交测试」。实测 +45 **全部**来自本 WP：另外 11 条是
  `i18n-model-coverage.test.js` 为 `report-coverage` 新加的 10 条文件级英文覆盖 + 1 条 `Week8StreamRecords` 入列。
  回传口径偏保守，实际归因对本 WP 更有利。
- 回传称两个截图基线「新增面板必然增高」。实测核实：synthetic `1440×3006 → 1440×3135`、dark `1440×1764 → 1440×1914`，
  另两个基线（request-evidence 1987、unknown-schema 1100）**逐字节未变**——与挂载位置差异一致
  （Attribution 的覆盖面板位于 `causesOpen` 折叠区之后，Execution / Overview 为常驻），**不是漏更新**。
  `playwright.config.js` 的 `maxDiffPixelRatio: 0.01` 未被放宽。

**残留观察（不阻塞验收，登记为后续项）**

1. `report-coverage/model/shared.ts:138` 的 `cell()` 对**行内**缺席字段直接判 `missing`，未走 `unavailable()` 的五态分派
   —— 报告级五态已修复，行级（列表单元格）只有在 `extra` 显式覆盖时才能表达
   `expected_absence` / `not_covered` / `unsupported_schema`。**已派发为 §6.4 B-1，并于 2026-09-18 验收关闭**。
2. `execution-inspector/components/LayerRecordTable.vue:59`、`f7-analysis/presentation.ts:45`、`DesignSpaceView.vue:44`
   等仍用「不适用」做二元回退，属**另一套 availability 模型**（非本次 C0-7 的五态面），如需统一应另立条目。
   **已派发为 §6.4 B-2 / B-3 / B-4**：B-2 / B-3 已验收关闭；B-4 判定「无需修改」并经指挥方复核成立
   （`DesignSpaceView.vue:43-46` 收到的 `knob.availability` 来自 `contracts/report-model.ts:675` 的
   `"available" | "not_applicable" | "unresolved_not_executed"` 三态联合，视图是**忠实的三态透传**，不存在压态）。

### 6.2 `WP-2D-02`（C1 + C2，**契约开窗批次**，需指挥方先确认窗口已重开）

派发前指挥方必须先确认三件事，否则**不要派发**：

1. 契约变更窗口已由指挥方显式重开（WP-2C-01b 关闭的那扇窗）；
2. ~~`WP-2D-01` 已验收~~ —— **该条已满足（2026-09-18，见 §6.1.1）**：C2 只把 2D-01 已稳定渲染的字段固化进
   Schema，2D-01 未验收就派 2D-02 会锁死接口。现在只剩窗口重开这一条前置。
3. §6.2 的「步骤 0 探针」结论已知（该探针决定 C1 是一次常规采集还是一个会改变 run 终态语义的高风险改动）。

```text
你是 TileSim Web 仓库（D:\tileSim-web）的实现 Agent。本次只做工作包 WP-2D-02「运行期工件采集 + 报告 Schema
加固」。这是**契约开窗批次**：你被明确授权修改 bridge/contracts/**/*.json，且必须完成全套契约级联。
不要扩展到 C3（输入面），不要顺手优化无关代码，不要动 D:\tileSim 后端仓库。

背景与依据（必读，按顺序）：
1. D:\tileSim-web\AGENTS.md、D:\tileSim-web\docs\AI_HANDOFF.md
2. D:\tileSim-web\docs\architecture\BACKEND_SIMULATION_FLOW_UI_COVERAGE.md —— 需求来源。
   §3.2 是你的 C1 范围（C1-1 / C1-2 / C1-3），§3.3 是你的 C2 范围（C2-1 ~ C2-4），§1.3 是十个规范产物清单。
3. D:\tileSim-web\docs\F9_AGENT_ORCHESTRATION\23_PHASE2C_WEB_INTEGRATION_PLAN.md —— 上一轮契约开窗
   （WP-2C-01b）的完整级联清单，**照它的流程做**；§5 与 §7 的回传格式与退回条件同样适用于本包。
4. bridge/contracts/openapi.json 的 x-tilesim-contract、bridge/services/execution.py、
   bridge/repositories/runs.py（尤其 inspect_artifact / _artifact_entries）、bridge/server.py（CONTRACT_METADATA 系列）
5. src/lib/api/artifacts.ts、src/adapters/report-registry.ts、src/contracts/generated/**
6. 后端只读参考（禁止修改）：D:\tileSim\src\apps\TileSimCLI.cpp:255-317、
   D:\tileSim\src\Core\WindTunnel.cpp:276-278（boundary_expects_runtime_trace）、:6150-6431
   （populate_artifact / write_wind_tunnel_artifacts）、:728+（runtime_event_*_to_json）、
   D:\tileSim\include\Core\WindTunnel.h:15-26、271-306

════════ 步骤 0（必做，先于任何改动）════════
写代码之前先做一次**只读探针**，并把原始输出贴进回传报告：
  a) 确认 Bridge 实际使用的 `--from` 取值（当前固定 S1；见 bridge/services/execution.py:186-226 与
     bridge/server.py:103-104 区段的默认值），据此判断 boundary_expects_runtime_trace 的返回值。
  b) 用一条**已存在的、非 5173** 的 Bridge 测试路径，实测一次「加上四个 --runtime-*-out 之后 run 是否仍成功」，
     或直接读代码给出确定性结论。
  c) 结论必须回答这个是非题：**在 Bridge 的标准配置下，当 runtime 事件轨迹不可用时，追加这四个开关会不会把
     一次原本成功的 run 变成 exit 1？**
为什么必须先问这个：D:\tileSim\src\Core\WindTunnel.cpp:6414-6419 规定，只要请求了某 artifact 而其 state 既不是
`ready` 也不是 `expected_absence`（即 state == `unavailable`），write_wind_tunnel_artifacts 就返回 false，
TileSimCLI.cpp:304-309 随即 `return 1` —— **整条 run 判为失败**。而 runtime_event_trace 的 state 正是
`has_runtime_event_trace ? ready : (expects_runtime_trace ? unavailable : expected_absence)`
（WindTunnel.cpp:6194-6207）。所以这不是「多采集一个文件」，而是**会改变 run 终态语义**的改动。
若探针结论是「会」，你必须在回传里显式写明，并采用下述任一 fail-closed 方案，不得静默接受：
  · 方案 A：只在可判定 runtime 可用时追加该组开关（需要基于版本化事实判定，禁止靠猜测）；
  · 方案 B：接受新语义，但必须把「runtime 不可用 ⇒ run failed」这一变化写成 Bridge 的可见事实，
    并补一条锁死该行为的测试。
无论选哪个方案，都必须在回传报告里给出理由与被拒方案的排除原因。

════════ C1：采集四个运行期工件 ════════
1. 在 bridge/services/execution.py 的命令构造中追加四个开关（注意它们目前只被 CLI 解析、从未被请求）：
   --runtime-events-out / --runtime-summary-out / --runtime-requests-out / --runtime-analysis-out。
   输出文件落在 <run_dir>/ 下，文件名必须与已有的 `input-runtime-trace.json` **不冲突**（那是 Bridge 自己
   写的输入轨迹，语义完全不同）。
2. 在 bridge/contracts/openapi.json 的 `report_files` 与 `artifacts` 增加对应条目。**必须先判断走哪条路线**：
   · 路线 1（默认）：作为 `report_kind: null` 的输入型 artifact，**不要**声明 `schema_identities`，也**不要**
     声明 `run_id_pointer`。依据：bridge/repositories/runs.py:519-536 —— 未声明 schema_identities 的
     artifact 会落到 `contract_status = "not_applicable"`，仍会在 manifest 里带 bytes/sha256，但不做 run 绑定。
   · 路线 2：为它们引入新的 Bridge 报告 schema（如 tilesim.s1_runtime_event_trace.v1）并声明 run_id_pointer。
     **阻塞点**：D:\tileSim\src\Core\WindTunnel.cpp:728+ 的 runtime_event_trace_to_json / summary / requests
     序列化器**既不写 schema_version 也不写 run_id**。走路线 2 就必须先改后端序列化器 —— 那不在本包范围，
     请你在回传里标注为「需后端工作包」，然后按路线 1 落地。
   两条路线的选择与理由必须写进回传报告。
3. artifact 描述符 ≠ artifact 数据，这是本包最容易出错的一点：当一个 artifact 的 state 是 expected_absence 时，
   后端写入的文件内容是 **artifact 描述符 JSON**（WindTunnel.cpp:6404-6412 调用 artifact_descriptor_to_json），
   而不是 trace 本身；state == ready 时才写 payload_json。因此：
   · Bridge 与前端都必须能区分「描述符（无 payload）」与「真实工件」；
   · 不得把描述符当作 trace 数据渲染；
   · 不得把 payload 为空的文件判为损坏报告或 rejected artifact（它会在 manifest 里以 not_applicable 出现）。
   · 前端空态必须写明是「未请求 / 期望缺席 / 不可用 / 已就绪」中的哪一种。
4. 在 src/lib/api/artifacts.ts 的 artifactContracts（:50-102）同步新增四条。注意 :113-118 会对 manifest 里
   出现但前端未登记的 artifact_id 直接抛 ambiguous_artifact_identity —— 契约与前端必须同步落地，
   不能先发契约后补前端。
5. Execution 页新增 S1 运行期真实事件面。当前该页的 S1 记录是
   `input-runtime-trace.requests × metrics.request_metrics` 的**显示级 join**（不是运行期真实事件流）；
   有了真实工件后，必须把「真实事件流」与「显示级 join」**分开标注**，禁止把 join 结果升级表述为运行期事件。

════════ C2：把稳定字段写进报告 Schema ════════
6. 当前 Bridge 报告 Schema 是窄契约：metrics-report 只 required
   [schema_version, run_id, request_metrics, percentile_subjects, system_summary]，
   validation-report 只 required [checks]，tail-cause-chain-report 只 required
   [cause_chain, attribution_ranking]，execution-envelope 只 required [evidence_refs, stages]，
   其余全靠 additionalProperties: true（§3.3 C2-1/C2-2）。
7. 把 **WP-2D-01 已落地并已在 UI 稳定渲染**的字段（§3.1 的 C0-1 ~ C0-6 清单）提升为 Schema 的显式 properties，
   并只在字段已由后端稳定序列化时才加进 required。**不要**把 dev/synthetic 路径下可能缺席的字段写进 required。
   WP-2D-01 未渲染的字段不要在本包里擅自提升。
8. 前端真正的门禁是 src/adapters/report-registry.ts:68-124 的 f6bShapeIssues()（逐 kind 强制若干数组与
   无损整数），**不是 JSON Schema**。扩 Schema 后必须同步扩它，且**只允许收紧或对齐，禁止放宽**
   （放宽 = 退回条件）。

════════ 契约级联清单（缺任一项即视为未完成）════════
- bridge/contracts/openapi.json：report_files / known_report_schema_identities / artifacts
- bridge/contracts/schemas/*.json（新增或加固）
- node scripts/generate-contract-types.mjs 与 node scripts/generate-bridge-client.mjs（**必须真跑**，
  并提交 src/contracts/generated/** 的生成结果；若 drift check 报错说明你漏跑了）
- src/lib/api/artifacts.ts 与 src/adapters/report-registry.ts
- Bridge 测试：python -m unittest test_server.py（**基线 143 passed / OK**，只允许增加，不允许减少或跳过；
  78 是更早时期的历史数字，已被 WP-2C-01b/02 抬高，不要拿它当基线）
- 文档：所有引用 SCHEMA_SET_REVISION 的位置必须同步改（至少
  docs/AI_HANDOFF.md、docs/F9_AGENT_ORCHESTRATION/01_CURRENT_BASELINE_AND_GAPS.md、
  /12_DELIVERY_ROADMAP_AND_BACKLOG.md、/23_PHASE2C_WEB_INTEGRATION_PLAN.md、/24_PHASE2C_WORK_PACKAGE_PROMPTS.md、
  docs/architecture/BACKEND_SIMULATION_FLOW_UI_COVERAGE.md），并写明旧值
  sha256:518f4da9…e43ece 与 sha256:d498092a…abffab 均已作废
- tests/fixtures/phase1-agent-orchestration/frozen-current-subset.json **不得改写**：它是 Phase 1 历史证据，
  被 tests/unit/{phase2a-contract-proposal,phase1-draft-eval,agent-intent-compiler,
  agent-clarification-binding}.test.ts、tests/oracles/phase1-draft-eval.mjs 与
  bridge/contracts/proposals/agent_orchestration_phase2a/tests/test_phase2a_oracle.py 当作数据消费
- 回传里必须给出**实测**的新 SCHEMA_SET_REVISION 全文（不是推测值）

════════ 硬边界（违反即退回）════════
- 授权范围仅限 bridge/contracts/** 与上述明确列出的文件。禁止修改 D:\tileSim 任何文件。
- 禁止新增或修改任何 HTTP 路由（本包只改劳动产物的采集与契约，不加端点）。
- 禁止创建 run、禁止写 runs/、禁止触碰 127.0.0.1:5173、禁止读取或输出 credential、禁止调用 live Provider。
- 禁止 commit / push / deploy / stage；禁止 reset、clean、stash 或任何覆盖式 checkout。工作树当前含多个
  **已验收但未提交**的工作包（WP-2C-01a/01b、WP-2C-02 服务层、WP-2C-06），一律只读保护，不得回滚或代为提交。
- 禁止为了让页面「看起来完整」而放宽 reportCompatibility / f6bShapeIssues 等既有门禁。
- 禁止把「契约已扩」表述成「后端已保证」：Schema 加固只提供校验保障，不改变后端的实际产出能力。

════════ 完成后运行 ════════
  cd d:/tileSim-web && node scripts/generate-contract-types.mjs --check
  cd d:/tileSim-web && node scripts/generate-bridge-client.mjs --check
  cd d:/tileSim-web && node scripts/check-doc-links.mjs
  cd d:/tileSim-web && node scripts/check-frontend-dependencies.mjs
  cd d:/tileSim-web && ./node_modules/.bin/vue-tsc.CMD --noEmit
  cd d:/tileSim-web && ./node_modules/.bin/vitest.CMD run
  cd d:/tileSim-web && ./node_modules/.bin/eslint.CMD src tests scripts bridge
  cd d:/tileSim-web && ./node_modules/.bin/vite.CMD build
  cd d:/tileSim-web && git diff --check
  Push-Location bridge; python -m py_compile server.py test_server.py api/responses.py contracts/validation.py contracts/run_request.py infra/identity.py repositories/runs.py services/execution.py services/week7.py; python -m unittest test_server.py; Pop-Location

格式约定：仓库当前 `prettier --check .` 有 **37 个既有不合规文件**（`.playwright-cli/`、`output/playwright/`、
phase2 的若干 `*.json`、`.workbuddy/memory/*.md` 等）。它们不是本工作包造成的，**禁止顺手修或 `--write` 全仓**。
你新增或修改的每个文件必须自己 prettier-clean，且不得产生无关 diff。

按 24_PHASE2C_WORK_PACKAGE_PROMPTS.md 第 5 节的七节结构回传，并明确回答：步骤 0 的是非题结论与实测依据；
C1-1/C1-2/C1-3 与 C2-1~C2-4 各自状态（done / not-done + 原因）；artifact 路线 1 还是路线 2 及理由；
新 SCHEMA_SET_REVISION 实测全文；是否修改 D:\tileSim（否）；是否新增或修改 HTTP 路由（否）；
是否创建 run（否）；是否触碰 5173（否）；是否改写 frozen-current-subset.json（否）；是否 commit 或 push（否）。
```

#### 6.2.1 步骤 0 探针结论（2026-09-18，指挥方授权「开窗」后实测）

**是非题结论：不会。** 在当前 Bridge 标准配置下，追加四个 `--runtime-*-out` 开关**不会**把一次原本成功的
run 变成 `exit 1` —— 因为该配置下 `runtime_event_trace` 的 state 实测恒为 `ready`。

判定链（全部只读，无一次真实执行）：

1. Bridge 标准配置固定 `--from S1 --to S6`（`bridge/server.py:103-104`，唯一 scenario 为 `s1_des_example`）。
2. 追加开关会把对应 artifact 标记为「已请求」，四个开关同构：
   `artifact_request.runtime_event_trace = !runtime_events_out.empty()`
   （`D:\tileSim\src\apps\TileSimCLI.cpp:260-263`）。
3. `write_wind_tunnel_artifacts` 对 state 既非 `ready` 也非 `expected_absence` 的**已请求** artifact
   **返回 false**（`src/Core/WindTunnel.cpp:6404-6419`），CLI 随即 `return 1`（`TileSimCLI.cpp:304-309`）——
   即整条 run 判为失败。
4. 该 artifact 的 state 由两个布尔决定：
   `has_runtime_event_trace ? "ready" : (expects_runtime_trace ? "unavailable" : "expected_absence")`
   （`WindTunnel.cpp:6194-6207`）；而 `boundary_expects_runtime_trace(range)` 在
   `from_subsystem ∈ {S0, S1}` 时为 **true**（`WindTunnel.cpp:276-278`）。
   ⇒ 标准配置下 state 只可能是 `ready` 或 `unavailable`，**不可能**落到安全分支 `expected_absence`。
5. **决定性实证**：对仓库内 3 处 run 存档（`runs/`、`runtime/cleared-runs-20260901-181900/`、
   `runtime/rehearsal/run-20260907-210208-1580/runs/`）共 **39 条** run 的 `execution-envelope.json` 全量扫描：
   `range_label` 全部为 `S1->S6`，`has_runtime_event_trace` **全部为 `true`，`false` 计数为 0**
   （最近一条 `run-20260911-151232-06d3cfb4` 为 `fidelity_policy=des`）。⇒ state = `ready` ⇒ 写出真实
   payload ⇒ run 仍然成功。
6. 四个 `runtime_*` 标志**只**出现在 `populate_artifact` 调用点（`WindTunnel.cpp:6196/6209/6222/6236`），
   **不参与任何计算分支**；会改变计算路径的是 `design_space_report`（`:6041-6044`）与 `run_bound_des_evidence`
   （`:6087`），与本次追加无关。`capture_mode` 也已因既有 6 个 artifact 请求而为 `Standard`
   （`TileSimCLI.cpp:271-282`），追加不会改变它 ⇒ `enable_event_log` 不变（`WindTunnel.cpp:5882`）。
   ⇒ **追加的唯一效果是「这四个 artifact 变为必须写出」。**

**但仍引入一个新的失败面（WP-2D-02 必须显式处理，不得静默接受）**：该 artifact 只在 state == `ready` 时安全。
当 `from` 为 S0/S1 而 runtime 轨迹不可用时（例如 s1 trace 的 `requests` 为空，见
`src/Core/LayerAdapters.cpp:3859-3874` 的 `has_runtime_source_trace` 分支），state 变为 `unavailable`，
**整条 run 会 `exit 1`，连同另外 6 个已成功的报告一起丢失**。当前标准 scenario 下不可达，但结构上可达。

**选定方案：方案 B** —— 接受新语义，把「runtime 不可用 ⇒ run failed」写成 Bridge 的可见事实，并补一条锁死
该行为的测试。**方案 A 被排除**：它要求 Bridge 在 run 之前判定 runtime 可用性，而唯一权威判据是 run 自身的
结果（`has_runtime_event_trace`）；Bridge 事前可得的事实只有 `--from`（只给出 `expects_runtime_trace`，
给不出 `has_*`）与 trace fixture 内容，据后者推断等于把后端内部实现假设硬编码进 Bridge —— 正属提示词禁止的
「靠猜测」。方案 B 在标准路径上的实测代价为 0（39/39 为 `ready`），且语义变化可见、可测。

**证据强度声明**：本机无 C++ 工具链且后端 CLI 为 ELF（`wsl.exe` 被安全策略阻断），本次探针**无任何真实执行**
（`not-run`）；结论由「只读代码判定 + 历史 run 存档实证」两条独立证据支撑，未编造任何 stdout。
`docs/examples/s1_runtime_trace.json` 的 `requests` 实测为 **3 条**（非空），这是第 5 条结论成立的前提。

### 6.3 `WP-2C-02a`（后端 issue serializer 补全，仓库 = `D:\tileSim`）

与 6.2 共享同一个窗口（避免开两次），但**仓库与文件集合完全不相交**，可以并行派发。
它是 `WP-2C-02b`（端点接线）的**唯一**前置；不做它，`WP-2C-02b` 与 `WP-2C-05` 都无法开工。

```text
你是 TileSim 后端仓库（D:\tileSim）的实现 Agent。本次只做工作包 WP-2C-02a「Run Intake issue 序列化补全」，
目标是把后端已有的信息如实暴露到 CLI，而不是新增能力。不要动 D:\tileSim-web。

必读背景：
1. D:\tileSim\include\Core\RunIntakeLowering.h（RunIntakeIssue 与 RunIntakeLoweringResult 的权威定义）
2. D:\tileSim\src\Core\RunIntakeLowering.cpp:221-257
3. D:\tileSim\src\apps\TileSimCLI.cpp:138-157
4. D:\tileSim-web\docs\F9_AGENT_ORCHESTRATION\24_PHASE2C_WORK_PACKAGE_PROMPTS.md §4.2.1 —— 本工作包存在的理由

现状（三处表示性缺口，逐一关闭）：
- RunIntakeIssue 有 5 个字段（code / message / field_path / blocking / safe_next_action，
  RunIntakeLowering.h:74-80），但 serialize_run_intake_issues（RunIntakeLowering.cpp:253-257）只输出三个：
  code、field_path，以及**硬编码的** "blocking":true —— message 与 safe_next_action 被静默丢弃，
  blocking 的真实值也被覆盖。lower_run_intake_v2 实际构造的 message（例如
  "Profile records are unavailable (0/unavailable): model"）与 safe_next_action
  （例如 "publish an audited Profile record and bind it"）都是可操作的权威指引，必须如实输出。
- 三个 lowering 标志 workload_lowered / execution_lowered / runtime_available
  （RunIntakeLowering.h:87-89）**没有任何出口**，调用方无从区分「哪一步没做成」。
- 退出码语义丢失：TileSimCLI.cpp:138-157 用 `return 1` 同时表达「判定为 blocked」「缺少 --run-intake 参数」
  「内部异常」三种完全不同的情况，调用方无法在不解析 stdout 的前提下区分。

要求：
1. serialize_run_intake_issues 输出完整五字段，且 blocking 输出真实值（不要硬编码 true）。
   保持输出是**单个 JSON 对象**、可被现有解析器直接消费；对 message / safe_next_action 做与既有代码
   同风格的 JSON 字符串转义（参考 WindTunnel.cpp 的 escape_json_string 用法）。
2. 在同一 JSON 对象里输出三个 lowering 标志（字段名自定，但必须在回传里给出选择与理由），
   使「parse 成功但 lower 被阻塞」与「parse 失败」可区分。
3. 让「blocked」与「工具失败」在退出码层面可区分（例如 blocked 用一个专用非零码，参数/内部错误保持 1）。
   这是 CLI 契约变更，必须同步更新 docs/ 里对该命令的描述；如果你判断后端仓库当前没有合适的文档承载点，
   在回传里明确指出「需要 D:\tileSim-web 侧文档同步」，不要自行去改 web 仓库。
4. 不改变任何既有判定逻辑：不得把 blocked 改判为 accepted，不得新增/删除 issue 条目，
   不得为了「输出好看」而润色 message 或 safe_next_action 文案。
5. 补测试：至少覆盖 (a) 五字段完整输出与转义、(b) blocking 真实值、(c) 三个 lowering 标志的取值、
   (d) blocked 与工具失败的退出码可区分。

完成后运行 D:\tileSim 仓库自身的门禁（`D:\tileSim\AGENTS.md` 规定的构建与测试命令），
并在回传里贴出实际执行的命令与结果；未跑的门禁必须标注为 not-run，不得写成 passed。
回传格式沿用 24_PHASE2C_WORK_PACKAGE_PROMPTS.md 第 5 节的七节结构，并明确回答：是否修改
D:\tileSim-web 任何文件（否）；是否新增或修改 HTTP 路由（否）；是否改动 Run Intake 判定语义（否）。
```

### 6.4 `WP-2D-04`（缺陷收口批次：`DEF-BUSY-RACE-001` + 五态语义残留，**无前置，可立即派发**）

本包两部分都是 §6.1.2 与本文件「残留观察」的收口，且与契约窗口无关。它**不占用 `WP-2D-03` 的编号**：2D-03 仍是
C3 输入面（依赖 Profile 数据，提示词未写）；本包因零前置且阻塞门禁（全量 e2e 长期不可用）而提前派发。

```text
你是 TileSim Web 仓库（D:\tileSim-web）的前端实现 Agent。本次只做工作包 WP-2D-04「缺陷收口批次」。
它由两个**互相独立**的部分组成：A = 修 DEF-BUSY-RACE-001（P0，让全量 e2e 恢复可用）；
B = 收口五态 availability 语义残留（P1）。两部分都只允许改前端，禁止扩展到 C1/C2/C3，禁止顺手优化无关代码。
若其中一部分无法完成，必须分开报告，不得用另一部分的绿灯掩盖。

背景与依据（必读，按顺序）：
1. D:\tileSim-web\AGENTS.md、D:\tileSim-web\docs\AI_HANDOFF.md；回传格式与退回条件借用
   D:\tileSim-web\docs\F9_AGENT_ORCHESTRATION\24_PHASE2C_WORK_PACKAGE_PROMPTS.md 的第 5 节与第 7 节
   （只借格式，不要执行该文件里的 2C 工作包）。
2. D:\tileSim-web\docs\architecture\BACKEND_SIMULATION_FLOW_UI_COVERAGE.md —— §6.1.2 第 3 条是 A 部的定因与
   DEF-BUSY-RACE-001 的定义；§6.1.2 末尾「残留观察」第 1、2 条是 B 部的范围来源；§6.1.1 是本包的上游验收结论。
3. A 部必读代码：src/store/dashboard.ts（:103-137 是缺陷所在）、src/store/dashboard-runs.ts（:19-32、:34-47）、
   src/store/dashboard-state.ts、src/App.vue（:239-264 的 route watcher 与 navigationUnavailable、:330 的 .global-busy）、
   tests/unit/dashboard-navigation-race.test.ts（**已存在的竞态测试，必须先读**）、
   tests/e2e/dashboard.spec.js（:2079 起的用例、断言在 :2095）。
4. B 部必读代码：src/adapters/dashboard-view-model.ts（:4-14 的 unavailable() 是五态唯一来源）、
   src/features/report-coverage/{availability.ts,index.ts,types.ts,model/shared.ts}、
   src/features/report-coverage/components/AvailabilityBadge.vue、
   src/features/execution-inspector/components/LayerRecordTable.vue、
   src/features/structured-report/render-html.ts、src/features/f7-analysis/{model.ts,presentation.ts}、
   src/views/DesignSpaceView.vue、src/contracts/report-model.ts（:610）。
5. 后端只读参考（禁止修改）：D:\tileSim 下与上述字段语义相关的头文件，仅在需要核实语义时读。

=== A 部：DEF-BUSY-RACE-001（必修，P0）===

缺陷定义（已在验收阶段定因，不要重新猜）：src/store/dashboard.ts:103-137 中，:104 先
`++routeSynchronizationRevision`，随后 :107 / :109 / :110 / :115 存在若干**提前返回**路径；而 :135 的 finally
只在「自己仍是最新 revision」时才把 state.busy 置回 false。因此：一次 run-evidence 同步只要在飞行中被任何后续导航
取代、且该导航走的是提前返回路径（自己不发起 fetch），state.busy 就**永久停在 true**，.global-busy 一直留在 DOM。
e2e:2079 的路径正是 openFixture(..., "execution") 的同步尚未落地时就点了「校准与追踪」
（→ /evidence-lab，:107 提前返回，但 :104 已 bump revision）。

A-1. 先复现，再改代码（顺序不可颠倒，必须留证据）。
在已存在的 tests/unit/dashboard-navigation-race.test.ts 中新增用例（复用该文件已有的 deferred() 与
`vi.mock("../../src/features/run-evidence")` 结构），至少覆盖：
  state.bridge.connected = true；state.runId = null；
  令 fetchRunEvidence("run-slow") 返回一个未决 promise；
  const p1 = synchronizeNavigation("execution", "run-slow");   // busy = true，飞行中
  const p2 = synchronizeNavigation("evidence_lab", null);      // :104 bump → :107 提前返回
  解开该 promise；await p1; await p2;
  断言 state.busy === false。
当前实现下这条断言**必须失败**。把改前的失败输出（用例名 + 期望/实际）原样贴进回传作为复现证据。

A-2. 必须为下面四种「取代后自己不发起 fetch」的终态各钉一条断言（可合并在两三条用例内，但四种情形都要覆盖）：
  (a) view === "evidence_lab"（:107）；(b) requestedRunId === state.runId（:109）；
  (c) !requestedRunId → resetDemo（:110-114）；(d) !state.bridge.connected（:115）。

A-3. 不变式（硬要求，违反即退回）：
  (i) 被取代的那次同步不得再写 state.busy（既不清零也不置位）。该语义已由既有测试
      tests/unit/dashboard-navigation-race.test.ts:37-59（"keeps the busy state until the newest run request settles"）
      钉住，**不得放宽、删除或改写它的断言语义**（可以改名或追加断言）。
  (ii) 任何一次导航到达终态后，state.busy 不得停留在**更早一次同步**遗留的 true —— 即不允许孤儿 busy。
  (iii) state.busy 是**跨模块共享**标志：src/store/dashboard-runs.ts:34-47 的 openRun() 也会置位/清零，且**没有 revision
      守卫**；同文件 :19-32 的 loadHistory() 用的是 state.history.loading，**不要**把它并进 busy。你的修复不得让导航在
      openRun() 飞行中提前清掉 busy（提前清零同样是语义错误，只是方向相反）。若你选择「revision bump 时直接清零」这类
      写法，必须论证并测试 (iii) 不成立：openRun() 先 state.busy = true，await 期间发生一次导航，断言 busy 仍为 true。
  (iv) 不得改变 state.busy 所有既有读取点的语义：src/App.vue:244（navigationUnavailable 的三项合取）、
      src/App.vue:330（.global-busy）、src/store/dashboard-state.ts:22（busy: toRef(session, "busy")）。

A-4. 修法自由（守卫 / 计数 / 所有权令牌 / 显式释放均可），但必须在回传里给出「为什么这个改法同时满足 (i)(ii)(iii)(iv)」。
  新增状态（若需要）放在 src/store/dashboard-state.ts 或新建的独立模块；**禁止**把状态重新集中回 src/store/dashboard.ts
  （AGENTS.md 明令它是兼容 controller）。本包在 store 层**只允许**改 src/store/dashboard.ts、src/store/dashboard-runs.ts、
  src/store/dashboard-state.ts 这三个文件。

A-5. 可选但允许：若你发现 openRun() 存在对称问题（两次并发 openRun 时先完成的那个先清零 busy），可以在**同一不变式**下
  一并修，但必须单独一条测试 + 单独在回传里说明。不要顺手改其它无关逻辑。

A-6. e2e 验证（必须实跑，不得口头断言）：
  - 定向：至少跑 dashboard.spec.js:2079「Week 7 evidence chain exposes calibration, lineage, and deterministic
    orchestration」（断言在 :2095），以及所有会经过 execution / evidence 记录表的用例。
  - 全量：node node_modules/@playwright/test/cli.js test --workers=1 --reporter=list（本机实测可用形式；
    workers=2 的 `worker process did not exit within 300000ms` 是**既有环境缺陷**，不要求你修，但不得因它而谎报 passed，
    该跑法按 incomplete 报告）。
  - :2079 必须在**定向与全量两种跑法下都绿**，每种至少重复 3 次；把每次的结果行原样贴进回传。
  - 若仍红：必须贴出失败断言与 test-results/<dir>/error-context.md 的相关片段，并明确把该部标为 not-done。

A-7. 禁止的「修法」：放宽任何 expect、加 waitForTimeout 之类等待来盖住竞态、在 e2e 里 mock 掉 fetchRunEvidence、
  删除或弱化 :2095 断言、改 .global-busy 的显示条件或 CSS 让它不渲染。若你的结论是「不动测试就绿不了」，那就是没修好。

=== B 部：五态 availability 语义残留收口（必修，P1）===

背景：AGENTS.md 要求严格区分 0 / missing / expected_absence / not_covered / unsupported_schema。WP-2D-01 已把
报告级字段的五态修好，但仍有若干路径把可区分的状态压成二态或统一占位符。范围**严格限定**为下面四条，不得扩大；
发现新的压态点只写进回传的「残留观察」，不要改代码。

B-1（必修，语义缺陷）：src/features/report-coverage/model/shared.ts:127-141 的 cell() 把行级单元格的 availability
  硬编码为 `present ? "available" : "missing"`，从不调用 availabilityFor() / unavailable()。可证后果：当
  bundle.compatibility[kind].supported === false（unsupported_schema），或 resolution_entries 判定 not_covered /
  expected_absence 时，**同一列表的容器**显示相应状态，而它下面的**每个单元格**都显示「缺失」——
  src/adapters/dashboard-view-model.ts:4-14 本可给出正确状态，是 cell() 没有去问。
  要求：
  - 行级单元格的 availability 必须来自与字段级**同一个解析器**（availabilityFor(value, () => unavailable(scope.bundle,
    scope.kind, scope.subsystems))），或来自后端对条目自身的显式声明；`extra` 显式覆盖仍优先级最高。
  - cell() 目前没有 scope 形参，调用点分布在 model/{run,metrics,validation,tail,envelope}.ts。允许为此做小范围签名调整，
    但**不得**改变任何字段的文案内容（availability 文案除外）、列集合、列顺序，也不得改 CoverageCell 的既有字段名。
  - 必须保持：0 / false / [] / "" 一律 available（tests/unit/report-coverage.test.ts 已钉住，不得放宽）。
  - 必须新增测试钉死三种情形：unsupported_schema 的 bundle 下，列表容器与其单元格**同为** unsupported_schema；
    已知 expected_absence / not_covered 的位置不得显示为 missing；**报告确实未写出且无其它信息**时仍为 missing。
  - 禁止反向造假：不得把「后端未声明」的缺失猜成 expected_absence 或 not_covered。

B-2（必修，导出路径一致性）：src/features/structured-report/render-html.ts:67-83 是同一 ExecutionRecord[] / facts
  结构的**导出 HTML** 渲染路径，:78 的 `fact ? display(...) : t("不适用")` 与屏幕版会给出不一致的文案。
  要求：两条路径对同一 record/fact 给出**同一 availability 文案与同一 tone 类**；:78 现在用的
  availabilityClass(fact?.value) 只按值判断，必须改为按解析后的状态判断。

B-3（必修）：src/features/execution-inspector/components/LayerRecordTable.vue:50-61 把缺席事实渲染成 t("不适用")，
  并用 `record-value--missing` 这个**二元类名**；status 未知时回退 `—`。要求：改为经
  src/features/report-coverage/index.ts 公共出口解析出的五态之一（该出口已导出 AvailabilityBadge 与
  availabilityLabel / availabilityDescription / availabilityTone / availabilityStates），五态在文案与 tone 上必须互相
  可区分；**禁止**再用统一占位符表达缺席。
  - feature 之间必须走公共 index.ts（node scripts/check-frontend-dependencies.mjs 会检查），不要深入 report-coverage 内部文件。
  - AvailabilityBadge 默认是「标签 + 长描述」两行形态；表格单元格里请用 compact，或在行内以 label + title 表达，
    不要撑破表格，且必须能通过既有的 expectNoUnexpectedTextOverflow(page) 断言。

B-4（诊断优先，允许判定为「无需修改」）：src/features/f7-analysis/presentation.ts:44-48 的
  metricValue(value, unit, available) 与调用点 src/views/DesignSpaceView.vue:252、:258。这里的 available 来自
  src/contracts/report-model.ts:610 的 `metric_availability?: { ttft?: boolean; tpot?: boolean }` —— **契约本身只有布尔**，
  前端无法知道它是五态里的哪一种。要求：
  - 禁止为了「凑成五态」而臆造状态（不得把 false 断言为 not_covered / expected_absence / unsupported_schema）；
  - 允许的最小改动是让文案不再声称「不适用」这一具体原因（改为不预设原因的表述并保留字段来源）；
    **也允许**你判定「契约层面只有布尔、前端无信息可分派」而保持原状 —— 但必须在回传里给出理由与依据行号；
  - src/views/DesignSpaceView.vue:44 的 `availability !== "available" ? (...) : "未执行"` 同属此条：先读
    src/features/f7-analysis/model.ts 与该字段的后端出处，判断它拿到的 availability 到底有几态；
    **只有当信息来源确实能区分五态、而代码把它压成两态时**才算缺陷；
  - 若结论是需要契约补强（例如 metric_availability 应为枚举），只能登记为 C2 后续项写进回传，
    **本包禁止改任何契约**（2D 轨道的契约窗口当前关闭）。

=== 硬性语义要求（A、B 共同适用，违反即退回）===
- 前端只做展示、校验、索引、排序、分组与可追溯的显示级换算（identity / unit_conversion / count / deduplicate）；
  禁止重算或补造任何模拟指标；64 位 ps/bytes 必须走无损 JSON 路径，显示换算保留原始列。
- 五态必须互相可区分，不得把某一态显示成另一态（尤其：不得把 unsupported_schema / not_covered / expected_absence
  显示为 missing，也不得把 missing 显示为「不适用」）。
- 新增文案写入 src/i18n/workstreams/（不要扩大共享 legacy catalog）；页面引导定义归 src/features/guided-help/ 所有。
- view 只做页面编排，不直接调用 bridgeApi、不导入其它 feature 内部文件；components/ui 不得访问 store / feature / Bridge / schema。

=== 硬边界（违反即退回）===
- 禁止新增、修改或删除 bridge/contracts/ 下任何 .json；完成后 SCHEMA_SET_REVISION 必须不变（实测前缀 sha256:d498092a）。
- 禁止改动 bridge/ 下任何 .py；禁止新增或修改任何 HTTP 路由；不得产生端点行为变化。
- 禁止修改 D:\tileSim（后端仓库）任何文件。
- 禁止新增 artifact 请求或 Bridge 调用；本包不得引入新的数据来源。
- 本包允许改动的 store 文件仅限 src/store/dashboard.ts、src/store/dashboard-runs.ts、src/store/dashboard-state.ts；
  禁止把状态重新集中回 dashboard.ts。
- 禁止 commit / push / deploy / stage；禁止 reset、clean、stash 或任何覆盖式 checkout。工作树当前含多个
  **已验收但未提交**的工作包（WP-2C-01a/01b、WP-2C-02 服务层、WP-2C-06、WP-2D-01），已在 bridge/**、src/**、
  tests/** 留下改动；这些改动一律**只读保护**，不得回滚、覆盖或代为提交。
- 禁止触碰 127.0.0.1:5173；禁止读取或输出任何 credential；禁止调用 live Provider；禁止创建 run、禁止写 runs/。
- 禁止为了让 e2e 或单元测试变绿而放宽、删除或跳过任何既有断言。

=== 完成后运行（本机 pnpm 可能不在 PATH；下列 .CMD 形式已实测可用，若 shell 不支持再改用等价 node 直调并说明）===
  cd d:/tileSim-web && node scripts/generate-contract-types.mjs --check
  cd d:/tileSim-web && node scripts/generate-bridge-client.mjs --check
  cd d:/tileSim-web && node scripts/check-doc-links.mjs
  cd d:/tileSim-web && node scripts/check-frontend-dependencies.mjs
  cd d:/tileSim-web && ./node_modules/.bin/vue-tsc.CMD --noEmit
  cd d:/tileSim-web && ./node_modules/.bin/vitest.CMD run
  cd d:/tileSim-web && ./node_modules/.bin/eslint.CMD src tests scripts bridge
  cd d:/tileSim-web && ./node_modules/.bin/vite.CMD build
  cd d:/tileSim-web && ./node_modules/.bin/prettier.CMD --check <你新增或修改的每一个文件>
  cd d:/tileSim-web && git diff --check
  cd d:/tileSim-web/bridge && <python> -m unittest test_server.py
  cd d:/tileSim-web && node node_modules/@playwright/test/cli.js test --workers=1 --reporter=list
  git status --porcelain bridge/contracts            （必须无变化）

格式约定：仓库当前 `prettier --check .` 有 **37 个既有不合规文件**（.playwright-cli/、output/playwright/、
phase2 的若干 *.json、.workbuddy/memory/*.md 等）。它们**不是本包造成的，禁止顺手修或 --write 全仓**。
你新增或修改的每个文件必须自己 prettier-clean（对该文件 --write 再 --check），且不得产生无关 diff。

测试要求：
- A 部：先复现后修复（改前失败输出必须在回传里）；四种取代路径都有断言。
- B 部：每个被改的渲染路径至少一条测试；五态不得互相混淆；B-1 的三种情形各有用例。
- 既有断言不得放宽或删除，尤其 tests/unit/dashboard-navigation-race.test.ts、
  tests/unit/report-coverage.test.ts、tests/components/report-boundaries.test.js。
- 前端基线（2026-09-18 实测）：**580 passed / 8 skipped**，只允许增加，不允许减少或跳过。
- Bridge 基线：python -m unittest test_server.py → Ran 143 tests … OK，本包不得使其变化。

按 24_PHASE2C_WORK_PACKAGE_PROMPTS.md 第 5 节的七节结构回传，并明确回答：
- A 部：改前的复现失败输出与改后输出；四种取代路径的断言位置；所选不变式实现及其对 (i)(ii)(iii)(iv) 的论证；
  :2079 在定向与全量下各 3 次的原始结果行；全量 e2e 的最终 tally，或 incomplete 的原因。
- B 部：B-1 / B-2 / B-3 各自的 done / not-done 与证据；B-4 的结论（改了 / 判定无需改，附依据行号）。
- 两部分是否都独立完成；若任一未完成，明确写出未完成的范围与原因，不得用另一部分的绿灯掩盖。
- 边界问答（全部须为「否」，否则即为退回）：SCHEMA_SET_REVISION 是否变化；是否新增/修改/删除 bridge/contracts 下 .json；
  是否新增或修改 HTTP 路由；是否修改 bridge/ 下 .py；是否修改 D:\tileSim 任何文件；是否新增 Bridge 调用或 artifact 请求；
  是否创建 run；是否触碰 5173；是否改动 src/store 三个允许文件之外的文件；是否 commit / push / stage。
```

#### 6.4.1 `WP-2D-04` 验收判定（指挥方，2026-09-18）

**结论：通过。** A 部（P0 缺陷）与 B 部（P1 五态残留）各自独立完成，`DEF-BUSY-RACE-001` **关闭**，
**全量 e2e 首次取得干净 tally**，此前「全量门禁长期不可判定」的阻塞解除。

复验方式：不采信回传数字。全部门禁与 e2e 由指挥方自跑；契约指纹按 `server.py:135-144` 的同一算法对工作树与
`git archive HEAD` 快照分别重算，不使用工作树内的计算脚本。

| 复验项                   | 指挥方自跑结果                                                                                                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEF-BUSY-RACE-001` 机制 | 全仓 `\.busy\s*=` **仅剩 1 处写点**（`dashboard-state.ts:63`）；`:112` 取认领、`:142` 释放                                                                                                           |
| 四条提前返回路径行号     | `:114` / `:116` / `:117-121` / `:122` —— 与回传声明**逐条一致**                                                                                                                                      |
| 既有不变式测试           | `dashboard-navigation-race.test.ts:38-60` 逐字未改；该文件对 HEAD 的 diff 为 **+167 / -0**                                                                                                           |
| `2079` 定向 ×3           | 三次全 `2 passed`、`EXIT=0`，**无一次 worker 强杀**                                                                                                                                                  |
| 全量 e2e ×1              | **51 passed / 6 skipped / 0 failed，exit 0，7.1m，无 force-kill**；`2079` = `ok 23`                                                                                                                  |
| 6 条 skipped 归属        | 全部为 `live-week8.spec.js` 的 deployed-Bridge 用例（需部署环境，属预期跳过）                                                                                                                        |
| Vitest                   | **70 files / 595 passed / 8 skipped**（+15 = 7 + 3 + 4 + 1，与工作包范围逐项对齐）                                                                                                                   |
| 其余门禁                 | `vue-tsc` / `eslint src tests scripts bridge` / `prettier` / `vite build` / `deps:check`(255) / `docs:check`(43) / 两个 `contracts --check` / `git diff --check` / Bridge `Ran 143 … OK` 全部 exit 0 |
| 契约指纹                 | 工作树 `sha256:d498092a…abffab`（88 文件）**未变**；`bridge/contracts` 仍是同样的 7 条既有项                                                                                                         |
| `App.vue` 边界           | mtime 09-17 13:29（早于本批次），diff 内**零** `busy` 行 → `.global-busy` 与 `navigationUnavailable` 未被触碰                                                                                        |
| 截图基线                 | 四个 PNG 尺寸与 2D-01 验收值一致，本批次未重建基线；`maxDiffPixelRatio` 未放宽                                                                                                                       |

**一处过程违规已核查，不构成退回，但必须记入纪律**：A-1 要求「改前失败」证据，执行方据称对 HEAD 做过一次
**受控回退再复原**。该动作触及 A 部禁止清单（禁止 `reset` / `clean` / `stash` / 任何覆盖式 checkout）。
指挥方核查结论为「工作树未受损」：`dashboard-navigation-race.test.ts`（+167/-0）与 `dashboard-state.ts`（+63/-0）
对 HEAD 均**只增不减**；`src/store/**` 在本批次开工前相对 HEAD 干净，其他工作包未在 store 层留改动，故不存在被
覆盖的既有成果；WP-2C-01a/01b、WP-2C-02、WP-2C-06、WP-2D-01 的产物逐项在位。
**指挥方未重跑该回退复现**（重跑等于再次违规），改为代码级核验：被删除的旧逻辑
（`state.busy = true` 位于四条提前返回之后；`finally` 的清零受 `synchronizationRevision === routeSynchronizationRevision`
守卫）在「A 起飞 → B 取代并提前返回」路径下必然留下孤儿 `true`，与新增用例的断言方向一致。
**后续 agent 注意：复现必须在副本（如临时目录 / 独立 worktree）中进行，不得对工作树任何文件做覆盖式 checkout。**

**本批次新登记的三条残留（均不阻塞验收）**

1. `structured-report/render-html.ts:68` 的 `renderKeyValues()` 仍用二元 `availabilityClass()`——它渲染的是**裸
   key/value dump**（如「请求选择」），没有 Coverage record，因此没有五态解析器可用。执行方已如实上报。
   若要与五态统一，需先裁定「无 Coverage record 的裸字典」应落到哪一态，属语义裁决而非实现问题。
2. **屏幕与导出的状态列仍不一致**：`LayerRecordTable.vue:67-72` 对未报告状态给 `missing` 徽章，而导出
   `render-html.ts:81` 仍是 `record.status || "—"`。B-2 的范围只覆盖事实单元格，此项未被纳入，属 B 部的尾巴。
3. `report-coverage/model/shared.ts` 的 `buildList()` 在 `resolution_entries` **存在**时把容器判为 `available`，
   而同一列表的单元格可判 `unsupported_schema`（已被 `report-coverage.test.ts:139-160` 显式钉住）。
   即「容器说已提供、单元格说不支持的 Schema」可以同时出现。这是容器级语义口径问题，建议由指挥方裁定是否收紧。

#### 6.4.2 三条残留裁定（指挥方，2026-09-18）

裁定方式：逐条回到代码实测（不引用验收文字）。**裁定结果与验收阶段登记时的直觉相反——只有第 ② 条是真缺陷，
① 与 ③ 都应维持现状**；一次「顺手统一五态」的改动会在 ① 处制造出比现状更差的不一致。

| 残留                                     | 实测锚点                                                                                                                    | 裁定                                                     | 依据（逐条实测）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ① 裸字典仍用二元 `availabilityClass()`   | `render-html.ts:47-49`；调用点 `:68`（`renderKeyValues`）、`:197`（`renderChecks`）                                         | **维持现状**，并在此明示为「唯一允许保留的二元渲染点」   | 两个调用点都不携带 backend scope（拿不到 bundle / kind / subsystems），**不可能**解析出 `not_covered` / `expected_absence` / `unsupported_schema`，可得状态集恰为 `{available, missing}`。更关键的是：该 helper 的谓词（`null \|\| undefined \|\| "" \|\| "—"`）与同站点 `display()`（`:36`）的谓词**逐字相同**，class 与文案**同源**；而共享解析器 `availabilityOfValue()`（`availability.ts:63-72`）只把 `undefined \| null` 判缺失，**会**把 `""` 与 `"—"` 判成 `available`。因此「改用共享解析器」会让这两个值变成 available 类而文案仍是「缺失」，反而制造新的 class 与文案不同源。此条**不得**改动。 |
| ② 导出状态列与屏幕不同规则               | 屏幕 `LayerRecordTable.vue:67-72`；导出 `render-html.ts:81`（`record.status \|\| "—"`）                                     | **真缺陷，须修**（`WP-2D-05`，§6.5）                     | 三个可复现差异：(a) 未报告状态（`undefined \| null \| ""`）导出成 `—`，正是 WP-2D-01/04 明令禁止的合并占位符；(b) `record.status === "unknown"` 被原样印成 `unknown`，而屏幕判它为「未报告」→「缺失」态；(c) 屏幕的 `StatusPill`（`components/StatusPill.vue:10`）文案经 `lib/format.js:56-88` 的 `statusLabel()` 翻译（`reported` → `有报告记录`）、tone 经 `statusTone()`，导出却直接印裸 token。屏幕侧早有钉住用例 `tests/components/layer-record-table.test.ts:67-79`（断言状态列 `not.toBe("—")`），导出侧既无实现也无用例——这是 B-2「同文案同 tone」的尾巴。                                         |
| ③ `buildList()` 容器级 availability 口径 | `shared.ts:163`（容器走 `availabilityFor(values, …)`，与 `field()`/`cell()` 同一条裁决）；`report-coverage.test.ts:139-160` | **维持现状，不收紧**；口径在此写死，**不得**改该钉住用例 | 容器与单元格回答的是**两个不同问题**：容器 =「后端是否提供了该集合」，单元格 =「该字段是否可解析」。`availabilityFor` 的既有裁决是「存在即 `available`（含 `0` / `false` / `[]`、含空数组），缺席才解析原因」，容器沿用它才与 `field()`/`cell()` 自洽。若在 `withEntries` 情形把容器也压成 `unsupported_schema`，反而会掩盖「条目确实存在、已渲染 N 条」这一事实。`unsupported_schema` 的语义是「**该字段**未解析」（`availability.ts:32`），不是「整份报告作废」——同一 bundle 下 `subsystem` 单元格判 `available`（`report-coverage.test.ts:159`）即为此口径的证据。                                      |

**对「统一五态」的纪律性结论**：五态统一的目标是「不得把某一态显示成另一态」，**不是**「每个渲染点都要能产出五个态」。
渲染点能产出的状态集由其可获得的后端 scope 决定；scope 不足时**只能**输出 `{available, missing}`，
臆造其余三态属补造。① 与 ③ 都属此类，故裁定维持并在文档中固定口径。

---

### 6.5 `WP-2D-05`（导出状态列收尾，**无前置，可立即派发**）

§6.4.2 把三条残留收成**一条必修项**（残留 ②）：导出侧记录状态列未走屏幕同规则。① 与 ③ 已裁定维持现状，
本包**不得**顺手改。范围只有一个函数的一列，外加一条测试。本包不占用 `WP-2D-02` / `WP-2D-03` 的编号。

```text
你是 TileSim Web 仓库（D:\tileSim-web）的前端实现 Agent。本次只做工作包 WP-2D-05「导出状态列收尾」。
范围只有 `src/features/structured-report/render-html.ts` 的 `renderRecords()` 状态列一处，外加对应测试。
这是 WP-2D-04 B-2「导出 HTML 与屏幕同文案同 tone」的尾巴。

=== 缺陷事实（已由指挥方实测，不要在别处找原因）===
- 屏幕侧：src/features/execution-inspector/components/LayerRecordTable.vue:67-72
  `record.status && record.status !== "unknown"` 时渲染 `<StatusPill :value="record.status" />`，
  否则渲染共享「缺失」态徽章（等于 availabilityOfValue(null) 的 label / tone / description）。
  钉住用例：tests/components/layer-record-table.test.ts:67-79（断言状态列 not.toBe("—")）。
- 导出侧：render-html.ts:81 仍是 `<td>${escapeHtml(record.status || "—")}</td>`。三个后果：
  (a) 未报告状态（undefined / null / ""）导出成 `—`，正是 WP-2D-01/04 明令禁止的合并占位符；
  (b) `record.status === "unknown"` 被原样印成 `unknown`，而屏幕判它是「未报告」；
  (c) StatusPill 的文案经 src/lib/format.js:56-88 的 statusLabel() 翻译（例：reported → 「有报告记录」），
      tone 经 statusTone()，导出却印裸 token（`reported`）→「同文案」不成立。

=== A 部（本包唯一必须完成的部分）===
A-1 导出状态列改为与屏幕「同规则」（改在 render-html.ts 的 renderRecords() 内）：
  (i) `record.status` 存在且 !== "unknown" → 文案走 statusLabel(record.status)，与屏幕同源；
  (ii) 否则 → 渲染共享「缺失」态：文案 availabilityLabel("missing")、class
       `availability availability--${availabilityTone("missing")}`、title 为
       availabilityDescription("missing")，与同函数事实单元格（:87-94）同一写法
       （也可直接用 availabilityOfValue(null) 取态，与 LayerRecordTable.vue:39 一致）；
  (iii) 删掉 `|| "—"` 兜底，不保留「兜底再判」的双路径，也不换成「不适用 / N/A / -」等任何通用占位符。
A-2 tone 与屏幕同源：已报告状态不得套「缺失」徽章样式；若要为已报告状态上 tone，必须来自
  statusTone(record.status)（其返回值与 AvailabilityTone 是同一套词表 positive|neutral|warning|danger，
  可复用导出 CSS 已有的 `.availability--{tone}` 规则，见 render-html.ts:293）。
  不得为 tone 新增颜色常量，不得改 css() 里既有规则。
A-3 测试（tests/unit/structured-report.test.ts）：在既有 availability 用例（:318-334）旁新增一条，至少断言：
  - 未报告状态（含 status: "unknown" 的记录）在导出里出现 availabilityLabel("missing") 的文案与
    `class="availability availability--${availabilityTone("missing")}"`，且不出现 `>unknown<`；
  - 状态列不再产生 `—`（按该列实际输出形式断言，例：not.toContain(">—</td>")；若你发现更精确的形式，在回传说明）；
  - 已报告状态出现 statusLabel(<该状态>) 的译文，且该单元格不套缺失徽章。
  用例名必须能表达「屏幕与导出同规则」，不得只断言一个字符串。

=== 明确不做（指挥方已裁定，做了即退回）===
- render-html.ts:47-49 的二元 availabilityClass() 与其两个调用点 :68（renderKeyValues）、:197（renderChecks）
  保持现状。理由：这两个渲染点不携带 backend scope，可得状态集恰为 {available, missing}；且该 helper 的谓词
  （null|undefined|""|"—"）与同站点 display()（:36）逐字相同、class 与文案同源。若改用共享的
  availabilityOfValue()（只把 undefined|null 判缺失），"" 与 "—" 会变成 available 类而文案仍是「缺失」，
  反而制造新的不一致。这是唯一允许保留的二元渲染点，不要动、也不要「顺手删掉死代码」。
- src/features/report-coverage/** 全部保持现状：buildList() 的容器口径维持（容器答「集合是否被提供」，
  单元格答「字段是否可解析」，是两个问题）。不得改 report-coverage.test.ts:139-160。

=== 硬边界（违反即退回）===
- 只允许修改两个文件：src/features/structured-report/render-html.ts、tests/unit/structured-report.test.ts。
  若要新增测试文件，须在回传说明理由。
- 禁止修改：src/features/report-coverage/**、src/store/**、src/views/**、src/components/**、
  src/lib/format.js、src/adapters/**、src/contracts/**、src/i18n/**、src/App.vue。
- 禁止把 StatusPill.vue 或任何 .vue 引进 structured-report（该模块会被 vite build 打进 worker 包，引 Vue 组件
  会让构建报 import analysis 失败——WP-2D-04 已在 report-coverage 上踩过同一坑，当时的修法是拆出纯 TS 的
  model-api.ts）。引用 statusLabel / statusTone 时只从 src/lib/format.js 取；若它牵连 Vue，停手回传，不要改它。
- 禁止新增、修改或删除 bridge/contracts/ 下任何 .json；完成后 SCHEMA_SET_REVISION 必须不变
  （实测前缀 sha256:d498092a，88 个 json）。禁止改 bridge/ 下任何 .py；禁止改 D:\tileSim。
- 禁止新增 Bridge 调用、artifact 请求或任何新数据来源；禁止新增/修改 HTTP 路由；禁止创建 run、禁止写 runs/。
- 禁止 commit / push / deploy / stage；禁止 reset、clean、stash 或任何覆盖式 checkout。需要对照 HEAD 或其它
  版本复现时，把内容读到仓库外的临时目录再做，不得对工作树做覆盖式检出。工作树含多个已验收但未提交的工作包
  （WP-2C-01a/01b、WP-2C-02 服务层、WP-2C-06、WP-2D-01、WP-2D-04），一律只读保护，不得回滚、覆盖或代为提交。
- 禁止触碰 127.0.0.1:5173；禁止读取或输出任何 credential；禁止调用 live Provider。
- 禁止为了让测试变绿而放宽、删除或跳过任何既有断言，尤其：
  tests/components/layer-record-table.test.ts:67-79、tests/unit/structured-report.test.ts:318-334、
  tests/unit/report-coverage.test.ts:139-160。

=== 完成后运行（本机 pnpm 可能不在 PATH；下列形式已实测可用）===
  cd d:/tileSim-web && node scripts/generate-contract-types.mjs --check
  cd d:/tileSim-web && node scripts/generate-bridge-client.mjs --check
  cd d:/tileSim-web && node scripts/check-doc-links.mjs
  cd d:/tileSim-web && node scripts/check-frontend-dependencies.mjs
  cd d:/tileSim-web && ./node_modules/.bin/vue-tsc.CMD --noEmit
  cd d:/tileSim-web && ./node_modules/.bin/vitest.CMD run
  cd d:/tileSim-web && ./node_modules/.bin/eslint.CMD src tests scripts bridge
  cd d:/tileSim-web && ./node_modules/.bin/vite.CMD build
  cd d:/tileSim-web && ./node_modules/.bin/prettier.CMD --check src/features/structured-report/render-html.ts tests/unit/structured-report.test.ts
  cd d:/tileSim-web && git diff --check
  cd d:/tileSim-web/bridge && <python> -m unittest test_server.py
  cd d:/tileSim-web && node node_modules/@playwright/test/cli.js test --workers=1 --reporter=list
  git status --porcelain bridge/contracts            （必须无变化）

基线（2026-09-18 实测，只允许增加不允许减少）：Vitest 595 passed / 8 skipped（70 files）；
Bridge `Ran 143 tests … OK`；全量 e2e 51 passed / 6 skipped / exit 0（6 条 skipped 全属 live-week8.spec.js
的 deployed-Bridge 用例）。

=== 回传必须包含 ===
- changed files 与逐处行号；状态列改前 / 改后的实际导出片段（同一 fixture 的同一行）；
- statusLabel / statusTone 的来源行号，以及你如何证明导出与屏幕同源；
- 全部门禁的原始命令与结果行（含 skipped 归属）；
- SCHEMA_SET_REVISION 重算值（必须仍是 sha256:d498092a…abffab，88 个 json）；
- 边界问答（全部须为「否」，否则即为退回）：是否改契约 .json；是否改 bridge/ 下 .py；是否改 D:\tileSim；
  是否新增 Bridge 调用或 artifact 请求；是否创建 run；是否触碰 5173；是否改 features/report-coverage/**；
  是否改 src/store/**；是否改 src/lib/format.js；是否 commit / push / stage；是否对工作树做过覆盖式 checkout；
- 未解决的残留与你自己的判断。

=== 禁止的修法 ===
- 用 display(record.status) 代替状态解析：display() 会把 "" 与 "—" 都变成「缺失」，抹掉「已报告但为空串」与
  「完全未报告」的区别，且 "unknown" 仍会被原样输出；
- 自造第三套徽章/文案表，或把状态列做成事实单元格以外的另一种写法；
- 放宽或删除既有断言；重建快照掩盖 diff；顺手重构其它函数或 CSS。
```

#### 6.5.1 `WP-2D-05` 交付与验收记录（指挥方，2026-09-18）

**结论：已交付并验收通过。** 本包按用户明确指示「你直接改」由**指挥方在同一会话内直接实施**，
因此**不适用**执行方/指挥方分离复验；改为指挥方实施后自跑全部门禁 + 定向 e2e 复跑，并把改动与证据逐条登记在案。

改动集（2 文件，均在 §6.5 允许清单内；未新增任何文件）：

| 文件                                            | 改动                                                                                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/structured-report/render-html.ts` | 新增 `renderStatusCell()`（`:74-90`）；`renderRecords()` 的状态列改调用它（`:100`，原 `record.status \|\| "—"`）；新增 `import { statusLabel, statusTone } from "../../lib/format"`（`:4`） |
| `tests/unit/structured-report.test.ts`          | 新增用例「prints the record status column with the same rule as the on-screen record table」（`:337-370`）；新增 `statusLabel / statusTone` import（`:13`）                                 |

**改前 / 改后实测**（同一 fixture 的同一行；改前 = 被删除表达式的等价复现，改后 = 真实导出输出）：

| `record.status` | 改前                | 改后                                                                                   |
| --------------- | ------------------- | -------------------------------------------------------------------------------------- |
| `"reported"`    | `<td>reported</td>` | `<td class="availability availability--positive">有报告记录</td>`                      |
| `"unknown"`     | `<td>unknown</td>`  | `<td class="availability availability--warning" title="报告未提供该字段；…">缺失</td>` |
| 缺失            | `<td>—</td>`        | 同上（共享 `missing` 态）                                                              |

全仓 `>—</td>` 命中数：**0**（该形态原本只由状态列产生）。`record.status` 的处理点现在全仓只剩 2 处且规则一致：
`LayerRecordTable.vue:68`（屏幕）与 `render-html.ts:82`（导出）。

复验门禁（指挥方自跑）：

| 门禁                              | 结果                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| Vitest                            | **70 files / 596 passed / 8 skipped**（基线 595 + 本包 1 条）                              |
| `vue-tsc --noEmit`                | 0                                                                                          |
| `eslint src tests scripts bridge` | 0                                                                                          |
| `prettier --check`（改动 2 文件） | 0                                                                                          |
| `contracts:check` / `docs:check`  | 0 / 43 篇 0 断链                                                                           |
| `deps:check`                      | 255 源文件 0（新增 `lib/format` 依赖在边界检查内通过）                                     |
| `vite build`                      | 2760 modules，exit 0（含 `structured-report.worker` 317.52 kB —— 未把 Vue 拖进 worker 包） |
| `git diff --check`                | clean                                                                                      |
| Bridge `unittest`                 | `Ran 143 tests … OK`                                                                       |
| `SCHEMA_SET_REVISION`             | 复算 `sha256:d498092a…abffab`（88 json）**未变**；`bridge/contracts` 仍是同样 7 条既有项   |

**e2e 结论**：**最终一次全量取得干净 tally** —— `51 passed / 6 skipped / 0 failed，exit 0，6.4m，无 force-kill`，
覆盖全部 **57** 条（含 `large-artifact-worker` 的 `artifact-worker.spec.js:4:1`，`ok 57`）；6 条 skipped 全属
`live-week8.spec.js` 的 deployed-Bridge 用例。**与既有基线（`WP-2D-04` 时的 51 passed / 6 skipped）完全一致，无回归。**

同一轮里另外三次运行**都**卡在 worker 收尾（用例已全部跑完、零失败之后出现
`worker-1 process did not exit within 300000ms after stop, force-killed it`，整轮走不到 `exit 0`）。
**已用 A/B 对照实验证明该卡死与本包无关**：把本包两处改动**逆操作回退**（回退后实测
`renderStatusCell = 0`、`lib/format = 0`、旧表达式 `record.status || "—"` 复原），`--project=desktop` 复跑得到
**完全相同**的现象。→ 该 worker 收尾卡死是**间歇性既有环境缺陷**（本会话复现 3 次，其中 1 次在**未改代码**上），
不是本包回归，也**不阻塞**本包。`AGENTS.md` §2 原记「worker 收尾卡死本轮未复现」已按此更新为
「间歇性复发，见本节」。卡死发生在 `desktop → large-artifact-worker` 的项目切换处时，那 1 条 worker 用例会
`not-reached`——本包以「另起一次完整运行覆盖到 `ok 57`」的方式补上，未把 `not-reached` 当作通过。

**一处偶发已定性**：首次全量运行（与全量 Vitest + Bridge `unittest` **并发**时）出现
`dashboard.spec.js:2079` 的 `toHaveURL(/\/metrics\?run=run-fixture-f1$/)` 失败（收到 `/metrics`，5s 超时）。
空载后定向复跑该用例 **×3 全部 `ok`、`EXIT=0`、单条 2.4–2.6s**，判为机器被并发门禁占满导致的偶发，
与 `DEF-BUSY-RACE-001` 及本包均无关。**纪律：全量 e2e 不得与其它重量级门禁并发跑。**

---

## 附录 A：前端逐页展示面

| 页面              | 关键渲染字段                                                                                                                                                                                                                           | 图表                                                           | 明确声明缺失的方式                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Overview          | `run.summary.{end_to_end_latency_us,runtime_event_count,fabric_record_count,validation_completeness}`、`run.bottleneck_report.*`、`metrics.claim_scope_summary`、`metrics.summary.*`、`system_summary.fabric_domain_utilization[0..6]` | 进度条 + 表                                                    | 「未提供瓶颈报告」；「不以请求数或总时长推算」                                                            |
| Execution         | S0–S6 层卡片（`resolution.actual_fidelity`、`evidenceState`）、layer record 表、`execution_envelope.stages` 时间轴、`resource_convergence` 4 计数、checks、attribution                                                                 | ECharts bar/stacked-bar/scatter/timeline/matrix（单图 ≤12 行） | 五态标签 `reported/declaration_only/expected_absence/not_covered/missing` 由 `aggregations.ts:73-86` 判定 |
| Metrics           | `tail_latency_summary.{ttft,tpot,e2e}_ps.{p95,p99}`、`request_metrics[]`、`summary.*`                                                                                                                                                  | latency bar（µs 显示、ps 原值）                                | 「boundary run 可以没有 TTFT/TPOT；missing、not applicable 与真实 0 必须分开」                            |
| Fabric            | `system_summary.{max_fabric_backpressure_delay_us,fabric_utilization_ratio,dominant_*,fabric_observation_window_ps}`、逐域表、逐请求表、topology 卡                                                                                    | 2 张 stacked-bar                                               | 完整 10 态 `availability`（`f7-analysis/model.ts:12-22`）                                                 |
| Attribution       | `tail.{explained_entity,confidence,completeness,attribution_ranking,attribution_audit,cause_chain}`                                                                                                                                    | bar（仅 S0–S6）                                                | S7/S8/S9 归入「输出面」并声明不进入因果排名                                                               |
| Validation        | `completeness`、`open_gaps`、`resolution_entries`、`checks`、`trace_provenance`                                                                                                                                                        | 无                                                             | `semanticFieldPresentation` 区分三种 source_mode；「completeness 是字段覆盖，非准确率」                   |
| DesignSpace       | `candidates[]`（final_rank/objectives/executed_s6_knobs/pareto/dominance）、`analytical_vs_des_disagreements`                                                                                                                          | scatter（可用 objective ≥2 时）否则 bar                        | 「前端不会用 projected 指标重建 Pareto」；`unresolved_not_executed` 显式列出                              |
| History           | `listRuns()` 表 + `ComparisonPanel` 5 指标 + 7 项 policy + 逐请求 diff                                                                                                                                                                 | 无                                                             | Bridge 未连接提示                                                                                         |
| Experiment        | `buildExperimentRequest()` 唯一 builder                                                                                                                                                                                                | 无                                                             | 契约错误即关闭提交；`unknown_or_ambiguous_error_pointer`                                                  |
| Week7Evidence     | `/week7/*` 三个只读示例                                                                                                                                                                                                                | 无                                                             | 「仅证明离线 fixture 工作流一致性，不是真实测量」                                                         |
| EvidenceAgent     | descriptor + run 内引用 + claims/citations                                                                                                                                                                                             | 无                                                             | `insufficient_evidence` / 502 / 503 / 504 / cancelled 分态                                                |
| UnsupportedSchema | `bundle.unsupported` + `rejected_artifacts`                                                                                                                                                                                            | 无                                                             | 本页即 unsupported_schema 专用面（**未注册路由**）                                                        |

## 附录 B：证据索引（关键行号）

| 主题                                | 位置                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CLI 全命令面                        | `D:\tileSim\src\apps\TileSimCLI.cpp:64-361`                                                                                                            |
| `run` 请求结构                      | `D:\tileSim\include\Core\WindTunnel.h:28-46`                                                                                                           |
| 十产物开关                          | `D:\tileSim\include\Core\WindTunnel.h:15-26`、`295-306`                                                                                                |
| 跨层契约链                          | `D:\tileSim\include\Core\PlatformContracts.h:113-172`                                                                                                  |
| 状态所有权映射                      | `D:\tileSim\include\Core\PlatformContracts.h:188-189`                                                                                                  |
| 工作负载描述语言                    | `D:\tileSim\include\S0_Workload\WorkloadDescription.h:21-121`                                                                                          |
| 引擎语义画像                        | `D:\tileSim\include\S1_Runtime\EngineSemanticProfile.h:14-26`                                                                                          |
| 执行片段与 Tile 分区                | `D:\tileSim\include\S2_Execution\ExecutionFragmentBuilder.h:18-51`                                                                                     |
| KV Cache 物理页                     | `D:\tileSim\include\S3_Memory\KVCacheStateMachine.h:20-96`                                                                                             |
| Cycle 窗口契约                      | `D:\tileSim\include\Core\CycleRefinementContracts.h:20-113`                                                                                            |
| 候选探索                            | `D:\tileSim\include\Core\CandidateExploration.h:22-111`                                                                                                |
| 校准工作流                          | `D:\tileSim\include\S8_Validation\CalibrationWorkflow.h:20-96`                                                                                         |
| 证据映射规则                        | `D:\tileSim\include\S9_Metrics\EvidenceContracts.h:16-28`                                                                                              |
| 分层适配与 S7/S8                    | `D:\tileSim\include\Core\LayerAdapters.h:34-308`                                                                                                       |
| 资源收敛                            | `D:\tileSim\include\Core\ResourceConvergence.h:31-43`                                                                                                  |
| Bridge run 命令 allow-list          | `D:\tileSim-web\bridge\services\execution.py:186-226`                                                                                                  |
| Bridge 契约头（报告/文件/工件枚举） | `D:\tileSim-web\bridge\contracts\openapi.json:9-70`                                                                                                    |
| Bridge 报告 Schema（窄契约）        | `D:\tileSim-web\bridge\contracts\schemas\metrics-report.schema.json:6-8`                                                                               |
| 工件清单契约                        | `D:\tileSim-web\bridge\contracts\schemas\artifact-manifest.schema.json:13-64`                                                                          |
| SSE 事件端点（仅 3 种事件）         | `D:\tileSim-web\bridge\server.py:1124-1172`                                                                                                            |
| 前端工件映射表                      | `D:\tileSim-web\src\lib\api\artifacts.ts:50-102`                                                                                                       |
| 前端展示状态机                      | `D:\tileSim-web\src\adapters\report-registry.ts:15-23,68-124,198-229`                                                                                  |
| availability 五态                   | `D:\tileSim-web\src\adapters\dashboard-view-model.ts:3-13`                                                                                             |
| 路由表                              | `D:\tileSim-web\src\app\router.ts:49-67`                                                                                                               |
| runtime artifact 就绪判定           | `D:\tileSim\src\Core\WindTunnel.cpp:276-278`（`boundary_expects_runtime_trace`）、`6194-6207`（`populate_artifact` 的 state 三态）                     |
| 工件写入的硬失败语义                | `D:\tileSim\src\Core\WindTunnel.cpp:6404-6419`、`D:\tileSim\src\apps\TileSimCLI.cpp:304-309`（state ∉ {ready, expected_absence} ⇒ `exit 1`）           |
| runtime artifact 序列化器           | `D:\tileSim\src\Core\WindTunnel.cpp:728+`（`runtime_event_*_to_json`，**不含 `schema_version` / `run_id`**）                                           |
| Bridge 工件契约判定                 | `D:\tileSim-web\bridge\repositories\runs.py:510-577`（`inspect_artifact`）、`580-613`（`_artifact_entries`）                                           |
| Bridge 报告路径注册                 | `D:\tileSim-web\bridge\server.py:126-127`（`REPORT_FILE_NAMES` / `JSON_ARTIFACT_DEFINITIONS`）、`311-312`、`323-331`                                   |
| Run Intake issue 序列化缺口         | `D:\tileSim\src\Core\RunIntakeLowering.cpp:253-257`、`D:\tileSim\include\Core\RunIntakeLowering.h:74-89`、`D:\tileSim\src\apps\TileSimCLI.cpp:138-157` |
