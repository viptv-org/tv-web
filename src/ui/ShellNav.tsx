import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import { Bookmark, Compass, House, Search, Settings as SettingsIcon, Tv, type LucideIcon } from "lucide-react";
import type { TvProfile } from "../api";
import { TvButton } from "./remote";
import { ReadyImage } from "./RokuArtwork";
import { avatarUrl } from "./ProfileEditor";
import type { Screen } from "./screens";

/*
 * App chrome navigation (shell family): the TV rail that expands into the
 * labelled menu, the desktop / web rail and the phone's floating bottom nav.
 * Reference screens: TvHome / TvMenu (TV), DeskHome / WebHome / WideHome /
 * DeskSettings (desktop app and web), Main / Discover / Library (phone), and
 * the navigation sections of CmpTv2 / CmpDesk2 / CmpPhone2.
 *
 * Every destination keeps its `nav-<Screen>` focus id and its full
 * destination name as the accessible name ("Live TV" where the rail draws
 * "Live"), so remote focus restoration, the preview harness and the e2e
 * suite address the same controls on every platform.
 */

export type NavDestination = "Home" | "Discover" | "Live TV" | "My List" | "Search" | "Settings";

const DESTINATIONS: readonly NavDestination[] = ["Home", "Discover", "Live TV", "My List", "Search", "Settings"];

export const isNavDestination = (screen: Screen): screen is NavDestination =>
  (DESTINATIONS as readonly string[]).includes(screen);

const ICONS: Record<NavDestination, LucideIcon> = {
  Home: House,
  Discover: Compass,
  "Live TV": Tv,
  "My List": Bookmark,
  Search,
  Settings: SettingsIcon,
};

/** The label drawn under / beside an icon; the accessible name stays the destination. */
const LABELS: Record<NavDestination, string> = {
  Home: "Home",
  Discover: "Discover",
  "Live TV": "Live",
  "My List": "My List",
  Search: "Search",
  Settings: "Settings",
};

/** The Watch on TV glyph (a remote), drawn as in the reference rail's "On TV" item. */
export function RemoteControlIcon({ className, size = 24, strokeWidth = 2 }: { className?: string; size?: number; strokeWidth?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="7" y="2" width="10" height="20" rx="3" />
      <circle cx="12" cy="8" r="2" />
      <path d="M12 14h.01" />
      <path d="M12 17h.01" />
    </svg>
  );
}

const initialOf = (profile?: TvProfile) => profile?.name.trim().slice(0, 1).toUpperCase() ?? "";

/** A profile's picture over its initial (the initial shows until, or unless, the image loads). */
function ProfilePicture({ profile, className }: { profile?: TvProfile; className: string }) {
  return (
    <span className={className} aria-hidden="true">
      <span className="vx-shell-initial">{initialOf(profile)}</span>
      {profile && <ReadyImage src={avatarUrl(profile)} alt="" />}
    </span>
  );
}

interface NavProps {
  /** The rail item drawn as current: the screen, or the section a detail page was opened from. */
  current?: NavDestination;
  onNavigate: (destination: NavDestination) => void;
}

/* ------------------------------------------------------------------------ */
/* TV: 144 icon rail, expands to the 520 labelled menu while it holds focus. */
/* ------------------------------------------------------------------------ */

const TV_ITEMS: readonly NavDestination[] = ["Search", "Home", "Discover", "Live TV", "My List"];

/**
 * TV rail. Focus inside it expands the labelled menu over a 0.55 scrim
 * (pure CSS :focus-within, so remote focus alone drives it). Entering the
 * rail with the D-pad lands on the current destination (data-focus-entry);
 * Right leaves it for the content element that last held focus.
 */
