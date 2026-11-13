import type { CSSProperties } from "react";

// Figma: Slider set — 4px tertiary track, accent progress fill, 16px r8 thumb
// (panel fill, 2px accent stroke). Native range input kept for a11y; the
// --pct var paints the filled portion of the track.
export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  width?: number;
  disabled?: boolean;
  ariaLabel?: string;
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  width,
  disabled,
  ariaLabel,
}: SliderProps) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      className="ui-slider"
      aria-label={ariaLabel}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      style={{ "--pct": `${pct}%`, ...(width !== undefined ? { width } : {}) } as CSSProperties}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}
