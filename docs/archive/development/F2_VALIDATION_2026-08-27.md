# F2 类型化契约与 Adapter 验证

> 历史快照：本文件只记录 2026-08-27 的 F2 验证。当前状态和下一步以 `../AI_HANDOFF.md` 为准。

**状态**：validated（frontend compatibility scope）  
**时间**：2026-08-27  
**机器记录**：[f2_validation_2026-08-27.json](f2_validation_2026-08-27.json)

## 1. 完成范围

- 建立 `schema -> contract -> adapter -> view model -> component` 路径，并以 TypeScript 5.9、`vue-tsc` 和严格类型覆盖报告加载、运行状态及主要报告页面。
- 新增前端兼容 schema，由同一生成脚本产出 TypeScript identity types 和 Ajv standalone validators；生成物漂移、代码格式和类型错误均进入门禁。
- versioned registry 对已知但畸形的 schema 返回 `invalid_schema`，对未知显式版本返回 `unsupported_schema`；两者均失败关闭并保留完整原始 JSON。无显式版本的 legacy bundle 继续兼容。
- 概览和指标页通过稳定 view model 读取数据。派生字段返回 `value`、`sourcePaths`、`derivation` 和 `availability`，不再由组件猜测原始字段。
- `availability` 区分 `available`、`expected_absence`、`not_covered`、`missing` 和 `unsupported_schema`；真实数值 `0` 不会被转换成缺失。
- API 与本地文件导入改用无损 JSON 解析：安全整数保留为 `number`，超出 JavaScript safe integer 的整数保留为十进制 `string`，小数保留为 `number`，重复 JSON key 被拒绝。S7 ps 时间差使用 `BigInt` 计算。
- S3、S4、S5 在 contract、adapter 和执行视图中保持并列资源语义；当前执行范围仍为 `S1 -> S6`，当前设计空间仍为 `S6_only`。

F2 没有引入 Router、Pinia、TanStack Query 或目录大迁移；这些仍属于 F4。当前 API 类型也不是 F3 计划中的正式 OpenAPI/API contract。

## 2. Schema 边界

后端当前没有可直接生成的 canonical JSON Schema。`src/contracts/schemas/report-identities.compat.schema.json` 是前端根据稳定版本标识和现有样本维护的兼容 schema，只用于保护当前读取边界，不得描述为后端 canonical contract。

因此 F2 在“前端兼容契约”范围内完成；后端正式 schema 仍是 external blocker。后续拿到正式 schema 时，需要在不降低 unknown-schema fail-closed、legacy compatibility、provenance 和无损整数门禁的前提下进行对齐。完整 API manifest、OpenAPI、SSE、request ID 和 schema-set revision 属于 F3。

## 3. 验收结果

| 门禁                      | 结果                                             |
| ------------------------- | ------------------------------------------------ |
| `vue-tsc --noEmit`        | 通过                                             |
| contract generation drift | 通过；生成器与仓库 Prettier 配置一致             |
| Vitest                    | 8 files，32/32，通过                             |
| ESLint                    | 0 errors，0 warnings                             |
| Prettier                  | 全仓检查通过                                     |
| bridge unittest           | 8/8，通过                                        |
| Vite production build     | 1,840 modules；JS 219.95 kB / gzip 69.85 kB      |
| Playwright 桌面           | 5/5，通过                                        |
| axe                       | serious/critical 违规 0                          |
| 浏览器运行错误            | page error、非预期 console error、5xx 均 0       |
| 桌面溢出                  | 页面横向溢出和普通文字溢出均为 0                 |
| 视觉基线                  | F1 的 synthetic 与 unknown-schema 桌面快照无变化 |
| `git diff --check`        | 通过；仅既有 Windows 行尾提示                    |

已覆盖的关键回归包括：unsafe integer API payload、重复 key 拒绝、known malformed schema 失败关闭、unknown version 原文保留、legacy bundle 兼容、expected absence 与真实 `0` 区分、source path 回溯和 S3/S4/S5 去重。

## 4. 真实运行复测

- bridge deployment：`local:codex/week6-design-space-closure`
- source/build revision：`e06cab9d2a1a9509e8f99729f390236511a9a239`
- identity gate：`versions_match=true`、`state_digests_match=true`、`execution_ready=true`
- 运行：`run-20260825-221201-d892ba16`（`week6-local-snapshot-smoke`）
- 页面结果：structured unsupported alerts 0；S0-S6 节点 7；S7 stages 5；页面/控制台失败 0；横向与普通文字溢出 0。

该运行是 `synthetic_consistency` 证据，不升级为 held-out real-trace validation。

## 5. 结论

F2 在前端兼容契约范围内验收完成。页面数据现在经过版本注册、运行时校验、稳定 adapter/view model 和无损数值路径；breaking 或未知显式 schema 不会静默进入旧结构化视图。下一阶段进入 F3 Bridge/API 契约与执行状态闭环，不提前开始 F4 结构迁移。
