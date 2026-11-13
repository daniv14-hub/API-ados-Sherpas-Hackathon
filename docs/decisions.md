# Decisions log

Format: context → options → decision → why. Newest at the bottom. Dates in Europe/Madrid.

---

## D1 · Voice conversation instead of a written questionnaire (12/11)
- **Context:** `persona.md` gives profile data, but not what really keeps the family up at night, how much detail they want, or which goal matters most.
- **Options:** written questionnaire · no intake at all (use `persona.md` only) · voice conversation.
- **Decision:** voice conversation with an AI agent.
- **Why:** a questionnaire adds friction, and `persona.md` alone misses the real worries. Sherpas' existing chat is **text only**, so voice also sets us apart.

## D2 · Couples: individual vs joint decisions (13/11, after asking the Sherpas mentor)
- **Context:** in the Weah and Johnson cases, partners can disagree (e.g. Timothy accepts more risk than Melanie). Nothing happens until both agree.
- **Options asked to the mentor:** A) one experience showing both views · B) one experience per person · C) the agent mediates until they agree.
- **Mentor's answer:** C is fine (the AI can even fully replace the advisor). B fits better because households have individual **and** joint accounts (e.g. Melanie's own retirement account). The mentor invited us to explore all three.
- **Decision:** combine **B for individual matters** (each person's accounts and coverage) and **C for joint matters** (house, kids' college, credit card, joint accounts). Averaging the two views was ruled out: it speaks to neither person and hides the disagreement.
- **Why:** the split follows how the data is structured, and it scores on "Personal: made for each of them".
- **Implementation note:** with a shared mic, the agent always says a name before asking ("Timothy, …? And Melanie?"), and the next answer is assigned to that person.

## D3 · Video = browser animation + TTS, not a rendered MP4 (12/11)
- **Options (estimated, to be measured):**
  - Browser animation + TTS: ~20–45 s.
  - Remotion MP4: ~2–4 min of rendering.
  - Generative video (Sora/Veo-type): not available in the proxy, expensive, and no control over the figures on screen.
- **Decision:** browser animation; narration with `eleven-flash-v2.5`, one clip per scene, max 4 in parallel; playback starts as soon as scene 1 is ready.
- **Why:** low latency, near-zero cost, and the figures on screen come straight from the data.

## D4 · Build the video while they talk (12/11)
- **Decision:**
  - Base scenes are filled from the case JSON **without AI**, before the conversation starts.
  - During the conversation, a profile fills up as answers come in (`{ detail, risk: {person: level}, top_worry, … }`).
  - At the end, one `gpt-5-mini` call orders the scenes and writes the narration for that profile, without touching the numbers.
- **Why:** no wait at the end and no filler talk. If there is idle time, use it for something useful: confirm the goal, or ask the other partner.
- **Open question (first spike):** can the voice model save profile data through function calling while it talks? The fallback is to send each turn's transcript to `gpt-5-mini` for extraction. `gpt-live-1` uses another protocol; the realtime models use the OpenAI Realtime protocol.

## D5 · "Have vs need" visuals, not "2 houses vs half a house" (13/11)
- **Context:** the team wanted "your life if you act" vs "if you don't". The data only has a status-quo yearly projection plus before/after score deltas per recommendation, with no wealth projection for acting.
- **Decision:** draw the real ratio X/Y of each have-vs-need pair; the shaded part is the gap. The "acting" side is the gap closed, since closing it is what each recommendation is for.
  - Johnson: $250K of $1.6M life cover.
  - Weah: $0 of ~$113K saved for college.
  - Carter: savings run out at 85, while the plan runs to 91.
- **Ruled out:** multiples of the goal ("2 houses") and any future wealth figure on the "act" side, because both would need our own calculation.

## D6 · Game progress = the plan's own score improvements (13/11)
- **Decision:** each step in the path uses the plan's `score_before → score_after` and the money it saves, e.g. "pay the card → score 60→62, stop losing $X/yr". The progress bar is the Sherpas score.
- **Constraint:** improvements don't add up (Weah: card alone 60→62, insurance alone →60, both 60→73). Use only the combinations the plan gives.
