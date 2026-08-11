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

## Repo layout

```
packages/core/src/
  domain.ts    taxonomy paths and asymmetric knowledge transfer
  types.ts     Depth, Question, Profile — the shared vocabulary
  predict.ts   the core probability model
  sanity.ts    readout proving the model behaves as designed
```

```bash
node --experimental-strip-types packages/core/src/sanity.ts
```
