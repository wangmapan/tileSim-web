import type { AttributionItem } from "../../contracts/report-model";

export function partitionCausalAttributions(entries: AttributionItem[]) {
  const indexed = entries.map((item, sourceIndex) => ({ item, sourceIndex }));
  return {
    causal: indexed.filter(({ item }) => /^S[0-6]$/.test(item.subsystem || "")),
    outputPlane: indexed.filter(({ item }) => /^S[789]$/.test(item.subsystem || "")),
  };
}
