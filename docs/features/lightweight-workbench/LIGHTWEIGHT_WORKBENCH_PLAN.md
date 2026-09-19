# TileSim 轻量工作台：可运行闭环方案

**状态**：当前产品基线（2026-09-16）
**适用范围**：电脑网页端；复用现有 TileSim Bridge、实验、run、报告和 Agent 公共能力。  
**重要修正**：轻量版不是学习中心，也不是只读结果页，而是与专业版并列的、可完成真实实验闭环的简化工作台。

## 1. 产品定义

TileSim 提供两个并列工作台：

- **专业版**：展示完整技术信息、完整实验配置、证据链和高级诊断。
- **轻量版**：隐藏复杂参数和技术噪音，但保留新建实验、配置、校验、提交、运行状态、结果摘要和必要图表。

两种模式使用同一套 canonical experiment/run/report 事实。切换模式只改变信息架构和呈现密度，不复制实验、不清除状态、不改变权限，也不改变 fidelity、provenance 或 capability 语义。

### 1.1 轻量版必须做到

1. 用户可以从空状态直接创建实验。
2. 用户可以完成必要配置并提交正式 run。
3. 用户可以看到真实运行状态和失败原因。
4. 用户可以看到基于真实报告字段的结果摘要和必要图表。
5. 用户可以随时进入专业版查看或继续编辑同一实验。
6. Agent 只能辅助理解、补齐和解释，不替代工作台主流程。

### 1.2 明确不做

- 不把轻量版实现成学习内容集合、模板展示页或已有 run 浏览器。
- 不在前端重算指标、不补造默认能力、不用 fixture/synthetic 数据伪装 live 结果。
- 不复制 request builder、validator、Bridge 调用或后端执行逻辑。
- 不因为轻量版简化而放宽权限、能力校验、artifact/schema 校验或失败关闭规则。
- 不为移动端增加实现或验收范围。

## 2. 信息架构与路由

### 2.1 根入口

`/` 始终展示等权的“轻量版”和“专业版”两个入口。最近模式只能作为弱提示，不得自动跳转，也不得参与权限或 capability 判断。

### 2.2 轻量版路由

| 路由                                            | 页面职责                                                     |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `/lightweight`                                  | 工作台首页：当前实验、最近运行、状态摘要、新建入口、结果摘要 |
| `/lightweight/prepare`                          | 新建/继续编辑轻量实验配置                                    |
| `/lightweight/runs/:runId` 或合法 `run-*` query | 运行状态、阶段、错误和结果入口                               |
| `/lightweight/results`                          | 结果摘要、关键图表、可信度和专业详情入口                     |
| `/lightweight/tasks`                            | 兼容旧链接；只保留合法工作台 query 并重定向到配置页          |
| `/lightweight/learn`                            | 兼容旧链接；只保留合法工作台 query 并重定向到轻量首页        |

轻量主导航只保留“开始”“新建实验”“结果”，不再展示独立“任务”或“学习”板块。现有 `/overview`、专业版实验路由和合法 legacy query 必须保持兼容。模式切换和深链接必须保留合法 `runId`、artifact SHA-256、schema-set revision、backend identity 及来源信息；兼容重定向不得携带旧 `task` 或未知 query。

## 3. 轻量版主流程

```text
工作台首页
  → 新建实验
  → 基础配置
  → 常用配置（高级配置可选）
  → 校验与确认
  → 提交正式 run
  → 运行状态
  → 结果摘要与必要图表
  → 进入专业版查看完整细节
```

### 3.1 首页

首屏必须突出：

- “新建实验”主按钮；
- 当前实验或最近实验；
- 最近一次 run 的真实状态；
- 结果摘要（没有合法结果时显示空状态）；
- 进入专业版查看完整细节；
- Agent 助手入口。

空状态应直接引导创建实验，不要求用户先完成学习任务。

### 3.2 配置表单

采用渐进式披露，字段必须来自现有 schema 和公开 feature：

**基础配置（默认显示）**

- 实验名称；
- 场景/任务模板；
- 工作负载和输入来源；
- requested fidelity；
- 核心规模或资源规模。

**常用配置（按 capability 显示）**

- batch size；
- sequence length；
- message size；
- 带宽和延迟；
- KV capacity；
- 其他已有 canonical 字段。

**高级配置（默认折叠）**

- 完整 design space；
- 拓扑和并行参数；
- trace package；
- 原始 JSON；
- 进入专业版继续编辑。

