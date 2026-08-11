import type { DomainPath } from "../../core/src/domain.ts";

/**
 * Mapping Jeopardy's 58,000 freeform category strings onto our taxonomy.
 *
 * The instinct is to chase coverage. Resist it. An anchor bank needs a few
 * hundred well-placed items, and the corpus has half a million clues, so
 * throwing away everything we aren't sure about costs nothing and buys
 * precision — which is the only property that matters in a measuring
 * instrument.
 *
 * Rules are ordered: the first match wins, so specific patterns come before
 * general ones. Anything unmatched is dropped.
 *
 * Every loose keyword here has been paid for once already. An early version
 * mapped a bare \bSTARS?\b to astronomy and produced an "astronomy" anchor
 * about Led Zeppelin, plus another whose answer was "starboard".
 */

export interface CategoryRule {
  pattern: RegExp;
  domain: DomainPath;
}

export const RULES: CategoryRule[] = [
  // --- Disambiguation, before anything else can claim these ----------------
  { pattern: /SPORTS? STARS/, domain: "sport/general" },
  { pattern: /(MOVIE|FILM|SCREEN) STARS/, domain: "screen/film" },
  { pattern: /(TV|TELEVISION) STARS/, domain: "screen/tv" },
  { pattern: /STARS? (&|AND) CONSTELLATION|STARGAZ/, domain: "science/astronomy" },
  { pattern: /STAR TREK|STAR WARS/, domain: "screen/film" },
  { pattern: /BODIES OF WATER/, domain: "geography/water" },

  // --- Sport (specific before generic) -------------------------------------
  { pattern: /\bBASEBALL\b|\bMLB\b|WORLD SERIES/, domain: "sport/baseball" },
  { pattern: /\bBASKETBALL\b|\bNBA\b/, domain: "sport/basketball" },
  { pattern: /\bNFL\b|SUPER BOWL|\bGRIDIRON\b/, domain: "sport/american-football" },
  { pattern: /\bSOCCER\b|WORLD CUP|\bFIFA\b/, domain: "sport/football" },
  { pattern: /\bHOCKEY\b|\bNHL\b|STANLEY CUP/, domain: "sport/hockey" },
  { pattern: /\bGOLF\b/, domain: "sport/golf" },
  { pattern: /\bTENNIS\b|WIMBLEDON/, domain: "sport/tennis" },
  { pattern: /\bBOXING\b/, domain: "sport/boxing" },
  { pattern: /OLYMPIC/, domain: "sport/olympics" },
  { pattern: /\bSPORTS?\b|\bATHLETES?\b/, domain: "sport/general" },

  // --- Science -------------------------------------------------------------
  {
    pattern: /\bASTRONOM|\bPLANETS?\b|SOLAR SYSTEM|CONSTELLATION|OUTER SPACE|SPACE (PROGRAM|TRAVEL|FLIGHT)|\bNASA\b|\bCOMETS?\b|\bGALAX/,
    domain: "science/astronomy",
  },
  { pattern: /\bCHEMIST|PERIODIC TABLE|THE ELEMENTS|CHEMICAL ELEMENT|\bMOLECULE/, domain: "science/chemistry" },
  { pattern: /\bPHYSIC/, domain: "science/physics" },
  { pattern: /\bANATOM|\bMEDIC|\bDISEASE|HUMAN BODY|\bHEALTH\b|\bSURGER/, domain: "science/medicine" },
  { pattern: /\bBIOLOG|\bGENETIC|\bCELLS?\b/, domain: "science/biology" },
  { pattern: /\bGEOLOG|MINERAL|VOLCAN|\bEARTHQUAKE/, domain: "science/geology" },
  { pattern: /\bMATHEMATIC|\bGEOMETRY\b|\bALGEBRA\b/, domain: "science/mathematics" },
  { pattern: /\bTECHNOLOG|\bCOMPUTERS?\b|\bINTERNET\b/, domain: "science/technology" },
  { pattern: /\bSCIENCE\b|\bSCIENTIF|\bINVENTIONS?\b|\bINVENTORS?\b/, domain: "science/general" },

  // --- Nature --------------------------------------------------------------
  { pattern: /\bBIRDS?\b|ORNITHOL/, domain: "nature/birds" },
  { pattern: /\bANIMALS?\b|\bMAMMALS?\b|\bINSECTS?\b|\bREPTILE|\bFISH\b/, domain: "nature/animals" },
  { pattern: /\bPLANTS?\b|\bFLOWERS?\b|\bTREES?\b|\bBOTAN/, domain: "nature/plants" },

  // --- History -------------------------------------------------------------
  { pattern: /CIVIL WAR/, domain: "history/us-civil-war" },
  { pattern: /WORLD WAR|\bWWI\b|\bWWII\b/, domain: "history/world-wars" },
  { pattern: /\bPRESIDENTS?\b|\bPRESIDENTIAL\b|FIRST LAD/, domain: "history/us-presidents" },
  { pattern: /\bANCIENT\b|ANCIENT ROME|\bROMAN EMPIRE\b|ANCIENT GREE|\bEGYPT/, domain: "history/ancient" },
  { pattern: /MEDIEVAL|MIDDLE AGES|KINGS & QUEENS|\bROYALTY\b|ROYAL FAMILY|\bMONARCH/, domain: "history/monarchy" },
  { pattern: /AMERICAN HISTORY|U\.S\. HISTORY|\bUS HISTORY/, domain: "history/us" },
  { pattern: /WORLD HISTORY|EUROPEAN HISTORY|BRITISH HISTORY/, domain: "history/world" },
  { pattern: /\bHISTOR/, domain: "history/general" },

  // --- Geography -----------------------------------------------------------
  { pattern: /WORLD CAPITAL|\bCAPITALS?\b/, domain: "geography/capitals" },
  { pattern: /U\.S\. CITIES|AMERICAN CITIES/, domain: "geography/us-cities" },
  { pattern: /\bCITIES\b/, domain: "geography/world-cities" },
  { pattern: /U\.S\. GEOGRAPHY|U\.S\. STATES|THE STATES\b|STATE (CAPITALS|NICKNAMES|BIRDS|FLAGS)/, domain: "geography/us" },
  { pattern: /\bRIVERS?\b|\bLAKES?\b|\bOCEANS?\b|\bSEAS\b/, domain: "geography/water" },
  { pattern: /\bMOUNTAINS?\b|\bISLANDS?\b/, domain: "geography/landforms" },
  { pattern: /\bCOUNTRIES\b|\bNATIONS\b|\bGEOGRAPH|\bMAPS?\b/, domain: "geography/world" },

  // --- Books and language --------------------------------------------------
  { pattern: /SHAKESPEARE/, domain: "literature/shakespeare" },
  { pattern: /\bPOETS?\b|\bPOETRY\b|\bPOEMS?\b/, domain: "literature/poetry" },
  { pattern: /\bAUTHORS?\b|\bNOVELS?\b|\bNOVELIST|\bBOOKS?\b|\bLITERAT|\bFICTION\b/, domain: "literature/general" },
  { pattern: /WORD ORIGIN|\bETYMOLOG/, domain: "language/etymology" },
  { pattern: /\bLANGUAGES?\b|\bFRENCH\b|\bSPANISH\b|\bLATIN\b/, domain: "language/foreign" },

  // --- Screen and stage ----------------------------------------------------
  { pattern: /\bOPERA\b/, domain: "music/opera" },
  { pattern: /\bBROADWAY\b|\bMUSICALS?\b|\bTHEATERS?\b|\bTHEATRE/, domain: "screen/stage" },
  { pattern: /\bTELEVISION\b|\bTV\b|\bSITCOM/, domain: "screen/tv" },
  { pattern: /\bMOVIES?\b|\bFILMS?\b|\bCINEMA\b|\bOSCARS?\b|\bHOLLYWOOD\b|\bACTORS?\b|\bACTRESS/, domain: "screen/film" },

  // --- Music ---------------------------------------------------------------
  { pattern: /\bCLASSICAL MUSIC\b|\bCOMPOSERS?\b|\bSYMPHON/, domain: "music/classical" },
  { pattern: /\bJAZZ\b/, domain: "music/jazz" },
  { pattern: /ROCK (&|'N|AND) ROLL|ROCK MUSIC|ROCK BANDS?|\bPOP MUSIC\b|POPULAR MUSIC/, domain: "music/popular" },
  { pattern: /\bMUSIC\b|\bSONGS?\b|\bSINGERS?\b/, domain: "music/general" },

  // --- Belief --------------------------------------------------------------
  { pattern: /\bBIBLE\b|\bBIBLICAL\b/, domain: "belief/bible" },
  { pattern: /\bMYTHOLOG|\bMYTHS?\b/, domain: "belief/mythology" },
  { pattern: /\bRELIGION\b|\bRELIGIOUS\b|\bSAINTS?\b/, domain: "belief/religion" },

  // --- Art, food, business, politics ---------------------------------------
  { pattern: /\bARCHITECT/, domain: "art/architecture" },
  { pattern: /\bPAINTERS?\b|\bPAINTINGS?\b|\bARTISTS?\b|\bART\b/, domain: "art/fine-art" },
  { pattern: /\bWINE\b|\bBEER\b|\bCOCKTAIL|POTENT POTABLES/, domain: "food/drink" },
  { pattern: /\bFOOD\b|\bCOOK|\bCUISINE\b|\bDINING\b/, domain: "food/cooking" },
  { pattern: /\bBUSINESS\b|\bECONOM|\bBRANDS?\b|\bCOMPANIES\b|\bCOMPANY\b|\bCORPORAT/, domain: "business/general" },
  { pattern: /\bPOLITIC|\bGOVERNMENT\b|SUPREME COURT|\bCONGRESS\b/, domain: "politics/general" },
];

/**
 * Categories that are wordplay dressed as knowledge. A "BEFORE & AFTER" clue
 * measures puzzle-solving, not depth in a domain, so it can't calibrate one.
 */
const PUZZLE =
  /BEFORE & AFTER|ANAGRAM|RHYME|WORD PLAY|WORDPLAY|SPELLING|CROSSWORD|HODGEPODGE|POTPOURRI|\bMISCELLAN|COMMON BOND|STUPID ANSWER/;

export function mapCategory(raw: string): DomainPath | null {
  const c = raw.toUpperCase();
  if (PUZZLE.test(c)) return null;
  for (const r of RULES) if (r.pattern.test(c)) return r.domain;
  return null;
}

/**
 * Second gate: only trust categories the show has used repeatedly.
 *
 * A category appearing hundreds of times ("AMERICAN HISTORY") is a literal
 * label. A one-off is usually a pun, and a pun that happens to contain a
 * keyword is precisely how nonsense enters the bank. Since we need hundreds
 * of anchors from a corpus of half a million clues, demanding repetition is
 * nearly free.
 */
export const MIN_CATEGORY_USES = 20;
