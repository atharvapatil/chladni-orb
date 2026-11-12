import {
  DEFAULT_PARAMS,
  PARAM_SCHEMA,
  SimulatedVoice,
  createChladniPlate,
  createMicAnalyser,
  type ChladniParams,
  type ChladniPlate,
  type DeepPartial,
} from "@chladni/core";
import { useEffect, useRef, useState } from "react";

const GROUPS: Record<string, string> = {
  listening: "Listening",
  plate: "Plate",
  studio: "Studio",
  lab: "Lab",
  look: "Look",
  ink: "Ink",
};

function setPath(p: DeepPartial<ChladniParams>, path: string, value: unknown): void {
  const [g, k] = path.split(".");
  (p as Record<string, Record<string, unknown>>)[g!] ??= {};
  (p as Record<string, Record<string, unknown>>)[g!]![k!] = value;
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const plateRef = useRef<ChladniPlate | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [params, setParams] = useState<ChladniParams>(DEFAULT_PARAMS);
  const [frozen, setFrozen] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || plateRef.current) return;
    const plate = createChladniPlate(canvasRef.current);
    plateRef.current = plate;
    setParams(plate.getParams());
    if (new URLSearchParams(location.search).get("source") === "sim") {
      plate.setAnalyser(new SimulatedVoice());
    }
    return () => {
      plateRef.current = null;
      plate.destroy();
    };
  }, []);

  const patch = (p: DeepPartial<ChladniParams>) => {
    const plate = plateRef.current;
    if (!plate) return;
    plate.setParams(p);
    setParams(plate.getParams());
  };

  const sine = async () => {
    stopRef.current?.();
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 440;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 8192;
    const mute = ctx.createGain();
    mute.gain.value = 0;
    osc.connect(analyser);
    analyser.connect(mute);
    mute.connect(ctx.destination);
    osc.start();
    plateRef.current?.setAnalyser(analyser);
    stopRef.current = () => {
      osc.stop();
      void ctx.close();
    };
  };

  const mic = async () => {
    stopRef.current?.();
    try {
      const h = await createMicAnalyser();
      plateRef.current?.setAnalyser(h.analyser);
      stopRef.current = () => {
        h.stop();
        void h.context.close();
      };
    } catch (e) {
      console.error("mic failed", e);
    }
  };

  const select = (path: string, options: readonly string[]) => {
    const [g, k] = path.split(".");
    const cur = (params as unknown as Record<string, Record<string, string>>)[g!]?.[k!];
    return (
      <label key={path} style={{ display: "block", fontSize: 12 }}>
        {PARAM_SCHEMA[path]!.label}
        <select
          value={cur}
          style={{ marginLeft: 6 }}
          onChange={(e) => {
            const p: DeepPartial<ChladniParams> = {};
            setPath(p, path, e.target.value);
            patch(p);
          }}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    );
  };

  const groups: Record<string, [string, (typeof PARAM_SCHEMA)[string]][]> = {};
  for (const [path, entry] of Object.entries(PARAM_SCHEMA)) {
    const g = path.split(".")[0]!;
    (groups[g] ??= []).push([path, entry]);
  }

  return (
    <main style={{ fontFamily: "system-ui", display: "flex", gap: 24, padding: 24 }}>
      <div>
        <h1 style={{ fontSize: 20 }}>chladni</h1>
        <canvas
          ref={canvasRef}
          width={640}
          height={640}
          style={{ width: 640, height: 640, background: "#000" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button onClick={() => plateRef.current?.setAnalyser(new SimulatedVoice())}>
            Simulated voice
          </button>
          <button onClick={() => void mic()}>Microphone</button>
          <button onClick={() => void sine()}>Sine 440 Hz</button>
          <button onClick={() => plateRef.current?.resetSand()}>Reset sand</button>
          <button
            onClick={() => {
              const next = !frozen;
              setFrozen(next);
              plateRef.current?.freeze(next);
            }}
          >
            {frozen ? "Unfreeze" : "Freeze"}
          </button>
        </div>
        <div style={{ fontSize: 12, marginTop: 8, color: "#666" }}>
          partials:{" "}
          {plateRef.current?.partials.map((p) => `${p.freq.toFixed(0)}`).join(", ") || "—"}
        </div>
      </div>
      <div style={{ maxHeight: "90vh", overflowY: "auto", minWidth: 280 }}>
        {Object.entries(groups).map(([g, entries]) => (
          <fieldset key={g} style={{ marginBottom: 12 }}>
            <legend>{GROUPS[g] ?? g}</legend>
            {entries.map(([path, entry]) => {
              if (entry.kind === "number") {
                const [gr, key] = path.split(".");
                const cur = (params as unknown as Record<string, Record<string, number>>)[gr!]?.[
                  key!
                ];
                return (
                  <label key={path} style={{ display: "block", fontSize: 12 }}>
                    {entry.label}{" "}
                    <span style={{ color: "#888" }}>
                      {typeof cur === "number"
                        ? cur.toFixed(entry.step && entry.step < 1 ? 2 : 0)
                        : ""}
                      {entry.unit ?? ""}
                    </span>
                    <input
                      type="range"
                      min={entry.min}
                      max={entry.max}
                      step={entry.step}
                      value={cur ?? entry.min ?? 0}
                      style={{ width: "100%" }}
                      onChange={(e) => {
                        const p: DeepPartial<ChladniParams> = {};
                        setPath(p, path, Number(e.target.value));
                        patch(p);
                      }}
                    />
                  </label>
                );
              }
              if (entry.kind === "enum") return select(path, entry.options!);
              if (entry.kind === "boolean") {
                const [gr, key] = path.split(".");
                const cur = (params as unknown as Record<string, Record<string, boolean>>)[gr!]?.[
                  key!
                ];
                return (
                  <label key={path} style={{ display: "block", fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(cur)}
                      onChange={(e) => {
                        const p: DeepPartial<ChladniParams> = {};
                        setPath(p, path, e.target.checked);
                        patch(p);
                      }}
                    />{" "}
                    {entry.label}
                  </label>
                );
              }
              return null;
            })}
          </fieldset>
        ))}
      </div>
    </main>
  );
}
