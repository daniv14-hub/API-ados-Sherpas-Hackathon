# Sherpy voice agent — design

Status: **draft for team approval** (brainstorm 16/11, Dani + team). Related decisions: D1, D2, D4, D5, D6, D8, D12,
D13, D15, D16, D17 in `docs/decisions.md`. Items marked **[Claude's call]** were not discussed with the team; check them.

## 1. Intent

Sherpy (D15) is the Sherpas advisor mascot that talks with the family by voice. It does two jobs:

1. **Phase 1 — interviewer.** Breaks the ice like a good advisor on a call, then asks the five approved closed questions
   (D17) to learn what the plan doesn't know. The answers fill the family's **profile file**, which personalises the
   video (D4) and the checkpoint lines (D15).
2. **Phase 2 — advisor.** Answers the family's questions about **their** plan, freely and in plain words, but only with
   what the Sherpas data says. Available at any point of the experience (D15).

The team calls this a "hybrid" agent: scripted where we need clean data, free where they need answers.

## 2. Goals, non-goals, anti-goals

**Goals**
- Warm, friendly but professional advisor tone (D8, D12). Natural voice.
- Every figure Sherpy says is in the case data. Nothing about Sherpas that isn't in the data.
- Phase-1 answers stored as clean, validated values the video can use without interpretation.
- Couples: ask each partner by name; mediate disagreements on joint matters (D2, D13).

**Non-goals (MVP)**
- ElevenLabs in the live agent (D16: realtime model voices). ElevenLabs is only for the scripted demo video.
- Lip-sync (D8: mouth moves with volume).
- Building the platform screens (video, game). This design covers the agent and its backend; the platform consumes it.
- Remembering full conversation history across visits (see §9).

**Anti-goals (a failure even if it "works")**
- **Sherpy states a number, fact or Sherpas policy that is not in the case data.** Team: "terminantemente prohibido".
- Sherpy gives advice the plan doesn't give (new products, new strategies, its own projections).
- A profile field saved with a value outside the allowed options.
- Fear tactics or exaggeration (D12).

## 3. Constraints

- **Data source = the Sherpas cases only** (MCP `get_case` / identical JSON in `cases/<id>/`). No other "Sherpas
  knowledge": if it's not in the data, Sherpy says so (team, 16/11).
- No "if you act" projection exists (D5); score improvements only from the plan's own combinations (D6).
- Budget $50 shared; voice billed per session and recorded on close → always close sessions. 4 concurrent sessions,
  60 req/min. Develop on the cheapest model.
- Secrets (`TEAM_KEY`, `MCP_TOKEN`) only in the backend. Voice goes browser → our backend → proxy.
- Product language: English. Mobile first.
- Profile holds personal data (worries, risk) → `/security-review` before calling it done.

## 4. Architecture

```
browser (mic, speaker, Sherpy animation)
   ⇄ WebSocket ⇄  our backend (Node)  ⇄  wss://llm-hackathon.sherpaswealth.com/v1/realtime?model=…
                     │  builds instructions (layers 1, 2, 4)
                     │  executes tool calls (layer 3, save_answer)
                     ├─ reads cases/<id>/*.json
                     └─ reads/writes data/profiles/<caseId>.json   (git-ignored)
```

- Start from `examples/voice/server.mjs` (relay, ~40 lines of logic) and its page's audio handling (PCM16 24 kHz,
  interruption handling). The backend stops being a blind relay: it injects instructions and answers tool calls.
- Realtime model: **not chosen yet** — `gpt-realtime-2.1-mini`, `gemini-3.8-live` or `gpt-live-1` (different protocol).
  Decided by the voice spike (Q-VOICE). The design assumes the OpenAI Realtime protocol (`session.update`,
  function calling); if `gpt-live-1` wins, the adapter changes, not the design.
