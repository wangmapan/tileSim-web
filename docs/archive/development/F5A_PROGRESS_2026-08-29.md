# F5A 大型工件基线与 Worker Contract

**状态**：2026-08-29 validated  
**范围**：F5A；不声称 Worker 索引、虚拟列表或 evidence pointer 已接入页面

## 已完成

- `tests/performance/large-artifact-fixture.mjs` 确定性生成 14.30 MB / 100,000 行工件，不向仓库提交巨大 JSON 副本。
- 同一配方固定超长单行、64 位整数十进制字符串和 unknown-schema 边界样本。
- `src/features/inspect-artifact/model/worker-contract.ts` 定义版本化 Worker request/result/error/cancel contract。
- 每项工作绑定 `{runId, artifactId, sha256, schemaIdentity}` 和 `requestId`；支持取消、搜索结果上限和 stale-result 拒绝。
- 大型 payload 使用可 transfer 的 UTF-8 `ArrayBuffer`，不把结构化对象作为 Worker 边界。
- `pnpm perf:artifact-baseline` 提供五样本中位基线；机器记录见 `f5a_artifact_baseline_2026-08-29.json`。

## 基线结论

| 项目                         | 当前值       |
| ---------------------------- | ------------ |
| 源工件                       | 14,299,360 B |
| 源行数                       | 100,000      |
| pretty-format 后逻辑行数     | 599,975      |
| parse 中位数                 | 15.986 ms    |
| pretty-format 中位数         | 28.169 ms    |
| 首次按行搜索中位数           | 36.835 ms    |
| parse/format/search 总中位数 | 80.224 ms    |
| 进程 heap delta 中位数       | 90,010,344 B |

这是 Node 主线程算法基线，不包含浏览器 paint/layout 和交互延迟。当前 `<pre>` 仍要布局约 60 万逻辑行，因此不能用 80 ms 算法时间宣称 10 MB 页面已经可交互。

## 验收

- Frontend：82/82 Vitest。
- Bridge：28/28 unittest。
- Desktop：10/10 Playwright。
- TypeScript、ESLint、Prettier、contract drift、依赖方向、Python compile、production build 和 `git diff --check` 通过。

## 下一步

进入 F5B：实现专用 Worker 的 UTF-8 解码、格式化、行索引、搜索和 JSON Pointer 索引；页面切换 run/artifact 时发送 cancel，并只接受当前 identity/request 的结果。Worker 接入前不得移除完整下载和复制回退。
