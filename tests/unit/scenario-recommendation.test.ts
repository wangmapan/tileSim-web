import { describe, expect, it } from "vitest";
import {
  buildExperimentSurface,
  buildParameterCatalog,
  createExperimentForm,
  hasRecommendation,
  matchScenarioProfiles,
  modelScenarioInstruction,
  modelScenarioRecommendation,
  parameterKeyOf,
  recommendScenarioPlan,
  resolveCatalogPath,
  SCENARIO_PROFILES,
  type ParameterCatalogEntry,
} from "../../src/features/run-experiment";
import { createF8ExperimentDescriptor, f8Capabilities } from "../fixtures/experiment-descriptor";

/**
 * The scenario recommender is what turns "描述一个场景" into a reviewable plan.
 * These pin the three properties that make that safe to offer as one click:
 * a preset can only address parameters the page really has, the user's own
 * words win over the preset, and an ambiguous or interrogative sentence is
 * never turned into writes.
 */

const runtimeJson = JSON.stringify(
  {
    trace_name: "scenario-trace",
    policy: { batch_scheduler: "fifo", max_batch_size: 4 },
    requests: [{ request_id: "req_a", arrival_time_ps: 0, phase: "prefill", tp_degree: 2, participants: ["gpu0"] }],
  },
  null,
  2,
);

const topologyJson = JSON.stringify(
  {
    topology: {
      devices: [
        { device_id: "gpu0", device_type: "GPU" },
        { device_id: "gpu1", device_type: "GPU" },
      ],
      module_bindings: [
        { module_name: "su-module", module_kind: "scale_up", override_params: { bandwidth_gbps: 900 } },
      ],
      domains: [
        { domain_id: "su0", domain_type: "scale_up", member_devices: ["gpu0", "gpu1"], module_binding: "su-module" },
      ],
      links: [{ src_device: "gpu0", dst_device: "gpu1", domain_id: "su0", bandwidth_gbps: 900 }],
    },
  },
  null,
  2,
);

const catalogInput = {
  scenarios: [{ scenario_id: "s1_des_example", label: "S1 → S6" }],
  fidelity_policies: ["default", "des"],
  input_modes: ["controls", "json"],
  design_space_modes: ["built_in_synthetic", "strict_s6_manifest"],
  gpu_participation_modes: ["gpu_free"],
};

function catalogOf(): ParameterCatalogEntry[] {
  const surface = buildExperimentSurface(catalogInput, f8Capabilities, createF8ExperimentDescriptor(), "supported");
  const form = createExperimentForm(surface);
  form.parameterValues["s1.runtime.max_batch_size"] = 4;
  return buildParameterCatalog({ form, surface, runtimeJson, topologyJson });
}

describe("catalogue key resolution", () => {
  it("prefers the knob over the runtime policy key that shares its name", () => {
    // `max_batch_size` is both a quick-control knob and a runtime policy key.
    // The knob is the address that needs no channel move, so a recommendation
    // built from it can be applied without switching the submission mode.
    expect(resolveCatalogPath("max_batch_size", catalogOf())).toBe("overrides/runtime/max_batch_size");
  });

  it("finds a document field by its key and reports an unknown key as null", () => {
    const catalog = catalogOf();
    expect(resolveCatalogPath("device_type", catalog)).toBe("topology/devices[0]/device_type");
    expect(resolveCatalogPath("no_such_parameter", catalog)).toBeNull();
  });

  it("accepts an exact path unchanged", () => {
    expect(resolveCatalogPath("runtime_trace/policy/max_batch_size", catalogOf())).toBe(
      "runtime_trace/policy/max_batch_size",
    );
  });

  it("reads a bare key out of an indexed document path", () => {
    // The panel shows one value per path, but a setting the model proposes names
    // the field, so the key has to survive the index suffix that addressing needs.
    expect(parameterKeyOf("runtime_trace/requests[0]/tp_degree")).toBe("tp_degree");
    expect(parameterKeyOf("topology/devices[12]/device_type")).toBe("device_type");
    expect(parameterKeyOf("overrides/runtime/max_batch_size")).toBe("max_batch_size");
  });
});

