import { describe, expect, it } from "vitest";
import { PartialAnalyser, type SpectrumSource } from "./PartialAnalyser";
import { DEFAULT_PARAMS } from "../params";

const SAMPLE_RATE = 48000;
const FFT_SIZE = 8192;
const BIN_HZ = SAMPLE_RATE / FFT_SIZE; // 5.859375

class FakeAnalyser implements SpectrumSource {
  readonly fftSize = FFT_SIZE;
  readonly frequencyBinCount = FFT_SIZE / 2;
  readonly context = { sampleRate: SAMPLE_RATE };
  spectrum = new Float32Array(this.frequencyBinCount).fill(-120);
  reads = 0;
  getFloatFrequencyData(array: Float32Array): void {
    this.reads++;
    array.set(this.spectrum);
  }
  setPeak(freq: number, ampDb: number): void {
    this.spectrum.fill(-120);
    const centre = freq / BIN_HZ;
    for (let b = 0; b < this.spectrum.length; b++) {
      const d = (b - centre) / 2;
      const v = -120 + (ampDb + 120) * Math.exp(-d * d);
      if (v > this.spectrum[b]!) this.spectrum[b] = v;
    }
  }
}

const LISTENING = { ...DEFAULT_PARAMS.listening, floor: -80, decay: 200 };

describe("PartialAnalyser", () => {
  it("returns live peaks", () => {
    const a = new FakeAnalyser();
    a.setPeak(440, -10);
    const pa = new PartialAnalyser(a);
    const out = pa.update(1 / 60, LISTENING);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]!.freq).toBeCloseTo(440, 0);
  });

  it("decays unmatched partials with the Decay time constant and drops them", () => {
    const a = new FakeAnalyser();
    a.setPeak(440, -10);
    const pa = new PartialAnalyser(a);
    pa.update(1 / 60, LISTENING);
    const amp0 = pa.update(1 / 60, LISTENING)[0]!.amp;

    a.spectrum.fill(-120); // silence
    const decayS = LISTENING.decay / 1000;
    const after = pa.update(decayS, LISTENING);
    expect(after[0]!.amp).toBeCloseTo(amp0 / Math.E, 3);

    for (let i = 0; i < 200; i++) pa.update(0.1, LISTENING);
    expect(pa.update(0.1, LISTENING)).toHaveLength(0);
  });

  it("freeze returns the identical previous list without reading the analyser", () => {
    const a = new FakeAnalyser();
    a.setPeak(440, -10);
    const pa = new PartialAnalyser(a);
    const before = pa.update(1 / 60, LISTENING);
    const reads = a.reads;
    a.setPeak(999, -10);
    const during = pa.update(1 / 60, { ...LISTENING, freeze: true });
    expect(during).toBe(before);
    expect(a.reads).toBe(reads);
  });
});
