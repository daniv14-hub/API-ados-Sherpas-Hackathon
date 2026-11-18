# STATUS — read this first

**Last synced by the desktop Claude:** Sun 15/11 ~20:45 (Europe/Madrid), after reading the Claude Code session.
**Time left:** Mon 16 and Tue 17 full days, Wed 18 until 23:59 (final delivery) · pitch Thu 19/11.

## Where we are
- **Idea:** closed and sent (`docs/idea-note.md`). Decisions **D1–D15** in `docs/decisions.md`.
- **Decided on 15/11:** game = plan steps as mission levels with checkpoints and a progress bar, house removed (D11);
  video style = En Plata / Punto Ciego, re-skinned with the Sherpas brand (D10); demo with the Johnsons, who mediate
  a small disagreement (D13); "if you act" scene uses the plan's own effects (D14); mascot = 2D virtual financial
  advisor, protagonist, always available, adaptive line at each checkpoint (D15).
- **Brand:** collected → `assets/brand/` (logo SVG, `tokens.css`, app screenshots) + `docs/brand.md`.
- **Code:** none yet. `examples/voice/` is still Sherpas' untouched starter.
- **Voice spike:** not started (task 4, Dani).
- **Solo info tasks 1–3:** sent to the team on 13/11; status unknown (see `docs/tasks.md`).

## Rejected — don't reuse
- **15/11 · First wireframe** (`.superpowers/brainstorm/.../flow-v1.html`): abstract orb, stories-style video,
  checklist path, no branding. Figures were correct, but it ignored the mascot (D8), the brand (D9), the video
  format (D10) and the game (D11).

## Next steps for Mon 16/11 (in order)
1. With the team: mascot look, name and animation (Q-MASCOT). Also decide Q-DEMO-SCRIPT (the Johnsons' one or two
   disagreements) and Q-PROGRESS (what the progress bar measures).
2. Voice spike (Dani, solo: measurements only). It unblocks D4 (Q-VOICE).
3. Agree the build plan and the cut list for the deadline, then start building in joint sessions.
   Nothing is built yet and there are ~2.5 days left: the plan must say what gets cut first if we run late.

## What Claude Code may do without the team
- Gather facts for `docs/tasks.md` (family data sheets, what Sherpas already has).
- Run the voice spike when Dani asks (measure, don't choose).
- Nothing that designs the mascot, the video or the game without the team present.

## Last Claude Code session
(Claude Code updates this block before ending each session.)
- 16/11: Sherpy voice agent (`feat/sherpy-voice-agent`). 17/11 day: explainer video (`feat/explainer-video`, approved 7-scene story).
- 17/11 night (autonomous run approved by Dani; branch **`feat/journey-ui`**, built on `feat/explainer-video`; not pushed, not merged; 195 tests):
  - **Whole journey on localhost:** conversation screen (option A) → automatic hand-off to the video (landscape, rotate hint, one-tap
    play if the browser blocks sound) → end card → missions screen (portrait). "Welcome back" start screen for families who already talked.
  - **Missions (pillar 3):** content from the desktop handoff (`docs/handoff-missions-content.md`): Johnsons 8 missions / 26 steps with
    kits, every fact tested against its source path, every advice item covered, scores only by exact lookup (52→57→60→60). Other cases get
    missions derived from `score.top_moves`. Screens: path with progress bar + score chip, mission detail with facts/steps/kits/"I did it",
    checkpoint with Sherpy and a template line.
  - **Provisional rulings to review** (see devlog 17/11 ~22:45): Q-CONFIRM self-declared; Q-PROGRESS = bar of steps + score at checkpoints;
    life cover from the FH JSON (PDF conflict: ask #dudas-reto-mcp); M8 investment mix is a mission; progress in the browser; checkpoint lines are
    templates (no model, no voice in missions).
  - Verified: real synthetic conversation end to end (5 min) → video pre-built when Sherpy says goodbye → served in 2 ms. Screens checked in headless
    Chromium at 390×844, 844×390, 1280×800. Final review (Opus): 0 critical, 5 important fixed, 12 minors parked
    (`docs/superpowers/2026-11-17-journey-ui-final-review.md`). Security: new routes `/missions/<case>`, `/journey/<case>` allow-listed, no data leaks.
  - Known issues: in the e2e run Sherpy saved `detail_level: low` without an answer (asked, then closed): the "never save a guess" flaw is still open.
    Mission views are not in browser history (Back leaves the page). Missions page has no view transition (fade instead). Voice still monotone.
  - After the review: Back button inside missions, focus on view change, quieter screen-reader announcements, in-page reset (99902c6). 198 tests.
  - **Voice (team to choose by ear):** 6 samples at `data/voice-samples/compare.html` (local only); options, costs and the exact code change in
    `docs/voice-options.md`. The proxy offers eleven-flash-v2.5, eleven-multilingual-v2, eleven-v3, any ElevenLabs voice_id, and passes
    voice_settings/speed. Default voice NOT changed.
  - Spend: **~$3.55 of $50**. The demo profile `data/profiles/daniel-emily-johnson.json` is the one from the morning test (restored after the e2e run).
- Next (team): try the whole journey live on a laptop and a phone; review the rulings; screenshots `YYYYMMDD-HHMM-what.png`; 2-min demo video and
  one-page write-up (due 18/11 23:59); merge decision (`feat/sherpy-voice-agent` → `feat/explainer-video` → `feat/journey-ui` stack).
- Needs from the desktop Claude: move the rulings and the decisions in devlog to decisions.md/open-questions.md once the team confirms.
