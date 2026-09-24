/*
 * Feedback primitives (src/styles/primitives/feedback.css): toasts, player notice pill,
 * preparing playback, backend banner, inline error, status line, loading more, empty state,
 * skeleton shapes and the TV startup cover. Copy comes from copy.md.
 * Actions stay the caller's (plain <button> on phone / desktop, TvButton on TV).
 */
import { CircleAlert } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const Spinner = () => <span className="vx-spinner" aria-hidden="true" />;

/** Fixed toast stack: P above the nav (116), D bottom-centre (24), TV top-centre. */
export function ToastRegion({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={join("vx-toast-region", className)}>{children}</div>;
}

/**
 * Notice (5 s, text only, secondary) or error (4 s, alert icon + one action: Dismiss, or
 * "Try again" for a startup error). The owner times it out (motion.toast-notice / -error).
 */
export function Toast({ kind = "notice", children, action, icon, className }: {
  kind?: "notice" | "error";
  children: ReactNode;
  /** A <button className="vx-toast__action"> (TvButton on TV). */
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const error = kind === "error";
  return (
    <div className={join("vx-toast", error && "vx-toast--error", className)} role={error ? "alert" : "status"}>
      {error ? (icon ?? <CircleAlert className="vx-toast__icon" aria-hidden="true" />) : icon}
      <span className="vx-toast__text">{children}</span>
      {action}
    </div>
  );
}

/** Player notice pill (4 s): "The stream could not seek there." `top` anchors it over the video. */
export function Notice({ children, top, className }: { children: ReactNode; top?: boolean; className?: string }) {
  return <div className={join("vx-notice", top && "vx-notice--top", className)} role="status">{children}</div>;
}

/** "Preparing playback…": a pill on phone / desktop, a centred panel with a 56 spinner on TV. */
export function Preparing({ label = "Preparing playback…", placement, className }: { label?: ReactNode; placement?: "top" | "center"; className?: string }) {
  return (
    <div className={join("vx-preparing", placement === "top" && "vx-notice--top", placement === "center" && "vx-preparing--center", className)} role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

/** Backend banner (TV: centred alert panel; wrap it in <Overlay> for the 0.6 scrim). */
export function Banner({ title, titleId = "vx-banner-title", icon, children, meta, actions, center, className }: {
  title: ReactNode;
  titleId?: string;
  icon: ReactNode;
  children: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  /** TV: centre it on the canvas. */
  center?: boolean;
  className?: string;
}) {
  return (
    <section className={join("vx-banner", center && "vx-banner--center", className)} role="alert" aria-labelledby={titleId}>
      <span className="vx-banner__icon" aria-hidden="true">{icon}</span>
      <div className="vx-banner__body">
        <h2 className="vx-banner__title" id={titleId}>{title}</h2>
        <p className="vx-banner__text">{children}</p>
        {meta ? <span className="vx-banner__meta">{meta}</span> : null}
        {actions ? <div className="vx-banner__actions">{actions}</div> : null}
      </div>
    </section>
  );
}

/** Alert icon + danger text under a field. */
export function InlineError({ children, id, className }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <span className={join("vx-inline-error", className)} role="alert" id={id}>
      <CircleAlert aria-hidden="true" />
      {children}
    </span>
  );
}

/** Spinner + tertiary words: "Finding sources…", "Still checking 2 addons". */
export function StatusLine({ children, spinner = true, className }: { children: ReactNode; spinner?: boolean; className?: string }) {
  return (
    <div className={join("vx-status", className)} role="status">
      {spinner ? <Spinner /> : null}
      {children}
    </div>
  );
}

/** End-of-list loader: "Loading more titles…" (never a Load more button). */
export function LoadingMore({ children = "Loading more titles…", className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={join("vx-loading-more", className)} role="status">
      <Spinner />
      {children}
    </div>
  );
}

/** 52 round icon (D 60, TV 88), a title, one line of help, optionally one action. */
export function EmptyState({ icon, title, children, action, center, headingLevel = 2, className }: {
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  center?: boolean;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <div className={join("vx-empty", center && "vx-empty--center", className)}>
      <span className="vx-empty__icon" aria-hidden="true">{icon}</span>
      <Heading className="vx-empty__title">{title}</Heading>
      {children ? <p className="vx-empty__text">{children}</p> : null}
      {action ? <div className="vx-empty__action">{action}</div> : null}
    </div>
  );
}

/* Skeletons (phone / desktop only; TV shows the startup cover then real content). */

type SkelProps = { className?: string; style?: CSSProperties; card?: boolean };
/** One shape. Lines: <Skel className="vx-skel--line" style={{ width: "80%" }}/>. */
export function Skel({ className, style, card }: SkelProps) {
  return <span className={join("vx-skel", card && "vx-skel--card", className)} style={style} aria-hidden="true" />;
}

function Lines({ widths, size, card }: { widths: string[]; size?: "md" | "lg"; card?: boolean }) {
  return (
    <span className="vx-skel-lines" aria-hidden="true">
      {widths.map((width, index) => <Skel key={index} card={card} className={join("vx-skel--line", size && `vx-skel--line-${size}`)} style={{ width }} />)}
    </span>
  );
}

/** Art + two caption lines. poster: P 111×139 / D 172×258; still: 256×128; episode: 272×150. */
export function SkeletonTile({ kind = "poster" }: { kind?: "poster" | "still" | "episode" }) {
  return (
    <span className={join("vx-skel-tile", kind !== "poster" && `vx-skel-tile--${kind}`)} aria-hidden="true">
      <Skel className="vx-skel-tile__art" />
      <Lines widths={["80%", "45%"]} />
    </span>
  );
}

/** Phone continue card: 292 × 96 surface card with thumb, two lines, bar and play disc. */
export function SkeletonContinue() {
  return (
    <span className="vx-skel-continue vx-skel-surface" aria-hidden="true">
      <Skel className="vx-skel-continue__thumb" />
      <span className="vx-skel-lines">
        <Skel className="vx-skel--line vx-skel--line-md" style={{ width: "80%" }} />
        <Skel className="vx-skel--line" style={{ width: "50%" }} />
        <Skel className="vx-skel--line vx-skel--bar" style={{ width: "100%" }} />
      </span>
      <Skel className="vx-skel--round vx-skel-continue__disc" />
    </span>
  );
}

/** Phone featured card (Home). */
export function SkeletonFeatured() {
  return (
    <span className="vx-skel-featured vx-skel-surface" aria-hidden="true">
      <Skel className="vx-skel-featured__art" />
      <span className="vx-skel-featured__body">
        <Skel className="vx-skel-featured__logo" />
        <Lines widths={["75%", "95%", "68%"]} />
        <span className="vx-skel-actions"><Skel className="vx-skel--grow" /><Skel className="vx-skel--round" /></span>
      </span>
    </span>
  );
}

/** Desktop hero (Home). */
export function SkeletonHero() {
  return (
    <span className="vx-skel-hero" aria-hidden="true">
      <span className="vx-skel-hero__text">
        <Skel className="vx-skel--line vx-skel--line-md" style={{ width: "40%" }} />
        <Skel className="vx-skel-hero__logo" />
        <Lines widths={["67%"]} size="md" />
        <Lines widths={["100%", "93%", "60%"]} size="md" />
        <span className="vx-skel-actions"><Skel className="vx-skel--pill" /><Skel className="vx-skel--pill" /><Skel className="vx-skel--round" /></span>
      </span>
      <Skel className="vx-skel-hero__art" />
    </span>
  );
}

/** List row. phone: 60 art + four lines (channel row); desktop: 40 icon, name, two blocks (guide row). */
export function SkeletonRow({ variant = "desktop" }: { variant?: "phone" | "desktop" }) {
  if (variant === "phone") {
    return (
      <span className="vx-skel-row" aria-hidden="true">
        <Skel className="vx-skel-row__art" />
        <span className="vx-skel-lines">
          <Skel className="vx-skel--line" style={{ width: "35%" }} />
          <Skel className="vx-skel--line vx-skel--line-lg" style={{ width: "75%" }} />
          <Skel className="vx-skel--line vx-skel--bar" style={{ width: "100%", height: "var(--viptv-size-progress-small)" }} />
          <Skel className="vx-skel--line" style={{ width: "55%" }} />
        </span>
      </span>
    );
  }
  return (
    <span className="vx-skel-row" aria-hidden="true">
      <Skel className="vx-skel-row__art" />
      <Skel className="vx-skel--line vx-skel--line-lg vx-skel-row__name" />
      {/* Block widths from the CmpDesk3 "Skeleton · list row" reference. */}
      <Skel className="vx-skel-row__block" style={{ width: 300 }} />
      <Skel className="vx-skel-row__block" style={{ width: 200 }} />
    </span>
  );
}

/** TV launch cover: wordmark over "Starting VIPTV…" (TV has no skeletons). */
export function StartupCover({ label = "Starting VIPTV…" }: { label?: ReactNode }) {
  return (
    <div className="vx-startup" role="status">
      <span className="vx-startup__mark">VIPTV</span>
      <span className="vx-status"><Spinner />{label}</span>
    </div>
  );
}
