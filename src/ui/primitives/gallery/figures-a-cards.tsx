/*
 * Gallery figures for agent A's cards (CmpPhone2 / CmpDesk2 / CmpTv2 "Cards and tiles")
 * and the player timeline (CmpPhone3 / CmpDesk3 / CmpTv3). Art comes from the design
 * reference assets (served by the dev server; DEV only).
 */
import type { CSSProperties, ReactNode } from "react";
import { Check, Film, Lock, Pencil, Plus } from "lucide-react";
import { PlayIcon } from "../icons";
import { ProfileTileContent, SourceRowContent, sourceRowClass } from "../Cards";
import { register } from "./registry";

const assets = import.meta.glob("../../../../../design/viptv-design-system/reference/assets/*", {
  eager: true, query: "?url", import: "default",
}) as Record<string, string>;
const art = (file: string) => assets[`../../../../../design/viptv-design-system/reference/assets/${file}`] ?? "";
const sw = (w: number) => ({ strokeWidth: w });
const box = (width: number, children: ReactNode, style: CSSProperties = {}) => <div style={{ width, display: "flex", gap: 10, ...style }}>{children}</div>;

function Progress({ value, small }: { value: number; small?: boolean }) {
  return (
    <span className={small ? "vx-progress vx-progress--small" : "vx-progress"} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span className="vx-progress__fill" style={{ width: `${value}%` }} />
    </span>
  );
}

function Card({ kind, img, title, meta, progress, badge, play, force, actions, missing, monogram, style }: {
  kind: string; img?: string; title: string; meta?: string; progress?: number; badge?: ReactNode; play?: boolean;
  force?: string; actions?: boolean; missing?: boolean; monogram?: string; style?: CSSProperties;
}) {
  return (
    <a href="#" className={`vx-card vx-card--${kind}`} data-force={force} style={style} onClick={(event) => event.preventDefault()}>
      <span className={monogram ? "vx-card__art vx-card__art--monogram" : "vx-card__art"}>
        {monogram ?? null}
        {missing ? <span className="vx-missing-art"><Film {...sw(1.8)} /><span className="vx-missing-art__title">{title}</span></span> : img ? <img alt="" src={art(img)} /> : null}
        {badge ? <span className="vx-card__badge">{badge}</span> : null}
        {progress !== undefined ? <span className="vx-card__progress"><Progress value={progress} /></span> : null}
        {play ? <span className="vx-card__play" aria-hidden="true"><span className="vx-card__play-disc"><PlayIcon /></span></span> : null}
        {actions ? <span className="vx-card__actions"><span className="vx-card__action-play"><PlayIcon />Play</span><span className="vx-card__action-add"><Plus {...sw(2.2)} /></span></span> : null}
      </span>
      <span className="vx-card__caption"><span className="vx-card__title">{title}</span>{meta ? <span className="vx-card__meta">{meta}</span> : null}</span>
    </a>
  );
}

function SourceRow({ quality, provider, file, best, opening, force, openingLabel }: {
  quality: string; provider: string; file: string; best?: boolean; opening?: boolean; force?: string; openingLabel?: string;
}) {
  return (
    <button className={sourceRowClass(best)} aria-label={`Play from ${provider}, ${quality}`} data-force={force}>
      <SourceRowContent quality={quality} provider={provider} file={file} best={best} opening={opening} openingLabel={openingLabel} icon={<PlayIcon />} />
    </button>
  );
}

function Profile({ name, img, letter, color, lock, force, cue }: { name: string; img?: string; letter?: string; color?: string; lock?: boolean; force?: string; cue?: boolean }) {
  return (
    <button className="vx-profile" data-force={force}>
      <ProfileTileContent name={name} src={img ? art(img) : undefined} letter={letter} color={color}
        lockIcon={lock ? <Lock {...sw(2.4)} /> : undefined} cueIcon={cue ? <Pencil {...sw(2.2)} /> : undefined} />
    </button>
  );
}
const AddProfile = ({ disabled }: { disabled?: boolean }) => (
  <button className="vx-profile vx-profile--add" disabled={disabled}><span className="vx-profile__avatar"><Plus {...sw(1.8)} /></span><span className="vx-profile__name">Add profile</span></button>
);
const Avatar = ({ label, img, selected, force }: { label: string; img: string; selected?: boolean; force?: string }) => (
  <button className="vx-avatar-tile" aria-label={label} aria-pressed={selected ? true : undefined} data-force={force}>
    <img alt="" src={art(img)} />
    {selected ? <span className="vx-check-badge" aria-hidden="true"><Check {...sw(3)} /></span> : null}
  </button>
);

