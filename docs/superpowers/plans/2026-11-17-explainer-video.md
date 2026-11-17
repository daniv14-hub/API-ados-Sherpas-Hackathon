# Explainer Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the conversation, the family watches a ~1-minute, 16:9, animated explainer of their plan, narrated in
Sherpy's ElevenLabs voice, built from the case data and their conversation profile.

**Architecture:** Server side (`agent/src/video/`): pure modules turn case data + profile into five scenes (facts →
scenes with template lines → narration by `gpt-5-mini` with number placeholders → grounding check), then one TTS clip
per scene; the result is cached in `data/videos/`. Browser side: `video.html` plays the clips back to back on a 16:9
stage and drives every animation from the audio clock. No new dependencies.

**Tech Stack:** Node 22 ESM, `node:test`, plain HTML/CSS/JS (Web Animations), proxy `gpt-5-mini` (chat completions)
and `eleven-flash-v2.5` (`POST /v1/audio/speech`), Sherpas MCP via the existing `agent/src/case-source.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-17-explainer-video-design.md` (approved 17/11). Decisions D5, D6, D10, D12,
D14, D15 in `docs/decisions.md`.

## Global Constraints

- **No invented numbers.** Every figure on screen or spoken is a value from the case data, formatted by code. The LLM
  never writes digits: a model line containing a digit is rejected; filled lines must pass `isGrounded`
  (`agent/src/numbers.mjs`) against `caseNumbers(fh, ia, persona)`.
- Never add numbers to make a new one (no "need = have + gap"). Show the values the data has.
- Product copy and narration in **English**; code, identifiers, comments, commits in English.
- Secrets (`TEAM_KEY`, `MCP_TOKEN`) only in the server process; the browser gets scene JSON and audio only.
- ElevenLabs budget $1.40 total: TTS only on a cache miss; cache key includes the voice id and the script text.
  Model `eleven-flash-v2.5`. Voice from env `SHERPY_VOICE`, default `onyx` (team pick, 17/11; other samples:
  `alloy`, `ash`, `onyx`, `sage`; `echo` and `fable` return `voice_not_found`).
- `gpt-5-mini`: never send `max_tokens`.
- Format 16:9; phone held upright shows a "Rotate your phone" overlay.
- Brand: tokens from `assets/brand/tokens.css`, Poppins headings, Inter body, navy outline `#0b0f2e`, brand blue
  `#4666d7`, status red `#cd3b3b`; Sherpy from `assets/mascot/sherpy.svg`. No invented brand assets.
- Scenes, in order: `goals`, `standing`, `worry`, `act`, `mission` (scene 3 may be skipped, never the others).
- Detail level → words per narration line: low 18, medium 28, high 40 (max). Style analytical → number first;
  emotional → meaning for the family; both/mixed → both in the same line.
- Data comes from the MCP (`source.getPart(caseId, 'financial-health' | 'investment-analysis' | 'persona')`).
- Tests: `cd agent && npm test` stays green; new tests use `test/fixtures.mjs` (`loadCase(id)` reads `cases/`).

## Review Focus

1. **Profile missing or incomplete** (`phase1Complete` false): `/video/<case>` answers 409 and the page says "Finish
   your conversation with Sherpy first" — test in Task 5.
2. **TTS fails or the ElevenLabs budget is exhausted:** the video still builds with `audio: null` per scene and plays
   captions-only on estimated timing (14 chars per second), with a small "Narration unavailable" note — tests in
   Tasks 4 and 6.
3. **`gpt-5-mini` returns non-JSON, too few lines, digits, or fails:** each bad line falls back to its template line
   — tests in Task 3.
4. **Cases with missing facts** (Carter: no `combined_moves`, education gap 0; Samantha/Weah: retirement gap 0,
   `shortfallToAdjustedMin` "Not applicable"): facts become `null`, scenes use their simpler variant or `worry` is
   skipped, nothing crashes — tests over all 4 cases in Tasks 1 and 2.
