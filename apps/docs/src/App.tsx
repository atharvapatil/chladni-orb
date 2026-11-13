import {
  ChladniPlate,
  DEFAULT_PARAMS,
  PARAM_SCHEMA,
  PRESETS,
  SimulatedVoice,
  createElementAnalyser,
  createMicAnalyser,
  mergeParams,
  type ChladniParams,
  type ChladniPlateHandle,
  type DeepPartial,
  type ParamSchemaEntry,
  type SpectrumSource,
} from "@chladni/react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Button } from "./components/Button";
import { SegmentedControl } from "./components/SegmentedControl";
import { Slider } from "./components/Slider";
import { Switch } from "./components/Switch";
import { renderSampleBuffer } from "./sample";
import { IdleOverlay } from "./IdleOverlay";
import { SandField } from "./SandField";
import { renderVoiceBuffer } from "./voice";
import "./styles.css";

const GROUP_ORDER = ["listening", "plate", "studio", "lab", "look", "ink"] as const;

// <ChladniPlate /> props, for the reference table (mirrors ChladniPlateProps)
const COMPONENT_PROPS = [
  {
    name: "params",
    type: "DeepPartial<ChladniParams>",
    def: "DEFAULT_PARAMS",
    desc: "The plate's settings. Merged over DEFAULT_PARAMS on every change and deep-compared, so pass a fresh object freely; removing a key resets it to the default.",
  },
  {
    name: "analyser",
    type: "SpectrumSource | AnalyserNode | null",
    def: "null",
    desc: "What the plate listens to: a Web Audio AnalyserNode, anything implementing SpectrumSource (e.g. SimulatedVoice), or null for silence.",
  },
  {
    name: "frozen",
    type: "boolean",
    def: "false",
    desc: "Hold the current figure and stop listening (same as listening.freeze).",
  },
  {
    name: "pixelRatio",
    type: "number",
    def: "min(devicePixelRatio, 2)",
    desc: "Cap on the render resolution multiplier. Lower it for cheaper frames on dense screens.",
  },
  {
    name: "fieldResolution",
    type: "number",
    def: "256",
    desc: "Size of the vibration-field texture (N×N). Higher is sharper nodal lines, costlier.",
  },
  {
    name: "particleTexSize",
    type: "number",
    def: "256",
    desc: "Side of the particle texture; the plate carries up to N² grains (65,536 at 256). look.amount scales how many are drawn.",
  },
  {
    name: "onReady",
    type: "(plate: ChladniPlate) => void",
    def: "—",
    desc: "Called once with the imperative handle (setParams, setAnalyser, freeze, reset, resetSand, start, stop, destroy, partials, level, supported).",
  },
  {
    name: "ref",
    type: "Ref<ChladniPlate | null>",
    def: "—",
    desc: "The same handle as onReady, via a ref. useChladniPlate() is the hook form.",
  },
  {
    name: "…canvas props",
    type: "CanvasHTMLAttributes",
    def: "—",
    desc: "className, style, aria-*, etc. are forwarded to the <canvas>. Size it with CSS; the plate follows via ResizeObserver.",
  },
];

function paramType(e: ParamSchemaEntry): string {
  if (e.kind === "enum") return (e.options ?? []).map((o) => `"${o}"`).join(" | ");
  if (e.kind === "boolean") return "boolean";
  if (e.kind === "color") return "string (hex / hsl)";
  const range = e.min !== undefined && e.max !== undefined ? ` ${e.min}..${e.max}` : "";
  return `number${range}${e.unit ? ` ${e.unit}` : ""}`;
}

const FAQ = [
  {
    q: "What does the plate need from the browser?",
    a: "WebGL2 with EXT_color_buffer_float (or the half-float fallback). Without it the component paints a flat plate colour and reports supported: false on its handle. Microphone input additionally needs a secure context (https or localhost) and a user gesture to start the AudioContext.",
  },
  {
    q: "How do I drive it from a real call?",
    a: "Give analyser any Web Audio AnalyserNode — createMicAnalyser() for the caller, createElementAnalyser(audioEl) for playback, or your own node on the agent's output stream. fftSize 8192 and smoothing ≈ 0.5 work well. Switch analyser (or pass null) as the call changes state; the plate crossfades through its decay.",
  },
  {
    q: "Which parameters matter most for speech?",
    a: "listening.partials (how many peaks reach the plate), listening.decay (how long a figure lingers after a syllable), listening.floor (silence threshold) and plate.exciterAmount / exciterX / exciterY (which modes a voice can reach). The Voice preset is a good starting point.",
  },
  {
    q: "Why does the figure sometimes shake instead of forming lines?",
    a: "That is tremor: the dominant partial sits far from every resonance of the plate, so the whole plate shakes rather than a mode standing up. It is physical and intentional; turn it off with look.tremor: false, or change plate size/material so resonances land nearer the voice.",
  },
  {
    q: "Studio or Lab model?",
    a: "Studio is a stretched membrane with some stiffness — fast, forgiving, good for UI. Lab solves a real free-edge plate (exact circle, Rayleigh–Ritz rectangle) in physical units; it takes a moment to solve when its inputs change and is there for people who want aluminium to behave like aluminium.",
  },
  {
    q: "Can several plates share one voice?",
    a: "Yes. SimulatedVoice and AnalyserNodes can be passed to any number of plates; each keeps its own sand. The demos on this page all share one simulated voice.",
  },
];
const GROUP_LABEL: Record<string, string> = {
  listening: "Listening",
  plate: "Plate",
  studio: "Studio",
  lab: "Lab",
  look: "Look",
  ink: "Ink",
};
const GROUP_DESC: Record<string, string> = {
  listening: "What the analyser feeds the plate — gain, peak count, decay, silence floor.",
  plate: "The physical plate — outline, size, material, where the exciter pushes.",
  studio: "The analytical model — membrane tension meeting plate stiffness.",
  lab: "A real free-edge plate in real units — thickness, elasticity, Poisson.",
  look: "Paint, not physics — sand and plate colours, light, halo, plate opacity.",
  ink: "Nodal-line rendering used by the ink look.",
};

