# Design

The reasoning behind quizfarm, as distinct from the README's what-it-is.
Written down because most of it was argued out in conversation and would
otherwise be lost.

## The problem

Pub quizzes are won by whoever knows the most things. That's fine as a
measurement and poor as a party game: the outcome is known in advance, and
three of the five people at the table are playing for second.

The goal is a quiz where the result is genuinely uncertain **without being
random**. Nobody wants a quiz where knowing things doesn't matter — that's the
Mario Kart blue shell, and good players hate it. Golf handicaps are the better
model: transparent, derived from your own record, agreed up front, and you
still have to play well on the day.

## Why it's possible

Knowledge clusters. Three axes carry most of the signal:

1. **Cohort** — what you were exposed to between roughly 12 and 22 dominates
   your music, television and sport knowledge.
2. **Geography and culture** — splits sport, politics, brands, spelling.
3. **Subculture and profession** — the sparse deep spikes.

On top of that there is a real general-knowledge factor: people who know a lot
about one domain tend to know somewhat more about all of them. Hence the person
model: `breadth` (one scalar) + sparse `domains` with measured depth.

## Three phases

### 1. Gathering (~90 seconds, all players in parallel, own phones)

An agent interviews each player. It identifies two to four domains, then
**measures** each by probing with calibrated anchors of known difficulty until
they stop getting them right. Binary search: anchor at mid depth, correct means
go harder, wrong means go easier. Three probes gives a usable estimate.

Non-negotiables, each of which was arrived at the hard way:

- **Measure, don't ask.** Claimed depth is worthless; measured depth is a
  handicap you can defend. Simulation puts the accuracy budget at roughly ±0.5
  depth levels, and self-report is nowhere near that.
- **Probes come from the bank, not the model.** The LLM steers conversation and
  reads vague answers charitably; the psychometrics do the measuring. If the
  model invents a question, judges the answer and assigns a difficulty, three
  unreliable steps compound into a number that means nothing to the selector.
- **Chase contradictions.** When measured performance contradicts a claim —
  "you said you barely follow cricket and just named the 2005 Ashes middle
  order" — push. This is the anti-sandbag, and far more robust than trying to
  detect lying from text.
- **Probe greedily against the decision, not the person.** The agent isn't
  writing a biography, it's reducing uncertainty in the selection it's about to
  make. Precision in a domain that won't appear this round is wasted budget.
- **Record negative space.** Domains explicitly ruled out matter as much as
  positive ones: they keep a champion round inside safe territory, since a
  visible blind spot is as much of a tell as a visible spike.
- **Have a personality.** This is the first ninety seconds of a party game with
  friends in a room. If it reads like a form, the energy is dead before
  question one. The repo name is the brief: a research facility politely
  establishing your capabilities.

### 2. Selection

Every player's profile goes into the prediction matrix, and questions are
chosen so the predicted spread lands where the mode wants it.

### 3. Play

Twenty or so questions, host screen plus phones.

## Two difficulty levers

**Depth** is the invisible one, and the load-bearing one. Ask the obsessive
something hard about their own subject and the casual fan something easy about
theirs; both get their moment, neither is visibly handed a freebie.

The alternative — allocating *more* questions to weaker players — is visible,
patronising, and boring for the expert. Depth-pitching is none of those, which
is why hidden-champion mode has to use it exclusively.

Why it works: **generalist advantage lives almost entirely in shallow
questions.** Breadth is precisely the ability to answer the first layer of
anything, and it stops helping fast as you go deeper. "Who won the 1998 World
Cup" is free for everyone; "which two players were sent off in the final" is
not. So the depth dial directly controls how much breadth is worth.

**Format** is the quiet one. Free-text for whoever is expected to know it,
multiple choice for everyone else. The recall/recognition gap is a large
difficulty delta and nearly invisible in play. It's also what stops a niche
question from being a gimme for one player and dead air for the rest — with
options in front of them, outsiders can reason their way in.

## Scoring

One rule, applied to every question: payout scales with **observed** rarity —
how many people in the room actually got it. Only one player: 5×. Half: 2×.
Everyone: 1×. Capped, or a single lucky strike decides the night.

Deliberately no model in the scoring path. A mis-calibrated prediction can
misjudge which questions get asked; it must never hand somebody a windfall.

Two consequences worth noticing:

- Equalisation partly emerges from the rule rather than being imposed.
  Answering a question in your own specialist subject is worth almost nothing;
  knowing one weird thing outside your patch can take a round. The generalist
  grazing everyone's domains scores steadily but rarely big.
