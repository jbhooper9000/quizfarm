/**
 * Is a Jeopardy-only anchor bank good enough to measure with?
 *
 * The bank spans depth 2.80 to 5.16. A player deeper than that answers every
 * probe correctly and the binary search runs off the top of the scale — the
 * agent can report "at least 5.16" and nothing more. Since the tuning run put
 * the accuracy budget at roughly +/-0.5 depth levels, saturation is not a
 * rounding error; it is a measurement failure for exactly the players the
 * game is built around.
 *
 * This clamps estimated depth at the ceiling and measures what it costs.
 */
import { buildMatrix, selectEqualised, selectRandom, type Selector } from "../select.ts";
import { makePlayer, makePool, observe, playRound, seeded, type Archetype } from "../simulate.ts";
import type { Format, Profile, Question } from "../types.ts";

const CAST: Archetype[] = ["generalist", "specialist", "enthusiast", "casual"];
const TRIALS = 2500;

/** What the agent can see when its deepest probe is `ceiling`. */
function saturate(p: Profile, ceiling: number): Profile {
  return {
    ...p,
    breadth: Math.min(p.breadth, ceiling),
    domains: p.domains.map((d) => ({
      ...d,
      depth: { ...d.depth, value: Math.min(d.depth.value, ceiling) },
    })),
  };
}

function run(sigma: number, ceiling: number, selector: Selector): Record<string, number> {
  const wins: Record<string, number> = Object.fromEntries(CAST.map((a) => [a, 0]));

  for (let t = 0; t < TRIALS; t++) {
    const rng = seeded(t * 2654435761);
    const truths: Profile[] = CAST.map((a) => makePlayer(a, a, rng));
    const estimates = truths.map((p) => saturate(observe(p, sigma, rng), ceiling));
    const pool: Question[] = makePool(200, rng);

    const m = buildMatrix(pool, estimates);
    const chosen = selector(m, 20);
    const byId = new Map(chosen.map((i) => [pool[i]!.id, i]));
    const pIdx = new Map(truths.map((p, i) => [p.playerId, i]));
    const formatFor = (q: Question, p: Profile): Format =>
      m.formats[byId.get(q.id)!]![pIdx.get(p.playerId)!]!;

    const o = playRound(truths, chosen.map((i) => pool[i]!), formatFor, rng);
    if (!o.tied) wins[o.winner] = (wins[o.winner] ?? 0) + 1;
  }
  return Object.fromEntries(CAST.map((a) => [a, wins[a]! / TRIALS]));
}

const pct = (n: number) => `${(n * 100).toFixed(1).padStart(5)}%`;

function report(label: string, r: Record<string, number>) {
  const v = CAST.map((a) => r[a]!);
  console.log(
    `  ${label.padEnd(38)} ` +
      CAST.map((a) => `${a.slice(0, 4)} ${pct(r[a]!)}`).join("  ") +
      `   spread ${pct(Math.max(...v) - Math.min(...v))}`,
  );
}

console.log("\nAnchor ceiling: how deep the bank can probe before it saturates\n");
report("no ceiling, sigma 0.3 (best case)", run(0.3, 99, selectEqualised));
report("ceiling 5.16 (Jeopardy only)", run(0.3, 5.16, selectEqualised));
report("ceiling 6.0 (+ some deeper anchors)", run(0.3, 6.0, selectEqualised));
report("ceiling 6.5", run(0.3, 6.5, selectEqualised));
report("random selection (floor)", run(0.3, 99, selectRandom));
console.log();
