# Pillar 3 — the mission game: context to design it

Purpose: brief for a Claude (or the team) who will think the game through. **Nothing in the "Open" lists is decided.**
Project: APIñados, Sherpas Wealth Hackathon, challenge "Bring the plan to life". Team: Dani, Javi, Nico.
Delivery Wed 18/11 23:59 (public repo, run steps in README, 2-min demo video, one page in English). Pitch Thu 19/11.
Rubric asks if it works for someone new to finance and for an expert.

## Where the game sits
Journey: **voice conversation with Sherpy (done) → personal explainer video (done) → game (not started)**. The video ends
on the "mission" scene ("Your first mission is {first move}. It is the first step toward {main goal} in {year}."), so the
game is its continuation. UI for the whole journey is meant to be one coherent product, mobile first.

## What is already decided (docs/decisions.md; D6, D7, D11, D12, D13, D14, D15)
- **Each step of the plan is a level, presented as a mission.** Big actions are split into small steps. Completing one is a
  **checkpoint**; a **progress bar** moves toward their goal. They can come back day after day.
- Must look and feel like a game (very visual, mission format, rewards, urge to level up) **and** stay on-brand and serious
  (it is their money). Tone: honest, no fear, no exaggeration (D12).
- **Sherpy** (virtual financial advisor, 2D avatar, always available) appears at **every completed checkpoint** with a short
  line that encourages them and shows they are closer to the goal; answers questions **by voice**; reminders/notifications.
- Ruled out: a video per step; leaderboard between families (privacy); checklist/to-do with score ring (doesn't hook);
  the house that builds piece by piece.
- **Never invent figures.** Every number comes from the case data. **Scores do not add up** (D6): only improvements the plan
  itself gives are shown (per-move `score_before → score_after`, and the plan's own `combined_moves`).
- Demo couple: the Johnsons (`daniel-emily-johnson`). Daniel is Growth, Emily Moderate; central question "college or
  retirement first?".
- Team rule (D7): propose options, the team approves; Claude doesn't take product/design decisions alone.

## Open questions (docs/open-questions.md, still open)
- **Q-PROGRESS** — what does the progress bar measure? A) the Sherpas score (only plan combinations) · B) share of steps
  completed · C) both (bar = steps, score shown at checkpoints).
- **Q-CONFIRM** — how does the game know a real-world action is done? Self-declared ("I did it") is enough for an MVP,
  but it must be said explicitly.
- **Q-EXPERT** — how do we serve experts (agent detects expertise / ask Sherpy for details / both)?
- **Q-DEMO-SCRIPT** — which one or two details do the Johnsons disagree on in the demo?
- Also unanswered: how much of the game is real (persisted progress) vs shown in the demo video only. The team has
  said the MVP may be only shown in the demo video (docs: "no MCP fallback, MVP only shown in demo video").

## Data the game can use (all from the Sherpas MCP / `cases/<id>/financial-health.json`)
`score.top_moves[]`: `{title, action, effort (low|medium|high), target_amount, score_before, score_after, lifts_a_cap}`;
`score.combined_moves[]`: `{moves[], score_after, note}`. Johnson example (score 52, "vulnerable"):
- Raise mortality coverage — add $1,166,000 life cover (to $1,616,000) — low effort — 52→57
- Add umbrella cover — $1M umbrella — low — 52→56
- Raise annual savings — redirect $15,032/yr of free cash flow — medium — 52→55
- Combined best: 52→60 (e.g. life cover + umbrella). Weah example (D6): card 60→62, life cover 60→60, both 60→73.
- Carter: umbrella 26→31, lower withdrawal rate 26→62 (high effort); `combined_moves` is empty — a case can have no combos.
Also available: per-pillar scores (weakest: protection 0/20 for the Johnsons), goals (college 2033 and 2035, retirement 2044),
gaps (college $106,552 short, retirement $1.43M short, 1 month of cash vs 8–9), life-cover shortfalls per adult, free cash
flow. The family profile from the conversation (risk per person, style analytical/emotional, main goal, top worry, detail
level) is in `data/profiles/<caseId>.json`. Facts extraction for the video is in `agent/src/video/facts.mjs`
(`buildFacts`) and can be reused. Constraint: `top_moves` often has only 3 moves — "split big actions into small steps"
needs sub-steps that the plan does not provide; deciding how to split without inventing numbers is a real design problem.

## What we already have to build on
- Node 22 ESM server in `agent/` (`npm start` → http://localhost:5173), plain HTML/CSS/JS + inline SVG, no build step, no
  framework (a deliberate choice; Remotion/React rejected for the video).
- Sherpas brand tokens (`assets/brand/tokens.css`, logos) and the **Sherpy** SVG mascot (`assets/mascot/sherpy.svg`,
  brown yak, no accessories). Never invent brand assets.
- The video's "sticker" visual style (flat shapes, navy outlines, hard shadows) in `agent/public/video-shapes.mjs` and
  `video-stage.mjs`: the game can share it. Conversation screen design (option A) in
  `docs/superpowers/specs/2026-11-17-conversation-screen-design.md`.
- Voice: Gemini realtime (voice Charon) for the conversation via the proxy; ElevenLabs TTS (`/v1/audio/speech`,
  `eleven-flash-v2.5`) for narration lines. Sherpy lines at checkpoints could be generated like the video narration
  (model writes wording, numbers via placeholders, guards check) or fixed per mission.
- Constraints: $50 team budget (spent ~$3), ElevenLabs capped at $1.40 for the whole team, 60 req/min and 4 concurrent;
  API access ends 21/11. UI/narration in English. Secrets only in the backend.

## Things worth deciding in the design session
1. What is the core loop of one mission (screen by screen), and what is the reward at a checkpoint?
2. What does the progress bar measure (Q-PROGRESS) and what does it look like when a plan move gives 0 points
   (e.g. life cover alone 60→60 in Weah)?
3. How is a mission ordered: by the family's main goal and worry from the conversation, by effort, or by score gain?
4. How are big moves split into small steps without inventing numbers (e.g. "get quotes → compare → sign")?
5. What does "coming back day after day" mean in a hackathon MVP: persisted state, a reminder, a streak? (Streaks and
   rewards must stay serious and not pressure people about money.)
6. Real vs demo: build a clickable prototype with real data for the Johnsons, or only script it for the 2-min video?
7. Where does Sherpy speak (text, voice, both) and can the family ask it questions mid-mission?
8. How do two people (Daniel and Emily) share one game — one plan, two profiles?
9. Fit for a newcomer and an expert (Q-EXPERT).

## Time reality
~30 hours to delivery, Claude Code usage limited tonight (tokens reset overnight). A clickable, data-driven single-case
(Johnson) prototype of 3–5 screens is realistic; a full multi-case persistent game is not. Whatever is designed must be
buildable in the plain-HTML stack above and approved by the team first (D7).
