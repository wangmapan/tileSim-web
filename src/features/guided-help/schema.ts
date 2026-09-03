export const routedGuideIds = [
  "overview",
  "experiment",
  "execution",
  "metrics",
  "fabric",
  "attribution",
  "validation",
  "design_space",
  "history",
  "evidence_agent",
  "evidence_lab",
] as const;

export const embeddedGuideIds = ["unsupported_schema", "raw_evidence"] as const;

export type RoutedGuideId = (typeof routedGuideIds)[number];
export type EmbeddedGuideId = (typeof embeddedGuideIds)[number];
export type GuideId = RoutedGuideId | EmbeddedGuideId;
export type GuidedView = RoutedGuideId;

export type HelpAnchor = `${GuideId}-${string}`;

export interface GuideStep {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly anchor: HelpAnchor;
}

export type GuideSteps = readonly [GuideStep, ...GuideStep[]];

export interface GuideTerm {
  readonly id: string;
  readonly term: string;
  readonly definition: string;
}

export interface GuideDestination {
  readonly label: string;
  readonly routeName: RoutedGuideId;
}

export interface GuideDefinition {
  readonly id: GuideId;
  readonly title: string;
  readonly description: string;
  readonly takeaway: string;
  readonly steps: GuideSteps;
  readonly terms: readonly GuideTerm[];
  readonly next: GuideDestination;
  readonly advanced: {
    readonly title: string;
    readonly body: string;
  };
}

export function defineGuide<const T extends GuideDefinition>(guide: T): T {
  return guide;
}
