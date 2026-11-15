# CLAUDE.md — APIñados · Sherpas Wealth Hackathon (UPV, Nov 2026)

Team: Dani, Javi, Nico. Challenge: **"Bring the plan to life"**: take a family from their Sherpas financial plan
to understanding it and wanting to act. Final delivery **Wed 18/11 23:59**.

## Start every session by reading, in this order
1. `docs/STATUS.md` — where we are right now, what's next, what was rejected. **Most up-to-date file.**
2. `docs/idea-note.md` — what we build, in the team's own words (Spanish). Source of truth for the product.
3. `docs/decisions.md` — every decision with its **status**. Only `DECIDED` entries are closed.
   `PROVISIONAL` = accepted on a condition. `FACT` = verified in the data. Nothing else is decided.
4. `docs/open-questions.md` — what is still undecided. **Never resolve these yourself.**
5. `docs/HACKATHON_CONTEXT.md` — event facts: dates, rubric, models, prices, rules (Spanish). Read when needed.

If two docs disagree: `STATUS.md` > `decisions.md` > `idea-note.md` > anything else, including your own memory of
earlier sessions. If something isn't written down, it isn't decided: **ask**.

## The product in 4 lines (details in decisions.md)
1. **Warm voice conversation led by an animated Sherpas mascot** (D1, D8) that learns what the plan doesn't know.
2. **Personal animated explainer video** with narration (D10), in the style of En Plata / Punto Ciego shorts,
   built while they talk, measured in their own goals.
3. **A mission-style game** (D11): each step of the plan is a level (mission); completing it is a checkpoint and the
   progress bar moves toward their goal. Very visual and game-like, but on-brand and serious. Mascot by voice; reminders.
4. **Sherpas brand**, integrable into their existing product (D9). Mobile first.

## Hard rules
1. **Never invent figures.** Every number shown or narrated comes from `cases/<id>/*.json` (or the MCP).
   The LLM may write narration and order scenes; it never produces or changes numbers. See D5 and D6 (facts).
2. **Never invent brand assets** (logo, colors, fonts, mascot look). Use `assets/brand/` or clearly marked placeholders.
3. **Secrets only in the backend.** `.env` is git-ignored. Never put `TEAM_KEY` / `MCP_TOKEN` in browser code, logs,
   screenshots or commits. Voice goes browser → our backend → proxy.
4. **Budget: $50 shared, all models.** Develop with cheap models (`gpt-5-mini`, `deepseek-flash`,
   `gpt-live-1` / `gpt-realtime-2.1-mini`). Always close voice sessions (billed on close). 60 req/min, 4 concurrent.
   `gpt-5-mini`: don't set `max_tokens` (< 1000 returns empty).
5. **Product, UI and narration in English** (US clients). Code, identifiers, comments, commits in English.
   Talk to the team in Spanish.

## Team rules (D7) — these override any skill that says "proceed autonomously"
- **You don't take product, design or architecture decisions alone.** When a choice comes up: give 2–3 options
  with pros/cons, add it to `docs/open-questions.md`, and stop or switch to work that doesn't depend on it.
- Autonomous execution only for a plan **the team approved** (write who approved it in `docs/devlog.md`).
- Solo work only gathers information (`docs/tasks.md`). Decisions and building happen in joint sessions.
- Wireframes and prototypes are **proposals** until the team approves them. Present them as such.

## How we work (Superpowers)
- New feature → `superpowers:brainstorming` → `superpowers:writing-plans` → team approves → execute.
- Bugs → `superpowers:systematic-debugging`. Data → scenes logic → `superpowers:test-driven-development`.
- Before saying something works → `superpowers:verification-before-completion`: run it and show the output.
- Don't guess an API, field name or protocol: read `README.md`, `examples/voice/` and the JSON first.
- Small, frequent commits. Don't push unless a human asks.

## Session protocol (keeps Claude Code and the desktop Claude in sync)
- **During the session:** log milestones, blockers and surprises in `docs/devlog.md` (timestamp Europe/Madrid,
  2–5 lines, real numbers). New decisions taken by the team → `docs/decisions.md` with status and who/when.
- **Before ending a session:** update the "Last Claude Code session" block in `docs/STATUS.md` (what you did,
  what's half-done, what you need from the team), then commit.
- The desktop Claude rewrites the rest of `STATUS.md`, `decisions.md` and `open-questions.md` after each planning
  session with Dani. Don't edit those parts.

## Documentation for the LinkedIn post
- `docs/screenshots/`: when something visible works for the first time, ask the human for a screenshot named
  `YYYYMMDD-HHMM-what.png`. Never capture keys.
- Log team spend at milestones: `curl -s https://llm-hackathon.sherpaswealth.com/key/info -H "Authorization: Bearer $TEAM_KEY"` (`info.spend`).

## Repo map
- `cases/<id>/` — `financial-health.json`, `investment-analysis.json`, `persona.md`, `report.pdf` (not Samantha).
  IDs: `timothy-melanie-weah`, `michael-carter`, `daniel-emily-johnson`, `samantha-lewis`.
- `examples/voice/` — Sherpas' working Realtime relay (`server.mjs`) + page. Starting point for the voice agent.
- `assets/brand/` — official Sherpas brand assets (when collected; see `docs/brand.md`).
- `docs/` — STATUS, idea-note, decisions, open-questions, tasks, devlog, HACKATHON_CONTEXT, screenshots.
- `.superpowers/` — local brainstorm screens (git-ignored).

## Deadlines
- Wed 18/11 23:59 — final delivery (`/entregar`): public repo, MVP link or run steps in README, 2-min demo video link,
  half to one page in English on what we built and why.
- Thu 19/11 — 2-min pitch at UPV (attendance mandatory). API access and credits end 21/11.