describe("scenario matching", () => {
  it.each(SCENARIO_PROFILES.map((profile) => [profile.id, profile.keywords[0]]))(
    "matches %s from its own wording",
    (id, keyword) => {
      const { matched } = matchScenarioProfiles(`我想跑一个${keyword}的场景`);
      expect(matched.map((profile) => profile.id)).toEqual([id]);
    },
  );

  it("reports a tie instead of picking a scenario", () => {
    const { matched } = matchScenarioProfiles("既要公平性又要长上下文");
    expect(matched.map((profile) => profile.id).sort()).toEqual(["fairness", "long_context"]);
  });

  it("refuses to turn a question into a scenario", () => {
    expect(matchScenarioProfiles("高吞吐怎么看？").matched).toEqual([]);
    expect(matchScenarioProfiles("现在延迟是多少").matched).toEqual([]);
  });
});

describe("scenario recommendation", () => {
  it("plans a preset against the live catalogue", () => {
    const recommendation = recommendScenarioPlan("跑一个高吞吐离线批处理", catalogOf());
    expect(recommendation.profile?.id).toBe("high_throughput");
    expect(recommendation.title).toBe("推荐方案：高吞吐 / 离线批量");
    expect(recommendation.rationale).toContain(recommendation.profile?.rationale ?? "");
    expect(recommendation.plan.rejected).toEqual([]);
    expect(recommendation.plan.unknown).toEqual([]);
    expect(recommendation.plan.items.map((item) => [item.path, item.next])).toEqual([
      ["overrides/runtime/max_batch_size", "64"],
      ["overrides/runtime/max_active_requests", "512"],
      ["overrides/runtime/batch_scheduler", "fabric_backpressure_aware"],
      ["overrides/runtime/kv_capacity_tokens", "262144"],
    ]);
    expect(hasRecommendation(recommendation)).toBe(true);
  });

  it("carries the current value so the panel can show old → new", () => {
    const recommendation = recommendScenarioPlan("高吞吐场景", catalogOf());
    const batch = recommendation.plan.items.find((item) => item.path === "overrides/runtime/max_batch_size");
    expect(batch?.previous).toBe("4");
    expect(batch?.next).toBe("64");
  });

  it.each(SCENARIO_PROFILES.map((profile) => [profile.id, profile.keywords[0]]))(
    "keeps every %s preset inside the contract ranges",
    (id, keyword) => {
      // A preset that drifts out of range must fail here rather than showing up
      // as a refused item in front of a user who pressed the button.
      const recommendation = recommendScenarioPlan(`跑一个${keyword}的场景`, catalogOf());
      const profile = SCENARIO_PROFILES.find((candidate) => candidate.id === id);
      expect(recommendation.profile?.id).toBe(id);
      expect(recommendation.skipped).toEqual([]);
      expect(recommendation.plan.rejected).toEqual([]);
      expect(recommendation.plan.unknown).toEqual([]);
      expect(recommendation.plan.items).toHaveLength(profile?.settings.length ?? 0);
    },
  );

  it("lets the user's own value win over the preset without duplicating the address", () => {
    const recommendation = recommendScenarioPlan("高吞吐场景，最大 batch = 32", catalogOf());
    expect(recommendation.profile?.id).toBe("high_throughput");
    expect(recommendation.overridden).toEqual(["最大 batch"]);
    expect(recommendation.rationale).toContain("你自己写的 最大 batch 覆盖了预设值。");
    const batch = recommendation.plan.items.filter((item) => item.path === "overrides/runtime/max_batch_size");
    expect(batch).toHaveLength(1);
    expect(batch[0].next).toBe("32");
  });

  it("reports a preset key the page does not expose instead of inventing an address", () => {
    const catalog = catalogOf().filter((entry) => !entry.path.endsWith("kv_capacity_tokens"));
    const recommendation = recommendScenarioPlan("跑一个高吞吐场景", catalog);
    expect(recommendation.skipped).toEqual(["kv_capacity_tokens"]);
    expect(recommendation.rationale).toContain("预设里的 kv_capacity_tokens 在当前页面找不到，已跳过。");
    expect(recommendation.plan.items.map((item) => item.path)).not.toContain("overrides/runtime/kv_capacity_tokens");
  });

  it("refuses a scenario that only names a field without giving it a value", () => {
    // `最大 batch` is a knob label, and the sentence names it without assigning
    // it. Reading that as the throughput scenario would add three knobs nobody
    // asked for; the frozen field-request path understands this wording instead.
    const recommendation = recommendScenarioPlan(
      "把最大 batch 调整为 8，把横向扩展网络带宽改为 100 Gbps per-link",
      catalogOf(),
    );
    expect(recommendation.profile).toBeNull();
    expect(recommendation.plan.items).toEqual([]);
    expect(hasRecommendation(recommendation)).toBe(false);
  });

  it("still reads a scenario that shares words with a field label", () => {
    // "长上下文阈值" is a field; "长上下文场景" is a scenario. Naming the field in
    // full makes the sentence a field request, whether or not it also carries an
    // `=`, because the panel offers a path that understands that wording.
    expect(recommendScenarioPlan("跑一个长上下文场景", catalogOf()).profile?.id).toBe("long_context");

    const named = recommendScenarioPlan("把长上下文阈值改成 16384", catalogOf());
    expect(named.profile).toBeNull();
    expect(hasRecommendation(named)).toBe(false);

    const assigned = recommendScenarioPlan("长上下文阈值 = 16384", catalogOf());
    expect(assigned.profile).toBeNull();
    expect(assigned.plan.items.map((item) => [item.path, item.next])).toEqual([
      ["overrides/runtime/long_context_threshold_tokens", "16384"],
    ]);
  });

  /**
   * The exact sentences the shipped e2e specs submit. A purely Chinese keyword
   * collides silently — `大batch` matched inside the knob label `最大 batch` and
   * hijacked the frozen field-request path, which only a seven-minute browser run
   * exposed. Pinning the sentences here makes the next such collision fail in
   * milliseconds instead.
   */
  it.each([
    "把最大 batch 调整为 8，把横向扩展网络带宽改为 100 Gbps per-link",
    "把最大 batch 调整为 8",
    "把带宽改为 100",
    "把 TP 改成 8",
    "把消息大小倍率改为 2",
    "说明当前页面能做什么",
  ])("leaves %s to the read-only paths", (instruction) => {
    expect(hasRecommendation(recommendScenarioPlan(instruction, catalogOf()))).toBe(false);
  });

  it("keeps a plain assignment working with no scenario at all", () => {
    const recommendation = recommendScenarioPlan("runtime_trace/requests[0]/tp_degree = 4", catalogOf());
    expect(recommendation.profile).toBeNull();
    expect(recommendation.title).toBe("");
    expect(recommendation.plan.items.map((item) => [item.path, item.next])).toEqual([
      ["runtime_trace/requests[0]/tp_degree", "4"],
    ]);
    expect(hasRecommendation(recommendation)).toBe(true);
  });

  it("offers nothing for a question, so the read-only paths can answer", () => {
    const recommendation = recommendScenarioPlan("高吞吐怎么看？", catalogOf());
    expect(recommendation.profile).toBeNull();
    expect(recommendation.tie).toEqual([]);
    expect(hasRecommendation(recommendation)).toBe(false);
  });

  it("surfaces a tie as candidates rather than a plan", () => {
    const recommendation = recommendScenarioPlan("既要公平性又要长上下文", catalogOf());
    expect(recommendation.profile).toBeNull();
    expect(recommendation.tie.map((profile) => profile.id).sort()).toEqual(["fairness", "long_context"]);
    expect(recommendation.plan.items).toEqual([]);
  });
});

