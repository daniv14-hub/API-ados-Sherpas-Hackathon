# Decisions log

Rewritten 15/11 after reviewing every planning conversation. IDs are stable; don't renumber.

**Status labels**
- `DECIDED` — the team decided it. Closed. Don't reopen without asking.
- `PROVISIONAL` — the team accepted it on a condition (stated). Can change if the condition fails.
- `FACT` — verified in the case data. Not a choice; a constraint.
- Anything not here, or listed in `open-questions.md`, is **not decided**. Ideas the desktop Claude proposed but the
  team never confirmed are listed as open questions, not here.

## Index
| ID | Area | Topic | Status |
|----|------|-------|--------|
| D1 | Conversation | Voice conversation instead of a questionnaire | DECIDED |
| D2 | Couples | Individual matters apart, joint matters mediated | DECIDED |
| D3 | Video | Rendered in the browser, not MP4 / generative video | PROVISIONAL |
| D4 | Video | Built while they talk; numbers never from the LLM | PROVISIONAL |
| D5 | Data | There is no "if you act" projection | FACT |
| D6 | Data / Game | Every improvement shown comes from the plan; scores don't add up | DECIDED + FACT |
| D7 | Process | Solo work gathers info; decisions together | DECIDED |
| D8 | Conversation | A Sherpas mascot leads the conversation | DECIDED |
| D9 | Look | Sherpas brand, integrable into their product | DECIDED |
| D10 | Video | Animated explainer with narration, not stories | DECIDED |
| D11 | Game | Mission-style game: plan steps = levels, progress bar | DECIDED |
| D12 | Tone | Explain reality honestly, measured in their goals | DECIDED |
| D13 | Demo | Demo with the Johnsons, who mostly agree; show the mediation | DECIDED |
| D14 | Video | The "if you act" scene uses what the plan gives | DECIDED |
| D15 | Mascot | Sherpy: suited yak advisor, always available, cheers at checkpoints | DECIDED |
| D16 | Voice | Live agent = realtime speech-to-speech model; demo video = scripted, ElevenLabs voices | DECIDED |
| D17 | Conversation | Profile file per family (JSON); closed, specific phase-1 questions | DECIDED |
| D18 | Agent | Design approved: no calculations, data via the MCP at runtime | DECIDED |

What we ruled out at idea stage (questionnaire, NotebookLM-style menu, expert dashboard, generic video,
favourite-character narrator, video per step, leaderboard) and why: `docs/idea-note.md`.

---

## D1 · Voice conversation instead of a questionnaire — DECIDED (team, 12/11; in idea note)
- `persona.md` has the profile, but its subjective worries section says "None recorded": nobody asked the family.
- A written questionnaire adds friction and people drop out. A voice conversation is smoother.
- The agent knows what it must find out: what worries them, how much detail they want, how much risk they accept,
  which goal is theirs. It keeps the conversation natural while it collects that.
- Sherpas' existing chat is **text only**, so voice sets us apart.

