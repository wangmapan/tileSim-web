import type { PageContextEnvelope } from "../../entities/agent-context";
import { agentPageDirectory } from "../../entities/navigation/model";

/**
 * Model-visible page ids are a closed vocabulary. They are route identities,
 * not URLs and never become executable code.
 */
export const AGENT_PAGE_DIRECTORY = agentPageDirectory.map((page) => ({
  ...page,
  capabilities: page.capability_ids,
})) as ReadonlyArray<(typeof agentPageDirectory)[number] & { capabilities: readonly string[] }>;

const PAGE_BY_ID = new Map(AGENT_PAGE_DIRECTORY.map((page) => [page.page_id, page]));
type AgentPageId = (typeof AGENT_PAGE_DIRECTORY)[number]["page_id"];

export interface AgentNavigationCandidate {
  page_id: string;
}

export interface AgentNavigationObservation {
  target_page: string;
  actual_page: string | null;
  page_correct: boolean;
  current_page_capabilities: string[];
  current_run_id: string | null;
  current_context_revision: string | null;
  failure_type:
    | "navigation_error"
    | "context_unavailable"
    | "context_invalid"
    | "page_mismatch"
    | "capability_missing"
    | "stale_identity"
    | null;
  retry_allowed: boolean;
  visited_pages: string[];
  navigation_attempts: number;
}

export interface AgentNavigationContextSnapshot {
  page_id?: unknown;
  route_name?: unknown;
  context_revision?: unknown;
  run_id?: unknown;
  backend_identity?: unknown;
  schema_set_revision?: unknown;
  input_snapshot_digest?: unknown;
  artifact_bindings?: unknown;
  capabilities?: unknown;
}

export interface AgentNavigationExecutorOptions {
  allowedPages: readonly string[];
  /** Explicit user-confirmed action grant; navigation consumes only `navigate`. */
  allowedActions: readonly string[];
  requiredCapabilities?: readonly string[];
  visitedPages?: readonly string[];
  /** Number of attempts already committed by the durable flow. */
  navigationAttempts?: number;
  maxAttempts: number;
  maxExecutionTimeMs: number;
  expectedRunId?: string | null;
  expectedContextRevision?: string | null;
  expectedBackendIdentity?: unknown;
  expectedSchemaSetRevision?: string | null;
  expectedInputSnapshotDigest?: string | null;
  expectedArtifactBindings?: unknown;
  /** Persist each bounded observation before trying another candidate. */
  onObservation?: (
    observation: AgentNavigationObservation,
  ) => Promise<"continue" | "completed" | "stale"> | "continue" | "completed" | "stale";
  /** Cancels the local loop before another route or durable mutation starts. */
  signal?: AbortSignal;
  navigate: (pageId: string) => Promise<void> | void;
  readContext: () =>
    | Promise<PageContextEnvelope | AgentNavigationContextSnapshot | null>
    | PageContextEnvelope
    | AgentNavigationContextSnapshot
    | null;
}

export interface AgentNavigationAuthorization {
  /** Immutable Bridge authorization identity for the proposal. */
  authorization_id?: string;
  authorization_digest?: string;
  max_navigation_attempts: number;
  max_model_calls: number;
  max_tool_calls_per_round: number;
  max_run_creations: number;
  max_execution_time_ms: number;
  allowed_pages: readonly string[];
  allowed_actions: readonly string[];
}

const NAVIGATION_AUTHORIZATION_FIELDS = new Set([
  "authorization_id",
  "authorization_digest",
  "max_navigation_attempts",
  "max_model_calls",
  "max_tool_calls_per_round",
  "max_run_creations",
  "max_execution_time_ms",
  "allowed_pages",
  "allowed_actions",
]);
const PUBLISHED_NAVIGATION_ACTIONS = new Set(["navigate"]);

class NavigationDeadlineExceeded extends Error {
  constructor() {
    super("navigation_execution_timeout");
    this.name = "NavigationDeadlineExceeded";
  }
}