隐藏字段必须告知数量和入口，例如“已隐藏 12 项高级配置，可进入专业版查看”。不支持或 unavailable 的能力必须显示原因并保持禁用。

### 3.3 校验与提交

提交前展示确认摘要：实验名称、requested/resolved fidelity、资源规模、输入来源、可产生的结果类型、provenance 和不支持项。

必须复用：

- `src/features/run-experiment/index.ts`；
- `src/features/run-experiment/form.ts`；
- `src/features/run-experiment/request.ts`；
- 现有 query、Bridge 和 run 状态入口。

轻量页面只做编排，不直接调用 `bridgeApi`，不实现第二套验证器。

### 3.4 运行状态

至少区分：`queued`、`running`、`succeeded`、`failed`、`unavailable`、`incomplete`。

显示 run ID、backend identity、requested/resolved fidelity、当前阶段、开始/更新时间、错误摘要和结果入口。只有后端提供真实进度时才显示百分比；否则使用真实阶段名称，不得用前端计时器伪造进度。

### 3.5 结果摘要与图表

首屏优先展示已有真实字段：端到端延迟、吞吐、TTFT、TPOT、资源利用率、执行时间线和主要瓶颈（字段存在时）。

图表必须标注单位、来源、fidelity 和数据状态，并严格区分：

- `real_trace`、`synthetic_trace`、`compatibility_harness_trace`；
- measured、simulated、inferred、unavailable；
- missing、not covered、unsupported schema、not applicable；
- requested fidelity 与 resolved fidelity。

没有真实字段时显示受控空状态，禁止填充演示数值。

## 4. Agent 与页面帮助边界

专业版现有的同一个右侧 `TileSim 助手` 复用于轻量工作台。两个工作台共享 Agent 外壳、面板/会话状态、intent compiler 和公共 context adapter，不实现第二套轻量 Agent。轻量配置页可以向同一助手发布正式八字段及当前值，轻量运行页和结果页只从合法 run 路由或 query 恢复 run context；模式切换可以保留助手面板状态，但必须使旧页面 context 失效并替换为新页面上下文。

Agent 可以生成草案、解释字段、提示缺失项、帮助选择配置和解释结果；但不能写入表单、自行创建 run、绕过校验、调用 Provider、编造 capability、升级 provenance/fidelity 或替代配置页。

页面帮助与 Agent 是不同能力。轻量版和专业版可以复用 `PagePrimer`、`GuidedHelpHost` 等基础组件，但必须使用互斥的 workspace scope：轻量帮助只列出轻量首页、配置、运行和结果主题，专业版帮助只列出专业页面及其参考主题。搜索、相关页面和定位动作均不得跨 scope，切换工作台后不得继续显示另一工作台的帮助内容。

当前 Agent/Bridge/Provider 契约不因本方案自动扩展。Provider、Evidence Agent、多轮 Conversation、Workflow、RAG、Approval 仍按现有 contract 和 DoR 单独管理。

## 5. 状态、安全与失败语义

- workspace/session/history/bridge UI state 继续由现有 Pinia/TanStack Query 分层管理；不把状态重新集中到 `src/store/dashboard.ts`。
- query key 必须保留 run ID、backend identity、schema-set revision 和 artifact SHA-256。
- 进入 backend-global 页面不得清除当前 run；run-bound 与 backend-global state 分开。
- 所有 artifact、schema、manifest、stale 和 provenance 校验沿用 canonical 语义。
- 409、502/503/504、unsupported 和 stale 必须可解释显示，不自动重试副作用操作。
- 64 位 ps/bytes/count 继续走无损 JSON 路径。

## 6. 实施阶段

### L2R：文档与架构重基线

删除旧的“只读/不创建 run”方案，冻结本文件为唯一轻量工作台产品基线；核对公共 run-experiment、状态查询、报告 adapter 和现有测试。

### L3R：工作台与配置入口

重做首页、导航、空状态和 `/lightweight/prepare`；完成基础字段、常用字段、高级设置入口和模式切换。

### L4R：实验校验与提交闭环

接入公共 run-experiment feature；完成确认摘要、提交、错误定位、run 恢复和深链接。

### L5R：运行状态、结果和图表

接入真实状态与报告；完成结果摘要、必要图表、数据状态、provenance/fidelity 展示和专业详情衔接。

### L6R：审查、回归和发布

完成视觉、无障碍、失败/空/加载状态审查；运行完整前端、Bridge、E2E、构建门禁；经用户授权后部署 5173。