export function TvRail({
  current,
  profile,
  onNavigate,
  onProfiles,
  onExit,
}: NavProps & {
  profile?: TvProfile;
  onProfiles: () => void;
  /** Move focus back into the page content; false when the page has nothing focusable. */
  onExit: () => boolean;
}) {
  const order: readonly string[] = ["nav-profiles", ...TV_ITEMS.map(value => `nav-${value}`), "nav-Settings"];
  const item = (destination: NavDestination) => {
    const index = order.indexOf(`nav-${destination}`);
    const Icon = ICONS[destination];
    const isCurrent = destination === current;
    return (
      <TvButton
        id={`nav-${destination}`}
        key={destination}
        data-nav-up={order[Math.max(0, index - 1)]}
        data-nav-down={order[Math.min(order.length - 1, index + 1)]}
        data-nav-left={`nav-${destination}`}
        aria-label={destination}
        aria-current={isCurrent ? "page" : undefined}
        className={`vx-tv-rail-item vx-tv-focus-fill vx-tv-focus-row ${isCurrent ? "is-current" : ""}`}
        onActivate={() => onNavigate(destination)}
      >
        <Icon className="vx-tv-rail-icon" size={28} strokeWidth={isCurrent ? 2 : 1.8} aria-hidden="true" />
        <span className="vx-tv-rail-label">{destination}</span>
        {isCurrent && <span className="vx-tv-rail-dot" aria-hidden="true" />}
      </TvButton>
    );
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // Right (or the remote's Back, handled by the shell) returns to the content.
    if (event.key !== "ArrowRight") return;
    if (onExit()) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  return (
    <>
      <nav
        className="vx-tv-rail"
        aria-label="Main navigation"
        data-focus-entry={current ? `nav-${current}` : undefined}
        onKeyDown={onKeyDown}
      >
        <TvButton
          id="nav-profiles"
          data-nav-up="nav-profiles"
          data-nav-down={order[1]}
          data-nav-left="nav-profiles"
          aria-label="Profile"
          className="vx-tv-rail-profile vx-tv-focus-fill vx-tv-focus-row"
          onActivate={onProfiles}
        >
          <ProfilePicture profile={profile} className="vx-tv-rail-avatar" />
          <span className="vx-tv-rail-who">
            <span className="vx-tv-rail-name viptv-type-tv-label">{profile?.name}</span>
            <span className="vx-tv-rail-switch viptv-type-tv-min">Switch profile</span>
          </span>
        </TvButton>
        <div className="vx-tv-rail-items">
          {TV_ITEMS.map(item)}
          <span className="vx-shell-spacer" aria-hidden="true" />
          {item("Settings")}
        </div>
      </nav>
      <div className="vx-tv-rail-scrim" aria-hidden="true" />
    </>
  );
}

const focusable = (element: HTMLElement) => {
  if ((element as HTMLButtonElement).disabled || element.closest("[hidden], [aria-hidden='true']")) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

/**
 * TV rail focus behaviour, owned by the shell:
 * - remembers the page control that last held focus, so Right / Back from
 *   the rail return to it (Roku contract: "Right or Back from the rail
 *   returns focus to its content");
 * - after a destination is chosen, moves focus from its rail item into the
 *   new page once the page has a focusable control (the menu collapses);
 *   any key press cancels this, so focus never jumps after the person moves.
 */
export function useTvRail(enabled: boolean, screen: Screen) {
  const lastContent = useRef<HTMLElement>();
  useEffect(() => {
    if (!enabled) return;
    const remember = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.dataset?.focusId && !target.closest(".vx-tv-rail")) lastContent.current = target;
    };
    document.addEventListener("focusin", remember);
    return () => document.removeEventListener("focusin", remember);
  }, [enabled]);

  /** Focus the page: the remembered control, else the one nearest the rail item. */
  const enterContent = useCallback((): boolean => {
    // A dialog, editor or text entry owns focus while it is open.
    if (document.querySelector("[data-focus-scope]")) return false;
    const remembered = lastContent.current;
    if (remembered?.isConnected && focusable(remembered)) {
      remembered.focus({ preventScroll: true });
      return true;
    }
    const origin = (document.activeElement as HTMLElement | null)?.closest(".vx-tv-rail")
      ? (document.activeElement as HTMLElement).getBoundingClientRect()
      : undefined;
    const originY = origin ? origin.top + origin.height / 2 : 0;
    let best: HTMLElement | undefined;
    let score = Infinity;
    for (const candidate of document.querySelectorAll<HTMLElement>(".tv-screen [data-focus-id]")) {
      if (candidate.closest(".vx-tv-rail") || !focusable(candidate)) continue;
      const rect = candidate.getBoundingClientRect();
      // Nearest to the rail, as a D-pad Right from it would measure (ahead + 3 × cross).
      const next = rect.left + rect.width / 2 + 3 * Math.abs(rect.top + rect.height / 2 - originY);
      if (next < score) {
        score = next;
        best = candidate;
      }
    }
    best?.focus({ preventScroll: true });
    return !!best;
  }, []);

  /** Back / Right while the rail holds focus: return to the page. */
  const exit = useCallback(() => {
    if (!enabled || !(document.activeElement as HTMLElement | null)?.closest(".vx-tv-rail")) return false;
    return enterContent();
  }, [enabled, enterContent]);

  useEffect(() => {
    if (!enabled || !isNavDestination(screen)) return;
    const railItem = `nav-${screen}`;
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    window.addEventListener("keydown", cancel, true);
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      if (cancelled) return;
      // Only while focus still rests on the destination's rail item: a page
      // that focuses itself (Settings, the guide) or a restored Back focus wins.
      if ((document.activeElement as HTMLElement | null)?.dataset.focusId !== railItem) return;
      if (enterContent()) return;
      if (Date.now() - started < 6000) timer = setTimeout(tick, 100);
    };
    timer = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("keydown", cancel, true);
    };
  }, [enabled, screen, enterContent]);

  return { exit };
}

/* ------------------------------------------------------------------------ */
/* Desktop app and web: the 84 rail.                                        */
/* ------------------------------------------------------------------------ */

