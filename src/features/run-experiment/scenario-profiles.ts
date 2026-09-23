/**
 * Built-in experiment scenarios, matched by keyword.
 *
 * This is a preset table, not a model. Every profile is a hand-written starting
 * point that the recommender resolves against the *live* catalogue, so a preset
 * can only ever propose an address the current page can actually write, and a
 * value the contract actually allows. A preset that drifts out of range shows
 * up as a refused item instead of being applied.
 *
 * The numbers are deliberately round and readable: the point of a recommendation
 * is to be a defensible starting point a user edits, not a tuned optimum.
 */

export type ScenarioSetting = {
  /**
   * The catalogue key the setting addresses, e.g. `max_batch_size`. Written
   * without a target prefix on purpose: the same key can exist as a quick-control
   * knob and as a runtime policy key, and the recommender picks the knob (the
   * address that needs no channel move) rather than making the profile encode
   * which surface it happens to live on today.
   */
  key: string;
  value: string;
};

export type ScenarioProfile = {
  /** Stable id, also used as the block's provenance. */
  id: string;
  title: string;
  /** Why these values, in one sentence. */
  rationale: string;
  /**
   * Wordings the profile answers to. Compounds only: a bare `延迟` would turn
   * ordinary questions ("延迟怎么看") into a recommendation, so the matcher also
   * refuses interrogative instructions outright.
   */
  keywords: readonly string[];
  settings: readonly ScenarioSetting[];
};

export const SCENARIO_PROFILES: readonly ScenarioProfile[] = [
  {
    id: "high_throughput",
    title: "高吞吐 / 离线批量",
    rationale: "把每批塞满、放宽容纳上限，并让调度器感知 Fabric 背压，吞吐优先。",
    keywords: [
      "高吞吐",
      "吞吐优先",
      "提升吞吐",
      "吞吐量",
      "throughput",
      "离线推理",
      "离线批处理",
      "批量推理",
      "批量任务",
      "压测",
      "压力测试",
      "跑分",
      "benchmark",
    ],
    settings: [
      { key: "max_batch_size", value: "64" },
      { key: "max_active_requests", value: "512" },
      { key: "batch_scheduler", value: "fabric_backpressure_aware" },
      { key: "kv_capacity_tokens", value: "262144" },
    ],
  },
  {
    id: "low_latency",
    title: "低延迟 / 在线服务",
    rationale: "压小批量、优先照顾正在解码的请求，并抬高 KV 准入水位减少排队。",
    keywords: [
      "低延迟",
      "延迟优先",
      "降低延迟",
      "降延迟",
      "在线服务",
      "在线推理",
      "实时推理",
      "实时服务",
      "交互式推理",
      "首字延迟",
      "响应时间",
      "latency",
      "p99",
      "ttft",
    ],
    settings: [
      { key: "max_batch_size", value: "4" },
      { key: "max_active_requests", value: "32" },
      { key: "batch_scheduler", value: "decode_priority" },
      { key: "kv_admission_watermark", value: "0.9" },
    ],
  },
  {
    id: "long_context",
    title: "长上下文压力",
    rationale: "明确长上下文阈值并放大 KV 容量，同时给超阈值的请求一点解码减速代价。",
    keywords: ["长上下文", "超长上下文", "长文本", "长序列", "long context", "长prompt", "长 prompt", "128k", "32k"],
    settings: [
      { key: "long_context_threshold_tokens", value: "32768" },
      // 512 Ki tokens. The knob tops out at 1,000,000 (`run-overrides`), which is
      // below the policy field's ceiling, so the preset stays clear of the bound
      // rather than sitting on it.
      { key: "kv_capacity_tokens", value: "524288" },
      { key: "decode_penalty_per_threshold", value: "0.1" },
      { key: "kv_admission_watermark", value: "0.7" },
    ],
  },
  {
    id: "kv_tight",
    title: "KV / 显存吃紧",
    rationale: "缩小 KV 容量并把并发与批大小压低，避免 KV 打满后整轮停顿。",
    keywords: [
      "kv紧张",
      "kv 紧张",
      "kv压力",
      "kv 压力",
      "kv不够",
      "kv 不够",
      "显存紧张",
      "显存不足",
      "内存紧张",
      "内存不足",
      "容量紧张",
      "爆显存",
      "oom",
    ],
    settings: [
      { key: "kv_capacity_tokens", value: "65536" },
      { key: "max_active_requests", value: "64" },
      { key: "max_batch_size", value: "8" },
      { key: "kv_admission_watermark", value: "0.5" },
    ],
  },
  {
    id: "fairness",
    title: "公平性 / 反饥饿",
    rationale: "换成反饥饿调度并放宽容纳上限，让长尾请求也能持续推进。",
    keywords: ["公平性", "不公平", "饥饿", "饿死", "starvation", "长尾请求", "抢占"],
    settings: [
      { key: "batch_scheduler", value: "starvation_aware" },
      { key: "max_active_requests", value: "256" },
    ],
  },
  {
    id: "single_device",
    title: "单卡冒烟 / 先跑通",
    rationale: "一次只跑 1 条、并发压到 4，先把整条链路跑通再谈性能。",
    keywords: [
      "单卡",
      "一张卡",
      "单机",
      "冒烟",
      "smoke",
      "快速验证",
      "先跑通",
      "最小场景",
      "简单场景",
      "小规模",
      "调试场景",
    ],
    settings: [
      { key: "max_batch_size", value: "1" },
      { key: "max_active_requests", value: "4" },
      { key: "kv_capacity_tokens", value: "8192" },
      { key: "initial_kv_tokens", value: "0" },
    ],
  },
  {
    id: "fabric_stress",
    title: "互联压力 / 弱网",
    rationale: "用一组明显低于理想值的带宽与偏高的时延，把 Fabric 变成可见瓶颈。",
    keywords: [
      "互联",
      "弱网",
      "网络拥塞",
      "拥塞",
      "带宽瓶颈",
      "带宽受限",
      "网络压力",
      "交换网络",
      "nvlink",
      "scale-up",
      "scale-out",
      "scaleup",
      "scaleout",
    ],
    settings: [
      { key: "scale_up_bandwidth_gbps", value: "200" },
      { key: "scale_up_latency_us", value: "5" },
      { key: "scale_out_bandwidth_gbps", value: "100" },
      { key: "scale_out_latency_us", value: "20" },
    ],
  },
  {
    id: "comm_heavy",
    title: "通信负载放大",
    rationale: "把通信负载倍率放大到 4 倍，观察集合通信对整体时延的拉扯。",
    keywords: ["通信负载", "集合通信", "allreduce", "all-reduce", "消息放大", "负载倍率", "通信压力", "通信密集"],
    settings: [{ key: "message_size_multiplier", value: "4" }],
  },
];

