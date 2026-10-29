# 执行回放设计方案

**状态**：设计评审稿，尚未进入实现与正式契约发布

**日期**：2026-10-25

**范围**：电脑网页端 `ExecutionView`、执行证据适配层、必要的 Bridge / 后端 execution replay artifact

**目标**：让用户可以在一次已完成的仿真运行中，自动播放、暂停、拖动时间游标或逐步查看执行过程，并在高层阶段、集合通信、设备与链路三个层级之间切换；所有可见事实都必须能够回到后端 artifact 和精确证据指针。

---

## 1. 决策摘要

TileSim 新增的执行过程能力命名为“执行回放”（Execution Replay）。它不是实时监控器、前端重新仿真器，也不是无证据的拓扑动画，而是：

> 以仿真后端已经产生的全局模拟时间、阶段、运行时事件、集合通信步骤和 Fabric 事件为事实来源，对一次运行进行可控的多层回放。

建议采用“两步走”：

1. **第一阶段不新增正式 contract**：复用已有 `execution_envelope`、`runtime_event_trace`、runtime request summaries、Fabric route evidence 和 metrics phase contributions，先实现高层阶段与运行时事件回放。
2. **第二阶段新增 canonical `execution-replay` artifact**：由后端发布可绑定、可分页、带证据指针的统一回放文档，正式支持 collective round/chunk、跨域阶段、设备到设备路径和链路事件。

这条路线能尽快形成产品亮点，同时不会让前端动画替后端补造事实，也不会把聚合数据误当作逐包 trace。

### 1.1 关键产品承诺

- 自动播放和单步播放都只移动前端回放游标，不重新执行仿真。
- 高层回放在现有 artifact 足够时立即可用；底层能力不足时必须降级为摘要或受控缺失态。
- AllReduce / AllGather 同时区分“逻辑参与者”和“实际物理路径”。
- 没有后端报告的 `actual_path`、`link_id`、`round`、`chunk` 或 `bytes` 时，不生成对应动画。
- 每个可见事件、阶段和路径都可跳回当前 run 的 artifact、SHA-256 和 JSON Pointer。
- synthetic、compatibility harness、real trace 的 provenance 保持原级别，不因可视化而升级。

### 1.2 明确不做

- 不做实时运行监控；
- 不在浏览器内重新运行 TileSim；
- 不根据拓扑配置猜测仿真实际走过的路径；
- 不根据 participant 数量推断 Ring、Tree 或 Hierarchical；
- 不把逻辑 collective 自动转换成物理 packet/flit 流；
- 不把缺少 start/end 的点事件包装成虚假的持续区间；
- 不新增移动端实现或验收范围。

---

## 2. 当前代码和数据事实

本节是实现边界，不是未来假设。结论分为“代码可证”和“设计建议”。

### 2.1 前端已有能力

| 事实 | 现状 | 依据 |
| --- | --- | --- |
| 执行链 | `ExecutionView` 已有分层执行链和选中层详情 | [`src/views/ExecutionView.vue`](../../src/views/ExecutionView.vue) `:269` 附近 |
| 阶段时间轴 | 已有 `execution_envelope.stages` 的统一时间轴和证据链接 | [`src/views/ExecutionView.vue`](../../src/views/ExecutionView.vue) `:513-555` |
| 运行期 artifact | runtime events、summary、requests、analysis 按 manifest 按需读取 | [`RuntimeEvidencePanel.vue`](../../src/features/execution-inspector/components/RuntimeEvidencePanel.vue) `:12-87` |
| Fabric 路径 | 已有 `actual_path`、`link_endpoints`、`execution_events` 的只读适配器 | [`fabric-routes.ts`](../../src/features/execution-inspector/model/fabric-routes.ts) `:82-125` |
| 时间精度 | 项目已有 lossless JSON 路径，`uint64` 不转为不安全 number | [`report-model.ts`](../../src/contracts/report-model.ts) |
| 证据深链 | 图表和记录使用当前 run、artifact、SHA-256、JSON Pointer 绑定 | [`EXECUTION_VISUALIZATION_DESIGN.md`](EXECUTION_VISUALIZATION_DESIGN.md) §3 |

### 2.2 后端已有能力

#### 运行时事件

`tilesim.s1_runtime_event_trace.v1` 已序列化：