- Sherpy's mouth/bounce driven by the output audio volume, as in `prototypes/mascot/` (approved).
- **[Claude's call]** Data read from `cases/` JSON files, not the MCP at runtime: same data, but the MCP token expires
  every 72 h and the README recommends the files if the MVP must keep working after delivery. A small data module
  hides the source so we can switch to the MCP (e.g. for the pitch) by config.

## 5. Context: four layers

| Layer | What | When loaded | Built by |
|---|---|---|---|
| 1. Sherpy | Persona, tone, hard rules (§6), the phase script | Always | Fixed text in the repo |
| 2. Family brief | ~5K tokens of the plan (below) | Always | **Code, no AI** |
| 3. Plan lookups | Any other section of the case | On demand, via tool | Tool returns raw JSON |
| 4. Profile | Answers from phase 1 | Phase 2 onwards; every visit | `data/profiles/<caseId>.json` |

**Layer 2 — family brief** (Johnson ≈ 20 KB JSON → ~5K tokens), from `financial-health.json` and `persona.md`:
`case.household`, `score` (published score, band, message, pillars, `top_moves`, `combined_moves`), `goals`,
`profile` (incomes, expenses, accounts, liabilities, insurance, goals), `narrative.summary_main`,
`narrative.summary_recommendations`, persona D4, D5, D6, Objective concerns, Tensions.
Why not everything: the full case is ~60K tokens; it would slow the voice model, cost more per turn and make
mistakes more likely.

**Layer 3 — lookups.** `key_metrics`, the rest of `narrative.*`, `projections.yearly`, `investment-analysis`
sections. Sherpy calls a tool instead of remembering.

Session start **[Claude's call]**: if the profile has `phase1Complete: true`, the session starts in phase 2;
otherwise in phase 1. One shared session per family for the MVP (the demo couple talks together, D13); per-partner
sessions for individual matters (D2) come later with the platform.

Phase switch: when phase 1 ends, the backend sends a new `session.update` with the phase-2 instructions (same
session, no hang-up).

## 6. Anti-hallucination rules (layer 1 + backend)

1. Sherpy only says a figure that appears in the brief or in a tool result in this session. **[Claude's call]** It
   doesn't calculate new figures (no subtracting, adding or projecting), because a derived number is a number the
   plan doesn't contain. It can quote the plan's own gaps (e.g. "you have $250K of cover; the plan recommends
   $1.6M+").
2. If the answer isn't in the data: "That isn't in your plan, so I don't want to guess. Your advisor can help with
   that." No general-knowledge answers about Sherpas, products, markets or taxes beyond what the data says.
   **[Claude's call]** General finance terms (what a 401(k) is) are allowed using the README glossary wording only.
3. Score changes only from `top_moves` / `combined_moves` (D6: they don't add up).
4. **Automatic check [Claude's call]:** the backend logs every assistant transcript; a test script extracts every
   number from it and flags any that doesn't appear in the case files. Run it on test conversations before the demo.

## 7. Phase 1 — tools and flow

Approved questions and options: D17. The flow per question: ask (by name for per-person questions) → map the answer to
one option → call `save_answer` → short confirmation → next. Unclear answer → re-ask with the options. Partners
disagree on Q1/Q2 → store both, Sherpy mediates (D2), then stores the agreed value.

Tool `save_answer` (schema enforced by the backend, not trusted to the model):

```json
{ "name": "save_answer",
  "parameters": {
    "question": "main_goal | top_worry | risk | style | detail_level | present",
    "person":   "<adult first name from case.household> | household",
    "value":    "<one of the allowed options for that question and family>" } }
```

Allowed options per family come from the data (Q1 from `goals.goalsSummary`, Q2 from persona objective concerns).
Invalid value → the tool returns an error and Sherpy re-asks.
Fallback if function calling during voice doesn't work (Q-VOICE): after each user turn, `gpt-5-mini` extracts the
same fields from the transcript, with the same validation.

Profile file `data/profiles/<caseId>.json`:

```json
{ "caseId": "daniel-emily-johnson",
  "present": ["Daniel", "Emily"],
  "people": { "Daniel": { "risk": "growth", "style": "analytical" },
              "Emily":  { "risk": "moderate", "style": "emotional" } },
  "main_goal":  { "agreed": "college", "byPerson": { "Daniel": "college", "Emily": "college" } },
  "top_worry":  { "agreed": "protection", "byPerson": { "Daniel": "retirement", "Emily": "protection" } },
  "detail_level": "low",
  "phase1Complete": true,
  "updatedAt": "2026-11-16T19:40:00+01:00" }
```

(Values above are an example of the shape, not real answers.) The video reads this file + `persona.md` + case JSON (D17).

## 8. Phase 2 — tools

- `get_plan_section(part, section)` → raw JSON/Markdown from the case, whitelisted parts/sections only, size-capped.
- The profile is in the instructions so Sherpy adapts depth (detail_level) and framing (style per person, D15).

## 9. Open / left to decide

- **Q-VOICE (spike):** which realtime model; function calling while talking (yes → tools, no → fallback).
- **Q-EXPERT:** still open; phase 2 + detail_level partly answers it.
- Memory across visits beyond the profile (conversation summaries for day 3 / day 30): not in this MVP unless the team
  asks.
- Which screen opens phase 1 and how the platform shows Sherpy "always available": platform design, not this doc.

## 10. Verification

- Unit tests (TDD): brief builder (every figure in the brief exists in the JSON), option builder per family,
  `save_answer` validation (rejects unknown questions, people, values), profile read/write.
- Grounding check script (§6.4) on recorded test transcripts.
- Manual run on the cheapest model with the Johnsons: full phase 1, then 5 phase-2 questions incl. 2 whose answer is
  not in the plan → Sherpy must decline.
- `/security-review` before done (personal data + exposed backend).
