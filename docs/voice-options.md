# Sherpy narration voice: options for the team (17/11, night)

**Status: proposal.** The team said the explainer narration (eleven-flash-v2.5 + `onyx`) sounds monotone. Nothing in
the code was changed; the default stays `onyx`. Samples to listen to: `data/voice-samples/compare.html` (open via
`file://`, git-ignored).

## What the proxy supports (verified 17/11)

- **TTS models:** `GET /v1/models` lists `eleven-flash-v2.5`, `eleven-multilingual-v2`, `eleven-v3` (plus `scribe-v2`
  for STT). README prices: flash $0.04 / 1k chars, the other two $0.08 / 1k chars. No voices list endpoint
  (`/v1/voices`, `/v1/audio/voices`, `/v2/voices` → 404).
- **Voices:** OpenAI names (`onyx`, `alloy`…) are mapped by the proxy; any other string is sent to ElevenLabs as a
  `voice_id` (`"nosuchvoice"` → ElevenLabs 404 `voice_not_found`). The premade ElevenLabs voice "Brian"
  (`nPczCjzI2devNBz1zQrb`) works.
- **Extra fields are passed through to ElevenLabs.** Evidence from deliberately invalid values (refused, so no
  audio billed):
  - `voice_settings: {stability: 7}` → ElevenLabs 422 "`body.voice_settings.stability` should be ≤ 1".
  - `speed: 9` → ElevenLabs 400 "`invalid_voice_settings`: speed expected 0.7–1.2".
  Valid `voice_settings` (stability, similarity_boost, style, use_speaker_boost, speed) returned 200.

## Variants (same passage, from the Johnson video)

| # | Model + voice | Text / settings | Dur. s | Pause % | RMS sd dB | F0 med Hz | F0 sd st |
|---|---|---|---|---|---|---|---|
| 1 | flash-v2.5 + onyx (**current**) | original text | 12.07 | 28.9 | 6.69 | 125 | 3.13 |
| 1b | same, run again (noise check) | original text | 10.96 | 24.4 | 6.82 | 120 | 2.94 |
| 2 | flash-v2.5 + onyx | rewritten text¹ | 12.82 | 28.7 | 6.37 | 116 | 3.31 |
| 3 | flash-v2.5 + onyx | rewritten + stability 0.25, similarity 0.75, speaker boost, speed 1.08 | 12.77 | 31.1 | 6.60 | 122 | 3.28 |
| 4 | **eleven-v3** + onyx | rewritten + `[serious]` / `[warmly]` audio tags | 11.44 | 31.8 | 6.11 | 127 | 3.08 |
| 5 | **multilingual-v2** + onyx | rewritten + stability 0.35, style 0.45, speaker boost | 13.84 | 31.8 | 6.48 | 126 | 3.32 |
| 6 | flash-v2.5 + **Brian** | rewritten + same settings as 3 | 9.75 | 26.2 | 6.39 | 97 | 3.06 |

¹ Original: "Right now you are not on track. Your score is 52 out of one hundred, which is vulnerable. But there is a
solution, one step at a time." Rewritten: "Right now… you're not on track. Your score is 52 out of one hundred. That's
vulnerable. But here's the good news: there is a solution. One step at a time."

**Metric** (script in the session scratchpad, plain Node + ffmpeg): 50 ms windows; RMS energy sd over voiced windows
(within 30 dB of the peak); pause % = silent windows between first and last voiced window; F0 by autocorrelation
(70–400 Hz, octave errors folded), sd in semitones.

**What it shows, honestly: almost nothing.** The re-run of the identical baseline request (1 vs 1b) moves every
number as much as any variant does (duration −1.1 s, pause −4.5 pts, F0 sd −0.2 st). ElevenLabs output is
non-deterministic, and this crude metric doesn't measure emphasis on the right word, which is what "monotone"
really means. The only clear measured difference is **pace**: Brian speaks ~15.8 chars/s vs ~11–12 for onyx
(variants 1–3, 5). `speed: 1.08` gave no visible change on onyx (2 vs 3) within that noise. **The choice has to be
made by ear.** I could not listen to the samples.

## Cost per 2-minute video

The current Johnson video is 833 characters for ~74 s of audio → a 2-minute video ≈ **1,350 characters**.
Clips are cached per profile + voice, so only new profiles cost.

| Option | $/2-min video | 2-min videos in the full $1.40 cap |
|---|---|---|
| flash-v2.5 (variants 1, 2, 3, 6) | $0.054 | ~26 |
| multilingual-v2 or v3 (4, 5) | $0.108 | ~13 |

The remaining ElevenLabs cap is **unknown**: `/key/info` returns an empty `model_spend`, so ElevenLabs spend can't
be separated from the $3.50 total. These samples used 1,066 characters (1,057 billed; the 9 in refused probes returned no audio), about $0.055. The demo and
rehearsals realistically need a handful of videos, so even v3 fits, but every extra rebuild for a new profile counts.

Other trade-offs: README says flash is "the least likely to be busy"; v3 and multilingual-v2 may be slower or refused
at peak (latency not measured here; today's video builds in ~4.6 s). v3's audio tags would appear in the captions
unless stripped, and the model would have to be allowed to write them (and they're billed as characters).

## Recommendation (the team decides)

1. **Listen first to 2 and 3** (same cost and model as today). If 2/3 already fix it, the change is just the narration
   prompt below plus, for 3, voice settings. Cheapest and lowest risk.
2. If not enough, compare **4 (eleven-v3)** and **6 (Brian)**. v3 is the "most expressive" ElevenLabs model, at 2×
   cost and with busy/latency risk; Brian keeps flash cost and is a different voice (deeper, faster).

Code change it would need (**not applied**): make model and settings configurable, and include them in the cache
key so old clips aren't reused.

```js
// agent/src/video/voice.mjs
export function speech({ baseUrl, key, voice, model = 'eleven-flash-v2.5', voiceSettings }) {
  return async (text) => {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, voice, input: text, ...(voiceSettings && { voice_settings: voiceSettings }) }),
    });
    ...
```

```js
// agent/server.mjs — e.g. for variant 3
const tts = {
  model: process.env.SHERPY_TTS_MODEL || 'eleven-flash-v2.5',
  voice: process.env.SHERPY_VOICE || 'onyx',
  voiceSettings: { stability: 0.25, similarity_boost: 0.75, use_speaker_boost: true, speed: 1.08 },
};
// createVideoBuilder({ ..., tts: speech({ baseUrl: PROXY_URL, key: TEAM_KEY, ...tts }), voice: JSON.stringify(tts) })
```

`voice` is part of `hashOf()` in `agent/src/video/build.mjs`, so passing the whole config there invalidates cached
clips when it changes. For v3 tags, captions would also need `text.replace(/\[[a-z ]+\]\s*/g, '')`.

## Proposed narration-prompt tweak for rhythm (not applied)

Add to `SYSTEM` in `agent/src/video/narrate.mjs`, after "use short sentences.":

```
This is read aloud: write for the ear. Vary the rhythm: in each line, follow a longer sentence with a very short
one (two to five words) that carries the key point, e.g. "That's vulnerable." Use contractions (you're, here's).
Where the story turns from the problem to the solution, pause once with an ellipsis (…) or a colon, e.g.
"But here's the good news: …". At most one ellipsis per line. No exclamation marks on bad news.
```

Compatible with the current guards: `accept()` splits sentences on `.!?` only and limits words, and `…` contains no
digits. It should be re-checked on one real build (one gpt-5-mini call, no TTS needed to read the text).
