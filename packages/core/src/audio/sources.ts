import type { SpectrumSource } from "./PartialAnalyser";

export interface AnalyserHandle {
  analyser: AnalyserNode;
  context: AudioContext;
  stop(): void;
}

export async function createMicAnalyser(ctx?: AudioContext): Promise<AnalyserHandle> {
  const context = ctx ?? new AudioContext();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const src = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 8192;
  analyser.smoothingTimeConstant = 0.5;
  src.connect(analyser);
  return {
    analyser,
    context,
    stop() {
      src.disconnect();
      for (const t of stream.getTracks()) t.stop();
    },
  };
}

export function createElementAnalyser(el: HTMLMediaElement, ctx?: AudioContext): AnalyserHandle {
  const context = ctx ?? new AudioContext();
  const src = context.createMediaElementSource(el);
  const analyser = context.createAnalyser();
  analyser.fftSize = 8192;
  analyser.smoothingTimeConstant = 0.5;
  src.connect(analyser);
  analyser.connect(context.destination);
  return {
    analyser,
    context,
    stop() {
      src.disconnect();
      analyser.disconnect();
    },
  };
}

/**
 * A fake voice-like spectrum for demos: a gliding pitch with harmonics plus
 * three wandering formant peaks, syllabic amplitude modulation and pauses.
 * Implements SpectrumSource so it plugs straight into PartialAnalyser.
 */
export class SimulatedVoice implements SpectrumSource {
  readonly fftSize = 8192;
  readonly frequencyBinCount = 4096;
  readonly context = { sampleRate: 48000 };
  private t = 0;
  private out = new Float32Array(this.frequencyBinCount);

  tick(dt: number): void {
    this.t += dt;
  }

  getFloatFrequencyData(array: Float32Array): void {
    const t = this.t;
    const binHz = this.context.sampleRate / this.fftSize;
    this.out.fill(-100);

    // syllabic gate: ~1.4 Hz syllables with pauses
    const syllable = Math.max(0, Math.sin(t * Math.PI * 2 * 1.4));
    if (syllable >= 0.15) {
      const gain = syllable;

      // pitch glides 110..220 Hz over a slow cycle
      const f0 = 110 + 55 * (1 + Math.sin(t * 0.9));
      const setBin = (freq: number, db: number, width: number) => {
        const c = freq / binHz;
        const lo = Math.max(1, Math.floor(c - width * 3));
        const hi = Math.min(array.length - 1, Math.ceil(c + width * 3));
        const target = this.out;
        for (let b = lo; b <= hi; b++) {
          const d = (b - c) / width;
          const v = -100 + (db + 100) * Math.exp(-d * d);
          if (v > target[b]!) target[b] = v;
        }
      };

      // harmonics
      for (let h = 1; h * f0 < 11000; h++) {
        const db = -18 - 6 * Math.log2(h) - (1 - gain) * 20;
        if (db < -99) break;
        setBin(h * f0, db, 1.5);
      }
      // formants wandering inside the stated bands
      const f1 = 550 + 250 * Math.sin(t * 1.7 + 1);
      const f2 = 1550 + 650 * Math.sin(t * 1.1 + 3);
      const f3 = 2700 + 300 * Math.sin(t * 2.3 + 5);
      for (const [freq, db, w] of [
        [f1, -14, 4],
        [f2, -22, 6],
        [f3, -30, 8],
      ] as const) {
        setBin(freq, db - (1 - gain) * 20, w);
      }
    }

    array.set(this.out.subarray(0, array.length));
  }
}