5. **Bad URLs** (`/video/../x`, unknown case, audio index out of range or non-numeric): 404 before any file or MCP
   access — tests in Task 5.

---

### Task 1: Facts per scene

**Files:**
- Create: `agent/src/video/facts.mjs`
- Test: `agent/test/video-facts.test.mjs`

**Interfaces:**
- Produces: `buildFacts(fh, personaMd) -> Facts`, `money(v) -> string`.
  `Facts = { people: string[], goals: Goal[], score: { value, band, colour, pillars: { name, points, score }[], weakest: { name, points } }, gaps: { [topic]: Gap|null }, moves: { title, before, after }[], combined: { moves: string[], after }|null, firstMission: string, concerns: { [topic]: string } }`
  `Goal = { type: 'retirement'|'college'|'vacation'|'purchase', label: string, year: number|null, amount: number|null }`
  `Gap = { topic, label, have: number|null, haveLabel, gap: number, gapLabel }`, topics `retirement|protection|college|debt|cash`.

- [ ] **Step 1: Write the failing tests**

```js
test('Johnson facts match the case', () => {
  const { fh, personaMd } = loadCase('daniel-emily-johnson');
  const f = buildFacts(fh, personaMd);
  assert.deepEqual(f.people, ['Daniel', 'Emily']);
  assert.equal(f.score.value, 52); assert.equal(f.score.band, 'vulnerable');
  assert.deepEqual(f.score.weakest, { name: 'Insurance and protection', points: '0/20' });
  assert.deepEqual(f.goals.filter((g) => g.type === 'college').map((g) => [g.label, g.year]), [['College Oliver', 2033], ['College Sophia', 2035]]);
  assert.equal(f.goals.find((g) => g.type === 'retirement').year, 2044);
  assert.equal(f.goals.find((g) => g.type === 'vacation').amount, 4500);
  assert.deepEqual(f.gaps.college, { topic: 'college', label: 'College', have: 30000, haveLabel: 'in the 529', gap: 106552.38, gapLabel: 'still missing' });
  assert.equal(f.gaps.retirement.gap, 1427455.89);
  assert.equal(f.gaps.protection.have, 250000); assert.equal(f.gaps.protection.gap, 1350000);
  assert.equal(f.gaps.cash.gap, 92360); assert.equal(f.gaps.debt.gap, 18000);
  assert.deepEqual(f.moves[0], { title: 'Raise mortality coverage', before: 52, after: 57 });
  assert.equal(f.combined.after, 60);
  assert.equal(f.firstMission, 'Raise mortality coverage');
});
test('every case builds without throwing; missing facts are null', () => {
  for (const id of CASES) { const { fh, personaMd } = loadCase(id); const f = buildFacts(fh, personaMd); assert.ok(f.score.value >= 0); }
  const carter = buildFacts(...Object.values(loadCase('michael-carter')));
  assert.equal(carter.combined, null); assert.equal(carter.gaps.college, null);
  const weah = buildFacts(...Object.values(loadCase('timothy-melanie-weah')));
  assert.equal(weah.gaps.retirement, null); assert.equal(weah.gaps.cash, null);
});
test('money formats like the grounding check expects', () => {
  assert.equal(money(106552.38), '$106,552'); assert.equal(money(4500), '$4,500');
  assert.equal(money(1427455.89), '$1.43 million'); assert.equal(money(1000000), '$1 million');
});
```

- [ ] **Step 2: Run** `cd agent && node --test test/video-facts.test.mjs` → FAIL (module not found).

- [ ] **Step 3: Implement `buildFacts` and `money` in `agent/src/video/facts.mjs`**

