/*
 * Switch, radio and choice rows (src/styles/primitives/toggles.css, components.md §4–5).
 * On TV, style a TvButton with className="vx-choice" and render <ChoiceContent/> inside it.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Switch({ checked, onChange, label, disabled, id }: {
  checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean; id?: string;
}) {
  return (
    <button type="button" id={id} className="vx-switch" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} />
  );
}

/** Presentational switch inside a row that itself takes focus (settings rows). */
export function SwitchIndicator({ checked }: { checked: boolean }) {
  return <span className="vx-switch" aria-hidden="true" data-checked={checked ? "true" : "false"} />;
}

export function ChoiceList({ label, role = "radiogroup", children, className }: { label: string; role?: "radiogroup" | "listbox" | "group"; children: ReactNode; className?: string }) {
  return <div className={className ? `vx-choice-list ${className}` : "vx-choice-list"} role={role} aria-label={label}>{children}</div>;
}

/**
 * Row content: [radio] label (+ sub-note), "✓ Current" at the end (P/D) or "· Current" after the
 * label (TV); an unavailable option reads "(unavailable)" (P/D) / "· unavailable" (TV).
 */
export function ChoiceContent({ children, sub, current, unavailable, radio, checkIcon, currentLabel = "Current", unavailableLabel = "unavailable" }: {
  children: ReactNode; sub?: ReactNode; current?: boolean; unavailable?: boolean; radio?: boolean; checkIcon?: ReactNode;
  currentLabel?: string; unavailableLabel?: string;
}) {
  return (
    <>
      {radio ? <span className="vx-radio" aria-hidden="true" /> : null}
      <span className="vx-choice__label">
        <span>
          {children}
          {unavailable ? <span className="vx-choice__note vx-choice__note--responsive"> ({unavailableLabel})</span> : null}
        </span>
        {current ? <span className="vx-choice__note vx-choice__note--tv">· {currentLabel}</span> : null}
        {unavailable ? <span className="vx-choice__note vx-choice__note--tv">· {unavailableLabel}</span> : null}
        {sub ? <span className="vx-choice__sub">{sub}</span> : null}
      </span>
      {current ? <span className="vx-choice__current">{checkIcon}{currentLabel}</span> : null}
    </>
  );
}

export function choiceClass({ destructive, className }: { destructive?: boolean; className?: string } = {}) {
  return ["vx-choice", destructive ? "vx-choice--destructive" : "", className ?? ""].filter(Boolean).join(" ");
}

/** A choice row button. current → aria-checked (radio rows) or aria-current; unavailable → disabled. */
export function Choice({ current, unavailable, radio, destructive, sub, checkIcon, currentLabel, unavailableLabel, children, className, type = "button", ...rest }:
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
    current?: boolean; unavailable?: boolean; radio?: boolean; destructive?: boolean; sub?: ReactNode; checkIcon?: ReactNode;
    currentLabel?: string; unavailableLabel?: string; className?: string;
  }) {
  const state = radio ? { role: "radio", "aria-checked": !!current } : { "aria-current": current ? ("true" as const) : undefined };
  return (
    <button type={type} className={choiceClass({ destructive, className })} disabled={unavailable || rest.disabled} {...state} {...rest}>
      <ChoiceContent sub={sub} current={current} unavailable={unavailable} radio={radio} checkIcon={checkIcon} currentLabel={currentLabel} unavailableLabel={unavailableLabel}>{children}</ChoiceContent>
    </button>
  );
}