当前 L6R 验收：fixture/mock Bridge 桌面闭环覆盖 `/` → 轻量版 → prepare → 正式 run 提交 → queued/preparing/running/completed → 真实 fixture report → 专业版往返；并覆盖 failed、Bridge unavailable、incomplete/stale、合法 0 与 missing、重复提交幂等 key、刷新按 run ID 恢复。拓扑 JSON 编辑器另有 desktop pointer E2E，覆盖布局拖动不污染 JSON、无向建边、反向重复保护、属性编辑/删除和键盘操作。run/results 合法深链先等待共享 manifest/schema bootstrap，bootstrap 失败时 fail closed，不从无 manifest/schema 上下文回退到 legacy evidence 路径。fixture 不调用 Provider、不创建生产 run，不能替代 live/calibration/held-out 验收。单元测试继续验证 Agent 不越权创建 run；工作台正式 run 能力由页面和 E2E 单独验证。

页面实现、结果适配、测试、文档和视觉审查可以并行，但共享路由、公共 feature 和契约必须由主 Agent 统一整合。

## 7. 验收标准

- 新用户从 `/` 进入轻量版后，能在不进入专业版的情况下创建并提交一个合法实验。
- 运行过程中可看到真实状态；完成后可看到真实结果摘要和至少一组有分析目的的图表。
- 任一字段或结果不可用时，界面明确显示原因而非假装成功。
- 轻量版与专业版切换不丢失实验、run、artifact、schema 或证据上下文。
- 专业版旧路由、实验表单、run 恢复、Agent、Bridge 和 Provider 边界全部回归通过。
- 轻量版与专业版只呈现各自页面帮助主题；同一个 `TileSim 助手` 可在两侧打开，并在切换后使用新的页面/run context。
- 文档、类型检查、单元测试、E2E、构建和 `git diff --check` 全部通过；skipped 项单独报告。

## 8. 页面级规格

### 8.1 工作台首页 `/lightweight`

页面只保留一个主任务：开始或继续实验。推荐布局为“页面标题 + 主行动区 + 最近活动 + 结果摘要”四段，而不是等权堆叠学习卡片。

| 区域     | 必须内容                                    | 无数据时                     |
| -------- | ------------------------------------------- | ---------------------------- |
| 主行动区 | 新建实验、继续当前实验、切换专业版          | 新建实验为唯一主按钮         |
| 当前实验 | 名称、配置完成度、最近保存状态、继续编辑    | 显示“尚未创建实验”           |
| 最近运行 | run 状态、fidelity、更新时间、查看运行      | 显示“还没有运行记录”         |
| 结果摘要 | 成功/失败、关键指标、数据状态、查看完整结果 | 显示“完成一次运行后显示结果” |
| 辅助区   | 共用 `TileSim 助手` 入口                    | 不能压过新建实验入口         |

首页不展示任务板块、学习卡片或内联教程，不能把“学习”“了解概念”作为首屏主 CTA，也不能在没有真实数据时绘制装饰性图表。基础概念和页面说明只进入本 workspace 的右上角“页面帮助”。

### 8.2 新建实验 `/lightweight/prepare`

采用单页分段或明确步骤条，但每一步都必须可回到前一步：

1. **实验身份**：名称、场景/任务、描述（若 canonical schema 支持）。
2. **输入与 fidelity**：输入来源、trace 类型、requested fidelity；明确展示 resolved fidelity 只能由后端确认。
3. **规模与常用参数**：只展示当前 capability 允许的字段；每个字段保留单位、范围和默认值来源，详细解释统一放在右上角页面帮助。
4. **高级设置**：设计空间、拓扑、trace package 和原始 JSON 的专业入口；默认收起。
5. **确认提交**：只读摘要、缺失项、不可用项、数据来源和副作用说明。

表单底部固定显示“保存草稿/返回工作台”和“校验并继续”。“提交实验”只在校验通过、Bridge 可用、请求 preview 合法且没有契约错误时启用。

**拓扑可视化编辑边界**：JSON 输入模式提供 canonical topology request 的设备/domain/显式连接图。设备节点拖动只改变本次编辑的前端布局；在连接模式下点选或拖拽两个设备会写入显式 `links`，选中边后可修改 `domain_id`、带宽、时延或删除边。当前 `links` 遵循后端 `LinkSpec` 的无向物理连接语义（执行侧会展开正向和反向链路），因此图中不绘制方向箭头，也不允许同一 domain 的反向重复边。`domain.member_devices` 以只读虚线表达，不因移动节点而隐式改变；本阶段不提供设备/domain CRUD，也不生成缺失的链路或网络性能数据。非法 JSON、未知字段、悬空端点、未知 domain 和越界数值均保持 fail closed。

