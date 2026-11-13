import {
  ChladniPlate,
  DEFAULT_PARAMS,
  PRESETS,
  mergeParams,
  type AgentState,
  type ChladniParams,
  type ChladniPlateHandle,
  type DeepPartial,
} from "@chladni/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/Button";
import { SegmentedControl } from "../components/SegmentedControl";
import { Slider } from "../components/Slider";
import { Switch } from "../components/Switch";
import { SITE_PARAMS, THEME_LOOK, simVoice, useTheme } from "../site";
import { ALL_ENTRIES, DOC_GROUPS, findEntry, type Control, type DocEntry } from "./content";
import { GUIDES, findGuide } from "./guides";
import "./docs.css";

const DEFAULT_ID = DOC_GROUPS[0]!.entries[0]!.id;
const BURST_MS = 2600;
const PROP_IDS = new Set(ALL_ENTRIES.filter((e) => e.group === "component").map((e) => e.id));

type Values = Record<string, unknown>;
const STATES: { value: AgentState; label: string }[] = [
  { value: "idle", label: "Idle" },
  { value: "connecting", label: "Connecting" },
  { value: "listening", label: "Listening" },
  { value: "talking", label: "Talking" },
];

function useSelected(hash: string) {
  const id = decodeURIComponent(hash.replace(/^#\/docs\/?/, ""));
  const guide = id.startsWith("guide/") ? findGuide(id.slice(6)) : null;
  const found = findEntry(id) ?? findEntry(DEFAULT_ID)!;
  return { ...found, guide };
}

/** everything the user has changed, split into params and component props */
function build(values: Values) {
  const patch: Record<string, Record<string, unknown>> = {};
  const touched: DocEntry[] = [];
  for (const e of ALL_ENTRIES) {
    if (!(e.id in values) || PROP_IDS.has(e.id)) continue;
    const v = values[e.id];
    if (v === e.initial) continue;
    (patch[e.group] ??= {})[e.name] = v;
    touched.push(e);
  }
  const prop = (id: string) => (id in values ? values[id] : null);
  return {
    patch: patch as DeepPartial<ChladniParams>,
    touched,
    analyser: prop("prop.analyser") === "null" ? null : "voice",
    frozen: prop("prop.frozen") === true,
    pixelRatio: prop("prop.pixelRatio") as number | null,
    fieldResolution: prop("prop.fieldResolution") as number | null,
    particleTexSize: prop("prop.particleTexSize") as number | null,
    preset: (prop("prop.params") as string | null) ?? "defaults",
    state: ((prop("prop.state") as AgentState | null) ?? "talking") as AgentState,
  };
}

function toJs(v: unknown, indent: number, depth = 0): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  const entries = Object.entries(v as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  const pad = " ".repeat(indent * (depth + 1));
  const end = " ".repeat(indent * depth);
  return `{\n${entries.map(([k, x]) => `${pad}${k}: ${toJs(x, indent, depth + 1)},`).join("\n")}\n${end}}`;
}

function codeFor(b: ReturnType<typeof build>, lang: "react" | "vanilla"): string {
  const hasParams = Object.keys(b.patch).length > 0;
  const p = toJs(b.patch, 2);
  const source =
    b.analyser === null
      ? ["// nothing playing yet", "const analyser = null;"]
      : [
          "const mic = await createMicAnalyser(); // or SimulatedVoice for a demo",
          "const analyser = mic.analyser;",
        ];
  const propLines = [
    "analyser={analyser}",
    ...(b.state !== "talking" ? [`state="${b.state}"`] : []),
    ...(b.frozen ? ["frozen={true}"] : []),
    ...(b.pixelRatio !== null ? [`pixelRatio={${b.pixelRatio}}`] : []),
    ...(b.fieldResolution !== null ? [`fieldResolution={${b.fieldResolution}}`] : []),
    ...(b.particleTexSize !== null ? [`particleTexSize={${b.particleTexSize}}`] : []),
    ...(hasParams ? [`params={${p.replace(/\n/g, "\n  ")}}`] : []),
  ];
  if (lang === "react") {
    return `import { ChladniPlate, createMicAnalyser } from "@chladni/react";

${source.join("\n")}

<ChladniPlate
  ${propLines.join("\n  ")}
/>`;
  }
  const opts = [
    ...(b.pixelRatio !== null ? [`pixelRatio: ${b.pixelRatio}`] : []),
    ...(b.fieldResolution !== null ? [`fieldResolution: ${b.fieldResolution}`] : []),
    ...(b.particleTexSize !== null ? [`particleTexSize: ${b.particleTexSize}`] : []),
    ...(hasParams ? [`params: ${p.replace(/\n/g, "\n  ")}`] : []),
  ];
  return `import { createChladniPlate, createMicAnalyser } from "@chladni/core";

${source.join("\n")}

const plate = createChladniPlate(canvas${opts.length ? `, {\n  ${opts.join(",\n  ")},\n}` : ""});
plate.setAnalyser(analyser);${b.state !== "talking" ? `\nplate.setState("${b.state}");` : ""}${b.frozen ? "\nplate.freeze(true);" : ""}`;
}

function fmt(v: unknown, c: Control): string {
  if (c.kind === "enum") return String(c.options.find((o) => o.value === v)?.label ?? v);
  if (c.kind === "number") return `${v}${c.unit ? ` ${c.unit}` : ""}`;
  return String(v);
}

function ValueControl({
  control,
  value,
  onChange,
}: {
  control: Control;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (control.kind === "enum") {
    return (
      <SegmentedControl
        ariaLabel="Value"
        options={control.options.map((o) => ({ value: String(o.value), label: o.label }))}
        value={String(value)}
        onChange={(s) => onChange(control.options.find((o) => String(o.value) === s)!.value)}
      />
    );
  }
  if (control.kind === "number") {
    return (
      <label className="ctl-number">
        <Slider
          ariaLabel="Value"
          min={control.min}
          max={control.max}
          step={control.step}
          value={value as number}
          onChange={onChange}
          width={240}
        />
        <span className="ctl-readout">{fmt(value, control)}</span>
      </label>
    );
  }
  if (control.kind === "boolean") {
    return (
      <label className="ctl-bool">
        <Switch ariaLabel="Value" checked={value as boolean} onChange={onChange} />
        <span>{value ? "on" : "off"}</span>
      </label>
    );
  }
  if (control.kind === "color") {
    return (
      <label className="ctl-color">
        <input
          type="color"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Value"
        />
        <code>{value as string}</code>
      </label>
    );
  }
  return null;
}

/** the one plate everything is applied to */
function Orb({
  values,
  theme,
  restartKey,
  burstUntil,
}: {
  values: Values;
  theme: "dark" | "light";
  restartKey: number;
  burstUntil: number;
}) {
  const b = useMemo(() => build(values), [values]);
  const params = useMemo(
    () =>
      [SITE_PARAMS, THEME_LOOK[theme], b.patch].reduce<ChladniParams>(
        (acc, p) => mergeParams(acc, p),
        DEFAULT_PARAMS,
      ),
    [b, theme],
  );
  const handle = useRef<ChladniPlateHandle | null>(null);

  // a change restarts the plate from idle: fresh, evenly spread sand that the
  // new figure then forms out of. Debounced so a slider drag resets once.
  useEffect(() => {
    if (restartKey === 0) return;
    const id = setTimeout(() => handle.current?.resetSand(), 180);
    return () => clearTimeout(id);
  }, [restartKey]);

  // during a burst the plate plays sound regardless, so there is a figure to
  // hold, freeze or relax afterwards
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (burstUntil <= Date.now()) return;
    const id = setTimeout(() => setNow(Date.now()), burstUntil - Date.now() + 20);
    return () => clearTimeout(id);
  }, [burstUntil]);
  const bursting = burstUntil > now;

  const analyser = bursting || b.analyser !== null ? simVoice : null;
  const frozen = !bursting && b.frozen;
  const mountKey = `${b.pixelRatio}-${b.fieldResolution}-${b.particleTexSize}`;

  return (
    <ChladniPlate
      key={mountKey}
      params={params}
      analyser={analyser}
      state={b.state}
      frozen={frozen}
      fieldResolution={b.fieldResolution ?? 128}
      particleTexSize={b.particleTexSize ?? 128}
      {...(b.pixelRatio !== null ? { pixelRatio: b.pixelRatio } : {})}
      onReady={(p) => {
        handle.current = p;
      }}
    />
  );
}

export function DocsPage({ hash }: { hash: string }) {
  const [theme, toggleTheme] = useTheme();
  const { group, entry, guide } = useSelected(hash);
  const [values, setValues] = useState<Values>({});
  const [restartKey, setRestartKey] = useState(0);
  const [burstUntil, setBurstUntil] = useState(0);
  const [lang, setLang] = useState<"react" | "vanilla">("react");
  const [copied, setCopied] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const value = entry.id in values ? values[entry.id] : entry.initial;
  const built = useMemo(() => build(values), [values]);
  const code = codeFor(built, lang);

  const setValue = (v: unknown) => {
    setValues((s) => {
      const next = { ...s, [entry.id]: v };
      // the lab and ink groups only show when their model / look is active
      if (entry.group === "lab") next["plate.model"] = "lab";
      if (entry.group === "ink") next["look.look"] = "ink";
      // picking a preset loads its values into the individual keys
      if (entry.id === "prop.params") {
        for (const e of ALL_ENTRIES) if (!PROP_IDS.has(e.id)) delete next[e.id];
        const preset = v === "defaults" ? {} : (PRESETS[v as string]?.params ?? {});
        for (const [g, keys] of Object.entries(preset))
          for (const [k, val] of Object.entries(keys as Record<string, unknown>))
            next[`${g}.${k}`] = val;
      }
      return next;
    });
    setRestartKey((k) => k + 1);
    // things that only show once a figure exists get a burst of sound first
    if (entry.needsFigure) setBurstUntil(Date.now() + BURST_MS);
  };

  // the selector above the plate is just the state prop
  const setState = (st: AgentState) => setValues((s) => ({ ...s, "prop.state": st }));

  const clear = (id: string) => {
    setValues((s) => {
      const next = { ...s };
      delete next[id];
      return next;
    });
    setRestartKey((k) => k + 1);
  };
  const reset = () => {
    setValues({});
    setRestartKey((k) => k + 1);
  };

  useEffect(() => {
    document.title = `${guide ? guide.title : entry.name} · chladni docs`;
    setNavOpen(false);
    window.scrollTo({ top: 0 });
  }, [entry, guide]);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const pages = [
    ...GUIDES.map((g) => ({ id: `guide/${g.id}`, name: g.title })),
    ...ALL_ENTRIES.map((e) => ({ id: e.id, name: e.name })),
  ];
  const idx = pages.findIndex((p) => p.id === (guide ? `guide/${guide.id}` : entry.id));
  const prev = pages[idx - 1];
  const next = pages[idx + 1];
  const changed = [
    ...ALL_ENTRIES.filter((e) => PROP_IDS.has(e.id) && e.id in values && e.id !== "prop.params"),
    ...built.touched,
  ];

  return (
    <div className="docs">
      <header className="docs-top">
        <a className="brand" href="#top">
          chladni
        </a>
        <span className="docs-crumb">docs</span>
        <button className="docs-menu" onClick={() => setNavOpen((o) => !o)} aria-label="Menu">
          ☰
        </button>
        <div className="nav-right">
          <a href="#use">Quick start</a>
          <a href="https://github.com/atharvapatil/chladni-orb">GitHub</a>
          <Button
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            onClick={toggleTheme}
          >
            {theme === "dark" ? "☀ Light" : "☾ Dark"}
          </Button>
        </div>
      </header>

      <div className="docs-body">
        <nav className={`docs-nav${navOpen ? " open" : ""}`}>
          <div className="nav-group is-open">
            <span className="nav-title">Getting started</span>
            <div className="nav-items">
              {GUIDES.map((g) => (
                <a
                  key={g.id}
                  href={`#/docs/guide/${g.id}`}
                  className={guide?.id === g.id ? "is-active" : ""}
                >
                  {g.title}
                </a>
              ))}
            </div>
          </div>
          {DOC_GROUPS.map((g) => (
            <div key={g.id} className={`nav-group${!guide && g.id === group.id ? " is-open" : ""}`}>
              <a className="nav-title" href={`#/docs/${g.entries[0]!.id}`}>
                {g.label}
              </a>
              <div className="nav-items">
                {g.entries.map((e) => (
                  <a
                    key={e.id}
                    href={`#/docs/${e.id}`}
                    className={`${!guide && e.id === entry.id ? "is-active" : ""}${
                      e.id in values && values[e.id] !== e.initial ? " is-changed" : ""
                    }`}
                  >
                    {e.name}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <main className="docs-entry">
          {guide ? (
            <div className="entry-body guide">
              <h1>{guide.title}</h1>
              <p className="detail-summary">{guide.summary}</p>
              {guide.body}
            </div>
          ) : (
            <div className="entry-body">
              <h1>{entry.name}</h1>
              <p className="detail-summary">{entry.summary}</p>
              {entry.effect.map((para, i) => (
                <p key={i} className="detail-effect">
                  {para}
                </p>
              ))}

              {entry.control.kind !== "none" && (
                <section className="try-section">
                  <h3>Try it</h3>
                  <div className="detail-control">
                    <ValueControl control={entry.control} value={value} onChange={setValue} />
                  </div>
                </section>
              )}

              <h3>Accepts</h3>
              <p>
                <code>{entry.accepts}</code>
              </p>

              <h3>Default</h3>
              <p>
                <code>{entry.def}</code>
              </p>
              {entry.tip && (
                <div className="detail-tip">
                  <span>Note</span>
                  <p>{entry.tip}</p>
                </div>
              )}

              {entry.example && (
                <>
                  <h3>In code</h3>
                  <pre>
                    <code>{entry.example}</code>
                  </pre>
                </>
              )}
            </div>
          )}

          <div className="detail-nav">
            {prev ? <a href={`#/docs/${prev.id}`}>← {prev.name}</a> : <span />}
            {next && <a href={`#/docs/${next.id}`}>{next.name} →</a>}
          </div>
        </main>

        <aside className="docs-orb">
          <div className="orb-state">
            <SegmentedControl
              ariaLabel="Agent state"
              options={STATES}
              value={built.state}
              onChange={setState}
            />
          </div>
          <div className="orb-plate">
            <Orb values={values} theme={theme} restartKey={restartKey} burstUntil={burstUntil} />
          </div>

          <div className="orb-changes">
            <div className="orb-changes-head">
              <span>Your plate</span>
              {changed.length > 0 && <Button onClick={reset}>Reset all</Button>}
            </div>
            {changed.length === 0 ? (
              <p className="orb-empty">
                Nothing changed yet. Play with a control on the left and it shows up here and in the
                code below.
              </p>
            ) : (
              <ul>
                {changed.map((e) => (
                  <li key={e.id}>
                    <a href={`#/docs/${e.id}`}>{e.id.replace(/^prop\./, "")}</a>
                    <code>{fmt(values[e.id], e.control)}</code>
                    <button onClick={() => clear(e.id)} aria-label={`Remove ${e.name}`}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="detail-code">
            <div className="detail-code-head">
              <SegmentedControl
                ariaLabel="Code language"
                size="small"
                options={[
                  { value: "react", label: "React" },
                  { value: "vanilla", label: "Vanilla TS" },
                ]}
                value={lang}
                onChange={setLang}
              />
              <Button onClick={() => void copy()}>{copied ? "Copied" : "Copy"}</Button>
            </div>
            <pre>
              <code>{code}</code>
            </pre>
          </div>
        </aside>
      </div>
    </div>
  );
}
