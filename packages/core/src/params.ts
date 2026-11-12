export type PlateShape = "circle" | "square" | "diamond";
export type PlateDrive = "exciter" | "pivot";
export type PlateModelKind = "studio" | "lab";
export type Look = "textured" | "classic" | "ink";
export type MultiTone = "physical" | "morph";
export type Halo = "still" | "breathing";

export interface ChladniParams {
  listening: {
    /** dB, −24..+24. Analysis gain only. */
    input: number;
    /** 1..32 strongest spectral peaks. */
    partials: number;
    /** ms, 10..2000. Per-partial envelope after it stops. */
    decay: number;
    /** dB, −100..−30. Silence threshold. */
    floor: number;
    /** Hold current figure, stop listening. */
    freeze: boolean;
  };
  plate: {
    shape: PlateShape;
    drive: PlateDrive;
    /** cm, 5..100 (diameter / side). */
    size: number;
    /** Square width/height ratio, 0.5..2 — ≠1 makes a rectangle. */
    aspect: number;
    /** kg/m³, 400..12000. */
    density: number;
    /** 0..1: 0 = whole plate driven evenly, 1 = point drive. */
    exciterAmount: number;
    /** Drive point in plate coords, −1..1. */
    exciterX: number;
    exciterY: number;
    /** degrees, 0..360. */
    rotation: number;
    model: PlateModelKind;
  };
  studio: {
    /** mm, 0.05..3. */
    thickness: number;
    /** N/m, 50..10000. */
    tension: number;
    /** GPa, 0..400 (0 = pure membrane; steel ≈200). */
    elasticity: number;
  };
  lab: {
    /** mm, 0.05..12 */ thickness: number;
    /** g, 0..300 */ sandMass: number;
    /** GPa, 0.1..450 (Al ≈69) */ elasticity: number;
    /** 0.05..0.49 */ poisson: number;
    /** 0.001..0.2 — damping; widens resonances, blends figures */ loss: number;
    /** mm, 0.5..20 — drive tip radius */ contact: number;
    /** g, 0..200 — mass moving with the tip */ tipMass: number;
    /** N/m, 0..1e7 — spring holding the tip */ support: number;
    /** N/m, 0..10000 — in-plane tension; solid plates 0 */ pretension: number;
  };
  look: {
    look: Look;
    /** HSL/HEX sand colour. */
    color: string;
    /** 0.1..1.5 — how much sand (face "Grain"). */
    amount: number;
    multiTone: MultiTone;
    /** 0..2 plate brightness. */
    plateBrightness: number;
    /** 0..1 plate surface opacity; 0 draws only the sand/ink, no disc. */
    plateAlpha: number;
    /** HSL/HEX plate surface colour (felt). */
    plateColor: string;
    /** −1..1 lamp position. */
    lightX: number;
    lightY: number;
    /** 0.5..1.6 overall brightness. */
    exposure: number;
    halo: Halo;
    /** Off-resonance whole-plate shake. */
    tremor: boolean;
  };
  ink: {
    /** 0..1 thread → band. */ width: number;
    /** 0..2 coverage. */ intensity: number;
    /** 0..1 how much of the low valleys is inked. */ fill: number;
    /** 0..1 soft light around lines; 0 = sharp. */ glow: number;
  };
}

export const DEFAULT_PARAMS: ChladniParams = {
  listening: { input: 0, partials: 16, decay: 350, floor: -72, freeze: false },
  plate: {
    shape: "circle",
    drive: "exciter",
    size: 30,
    aspect: 1,
    density: 2700,
    exciterAmount: 0.7,
    exciterX: 0,
    exciterY: 0,
    rotation: 0,
    model: "studio",
  },
  studio: { thickness: 0.8, tension: 800, elasticity: 40 },
  lab: {
    thickness: 1,
    sandMass: 20,
    elasticity: 69,
    poisson: 0.33,
    loss: 0.02,
    contact: 5,
    tipMass: 10,
    support: 1e5,
    pretension: 0,
  },
  look: {
    look: "textured",
    color: "#f3ead8",
    amount: 1,
    multiTone: "physical",
    plateBrightness: 1,
    plateAlpha: 1,
    plateColor: "#1a1a1c",
    lightX: -0.5,
    lightY: 0.8,
    exposure: 1,
    halo: "breathing",
    tremor: true,
  },
  ink: { width: 0.4, intensity: 1, fill: 0.5, glow: 0.3 },
};

export interface ParamSchemaEntry {
  label: string;
  kind: "number" | "enum" | "boolean" | "color";
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: readonly string[];
  help: string;
}

