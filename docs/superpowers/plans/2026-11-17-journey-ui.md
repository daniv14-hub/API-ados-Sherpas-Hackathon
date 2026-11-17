# Journey UI Implementation Plan (conversation → video → missions)

> For agentic workers: REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** One smooth journey on localhost: conversation screen (option A) → automatic hand-off to the video (landscape) →
automatic hand-off to a missions screen (portrait), all in the Sherpas sticker look.

**Approved by:** Dani (17/11 ~22:00, overnight autonomous run; team rule D7 satisfied by his explicit order). The design
choices marked "Ruling" below are provisional and must be reviewed by the team.

**Architecture:** Multi-page, no build step. Pages: `/` (conversation, replaces the test bench; old bench kept at `/bench.html`),
`/video.html` (exists), `/missions.html` (new). Smooth hand-off with CSS cross-document view transitions
(`@view-transition { navigation: auto; }`) plus a fade overlay fallback. Server (`agent/server.mjs`) gains `/missions/<case>`
and serves new static files from its fixed map.

**Spec / inputs (binding):** `docs/superpowers/specs/2026-11-17-conversation-screen-design.md`, `prototypes/conversation/index.html`
(option A), `docs/handoff-missions-content.md` (mission content; its §5 is the Johnson content, §7 the content tasks),
`docs/superpowers/specs/2026-11-17-explainer-video-design.md` (video), `assets/brand/tokens.css`, `assets/mascot/sherpy.svg`,
video sticker style in `agent/public/video-shapes.mjs` / `video.html`.

## Global Constraints
- Product/UI/copy in English. Code/comments/commits in English. Secrets only in backend. No new npm dependencies.
- Never invent figures: every number comes from case data (paths in the handoff) or is typed by the family and labelled theirs.
  Dollars rounded to whole dollars. Scores only by exact lookup (D6, handoff R2).