class NavigationCancelled extends Error {
  constructor() {
    super("navigation_cancelled");
    this.name = "NavigationCancelled";
  }
}

export interface AgentNavigationResult {
  status: "navigated" | "waiting_user" | "stale";
  observation: AgentNavigationObservation | null;
  failures: AgentNavigationObservation[];
}

function withinNavigationDeadline<T>(value: Promise<T> | T, deadline: number, signal?: AbortSignal): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.reject(new NavigationDeadlineExceeded());
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new NavigationCancelled());
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new NavigationDeadlineExceeded());
    }, remaining);
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(value).then(
      (result) => {
        cleanup();
        resolve(result);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
}

function throwIfNavigationCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new NavigationCancelled();
}

function pageId(value: unknown): AgentPageId | null {
  return typeof value === "string" && PAGE_BY_ID.has(value as AgentPageId) ? (value as AgentPageId) : null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))].slice(0, 32);
}

function contextValue(context: AgentNavigationContextSnapshot | PageContextEnvelope, key: string): unknown {
  if (key in context) return (context as unknown as Record<string, unknown>)[key];
  if (key === "run_id" && "run_ref" in context) return context.run_ref?.run_id ?? null;
  if (key === "context_revision" && "context_revision" in context) return context.context_revision;
  return null;
}

function capabilitiesFor(
  context: AgentNavigationContextSnapshot | PageContextEnvelope,
  actualPage: AgentPageId | null,
): string[] {
  const explicit = contextValue(context, "capabilities");
  if (Array.isArray(explicit)) return stringList(explicit);
  // PageContextEnvelope publishes supported actions, while the closed page
  // directory publishes page capabilities. Keep both meanings separate and
  // use the directory as the fallback capability evidence.
  const pageCapabilities = actualPage ? [...(PAGE_BY_ID.get(actualPage)?.capabilities ?? [])] : [];
  if ("supported_actions" in context)
    return [...new Set([...pageCapabilities, ...stringList(context.supported_actions)])];
  if (pageCapabilities.length) return pageCapabilities;
  return [];
}

function sameIdentity(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Validate the small local navigation grant before it reaches the executor. */
export function isAgentNavigationAuthorization(value: unknown): value is AgentNavigationAuthorization {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !NAVIGATION_AUTHORIZATION_FIELDS.has(key))) return false;
  const numericFields = [
    ["max_navigation_attempts", 8],
    ["max_model_calls", 60],
    ["max_tool_calls_per_round", 4],
    ["max_run_creations", 1],
    ["max_execution_time_ms", 3_600_000],
  ] as const;
  if (record.authorization_id !== undefined && (typeof record.authorization_id !== "string" || !/^authz-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(record.authorization_id))) return false;
  if (record.authorization_digest !== undefined && (typeof record.authorization_digest !== "string" || !/^sha256:[0-9a-f]{64}$/.test(record.authorization_digest))) return false;
  if (
    numericFields.some(
      ([key, maximum]) =>
        !Number.isSafeInteger(record[key]) || Number(record[key]) <= 0 || Number(record[key]) > maximum,
    )
  )
    return false;
  const allowedPages = record.allowed_pages;
  const allowedActions = record.allowed_actions;
  const pageIds = new Set(AGENT_PAGE_DIRECTORY.map((page) => page.page_id));
  return (
    Array.isArray(allowedPages) &&
    allowedPages.length > 0 &&
    allowedPages.length <= 32 &&
    new Set(allowedPages).size === allowedPages.length &&
    allowedPages.every((page) => typeof page === "string" && pageIds.has(page as AgentPageId)) &&
    Array.isArray(allowedActions) &&
    allowedActions.length > 0 &&
    new Set(allowedActions).size === allowedActions.length &&
    allowedActions.every(
      (action) => typeof action === "string" && action.length <= 128 && PUBLISHED_NAVIGATION_ACTIONS.has(action),
    ) &&
    allowedActions.includes("navigate")
  );
}

