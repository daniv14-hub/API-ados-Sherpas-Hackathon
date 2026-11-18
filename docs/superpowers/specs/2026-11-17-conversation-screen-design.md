# Conversation screen — design (short)

Status: **approved by the team (Dani, 17/11)**. Not built yet. Replaces the test bench `agent/public/index.html`
as the product screen (D19). Approved mockup: `prototypes/conversation/index.html`, option A.

## Intent
The family talks with Sherpy on the screen they will really use. It must look like part of the Sherpas app (D9),
keep Sherpy as the protagonist (D8, D15) and make clear when Sherpy can hear them: since 17/11 the mic is
half-duplex, so anything said while Sherpy talks is dropped.

## Decided (team, 17/11)
- **Option A, "Advisor call":** light app look (Sherpas tokens), Sherpy big inside the soft blue score-card circle,
  "SHERPY" label, its current sentence in big Poppins. Phone: stacked, portrait. Laptop: Sherpy left, words right.
  Must work in portrait and landscape.
- **Only Sherpy's words** are shown, word by word as it speaks, key words in brand blue. No user transcript.
- **Turn pill:** grey "Sherpy is speaking" while its audio plays; blue "Your turn · speak now" with a pulsing mic
  when the mic is open. The circle "breathes" on their turn.
- **Top bar:** Sherpas wordmark + "End" (phone) / "End conversation" (laptop). No subtitle text (removed 17/11).
- **End = confirm and pause:** an in-page confirmation ("End now? Sherpy keeps what you've shared so far").
  On confirm: the voice session closes and a pause screen shows Sherpy and a "Continue with Sherpy" button that
  resumes at the first missing topic (the server already does this). No video until every topic is answered.
- Rejected: B (dark stage with subtitles), C (sticker speech bubble); End going straight to the video with
  incomplete answers (would need guessed values).

## Left to the builder
- Which words are "key" (highlight rule), how word timing follows the audio, the start screen before the call,
  the case selection for the demo (not in the product UI), error states. Propose them; don't change the above.
