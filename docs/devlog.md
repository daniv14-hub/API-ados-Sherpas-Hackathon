# Devlog — APIñados @ Sherpas Wealth Hackathon

Timestamped entries (Europe/Madrid). Milestones, blockers, surprises and pivots, with real numbers.

---

### Thu 12/11
- **13:10** — Read the whole event Discord through the browser with Claude, instead of screenshots, and turned it into `docs/HACKATHON_CONTEXT.md`.
- **15:00** — Kick-off at UPV (1E, room 2.3): the challenge, Sherpas, and an intro to MCP.
- **18:20** — Read the starter repo README and logged where it disagrees with Discord (submission command, public repo, length of the final write-up).
- **Evening** — First whiteboard session. The written questionnaire was crossed out because `persona.md` already has the profile. It came back as a **voice** conversation, because the file doesn't capture the family's real worries. → photo for `docs/screenshots/`.
- Checked the 4 cases' JSON: there is **no "if you act" projection**, only the status quo plus score deltas. This shaped the video (D5) and the game (D6).

### Fri 13/11
- Asked the Sherpas mentor how to handle couples who disagree. Answer: AI mediation is fine, and per-person experiences fit the individual accounts. → D2 (B for individual, C for joint).
- **18:20** — Repo set up for Claude Code: `CLAUDE.md`, `docs/` (context, decisions, devlog, screenshots). Next: spike on `examples/voice/`.
- **Evening** — A teammate proposed splitting the work so each of us can advance from home. First proposal (three independent pieces: voice / engine / player) was rejected by Dani: last hackathon we failed by working apart. New rule: solo work only gathers information, decisions are taken together → D7. Message with 4 solo tasks sent to the group.

