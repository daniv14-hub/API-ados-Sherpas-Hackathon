// Half-duplex mic for the open-mic mode (runs in the page; pure, so node tests can use it too).
// Why: live test 17/11 on a laptop speaker. Sherpy's own voice leaked into the mic, the model heard
// it as the user ("¿Qué?", "top"), cut its own reply and answered words nobody said. The team asked
// that Sherpy can't be interrupted: it finishes its sentence, then listens. So while its audio plays,
// and for a short tail after (room echo, echo-canceller lag), the page sends silence instead of the mic.

export const TAIL = 0.5; // seconds after the last scheduled audio sample

// now and playEnd are AudioContext times in seconds; playEnd is when the queued audio finishes.
export function micMuted(now, playEnd, tail = TAIL) {
  return now < playEnd + tail;
}
