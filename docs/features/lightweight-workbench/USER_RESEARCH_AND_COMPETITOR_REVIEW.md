# 用户研究与同类产品调研

## 1. 方法与范围

2026-09-12 通过 Playwright 访问公开官方文档，优先记录产品实际信息架构、前置条件、状态和失败边界；不把营销页面当作可用性证据。研究对象覆盖 AI 助手、数据分析工作台和 ML IDE，目标是提炼适用于 TileSim 电脑网页端的模式，而不是复制视觉风格。

## 2. 来源与观察

### GitHub Copilot

来源：[Getting code suggestions in your IDE](https://docs.github.com/en/copilot/how-tos/get-code-suggestions/get-ide-code-suggestions)。

- 文档先列 prerequisites，再给出最短成功路径（输入一行 → 接受建议）。
- 接受、拒绝、替代建议、部分接受都有显式动作和键盘路径。
- 支持切换模型，但把模型选择放在需要时，而不是首次操作前。

TileSim 借鉴：轻量版先让用户完成最小闭环；每个 Agent 草案都提供确认/拒绝/补充，而不是只有“提交”；高级模型/字段放到渐进披露。

### Microsoft Power BI Copilot

来源：[Copilot for Power BI overview](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-introduction)。

- 同时提供报告右侧 pane 和独立全屏 Copilot；上下文范围不同且文档明确说明。
- 按业务用户、报告作者、数据模型维护者组织任务：查找、分析、生成 visual、总结。
- 在能力说明前列出 capacity、管理员开关、区域、权限、prompt 限制和数据准备要求。
- 说明如何清除聊天、隐私/安全和 compute usage；结果可靠性与数据准备直接关联。

TileSim 借鉴：专业/轻量应是两个并列入口；轻量版按目标组织任务；前置条件、数据/证据质量、成本和权限在用户行动前可见；摘要与技术详情分层。

### Amazon SageMaker Studio

来源：[Studio UI overview](https://docs.aws.amazon.com/sagemaker/latest/dg/studio-updated-ui.html) 与 [Studio Classic overview](https://docs.aws.amazon.com/sagemaker/latest/dg/studio.html)。

- UI 明确拆成导航栏、导航窗格、内容窗格；URL 随页面变化，可直接深链接。
- Home 提供 Overview 与 Getting started 两个不同目的的 tab；Getting started 放导览、文档和 quick tips。
- 工作流按 Data、Auto ML、Experiments、Jobs、Models、Deployments 分组，而不是把所有对象平铺。
- 旧 Studio Classic 明确标注维护/迁移状态，避免用户把旧入口当作推荐路径。

TileSim 借鉴：轻量版需要独立导航和 Getting started；URL 应反映任务；能力/版本状态应在入口和页面上诚实标记。

### Google Gemini Enterprise Agent Platform / Agent Studio

来源：[Agent Studio quickstart](https://cloud.google.com/vertex-ai/generative-ai/docs/start/quickstarts/quickstart)（当前重定向到 Gemini Enterprise Agent Platform）。

- 提供提示库，按任务下拉分类并以卡片呈现可直接运行的示例。
- 示例预配置模型与参数，用户先提交得到结果，再选择“获取代码”；学习与执行分开。
- 合作伙伴模型首次使用需接受条款；文档将此类前置条件放在操作前。

TileSim 借鉴：轻量模板按“想完成的事”分类；示例必须明确 `example`，不能伪装成真实校准；需要授权/能力不可用时，在 CTA 前说明。

### Datadog Bits AI

来源：[Bits AI](https://docs.datadoghq.com/bits_ai/)（官方文档 Markdown 版）。

- 将实时聊天与“委托完整任务”明确区分。
- 能力按 Investigation、Code、Security Analyst、Chat、Remediation 等任务拆分，并提供独立入口。
- 价格以 AI Credits 单独说明，动作型能力（修复/Remediation）与只读探索分开。

TileSim 借鉴：轻量版首期只读草案与解释；未来若开放执行，必须另设确认、权限、成本和审计层，不能沿用聊天按钮。

## 3. 跨产品模式总结

| 模式 | 用户价值 | TileSim 应用 |
| --- | --- | --- |
| 双入口/双上下文 | 降低不同角色的认知负担 | `/` 两个等权入口；轻量与专业 shell 分离 |
| 目标/任务卡 | 用户无需先懂对象模型 | 按“了解、准备、解读、示例”组织 |
| Getting started | 首次成功路径清晰 | 3 步以内导览 + 可跳过 |
| 渐进披露 | 先做事，再看细节 | 结论—依据—限制—专业详情 |
| 先决条件可见 | 避免无效尝试和误解 | Bridge/能力/权限/证据状态在 CTA 前显示 |
| 接受/拒绝/替代 | 保留用户控制权 | 草案确认、补充、丢弃、切换专业版 |
| 能力/成本分层 | 防止只读与副作用混淆 | 首期只读；未来执行另走审批与审计 |
| 可追溯状态 | 建立对 AI 结果的信任 | run、artifact、schema、revision、provenance 始终可展开 |

## 4. 需要验证的 TileSim 假设

- 新手最先关心“我能回答什么问题、需要准备什么”，而不是字段的完整列表。
- 用户愿意在看到一条可理解的草案后再进入专业表单。
- “草案未运行”与“真实结果”必须通过文案和视觉双重区分，才能将误解率降为 0。
- 轻量版不应承诺当前 Agent 尚未具备的模型/设备/多轮/执行能力。

上线后用埋点和访谈验证这些假设；埋点只记录非敏感事件（入口、任务类型、状态类别、是否切换），不记录完整问题或响应。
