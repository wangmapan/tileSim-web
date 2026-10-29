export type TemplateHydrationRequest = {
  token: number;
  controller: { signal: { aborted: boolean } };
  scenarioId: string;
  schemaRevision: string;
  mode: string;
  inputToken: number;
};

export type TemplateHydrationCurrent = {
  mounted: boolean;
  token: number;
  controller: { signal: { aborted: boolean } } | null;
  scenarioId: string;
  schemaRevision: string;
  mode: string;
  inputToken: number;
};

/**
 * A response may hydrate the page only while every identity it read still
 * matches. This is deliberately pure so race cases can be tested without a
 * Bridge or a browser request.
 */
export function templateHydrationRequestIsCurrent(
  request: TemplateHydrationRequest,
  current: TemplateHydrationCurrent,
): boolean {
  return (
    current.mounted &&
    current.token === request.token &&
    current.controller === request.controller &&
    !request.controller.signal.aborted &&
    current.scenarioId === request.scenarioId &&
    current.schemaRevision === request.schemaRevision &&
    current.mode === request.mode &&
    current.inputToken === request.inputToken
  );
}
