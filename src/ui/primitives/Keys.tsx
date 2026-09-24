/*
 * Key hints (src/styles/primitives/keys.css).
 * Desktop / web: <Kbd>Esc</Kbd> keycaps and a <KbdHints> row (hidden on phones).
 * TV: <KeyLegend items={[{ key: "OK", label: "Select" }, { key: "BACK", label: "Close" }]} corner/>,
 * bottom-right in the safe area on every TV screen (render it inside the .tv-layout canvas).
 * Both are decorative (aria-hidden): the controls themselves carry the accessible names.
 */
import type { ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="vx-kbd">{children}</kbd>;
}

export type KbdHint = { keys: ReactNode[]; label: ReactNode };

export function KbdHints({ hints, className }: { hints: KbdHint[]; className?: string }) {
  return (
    <div className={className ? `vx-kbd-hints ${className}` : "vx-kbd-hints"} aria-hidden="true">
      {hints.map((hint, index) => (
        <span className="vx-kbd-hint" key={index}>
          {hint.keys.map((key, keyIndex) => <kbd className="vx-kbd" key={keyIndex}>{key}</kbd>)}
          {" "}{hint.label}
        </span>
      ))}
    </div>
  );
}

export type LegendItem = { key: ReactNode; label: ReactNode };

export function KeyLegend({ items, corner = false, className }: { items: LegendItem[]; corner?: boolean; className?: string }) {
  const classes = ["vx-legend", corner ? "vx-legend--corner" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <div className={classes} aria-hidden="true">
      {items.map((item, index) => (
        <span className="vx-legend__item" key={index}>
          <span className="vx-legend__key">{item.key}</span>
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}
