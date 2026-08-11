/**
 * Not a test suite — a readout. Run it to see whether the prediction model
 * actually behaves the way the design says it should.
 *
 *   node --experimental-strip-types src/sanity.ts
 *
 * The four properties being checked are the ones the whole game rests on:
 *
 *   1. Breadth pays off on shallow questions and stops helping as depth rises.
 *   2. A specialist dominates their own niche at depth.
 *   3. Knowledge transfers asymmetrically — down the tree cheaply, up expensively.
 *   4. Multiple choice gives an outsider a real shot where free-text does not.
 *
 * If any of these stop holding after a tuning change, the equaliser will
 * quietly stop working long before anyone notices in play.
 */
import { predict } from "./predict.ts";
import type { DepthEstimate, Format, Profile, Question } from "./types.ts";

const solid: DepthEstimate = { value: 0, confidence: 0.8, source: "hand" };

function question(domain: string, depth: number): Question {
  return {
    id: `q-${domain}-${depth}`,
    prompt: "",
    answer: { canonical: "", accept: [], distractors: ["a", "b", "c"] },
    domain,
    depth: { ...solid, value: depth },
    source: { kind: "bank", corpus: "hand" },
    anchor: true,
  };
}

function player(name: string, breadth: number, domains: [string, number][]): Profile {
  return {
    playerId: name,
    breadth,
    domains: domains.map(([domain, value]) => ({
      domain,
      depth: { ...solid, value },
      evidence: [],
    })),
    ruledOut: [],
    sessionsPlayed: 0,
    updatedAt: new Date().toISOString(),
  };
}

const alice = player("Alice (generalist)", 4.5, []);
const bob = player("Bob (football obsessive)", 2.5, [
  ["sport/football/english/championship", 7],
]);

const pct = (n: number) => `${(n * 100).toFixed(0).padStart(3)}%`;

function row(label: string, q: Question, format: Format) {
  const a = predict(alice, q, format).p;
  const b = predict(bob, q, format).p;
  console.log(
    `  ${label.padEnd(46)} Alice ${pct(a)}   Bob ${pct(b)}   gap ${pct(Math.abs(a - b))}`,
  );
}

console.log("\n1. Breadth pays on shallow questions, not deep ones");
console.log("   (questions in a domain neither player has been measured in)");
for (const d of [2, 4, 6]) {
  row(`science/chemistry @ depth ${d}`, question("science/chemistry", d), "free-text");
}

console.log("\n2. The specialist owns their niche — and only at depth");
for (const d of [2, 4, 6, 7]) {
  row(
    `championship football @ depth ${d}`,
    question("sport/football/english/championship", d),
    "free-text",
  );
}

console.log("\n3. Transfer is asymmetric across the taxonomy (depth 5 throughout)");
for (const dom of [
  "sport/football/english/championship",
  "sport/football/english",
  "sport/football",
  "sport/tennis",
  "sport/rugby",
  "sport/football/spanish",
]) {
  row(dom, question(dom, 5), "free-text");
}

console.log("\n4. Format is a real difficulty lever (depth 7 in Bob's niche)");
const deep = question("sport/football/english/championship", 7);
row("free-text", deep, "free-text");
row("multiple choice", deep, "multiple-choice");
console.log();
