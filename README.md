# quizfarm

A party quiz for phones in a room. It interviews everybody first.

Most quizzes are won by whoever knows the most things. This one tries to make
the result genuinely uncertain without making it random — by working out what
each player actually knows, and then pitching questions so that knowing a lot
about one narrow thing is worth as much as knowing a little about everything.

## How it works

**1. Gathering.** Every player is interviewed on their own phone by an agent,
in parallel, for about ninety seconds. It identifies two to four domains they
claim, then *measures* each one by probing with calibrated questions of known
difficulty until they stop getting them right. Claimed depth is worthless;
measured depth is a handicap you can defend. If it finds something genuinely
niche, it draws material out of them along the way.

**2. Selection.** With every player's profile in hand, questions are chosen so
the predicted spread of scores lands where the chosen game mode wants it.

**3. Play.** Twenty or so questions on the big screen, answers on phones.

## The one idea everything hangs off

```ts
predict(profile, question, format) -> { p, confidence }
```

The probability that this player gets this question right. Every feature is a
policy over that one number:

- **Equalising** a round is balancing sums of it across players.
- **Champion mode** is pushing one player's sum up without moving the topics.
- **Depth-pitching** is finding questions where it's high for one player and
  low for everyone else.
- **Live adaptation** is refitting it after five questions of real data.

Designing the schema was mostly a matter of asking what the minimum
information is that makes that function computable. Anything that doesn't feed
it is UI state or logging and can be designed later with much less care.

## Depth, and why it isn't difficulty

Free trivia corpora label **global difficulty** — easy/medium/hard for the
population at large. That's the wrong axis. It averages over exactly the
variation this game exists to exploit: a question can be globally hard because
almost nobody follows non-league football, while being trivial for someone who
does.

So questions and profiles both carry **depth**, on one shared 1–7 scale, with
an operational definition that makes it measurable:

> A question of depth _d_ is one that a player of depth _d_ in that domain
> answers correctly half the time.

Both sides speaking the same scale is the constraint that makes everything
else composable, and it's why calibration matters so much.

## Two levers, one visible

**Depth** is the invisible lever. Ask the expert something hard about their own
subject and the casual fan something easy about theirs, and both get their
moment without anyone being obviously handed a freebie. Allocating *more*
questions to weaker players is visible and patronising; pitching depth is
neither.

**Format** is the quiet one. The same question goes free-text to the player
expected to know it and multiple choice to everyone else. The recall/recognition
gap is a large difficulty delta and nearly invisible in play.

## Scoring

Payout scales with **observed** rarity, not predicted — how many people in the
room actually got it. Only one player: 5×. Half the room: 2×. Everyone: 1×.

No model in the scoring path, so a mis-calibrated prediction can't hand
somebody a windfall. And the equalisation falls out of the rule rather than
being imposed: answering a question in your own specialist subject is worth
almost nothing, while knowing one weird thing outside your patch can take a
round. The generalist grazing everyone's domains scores steadily but rarely
big, because they're rarely the only one.

There is deliberately no "super question" category. One rule applies to every
question, and some of them just happen to be rare.

## Question sources

Two tiers, doing different jobs.

**The calibrated bank** is the measuring instrument — anchor items with
trustworthy depth, used for probing during gathering. You cannot measure a
player with a question of unknown difficulty. Built from free corpora:

