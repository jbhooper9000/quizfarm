import { transfer } from "./domain.ts";
import type { Format, Profile, Question } from "./types.ts";

/**
 * The core computation of the whole system.
 *
 * Everything else is a policy over this number:
 *
 *   - equalising a round is balancing sums of it across players
 *   - champion mode is pushing one player's sum up without moving the topics
 *   - depth-pitching is finding questions where it is high for one player
 *     and low for everyone else
 *   - live adaptation is refitting it after five questions of real data
 *
 * The model is Rasch-flavoured: a logistic on the gap between how deep the
 * player is and how deep the question is, with a guessing floor for multiple
 * choice. Nothing exotic — the interesting part is the domain transfer term,
 * not the curve.
 */

/** Controls how sharply p moves as the depth gap widens. Tunable. */
export const DISCRIMINATION = 1.0;

export interface Prediction {
  /** Probability the player answers correctly. */
  p: number;
  /**
   * How much to trust `p`, in 0–1, from the confidence of the inputs and how
   * far the knowledge had to travel across the taxonomy.
   *
   * The selector needs this separately from `p`. A question we are confident
   * is a 50/50 is a good question; a question we have no idea about is not
   * the same thing, even though both come out at 0.5.
   */
  confidence: number;
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * The depth this player effectively brings to a question in `domain`.
 *
 * Takes the best of: any measured domain knowledge discounted by taxonomic
 * transfer, floored at their general breadth. The floor is what stops a
 * specialist from looking clueless on easy questions outside their patch.
 */
export function effectiveDepth(
  profile: Profile,
  domain: string,
): { depth: number; confidence: number } {
  let best = { depth: profile.breadth, confidence: 0.5 };

  for (const known of profile.domains) {
    const t = transfer(known.domain, domain);
    if (t === 0) continue;

    const depth = known.depth.value * t;
    if (depth > best.depth) {
      // Confidence decays with transfer distance: knowledge inferred from a
      // neighbouring domain is a weaker claim than knowledge measured directly.
      best = { depth, confidence: known.depth.confidence * t };
    }
  }

  return best;
}

export function predict(
  profile: Profile,
  question: Question,
  format: Format,
): Prediction {
  const { depth, confidence: depthConfidence } = effectiveDepth(
    profile,
    question.domain,
  );

  const gap = depth - question.depth.value;
  const knows = logistic(gap * DISCRIMINATION);

  // Multiple choice raises the floor: even with no knowledge you land on it
  // sometimes. This is the format lever made explicit — the same question is
  // materially easier as MCQ, which is how an outsider gets a real shot at a
  // niche question instead of just sitting it out.
  const floor =
    format === "multiple-choice"
      ? 1 / (question.answer.distractors.length + 1)
      : 0;

  const p = floor + (1 - floor) * knows;

  return {
    p,
    confidence: Math.min(depthConfidence, question.depth.confidence),
  };
}