- Conversation and missions: **portrait phone layout first**, also fine on laptop (centered column / spec's laptop layout).
  Video: 16:9 landscape (on a portrait phone show a "rotate your phone" hint, never block playback).
- Same visual language: Sherpas tokens, Poppins, sticker shapes (navy outlines, hard shadows), Sherpy SVG. Accessible
  (prefers-reduced-motion, 44px targets, contrast), no horizontal scroll at 360px.
- Rulings (provisional): Q-CONFIRM = self-declared ("I did it"), said explicitly in the UI; Q-PROGRESS = option C (bar = steps
  done, score shown at checkpoints); life-cover figure: use the FH JSON ($1,166,000 added → $1,616,000), log the PDF conflict;
  M8 (investment mix) is a mission, last, no score; progress persisted in the browser (localStorage) per case; Sherpy lines at
  checkpoints are fixed templates filled with real data (no model, no TTS); missions for cases other than the Johnsons are
  derived generically from `score.top_moves` (title, action, effort, score) + `listAdvice`.
- Do not push, do not merge. Tests: `cd agent && npm test` must stay green.

---
### Task 1: Mission content (handoff §7) — server, no UI
Files: `agent/src/game/advice.mjs`, `agent/src/game/missions.mjs`, `agent/src/game/score.mjs`, `agent/data/missions/daniel-emily-johnson.json`,
tests `agent/test/game-*.test.mjs`. Read `docs/handoff-missions-content.md` fully; follow §3 rules, §5 content verbatim, §7 deliverables.
Interfaces produced:
- `listAdvice(source, caseId) -> [{source:'S1'|'S2'|'S3', field, index, text}]`
- `scoreFor(table, doneMoveTitles) -> number|null` where `table = {base, moves:{title:score_after}, combos:[{moves:[title], score_after}]}`
  (exact set lookup; none done → base; no exact match → null; pure, no deps; also served to the browser)
- `orderMissions(missions, choice) -> missions` (handoff §4)
- `loadMissions(source, caseId, {dir}) -> {caseId, base, table, missions, keepInView, order, source:'handwritten'|'derived'}`; derived for other cases
  from `top_moves` + listAdvice (one mission per top_move with 3 steps learn/act/close built from the move's `action`; unmatched advice
  items listed in `keepInView`; no numbers beyond case data).
- Mission JSON: `{id, title, kind:'individual'|'joint'|'mixed', effort, moveTitle|null, scoreNote|null, facts:[{label, value, fmt:'usd'|'pct'|'text'|'date'|'months', src}], steps:[{id,type:'learn'|'prepare'|'decide'|'act'|'close',owner,title,body,kit|null}], adviceRefs:[...]}`.
Tests (handoff §7.4): fact values equal the JSON at `src` after rounding; every Johnson advice item referenced by ≥1 step; score path 52→57→60→60;
Weah {card, life} = 73; Carter two moves → null; step text has no digits except "401(k)".
Commit `feat(game): mission content, advice listing and exact score lookup`.

### Task 2: Conversation screen (product UI, option A)
Files: move current `agent/public/index.html` → `agent/public/bench.html` (add to server map `/bench.html`); new `agent/public/index.html`
(+ `agent/public/conversation.mjs`, `agent/public/conversation.css` if useful; add to server map). Reuse the voice client logic of the bench
(WebSocket, speech gate, half-duplex, playback) — extract shared logic instead of copying where it is cheap; behaviour must not change.
Build exactly the spec: start screen (Start button, case from `?case=` default `daniel-emily-johnson`, subtle demo case selector from `/config`),
option A call screen (Sherpy in circle, current sentence big, key words blue, turn pill, top bar with End), End = in-page confirm + pause screen with
"Continue with Sherpy" (reconnects; server resumes), error states (mic denied, proxy refused, connection lost) with a retry. No user transcript, no subtitle.
Portrait phone + landscape + laptop layouts. Verify with headless Chrome + fake mic wav (see devlog 17/11: `--no-sandbox`, wav inside the project) and
screenshots at 390×844, 844×390, 1280×800 (look at them). Commit `feat(ui): conversation screen (option A)`.

### Task 3: Journey hand-off (conversation → video → missions)
When `sherpy.conversation_done` arrives: show a calm "Sherpy is putting your video together…" state inside the call screen (Sherpy keeps
animating), poll/await `GET /video/<case>` (200), then fade into `/video.html?case=<id>&flow=1` and autoplay (if the browser blocks sound, show one big
"Watch your video" button, never a dead screen). On video end (flow=1): short "Your plan in missions" beat, fade to `/missions.html?case=<id>`.
Use cross-document view transitions + fade fallback. Without `flow=1` the video page behaves as today (manual replay, no redirect). Video page on a portrait
phone: rotate hint overlay that disappears on landscape. Handle build failure (409/500) with a clear retry. Add tests for pure helpers; verify the full chain in
headless Chrome using the synthetic conversation (`agent/scripts/e2e-conversation.mjs` style, cost ~$0.5, allowed once or twice).
Commit `feat(ui): seamless hand-off conversation -> video -> missions`.

### Task 4: Missions screen
Files: `agent/public/missions.html` (+ `missions.mjs`/css), server route `GET /missions/<case>` (uses `loadMissions`; allow-listed case id; no secrets) and
static map entries incl. `/game-score.mjs`. Portrait-first, sticker style, Sherpy present. Screens: (1) path/overview with progress bar (steps done / total),
score chip (only exact lookups), missions as stacked cards in order (locked/next/done states, effort chip, "keep in view" section at the end);
(2) mission detail: facts (labelled, from case data), steps by type with owner chip (Daniel/Emily/Together), kit (collapsible, copy button for the HR email),
"I did it" per step (self-declared, wording explicit); (3) checkpoint celebration with Sherpy line (template + real data, e.g. new score when an exact
lookup exists, else the plan's own fact) and bar update. State in localStorage (try/catch). Works for all four cases (derived missions for the others).
Verify headless at 390×844 / 360×640 / 1280×800 for Johnson + Carter; look at screenshots. Commit `feat(ui): missions screen`.

### Task 5: Verification, security, docs (controller)
Full `npm test`; e2e chain once; `/security-review` of new routes/pages; devlog, STATUS block, README run steps (+ missions), decisions proposals recorded as
PROVISIONAL rulings in devlog (don't edit decisions.md/open-questions.md); whole-branch review (opus) and fix Critical/Important only.

### Task 6 (only if everything above is done): voice expressiveness
Narration prompt asks for varied rhythm; at most two test builds of the Johnson video; keep the current version unless clearly better. Bump `VERSION`.
