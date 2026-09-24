/*
 * Spinner, progress bar and live dot (src/styles/primitives/{spinner,progress}.css).
 * The timeline is markup-only (see the comment in progress.css); SeekBar adopts it.
 */
export function Spinner({ variant, label }: { variant?: "inline" | "buffering" | "panel"; label?: string }) {
  const className = variant ? `vx-spinner vx-spinner--${variant}` : "vx-spinner";
  return label
    ? <span className={className} role="status" aria-label={label} />
    : <span className={className} aria-hidden="true" />;
}

/** Progress bar: value 0–100. P/D 4 (small 3), TV 6; accent fill. */
export function ProgressBar({ value, small, label, className }: { value: number; small?: boolean; label?: string; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const classes = ["vx-progress", small ? "vx-progress--small" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <span className={classes} role="progressbar" aria-label={label} aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
      <span className="vx-progress__fill" style={{ width: `${clamped}%` }} />
    </span>
  );
}

export function LiveDot() {
  return <span className="vx-live-dot" aria-hidden="true" />;
}