| Source | What it gives | Licence |
| --- | --- | --- |
| [J!-Archive / Jeopardy](https://github.com/jwolle1/jeopardy_clue_dataset) | 538k clues; **dollar value** is within-category difficulty calibrated by professionals | fan scrape, personal use |
| [QANTA / quizbowl](https://qanta-org.github.io/) | Pyramidal questions — clue sequences ordered obscure→obvious. Depth ladders, pre-built | research use |
| [Open Trivia DB](https://opentdb.com/api_config.php) | ~24 categories, no key | CC BY-SA 4.0 |
| [The Trivia API](https://the-trivia-api.com/) | Sub-category tags | CC BY-NC 4.0 |

None of them carry depth in our sense, but it can be derived: Jeopardy dollar
value (normalised for era and round), quizbowl clue position, and log Wikipedia
pageviews of the answer entity as an obscurity proxy. That turns authoring an
anchor bank into reviewing a sorted list, which is a much smaller job.

Jeopardy skews American and historical — fine for calibration probes, less so
for content.

**Harvested questions** are the actual fun: niche material drawn out of players
during gathering, edited by the agent, verified by the contributor. The player
supplies the fact, the model shapes the question — long-tail niches are exactly
where models confabulate and exactly where the one person who'd notice is
sitting in the room.

## What simulation has settled so far

Synthetic players, 20 questions, 3000 rounds per configuration. Crucially the
selector only ever sees *estimated* profiles while answers are generated from
the *true* ones — otherwise you're just checking arithmetic against itself.

**Equalisation works, and the problem it solves is real.**

```
random selection      gene 50.6%  spec  9.2%  enth 26.5%  casu  9.6%   spread 41.4%
equalised selection   gene 25.4%  spec 22.2%  enth 24.9%  casu 21.6%   spread  3.9%
```

**The gathering agent needs to measure depth to within about half a level.**
Sigma is measurement error in depth units; recovery is how much of the gap
between random and perfect equalisation survives.

| sigma | spread | recovered |
| --- | --- | --- |
| 0.0 | 3.9% | 100% |
| 0.5 | 10.0% | 84% |
| 1.0 | 25.0% | 44% |
| 1.5 | 34.6% | 18% |
| 2.0 | 40.3% | 3% |

At sigma 2.0 the selector may as well be picking at random. This is the
argument for probing with calibrated anchors rather than asking people to
rate themselves — self-report is nowhere near ±0.5.

**Selection cannot manufacture an advantage that isn't there.** Champion mode
tops out at 25.9% for a player with no isolated domain, even with every
question tilted their way — a "specialty" at depth 4.2 is shallower than a
generalist's breadth of 5.0, so no question in the pool is theirs. Give the
same player one genuinely isolated domain and tilt 0.5 reaches 41.9%.

So every player needs territory, and finding or creating it is the gathering
agent's job. The harvested niche questions aren't a flourish — champion mode
does not function without them.

**A Jeopardy-only anchor bank is good enough to start.** The bank it produces
spans depth 2.80–5.16, so anyone deeper saturates — every probe comes back
correct and the search runs off the top of the scale. That sounded fatal given
the ±0.5 budget, but measuring it says otherwise:

```
no ceiling (best case)      spread  8.2%
ceiling 5.16 (Jeopardy)     spread 11.2%     spec 27.1%, casu 15.9%
ceiling 6.0                 spread  7.7%
random selection (floor)    spread 41.3%
```

Saturation doesn't collapse the equaliser, it *tilts* it — under-rating deep
players by about five points in their favour, because the selector hands them
questions it wrongly believes are hard for them. Ship with it; adding deeper
anchors is a refinement, not a blocker.

**The 55–60% target was wrong.** In a four-player game ~42% is the better
aim: a clear favourite at 1.7× chance who still loses most rounds to somebody.
A champion winning 56% of the time makes the hidden role trivially solvable by
reading the scoreboard.

## Repo layout

```
packages/core/src/
  domain.ts       taxonomy paths and asymmetric knowledge transfer
  types.ts        Depth, Question, Profile — the shared vocabulary
  predict.ts      the core probability model
  select.ts       policies that turn predictions into a round
  simulate.ts     synthetic players and round play
  sanity.ts       readout proving the model behaves as designed
  experiments/    tuning, champion diagnosis, anchor ceiling

packages/ingest/src/
  value-depth.ts  Jeopardy board position -> depth estimate
  categories.ts   58k freeform categories -> our taxonomy
  jeopardy.ts     streaming TSV reader with quality filters
  build.ts        assembles and reports on the anchor bank
```

```bash
cd packages/core && npm install
npm run sanity     # model behaviour readout
npm run tune       # selector tuning (~2.5 min)
```

## Building the anchor bank

The Jeopardy dump is a fan scrape of copyrighted broadcast content, so it is
**not committed here** — fetch it yourself and generate locally.

```bash
curl -sSLO https://raw.githubusercontent.com/jwolle1/jeopardy_clue_dataset/main/combined_season1-42.tsv
cd packages/ingest
node --experimental-strip-types src/build.ts ../../combined_season1-42.tsv anchors.json
```

544k clues in, ~3,400 anchors out across 59 domains, in about ten seconds.
Two gates do the filtering, both biased hard toward precision because
coverage is irrelevant — we need hundreds of anchors and the corpus has half a
million clues:

1. **Keyword rules** over category text, ordered specific-first. Every loose
   keyword has been paid for once: a bare `\bSTARS?\b` mapped to astronomy
   produced an "astronomy" anchor about Led Zeppelin and another whose answer
   was "starboard". In this corpus `STARS` nearly always means celebrities.
2. **Repetition.** Only categories the show has used 20+ times are trusted. A
   frequently-reused category is a literal label; a one-off is usually a pun,
   and a pun containing a keyword is precisely how nonsense enters the bank.

Distractors are sampled from other answers in the same domain, matched on
shape (number / proper noun / common noun) and length. Matching length alone
offered "4" and "35" as alternatives to Richard Nixon.
