import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSpeechGate } from '../public/speech-gate.mjs';

// WAV fixtures: 24 kHz mono PCM16. speech-* are synthetic (macOS `say`); breath/cough/clicks are
// generated noise shaped like the sounds that triggered phantom "¿Qué?" turns on 16/11.
function frames(name) {
  const buf = readFileSync(new URL(`./audio/${name}.wav`, import.meta.url));
  const dataAt = buf.indexOf('data') + 8;
  const pcm = new Int16Array(buf.buffer.slice(buf.byteOffset + dataAt, buf.byteOffset + buf.length - ((buf.length - dataAt) % 2)));
  const out = [];
  for (let i = 0; i + 480 <= pcm.length; i += 480) out.push(pcm.slice(i, i + 480));
  for (let i = 0; i < 60; i++) out.push(new Int16Array(480)); // 1.2 s of silence to flush the delay
  return out;
}
function passedRatio(name) {
  const gate = createSpeechGate();
  const input = frames(name);
  let sent = 0, loud = 0;
  // Output is delayed by 10 frames: compare frame i of the output with input i - 10.
  input.forEach((f, i) => {
    const o = gate.push(f);
    const src = input[i - 10];
    if (!src) return;
    const energy = src.reduce((s, v) => s + Math.abs(v), 0);
    if (energy / 480 > 300) { loud++; if (o.some((v) => v !== 0)) sent++; }
  });
  return { sent, loud, ratio: loud ? sent / loud : 0 };
}

test('lets English speech through', () => {
  const r = passedRatio('speech-en');
  assert.ok(r.ratio > 0.9, JSON.stringify(r));
});

test('lets Spanish speech through', () => {
  const r = passedRatio('speech-es');
  assert.ok(r.ratio > 0.9, JSON.stringify(r));
});

for (const name of ['breath', 'cough', 'clicks']) {
  test(`silences ${name}`, () => {
    const gate = createSpeechGate();
    for (const f of frames(name)) assert.ok(gate.push(f).every((v) => v === 0), `${name} leaked`);
  });
}

test('silence stays silence and output length matches input', () => {
  const gate = createSpeechGate();
  for (let i = 0; i < 50; i++) {
    const o = gate.push(new Int16Array(480));
    assert.equal(o.length, 480);
    assert.ok(o.every((v) => v === 0));
  }
});