/* Pink / blue letter avatars are profile colours (data), as drawn on the sheets. */
const PINK = "#C24E6B";
const BLUE = "#3E6B8F";

register("CmpPhone2", {
  "Poster · art": () => box(111, <Card kind="poster" img="9f0f26dbf0d6f122f12044701c5f3ac0.jpg" title="The End of Oak Street" meta="2026" />),
  "Poster · missing art": () => box(111, <Card kind="poster" missing title="Tony" meta="2026" />),
  "Continue card · default": () => (
    <a href="#" className="vx-continue-card" aria-label="Resume Mayday">
      <img className="vx-continue-card__thumb" alt="" src={art("c484b92ba8052ae5c295f21965fb27d8.jpg")} />
      <span className="vx-continue-card__body"><span className="vx-continue-card__title">Mayday</span><span className="vx-continue-card__meta">2026 · 42 min left</span><Progress value={58} /></span>
      <span className="vx-continue-card__play" aria-hidden="true"><PlayIcon /></span>
    </a>
  ),
  "Continue card · pressed": () => (
    <a href="#" className="vx-continue-card" aria-label="Resume Mayday" data-force="active">
      <img className="vx-continue-card__thumb" alt="" src={art("c484b92ba8052ae5c295f21965fb27d8.jpg")} />
      <span className="vx-continue-card__body"><span className="vx-continue-card__title">Mayday</span><span className="vx-continue-card__meta">2026 · 42 min left</span><Progress value={58} /></span>
      <span className="vx-continue-card__play" aria-hidden="true"><PlayIcon /></span>
    </a>
  ),
  "Live-now card": () => (
    <a href="#" className="vx-live-card">
      <span className="vx-live-label"><span className="vx-live-dot" />Live</span>
      <span className="vx-live-card__title">Cartoon Network</span><span className="vx-live-card__sub">West</span>
      <Progress value={40} small />
    </a>
  ),
  "Channel row · default": () => box(390, (
    <a href="#" className="vx-channel-row">
      <span className="vx-monogram">CNBC</span>
      <span className="vx-channel-row__body"><span className="vx-channel-row__channel">CNBC</span><span className="vx-channel-row__title">Squawk on the Street</span><Progress value={52} small /><span className="vx-channel-row__next">Next 12:00 · Halftime Report</span></span>
    </a>
  )),
  "Channel row · pressed": () => box(390, (
    <a href="#" className="vx-channel-row" data-force="active">
      <span className="vx-monogram">CNN</span>
      <span className="vx-channel-row__body"><span className="vx-channel-row__channel">CNN</span><span className="vx-channel-row__title">The Situation Room</span><Progress value={55} small /><span className="vx-channel-row__next">Next 11:00 · The Situation Room</span></span>
    </a>
  )),
  "Source row · best match": () => box(358, <SourceRow best quality="1080p" provider="LordStreams" file="The End of Oak Street - 2026 · HTTP" />),
  "Source row · default": () => box(358, <SourceRow quality="720p" provider="LucidHosting" file="The End of Oak Street (2026) · HTTP" />),
  "Source row · pressed": () => box(358, <SourceRow quality="1080p" provider="ThisIPTV" file="The End of Oak Street (2026) · HTTP" force="active" />),
  "Source row · opening": () => box(358, <SourceRow best opening quality="1080p" provider="LordStreams" file="The End of Oak Street - 2026 · HTTP" />),
  "Profile tile · image / letter": () => <><Profile name="vynxc" img="5112cc304140378385555c10e98d120d.png" /><Profile name="cedes" letter="C" color={PINK} lock /></>,
  "Profile tile · initials / pressed": () => <><Profile name="Wasim Ahmed" letter="WA" color={BLUE} /><Profile name="zayne" img="e12f8d0854be9217fda190bd7a21aebd.png" force="active" /></>,
  "Add profile · default / disabled (12)": () => <><AddProfile /><AddProfile disabled /></>,
  "Avatar tile · default / selected": () => <><Avatar label="Clay friends 1" img="b0a307f45987901042e337adf2fae4d1.png" /><Avatar label="Clay friends 2" img="9c5e2c21242c7637e916118765c1d42c.png" selected /></>,
  "Missing-art placeholder": () => (
    <span className="vx-missing-art" style={{ "--vx-card-w": "var(--viptv-size-tile-phone-poster-width)", "--vx-card-h": "var(--viptv-size-tile-phone-poster-height)", "--vx-card-r": "var(--viptv-radius-xl)" } as CSSProperties}>
      <Film {...sw(1.8)} /><span className="vx-missing-art__title">[Title]</span>
    </span>
  ),
});