- **There is no "super question" category.** Bespoke niche questions pay out
  big more often, but they aren't a labelled type — just questions that turned
  out to be rare. Nothing to announce, nothing to conceal.

## Game modes

Voted on at the start; coin flip breaks ties.

### Fair mode

Predicted scores flattened across everyone, every round.

### Hidden champion

One player is quietly favoured. They may reveal it afterwards or not.

Design constraints, all of which fall out rather than being chosen:

- **Draw randomly without replacement across a session.** Five rounds, five
  players, everyone gets exactly one round they're favoured in. That's the same
  equalisation as fair mode delivered as drama instead of as a levelling tax —
  being handicapped up feels like pity, being secretly crowned feels like luck.
- **Advantage via depth-pitching only.** Six football questions and everyone
  knows it's Bob's round. Keep topics normal and shared; set depth where the
  champion clears and others don't.
- **Keep the whole round inside the champion's covered domains.** A visible
  blind spot is as much of a tell as a visible spike.
- **Target ~42% win probability in a four-player game**, not the 55–60% first
  assumed. At 56% the champion wins more often than everyone else combined and
  the hidden role is solvable by glancing at the scoreboard. The uncertainty
  *is* the fog.
- Champion loses anyway sometimes. Good — makes the reveal funnier.

Optional upgrade: everyone secretly guesses the champion at the end. Champion
scores if fewer than half get it. Sharpens across a session as players work out
who hasn't had their turn.

### Topic scope

Use a **draft, not a vote**: each player names one category, the round draws
from all of them. A 3–2 vote means two people have a bad round, which is the
exact thing being designed out. A draft is faster, produces no losers, and
feeds the per-player structure anyway.

## Harvesting niche questions

Simulation promoted this from flourish to prerequisite: **selection can only
exploit an advantage that exists.** A player with no isolated domain cannot be
made the favourite at any tilt. So every player needs territory, and if
measurement doesn't find it, the harvest has to create it.

### The player supplies the fact, the model edits it

Generating a question inside someone's niche is the worst case for an LLM —
long-tail by definition, and the one person who'd catch the error is holding a
phone three feet away. Inverting it puts each side on the part it's good at:
people know their own niche, models are excellent editors.

### Extract through enthusiasm, never by asking for a question

People write bad quiz questions, and the request announces itself. Framings
that work:

- *"If someone claimed to be into this, what would you ask to catch them out?"*
  — asks for a discriminating question while sounding like banter, and the
  framing produces a better one than a direct request would.
- *"What do outsiders always get wrong about it?"* — misconceptions are exactly
  the plausible-but-wrong answers needed for distractors. The hardest part of
  authoring multiple choice, handed over by the person best placed to know.
- *"What's a fact about this that sounds made up but isn't?"*

The camouflage is free: this is indistinguishable from depth probing. The
player experiences "it got interested in my thing", which is flattering rather
than extractive.

### Selection and concealment

- **Harvest from everyone, select later.** Uniform treatment carries no signal,
  and it decouples from the timing problem — isolation needs the whole room's
  profiles, but gathering runs in parallel.
- **Harvest more than you use.** Six candidates, two appear.
- **Transform before use.** Don't reuse the player's phrasing; pull on an
  adjacent detail where possible.
- Three gates decide what gets asked: **isolation** (computed —
  `max(depth) − second_max(depth)` per domain), **engagement** (judged live —
  a terse player is a bad source however deep they measure), and **question
  quality** (post-harvest — one unambiguous answer, three distractors that
  reward reasoning). Only the middle one happens in front of the player.

### Known wrinkle

Under rarity scoring, supplying material is mildly against your interest —
you'll get your own question at 1× while someone else takes 5× off it. Players
can't strategise against what they don't know is happening, but a group playing
weekly might eventually smell it. Cheap insurance if so: a quiet end-of-session
bonus for material that stumped the room.

## Open design questions

- **Era as a facet.** Era cross-cuts every domain and is the strongest single
  predictor of what someone knows, so it does not belong in a strict hierarchy.
  A shallow tree plus one era facet is probably right. Unresolved, and better
  resolved before the bank is tagged at scale.
- **Real specialists may exceed the synthetic ones.** The archetypes top out
  around depth 6.8. If real obsessives run deeper, anchor-ceiling saturation
  bites harder than measured.
- **Transfer constants are fitted to invented targets.** `0.9` toward the root,
  `0.78` away, `0.45` across root categories — all fitted to six numbers made
  up about one imaginary football obsessive. The structural claim (top-level
  categories are filing labels, not domains) is solid; the constants are
  placeholders until real responses exist.
