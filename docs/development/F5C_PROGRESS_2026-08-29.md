# F5C 大型 JSON 虚拟浏览

**状态**：2026-08-29 validated  
**范围**：Worker 行窗口、虚拟滚动、搜索定位和桌面 JSON 浏览；不声称结构化字段 evidence link 已完成

## 已完成

- index-ready 不再向主线程回传约 18 MB 的完整 pretty JSON；Worker 保留完整索引，只通过 read-lines 返回行窗口。
- read-lines contract 将单次响应限制为 1–300 行；页面常驻 120 行，固定行高虚拟滚动覆盖 599,975 个格式化行。
- 超长单行窗口最多 4,000 字符并显示截断标记；完整复制和原始文件仍使用 hash-verified 原文。
- JSON viewer 支持 Pointer 列开关、搜索命中高亮、上一项/下一项、PageUp/PageDown/Home/End 和匹配行定位。
- 小工件按实际行数收缩浏览区；大工件保持 560 px 桌面浏览区和内部横向滚动。
- run/artifact 快速切换继续以 Worker terminate、artifact identity、load revision 和 window revision 拒绝旧结果。

## 性能

- 固定样本：14,299,360 B / 100,000 源行 / 599,975 格式化行 / 499,978 Pointer。
- 五样本中位数：索引 613.057 ms；首次搜索 296.52 ms；120 行窗口切片 0.032 ms。
- 相对 F5B 中位数：索引约 -0.2%，首次搜索约 +5.6%，均未达到 20% 回退阈值。
- 浏览器实测首次搜索低于 500 ms，索引期间主线程计时器持续推进。
- 虚拟组件在 599,975 总行数下只挂载 120 个 JSON 行节点，低于 300 行门限。
- 生产 Worker chunk：12.36 kB。

机器记录见 f5c_artifact_virtual_baseline_2026-08-29.json。

## 验收

- Frontend：88/88 Vitest。
- Bridge：28/28 unittest。
- Desktop：11/11 Playwright。
- TypeScript、ESLint、Prettier、contract drift、依赖方向、production build 和 git diff --check 通过。
- unknown schema、64 位值、完整复制、快速 artifact 切换、axe、键盘、视觉和 overflow 回归保持通过。

## 下一步

进入 F5D evidence link。统一 runId、artifactId、sha256 和 pointer，结构化指标、validation、attribution 和 execution inspector 可打开 JSON viewer 并定位对应 Pointer。F5C 内部搜索定位不是跨功能 evidence link。
