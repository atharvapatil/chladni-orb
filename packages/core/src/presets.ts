import type { ChladniParams, DeepPartial } from "./params";

export interface Preset {
  label: string;
  description: string;
  params: DeepPartial<ChladniParams>;
}

/** Our own starter scenes, in the spirit of Figura's but original. */
export const PRESETS: Record<string, Preset> = {
  voice: {
    label: "Voice",
    description: "A slow, thin plate pushed off centre. Spokes and petals for speech and song.",
    params: {
      plate: {
        shape: "circle",
        drive: "exciter",
        size: 40,
        exciterAmount: 0.9,
        exciterX: 0.35,
        exciterY: 0.2,
      },
      studio: { thickness: 0.4, tension: 300 },
    },
  },
  "classic-square-pivot": {
    label: "Classic square pivot",
    description: "Chladni's bench: centre-clamped square plate, turned-metal look.",
    params: {
      plate: { shape: "square", drive: "pivot" },
      look: { look: "classic" },
    },
  },
  "ink-square": {
    label: "Ink square",
    description: "Nodal lines only, drawn in ink on a square plate.",
    params: {
      plate: { shape: "square" },
      look: { look: "ink" },
      ink: { width: 0.35, intensity: 1.2, glow: 0.4 },
    },
  },
  drumhead: {
    label: "Drumhead",
    description: "Pure stretched membrane: elasticity 0, high tension.",
    params: {
      plate: { shape: "circle", size: 25 },
      studio: { elasticity: 0, tension: 8000 },
    },
  },
  "lab-aluminium": {
    label: "Lab aluminium",
    description: "Free-edge aluminium disc in real units (interim model).",
    params: {
      plate: { shape: "circle", model: "lab" },
      lab: { elasticity: 69, poisson: 0.33, thickness: 2, loss: 0.01 },
    },
  },
};