function staleReason(
  context: AgentNavigationContextSnapshot | PageContextEnvelope,
  options: AgentNavigationExecutorOptions,
): boolean {
  if (options.expectedRunId != null && contextValue(context, "run_id") !== options.expectedRunId) return true;
  if (
    options.expectedContextRevision != null &&
    contextValue(context, "context_revision") !== options.expectedContextRevision
  )
    return true;
  if (
    options.expectedBackendIdentity !== undefined &&
    !sameIdentity(contextValue(context, "backend_identity"), options.expectedBackendIdentity)
  )
    return true;
  if (
    options.expectedSchemaSetRevision != null &&
    contextValue(context, "schema_set_revision") !== options.expectedSchemaSetRevision
  )
    return true;
  if (
    options.expectedInputSnapshotDigest != null &&
    contextValue(context, "input_snapshot_digest") !== options.expectedInputSnapshotDigest
  )
    return true;
  if (
    options.expectedArtifactBindings !== undefined &&
    !sameIdentity(contextValue(context, "artifact_bindings"), options.expectedArtifactBindings)
  )
    return true;
  return false;
}

export function selectAgentNavigationCandidate(
  candidates: readonly AgentNavigationCandidate[] | readonly string[],
  options: Pick<AgentNavigationExecutorOptions, "allowedPages" | "requiredCapabilities" | "visitedPages">,
): string | null {
  const allowed = new Set<AgentPageId>(
    options.allowedPages.map(pageId).filter((value): value is AgentPageId => value !== null),
  );
  const visited = new Set<AgentPageId>(
    (options.visitedPages ?? []).map(pageId).filter((value): value is AgentPageId => value !== null),
  );
  const required = new Set(options.requiredCapabilities ?? []);
  for (const candidate of candidates) {
    const id = pageId(typeof candidate === "string" ? candidate : candidate.page_id);
    if (!id || visited.has(id) || !allowed.has(id)) continue;
    const capabilities = new Set<string>(PAGE_BY_ID.get(id)?.capabilities ?? []);
    if (![...required].every((capability) => capabilities.has(capability))) continue;
    return id;
  }
  return null;
}

export async function executeAgentNavigation(
  target: string,
  options: AgentNavigationExecutorOptions,
  visitedPages: string[],
  navigationAttempts: number,
  deadline = Date.now() + options.maxExecutionTimeMs,
): Promise<{ observation: AgentNavigationObservation; stale: boolean }> {
  throwIfNavigationCancelled(options.signal);
  const id = pageId(target);
  if (!id || !options.allowedPages.includes(id)) throw new Error("navigation_target_not_authorized");
  const attempts = navigationAttempts + 1;
  let failureType: AgentNavigationObservation["failure_type"] = null;
  let deadlineExceeded = false;
  try {
    await withinNavigationDeadline(options.navigate(id), deadline, options.signal);
    throwIfNavigationCancelled(options.signal);
  } catch (error) {
    if (error instanceof NavigationCancelled) throw error;
    failureType = "navigation_error";
    deadlineExceeded = error instanceof NavigationDeadlineExceeded || Date.now() >= deadline;
  }
  let context: AgentNavigationContextSnapshot | PageContextEnvelope | null = null;
  if (!deadlineExceeded) {
    try {
      context = await withinNavigationDeadline(options.readContext(), deadline, options.signal);
      throwIfNavigationCancelled(options.signal);
    } catch (error) {
      if (error instanceof NavigationCancelled) throw error;
      failureType = failureType ?? "context_unavailable";
      deadlineExceeded = deadlineExceeded || error instanceof NavigationDeadlineExceeded || Date.now() >= deadline;
    }
  }
  if (!context || typeof context !== "object") {
    failureType = failureType ?? "context_invalid";
  }
  // The Web context envelope uses a namespaced page_id (for example
  // `page-overview`) for local ownership.  Agent navigation binds to the
  // published route identity, so prefer route_name and only accept page_id as
  // a compatibility fallback.
  const actualPage = context
    ? pageId(contextValue(context, "route_name") ?? contextValue(context, "page_id")) ||
      pageId(String(contextValue(context, "page_id") || "").replace(/^page-/, ""))
    : null;
  const capabilities = context ? capabilitiesFor(context, actualPage) : [];
  const stale = Boolean(context && staleReason(context, options));
  if (stale) failureType = "stale_identity";
  const missing = (options.requiredCapabilities ?? []).some((capability) => !capabilities.includes(capability));
  if (missing) failureType = failureType ?? "capability_missing";
  const observation: AgentNavigationObservation = {
    target_page: id,
    actual_page: actualPage,
    page_correct: !failureType && actualPage === id,
    current_page_capabilities: capabilities,
    current_run_id: context ? (contextValue(context, "run_id") as string | null) : null,
    current_context_revision: context ? (contextValue(context, "context_revision") as string | null) : null,
    failure_type: failureType ?? (actualPage === id ? null : "page_mismatch"),
    retry_allowed: !stale && !deadlineExceeded && attempts < options.maxAttempts && Date.now() < deadline,
    visited_pages: [...visitedPages, id],
    navigation_attempts: attempts,
  };
  return { observation, stale };
}