- `kind`；
- `request_id`、`batch_id`、`batch_request_ids`；
- `model_execution_call_id`、`iteration_id`；
- `event_time_ps`、`logical_step`；
- `kv_tokens`、`active_requests`；
- `detail`；
- 后端内部还保留 `resource_operation_id`、`network_demand_id`、`feedback_id`、`event_id`。

序列化代码见 `D:/tileSim/src/Core/WindTunnel.cpp:956-996`，正式 schema 见 [`runtime-evidence.schema.json`](../../bridge/contracts/schemas/runtime-evidence.schema.json) `:7-84`。

当前事件类型包括 arrival、admit、batch issue、decode step、KV handoff/swap ready、memory/fabric backpressure、KV grow、complete、reject。它们主要是**点事件**，不能直接当成设备执行区间。

#### Fabric 记录

Fabric execution record 已包含：

- `start_time_ps`、`finish_time_ps`；
- `actual_path`；
- `link_endpoints`；
- `execution_events`；
- queue、congestion、service 和 completion 相关时间；
- retransmission 和 flow-control stall 计数。

序列化见 `D:/tileSim/src/S6_Fabric/ModularFabric.cpp:173-221`，事件种类定义见 `D:/tileSim/include/S6_Fabric/ModularFabric.h:137-158`。

这些记录并非每种 artifact、每条运行路径都以统一的回放文档发布。前端必须根据 manifest 和 artifact 内容决定是否显示路径动画。

#### 集合通信步骤

后端内部的 `CollectiveStep` 已有：

- `step_id`、`demand_id`；
- `phase`；
- `round`、`chunk`；
- source/destination endpoint；
- bytes；
- dependency step IDs；
- earliest ready / completion time。

定义见 `D:/tileSim/include/S5_Collective/CollectiveStateMachine.h:19-32`。

Ring AllReduce 已有 reduce-scatter / allgather 语义，分层路径还会产生 `inter_allreduce`、`inter_allgather`、`su_reduce`、`so_exchange`、`su_distribute` 等阶段。实现见 `D:/tileSim/src/S5_Collective/CollectiveStateMachine.cpp` 和 `D:/tileSim/src/S6_Fabric/ModularFabric.cpp:1023-1103`。

目前 `CollectiveStep` 尚未作为独立、稳定、可分页的 canonical artifact 发布，这是“完整集合通信回放”进入正式实现前的主要后端缺口。

### 2.3 当前能力矩阵

| 能力 | 现有字段 | 首版处理 |
| --- | --- | --- |
| 高层阶段 | `execution_envelope.stages` | 可实现区间回放；缺时间则显示阶段节点 |
| Runtime 事件 | `runtime_event_trace.events` | 可实现点事件回放 |
| 请求 / batch | runtime request summaries 与 event membership | 可实现筛选和联动 |
| 集合通信列表 | `phase_fabric_contributions` | 可实现摘要列表，不伪造细粒度时间 |
| Fabric 区间 | Fabric record 的 start/finish | 有记录时可实现传输区间 |
| 物理路径 | `actual_path`、`link_endpoints` | 有完整路径时高亮或播放 |
| 链路状态 | Fabric `execution_events` | 有完整事件时显示 enqueue/service/complete |
| round/chunk | 后端内部 `CollectiveStep` | 需要 canonical replay artifact |
| 每个 chunk 的 bytes | 后端内部 demand/step | 需要 canonical replay artifact |
| packet/flit | 当前没有统一发布的完整证据 | 不纳入首版 |

---

## 3. 外部方案调研与取舍

### 3.1 参考方案

