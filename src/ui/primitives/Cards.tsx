/*
 * Card and tile content (src/styles/primitives/cards.css, components.md §6).
 * Cards are links or buttons owned by their family (TvButton on TV, <a>/<button> on P/D), so
 * these helpers render the inside plus class builders for the outer element:
 *   <TvButton id="card-1" className={cardClass("grid")} onActivate={open}>
 *     <CardArt src={art} /><CardCaption title="Mayday" meta="2026 · 111 min · Action" /></TvButton>
 */
import type { ReactNode } from "react";

export type CardKind = "poster" | "continue" | "episode" | "grid" | "live";

export function cardClass(kind: CardKind, className?: string) {
  return className ? `vx-card vx-card--${kind} ${className}` : `vx-card vx-card--${kind}`;
}

/** Missing art: surface-2 block, film icon, title in display type. Never stretch small art. */
export function MissingArt({ title, icon }: { title: ReactNode; icon: ReactNode }) {
  return <span className="vx-missing-art">{icon}<span className="vx-missing-art__title">{title}</span></span>;
}

export function CardArt({ src, alt = "", missing, badge, progress, play, actions, monogram }: {
  src?: string | null; alt?: string;
  /** Rendered when there is no src: <MissingArt/>. */
  missing?: ReactNode;
  /** Top-left badge (UP NEXT, WATCHING, LIVE). */
  badge?: ReactNode;
  /** 0–100 progress along the bottom of the art. */
  progress?: number;
  /** Desktop hover play disc (continue cards): pass the play icon. */
  play?: ReactNode;
  /** Desktop poster hover actions (<span class="vx-card__actions">…). */
  actions?: ReactNode;
  /** Text monogram instead of art (live tiles, channel logos). */
  monogram?: ReactNode;
}) {
  const clamped = progress === undefined ? undefined : Math.max(0, Math.min(100, progress));
  return (
    <span className={monogram ? "vx-card__art vx-card__art--monogram" : "vx-card__art"}>
      {monogram ?? (src ? <img alt={alt} src={src} loading="lazy" decoding="async" /> : missing)}
      {badge ? <span className="vx-card__badge">{badge}</span> : null}
      {clamped !== undefined ? (
        <span className="vx-card__progress">
          <span className="vx-progress" role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
            <span className="vx-progress__fill" style={{ width: `${clamped}%` }} />
          </span>
        </span>
      ) : null}
      {play ? <span className="vx-card__play" aria-hidden="true"><span className="vx-card__play-disc">{play}</span></span> : null}
      {actions}
    </span>
  );
}

export function CardCaption({ title, meta }: { title: ReactNode; meta?: ReactNode }) {
  return (
    <span className="vx-card__caption">
      <span className="vx-card__title">{title}</span>
      {meta ? <span className="vx-card__meta">{meta}</span> : null}
    </span>
  );
}

/** Episode caption: D "E1 Title" + 2-line synopsis; TV "EPISODE 1" eyebrow + title. */
export function EpisodeCaption({ number, title, synopsis, eyebrow }: { number?: ReactNode; title: ReactNode; synopsis?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <>
      {eyebrow ? <span className="vx-card__eyebrow">{eyebrow}</span> : null}
      {eyebrow
        ? <span className="vx-card__title">{title}</span>
        : <span className="vx-card__heading">{number ? <span className="vx-card__number">{number}</span> : null}<span className="vx-card__title">{title}</span></span>}
      {synopsis ? <span className="vx-card__synopsis">{synopsis}</span> : null}
    </>
  );
}

/** Phone continue card inside (292 × 96): thumb, title, meta, progress, play disc. Outer: className="vx-continue-card". */
export function ContinueCardContent({ src, title, meta, progress, play }: { src?: string | null; title: ReactNode; meta?: ReactNode; progress: number; play: ReactNode }) {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <>
      {src ? <img className="vx-continue-card__thumb" alt="" src={src} loading="lazy" decoding="async" /> : <span className="vx-continue-card__thumb" aria-hidden="true" />}
      <span className="vx-continue-card__body">
        <span className="vx-continue-card__title">{title}</span>
        {meta ? <span className="vx-continue-card__meta">{meta}</span> : null}
        <span className="vx-progress" role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}><span className="vx-progress__fill" style={{ width: `${clamped}%` }} /></span>
      </span>
      <span className="vx-continue-card__play" aria-hidden="true">{play}</span>
    </>
  );
}

/** Source row inside. Outer: className={sourceRowClass(best)} with aria-label "Play from <provider>, <quality>". */
export function sourceRowClass(best?: boolean) {
  return best ? "vx-source-row vx-source-row--best" : "vx-source-row";
}
export function SourceRowContent({ quality, provider, file, best, bestLabel = "Best match", opening, openingLabel = "Opening…", icon }: {
  quality: ReactNode; provider: ReactNode; file?: ReactNode; best?: boolean; bestLabel?: ReactNode; opening?: boolean; openingLabel?: ReactNode; icon: ReactNode;
}) {
  return (
    <>
      <span className="vx-source-row__quality">{quality}</span>
      <span className="vx-source-row__body">
        {best ? <span className="vx-eyebrow vx-eyebrow--accent">{bestLabel}</span> : null}
        <span className="vx-source-row__provider">{provider}</span>
        {file ? <span className="vx-source-row__file">{file}</span> : null}
      </span>
      {opening
        ? <span className="vx-source-row__status" role="status"><span className="vx-spinner vx-spinner--inline" aria-hidden="true" />{openingLabel}</span>
        : <span className="vx-source-row__icon" aria-hidden="true">{icon}</span>}
    </>
  );
}

/**
 * Profile tile inside. Outer: <button className="vx-profile"> (add tile: "vx-profile vx-profile--add",
 * disabled at 12 profiles). letter = one or two initials on the profile colour.
 */
export function ProfileTileContent({ name, src, letter, color, lockIcon, lockLabel = "Parent PIN required", cueIcon, addIcon }: {
  name: ReactNode; src?: string | null; letter?: string; color?: string;
  /** Lock badge for PIN-protected profiles. */
  lockIcon?: ReactNode; lockLabel?: string;
  /** TV manage-profiles pencil cue. */
  cueIcon?: ReactNode;
  /** Add-profile tile: the plus icon (renders the dashed square). */
  addIcon?: ReactNode;
}) {
  const avatar = (
    <span className="vx-profile__avatar">
      {addIcon ?? (src
        ? <img alt="" src={src} />
        : <span className={letter && letter.length > 1 ? "vx-profile__letter vx-profile__letter--initials" : "vx-profile__letter"} style={color ? { background: color } : undefined}>{letter}</span>)}
    </span>
  );
  return (
    <>
      {lockIcon || cueIcon ? (
        <span className="vx-profile__frame">
          {avatar}
          {lockIcon ? <span className="vx-lock-badge" role="img" aria-label={lockLabel}>{lockIcon}</span> : null}
          {cueIcon ? <span className="vx-pencil-cue" aria-hidden="true">{cueIcon}</span> : null}
        </span>
      ) : avatar}
      <span className="vx-profile__name">{name}</span>
    </>
  );
}

/** Avatar tile inside. Outer: <button className="vx-avatar-tile" aria-pressed={selected} aria-label="…">. */
export function AvatarTileContent({ src, selected, checkIcon }: { src: string; selected?: boolean; checkIcon: ReactNode }) {
  return (
    <>
      <img alt="" src={src} loading="lazy" decoding="async" />
      {selected ? <span className="vx-check-badge" aria-hidden="true">{checkIcon}</span> : null}
    </>
  );
}