### 8.3 运行页 `/lightweight/runs/:runId`

页面采用状态头部 + 阶段列表 + 运行元信息 + 下一步动作：

- 状态头部：成功、运行中、失败、不可用或结果不完整；颜色不能作为唯一编码。
- 阶段列表：只显示后端返回的阶段；没有真实阶段时显示受控的“状态等待更新”。
- 运行元信息：run ID、实验名、backend identity、requested/resolved fidelity、schema-set revision、开始/更新时间。
- 下一步：查看结果、重试（仅在现有 contract 明确允许时）、进入专业版、返回工作台。

### 8.4 结果页 `/lightweight/results`

结果页按照“先结论、后证据、再细节”的顺序：

1. 结果状态和完整性声明；
2. 关键指标摘要；
3. 一个或多个有明确问题定义的图表；
4. 数据来源、fidelity、provenance 和缺失字段说明；
5. 进入专业版查看完整报告。

每个指标必须携带字段路径、单位、数据状态和来源。结果页不得把“没有字段”渲染成 0，也不得把 expected absence 渲染成失败。

## 9. 字段分层与来源规则

### 9.1 显示分层

| 层级       | 目标                   | 处理原则                                          |
| ---------- | ---------------------- | ------------------------------------------------- |
| 基础必填   | 让用户能构造合法请求   | 只放 request builder 真正需要且 schema 支持的字段 |
| 常用调整   | 让用户比较常见实验变化 | 仅在 capability available 且有单位/范围时显示     |
| 高级配置   | 保留专业能力           | 默认折叠，复用专业组件或跳转专业版                |
| 不可用字段 | 防止用户误以为可执行   | 显示 unavailable/unsupported 原因，不允许伪提交   |

### 9.2 来源优先级

字段显示和默认值必须按以下顺序决定：

1. canonical schema/descriptor；
2. 当前 backend manifest 和 capability snapshot；
3. 现有模板接口返回值；
4. 用户已保存的实验草稿；
5. 没有来源时不显示默认值。

任何静态示例只能用于帮助文本，必须明确标记为 example，不能进入 request payload。

### 9.3 状态词典

统一使用以下用户可理解但不失真的文案：

| 内部状态              | 轻量文案   | 允许动作                       |
| --------------------- | ---------- | ------------------------------ |
| `queued`              | 等待执行   | 查看详情、离开页面             |
| `running`             | 正在运行   | 查看阶段、离开页面             |
| `completed/succeeded` | 已完成     | 查看结果、进入专业版           |
| `failed`              | 运行失败   | 查看原因、按契约允许时重试     |
| `unavailable`         | 当前不可用 | 查看原因、修改配置或进入专业版 |
| `incomplete`          | 结果不完整 | 查看缺失项、进入专业版         |

不得使用“马上完成”“预计还剩”等没有后端证据的措辞。

## 10. 状态机与恢复

### 10.1 实验状态

```text
empty → editing → valid → submitting → submitted
  ↑         ↓         ↓          ↓
  └────── invalid ← validation_error ← submit_error
```

`editing` 是本地草稿，不代表已创建 run；`submitted` 只表示服务端接受请求，不能提前显示结果成功。

### 10.2 运行状态

```text
created → preparing → running → completed
                    └──────→ failed
created/preparing/running → unavailable
completed → incomplete   (报告或 artifact 校验不完整)
```

刷新或重新进入运行页时，优先通过合法 run ID 恢复服务端状态；不得根据本地计时器推断阶段。重复提交必须沿用现有 idempotency 语义。

### 10.3 浏览器生命周期

- 未提交草稿可按现有 workspace/session 规则恢复；若当前架构不支持持久化，必须明确显示“离开页面可能丢失”。
- 已提交 run、artifact、schema 和报告由 canonical store/query 管理，不放入 URL 之外的临时字符串。
- 页面刷新、前进、后退和模式切换不得清除合法 run 上下文。

## 11. 图表与数据适配规格

首期只实现有真实字段支撑的图表，优先级如下：

1. 延迟与吞吐的同一 run 摘要/分位数对比；
2. 执行阶段时间线；
3. 资源利用率或瓶颈贡献（仅当报告明确提供）；
4. 请求级 TTFT/TPOT 分布（仅当字段覆盖且 provenance 可见）。