export async function recoverAgentNavigation(
  candidates: readonly AgentNavigationCandidate[] | readonly string[],
  options: AgentNavigationExecutorOptions,
): Promise<AgentNavigationResult> {
  if (!Number.isSafeInteger(options.maxAttempts) || options.maxAttempts <= 0 || options.maxAttempts > 8) {
    throw new Error("navigation_budget_invalid");
  }
  if (
    !Number.isSafeInteger(options.maxExecutionTimeMs) ||
    options.maxExecutionTimeMs <= 0 ||
    options.maxExecutionTimeMs > 3_600_000
  ) {
    throw new Error("execution_time_budget_invalid");
  }
  if (!options.allowedActions.includes("navigate") || options.allowedActions.some((action) => action !== "navigate")) {
    throw new Error("navigation_action_not_authorized");
  }
  // Persisted flow history is an authorization/audit input, not a hint. Do
  // not silently discard an unknown page and continue with a smaller history:
  // that could make the executor revisit a page the durable flow already
  // attempted. Reject the whole recovery request instead.
  const rawVisited = options.visitedPages ?? [];
  if (!Array.isArray(rawVisited) || rawVisited.some((value) => pageId(value) === null)) {
    throw new Error("navigation_history_invalid");
  }
  const visited = [...rawVisited];
  const failures: AgentNavigationObservation[] = [];
  const initialAttempts = options.navigationAttempts ?? visited.length;
  if (!Number.isSafeInteger(initialAttempts) || initialAttempts < 0 || initialAttempts > options.maxAttempts) {
    throw new Error("navigation_attempts_invalid");
  }
  if (new Set(visited).size !== visited.length || visited.length !== initialAttempts) {
    throw new Error("navigation_history_invalid");
  }
  let attempts = initialAttempts;
  const deadline = Date.now() + options.maxExecutionTimeMs;
  while (attempts < options.maxAttempts) {
    throwIfNavigationCancelled(options.signal);
    if (Date.now() >= deadline) return { status: "waiting_user", observation: failures.at(-1) ?? null, failures };
    const target = selectAgentNavigationCandidate(candidates, { ...options, visitedPages: visited });
    if (!target) return { status: "waiting_user", observation: failures.at(-1) ?? null, failures };
    const result = await executeAgentNavigation(target, options, visited, attempts, deadline);
    attempts = result.observation.navigation_attempts;
    visited.push(target);
    const persisted = await options.onObservation?.(result.observation);
    throwIfNavigationCancelled(options.signal);
    if (result.stale || persisted === "stale")
      return { status: "stale", observation: result.observation, failures: [...failures, result.observation] };
    if (persisted === "completed") return { status: "navigated", observation: result.observation, failures };
    if (result.observation.page_correct) return { status: "navigated", observation: result.observation, failures };
    failures.push(result.observation);
  }
  return { status: "waiting_user", observation: failures.at(-1) ?? null, failures };
}
