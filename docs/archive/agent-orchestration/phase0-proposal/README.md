# Agent 编排 Phase 0 Contract Catalog Proposal

状态：`proposal_only`。本目录不属于正式 OpenAPI、Schema 根索引或 schema-set，不能作为已发布 runtime contract 使用。

## 1. 职责边界

本 proposal 对应 `GAP-CAP-001` 与 `GAP-PROFILE-001`，只定义：

- parameter descriptor；
- capability snapshot；
- model、engine、device、topology、workload 五类最小 Profile；
- status、reason code、revision、digest、deprecation 与兼容语义；
- schema-local fixture、跨 Python/TypeScript canonical digest vector 与局部测试。

它不实现 registry、lowering、执行链、UI、Provider、create-run successor、正式发布或 schema-set 更新。所有 profile fixture 都是合成 contract fixture，不代表真实模型、设备、网络、校准或 held-out 验证。

## 2. 冻结输入身份

| 输入                      | 冻结身份                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| runtime schema set        | `sha256:eb6c0dc921faa53789c053dfef99b82d1a5eb0499cb244e364178eab43e7095c`                                                 |
| experiment descriptor     | `tilesim.bridge.experiment_descriptor.v1` / `sha256:de97e5fe0aae2ae1c5ffeeda7a0a56fd23c6a56aa28c3746eead00d89c68d059`     |
| create-run                | `tilesim.bridge.create_run_request.v1`                                                                                    |
| Evidence Agent descriptor | `tilesim.bridge.evidence_agent_descriptor.v2` / `sha256:5f78ed33e20c131f672af53368c5ca950f41d63fd2e8f5301757d1f42debe357` |
| Evidence Agent family     | request/response/citation/snapshot v1                                                                                     |

本目录没有改变以上任何身份，也没有为它们发布 successor。

## 3. 十维能力语义

每个维度独立取 `affirmed`、`denied`、`unknown` 或 `not_applicable`，并携带稳定 `reason_code` 和证据引用。一个维度不能由另一个维度推断。

| 维度                 | 精确定义                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `described`          | 正式 descriptor/catalog 有稳定字段身份与语义。                                                                   |
| `accepted`           | 冻结 request identity 的正式入口接受该字段。                                                                     |
| `validated`          | 有确定性语法、单位、范围和跨字段规则。                                                                           |
| `lowered`            | 字段进入声明的拥有模块转换节点，而非仅被保存。                                                                   |
| `executed`           | 在目标执行路径中真实改变状态、事件或控制决定。                                                                   |
| `observable`         | 正式 artifact/field 或 execution test 能证明执行影响。                                                           |
| `calibrated`         | 在明确 valid regime 内绑定校准 receipt。                                                                         |
| `held_out_validated` | 在同一声明 regime 内绑定独立留出验证 receipt。                                                                   |
| `ui_exposed`         | 当前 Web 可提交；不等价于 `executed`。                                                                           |
| `agent_exposed`      | Agent 可建议或写入可运行草案。只有 accepted、validated、lowered、executed、observable 都为 `affirmed` 时才允许。 |

`calibrated` 和 `held_out_validated` 限制 claim scope，不决定字段能否执行。`held_out_validated=affirmed` 必须同时有 `calibrated=affirmed`。Schema 内以条件约束强制这些不变量。

## 4. 状态与 reason code

整体 `status` 使用：`available`、`conditional`、`not_exposed`、`unsupported`、`unresolved_not_executed`、`profile_missing`、`calibration_missing`、`temporarily_unavailable`、`deprecated`。

控制流只能使用 `reason_code`，不能解析用户说明。稳定原因集合定义在 `schemas/common.schema.proposal.jsonc`；未知 reason code 因 Schema `enum` 失败关闭。文本说明可以本地化，但不能改变控制流。

## 5. Revision 与 digest

- revision 与 digest 都使用 `sha256:<64 lowercase hex>`。
- revision 标识 immutable contract/profile revision；事实变化必须产生新 revision。
- `canonical_digest` 使用 `tilesim.bridge.canonical_json.v1`：Unicode code point key order、数组顺序保留、UTF-8、无空白分隔符、lossless decimal integer token、禁止非有限数和二进制浮点。
- digest material 必须排除对象自身的 `canonical_digest`，并由对象 Schema 的 `digest_material_fields` 明确列出；禁止“删除任意看起来不稳定的字段”式隐式规则。
- capability snapshot 绑定 backend、schema-set、experiment descriptor、create-run、Evidence Agent descriptor 和 catalog/profile revisions。任一 binding 改变，旧 snapshot 必须成为 stale，而不是静默重写。

## 6. Deprecation 与兼容

- Profile 和 descriptor revision immutable；更正事实发布新 revision。
- additive optional 字段可保持同 major family；收紧、删除、改变单位/含义、改变 digest material 或把 unknown 当 default 都属于 breaking change。
- 先 `active`，再发布 `deprecated` revision，提供 replacement（若存在）和 removal revision；未知 identity/revision 失败关闭。
- `withdrawn` 只影响新解析。历史 run 仍引用当时 immutable revision，不能被重解释。
- 本 proposal 不声明正式 predecessor/successor；`replacement_identity` 为 `null`。

## 7. Profile 事实纪律

五类 Profile 的关键字段使用 assertion：`known` 必须有 value 和 evidence；`unknown` 不得携带 value；`not_applicable` 必须有原因。字段来源分别标记 `observed`、`inferred` 或 `modelled`。Profile 自报不能把 calibration 或 held-out 状态升级；只有对应 receipt source 与 policy 校验后 capability snapshot 才能 affirm。

Model/Device fixture 使用虚构 identity 且关键性能为 unknown；没有硬编码 H100、真实模型结构或设备性能。

## 8. 局部验证

在本目录运行 JSON parse 和 canonical vector：

```powershell
Get-ChildItem -Recurse -Filter *.jsonc | ForEach-Object { python -m json.tool $_.FullName *> $null }
python canonical/test_canonical_digest.py
node canonical/test_canonical_digest.ts
```

Schema fixture 校验需要仓库已安装的 `ajv`。若当前 worktree 没有 `node_modules`，可只为模块解析设置 `NODE_PATH`，不安装或修改依赖，然后使用审计任务中的直接 Ajv 命令校验 `schemas/` 与 `fixtures/`：

```powershell
$env:NODE_PATH='D:\tileSim-web\node_modules'
```

测试不启动 Bridge、不接触 5173、不调用 Provider，也不读取 credential。
