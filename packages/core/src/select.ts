import { predict } from "./predict.ts";
import type { Format, Profile, Question } from "./types.ts";

/**
 * Turning predictions into a round.
 *
 * A selector may only ever see ESTIMATED profiles. It never gets to look at
 * what players actually know — that asymmetry is the whole reason the
 * simulator is worth building.
 */

/** p for every (question, player) pair, computed once and then indexed. */
export interface Matrix {
  questions: Question[];
  players: Profile[];
  /** p[qIndex][playerIndex] */
  p: number[][];
  formats: Format[][];
}

/**
 * Free-text for whoever is most likely to know it, multiple choice for
 * everyone else.
 *
 * This is the quiet difficulty lever: the recall/recognition gap is large and
 * almost invisible in play. It is also what stops a niche question from being
 * a gimme for one player and dead air for the rest — with options in front of
 * them, outsiders can reason their way in.
 */
export function buildMatrix(questions: Question[], players: Profile[]): Matrix {
  const p: number[][] = [];
  const formats: Format[][] = [];

  for (const q of questions) {
    const free = players.map((pl) => predict(pl, q, "free-text").p);
    let owner = 0;
    for (let i = 1; i < free.length; i++) if (free[i]! > free[owner]!) owner = i;

    const row: number[] = [];
    const frow: Format[] = [];
    players.forEach((pl, i) => {
      const fmt: Format = i === owner ? "free-text" : "multiple-choice";
      frow.push(fmt);
      row.push(i === owner ? free[i]! : predict(pl, q, fmt).p);
    });
    p.push(row);
    formats.push(frow);
  }

  return { questions, players, p, formats };
}

const MAX_MULT = 5;

/** Expected points each player takes from a question, rarity included. */
function expectedGains(row: number[], nPlayers: number): number[] {
  const expectedCorrect = row.reduce((a, b) => a + b, 0);
  const mult = Math.min(MAX_MULT, nPlayers / Math.max(expectedCorrect, 0.5));
  return row.map((p) => p * 10 * mult);
}

function spread(scores: number[]): number {
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.sqrt(scores.reduce((a, s) => a + (s - mean) ** 2, 0) / scores.length);
}

/**
 * A question nobody can touch, or one everybody gets, teaches the scoreboard
 * nothing and is dull to sit through. Rounds want questions that split the room.
 */
function informative(row: number[]): boolean {
  const max = Math.max(...row);
  const min = Math.min(...row);
  return max > 0.15 && min < 0.92;
}

export type Selector = (m: Matrix, n: number) => number[];

export const selectRandom: Selector = (m, n) => {
  const idx = m.questions.map((_, i) => i).filter((i) => informative(m.p[i]!));
  const out: number[] = [];
  while (out.length < n && idx.length) out.push(...idx.splice(Math.floor(Math.random() * idx.length), 1));
  return out;
};

/**
 * Greedily pick the question that leaves predicted scores closest together.
 *
 * Note this equalises the PREDICTED spread. Real outcomes still vary, which
 * is the point — the aim was never to make the result a coin flip, only to
 * stop it being a foregone conclusion.
 */
export function selectEqualised(m: Matrix, n: number, exclude?: Set<number>): number[] {
  const running = new Array(m.players.length).fill(0) as number[];
  const taken = new Set<number>(exclude ?? []);
  const out: number[] = [];

  for (let k = 0; k < n; k++) {
    let best = -1;
    let bestSpread = Infinity;

    for (let i = 0; i < m.questions.length; i++) {
      if (taken.has(i) || !informative(m.p[i]!)) continue;
      const gains = expectedGains(m.p[i]!, m.players.length);
      const s = spread(running.map((r, j) => r + gains[j]!));
      if (s < bestSpread) [bestSpread, best] = [s, i];
    }

    if (best < 0) break;
    const gains = expectedGains(m.p[best]!, m.players.length);
    gains.forEach((g, j) => (running[j]! += g));
    taken.add(best);
    out.push(best);
  }

  return out;
}

/**
 * Hidden-advantage mode.
 *
 * `tilt` is the fraction of questions chosen to favour the champion; the rest
 * are equalised across everybody. The advantage comes from depth-pitching —
 * picking questions the champion clears and others don't — rather than from
 * handing them extra questions in their own topics, because allocation is
 * visible and depth is not.
 *
 * Tuning target is roughly 55–60% win probability. Stronger than that and the
 * deduction collapses: if the champion always wins, working out who it was is
 * just reading the scoreboard.
 */
export function selectChampion(championIndex: number, tilt: number): Selector {
  return (m, n) => {
    const favoured = Math.round(n * tilt);
    const taken = new Set<number>();
    const out: number[] = [];

    for (let k = 0; k < favoured; k++) {
      let best = -1;
      let bestEdge = -Infinity;
      for (let i = 0; i < m.questions.length; i++) {
        if (taken.has(i) || !informative(m.p[i]!)) continue;
        const gains = expectedGains(m.p[i]!, m.players.length);
        const others = gains.filter((_, j) => j !== championIndex);
        const edge = gains[championIndex]! - Math.max(...others);
        if (edge > bestEdge) [bestEdge, best] = [edge, i];
      }
      if (best < 0) break;
      taken.add(best);
      out.push(best);
    }

    // Remaining slots equalised across the whole room.
    return [...out, ...selectEqualised(m, n - out.length, taken)];
  };
}
