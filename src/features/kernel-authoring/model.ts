import { parseJsonLossless, isLosslessInteger } from "../../contracts/lossless-json";
import { executionInput } from "../../contracts/generated/experiment-validators.js";

import type { ExecutionDocument } from "../../contracts/execution-authoring";
export type Document = ExecutionDocument;
export type SourceMode = "default" | "kernel_strategy" | "tilelang_source" | "execution_partition";
export const operations = ["norm_qkv", "attention_output", "norm_gate_up", "activation_down", "final_norm_lm_head"];
export interface Issue {
  path: string;
  message: string;
}
export function cloneDocument<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
export function parseExecution(text: string): Document {
  const value = parseJsonLossless(text);
  // lossless-json allows identical duplicate values. Authoring selectors must
  // reject every duplicate, including identical strategy objects.
  const stack: { object: boolean; keys: Set<string>; expectsKey: boolean }[] = [];
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}[\]:,]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g) || [];
  for (const token of tokens) {
    const parent = stack.at(-1);
    if (token === "{" || token === "[")
      stack.push({ object: token === "{", keys: new Set(), expectsKey: token === "{" });
    else if (token === "}" || token === "]") stack.pop();
    else if (token === "," && parent?.object) parent.expectsKey = true;
    else if (token === ":") {
      if (parent) parent.expectsKey = false;
    } else if (token.startsWith('"') && parent?.object && parent.expectsKey) {
      const key = JSON.parse(token) as string;
      if (parent.keys.has(key)) throw new SyntaxError("JSON contains a duplicate key: " + key);
      parent.keys.add(key);
      parent.expectsKey = false;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("配置根必须为对象");
  return value as Document;
}
export function patchExecution(document: Document, path: string, value: unknown): Document {
  const result = cloneDocument(document);
  const keys = path
    .split("/")
    .slice(1)
    .map((k) => k.replaceAll("~1", "/").replaceAll("~0", "~"));
  let cursor = result;
  for (const key of keys.slice(0, -1)) cursor = cursor[key];
  cursor[keys.at(-1)!] = value;
  return result;
}
export const escapePointer = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");
export function validateExecution(document: Document): Issue[] {
  const issues: Issue[] = [];
  if (!executionInput(document)) {
    for (const e of (
      executionInput as unknown as {
        errors?: { instancePath: string; params?: { missingProperty?: string }; message?: string }[];
      }
    ).errors || [])
      issues.push({
        path: `/execution_input${e.instancePath}${e.params?.missingProperty ? "/" + e.params.missingProperty : ""}`,
        message: e.message || "结构不合法",
      });
    return issues.slice(0, 30);
  }
  const add = (path: string, message: string) => issues.push({ path: `/execution_input${path}`, message });
  if (document.mode === "kernel_strategy") {
    const hw = document.kernel_execution.hardware;
    for (const [selector, selection] of Object.entries(document.kernel_execution.operations) as [string, Document][]) {
      const s = selection.strategy,
        p = `/kernel_execution/operations/${escapePointer(selector)}/strategy`;
      if (s.dtype !== hw.matrix_dtype) add(p + "/dtype", "dtype 与 hardware.matrix_dtype 不一致");
      if (s.threads % 32 || s.threads > Math.min(hw.threads_per_block, hw.threads_per_unit))
        add(p + "/threads", "线程数必须为 32 的倍数且不能超限");
      if (s.shared_bytes > hw.shared_bytes_per_unit) add(p + "/shared_bytes", "共享内存超限");
      if (s.threads * s.registers_per_thread > hw.registers_per_unit)
        add(p + "/registers_per_thread", "寄存器资源超限");
      if (s.source !== "declared" && !s.source_reference) add(p + "/source_reference", "证据来源引用必填");
      if (s.source === "launch_observation" && !s.launch_grid) add(p + "/launch_grid", "launch_grid 必填");
    }
  }
  if (document.mode === "tilelang_source") {
    const ids = new Set<string>(),
      bindings: { phase: string; op: string; instances: string[]; shape: string }[] = [];
    document.tilelang_kernels.forEach((s: Document, i: number) => {
      const p = `/tilelang_kernels/${i}`,
        a = s.source.arguments;
      if (ids.has(s.selection_id)) add(p + "/selection_id", "重复 selection_id");
      ids.add(s.selection_id);
      if (a.dtype !== document.tilelang_model_dtype) add(p + "/source/arguments/dtype", "源码 dtype 与模型不一致");
      if (![128, 256].includes(a.threads) || a.num_stages < 2 || a.num_stages > 4)
        add(p + "/source/arguments", "严格源码子集仅支持 threads=128/256、stages=2–4");
      if (s.source.payload_mode === "materialized" && (a.K > 128 || a.M * a.N > 4096 || a.M * a.N * a.K > 1048576))
        add(p + "/source/payload_mode", "数值 payload 超出物化预算；可显式选择 structure_only，结构模式独立准入");
      if (
        [
          ["M", "block_M"],
          ["N", "block_N"],
          ["K", "block_K"],
        ].some(([d, b]) => a[d] % a[b])
      )
        add(p + "/source/arguments", "形状不能完整覆盖分块");
      const shape = [a.M, a.N, a.K, a.dtype].join("/");
      if (
        bindings.some(
          (b) =>
            b.phase === s.phase &&
            b.op === s.operation &&
            b.shape === shape &&
            (!b.instances.length || !s.instances.length || b.instances.some((x) => s.instances.includes(x))),
        )
      )
        add(p + "/instances", "相同 phase/operator/shape 的实例覆盖重叠");
      bindings.push({ phase: s.phase, op: s.operation, instances: s.instances, shape });
      if (
        s.output_buffer_slots > 0 &&
        (!document.dense_execution.explicit_rank_execution ||
          !s.rank_programs ||
          s.output_policy !== "tile_ready_allreduce")
      )
        add(p + "/output_buffer_slots", "有限槽位要求显式 TP2、完整 rank_programs 和 tile_ready_allreduce");
      if (s.output_policy === "tile_ready_allreduce" && !["attention_output", "activation_down"].includes(s.operation))
        add(p + "/output_policy", "此算子没有受支持的同形 AllReduce 消费者");
      if (s.output_admission_policy === "safe_window_v1" && s.output_buffer_slots <= 0)
        add(p + "/output_admission_policy", "safe_window_v1 要求正数 output_buffer_slots");
      if (s.rank_programs && !document.dense_execution.explicit_rank_execution)
        add(p + "/rank_programs", "rank_programs 要求显式 Rank 执行");
    });
  }
  return issues;
}
export function exactDisplay(value: unknown): string {
  if (value === undefined || value === null || value === "") return "missing";
  if (isLosslessInteger(value)) return String(value);
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