register("CmpDesk2", {
  "Poster · default": () => <Card kind="poster" img="c5e059aaab8694dc24d6eac5443251d7.jpg" title="The End of Oak Street" meta="2026 · 100 min · Action" />,
  "Poster · hover": () => <Card kind="poster" img="583431e4f79c9c282528008fe0dc55d1.jpg" title="Mayday" meta="2026 · 111 min · Action" actions force="hover" />,
  "Poster · keyboard focus": () => <Card kind="poster" img="b3223e2a084e414007a98927d4dacb2a.jpg" title="The Whisper Man" meta="2026 · 111 min · Crime" force="focus focus-visible" />,
  "Poster · missing art": () => <Card kind="poster" missing title="Naruto" meta="2017 · Adventure" />,
  /* The web build sizes posters itself (data-platform="html5"); the desktop sheet shows it explicitly. */
  "Web poster 164 × 246": () => <Card kind="poster" img="4ad1cd0344ed6671f51e0752cec8f76a.jpg" title="In the Grey" meta="2026" style={{ "--vx-card-w": "var(--viptv-size-tile-web-poster-width)", "--vx-card-h": "var(--viptv-size-tile-web-poster-height)" } as CSSProperties} />,
  "Continue · default": () => <Card kind="continue" img="16264432fcbd259fc7111f7086159713.jpg" title="One Night Only" meta="Resume from 73:46" progress={72} />,
  "Continue · hover": () => <Card kind="continue" img="463bf3075bed1524ceb8b056491022f6.jpg" title="Lanterns" meta="S1 E1 · Pilot · 5:43" progress={9} play force="hover" />,
  "Continue · keyboard focus": () => <Card kind="continue" img="c0392e6fa705c5eeaf617bbb8135a263.jpg" title="Dune" meta="Resume from 5:32" progress={4} play force="focus focus-visible" />,
  "Continue · pressed": () => <Card kind="continue" img="3cae2e002204a1089bd7a31d399510af.jpg" title="The Batman" meta="Resume from 156:37" progress={88} play force="active" />,
  "Episode · UP NEXT": () => (
    <a href="#" className="vx-card vx-card--episode">
      <span className="vx-card__art"><img alt="" src={art("a24352cd0caeb6b20f44f59c848d9f36.jpg")} /><span className="vx-card__badge"><span className="vx-badge vx-badge--up-next">Up next</span></span></span>
      <span className="vx-card__heading"><span className="vx-card__number">E1</span><span className="vx-card__title">Episode One</span></span>
      <span className="vx-card__synopsis">After throwing his neighbor off the stench coming from his apartment, Jeff heads to a local bar, where a…</span>
    </a>
  ),
  "Episode · hover": () => (
    <a href="#" className="vx-card vx-card--episode" data-force="hover">
      <span className="vx-card__art"><img alt="" src={art("fb7603a06a174b01bc7db86a94ef15c5.jpg")} /></span>
      <span className="vx-card__heading"><span className="vx-card__number">E2</span><span className="vx-card__title">Please Don’t Go</span></span>
      <span className="vx-card__synopsis">A young Jeff contends with troubles at home and school. Years later, his strange behavior evolves into…</span>
    </a>
  ),
  "Live tile · default / hover": () => <>
    <Card kind="live" monogram="CN" title="Cartoon Network" meta="West" badge={<span className="vx-badge vx-badge--live"><span className="vx-badge__dot" />LIVE</span>} />
    <Card kind="live" monogram="abc" title="ABC News Live" meta="News" force="hover" badge={<span className="vx-badge vx-badge--live"><span className="vx-badge__dot" />LIVE</span>} />
  </>,
  "Guide blocks": () => box(840, <>
    <button className="vx-guide-block vx-guide-block--airing" style={{ width: 200 }}><span className="vx-guide-block__time">10:30 – 11:00</span><span className="vx-guide-block__title">The Situation Room</span><span className="vx-guide-block__bar" style={{ width: "83%" }} /></button>
    <button className="vx-guide-block" style={{ width: 200 }}><span className="vx-guide-block__time">11:00 – 12:00</span><span className="vx-guide-block__title">The Situation Room</span></button>
    <button className="vx-guide-block vx-guide-block--empty" style={{ width: 200 }}><span className="vx-guide-block__time">Live channel</span><span className="vx-guide-block__title">No guide data — watch live</span></button>
    <button className="vx-guide-block vx-guide-block--airing" style={{ width: 200 }} data-force="focus focus-visible"><span className="vx-guide-block__time">10:30 – 12:00</span><span className="vx-guide-block__title">Squawk on the Street</span><span className="vx-guide-block__bar" style={{ width: "28%" }} /></button>
  </>, { gap: 12 }),
  "Source row · best match": () => box(412, <SourceRow best quality="1080p" provider="LordStreams" file="The End of Oak Street - 2026 · HTTP" />),
  "Source row · hover": () => box(412, <SourceRow quality="1080p" provider="ThisIPTV" file="The End of Oak Street (2026) · HTTP" force="hover" />),
  "Source row · focus": () => box(412, <SourceRow quality="720p" provider="LucidHosting" file="The End of Oak Street (2026) · HTTP" force="focus focus-visible" />),
  "Source row · opening": () => box(412, <SourceRow best opening quality="1080p" provider="LordStreams" file="The End of Oak Street - 2026 · HTTP" />),
  "Profile tiles": () => <>
    <Profile name="vynxc" img="5112cc304140378385555c10e98d120d.png" />
    <Profile name="zayne" img="e12f8d0854be9217fda190bd7a21aebd.png" force="hover" />
    <Profile name="cedes" letter="C" color={PINK} lock force="focus focus-visible" />
    <AddProfile />
  </>,
  "Add profile · disabled at 12": () => <AddProfile disabled />,
  "Avatar tiles · default / hover / selected / focus": () => <>
    <Avatar label="Clay friends 3" img="d4ebf3c99443613a826b04a700370765.png" />
    <Avatar label="Clay friends 4" img="80742fde57f032f70e35b356fde738b1.png" force="hover" />
    <Avatar label="Clay friends 5" img="d3a56349af3b112f295471f76d6f88dc.png" selected />
    <Avatar label="Clay friends 6" img="e5b491fb3fe46e90fbc6edb0b420992a.png" force="focus focus-visible" />
  </>,
  "Missing-art placeholder": () => (
    <span className="vx-missing-art" style={{ "--vx-card-w": "var(--viptv-size-tile-desktop-poster-width)", "--vx-card-h": "var(--viptv-size-tile-desktop-poster-height)" } as CSSProperties}>
      <Film {...sw(1.8)} /><span className="vx-missing-art__title">[Title]</span>
    </span>
  ),
});

