<script setup lang="ts">
import { computed, ref } from "vue";
import StructuredFields from "../../components/ExecutionInputFields.vue";
import type { ExecutionDocument as Document } from "../../contracts/execution-authoring";
const cloneDocument = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
import { partitionPreview } from "./model";
const props = defineProps<{ program: Document; deviceIds: string[] }>();
const emit = defineEmits<{ change: [Document]; invalid: [path: string, message: string] }>();
const selected = ref(0);
const nodeId = ref(""),
  poolId = ref(""),
  editError = ref("");
function addNode() {
  const id = nodeId.value.trim(),
    result = cloneDocument(props.program),
    window = result.windows[selected.value];
  if (!id || !window || window.resources[id]) {
    editError.value = "节点 ID 必须非空且唯一";
    return;
  }
  window.partition.slices.push({
    local_partition_id: id,
    operation_kind: "declared_device",
    dependency_partition_ids: [],
    completion_condition: "device_task_completed",
    token_offsets: [0, String(BigInt(window.token_end) - BigInt(window.token_begin))],
    tensor_shape: [1],
    tensor_offset: [0],
    tensor_extent: [1],
  });
  window.resources[id] = {
    kind: "device",
    placement: props.deviceIds[0] || "",
    stream: "default",
    flops: 1,
    memory_bytes: 0,
  };
  nodeId.value = "";
  editError.value = "";
  emit("change", result);
}
function addPool() {
  const id = poolId.value.trim(),
    result = cloneDocument(props.program);
  if (!id || result.buffers?.[id]) {
    editError.value = "缓冲池 ID 必须非空且唯一";
    return;
  }
  result.buffers = { ...result.buffers, [id]: { placement: props.deviceIds[0] || "", capacity_bytes: 1 } };
  poolId.value = "";
  editError.value = "";
  emit("change", result);
}
function addBufferEdge() {
  const result = cloneDocument(props.program),
    window = result.windows[selected.value];
  if (!window) return;
  window.buffer_edges = [...(window.buffer_edges || []), { producer: "", consumers: [], pool: "", bytes: 1 }];
  emit("change", result);
}
const preview = computed(() => partitionPreview(props.program, props.deviceIds));
function patch(path: string, value: unknown) {
  const result = cloneDocument(props.program),
    keys = path
      .split("/")
      .slice(1)
      .map((k) => k.replaceAll("~1", "/").replaceAll("~0", "~"));
  let cursor = result;
  for (const key of keys.slice(0, -1)) cursor = cursor[key];
  if (keys.at(-1) === "local_partition_id") {
    const window = result.windows[Number(keys[1])],
      old = cursor.local_partition_id,
      id = String(value).trim();
    if (!id || (id !== old && window.resources[id])) {
      editError.value = "节点 ID 必须非空且唯一";
      return;
    }
    if (id !== old) {
      window.resources[id] = window.resources[old];
      delete window.resources[old];
      for (const node of window.partition.slices)
        node.dependency_partition_ids = node.dependency_partition_ids.map((dep: string) => (dep === old ? id : dep));
      for (const edge of window.buffer_edges || []) {
        if (edge.producer === old) edge.producer = id;
        edge.consumers = edge.consumers.map((consumer: string) => (consumer === old ? id : consumer));
      }
    }
    value = id;
  }
  if (keys.at(-1) === "slices" && Array.isArray(value)) {
    const window = result.windows[Number(keys[1])],
      ids = new Set(value.map((n) => n.local_partition_id)),
      removed = window.partition.slices.filter((n: Document) => !ids.has(n.local_partition_id));
    if (
      removed.some(
        (n: Document) =>
          value.some((node) => node.dependency_partition_ids.includes(n.local_partition_id)) ||
          window.buffer_edges?.some(
            (edge: Document) => edge.producer === n.local_partition_id || edge.consumers.includes(n.local_partition_id),
          ),
      )
    ) {
      editError.value = "节点仍被依赖或 buffer edge 引用，请先显式解除引用";
      return;
    }
    for (const node of removed) delete window.resources[node.local_partition_id];
  }
  cursor[keys.at(-1)!] = value;
  editError.value = "";
  emit("change", result);
}
function addWindow() {
  const result = cloneDocument(props.program);
  result.windows.push(cloneDocument(result.windows[selected.value]));
  selected.value = result.windows.length - 1;
  emit("change", result);
}
</script>
<template>
  <section aria-label="执行划分编辑器">
    <StructuredFields
      :value="{ program_id: program.program_id, model_id: program.model_id, model_revision: program.model_revision }"
      @change="patch"
      @invalid="(path, message) => emit('invalid', path, message)"
    />
    <div class="operator-toolbar">
      <label>新节点 ID<input v-model="nodeId" aria-label="新节点 ID" /></label
      ><button type="button" @click="addNode">添加节点与资源需求</button
      ><button type="button" @click="addBufferEdge">添加 producer / consumer 边</button>
    </div>
    <p v-if="editError" role="alert">{{ editError }}</p>
    <div class="operator-toolbar">
      <strong>窗口与节点</strong><button type="button" @click="addWindow">复制窗口</button
      ><button
        type="button"
        :disabled="program.windows.length <= 1"
        @click="
          emit('change', { ...program, windows: program.windows.filter((_: unknown, i: number) => i !== selected) });
          selected = 0;
        "
      >
        删除窗口
      </button>
    </div>
    <div class="operator-scroll">
      <table>
        <thead>
          <tr>
            <th>request / phase</th>
            <th>token</th>
            <th>节点</th>
            <th>资源</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(w, i) in program.windows" :key="i">
            <td>
              <button type="button" @click="selected = Number(i)">{{ w.request_id }} / {{ w.phase }}</button>
            </td>
            <td>{{ w.token_begin }} → {{ w.token_end }}</td>
            <td>{{ w.partition.slices.length }}</td>
            <td>
              {{
                Object.values(w.resources)
                  .map((r) => (r as Document).kind)
                  .join(", ")
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <StructuredFields
      v-if="program.windows[selected]"
      :value="program.windows[selected]"
      :path="`/windows/${selected}`"
      @change="patch"
      @invalid="(path, message) => emit('invalid', path, message)"
    />
    <details open>
      <summary>拓扑排序预览 · 只读</summary>
      <ol>
        <li v-for="id in preview.order" :key="id">
          <code>{{ id }}</code>
        </li>
      </ol>
      <p v-for="issue in preview.issues" :key="issue.path + issue.message" role="alert">
        <code>{{ issue.path }}</code> {{ issue.message }}
      </p>
    </details>
    <details>
      <summary>共享 buffer pools</summary>
      <div class="operator-toolbar">
        <label>新缓冲池 ID<input v-model="poolId" /></label><button type="button" @click="addPool">添加缓冲池</button>
      </div>
      <StructuredFields
        :value="program.buffers || {}"
        path="/buffers"
        @change="patch"
        @invalid="(path, message) => emit('invalid', path, message)"
      />
    </details>
    <p>
      只声明需求、依赖、边界和来源。完成时间、物理 KV 状态及真实网络完成事件由后端产生。缓冲容量死锁与实际窗口覆盖由 CLI
      预检拒绝，不自动补全。
    </p>
  </section>
</template>
