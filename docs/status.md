# Status

Point-in-time snapshot. `docs/design.md` is the durable part; this file goes
stale.

## Where things are

Four commits on `claude/web-quiz-concept-rqb1fh`. Typecheck clean, all
readouts run.

| commit | what |
| --- | --- |
| `4e70ee5` | Core schema — depth scale, Question/Profile, prediction model |
| `15cdce9` | Transfer fix — damp cross-root-category leakage |
| `6c6b25a` | Simulator and selector, tuned against synthetic players |
| `41b096f` | Anchor bank ingest from the Jeopardy corpus |

### Built and working

- **Prediction model.** `predict(profile, question, format) → {p, confidence}`.
  Rasch-flavoured logistic on the depth gap with a guessing floor for multiple
  choice. Everything else in the system is a policy over this number.
- **Taxonomy with asymmetric transfer.** Knowing a leaf implies the branch;
  knowing the branch doesn't imply the leaf. Questions may not be tagged at the
  top level (`isValidQuestionDomain`).
- **Selector.** Random, equalised (greedy on predicted spread), and champion
  (tilt fraction favouring one player, remainder equalised).
- **Simulator.** Synthetic archetypes, seeded RNG, rarity scoring. Critically:
  the selector sees only *estimated* profiles while answers come from *true*
  ones, so profiling error is measurable rather than assumed away.
- **Ingest.** 544k Jeopardy clues → ~3,400 anchors across 59 domains in ~10s.

### Findings that changed the design

1. **Equalisation works.** Win-rate spread 41.4% → 3.9% with perfect profiles.
2. **Accuracy budget: ±0.5 depth levels.** At 1.0 half the benefit is gone; at
   2.0 the selector is no better than random. This is the gathering agent's
   spec.
3. **Selection cannot manufacture an advantage.** A player with no isolated
   domain peaks at 25.9% even at full tilt. Give them one and tilt 0.5 reaches
   41.9%. Harvested niche questions are therefore a prerequisite for champion
   mode, not a garnish.
4. **Win target revised 55–60% → ~42%** for four players.
5. **The Jeopardy-only bank is usable.** It spans depth 2.80–5.16 so deeper
   players saturate, but that costs spread 8.2% → 11.2% against a 41.3% random
   floor. A five-point tilt toward specialists, not a failure.

Three predictions were overturned by experiment this session (dropping
nationality from the taxonomy, faster up-decay, and the anchor ceiling being
disqualifying). Worth continuing to run things rather than reason about them.

## Blocked

- **Push.** `git push` returns 403 — `jbhooper9000/quizfarm` was never added to
  the session's authorized repo set. The `add_repo` approval prompt never
  reached the user across several attempts. Work has been handed over as git
  bundles instead. **To resume pushing: get `add_repo` approved, or clone the
  bundle locally and push from there.**
- **Network.** The org egress policy blocks `opentdb.com` and `wikimedia.org`.
  `raw.githubusercontent.com` is allowed, which is why Jeopardy ingest was
  possible. Pageview enrichment and the OpenTDB adapter can only be built
  somewhere with open egress.

## Next steps, in priority order

1. **Gathering agent.** Now unblocked — anchors exist to probe with. Testable
   standalone in a terminal, no UI needed. Must hit ±0.5 depth accuracy and
   must find territory for every player.
2. **Pageview enrichment.** Extends depth *below* 2.8 and gives within-domain
   ordering to corpora with no difficulty labels. Needs open network.
3. **Quizbowl ingest.** The real fix for the depth ceiling — pyramidal clues
   are deliberately obscure at the top, which is exactly the range Jeopardy
   can't reach.
4. **Multiplayer shell.** Host screen, phone clients, room codes, websockets.
   Well-trodden and deliberately last; all the uncertain decisions are already
   made and tested.
5. **Modes, draft, reveal, guess-the-champion.**

## Environment notes

- **Node 22 runs TypeScript directly** via `--experimental-strip-types`. No
  build step, which keeps the experiment loop fast.
- **Relative imports use `.ts` extensions**, with `allowImportingTsExtensions`
  and `rewriteRelativeImportExtensions` in tsconfig. Node's type stripping does
  not rewrite `.js` → `.ts`, so `.js` imports fail at runtime.
- **npm workspaces**, `node_modules` hoisted to the root. `npm install` at the
  root, not in a package.
- Ingest imports core by relative path (`../../core/src/...`) rather than by
  package name, because resolving a workspace package whose `main` is a `.ts`
  file doesn't work under type stripping.

```bash
npm install
npm run typecheck
npm run sanity     # model behaviour readout
npm run tune       # selector tuning, ~2.5 min
```

## Suggested stack for the parts not yet built

TypeScript throughout — the profile object crosses server, host screen and
phone. Vite + React for both clients, Fastify + Socket.IO for the server,
SQLite via Drizzle. Anthropic SDK server-side for the agent.

Avoid Next.js: awkward websocket ergonomics, and there are two genuinely
different clients (a TV-ish host display and a phone controller) which fights
the single-app model. Cloudflare Durable Objects would suit room-based state if
cheap hosting matters later, but local-first plain Node is easier to debug.
