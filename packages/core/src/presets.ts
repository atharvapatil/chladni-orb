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
    description: "Slow thin plate, off-centre exciter — diameters and petals for speech and song.",
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
  "ink-hexagon": {
    label: "Ink hexagon",
    description: "Nodal lines only, drawn in ink on a hexagonal plate.",
    params: {
      plate: { shape: "hexagon" },
      look: { look: "ink" },
      ink: { width: 0.35, intensity: 1.2, glow: 0.4 },
    },
  },
  "brass-rectangle": {
    label: "Brass rectangle",
    description: "Heavy brass plate cut along its edge — pure product modes.",
    params: {
      plate: { shape: "rectangle", aspect: 1.5, density: 8500 },
      studio: { elasticity: 100 },
      look: { look: "classic", color: "#d9b25f" },
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
