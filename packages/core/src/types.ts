import type { DomainPath } from "./domain.ts";

export type PlayerId = string;
export type QuestionId = string;
export type SessionId = string;

// ---------------------------------------------------------------------------
// Depth
// ---------------------------------------------------------------------------

/**
 * Depth is the single scale that makes this system work, and the reason it
 * has to be defined in one place is that BOTH sides of the core prediction
 * speak it:
 *
 *   - a Question has a depth (how far into a domain you must be to answer it)
 *   - a Profile has a depth per domain (how far into it the player actually is)
 *
 * If those two are not the same scale, they cannot be compared, and nothing
 * downstream works. Every calibration decision exists to keep them commensurable.
 *
 * Note this is NOT global difficulty. A depth-6 question about non-league
 * football is trivial for the right person and impossible for everyone else.
 * Global difficulty averages over exactly the variation we want to exploit.
 *
 * OPERATIONAL DEFINITION, which is what actually makes the scale mean
 * anything: a question of depth d is one that a player of depth d in that
 * domain answers correctly HALF the time. Everything above is prose to help
 * humans author against; this sentence is the calibration target, and it is
 * what anchor items have to be tuned to hit.
 */
export const DEPTH_LEVELS = {
  1: "Anyone who has heard of the topic at all",
  2: "Passive cultural awareness",
  3: "Follows it occasionally",
  4: "Genuine interest, reads about it",
  5: "Enthusiast",
  6: "Deep enthusiast, knows the corners",
  7: "Specialist, knows what other enthusiasts don't",
} as const;

export const MIN_DEPTH = 1;
export const MAX_DEPTH = 7;

/**
 * Where a depth number came from. This matters more than it looks.
 *
 * A depth derived from a Jeopardy dollar value is trustworthy in a way that
 * one inferred from Wikipedia pageviews alone is not, and when a question
 * mis-fires in front of a live room you want to know which signal produced
 * it. Provenance also lets the selector prefer well-grounded questions when
 * the stakes are high.
 */
export type DepthSource =
  | "hand" // authored and labelled by a human
  | "jeopardy-value" // dollar value, normalised for era and round
  | "quizbowl-position" // clue position within a pyramidal question
  | "pageviews" // log Wikipedia pageviews of the answer entity
  | "agent" // the gathering agent's judgement
  | "observed"; // fitted from real player responses — the best signal

export interface DepthEstimate {
  /** Continuous, but interpreted against DEPTH_LEVELS. */
  value: number;
  /** 0–1. Low confidence should make the selector cautious, not exclude. */
  confidence: number;
  source: DepthSource;
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export interface Answer {
  canonical: string;
  /** Alternate spellings and forms accepted for free-text answers. */
  accept: string[];
  /**
   * Plausible wrong answers. Presence of >= 3 is what makes a question
   * askable as multiple choice.
   *
   * These are not filler. Format is the quiet difficulty lever: the same
   * question goes free-text to the player expected to know it and multiple
   * choice to everyone else, and a niche question is only interesting to
   * outsiders if the distractors let them reason their way in.
   */
  distractors: string[];
}

export type QuestionSource =
  | {
      kind: "bank";
      corpus: "jeopardy" | "quizbowl" | "opentdb" | "trivia-api" | "hand";
      externalId?: string;
    }
  | {
      kind: "harvested";
      /** Who it was drawn out of during gathering. */
      contributorId: PlayerId;
      sessionId: SessionId;
      /** Did the contributor confirm the fact is right? Never ask an unconfirmed one. */
      confirmed: boolean;
    };

export interface Question {
  id: QuestionId;
  prompt: string;
  answer: Answer;
  domain: DomainPath;
  depth: DepthEstimate;
  source: QuestionSource;
  /**
   * Usable as a calibration probe during gathering. Anchors need a
   * high-confidence depth, because they are the measuring instrument — you
   * cannot measure a player with a question of unknown difficulty.
   */
  anchor: boolean;
}

export type Format = "free-text" | "multiple-choice";

export function canBeMultipleChoice(q: Question): boolean {
  return q.answer.distractors.length >= 3;
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

/** One probe during gathering. Raw evidence, kept so depth can be refitted later. */
export interface ProbeResult {
  questionId: QuestionId;
  domain: DomainPath;
  askedDepth: number;
  correct: boolean;
  at: string; // ISO 8601
}

export interface DomainKnowledge {
  domain: DomainPath;
  depth: DepthEstimate;
  evidence: ProbeResult[];
}

export interface Profile {
  playerId: PlayerId;

  /**
   * General knowledge, expressed on the SAME 1–7 depth scale: the depth this
   * player effectively has in an arbitrary domain they've never specifically
   * studied.
   *
   * Putting breadth on the depth scale rather than inventing a second scale
   * is what lets prediction treat it as a simple floor. It also encodes the
   * thing the whole game rests on: breadth pays off on shallow questions and
   * stops helping as depth rises.
   */
  breadth: number;

  domains: DomainKnowledge[];

  /**
   * Domains explicitly ruled out during gathering.
   *
   * Negative space is as useful as positive: it keeps a hidden-champion round
   * inside safe territory, since a visible blind spot is as much of a tell as
   * a visible spike.
   */
  ruledOut: DomainPath[];

  /** Profiles persist across sessions and sharpen. Session 5 is far better than session 1. */
  sessionsPlayed: number;
  updatedAt: string; // ISO 8601
}
