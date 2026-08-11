/**
 * Domain taxonomy.
 *
 * Domains are slash-separated paths through a shallow tree:
 *
 *   sport/football/english/championship
 *   music/electronic/detroit-techno
 *   science/biology
 *
 * Depth of nesting is deliberately not fixed. Some areas of knowledge
 * genuinely fan out further than others, and forcing a uniform depth just
 * produces filler levels nobody uses.
 */

export type DomainPath = string;

export function segments(path: DomainPath): string[] {
  return path.split("/").filter(Boolean);
}

/** Number of segments shared from the root. */
function commonPrefixLength(a: string[], b: string[]): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * How much of a player's measured depth in `from` carries over to a question
 * in `to`, as a multiplier in [0, 1].
 *
 * The important property here is that transfer is ASYMMETRIC, because
 * knowledge is:
 *
 *   - Knowing Championship football deeply implies you know football
 *     generally. Moving toward the root costs you very little.
 *   - Knowing football generally does NOT imply you know the Championship.
 *     Moving away from the root costs you a lot.
 *
 * A symmetric distance metric gets this wrong in both directions and will
 * make the specialist look like a generalist.
 *
 * Cousins route through the common ancestor: up from `from`, then down to
 * `to`.
 *
 * These two constants are the main tuning dials in the whole prediction
 * model. They are guesses right now. Once there is real response data they
 * should be fitted rather than chosen.
 */
export const TRANSFER_TOWARD_ROOT = 0.9;
export const TRANSFER_AWAY_FROM_ROOT = 0.78;

/**
 * Extra damping when two domains share nothing but their top-level category.
 *
 * The top level is a filing label, not a domain. Nobody knows "sport" or
 * "music" as a unit — knowledge clusters one or two levels down, around
 * things like football or Britpop. Without this, an obsessive follower of
 * lower-league football reads as knowing a fair amount about rugby, purely
 * because both files under `sport`.
 *
 * This was the dominant source of error in the first fit, and it is why
 * questions may not be tagged at the top level (see assertQuestionDomain).
 */
export const ROOT_CROSSING_PENALTY = 0.45;

export function transfer(from: DomainPath, to: DomainPath): number {
  const a = segments(from);
  const b = segments(to);
  const shared = commonPrefixLength(a, b);

  // Unrelated top-level branches: no transfer at all. General ability is
  // handled separately by Profile.breadth, not by leaking across the tree.
  if (shared === 0) return 0;

  const up = a.length - shared;
  const down = b.length - shared;

  const t =
    Math.pow(TRANSFER_TOWARD_ROOT, up) * Math.pow(TRANSFER_AWAY_FROM_ROOT, down);

  const crossesRoot = shared === 1 && b.length > 1;
  return crossesRoot ? t * ROOT_CROSSING_PENALTY : t;
}

/**
 * Questions must be tagged at least two levels deep.
 *
 * A question tagged `sport` is unanswerable as a design object: there is no
 * such thing as being deep in "sport", so no depth we assign it means
 * anything, and every specialist in every branch would read as partially
 * qualified to answer it. Enforced at ingest, when tagging the bank.
 */
export function isValidQuestionDomain(path: DomainPath): boolean {
  return segments(path).length >= 2;
}

export function isAncestorOf(ancestor: DomainPath, descendant: DomainPath): boolean {
  const a = segments(ancestor);
  const d = segments(descendant);
  return a.length < d.length && commonPrefixLength(a, d) === a.length;
}