export const PARAM_SCHEMA: Record<string, ParamSchemaEntry> = {
  "listening.input": {
    label: "Input",
    kind: "number",
    min: -24,
    max: 24,
    step: 0.1,
    unit: "dB",
    help: "How hard the sound shakes the plate. Never changes the audio.",
  },
  "listening.partials": {
    label: "Partials",
    kind: "number",
    min: 1,
    max: 32,
    step: 1,
    help: "How many of the strongest frequencies reach the plate.",
  },
  "listening.decay": {
    label: "Decay",
    kind: "number",
    min: 10,
    max: 2000,
    step: 1,
    unit: "ms",
    help: "How long a frequency keeps pushing after it stops.",
  },
  "listening.floor": {
    label: "Floor",
    kind: "number",
    min: -100,
    max: -30,
    step: 1,
    unit: "dB",
    help: "Below this level the plate hears silence.",
  },
  "listening.freeze": {
    label: "Freeze",
    kind: "boolean",
    help: "Hold the current figure; listening stops.",
  },
  "plate.shape": {
    label: "Shape",
    kind: "enum",
    options: ["circle", "square", "diamond"],
    help: "Plate outline. A square with aspect ≠ 1 is a rectangle; diamond is a square with the corners cut.",
  },
  "plate.drive": {
    label: "Drive",
    kind: "enum",
    options: ["exciter", "pivot"],
    help: "Exciter drives from a point; Pivot is Chladni's centre-clamped bench.",
  },
  "plate.size": {
    label: "Size",
    kind: "number",
    min: 5,
    max: 100,
    step: 0.5,
    unit: "cm",
    help: "Diameter or side. Bigger → denser figures, lower resonances.",
  },
  "plate.aspect": {
    label: "Aspect",
    kind: "number",
    min: 0.5,
    max: 2,
    step: 0.05,
    help: "Rectangle width/height ratio. Ignored for other shapes.",
  },
  "plate.density": {
    label: "Density",
    kind: "number",
    min: 400,
    max: 12000,
    step: 10,
    unit: "kg/m³",
    help: "How heavy the material is.",
  },
  "plate.exciterAmount": {
    label: "Exciter",
    kind: "number",
    min: 0,
    max: 1,
    step: 0.01,
    help: "0 = whole plate pushed evenly, 1 = point drive.",
  },
  "plate.exciterX": {
    label: "Exciter X",
    kind: "number",
    min: -1,
    max: 1,
    step: 0.01,
    help: "Drive point. Modes with a still line under it stay silent.",
  },
  "plate.exciterY": {
    label: "Exciter Y",
    kind: "number",
    min: -1,
    max: 1,
    step: 0.01,
    help: "Drive point. Modes with a still line under it stay silent.",
  },
  "plate.rotation": {
    label: "Rotation",
    kind: "number",
    min: 0,
    max: 360,
    step: 1,
    unit: "°",
    help: "Plate rotation.",
  },
  "plate.model": {
    label: "Model",
    kind: "enum",
    options: ["studio", "lab"],
    help: "Studio is a stretched membrane with some stiffness; Lab a free-edge plate in real units.",
  },
  "studio.thickness": {
    label: "Thickness",
    kind: "number",
    min: 0.05,
    max: 3,
    step: 0.01,
    unit: "mm",
    help: "Studio plate thickness.",
  },
  "studio.tension": {
    label: "Tension",
    kind: "number",
    min: 50,
    max: 10000,
    step: 10,
    unit: "N/m",
    help: "Tighter raises every figure in pitch.",
  },
  "studio.elasticity": {
    label: "Elasticity",
    kind: "number",
    min: 0,
    max: 400,
    step: 1,
    unit: "GPa",
    help: "0 is a pure stretched membrane; steel is about 200.",
  },
  "lab.thickness": {
    label: "Lab thickness",
    kind: "number",
    min: 0.05,
    max: 12,
    step: 0.01,
    unit: "mm",
    help: "How thick the plate is.",
  },
  "lab.sandMass": {
    label: "Sand",
    kind: "number",
    min: 0,
    max: 300,
    step: 1,
    unit: "g",
    help: "More sand lowers each figure in pitch.",
  },
  "lab.elasticity": {
    label: "Lab elasticity",
    kind: "number",
    min: 0.1,
    max: 450,
    step: 1,
    unit: "GPa",
    help: "How stiff the plate is. Aluminium is about 69.",
  },
  "lab.poisson": {
    label: "Poisson",
    kind: "number",
    min: 0.05,
    max: 0.49,
    step: 0.01,
    help: "How much the material swells sideways as it bends.",
  },
  "lab.loss": {
    label: "Loss",
    kind: "number",
    min: 0.001,
    max: 0.2,
    step: 0.001,
    help: "Damping. Higher values widen the resonances and blend the figures.",
  },
  "lab.contact": {
    label: "Contact",
    kind: "number",
    min: 0.5,
    max: 20,
    step: 0.1,
    unit: "mm",
    help: "The radius of the tip that pushes the plate.",
  },
  "lab.tipMass": {
    label: "Mass",
    kind: "number",
    min: 0,
    max: 200,
    step: 1,
    unit: "g",
    help: "Mass moving with the tip.",
  },
  "lab.support": {
    label: "Support",
    kind: "number",
    min: 0,
    max: 10000000,
    step: 10000,
    unit: "N/m",
    help: "The spring holding the tip.",
  },
  "lab.pretension": {
    label: "Pretension",
    kind: "number",
    min: 0,
    max: 10000,
    step: 10,
    unit: "N/m",
    help: "Tension in the plane of the plate. Solid plates use 0.",
  },
  "look.look": {
    label: "Look",
    kind: "enum",
    options: ["textured", "classic", "ink"],
    help: "Textured felt / turned metal / nodal lines only. Painting only, same physics.",
  },
  "look.color": {
    label: "Color",
    kind: "color",
    help: "Sand colour.",
  },
  "look.amount": {
    label: "Grain",
    kind: "number",
    min: 0.1,
    max: 1.5,
    step: 0.01,
    help: "How much sand is on the plate.",
  },
  "look.multiTone": {
    label: "Multi-tone",
    kind: "enum",
    options: ["physical", "morph"],
    help: "Physical adds partial energies (figure holds still); Morph lets them interfere (figure wanders).",
  },
  "look.plateBrightness": {
    label: "Plate",
    kind: "number",
    min: 0,
    max: 2,
    step: 0.01,
    help: "The brightness of the plate.",
  },
  "look.plateAlpha": {
    label: "Plate opacity",
    kind: "number",
    min: 0,
    max: 1,
    step: 0.01,
    help: "Opacity of the plate surface. 0 draws only the sand on whatever is behind the canvas.",
  },
  "look.plateColor": {
    label: "Plate color",
    kind: "color",
    help: "Colour of the plate surface (felt).",
  },
  "look.lightX": {
    label: "Light X",
    kind: "number",
    min: -1,
    max: 1,
    step: 0.01,
    help: "Lamp position.",
  },
  "look.lightY": {
    label: "Light Y",
    kind: "number",
    min: -1,
    max: 1,
    step: 0.01,
    help: "Lamp position.",
  },
  "look.exposure": {
    label: "Exposure",
    kind: "number",
    min: 0.5,
    max: 1.6,
    step: 0.01,
    help: "Overall brightness, in every view.",
  },
  "look.halo": {
    label: "Halo",
    kind: "enum",
    options: ["still", "breathing"],
    help: "The glow around the plate can breathe with the energy of the sound.",
  },
  "look.tremor": {
    label: "Tremor",
    kind: "boolean",
    help: "Notes with no resonance shake the plate as a whole.",
  },
  "ink.width": {
    label: "Ink width",
    kind: "number",
    min: 0,
    max: 1,
    step: 0.01,
    help: "From a thread to a band.",
  },
  "ink.intensity": {
    label: "Ink intensity",
    kind: "number",
    min: 0,
    max: 2,
    step: 0.01,
    help: "How strongly the ink covers the felt.",
  },
  "ink.fill": {
    label: "Ink fill",
    kind: "number",
    min: 0,
    max: 1,
    step: 0.01,
    help: "How much of the low valleys is inked. Rich chords show more of it.",
  },
  "ink.glow": {
    label: "Ink glow",
    kind: "number",
    min: 0,
    max: 1,
    step: 0.01,
    help: "The soft light around the lines. 0 is sharp ink.",
  },
};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export function mergeParams(base: ChladniParams, patch: DeepPartial<ChladniParams>): ChladniParams {
  const out = {
    listening: { ...base.listening, ...patch.listening },
    plate: { ...base.plate, ...patch.plate },
    studio: { ...base.studio, ...patch.studio },
    lab: { ...base.lab, ...patch.lab },
    look: { ...base.look, ...patch.look },
    ink: { ...base.ink, ...patch.ink },
  };
  return out;
}
