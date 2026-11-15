# Solo tasks (information only, no decisions)

Rule: these tasks gather facts. If you hit something that needs a decision, write it in `docs/open-questions.md` and move on.
Mark your name and status. Log what you did in `docs/devlog.md` with time and name.

| # | Task | Output | Who | Status |
|---|------|--------|-----|--------|
| 1 | Data sheet per family: have/need pairs with exact figures, goals (date, price), score improvement per recommendation (`score_before → score_after`, only combinations the plan gives), worries/tensions from `persona.md` | `docs/families/<id>.md` | Weah, Carter, Johnson: one each; Samantha: whoever finishes first | ? |
| 2 | Open "Open the plan" for each case and note what Sherpas already does (tour, chat, living map), so we don't repeat it | `docs/sherpas-existing.md` | ? | ? |
| 3 | 5–10 references each: TikTok-style explainer videos and game-like apps (Duolingo-style) | links in `docs/references.md` | everyone | ? |
| 4 | Voice spike: does `examples/voice/` run, does function calling work through the proxy, latency, spend before/after (`key/info`) | results in `docs/devlog.md`; choice later as a decision | Dani | not started |
| 5 | Collect Sherpas brand: logo (SVG/PNG), colors (hex), fonts, UI screenshots of the plan app, from official sources only (their website, the "Open the plan" app, Discord) | `assets/brand/` + `docs/brand.md` | desktop Claude | done 15/11 |

Task 3 now also covers: mascot references (friendly characters in apps, e.g. Duolingo's), animated explainer styles in the line of En Plata / PuntoCiegoEconomía (not stories), and game references for the minigames.

Copy figures only from `cases/<id>/*.json` and `persona.md`. Never calculate new ones.
