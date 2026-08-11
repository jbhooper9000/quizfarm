/**
 * Tuning readout.
 *
 *   node --experimental-strip-types src/experiments/tuning.ts
 *
 * Three questions, in order of how much they matter:
 *
 *   1. Does equalising the predicted spread actually change who wins?
 *   2. How much of that survives the gathering agent being wrong?
 *   3. What tilt lands the hidden champion at the 55-60% target?
 *
 * Question 2 is the one with teeth. It converts a vague design worry — "the
 * profile will be imperfect" — into a number the agent has to hit.
 */
import { buildMatrix, selectChampion, selectEqualised, selectRandom, type Selector } from "../select.ts";
import { makePlayer, makePool, observe, playRound, seeded, type Archetype } from "../simulate.ts";
import type { Format, Profile, Question } from "../types.ts";

const CAST: Archetype[] = ["generalist", "specialist", "enthusiast", "casual"];
const QUESTIONS_PER_ROUND = 20;
const POOL_SIZE = 300;
const TRIALS = 3000;

interface Result {
  winRate: Record<Archetype, number>;
  tieRate: number;
}

function runTrials(sigma: number, makeSelector: () => Selector, trials = TRIALS): Result {
  const wins: Record<string, number> = Object.fromEntries(CAST.map((a) => [a, 0]));
  let ties = 0;

  for (let t = 0; t < trials; t++) {
    const rng = seeded(t * 2654435761);

    const truths: Profile[] = CAST.map((a) => makePlayer(a, a, rng));
    const estimates = truths.map((p) => observe(p, sigma, rng));
    const pool: Question[] = makePool(POOL_SIZE, rng);

    // The selector sees only the estimates. Answers come from the truth.
    const m = buildMatrix(pool, estimates);
    const chosen = makeSelector()(m, QUESTIONS_PER_ROUND);

    const byId = new Map(chosen.map((i) => [pool[i]!.id, i]));
    const playerIndex = new Map(truths.map((p, i) => [p.playerId, i]));
    const formatFor = (q: Question, p: Profile): Format =>
      m.formats[byId.get(q.id)!]![playerIndex.get(p.playerId)!]!;

    const outcome = playRound(truths, chosen.map((i) => pool[i]!), formatFor, rng);
    if (outcome.tied) ties++;
    else wins[outcome.winner] = (wins[outcome.winner] ?? 0) + 1;
  }

  return {
    winRate: Object.fromEntries(CAST.map((a) => [a, wins[a]! / trials])) as Record<Archetype, number>,
    tieRate: ties / trials,
  };
}

const pct = (n: number) => `${(n * 100).toFixed(1).padStart(5)}%`;

function report(label: string, r: Result) {
  const rates = CAST.map((a) => r.winRate[a]);
  const gap = Math.max(...rates) - Math.min(...rates);
  console.log(
    `  ${label.padEnd(26)} ` +
      CAST.map((a) => `${a.slice(0, 4)} ${pct(r.winRate[a])}`).join("  ") +
      `   spread ${pct(gap)}`,
  );
}

console.log(`\n${CAST.length} players, ${QUESTIONS_PER_ROUND} questions, ${TRIALS} rounds each\n`);

console.log("1. Does equalisation change who wins? (perfect profiles)");
report("random selection", runTrials(0, () => selectRandom));
report("equalised selection", runTrials(0, () => selectEqualised));

console.log("\n2. Cost of profiling error — sigma is depth-units of measurement noise");
for (const sigma of [0, 0.5, 1.0, 1.5, 2.0]) {
  report(`equalised, sigma ${sigma.toFixed(1)}`, runTrials(sigma, () => selectEqualised));
}

console.log("\n3. Champion tilt — champion is the CASUAL player, the hard case");
const casualIndex = CAST.indexOf("casual");
for (const tilt of [0, 0.2, 0.35, 0.5, 0.7, 1.0]) {
  report(`tilt ${tilt.toFixed(2)}`, runTrials(0.75, () => selectChampion(casualIndex, tilt)));
}

console.log("\n   same tilts, champion is the GENERALIST");
const genIndex = CAST.indexOf("generalist");
for (const tilt of [0, 0.2, 0.35, 0.5]) {
  report(`tilt ${tilt.toFixed(2)}`, runTrials(0.75, () => selectChampion(genIndex, tilt)));
}
console.log();
