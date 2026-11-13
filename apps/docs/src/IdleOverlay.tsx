import type { ChladniParams } from "@chladni/react";
import type { ReactNode } from "react";
import { SandField } from "./SandField";

interface Props {
  /** true while no voice is driving the plate */
  idle: boolean;
  params: ChladniParams;
  /** grains in the idle sand */
  count?: number;
  /** the live plate underneath */
  children: ReactNode;
}

/**
 * Stacks the Idle sand over a plate and cross-fades between them. The sand
 * stays mounted (paused while hidden), so going idle again picks up the same
 * grains instead of re-seeding.
 */
export function IdleOverlay({ idle, params, count, children }: Props) {
  return (
    <div className={`plate-stack${idle ? " is-idle" : ""}`}>
      {children}
      <SandField
        sand={params.look.color}
        plate={params.look.plateColor}
        shape={params.plate.shape}
        mode="idle"
        active={idle}
        {...(count !== undefined ? { count } : {})}
      />
    </div>
  );
}
