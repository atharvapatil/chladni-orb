import type { ChladniParams } from "../params";
import type { SpectralPartial } from "../audio/peaks";
import { evalMode, type Mode } from "./modes";

export interface MixerOutput {
  /** signed per-mode coefficients, same order as `modes`. Degenerate
   *  pairs (adjacent, marked pair 1/2) are meant to be summed coherently:
   *  field = Σ_i coef_i·φ_i. */
  coeffs: Float32Array;
  /** Σ partial amps */
  energy: number;
  /** 0..1 off-resonance whole-plate shake */
  tremor: number;
}

const INV_SQRT2 = Math.SQRT1_2;

export class ResonanceMixer {
  private readonly gamma: number;
  private readonly beta: number;
  private readonly tremorThreshold: number;
  private coeffs = new Float32Array(0);
  private readonly out: MixerOutput = { coeffs: this.coeffs, energy: 0, tremor: 0 };

  constructor(opts?: { gamma?: number; beta?: number; tremorThreshold?: number }) {
    this.gamma = opts?.gamma ?? 0.04;
    this.beta = opts?.beta ?? 1.5;
    this.tremorThreshold = opts?.tremorThreshold ?? 0.15;
  }

  update(
    dt: number,
    partials: readonly SpectralPartial[],
    modes: readonly Mode[],
    params: ChladniParams,
  ): MixerOutput {
    if (this.coeffs.length !== modes.length) {
      this.coeffs = new Float32Array(modes.length);
    }
    const { plate, look, listening, lab } = params;
    const gamma = plate.model === "lab" ? lab.loss : this.gamma;
    const e = plate.exciterAmount;
    const pivot = plate.drive === "pivot";
    const fLowest = modes.length > 0 ? modes[0]!.freq : 1;
    const decayS = Math.max(1e-3, listening.decay / 1000);

    let energy = 0;
    for (const p of partials) energy += p.amp;

    let peakRaw = 0;
    for (let k = 0; k < modes.length; k++) {
      const mode = modes[k]!;
      let raw = 0;
      for (const p of partials) {
        const d = (p.freq - mode.freq) / (gamma * mode.freq);
        raw += p.amp / (1 + d * d);
      }
      if (raw > peakRaw) peakRaw = raw;

      const tau = decayS * (fLowest / mode.freq);
      const decay = Math.exp(-dt / tau);
      const settle = (idx: number, target: number) => {
        const prev = this.coeffs[idx]!;
        const mag = Math.max(Math.abs(target), Math.abs(prev) * decay);
        const sign = target !== 0 ? Math.sign(target) : Math.sign(prev) || 1;
        this.coeffs[idx] = sign * mag;
      };

      if (mode.pair !== 1) {
        // singleton (pair 0 or a stray pair-2 tail)
        let factor: number;
        if (pivot) {
          factor = Math.pow(1 - Math.min(1, Math.abs(evalMode(mode, 0, 0))), this.beta);
        } else {
          factor =
            1 -
            e +
            e * Math.pow(Math.abs(evalMode(mode, plate.exciterX, plate.exciterY)), this.beta);
        }
        settle(k, raw * factor);
        continue;
      }

      // degenerate pair (k, k+1): coherent response ∝ φ_i(drive point)
      const other = modes[k + 1]!;
      let ci: number;
      let cj: number;
      if (pivot) {
        // centre clamp: weight = how far each member is from a node at centre
        ci = Math.pow(1 - Math.min(1, Math.abs(evalMode(mode, 0, 0))), this.beta);
        cj = Math.pow(1 - Math.min(1, Math.abs(evalMode(other, 0, 0))), this.beta);
      } else {
        ci = evalMode(mode, plate.exciterX, plate.exciterY);
        cj = evalMode(other, plate.exciterX, plate.exciterY);
      }
      const len = Math.hypot(ci, cj);
      if (len < 1e-9) {
        if (pivot) {
          // the whole pair is an antinode at the clamped centre: cannot ring
          settle(k, 0);
          settle(k + 1, 0);
          k++;
          continue;
        }
        ci = INV_SQRT2;
        cj = INV_SQRT2;
      } else {
        ci /= len;
        cj /= len;
      }
      // pivot is a fixed drive topology: the centre-node weights fully
      // determine the split (a member that is an antinode at the centre is
      // impossible), so exciterAmount only blends in for the exciter drive
      const wi = pivot ? ci : (1 - e) * INV_SQRT2 + e * ci;
      const wj = pivot ? cj : (1 - e) * INV_SQRT2 + e * cj;
      settle(k, raw * wi);
      settle(k + 1, raw * wj);
      k++;
    }

    let tremor = 0;
    if (look.tremor && energy > 0) {
      const rel = peakRaw / energy;
      if (rel < this.tremorThreshold) tremor = Math.min(1, 1 - rel / this.tremorThreshold);
    }

    this.out.coeffs = this.coeffs;
    this.out.energy = energy;
    this.out.tremor = tremor;
    return this.out;
  }
}
