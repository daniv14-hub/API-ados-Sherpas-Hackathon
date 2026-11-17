# STATUS — read this first

**Last synced by the desktop Claude:** Sun 15/11 ~20:15 (Europe/Madrid).
**Days left:** final delivery Wed 18/11 23:59 · pitch Thu 19/11.

## Where we are
- **Idea:** closed and sent (`docs/idea-note.md`). Decisions D1–D14 in `docs/decisions.md`.
- **15/11 team decisions:** house removed → progress bar; game = plan steps as missions with checkpoints (D11);
  video style = En Plata / Punto Ciego, described in D10; demo with the Johnsons, who mediate (D13);
  "if you act" scene uses the plan's own effects (D14).
- **Code:** none yet. `examples/voice/` is still Sherpas' untouched starter.
- **Voice spike:** not started (task 4, Dani).
- **Brand assets:** collected → `assets/brand/` (logo SVG, `tokens.css`, app screenshots) + `docs/brand.md`.
- **Solo info tasks 1–3:** sent to the team on 13/11; status unknown (see `docs/tasks.md`).

## Rejected — don't reuse
- **15/11 · First wireframe** (`.superpowers/brainstorm/.../flow-v1.html`): abstract orb, stories-style video,
  checklist path, no branding. Figures were correct, but it ignored the mascot (D8), the brand (D9), the video
  format (D10) and the game (D11).

## Next steps (in order)
1. Next Claude Code session with the team: define the mascot (Q-MASCOT). Also pending: Q-DEMO-SCRIPT, Q-PROGRESS.
2. Voice spike (Dani, solo: measurements only).
3. Build, in joint sessions, following the plan the team approves.

## What Claude Code may do right now without the team
- Gather facts for `docs/tasks.md` (family data sheets, what Sherpas already has).
- Run the voice spike when Dani asks (measure, don't choose).
- Nothing that designs the mascot, the video or the game without the team present.

## Last Claude Code session
(Claude Code updates this block before ending each session.)
- 15/11: flow-v1 wireframe (rejected). No code.
- 16/11: mascot Sherpy approved (D15). Voice agent built on **`feat/sherpy-voice-agent`** (D16–D19); live tests 1–2.
- 17/11 (branch **`feat/explainer-video`**, not pushed, not merged; 154 tests; spend ~$3.1 of $50):
  - Live test 3/4: half-duplex open mic (Sherpy can't hear itself or be interrupted). Back to the 728c849 instructions
    + half-duplex. Open conversation flaws: no mediation of the risk disagreement, a guessed `top_worry` "none" is saved
    after "I don't know", generic questions. Two reverted fixes (closing line cut, stuck on "both") may need to return.
  - Conversation screen: option A approved (light Sherpas look, portrait + landscape, Sherpy's words only, End =
    confirm + pause). Spec + mockup committed; **UI not built**.
  - **Explainer video built** (16:9, hand-made HTML/SVG, no Remotion; ElevenLabs voice `onyx` via the proxy; narration by
    `gpt-5-mini`, numbers only through placeholders, guards fall back to templates). Approved 7-scene "roller coaster"
    story (dream, reality, gaps, fragility, turn, act, mission), ~2 min, generated in ~10 s, cached.
    Johnson video: `http://localhost:5173/video.html?case=daniel-emily-johnson`. Team feedback: voice too monotone
    (flash-v2.5, clips synthesised one by one, no prosody in the text) — not fixed yet; ideas in devlog.
  - `/security-review` of the branch (video routes, voice relay): no finding with confidence >= 8. Noted, not reported:
    no Host-header check (DNS rebinding could read synthetic case data), `GET /video/<case>` from any page can trigger a paid build.
  - README now has "Run Sherpy". Decisions taken this session (End conversation = confirm and pause; voice `onyx`)
    are in `devlog.md` for the desktop Claude to move.
- How to run: README "Run Sherpy". MCP token expires ~19/11 20:30; `gpt-realtime-2.1-mini` returns `expired_secret_key`
  (tell Sherpas in `#dudas-reto-mcp`).
- Next: (1) **game, pillar 3** (not started; needs team design, see `docs/pillar3-context.md`); (2) conversation UI;
  (3) voice expressiveness; (4) whole-branch review + deferred minors; (5) screenshots, 2-min demo video, one-page write-up
  (due 18/11 23:59); (6) merge decision.
- Needs from the team: pillar 3 design; screenshots `YYYYMMDD-HHMM-what.png` for `docs/screenshots/`; merge decision.
- Needs from the desktop Claude: close Q-MASCOT and Q-VOICE; record "End conversation = confirm and pause" and voice `onyx`.
