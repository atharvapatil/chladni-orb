// Generates a ~12 s voice-like demo sample (harmonic pitch glides shaped by
// two formant envelopes, syllable gating) as a 22.05 kHz mono 16-bit WAV.
// Run: node apps/docs/scripts/make-sample.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 22050;
const SECONDS = 12;
const N = SR * SECONDS;
const out = new Int16Array(N);

const formantGain = (f, f1, f2) =>
  1.4 * Math.exp(-(Math.log2(f / f1) ** 2) / 0.35) +
  0.9 * Math.exp(-(Math.log2(f / f2) ** 2) / 0.5) +
  0.05;

for (let i = 0; i < N; i++) {
  const t = i / SR;
  // syllable gate ~1.3 Hz with soft edges
  const gate = Math.max(0, Math.sin(t * Math.PI * 2 * 1.3));
  const env = Math.min(1, gate * 3);
  if (env <= 0) continue;
  const f0 = 110 + 50 * Math.sin(t * 0.8) + 15 * Math.sin(t * 2.1);
  const f1 = 550 + 220 * Math.sin(t * 1.5 + 1);
  const f2 = 1600 + 500 * Math.sin(t * 1.1 + 3);
  let s = 0;
  for (let h = 1; h * f0 < 8000 && h <= 40; h++) {
    s += (formantGain(h * f0, f1, f2) / h) * Math.sin(2 * Math.PI * h * f0 * t + h * 0.7);
  }
  // light breath noise
  s += 0.02 * (Math.random() * 2 - 1);
  out[i] = Math.max(-32768, Math.min(32767, Math.round(s * env * 6000)));
}

const dataSize = N * 2;
const buf = Buffer.alloc(44 + dataSize);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + dataSize, 4);
buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(dataSize, 40);
Buffer.from(out.buffer).copy(buf, 44);

const dest = fileURLToPath(new URL("../public/audio/sample.wav", import.meta.url));
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, buf);
console.log(`wrote ${dest} (${(buf.length / 1024).toFixed(0)} KiB)`);