| 来源 | 借鉴原则 | TileSim 落地方式 | 不照搬的内容 |
| --- | --- | --- | --- |
| [NVIDIA Nsight Systems](https://docs.nvidia.com/nsight-systems/UserGuide/index.html) | 多轨道时间轴、缩放、lane 联动 | 阶段、runtime、collective、device、link 分轨道 | 不引入 profiler 级别的复杂配置 |
| [PyTorch Profiler](https://pytorch.org/tutorials/recipes/recipes/profiler_recipe.html) | 从 operator 到 kernel / communication 的层级下钻 | 概览 → collective → device/link 三层 | 不把 TileSim 事件称作 CUDA kernel |
| [Perfetto](https://perfetto.dev/docs/getting-started/converting) | track、slice、flow arrow、时间游标 | 稳定 track ID、区间 slice、显式 flow relation | 不直接引入完整 Perfetto 存储格式 |
| [Perfetto Buffers](https://perfetto.dev/docs/concepts/buffers) | 大 trace 分块和索引 | Worker 索引、窗口加载、虚拟事件列表 | 不把全部事件一次性挂载进 DOM |
| [Holistic Trace Analysis](https://github.com/facebookresearch/HolisticTraceAnalysis) | compute/communication/idle 分解与重叠查看 | 只展示后端已报告的状态和区间 | 不在前端重算新的模拟指标 |
| [OpenTelemetry Traces](https://opentelemetry.io/docs/concepts/signals/traces/) | 稳定 identity、parent/links、attributes | `event_id`、`sourcePath`、relation、证据属性 | 不把 TileSim 语义改写成通用分布式 trace |
| [NCCL Collectives](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html) | AllReduce、AllGather、ReduceScatter 的语义边界 | 用后端实际 phase 展示集合通信过程 | 不根据操作名推测未报告的算法或路径 |

### 3.2 设计结论

最适合 TileSim 的视觉语言是：

> 多轨道时间轴作为主阅读入口，拓扑作为当前时刻的空间投影，详情面板作为证据入口。

不建议从 3D 网络、粒子、发光流线或持续自动运动开始。那些效果会让页面看起来“动了”，但不能回答“哪个后端事件在什么模拟时间发生”，也容易掩盖缺失数据。

---

## 4. 产品信息架构

### 4.1 执行页布局

执行页只增加一个主模块“执行回放”，不要继续堆叠多个长事件面板。

```text
┌──────────────────────────────────────────────────────────────┐
│ 执行回放  已观测事件回放 / 阶段摘要 / 部分底层证据             │
│ run identity · provenance · fidelity · 覆盖状态               │
├──────────────────────────────────────────────────────────────┤
│ [概览] [集合通信] [设备与链路]     [请求] [通信] [等待]         │
├──────────────────────────────────────────────────────────────┤
│ 上一步  播放/暂停  下一步  阶段跳转  0.25x…8x  时间游标         │
├──────────────────────────────────┬───────────────────────────┤
│                                  │                           │
│        时间轴 + 拓扑画布          │        事件详情            │
│                                  │                           │
├──────────────────────────────────┴───────────────────────────┤
│ 阶段 / Runtime / Collective / Fabric / Device tracks          │
├──────────────────────────────────────────────────────────────┤
│ 事件列表（虚拟滚动、分页、证据深链）                           │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 顶部身份栏

只展示用户真正需要知道的短信息：

- 回放状态：已观测事件回放 / 阶段摘要 / 部分底层证据；
- trace provenance；
- requested / resolved fidelity；
- 当前数据覆盖状态；
- 事件数量和时间范围。

完整 schema、artifact SHA、字段路径和 JSON Pointer 收入“查看证据”抽屉，避免身份信息挤占主画布。

### 4.3 回放层级切换

使用三个固定的一级视图：

1. **执行概览**：回答“运行经过了哪些阶段”；
2. **集合通信**：回答“AllReduce / AllGather 的阶段和参与者如何推进”；
3. **设备与链路**：回答“哪些设备、域和链路正在传输或等待”。

切换层级只改变可见 track 和画布内容，不改变回放游标，也不重新加载不必要的 artifact。

### 4.4 右侧详情

详情面板只展示当前选中对象：

```text
AllReduce · reduce_scatter
当前状态：进行中
模拟时间：12.400–12.460 µs
参与设备：GPU0、GPU1、GPU2、GPU3
当前路径：GPU0 → NIC0 → Switch0 → NIC1 → GPU1
数据量：未报告
证据：查看当前 run 的正式证据
```

后端字段名、原始 ID、完整 JSON Pointer 和 provenance 进入折叠的“查看数据与证据”，不默认占据视觉主层。

---

## 5. 三种可视化层级

### 5.1 执行概览

使用 range bar 时间轴表示真实的 `start_time_ps` / `end_time_ps`。每个阶段包含：

- 当前模块中文名称；
- 阶段状态；
- 开始 / 结束时间；
- 选中状态；
- 证据链接。

已有阶段没有合法时间区间时：

- 不画假的区间；
- 改为 point marker 或“阶段摘要”；
- 显示缺失原因。

Runtime 事件作为 marker 叠加到同一时间轴，使用后端原始顺序，不将点事件扩展为区间。

### 5.2 集合通信

左侧为 collective 列表，中部为 phase / round / chunk 时间带，右侧为当前步骤详情。

#### AllReduce

逻辑层显示：

- collective type；
- collective ID；
- participants；
- participant count；
- domain 分组。

阶段层只显示后端实际产生的 phase，例如：

- `reduce_scatter`；
- `allgather`；
- `inter_allreduce`；
- `su_reduce`；
- `so_exchange`；
- `su_distribute`。

步骤层在字段完整时显示：

- round；
- chunk；
- source / destination；
- bytes；
- dependencies；
- earliest ready / completion；
- 实际 Fabric path。

#### AllGather

展示 participant、round、chunk 和当前传输关系。只有后端报告每个数据段的状态时，才显示“已到达的数据段”；否则只显示步骤和路径，不画数据块填充动画。

#### 逻辑参与者和物理路径必须分栏

```text
逻辑参与者：GPU0、GPU1、GPU2、GPU3
实际路径：GPU0 → NIC0 → Switch0 → NIC1 → GPU1
跨域证据：已报告 / 未报告
```

不能使用“参与者在不同域”直接推断真实跨域传输。跨域状态必须来自后端 phase、domain 或 actual path 证据。

### 5.3 设备与链路

拓扑画布显示：GPU、CPU 主机、NIC、交换机、路由器、网络桥、存储和通信域。节点只使用当前 topology artifact 的稳定 ID。

#### 路径级动画

当存在完整 `actual_path` 和 `link_endpoints` 时：

- 高亮实际经过的节点和链路；
- 根据 `enqueue`、`service_start`、`service_complete`、`transfer_complete` 切换状态；
- pulse 沿已报告路径移动；
- 选中路径时同步高亮时间轴和详情。

当只有 aggregate `start_time_ps` / `finish_time_ps` 时：

- 显示传输区间；
- 显示“路径细节未报告”；
- 不播放逐 hop 流动。

当没有 `actual_path` 时：

- 不画 source → destination 的假连线；
- 显示“后端未提供实际路径”。

---

## 6. 播放模型和状态机

### 6.1 回放游标

游标必须使用无损时间类型：

```ts
cursorPs: string | bigint
```

事件时间在数据模型中始终保留原始 ps 字符串。转为百分比、像素和展示单位只属于安全的显示级换算。

### 6.2 事件状态规则

- 瞬时事件：`at_ps <= cursorPs` 后标记为已发生；
- 区间事件：`start_ps <= cursorPs < end_ps` 标记为进行中；
- `cursorPs === end_ps` 标记为完成；
- 同一时间戳保持后端 `sequence` / source index 的顺序；
- 没有区间端点时，不创建默认时长。

### 6.3 自动播放

控制项：

- 播放 / 暂停；
- 重置；
- 上一步 / 下一步；
- 上一阶段 / 下一阶段；
- 速度 0.25x、0.5x、1x、2x、4x、8x；
- 拖动时间游标；
- 跟随当前选中对象；
- 只看通信 / 等待 / 当前请求。

播放只推进游标，不改变后端数据。实现上使用单个 `requestAnimationFrame` 循环和可取消的 playback controller，避免每个组件各自创建动画定时器。

### 6.4 长空闲区

默认按真实模拟时间比例播放。可提供“压缩长空闲区”选项，但必须：

- 明确显示为显示级压缩；
- 在时间轴中保留断点标记；
- 不改变原始时间字段；
- 不改变步骤顺序和证据指针。

### 6.5 单步播放

“下一步”按当前层级选择边界：

- 概览：下一阶段边界；
- 集合通信：下一 collective step；
- 设备与链路：下一 Fabric execution event；
- Runtime 过滤：下一 runtime event。

单步播放不能触发新的 simulation API 请求，也不能从聚合记录推断不存在的中间步骤。

### 6.6 播放状态

```text
idle → playing → paused
  ↑       ↓         ↓
  └── ended ← reset ┘
```

如果数据在播放中被切换、run 变化或 artifact SHA 变化：

1. 立即取消动画帧；
2. 清除旧选中事件；
3. 重新绑定 query；
4. 新数据就绪后回到 `idle`。

---

## 7. 数据模型

建议新增 feature 内部模型，不直接把后端 JSON 结构暴露给组件。

```ts
interface ReplayDocument {
  runId: string;
  backendIdentity: string;
  schemaSetRevision: string;
  sourceArtifacts: ReplaySourceArtifact[];
  timeOriginPs: string;
  endTimePs: string;
  clockStatus: "aligned" | "partial" | "unaligned";
  tracks: ReplayTrack[];
  events: ReplayEvent[];
  relations: ReplayRelation[];
  coverage: ReplayCoverage;
}
```

```ts
interface ReplayTrack {
  id: string;
  kind: "runtime" | "stage" | "device" | "stream" | "domain" | "link" | "collective";
  label: string;
  parentId?: string;
  deviceId?: string;
  domainId?: string;
}
```

```ts
interface ReplayEvent {
  eventId: string;
  sequence: string;
  kind: string;
  timing:
    | { type: "instant"; atPs: string }
    | { type: "interval"; startPs: string; endPs: string };

  requestId?: string;
  batchId?: string;
  modelExecutionCallId?: string;
  collectiveId?: string;
  collectiveType?: string;
  phaseId?: string;
  algorithm?: string;
  round?: string;
  chunk?: string;

  sourceDevice?: string;
  destinationDevice?: string;
  linkId?: string;
  domainId?: string;
  transferKind?: string;
  bytes?: string;
  state?: string;

  sourcePath: string;
  evidenceRefs: EvidenceRef[];
  availability: Availability;
}
```

```ts
interface ReplayRelation {
  sourceEventId: string;
  targetEventId: string;
  kind: "causal" | "flow" | "phase" | "dependency" | "same_collective";
}
```

约束：

- `same_collective` 只是分组，不自动表示因果；
- relation 必须由后端或稳定 ID 关系支持，不能凭前端排序创建因果箭头；
- 聚合记录不能被复制成多个“虚拟事件”；
- 每个事件都要有 `sourcePath` 或明确的 `expected_absence` / `not_covered` 原因；
- `0`、missing、expected absence、not covered、unsupported schema 分开处理；
- 原始证据路径必须保留通配字段模式和精确 record pointer 的区别。

---

## 8. Canonical execution replay artifact

### 8.1 建议的 artifact

```text
artifact_id: execution-replay
schema_version: tilesim.execution_replay.v1
file_name: execution-replay.json
```

它不是 runtime trace 或 metrics 的替代品，而是后端将已发布事实按回放结构组织后的独立 artifact。

### 8.2 根对象

```json
{
  "schema_version": "tilesim.execution_replay.v1",
  "run_id": "...",
  "timebase": "simulation_ps",
  "time_origin_ps": "0",
  "end_time_ps": "...",
  "clock_alignment": "aligned",
  "trace_provenance": {},
  "source_artifacts": [],
  "coverage": {},
  "tracks": [],
  "events": [],
  "relations": []
}
```

### 8.3 事件要求

每个事件必须具备：

- 稳定 `event_id`；
- 稳定 `sequence`；
- instant 或 interval timing；
- event kind；
- 所属 track；
- 原始 artifact source；
- evidence refs；
- availability。

可选字段包括：

- request / batch / model execution call；
- collective / phase / algorithm / round / chunk；
- source / destination device；
- domain / link；
- transfer kind；
- bytes；
- queue / service / completion state。

所有计时、顺序、bytes 和计数使用无损 JSON uint64 语义，前端不得将其强制解析成 number。

### 8.4 关系要求

建议只支持以下关系：

- `causal`：后端明确提供的因果关系；
- `flow`：明确的 source → destination 数据流；
- `phase`：事件属于某一 phase；
- `dependency`：collective step 依赖；
- `same_collective`：同一 collective 分组。

不建议把任意相邻事件自动连成 causal relation。

### 8.5 contract 发布门槛

只有以下条件全部满足后，才将 artifact 升级为正式能力：

1. backend schema、OpenAPI、manifest 同步发布；
2. `pnpm contracts:generate` 生成并提交前端类型；
3. Bridge 完成 run、schema、SHA、bytes 校验；
4. 具有 4 GPU / 双域 / AllReduce / AllGather fixture；
5. 具有 route unavailable、partial、expected absence、unsupported schema fixture；
6. 后端事件顺序、时间单调性和 identity 有测试；
7. 回放 artifact 能在刷新后从证据深链恢复；
8. 不能把 synthetic trace 标记为 real trace。

---

## 9. 前端实现边界

### 9.1 建议目录

```text
src/features/execution-replay/
├── index.ts
├── model/
│   ├── types.ts
│   ├── normalize.ts
│   ├── coverage.ts
│   ├── collective.ts
│   └── playback.ts
├── components/
│   ├── ExecutionReplayPanel.vue
│   ├── ReplayControls.vue
│   ├── ReplayTimeline.vue
│   ├── ReplayTopologyCanvas.vue
│   ├── ReplayCollectiveView.vue
│   ├── ReplayDetailsPanel.vue
│   └── ReplayEventList.vue
└── queries/
    └── useExecutionReplayQuery.ts
```

### 9.2 状态归属

TanStack Query 负责 artifact 和 server state，query key 必须包含：

```text
["execution-replay", runId, backendIdentity, schemaSetRevision, artifactSha256]
```

Pinia 只保存 UI 回放状态：

```text
cursorPs
isPlaying
speed
viewLevel
selectedEventId
selectedCollectiveId
filters
followSelection
reducedMotion
```

`ExecutionView.vue` 只编排回放模块，不直接调用 `bridgeApi`，也不读取 feature 内部文件。

### 9.3 与现有执行页的关系

- “执行回放”成为执行页主展示模块；
- 现有 `RuntimeEvidencePanel` 保留为“原始运行证据”或抽屉入口；
- 现有阶段列表和图表作为概览下方的证据表，不再与回放区重复展示长表；
- 现有 `ArtifactEvidenceLink` 继续作为唯一证据跳转入口；
- 不在回放模块内复制一份完整原始 JSON 查看器。

---

## 10. 动画实现方案

### 10.1 动画原则

动画只表达三个事实：

1. 当前模拟时间在哪里；
2. 哪些事件处于 active / waiting / completed；
3. 哪条已报告路径正在传输。

动画不用于制造“仿真正在运行”的错觉。

### 10.2 渲染分工

| 内容 | 技术建议 | 原因 |
| --- | --- | --- |
| 阶段和事件时间轴 | SVG / 现有 chart runtime | 可选中、可访问、支持证据联动 |
| 拓扑节点和链路 | 原生 SVG | 节点数量有限、易做键盘和 hover |
| 大量 flow pulse | Canvas overlay | 避免数千个 SVG 动画节点 |
| 事件列表 | 虚拟列表 | 防止大 trace 造成 DOM 爆炸 |
| 原始字段 | 表格 / JSON evidence view | 保留完整精度和 pointer |

不新增全量 ECharts import，不使用高成本 blur、glow、filter 和无限循环动画。

### 10.3 单一动画时钟

页面只允许一个 playback controller：

- 由 `requestAnimationFrame` 驱动；
- 统一更新 `cursorPs`；
- 所有 track 根据同一游标计算状态；
- 播放暂停时取消 frame；
- 路由切换、run 变化、组件卸载时清理 frame 和 Worker；
- `prefers-reduced-motion` 时不播放连续 pulse，只更新静态状态。

### 10.4 流畅性目标

验收时应建立基线并保证：

- 普通 1,000 条事件窗口播放不卡顿；
- 事件列表不因总事件数增长而一次性增加 DOM；
- Canvas pulse 数量受可见窗口限制；
- 拖动游标时只更新受影响的 track 和详情，不重建整个画布；
- 主题切换和层级切换不遗留旧动画帧；
- 大 trace 先显示摘要，索引完成后再显示可下钻事件。

不把某个未经实测的帧率数字写成产品事实；以浏览器基线、Playwright 录屏检查和性能采样结果作为最终门禁依据。

### 10.5 视觉语义

- 计算：蓝绿色；
- 通信：蓝色；
- 排队 / 等待：琥珀色；
- backpressure / error：红色；
- 完成：绿色；
- missing / not covered：灰色和斜线纹理；
- selected：高对比边框，不只依靠颜色；
- domain：浅色分组或虚线边界；
- link 状态：线型 + 标签，不只使用颜色。

禁止使用紫蓝渐变、玻璃拟态、装饰性光晕和无语义粒子效果。

---

## 11. 大 trace、性能和缓存

### 11.1 加载策略

1. 首屏只读取 manifest、summary 和时间范围；
2. 用户打开回放后按需读取首个时间窗口；
3. 大于现有阈值的 artifact 交给 Worker 索引；
4. 主线程只持有当前窗口、索引和选中记录；
5. 事件列表按页或虚拟窗口加载；
6. 原始 artifact 仍通过 `/raw-evidence` 深链访问。

### 11.2 去重规则

runtime event、Fabric record、phase contribution 和 request metric 不得因为相同 ID 被重复求和。回放模型必须保留：

- canonical source；
- display grouping；
- identity / display_group / display_sum derivation；
- 是否为聚合记录。

聚合记录只用于摘要，不生成新的 event identity。

### 11.3 时钟校验

runtime、Fabric、collective 三类数据只有在确认同一模拟时间基准后才叠加到同一轴上。

如果存在：

- 缺 time origin；
- 不同 clock domain；
- 无法证明的 offset；
- 非单调事件时间；

则显示 `clock_unaligned`，分轨展示，不强行重合。

---

## 12. 信息密度、国际化与无障碍

### 12.1 信息收敛

- 主区域只显示短标签和当前状态；
- 后端原始字段名只放详情和证据抽屉；
- 每个图只保留一句“这张图回答什么”；
- 字段边界、推导方式、缺失原因按需展开；
- 不在每个 panel 重复 run ID、schema、provenance；
- 完整 technical ID 通过 hover、复制和证据详情获取。

### 12.2 键盘和读屏

- Space：播放 / 暂停；
- ← / →：上一步 / 下一步；
- Shift + ← / →：上一阶段 / 下一阶段；
- Home / End：开始 / 结束；
- Enter：打开详情；
- Esc：关闭详情；
- 时间轴、拓扑节点和事件列表都可获得焦点；
- SVG 有本地化 `role=img` 和等价文本表；
- 不把颜色作为唯一状态表达；
- 支持 `prefers-reduced-motion`；
- 暗色和亮色主题都要保持对比度。

### 12.3 文案

用户文案使用当前中文模块术语。建议：

- “已观测事件回放”而不是“真实回放”；
- “阶段摘要”而不是“完整执行”；
- “路径未报告”而不是“无路径”；
- “算法未报告”而不是“自动算法”；
- “数据量未报告”而不是把缺失显示成 0。

---

## 13. 分阶段实施计划

### M0：数据盘点与 fixture

交付：

- runtime、Fabric、phase、topology 字段支持矩阵；
- 事件 identity 和 clock 校验规则；
- 4 GPU / 双域 fixture；
- AllReduce、AllGather、Ring、Hierarchical、route unavailable fixture；
- 缺失、expected absence、unsupported schema fixture。

DoD：所有后续 UI 需求都能对应到已存在字段或明确的 contract gap。

### M1：高层执行回放

交付：

- 概览层时间轴；
- runtime event marker；
- 自动播放、暂停、拖动、逐步；
- 阶段和请求筛选；
- evidence link；
- provenance 和 availability 状态。

不新增正式 contract。

### M2：设备与链路回放

交付：

- topology SVG；
- GPU / NIC / switch / router / bridge / storage 节点；
- actual path 高亮；
- Fabric execution event；
- queue / service / complete 状态；
- partial / route unavailable 降级。

### M3：canonical replay artifact

交付：

- `tilesim.execution_replay.v1`；
- Bridge artifact manifest 接入；
- generated TypeScript contract；
- query identity 和 SHA 校验；
- Worker 索引和分页读取。

### M4：集合通信下钻

交付：

- AllReduce；
- AllGather；
- reduce_scatter / allgather；
- round / chunk；
- dependency；
- participant matrix；
- 跨域阶段；
- collective step 单步播放。

### M5：视觉和体验加固

交付：

- 1440×1100、1024×768 无横向溢出；
- dark/light；
- reduced-motion；
- keyboard；
- axe；
- 大 trace 性能基线；
- 录屏检查动画连续性和暂停准确性。

---

## 14. 测试与验收

### 14.1 纯模型测试

- instant / interval 状态边界；
- 相同时间戳的稳定排序；
- lossless ps / bytes；
- `0` 与 missing；
- expected absence / not covered / unsupported schema；
- collective 分组；
- round/chunk 映射；
- relation 不被前端补造；
- actual path 不从 topology 推断；
- clock unaligned 降级；
- duplicate aggregate 不重复计数。

### 14.2 组件测试

- 播放 / 暂停 / 重置；
- 上一步 / 下一步；
- 阶段跳转；
- 当前选中事件同步时间轴、拓扑和详情；
- 缺底层路径时不出现 flow pulse；
- route unavailable 的受控状态；
- reduced-motion；
- 键盘操作；
- 证据链接带 run、artifact、SHA、pointer。

### 14.3 Desktop Playwright

至少覆盖：

1. 4 GPU 双域 AllReduce 概览；
2. AllReduce reduce_scatter / allgather 下钻；
3. AllGather round/chunk；
4. 设备到设备路径高亮；
5. 自动播放后暂停位置稳定；
6. 单步播放顺序稳定；
7. route unavailable；
8. no runtime trace；
9. large artifact；
10. dark/light、axe、keyboard、reduced-motion；
11. 1440 和 1024 宽度无横向溢出；
12. 刷新后证据深链仍可恢复。

### 14.4 后端 / Bridge

- replay artifact schema validation；
- run identity mismatch；
- schema revision mismatch；
- SHA / bytes mismatch；
- event sequence gap；
- non-monotonic time；
- missing source pointer；
- actual path / link endpoint mismatch；
- collective dependency mismatch；
- expected absence 和 unsupported schema。

### 14.5 最终验收标准

1. 自动播放不触发新的模拟执行；
2. 每个可见事实都能回到 canonical evidence；
3. 没有底层事件时不播放虚假的数据流；
4. 逻辑 collective 和物理 path 始终分开；
5. 未报告算法不被推断；
6. synthetic trace 不升级为 real trace；
7. 大 trace 不因首屏加载造成明显阻塞；
8. 时间和 bytes 不丢精度；
9. 所有缺失态都可解释；
10. dark/light、键盘、读屏和 reduced-motion 通过验收。

---

## 15. 风险和决策门槛

| 风险 | 后果 | 控制措施 |
| --- | --- | --- |
| 将逻辑 AllReduce 画成物理路径 | 用户形成错误网络结论 | participant / actual path 分栏；没有 path 不画 |
| runtime 与 Fabric 时钟未对齐 | 时间轴错位 | clock metadata 和 unaligned 降级 |
| 聚合记录与逐流记录重复 | 延迟和事件被重复计算 | canonical source、display grouping、不可重复求和 |
| synthetic 被误标为真实 | 证据等级升级 | provenance 顶部固定展示，文案禁止“真实” |
| 事件数量过大 | 页面卡顿 | Worker、索引、窗口加载、虚拟列表、Canvas |
| 前端自行推断 round/chunk | 伪造后端事实 | 只消费 canonical collective step |
| 过度动画 | 页面好看但不可解释 | 单一时间游标、可暂停、reduced-motion、状态驱动 |
| 页面重新堆叠大量信息 | 执行页再次杂乱 | 一个主回放区，技术字段移入详情抽屉 |

进入 M3 前必须确认后端可以稳定发布 collective step 的 identity、时间、bytes 和来源指针；否则只交付 M1/M2 的真实能力，不以“动画看起来完整”作为替代。

---

## 16. 评审结论和下一步

推荐批准本方案的产品方向，但按 M0 → M1 → M2 → M3 → M4 → M5 分阶段实施。

第一批实际开发任务应是：

1. 编写 M0 字段支持矩阵和 fixture；
2. 在 `execution-inspector` 旁新增 `execution-replay` feature；
3. 先实现概览层时间游标、事件 marker、自动播放和单步；
4. 保留现有 raw evidence 面作为证据底座；
5. 用真实 artifact 和 fixture 做视觉验收；
6. 在 M1 验收后，再决定是否进入 replay artifact contract 设计。

本方案明确：实用性来自可追溯、可降级、可验证；美观和流畅来自层级清晰、单一动画时钟、适度的路径高亮和精确的状态反馈，而不是装饰性动效。
