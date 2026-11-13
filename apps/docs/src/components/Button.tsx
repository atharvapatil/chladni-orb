import type { ButtonHTMLAttributes, ReactNode } from "react";

// Figma: Button component set — panel fill, edge stroke, r6, h32, 13px Medium,
// optional 16px leading/trailing icon slots.
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
  return (
    <button type="button" className={cls} {...rest}>
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}
