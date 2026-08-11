/**
 * Turning a Jeopardy board position into a depth estimate.
 *
 * The chain of reasoning, since every step is an assumption worth being able
 * to argue with later:
 *
 *   1. A clue's board value encodes how hard the writers judged it. Values
 *      doubled on 1984 -> 2001-11-26, so normalise to a row index 1-5 first.
 *   2. Row index maps to roughly what fraction of contestants answer it
 *      correctly. Double Jeopardy is harder than Single at the same row.
 *   3. Our model says p = logistic(playerDepth - questionDepth). Rearranged,
 *      questionDepth = playerDepth - logit(p). Assume a typical contestant
 *      sits at CONTESTANT_DEPTH and the clue's depth falls out.
 *
 * KNOWN LIMITATION. Step 3 pretends a contestant is equally deep in every
 * domain, which they are not — they are better at literature than at grime.
 * Within a single domain the resulting bias is roughly constant, so the
 * ORDERING of anchors stays right and binary-search probing still works. What
 * it distorts is the absolute level, and therefore comparisons ACROSS domains.
 * Real response data (DepthSource "observed") is what eventually fixes this.
 */

/** Board values doubled on this date. */
const DOUBLING_DATE = "2001-11-26";

/**
 * Where a typical Jeopardy contestant sits on our 1-7 depth scale. They are
 * exceptional generalists, so this is high but not specialist.
 */
export const CONTESTANT_DEPTH = 5.0;

/**
 * Estimated fraction of contestants answering correctly, by round and row.
 * Ordering is solid; exact figures are informed guesses and should be
 * replaced the moment there is real response data to fit against.
 */
const P_CORRECT: Record<1 | 2, [number, number, number, number, number]> = {
  1: [0.9, 0.85, 0.79, 0.72, 0.65],
  2: [0.8, 0.73, 0.65, 0.56, 0.46],
};

/** Final Jeopardy has no board value; treat it as a coin flip. */
const P_CORRECT_FINAL = 0.5;

const logit = (p: number) => Math.log(p / (1 - p));

export interface BoardPosition {
  round: 1 | 2 | 3;
  clueValue: number;
  airDate: string;
}

/** Row index 1-5, or null if the value doesn't sit on the expected grid. */
export function rowIndex(pos: BoardPosition): number | null {
  if (pos.round === 3) return null;
  const unit = (pos.airDate < DOUBLING_DATE ? 100 : 200) * pos.round;
  const row = pos.clueValue / unit;
  return Number.isInteger(row) && row >= 1 && row <= 5 ? row : null;
}

/**
 * Depth for FREE-TEXT recall, which is how contestants answer. Presenting the
 * same item as multiple choice makes it easier, and predict() already models
 * that with a guessing floor — so this must not be adjusted for format here.
 */
export function depthFromBoard(pos: BoardPosition): number | null {
  if (pos.round === 3) return CONTESTANT_DEPTH - logit(P_CORRECT_FINAL);
  const row = rowIndex(pos);
  if (row === null) return null;
  return CONTESTANT_DEPTH - logit(P_CORRECT[pos.round][row - 1]!);
}
