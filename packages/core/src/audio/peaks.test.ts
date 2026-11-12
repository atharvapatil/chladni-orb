import { describe, expect, it } from "vitest";
import { pickPeaks } from "./peaks";

const BIN_HZ = 5.86;

function spectrumWithPeaks(freqs: number[], ampsDb: number[], bins = 4096): Float32Array {
  const s = new Float32Array(bins).fill(-120);
  for (let i = 0; i < freqs.length; i++) {
    const centre = freqs[i]! / BIN_HZ;
    for (let b = 0; b < bins; b++) {
      const d = (b - centre) / 2; // ~2-bin-wide gaussian
      const v = -120 + (ampsDb[i]! + 120) * Math.exp(-d * d);
      if (v > s[b]!) s[b] = v;
    }
  }
  return s;
}

const OPTS = { binHz: BIN_HZ, inputDb: 0, floorDb: -80, maxHz: 12000, count: 8 };

describe("pickPeaks", () => {
  it("finds peaks at 440 and 880 Hz within 1 Hz, ordered by amp", () => {
    const s = spectrumWithPeaks([440, 880], [-10, -30]);
    const peaks = pickPeaks(s, OPTS);
    expect(peaks).toHaveLength(2);
    expect(peaks[0]!.freq).toBeCloseTo(440, 0);
    expect(peaks[1]!.freq).toBeCloseTo(880, 0);
    expect(peaks[0]!.amp).toBeGreaterThan(peaks[1]!.amp);
  });

  it("parabolic interpolation refines an off-bin peak to <0.5 Hz", () => {
    const s = spectrumWithPeaks([443], [-10]);
    const peaks = pickPeaks(s, OPTS);
    expect(Math.abs(peaks[0]!.freq - 443)).toBeLessThan(0.5);
  });

  it("floor removes a weak third peak", () => {
    const s = spectrumWithPeaks([440, 880, 1320], [-10, -30, -95]);
    const peaks = pickPeaks(s, OPTS);
    expect(peaks).toHaveLength(2);
  });

  it("count caps the number of partials", () => {
    const s = spectrumWithPeaks([440, 880, 1320, 1760], [-10, -20, -30, -40]);
    const peaks = pickPeaks(s, { ...OPTS, count: 2 });
    expect(peaks).toHaveLength(2);
  });

  it("input gain lifts a peak above the floor", () => {
    const s = spectrumWithPeaks([440], [-95]);
    expect(pickPeaks(s, OPTS)).toHaveLength(0);
    expect(pickPeaks(s, { ...OPTS, inputDb: 24 })).toHaveLength(1);
  });
});