/**
 * Desktop / web rail: Home, Discover, Live, My List (+ Search on the web,
 * where there is no title bar), then On TV (lit while Watch on TV is open),
 * Settings and the profile avatar at the bottom.
 */
export function DesktopRail({
  current,
  onNavigate,
  withSearch,
  casting,
  onCast,
  profile,
  onProfiles,
  skeleton = false,
}: NavProps & {
  withSearch: boolean;
  casting: boolean;
  onCast: () => void;
  profile?: TvProfile;
  onProfiles: () => void;
  /** Drawn inert behind the loading skeleton (no focus, hidden from assistive technology). */
  skeleton?: boolean;
}) {
  const top: NavDestination[] = ["Home", "Discover", "Live TV", "My List", ...(withSearch ? ["Search" as const] : [])];
  const inert = skeleton ? { tabIndex: -1 } : {};
  const item = (destination: NavDestination) => {
    const Icon = ICONS[destination];
    const isCurrent = destination === current;
    return (
      <TvButton
        id={skeleton ? `skeleton-nav-${destination}` : `nav-${destination}`}
        key={destination}
        aria-label={destination}
        aria-current={isCurrent ? "page" : undefined}
        className={`vx-rail-item ${isCurrent ? "is-current" : ""}`}
        onActivate={() => onNavigate(destination)}
        {...inert}
      >
        <Icon className="vx-rail-icon" size={21} strokeWidth={isCurrent ? 2.1 : 1.9} aria-hidden="true" />
        <span className="vx-rail-label viptv-type-desktop-rail-label">{LABELS[destination]}</span>
      </TvButton>
    );
  };
  return (
    <nav
      className={`vx-rail ${skeleton ? "is-skeleton" : ""}`}
      aria-label={skeleton ? undefined : "Main navigation"}
      aria-hidden={skeleton || undefined}
    >
      {top.map(item)}
      <span className="vx-shell-spacer" aria-hidden="true" />
      <TvButton
        id={skeleton ? "skeleton-responsive-cast" : "responsive-cast"}
        aria-label="Watch on TV"
        aria-haspopup="dialog"
        aria-expanded={casting}
        className={`vx-rail-item ${casting ? "is-current" : ""}`}
        onActivate={onCast}
        {...inert}
      >
        <RemoteControlIcon className="vx-rail-icon" size={21} strokeWidth={casting ? 2.1 : 1.9} />
        <span className="vx-rail-label viptv-type-desktop-rail-label">On TV</span>
      </TvButton>
      {item("Settings")}
      {(profile || skeleton) && (
        <TvButton
          id={skeleton ? "skeleton-responsive-profile" : "responsive-profile"}
          className="vx-rail-avatar"
          aria-label={profile ? `Switch profile (${profile.name})` : "Switch profile"}
          title={profile?.name}
          onActivate={onProfiles}
          {...inert}
        >
          <ProfilePicture profile={profile} className="vx-rail-avatar-art viptv-type-desktop-label" />
        </TvButton>
      )}
    </nav>
  );
}

/* ------------------------------------------------------------------------ */
/* Phone: floating glass bottom nav + separate round Search button.         */
/* ------------------------------------------------------------------------ */

const PHONE_TABS: readonly NavDestination[] = ["Home", "Discover", "Live TV", "My List"];

/** Phone bottom nav, shown on tab screens only, over a 150 px fade. */
export function PhoneNav({ current, onNavigate, skeleton = false }: NavProps & { skeleton?: boolean }) {
  const inert = skeleton ? { tabIndex: -1 } : {};
  return (
    <>
      <div className="vx-phone-nav-fade" aria-hidden="true" />
      <nav
        className={`vx-phone-nav ${skeleton ? "is-skeleton" : ""}`}
        aria-label={skeleton ? undefined : "Main navigation"}
        aria-hidden={skeleton || undefined}
      >
        <div className="vx-phone-nav-bar">
          {PHONE_TABS.map((destination) => {
            const Icon = ICONS[destination];
            const isCurrent = destination === current;
            return (
              <TvButton
                id={skeleton ? `skeleton-nav-${destination}` : `nav-${destination}`}
                key={destination}
                aria-label={destination}
                aria-current={isCurrent ? "page" : undefined}
                className={`vx-phone-nav-tab ${isCurrent ? "is-current" : ""}`}
                onActivate={() => onNavigate(destination)}
                {...inert}
              >
                <Icon size={21} strokeWidth={isCurrent ? 2.2 : 2} aria-hidden="true" />
                <span className="viptv-type-phone-nav-label">{LABELS[destination]}</span>
              </TvButton>
            );
          })}
        </div>
        <TvButton
          id={skeleton ? "skeleton-nav-Search" : "nav-Search"}
          aria-label="Search"
          aria-current={current === "Search" ? "page" : undefined}
          className="vx-phone-nav-search"
          onActivate={() => onNavigate("Search")}
          {...inert}
        >
          <Search size={24} strokeWidth={2.2} aria-hidden="true" />
        </TvButton>
      </nav>
    </>
  );
}