/**
 * A sentence is only handed to an assistant model when the deterministic paths
 * would have to guess at it. A question already has an answer, an explicit
 * assignment already has an exact one, and a sentence that names a parameter in
 * full already has a path that understands it — sending any of those away would
 * swap something exact for something guessed.
 */
describe("model-bound scenario instructions", () => {
  it("sends a described scenario that no built-in preset covers", () => {
    const sentence = "我要模拟一个新模型上线前的容量评估";
    expect(modelScenarioInstruction(sentence, catalogOf())).toBe(sentence);
    // Nothing preset matches it, which is exactly why the model is asked.
    expect(hasRecommendation(recommendScenarioPlan(sentence, catalogOf()))).toBe(false);
  });

  it("trims the sentence before sending it", () => {
    expect(modelScenarioInstruction("  我要模拟一个新模型上线前的容量评估  ", catalogOf())).toBe(
      "我要模拟一个新模型上线前的容量评估",
    );
  });

  it.each([
    ["a question", "高吞吐怎么看？"],
    ["a plain question", "现在延迟是多少"],
    ["its own assignment", "最大 batch = 32，然后跑高吞吐"],
    ["a path assignment", "runtime_trace/requests[0]/tp_degree = 4"],
    ["a fully named field", "把长上下文阈值改成 16384"],
    ["whitespace", "   "],
  ])("keeps %s on the deterministic paths", (_label, instruction) => {
    expect(modelScenarioInstruction(instruction, catalogOf())).toBeNull();
  });
});