function getPath(obj: unknown, path: string): unknown {
  const [g, k] = path.split(".");
  return (obj as Record<string, Record<string, unknown>>)[g!]?.[k!];
}

function setPath(p: DeepPartial<ChladniParams>, path: string, value: unknown): void {
  const [g, k] = path.split(".");
  const rec = p as Record<string, Record<string, unknown>>;
  (rec[g!] ??= {})[k!] = value;
}

/** JS object-literal source (unquoted keys) for a params patch. */
function toJs(v: unknown, indent: number, depth = 0): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  const entries = Object.entries(v as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  const pad = " ".repeat(indent * (depth + 1));
  const end = " ".repeat(indent * depth);
  return `{\n${entries.map(([k, x]) => `${pad}${k}: ${toJs(x, indent, depth + 1)},`).join("\n")}\n${end}}`;
}

function diffParams(base: ChladniParams, cur: ChladniParams): DeepPartial<ChladniParams> {
  const diff: Record<string, Record<string, unknown>> = {};
  for (const g of Object.keys(base) as (keyof ChladniParams)[]) {
    for (const k of Object.keys(base[g]) as string[]) {
      const b = (base[g] as Record<string, unknown>)[k];
      const c = (cur[g] as Record<string, unknown>)[k];
      if (JSON.stringify(b) !== JSON.stringify(c)) (diff[g] ??= {})[k] = c;
    }
  }
  return diff;
}

const simVoice = new SimulatedVoice();

// voice-agent states. Talking is the plate proper, driven by a voice; the
// quiet states are particle animations (SandField) with no audio behind them.
const PLATE_STATES = [
  {
    id: "idle",
    name: "Idle",
    cap: "No call yet. Loose sand shivering in place — alive, but clearly not listening.",
    code: '<SandField mode="idle" />',
    p: {},
    source: null,
    custom: "idle",
  },
  {
    id: "connecting",
    name: "Connecting",
    cap: "Placing the call. Pulses spring out from the centre so waiting reads as working.",
    code: '<SandField mode="connecting" />',
    p: {},
    source: null,
    custom: "connecting",
  },
  {
    id: "listening",
    name: "Listening",
    cap: "The caller is speaking. Pulses draw in from the rim — taking it in, no waveform.",
    code: '<SandField mode="listening" />',
    p: {},
    source: null,
    custom: "listening",
  },
  {
    id: "talking",
    name: "Talking",
    cap: "The agent is speaking. Its partials drive the plate's modes and the figure forms live.",
    code: "<ChladniPlate analyser={agent} />",
    p: {},
    source: simVoice,
  },
] as const;

// live-level bands for the side card; Voice is the telephone speech band
const LEVEL_BANDS = [
  { key: "bass", label: "Bass", lo: 0, hi: 250, tip: "Under 250 Hz — kicks and low hum." },
  { key: "lowmid", label: "Low mid", lo: 250, hi: 1000, tip: "250 Hz–1 kHz — body of the sound." },
  { key: "highmid", label: "High mid", lo: 1000, hi: 4000, tip: "1–4 kHz — speech clarity." },
  { key: "treble", label: "Treble", lo: 4000, hi: 1e9, tip: "Over 4 kHz — hats, hiss, sparkle." },
  {
    key: "voice",
    label: "Voice",
    lo: 300,
    hi: 3400,
    tip: "The telephone band — where speech sits.",
  },
] as const;

let voiceBuf: Promise<AudioBuffer> | null = null;
const loadVoice = () => (voiceBuf ??= renderVoiceBuffer());

type Theme = "dark" | "light";

// the plate reads as a page element: light theme uses dark grains on a light felt
const THEME_LOOK: Record<Theme, DeepPartial<ChladniParams>> = {
  dark: {
    look: { color: "#f3ead8", plateAlpha: 1, plateColor: "#1a1a1c", amount: 1, halo: "none" },
  },
  light: {
    look: { color: "#2b2520", plateAlpha: 1, plateColor: "#e9e6df", amount: 1, halo: "none" },
  },
};

function initialTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const initial = useMemo(() => {
    const q = new URLSearchParams(location.search);
    const preset = q.get("preset");
    const base =
      preset && PRESETS[preset]
        ? mergeParams(DEFAULT_PARAMS, PRESETS[preset].params)
        : DEFAULT_PARAMS;
    const themed = mergeParams(base, THEME_LOOK[initialTheme()]);
    return q.get("model") === "lab" ? mergeParams(themed, { plate: { model: "lab" } }) : themed;
  }, []);
  const [params, setParams] = useState<ChladniParams>(initial);
  const [patch, setPatch] = useState<DeepPartial<ChladniParams>>(() =>
    diffParams(DEFAULT_PARAMS, initial),
  );
  const [source, setSource] = useState<SpectrumSource | AnalyserNode | null>(null);
  const [sourceName, setSourceName] = useState("none");
  const [frozen, setFrozen] = useState(false);
  const [plateSize, setPlateSize] = useState(320);
  const [plateRadius, setPlateRadius] = useState(6);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [previewAnalyser, setPreviewAnalyser] = useState<AnalyserNode | null>(null);
  const previewRef = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode | null } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [snippetLang, setSnippetLang] = useState<"react" | "vanilla">("react");
  const [status, setStatus] = useState("warming up");
  const plateRef = useRef<ChladniPlateHandle | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const applyPatch = useCallback((p: DeepPartial<ChladniParams>) => {
    setPatch((prev) => {
      const next = { ...prev };
      for (const [g, kv] of Object.entries(p)) {
        (next as Record<string, Record<string, unknown>>)[g] = {
          ...(next as Record<string, Record<string, unknown>>)[g],
          ...kv,
        };
      }
      return next;
    });
    setParams((prev) => mergeParams(prev, p));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("chladni-theme", next);
      return next;
    });
  }, []);

  // keep the plate in tune with the page theme (Tune panel still overrides)
  useEffect(() => {
    const look = THEME_LOOK[theme].look;
    if (look) applyPatch({ look });
  }, [theme, applyPatch]);

  // load a fresh param set (preset or factory defaults) under the page theme
  const loadParams = useCallback(
    (p: DeepPartial<ChladniParams>) => {
      const next = mergeParams(mergeParams(DEFAULT_PARAMS, THEME_LOOK[theme]), p);
      setParams(next);
      setPatch(diffParams(DEFAULT_PARAMS, next));
    },
    [theme],
  );
  const applyPreset = useCallback(
    (key: string) => {
      const p = PRESETS[key];
      if (p) loadParams(p.params);
    },
    [loadParams],
  );

  const idle = source === null && !frozen;
  const idleRef = useRef(idle);
  idleRef.current = idle;
  useEffect(() => {
    if (!idle) return;
    setLevels({});
    setStatus("idle · no voice");
  }, [idle]);

  // status line follows partials each ~250 ms
  useEffect(() => {
    const id = setInterval(() => {
      const p = plateRef.current;
      if (!p || idleRef.current) return;
      const n = p.partials.length;
      const lv: Record<string, number> = {};
      for (const b of LEVEL_BANDS) {
        let m = 0;
        for (const x of p.partials) if (x.freq >= b.lo && x.freq < b.hi && x.amp > m) m = x.amp;
        lv[b.key] = m;
      }
      setLevels(lv);
      const list = p.partials
        .slice(0, 6)
        .map((x) => `${x.freq.toFixed(0)}`)
        .join(", ");
      setStatus(
        p.supported
          ? p.level.solving
            ? "lab · solving…"
            : p.level.tremor > 0.5
              ? "listening · trembling"
              : n > 0
                ? `listening · ${n} partial${n === 1 ? "" : "s"} (${list}${n > 6 ? "…" : ""} Hz)`
                : "listening · silence"
          : "WebGL2 unavailable — static fallback",
      );
    }, 250);
    return () => clearInterval(id);
  }, []);

  const stopSource = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    audioElRef.current?.pause();
    setSource(null);
    setSourceName("none");
  }, []);

  const togglePreview = useCallback(async () => {
    if (previewRef.current) {
      previewRef.current.src?.stop();
      void previewRef.current.ctx.close();
      previewRef.current = null;
      setPreviewAnalyser(null);
      return;
    }
    const ctx = new AudioContext();
    previewRef.current = { ctx, src: null };
    const buffer = await loadVoice();
    if (previewRef.current?.ctx !== ctx) {
      void ctx.close();
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0.5;
    src.connect(analyser);
    analyser.connect(ctx.destination);
    src.start();
    previewRef.current.src = src;
    setPreviewAnalyser(analyser);
  }, []);

  const pickSim = useCallback(async () => {
    stopSource();
    const ctx = new AudioContext();
    const buffer = await renderVoiceBuffer();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0.5;
    src.connect(analyser);
    analyser.connect(ctx.destination);
    src.start();
    setSource(analyser);
    setSourceName("simulated voice");
    stopRef.current = () => {
      src.stop();
      void ctx.close();
    };
  }, [stopSource]);

  const pickMic = useCallback(async () => {
    stopSource();
    try {
      const h = await createMicAnalyser();
      setSource(h.analyser);
      setSourceName("microphone");
      stopRef.current = () => {
        h.stop();
        void h.context.close();
      };
    } catch (e) {
      setSourceName(`mic unavailable: ${String(e)}`);
    }
  }, [stopSource]);

  const pickSample = useCallback(async () => {
    stopSource();
    const ctx = new AudioContext();
    const buffer = await renderSampleBuffer();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0.5;
    src.connect(analyser);
    analyser.connect(ctx.destination);
    src.start();
    setSource(analyser);
    setSourceName("sample");
    stopRef.current = () => {
      src.stop();
      void ctx.close();
    };
  }, [stopSource]);

  const pickFile = useCallback(
    async (file: File) => {
      stopSource();
      const el = new Audio(URL.createObjectURL(file));
      el.loop = true;
      audioElRef.current = el;
      const h = createElementAnalyser(el);
      await el.play();
      setSource(h.analyser);
      setSourceName(`file: ${file.name}`);
      stopRef.current = () => {
        h.stop();
        void h.context.close();
        el.pause();
      };
    },
    [stopSource],
  );

  // ?source=sim boots straight into a source (for screenshots)
  useEffect(() => {
    const src = new URLSearchParams(location.search).get("source");
    if (src === "sim") pickSim();
  }, [pickSim]);

  // what the stage controls set — shape, look and colours — follows down to
  // the demo and state plates so they stay instances of the same plate
  const stageLook = useMemo(
    () => ({
      plate: {
        shape: params.plate.shape,
        aspect: params.plate.aspect,
        rotation: params.plate.rotation,
      },
      look: {
        ...THEME_LOOK[theme].look,
        look: params.look.look,
        color: params.look.color,
        plateColor: params.look.plateColor,
      },
    }),
    [
      theme,
      params.plate.shape,
      params.plate.aspect,
      params.plate.rotation,
      params.look.look,
      params.look.color,
      params.look.plateColor,
    ],
  );
  const withStageLook = (p: DeepPartial<ChladniParams>): DeepPartial<ChladniParams> => ({
    ...stageLook,
    ...p,
    plate: { ...stageLook.plate, ...p.plate },
    look: { ...stageLook.look, ...p.look },
  });
  const plateRadiusStyle = {
    "--plate-radius": params.plate.shape === "circle" ? "9999px" : `${plateRadius}px`,
  } as CSSProperties;

  const copyText = useCallback(async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }, []);

  // the quick-start snippet follows the stage + Tune panel: whatever differs
  // from the defaults (ignoring the page theme's palette) becomes `params`
  const tunedPatch = useMemo(
    () => diffParams(mergeParams(DEFAULT_PARAMS, THEME_LOOK[theme]), params),
    [params, theme],
  );
  const snippet = useMemo(() => {
    const p = toJs(tunedPatch, 2);
    const hasParams = p !== "{}";
    const kind = sourceName.startsWith("file")
      ? "sample"
      : sourceName === "sample" || sourceName === "simulated voice"
        ? sourceName
        : "microphone";
    const [sourceLine, analyserExpr] = {
      microphone: [
        "const mic = await createMicAnalyser(); // or any AnalyserNode — see step 2",
        "mic.analyser",
      ],
      sample: [
        "const sample = createElementAnalyser(audioEl); // any <audio> / <video> element",
        "sample.analyser",
      ],
      "simulated voice": [
        "const voice = new SimulatedVoice(); // demo source, no audio needed",
        "voice",
      ],
    }[kind];
    const helper = {
      microphone: "createMicAnalyser",
      sample: "createElementAnalyser",
      "simulated voice": "SimulatedVoice",
    }[kind];
    if (snippetLang === "react") {
      return `import { ChladniPlate, ${helper} } from "@chladni/react";

${sourceLine}

<ChladniPlate
  analyser={${analyserExpr}}${hasParams ? `\n  params={${p.replace(/\n/g, "\n  ")}}` : ""}
  style={{ width: ${plateSize}, height: ${plateSize} }}
/>`;
    }
    return `import { createChladniPlate, ${helper} } from "@chladni/core";

${sourceLine}
const plate = createChladniPlate(document.querySelector("canvas")${hasParams ? `, {\n  params: ${p.replace(/\n/g, "\n  ")},\n}` : ""});
plate.setAnalyser(${analyserExpr});`;
  }, [tunedPatch, snippetLang, sourceName, plateSize]);

  const groups = useMemo(() => {
    const g: Record<string, [string, ParamSchemaEntry][]> = {};
    for (const [path, entry] of Object.entries(PARAM_SCHEMA)) {
      const key = path.split(".")[0]!;
      if (key === "lab" && params.plate.model !== "lab") continue;
      if (key === "ink" && params.look.look !== "ink") continue;
      if (key === "studio" && params.plate.model === "lab") continue;
      (g[key] ??= []).push([path, entry]);
    }
    return GROUP_ORDER.filter((k) => g[k]).map((k) => [k, g[k]!] as const);
  }, [params.plate.model, params.look.look]);

  const demos = [
    {
      title: "The field",
      p: { look: { look: "ink" } },
      cap: "Standing-wave field drawn in ink — this is what the sand feels.",
    },
    {
      title: "The sand",
      p: {},
      cap: "The same field with sand: grains hop off antinodes and settle on the nodes.",
    },
    {
      title: "No exciter",
      p: { plate: { exciterAmount: 0 } },
      cap: "Exciter at 0 — the whole plate is pushed evenly, so only ring modes answer.",
    },
    {
      title: "Morph",
      p: { look: { multiTone: "morph" } },
      cap: "Morph — partials interfere, so the figure wanders instead of holding still.",
    },
  ] as const;

  return (
    <>
      <header className="nav">
        <a className="brand" href="#top">
          chladni
        </a>
        <nav>
          <a href="#use">Quick start</a>
          <a href="#states">States</a>
          <a href="#presets">Presets</a>
          <a href="#tune">Tune</a>
          <a href="#props">Props</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="nav-right">
          <a href="https://github.com/<user>/chladni">GitHub</a>
          <Button
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            onClick={toggleTheme}
          >
            {theme === "dark" ? "☀ Light" : "☾ Dark"}
          </Button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <p className="oss">
            <i />
            Open source · MIT · React + vanilla TS
          </p>
          <h1>A voice-reactive Chladni plate for the web.</h1>
          <p className="tagline">
            Sound in, sand figures out. Hand <b>&lt;ChladniPlate /&gt;</b> any Web Audio
            AnalyserNode — a microphone, a call, a TTS stream — and it draws the voice as the
            standing-wave figures of a vibrating plate. Built as a visual presence for{" "}
            <b>AI voice agents</b>: idle, connecting, listening, talking.
          </p>
          <div className="hero-actions">
            <a className="btn primary" href="#use">
              Quick start →
            </a>
            <span className="install">
              <span>$</span>npm i @chladni/react
              <Button onClick={() => void copyText("npm i @chladni/react", "install")}>
                {copied === "install" ? "Copied" : "Copy"}
              </Button>
            </span>
            <a className="btn" href="https://github.com/<user>/chladni">
              GitHub
            </a>
          </div>
          <ul className="hero-meta">
            <li>WebGL2, one shared context for any number of plates</li>
            <li>Physics-based: real plate modes, Lorentzian resonance</li>
            <li>Zero dependencies in the engine</li>
          </ul>
        </section>

        <section
          className="stage-card"
          style={
            {
              "--plate-size": `${plateSize}px`,
              "--plate-radius": params.plate.shape === "circle" ? "9999px" : `${plateRadius}px`,
            } as CSSProperties
          }
        >
          <div className="stage">
            <IdleOverlay idle={idle} params={params} count={6000}>
              <ChladniPlate
                params={patch}
                analyser={source}
                frozen={frozen}
                onReady={(p) => {
                  plateRef.current = p;
                }}
              />
            </IdleOverlay>
            <p className="stage-cap">
              {params.look.look} · {params.plate.shape}
              {params.plate.aspect !== 1 ? ` ×${params.plate.aspect}` : ""}
            </p>
          </div>

          <div className="stage-row">
            <div className="segctl">
              <span>Voice</span>
              <SegmentedControl
                ariaLabel="Voice source"
                options={[
                  { value: "none", label: "Off" },
                  { value: "sample", label: "Sample" },
                  { value: "microphone", label: "Microphone" },
                  { value: "file", label: "Your file" },
                  { value: "simulated voice", label: "Simulated voice" },
                ]}
                value={
                  sourceName === "none"
                    ? "none"
                    : sourceName.startsWith("file")
                      ? "file"
                      : sourceName
                }
                onChange={(v) => {
                  if (v === "none") stopSource();
                  else if (v === "sample") void pickSample();
                  else if (v === "microphone") void pickMic();
                  else if (v === "file") fileRef.current?.click();
                  else void pickSim();
                }}
              />
            </div>
            <span className="row-actions">
              <Button onClick={() => plateRef.current?.resetSand()}>Reset sand</Button>
              <Button variant={frozen ? "primary" : "default"} onClick={() => setFrozen((f) => !f)}>
                {frozen ? "Unfreeze" : "Freeze"}
              </Button>
            </span>
          </div>

          <div className="stage-grid">
            <div className="segctl">
              <span>Shape</span>
              <SegmentedControl
                ariaLabel="Plate shape"
                options={["circle", "square", "diamond"]}
                value={params.plate.shape}
                onChange={(s) =>
                  applyPatch({
                    plate: {
                      shape: s,
                      rotation: s === "circle" ? params.plate.rotation : 0,
                      ...(s === "diamond" ? { aspect: 1 } : {}),
                    },
                  })
                }
              />
            </div>
            <div className="segctl">
              <span>Look</span>
              <SegmentedControl
                ariaLabel="Plate look"
                options={["textured", "classic", "ink"]}
                value={params.look.look}
                onChange={(l) => applyPatch({ look: { look: l } })}
              />
            </div>
            <div className="segctl">
              <span>Size</span>
              <label className="minislider">
                <Slider
                  ariaLabel="Plate size"
                  min={128}
                  max={320}
                  step={1}
                  value={plateSize}
                  onChange={setPlateSize}
                  width={110}
                />
                {plateSize}px
              </label>
            </div>
            {params.plate.shape === "square" && params.plate.rotation % 90 === 0 && (
              <div className="segctl">
                <span>Radius</span>
                <label className="minislider">
                  <Slider
                    ariaLabel="Plate corner radius"
                    min={0}
                    max={32}
                    step={1}
                    value={plateRadius}
                    onChange={setPlateRadius}
                    width={110}
                  />
                  {plateRadius}px
                </label>
              </div>
            )}
            <div className="segctl">
              <span>Colours</span>
              <span className="pickers">
                <label>
                  Plate
                  <input
                    type="color"
                    value={params.look.plateColor}
                    onChange={(e) => applyPatch({ look: { plateColor: e.target.value } })}
                  />
                </label>
                <label>
                  Sand
                  <input
                    type="color"
                    value={params.look.color}
                    onChange={(e) => applyPatch({ look: { color: e.target.value } })}
                  />
                </label>
              </span>
            </div>
          </div>
          <div className="status">{status}</div>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickFile(f);
            }}
          />
        </section>

        <h2 id="use" className="sec">
          <span className="eyebrow">01 · Quick start</span>Install, point it at a voice, ship
        </h2>
        <p className="sec-sub">
          Three steps. The code in step 3 is live — it mirrors whatever you set on the stage and in{" "}
          <a href="#tune">Tune</a>, so configure the plate here and paste the result.
        </p>
        <div className="quick">
          <div className="step">
            <span className="stepnum">1</span>
            <div>
              <div className="step-head">
                <h3>Install</h3>
                <Button
                  onClick={() => void copyText("npm i @chladni/react @chladni/core", "install2")}
                >
                  {copied === "install2" ? "Copied" : "Copy"}
                </Button>
              </div>
              <p>
                <code>@chladni/react</code> is the component; it re-exports everything from{" "}
                <code>@chladni/core</code>, the framework-free engine.
              </p>
              <pre>
                <code>{`npm i @chladni/react @chladni/core
# engine only, no React:
npm i @chladni/core`}</code>
              </pre>
            </div>
          </div>
          <div className="step">
            <span className="stepnum">2</span>
            <div>
              <h3>Give it a voice</h3>
              <p>
                Anything that is — or quacks like — a Web Audio <code>AnalyserNode</code>. The
                helpers set it up with the right FFT size.
              </p>
              <pre>
                <code>{`import {
  createMicAnalyser, createElementAnalyser, SimulatedVoice,
} from "@chladni/react";

const mic = await createMicAnalyser();      // the caller
const tts = createElementAnalyser(audioEl); // the agent's playback
const demo = new SimulatedVoice();          // no audio at all

// or your own AnalyserNode on any stream:
node.fftSize = 8192;
node.smoothingTimeConstant = 0.5;`}</code>
              </pre>
            </div>
          </div>
          <div className="step wide">
            <span className="stepnum">3</span>
            <div>
              <div className="step-head">
                <h3>
                  Render it
                  <span className="live">
                    <i />
                    live — follows the stage and Tune
                  </span>
                </h3>
                <Button onClick={() => void copyText(snippet, "snippet")}>
                  {copied === "snippet" ? "Copied" : "Copy code"}
                </Button>
              </div>
              <div className="snippet-tabs">
                <SegmentedControl
                  ariaLabel="Snippet language"
                  size="small"
                  options={[
                    { value: "react", label: "React" },
                    { value: "vanilla", label: "Vanilla TS" },
                  ]}
                  value={snippetLang}
                  onChange={setSnippetLang}
                />
              </div>
              <pre>
                <code>{snippet}</code>
              </pre>
            </div>
          </div>
        </div>

        <h2 id="states" className="sec">
          <span className="eyebrow">02 · For voice agents</span>One plate, four states
        </h2>
        <p className="sec-sub">
          Map your call state onto the plate. <b>Talking</b> is the plate proper — pass it the
          agent's analyser. The three quiet states are a small particle layer with no audio behind
          them (<code>SandField</code> in this site's source), shown here on the same shape and
          palette as the stage.
        </p>
        <div className="how" style={plateRadiusStyle}>
          {PLATE_STATES.map((s) => (
            <figure key={s.id} className={`state-${s.id}`}>
              {"custom" in s ? (
                <SandField
                  sand={params.look.color}
                  plate={params.look.plateColor}
                  shape={params.plate.shape}
                  mode={s.custom}
                />
              ) : (
                <ChladniPlate
                  params={withStageLook(s.p as DeepPartial<ChladniParams>)}
                  analyser={s.source}
                />
              )}
              <figcaption>
                <b>{s.name}</b>
                {s.cap}
                <span className="state-tag">{s.code}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <h2 id="presets" className="sec">
          <span className="eyebrow">03 · Presets</span>Start from a scene
        </h2>
        <p className="sec-sub">
          Click one to load it on the stage — the quick-start snippet updates to match. Each is a
          plain <code>params</code> object you can also import from <code>PRESETS</code>.
        </p>
        <div className="presets">
          {Object.entries(PRESETS).map(([key, p]) => (
            <button key={key} className="preset-card" onClick={() => applyPreset(key)}>
              <ChladniPlate
                params={
                  {
                    ...p.params,
                    look: { ...THEME_LOOK[theme].look, ...p.params.look },
                  } as DeepPartial<ChladniParams>
                }
                analyser={simVoice}
              />
              <b>{p.label}</b>
              <span>{p.description}</span>
            </button>
          ))}
        </div>

        <div className="sec-head">
          <h2 id="tune" className="sec">
            <span className="eyebrow">04 · Configure</span>Tune every parameter
          </h2>
          <div className="sec-side">
            <p className="sec-sub">
              The whole <code>ChladniParams</code> surface, grouped as in the API. Every change hits
              the stage and the quick-start snippet live; hover ⓘ for what a control does.
            </p>
            <div className="tune-actions">
              <Button
                onClick={() => {
                  loadParams({});
                  plateRef.current?.resetSand();
                }}
              >
                Reset
              </Button>
              <Button onClick={() => void copyText(JSON.stringify(tunedPatch, null, 2), "json")}>
                {copied === "json" ? "Copied" : "Copy JSON"}
              </Button>
            </div>
          </div>
        </div>
        <div className="tune-layout">
          <div className="tune-groups">
            {groups.map(([g, entries]) => (
              <div className="gcard" key={g}>
                <div className="gside">
                  <b>{GROUP_LABEL[g] ?? g}</b>
                  <p>{GROUP_DESC[g]}</p>
                </div>
                <div className="gbody">
                  {entries.map(([path, entry]) => (
                    <Control
                      key={path}
                      entry={entry}
                      value={getPath(params, path)}
                      onChange={(v) => {
                        const p: DeepPartial<ChladniParams> = {};
                        setPath(p, path, v);
                        applyPatch(p);
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <aside className="side">
            <div className="pcard">
              <div className="pcard-head">
                <b>Preview</b>
                <Button
                  variant={previewAnalyser ? "primary" : "default"}
                  onClick={() => void togglePreview()}
                >
                  {previewAnalyser ? "Stop" : "▶ Play"}
                </Button>
              </div>
              <p className="pstatus">Mirrors the stage: palette, shape, state and voice.</p>
              <div className="pstage">
                <IdleOverlay idle={previewAnalyser === null} params={params} count={3000}>
                  <ChladniPlate params={patch} analyser={previewAnalyser} />
                </IdleOverlay>
              </div>
            </div>
            <div className="pcard">
              <b>
                Live levels{" "}
                <span className="tip" data-tip="Loudest partial in each band, right now.">
                  ⓘ
                </span>
              </b>
              {LEVEL_BANDS.map((b) => {
                const v = levels[b.key] ?? 0;
                return (
                  <div className="lvl" key={b.key}>
                    <span className="lvl-n">
                      {b.label}{" "}
                      <span className="tip" data-tip={b.tip}>
                        ⓘ
                      </span>
                    </span>
                    <span className="lvl-bar">
                      <i style={{ width: `${Math.min(100, v * 100)}%` }} />
                    </span>
                    <span className="lvl-v">{v.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>

        <h2 id="props" className="sec">
          <span className="eyebrow">05 · Reference</span>Props
        </h2>
        <p className="sec-sub">
          Everything <code>&lt;ChladniPlate /&gt;</code> accepts, then every key of{" "}
          <code>params</code>. The parameter table is generated from the engine's schema and
          defaults, so it is always current. The same tables, plus the imperative handle and audio
          helpers, are in each package's README.
        </p>
        <h3 className="ref-h">
          <code>&lt;ChladniPlate /&gt;</code>
        </h3>
        <table className="props">
          <thead>
            <tr>
              <th>Prop</th>
              <th>Type</th>
              <th>Default</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            {COMPONENT_PROPS.map((p) => (
              <tr key={p.name}>
                <td>
                  <code>{p.name}</code>
                </td>
                <td>
                  <code>{p.type}</code>
                </td>
                <td>
                  <code>{p.def}</code>
                </td>
                <td>{p.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="ref-h">
          <code>params</code> — <code>DeepPartial&lt;ChladniParams&gt;</code>
        </h3>
        <p className="sec-sub">
          <code>params</code> is one nested object with six groups —{" "}
          {GROUP_ORDER.map((g, i) => (
            <span key={g}>
              {i > 0 && " · "}
              <code>{g}</code>
            </span>
          ))}
          . A key in the table like <code>plate.shape</code> means{" "}
          <code>{"{ plate: { shape } }"}</code>. Only include what you want to change; everything
          else comes from <code>DEFAULT_PARAMS</code>. In React the prop is authoritative — if you
          later drop a key from the object, that value goes back to its default.
        </p>
        <pre className="ref-example">
          <code>{`// React — the prop
<ChladniPlate
  analyser={mic.analyser}
  params={{
    plate: { shape: "square", size: 40 },   // plate.shape, plate.size
    look: { look: "ink", color: "#f3ead8" }, // look.look, look.color
  }}
/>

// Vanilla — at creation, or any time later
const plate = createChladniPlate(canvas, { params: { plate: { shape: "square" } } });
plate.setParams({ look: { look: "ink" } }); // merged over the current state

// Presets are just params objects
<ChladniPlate params={PRESETS["voice"].params} />`}</code>
        </pre>
        <table className="props">
          <thead>
            <tr>
              <th>Key</th>
              <th>Type / values</th>
              <th>Default</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(PARAM_SCHEMA).map(([key, e]) => {
              const [g, k] = key.split(".") as [keyof ChladniParams, string];
              const def = (DEFAULT_PARAMS[g] as Record<string, unknown>)[k];
              return (
                <tr key={key}>
                  <td>
                    <code>{key}</code>
                    <span className="ref-label">{e.label}</span>
                  </td>
                  <td>
                    <code>{paramType(e)}</code>
                  </td>
                  <td>
                    <code>{String(def)}</code>
                  </td>
                  <td>{e.help}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h2 id="faq" className="sec">
          <span className="eyebrow">06 · FAQ</span>Questions
        </h2>
        <details className="faq" open>
          <summary>How is the plate built?</summary>
          <p className="sec-sub">Four views, each one live with the same simulated voice.</p>
          <div className="how" style={plateRadiusStyle}>
            {demos.map((d, i) => (
              <figure key={i}>
                <span className="stepnum">{i + 1}</span>
                <ChladniPlate
                  params={withStageLook(d.p as DeepPartial<ChladniParams>)}
                  analyser={simVoice}
                />
                <figcaption>
                  <b>{d.title}</b>
                  {d.cap}
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="pipeline">
            <b>Audio → FFT → partials → modes → resonance → sand.</b> An analyser node measures the
            spectrum; the strongest peaks become <b>partials</b>. Each partial shakes the plate's
            vibration modes through a Lorentzian resonance — on a resonance the figure is clean,
            between two it blends, far from all it trembles. The driven displacement field is drawn
            as a standing wave; thousands of grains jitter in proportion to local vibration and
            drift down its gradient until only the nodal lines hold sand.
          </p>
        </details>
        {FAQ.map((f) => (
          <details key={f.q} className="faq">
            <summary>{f.q}</summary>
            <p className="pipeline">{f.a}</p>
          </details>
        ))}
        <p className="pipeline">
          Research notes (Figura parameter catalog, behaviour rules, plate physics):{" "}
          <a href="https://github.com/<user>/chladni" style={{ color: "var(--accent)" }}>
            docs/research
          </a>{" "}
          in the repository.
        </p>
      </main>
      <footer>
        <span>chladni · MIT</span>
        <span>
          <a href="#use">Quick start</a> · <a href="#props">Props</a> ·{" "}
          <a href="https://github.com/<user>/chladni">GitHub</a>
        </span>
      </footer>
    </>
  );
}

function Control({
  entry,
  value,
  onChange,
}: {
  entry: ParamSchemaEntry;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (entry.kind === "number") {
    const v = typeof value === "number" ? value : (entry.min ?? 0);
    const digits = entry.step !== undefined && entry.step < 1 ? 2 : 0;
    return (
      <label className="ctl" title={entry.help}>
        <span className="row">
          <span>
            {entry.label}{" "}
            <span className="tip" data-tip={entry.help}>
              ⓘ
            </span>
          </span>
          <span className="val">
            {v.toFixed(digits)}
            {entry.unit ? ` ${entry.unit}` : ""}
          </span>
        </span>
        <Slider
          ariaLabel={entry.label}
          min={entry.min ?? 0}
          max={entry.max ?? 1}
          step={entry.step ?? 1}
          value={v}
          onChange={onChange}
        />
      </label>
    );
  }
  if (entry.kind === "enum") {
    return (
      <label className="ctl" title={entry.help}>
        <span className="row">
          <span>
            {entry.label}{" "}
            <span className="tip" data-tip={entry.help}>
              ⓘ
            </span>
          </span>
        </span>
        <SegmentedControl
          ariaLabel={entry.label}
          options={entry.options!}
          value={String(value)}
          onChange={onChange}
        />
      </label>
    );
  }
  if (entry.kind === "boolean") {
    return (
      <label className="ctl bool" title={entry.help}>
        <Switch checked={Boolean(value)} onChange={onChange} ariaLabel={entry.label} />
        <span>
          {entry.label}{" "}
          <span className="tip" data-tip={entry.help}>
            ⓘ
          </span>
        </span>
      </label>
    );
  }
  if (entry.kind === "color") {
    return (
      <label className="ctl" title={entry.help}>
        {entry.label}{" "}
        <span className="tip" data-tip={entry.help}>
          ⓘ
        </span>{" "}
        <input
          type="color"
          value={typeof value === "string" ? value : "#f3ead8"}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  }
  return null;
}