Sources: `fh.case.household` (role client/co-client → `first_name`), `fh.goals.goalsSummary` + `fh.goals.chartGoals`
(college/retirement labels and years from `chartGoals[].name`/`date`; one entry per college child; vacation and
purchase amounts from `goalsSummary[].amount`), `fh.score` (`published_score`, `band`, `colour`, `pillars`,
`top_moves`, `combined_moves`; `combined` = the entry with the highest `score_after`, null if none), and
`fh.key_metrics.ratios`: retirement `retirementSavings.planningGapAtRetirementAgeInTodaysDollars`; protection
`lifeInsurance.clientCoverage` + `lifeInsuranceCoverageGapsAndExcess.clientShortfall`; college
`educationSavings.current529AccountsBalance` + `.totalGAP`; cash `emergencyFund.emergencyFund` +
`.shortfallToAdjustedMin`; debt `creditCardDebt.balance` (have null). A gap that is missing, non-numeric or 0 is
`null`. `concerns[topic]` = the persona objective-concern title for that topic (reuse `personaSections` and the
`WORRY_RULES` idea from `options.mjs`; export a `worryCategory` from `options.mjs` rather than copying it).
`money`: under 1M → `$` + integer with commas; from 1M → millions with up to 2 decimals, trailing zeros dropped.

- [ ] **Step 4: Run** the test → PASS; `npm test` → all green.
- [ ] **Step 5: Commit** `feat(video): facts per scene from the case data`

---

### Task 2: Scenes and template lines

**Files:**
- Create: `agent/src/video/scenes.mjs`
- Test: `agent/test/video-scenes.test.mjs`

**Interfaces:**
- Consumes: `Facts`, `money` (Task 1); profile shape from `agent/src/profile.mjs`
  (`main_goal.agreed`, `top_worry.agreed`, `people[name].style`, `detail_level`, `present`).
- Produces: `planScenes(facts, profile) -> Scene[]` and `fillLine(template, values) -> { text, segments }`.
  `Scene = { id: 'goals'|'standing'|'worry'|'act'|'mission', props: object, values: { [key]: string }, template: string, maxWords: number }`.
  `template` uses `{key}` placeholders whose keys are exactly `Object.keys(values)`. `segments = [{ text, key: boolean }]`
  (filled placeholder values are key segments, used for highlighting).

- [ ] **Step 1: Write the failing tests**

```js
const johnson = () => buildFacts(...Object.values(loadCase('daniel-emily-johnson')));
const profile = (over = {}) => ({ present: ['Daniel', 'Emily'], people: { Daniel: { style: 'analytical' }, Emily: { style: 'emotional' } },
  main_goal: { agreed: 'college' }, top_worry: { agreed: 'none' }, detail_level: 'high', phase1Complete: true, ...over });
test('five scenes in order; main goal first; worry none falls back to the main goal gap', () => {
  const s = planScenes(johnson(), profile());
  assert.deepEqual(s.map((x) => x.id), ['goals', 'standing', 'worry', 'act', 'mission']);
  assert.equal(s[0].props.goals[0].type, 'college');
  assert.equal(s[2].props.gap.topic, 'college');
  assert.equal(s[2].values.gap, '$106,552');
  assert.equal(s[3].values.after, '60');
  assert.equal(s[4].values.mission, 'Raise mortality coverage');
});
test('top_worry picks the scene 3 gap; a worry with no gap and no main-goal gap skips scene 3', () => {
  assert.equal(planScenes(johnson(), profile({ top_worry: { agreed: 'protection' } }))[2].props.gap.topic, 'protection');
  const carter = buildFacts(...Object.values(loadCase('michael-carter')));
  const ids = planScenes(carter, profile({ present: ['Michael'], people: { Michael: {} }, main_goal: { agreed: 'vacation' }, top_worry: { agreed: 'home' } })).map((x) => x.id);
  assert.ok(!ids.includes('worry'));
});
test('detail level sets maxWords; every template placeholder has a value', () => {
  for (const [lvl, n] of [['low', 18], ['medium', 28], ['high', 40]]) {
    for (const sc of planScenes(johnson(), profile({ detail_level: lvl }))) {
      assert.equal(sc.maxWords, n);
      for (const k of sc.template.match(/\{(\w+)\}/g) ?? []) assert.ok(k.slice(1, -1) in sc.values);
    }
  }
});
test('fillLine marks filled values as key segments', () => {
  const r = fillLine('Your score is {score} out of 100.', { score: '52' });
  assert.equal(r.text, 'Your score is 52 out of 100.');
  assert.deepEqual(r.segments, [{ text: 'Your score is ', key: false }, { text: '52', key: true }, { text: ' out of 100.', key: false }]);
});
test('every filled template line is grounded, for all cases and detail levels', () => { /* for each case × level: planScenes → fillLine(template, values) → every extractMentions(text) isGrounded in caseNumbers(fh, ia, persona); load ia from cases/<id>/investment-analysis.json */ });
```

