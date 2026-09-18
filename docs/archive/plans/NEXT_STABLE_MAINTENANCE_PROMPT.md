# TileSim Web Stable Maintenance Handoff Prompt

下面的提示词用于让后续 Agent 接手当前稳定版候选的维护、缺陷修复和发布交接。它是当前仓库状态的入口，
不是授权提交、部署或执行真实 Provider acceptance 的替代品。

## 可直接复制的提示词

```text
请在 D:\tileSim-web 接手 TileSim Web 当前稳定版候选的维护工作。

开始前完整阅读：

1. D:\tileSim-web\AGENTS.md
2. D:\tileSim-web\docs\AI_HANDOFF.md
3. D:\tileSim\AGENTS.md
4. D:\tileSim-web\docs\development\FRONTEND_STABLE_CANDIDATE_AUDIT_2026-09-02.md
5. D:\tileSim-web\docs\F10_RELEASE_HARDENING.md
6. 当前任务直接涉及的 feature、公共 index.ts、测试和契约文件

当前仓库与服务事实：

- 前端仓库是 D:\tileSim-web，不要误改 D:\tileSim 或其他 worktree。
- 当前分支是 codex/f9-evidence-agent-v2-release-hardening，开始接手时必须先执行 git status --short --branch；
  不得 reset、clean、覆盖、回滚、擅自提交或推送任何既有改动。
- 当前稳定版候选包含尚未提交的审查修复：删除未引用的旧 PagePrimer、消除跨 workstream i18n 重复键、
  增加词典所有权测试、ECharts 6.0.0 升级到 6.1.0，以及对应稳定版/发布文档更新。
- 该候选已经通过 265/265 frontend、78/78 Bridge、29/29 desktop fixture Playwright、contracts、deps、
  typecheck、lint、format、build、生产依赖安全审计和 git diff --check。
- 隔离端口 58173 的 tilesim.web.release_rehearsal.v1 已通过：真实 run 完成、坏 CLI 失败关闭、immutable
  snapshot、manifest 与同一 completed run 成功恢复。
- 当前 127.0.0.1:5173 仍是审查前的 immutable Web snapshot，web source revision 为
  d538aceb85095b27d17b4abe9ebb5946157bd381；后端是 D:\tileSim-week8 的
  codex/week8-scale-system-acceptance @ 4a536cc081abb20567c19ab9e94e6139f5008333。
- 当前 schema-set revision 是 sha256:92acce87f4f611893fafb2bf81dd1fa4fac509316ea2b5215a60f1995688871e；
  Evidence Agent descriptor 是 tilesim.bridge.evidence_agent_descriptor.v2，revision 是
  sha256:5f78ed33e20c131f672af53368c5ca950f41d63fd2e8f5301757d1f42debe357。
- authenticated Provider capability probe 当前返回 available/configured，但真实 live repetitions 仍为 0；
  capability available 绝不等于 F9 validated。

职责与安全边界：

1. 保护所有未提交改动。先理解现有 diff，再进行最小、可验证的修改。
2. 除非用户明确说“提交”或“推送”，不要创建 commit、不要 push。
3. 除非用户明确说“部署/重启 5173”，不要停止、重启或替换 127.0.0.1:5173。
4. 除非用户明确授权 live Provider acceptance，不要发送真实 Evidence Agent 问题。
5. 不读取或输出 TILESIM_EVIDENCE_AGENT_* 的值，只能引用变量名；不得使用 OPENAI_* fallback、fake Provider
   或 compatibility harness 声称 live closure。
6. 前端不得重算或补造后端指标、因果、Pareto、fidelity、provenance 或 validation 结论。
7. 保持 S3/S4/S5 并列；S7 是统一执行宿主；S8/S9 不进入 latency causal ranking。
8. real_trace、synthetic_trace、compatibility_harness_trace 不得互相升级；synthetic consistency 不等于 held-out
   validation。
9. requested fidelity、resolved fidelity、execution mode 分开；uint64 ps/bytes/count 始终走无损路径。
10. view 只编排；跨 feature 只走公共 index.ts；components/ui 不访问 store、feature、Bridge API 或报告 schema；
    不把业务重新集中回 src/store/dashboard.ts。

接手后的第一轮检查：

- git status --short --branch
- git diff --check
- 只输出非敏感字段检查 http://127.0.0.1:5173/api/health、/api/manifest 和
  /api/agent/evidence-capabilities
- pnpm install --frozen-lockfile --offline
- pnpm contracts:check
- pnpm deps:check
- pnpm typecheck
- pnpm test
- pnpm lint
- pnpm format:check
- pnpm build
- python -m py_compile Bridge 入口与服务文件
- python -m unittest discover -s bridge -p "test*.py"
- F7/F8/F9 Schema/OpenAPI inventory 与 Python/Node canonical digest tests
- pnpm test:e2e

维护优先级：

1. 优先修复 P0/P1、契约漂移、跨 run/stale 泄漏、无损整数、证据身份、键盘/焦点/overflow/axe 和发布回滚问题。
2. 保持 ECharts 使用 echarts/core、按需图型和 SVG renderer；当前约 347 kB runtime + 183 kB renderer。
3. 主共享入口约 841.80 kB 是已知非阻断债务；先做 bundle attribution，再决定拆分，不为消除 warning 重复打包。
4. dashboard compatibility controller 只渐进拆分，不做无证据的全量重写。
5. 后端正式 canonical report Schema、真实 calibration assets 和 held-out validation 未交付前，保持明确 unavailable/
   compatibility/synthetic 边界。
6. 若用户授权 F9 live acceptance，严格执行 success/refusal/timeout、每个安全/拒答配置至少 5 次重复评测和双人
   citation entailment review；通过前 F9 保持 acceptance-pending。

若任务涉及发布：

- 先在非 5173 端口运行 pnpm release:rehearse，确认真实 run、失败关闭、rollback 和 immutable bytes。
- 只有用户明确授权后才能部署 5173。
- 部署后必须核对 source/build/state/release/Bridge/static/schema/descriptor identity，并复核正式 run artifact 的
  bytes、SHA-256、run binding 和 rejected_artifacts=[]。
- 失败部署必须恢复上一 immutable snapshot；不得把部分健康状态报告为成功。

最终报告必须包含：

- 实际修改文件与语义
- 是否改变 contract/schema/identity/revision
- 全部门禁结果及精确测试数量
- 当前 5173 是否被部署或重启
- Provider live repetitions 数量和 F9 是否仍为 acceptance-pending
- 未关闭的 blocker、P0/P1 和非阻断技术债
- git status，明确哪些改动尚未提交
```

## 使用说明

- 普通维护任务直接使用整段提示词，再在末尾补充具体缺陷或功能目标。
- 需要并行开发时，每个 Agent 必须使用独立 worktree，并先遵守 `docs/plans/PARALLEL_FRONTEND_WORKSTREAMS.md` 的文件所有权。
- 集成 Agent 负责最后的 generated contract、i18n、视觉快照、完整门禁和部署身份复核。
