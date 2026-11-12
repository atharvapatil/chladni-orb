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
import { renderSampleBuffer } from "./sample";
import { renderVoiceBuffer } from "./voice";
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
  const [parts, setParts] = useState<{ freq: number; amp: number }[]>([]);
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
      setParts(p.partials.slice(0, 8).map((x) => ({ freq: x.freq, amp: x.amp })));
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
          <a href="#tune">Tune</a>
          <a href="#inside">How it works</a>
          <a href="#presets">Presets</a>
          <a href="#use">Use it</a>
        </nav>
        <div className="nav-right">
          <a href="https://github.com/<user>/chladni">GitHub</a>
          <button
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            onClick={toggleTheme}
          >
            {theme === "dark" ? "☀ Light" : "☾ Dark"}
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <p className="oss">
            <i />
            Open source · MIT
          </p>
          <h1>chladni</h1>
          <p className="tagline">
            A voice-reactive Chladni plate for the web — sound in, sand figures out. Play any voice
            through it, tune the look, take the code.
          </p>
          <div className="hero-actions">
            <a className="btn primary" href="https://github.com/<user>/chladni">
              Get the code →
            </a>
            <a className="btn" href="#inside">
              How it works
            </a>
          </div>
          <p className="credit">Open source · MIT licensed</p>
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
            <ChladniPlate
              params={patch}
              analyser={source}
              frozen={frozen}
              onReady={(p) => {
                plateRef.current = p;
              }}
            />
            <p className="stage-cap">
              {params.look.look} · {params.plate.shape}
              {params.plate.aspect !== 1 ? ` ×${params.plate.aspect}` : ""}
            </p>
          </div>

          <div className="stage-row">
            <div className="segctl">
              <span>Voice</span>
              <span className="seg">
                <button className={sourceName === "none" ? "active" : ""} onClick={stopSource}>
                  Off
                </button>
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
                <button
                  className={sourceName === "simulated voice" ? "active" : ""}
                  onClick={pickSim}
                >
                  Simulated voice
                </button>
              </span>
            </div>
            <span className="row-actions">
              <button onClick={() => plateRef.current?.resetSand()}>Reset sand</button>
              <button className={frozen ? "primary" : ""} onClick={() => setFrozen((f) => !f)}>
                {frozen ? "Unfreeze" : "Freeze"}
              </button>
            </span>
          </div>

          <div className="stage-grid">
            <div className="segctl">
              <span>Shape</span>
              <span className="seg">
                {(["circle", "square", "diamond"] as const).map((s) => (
                  <button
                    key={s}
                    className={params.plate.shape === s ? "active" : ""}
                    onClick={() =>
                      applyPatch({
                        plate: {
                          shape: s,
                          rotation: s === "circle" ? params.plate.rotation : 0,
                          ...(s === "diamond" ? { aspect: 1 } : {}),
                        },
                      })
                    }
                  >
                    {s}
                  </button>
                ))}
              </span>
            </div>
            <div className="segctl">
              <span>Look</span>
              <span className="seg">
                {(["textured", "classic", "ink"] as const).map((l) => (
                  <button
                    key={l}
                    className={params.look.look === l ? "active" : ""}
                    onClick={() => applyPatch({ look: { look: l } })}
                  >
                    {l}
                  </button>
                ))}
              </span>
            </div>
            <div className="segctl">
              <span>Size</span>
              <label className="minislider">
                <input
                  type="range"
                  min={128}
                  max={320}
                  step={1}
                  value={plateSize}
                  onChange={(e) => setPlateSize(Number(e.target.value))}
                />
                {plateSize}px
              </label>
            </div>
            {params.plate.shape === "square" && params.plate.rotation % 90 === 0 && (
              <div className="segctl">
                <span>Radius</span>
                <label className="minislider">
                  <input
                    type="range"
                    min={0}
                    max={32}
                    step={1}
                    value={plateRadius}
                    onChange={(e) => setPlateRadius(Number(e.target.value))}
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

        <div className="sec-head">
          <h2 id="tune" className="sec">
            <span className="eyebrow">01 · Controls</span>Tune
          </h2>
          <div className="sec-side">
            <p className="sec-sub">
              Every slider changes the plate live. Hover the ⓘ for what each does, and copy the
              settings to share a look.
            </p>
            <div className="tune-actions">
              <button
                onClick={() => {
                  setParams(DEFAULT_PARAMS);
                  setPatch({});
                  plateRef.current?.resetSand();
                }}
              >
                Reset
              </button>
              <button onClick={() => void copySettings()}>
                {copied ? "Copied" : "Copy settings"}
              </button>
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
              <b>Status</b>
              <p className="pstatus">{status}</p>
            </div>
            <div className="pcard">
              <b>Live partials</b>
              {parts.length === 0 && <p className="pstatus">listening…</p>}
              {parts.map((x, i) => (
                <div className="lvl" key={i}>
                  <span className="lvl-f">{x.freq.toFixed(0)} Hz</span>
                  <span className="lvl-bar">
                    <i style={{ width: `${Math.min(100, x.amp * 100)}%` }} />
                  </span>
                  <span className="lvl-v">{x.amp.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <h2 id="inside" className="sec">
          <span className="eyebrow">02 · Inside</span>How the plate is built
        </h2>
        <p className="sec-sub">Four views, each one live with the same simulated voice.</p>
        <div className="how">
          {demos.map((d, i) => (
            <figure key={i}>
              <span className="stepnum">{i + 1}</span>
              <ChladniPlate
                params={
                  {
                    ...d.p,
                    look: { ...THEME_LOOK[theme].look, ...(d.p as { look?: object }).look },
                  } as DeepPartial<ChladniParams>
                }
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
          between two it blends, far from all it trembles. The driven displacement field is drawn as
          a standing wave; thousands of grains jitter in proportion to local vibration and drift
          down its gradient until only the nodal lines hold sand.
        </p>

        <h2 id="presets" className="sec">
          <span className="eyebrow">03 · Presets</span>Presets
        </h2>
        <p className="sec-sub">Starter scenes — pick one, then make it yours in Tune.</p>
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

        <h2 id="use" className="sec">
          <span className="eyebrow">04 · Use it</span>Use it in your project
        </h2>
        <p className="sec-sub">
          A React component over a plain-TypeScript engine — install and give it any AnalyserNode.
        </p>
        <div className="useit">
          <div className="step">
            <span className="stepnum">1</span>
            <div>
              <h3>Install</h3>
              <pre>
                <code>
                  pnpm add @chladni/react{"\n"}# or the engine alone: pnpm add @chladni/core
                </code>
              </pre>
            </div>
          </div>
          <div className="step">
            <span className="stepnum">2</span>
            <div>
              <h3>React</h3>
              <pre>
                <code>{`import { ChladniPlate, SimulatedVoice } from "@chladni/react";

<ChladniPlate
  params={{ plate: { shape: "circle" } }}
  analyser={new SimulatedVoice()}
/>`}</code>
              </pre>
            </div>
          </div>
          <div className="step">
            <span className="stepnum">3</span>
            <div>
              <h3>Vanilla</h3>
              <pre>
                <code>{`import { createChladniPlate, SimulatedVoice } from "@chladni/core";

const plate = createChladniPlate(document.querySelector("canvas"));
plate.setAnalyser(new SimulatedVoice());`}</code>
              </pre>
            </div>
          </div>
        </div>
        <p className="pipeline">
          Research notes (Figura parameter catalog, behaviour rules, plate physics):{" "}
          <a href="https://github.com/<user>/chladni" style={{ color: "var(--accent)" }}>
            docs/research
          </a>{" "}
          in the repository.
        </p>
      </main>
      <footer>Built with @chladni/core · Open source · MIT</footer>
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
          <span>
            {entry.label}{" "}
            <span className="tip" data-tip={entry.help}>
              ⓘ
            </span>
          </span>
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
        {entry.label}{" "}
        <span className="tip" data-tip={entry.help}>
          ⓘ
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
