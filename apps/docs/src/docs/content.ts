import {
  DEFAULT_PARAMS,
  PARAM_SCHEMA,
  PRESETS,
  type ChladniParams,
  type ParamSchemaEntry,
} from "chladni-orb";

/** the UI control for an entry */
export type Control =
  | { kind: "enum"; options: { value: unknown; label: string }[] }
  | { kind: "number"; min: number; max: number; step: number; unit?: string }
  | { kind: "boolean" }
  | { kind: "color" }
  | { kind: "none" };

export interface DocEntry {
  /** route id: `plate.shape`, `prop.analyser` */
  id: string;
  group: string;
  name: string;
  label: string;
  /** one plain sentence */
  summary: string;
  accepts: string;
  def: string;
  /** short paragraphs: what you will see change, in everyday words */
  effect: string[];
  control: Control;
  initial: unknown;
  /** a note box under the default */
  tip?: string;
  /** the change only shows after a figure has formed, so play sound first */
  needsFigure?: boolean;
  /** code example for the right-hand panel (props only; params are generated) */
  example?: string;
}

export interface DocGroup {
  id: string;
  label: string;
  blurb: string;
  entries: DocEntry[];
}

const str = (v: unknown) => (typeof v === "string" ? `"${v}"` : String(v));

function accepts(e: ParamSchemaEntry): string {
  if (e.kind === "enum") return (e.options ?? []).map((o) => `"${o}"`).join(" | ");
  if (e.kind === "boolean") return "true or false";
  if (e.kind === "color") return 'a colour, like "#f3ead8"';
  return `a number from ${e.min} to ${e.max}${e.unit ? ` (${e.unit})` : ""}`;
}

// ---------------------------------------------------------------------------
// Plain-language explanations. A few words used throughout:
//   partials  = the strongest notes inside a sound, picked out each frame
//   modes     = the natural shapes a plate vibrates in
//   nodal lines = the still lines on a vibrating plate, where sand gathers

interface ParamDoc {
  summary?: string;
  effect: string[];
  tip?: string;
  needsFigure?: boolean;
}

