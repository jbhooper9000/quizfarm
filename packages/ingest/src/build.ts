/**
 * Build an anchor bank from the Jeopardy dump.
 *
 *   node --experimental-strip-types src/build.ts <path-to-tsv> [out.json]
 *
 * Anchors are the measuring instrument, not the quiz. What matters is that
 * each (domain, depth) cell holds a handful of items whose difficulty we
 * trust — coverage of the corpus is irrelevant, and most of it is discarded.
 */
import { writeFileSync } from "node:fs";
import { countCategories, readClues, type Candidate } from "./jeopardy.ts";
import { isValidQuestionDomain } from "../../core/src/domain.ts";
import type { Question } from "../../core/src/types.ts";

const PER_CELL = 6;
const MIN_PER_DOMAIN = 12;

const cellKey = (domain: string, depth: number) => `${domain}@${depth.toFixed(2)}`;

/**
 * Reservoir sampling, so the bank isn't just the first six clues of 1984.
 * Spreading across eras matters: a 1985 clue about "modern technology" has
 * aged in ways that change its difficulty unpredictably.
 */
function reservoir<T>(items: T[], k: number, item: T, seen: number): void {
  if (items.length < k) items.push(item);
  else {
    const j = Math.floor(Math.random() * seen);
    if (j < k) items[j] = item;
  }
}

const path = process.argv[2];
if (!path) {
  console.error("usage: build.ts <combined_season1-42.tsv> [out.json]");
  process.exit(1);
}

const categoryCounts = await countCategories(path);

const cells = new Map<string, Candidate[]>();
const counts = new Map<string, number>();
const byDomain = new Map<string, Candidate[]>();
let scanned = 0;
let kept = 0;

for await (const c of readClues(path, categoryCounts)) {
  scanned++;
  if (!isValidQuestionDomain(c.domain)) continue;
  kept++;

  const key = cellKey(c.domain, c.depth);
  const seen = (counts.get(key) ?? 0) + 1;
  counts.set(key, seen);
  if (!cells.has(key)) cells.set(key, []);
  reservoir(cells.get(key)!, PER_CELL, c, seen);

  if (!byDomain.has(c.domain)) byDomain.set(c.domain, []);
  const pool = byDomain.get(c.domain)!;
  if (pool.length < 400) pool.push(c);
}

// ---------------------------------------------------------------------------
// Distractors, drawn from other answers in the same domain
// ---------------------------------------------------------------------------

/**
 * Same-domain answers make decent distractors, but only if they are the same
 * KIND of thing. Matching on word count alone offered "4" and "35" as
 * alternatives to Richard Nixon, which tells the player the answer by
 * elimination and makes the item useless for measurement.
 *
 * Good enough for anchors. Harvested niche questions deserve better, since
 * there the distractors have to reward reasoning rather than just fill space.
 */
type Shape = "number" | "proper-noun" | "common-noun";

function shapeOf(answer: string): Shape {
  if (/^[\d,.$%\s-]+$/.test(answer)) return "number";
  const words = answer.replace(/^(the|a|an) /i, "").split(/\s+/);
  return words.some((w) => /^[A-Z]/.test(w)) ? "proper-noun" : "common-noun";
}

function distractorsFor(c: Candidate): string[] {
  const pool = byDomain.get(c.domain) ?? [];
  const targetWords = c.answer.split(/\s+/).length;
  const targetShape = shapeOf(c.answer);
  const out: string[] = [];
  const tried = new Set<string>([c.answer.toLowerCase()]);

  for (let attempts = 0; attempts < 400 && out.length < 3; attempts++) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) break;
    const a = pick.answer;
    if (tried.has(a.toLowerCase())) continue;
    if (shapeOf(a) !== targetShape) continue;
    if (Math.abs(a.split(/\s+/).length - targetWords) > 1) continue;
    tried.add(a.toLowerCase());
    out.push(a);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const bank: Question[] = [];
let id = 0;

for (const [key, items] of [...cells].sort()) {
  const domain = key.split("@")[0]!;
  if ((byDomain.get(domain)?.length ?? 0) < MIN_PER_DOMAIN) continue;

  for (const c of items) {
    bank.push({
      id: `jeo-${id++}`,
      prompt: c.prompt,
      answer: { canonical: c.answer, accept: [c.answer], distractors: distractorsFor(c) },
      domain: c.domain,
      depth: { value: c.depth, confidence: 0.7, source: "jeopardy-value" },
      source: { kind: "bank", corpus: "jeopardy" },
      anchor: true,
    });
  }
}

const out = process.argv[3] ?? "anchors.json";
writeFileSync(out, JSON.stringify(bank, null, 2));

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const domains = [...new Set(bank.map((q) => q.domain))].sort();
const depths = [...new Set(bank.map((q) => q.depth.value))].sort((a, b) => a - b);

console.log(`\nscanned ${scanned} usable clues, kept ${kept}`);
console.log(`wrote ${bank.length} anchors across ${domains.length} domains -> ${out}\n`);

console.log(`depth levels available: ${depths.map((d) => d.toFixed(2)).join("  ")}`);
console.log(`range: ${depths[0]?.toFixed(2)} to ${depths[depths.length - 1]?.toFixed(2)}\n`);

const header = depths.map((d) => d.toFixed(1).padStart(4)).join(" ");
console.log(`${"domain".padEnd(28)} ${header}   total`);
for (const d of domains) {
  const row = depths
    .map((dep) => {
      const n = bank.filter((q) => q.domain === d && q.depth.value === dep).length;
      return String(n || "·").padStart(4);
    })
    .join(" ");
  const total = bank.filter((q) => q.domain === d).length;
  console.log(`${d.padEnd(28)} ${row}   ${total}`);
}

const noDistractors = bank.filter((q) => q.answer.distractors.length < 3).length;
console.log(`\nanchors without a full set of distractors: ${noDistractors}`);
