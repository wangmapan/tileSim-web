# TileSim 后端基线对齐差异与适配计划（2026-10-24）

## 范围与事实来源

- 远端公共基线：`D:\tileSim` `origin/main@7535781e938a60b0050d925c1a574b4770702979`，发布定位为 v0.0.1「未校准功能基线」。
- 本地后端：同一仓库的当前工作树；存在用户修改和未跟踪构建产物，本次不 reset、clean、checkout、覆盖或推送后端。
- 前端范围：仅 `D:\tileSim-web` 的 Bridge 适配、报告模型、拓扑/执行展示与测试。

## 差异表

| 分类                      | 远端 v0.0.1 基线                                                                                                                                                                                                                                                                                                                       | 本地后端工作树/额外能力                                                                                                                                                                                                                                                 | 前端处理                                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 远端新增能力              | TP/EP/PP/DP 并行与固定批次；六类标准 Trace 联合消费；模型几何、BF16、Qwen3、MoE 动态形状；物理 KV、共享前缀、PD 目标页、网络复制；Dense/MoE Prefill/Decode；联合快照恢复；AdaptiveSharedLink；NativeOnlineFabric、SUE、Soft-UE、多跳、VC、双端口、可靠性、等待链路；TileLang kernel/model；Dense/MoE/SUE CLI；CPU 功能闭环和验收证据。 | 本地工作树未删除这些公共入口；本地修改集中在 Fabric 路由、S7/LayerAdapters 和测试。                                                                                                                                                                                     | 保留已有可选字段读取；缺少对应报告时显示 `unavailable`/`expected_absence`，不从配置推导成功或 fidelity。                                                  |
| 本地独有能力              | 远端公共文档不承诺物理链路 fail-closed 细节。                                                                                                                                                                                                                                                                                          | `GenericFabricModule` 对 `topology.links` 做真实路径搜索；返回 `actual_path`、`link_endpoints`、逐跳执行事件；空链路不补全；失败使用 `route_unavailable`；S7、LayerAdapters、DenseRuntimeHost 保留拓扑校验与 partial 语义；runtime evidence 四类工件绑定真实 `run_id`。 | 适配层按原始 JSON 保留字段，网络页面展示后端实际路径/链路/域/事件；没有结果就明确不可用，绝不补造 latency、transfers 或 ready。                           |
| 双方均有但字段/契约变化   | 运行结果、metrics、validation、tail、execution envelope、runtime 工件均为版本化 JSON；uint64 字段来自后端十进制 JSON。                                                                                                                                                                                                                 | 本地四类 runtime 工件的 schema 与 `run_id` 已在 Bridge/后端测试中加固；拓扑结果增加逐跳和路由状态。                                                                                                                                                                     | `parseJsonLossless` + `LosslessInteger`/字符串；manifest 与 payload 双重校验 schema/run_id；runtime-analysis 完整保留嵌套 `summary`/`requests`/`events`。 |
| 需要新增/修改的页面与字段 | 运行状态/退出码、工件状态与拒绝原因、运行期事件/汇总/请求/分析、网络等待/拥塞/路径、证据可信度。                                                                                                                                                                                                                                       | 这些结果可能是 `completed`、`partial`、`failed`、`route_unavailable`、`unavailable` 或 `expected_absence`。                                                                                                                                                             | 在执行页补充统一结果状态与拓扑路径证据视图；运行工件面板保留拒绝原因；拓扑编辑器继续允许空链路并把可运行性留给后端。                                      |

## 适配计划

1. **契约保持**：复核 Bridge manifest、四类 runtime schema、run 绑定和无损解析；只补读取适配，不放宽后端校验。
2. **网络证据适配**：增加对 `actual_path`、`link_endpoints`、`domain_id`、`transfers_executed`、`end_to_end_latency_us`、`route_unavailable` 的保留式视图模型，区分连通、空链路和缺跨域链路。
3. **运行结果状态**：把 `status`、`exit_code`、`failure_code`、`cause`、`next_action` 和 manifest rejected entries 以 fail-closed 语义呈现，不把 partial/failed/unavailable/expected_absence 变成 ready/completed。
4. **测试**：增加 runtime schema/run_id、uint64、analysis 嵌套字段、拓扑三态和状态渲染测试；运行 Bridge runtime evidence、schema/contracts、前端定向测试、typecheck/build、`git diff --check`。
5. **未覆盖项**：无真实 TileSim run_id 的 live API 集成、后端 CTest/原生 SUE 运行与 live Provider acceptance 仍按环境/权限报告为未执行，不用 fixture 代替真实证据。

## 明确保留声明

本次只修改 `D:\tileSim-web`。没有删除、覆盖、回退或假设不存在 `D:\tileSim` 本地的 Fabric 路由、S7/LayerAdapters/DenseRuntimeHost、runtime evidence、CTest、CLI、ScenarioLoader、fixture 或用户修改。
