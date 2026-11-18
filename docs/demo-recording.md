# Recording the demo (Johnson, from zero) — step by step

Everything runs on the laptop (`http://localhost:5173`). The family is simulated: Daniel and Emily are
ElevenLabs voices that answer Sherpy on their own. Nobody speaks during the recording.

## 1. Before recording (2 min)
1. In the terminal, from `agent/`, stop the server (Ctrl+C) and run:
   `npm run demo:reset`
   (moves the Johnson profile and built videos to `data/archive/`, nothing is deleted), then `npm start`.
2. In Chrome open `http://localhost:5173/reset.html` → it says "Ready for a fresh start".
3. Chrome full screen (Cmd+Ctrl+F), zoom 100%, close other tabs with sound. Laptop volume ~70%.
4. OBS: one "macOS Screen Capture" source (display), audio = desktop audio (Sherpy and the family come out of the
   laptop speakers). 1920×1080, 30 fps. Do a 10 s test recording and check you hear Sherpy.

## 2. Recording (about 6 min raw; cut to 2 min later)
1. Start recording in OBS.
2. On `reset.html` click **Start the demo (recorded family)**. Then click **Start** in the phone.
3. Do nothing: Sherpy greets, Daniel and Emily answer (their line appears under Sherpy's words), they disagree on
   the goal and on risk, Sherpy mediates, then says "I'm putting together your video now".
   Keys only if something goes off-script: **N** = family answers now, **R** = repeat the last line,
   **P** = pause/resume the family.
4. The video is built in ~6 s and opens wide on its own. Let it play to the end (~2 min).
5. The missions open in the phone. Do it by hand, slowly:
   - Mission 1: "I've read it" on step 1 (show the bars), fill step 2 (insurer, amount, type) for both, "I did it",
     tick step 3, "I did it" on step 4 → **checkpoint, score 52 → 57**.
   - "See all missions" → Mission 3: each orders the needs (↑↓) → "This is Daniel's order" / Emily's → agree an order
     and amounts → total next to the plan's free cash flow.
   - Open any mission and tap the **Sherpy bubble** (bottom right): Emily asks "What's the second step of this
     mission?" and Sherpy answers about that mission. Close the bubble (×).
6. Stop recording.

## 3. Editing (target 2:00)
0:00–0:10 title "A 30-page financial plan. Nobody acts on it." · 0:10–0:45 conversation highlights (greeting,
a disagreement, the goodbye + "putting together your video") · 0:45–1:15 the video (show it is ready in seconds)
· 1:15–1:50 missions (checkpoint 52 → 57, ranking, the bubble) · 1:50–2:00 "Every number from their own plan.
Nothing invented." + team. Export 1080p, upload to YouTube as **Unlisted**, test the link in a private window.

## If something goes wrong
- Sherpy stuck or the family silent for >10 s: press **N**.
- Anything else: stop, run step 1 again (reset + restart + reset.html) and record again. Each run costs cents.
