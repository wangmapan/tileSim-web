# Agent 接入边界

## 1. 可消费的公开能力

轻量版只允许调用现有公开入口（通过 feature `index.ts`）：

- capability snapshot / Phase 1 projection；
- `compileIntent`；
- `intentOutputToTypedBlocks`；
- 单轮输入 redaction；
- 已有 context envelope 与 stale 标记。

适配器负责把 typed block 投影成易读的卡片，不改变字段值、状态、provenance、fidelity、revision 或错误码。

## 2. 当前八字段

当前 Agent 公开草案字段为 message size multiplier、batch scheduler、max batch size、KV capacity tokens、scale-up bandwidth、scale-out bandwidth 和 latency 相关字段（以 canonical contract/能力快照为准）。字段列表、单位和可用性不能在轻量版静态复制；始终从公开能力快照读取。

模型、engine、device、topology、workload、物理 KV、SLO、审批、Workflow、RAG、执行等当前为 `0/unavailable` 或未开放时，轻量版显示“尚未开放/需要专业配置”，不提供伪造输入控件。

## 3. 输入与输出约定

### 输入

- 只提交当前单轮 instruction；提交前调用现有 redaction。
- 绑定 `context_revision`；页面上下文变化时拒绝旧提交。
- locale 可为 `zh-CN`/`en-US`，不改变 canonical 事实。

### 输出

只读呈现以下 typed block：draft summary、clarification、explanation、unsupported、validation result、error/stale。每个 block 需带稳定 block ID、状态和可追溯字段；展示层不得合并成一个“看起来成功”的结论。

## 4. 状态映射

| canonical 状态 | 轻量文案 | 可用动作 |
| --- | --- | --- |
| draft | 草案，尚未创建运行 | 确认/补充/进入专业版 |
| clarification | 还需要你确认 | 选择或补充后重新提交 |
| unknown/missing | 当前没有足够信息 | 查看原因、补充字段 |
| unsupported schema | 当前版本不支持 | 查看支持范围、联系维护者 |
| unavailable | 能力暂不可用 | 重试或继续学习；不模拟成功 |
| stale | 页面/证据已变化 | 刷新、显式丢弃旧内容 |
| validation error | 这组输入无法通过校验 | 定位字段并修正 |
| real/synthetic/compatibility trace | 按原 provenance 展示 | 不互相升级 |

## 5. 明确禁止

- 不 import compiler、validator、catalog、request builder、Agent store/entity 内部文件。
- 不在轻量版拼装 create-run request，不触发 `/api/runs`，不调用 Provider。
- 不将 `0` 当成有意义的零值，不把 missing/expected absence/not covered 混成“未设置”。
- 不生成新指标、排序或修正模拟事实；前端仅做显示级换算且可追溯。
- 不保存完整问题、raw response、hidden reasoning、完整会话；仅可保存 UI preference。

## 6. 接口缺口与后续门

当前没有正式 Conversation、Draft revision、Approval、Workflow、RAG 或 create-run 会话接口。因此首期必须是单轮内存草案。未来要开放多轮或执行，需先由 Agent/Bridge 负责人发布契约、权限、留存、审计和失败语义，并重新完成 DoR 审计；轻量版不得在浏览器内“先模拟”。

## 7. 能力门（capability gate）

渲染前按以下顺序判断，任何一步失败都停止后续动作：

1. manifest/schema identity 可解析；
2. context revision 与当前页面一致；
3. capability snapshot 可用且 revision 未过期；
4. instruction 经 redaction 且目的属于当前页面允许的 purpose；
5. compiler 返回 canonical kind；
6. typed block 映射成功且 provenance/fidelity 完整。

门控失败时只能显示对应状态，不得降级成“默认值”“示例结果”或自由文本结论。

## 8. 字段显示合同

每个字段卡片必须同时提供：canonical field name、用户友好名称、原始值（若有）、规范值（若有）、单位、状态、来源/provenance、schema/revision 和“为什么需要”。缺值时 value 区显示 `unknown`/`missing` 等正式状态，而非 `—` 或 `0`。显示换算不能丢弃 64 位整数精度。

## 9. 交互幂等性

- 同一 `context_revision + instruction digest` 的重复提交在 UI 层合并 pending 状态，不产生第二条结果。
- 结果到达后若 context 已变化，标记 stale 并禁止“确认草案”动作。
- 用户显式丢弃 stale 内容后才允许新一轮；丢弃不代表旧证据被删除，只是解除 UI 绑定。
