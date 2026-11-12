export interface SpectralPartial {
  /** Hz */
  freq: number;
  /** linear amplitude, ~0..1 relative to 0 dBFS */
  amp: number;
}

export interface PeakOptions {
  /** Hz per FFT bin */
  binHz: number;
  /** dB gain added to the spectrum before analysis */
  inputDb: number;
  /** bins below this level (after gain) are silence */
  floorDb: number;
  /** ignore bins above this frequency */
  maxHz: number;
  /** max number of partials returned */
  count: number;
}

export function pickPeaks(spectrumDb: Float32Array, o: PeakOptions): SpectralPartial[] {
  const out: SpectralPartial[] = [];
  const maxBin = Math.min(spectrumDb.length - 1, Math.floor(o.maxHz / o.binHz));
  for (let i = 1; i <= maxBin; i++) {
    const b = spectrumDb[i]! + o.inputDb;
    if (b < o.floorDb) continue;
    const a = spectrumDb[i - 1]! + o.inputDb;
    const c = spectrumDb[i + 1]! + o.inputDb;
    if (!(b > a && b >= c)) continue;
    // parabolic interpolation on the dB values
    const denom = a - 2 * b + c;
    const p = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
    const freq = (i + p) * o.binHz;
    const peakDb = b - 0.25 * (a - c) * p;
    const amp = Math.min(1, Math.max(0, Math.pow(10, peakDb / 20)));
    out.push({ freq, amp });
  }
  out.sort((x, y) => y.amp - x.amp);
  return out.slice(0, Math.max(0, o.count));
}
