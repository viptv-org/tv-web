/*
 * Gallery figures for the primitives owned by agent B: rows (settings group / rows, section
 * nav, TV description panel), keys (kbd hints, TV key legend), feedback (toasts, notices,
 * banner, status, empty state, loading more, skeletons, startup cover) and, in
 * figures-b-overlays.tsx, overlays. Keys are "<Sheet>:<caption>" (registry.ts); pseudo-classes
 * are forced with data-force. Wrapper widths reproduce the reference figure geometry.
 */
import type { ReactNode } from "react";
import { Bookmark, Cast, CirclePlay, CloudOff, Info, LogOut, Moon, Puzzle, Users } from "lucide-react";
import { Banner, EmptyState, InlineError, LoadingMore, Notice, Preparing, SkeletonContinue, SkeletonFeatured, SkeletonHero, SkeletonRow, SkeletonTile, StartupCover, StatusLine, Toast } from "../Feedback";
import { KbdHints, KeyLegend } from "../Keys";
import { Overlay } from "../Overlays";
import { SectionNav, SectionNavItem, SectionNavLabel, SettingsGroup, SettingsRow, SettingsRowContent, TvDescription } from "../Rows";
import { register } from "./registry";
import "./figures-b-overlays";

const sw = (w: number) => ({ strokeWidth: w });
const column = (width: number, gap: number, children: ReactNode) => <div style={{ width, display: "flex", flexDirection: "column", gap }}>{children}</div>;
/** A black video box (player notices). */
const video = (width: number, height: number, children: ReactNode) => (
  <div style={{ position: "relative", width, height, flex: "none", overflow: "hidden", background: "var(--viptv-color-bg-oled)" }}>{children}</div>
);
const dismiss = (label = "Dismiss", force?: string) => <button type="button" className="vx-toast__action" data-force={force}>{label}</button>;
const bannerCopy = "The connection was refused, so the backend is down or unreachable. Retrying every 10 seconds; this clears itself once the backend answers.";

/* ---------- Rows ---------- */
register("CmpPhone1", {
  "Settings group": () => column(358, 22, <>
    <SettingsGroup label="Playback" labelId="g-phone-playback">
      <SettingsRow icon={<CirclePlay {...sw(2)} />} title="Playback preferences" note="Audio, subtitles and quality" />
    </SettingsGroup>
    <SettingsGroup label="Account" labelId="g-phone-account">
      <SettingsRow icon={<Puzzle {...sw(2)} />} title="Addons" note="Shared by your account" />
      <SettingsRow icon={<Info {...sw(2)} />} title="About VIPTV" value="Version 0.1.0" chevron={false} />
    </SettingsGroup>
  </>),
  "Settings row · pressed / destructive": () => column(358, 0, (
    <SettingsGroup>
      <SettingsRow icon={<Users {...sw(2)} />} title="Switch profile" data-force="active" />
      <SettingsRow icon={<LogOut {...sw(2)} />} title="Sign out" danger />
    </SettingsGroup>
  )),
});

register("CmpDesk1", {
  "Settings rows · card": () => (
    <div style={{ width: 460, display: "flex" }}>
      <SettingsGroup>
        <button type="button" role="switch" aria-checked="true" className="vx-settings-row">
          <SettingsRowContent icon={<Moon {...sw(2)} />} title="OLED mode" note="Pure black background"
            end={<span className="vx-switch" aria-hidden="true" data-checked="true" />} />
        </button>
        <SettingsRow icon={<CirclePlay {...sw(2)} />} title="Playback preferences" note="Audio, subtitles and quality" data-force="hover" />
        <SettingsRow icon={<Info {...sw(2)} />} title="About VIPTV" value="Version 0.1.0" chevron={false} />
      </SettingsGroup>
    </div>
  ),
  "Settings row · focus / destructive": () => (
    <div style={{ width: 460, display: "flex" }}>
      <SettingsGroup>
        <SettingsRow icon={<Users {...sw(2)} />} title="Switch profile" data-force="focus focus-visible" />
        <SettingsRow icon={<LogOut {...sw(2)} />} title="Sign out" danger />
      </SettingsGroup>
    </div>
  ),
  "Section nav items": () => column(260, 0, (
    <SectionNav>
      <SectionNavLabel>This device</SectionNavLabel>
      <SectionNavItem href="#appearance" current icon={<Moon {...sw(2)} />}>Appearance</SectionNavItem>
      <SectionNavItem href="#cast" icon={<Cast {...sw(2)} />} data-force="hover">Watch on TV</SectionNavItem>
      <SectionNavItem href="#addons" icon={<Puzzle {...sw(2)} />} data-force="focus focus-visible">Addons</SectionNavItem>
      <SectionNavItem href="#sign-out" danger icon={<LogOut {...sw(2)} />}>Sign out</SectionNavItem>
    </SectionNav>
  )),
  "kbd hints": () => <KbdHints hints={[{ keys: ["↑", "↓"], label: "Move" }, { keys: ["Enter"], label: "Play" }, { keys: ["Esc"], label: "Close" }]} />,
});

