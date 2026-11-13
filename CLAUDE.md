# CLAUDE.md — APIñados · Sherpas Wealth Hackathon (UPV, Nov 2026)

Team: Dani, Javi, Nico. Challenge: **"Bring the plan to life"**.
Full event context (dates, rubric, models, prices, rules): `docs/HACKATHON_CONTEXT.md` (Spanish). Read it before planning.
Decisions already taken and why: `docs/decisions.md`. Do not reopen them without asking.

## The product (one paragraph)
A family talks by **voice** with an AI agent that learns what the plan doesn't know (worries, how much detail
they want, risk comfort, which goal matters most). While they talk, a **short vertical explainer video**
(TikTok-style: browser animation + narration) is assembled from their real plan, measured in their own goals
(e.g. their house) instead of raw dollars. Afterwards, a **game-like path**: one clear next step at a time,
visual progress driven by the plan's own score improvements, a voice chatbot for questions, and reminders.

## Hard rules
1. **Never invent figures.** Every number shown or narrated comes from `cases/<id>/*.json` (or the MCP).
   The LLM may write narration and order scenes, but it never produces or changes numbers.
   - There is **no "if you act" wealth projection** in the data. Don't compute one. Use "have vs need" pairs.
   - Score improvements don't add up: use only the combinations the plan provides (`score_before → score_after`).
2. **Secrets only in the backend.** `.env` is git-ignored. Never put `TEAM_KEY` / `MCP_TOKEN` in browser code,
   logs, screenshots or commits. Voice must go browser → our backend → proxy.
3. **Budget: $50 shared for the whole team, all models.** Develop with cheap models
   (`gpt-5-mini`, `deepseek-flash`, `gpt-live-1`/`gpt-realtime-2.1-mini`); keep expensive ones for the demo.
   Always close voice sessions (they are billed on close). Limits: 60 req/min, 4 concurrent.
   `gpt-5-mini`: don't set `max_tokens` (< 1000 returns empty).
4. **Product language is English** (US clients). Code, identifiers, comments and commits in English.
   Talk to the team in Spanish.
5. **Mobile first.** The Weah family checks the plan in short bursts on their phone.

## How we work (Superpowers)
- New feature → `superpowers:brainstorming` → `superpowers:writing-plans` → the human approves the plan →
  execute **autonomously** (`superpowers:executing-plans` / subagent-driven) without asking at every step.
- Bugs → `superpowers:systematic-debugging`. Core logic (data → scenes) → `superpowers:test-driven-development`.
- Before claiming something works → `superpowers:verification-before-completion`: run it and show the output.
- If something isn't in the docs or the data, **ask**. Don't guess an API, field name or protocol:
  read `README.md`, `examples/voice/` and the JSON first.
- Small, frequent commits with clear messages.

## Documentation for the LinkedIn post (mandatory, as you go)
- `docs/devlog.md`: append a timestamped entry (Europe/Madrid) at every milestone, blocker, surprise or
  pivot. Include real numbers (latency, cost spent, tokens), not adjectives. One entry = 2–5 lines.
- `docs/decisions.md`: every technical or product decision with context, options, choice and why.
- `docs/screenshots/`: when something visible works for the first time, tell the human to take a
  screenshot and name it `YYYYMMDD-HHMM-what.png`. Never capture keys.
- Check team spend at milestones:
  `curl -s https://llm-hackathon.sherpaswealth.com/key/info -H "Authorization: Bearer $TEAM_KEY"` (log `info.spend`).

## Repo map
- `cases/<id>/` — `financial-health.json`, `investment-analysis.json`, `persona.md` (D0–D6, O*, T*), `report.pdf`.
  IDs: `timothy-melanie-weah`, `michael-carter`, `daniel-emily-johnson`, `samantha-lewis` (no PDF).
- `examples/voice/` — working Realtime relay (`server.mjs`) + page. Starting point for the voice agent.
- `docs/` — context, decisions, devlog, screenshots.

## Deadlines
- Fri 13/11 22:00 — idea note (`/idea` in `#apiñados`).
- Wed 18/11 23:59 — final delivery (`/entregar`): public repo, MVP link or run steps in README,
  2-min demo video link, half to one page in English on what and why.
- Thu 19/11 — 2-min pitch. API access and credits end 21/11.
