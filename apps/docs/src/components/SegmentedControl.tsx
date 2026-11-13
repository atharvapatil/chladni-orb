import type { ReactNode } from "react";

// Figma: Segmented control set — seg-bg container (r4, p3, gap 2), items with
// 12px Medium text; active item gets seg-active fill, seg-active-fg text, r6 + shadow.
export interface SegmentedControlOption<T extends string> {
  value: T;
  label?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly (T | SegmentedControlOption<T>)[];
  value: T;
  onChange: (value: T) => void;
  size?: "default" | "small";
  ariaLabel?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "default",
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <span
      className={`ui-seg${size === "small" ? " sm" : ""}`}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : (o.label ?? o.value);
        return (
          <button
            type="button"
            key={v}
            role="radio"
            aria-checked={v === value}
            className={v === value ? "active" : ""}
            onClick={() => onChange(v)}
          >
            {label}
          </button>
        );
      })}
    </span>
  );
}
