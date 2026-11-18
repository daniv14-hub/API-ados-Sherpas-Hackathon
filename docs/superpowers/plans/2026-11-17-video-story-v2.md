# Video Story v2 (roller coaster) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Replace the 5-scene video with the approved 7-scene "roller coaster" story (~2 min at medium detail).

**Architecture:** Same pipeline (facts → scenes → narrate → TTS → player). Server: `facts.mjs` gains the new facts,
`scenes.mjs` plans the 7 scenes with longer template lines, cache `VERSION` 3. Browser: `video-stage.mjs` gets
renderers for the new scene ids; captions show the current sentence only.

**Tech Stack:** unchanged (Node 22 ESM, node:test, plain HTML/CSS/JS).

**Spec:** `docs/superpowers/specs/2026-11-17-explainer-video-design.md`, section "Revision 2" (binding).

## Global Constraints
- Everything in the original plan's Global Constraints still holds (no invented numbers, numbers only through
  placeholders filled from facts, never compute new numbers, English copy, cache must not re-spend).
- Scene ids in order: `dream`, `reality`, `gaps`, `fragility`, `turn`, `act`, `mission`. `fragility` and `gaps` may be
  skipped when the case has no data for them; the others always exist.
- maxWords per scene line: low 30, medium 45, high 60.
- Tone: `dream` warm; `reality`/`gaps`/`fragility` direct, not softened, no fear words ("disaster", "danger"); `turn`
  reassuring ("this has a solution, one step at a time"). Never repeat the family's answers ("you told me…").
- `act` must link each move to the problem shown before it (life cover ↔ fragility; saving more ↔ retirement gap;
  umbrella ↔ protection).

---

### Task 1: Facts and scenes v2 (server)

**Files:** Modify `agent/src/video/facts.mjs`, `agent/src/video/scenes.mjs`, `agent/src/video/build.mjs` (VERSION 3),
`agent/src/video/narrate.mjs` (only if a prompt tweak is needed for the longer lines); tests in
`agent/test/video-facts.test.mjs`, `agent/test/video-scenes.test.mjs`.

**Interfaces — Produces:**
- `Facts` gains: `retirement: { year, ages: { [name]: number } }` (from `fh.case.household[].retirement_age` and the
  retirement chart goal year); `freeCashFlow: number|null` (`key_metrics.cashflowStatement.freeCashflow.total`);
  `cash: { have, months, minMonths, maxMonths }|null` (`ratios.emergencyFund.emergencyFund`, `.emergencyFundMonths`
  numeric only — "+12" → null, `.minRecommendedEFMonths`, `.maxRecommendedEFMonths`); `protection: [{ name, cover,
  shortfall }]` per adult with a shortfall > 0 (client: `ratios.lifeInsurance.clientCoverage` +
  `lifeInsuranceCoverageGapsAndExcess.clientShortfall`; co-client: `coClientCoverage` + `coClientShortfall`; names from
  household client/co-client); `noRetirementSaving: boolean` (every account whose name contains "401(k)" or "IRA"
  has `yearly_contribution_total` 0, and at least one exists); `retirementExtra: number|null`
  (`ratios.retirementSavings.requiredExtraSavings`). Existing fields unchanged.
- `planScenes(facts, profile)` returns the 7 scene ids above with the same `Scene` shape.

- [ ] **Step 1: Failing tests** — Johnson: `retirement.ages` {Daniel: 62, Emily: 60}, year 2044; `freeCashFlow`
  15032.01; `cash` {have 19000, months 1, minMonths 8, maxMonths 9}; `protection` [{Daniel, 250000, 1350000},
  {Emily, 200000, 1000000}]; `noRetirementSaving` true; Weah `cash.months` null ("+12"); Carter `freeCashFlow`
  -8336. Scenes: Johnson medium → ids `dream, reality, gaps, fragility, turn, act, mission`; `dream` template mentions
  college first; `gaps` lists college first for main_goal college, then retirement, then cash (high detail only for
  the third); `fragility` names both people; `act` text links life cover to the shortfall and contains "52" and "60";
  `mission` mentions the main goal's year (2033); no template has digits except "100"; every filled template is
  grounded and within maxWords for all 4 cases × 3 detail levels × 3 styles (extend the existing test); Carter
  (one adult, negative cash flow) builds without throwing and `turn` doesn't mention a free cash flow.
- [ ] **Step 2: Run** `cd agent && node --test test/video-facts.test.mjs test/video-scenes.test.mjs` → FAIL.
- [ ] **Step 3: Implement.** Template copy follows the spec's Revision 2 text. Numbers only via placeholders.
- [ ] **Step 4: Run** focused tests → PASS; `npm test` → green (update older tests that assert the 5-scene list).
- [ ] **Step 5: Commit** `feat(video): roller-coaster story — facts and seven scenes`.

### Task 2: Stage renderers v2 (browser)

**Files:** Modify `agent/public/video-stage.mjs`, `agent/public/video-shapes.mjs`, `agent/public/video.html` (styles,
caption window), `agent/public/video-player.mjs` (captions: current sentence only).

**Interfaces — Consumes:** scene props from Task 1 (`dream` {people, goals, retirement}; `reality` {score, band, colour,
pillars, weakest}; `gaps` {items: [{topic, label, have, haveLabel, gap, gapLabel}] | cash item {have, months,
minMonths, maxMonths} | retirement item {gap, noRetirementSaving}}; `fragility` {protection}; `turn` {freeCashFlow,
riskViews}; `act` as before plus `links`; `mission` {mission, year}). Read `agent/src/video/scenes.mjs` for exact shapes.

- [ ] **Step 1: Implement** renderers: `dream` (warm, goal "postcards" on a timeline with years, Sherpy small),
  `reality` (reuse the score dial, a stamp "Not on track", protection 0/20 stamp), `gaps` (one row per item:
  have-vs-gap bars, cash months bar "1 of 8–9 months"), `fragility` (one card per person: cover bar vs shortfall,
  hatched red), `turn` (relief: Sherpy back, "One step at a time", free cash flow chip, 3 dotted step outlines),
  `act` (existing, with link labels), `mission` (existing + "Back to {year}"). Deterministic from t.
  Captions: show only the sentence being spoken (split `wordTimes` output at sentence ends), max 2 lines.
- [ ] **Step 2: Verify** with the scratchpad fake server (no paid calls), Johnson medium/high and Carter, at 1280×720
  and 844×390; look at every screenshot.
- [ ] **Step 3: Commit** `feat(video): roller-coaster scenes and sentence captions`.

### Task 3: Real build and check (controller)
- [ ] `node --env-file=../.env scripts/build-video.mjs daniel-emily-johnson` → 7 scenes, 0 ungrounded, timing, ~2 min.
- [ ] Play it on `http://localhost:5173/video.html?case=daniel-emily-johnson`; log in devlog; commit.
