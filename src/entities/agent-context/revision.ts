/**
 * Keeps a published page-context revision stable while the page's content is unchanged.
 *
 * The revision is the token the assistant panel compares when it decides whether a
 * parameter plan still describes the page it was computed for.  A publisher, however,
 * runs whenever any input it reads is *touched*, and being touched is not the same as
 * having changed: a descriptor object can be replaced by an equal one, a form's deep
 * watcher can fire on a nested write that leaves the published values identical, and a
 * kept-alive page can re-declare itself on re-entry.  Revisions built from a counter
 * alone move in all of those cases, which would refuse a plan that was read moments
 * earlier although nothing it addresses has moved.
 *
 * Callers therefore pass the content the revision is meant to stand for.  The keeper
 * hands back a fresh revision only when that content actually differs from the last one
 * it published, and reports whether it did.
 *
 * What the keeper does **not** do is let a publisher stay silent: holding the revision
 * steady and declaring the context are two different jobs.  The application shell
 * publishes a generic projection under the same provider id, so a page that skipped its
 * own declaration left a parameter-free context standing as the live one — the panel
 * then answered about the page rather than about its parameters.  Publishers keep the
 * revision *and* declare the context on every run; the `changed` flag is there for
 * callers that need to know whether the page really moved.
 */

/**
 * The revision a publisher puts into the content it measures.  Holding it fixed keeps the
 * measurement about the page rather than about the token that names it.
 */
export const UNPUBLISHED_CONTEXT_REVISION = "context:pending";

export interface PageContextRevision {
  /** The revision that names this content: the previous one when nothing changed. */
  readonly revision: string;
  /** Whether this call saw content that differs from what was published before. */
  readonly changed: boolean;
}

/** Creates the holder one page uses for every context it publishes. */
export function createPageContextRevisionKeeper(): (prefix: string, content: unknown) => PageContextRevision {
  let sequence = 0;
  let publishedContent: string | null = null;
  let publishedRevision: string | null = null;

  return (prefix, content) => {
    const nextContent = JSON.stringify([prefix, content ?? null]);
    if (nextContent === publishedContent && publishedRevision !== null) {
      return { revision: publishedRevision, changed: false };
    }
    sequence += 1;
    publishedContent = nextContent;
    publishedRevision = `${prefix}:${sequence}`;
    return { revision: publishedRevision, changed: true };
  };
}
