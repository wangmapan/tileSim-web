# 信息架构与入口设计

## 1. 总体 sitemap

```text
/
├─ /lightweight                 轻量工作台首页（任务导向）
│  ├─ /lightweight/learn         概念与快速导览
│  ├─ /lightweight/tasks         任务模板
│  ├─ /lightweight/prepare       自然语言草案
│  └─ /lightweight/results       结果摘要（可带 run 查询）
└─ /overview                    专业工作台首页
   ├─ /execution                执行状态
   ├─ /metrics                  指标
   ├─ /fabric                   资源/网络
   ├─ /validation               验证
   ├─ /evidence-agent           证据 Agent
   ├─ /evidence-lab             Week 7 证据实验室
   ├─ /design-space             设计空间
   ├─ /history                  历史
   └─ /experiment               新建实验
```

`/lightweight/*` 是目标路由；首期可由一个 view 按子路由渲染不同 section，但 URL 必须可深链接，不能用不可见的内存 tab 代替。

## 2. 入口优先级

| 位置 | 专业版 | 轻量版 | 规则 |
| --- | --- | --- | --- |
| `/` 首屏 | 一级入口 | 一级入口 | 等宽、等 CTA 权重 |
| 顶部切换器 | 当前模式外的另一入口 | 当前模式外的另一入口 | 始终可见 |
| 轻量任务完成 | “进入专业版查看详情” | “回到轻量任务” | 不称为升级 |
| 专业页面 | “切换到轻量版” | — | 不改变 run 状态 |
| 深链接 | 直接到目标专业页 | 直接到目标轻量页 | 无效 run 显示明确错误 |

## 3. 模式选择与记忆

- 首次访问 `/` 展示选择页，不自动重定向。
- 用户点击入口后写入 `tilesim-web.workbench-mode.v1`，仅值 `lightweight` 或 `professional`。
- 后续访问 `/` 可按偏好进入最近模式，但必须有显著“选择另一个工作台”入口；若偏好损坏，回退选择页。
- 不把 run ID、草案、问题文本、Provider 响应写入该 key。
- 显式点击“重新选择工作台”清除偏好并回到 `/`，不清除 run-bound 状态。

## 4. 专业版侧栏与轻量版导航分离

专业侧栏继续由现有 `AppSidebar`/navigation model 管理。轻量版使用独立的 4 项导航：

1. 开始（任务首页）
2. 学习（概念卡）
3. 我的草案（当前会话内存态）
4. 帮助与限制

轻量导航不能导入专业 feature 内部文件；跨模式跳转只通过公共路由和稳定 query。

## 5. 深链接与 query 约定

- `run=run-...`：只接受现有正则；不在轻量版创建新 run。
- `artifact_sha256=...`、`schema_set_revision=...`：用于详情定位，缺失或不匹配时显示 stale/unsupported，而不是猜测。
- `from=lightweight`：可选的显示来源标记，不参与权限或事实判断。
- 页面刷新、后退、复制 URL 必须保持模式和可解析的 run 引用。

## 6. 信息优先级

首屏顺序：目标/任务 > 当前状态 > 结论或需要补充什么 > 可信范围/限制 > 详细证据。任何会改变用户决策的 unknown、stale、unsupported、not covered 都不得折叠到首屏以下。

## 7. 页面责任边界

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| App/router | 路由、模式选择、深链接解析、壳装配 | 解析 Agent 指令、计算模拟指标 |
| Lightweight view | 页面编排、section 顺序、空状态 | 直接调用 `bridgeApi` 或导入其他 feature 内部文件 |
| Lightweight feature | 任务卡、适配器、摘要、文案映射 | 复制 compiler/validator/catalog/request builder |
| `components/ui` | 无状态布局、按钮、details、提示 | 读取 store、Bridge、report schema |
| 专业 view/feature | 现有专业流程 | 为轻量版提供隐式导航或状态副作用 |

## 8. 首屏内容合同

选择页必须在不滚动的首屏区域内同时显示：两种模式名称、适用人群、能完成的事、是否会创建运行、进入按钮和“可随时切换”。任何因窗口变窄导致的折叠都只能影响辅助说明，不能折叠入口名称或副作用提示。

轻量任务页必须在首次渲染时显示：任务目标、输入示例、只读/未运行徽标、帮助入口和返回工作台选择入口。没有 capability 时仍可读学习内容和任务说明。

## 9. 路由守卫规则

- 只对不存在的 `/lightweight/*` 子路由回退到轻量首页；不把轻量 URL 静默重定向到专业版。
- `run`、artifact SHA、schema revision 先做格式校验，再交给现有导航同步；格式正确但资源不可用时显示状态页。
- 模式偏好只影响根路径 `/` 的默认落点；显式访问 `/overview` 或 `/lightweight` 永远尊重用户 URL。
- 不在路由守卫中清除 Pinia run、Evidence selection 或专业表单。