/**
 * Instructions that ask a question rather than describe a scenario. A question
 * must never silently turn into a set of parameter writes, so the matcher bows
 * out and the panel answers from the page's read-only paths instead.
 *
 * This is a heuristic, and it is deliberately generous: refusing to guess costs
 * a user nothing (they can always write `参数 = 值`), while guessing wrong would
 * write values they never asked for.
 */
const INTERROGATIVE_MARKERS: readonly string[] = [
  "?",
  "？",
  "什么",
  "为什么",
  "怎么",
  "如何",
  "怎样",
  "多少",
  "是否",
  "能不能",
  "可不可以",
  "有没有",
  "吗",
];

/** Case- and spacing-insensitive so `大 batch` and `大batch` are one keyword. */
function normalize(text: string): string {
  return text.replace(/[\s`"'「」“”]+/gu, "").toLowerCase();
}

export function looksInterrogative(instruction: string): boolean {
  const text = normalize(instruction);
  return INTERROGATIVE_MARKERS.some((marker) => text.includes(normalize(marker)));
}

export type ScenarioMatch = {
  /** Every profile that scored highest. More than one means "do not guess". */
  matched: readonly ScenarioProfile[];
  /** Highest keyword-hit count, 0 when nothing matched. */
  score: number;
};

/**
 * Ranks the profiles by how many of their keywords the instruction contains.
 * A tie is reported as a tie: two plausible scenarios is exactly when the
 * assistant must ask rather than pick.
 */
export function matchScenarioProfiles(instruction: string): ScenarioMatch {
  if (!instruction.trim() || looksInterrogative(instruction)) return { matched: [], score: 0 };
  const text = normalize(instruction);
  let best = 0;
  let matched: ScenarioProfile[] = [];
  SCENARIO_PROFILES.forEach((profile) => {
    const score = profile.keywords.filter((keyword) => text.includes(normalize(keyword))).length;
    if (!score) return;
    if (score > best) {
      best = score;
      matched = [profile];
      return;
    }
    if (score === best) matched.push(profile);
  });
  return { matched, score: best };
}