- [ ] **Step 2: Run** `node --test test/video-scenes.test.mjs` → FAIL.
- [ ] **Step 3: Implement `planScenes` and `fillLine` in `agent/src/video/scenes.mjs`**

Scene props: `goals` → `{ people, goals }` (main goal's entries first); `standing` → `{ score, band, colour,
pillars, weakest }` (pillars only when detail is `high`); `worry` → `{ gap }` (gap = facts.gaps[top_worry] ??
facts.gaps[main_goal] ?? skip); `act` → `{ moves, combined, before }` (moves capped at 2 for low/medium);
`mission` → `{ mission }`. Template lines are written by us in Sherpy's warm plain voice and differ by style:
analytical leads with the value, emotional with the people/goal names, mixed couple uses both. "100" in "out of 100"
is grounded (scale "0 to 100" is in the data); don't put any other literal digit in a template.

- [ ] **Step 4: Run** → PASS; `npm test` green.
- [ ] **Step 5: Commit** `feat(video): scenes and template narration from facts and profile`

---

### Task 3: Narration by gpt-5-mini, guarded

**Files:**
- Create: `agent/src/video/narrate.mjs`
- Test: `agent/test/video-narrate.test.mjs`

**Interfaces:**
- Consumes: `Scene[]`, `fillLine` (Task 2); `extractMentions`, `isGrounded` (`agent/src/numbers.mjs`).
- Produces: `narrate(scenes, { complete, numberSet, profile }) -> Promise<{ id, text, segments, source: 'model'|'template' }[]>`
  and `chatComplete({ baseUrl, key }) -> (messages) => Promise<string>` (POST `/v1/chat/completions`,
  model `gpt-5-mini`, no `max_tokens`).

- [ ] **Step 1: Write the failing tests** (a fake `complete` returns canned strings)

```js
test('uses model lines with placeholders filled', async () => {
  const complete = async () => JSON.stringify({ lines: scenes.map((s) => `Here is {${Object.keys(s.values)[0]}} for you.`) });
  const out = await narrate(scenes, { complete, numberSet, profile });
  assert.ok(out.every((l) => l.source === 'model'));
});
test('a model line with a digit, an unknown placeholder, too many words or an ungrounded fill falls back to the template', async () => { /* four cases, each asserts that line's source === 'template' and the others stay 'model' */ });
test('non-JSON, wrong line count or a throwing complete -> all template lines', async () => { /* three cases */ });
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** in `agent/src/video/narrate.mjs`. One request; system prompt: you are Sherpy, warm plain
English, one line per scene in order, at most `maxWords` words, **never write digits**, use only the given
`{placeholders}`, style rules from Global Constraints; user message: the scenes' ids, props summaries and placeholder
keys (not the values' digits). Reply format `{"lines": [...]}`. Per line, accept only if: no `\d` in the raw line,
placeholders ⊆ scene values, word count ≤ maxWords after filling, every `extractMentions` of the filled text
`isGrounded`. Otherwise use the scene template.
- [ ] **Step 4: Run** → PASS; `npm test` green.
- [ ] **Step 5: Commit** `feat(video): narration lines from gpt-5-mini with grounding fallback`

---

### Task 4: Voice clips and the cached build

**Files:**
- Create: `agent/src/video/voice.mjs`, `agent/src/video/build.mjs`
- Test: `agent/test/video-build.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–3; `loadProfile` (`agent/src/profile.mjs`); `caseNumbers` (`agent/src/numbers.mjs`).
- Produces:
  - `speech({ baseUrl, key, voice }) -> (text) => Promise<Buffer>` (POST `/v1/audio/speech`, model `eleven-flash-v2.5`).
  - `createVideoBuilder({ source, profilesDir, videosDir, complete, tts, voice }) -> { get(caseId) }`.
    `get` returns `Promise<Video>`, throws `VideoError('profile_incomplete')` when the profile is missing/incomplete.
    Concurrent `get` for the same case share one promise.
  - `Video = { caseId, voice, scenes: [{ id, props, text, segments, audio: string|null, duration: number|null }] }`,
    stored as `data/videos/<caseId>-<hash>/video.json` with `scene-<i>.mp3`; `audio` is the file name.
    `hash` = sha256 of JSON `{ profile fields used, voice, version: 1 }`, first 12 hex chars.

- [ ] **Step 1: Write the failing tests** (tmp dirs, fake `source` reading `cases/`, fake `complete`, fake `tts` returning a fixed Buffer and counting calls)

```js
test('builds once, then serves from cache without TTS or model calls', async () => { /* get twice → tts calls === scenes count; second get: 0 new calls; video.json exists */ });
test('incomplete profile -> VideoError profile_incomplete', async () => { /* profile with phase1Complete false */ });
test('tts failure -> scenes with audio null, video still returned and not cached', async () => {});
test('two concurrent gets share one build', async () => { /* Promise.all → tts calls === scenes count */ });
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** `duration` from the MP3 is not needed server-side (the player reads it); keep `null`.
A build where any TTS failed is returned but not written, so the next request retries.
- [ ] **Step 4: Run** → PASS; `npm test` green.
- [ ] **Step 5: Commit** `feat(video): cached video build with one TTS clip per scene`

---

### Task 5: Server routes and the hand-off from the conversation

**Files:**
- Create: `agent/src/video/routes.mjs`
- Modify: `agent/server.mjs` (static files map, request handler, builder wiring), `agent/src/session.mjs:48`
  (`createSession` gains `onFinished`), `agent/public/index.html:274-284` (on `sherpy.conversation_done`, after the
  closing audio, `location.href = '/video.html?case=<id>'` instead of showing the placeholder)
- Test: `agent/test/video-routes.test.mjs`, `agent/test/session.test.mjs` (one new test)

**Interfaces:**
- Consumes: `createVideoBuilder` (Task 4), `isAllowedCase` (`session.mjs`).
- Produces: `parseVideoPath(pathname, caseIds) -> { caseId, audio: number|null } | null`;
  routes `GET /video/<case>` (JSON `Video`, 409 `{ error: 'profile_incomplete' }`), `GET /video/<case>/audio/<i>.mp3`
  (`audio/mpeg`); static `/video.html`, `/video-player.mjs`, `/video-stage.mjs`, `/sherpy.svg`.
  `createSession({ ..., onFinished })` calls `onFinished(caseId)` once when `finish_conversation` succeeds; the server
  passes `(id) => builder.get(id).catch(() => {})` so the build starts while the closing line plays.

- [ ] **Step 1: Write the failing tests**

```js
test('parseVideoPath accepts known cases and audio indexes only', () => {
  assert.deepEqual(parseVideoPath('/video/daniel-emily-johnson', CASES), { caseId: 'daniel-emily-johnson', audio: null });
  assert.deepEqual(parseVideoPath('/video/daniel-emily-johnson/audio/2.mp3', CASES), { caseId: 'daniel-emily-johnson', audio: 2 });
  for (const p of ['/video/../etc', '/video/nobody', '/video/daniel-emily-johnson/audio/x.mp3', '/video/daniel-emily-johnson/audio/-1.mp3', '/video/daniel-emily-johnson/audio/99.mp3x']) assert.equal(parseVideoPath(p, CASES), null);
});
// session.test.mjs: 'finish_conversation success calls onFinished once with the case id'
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the routes in `server.mjs` using `parseVideoPath` (audio index must be < scene count,
else 404). `TEAM_KEY` stays in the server: `speech({ baseUrl: PROXY_URL, key: TEAM_KEY, voice: process.env.SHERPY_VOICE || 'onyx' })`.
- [ ] **Step 4: Run** `npm test` → green. Then `npm start` and
  `curl -s -o /dev/null -w "%{http_code}" localhost:5173/video/nobody` → `404`;
  with no profile for the Johnsons, `curl -s localhost:5173/video/daniel-emily-johnson` → `{"error":"profile_incomplete"}`.
- [ ] **Step 5: Commit** `feat(video): video routes and hand-off after the conversation`

---

### Task 6: Player — 16:9 stage, audio clock, captions

**Files:**
- Create: `agent/public/video.html`, `agent/public/video-player.mjs`
- Test: `agent/test/video-player.test.mjs`

**Interfaces:**
- Consumes: `GET /video/<case>` JSON (Task 5); `renderScene` (Task 7, can be a stub that writes the scene id until
  Task 7 lands).
- Produces (pure, exported from `video-player.mjs`): `wordTimes(segments, duration) -> { word, key, start }[]`
  (start proportional to characters), `estimateDuration(text) -> seconds` (chars / 14),
  `timeline(scenes) -> { start, duration }[]`. Page API for Task 7:
  `renderScene(stageEl, scene) -> { at(t: seconds) }` — the player calls `at(t)` every frame with the time inside the
  current scene.

- [ ] **Step 1: Write the failing tests**

```js
test('wordTimes spreads words by characters over the clip', () => {
  const w = wordTimes([{ text: 'Your score is ', key: false }, { text: '52', key: true }], 2);
  assert.deepEqual(w.map((x) => x.word), ['Your', 'score', 'is', '52']);
  assert.equal(w[0].start, 0); assert.ok(w[3].key); assert.ok(w[3].start < 2);
});
test('timeline chains scenes; missing duration uses the estimate', () => {
  const t = timeline([{ duration: 3, text: 'a' }, { duration: null, text: 'x'.repeat(28) }]);
  assert.deepEqual(t, [{ start: 0, duration: 3 }, { start: 3, duration: 2 }]);
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Page states: loading (Sherpy + "Putting your video together…" while `GET /video/<case>` is in flight — the
server answers when the build is done, ~20 s on a miss; then each clip's metadata is preloaded to get its duration),
409 message, ready (big "Play your video" button —
audio needs a user gesture), playing, ended ("Start your first mission" button, inert placeholder). Stage: fixed
1280×720 box scaled with CSS `transform` to fit the viewport; `@media (orientation: portrait) and (max-width: 900px)`
shows the rotate overlay. Clips play back to back through one `<audio>` element; current time = scene start +
`audio.currentTime`; if a scene's `audio` is null, a timer clock runs for its estimated duration and the "Narration
unavailable" note shows. Captions bar at the bottom: words appear at their `start`, key words on a brand-blue block.
Play/pause and replay controls. The `<audio>` goes through an `AnalyserNode`; every frame the player sets
`--lvl` (0–1, narration volume) on the stage so Sherpy's mouth can follow it (Task 7), as in the conversation page. Reads `?case=` from the URL; `?t=<seconds>&paused=1` jumps there (for screenshots).
- [ ] **Step 4: Run** `npm test` → green. With a cached video (Task 8 builds one) the page plays; until then check
loading and 409 states in the browser.
- [ ] **Step 5: Commit** `feat(video): 16:9 player driven by the audio clock, with captions`

---

### Task 7: The five scenes in the D10 look

**Files:**
- Create: `agent/public/video-stage.mjs` (`renderScene` + one function per scene id), styles in `video.html`
- Modify: `agent/server.mjs` static map (`/sherpy.svg` → `assets/mascot/sherpy.svg`, already listed in Task 5)

**Interfaces:**
- Consumes: scene `props`/`segments` (Task 2 shapes), `renderScene` contract (Task 6).
- Produces: `renderScene(stageEl, scene) -> { at(t) }` for `goals`, `standing`, `worry`, `act`, `mission`.

- [ ] **Step 1: Implement the scenes** (visual work; no unit tests). Look (spec "Decided" + D10): light Sherpas
neutral background, flat sticker shapes with 4–5 px navy outlines and a hard 5 px shadow, heavy Poppins headline with
the key word on a brand-blue highlight block, tilted stamps, elements pop in at fixed fractions of the scene's
duration via Web Animations (deterministic from `t`, so seeking works).
  - Sherpy: the inline SVG from `/sherpy.svg`, mouth opening with the stage's `--lvl` (same trick as
    `agent/public/index.html`).
  - `goals`: Sherpy pops in, waves, slides out by 35 %; goal cards (college cap per child with name + year, palm for
    the vacation with amount per year, rocking chair for retirement with year), main goal biggest.
  - `standing`: score dial 0–100 counting up to the score, band word in a stamp coloured by `colour`; for high detail,
    pillar bars with their `points` labels; the `weakest` gets a red stamp.
  - `worry`: one horizontal bar: `have` segment (navy) and `gap` segment (red hatched), each labelled with its
    formatted value and label; widths proportional to the two values, no total shown.
  - `act`: move cards appear one by one with "before → after" chips; then the combined score (if any) counts from
    `before` to `after`.
  - `mission`: Sherpy returns, a mission card "Mission 1" with the title, and a hint of the progress bar at 0 %.
  Icons are drawn by us as simple inline SVG (no external assets).
- [ ] **Step 2: Verify visually.** With the Task 8 cached video, capture each scene at mid-time in headless Chrome
(`/video.html?case=daniel-emily-johnson&t=<mid>&paused=1`) at 1280×720 and 844×390 (phone landscape) and check:
every label legible, nothing overflows the stage, numbers equal the scene values.
- [ ] **Step 3: Commit** `feat(video): five animated scenes in the Sherpas sticker style`

---

### Task 8: Real build for the Johnsons and end-to-end check

**Files:**
- Create: `agent/scripts/build-video.mjs` (CLI: `node --env-file=../.env scripts/build-video.mjs <caseId> [profile.json]`;
  with a profile file it writes it to `data/profiles/<case>.json` only if none exists, then builds and prints the
  narration lines with their source and the spend before/after from `/key/info`)
- Create: `agent/test/fixtures/profile-johnson.json` (complete profile: college agreed, worry `protection`,
  Daniel growth/analytical, Emily moderate/emotional, detail `medium`)

- [ ] **Step 1: Build** `cd agent && node --env-file=../.env scripts/build-video.mjs daniel-emily-johnson test/fixtures/profile-johnson.json`
  Expected: 5 lines printed, each `model` or `template`, all grounded; 5 `scene-<i>.mp3` in `data/videos/`;
  ElevenLabs cost ≈ $0.035.
- [ ] **Step 2: Run it again** → "cache hit", no new spend.
- [ ] **Step 3: Play it** at `http://localhost:5173/video.html?case=daniel-emily-johnson` in Chrome; record the
  screenshots from Task 7 Step 2; run `node scripts/grounding-check.mjs`-style check on the five lines (the script
  prints any ungrounded number; expected none).
- [ ] **Step 4: Log** in `docs/devlog.md` (time, spend, what the team saw) and commit
  `chore(video): build script and Johnson fixture profile`.
