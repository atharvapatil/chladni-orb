import type { ChladniParams } from "../params";

/**
 * The plate as a voice agent's presence.
 * - `talking`: the normal plate, driven by the analyser.
 * - `idle`: the sound is ignored and the sand rests, spread evenly, shivering.
 * - `connecting`: like idle, with pulses rolling out from the centre.
 * - `listening`: like idle, with pulses drawing in from the rim.
 */
export type AgentState = "idle" | "connecting" | "listening" | "talking";

export const AGENT_STATES: readonly AgentState[] = ["idle", "connecting", "listening", "talking"];

/** quiet states ignore the analyser entirely */
export function isQuiet(state: AgentState): boolean {
  return state !== "talking";
}

/** +1 rings roll out from the centre, -1 in from the rim, 0 none */
export function pulseFor(state: AgentState): -1 | 0 | 1 {
  return state === "connecting" ? 1 : state === "listening" ? -1 : 0;
}

/** energy below this counts as silence for the relax behaviour */
export const RELAX_SILENCE = 0.02;

/** should the sand be relaxing (spreading evenly) right now? */
export function wantsRelax(state: AgentState, params: ChladniParams, energy: number): boolean {
  if (params.listening.freeze) return false;
  if (isQuiet(state)) return true;
  return params.listening.idle === "relax" && energy < RELAX_SILENCE;
}

/** relax eases in over ~0.6s and snaps out in ~0.15s; returns the new level */
export function stepRelax(relax: number, want: boolean, dt: number): number {
  const rate = want ? dt / 0.6 : dt / 0.15;
  const next = relax + ((want ? 1 : 0) - relax) * Math.min(1, rate);
  return next < 0.001 ? 0 : next;
}

/**
 * Fresh sand on model or partial-count change (Figura rule), and whenever the
 * outline changes so the grains fill the new shape.
 */
export function needsFreshSand(prev: ChladniParams, next: ChladniParams): boolean {
  return (
    next.plate.model !== prev.plate.model ||
    next.listening.partials !== prev.listening.partials ||
    next.plate.shape !== prev.plate.shape ||
    next.plate.aspect !== prev.plate.aspect
  );
}
