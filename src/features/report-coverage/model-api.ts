/**
 * Pure public entry (no Vue imports) for consumers that must stay outside the component graph,
 * e.g. the structured-report HTML export worker. Mirrors `execution-inspector/model-api.ts`.
 */
export {
  availabilityDescription,
  availabilityFor,
  availabilityLabel,
  availabilityOfValue,
  availabilityStates,
  availabilityTone,
} from "./availability";
export type { AvailabilityTone } from "./availability";