const PARAM_DOCS: Record<string, ParamDoc> = {
  "listening.input": {
    summary: "How loud the sound seems to the plate.",
    effect: [
      "Think of it as a volume knob that only the plate can hear. It does not change what comes out of the speakers.",
      "Turn it up and quieter parts of the voice start to count, so the sand reacts to more and forms figures sooner. Turn it down and only the loudest notes get through, which gives cleaner, simpler figures that fade between words.",
    ],
  },
  "listening.partials": {
    summary: "How many notes from the sound reach the plate at once.",
    effect: [
      "A voice is made of many notes stacked together. This is how many of the strongest ones the plate listens to.",
      "With just a few, you get one clear figure that jumps to a new shape as the pitch moves. With many, several figures overlap into a richer, more detailed texture.",
    ],
    tip: "Changing this gives the plate fresh sand, so it starts over.",
  },
  "listening.decay": {
    summary: "How long a note keeps shaking the plate after it stops.",
    effect: [
      "Short values make the plate twitchy. Every syllable shows and the sand goes quiet between words.",
      "Long values blur words together into a figure that drifts rather than jumps, and keep the sand moving through pauses. For speech, 250 to 500 ms feels natural. For music, go longer.",
    ],
  },
  "listening.floor": {
    summary: "How quiet a sound has to be before the plate ignores it.",
    effect: [
      "Anything softer than this level counts as silence.",
      "A high setting (around -40) means the plate only reacts to loud moments and rests between words. A low setting (around -95) picks up breath and room noise, so the plate almost never goes still.",
    ],
  },
  "listening.freeze": {
    summary: "Pause the plate and keep the figure as it is.",
    effect: [
      "The plate stops listening and the sand stays put. Turn it off and it picks up where it left off.",
      "Handy for a screenshot or a hold moment in a call. In React the same thing is available as the frozen prop.",
    ],
    needsFigure: true,
  },
  "listening.idle": {
    summary: "What the sand does when the sound stops.",
    effect: [
      "With hold, the last figure stays on the plate, like real sand would.",
      "With relax, the grains slowly spread back out over the whole plate and shiver gently, like the plate is resting. When sound returns, the figure forms again from wherever the grains are. Nothing jumps or resets.",
      "Relax is what gives a voice agent its idle look with no extra code.",
    ],
    needsFigure: true,
  },
  "plate.shape": {
    summary: "The outline of the plate.",
    effect: [
      "A circle makes rings, spokes and petal shapes. A square makes grids, crosses and diagonals, the classic Chladni look. Diamond is a square stood on its corner with the points cut off.",
      "This is the biggest single change you can make to how the figures look. The sand starts fresh when you switch.",
    ],
  },
  "plate.drive": {
    summary: "Where the vibration goes into the plate.",
    effect: [
      "Exciter pushes the plate at one spot that you choose with exciter X and Y. Pivot is the old bench setup: the plate is held at its centre, so only figures that are still in the middle can appear.",
      "Pivot gives symmetric, old-fashioned figures and ignores the exciter position.",
    ],
  },
  "plate.size": {
    summary: "How big the plate is, in centimetres.",
    effect: [
      "A small plate has only a few natural shapes in the range of a voice, so figures are simple and the plate often just trembles.",
      "A large plate has dozens, so figures are fine and detailed and change with every vowel.",
    ],
  },
  "plate.aspect": {
    summary: "Stretch a square plate into a rectangle.",
    effect: [
      "1 is a square. Above 1 is wider than tall, below 1 is taller than wide. Rectangles turn the square's crosses into ladders and stripes along the long side.",
      "Does nothing for circle or diamond.",
    ],
  },
  "plate.density": {
    summary: "How heavy the plate material is.",
    effect: [
      "Heavier plates vibrate at lower notes, so every figure shifts down in pitch. Aluminium is about 2700, steel about 7800, glass about 2500.",
    ],
  },
  "plate.exciterAmount": {
    summary: "Whether the push is spread out or at one point.",
    effect: [
      "At 0 the whole plate is pushed evenly, so only round, ring-like figures appear. At 1 the push comes from a single point, so where that point sits decides which figures can form.",
      "Low values give calm, symmetric figures. High values let the exciter position pick out spokes and lopsided shapes.",
    ],
  },
  "plate.exciterX": {
    summary: "Left to right position of the push.",
    effect: [
      "-1 is the left edge, 0 the centre, 1 the right edge. A figure with a still line through this spot cannot be woken up.",
      "Moving the push off centre brings out spoke figures that a centred push never reaches. Only matters when exciter amount is above 0.",
    ],
  },
  "plate.exciterY": {
    summary: "Bottom to top position of the push.",
    effect: [
      "-1 is the bottom, 0 the centre, 1 the top. Same idea as exciter X: it chooses which of two matching figures gets to appear.",
    ],
  },
  "plate.rotation": {
    summary: "Turn the plate, in degrees.",
    effect: [
      "Rotates the plate and everything on it. Nothing about the physics changes, it just turns.",
    ],
  },
  "plate.model": {
    summary: "Which physics is used to work out the figures.",
    effect: [
      "Studio is a simple, fast model: a stretched skin with some stiffness. It is forgiving and good for interfaces.",
      "Lab is a real plate in real units, using the settings in the lab group. It takes a moment to recalculate after a change, and is there for people who want aluminium to behave like aluminium. The sand starts fresh when you switch.",
    ],
  },
  "studio.thickness": {
    summary: "How thick the Studio plate is.",
    effect: [
      "Thicker is stiffer. Figures move up in pitch and there are fewer of them in the voice range, so shapes get simpler.",
    ],
  },
  "studio.tension": {
    summary: "How tightly the Studio plate is stretched.",
    effect: [
      "Like tuning a drum: tighter raises every figure in pitch together. High tension with zero elasticity behaves like a drumhead and makes evenly spaced rings.",
    ],
  },
  "studio.elasticity": {
    summary: "How stiff the Studio plate material is.",
    effect: [
      "0 is a pure drum skin. Steel is about 200. Stiffness changes how far apart the figures are in pitch, which you feel as how quickly the shape changes as a voice rises.",
    ],
  },
  "lab.thickness": {
    summary: "How thick the Lab plate is.",
    effect: [
      "Doubling the thickness roughly doubles the pitch of every figure, so fewer of them fall inside a voice.",
    ],
  },
  "lab.sandMass": {
    summary: "How much sand sits on the Lab plate, in grams.",
    effect: [
      "Sand adds weight without stiffness, so more of it lowers every figure in pitch, just like on a real bench.",
    ],
  },
  "lab.elasticity": {
    summary: "How stiff the Lab plate material is.",
    effect: [
      "Stiffer materials vibrate at higher notes. Acrylic is about 3, aluminium about 69, brass about 100, steel about 200.",
    ],
  },
  "lab.poisson": {
    summary: "How much the material bulges sideways when bent.",
    effect: [
      "A material property. It nudges figures relative to each other rather than moving them all together, and matters most at the free edge of the plate.",
    ],
  },
  "lab.loss": {
    summary: "How much the Lab plate damps its own vibration.",
    effect: [
      "Low values give sharp figures that snap from one to the next. High values blend neighbouring figures into smoother, slower shapes, and the plate trembles less.",
    ],
  },
  "lab.contact": {
    summary: "How wide the tip that pushes the plate is, in millimetres.",
    effect: [
      "A fine tip can wake figures with a still line close by. A wide pad averages over them and behaves more like an even push.",
    ],
  },
  "lab.tipMass": {
    summary: "The weight of the pushing tip, in grams.",
    effect: [
      "Extra weight at the push point lowers the pitch of figures that move there, like a finger resting on a cymbal.",
    ],
  },
  "lab.support": {
    summary: "How firmly the tip is held against the plate.",
    effect: [
      "A soft support lets the push point float. A stiff one pins it, which raises the figures around it.",
    ],
  },
  "lab.pretension": {
    summary: "How tightly the Lab plate is stretched.",
    effect: ["Solid plates have none. Adding some mixes drum-like behaviour into the plate."],
  },
  "look.look": {
    summary: "The painting style.",
    effect: [
      "Textured is sand on felt with a lamp on it. Classic is sand on turned metal. Ink skips the sand and draws the still lines of the plate as ink, with its own settings in the ink group.",
      "The physics is the same in all three. Only the drawing changes.",
    ],
  },
  "look.color": {
    summary: "The colour of the sand (or the ink).",
    effect: [
      "Pick something that stands out against the plate colour so the figures read clearly. A close match gives a quiet, embossed feel.",
    ],
  },
  "look.amount": {
    summary: "How much sand is on the plate.",
    effect: [
      "Less sand draws thin, delicate lines and leaves the plate visible. More sand gives heavy ridges and a busier surface between them.",
    ],
  },
  "look.multiTone": {
    summary: "How several notes at once are combined.",
    effect: [
      "Physical adds them up, so the figure holds still. Morph lets them interfere over time, so the pattern wanders and breathes even on a steady sound.",
      "Morph is livelier for music. Physical is calmer and truer for speech.",
    ],
  },
  "look.plateBrightness": {
    summary: "How bright the plate surface is.",
    effect: [
      "0 is a black plate under the sand, 2 is nearly white. Use it to match the plate to your page without changing its colour.",
    ],
  },
  "look.plateAlpha": {
    summary: "How see-through the plate is.",
    effect: [
      "At 1 the plate is solid. At 0 only the sand is drawn, on top of whatever is behind the canvas, so the figure floats on your page. In between looks like tinted glass.",
    ],
  },
  "look.plateColor": {
    summary: "The colour of the plate surface.",
    effect: [
      "The felt under the sand. Set it to your page background for a seamless look, or pick a contrast colour for a framed one.",
    ],
  },
  "look.lightX": {
    summary: "Left to right position of the lamp.",
    effect: [
      "Only changes the shading of the sand ridges in the textured look, not where they are. -1 lights from the left, 1 from the right.",
    ],
  },
  "look.lightY": {
    summary: "Bottom to top position of the lamp.",
    effect: [
      "Light from above (1) looks most natural. Light from below (-1) makes ridges look like grooves.",
    ],
  },
  "look.exposure": {
    summary: "Overall brightness of the picture.",
    effect: ["Turn it down to sink the plate into a background, or up to lift a dark palette."],
  },
  "look.halo": {
    summary: "A soft glow around the rim.",
    effect: [
      "None turns it off. Still keeps it steady. Breathing makes it swell with the loudness of the sound.",
      "The glow reaches about a third of the plate's radius past the edge, so give the canvas some room or it gets cut into a box.",
    ],
  },
  "look.tremor": {
    summary: "Shake the whole plate when no figure fits the sound.",
    effect: [
      "Sometimes a note does not match any of the plate's natural shapes. A real plate just shakes. With tremor on, the sand shivers all over instead of sitting still.",
      "Turn it off and the plate only moves when a figure actually forms.",
    ],
  },
  "ink.width": {
    summary: "How thick the ink lines are.",
    effect: ["0 is a hairline, 1 is a broad band."],
  },
  "ink.intensity": {
    summary: "How dark the ink is.",
    effect: ["Below 1 the lines are see-through. Above 1 they go solid and fill in sooner."],
  },
  "ink.fill": {
    summary: "How much of the quiet areas gets inked too.",
    effect: [
      "0 keeps strict lines. 1 shades every calm region around them, which turns rich sounds into washes.",
    ],
  },
  "ink.glow": {
    summary: "A soft light around the ink lines.",
    effect: [
      "0 is a sharp pen. Higher values bloom the lines outward, which reads well when small.",
    ],
  },
};