register("CmpTv2", {
  "Still 320 × 180 · default / focused": () => <>
    <Card kind="continue" img="d1f119013660d10c200395924d2e01f1.jpg" title="Monster" meta="S1 E1 · Episode One · 0:04" progress={2} />
    <Card kind="continue" img="3da010bb588e70c5323088b2c66658fe.jpg" title="Obsession" meta="Resume from 0:16" progress={3} force="focus" />
  </>,
  "Grid 360 × 202 · default / focused": () => <>
    <Card kind="grid" img="76544c1a9368f56b12b7273fb03f0436.jpg" title="The End of Oak Street" meta="2026 · 100 min · Action" />
    <Card kind="grid" img="d40b97c615ff0818af1a9d212272c1f5.jpg" title="Mayday" meta="2026 · 111 min · Action" force="focus" />
  </>,
  "Episode 360 × 200 · WATCHING / focused": () => <>
    <a href="#" className="vx-card vx-card--episode">
      <span className="vx-card__art"><img alt="" src={art("42b16a2d66c54eeda67d0a2254679a5c.jpg")} /><span className="vx-card__badge"><span className="vx-badge vx-badge--watching">Watching</span></span><span className="vx-card__progress"><Progress value={2} /></span></span>
      <span className="vx-card__eyebrow">Episode 1</span><span className="vx-card__title">Episode One</span>
    </a>
    <a href="#" className="vx-card vx-card--episode" data-force="focus">
      <span className="vx-card__art"><img alt="" src={art("6815a976d56905fc3c84f48fce77070a.jpg")} /></span>
      <span className="vx-card__eyebrow">Episode 2</span><span className="vx-card__title">Please Don’t Go</span>
    </a>
  </>,
  "Missing art": () => <Card kind="continue" missing title="Naruto" meta="2017 · Adventure" />,
  "Guide blocks · airing / upcoming / no data / focused": () => <>
    <button className="vx-guide-block vx-guide-block--airing" style={{ width: 300 }}><span className="vx-guide-block__time">10:30 – 11:00</span><span className="vx-guide-block__title">ABC News Live</span><span className="vx-guide-block__bar" style={{ width: "83%" }} /></button>
    <button className="vx-guide-block" style={{ width: 300 }}><span className="vx-guide-block__time">11:00 – 11:30</span><span className="vx-guide-block__title">ABC News Live</span></button>
    <button className="vx-guide-block vx-guide-block--empty" style={{ width: 520 }}><span className="vx-guide-block__time">Live channel</span><span className="vx-guide-block__title">No guide data — press OK to watch live</span></button>
    <button className="vx-guide-block vx-guide-block--airing" style={{ width: 440 }} data-force="focus"><span className="vx-guide-block__time">10:30 – 12:00</span><span className="vx-guide-block__title">Squawk on the Street</span><span className="vx-guide-block__bar" style={{ width: "28%" }} /></button>
  </>,
  "Source rows · focused best / default / opening": () => <div style={{ width: 640, display: "flex", flexDirection: "column", gap: 14 }}>
    <SourceRow best quality="1080p" provider="LordStreams" file="Monster S1 E1 · HTTP" force="focus" />
    <SourceRow quality="720p" provider="LucidHosting" file="Monster S1 E1 · HTTP" />
    <SourceRow opening openingLabel="Opening stream…" quality="1080p" provider="ThisIPTV" file="Monster S1 E1 · HTTP" />
  </div>,
  "Profile tiles · focused / default / letter / add": () => <>
    <Profile name="vynxc" img="5112cc304140378385555c10e98d120d.png" force="focus" />
    <Profile name="zayne" img="e12f8d0854be9217fda190bd7a21aebd.png" />
    <Profile name="cedes" letter="C" color={PINK} lock />
    <AddProfile />
  </>,
  "Avatar tiles · default / selected / focused": () => <>
    <Avatar label="Clay friends 7" img="187684b6851bacf926b2c94ecfaededb.png" />
    <Avatar label="Clay friends 8" img="ad318b3a47b348592eaf6997ab8f967f.png" selected />
    <Avatar label="Clay friends 9" img="0f1c225c7dba6cd829f4f72c41083294.png" force="focus" />
  </>,
});

