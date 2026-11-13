import type { InputHTMLAttributes } from "react";

// Figma: Input set — 32px field, r6, panel fill, border stroke, 12px Medium text,
// secondary placeholder.
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={["ui-input", className ?? ""].filter(Boolean).join(" ")} {...rest} />;
}
