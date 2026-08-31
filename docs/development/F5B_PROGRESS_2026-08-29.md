# F5B Artifact Worker 索引

**状态**：2026-08-29 validated  
**范围**：Worker 解码、格式化、行索引、搜索、JSON Pointer、取消和 stale-result rejection；不声称虚拟列表已完成

## 已完成

- Bridge artifact 浏览新增 hash-verified raw-text 入口；Worker 接收原始 UTF-8 `ArrayBuffer`，主线程不再解析或 pretty-format 远端工件。
- 专用 Worker 使用无损 JSON 解析，校验 manifest schema identity，建立行 offset、line-to-pointer 和 pointer-to-line 索引。
- 搜索在 Worker 内异步分段执行，最多返回 200 条有界预览，同时保留准确总匹配数。
- 切换 run/artifact 时终止旧 Worker；连续搜索发送 cancel，并按 request ID 与 artifact identity 拒绝过期结果。
- 复制使用 hash-verified 完整原文；原始文件入口保持不变。Worker 失败时显示明确错误，复制和原始文件仍可用。
- unknown schema、64 位整数十进制字符串、Pointer escape、超长单行和快速 artifact 切换均有回归覆盖。

## 性能

- 固定样本：14,299,360 B / 100,000 源行。
- 格式化索引：599,975 行、499,978 个 Pointer。
- 五样本索引中位数：614.176 ms。
- 五样本首次搜索中位数：280.692 ms；所有样本均低于 500 ms。
- 独立浏览器测试确认索引期间 20 ms 主线程计时器持续推进。
- 生产 Worker chunk：11.53 kB。

机器记录见 `f5b_artifact_worker_baseline_2026-08-29.json`。Node/vite-node 数值不包含 Worker transfer 和浏览器 paint；真实 Worker 与主线程可交互性由 Playwright 单独覆盖。

## 验收

- Frontend：86/86 Vitest。
- Bridge：28/28 unittest。
- Desktop：11/11 Playwright，其中 1 项为 14.3 MB Worker 性能门禁。
- TypeScript、ESLint、Prettier、contract drift、依赖方向、production build 和 `git diff --check` 通过。

## 已知边界与下一步

Worker 当前仍将完整 pretty text 返回主线程并交给单个 `<pre>`；计算已移出主线程，但约 60 万行的字符串复制、浏览器布局和绘制尚未关闭。因此下一步必须进入 F5C：Worker 提供有界行窗口，页面虚拟化展示且 DOM 行数不超过 300。完成 F5C 前不得声称 10 MB 完整浏览已经达到最终交互目标。
