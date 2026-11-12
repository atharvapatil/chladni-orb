import type { ChladniParams } from "../params";
import { pickPeaks, type SpectralPartial } from "./peaks";

export interface SpectrumSource {
  readonly fftSize: number;
  readonly frequencyBinCount: number;
  readonly context: { readonly sampleRate: number };
  getFloatFrequencyData(array: Float32Array): void;
}

interface Tracked extends SpectralPartial {}

export class PartialAnalyser {
  readonly partials: readonly SpectralPartial[] = [];
  private readonly analyser: SpectrumSource;
  private readonly maxHz: number;
  private readonly binHz: number;
  private readonly buf: Float32Array;
  private tracked: Tracked[] = [];
  private lastOut: SpectralPartial[] = [];

  constructor(analyser: SpectrumSource, opts?: { maxHz?: number }) {
    this.analyser = analyser;
    this.maxHz = opts?.maxHz ?? 12000;
    this.binHz = analyser.context.sampleRate / analyser.fftSize;
    this.buf = new Float32Array(analyser.frequencyBinCount);
  }

  update(dtSeconds: number, listening: ChladniParams["listening"]): readonly SpectralPartial[] {
    if (listening.freeze) return this.lastOut;

    this.analyser.getFloatFrequencyData(this.buf);
    const peaks = pickPeaks(this.buf, {
      binHz: this.binHz,
      inputDb: listening.input,
      floorDb: listening.floor,
      maxHz: this.maxHz,
      count: listening.partials,
    });

    const decayS = Math.max(1e-3, listening.decay / 1000);
    const release = Math.exp(-dtSeconds / decayS);
    const next: Tracked[] = [];

    for (const t of this.tracked) {
      const hit = peaks.findIndex(
        (p) => Math.abs(p.freq - t.freq) <= Math.max(0.03 * t.freq, this.binHz),
      );
      if (hit >= 0) {
        const p = peaks[hit]!;
        peaks.splice(hit, 1);
        next.push({ freq: p.freq, amp: Math.max(p.amp, t.amp) });
      } else {
        const amp = t.amp * release;
        if (amp >= 1e-3) next.push({ freq: t.freq, amp });
      }
    }
    for (const p of peaks) next.push({ freq: p.freq, amp: p.amp });

    next.sort((x, y) => y.amp - x.amp);
    this.tracked = next;
    this.lastOut = next.slice(0, listening.partials);
    (this.partials as SpectralPartial[]).length = 0;
    (this.partials as SpectralPartial[]).push(...this.lastOut);
    return this.lastOut;
  }
}
