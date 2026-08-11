import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { mapCategory, MIN_CATEGORY_USES } from "./categories.ts";
import { depthFromBoard } from "./value-depth.ts";
import type { DomainPath } from "../../core/src/domain.ts";

/**
 * Streaming reader for the J!-Archive dump (jwolle1/jeopardy_clue_dataset,
 * combined_season1-42.tsv — 544k rows, 77MB).
 *
 * Columns: round, clue_value, daily_double_value, category, comments, answer,
 * question, air_date, notes.
 *
 * NOTE THE INVERSION. Jeopardy's "answer" is the clue read to contestants,
 * and its "question" is the correct response. So their answer is our prompt,
 * and their question is our answer. Getting this backwards produces a bank
 * that looks plausible and is entirely useless.
 */

export interface Candidate {
  prompt: string;
  answer: string;
  domain: DomainPath;
  depth: number;
  category: string;
  airDate: string;
}

/** Clues that lean on something the player can't see or hear from us. */
const MEDIA = /seen here|heard here|shown here|pictured|this video|audio clue|\[|<a /i;

/** Clues whose answer is a whole phrase make poor free-text targets. */
function answerIsUsable(a: string): boolean {
  const words = a.trim().split(/\s+/).length;
  return words >= 1 && words <= 4 && a.length <= 40;
}

function promptIsUsable(p: string): boolean {
  return p.length >= 25 && p.length <= 230 && !MEDIA.test(p);
}

/** The dump escapes embedded quotes, which would otherwise reach the screen. */
function unescape(s: string): string {
  return s.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, "\\").trim();
}

async function eachLine(path: string, fn: (fields: string[]) => void): Promise<void> {
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (first) {
      first = false;
      continue;
    }
    const f = line.split("\t");
    if (f.length >= 8) fn(f);
  }
}

/** First pass: how often each category is used, for the repetition gate. */
export async function countCategories(path: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  await eachLine(path, (f) => {
    const c = (f[3] ?? "").toUpperCase();
    counts.set(c, (counts.get(c) ?? 0) + 1);
  });
  return counts;
}

export async function* readClues(
  path: string,
  categoryCounts?: Map<string, number>,
): AsyncGenerator<Candidate> {
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let first = true;

  for await (const line of rl) {
    if (first) {
      first = false;
      continue;
    }
    const f = line.split("\t");
    if (f.length < 8) continue;

    const round = Number(f[0]);
    if (round !== 1 && round !== 2 && round !== 3) continue;

    const rawCategory = f[3] ?? "";
    if (categoryCounts && (categoryCounts.get(rawCategory.toUpperCase()) ?? 0) < MIN_CATEGORY_USES) {
      continue;
    }

    const domain = mapCategory(rawCategory);
    if (!domain) continue;

    const depth = depthFromBoard({
      round: round as 1 | 2 | 3,
      clueValue: Number(f[1]),
      airDate: f[7] ?? "",
    });
    if (depth === null) continue;

    const prompt = unescape(f[5] ?? "");
    const answer = unescape(f[6] ?? "");
    if (!promptIsUsable(prompt) || !answerIsUsable(answer)) continue;

    yield { prompt, answer, domain, depth, category: rawCategory, airDate: f[7] ?? "" };
  }
}
