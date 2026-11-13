export type PlateShape = "circle" | "square" | "diamond";
export type PlateDrive = "exciter" | "pivot";
export type PlateModelKind = "studio" | "lab";
export type Look = "textured" | "classic" | "ink";
export type MultiTone = "physical" | "morph";
export type Halo = "none" | "still" | "breathing";
export type IdleBehaviour = "hold" | "relax";

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
    /**
     * What the sand does in silence: `hold` keeps the last figure; `relax`
     * lets the grains spread evenly over the plate and shiver until sound
     * returns.
     */
    idle: IdleBehaviour;
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
  listening: { input: 0, partials: 16, decay: 350, floor: -72, freeze: false, idle: "hold" },
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
    help: "How loud the sound seems to the plate. Never changes what you hear.",
  },
  "listening.partials": {
    label: "Partials",
    kind: "number",
    min: 1,
    max: 32,
    step: 1,
    help: "How many notes from the sound reach the plate at once.",
  },
  "listening.decay": {
    label: "Decay",
    kind: "number",
    min: 10,
    max: 2000,
    step: 1,
    unit: "ms",
    help: "How long a note keeps shaking the plate after it stops.",
  },
  "listening.floor": {
    label: "Floor",
    kind: "number",
    min: -100,
    max: -30,
    step: 1,
    unit: "dB",
    help: "Sounds quieter than this count as silence.",
  },
  "listening.freeze": {
    label: "Freeze",
    kind: "boolean",
    help: "Pause the plate and keep the figure as it is.",
  },
  "listening.idle": {
    label: "In silence",
    kind: "enum",
    options: ["hold", "relax"],
    help: "When the sound stops: hold keeps the last figure, relax spreads the sand back over the plate until sound returns.",
  },
  "plate.shape": {
    label: "Shape",
    kind: "enum",
    options: ["circle", "square", "diamond"],
    help: "The outline of the plate. A square with an aspect other than 1 is a rectangle. Diamond is a square on its corner with the points cut off.",
  },
  "plate.drive": {
    label: "Drive",
    kind: "enum",
    options: ["exciter", "pivot"],
    help: "Exciter pushes the plate at one spot. Pivot holds it at the centre, like Chladni's bench.",
  },
  "plate.size": {
    label: "Size",
    kind: "number",
    min: 5,
    max: 100,
    step: 0.5,
    unit: "cm",
    help: "Diameter or side. Bigger plates make finer figures at lower notes.",
  },
  "plate.aspect": {
    label: "Aspect",
    kind: "number",
    min: 0.5,
    max: 2,
    step: 0.05,
    help: "Width divided by height for a square plate. Ignored for other shapes.",
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
    help: "0 pushes the whole plate evenly. 1 pushes at a single point.",
  },
  "plate.exciterX": {
    label: "Exciter X",
    kind: "number",
    min: -1,
    max: 1,
    step: 0.01,
    help: "Where the plate is pushed, left to right. Figures with a still line under that spot cannot form.",
  },
  "plate.exciterY": {
    label: "Exciter Y",
    kind: "number",
    min: -1,
    max: 1,
    step: 0.01,
    help: "Where the plate is pushed, bottom to top. Figures with a still line under that spot cannot form.",
  },
  "plate.rotation": {
    label: "Rotation",
    kind: "number",
    min: 0,
    max: 360,
    step: 1,
    unit: "°",
    help: "Turn the plate.",
  },
  "plate.model": {
    label: "Model",
    kind: "enum",
    options: ["studio", "lab"],
    help: "Studio is a simple, fast model. Lab is a real plate in real units.",
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
    help: "Tighter raises every figure in pitch, like tuning a drum.",
  },
  "studio.elasticity": {
    label: "Elasticity",
    kind: "number",
    min: 0,
    max: 400,
    step: 1,
    unit: "GPa",
    help: "0 is a pure drum skin. Steel is about 200.",
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
    help: "Damping. Higher values blend neighbouring figures together.",
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
    help: "How tightly the plate is stretched. Solid plates use 0.",
  },
  "look.look": {
    label: "Look",
    kind: "enum",
    options: ["textured", "classic", "ink"],
    help: "Sand on felt, sand on metal, or ink lines only. Only the drawing changes.",
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
    help: "Physical adds notes together so the figure holds still. Morph lets them interfere so it wanders.",
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
    help: "How solid the plate is. At 0 only the sand is drawn, over whatever is behind it.",
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
    help: "Overall brightness of the picture.",
  },
  "look.halo": {
    label: "Halo",
    kind: "enum",
    options: ["none", "still", "breathing"],
    help: "A soft glow around the rim: off, steady, or breathing with the loudness.",
  },
  "look.tremor": {
    label: "Tremor",
    kind: "boolean",
    help: "When no figure fits the sound, shake the whole plate instead.",
  },
  "ink.width": {
    label: "Ink width",
    kind: "number",
    min: 0,
    max: 1,
    step: 0.01,
    help: "Line thickness, from a thread to a band.",
  },
  "ink.intensity": {
    label: "Ink intensity",
    kind: "number",
    min: 0,
    max: 2,
    step: 0.01,
    help: "How dark the ink is.",
  },
  "ink.fill": {
    label: "Ink fill",
    kind: "number",
    min: 0,
    max: 1,
    step: 0.01,
    help: "How much of the quiet areas gets inked too.",
  },
  "ink.glow": {
    label: "Ink glow",
    kind: "number",
    min: 0,
    max: 1,
    step: 0.01,
    help: "A soft light around the lines. 0 is a sharp pen.",
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