每张图表必须有：标题、问题说明、坐标单位、数据范围、来源状态、fidelity、空状态和“进入专业版”入口。图表组件接收 adapter 输出的 view model，不直接读取 Bridge payload，不自行聚合原始指标。

图表状态至少覆盖：`loading`、`ready`、`missing`、`not_covered`、`unsupported_schema`、`not_applicable`、`stale`、`error`。

## 12. 组件与代码边界

建议的轻量 feature 公共入口按职责组织：

- `surface`：轻量字段分层、步骤和 CTA 可用性；
- `draft`：草稿状态和恢复；
- `run-adapter`：复用现有 run query/status 事实；
- `result-adapter`：把 canonical report 映射为摘要/图表 view model；
- `components`：只接收 view model 和事件；
- `index.ts`：对 view 暴露唯一公共 API。

`views` 只负责编排，不导入 feature 内部文件、不直接调用 `bridgeApi`。任何新建实验提交必须经过 `run-experiment` 的公共入口。不得在轻量 feature 中复制专业版 request builder、schema validator、Evidence 或 Provider 逻辑。

## 13. 测试矩阵

### 13.1 单元测试

- 字段分层：capability available/unavailable、schema 缺失、默认值来源；
- 表单：空值、范围、单位、跨步骤保留、返回修改；
- request：与专业版生成相同 canonical payload；
- 状态：queued/running/completed/failed/unavailable/incomplete；
- 结果 adapter：真实字段、missing、not covered、stale、uint64 无损；
- 模式切换：run/artifact/schema/backend/from query 全部保留；
- Agent：专业版与轻量版复用同一助手；只能生成草案/解释，不写表单、不触发 create run、不调用 Provider，跨模式后旧 context 失效；
- 页面帮助：轻量和专业 topic、搜索分组、相关页面及路由定位完全分域。

### 13.2 桌面 E2E

至少覆盖：

1. `/` → 轻量版 → 新建实验 → 表单错误 → 修正；
2. 合法 fixture 配置 → 提交 mock run → 运行状态 → 结果摘要；
3. 失败 run、Bridge unavailable、stale artifact/schema；
4. 结果页 → 专业版 → 返回轻量版，状态不丢失；
5. 键盘导航、焦点可见、缩放和桌面窄窗口；
6. 专业版 `/overview` 和既有实验深链接回归。

fixture 只能证明交互和契约映射，不能作为 live/calibration/held-out 证据。

## 14. 视觉与可用性检查

- 使用现有 TileSim token、字体层级、间距和状态颜色；不引入渐变、玻璃拟态、发光或装饰性 KPI。
- 主 CTA 在首屏唯一突出；教程、字段解释和证据边界统一由右上角“页面帮助”承载，旧 `/lightweight/learn` 仅作为兼容重定向。
- 运营信息保持足够密度：run ID、fidelity、来源、更新时间不能藏在不可发现的 tooltip 中。
- 所有状态同时使用文字、图标/结构和颜色；支持键盘焦点和 reduced-motion。
- 错误信息靠近对应字段，并提供可执行的下一步；全局错误保留 request/run 关联信息。
- 桌面窄窗口下不得产生横向滚动；本项目不扩展移动端布局。

### 14.1 页面帮助收敛（L6R 后续）

- 轻量开始、配置、运行和结果页不再展示独立教程卡或内联帮助面板，主导航不再包含“任务”或“学习”；
- 轻量版与专业版只复用 `PagePrimer` + `GuidedHelpHost` 基础设施，各自的 guide ID、topic 列表、搜索分组、相关页面和定位动作按 workspace scope 完全分离；
- 帮助中的定位步骤通过稳定 `data-help-anchor` 回到当前页面，运行页保留 run ID 上下文；
- `/lightweight/tasks` 访问时只保留合法工作台 query 并重定向到 `/lightweight/prepare`；`/lightweight/learn` 同样过滤 query 后重定向到 `/lightweight`。

## 15. 开发 Agent 的交付格式

每个阶段结束必须报告：

1. 修改文件及每个文件的职责；
2. 复用的公共 feature 和新增 adapter；
3. 当前已实现的用户路径与未实现路径；
4. fixture、live、calibration、held-out 的证据边界；
5. 单元、E2E、typecheck、lint、format、build 和 docs 结果；
6. skipped 项及原因；
7. 是否操作 5173、credential、Provider、正式 run、commit、push；
8. 下一阶段可直接执行的任务清单。
