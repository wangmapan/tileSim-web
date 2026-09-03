# Trace-package Web 快速原型

## 目标与边界

本原型把工作负载抽象与负载描述语言模块产生的六类核心 Trace package，通过受控 Bridge
入口交给统一仿真内核模块执行，并复用现有运行状态、报告、History 与 Evidence 展示链。

首版只开放 `synthetic_trace`。`real_trace` 和 `compatibility_harness_trace` 可以被发现和查看，
但不能提交。synthetic fixture 只验证契约、路径安全和流程一致性，不构成真实设备校准、独立
留出验证、数值正确性或硬件 fidelity 证据。该原型也不提供浏览器上传、任意服务器路径、Cycle
级执行、设计空间联合提交或新的指标/归因计算。

## 数据流

1. Bridge 从 `TILESIM_TRACE_PACKAGE_ROOT/<package-directory>/trace_package.json` 发现候选。
2. Bridge 负责目录约束、稳定 package ID、大小上限、symlink/junction 拒绝和调用隔离。
3. TileSimCLI 的 `inspect-trace-package --trace-package <manifest>` 调用后端
   TracePackageAdapter，权威校验 manifest、六类语义 artifact、SHA-256、入口边界、trace kind 与
   provenance。
4. 前端通过 TanStack Query 加载 catalog；query identity 包含 backend identity 和
   `schema_set_revision`。页面只展示后端返回的身份与证据范围，不补造 provenance 或 artifact 状态。
5. 浏览器创建运行时只发送稳定 `trace_package_id`。Bridge 在创建前重新 inspect，并只接受
   `synthetic_trace`。
6. Bridge 从白名单场景物化 topology，然后以参数数组调用
   `TileSimCLI run --trace-package <manifest> --topology <topology> --to S6 ...`。package 入口边界由
   manifest 决定，因此不传固定 `--from`，也不传 `--trace`。
7. 完成后沿既有 run status、reports、artifact manifest、History 和 Evidence 路径加载结果。

其中 `S0`–`S6` 只是在 CLI 参数和现有代码路径中的遗留边界标识。语义上，package 可以从工作负载
与请求层、推理引擎与服务运行时层、执行语义与并行层或资源语义层进入，最终由网络与硬件资源层
收敛通信需求，并由仿真执行与控制平面维持统一时间轴。

## HTTP 契约

- `GET /api/trace-packages` 返回 catalog schema identity、Trace-package schema identity、
  schema-set revision、净化后的 backend identity、capability、package 列表和发现错误。
- `POST /api/trace-packages/{package_id}/inspect` 返回所选 package 的最新检查结果。
- `POST /api/runs` 新增 `trace_package_id`。它与 `overrides`、`custom_inputs`、
  `design_space_candidates` 互斥。
- `GET /api/manifest` 发布上述 endpoint、schema identities 和首版允许的 source mode。

catalog 与 inspect 响应均携带 `X-TileSim-Schema-Set-Revision`。前端同时核对响应 payload、header
和已固定 manifest revision；任一不一致都失败关闭。所有响应都不得包含 manifest 或 artifact 的
服务器绝对路径。

## 安全与一致性

- package ID 必须匹配受限 HTTP 标识符；未知 ID、绝对路径和 `..` 不会参与路径解析。
- 受控根目录只接受固定的一层 package 目录；重复 package ID、manifest 缺失、超过 1 MiB、
  malformed UTF-8/JSON、symlink/junction 和 resolved escape 均拒绝。
- TileSim 根目录或 TileSimCLI 不可用时，catalog capability 为 unavailable。
- inspect 设置 15 秒 timeout，并拒绝 CLI 启动失败、非 JSON、非零退出、无效报告、schema mismatch
  和 package ID mismatch。
- 创建 run 前重新 inspect；执行前后再次核对 manifest SHA-256。检查后被替换的 package 以
  `trace_package_changed` 收敛为失败状态。
- CLI 调用始终使用参数数组，不经过 shell 拼接。
- 私有 run metadata 保存 package ID、manifest SHA-256、入口边界、trace kind 和原始 provenance；
  manifest 路径不进入公共 run 响应或 artifact allow-list。

## 前端行为

运行实验页提供快捷控制、JSON 和 Trace package 三种输入模式。Trace-package 面板显示 producer/version、
experiment/physical run identity、入口边界、trace kind、source mode、calibration level、allowed claim
scope、inspect 状态、错误、manifest SHA-256 和六类 artifact 完整性摘要。

只有检查有效且 `submission_available=true` 的 synthetic package 能启用提交按钮。切换到 real 或
compatibility package 会保留只读详情并关闭提交。request 预览只包含 `trace_package_id`，不包含路径，
也不混入 controls、custom JSON 或 design-space 字段。

## 验证

Bridge 测试覆盖正常 catalog、capability unavailable、路径穿越、resolved escape、symlink/junction、
重复 ID、inspect 成功与失败、timeout、非 JSON、SHA 失败、source mode 限制、互斥、idempotency、
metadata 和最终 CLI 参数。前端测试覆盖 catalog 状态、详情、禁用规则、request builder、错误 Pointer
和 query identity。桌面 Playwright fixture 覆盖键盘选择、重新 inspect、provenance/完整性展示、
synthetic 提交、报告加载、axe 严重/致命问题以及横向 overflow。

这些自动化结果应报告为 synthetic consistency 与 contract/flow validation。只有后续获得真实设备
校准资产和独立留出 real trace 后，才能另行声明相应的校准或 fidelity 结论。
