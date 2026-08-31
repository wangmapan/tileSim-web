# TileSim 电脑网页端视觉美化与浅色 / 深色模式计划

## 1. 目标与边界

本轮工作只优化 `D:\tileSim-web` 的电脑网页端，不改变 TileSim 模拟事实、报告字段语义、Bridge 契约或
后端逻辑。

目标：

- 建立独立于 palette 的浅色 / 深色外观模式；
- 提升证据工作台的信息层级、排版密度、可扫描性和长文本稳定性；
- 让面板、浮层、输入控件、表格、图表和状态色在两种外观下保持一致语义；
- 使用短促、克制、可关闭的过渡表达状态变化；
- 保持 S0-S9、S3/S4/S5 并列关系、证据边界和原始数据展示规则不变。

不做：

- 移动端重新设计；
- 3D、粒子、视差或持续循环的装饰动画；
- 为美观截断证据、隐藏 contract gap 或降低数据密度；
- 改写图表数值、归因顺序或报告事实；
- 将深色模式实现为简单的颜色反相。

## 2. 联网调研结论

### Primer：语义 token 与 color mode

[Primer Color usage](https://primer.style/foundations/color/overview) 明确区分 primitive、functional 和
component token，并要求组件通过会响应 color mode 的功能性 token 取色。Primer 的产品界面以 light 和
dark 作为基本 color mode，同一模式下仍可有不同 theme。

应用到 TileSim：

- `theme` 表示晴空蓝、云雾白、薄荷青、经典深绿等 palette；
- `appearance` 单独表示 `light | dark`；
- 页面组件只消费 `canvas/panel/ink/line/accent/status` 等语义 token；
- palette 与 appearance 可以组合，不让组件直接判断某个具体主题。

### Carbon：深色界面的层级模型

[Carbon Color](https://carbondesignsystem.com/elements/color/overview/) 强调 role-based token 和 layering
model。浅色主题通过相邻浅色层区分空间；深色主题中，越靠上的浮层应略微变亮，从而表达空间关系。

应用到 TileSim：

```text
dark canvas（最暗）
  → inset / table body
    → panel
      → panel-strong / control / popover（最亮）
```

因此深色模式不会把所有背景压成同一黑色；侧栏、页面、面板、输入框和菜单保持可识别层次。

### GOV.UK：桌面阅读宽度与布局

[GOV.UK Layout](https://design-system.service.gov.uk/styles/layout/) 建议限制普通文字行长，并允许数据密集
内容在确有需要时使用更宽容器。

应用到 TileSim：

- 普通说明文字保持受控宽度和 1.5-1.75 行高；
- 表格、执行流和图表可以使用更宽的桌面工作区；
- 使用 `minmax(0, 1fr)`、明确 overflow 容器和 `overflow-wrap:anywhere` 保护长 ID；
- 电脑端主工作区最大宽度提高，但不会无边界拉长段落。

### web.dev：reduced motion

[prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion) 建议为主动表达了减少动态偏好的用户提供
低动态版本。

应用到 TileSim：

- 页面进入、菜单、主题图标和 disclosure 仅使用 140-280ms 的一次性过渡；
- 不使用影响证据读取的自动位移或循环动画；
- `prefers-reduced-motion: reduce` 下统一关闭装饰动画、延迟和滚动动画；
- loading spinner 仅用于真实进行中的操作。

### WCAG：对比度

[WCAG 2.2 Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) 要求普通文字
至少达到 4.5:1，大文本至少达到 3:1。

应用到 TileSim：

- 中性文字、状态文字、placeholder、表头和图表坐标轴都纳入 axe 检查；
- 不仅依赖色相区分 pass/warning/danger；
- focus ring 在所有 palette 与 appearance 组合中保持可见；
- 深色主按钮使用深色前景配合亮 accent，避免白字落在过亮背景上。

## 3. 视觉系统设计

### 3.1 状态模型

```text
palette:    blue | cloud | mint | classic
appearance: light | dark
```

两个状态分别持久化。切换 appearance 不改变 palette，切换 palette 也不改变 appearance。

### 3.2 核心语义 token

| 类别 | Token                                         | 用途                     |
| ---- | --------------------------------------------- | ------------------------ |
| 空间 | `--canvas`                                    | 页面底层画布             |
| 空间 | `--surface-inset`                             | 内嵌记录、表体、低层内容 |
| 空间 | `--panel`                                     | 标准面板                 |
| 空间 | `--panel-strong`                              | 浮层、菜单、强调面板     |
| 控件 | `--control-bg`                                | input、select、search    |
| 文字 | `--ink` / `--ink-soft` / `--muted`            | 主文、说明、弱化信息     |
| 边界 | `--line` / `--line-strong`                    | 分隔、控件边框           |
| 品牌 | `--accent` / `--accent-soft`                  | 操作、选中、导航         |
| 状态 | `--positive-*` / `--warning-*` / `--danger-*` | 状态背景与前景           |
| 数据 | `--table-header`                              | 表头与固定头部           |

### 3.3 排版

- 标题使用紧凑字距和清晰的三级层次；
- ID、SHA、ps、bytes 和数值继续使用等宽字体与 tabular numbers；
- 正文说明避免全大写；kicker 和 schema/contract 标签可使用等宽大写；
- 中英文长文本允许自然换行，原始 JSON、ID 和枚举不翻译。

### 3.4 动效

- 页面：轻微 `translateY + opacity`，一次进入；
- 菜单：从触发器方向缩放/淡入；
- appearance：Sun/Moon 图标短促旋转和缩放；
- hover：最多 1-2px 位移，只用于可交互元素；
- 图表：保留短时首次绘制，切换主题时重绘颜色；
- reduced motion：所有上述装饰效果接近 0ms。

## 4. 分阶段实施

### 完成状态（2026-08-30）

| 阶段   | 状态   | 已完成结果                                                                       |
| ------ | ------ | -------------------------------------------------------------------------------- |
| 阶段一 | 已完成 | appearance 独立状态、持久化、双语切换控件、深色 token、ECharts 主题联动          |
| 阶段二 | 已完成 | 1440px 桌面工作区、全局排版与间距、语义化表面层级、受控动效和 reduced motion     |
| 阶段三 | 已完成 | Overview、Execution/F6B、证据页、Experiment、History 与 Design Space 视觉精修    |
| 阶段四 | 已完成 | 契约/依赖/类型/lint/format/build、107 个前端测试和 20 个桌面 Playwright 全部通过 |

人工检查覆盖了浅色主证据页、未知 Schema fail-closed 页和 Mint 深色证据页。更新视觉快照前均核对了
canonical flow、S3/S4/S5 并列关系、S7-S9 输出面、原始 JSON 完整性和桌面 overflow。

### 阶段一：外观基础设施

范围：

- 新增独立 `appearance=light|dark` 状态、持久化和 DOM 属性；
- 新增浅色/深色切换控件；
- 建立深色语义 token 和四套 palette 的暗色 accent；
- 图表轴线、文字、tooltip 随 appearance/theme 重绘；
- 补齐中英文文案。

验收：

- palette 与 appearance 状态相互独立；
- 刷新后保持选择；
- 首屏加载前已设置 DOM 外观，避免明显闪烁；
- typecheck、dependency boundary、unit test 通过。

### 阶段二：全局排版、布局与动效

范围：

- 扩展电脑端工作区宽度，优化 header、panel 和 view stack 的节奏；
- 将散落的浅色硬编码迁移到语义 token；
- 统一输入控件、表格、内嵌记录和浮层层级；
- 增加表格 hover、数值对齐、长文本换行和受控横向滚动；
- 优化一次性进入动画、菜单和 appearance 图标动效。

验收：

- 1440px 桌面视口无非预期页面级横向滚动；
- 中英文长文本、request ID、SHA-256 和 JSON Pointer 不遮挡操作；
- light/dark 下层级可辨，不出现大片同色面板；
- reduced motion 下装饰动画被关闭。

### 阶段三：重点页面视觉精修

范围：

- Overview：状态 hero、统计卡片和下一步行动层级；
- Execution/F6B：canonical flow、S3/S4/S5 peer group、S7-S9 输出面；
- Metrics/Validation/Attribution：表格、状态、gap 和证据链接；
- Experiment/History/Design Space：输入、对比、候选与浮层。

验收：

- 不改变任何报告字段和证据含义；
- S3/S4/S5 始终并列；
- 0、missing、expected absence、not covered、unsupported schema、not applicable 视觉可区分；
- 关键操作键盘可达，focus 清晰。

### 阶段四：视觉与工程回归

范围：

- unit/component：状态独立、持久化、切换控件、图表主题；
- desktop Playwright：light/dark、四 palette、刷新持久化、中英文、长文本、overflow；
- axe：普通与深色关键页面；
- prefers-reduced-motion；
- 更新经人工检查的视觉快照。

最终门禁：

```powershell
pnpm contracts:check
pnpm deps:check
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm build
pnpm test:e2e
git diff --check
```

## 5. 风险控制

- `127.0.0.1:5173` 不因本轮工作被停止或重启；
- 不修改 `D:\tileSim-week8`；
- 保护两个仓库的既有未提交改动；
- 深色覆盖遗漏优先通过迁移语义 token 修复，不堆叠无边界 `!important`；
- axe 或对比度失败必须修正 token，不通过关闭检查规避；
- 视觉快照只在人工查看实际页面后更新。
