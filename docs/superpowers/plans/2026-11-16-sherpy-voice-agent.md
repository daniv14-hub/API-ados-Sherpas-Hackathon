# Sherpy Voice Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Node backend that runs Sherpy as a realtime voice agent: phase 1 asks the approved closed questions and saves a validated profile per family; phase 2 answers questions using only Sherpas MCP data.

**Architecture:** Browser page (adapted from `examples/voice/public`) ⇄ our Node server ⇄ proxy `/v1/realtime`. The server injects Sherpy's instructions and tools into the page's `session.update`, executes tool calls itself (`save_answer`, `get_plan_section`), stores the profile in `data/profiles/<caseId>.json` and switches phase with a new `session.update`. Case data comes from the Sherpas MCP (`get_case`).

**Tech Stack:** Node 22+ (installed: v25.9.0), ES modules, `ws`, `@modelcontextprotocol/sdk`, `node:test` (no test framework dependency).

**Spec:** `docs/superpowers/specs/2026-11-16-voice-agent-design.md` (decisions D15–D18 in `docs/decisions.md`).

## Global Constraints

- Never invent figures. Sherpy never calculates; every figure comes from the brief or a tool result (D18).
- Case data only through the MCP at runtime (D18). `cases/*.json` may be used **only as test fixtures**.
- MCP failure → tool returns `{"error":"plan_unavailable"}` and Sherpy says it can't reach the plan right now. No fallback.
- Secrets (`TEAM_KEY`, `MCP_TOKEN`) only in the root `.env` (git-ignored), read by the server. Never sent to the browser, never logged.
- Product copy (instructions, Sherpy's words) in English. Code, identifiers, comments, commits in English.
- Develop on the cheapest realtime model the spike validates. Always close upstream sessions when the browser leaves.
- Profile values only from the approved options (D17); the backend validates, the model is not trusted.
- `gpt-5-mini`: never set `max_tokens` (only relevant for the Task 1 fallback).
- Before calling the feature done: `/security-review` (personal data + exposed backend).

## Review Focus

1. MCP token expired or MCP down mid-session → the tool returns `plan_unavailable`, the session keeps running (Task 5 test `get_plan_section returns plan_unavailable when MCP throws`).
2. The model sends malformed JSON arguments, an unknown person or a value outside the options → rejected with an error output, no crash, nothing saved (Task 4 + Task 5 tests).
3. `case` query param with `../` or an unknown id → connection refused before any file or MCP access (Task 4 `rejects unsafe caseId`, Task 6 `refuses unknown case`).
4. Profile file missing or corrupt → start a fresh profile in phase 1 (Task 4 `loadProfile returns fresh profile on corrupt file`).
5. Browser closes while a tool call is in flight → upstream is closed, no unhandled rejection (Task 6 `closes upstream when browser closes`).

## File Structure

```
agent/
  package.json            scripts: start, test; deps: ws, @modelcontextprotocol/sdk
  server.mjs              HTTP (static page) + WebSocket /voice entry; loads root .env
  src/case-source.mjs     MCP access: createCaseSource({ callTool }) and connectMcp(url, token)
  src/brief.mjs           buildBrief(fh, personaMd) -> string        (layer 2, no AI)
  src/options.mjs         buildOptions(fh, personaMd) -> Options      (D17 options per family)
  src/profile.mjs         profile shape, applyAnswer, isPhase1Complete, load/save
  src/instructions.mjs    SHERPY_RULES, sherpyInstructions(...)       (layers 1 + 4)
  src/tools.mjs           toolDefinitions(phase, options), handleToolCall(...)
  src/session.mjs         createSession(...) : relay + interception + phase switch
  scripts/spike-tools.mjs     Task 1 spike (throwaway)
  scripts/mcp-smoke.mjs       prints real MCP response shapes
  scripts/grounding-check.mjs flags numbers in transcripts not found in the case
  public/index.html, public/mic-worklet.js   copied from examples/voice/public, adapted
  test/*.test.mjs
data/profiles/  data/transcripts/   (git-ignored)
```

---

### Task 1: Voice spike — function calling on the proxy (Q-VOICE)

Throwaway measurement. Its result is a **team decision** (which model), so stop after it and report.

**Files:**
- Create: `agent/package.json` (`"type": "module"`, `"engines": {"node": ">=22"}`, scripts `start: node server.mjs`, `test: node --test test/`), `agent/scripts/spike-tools.mjs`
- Modify: `.gitignore` (add `data/`)

**Interfaces:** Produces: nothing reused. Output = numbers in `docs/devlog.md`.

- [ ] **Step 1:** `cd agent && npm install ws @modelcontextprotocol/sdk`
- [ ] **Step 2:** Write `scripts/spike-tools.mjs <model>`: opens `wss://…/v1/realtime?model=<model>` with `TEAM_KEY` from the root `.env` (`node --env-file=../.env`); sends `session.update` with `{ type: "realtime", output_modalities: ["text"], instructions: "When the user states their main goal, call save_answer.", tools: [save_answer with question/person/value strings], tool_choice: "auto" }`; sends `conversation.item.create` (user text: "Hi, I'm Daniel. Our main goal is college for the kids.") + `response.create`; logs every event type; on `response.done` prints any `output[]` item with `type: "function_call"` (`name`, `call_id`, `arguments`); replies with `conversation.item.create` `function_call_output` + `response.create`; prints the follow-up text; closes after 20 s max.
- [ ] **Step 3:** Run for `gpt-realtime-2.1-mini` and `gemini-3.8-live`: `node --env-file=../.env scripts/spike-tools.mjs gpt-realtime-2.1-mini`. Expected: a `function_call` item with `"name":"save_answer"` and arguments containing `college`. Note: the example page says the proxy drops `response.create` for Gemini — record whether Gemini continues after the tool output on its own.
- [ ] **Step 4:** Record spend before/after: `curl -s https://llm-hackathon.sherpaswealth.com/key/info -H "Authorization: Bearer $TEAM_KEY"` (`info.spend`).
- [ ] **Step 5:** Log results in `docs/devlog.md` (per model: tool call yes/no, follow-up yes/no, latency, cost). `gpt-live-1` is out of scope (different protocol, not documented in the repo).
- [ ] **Step 6:** Commit (`chore(agent): voice tool-calling spike`). **STOP: the team chooses the model (closes Q-VOICE).** If no model supports tool calls, the team decides on the `gpt-5-mini` transcript-extraction fallback before Task 5.

### Task 2: Case source (MCP)

**Files:**
- Create: `agent/src/case-source.mjs`, `agent/scripts/mcp-smoke.mjs`, `agent/test/case-source.test.mjs`

**Interfaces:**
- Produces: `createCaseSource({ callTool }) -> { getPart(caseId, part, section?) : Promise<any> }` where `callTool(name, args) -> Promise<{ content: [{ text: string }] }>`. Returns the parsed `value` for JSON parts and the Markdown string for `persona`. Throws `CaseSourceError` on any failure.
- Produces: `connectMcp(url: string, token: string) -> Promise<{ callTool, close }>` using `Client` + `StreamableHTTPClientTransport` with `Authorization: Bearer <token>` (exact pattern in `README.md` §4, JavaScript).

- [ ] **Step 1:** Run `node --env-file=../.env scripts/mcp-smoke.mjs` (calls `get_case` for `daniel-emily-johnson` with `financial-health/score` and `persona/D4`; prints `content[0].text.slice(0, 300)`). Requires `MCP_TOKEN` in the root `.env` (a teammate logs in on the access page). Record the real shape of the persona response in a comment in `case-source.mjs`.
- [ ] **Step 2: Failing tests** (fake `callTool`):
  - `getPart parses value of a JSON part` — fake returns `{content:[{text: JSON.stringify({value:{published_score:52}})}]}` → `{published_score:52}`.
  - `getPart returns persona markdown as text` — shape from Step 1.
  - `getPart wraps transport errors in CaseSourceError` — fake throws → rejects with `CaseSourceError`.
- [ ] **Step 3:** `npm test` → FAIL. **Step 4:** implement. **Step 5:** `npm test` → PASS.
- [ ] **Step 6:** Commit `feat(agent): MCP case source`.

### Task 3: Family brief and options (no AI)

**Files:**
- Create: `agent/src/brief.mjs`, `agent/src/options.mjs`, `agent/test/brief.test.mjs`, `agent/test/options.test.mjs`
- Fixtures: read `cases/<id>/financial-health.json` and `persona.md` directly in tests (fixtures only).

**Interfaces:**
- Produces: `buildBrief(fh: object, personaMd: string) -> string`. Includes, labelled: `case.household`, `score` (published_score, band, message, pillars, top_moves, combined_moves), `goals.goalsSummary`, `profile` (incomes, expenses, accounts, liabilities, insurance, goals), `narrative.summary_main`, `narrative.summary_recommendations`, persona sections D4, D5, D6, Objective concerns, Tensions (cut by `## ` headings). Values are copied as JSON/text, never reformatted.
- Produces: `buildOptions(fh, personaMd) -> Options`:
  ```
  { present: string[] /* adult first names: role client|co-client */,
    main_goal: { value: string, label: string }[]  /* one per distinct goalsSummary.goalType, lowercased; label = its .value text */,
    top_worry: string[]  /* categories from Objective concerns, in O order, deduped, + "none" last */,
    risk: ["conservative","moderate","growth"], style: ["analytical","emotional"], detail_level: ["low","medium","high"] }
  ```
  Worry category = first matching rule on the concern title (text after `O<n>…:` up to `(`, `.` or `**`), rules in this order: `retirement:/retire/i`, `protection:/insurance|umbrella|cover/i`, `college:/college|education/i`, `debt:/debt|card|loan/i`, `home:/home purchase/i`, `cash:/reserve|thin cash|idle cash/i`; no match → skipped. Two title formats exist: `**O1: Retirement (SIGNIFICANT).**` and `**O1 SIGNIFICANT: Retirement shortfall.**`.

- [ ] **Step 1: Failing tests**
  - `brief contains household and score` — Johnson brief includes `"Daniel"`, `"Emily"`, `52`.
  - `brief numbers all exist in the sources` — every `/\d[\d,.]*/` token in the brief appears in `JSON.stringify(fh) + personaMd`.
  - `brief stays under 30000 chars` — for all 4 cases.
  - `options for Johnson` — `present` `["Daniel","Emily"]`; `main_goal` values `["retirement","vacation","college"]`; `top_worry` `["retirement","protection","cash","debt","college","none"]`.
  - `options for Carter` — `present` `["Michael"]`; `main_goal` values `["vacation","purchase"]`; `top_worry[0] === "retirement"`, last `"none"`.
  - `options never empty` — every case has ≥2 `top_worry` and ≥1 `main_goal`.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implement both. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(agent): family brief and question options`.

Note for the team review: the Johnson worry list derived from the data includes `cash` (O4 cash reserve), which the 16/11 draft table didn't show.

### Task 4: Profile

**Files:**
- Create: `agent/src/profile.mjs`, `agent/test/profile.test.mjs`

**Interfaces:**
- Produces: `isSafeCaseId(id) -> boolean` (`/^[a-z]+(-[a-z]+)*$/`).
- Produces: `newProfile(caseId, adults: string[]) -> Profile` with the shape in spec §7 (`present: []`, `people: {<name>: {}}`, `main_goal: {agreed:null, byPerson:{}}`, `top_worry: {agreed:null, byPerson:{}}`, `detail_level: null`, `phase1Complete: false`, `updatedAt`).
- Produces: `applyAnswer(profile, { question, person, value }, options) -> { ok: true, profile } | { ok: false, error: string }` — pure, returns a new object. Rules: `question ∈ {present, main_goal, top_worry, risk, style, detail_level}`; `risk`/`style` need `person ∈ options.present`; `main_goal`/`top_worry` with a name → `byPerson`, with `"household"` → `agreed`; `present` value = comma-separated names ⊆ `options.present`; `detail_level` person `"household"`; value must be in that question's options. Sets `phase1Complete = isPhase1Complete(...)`.
- Produces: `isPhase1Complete(profile) -> boolean` — `present` non-empty, both `agreed` set, `risk` and `style` for every present adult, `detail_level` set.
- Produces: `loadProfile(dir, caseId, adults) -> Promise<Profile>` (missing or unparsable → `newProfile`), `saveProfile(dir, profile) -> Promise<void>` (write `<caseId>.json.tmp` then rename).

- [ ] **Step 1: Failing tests** — `rejects unsafe caseId` (`"../x"`, `"A"`, `""` false; `"daniel-emily-johnson"` true); `saves risk per person`; `rejects value outside options` (`risk: "yolo"` → ok false, profile unchanged); `rejects unknown person`; `stores disagreement byPerson and agreed separately`; `phase1Complete only when all fields set` (two-adult Johnson sequence → true only after the last answer); `loadProfile returns fresh profile on missing file`; `loadProfile returns fresh profile on corrupt file`; `save then load round-trips` (temp dir via `fs.mkdtemp`).
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(agent): validated family profile`.

### Task 5: Instructions and tools

**Files:**
- Create: `agent/src/instructions.mjs`, `agent/src/tools.mjs`, `agent/test/instructions.test.mjs`, `agent/test/tools.test.mjs`

**Interfaces:**
- Consumes: `applyAnswer`, `saveProfile` (Task 4); `getPart` (Task 2); `Options` (Task 3).
- Produces: `SHERPY_RULES: string` — must contain, verbatim: `Never calculate.`, `Only say a figure that appears in the family brief or in a tool result.`, and the decline line `That isn't in your plan, so I don't want to guess. Your advisor can help with that.` Plus: friendly but professional advisor; English; short spoken sentences; address partners by name; never answer from memory if a lookup failed. General terms may be explained only with the README glossary definitions (`README.md` § "A few financial terms": net worth, cash flow, liquidity, 401(k) and IRA, Roth, 529, living map), copied into `GLOSSARY` in `instructions.mjs`; test `rules include the glossary and nothing else as general knowledge` checks the 7 terms are present.
- Produces: `sherpyInstructions({ phase: 1|2, brief, profile, options }) -> string`. Phase 1: ice-breaker (introduce itself as Sherpy, a few short questions, honesty matters), the questions of D17 in order with their options spelled out (main_goal labels, worry categories), "ask each partner by name for risk and style", "re-ask with the options if unclear", "if partners disagree on goal or worry, save each answer by person, help them agree, then save the agreed one with person household", "call save_answer after each answer". Phase 2: answer questions about their plan, use `get_plan_section` for anything not in the brief, adapt depth to `detail_level` and framing to each person's `style`. Both phases include `SHERPY_RULES` and the brief; phase 2 includes the profile JSON.
- Produces: `toolDefinitions(phase, options) -> object[]` (Realtime `{type:"function", name, description, parameters}`). Phase 1: `save_answer` (`question` enum, `person` string, `value` string). Phase 2: `get_plan_section` (`part` enum `financial-health|investment-analysis|persona`, `section` enum of `SECTIONS`).
- Produces: `SECTIONS = { "financial-health": ["narrative","key_metrics","projections","goals","profile","score"], "investment-analysis": ["narrative","key_metrics","analysis","positions"], "persona": [] }` (empty = whole part).
- Produces: `handleToolCall(name, argsJson, ctx) -> Promise<{ output: object, profile?: Profile }>` with `ctx = { caseId, profile, options, source, profilesDir }`. Output is what goes into `function_call_output` (JSON-stringified by the session). Tool results are capped at 20000 chars (cut + `"truncated": true`).

- [ ] **Step 1: Failing tests** — `rules contain the exact no-calculation lines`; `phase 1 instructions list Johnson goals and worries`; `phase 2 instructions include profile and not the question script`; `phase 1 exposes only save_answer`; `phase 2 exposes only get_plan_section`; `save_answer valid → ok and profile saved` (temp dir); `save_answer invalid JSON args → error output, nothing saved`; `save_answer value outside options → error output`; `get_plan_section unknown section → error output`; `get_plan_section returns plan_unavailable when MCP throws` (fake source rejects with `CaseSourceError` → `{error:"plan_unavailable"}`); `get_plan_section caps output at 20000 chars`; `unknown tool → error output`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(agent): Sherpy instructions and tools`.

### Task 6: Session relay, server and page

**Files:**
- Create: `agent/src/session.mjs`, `agent/server.mjs`, `agent/test/session.test.mjs`
- Create: `agent/public/index.html`, `agent/public/mic-worklet.js` (copy from `examples/voice/public/`; change: fixed model from config, case selector kept, the instructions textarea removed — the server owns instructions; show Sherpy from `assets/mascot/sherpy.svg` with the approved talking animation driven by output audio volume)

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces: `createSession({ browser, upstream, caseId, source, profilesDir, transcriptsDir }) -> Promise<void>` where `browser`/`upstream` are `ws`-like (`send`, `close`, `on('message'|'close')`, `readyState`). On start: loads `financial-health` (whole part) + `persona` via `source`, builds brief/options, loads profile, `phase = profile.phase1Complete ? 2 : 1`. Behaviour:
  - page → upstream: a `session.update` gets `instructions`, `tools`, `tool_choice: "auto"` replaced by ours (audio config kept); everything else passes through; queued until upstream is open (as in the example).
  - upstream → page: everything passes through. On `response.done`, for each `output[]` item `type === "function_call"`: `handleToolCall` → send `conversation.item.create` (`function_call_output`, same `call_id`, `output: JSON.stringify(output)`) then `response.create`. If the profile became `phase1Complete` in phase 1 → `phase = 2` and send a `session.update` with phase-2 instructions and tools.
  - `response.output_audio_transcript.done` / `response.audio_transcript.done` → append `{t, role:"assistant", text}` to `transcriptsDir/<caseId>-<startISO>.jsonl`; `conversation.item.input_audio_transcription.completed` → same with `role:"user"`.
  - Either side closes → close the other.
  - Case data fails to load at start → send the page `{type:"error", error:{message:"plan_unavailable"}}` and close both.
- Produces: `server.mjs` — reads root `.env` (`node --env-file=../.env server.mjs`), `PORT` default 5173, `MODEL` env default = spike winner, `/voice?case=<id>` refuses unless `isSafeCaseId(id)` and id ∈ `list_cases` result (cached at startup).

- [ ] **Step 1: Failing tests** (fake sockets = `EventEmitter` + `send` spy, fake source from fixtures):
  - `injects instructions and tools into page session.update`
  - `answers a save_answer function call with function_call_output then response.create`
  - `switches to phase 2 after the last phase-1 answer` (seed profile with all but one field)
  - `starts in phase 2 when profile is complete`
  - `writes assistant transcript lines`
  - `closes upstream when browser closes`
  - `sends plan_unavailable and closes when case data fails`
  - `refuses unknown case` (server-level helper `isAllowedCase(id, ids)`)
- [ ] **Step 2:** FAIL. **Step 3:** implement `session.mjs`, `server.mjs`, page. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(agent): realtime session with tools and phase switch`.

### Task 7: Grounding check

**Files:**
- Create: `agent/scripts/grounding-check.mjs`, `agent/src/numbers.mjs`, `agent/test/numbers.test.mjs`

**Interfaces:**
- Produces: `extractNumbers(text) -> number[]` — parses `$1,600,000`, `1.6 million`, `$1.6M`, `250K`, `24.9%`, `52`; ignores years 1900–2100 only when written as a 4-digit year next to a month or "in"/"by" (otherwise checked).
- Produces: `caseNumbers(fh, ia, personaMd) -> Set<number>` (every number in the sources, plus each one rounded to K/M forms: 1,600,000 → 1.6e6 also matches 1.6M).
- Produces: CLI `node --env-file=../.env scripts/grounding-check.mjs data/transcripts/<file>.jsonl` → prints each assistant number not in the case set with its sentence; exit 1 if any.

- [ ] **Step 1: Failing tests** — `extracts money, K/M, million, percents`; `1.6 million matches 1600000`; `flags 1350001 as not in case`; `accepts 52 for Johnson`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(agent): transcript grounding check`.

### Task 8: End-to-end run, security review, docs

**Files:**
- Modify: `README.md` (section "Run Sherpy": prerequisites, `.env` with `MCP_TOKEN` renewed every 72 h, MCP access ends 21/11, `cd agent && npm install && npm start`), `docs/devlog.md`, `docs/STATUS.md` (Last Claude Code session block only)

- [ ] **Step 1:** `npm test` → all PASS (show output).
- [ ] **Step 2:** Manual run with the Johnsons on the dev model, headphones: full phase 1 (both partners, one disagreement on Q1), then 5 phase-2 questions, two of them not in the plan (e.g. "What will bitcoin do next year?", "How does Sherpas calculate the score internally?"). Expected: profile file complete and valid; phase switch without hang-up; both off-plan questions declined with the decline line.
- [ ] **Step 3:** `node --env-file=../.env scripts/grounding-check.mjs data/transcripts/<that file>` → exit 0. Any flagged number → `superpowers:systematic-debugging` before going on.
- [ ] **Step 4:** Record spend (`/key/info`), confirm upstream closed in server logs.
- [ ] **Step 5:** Run `/security-review`, show findings to the team, fix what they approve.
- [ ] **Step 6:** Ask the team for a screenshot `docs/screenshots/YYYYMMDD-HHMM-sherpy-voice.png`. Update README, devlog, STATUS. Commit `docs: run Sherpy voice agent`.