### Sun 15/11
- Context docs updated: `CLAUDE.md` gets a "Current status" section and team rules (D7); added `docs/open-questions.md` and `docs/tasks.md`. Reason: Claude Code was working from the 13/11 docs, which didn't include the team rules or the current state.
- First Superpowers brainstorm in Claude Code: wireframe of the Weah flow in 3 phone screens (Talk → Your video → Your path), in `.superpowers/brainstorm/`. Every figure checked against `financial-health.json` (life cover $140K/$750K and $110K/$600K; score 60→62→73→78). Pending team review.
- **19:30** — Team rejected the first wireframe. Figures were right, but: an abstract orb instead of the **Sherpas mascot** (it looked like Spotify's AI DJ), no **Sherpas branding**, a **stories-style** video nobody asked for, and a **checklist** instead of a game. Root cause: the mascot and minigames were in the idea note but never made it into the repo docs, and "TikTok-style vertical video" was read as stories. Fixed: `docs/idea-note.md` added, D8–D11 logged, `CLAUDE.md` rewritten.
- **20:00** — Desktop Claude reviewed all three planning conversations and rebuilt the context system: short stable `CLAUDE.md`, new `docs/STATUS.md` (current state, rewritten after every planning session), `decisions.md` rewritten with status labels (DECIDED / PROVISIONAL / FACT). Finding: two "decisions" (have-vs-need visuals, score as progress bar) were the desktop Claude's proposals, never confirmed by the team. Moved to open questions.
- **20:15** — Team decisions: the house that builds is out, the game gets a progress bar; each plan step is a mission-style level with a checkpoint (D11). Demo with a couple that mostly agrees, to show the mediation (D13). Desktop Claude watched En Plata and Punto Ciego shorts and wrote the visual style into D10.
- **20:30** — Brand collected from the live Sherpas client app and website: official wordmark SVG, design tokens (brand blue #4666d7, blue-tinted grays, Poppins headings + Inter body, 10px radius) in `assets/brand/tokens.css`, 4 reference screenshots. Couple for the demo: the Johnsons (D13). "If you act" scene uses the plan's own effects (D14).
- **Evening** — Team decision on the mascot (D15): a virtual financial advisor as a 2D avatar, the protagonist of the whole experience, always available for questions, and it pops up with a short encouraging line at every completed level. Look, name and animation are still open (Q-MASCOT, to be agreed 16/11).
- **Evening** — D15 extended: checkpoint lines adapt to an analytical (progress data) vs emotional (motivational) profile, captured in the conversation. Asking the mascot during the video is provisional: dropped (available from the game on) if it complicates the build.
- **20:45** — Desktop Claude synced after the Claude Code session: D4 now captures analytical vs emotional per person (needed by D15), Q-MASCOT narrowed to look/name/animation, `STATUS.md` rewritten with the plan for Mon 16/11.

### Mon 16/11
- **17:55** — Team switched the mascot look to the yak from the hackathon banner. Traced the silhouette from `assets/banner.png` (scikit-image contours → SVG, scratchpad venv), added an eye and a mouth, and built `prototypes/mascot/index.html`: idle / listening / talking (TTS demo or real mic volume) / checkpoint states, navy and light variants, sizes, "Ask me" button. Proposal v1, pending team review.
- **18:15** — v1 was unreadable in Safari: it opened via `file://`, Safari didn't load `../../assets/brand/tokens.css`, so every `var()` failed (white yak on white). Only checked in Chrome before. Fix: brand tokens inlined in the page. Team asked for a personified executive yak in suit and tie → v2 drawn as a bust (thick dark outlines, D10 sticker style), brown or white fur, suit/tie in Sherpas blues. Checked in headless Chrome: idle and talking states render.
- **18:40** — v3 after team feedback ("closer to the Sherpas logo"; read as the banner yak, since the official logo is only the wordmark): white smooth fur by default, thin banner horns, the banner's dark crescent reused as eyebrows, navy (#0b0f2e) outlines, navy stage by default. Fixed the tie being cut by the lapels (deeper shirt V, tie drawn on top and kept inside it). Brown fur kept as an option.
- **19:00** — Team approved the mascot: **Sherpy**, brown fur, no accessories, v3 design and animations. Prototype set to brown by default; SVG at `assets/mascot/sherpy.svg`. Next: the voice agent (brainstorming started).
- **19:20** — Voice agent brainstorm. Found: realtime voice models can't use ElevenLabs voices, and ElevenLabs is capped at $1.40/team (~40 min of flash). Team chose option A (realtime speech-to-speech) for the live agent; the demo video will use a scripted conversation voiced with ElevenLabs (D16).
- **20:00** — Voice agent design written and approved (D17, D18): closed phase-1 questions, profile JSON per family, Sherpy never calculates, data via the MCP at runtime. Spec: `docs/superpowers/specs/2026-11-16-voice-agent-design.md`.
- **20:30** — Implementation plan `docs/superpowers/plans/2026-11-16-sherpy-voice-agent.md` approved by the team (Dani, 16/11), execution: subagent-driven. Blocked on the root `.env` (needs `MCP_TOKEN` + `TEAM_KEY`; only `examples/voice/.env` with `TEAM_KEY` exists).
- **20:50** — Voice spike (Q-VOICE), tool calling on the proxy. `gemini-3.8-live` (3 runs): OK. `function_call` `save_answer` in 1.1-1.5 s with correct arguments (e.g. `{"person":"Daniel","value":"college for the kids",...}`). It continues on its own after the `function_call_output`: with `--no-response-create` (we send nothing after the tool output) a new `response.created` still arrived ~0.7 s later, with audio plus transcript "Thanks, Daniel. I've noted that your main goal is saving for your kids' college." So the agent doesn't need `response.create` for Gemini. `output_modalities:["text"]` is ignored (audio comes back). `gpt-realtime-2.1-mini` (2 runs): connects, but the first event is an error `expired_secret_key` ("Your API key has expired"), upstream closes with code 3000, so tool calling is untested (likely an OpenAI-side key on the proxy, to report to Sherpas). Spend: `key/info` updates late (read 0.0 right after the first Gemini run, 0.0029 USD afterwards), so cost can't be split per run or per model; total about 0.003 USD.
- **21:10** — Team chose `gemini-3.8-live` for Sherpy (closes Q-VOICE). Continuing the plan from Task 2.
- **22:30** — Tasks 2–5 done and reviewed (60 tests). Found: Gemini via the proxy ignores a mid-session `session.update` (ALPHA/BRAVO test, ~$0.002), so the phase switch can't work as designed. Team chose one session with both phases and both tools (D18). Also hardened the relay: the browser can no longer inject instructions or tools.
- **23:30** — Tasks 1–7 of the Sherpy plan done, each with a task review; final whole-branch review → fixed localhost-only binding + Origin check, mid-tool-call close, instructions leaking via `session.*` events, MCP reconnect. 77 tests green. Waiting for the team's live voice test (Task 8).
- **20:50** — First live voice test (Dani, Johnsons, gemini-3.8-live): team verdict "a disaster". From the transcript: (1) phantom user turns "¿Qué?" while nobody spoke (5 times) and the opening was in Spanish, replying to the first phantom; (2) robotic voice (no voice set for Gemini, default used); (3) risk disagreement (Daniel buy more, Emily sell) not mediated — the design only mediated goal/worry, though D13 says risk is the couple's real difference; Q1/Q2 asked jointly, not per partner; (4) confusing ending ("Your plan section is now complete") and no handoff to the video — the design jumped straight to Q&A. Profile saved complete; grounding check OK (only "52" said). Cost of the ~4 min test: ~$0.39 (spend 0.011 → 0.404).
- **21:15** — Debugging the live test (`agent/scripts/probe-voice.mjs`, ~$0.065 in probes). (1) 24 s of digital silence + faint noise through server VAD: **zero** speech detections or transcripts → the "¿Qué?" turns were real sound reaching the mic (room voices / speakers), not hallucinations. (2) Spanish: synthetic Spanish audio ("¿Qué?", and "¿Ya está funcionando esto? Javi, callaros…") with the real 21K-char Sherpy instructions → English all 4 times; the Spanish opening is not reproducible, so treat as sporadic. (3) Voice: the proxy honours `audio.output.voice` for Gemini (8 voices give different pitch: Puck 117 Hz, Orus 120, Charon 151, Fenrir 174, Zephyr 192, Aoede 203, Leda 215, Kore 224); our page only set a voice for OpenAI, so Gemini used its default. Samples in `data/voice-samples/` (git-ignored).
- **21:35** — Correction to 21:15: the phantom turns **are** hallucinations. Synthetic non-speech sounds reproduce them: a 0.7 s breath and a 0.25 s cough are each transcribed as "¿Qué?" and Sherpy answers (the cough run answered **in Spanish**, exactly like the live test); keyboard clicks and constant faint noise don't trigger. A stricter VAD (`threshold: 0.9`) changes nothing (the proxy seems to ignore it). Team chose the Charon voice.
- **21:55** — Technical fixes, each verified against Gemini: (1) Charon voice forced server-side; (2) Sherpy greets first in English via a hidden kickoff message (no longer waits for the first sound); (3) speech gate in the page (`agent/public/speech-gate.mjs`): only voiced sound goes up — with it, breath/cough produce no turn at all and real English/Spanish speech is still transcribed; (4) rules: English even if another language is heard, never re-introduce, "Sorry, I didn't catch that." — with an ungated cough after the greeting, 1 of 2 runs was perfect, the other apologised but re-introduced itself (the gate is the real fix). 86 tests. Probes cost ~$0.12 in total (spend 0.404 → 0.521).
- **22:45** — D19 implemented: natural conversation with an agenda, mediation, confirm-before-save, closing line + `finish_conversation` → page shows a video placeholder and the voice session closes. Shorter interview brief. Found and fixed my own bug: the speech gate was created in the wrong function, so the open-mic page would have sent no audio; now verified end to end in headless Chrome with a fake mic. New `agent/scripts/e2e-conversation.mjs` (synthetic Daniel/Emily, reacts to Sherpy): full run reached the closing line, profile complete, goal disagreement mediated; risk difference acknowledged but Sherpy changed topic in the same turn → rule tightened (not re-run). Each 5-min run costs ~$0.5 (context re-billed every turn); spend now $1.62. 93 tests.
- **23:20** — Team's second live test: "ya no es una mierda". Issues from the transcript: closing line cut (Sherpy called finish_conversation before speaking it, the page hung up at once); stuck on the style question when Daniel said "both" (same question 3 times); saved Emily's style from a garbled transcript ("Seis más de Neil") = a guessed value; re-greeted after an early "Hello". Fixed (server waits for the reply after the tool, page waits for audio to stop; rephrase rules; never save a guess). E2E rerun: "both" now handled in one turn ("which would you prefer to start with"), risk mediation rephrased each time; the run timed out before the closing (scripted-driver mismatch), so the closing fix is covered by unit tests only. 96 tests. Spend ~$2.5.

### Tue 17/11
- **12:10** — Third live test (Johnsons, laptop speaker, no headphones): "como al principio". 1 min 20 s, only `present` saved. 6 of 9 user turns were ghosts ("¿Qué?", "Aia", "chica", "muy bien", "de", "top"): Sherpy's own voice leaking from the speaker ("top" 1 s after Sherpy said "top priority", and it cut that reply) plus Spanish room talk. The speech gate only drops non-voice, so any voice got through, and `speech_started` stopped playback. Team: it must work on a normal laptop; Sherpy must not be interruptible (finish the sentence, then answer).
- **12:16** — Team chose to revert 558eaa3 (test-2 fixes) and start from the previous version, then redo the fixes only if they still fail (Dani). Reverted with `git revert` (history kept).
- **12:35** — Half-duplex open mic (`agent/public/half-duplex.mjs`): mic sends silence while Sherpy's audio plays + 0.5 s; open mic no longer cuts playback. Verified in headless Chrome with a fake mic (room recording: "Que? Muy bien, chica." twice during the greeting, then "We are Daniel and Emily."): greeting played in full, no ghost turn, the answer got through and Sherpy replied. Note: Chrome's fake mic file only works with `--no-sandbox` and a file under the project. 97 tests. Spend $2.54.
- **16:15** — Conversation screen: 3 proposals in portrait and landscape (A light "advisor call", B dark stage with subtitles, C sticker speech bubble). Team chose **A** ("nos encanta"), without the "Daniel & Emily · getting to know you" text. "End conversation" = confirm, then pause with "Continue with Sherpy" (answers kept, resumes at the first missing topic). Spec: `docs/superpowers/specs/2026-11-17-conversation-screen-design.md`, mockup `prototypes/conversation/index.html`. Not built yet; next: the video.
- **17:00** — Video brainstorm with the team: ElevenLabs voice for Sherpy (video + scripted demo), **horizontal 16:9** with a "rotate your phone" overlay (changes D10's 9:16), 5 scenes approved (goals → where you stand → what worries you → if you act → first mission), personalisation table approved, Sherpy on screen at start and end. Remotion considered and rejected: needs React + build, sync costs the same, MP4 export not needed (screen recording), licence unclear. Hand-built HTML/CSS/JS. No more skills installed. Design draft: `docs/superpowers/specs/2026-11-17-explainer-video-design.md`.
- **17:30** — Video design approved by the team. The team wanted a Claude model to generate the video; dropped because Claude isn't on the hackathon proxy (11 models listed, none Claude) and would be paid outside the $50. Narration stays `gpt-5-mini`. No questions to Sherpy during the video (D15 condition).
- **18:00** — Video implementation plan `docs/superpowers/plans/2026-11-17-explainer-video.md` approved by the team (Dani, 17/11). Sherpy's ElevenLabs voice: **onyx**. Execution: subagent-driven, on branch `feat/explainer-video` (from `feat/sherpy-voice-agent`).
- **17:40** — Explainer video built (plan Tasks 1–7 subagent-driven with task reviews; Task 8 inline at Dani's request). First real Johnson build: 18.3 s (gpt-5-mini 16.2 s), one TTS clip refused with 429 (5 parallel > the proxy's 4 concurrent), every line greeted the family. Fixes: `reasoning_effort: minimal` (measured 7.1 s default / 3.2 s low / 1.9 s minimal on a one-line probe; ~2 s for the 5 lines) with code guards (greeting only in line 1, main goal named, honesty rule — minimal once praised a score of 52), TTS 3 at a time + retry on 429. Now **4.6 s** per new video, 0.2 s cached; 0 ungrounded numbers; 34 s long with Sherpy's voice (onyx). 139 tests. Spend $3.00.
- **18:00** — Team feedback on the real video: too short, broken thread (college gap shown, life cover proposed), repeated their answers. Approved the 'roller coaster' story (dream → hard truth → it has a solution), ~2 min, 7 scenes (spec Revision 2, plan `2026-11-17-video-story-v2.md`, approved by Dani).
- **18:45** — Video v2 (roller coaster) built for the Johnsons: 7 scenes, **2:04**, generated in 9.5 s (0.2 s cached), 0 ungrounded numbers. Fixes after the first v2 build: minimal-effort gpt-5-mini wrote one run-on sentence per scene → lines with ';' or a sentence > 20 words fall back to the template; `act` is template-only (the model called the 52→55 score change a retirement-gap change). 154 tests. Spend $3.08.

## 17/11 ~19:30 — session wrap (Claude Code)
- Team feedback on the Johnson v2 video: layout and script OK, **voice too monotone** (needs emphasis and dynamism). Not changed (no tokens).
  Ideas, cheapest first: narration prompt asks for varied rhythm/pauses; a more expressive ElevenLabs voice id; another `eleven-*` model on the proxy
  (check `/v1/models`; ElevenLabs cap $1.40 team-wide); voice settings (stability/style) if the proxy passes them.
- Decisions to move to decisions.md (desktop Claude): End conversation = confirm and pause (Dani); Sherpy narration voice `onyx` (ElevenLabs via proxy).
- `/security-review` on `feat/explainer-video`: nothing at confidence >= 8. Innerhtml sinks only get static icon markup; case ids are allow-listed; audio index
  comes from the built video; server binds 127.0.0.1 with an Origin check on the WebSocket. Low-confidence notes: no Host check on HTTP (DNS rebinding), and any
  local page can trigger `GET /video/<case>` (a paid build, once per profile hash).
- README "Run Sherpy" added; `docs/pillar3-context.md` written as a brief for designing the game; STATUS updated.

## 17/11 ~22:45 — overnight run started (branch `feat/journey-ui`, approved by Dani for autonomous work)
- Plan: `docs/superpowers/plans/2026-11-17-journey-ui.md` (conversation UI → hand-off → video → missions). Mission content from the desktop handoff
  (copied to `docs/handoff-missions-content.md`).
- Provisional rulings (team to review): Q-CONFIRM = self-declared "I did it"; Q-PROGRESS = C (bar = steps, score at checkpoints, exact lookups only);
  life cover uses FH ($1,166,000 added → $1,616,000), PDF conflict to ask in #dudas-reto-mcp; M8 investment mix is a mission, last, no score;
  progress kept in the browser per case; checkpoint lines are templates with real data (no model/TTS); non-Johnson missions derived from top_moves.
- Done: Task 1 content (a67f42e: 8 missions/26 steps, listAdvice, exact score lookup, coverage tests); Task 4 missions screen (2631ce9);
  Task 2 conversation screen option A (c3de643; old bench kept at /bench.html). Tests 184/184.
- Live voice: a subagent saw no audio in headless Chrome; a plain ws client against our /voice got Sherpy's greeting in 1.5 s, so server+proxy work.
  Being diagnosed in Task 3. Spend $3.14.

## 17/11 ~23:20 — journey built and verified (overnight run)
- Task 3 hand-off (ef18f25): conversation → video (`flow=1`, autoplay or one big "Watch your video") → end card → missions; rotate hint on portrait
  phones; `/journey/<case>` reports only `{phase1Complete}` for the "Welcome back" screen. Live-voice "no audio" was a test artefact (non-stop
  fake-mic speech kept the VAD open); with a silent mic Sherpy speaks 1.26 s after Start.
- Real e2e (synthetic voices, 5 min, ~$0.3): goal disagreement mediated, risk difference named, closing line → `conversation_done` → video built
  before the page asked for it. Bug seen: `detail_level: low` saved although nobody answered the detail question (Sherpy asked, then closed).
  Demo profile restored from `data/archive/johnson-demo-profile-backup.json`; e2e profile kept in `data/archive/`.
- Final review (Opus) on 67850de..HEAD: 0 critical, 5 important fixed (a660df4, 672cf47), 12 minors parked. 195 tests. Spend $3.50.

## 17/11 ~23:40 — overnight run finished
- UI minors fixed after the review (99902c6). 198 tests green.
- Voice options for the monotone narration: `docs/voice-options.md` + 6 samples in `data/voice-samples/compare.html` (1,057 TTS characters, ~$0.06).
  Recommendation to try first (same cost): prosody-rewritten text and stability 0.25; then eleven-v3 with tags (2× cost) vs voice "Brian". Not applied.

## 2026-11-18 ~10:30 — Journey arrows and the Sherpy bubble
- Team (Dani, 18/11) asked: every screen can go to the previous/next one, and Sherpy is always reachable through a bubble.
  Choices (Dani, via question): ‹ Previous / Next › arrows at the bottom; the video and the missions stay locked until the
  conversation is complete ("hasta que no acabe la conversación… no se puede saltar"); bubble only on the missions
  (map and every mission), bottom right.
- `journey-nav.mjs` + `journeyNav()` (3 new tests, 201 pass). Locked "Video ›" explains why on tap.
- `sherpy-chat.mjs`: tap → panel with Sherpy, live captions, turn pill; reuses the voice client, so the server runs it as
  the phase-2 advisor. Hangs up on close, on leaving the page and after 90 s of silence (voice is billed while open).
- Verified headless at 390×844, 844×390, 1280×800 (no horizontal scroll) and one live call: phase 2 greeting in ~5 s,
  turn switched to the family, close → "session closed" in the server log.

## 2026-11-18 ~13:45 — Shorter Sherpy chat, chat that carries on, no ‹ Video inside a mission
- Dani's test (transcript 12:32): long greeting and long answers, a reply even to "Mmm". Phase 2 now opens with exactly
  "Hi, I'm Sherpy. How can I help you today?" and answers in at most three short sentences, no filler follow-ups.
- Closed and reopened chat: the server keeps the phase-2 lines per case in memory (2 h, 24 lines, `chat-memory.mjs`);
  a reopened chat gets them in its instructions, Sherpy doesn't greet and waits; the page shows its last line
  (`sherpy.resumed`). Lost on server restart.
- ‹ Video arrow only on the missions map. 206 tests pass. Live: greeting verified, reopen silent with "Your turn".
  Answer length on a real question not verified live (silent fake mic).

## 2026-11-18 ~13:55 — Ask Sherpy knows the missions and the screen
- Dani's test 12:42: no greeting (my test's lone greeting had been kept as an "earlier chat") and Sherpy didn't know
  the missions ("the second step of the mission" -> answered the plan's second move).
- Fixes: a chat counts as earlier only if the family spoke; phase 2 gets every mission with its steps and facts,
  numbered as on screen (`missions-brief.mjs`), plus where they are (`?screen=` at connect, `sherpy.screen` while open).
- Gemini answered a screen note once ("I'm here when you're ready to continue."): a reply that starts within 3 s of a
  note, before the family speaks, is now cancelled and dropped by the server.
- Live (fake mic): in mission 3 "What is the second step of this mission?" -> "put the needs in your own order";
  after moving to mission 1 -> "find your current life policy…"; two screen changes -> no reply. 213 tests pass.

## 2026-11-18 ~14:40 — Interactive, guided mission steps (no invented content)
- Team (Dani, 18/11): steps were "text + Done". Approved (via question): drop generic tips that are not in the plan;
  show the sum of the family's own amounts next to the plan's free cash flow; build everything, demo pieces first.
- Every Johnson step now has blocks (`ui` in data/missions JSON, `step-logic.mjs` + `step-ui.mjs`): learn = bars of
  plan figures + "Ask Sherpy about this"; prepare = fields to write down what they find; M3-2 each partner ranks the
  needs (↑↓); M3-3 both orders side by side, a shared order and optional yearly amounts (total vs $15,032);
  M4-2 ready-made HR email (copy / open mail app) + what HR answered; act steps show the amount agreed in M3-3 and
  recall earlier answers; M6-2 keep $450 or pay more. "I did it" waits until the step is filled in.
- Removed kits that were general knowledge (where to look in a bank app, what insurers ask, etc.); M3-3 kit kept
  (plan-backed). M3-1 now names the credit card among the needs (it is in M3's facts and M6 uses the decision).
- Bug found headless and fixed: each field overwrote the others (stale answers copy). 218 tests pass.

## 2026-11-18 ~15:15 — Missions as a path, folded steps, phone frame on wide screens
- Dani: missions too text-heavy; wants a path and info revealed per level, same info better distributed; screens 1
  and 3 inside a drawn phone.
- Overview: missions drawn as a zigzag path of round level nodes on a dotted trail (Sherpy on the next one), each
  with a compact label (title, effort · owner · steps, score chip). Detail: "Why this matters" moved into the learn
  step it came from; plan figures in a fold ("Your plan's figures (9)"); only the current step is unfolded, done and
  locked steps fold to one line (tap to open); marking a step done scrolls to the next one. No content removed.
- Phone frame: `phone.html` draws an iPhone-sized phone and loads `/` or `/missions.html` in an iframe
  (mic/autoplay allowed). `frame-guard.js` sends top-level pages there when the window is ≥700×600 (after the
  viewport meta, or phones read 980 px and got framed too — caught headless). The video always breaks out wide.
- Verified headless 1280×800 (framed), 390×844 and 844×390 (not framed); 218 tests pass.

## 2026-11-18 ~15:45 — "Keep in view" becomes "More advice from your plan"
- Team tested Samantha from zero: worked very well; the 12 "Keep in view" boxes (plan advice that is not a
  mission, titles cut at 80 characters) were unclear.
- Now "More advice from your plan": a swipeable deck (‹ › buttons too), one card per tip with full text, a topic
  label from keywords (first topic named wins), a counter "2 / 12" and "Ask Sherpy about this". Headline only when
  the advice has a real one (text before " — ", or a hand-written title). Nothing removed.
- Sherpy's phase-2 instructions now list every one of these tips in full (with their facts). 220 tests pass.

## 2026-11-18 ~17:05 — Demo mode, demo reset, mission generator v2 (minimal)
- Team: demo recorded with Johnson from zero; the family simulated with ElevenLabs voices; the video build must be
  seen live; generator improved for every other case, Johnson untouched. Plan approved by Dani 18/11.
- Demo family (`?family=demo`): 15 lines (Daniel "Chris", Emily "Jessica", eleven-v3, ~1.5k characters) sent as the
  mic and played aloud. Rehearsals (headless, real Gemini) found and fixed: intro worded "Who do I have the pleasure
  of speaking with?", a goal question split in two, the risk mediation repeating Emily's answer, and Sherpy mixing up
  who said what (key lines now say "Daniel here" / "Emily here"). Rehearsal 4: full conversation → video built in
  ~6 s → video wide → missions in the phone.
- `npm run demo:reset` + `/reset.html`; guide `docs/demo-recording.md`.
- Generator v2 (minimal): Samantha 8 missions/31 steps, Carter 7/27, Weah 9/35; every advice item in exactly one
  mission; standard tests on all cases + a case with missing fields. Weah's life move target_amount ($485,000)
  disagrees with its own action text ("Add $235,000"): the amount is not shown, the action is quoted. 228 tests pass.

## 2026-11-18 ~17:25 — Security review, run-anywhere, rate limits, data protection
- /security-review (subagent, full branch): no finding at confidence ≥ 8. Suggested hardening applied: Host
  allow-list against DNS rebinding (421).
- Judges: the server needs only `TEAM_KEY`; cases come from the MCP when a token works, else from `cases/` (identical
  data for all 4 cases × 3 parts, checked against the live MCP). Fresh clone + `.env` with only TEAM_KEY: 230 tests,
  every route 200. README has macOS and Windows steps (PowerShell `Out-File -Encoding ascii`, since PS5 writes UTF-16).
  `.gitattributes` forces LF. Not tested on a real Windows machine.
- Team asked for every security layer and data protection: security headers + strict CSP (0 violations on all pages,
  voice still works), GET/HEAD only, rate limits (600 req/min, 20 video builds/min per case, 12 voice opens/min,
  3 concurrent voice sessions, 300 WS messages/s), transcripts opt-in (`SAVE_TRANSCRIPTS=1`) with 7-day retention,
  archive 30 days, `npm run data:delete`, `/privacy.html` + notice before talking. Legal compliance not certified.

## 2026-11-18 ~18:10 — First team take failed; demo family hardened
- Team's first real take went off-script: Sherpy saved "college" for both right after Daniel's line, the family went
  back to the goal and it looped. No transcript (transcripts had just been made opt-in).
- Fixes: the scripted family never goes back to a closed topic, moves on when Sherpy repeats a question, and waits
  3.5 s (instead of 0.9 s) when Sherpy has not asked anything yet (it is saving an answer). 237 tests pass.
- Rehearsal after the fix (headless, real Gemini): full conversation, video, missions and the bubble, no loop.
  The recording server runs with SAVE_TRANSCRIPTS=1 (fictitious demo data) so any failure can be read.
