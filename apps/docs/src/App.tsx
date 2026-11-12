import {
  ChladniPlate,
  DEFAULT_PARAMS,
  PARAM_SCHEMA,
  PRESETS,
  SimulatedVoice,
  createElementAnalyser,
  createMicAnalyser,
  mergeParams,
  type AnalyserHandle,
  type ChladniParams,
  type ChladniPlateHandle,
  type DeepPartial,
  type ParamSchemaEntry,
  type SpectrumSource,
} from "@chladni/react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import "./styles.css";

const GROUP_ORDER = ["listening", "plate", "studio", "lab", "look", "ink"] as const;
const GROUP_LABEL: Record<string, string> = {
  listening: "Listening",
  plate: "Plate",
  studio: "Studio",
  lab: "Lab",
  look: "Look",
  ink: "Ink",
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

type Theme = "dark" | "light";

// the plate reads as a page element: light theme uses dark grains on a light felt
const THEME_LOOK: Record<Theme, DeepPartial<ChladniParams>> = {
  dark: { look: { color: "#f3ead8", plateAlpha: 1, plateColor: "#1a1a1c", amount: 1 } },
  light: { look: { color: "#2b2520", plateAlpha: 1, plateColor: "#e9e6df", amount: 1 } },
};

const THEME_BG: Record<Theme, string> = { dark: "#0c0d10", light: "#f7f6f2" };

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
  const [pageBg, setPageBg] = useState(() => localStorage.getItem("chladni-bg") ?? "");
  const [copied, setCopied] = useState(false);
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

  // custom page background overrides the theme's --bg until cleared
  useEffect(() => {
    const root = document.documentElement;
    if (pageBg) {
      root.style.setProperty("--bg", pageBg);
      localStorage.setItem("chladni-bg", pageBg);
    } else {
      root.style.removeProperty("--bg");
      localStorage.removeItem("chladni-bg");
    }
  }, [pageBg]);

  const applyPreset = useCallback((key: string) => {
    const p = PRESETS[key];
    if (!p) return;
    setPatch(p.params);
    setParams(mergeParams(DEFAULT_PARAMS, p.params));
  }, []);

  // status line follows partials each ~250 ms
  useEffect(() => {
    const id = setInterval(() => {
      const p = plateRef.current;
      if (!p) return;
      const n = p.partials.length;
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

  const pickSim = useCallback(() => {
    stopSource();
    setSource(simVoice);
    setSourceName("simulated voice");
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
    const el = new Audio(`${import.meta.env.BASE_URL}audio/sample.wav`);
    el.loop = true;
    audioElRef.current = el;
    const h: AnalyserHandle = createElementAnalyser(el);
    await el.play();
    setSource(h.analyser);
    setSourceName("sample");
    stopRef.current = () => {
      h.stop();
      void h.context.close();
      el.pause();
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

  const pickSine = useCallback(() => {
    stopSource();
    const ctx = new AudioContext();
    void ctx.resume();
    const osc = ctx.createOscillator();
    osc.frequency.value = 440;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0.5;
    const mute = ctx.createGain();
    mute.gain.value = 0;
    osc.connect(analyser);
    analyser.connect(mute);
    mute.connect(ctx.destination);
    osc.start();
    setSource(analyser);
    setSourceName("sine 440 Hz");
    stopRef.current = () => {
      osc.stop();
      void ctx.close();
    };
  }, [stopSource]);

  // ?source=sim|sine boots straight into a source (for screenshots)
  useEffect(() => {
    const src = new URLSearchParams(location.search).get("source");
    if (src === "sim") pickSim();
    else if (src === "sine") pickSine();
  }, [pickSim, pickSine]);

  const copySettings = useCallback(async () => {
    const json = JSON.stringify(diffParams(DEFAULT_PARAMS, params), null, 2);
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [params]);

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
      p: { look: { look: "ink" } },
      cap: "Standing-wave field drawn in ink — this is what the sand feels.",
    },
    { p: {}, cap: "The same field with sand: grains hop off antinodes and settle on the nodes." },
    {
      p: { plate: { exciterAmount: 0 } },
      cap: "Exciter at 0 — the whole plate is pushed evenly, so only ring modes answer.",
    },
    {
      p: { look: { multiTone: "morph" } },
      cap: "Morph — partials interfere, so the figure wanders instead of holding still.",
    },
  ] as const;

  return (
    <main>
      <button
        className="themetoggle"
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        onClick={toggleTheme}
      >
        {theme === "dark" ? "☀ Light" : "☾ Dark"}
      </button>
      <h1>chladni</h1>
      <p className="tagline">
        A voice-reactive Chladni plate for the web — sound in, sand figures out.
      </p>

      <section className="hero" style={{ "--plate-size": `${plateSize}px` } as CSSProperties}>
        <ChladniPlate
          params={patch}
          analyser={source}
          frozen={frozen}
          onReady={(p) => {
            plateRef.current = p;
          }}
        />
        <label className="sizebar">
          Size
          <input
            type="range"
            min={128}
            max={320}
            step={1}
            value={plateSize}
            onChange={(e) => setPlateSize(Number(e.target.value))}
          />
          {plateSize} px
        </label>
        <div className="customize">
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
          <label>
            Page
            <input
              type="color"
              value={pageBg || THEME_BG[theme]}
              onChange={(e) => setPageBg(e.target.value)}
            />
          </label>
          {pageBg && (
            <button onClick={() => setPageBg("")} title="Back to theme background">
              reset
            </button>
          )}
        </div>
        <div className="sourcebar">
          <button
            className={sourceName === "sample" ? "active" : ""}
            onClick={() => void pickSample()}
          >
            Sample
          </button>
          <button
            className={sourceName === "microphone" ? "active" : ""}
            onClick={() => void pickMic()}
          >
            Microphone
          </button>
          <button
            className={sourceName.startsWith("file") ? "active" : ""}
            onClick={() => fileRef.current?.click()}
          >
            Your file
          </button>
          <button className={sourceName === "simulated voice" ? "active" : ""} onClick={pickSim}>
            Simulated voice
          </button>
          <button className={sourceName === "sine 440 Hz" ? "active" : ""} onClick={pickSine}>
            Sine 440
          </button>
          <button onClick={() => plateRef.current?.resetSand()}>Reset sand</button>
          <button className={frozen ? "active" : ""} onClick={() => setFrozen((f) => !f)}>
            {frozen ? "Unfreeze" : "Freeze"}
          </button>
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
        </div>
        <div className="status">{status}</div>
      </section>

      <h2 id="presets">Presets</h2>
      <div className="presets">
        {Object.entries(PRESETS).map(([key, p]) => (
          <button key={key} className="preset-card" onClick={() => applyPreset(key)}>
            <b>{p.label}</b>
            <span>{p.description}</span>
          </button>
        ))}
      </div>

      <h2 id="tune">Tune</h2>
      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        <button
          onClick={() => {
            setParams(DEFAULT_PARAMS);
            setPatch({});
            plateRef.current?.resetSand();
          }}
        >
          Reset
        </button>
        <button onClick={() => void copySettings()}>{copied ? "Copied" : "Copy settings"}</button>
      </div>
      <div className="tune">
        {groups.map(([g, entries]) => (
          <fieldset key={g}>
            <legend>{GROUP_LABEL[g] ?? g}</legend>
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
          </fieldset>
        ))}
      </div>

      <h2 id="how">How it works</h2>
      <div className="how">
        {demos.map((d, i) => (
          <figure key={i}>
            <ChladniPlate
              params={
                {
                  ...d.p,
                  look: { ...THEME_LOOK[theme].look, ...(d.p as { look?: object }).look },
                } as DeepPartial<ChladniParams>
              }
              analyser={simVoice}
            />
            <figcaption>{d.cap}</figcaption>
          </figure>
        ))}
      </div>
      <p className="pipeline">
        <b>Audio → FFT → partials → modes → resonance → sand.</b> An analyser node measures the
        spectrum; the strongest peaks become <b>partials</b>. Each partial shakes the plate's
        vibration modes through a Lorentzian resonance — on a resonance the figure is clean, between
        two it blends, far from all it trembles. The driven displacement field is drawn as a
        standing wave; thousands of grains jitter in proportion to local vibration and drift down
        its gradient until only the nodal lines hold sand.
      </p>

      <h2 id="use">Use it</h2>
      <div className="useit">
        <h3>Install</h3>
        <pre>
          <code>pnpm add @chladni/react{"\n"}# or the engine alone: pnpm add @chladni/core</code>
        </pre>
        <h3>React</h3>
        <pre>
          <code>{`import { ChladniPlate, SimulatedVoice } from "@chladni/react";

<ChladniPlate
  params={{ plate: { shape: "circle" } }}
  analyser={new SimulatedVoice()}
/>`}</code>
        </pre>
        <h3>Vanilla</h3>
        <pre>
          <code>{`import { createChladniPlate, SimulatedVoice } from "@chladni/core";

const plate = createChladniPlate(document.querySelector("canvas"));
plate.setAnalyser(new SimulatedVoice());`}</code>
        </pre>
        <p className="pipeline">
          Research notes (Figura parameter catalog, behaviour rules, plate physics):{" "}
          <a href="https://github.com/" style={{ color: "var(--accent)" }}>
            docs/research
          </a>{" "}
          in the repository.
        </p>
      </div>
    </main>
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
            {entry.label} <span title={entry.help}>ⓘ</span>
          </span>
          <span className="val">
            {v.toFixed(digits)}
            {entry.unit ? ` ${entry.unit}` : ""}
          </span>
        </span>
        <input
          type="range"
          min={entry.min}
          max={entry.max}
          step={entry.step}
          value={v}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </label>
    );
  }
  if (entry.kind === "enum") {
    return (
      <label className="ctl" title={entry.help}>
        <span className="row">
          <span>{entry.label}</span>
        </span>
        <span className="seg">
          {entry.options!.map((o) => (
            <button key={o} className={value === o ? "active" : ""} onClick={() => onChange(o)}>
              {o}
            </button>
          ))}
        </span>
      </label>
    );
  }
  if (entry.kind === "boolean") {
    return (
      <label className="ctl" title={entry.help}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />{" "}
        {entry.label}
      </label>
    );
  }
  if (entry.kind === "color") {
    return (
      <label className="ctl" title={entry.help}>
        {entry.label}{" "}
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
