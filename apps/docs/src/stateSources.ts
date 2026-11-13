import type { SpectrumSource } from "@chladni/react";

type Synth = (t: number, out: Float32Array, binHz: number) => void;

/** gaussian spectral bump at freq (Hz), peak db, width in bins. */
function gauss(out: Float32Array, binHz: number, freq: number, db: number, width: number): void {
  const c = freq / binHz;
  const lo = Math.max(1, Math.floor(c - width * 3));
  const hi = Math.min(out.length - 1, Math.ceil(c + width * 3));
  for (let b = lo; b <= hi; b++) {
    const d = (b - c) / width;
    const v = -100 + (db + 100) * Math.exp(-d * d);
    if (v > out[b]!) out[b] = v;
  }
}

/**
 * A self-clocked SpectrumSource driven by a synth function of time, the same
 * pattern SimulatedVoice uses, so several plates can share one instance.
 */
function makeSource(synth: Synth): SpectrumSource {
  const fftSize = 8192;
  const frequencyBinCount = 4096;
  const out = new Float32Array(frequencyBinCount);
  let t = 0;
  let lastNow: number | undefined;
  return {
    fftSize,
    frequencyBinCount,
    context: { sampleRate: 48000 },
    getFloatFrequencyData(array: Float32Array): void {
      const now = performance.now() / 1000;
      if (lastNow !== undefined) t += Math.min(0.1, now - lastNow);
      lastNow = now;
      out.fill(-100);
      synth(t, out, 48000 / fftSize);
      array.set(out.subarray(0, array.length));
    },
  };
}

/** ready: a soft, slow swell — the plate breathes on time alone. */
export const readySource: SpectrumSource = makeSource((t, out, binHz) => {
  const g = 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / 7);
  if (g < 0.06) return;
  const f0 = 120 + 18 * Math.sin(t * 0.35);
  gauss(out, binHz, f0, -52 + 14 * g, 2);
  gauss(out, binHz, f0 * 3.02, -60 + 12 * g, 2.5);
});

/** connecting: a ringback pulse — two tones on a 1.8s-on / 4.2s-off cadence. */
export const connectingSource: SpectrumSource = makeSource((t, out, binHz) => {
  const phase = t % 6;
  if (phase > 1.8) return;
  const env = Math.min(1, phase / 0.06, (1.8 - phase) / 0.12);
  const db = -20 - 30 * (1 - env);
  gauss(out, binHz, 440, db, 1.6);
  gauss(out, binHz, 480, db, 1.6);
});

/** settled: a voice-like tail that decays to a faint resting level. */
export const settledSource: SpectrumSource = makeSource((t, out, binHz) => {
  const env = Math.max(Math.exp(-t / 1.6), 0.3);
  const drop = 50 * (1 - env);
  for (const [f, db, w] of [
    [160, -16, 2],
    [320, -26, 2.5],
    [640, -38, 3],
  ] as const) {
    gauss(out, binHz, f, db - drop, w);
  }
});
