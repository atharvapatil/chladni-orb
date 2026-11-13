import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// Figma: Segmented control set — seg-bg container (r4, p3, gap 2), items with
// 12px Medium text; active item gets seg-active fill, seg-active-fg text, r6 + shadow.
// Motion: one pill slides between options (tabs sliding, 250ms). Its first
// placement snaps; it only animates after a real change.
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
  const root = useRef<HTMLSpanElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number; settled: boolean } | null>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const place = () => {
      const active = el.querySelector<HTMLButtonElement>('button[aria-checked="true"]');
      if (!active) return;
      const r = el.getBoundingClientRect();
      const a = active.getBoundingClientRect();
      setPill((p) => ({ x: a.left - r.left, w: a.width, settled: p !== null }));
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value, options.length, size]);

  return (
    <span
      ref={root}
      className={`ui-seg${size === "small" ? " sm" : ""}`}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {pill && (
        <span
          className={`ui-seg-pill${pill.settled ? " is-live" : ""}`}
          style={{ "--x": `${pill.x}px`, "--w": `${pill.w}px` } as CSSProperties}
          aria-hidden="true"
        />
      )}
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
