# F1 Fixture 与回归验证

> 历史快照：本文件只记录 2026-08-27 的 F1 状态。当前测试数量和下一步以 `../AI_HANDOFF.md` 为准。

**状态**：validated  
**时间**：2026-08-27  
**机器记录**：[f1_validation_2026-08-27.json](f1_validation_2026-08-27.json)

## 1. 完成范围

- 固定五类报告 bundle：synthetic、held-out real trace、boundary expected absence、legacy 缺可选工件、unknown schema。
- 建立 14 项机器可读字段审计，覆盖关键数字、单位、JSON Pointer、零值保持和 S3/S4/S5 去重规则。
- unknown explicit schema 不进入旧结构化视图，完整原始 JSON 和未知字段仍可查看。
- boundary 指标缺失显示“不适用”，真实数值 `0` 保持为 `0`；旧版四报告 bundle 不补造 execution envelope 或 design space。
- 加入 Vitest 组件测试、Playwright、axe、桌面视觉基线和 ESLint。

F1 没有引入 TypeScript、Router、Pinia 或目录迁移；这些仍属于 F2/F4。

## 2. 桌面范围与溢出

按 2026-08-27 的产品范围决定，后续只维护电脑网页端；移动端不再作为开发和发布门禁，已有响应式代码保持但不单独承诺。

桌面溢出检查不只比较文档宽度，还扫描普通可见元素的 `scrollWidth/clientWidth`。JSON `<pre>` 保留有意横向滚动，以保证证据完整而不裁剪。执行链的 S5 `Collective` 溢出已修复：并列资源区域加宽，长英文标识允许自然断行，较窄桌面窗口使用两行布局。

真实样本 `run-20260825-221201-d892ba16` 的复测结果：

| 视口      | 页面横向溢出 | 普通文字溢出 |
| --------- | ------------ | ------------ |
| 1440×1100 | 0            | 0            |
| 1280×900  | 0            | 0            |

## 3. 验收结果

| 门禁                  | 结果                                       |
| --------------------- | ------------------------------------------ |
| Vitest                | 5 files，25/25，通过                       |
| fixture / field audit | 5 类 fixture，14 项字段映射，通过          |
| ESLint                | 0 errors，0 warnings                       |
| bridge unittest       | 8/8，通过                                  |
| Vite production build | 1,814 modules，通过                        |
| Playwright 桌面       | 5/5，通过                                  |
| unknown schema        | fail-closed，未知字段完整保留              |
| boundary / zero       | “不适用”和真实 `0` 可区分                  |
| provenance            | synthetic 与 held-out 不互相升级           |
| axe                   | serious/critical 违规 0                    |
| 键盘                  | 核心 Tab 路径可获得焦点                    |
| 浏览器运行错误        | page error、非预期 console error、5xx 均 0 |
| 视觉基线              | synthetic、unknown schema 各 1 份桌面快照  |
| `git diff --check`    | 通过；仅既有 Windows 行尾提示              |

缺少可选输入的 fixture 会产生预期的 artifact `404`，测试将其与应用错误、page error 和服务端 `5xx` 分开记录。

## 4. 结论

F1 验收完成。后续重构现在会在字段错配、证据范围升级、unknown schema 误解释、边界指标置零、桌面文字溢出、严重无障碍问题和视觉漂移时自动失败。下一阶段可进入 F2 类型化契约与 versioned adapter。
