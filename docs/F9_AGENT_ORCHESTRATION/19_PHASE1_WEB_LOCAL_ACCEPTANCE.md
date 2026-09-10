# Phase 1 Web 本地验收

> 文档 ID：`AO-19`
>
> 事实日期：2026-09-10
>
> 状态：`validated`
>
> Web 开发基线：`b46b9783bdd8a8ed330cffe549327e4e381b6f03`
>
> 当前后端 HEAD：`a876859a44f660c4627dab495034d52b4ae61f57`
>
> 不可变 execution-evidence revision：`7e5a8c6a5cf738bd24608b440a61b62dee8d1881`

## 1. 已实现范围

Phase 1 仅实现电脑网页端的单轮、无副作用参数草案：

- App Shell 全局 lazy mount 的右侧栏，支持 `closed/collapsed/open/expanded`、鼠标与键盘缩放、焦点恢复和错误隔离；
- 页面通过公开 adapter 发布 typed、最小、只读 `PageContextEnvelope`，不抓取 DOM，不复制 artifact 正文；
- 实验页把当前八字段值作为独立 compiler projection 发布，不把表单值放入 Page Context；
- 中英文和混合表达的确定性意图编译、单位归一、范围校验、澄清和 unsupported fail-closed；
- typed blocks 展示理解结果、原值、新值、单位、来源和校验，Pointer、identity、SHA 只在折叠详情中展示；
- 草案明确标记“这是草案，尚未创建运行”，route/context revision 变化后旧结果标记 stale；
- `ExperimentView` 使用 `KeepAlive` 保留未提交表单，侧栏生命周期和跨路由切换不清除当前 run 或 Query。

正式八字段全部覆盖：

1. `s0.workload.message_size_multiplier`
2. `s1.runtime.batch_scheduler`
3. `s1.runtime.max_batch_size`
4. `s1.runtime.kv_capacity_tokens`
5. `s6.fabric.scale_up_bandwidth_gbps`
6. `s6.fabric.scale_up_latency_us`
7. `s6.fabric.scale_out_bandwidth_gbps`
8. `s6.fabric.scale_out_latency_us`

模型、设备、卡数、TP/PP/EP、placement、物理 KV、集合通信算法、SLO 和工作负载模板均 fail closed，不会进入草案。

## 2. 契约与身份

Phase 1 冻结的是本地 Web/domain contract：`tilesim.web.agent_orchestration.phase1.local.v1`。它不是新的 Bridge contract。

以下正式身份未改变：

- Capability Catalog：`tilesim.bridge.agent_orchestration_capability_catalog.v1`
- create-run：`tilesim.bridge.create_run_request.v1`
- Evidence descriptor：`tilesim.bridge.evidence_agent_descriptor.v2`
- Evidence request/response/citation/snapshot：保持 v1
- nested F8 v1/v2 兼容矩阵：保持不变

八字段 canonical request equivalence 为 8/8。uint64、整数和 decimal 在草案域中使用 decimal string 保持无损；只有进入现有 bounded request builder adapter 前才允许经过 safe-integer 检查。

## 3. 验收结果

- Phase 1 模块窄回归：55/55；
- 双语/中英混合 fixture corpus：128/128，其中 train 30、validation 32、test 34、held-out-adversarial 32；
- canonical request equivalence：8/8；
- Web 全量 Vitest：504 passed、8 skipped；
- Playwright fixture E2E：50 passed、6 deployed/live skipped；
- Bridge `py_compile`：passed；
- Bridge unittest：105/105；
- `contracts:check`、`docs:check`、`deps:check`、`typecheck`、`lint`、`format:check`、`build`、`git diff --check`：passed。

浏览器 fixture 覆盖草案、澄清、unsupported、formal binding drift、stale、四种面板状态、键盘 resize、焦点恢复、路由与表单保持、深浅主题、1100/1440/1920 宽度、CSS 200% zoom reflow、reduced-motion、桌面 overflow 和 axe serious/critical 违规为 0。6 个 skipped 用例必须连接 deployed/live 服务，未计入 passed。

后端没有生产代码变更；本阶段按验收命令只读复跑 execution-evidence reproducibility oracle，结果为 8/8，generated drift check 为 passed，并保持不可变后端 evidence revision `7e5a8c6a5cf738bd24608b440a61b62dee8d1881`。该复现不改写后端证据文件，也不产生新的 fidelity 声明。

## 4. 安全、留存与证据范围

- Provider 调用：0；
- create-run 调用：0；
- 新建 Evidence key：0；
- 新增持久化完整 instruction、artifact、claims、raw response 或 hidden reasoning：0；
- credential 读取：0；常见 credential-like 片段在进入 compiler 前做本地 redaction；
- DOM scraping 和 feature-internal store import：0；
- fixture 结果仅证明 synthetic consistency 和 UI/contract 行为，不是 live、calibrated 或 held-out real validation；
- 未部署、停止、重启或替换 `127.0.0.1:5173`；浏览器测试使用独立 4173 fixture；
- 未创建正式 simulation run；
- 已形成本地 Git 可复现交付点，未 push。

## 5. Remaining Gap

`GAP-DRAFT-001`、`GAP-VALIDATE-001`、`GAP-CLARIFY-001`、`GAP-CONV-001`、`GAP-APPROVAL-001`、`GAP-WORKFLOW-001`、`GAP-CANCEL-001`、`GAP-RAG-001`、`GAP-COMPARE-001` 和 `GAP-TOOLS-001` 均未关闭。

Phase 2/3 或新正式契约至少需要：持久化多轮 Conversation/Turn/Goal、answer binding、正式 Experiment Draft identity/digest、统一 Validation Report、approval、写工具、create-run、SSE/cancellation、跨 run 比较与受控 RAG。完成 Phase 1 后停止，不自动进入这些能力。
