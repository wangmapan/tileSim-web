import type { ExecutionDocument as Document, ExecutionIssue as Issue } from "../../contracts/execution-authoring";
export function partitionPreview(program: Document, deviceIds: string[]): { order: string[]; issues: Issue[] } {
  try {
    return buildPreview(program, deviceIds);
  } catch {
    return {
      order: [],
      issues: [
        {
          path: "/execution_input/execution_partition_program",
          message: "error · 结构或精确整数字段无效；请先修复合同校验错误",
        },
      ],
    };
  }
}
function buildPreview(program: Document, deviceIds: string[]): { order: string[]; issues: Issue[] } {
  const order: string[] = [],
    issues: Issue[] = [];
  const add = (path: string, message: string) =>
    issues.push({ path: "/execution_input/execution_partition_program" + path, message });
  const windows = new Set<string>();
  for (const [i, w] of (program.windows || []).entries()) {
    const p = `/windows/${i}`,
      key = [w.request_id, w.phase, w.token_begin, w.token_end].join("/");
    if (windows.has(key)) add(p, "重复消费窗口");
    windows.add(key);
    if (BigInt(w.token_begin) >= BigInt(w.token_end)) add(p + "/token_end", "token 范围必须非空");
    const nodes = new Map<string, Document>();
    for (const s of w.partition.slices) {
      if (nodes.has(s.local_partition_id)) add(p + "/partition/slices", "重复节点身份");
      nodes.set(s.local_partition_id, s);
    }
    const ranges = w.partition.slices
      .map((s: Document) => s.token_offsets.map((n: string | number) => BigInt(n)))
      .sort((a: bigint[], b: bigint[]) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const size = BigInt(w.token_end) - BigInt(w.token_begin);
    let covered = 0n;
    for (const [begin, end] of ranges) {
      if (begin > covered || end > size || end <= begin)
        add(p + "/partition/slices", "未覆盖窗口或 token_offsets 越界");
      if (end > covered) covered = end;
    }
    if (covered < size) add(p + "/partition/slices", "未覆盖完整窗口");
    const visiting = new Set<string>(),
      done = new Set<string>();
    function visit(id: string) {
      if (done.has(id)) return;
      if (visiting.has(id)) {
        add(p + "/partition/slices", "依赖图有环: " + id);
        return;
      }
      if (!nodes.has(id)) {
        add(p + "/partition/slices", "缺失依赖: " + id);
        return;
      }
      visiting.add(id);
      for (const d of nodes.get(id)!.dependency_partition_ids) visit(d);
      visiting.delete(id);
      done.add(id);
      order.push(`${w.request_id}/${w.phase}/${id}`);
    }
    for (const id of nodes.keys()) visit(id);
    for (const [id, r] of Object.entries(w.resources) as [string, Document][]) {
      if (!nodes.has(id)) add(p + "/resources/" + id, "资源没有对应节点");
      if (r.kind === "device") {
        if (!deviceIds.includes(r.placement)) add(p + "/resources/" + id + "/placement", "设备不在拓扑");
      } else {
        if (r.participants.some((x: string) => !deviceIds.includes(x)))
          add(p + "/resources/" + id + "/participants", "通信参与方不在拓扑");
        if (r.kind === "sendrecv" && r.participants.length !== 2)
          add(p + "/resources/" + id + "/participants", "sendrecv 要求两个端点");
        if (BigInt(r.bytes) <= 0n || BigInt(r.chunk_bytes) < 0n || BigInt(r.chunk_bytes) > BigInt(r.bytes))
          add(p + "/resources/" + id + "/bytes", "bytes/chunk_bytes 不合法");
      }
    }
    for (const id of nodes.keys()) if (!w.resources[id]) add(p + "/resources/" + id, "缺失资源需求");
    for (const edge of w.buffer_edges || []) {
      const pool = program.buffers?.[edge.pool];
      if (!pool || BigInt(edge.bytes) > BigInt(pool.capacity_bytes)) add(p + "/buffer_edges", "缓冲池缺失或容量不足");
      if (!nodes.has(edge.producer)) add(p + "/buffer_edges", "缺失 producer");
      if (pool)
        for (const id of [edge.producer, ...edge.consumers]) {
          const resource = w.resources[id];
          if (resource?.kind === "device" && resource.placement !== pool.placement)
            add(p + "/buffer_edges", "device 与 buffer placement 不一致");
        }
      for (const consumer of edge.consumers)
        if (!nodes.get(consumer)?.dependency_partition_ids.includes(edge.producer))
          add(p + "/buffer_edges", "消费者必须直接依赖生产者");
    }
    for (const edge of w.buffer_edges || [])
      for (const consumer of edge.consumers) {
        const next = (w.buffer_edges || []).filter((e: Document) => e.producer === consumer && e.pool === edge.pool);
        const pool = program.buffers?.[edge.pool];
        if (
          pool &&
          next.length &&
          BigInt(edge.bytes) + next.reduce((sum: bigint, e: Document) => sum + BigInt(e.bytes), 0n) >
            BigInt(pool.capacity_bytes)
        )
          add(p + "/buffer_edges", "缓冲死锁风险：消费者输出与未释放输入超过同池容量，CLI 将精确准入");
      }
  }
  return { order, issues };
}