const GROUP_META: Record<string, { label: string; blurb: string }> = {
  listening: {
    label: "listening",
    blurb:
      "How the plate hears: how loud, how many notes, how long they linger, and what the sand does in silence.",
  },
  plate: {
    label: "plate",
    blurb:
      "The plate itself: its shape, size, material, where it is pushed, and which physics model runs.",
  },
  studio: {
    label: "studio",
    blurb: "Settings for the Studio model, the simple and fast one. Three knobs.",
  },
  lab: {
    label: "lab",
    blurb:
      "Settings for the Lab model, a real plate in real units. Changing one of these switches the model to Lab for you.",
  },
  look: {
    label: "look",
    blurb:
      "How it is drawn: sand, plate, lamp, brightness, glow. None of these change the physics.",
  },
  ink: {
    label: "ink",
    blurb: "Settings for the ink style. Changing one of these switches the look to ink for you.",
  },
};

function controlFor(e: ParamSchemaEntry): Control {
  if (e.kind === "enum")
    return { kind: "enum", options: (e.options ?? []).map((o) => ({ value: o, label: o })) };
  if (e.kind === "boolean") return { kind: "boolean" };
  if (e.kind === "color") return { kind: "color" };
  return {
    kind: "number",
    min: e.min ?? 0,
    max: e.max ?? 1,
    step: e.step ?? 0.01,
    ...(e.unit ? { unit: e.unit } : {}),
  };
}

