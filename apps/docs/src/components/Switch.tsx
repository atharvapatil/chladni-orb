// Figma: Switch set — 36×20 r10 track (tertiary off, accent on), 16px r8 thumb
// (panel off, active-fg on) sliding 16px.
export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export function Switch({ checked, onChange, disabled, ariaLabel }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`ui-switch${checked ? " on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <i />
    </button>
  );
}
