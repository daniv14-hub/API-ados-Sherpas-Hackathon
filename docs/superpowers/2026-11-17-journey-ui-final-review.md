# Final review: journey UI (67850de..HEAD), 17/11 night

Reviewer: Claude Code (final reviewer + fixer). Branch `feat/journey-ui`, not pushed.

## Verdict
Ready to demo after the fixes below. No Critical findings. Five Important ones, all fixed and verified. Hard rules hold:
every figure in the missions comes from case data (facts checked against their `src` by tests, `verify: exists`
only on two "not in the plan" text facts), scores only by exact lookup (`score.mjs`, `missions-logic.mjs`), no secrets
in browser files, `/missions/<case>` and `/journey/<case>` are allow-listed (`isAllowedCase` = safe id + list), give
generic errors and strip data paths (`missionsView`). No `innerHTML` with data: only static `<template>` copies
(`conversation.mjs:14-15`); missions render through text nodes. Copy is in English.

Counts: Critical 0 · Important 5 (all fixed) · Minor 12 (parked).

## Important (fixed)
| # | Where | Finding | Fix |
|---|-------|---------|-----|
| I1 | `agent/public/voice-client.mjs:45` (was :44) | Every `error` event from the socket ended the call ("The connection dropped"). The bench only logs them. The realtime model sends harmless mid-call errors (e.g. "conversation already has an active response", likely after the server's `response.create` following a tool call), so a family could lose the call mid-conversation. | New pure `isFatalServerError()` in `conversation-logic.mjs` (TDD, test added): only our server's `plan_unavailable` and `proxy HTTP …` end the call; real upstream failures still arrive as a socket close. Commit a660df4. |
| I2 | `agent/public/voice-client.mjs:86-89` | End pressed while the browser's mic prompt was open: `cleanup()` ran before `getUserMedia` resolved, the stream was then stored and never stopped (mic left on, red indicator). | Check `closedByUs`/context after each await and stop the late stream. Commit a660df4. |
| I3 | `agent/public/conversation.mjs:130,143` | Pressing End and confirming in the ~0.6 s after Sherpy's goodbye showed "Conversation paused" (onDone ignored because `client` was nulled) while the conversation was complete; also the confirm dialog stayed open over the "making the video" state. | If the client is already `finished`, "End now" just closes the dialog and lets the hand-off run; `conversationDone` closes the dialog. Commit 672cf47. |
| I4 | `agent/public/handoff.mjs:15,81` | Back button: pages restored from the back/forward cache stayed faded out (`html.leaving` → `body{opacity:0}`, blank page after missions → Back to the video), and the conversation page came back stuck on "Sherpy is putting your video together" (dead screen). | `leaveTo` removes `leaving` on a persisted `pageshow`; the conversation page reloads itself if restored in the making state (it then shows "Welcome back" with video + missions). Commit 672cf47. |
| I5 | `agent/public/conversation.mjs:80` | (a11y) The turn pill is a `role=status` live region and was rewritten every animation frame; screen readers can repeat it continuously. | Write only when the text changes. Commit 672cf47. |


Verification: `cd agent && npm test` → 195 tests, 195 pass, 0 fail (194 + 1 new). Headless Chromium shell via CDP with
a mock WebSocket (no paid calls), script `scratchpad/review-verify.mjs`:
- A harmless model error mid-call → still on the call view.
- B End during a 1.5 s mic prompt → pause view, track state `ended`.
- C End confirmed right after the goodbye → stays on the call, hands off to `/video.html?case=daniel-emily-johnson&flow=1`.
- D Back from the video → `/` start view, "Welcome back", not stuck in making (screenshot `c-review-D-back.png`).
- E `/` → fade → missions → Back: restored from bfcache (`back_forward`), `leaving` false, page visible (`c-review-E-back.png`).
No server restart needed (static map unchanged). `data/profiles/` untouched.

## Minor (parked, not fixed)
1. `agent/public/conversation.mjs:128` `conversationDone` clears `talking/listening` on `#callstage`, but `frame()` sets them on `#call`; the halo keeps "breathing" during the making state.
2. `agent/public/conversation.mjs:19` `show()` never moves focus: after Start/End/error the focused button disappears and focus falls to `<body>` (only the making-failure moves focus to "Try again").
3. `agent/public/missions.html:11` `#app` is `aria-live="polite"`: every re-render (each "I did it") re-announces the whole page.
4. `agent/public/missions.mjs:43` mission views are not in history: the browser Back button on a mission detail leaves the page (to the video) instead of going back to the list.
5. `agent/public/missions.mjs:149-152` "Reset progress" is shown to families, with a native `confirm()` that says "This is for demos."
6. `agent/public/missions.mjs:59` + `missions-logic.mjs:91-100` when no exact lookup exists, the chip shows the last exact score labelled "last checkpoint". It is a real lookup, but a strict reading of R2 ("no exact match → no score") would hide it. Team call.
7. `agent/src/game/missions.mjs:35` derived missions call Carter "joint/together" (incomes length); the UI masks it with the "&"-in-label heuristic (`missions-logic.mjs:131`). Fragile coupling.
8. `agent/public/handoff.mjs:81` the reload on bfcache restore can log an uncaught "AbortError: Transition was skipped" (harmless console noise).
9. `agent/public/video-player.mjs:293` the play handler uses `jump`, a `const` declared at :318 (works only because clicks come later; fragile).
10. `agent/server.mjs` `/bench.html` (debug event log incl. transcripts) is still served next to the product pages; fine locally, remove or gate before any public deploy.
11. `agent/public/voice-client.mjs` has no unit tests (WebSocket/audio glue); only the pure rules are tested. `handoff.mjs` DOM parts (`initConversationHandoff`, `initReturningFamily`) are covered only by the headless runs.
12. `agent/public/handoff.mjs:113` stray indentation; `missions.mjs` "Copy" note and checkpoint confetti fine, but the checkpoint view is lost on reload (falls back to overview).

## Not checked / limits
- No live voice session (no paid calls); real model error timing not reproduced, only the mock.
- 360 px layout: relied on Task 2-4 screenshots (no horizontal overflow reported); no layout code changed tonight.
