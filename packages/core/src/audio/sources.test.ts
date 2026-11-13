import { afterEach, describe, expect, it, vi } from "vitest";
import { PartialAnalyser } from "./PartialAnalyser";
import { SimulatedVoice } from "./sources";
import { DEFAULT_PARAMS } from "../params";

const read = (v: SimulatedVoice) => {
  const out = new Float32Array(v.frequencyBinCount);
  v.getFloatFrequencyData(out);
  return out;
};
const binHz = (v: SimulatedVoice) => v.context.sampleRate / v.fftSize;

describe("SimulatedVoice", () => {
  afterEach(() => vi.useRealTimers());

  it("looks like an analyser: 8192-point FFT, dBFS bins", () => {
    const v = new SimulatedVoice();
    expect(v.fftSize).toBe(8192);
    expect(v.frequencyBinCount).toBe(4096);
    const out = read(v);
    expect(Math.max(...out)).toBeLessThanOrEqual(0);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(-100);
  });

  it("is deterministic after seek: the same clock gives the same spectrum", () => {
    const a = new SimulatedVoice();
    const b = new SimulatedVoice();
    a.seek(1.234);
    b.seek(1.234);
    expect(read(a)).toEqual(read(b));
  });

  it("puts its energy in the voice band while a syllable is on", () => {
    const v = new SimulatedVoice();
    // syllable gate is sin(2π·1.4·t); t = 1/(4·1.4) is its peak
    v.seek(1 / 5.6);
    const out = read(v);
    const hz = binHz(v);
    let loudest = 0;
    for (let i = 1; i < out.length; i++) if (out[i]! > out[loudest]!) loudest = i;
    const f = loudest * hz;
    expect(f).toBeGreaterThan(80);
    expect(f).toBeLessThan(4000);
  });

  it("goes silent between syllables", () => {
    const v = new SimulatedVoice();
    // t = 3/(4·1.4) is the trough of the gate
    v.seek(3 / 5.6);
    const out = read(v);
    expect(Math.max(...out)).toBe(-100);
  });

  it("advances by wall time, so many plates can share one instance", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const perf = vi.spyOn(performance, "now");
    perf.mockReturnValue(0);
    const v = new SimulatedVoice();
    v.seek(0);
    read(v);
    read(v); // a second read in the same instant must not move the clock
    const same = read(v);
    perf.mockReturnValue(500);
    const later = read(v);
    expect(later).not.toEqual(same);
    perf.mockRestore();
  });

  it("drives PartialAnalyser to a handful of partials in the speech band", () => {
    const v = new SimulatedVoice();
    v.seek(1 / 5.6);
    const pa = new PartialAnalyser(v);
    const partials = pa.update(1 / 60, DEFAULT_PARAMS.listening);
    expect(partials.length).toBeGreaterThan(2);
    expect(partials.length).toBeLessThanOrEqual(DEFAULT_PARAMS.listening.partials);
    for (const p of partials) expect(p.freq).toBeLessThan(11000);
  });
});
