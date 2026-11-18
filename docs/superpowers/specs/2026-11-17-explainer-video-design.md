# Personal explainer video — design

Status: **approved by the team (Dani, 17/11)**. Decisions marked *(team, 17/11)* were taken in the session with
Dani today; items marked *(Claude's call)* are proposals the team can change.

## Intent
When the conversation with Sherpy ends ("I'm putting together your video now"), the family watches a ~1-minute
animated explainer about **their** plan, measured in **their** goals, narrated by Sherpy (D10, D12, D14). It is the
hook between the conversation and the game: they should finish it understanding where they stand and wanting to act.
For the hackathon the jury only sees it inside the 2-minute demo video, so the Johnsons' video must look great.

## Goals
- A generator that turns case data + the conversation profile into a video for any of the 4 cases.
- The Johnsons' video (the demo, D13) is polished: every scene fully designed, on-brand, synced to the voice.
- Every figure on screen or in the narration comes from the case data (hard rule 1, D5, D6).

## Non-goals
- MP4 export or server-side rendering. The demo video is a screen recording of the browser.
- Asking Sherpy questions **during** the video. D15 left this provisional "if it complicates the build": it does
  (a live voice session while the narration plays), so the mascot is available from the game on. *(Confirmed by the team, 17/11, under D15's condition.)*
- Investment risk (`risk` per person) in the video: no Johnson plan action depends on it. Kept for the game.

## Anti-goals (it fails even if it works)
- Any invented or recalculated number (including "with the plan you'd have X", D5/D14).
- Stories UI (progress bars, tap-through cards) or static slides with captions (rejected 15/11, D10).
- A dashboard or a chart wall: one idea per beat, big and simple.
- Fear tactics or exaggeration (D12).

## Constraints
- Deadline: delivery Wed 18/11 23:59. Must be buildable in about one day.
- Budget: ElevenLabs is capped at **$1.40 for the whole team** (`eleven-flash-v2.5`, $0.04 per 1K chars ≈ $0.04 per
  1-minute video). Cache every generated audio; never regenerate during development unless the text changed.
- Proxy endpoints: TTS `POST /v1/audio/speech` (OpenAI-compatible, `voice` = an ElevenLabs `voice_id`), text
  `gpt-5-mini` via chat completions (no `max_tokens`). Keys only in the backend (hard rule 3).
- Case data comes from the Sherpas MCP at runtime (D18), like the voice agent (`agent/src/case-source.mjs`).
- Brand: `assets/brand/` tokens, Poppins + Inter, wordmark; Sherpy from `assets/mascot/sherpy.svg` (D9, D15).

## Approaches considered
1. **Hand-built HTML/CSS/JS player in the existing agent server** — *chosen (team, 17/11)*. Scenes are DOM/SVG
   elements animated with CSS / Web Animations, triggered by the audio clock (`audio.currentTime` read every frame).
   No new dependencies, same stack as the conversation page.
2. Remotion (`@remotion/player` in the browser, optional MP4 render) — rejected (team, 17/11): needs React and a build
   step, sync costs the same, its MP4 export isn't needed (screen recording), licence unclear once the code is Sherpas'.
3. Generative video (Sora/Veo type) — rejected earlier (D3): not on the proxy, expensive, can't control figures.

## Decided (team, 17/11)
- **Format: horizontal 16:9**, about 1 minute. Changes D10's 9:16. On a phone held upright, an overlay asks them to
  rotate the phone; the stage scales to fit any landscape screen.
- **Voice: ElevenLabs.** The narration is Sherpy's voice. The team picks one ElevenLabs voice for Sherpy, used in the
  video and in the scripted demo conversation (D16), so in the demo Sherpy sounds the same everywhere. (The live MVP
  conversation keeps Gemini's Charon: realtime models can't use ElevenLabs voices.)
- **Sherpy appears at the start and the end** (greets, then hands over to the data; comes back to present the first
  mission). In between his voice narrates off-screen and the data fills the stage.
- **Five scenes, in this order:**
  1. **Hook — your goals.** Their goals as big icons with names and dates (Johnson: college for Oliver 2033 and Sophia
     2035, retiring in 2044, a $4,500 vacation every year). The `main_goal` goes first and biggest.
  2. **Where you stand.** Sherpas score (Johnson 52/100, "vulnerable", red) and the pillars; the weakest one gets a
     stamp (Johnson: Insurance and protection 0/20).
  3. **What worries you.** The gap behind `top_worry` as a have-vs-need picture (e.g. college: $30,000 in the 529,
     $106,552 still missing). If `top_worry` is `none`, use the gap of the `main_goal`.
  4. **If you act.** The plan's own moves and their effect (D14): Johnson life cover 52→57, umbrella 52→56, both
     together → 60. Only scores the plan gives (`top_moves`, `combined_moves`, D6). No future-wealth figures.
  5. **Your first mission.** Sherpy returns and names the first step (the plan's first `top_move`), then hands over
     to the game.
- **Personalisation by profile** (team approved the table, 17/11):
  - `main_goal` → which goal leads scene 1, and the fallback gap in scene 3.
  - `top_worry` → which gap scene 3 shows (retirement / protection / college / debt / cash, as `options.mjs` builds
    them per case).
  - `detail_level` → low: one big figure per scene (~45 s); medium: + one supporting figure (~60 s); high: + the
    secondary figures (e.g. all pillars, per-person life-cover shortfalls) (~75 s).
  - `style` → analytical: the number leads ("52 out of 100"); emotional: what it means for them ("Oliver and Sophia").
    Partners differ → narration does both in the same line.
- **Built by hand in HTML/CSS/JS**, no Remotion (team, 17/11). Look follows D10 re-skinned to Sherpas: light Sherpas
  neutrals, sticker-style flat shapes with thick navy (`#0b0f2e`) outlines and a slight hard shadow, heavy Poppins
  headline with the key word on a brand-blue highlight block, tilted stamp labels, captions word by word with the key
  words highlighted, elements popping in with the voice, bars growing, counters ticking.

## How it is built *(Claude's calls unless marked)*
Pipeline, all on the server (`agent/`), each step a pure module with tests except the two network calls:
1. **Facts** (`video/facts.mjs`, no AI): case JSON + persona → a fact sheet per scene with display-ready values
   (score, band, pillars, goals with dates, gap per worry topic, moves with before/after scores, first move).
   Johnson must be complete. The other three cases must render without crashing; where a fact is missing the scene
   uses a simpler variant (one big number from the matching persona concern) or is skipped. Carter and Samantha have
   no `combined_moves`, so scene 4 shows single moves only.
2. **Script** (`video/script.mjs`): profile + facts → ordered scenes, each with its visual props and a narration line.
   `gpt-5-mini` writes the narration lines in Sherpy's voice (warm, plain English, short sentences), with numbers
   only as **placeholders** (`{score}`, `{gap}`…) that code fills from the facts. The finished text then goes through
   the existing grounding check (`agent/src/numbers.mjs`); if a line fails or the call fails, that scene uses a
   template line written by us. So no AI-written digit ever reaches the screen or the voice.
3. **Voice** (`video/voice.mjs`): one TTS request **per scene** (5–6 requests), so each scene starts exactly when its
   audio starts and no word timestamps are needed. Captions inside a scene advance word by word, timed in proportion
   to characters over the clip's duration. Audio and script are cached in `data/videos/<case>-<profile hash>/`
   (git-ignored).
4. **When:** generation starts the moment `finish_conversation` succeeds; the page shows Sherpy and "Putting your video
   together…" until it is ready (target under 20 s). A cached video opens instantly.
5. **Player** (`agent/public/video.html` + `video-player.mjs`): GET `/video/<case>` returns the script JSON and audio
   URLs; the player plays the clips back to back on one 16:9 stage, drives every animation from the audio clock,
   has play/pause and replay, and at the end shows "Start your first mission" (placeholder until the game exists).
   Sherpy's mouth follows the narration volume, as in the conversation.

## Settled during the builder check *(Claude's calls)*
- Sherpy's greeting is the opening beat of scene 1 ("Daniel, Emily, here's your plan in one minute"); he then slides
  out and the goals pop in. Scene 5 brings him back.
- If partners didn't agree on `main_goal`/`top_worry` (only `byPerson` saved), scene 1 shows both goals side by side
  and scene 3 shows the first partner's worry; the narration names whose it is.
- `style` missing for someone → treated as both. One adult → only that person's style.
- Until the team picks Sherpy's voice, development uses one fixed voice; the cache key includes the voice id, so
  changing the voice regenerates the audio once.
- After the conversation the page goes to the video page for that case; the conversation page's placeholder is
  replaced by that navigation.

## Open (theirs)
- Narration model stays `gpt-5-mini` (team, 17/11): a Claude model was considered but isn't on the proxy.
- **Which ElevenLabs voice is Sherpy?** Claude generates 3–4 short samples (≈$0.02 total) for the team to choose.

## Left to the builder
Exact layout and motion of each scene within the look above; icon drawings (flat SVG, drawn by us, no brand assets
invented); which persona/JSON fields feed each fact; the wording of template lines; loading and error states
(e.g. TTS budget exhausted → show the video with captions only and say so).

## Revision 2 — the roller-coaster story (team, 17/11, replaces "Five scenes" and "Personalisation by profile")
Team feedback on the first real Johnson video: too short for all the data; the thread was broken (it showed a
college gap, then proposed life cover with no link); it repeated their answers instead of using them. Approved story,
**~2 minutes** (low ≈ 90 s, medium ≈ 120 s, high ≈ 150 s), seven scenes, the "roller coaster":
- **Up, the dream** — `dream`: what life looks like with their goals met, only their own goals, dates and amounts
  (Johnson: Oliver starts college in 2033, Sophia in 2035, both retire in 2044 at 62 and 60, a $4,500 vacation every
  year). Main goal first and biggest. No projections.
- **Down, the hard truth** (not softened) — `reality`: "Today you're not on track for that": score 52/100 vulnerable,
  protection 0/20. `gaps`: how far each goal is (college $30,000 saved / $106,552 missing; nothing goes into the
  401(k)s, retirement gap $1,427,456; cash covers 1 month, 8 to 9 recommended); main goal and top worry first.
  `fragility`: if one paycheck stops — life cover and shortfall per person (Daniel $250,000 / $1,350,000 short,
  Emily $200,000 / $1,000,000 short).
- **Relief, it has a solution** (don't overwhelm) — `turn`: "this has a solution, one step at a time"; free cash flow
  per year ($15,032) and the plan sets the order; their risk answers transformed ("protect what you have first, then
  grow it", acknowledging different views when partners differ). `act`: the plan's moves linked to what was just shown
  (life cover closes the fragility gap 52→57, umbrella 52→56, together 60, then saving more 52→55 toward retirement).
  `mission`: back to the dream year + Mission 1.
- Answers are used, never repeated: main goal anchors `dream`/`mission`; top worry orders `gaps`; risk feeds `turn`;
  style frames lines; detail level sets figures per scene and length.
