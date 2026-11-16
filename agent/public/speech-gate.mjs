// Speech gate for the microphone (runs in the page; pure, so node tests can use it too).
// Why: Gemini's server VAD treats a breath or a cough as speech and its transcription turns it into
// "¿Qué?", so Sherpy answered sounds nobody said (devlog 16/11 21:35). The proxy ignores VAD
// tuning, so we filter before sending: only frames around *voiced* sound (a pitch, like speech)
// go up; everything else is replaced by silence. The stream stays continuous, delayed by `delay`
// frames so the start of a word is not cut.

const FRAME = 480; // 20 ms at 24 kHz

// True if this 20 ms frame (analysed with the previous one) has a pitch between ~60 and ~400 Hz.
export function isVoiced(prev, frame, { minRms = 300, minCorr = 0.5 } = {}) {
  const n = prev.length + frame.length;
  const x = new Float32Array(n);
  x.set(prev, 0);
  x.set(frame, prev.length);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += x[i];
  mean /= n;
  let energy = 0;
  for (let i = 0; i < n; i++) { x[i] -= mean; energy += x[i] * x[i]; }
  if (Math.sqrt(energy / n) < minRms) return false;
  let best = 0;
  for (let lag = 60; lag <= 400; lag++) { // 400 Hz .. 60 Hz at 24 kHz
    let c = 0, e1 = 0, e2 = 0;
    for (let i = 0; i + lag < n; i++) { c += x[i] * x[i + lag]; e1 += x[i] * x[i]; e2 += x[i + lag] * x[i + lag]; }
    const r = c / Math.sqrt(e1 * e2 + 1e-9);
    if (r > best) best = r;
  }
  return best >= minCorr;
}

// push(frame) takes one 20 ms Int16Array frame and returns one frame to send: the frame from
// `delay` frames ago if the gate was open around it, or silence.
export function createSpeechGate({ window = 10, minVoiced = 5, delay = 10, hangover = 40, ...voicing } = {}) {
  const frames = []; // last `delay + 1` input frames
  const pass = []; // parallel flags: send this frame for real?
  const recent = []; // voiced flags of the last `window` frames
  let prev = new Int16Array(FRAME);
  let openFor = 0; // frames the gate stays open after the last voiced burst
  return {
    push(frame) {
      const voiced = isVoiced(prev, frame, voicing);
      prev = frame;
      recent.push(voiced);
      if (recent.length > window) recent.shift();
      frames.push(frame);
      pass.push(false);
      if (recent.filter(Boolean).length >= minVoiced) {
        if (openFor === 0) pass.fill(true); // just opened: release the buffered onset too
        openFor = hangover;
      }
      if (openFor > 0) { pass[pass.length - 1] = true; openFor--; }
      if (frames.length <= delay) return new Int16Array(frame.length);
      const out = frames.shift();
      return pass.shift() ? out : new Int16Array(out.length);
    },
  };
}
