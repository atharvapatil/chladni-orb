import type { ChladniParams } from "../params";
import type { SpectralPartial } from "../audio/peaks";
import { evalMode, type Mode } from "./modes";

export interface MixerOutput {
  /** per mode, same order as `modes` */
  amps: Float32Array;
  /** Σ partial amps */
  energy: number;
  /** 0..1 off-resonance whole-plate shake */
  tremor: number;
}

export class ResonanceMixer {
  private readonly gamma: number;
  private readonly beta: number;
  private readonly tremorThreshold: number;
  private amps = new Float32Array(0);
  private readonly out: MixerOutput = { amps: this.amps, energy: 0, tremor: 0 };

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
    if (this.amps.length !== modes.length) {
      this.amps = new Float32Array(modes.length);
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

      let factor: number;
      if (pivot) {
        // centre clamp: modes must vanish at the plate centre, so each
        // mode is damped by how non-zero it is there.
        factor = Math.pow(1 - Math.min(1, Math.abs(evalMode(mode, 0, 0))), this.beta);
      } else {
        factor =
          1 - e + e * Math.pow(Math.abs(evalMode(mode, plate.exciterX, plate.exciterY)), this.beta);
      }

      const target = raw * factor;
      const tau = decayS * (fLowest / mode.freq);
      const decayed = this.amps[k]! * Math.exp(-dt / tau);
      this.amps[k] = Math.max(target, decayed);
    }

    let tremor = 0;
    if (look.tremor && energy > 0) {
      const rel = peakRaw / energy;
      if (rel < this.tremorThreshold) tremor = Math.min(1, 1 - rel / this.tremorThreshold);
    }

    this.out.amps = this.amps;
    this.out.energy = energy;
    this.out.tremor = tremor;
    return this.out;
  }
}
