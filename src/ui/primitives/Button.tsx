/*
 * Buttons (src/styles/primitives/buttons.css, components.md §1).
 * <Button kind="primary" icon={<PlayIcon/>}>Play</Button> renders a real <button>. On TV, keep
 * TvButton (remote focus) and style it with buttonClass(...) + <ButtonContent/>:
 *   <TvButton id="play" className={buttonClass({ icon: true })} onActivate={play}><ButtonContent icon={<PlayIcon/>}>Resume</ButtonContent></TvButton>
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonKind = "primary" | "secondary" | "light" | "outline" | "destructive" | "quiet";
export type ButtonSize = "default" | "detail" | "pill" | "small";

export type ButtonClassOptions = {
  kind?: ButtonKind;
  size?: ButtonSize;
  /** Icon-only round button (give it an aria-label). */
  round?: boolean;
  /** Has a leading icon (adds the drawn +4 trailing padding). */
  icon?: boolean;
  /** Full width. */
  block?: boolean;
  className?: string;
};

export function buttonClass({ kind = "secondary", size = "default", round, icon, block, className }: ButtonClassOptions = {}) {
  return [
    "vx-btn",
    kind !== "secondary" ? `vx-btn--${kind}` : "",
    size !== "default" ? `vx-btn--${size}` : "",
    round ? "vx-btn--icon" : "",
    icon && !round ? "vx-btn--lead" : "",
    block ? "vx-btn--block" : "",
    className ?? "",
  ].filter(Boolean).join(" ");
}

/** Button inner content: the icon (or the loading spinner, which replaces it) + label. */
export function ButtonContent({ icon, loading, loadingLabel, children }: { icon?: ReactNode; loading?: boolean; loadingLabel?: ReactNode; children?: ReactNode }) {
  return (
    <>
      {loading ? <span className="vx-spinner" aria-hidden="true" /> : icon}
      {loading && loadingLabel ? loadingLabel : children}
    </>
  );
}

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & ButtonClassOptions & {
  /** Leading icon (lucide or PlayIcon). */
  leading?: ReactNode;
  /** Shows the spinner in place of the icon and sets aria-busy; label reads loadingLabel ("Saving…"). */
  loading?: boolean;
  loadingLabel?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { kind, size, round, block, className, leading, loading, loadingLabel, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ kind, size, round, block, className, icon: !!leading || !!loading })}
      aria-busy={loading || undefined}
      {...rest}
    >
      <ButtonContent icon={leading} loading={loading} loadingLabel={loadingLabel}>{children}</ButtonContent>
    </button>
  );
});

/** Desktop split button: Play + a chevron that opens the source drawer (one focus ring around both). */
export function SplitButton({ icon, label, onPlay, chevron, onChoose, chooseLabel = "Choose source", disabled }: {
  icon?: ReactNode; label: ReactNode; onPlay: () => void; chevron: ReactNode; onChoose: () => void; chooseLabel?: string; disabled?: boolean;
}) {
  return (
    <div className="vx-split">
      <button type="button" className="vx-split__main" onClick={onPlay} disabled={disabled}>{icon}{label}</button>
      <button type="button" className="vx-split__more" aria-label={chooseLabel} aria-haspopup="dialog" onClick={onChoose} disabled={disabled}>{chevron}</button>
    </div>
  );
}

/** TV source pill content ("1080p LordStreams"); put it in a TvButton with className="vx-source-pill". */
export function SourcePillContent({ quality, provider }: { quality: ReactNode; provider: ReactNode }) {
  return <><span className="vx-badge vx-badge--quality">{quality}</span>{provider}</>;
}
