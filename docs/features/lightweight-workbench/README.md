# TileSim 轻量工作台

状态：`L6R 验收补强已完成（fixture 闭环与发布前门禁通过；Provider/live/calibration/held-out 仍未执行）`。

轻量版与专业版是两个并列工作台。轻量版面向基础知识储备较少的用户，通过渐进式配置减少复杂信息，但必须保留真实实验的完整闭环：

```text
新建实验 → 配置 → 校验 → 提交 run → 查看状态 → 查看结果与必要图表
```

轻量版不是学习中心、任务目录、模板展示页或已有 run 的只读浏览器。工作台可以创建正式 run；专业版现有的同一个 `TileSim 助手` 复用于轻量工作台，但只负责解释和生成本地草案，不写入表单、不自行创建 run、不调用 Provider，也不能替代实验配置或绕过正式 run 流程。

L3R/L4R/L5R 已实现：基础配置、canonical request preview、正式提交、idempotency 恢复、run 状态轮询、真实报告摘要与图表、专业版切换和 query 上下文保留。L6R 已加入 fixture/mock Bridge 的桌面闭环验收与失败边界审查；fixture 仅证明 UI、路由、状态机和契约映射，不构成 Provider、live、calibration 或 held-out 证据。

当前已支持：在 JSON 输入模式中对 canonical topology request 提供可视化连接图、设备布局拖拽和显式 `links` 的连接/属性编辑；布局坐标只保留在前端，不会写入提交 JSON。当前仍未支持完整 design space、trace package 深度编辑或完整设备/domain CRUD；后端尚未开放的高级 profile/并行/KV 能力也继续保持禁用。

页面 remediation 已完成 P0/P1/P2/P3 并通过发布前复验：主导航只保留“开始 / 新建实验 / 结果”，不再提供独立“任务”或“学习”板块；旧 `/lightweight/tasks` 仅兼容重定向到 `/lightweight/prepare`，旧 `/lightweight/learn` 仅兼容重定向到 `/lightweight`，并且只保留合法工作台 query。教程、字段解释和证据边界统一放入右上角“页面帮助”；轻量帮助与专业版帮助按 workspace scope 完全分域，不共享主题列表、搜索分组或跨域跳转。轻量首页已移除教程式副文案，主流程只保留状态、证据和可执行动作。运行页采用“状态→下一步→元信息”层级并展示轮询终止、artifact SHA-256 和 schema revision；结果页采用“结论→证据→细节”层级并区分 resolved fidelity、provenance、unsupported schema、0 与 missing。L6 fixture 闭环已覆盖正式提交、状态推进、刷新恢复、真实 fixture 报告、失败边界和专业版往返；当前前端单测为 639 passed/8 skipped，Bridge 91/91，完整桌面 fixture E2E 为 63 passed/6 skipped，live/Provider 相关 6 项保持 skipped。

run/results 合法深链会先等待共享 Bridge manifest/schema bootstrap；bootstrap 失败时 fail closed，不从无 manifest/schema 上下文回退到 legacy evidence 路径。App shell 与轻量页面并发进入时共用同一个 readiness promise，避免重复 bootstrap 和竞态读取。

两个工作台只共享同一套 Agent 外壳、状态和公共 context adapter，不混用页面帮助。轻量配置页向助手发布正式八字段与当前值，轻量运行/结果页从合法 run ID 恢复上下文；切换模式后助手面板状态可以保留，但前一页面的 context 必须失效。fixture 只验证这条 UI、路由、状态机和契约映射路径，不能证明模型 Provider、live 执行、calibration 或 held-out validation。

## 当前产品基线

完整方案、路由、字段分层、状态语义、图表规则、Agent 边界、实施阶段和验收标准统一维护在：

- [LIGHTWEIGHT_WORKBENCH_PLAN.md](LIGHTWEIGHT_WORKBENCH_PLAN.md)

旧的只读方案文档已删除，避免后续开发继续引用冲突决策。专业版旧路由、Bridge、Provider、canonical schema 和现有 run 语义仍是保护边界。
