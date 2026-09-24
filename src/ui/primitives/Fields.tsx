/*
 * Fields (src/styles/primitives/fields.css, components.md §4): text / password / URL fields,
 * search fields, PIN boxes and the TV display-only field value. Real <label> + <input>.
 */
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "size">;

export type TextFieldProps = InputProps & {
  label: ReactNode;
  /** Visually hide the label (TV text entry, where the screen title names the field). */
  hideLabel?: boolean;
  /** Inline error below the field (danger border + alert line, role="alert"). */
  error?: ReactNode;
  /** Alert icon for the inline error (lucide CircleAlert). */
  errorIcon?: ReactNode;
  /** Monospace value (addon manifest URL). */
  mono?: boolean;
  /** Trailing 32 round action inside the field (password eye, clear). */
  action?: ReactNode;
  className?: string;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hideLabel, error, errorIcon, mono, action, className, disabled, ...rest },
  ref,
) {
  const classes = ["vx-field", error ? "vx-field--error" : "", disabled ? "vx-field--disabled" : "", mono ? "vx-field--mono" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <label className={classes}>
      <span className={hideLabel ? "vx-sr-only" : "vx-field__label"}>{label}</span>
      <span className="vx-field__control">
        <input ref={ref} className="vx-field__input" disabled={disabled} aria-invalid={error ? true : undefined} {...rest} />
        {action}
      </span>
      {error ? <span className="vx-inline-error" role="alert">{errorIcon}{error}</span> : null}
    </label>
  );
});

/** Password field with a show / hide eye button. */
export const PasswordField = forwardRef<HTMLInputElement, Omit<TextFieldProps, "type" | "action"> & {
  showIcon: ReactNode; hideIcon: ReactNode; showLabel?: string; hidePasswordLabel?: string;
}>(function PasswordField({ showIcon, hideIcon, showLabel = "Show password", hidePasswordLabel = "Hide password", ...rest }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      ref={ref}
      {...rest}
      type={visible ? "text" : "password"}
      action={(
        <button type="button" className="vx-field__action" aria-label={visible ? hidePasswordLabel : showLabel} aria-pressed={visible} onClick={() => setVisible(!visible)}>
          {visible ? hideIcon : showIcon}
        </button>
      )}
    />
  );
});

/** Display-only value with the accent caret (TV text entry shows what the keyboard typed). */
export function FieldValue({ value, placeholder, caret }: { value: string; placeholder?: ReactNode; caret?: boolean }) {
  return value
    ? <span className="vx-field__value">{value}{caret ? <span className="vx-caret" aria-hidden="true" /> : null}</span>
    : <span className="vx-field__placeholder">{placeholder}{caret ? <span className="vx-caret" aria-hidden="true" /> : null}</span>;
}

/**
 * Search field: phone docked glass pill (default), web page search ("page"), desktop title bar
 * ("titlebar", 460 × 30). The clear button shows once there is text.
 */
export const SearchField = forwardRef<HTMLInputElement, InputProps & {
  variant?: "docked" | "page" | "titlebar"; icon: ReactNode; clearIcon: ReactNode; onClear?: () => void;
  label?: string; clearLabel?: string; className?: string;
}>(function SearchField({ variant = "docked", icon, clearIcon, onClear, label = "Search", clearLabel = "Clear search", className, value, placeholder = "Search movies and series", ...rest }, ref) {
  const classes = ["vx-search", variant !== "docked" ? `vx-search--${variant}` : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <label className={classes}>
      {icon}
      <input ref={ref} className="vx-search__input" type="search" value={value} placeholder={placeholder} {...rest} />
      {value && onClear ? <button type="button" className="vx-search__clear" aria-label={clearLabel} onClick={onClear}>{clearIcon}</button> : null}
      <span className="vx-sr-only">{label}</span>
    </label>
  );
});

/** PIN boxes: filled boxes show a dot, the active box the accent caret; error turns every border danger. */
export function PinBoxes({ length, filled, active = true, error, label }: { length: number; filled: number; active?: boolean; error?: boolean; label: string }) {
  return (
    <div className={error ? "vx-pin vx-pin--error" : "vx-pin"} role="group" aria-label={label}>
      {Array.from({ length }, (_, index) => (
        <span key={index} className={index < filled ? "vx-pin__box vx-pin__box--filled" : index === filled && active ? "vx-pin__box vx-pin__box--active" : "vx-pin__box"} />
      ))}
    </div>
  );
}
