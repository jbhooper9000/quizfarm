/**
 * Why can't the weakest player be made the favourite?
 *
 * The tilt sweep topped out at 25.9% for the casual player even when EVERY
 * question was chosen to favour them. Two candidate explanations:
 *
 *   (a) profiling noise is misdirecting the tilt, or
 *   (b) selection can only exploit an advantage that already exists, and the
 *       casual archetype has none — a "specialty" at depth 4.2 is shallower
 *       than the generalist's breadth of 5.0, so there is no question in the
 *       pool that belongs to them.
 *
 * Testing both: drop the noise to zero, and separately give the casual player
 * one genuinely isolated domain.
 */
import { buildMatrix, selectChampion } from "../select.ts";
import { makePlayer, makePool, observe, playRound, seeded, WORLD } from "../simulate.ts";
import type { Archetype } from "../simulate.ts";
import type { Format, Profile, Question } from "../types.ts";

const CAST: Archetype[] = ["generalist", "specialist", "enthusiast", "casual"];
const TRIALS = 1500;

function run(sigma: number, tilt: number, giveCasualANiche: boolean): Record<string, number> {
  const wins: Record<string, number> = Object.fromEntries(CAST.map((a) => [a, 0]));

  for (let t = 0; t < TRIALS; t++) {
    const rng = seeded(t * 2654435761);
    const truths: Profile[] = CAST.map((a) => makePlayer(a, a, rng));

    if (giveCasualANiche) {
      // One domain nobody else is anywhere near — the thing the gathering
      // agent is supposed to dig out, or the harvest is supposed to create.
      const casual = truths[CAST.indexOf("casual")]!;
      casual.domains = [
        {
          domain: WORLD[Math.floor(rng() * WORLD.length)]!,
          depth: { value: 6.2, confidence: 0.8, source: "observed" },
          evidence: [],
        },
      ];
    }

    const estimates = truths.map((p) => observe(p, sigma, rng));
    const pool: Question[] = makePool(200, rng);
    const m = buildMatrix(pool, estimates);
    const chosen = selectChampion(CAST.indexOf("casual"), tilt)(m, 20);

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
  console.log(
    `  ${label.padEnd(34)} ` + CAST.map((a) => `${a.slice(0, 4)} ${pct(r[a]!)}`).join("  "),
  );
}

console.log("\nChampion is the casual player throughout. Target: 55-60%.\n");

console.log("(a) is it the noise? tilt 1.0, sweeping sigma");
for (const sigma of [0, 0.25, 0.75]) {
  report(`sigma ${sigma.toFixed(2)}, no niche`, run(sigma, 1.0, false));
}

console.log("\n(b) is it that they own nothing? give them one depth-6.2 domain");
for (const tilt of [0.2, 0.35, 0.5, 0.7]) {
  report(`tilt ${tilt.toFixed(2)}, sigma 0.5, with niche`, run(0.5, tilt, true));
}
console.log();