function paramEntry(key: string, e: ParamSchemaEntry): DocEntry {
  const [g, k] = key.split(".") as [keyof ChladniParams, string];
  const def = (DEFAULT_PARAMS[g] as Record<string, unknown>)[k];
  const doc = PARAM_DOCS[key] ?? { effect: [e.help] };
  return {
    id: key,
    group: g,
    name: k,
    label: e.label,
    summary: doc.summary ?? e.help,
    accepts: accepts(e),
    def: str(def),
    effect: doc.effect,
    control: controlFor(e),
    initial: def,
    ...(doc.tip ? { tip: doc.tip } : {}),
    ...(doc.needsFigure ? { needsFigure: true } : {}),
  };
}

// ---------------------------------------------------------------------------
// <ChladniPlate /> props

const sizes = [32, 64, 128, 256].map((v) => ({ value: v, label: String(v) }));

const PROP_ENTRIES: DocEntry[] = [
  {
    id: "prop.params",
    group: "component",
    name: "params",
    label: "Start from a preset",
    summary: "All the plate's settings, in one object.",
    accepts: "an object with any of the keys in the groups on the left",
    def: "DEFAULT_PARAMS",
    effect: [
      "Everything about the plate that is not the sound: shape, physics and paint. You only write the keys you want to change. Everything else uses the default.",
      "A key written as plate.shape in these docs means { plate: { shape } } in the object.",
      "Presets are ready-made params objects. Pick one here and its values are loaded into the plate and into the code on the right, so you can see exactly what it sets.",
    ],
    control: {
      kind: "enum",
      options: [
        { value: "defaults", label: "defaults" },
        ...Object.entries(PRESETS).map(([k, p]) => ({ value: k, label: p.label })),
      ],
    },
    initial: "defaults",
    tip: "In React the prop is the source of truth: if you remove a key later, that setting goes back to its default.",
  },
  {
    id: "prop.analyser",
    group: "component",
    name: "analyser",
    label: "Sound source",
    summary: "The sound the plate listens to.",
    accepts: "a Web Audio AnalyserNode, a SpectrumSource, or null",
    def: "null",
    effect: [
      "This is where the voice comes in. Any Web Audio AnalyserNode works: a microphone, a phone call, an audio element, a text-to-speech stream. SimulatedVoice is a built-in pretend voice for demos.",
      "With null the plate hears nothing. It then holds or relaxes, depending on listening.idle. For a call UI you usually keep the analyser connected and switch the state prop instead.",
      "Swap it whenever your call changes state. The plate fades between sources rather than cutting, and one source can drive many plates.",
    ],
    control: {
      kind: "enum",
      options: [
        { value: "voice", label: "SimulatedVoice" },
        { value: "null", label: "null" },
      ],
    },
    initial: "voice",
    example: `import { createMicAnalyser, createElementAnalyser, SimulatedVoice } from "chladni-orb";

const mic = await createMicAnalyser();        // the caller
const tts = createElementAnalyser(audioEl);   // the agent's own playback
const demo = new SimulatedVoice();            // no audio needed`,
  },
  {
    id: "prop.state",
    group: "component",
    name: "state",
    label: "Agent state",
    summary: "What the plate is doing right now: idle, connecting, listening or talking.",
    accepts: '"idle" | "connecting" | "listening" | "talking"',
    def: '"talking"',
    effect: [
      "This is the one prop a voice agent flips as a call goes along. Talking is the normal plate: it listens to the analyser and draws the voice. The other three are quiet states that ignore the sound.",
      "Idle: the sand rests, spread evenly over the plate, with a gentle shiver. Connecting: pulses roll out from the centre through the sand, so waiting looks like working. Listening: the same pulses, but drawn in from the edge, like the plate is taking the caller in.",
      "The same grains carry over between states. Going from talking to idle, the figure dissolves into the resting spread. Going back, it forms again from wherever the grains are. Nothing resets or flashes.",
    ],
    control: {
      kind: "enum",
      options: [
        { value: "idle", label: "idle" },
        { value: "connecting", label: "connecting" },
        { value: "listening", label: "listening" },
        { value: "talking", label: "talking" },
      ],
    },
    initial: "talking",
    tip: "In a call: idle before the call, connecting while dialling, listening while the caller speaks, talking while your agent speaks.",
    example: `const [state, setState] = useState<AgentState>("idle");

<ChladniPlate analyser={agentAudio} state={state} />

// as the call moves along
setState("connecting");
setState("listening");
setState("talking");`,
  },
  {
    id: "prop.frozen",
    group: "component",
    name: "frozen",
    label: "Frozen",
    summary: "Pause the plate and keep the figure as it is.",
    accepts: "true or false",
    def: "false",
    effect: [
      "While true, the plate stops listening and the sand stays where it is. Set it back to false and it carries on live.",
      "It is the same as listening.freeze, offered as a prop because it is usually a piece of UI state. The prop wins if both are set.",
    ],
    control: { kind: "boolean" },
    initial: false,
    needsFigure: true,
  },
  {
    id: "prop.pixelRatio",
    group: "component",
    name: "pixelRatio",
    label: "Sharpness",
    summary: "How many pixels are drawn per screen pixel.",
    accepts: "a number",
    def: "min(devicePixelRatio, 2)",
    effect: [
      "Lower it to save battery on dense screens, or for a deliberately coarse, grainy plate. It is fixed when the plate is created, so here the plate rebuilds when you change it.",
    ],
    control: {
      kind: "enum",
      options: [0.5, 1, 2].map((v) => ({ value: v, label: String(v) })),
    },
    initial: 1,
  },
  {
    id: "prop.fieldResolution",
    group: "component",
    name: "fieldResolution",
    label: "Detail of the figure",
    summary: "How finely the vibration pattern is calculated.",
    accepts: "a number (the side of a square grid)",
    def: "256",
    effect: [
      "Low values blur the still lines so sand settles in wider bands. High values sharpen them but cost more per frame. Easiest to see in the ink look. Fixed when the plate is created.",
    ],
    control: { kind: "enum", options: sizes },
    initial: 128,
  },
  {
    id: "prop.particleTexSize",
    group: "component",
    name: "particleTexSize",
    label: "Amount of sand available",
    summary: "The most grains the plate can have.",
    accepts: "a number (the side of a square grid; grains = side squared)",
    def: "256",
    effect: [
      "256 means up to 65,536 grains. look.amount then decides how many of them are shown. Small budgets give sparse, dotty plates that are cheap enough for a row of thumbnails. Large ones give dense sand for a hero plate. Fixed when the plate is created.",
    ],
    control: { kind: "enum", options: sizes },
    initial: 128,
  },
  {
    id: "prop.onReady",
    group: "component",
    name: "onReady",
    label: "onReady",
    summary: "Get a handle to control the plate from code.",
    accepts: "a function that receives the plate",
    def: "none",
    effect: [
      "Called once when the plate exists. The handle lets you change settings, swap the sound, freeze, reset the sand, and read live values like loudness. Use it for meters, a reset button, or to check WebGL support.",
    ],
    control: { kind: "none" },
    initial: null,
    example: `<ChladniPlate
  analyser={analyser}
  onReady={(plate) => {
    if (!plate.supported) showFallback();
    plateRef.current = plate;
  }}
/>

plateRef.current?.resetSand();
console.log(plateRef.current?.level.energy);`,
  },
  {
    id: "prop.ref",
    group: "component",
    name: "ref",
    label: "ref",
    summary: "The same handle as onReady, as a React ref.",
    accepts: "a React ref",
    def: "none",
    effect: [
      "Points at the plate handle, not the canvas. It is null before the plate mounts and after it unmounts. If you would rather own the canvas yourself, use the useChladniPlate() hook instead.",
    ],
    control: { kind: "none" },
    initial: null,
    example: `const plate = useRef<ChladniPlateHandle | null>(null);
<ChladniPlate ref={plate} analyser={analyser} />
<button onClick={() => plate.current?.resetSand()}>Reset sand</button>`,
  },
  {
    id: "prop.canvas",
    group: "component",
    name: "…canvas props",
    label: "Size, class and the rest",
    summary: "Anything else goes straight to the canvas element.",
    accepts: "any canvas attribute: className, style, aria-label, ...",
    def: "none",
    effect: [
      "Size the plate with CSS like any other element. The engine follows the element's size, so a responsive width just works. Keep it square unless you want a stretched plate.",
    ],
    control: { kind: "none" },
    initial: null,
    example: `<ChladniPlate
  analyser={analyser}
  className="agent-orb"
  style={{ width: "min(60vw, 420px)", aspectRatio: 1 }}
  aria-label="Agent is speaking"
/>`,
  },
];

// ---------------------------------------------------------------------------

export const DOC_GROUPS: DocGroup[] = [
  {
    id: "component",
    label: "<ChladniPlate />",
    blurb: "The React component's props. The sound, the settings object, and a few setup options.",
    entries: PROP_ENTRIES,
  },
  ...(["listening", "plate", "studio", "lab", "look", "ink"] as const).map((g) => {
    const meta = GROUP_META[g]!;
    return {
      id: g,
      label: meta.label,
      blurb: meta.blurb,
      entries: Object.entries(PARAM_SCHEMA)
        .filter(([key]) => key.startsWith(`${g}.`))
        .map(([key, e]) => paramEntry(key, e)),
    };
  }),
];

export const ALL_ENTRIES = DOC_GROUPS.flatMap((g) => g.entries);

export function findEntry(id: string): { group: DocGroup; entry: DocEntry } | null {
  for (const group of DOC_GROUPS) {
    const entry = group.entries.find((e) => e.id === id);
    if (entry) return { group, entry };
  }
  return null;
}