/* ---------- Timeline (player sheets) ---------- */

function Timeline({ width, force, hover, tv, seek }: { width: number; force?: string; hover?: boolean; tv?: boolean; seek?: boolean }) {
  const bar = tv ? (
    <div className="vx-timeline__bar" role="slider" tabIndex={0} aria-label="Playback position" aria-valuetext={seek ? "[16:28] of [52:10]" : "[12:48] of [52:10]"} data-force={force}>
      <span className="vx-timeline__track">
        <span className="vx-timeline__buffered" style={{ width: "34%" }} />
        {seek ? <span className="vx-timeline__seek" style={{ left: "24.5%", width: "7.1%" }} /> : null}
        <span className="vx-timeline__played" style={{ width: "24.5%" }} />
      </span>
      <span className="vx-timeline__knob" style={{ left: seek ? "31.6%" : "24.5%" }} />
      <span className="vx-timeline__bubble" style={{ left: "31.6%" }}>[16:28]</span>
    </div>
  ) : (
    <label className="vx-timeline__bar" data-force={force ? "focus-within" : undefined}>
      <span className="vx-sr-only">Playback position</span>
      <span className="vx-timeline__track"><span className="vx-timeline__buffered" style={{ width: "38%" }} /><span className="vx-timeline__played" style={{ width: "24.5%" }} /></span>
      <span className="vx-timeline__knob" style={{ left: "24.5%" }} />
      {hover ? <><span className="vx-timeline__marker" style={{ left: "61%" }} /><span className="vx-timeline__bubble" style={{ left: "61%" }}>[31:50]</span></> : null}
      <input className="vx-timeline__input" type="range" min={0} max={100} defaultValue={24.5} aria-valuetext="[12:48] of [52:10]" />
    </label>
  );
  return box(width, <div className="vx-timeline" style={{ width: "100%" }}>{bar}<div className="vx-timeline__times"><span>[12:48]</span><span>[52:10]</span></div></div>);
}

register("CmpPhone3", { "Timeline + time labels": () => <Timeline width={358} /> });
register("CmpDesk3", {
  "Timeline · hover tooltip + buffered": () => <Timeline width={700} hover />,
  "Timeline · keyboard focus": () => <Timeline width={500} force="focus focus-visible" />,
});
register("CmpTv3", {
  "Timeline · default": () => <Timeline width={1200} tv />,
  "Timeline · focused, seek preview": () => <Timeline width={1200} tv seek force="focus" />,
});