## D2 · Couples — DECIDED (team, 13/11, after asking the Sherpas mentor; in idea note)
- In couples, the agent asks each partner. If they agree, the second one just confirms ("I agree").
- **Individual matters** (each person's retirement account, life cover): each partner gets their own experience.
- **Joint matters** (house, kids' college, joint accounts, debt): the agent talks with both and helps them agree.
  It can fully play the advisor's role (the mentor said this is fine).
- Ruled out: averaging both views (speaks to neither person and hides the disagreement).
- Implementation hint, not decided: with one shared mic, the model can't tell who speaks, so the agent says a name
  before each question ("Timothy, …? And Melanie?") and assigns the next answer to that person.

## D3 · Video rendered in the browser — PROVISIONAL (13/11)
- Browser animation + TTS narration (`eleven-flash-v2.5`), no MP4 render. Estimated ~20–45 s to generate vs 2–4 min
  for Remotion. Generative video (Sora/Veo type) is not in the proxy, is expensive and can't control on-screen figures.
- **Condition:** the team accepted generating the video during the conversation "if it's feasible". If browser
  animation can't reach the look we want (D10), revisit with the team.

## D4 · Build the video while they talk — PROVISIONAL (13/11)
- Base scenes are filled from the case JSON **without AI** before the conversation starts.
- During the conversation, a profile fills up as answers come in (detail level, risk per person, top worry, …).
- At the end, one `gpt-5-mini` call orders the scenes and writes the narration for that profile. It never touches numbers.
- So there's no waiting at the end and no filler talk (the team first thought of chatting to fill the wait; this
  replaced it). Any idle moment is used for something useful: confirm the goal, ask the other partner.
- **Condition:** depends on the voice spike (open question Q-VOICE): can the voice model save profile fields through
  function calling while it talks, or do we extract them from each turn's transcript with `gpt-5-mini`?

## D5 · There is no "if you act" projection — FACT (checked 13/11 in all 4 cases)
- Each case has **one** yearly projection (`projections.yearly`): the **status quo**, with their goals included
  (e.g. Carter's debt jumps to $466K in 2027 = the mortgage). Also in today's dollars (`net_worth_todays_dollars`).
- Inflation 3 % (`generalInflation`), average return ~7.6–7.8 % (`averagePerformance`), already applied.
  Samantha has `averagePerformance: 0` (possible data error, see open questions).
- What the plan does quantify for acting: score before → after per recommendation (`score.top_moves`,
  `combined_moves`), extra savings needed (`requiredExtraSavings`), costs avoided (e.g. Weah $3,240/yr card interest),
  and "have vs need" pairs (e.g. Johnson life cover $250K of $1.6M+).
- Consequence: we can't show "with the plan you'd have 2 houses" without building our own model, which breaks the
  no-invented-figures rule. **How the video shows "act vs don't act" is still open** (Q-VIDEO-ACT).

## D6 · Improvements come from the plan — DECIDED (idea note) + FACT
- Everything we show as an improvement comes from the plan: how much the score goes up, how much money they stop
  losing, which gap closes. Goal amounts use the prices the family gave (e.g. the house they want).
- FACT: score improvements **don't add up**. Weah: card alone 60→62, life cover alone 60→60, both 60→73, all three 78.
  Use only the combinations the plan provides.
- The game has a progress bar (D11). Not decided: what it measures (Sherpas score, share of steps done, or both).

## D7 · How the team works — DECIDED (team, 13/11)
- We're at home on different schedules. Last hackathon we failed by working apart.
- Solo tasks only gather information (`docs/tasks.md`). Anything that needs a decision goes to `docs/open-questions.md`.
- Decisions and building happen in joint Discord sessions (one person shares the Claude Code screen).
- Claude Code proposes options; it doesn't decide product, design or architecture.

## D8 · A Sherpas mascot leads the conversation — DECIDED (team, 13/11; in idea note)
- An animated **mascot character for Sherpas**, big on screen, leads the conversation and is later the voice
  assistant inside the game. The goal: a warm chat that invites people to stay, not a cold Q&A.
- It doesn't jump into questions. Like a good advisor's call: it breaks the ice, says it will ask a few short
  questions to understand their situation, and explains why honest answers matter.
- Ruled out: abstract orb / waveform (looked like Spotify's AI DJ in the first wireframe, 15/11), plain chat screen.
- For the MVP, reacting to the voice (moving with audio volume) is enough; real lip-sync is not required.
- Open: what it looks like, its name, how it's animated (Q-MASCOT).

## D9 · Sherpas brand — DECIDED (team, 15/11)
- The web uses Sherpas' logo, colors and typography and must look like it can be integrated directly into
  Sherpas' existing product.
- Assets only from official sources → `assets/brand/` + `docs/brand.md`. Never invented.

## D10 · Video format — DECIDED (team, 12/11 + 15/11)
- A short **animated explainer with voice narration**, like the shorts of **En Plata** (YouTube @EnPlata_es,
  TikTok @enplata.tv) and **Punto Ciego** (YouTube @PuntoCiegoEconomia). It's the first thing the family sees, so it
  must hook and be about them: personalised to their goals and preferences.
- It tells the story of **their life**: where they are and where they're heading, measured in their goals
  (e.g. their house), not in raw dollars.
- **Visual style, from the references (desktop Claude watched them on 15/11):**
  - Vertical 9:16, about 1 minute, fast pace: one idea per beat, a new element every few seconds.
  - Warm cream / paper background. Flat illustrated icons and simple charts with thick dark outlines and a slight
    drop shadow, like stickers. Objects can have tiny friendly faces (Punto Ciego's smiling boxes).
  - A simple character labeled "TÚ" ("YOU") stands for the viewer inside the scene.
  - Big heavy black headline at the top with the key word on a colored highlight block; stamp-style labels
    (e.g. a tilted red "NOT THE STORE" stamp, red "– warehouses" tags) pop in.
  - Captions word by word in sync with the narration, key words highlighted.
  - Elements animate in sync with the voice: pop/scale in, bars grow, grids fill, counters tick.
  - Real numbers on screen, always sourced. Ends on a hook/question.
  - Our version swaps their palette for the Sherpas brand (D9) and speaks English.
- **Not** the stories format (no story progress bars, tap-through cards, static slides with captions). Rejected 15/11.
- This style is flat 2D shapes + text + timing, so it can be built in the browser (D3).
- The "if you act" scene: see D14.

## D11 · The game: missions toward their goal — DECIDED (team, 12/11–15/11)
- After the video they enter a game they can come back to day after day.
- **Each step of the plan to reach their goal is a level of the game**, presented as a **mission**. Big actions
  are split into small steps. Completing a step is a **checkpoint**: the progress bar updates.
- There is a **progress bar** toward their goal. The house that builds piece by piece is **removed** (15/11).
- It must look and feel like a game: very visual, mission format, rewards, the urge to keep levelling up to reach
  the goal. At the same time it keeps the Sherpas brand and a serious tone (it's their money).
- The mascot answers questions by voice. Reminders/notifications so they act.
- Ruled out: a video per step (levels are shorter, interactive, cheaper); a leaderboard between families (privacy);
  a checklist / to-do list with a score ring (first wireframe, 15/11: doesn't hook); the house that builds (15/11).
- Open: what the progress bar measures (Q-PROGRESS); how a real-world action is confirmed (Q-CONFIRM).

## D12 · Tone: honest reality, in their goals — DECIDED (team, 12/11)
- We explain the reality of their situation and that following the plan makes it better. No fear tactics, no
  exaggeration, no invented data.
- Big numbers mean nothing to them; their goals do. Goal comparisons use the prices in their own plan.

## D13 · The demo — DECIDED (team, 15/11)
- We demo with **a couple**. They agree on almost everything except one or two details, and the demo shows the
  mascot mediating until they reach an agreement (D2).
- **Couple: the Johnsons** (Dani, 15/11). Data-backed difference: Daniel is Growth, Emily is Moderate; their central
  question is "college or retirement first?". Case id `daniel-emily-johnson`.
- Open: which one or two details they disagree on in the demo script (Q-DEMO-SCRIPT).

## D14 · The "if you act" scene — DECIDED (Dani, 15/11)
- The video tells what happens if they act using **what the plan gives** (D5, D6): the gaps that close (e.g. Johnson
  life cover $250K of $1.6M+ → covered), the score that goes up (only plan combinations), the money they stop losing.
- No future wealth figure and no "2 houses" multiples on the act side: we don't have that data and we don't build it.
- Nothing more to it: say what will happen if they act, with the plan's own effects.

## D15 · The mascot: a virtual financial advisor, always present — DECIDED (team, via Dani, 15/11)
- The mascot is **very much the protagonist** of the whole experience. It is a **virtual financial advisor**, drawn
  as a **2D avatar**. Extends D8.
- It is **always available**: the family can ask it questions at any point of the experience, not only in the game.
- **At every completed level** (checkpoint, D11) the mascot appears with a **short line** that encourages them to keep
  completing levels and shows them they are **closer to their goal**.
- **Checkpoint lines adapt to the person's profile** (team, via Dani, 15/11): a more **analytical** person gets
  progress data (e.g. % of the way, how the score rises); a more **emotional** person gets motivational lines.
  So the conversation must also capture analytical vs emotional as a profile field (D4). Data lines still follow
  D6 (only score combinations the plan gives) and Q-PROGRESS (what "% of the way" means).
- **Availability during the video — PROVISIONAL** (team, via Dani, 15/11): if letting them ask the mascot while the
  video plays complicates the build, the mascot becomes available only after the video, in the game.
  Condition: decided when we build the video player.
- **Look: built from the yak silhouette** of the official hackathon banner (`assets/banner.png`) — DECIDED (team,
  via Dani, 16/11). Replaces the earlier "2D advisor avatar" idea for the look; it keeps the advisor role.
  Refined the same day (team, via Dani, 16/11): a **personified, friendly, executive yak in a suit and tie**.
  Proposal v3 (closer to the banner yak): `prototypes/mascot/index.html` + `assets/mascot/yak.svg`, **pending team approval**.
- **APPROVED (team, via Dani, 16/11):** design and animations of v3 (idle, listening, talking by voice volume,
  checkpoint hop). **Brown fur. Name: Sherpy. No accessories.** Files: `assets/mascot/sherpy.svg`,
  `prototypes/mascot/index.html`, generator `tools/sherpy_svg.py`. Q-MASCOT is closed.
- Constraint from the hard rules, not a new decision: any figure in those checkpoint lines must come from the case
  data (D5, D6). How "closer to the goal" is measured depends on Q-PROGRESS.

## D16 · Voice architecture — DECIDED (team, via Dani, 16/11)
- **Live product:** option A, a **realtime speech-to-speech model** (one model hears and speaks, with its own voices).
  Chosen for simplicity and a natural sound. No ElevenLabs in the live agent.
- Ruled out: B, a pipeline STT → text LLM → ElevenLabs TTS (more latency, turn-taking and interruptions built by hand,
  ~40 min ElevenLabs cap for the whole team); C, realtime model with text output + ElevenLabs (unverified on the proxy).
- **Demo video recording:** **100% artificial**, scripted and voiced with **ElevenLabs** (simulated, not live).
  Recommended by the Sherpas mentor, who wants teams to use the ElevenLabs credit.
- **Model: `gemini-3.8-live`** (team, via Dani, 16/11, after the spike): tool calling works (1.1–1.5 s) and it continues
  on its own after a tool output. `gpt-realtime-2.1-mini` untestable (proxy returns `expired_secret_key`; reported to
  Sherpas). Re-run the spike if they fix it. Closes Q-VOICE.
- Agent behaviour ("hybrid", team's words): phase 1 = advisor role with predetermined questions to break the ice and
  fill the video profile; phase 2 = connected to the Sherpas context, freer to reason, without hallucinating.
  **Sherpas context = only the case data from the MCP (same as `cases/`). Inventing any figure or fact is strictly
  forbidden** (team, 16/11). Design draft: `docs/superpowers/specs/2026-11-16-voice-agent-design.md`.

## D17 · The conversation profile — DECIDED (team, via Dani, 16/11)
- What Sherpy learns in phase 1 is saved as a **JSON profile file per family on the backend** (git-ignored).
  Ruled out for now: SQLite (more work), browser storage (one device only; partners would get different profiles).
- The **video is built from this profile file plus `persona.md`** (and the case JSON for every figure, D5/D6).
- Phase-1 questions are **closed and specific**, so answers can be evaluated without ambiguity.
- Updated live by the voice model through function calling, if the spike confirms it (Q-VOICE); fallback: `gpt-5-mini`
  extracts fields from each turn's transcript.
- **Question list APPROVED (team, 16/11).** Options come from each family's data:
  0. Ice-breaker: who is present (`household`).
  1. Main goal now → options from `goals.goalsSummary` (Johnson: retirement / college / vacation).
  2. Top worry → options from persona objective concerns (Johnson: retirement / protection / college / debt / none).
  3. Per person: "investments drop 20% in a year: sell, wait or buy more?" → conservative / moderate / growth.
  4. Per person: "numbers or what it means for your family?" → analytical / emotional (feeds D15 checkpoint lines).
  5. Detail level: big picture / key numbers / everything → low / medium / high.
  The save function only accepts these values; unclear answers are re-asked with the options; partner disagreement
  on 1–2 is stored per person and mediated (D2, D13).

## D18 · Voice agent design — DECIDED (team, via Dani, 16/11)
- Design approved: `docs/superpowers/specs/2026-11-16-voice-agent-design.md` (two phases, four context layers,
  validated `save_answer`, grounding check).
- **Sherpy never calculates.** It only says figures exactly as they appear in the data.
- **Data comes from the Sherpas MCP at runtime**, not from `cases/` ("they give it to us for a reason; they want us to
  use it"). Accepted costs: 72 h token renewal, MCP access ends 21/11, network round trip per lookup.
- **One session, both phases (team, via Dani, 16/11):** the proxy/Gemini ignore a mid-session `session.update` (tested:
  instructions ALPHA→BRAVO kept answering ALPHA). So Sherpy gets both phases' instructions and both tools
  (`save_answer`, `get_plan_section`) from the start; it asks the phase-1 questions first and can still answer plan
  questions at any moment. A returning family with a complete profile starts with phase-2 instructions only.
  Ruled out: reconnecting for phase 2 (1–2 s cut, loses the conversation), rules as a conversation item (unverified).
- The pitch is a presentation; the MVP is not shown live. **The jury won't run the MVP**: it is only shown in the
  demo video. So no fallback to `cases/` files; if the MCP fails, Sherpy says it can't reach the plan right now.

