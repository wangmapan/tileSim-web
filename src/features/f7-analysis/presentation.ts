import type { DesignCandidate } from "../../contracts/report-model";
import { formatNumber } from "../../lib/format";
import type { F7Capability } from "./model";

type Translate = (source: string, params?: Record<string, string | number>) => string;

const capabilityTitles: Record<F7Capability["key"], string> = {
  reported_ranking: "后端 reported ranking",
  pareto: "Pareto membership",
  candidate_navigation: "候选 run / artifact 导航",
  executed_s6_knobs: "Executed S6 knobs",
  topology_domain_join: "Topology → metrics domain",
};

const capabilityDetails: Record<F7Capability["key"], string> = {
  reported_ranking: "只展示后端 final_rank；它不是 Pareto front。",
  pareto: "后端未提供 front ID、membership 或 dominance，前端不自行计算。",
  candidate_navigation: "候选链接是 opaque 字符串且没有独立 artifact manifest，禁止解析或跳转。",
  executed_s6_knobs: "候选缺少带单位、availability 和 Pointer 的完整实际执行参数。",
  topology_domain_join: "topology 尚无版本化 identity 和 domain EvidenceRef，不按名称连接。",
};

const availableCapabilityDetails: Record<F7Capability["key"], string> = {
  reported_ranking: "展示后端报告顺序与 final_rank；不会重算排序。",
  pareto: "Pareto front ID、membership、dominance 与 objectives 均来自正式后端契约。",
  candidate_navigation: "候选导航固定到当前 run 的 design-space artifact 记录；backend instance 不是 Bridge run。",
  executed_s6_knobs: "requested、resolved、单位与 availability 均来自正式 S6 knob 记录。",
  topology_domain_join: "metrics 通过正式 EvidenceRef 连接到唯一 topology domain。",
};

export function unresolvedCandidateKnobs(candidates: DesignCandidate[]): string[] {
  const fields = ["runtime_scheduler", "kv_policy", "device_profile", "moe_placement"];
  return fields.filter((field) => candidates.some((candidate) => candidate[field] === "unresolved_not_executed"));
}

export function createDesignSpacePresentation(t: Translate) {
  return {
    rankDelta(candidate: DesignCandidate) {
      if (!candidate.analytical_rank || !candidate.final_rank) return "—";
      const delta = candidate.analytical_rank - candidate.final_rank;
      if (!delta) return t("不变");
      return delta > 0 ? `↑ ${delta}` : `↓ ${Math.abs(delta)}`;
    },
    metricValue(value: number | undefined, unit = "", available = true) {
      if (!available) return t("不适用");
      const formatted = formatNumber(value);
      return formatted === "—" || !unit ? formatted : `${formatted} ${unit}`;
    },
    boundRange(candidate: DesignCandidate, percentile: "p95" | "p99") {
      const bounds = candidate.deterministic_bounds_us?.[percentile];
      if (typeof bounds?.lower !== "number" || typeof bounds?.upper !== "number") return "—";
      return `${formatNumber(bounds.lower)}–${formatNumber(bounds.upper)} µs`;
    },
    candidateKnobEntries(candidate: DesignCandidate) {
      const values = candidate.candidate_knobs || {
        runtime_scheduler: candidate.runtime_scheduler,
        kv_policy: candidate.kv_policy,
        device_profile: candidate.device_profile,
        topology_scale: candidate.topology_scale,
        moe_expert_count: candidate.moe_expert_count,
        moe_placement: candidate.moe_placement,
      };
      return Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== "");
    },
    candidateLinks(candidate: DesignCandidate) {
      return [
        ["DES refinement", candidate.des_refinement_link],
        ["S8 validation", candidate.validation_link],
        ["S9 metrics", candidate.metrics_link],
        ["Tail attribution", candidate.tail_attribution_link],
      ].filter((entry): entry is [string, string] => Boolean(entry[1]));
    },
    capabilityTitle(capability: F7Capability) {
      return t(capabilityTitles[capability.key]);
    },
    capabilityDetail(capability: F7Capability) {
      return t(
        capability.availability === "available" || capability.availability === "partial"
          ? availableCapabilityDetails[capability.key]
          : capabilityDetails[capability.key],
      );
    },
  };
}