register("CmpTv1", {
  "Settings rows · focused / default / value / destructive": () => column(700, 0, (
    <div className="vx-settings-card">
      <SettingsRow icon={<Users {...sw(2)} />} title="Switch profile" data-force="focus" />
      <SettingsRow icon={<CirclePlay {...sw(2)} />} title="Playback preferences" />
      <SettingsRow icon={<Info {...sw(2)} />} title="About VIPTV" value="Version 0.1.0" chevron={false} />
      <SettingsRow icon={<LogOut {...sw(2)} />} title="Sign out" danger />
    </div>
  )),
  "Description panel (right side)": () => column(620, 0, <TvDescription title="Maximum quality">Current: Auto</TvDescription>),
  "Key legend": () => (
    <KeyLegend items={[
      { key: "OK", label: "Select" }, { key: "◀ ▶", label: "Move" }, { key: "▲ ▼", label: "Channels" },
      { key: "☰", label: "Details" }, { key: "BACK", label: "Close" },
    ]} />
  ),
});

/* ---------- Feedback ---------- */
register("CmpPhone3", {
  "Error toast": () => <Toast kind="error" action={dismiss()}>Could not save your profile. Please try again.</Toast>,
  "Notice toast · 5 s": () => <Toast>Added to My List</Toast>,
  "Player notice pill · 4 s": () => video(330, 80, <Notice top>The stream could not seek there.</Notice>),
  "Preparing playback": () => video(250, 80, <Preparing placement="top" />),
  "Backend banner": () => (
    <Banner titleId="bb-phone" title="Can’t reach the backend" icon={<CloudOff {...sw(2)} />} meta="Backend unreachable since [9:41 PM]."
      actions={<button type="button" className="vx-btn vx-btn--small">Dismiss</button>}>{bannerCopy}</Banner>
  ),
  "Inline error": () => <InlineError>Enter a name to continue.</InlineError>,
  "Status line": () => <StatusLine>Finding sources…</StatusLine>,
  "Empty state": () => <EmptyState icon={<Bookmark {...sw(2)} />} title="Your list is empty.">Add titles with the + button.</EmptyState>,
  "Loading more": () => <LoadingMore />,
  // The reference card is content-sized (316) inside its 330 figure.
  "Skeleton · featured card": () => <div style={{ width: 330 }}><div style={{ width: 316 }}><SkeletonFeatured /></div></div>,
  "Skeleton · poster / continue": () => <><SkeletonTile /><SkeletonContinue /></>,
  "Skeleton · list row": () => <div style={{ width: 390 }}><SkeletonRow variant="phone" /></div>,
});

register("CmpDesk3", {
  "Error toast · 4 s": () => <Toast kind="error" action={dismiss()}>Could not save your profile. Please try again.</Toast>,
  "Error toast · startup": () => <Toast kind="error" action={dismiss("Try again")}>[VIPTV could not start.]</Toast>,
  "Notice toast · 5 s": () => <Toast>Added to My List</Toast>,
  "Player notice pill · 4 s": () => video(340, 80, <Notice top>The stream could not seek there.</Notice>),
  "Preparing playback": () => video(240, 80, <Preparing placement="top" />),
  "Backend banner": () => (
    <Banner titleId="bb-desk" title="Can’t reach the backend" icon={<CloudOff {...sw(2)} />} meta="Backend unreachable since [9:41 PM]."
      actions={<button type="button" className="vx-btn vx-btn--small">Dismiss</button>}>{bannerCopy}</Banner>
  ),
  "Inline error": () => <InlineError>That does not look like an addon URL.</InlineError>,
  "Status line": () => <StatusLine>Opening stream…</StatusLine>,
  "Empty state": () => (
    <EmptyState icon={<Bookmark {...sw(2)} />} title="Your list is empty."
      action={<a href="#discover" className="vx-btn vx-btn--light vx-btn--pill">Browse Discover</a>}>Add titles with the + button.</EmptyState>
  ),
  "Loading more": () => <LoadingMore>Loading more channels… [120] of [860]</LoadingMore>,
  "Skeleton · hero": () => <SkeletonHero />,
  "Skeleton · poster / continue / episode": () => <><SkeletonTile /><SkeletonTile kind="still" /><SkeletonTile kind="episode" /></>,
  "Skeleton · list row": () => <div style={{ width: 740 }}><SkeletonRow /></div>,
});

register("CmpTv3", {
  "Error toast": () => <Toast kind="error" action={dismiss("Dismiss", "focus")}>Could not save your profile. Please try again.</Toast>,
  "Notice toast": () => <Toast>Press Home on your TV remote to leave viptv.</Toast>,
  "Player notice pill": () => video(620, 120, <Notice top>The stream could not seek there.</Notice>),
  "Preparing playback panel": () => video(620, 300, <Preparing placement="center" />),
  "Backend panel": () => (
    <div style={{ position: "relative", width: 1100, height: 640, flex: "none", overflow: "hidden", background: "var(--viptv-color-bg)" }}>
      <Overlay>
        <Banner center titleId="bb-tv" title="Can’t reach the backend" icon={<CloudOff {...sw(2)} />} meta="Backend unreachable since [9:41 PM]."
          actions={<button type="button" className="vx-btn" data-force="focus">Dismiss</button>}>{bannerCopy}</Banner>
      </Overlay>
    </div>
  ),
  "Inline error / status line": () => column(560, 24, <>
    <InlineError>Incorrect PIN. Try again.</InlineError>
    <StatusLine>Finding sources…</StatusLine>
  </>),
  "Empty state": () => (
    <EmptyState icon={<Bookmark {...sw(2)} />} title="Your list is empty."
      action={<button type="button" className="vx-btn" data-force="focus">Browse Discover</button>}>Add titles with the + button.</EmptyState>
  ),
  "Loading more": () => <LoadingMore>Loading more channels… [120] of [860]</LoadingMore>,
  "Startup cover": () => (
    <div style={{ position: "relative", width: 700, height: 300, flex: "none", overflow: "hidden" }}><StartupCover /></div>
  ),
});