/**
 * A follow-up only means something with the earlier turns attached, and those
 * turns are exactly what a model is handed, so once the panel is already in a
 * conversation the shape checks that keep the first turn local must get out of
 * the way. The one thing that still stays local is the sentence that carries its
 * own assignment, because that one is answered exactly by the typed input.
 */
describe("model-bound follow-up turns", () => {
  it.each([
    ["a question about the earlier proposal", "为什么是 4?"],
    ["a fully named field", "把长上下文阈值改成 16384"],
  ])("hands %s to the model once the conversation has started", (_label, instruction) => {
    // On a page with nothing discussed yet both are answered precisely from the
    // catalogue, so they stay local...
    expect(modelScenarioInstruction(instruction, catalogOf())).toBeNull();
    // ...but as a follow-up they only mean something with the earlier turns
    // attached, and those turns are exactly what the model is handed.
    expect(modelScenarioInstruction(instruction, catalogOf(), true)).toBe(instruction);
  });

  it("hands a steer to the model on the first turn too, because nothing local can read it", () => {
    // A steer describes no field and asks nothing a rule can answer, so it is
    // model-bound either way - `continuing` is not what decides it.
    const steer = "再激进一点";
    expect(modelScenarioInstruction(steer, catalogOf())).toBe(steer);
    expect(modelScenarioInstruction(steer, catalogOf(), true)).toBe(steer);
    expect(hasRecommendation(recommendScenarioPlan(steer, catalogOf()))).toBe(false);
  });

  it("still keeps a sentence with its own assignment local", () => {
    // `参数 = 值` is answered exactly by the typed input, and swapping an exact
    // answer for a guess is not what a follow-up turn should do.
    expect(modelScenarioInstruction("最大 batch = 32", catalogOf(), true)).toBeNull();
    expect(modelScenarioInstruction("runtime_trace/requests[0]/tp_degree = 4", catalogOf(), true)).toBeNull();
  });

  it("treats a blank follow-up as nothing to send", () => {
    expect(modelScenarioInstruction("   ", catalogOf(), true)).toBeNull();
  });
});

/**
 * A model proposal is not trusted any more than a preset is: every key is
 * resolved against the live catalogue and every value goes through the same
 * planner the typed input uses. What it adds is the reason next to each value,
 * which is only kept for values that actually survived planning.
 */
