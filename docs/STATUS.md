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
- 16/11 (long session): mascot **Sherpy** approved (D15). Voice agent designed and built on branch
  **`feat/sherpy-voice-agent`** (not pushed, not merged; 96 tests): `agent/` Node server + test page, Gemini
  `gemini-3.8-live` with voice **Charon**, case data via the MCP. Decisions D16–D19 in `decisions.md`.
  - Two live tests by the team. 1st: "a disaster" → fixed: phantom "¿Qué?" turns were Gemini transcribing breaths and
    coughs (speech gate in the page), Spanish start (Sherpy now greets first in English), robotic voice (Charon).
  - D19: natural conversation with an agenda, mediation (goal, worry, risk), confirm before saving, closing line
    "I've got everything I need. I'm putting together your video now." + `finish_conversation` → page shows a video
    placeholder and the paid voice session closes. Plan questions move to after the video.
  - 2nd live test: "ya no es una mierda". Fixed after it: closing line was cut, stuck on "both", saved a guessed
    value, re-greeted. **Closing-line fix is only unit-tested: check it in the next live test.**
- How to run: `cd agent && npm start` → http://localhost:5173 (must be `localhost`), headphones. A completed
  profile makes the next session start in Q&A mode: move `data/profiles/<case>.json` to `data/archive/` to restart.
  Synthetic full conversation: `node scripts/e2e-conversation.mjs` with the server running (~$0.50 per run).
- Spend: **$2.39 of $50** (each 5-min conversation ≈ $0.50). MCP token taken 16/11 ~20:30 → expires ~19/11 20:30.
  `gpt-realtime-2.1-mini` returns `expired_secret_key` on the proxy: tell Sherpas in `#dudas-reto-mcp`.
- Next, in order: (1) live test of the latest fixes; (2) conversation screen UI proposals (team said: only once the
  agent works); (3) the video (D10, D14) built from `data/profiles/` + persona; (4) plan Task 8: `/security-review`,
  README "Run Sherpy", screenshot; (5) merge decision for the branch.
- Needs from the desktop Claude: close Q-MASCOT and Q-VOICE in `open-questions.md`; D15–D19 are in `decisions.md`.
