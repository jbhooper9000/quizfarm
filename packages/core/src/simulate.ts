import { predict } from "./predict.ts";
import type { DomainPath } from "./domain.ts";
import type { Format, Profile, Question } from "./types.ts";

/**
 * Offline simulation of rounds, for tuning the selector without a room full
 * of people.
 *
 * THE POINT OF THIS FILE, which is easy to get wrong:
 *
 * Every player has TWO profiles. `truth` governs whether they actually answer
 * correctly. `estimate` is what gathering managed to measure, and it is the
 * only thing the selector is allowed to see.
 *
 * If you simulate answers from the same numbers the selector optimised
 * against, you are just checking that arithmetic is consistent with itself,
 * and the equaliser will look far better here than it ever will in a living
 * room. Splitting them turns this into a real experiment: how much does
 * profiling error actually cost, and therefore how accurate does the
 * gathering agent have to be?
 */

// ---------------------------------------------------------------------------
// Deterministic RNG, so a surprising result can be reproduced and dug into
// ---------------------------------------------------------------------------

export type Rng = () => number;

export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(xs: readonly T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)]!;
const gauss = (rng: Rng): number =>
  Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// ---------------------------------------------------------------------------
// A synthetic world
// ---------------------------------------------------------------------------

/** Leaf domains, all at least two levels deep per isValidQuestionDomain. */
export const WORLD: DomainPath[] = [
  "sport/football/english/championship",
  "sport/football/english/premier-league",
  "sport/football/spanish",
  "sport/rugby/union",
  "sport/cricket/test",
  "sport/motorsport/f1",
  "music/rock/britpop",
  "music/rock/prog",
  "music/electronic/techno",
  "music/hiphop/golden-age",
  "screen/film/horror",
  "screen/film/new-hollywood",
  "screen/tv/sitcoms",
  "history/military/napoleonic",
  "history/social/victorian-britain",
  "science/biology/marine",
  "science/physics/astronomy",
  "food/wine/burgundy",
  "food/baking/bread",
  "games/videogames/rpgs",
];

export type Archetype = "generalist" | "specialist" | "enthusiast" | "casual";

/** Breadth, then how many deep domains and roughly how deep. */
const ARCHETYPES: Record<Archetype, { breadth: number; spikes: number; depth: number }> = {
  generalist: { breadth: 5.0, spikes: 0, depth: 0 },
  specialist: { breadth: 2.6, spikes: 1, depth: 6.8 },
  enthusiast: { breadth: 3.6, spikes: 2, depth: 5.2 },
  casual: { breadth: 2.8, spikes: 1, depth: 4.2 },
};

export function makePlayer(id: string, archetype: Archetype, rng: Rng): Profile {
  const spec = ARCHETYPES[archetype];
  const chosen = new Set<DomainPath>();
  while (chosen.size < spec.spikes) chosen.add(pick(WORLD, rng));

  return {
    playerId: id,
    breadth: spec.breadth + gauss(rng) * 0.3,
    domains: [...chosen].map((domain) => ({
      domain,
      depth: {
        value: spec.depth + gauss(rng) * 0.5,
        confidence: 0.8,
        source: "observed" as const,
      },
      evidence: [],
    })),
    ruledOut: [],
    sessionsPlayed: 0,
    updatedAt: new Date(0).toISOString(),
  };
}

/**
 * What gathering *thinks* it measured: the truth plus error.
 *
 * `sigma` is in depth units, so 1.0 means the agent's estimate of how deep
 * someone is typically lands a whole level out. Sweeping it answers the
 * question the gathering agent's whole design hangs on — how good is good
 * enough.
 */
export function observe(truth: Profile, sigma: number, rng: Rng): Profile {
  return {
    ...truth,
    breadth: truth.breadth + gauss(rng) * sigma,
    domains: truth.domains.map((d) => ({
      ...d,
      depth: { ...d.depth, value: d.depth.value + gauss(rng) * sigma, source: "agent" as const },
    })),
  };
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export function makePool(size: number, rng: Rng): Question[] {
  return Array.from({ length: size }, (_, i) => {
    const domain = pick(WORLD, rng);
    const depth = 1.5 + rng() * 5.5;
    return {
      id: `q${i}`,
      prompt: "",
      answer: { canonical: "", accept: [], distractors: ["a", "b", "c"] },
      domain,
      depth: { value: depth, confidence: 0.7, source: "pageviews" as const },
      source: { kind: "bank" as const, corpus: "jeopardy" as const },
      anchor: false,
    };
  });
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export const MAX_RARITY_MULTIPLIER = 5;

/**
 * Payout scales with how rare a correct answer turned out to be IN THE ROOM,
 * not with what the model predicted. Keeping the model out of the scoring
 * path means a mis-calibrated prediction can misjudge which questions get
 * asked, but can never hand somebody an undeserved windfall.
 */
export function rarityMultiplier(correct: number, players: number): number {
  if (correct === 0) return 0;
  return Math.min(MAX_RARITY_MULTIPLIER, players / correct);
}

export interface RoundOutcome {
  scores: Map<string, number>;
  winner: string;
  /** True when two or more players tied at the top. */
  tied: boolean;
}

export function playRound(
  truths: Profile[],
  questions: Question[],
  formatFor: (q: Question, p: Profile) => Format,
  rng: Rng,
): RoundOutcome {
  const scores = new Map(truths.map((p) => [p.playerId, 0]));

  for (const q of questions) {
    const got = truths.filter((p) => rng() < predict(p, q, formatFor(q, p)).p);
    const mult = rarityMultiplier(got.length, truths.length);
    for (const p of got) scores.set(p.playerId, scores.get(p.playerId)! + 10 * mult);
  }

  let best = -Infinity;
  let winner = "";
  let tied = false;
  for (const [id, s] of scores) {
    if (s > best) [best, winner, tied] = [s, id, false];
    else if (s === best) tied = true;
  }
  return { scores, winner, tied };
}
