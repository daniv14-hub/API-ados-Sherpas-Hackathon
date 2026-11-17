// Voice client for the product screen: the open-mic logic of the test bench (bench.html), without any UI.
// Behaviour is the same as the bench: mic -> speech gate -> half-duplex mute while Sherpy's audio plays ->
// WebSocket /voice?case=<id>; model audio is PCM16 24 kHz queued chunk after chunk.
// The UI reads snapshot() every frame and gets a few callbacks. Secrets never reach this file.
import { createSpeechGate } from "/speech-gate.mjs";
import { micMuted } from "/half-duplex.mjs";
import { isFatalServerError } from "/conversation-logic.mjs";

const b64 = (buf) => { let s = ""; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

// handlers: onConnected(), onError({source, name?, message?}), onClosed({code}) (unexpected close only), onDone() (closing line played)
export function createVoiceClient({ caseId, model = "", handlers = {} }) {
  const OPENAI = model.startsWith("gpt-");
  let ws = null, ctx = null, micStream = null, micNode = null;
  let playHead = 0, playing = [];
  let connected = false, thinking = false, finished = false, closedByUs = false, errored = false;
  let reply = null; // {id, text, startAt, seconds, audioDone}; the latest Sherpy reply
  let replyCount = 0;

  function play(base64) {
    const bin = atob(base64), n = bin.length >> 1, pcm = new Float32Array(n);
    for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v >= 0x8000) v -= 0x10000; pcm[i] = v / 0x8000; }
    const buf = ctx.createBuffer(1, n, 24000); buf.copyToChannel(pcm, 0);
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination);
    playHead = Math.max(playHead, ctx.currentTime + 0.05); const startAt = playHead; src.start(playHead); playHead += buf.duration;
    playing.push(src); src.onended = () => { playing = playing.filter((s) => s !== src); };
    return { startAt, seconds: buf.duration };
  }
  const stopPlayback = () => { for (const s of playing) { try { s.stop(); } catch {} } playing = []; playHead = ctx?.currentTime ?? 0; };
  const audioPending = () => !!ctx && playHead > ctx.currentTime + 0.02;

  // The server replaces instructions and tools with Sherpy's own; the page only sets up audio.
  function sessionUpdate() {
    const input = { format: { type: "audio/pcm", rate: 24000 }, turn_detection: { type: "server_vad", silence_duration_ms: 600 } };
    if (OPENAI) input.transcription = { model: "gpt-4o-mini-transcribe" };
    const output = { format: { type: "audio/pcm", rate: 24000 } };
    if (OPENAI) output.voice = "marin";
    return { type: "session.update", session: { type: "realtime", audio: { input, output } } };
  }

  function fail(info) { if (errored || closedByUs) return; errored = true; handlers.onError?.(info); cleanup(); }

  function onEvent(ev) {
    const t = ev.type ?? "?";
    if (t === "error") {
      const message = ev.error?.message ?? "";
      if (isFatalServerError(message)) fail({ source: "event", message }); // other model errors are harmless mid-call
      return;
    }
    if (t === "session.created" || t === "session.updated") { if (!connected) { connected = true; handlers.onConnected?.(); } }
    if (t === "sherpy.conversation_done") {
      // Let the closing line finish playing, then hang up (voice is billed until the session closes).
      finished = true;
      let quiet = 0;
      const wait = setInterval(() => {
        quiet = audioPending() ? 0 : quiet + 1;
        if (quiet < 3) return; // 3 checks (0.6 s) of silence, so late audio chunks are not cut
        clearInterval(wait);
        closedByUs = true; ws?.close(); cleanup();
        handlers.onDone?.();
      }, 200);
      return;
    }
    if (t === "input_audio_buffer.speech_started") thinking = false;
    if (t === "input_audio_buffer.speech_stopped") thinking = true;
    if (t === "response.created") { thinking = true; reply = { id: ++replyCount, text: "", startAt: 0, seconds: 0, audioDone: false }; }
    if ((t === "response.output_audio.delta" || t === "response.audio.delta") && ev.delta && ctx) {
      reply ??= { id: ++replyCount, text: "", startAt: 0, seconds: 0, audioDone: false };
      const chunk = play(ev.delta);
      if (!reply.seconds) reply.startAt = chunk.startAt;
      reply.seconds += chunk.seconds;
      thinking = false;
    }
    if ((t === "response.output_audio_transcript.delta" || t === "response.audio_transcript.delta") && reply) reply.text += ev.delta ?? "";
    if ((t === "response.output_audio.done" || t === "response.audio.done") && reply) reply.audioDone = true;
    if (t === "response.done") { thinking = false; if (reply) reply.audioDone = true; }
  }

  async function start() {
    closedByUs = false; errored = false; finished = false; connected = false; thinking = false; reply = null;
    try {
      const audio = new AudioContext({ sampleRate: 24000 }); // the browser resamples the mic to 24 kHz for us
      ctx = audio;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      // Ended (stop()) while the browser asked for the mic: release it, or the mic stays on with nobody listening.
      if (closedByUs || ctx !== audio) { stream.getTracks().forEach((tr) => tr.stop()); return; }
      micStream = stream;
      await audio.audioWorklet.addModule("/mic-worklet.js");
      if (closedByUs || ctx !== audio) return; // cleanup() already released the mic and the context
      micNode = new AudioWorkletNode(audio, "mic-frames");
      audio.createMediaStreamSource(stream).connect(micNode);
    } catch (e) { fail({ source: "mic", name: e?.name }); return; }
    const gate = createSpeechGate(); // one per call: it keeps a short audio history
    const sock = new WebSocket(`${location.origin.replace(/^http/, "ws")}/voice?${new URLSearchParams({ case: caseId })}`);
    ws = sock;
    sock.onopen = () => sock.send(JSON.stringify(sessionUpdate()));
    sock.onmessage = (m) => { try { onEvent(JSON.parse(m.data)); } catch { /* ignore a malformed event */ } };
    sock.onclose = (e) => {
      if (sock !== ws || closedByUs || finished || errored) return;
      errored = true; cleanup();
      handlers.onClosed?.({ code: e.code });
    };
    micNode.port.onmessage = (e) => {
      const frame = new Int16Array(e.data);
      if (!ctx || ws?.readyState !== 1) return;
      // Breaths and coughs become silence (speech-gate.mjs), and so does everything while Sherpy speaks (half-duplex.mjs).
      const muted = micMuted(ctx.currentTime, playHead);
      const out = gate.push(muted ? new Int16Array(frame.length) : frame);
      const d = (window.sherpyMic ??= { frames: 0, sentVoice: 0, muted: 0, peak: 0 }); // counters for tests, no audio kept
      d.frames++; if (out.some((v) => v !== 0)) d.sentVoice++; if (muted) d.muted++;
      for (let i = 0; i < frame.length; i += 16) d.peak = Math.max(d.peak, Math.abs(frame[i]));
      ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b64(out.buffer) }));
    };
  }

  function cleanup() {
    stopPlayback();
    micStream?.getTracks().forEach((t) => t.stop()); micStream = null;
    ctx?.close().catch(() => {}); ctx = null; micNode = null;
    const s = ws; ws = null; try { s?.close(); } catch {}
    connected = false; thinking = false;
  }

  // End by the user: closes the voice session (and so stops billing).
  function stop() { closedByUs = true; cleanup(); }

  return {
    start, stop,
    snapshot: () => ({
      connected, thinking, finished,
      now: ctx?.currentTime ?? 0,
      speaking: audioPending(),
      muted: !!ctx && micMuted(ctx.currentTime, playHead),
      reply,
    }),
  };
}