describe("model scenario recommendation", () => {
  it("resolves the proposal against the catalogue and keeps a reason per value", () => {
    const recommendation = modelScenarioRecommendation(
      {
        title: "高吞吐 / 离线批量",
        rationale: "把每批塞满、放宽容纳上限，吞吐优先。",
        settings: [
          { key: "max_batch_size", value: "64", why: "提高每批处理量，吃满带宽。" },
          { key: "batch_scheduler", value: "fabric_backpressure_aware", why: "按拥塞反馈分配，避免排队堆积。" },
        ],
      },
      catalogOf(),
    );

    expect(recommendation?.title).toBe("高吞吐 / 离线批量");
    expect(recommendation?.rationale).toBe("把每批塞满、放宽容纳上限，吞吐优先。");
    expect(recommendation?.plan.rejected).toEqual([]);
    expect(recommendation?.plan.unknown).toEqual([]);
    expect(recommendation?.plan.items.map((item) => [item.path, item.next])).toEqual([
      ["overrides/runtime/max_batch_size", "64"],
      ["overrides/runtime/batch_scheduler", "fabric_backpressure_aware"],
    ]);
    expect(recommendation?.reasons).toEqual({
      "overrides/runtime/max_batch_size": "提高每批处理量，吃满带宽。",
      "overrides/runtime/batch_scheduler": "按拥塞反馈分配，避免排队堆积。",
    });
    expect(recommendation && hasRecommendation(recommendation)).toBe(true);
  });

  it("reports a key the catalogue does not expose instead of inventing an address", () => {
    const recommendation = modelScenarioRecommendation(
      {
        title: "高吞吐",
        rationale: "把每批塞满。",
        settings: [
          { key: "no_such_parameter", value: "1", why: "模型凭空写的。" },
          { key: "max_batch_size", value: "32", why: "提高每批处理量。" },
        ],
      },
      catalogOf(),
    );

    expect(recommendation?.skipped).toEqual(["no_such_parameter"]);
    expect(recommendation?.rationale).toBe("把每批塞满。模型提到的 no_such_parameter 在当前页面找不到，已跳过。");
    expect(recommendation?.plan.items.map((item) => item.path)).toEqual(["overrides/runtime/max_batch_size"]);
    expect(recommendation?.reasons).toEqual({ "overrides/runtime/max_batch_size": "提高每批处理量。" });
  });

  it("returns null when nothing in the proposal resolves", () => {
    expect(
      modelScenarioRecommendation(
        { title: "", rationale: "", settings: [{ key: "no_such_parameter", value: "1", why: "凭空写的。" }] },
        catalogOf(),
      ),
    ).toBeNull();
  });

  it("returns null when the catalogue refuses every proposed value", () => {
    // The value never reaches the plan, so the panel must not be handed a plan
    // with no rows; the caller falls back to its local answer instead.
    expect(
      modelScenarioRecommendation(
        {
          title: "高吞吐",
          rationale: "随口一说。",
          settings: [{ key: "max_batch_size", value: "不是数字", why: "随手写的。" }],
        },
        catalogOf(),
      ),
    ).toBeNull();
  });

  it("offers one value per address and drops the reason of the one it did not offer", () => {
    const recommendation = modelScenarioRecommendation(
      {
        title: "高吞吐",
        rationale: "把每批塞满。",
        settings: [
          { key: "max_batch_size", value: "16", why: "第一个理由。" },
          { key: "max_batch_size", value: "32", why: "第二个理由。" },
        ],
      },
      catalogOf(),
    );

    expect(recommendation?.plan.items.map((item) => [item.path, item.next])).toEqual([
      ["overrides/runtime/max_batch_size", "16"],
    ]);
    expect(recommendation?.reasons).toEqual({ "overrides/runtime/max_batch_size": "第一个理由。" });
  });

  it("falls back to a default heading when the model named the plan nothing", () => {
    const recommendation = modelScenarioRecommendation(
      {
        title: "   ",
        rationale: "把每批塞满。",
        settings: [{ key: "max_batch_size", value: "64", why: "提高每批处理量。" }],
      },
      catalogOf(),
    );

    expect(recommendation?.title).toBe("模型推荐方案");
  });
});

