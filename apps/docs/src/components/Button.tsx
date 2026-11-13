import type { ButtonHTMLAttributes, ReactNode } from "react";

// Figma: Button component set — panel fill, edge stroke, r6, h32, 13px Medium,
// optional 16px leading/trailing icon slots.
// Motion: hover is colour only, press squeezes to .97; a text label that
// changes (Copy → Copied) swaps in place with a short blur.
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary";
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function Button({
  variant = "default",
  leadingIcon,
  trailingIcon,
  className,
  children,
  ...rest
}: ButtonProps) {
  const cls = ["ui-btn", variant === "primary" ? "primary" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  const label =
    typeof children === "string" ? (
      <span key={children} className="ui-swap">
        {children}
      </span>
    ) : (
      children
    );
  return (
    <button type="button" className={cls} {...rest}>
      {leadingIcon}
      {label}
      {trailingIcon}
    </button>
  );
}
