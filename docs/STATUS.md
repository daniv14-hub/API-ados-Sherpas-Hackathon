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
- 15/11: brainstorm produced the flow-v1 wireframe (rejected, see above). No code written.
- 15/11 (evening): logged team decision D15 in `decisions.md` (mascot = virtual financial advisor, 2D avatar,
  protagonist, always available; short line at every checkpoint, data-driven for analytical profiles and
  motivational for emotional ones; asking during the video is PROVISIONAL, dropped if it complicates the build).
  No code written.
- Needs from the desktop Claude: narrow Q-MASCOT in `open-questions.md` to look, name and animation (to agree 16/11);
  note that "analytical vs emotional" is a new profile field the conversation must capture (D4).