/**
 * What a model can now propose without being refused. Every address here used to
 * come back as `skipped` because the page's own surface was not the catalogue
 * the assistant was validated against.
 */
describe("model proposals across the whole surface", () => {
  it("accepts the card count as an address", () => {
    const recommendation = modelScenarioRecommendation(
      {
        title: "扩容到 8 张卡",
        rationale: "先把卡数加上去，再谈并行度。",
        settings: [{ key: "topology/devices", value: "8", why: "设备数量就是卡数。" }],
      },
      catalogOf(),
    );

    expect(recommendation?.skipped).toEqual([]);
    expect(recommendation?.plan.items.map((item) => [item.path, item.next, item.kind])).toEqual([
      ["topology/devices", "8", "count"],
    ]);
  });

  it("accepts a top-level field, a policy key and a per-element field", () => {
    const recommendation = modelScenarioRecommendation(
      {
        title: "整体调整",
        rationale: "一次说完。",
        settings: [
          { key: "gpu_participation_mode", value: "gpu_free", why: "当前只提供这一种。" },
          { key: "fidelity_policy", value: "des", why: "用 DES 保真度。" },
          { key: "runtime_trace/policy/fabric_backpressure_active", value: "true", why: "打开背压。" },
          { key: "runtime_trace/requests[0]/tp_degree", value: "4", why: "每请求用 4 卡。" },
          { key: "topology/devices[1]/device_type", value: "H100", why: "第二张卡换型号。" },
        ],
      },
      catalogOf(),
    );

    expect(recommendation?.skipped).toEqual([]);
    expect(recommendation?.plan.rejected).toEqual([]);
    expect(recommendation?.plan.items.map((item) => item.path)).toEqual([
      "gpu_participation_mode",
      "fidelity_policy",
      "runtime_trace/policy/fabric_backpressure_active",
      "runtime_trace/requests[0]/tp_degree",
      "topology/devices[1]/device_type",
    ]);
    expect(recommendation?.plan.items.map((item) => item.kind)).toEqual([
      "enum",
      "enum",
      "boolean",
      "integer",
      "string",
    ]);
  });

  it("still reports an address the page does not expose", () => {
    const recommendation = modelScenarioRecommendation(
      {
        title: "扩容",
        rationale: "顺手把域也加两个。",
        settings: [
          { key: "topology/devices", value: "8", why: "设备数量就是卡数。" },
          { key: "topology/workload/requests", value: "4", why: "页面并没有这个地址。" },
        ],
      },
      catalogOf(),
    );

    expect(recommendation?.skipped).toEqual(["topology/workload/requests"]);
    expect(recommendation?.plan.items.map((item) => item.path)).toEqual(["topology/devices"]);
  });

  it("says so when the Bridge refused part of the proposal", () => {
    // A plan shorter than the answer above it reads as if the model never asked for the missing
    // entries, so a refusal the reader cannot see is one it cannot judge.
    const recommendation = modelScenarioRecommendation(
      {
        title: "扩容",
        rationale: "先把卡数加上去。",
        settings: [{ key: "topology/devices", value: "8", why: "设备数量就是卡数。" }],
        dropped: [
          { key: "overrides/fabric/scale_up_bandwidth_gbps", reason: "settings_limit_exceeded" },
          { key: "overrides/fabric/scale_up_latency_us", reason: "settings_limit_exceeded" },
        ],
      },
      catalogOf(),
    );

    expect(recommendation?.rationale).toBe(
      "先把卡数加上去。模型另外提了 2 项，受一次方案的长度上限或取值范围限制，没有列进这份改动。",
    );
  });

  it("keeps the rationale plain when the Bridge refused nothing", () => {
    const recommendation = modelScenarioRecommendation(
      {
        title: "扩容",
        rationale: "先把卡数加上去。",
        settings: [{ key: "topology/devices", value: "8", why: "设备数量就是卡数。" }],
        dropped: [],
      },
      catalogOf(),
    );

    expect(recommendation?.rationale).toBe("先把卡数加上去。");
  });
});
