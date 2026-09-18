export const professionalRoutedGuideIds = [
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

export const lightweightRoutedGuideIds = [
  "lightweight",
  "lightweight_prepare",
  "lightweight_run",
  "lightweight_results",
] as const;

export const routedGuideIds = [...professionalRoutedGuideIds, ...lightweightRoutedGuideIds] as const;

export const embeddedGuideIds = ["unsupported_schema", "raw_evidence"] as const;

export type RoutedGuideId = (typeof routedGuideIds)[number];
export type EmbeddedGuideId = (typeof embeddedGuideIds)[number];
export type GuideId = RoutedGuideId | EmbeddedGuideId;
export type GuidedView = RoutedGuideId;
export type GuideScope = "professional" | "lightweight";

export const professionalGuideIds = [...professionalRoutedGuideIds, ...embeddedGuideIds] as const;
export const lightweightGuideIds = [...lightweightRoutedGuideIds] as const;

const guideIdsByScope = {
  professional: professionalGuideIds,
  lightweight: lightweightGuideIds,
} as const satisfies Readonly<Record<GuideScope, readonly GuideId[]>>;

export function guideIdsForScope(scope: GuideScope): readonly GuideId[] {
  return guideIdsByScope[scope];
}

export function isGuideInScope(guideId: GuideId, scope: GuideScope): boolean {
  return (guideIdsByScope[scope] as readonly GuideId[]).includes(guideId);
}

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
