/*
 * Badges and indicators (src/styles/primitives/badges.css, components.md §3). Not interactive.
 */
import type { ReactNode } from "react";

export function QualityBadge({ children }: { children: ReactNode }) {
  return <span className="vx-badge vx-badge--quality">{children}</span>;
}

/** LIVE: glass over art (P/D, red dot), solid red block on TV. */
export function LiveBadge({ label = "LIVE" }: { label?: ReactNode }) {
  return <span className="vx-badge vx-badge--live"><span className="vx-badge__dot" aria-hidden="true" />{label}</span>;
}

/** "● LIVE" row label (live-now card, live rows). */
export function LiveLabel({ children = "Live" }: { children?: ReactNode }) {
  return <span className="vx-live-label"><span className="vx-live-dot" aria-hidden="true" />{children}</span>;
}

/** Pill badges: FEATURED (glass over the phone hero), UP NEXT (accent), WATCHING (dark glass). */
export function Badge({ kind, children }: { kind: "featured" | "up-next" | "watching"; children: ReactNode }) {
  return <span className={`vx-badge vx-badge--${kind}`}>{children}</span>;
}

/** Caps eyebrow ("Featured movie"); accent = "Best match" on the first source row. */
export function Eyebrow({ accent, children, className }: { accent?: boolean; children: ReactNode; className?: string }) {
  return <span className={["vx-eyebrow", accent ? "vx-eyebrow--accent" : "", className ?? ""].filter(Boolean).join(" ")}>{children}</span>;
}

/** TV player status: PLAYING / PAUSED / BUFFERING / LOADING. */
export function StatusWord({ children }: { children: ReactNode }) {
  return <span className="vx-status-word">{children}</span>;
}

/** Carousel dots (decorative; the carousel announces its own position). */
export function CarouselDots({ count, index, overArt }: { count: number; index: number; overArt?: boolean }) {
  return (
    <span className={overArt ? "vx-dots vx-dots--over-art" : "vx-dots"} aria-hidden="true">
      {Array.from({ length: count }, (_, dot) => <span key={dot} className="vx-dots__dot" aria-current={dot === index ? "true" : undefined} />)}
    </span>
  );
}
