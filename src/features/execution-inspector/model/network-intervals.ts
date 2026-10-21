import type { NetworkWaitInterval } from "../../../contracts/report-model";
import { isLosslessInteger, losslessIntegerToBigInt } from "../../../contracts/lossless-json";

export interface NetworkIntervalAnalysis {
  valid: NetworkWaitInterval[];
  invalid: NetworkWaitInterval[];
  overlapPairs: number;
  duplicateCount: number;
}

/** Network intervals explain one parent wait; never sum them as extra latency. */
export function analyzeNetworkIntervals(intervals: NetworkWaitInterval[] | undefined): NetworkIntervalAnalysis {
  const valid: NetworkWaitInterval[] = [];
  const invalid: NetworkWaitInterval[] = [];
  for (const interval of intervals || []) {
    if (!isLosslessInteger(interval.start_time_ps) || !isLosslessInteger(interval.end_time_ps)) {
      invalid.push(interval);
      continue;
    }
    const start = losslessIntegerToBigInt(interval.start_time_ps);
    const end = losslessIntegerToBigInt(interval.end_time_ps);
    if (end <= start) invalid.push(interval);
    else valid.push(interval);
  }
  let overlapPairs = 0;
  for (let left = 0; left < valid.length; left += 1) {
    for (let right = left + 1; right < valid.length; right += 1) {
      const aStart = losslessIntegerToBigInt(valid[left].start_time_ps!);
      const aEnd = losslessIntegerToBigInt(valid[left].end_time_ps!);
      const bStart = losslessIntegerToBigInt(valid[right].start_time_ps!);
      const bEnd = losslessIntegerToBigInt(valid[right].end_time_ps!);
      if (aStart < bEnd && bStart < aEnd) overlapPairs += 1;
    }
  }
  const seen = new Set<string>();
  let duplicateCount = 0;
  for (const interval of valid) {
    const key = [
      interval.component_code,
      interval.demand_id,
      interval.link_id,
      interval.attempt,
      interval.start_time_ps,
      interval.end_time_ps,
    ].join("\u0000");
    if (seen.has(key)) duplicateCount += 1;
    seen.add(key);
  }
  return { valid, invalid, overlapPairs, duplicateCount };
}
