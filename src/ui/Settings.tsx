/*
 * Settings (design references: Settings / DeskSettings / TvSettings, Ph|Desk|TvPlayback,
 * PhPlaybackChoice, TvPlaybackChoice, DeskEngine, Ph|Desk|TvAddons, Addon Install / Manage /
 * Remove, Ph|Desk|TvSignOut). Three arrangements of one row model:
 *   phone   grouped cards (list, phone width) with sub-pages and bottom sheets
 *   desktop left section nav (Profile, Playback, This device, Account) + pane, centred dialogs,
 *           anchored popovers for the engine and accent choices
 *   TV      80-tall rows + description panel on the right, right-panel dialogs, key legend
 * Styles: src/styles/screens/settings.css (+ the rows / toggles / overlays primitives).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Captions,
  Cast,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CirclePlay,
  Cpu,
  Gauge,
  Info,
  Languages,
  LogOut,
  Moon,
  Palette,
  Plus,
  Puzzle,
  Server,
  SwatchBook,
  Trash2,
  Type,
  User,
  Users,
} from "lucide-react";
import type { NativeVideoEngine } from "@viptv/video";
import { TvApi, type JsonObject, type PlaybackPreferences, type TvProfile } from "../api";
import { ENGINE_CHOICES } from "./enginePreference";
import { TextEntry } from "./TextEntry";
import { TvButton, focusElement } from "./remote";
import { usePhoneLayout } from "./usePhoneLayout";
import { avatarUrl } from "./ProfileEditor";
import { ReadyImage } from "./RokuArtwork";
import { ACCENTS, useAppearance, type Accent } from "../theme/appearance";
import { SettingsRowContent, TvDescription } from "./primitives/Rows";
import { ChoiceContent, SwitchIndicator } from "./primitives/Toggles";
import { Dialog, DialogText, MenuItemContent } from "./primitives/Overlays";
import { ButtonContent, buttonClass } from "./primitives/Button";
import { TextField } from "./primitives/Fields";
import { KeyLegend } from "./primitives/Keys";
import { SettingsLayer, isBackKey } from "./SettingsOverlay";
import packageInfo from "../../package.json";

type Page = "Settings" | "Playback preferences" | "Addons";
/** Desktop panes of the root page (the sub-pages have their own). */
type RootPane = "Appearance" | "About VIPTV";
type Group = "Profile" | "Playback" | "This device" | "Account";

type Row = {
  id: string;
  title: string;
  icon: ReactNode;
  action: () => void;
  /** Phone / desktop secondary line. */
  note?: string;
  /** TV secondary line (Install addon). */
  tvNote?: string;
  /** Trailing current value. */
  value?: string;
  /** TV description panel: the text under the title. */
  description: string;
  group?: Group;
  /** On/off state rendered as a switch (no chevron). */
  toggle?: boolean;
  /** Informational row (About on phone): no chevron, nothing to open. */
  info?: boolean;
  danger?: boolean;
  /** Accent swatch before the value. */
  swatch?: Accent;
};

type Option = { label: string; current: boolean; pick: () => void; swatch?: Accent };
type Overlay =
  | { kind: "choice"; title: string; options: Option[]; from: string; popover?: boolean }
  | { kind: "manage"; addon: JsonObject; from: string }
  | { kind: "remove"; addon: JsonObject; from: string }
  | { kind: "signout" }
  | { kind: "install" };

const LIST_GROUPS: readonly Group[] = ["Profile", "Playback", "This device", "Account"];
const TV_ROOT_ORDER = ["settings-profiles", "settings-playback", "settings-manage", "settings-addons", "settings-about"];
const PAGE_CAPTION: Record<Page, string> = {
  Settings: "",
  "Playback preferences": "Applies to your next playback. Manual track choices take priority.",
  Addons: "Shared by all profiles and devices on your account.",
};
const ACCENT_LABEL: Record<Accent, string> = { gold: "Gold", coral: "Coral", mint: "Mint", periwinkle: "Periwinkle" };
const languages: readonly [string, string][] = [
  ["System default", ""],
  ["English", "en"],
  ["Spanish", "es"],
  ["French", "fr"],
  ["German", "de"],
  ["Italian", "it"],
  ["Portuguese", "pt"],
  ["Japanese", "ja"],
  ["Korean", "ko"],
  ["Chinese", "zh"],
  ["Hindi", "hi"],
  ["Arabic", "ar"],
];
const languageName = (value: string) => languages.find(([, code]) => code === value)?.[0] ?? value;
const engineLabel = (engine: NativeVideoEngine) => (engine === "auto" ? "Auto" : engine);
const addonName = (addon: JsonObject) => String(addon.name ?? "Addon");

/** Copy for manifest URL problems (copy.md → Errors). */
export function checkManifestUrl(text: string): string {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    throw new Error("That does not look like an addon URL.");
  }
  if (url.protocol !== "https:") throw new Error("Enter an HTTPS manifest URL.");
  return url.href;
}

const Swatch = ({ accent }: { accent: Accent }) => (
  <span className={`vx-settings-swatch vx-settings-swatch--${accent}`} aria-hidden="true" />
);

export function Settings({
  api,
  profile,
  prefs,
  onPrefs,
  onProfiles,
  onManageProfiles = onProfiles,
  onSignOut,
  onError,
  serverOrigin = "https://viptv.syek.tech",
  appearance,
  playbackEngine,
  subpage,
  onSubpageChange,
  onBack,
  list = false,
  onWatchOnTv,
  profiles,
  onChooseProfile,
}: {
  api: TvApi;
  profile: string;
  prefs: PlaybackPreferences;
  onPrefs: (p: PlaybackPreferences) => void;
  onProfiles: () => void;
  onManageProfiles?: () => void;
  /** The confirmed sign-out (Settings asks "Sign out of this device?" first). */
  onSignOut: () => void;
  onError: (e: unknown) => void;
  serverOrigin?: string;
  /** Device appearance (OLED + accent colour): phone / desktop only. */
  appearance?: { oled: boolean; toggle: () => void };
  playbackEngine?: { choice: NativeVideoEngine; select: (engine: NativeVideoEngine) => void };
  subpage?: Page;
  onSubpageChange?: (p: Page) => void;
  onBack?: () => void;
  /** Pointer/touch arrangement (phone list or desktop section nav). */
  list?: boolean;
  /** Opens the Watch on TV controller. */
  onWatchOnTv?: () => void;
  /** TV: the "Switch profile" panel lists the profiles to pick from directly. */
  profiles?: readonly TvProfile[];
  onChooseProfile?: (id: string) => void;
}) {
  const phone = usePhoneLayout(list);
  const desktop = list && !phone;
  const { accent, setAccent } = useAppearance();
  const [addons, setAddons] = useState<readonly JsonObject[]>([]);
  const [internalPage, setInternalPage] = useState<Page>("Settings");
  const page = subpage !== undefined ? subpage : internalPage;
  const setPage = (next: Page) => {
    if (subpage === undefined) setInternalPage(next);
    onSubpageChange?.(next);
  };
  const [rootPane, setRootPane] = useState<RootPane>("Appearance");
  const [selected, setSelected] = useState(0);
  const [entry, setEntry] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const version = packageInfo.version;

  useEffect(() => {
    const scope = api.createScope();
    void api
      .addons({ signal: scope.signal })
      .then(setAddons)
      .catch((e) => {
        if (!scope.signal.aborted) onError(e);
      });
    return () => scope.abort();
  }, [api]);
  // A page change (Back, the browser, the section nav) closes whatever was open over it.
  useEffect(() => setOverlay(undefined), [page]);

  const openPage = (next: Page) => {
    setSelected(0);
    setPage(next);
  };
  const close = () => setOverlay(undefined);
  const save = (value: Partial<PlaybackPreferences>) =>
    void api.savePreferences(profile, value).then(onPrefs).catch(onError);
  const refreshAddons = (request: Promise<unknown>) =>
    void request
      .then(() => api.addons())
      .then(setAddons)
      .catch(onError);
  const openChoice = (
    from: string,
    title: string,
    options: Option[],
    popover = false,
  ) => {
    // The popover hangs from its row (looked up by id: WebKit does not focus clicked buttons).
    setAnchor(popover ? Array.from(document.querySelectorAll<HTMLElement>("[data-focus-id]")).find((element) => element.dataset.focusId === from) ?? null : null);
    setOverlay({ kind: "choice", title, options, from, popover });
  };
  const choose = (
    from: string,
    title: string,
    key: keyof PlaybackPreferences,
    values: readonly [string, string | boolean][],
  ) =>
    openChoice(
      from,
      title,
      values.map(([label, value]) => ({
        label,
        current: prefs[key] === value,
        pick: () => {
          close();
          save({ [key]: value });
        },
      })),
    );

  const engineRow: Row | undefined = playbackEngine && {
    id: "settings-engine",
    title: "Playback engine",
    icon: <Cpu />,
    note: "Stored on this device",
    value: engineLabel(playbackEngine.choice),
    description: "The native engine that decodes video. Auto uses the app's preferred engine for this device.",
    action: () =>
      openChoice(
        "settings-engine",
        "Playback engine",
        ENGINE_CHOICES.map((engine) => ({
          label: engineLabel(engine),
          current: playbackEngine.choice === engine,
          pick: () => {
            close();
            playbackEngine.select(engine);
          },
        })),
        desktop,
      ),
  };
  const accentChoice = () =>
    openChoice(
      "settings-accent",
      "Accent colour",
      ACCENTS.map((value) => ({
        label: ACCENT_LABEL[value],
        swatch: value,
        current: accent === value,
        pick: () => {
          close();
          setAccent(value);
        },
      })),
      desktop,
    );

  const rootRows: Row[] = [
    {
      id: "settings-profiles",
      title: "Switch profile",
      icon: <Users />,
      description: profiles?.length && onChooseProfile ? "Choose who’s watching. Press ▶ to pick from here." : "Choose who’s watching.",
      action: onProfiles,
      group: "Profile",
    },
    {
      id: "settings-manage",
      title: "Manage profiles",
      icon: <User />,
      note: "Add, rename or delete profiles",
      description: "Add, rename, choose avatars or delete profiles.",
      action: onManageProfiles,
      group: "Profile",
    },
    {
      id: "settings-playback",
      title: "Playback preferences",
      icon: <CirclePlay />,
      note: "Audio, subtitles and quality",
      description: "Audio, subtitles and quality for this profile.",
      action: () => openPage("Playback preferences"),
      group: "Playback",
    },
    ...(appearance
      ? [
          {
            id: "settings-oled",
            title: "OLED mode",
            icon: <Moon />,
            note: "Pure black background",
            description: "Use a pure black background on this device. Your profile and playback settings stay the same.",
            action: appearance.toggle,
            group: "This device",
            toggle: appearance.oled,
          } satisfies Row,
          {
            id: "settings-accent",
            title: "Accent colour",
            icon: <SwatchBook />,
            note: "Buttons and highlights",
            value: ACCENT_LABEL[accent],
            swatch: accent,
            description: "The colour of the main button, progress bars and highlights on this device.",
            action: accentChoice,
            group: "This device",
          } satisfies Row,
        ]
      : []),
    ...(onWatchOnTv
      ? [
          {
            id: "settings-watch-on-tv",
            title: "Watch on TV",
            icon: <Cast />,
            note: "Open VIPTV on a television",
            description: "Open VIPTV on a television.",
            action: onWatchOnTv,
            group: "This device",
          } satisfies Row,
        ]
      : []),
    {
      id: "settings-addons",
      title: "Addons",
      icon: <Puzzle />,
      note: "Shared by your account",
      description: "Manage addons shared by your account.",
      action: () => openPage("Addons"),
      group: "Account",
    },
    {
      id: "settings-about",
      title: "About VIPTV",
      icon: <Info />,
      value: `Version ${version}`,
      description: `Version ${version}\n${serverOrigin}`,
      action: () => (desktop ? setRootPane("About VIPTV") : undefined),
      group: "Account",
      info: !desktop,
    },
  ];
  const signOutRow: Row = {
    id: "signout",
    title: "Sign out",
    icon: <LogOut />,
    description: list ? "Sign out of VIPTV on this device." : "Sign out of VIPTV on this TV.",
    action: () => setOverlay({ kind: "signout" }),
    danger: true,
  };
  const playbackRows: Row[] = [
    {
      id: "audio-language",
      title: "Preferred audio",
      icon: <Languages />,
      value: languageName(prefs.audioLanguage),
      description: "",
      action: () => choose("audio-language", "Preferred audio", "audioLanguage", languages),
    },
    {
      id: "subtitle-language",
      title: "Preferred subtitles",
      icon: <Captions />,
      value: languageName(prefs.subtitleLanguage),
      description: "",
      action: () => choose("subtitle-language", "Preferred subtitles", "subtitleLanguage", languages),
    },
    {
      id: "setting-subtitlesEnabled",
      title: "Start with subtitles",
      icon: <Captions />,
      value: prefs.subtitlesEnabled ? "On" : "Off",
      description: "",
      action: () =>
        choose("setting-subtitlesEnabled", "Start with subtitles", "subtitlesEnabled", [
          ["On", true],
          ["Off", false],
        ]),
    },
    {
      id: "subtitle-size",
      title: "Subtitle size",
      icon: <Type />,
      value: prefs.subtitleSize === "normal" ? "System default" : prefs.subtitleSize === "small" ? "Small" : "Large",
      description: "",
      action: () =>
        choose("subtitle-size", "Subtitle size", "subtitleSize", [
          ["Small", "small"],
          ["System default", "normal"],
          ["Large", "large"],
        ]),
    },
    {
      id: "subtitle-style",
      title: "Subtitle appearance",
      icon: <Palette />,
      value:
        prefs.subtitleStyle === "shadow"
          ? "Text with shadow"
          : prefs.subtitleStyle === "opaque"
            ? "White text on black"
            : "System default",
      description: "",
      action: () =>
        choose("subtitle-style", "Subtitle appearance", "subtitleStyle", [
          ["System default", "system"],
          ["Text with shadow", "shadow"],
          ["White text on black", "opaque"],
        ]),
    },
    {
      id: "quality",
      title: "Maximum quality",
      icon: <Gauge />,
      value: prefs.quality === "auto" ? "Auto" : prefs.quality,
      description: "",
      action: () =>
        choose("quality", "Maximum quality", "quality", [
          ["Auto", "auto"],
          ["1080p", "1080p"],
          ["720p", "720p"],
          ["480p", "480p"],
        ]),
    },
  ].map((row) => ({ ...row, description: `Current: ${row.value}` }));
  const addonRows: Row[] = [
    {
      id: "addon-add",
      title: "Install addon",
      icon: <Plus />,
      note: "Enter a Stremio manifest URL",
      tvNote: "Enter a Stremio manifest URL",
      description: "Enter a Stremio manifest URL.",
      action: () => (list ? setOverlay({ kind: "install" }) : setEntry(true)),
    },
    ...addons.map((addon, index): Row => {
      const state = addon.enabled === false ? "Disabled" : "Enabled";
      const from = `addon-${index}`;
      return {
        id: from,
        title: addonName(addon),
        icon: <Puzzle />,
        value: state,
        description: state,
        action: () => setOverlay({ kind: "manage", addon, from }),
      };
    }),
  ];
  const tvRootRows = [...TV_ROOT_ORDER.map((id) => rootRows.find((row) => row.id === id)!), signOutRow];
  const rows: Row[] =
    page === "Settings"
      ? list
        ? [...rootRows, signOutRow]
        : tvRootRows
      : page === "Playback preferences"
        ? [...playbackRows, ...(engineRow ? [engineRow] : [])]
        : addonRows;

  useEffect(() => {
    // Touch layouts take no programmatic focus: it would only paint a
    // remote focus state on the first row.
    if (!list) focusElement(rows[0].id);
  }, [page]);

  const closeEntry = () => {
    setEntry(false);
    setTimeout(() => focusElement("addon-add"), 0);
  };
  const installAddon = async (text: string) => {
    await api.addAddon(checkManifestUrl(text));
    setAddons(await api.addons());
  };
  const entryPortal =
    entry &&
    createPortal(
      <TextEntry
        title="Install addon manifest URL"
        initialValue="https://"
        onCancel={closeEntry}
        onSubmit={async (text) => {
          await installAddon(text);
          closeEntry();
        }}
      />,
      document.querySelector(".tv-screen") ?? document.body,
    );
  const back = () => {
    if (onBack) onBack();
    else openPage("Settings");
  };

  const overlayLayer = overlay && (
    <SettingsOverlays
      overlay={overlay}
      tv={!list}
      desktop={desktop}
      anchor={anchor}
      onClose={close}
      onInstall={installAddon}
      onToggleAddon={(addon) => {
        close();
        refreshAddons(api.updateAddon(String(addon.id ?? ""), { enabled: addon.enabled === false }));
      }}
      onAskRemove={(addon, from) => setOverlay({ kind: "remove", addon, from })}
      onRemove={(addon) => {
        close();
        refreshAddons(api.deleteAddon(String(addon.id ?? "")));
      }}
      onSignOut={() => {
        close();
        onSignOut();
      }}
    />
  );

  // ---- TV: rows + description panel ------------------------------------------------------
  if (!list) {
    const focused = rows[selected] ?? rows[0];
    const tiles = page === "Settings" && focused?.id === "settings-profiles" && profiles?.length && onChooseProfile ? profiles : undefined;
    return (
      <main
        className={`vx-settings vx-settings-tv${page === "Settings" ? "" : " vx-settings-tv--sub"}`}
        onKeyDown={(event) => {
          if (!isBackKey(event) || page === "Settings") return;
          event.preventDefault();
          event.stopPropagation();
          if (onBack) onBack();
          else {
            const restore = page === "Addons" ? "settings-addons" : "settings-playback";
            openPage("Settings");
            setTimeout(() => focusElement(restore), 0);
          }
        }}
      >
        <section className="vx-settings-tv__list" aria-labelledby="settings-title">
          <h1 className="vx-settings-tv__title" id="settings-title">{page}</h1>
          <div className="vx-settings-tv__rows" role="list">
            {rows.map((row, index) => (
              <div className="vx-settings-tv__item" role="listitem" key={row.id}>
                {row.danger && page === "Settings" ? <span className="vx-settings-tv__divider" aria-hidden="true" /> : null}
                <TvButton
                  id={row.id}
                  className={`vx-settings-row${row.danger ? " vx-settings-row--danger" : ""}`}
                  onFocus={() => setSelected(index)}
                  onActivate={row.action}
                >
                  <SettingsRowContent
                    icon={row.icon}
                    title={row.title}
                    note={row.tvNote}
                    value={page === "Settings" ? undefined : row.value}
                    chevron={page === "Settings" && !row.danger}
                    danger={row.danger}
                  />
                </TvButton>
              </div>
            ))}
          </div>
        </section>
        {focused && (
          <div className="vx-settings-tv__panel">
            <TvDescription title={focused.title} className="vx-settings-tv__description">
              {focused.description}
            </TvDescription>
            {tiles && (
              <div className="vx-settings-tv__profiles" role="group" aria-label="Profiles">
                {tiles.map((entry, index) => (
                  <TvButton
                    key={entry.id}
                    id={`settings-profile-${index}`}
                    className="vx-profile vx-settings-tv__profile"
                    data-nav-left="settings-profiles"
                    aria-current={entry.id === profile ? "true" : undefined}
                    onActivate={() => onChooseProfile?.(entry.id)}
                  >
                    <span className="vx-profile__avatar">
                      <span className="vx-profile__letter">{entry.name.trim().slice(0, 1).toUpperCase()}</span>
                      <ReadyImage src={avatarUrl(entry)} alt="" />
                    </span>
                    <span className="vx-profile__name">{entry.name}</span>
                    {entry.id === profile ? <span className="vx-settings-tv__watching">Watching now</span> : null}
                  </TvButton>
                ))}
              </div>
            )}
            {page === "Settings" ? (
              <p className="vx-settings-tv__version">VIPTV {version}</p>
            ) : (
              <p className="vx-settings-tv__caption">{PAGE_CAPTION[page]}</p>
            )}
          </div>
        )}
        {!overlay && !entry && (
          <KeyLegend corner items={[{ key: "OK", label: "Select" }, { key: "BACK", label: "Back" }]} />
        )}
        {overlayLayer}
        {entryPortal}
      </main>
    );
  }

  const rowButton = (row: Row) => {
    const swatch = row.swatch ? <Swatch accent={row.swatch} /> : null;
    if (row.toggle !== undefined)
      return (
        <TvButton
          key={row.id}
          id={row.id}
          className="vx-settings-row"
          role="switch"
          aria-checked={row.toggle}
          onActivate={row.action}
        >
          <SettingsRowContent icon={row.icon} title={row.title} note={row.note} end={<SwitchIndicator checked={row.toggle} />} />
        </TvButton>
      );
    if (row.info)
      return (
        <div key={row.id} id={row.id} className="vx-settings-row vx-settings-row--info">
          <SettingsRowContent icon={row.icon} title={row.title} note={row.note} value={row.value} chevron={false} />
        </div>
      );
    return (
      <TvButton
        key={row.id}
        id={row.id}
        className={`vx-settings-row${row.danger ? " vx-settings-row--danger" : ""}`}
        aria-haspopup={row.swatch || row.id === "settings-engine" ? (desktop ? "menu" : "dialog") : undefined}
        aria-expanded={overlay?.kind === "choice" && overlay.from === row.id ? true : undefined}
        onActivate={row.action}
      >
        <SettingsRowContent icon={row.icon} title={row.title} note={row.note} value={row.value} end={swatch} chevron={!row.danger} danger={row.danger} />
      </TvButton>
    );
  };

  // ---- Phone: grouped cards, sub-pages with a back button -------------------------------
  if (phone) {
    const sections: (readonly [string, readonly Row[]])[] =
      page === "Settings"
        ? LIST_GROUPS.map((group) => [group, rootRows.filter((row) => row.group === group)] as const).filter(([, groupRows]) => groupRows.length)
        : page === "Playback preferences"
          ? [["", playbackRows], ...(engineRow ? [["This device", [engineRow]] as const] : [])]
          : [["", addonRows]];
    return (
      <main className="vx-settings vx-settings-list">
        <header className="vx-settings-list__header">
          <button
            type="button"
            className="vx-settings-list__back"
            aria-label={page === "Settings" ? "Back" : "Back to Settings"}
            onClick={back}
          >
            <ChevronLeft aria-hidden="true" strokeWidth={2.4} />
          </button>
          <h1 className="vx-settings-list__title">{page}</h1>
        </header>
        {PAGE_CAPTION[page] && <p className="vx-settings-list__caption">{PAGE_CAPTION[page]}</p>}
        <div className="vx-settings-list__groups">
          {sections.map(([group, groupRows]) => (
            <section className="vx-settings-group" key={group || "rows"} aria-label={group || undefined}>
              {group && <h2 className="vx-settings-group__label">{group}</h2>}
              <div className="vx-settings-card">{groupRows.map(rowButton)}</div>
            </section>
          ))}
          {page === "Settings" && (
            <TvButton id="signout" className="vx-settings-list__signout" onActivate={signOutRow.action}>
              <LogOut aria-hidden="true" strokeWidth={2.2} />
              Sign out
            </TvButton>
          )}
        </div>
        {overlayLayer}
      </main>
    );
  }

  // ---- Desktop / web: section nav + pane ------------------------------------------------
  const current: string =
    page === "Playback preferences" ? "settings-playback" : page === "Addons" ? "settings-addons" : rootPane === "About VIPTV" ? "settings-about" : "settings-appearance";
  const navItem = (id: string, label: string, icon: ReactNode, action: () => void) => (
    <TvButton
      key={id}
      id={id}
      className="vx-section-nav__item"
      aria-current={current === id ? "page" : undefined}
      onActivate={action}
    >
      {icon}
      {label}
    </TvButton>
  );
  const showRoot = (pane: RootPane) => {
    setRootPane(pane);
    if (page !== "Settings") openPage("Settings");
  };
  const oled = rootRows.find((row) => row.id === "settings-oled");
  const paneTitle = page === "Settings" ? rootPane : page;
  const paneCaption =
    page === "Settings"
      ? rootPane === "Appearance"
        ? "These settings apply to this device only."
        : `VIPTV on this device.`
      : PAGE_CAPTION[page];
  return (
    <main className="vx-settings vx-settings-split">
      <h1 className="vx-settings-split__title">Settings</h1>
      <div className="vx-settings-split__body">
        <nav className="vx-section-nav vx-settings-split__nav" aria-label="Settings sections">
          <span className="vx-section-nav__label">Profile</span>
          {navItem("settings-profiles", "Switch profile", <Users strokeWidth={2} />, onProfiles)}
          {navItem("settings-manage", "Manage profiles", <User strokeWidth={2} />, onManageProfiles)}
          <span className="vx-section-nav__label">Playback</span>
          {navItem("settings-playback", "Playback preferences", <CirclePlay strokeWidth={2} />, () => openPage("Playback preferences"))}
          <span className="vx-section-nav__label">This device</span>
          {appearance ? navItem("settings-appearance", "Appearance", <Moon strokeWidth={2} />, () => showRoot("Appearance")) : null}
          {onWatchOnTv ? navItem("settings-watch-on-tv", "Watch on TV", <Cast strokeWidth={2} />, onWatchOnTv) : null}
          <span className="vx-section-nav__label">Account</span>
          {navItem("settings-addons", "Addons", <Puzzle strokeWidth={2} />, () => openPage("Addons"))}
          {navItem("settings-about", "About VIPTV", <Info strokeWidth={2} />, () => showRoot("About VIPTV"))}
          <span className="vx-settings-split__spacer" aria-hidden="true" />
          <TvButton id="signout" className="vx-section-nav__item vx-section-nav__item--danger vx-settings-split__signout" onActivate={signOutRow.action}>
            <LogOut strokeWidth={2} />
            Sign out
          </TvButton>
        </nav>
        <section className="vx-settings-pane" aria-labelledby="settings-pane-title">
          <h2 className="vx-settings-pane__title" id="settings-pane-title">{paneTitle}</h2>
          <p className="vx-settings-pane__caption">{paneCaption}</p>
          {page === "Settings" && rootPane === "Appearance" && appearance && oled ? (
            <div className="vx-settings-card vx-settings-pane__card">
              <div className="vx-settings-option">
                <div className="vx-settings-option__text">
                  <span className="vx-settings-option__title" id="settings-oled-title">OLED mode</span>
                  <span className="vx-settings-option__description">{oled.description}</span>
                </div>
                <button
                  type="button"
                  id="settings-oled"
                  data-focus-id="settings-oled"
                  className="vx-switch"
                  role="switch"
                  aria-checked={appearance.oled}
                  aria-label="OLED mode"
                  onClick={appearance.toggle}
                />
              </div>
              <TvButton
                id="settings-accent"
                className="vx-settings-option vx-settings-option--button"
                aria-haspopup="menu"
                aria-expanded={overlay?.kind === "choice" && overlay.from === "settings-accent" ? true : undefined}
                onActivate={accentChoice}
              >
                <span className="vx-settings-option__text">
                  <span className="vx-settings-option__title">Accent colour</span>
                  <span className="vx-settings-option__description">The colour of the main button, progress bars and highlights on this device.</span>
                </span>
                <span className="vx-settings-option__value">
                  <Swatch accent={accent} />
                  {ACCENT_LABEL[accent]}
                  <ChevronRight className="vx-settings-row__chevron" aria-hidden="true" strokeWidth={2.2} />
                </span>
              </TvButton>
            </div>
          ) : page === "Settings" ? (
            <div className="vx-settings-card">
              <div className="vx-settings-row vx-settings-row--info">
                <SettingsRowContent icon={<Info />} title="Version" value={version} chevron={false} />
              </div>
              <div className="vx-settings-row vx-settings-row--info">
                <SettingsRowContent icon={<Server />} title="Server" value={serverOrigin} chevron={false} />
              </div>
            </div>
          ) : page === "Playback preferences" ? (
            <>
              <div className="vx-settings-group">
                <div className="vx-settings-card">{playbackRows.map(rowButton)}</div>
              </div>
              {engineRow ? (
                <section className="vx-settings-group" aria-labelledby="settings-device-label">
                  <h3 className="vx-settings-group__label" id="settings-device-label">This device</h3>
                  <div className="vx-settings-card">{rowButton(engineRow)}</div>
                </section>
              ) : null}
            </>
          ) : (
            <div className="vx-settings-group">
              <div className="vx-settings-card">{addonRows.map(rowButton)}</div>
            </div>
          )}
        </section>
      </div>
      {overlayLayer}
    </main>
  );
}

/* ---- Overlays: choice list / popover, manage and remove addon, sign out, install ------ */

function SettingsOverlays({
  overlay,
  tv,
  desktop,
  anchor,
  onClose,
  onInstall,
  onToggleAddon,
  onAskRemove,
  onRemove,
  onSignOut,
}: {
  overlay: Overlay;
  tv: boolean;
  desktop: boolean;
  anchor: HTMLElement | null;
  onClose: () => void;
  onInstall: (url: string) => Promise<void>;
  onToggleAddon: (addon: JsonObject) => void;
  onAskRemove: (addon: JsonObject, from: string) => void;
  onRemove: (addon: JsonObject) => void;
  onSignOut: () => void;
}) {
  const legend = [{ key: "OK", label: "Select" }, { key: "BACK", label: "Cancel" }];
  const key = overlay.kind;
  const btn = (id: string, label: string, action: () => void, options: { danger?: boolean; icon?: ReactNode } = {}) => (
    <TvButton
      key={id}
      id={id}
      className={buttonClass({ kind: options.danger ? "destructive" : "secondary", block: true, icon: !!options.icon })}
      onActivate={action}
    >
      <ButtonContent icon={options.icon}>{label}</ButtonContent>
    </TvButton>
  );

  if (overlay.kind === "choice") {
    const currentIndex = Math.max(0, overlay.options.findIndex((option) => option.current));
    if (overlay.popover && desktop) {
      return (
        <SettingsLayer onClose={onClose} scrim={false} anchor={anchor} initialFocus={`settings-option-${currentIndex}`} focusKey={overlay.title} returnFocus={overlay.from}>
          <div className="vx-popover vx-settings-popover" role="menu" aria-label={overlay.title} data-anchored="true">
            <div className="vx-popover__label" aria-hidden="true">{overlay.title}</div>
            <div className="vx-menu">
              {overlay.options.map((option, index) => (
                <button
                  key={option.label}
                  type="button"
                  className="vx-menu__item"
                  role="menuitemradio"
                  aria-checked={option.current}
                  data-focus-id={`settings-option-${index}`}
                  onClick={option.pick}
                >
                  <MenuItemContent icon={option.swatch ? <Swatch accent={option.swatch} /> : undefined} current={option.current}>
                    {option.label}
                  </MenuItemContent>
                </button>
              ))}
            </div>
          </div>
        </SettingsLayer>
      );
    }
    // Long lists (languages) are the tall phone sheet; short ones size to their rows.
    const tall = !tv && !desktop && overlay.options.length > 6;
    return (
      <SettingsLayer onClose={onClose} initialFocus={`settings-option-${currentIndex}`} focusKey={overlay.title} returnFocus={overlay.from}>
        <Dialog
          title={overlay.title}
          onClose={tv ? undefined : onClose}
          variant={tall ? "drawer" : "dialog"}
          className={`vx-settings-dialog vx-settings-choice${tall ? " vx-settings-choice--tall" : ""}`}
          legend={tv ? legend : undefined}
        >
          <div className="vx-choice-list vx-settings-choice__list" role="radiogroup" aria-label={overlay.title}>
            {overlay.options.map((option, index) => (
              <TvButton
                key={option.label}
                id={`settings-option-${index}`}
                className="vx-choice"
                role="radio"
                aria-checked={option.current}
                onActivate={option.pick}
              >
                {option.swatch ? <Swatch accent={option.swatch} /> : null}
                <ChoiceContent current={option.current} checkIcon={<Check aria-hidden="true" strokeWidth={2.6} />}>
                  {option.label}
                </ChoiceContent>
              </TvButton>
            ))}
            {tv ? (
              <TvButton id="settings-option-cancel" className="vx-choice" onActivate={onClose}>
                <ChoiceContent>Cancel</ChoiceContent>
              </TvButton>
            ) : null}
          </div>
        </Dialog>
      </SettingsLayer>
    );
  }

  if (overlay.kind === "manage" || overlay.kind === "remove") {
    const name = addonName(overlay.addon);
    const remove = overlay.kind === "remove";
    const trash = tv ? undefined : <Trash2 aria-hidden="true" strokeWidth={2.2} />;
    return (
      <SettingsLayer onClose={onClose} initialFocus={remove ? "settings-cancel" : "settings-addon-toggle"} focusKey={key} returnFocus={overlay.from}>
        <Dialog
          title={remove ? `Remove ${name}?` : `Manage ${name}`}
          onClose={tv ? undefined : onClose}
          className="vx-settings-dialog"
          legend={tv ? legend : undefined}
          actions={
            remove ? (
              <>
                {btn("settings-cancel", "Cancel", onClose)}
                {btn("settings-remove", "Remove", () => onRemove(overlay.addon), { danger: true, icon: trash })}
              </>
            ) : (
              <>
                {btn("settings-addon-toggle", overlay.addon.enabled === false ? "Enable" : "Disable", () => onToggleAddon(overlay.addon))}
                {btn("settings-addon-remove", "Remove addon", () => onAskRemove(overlay.addon, overlay.from), { danger: true, icon: trash })}
                {btn("settings-cancel", "Cancel", onClose)}
              </>
            )
          }
        />
      </SettingsLayer>
    );
  }

  if (overlay.kind === "signout") {
    return (
      <SettingsLayer onClose={onClose} initialFocus="settings-cancel" focusKey={key} returnFocus="signout">
        <Dialog
          title={tv ? "Sign out of this TV?" : "Sign out of this device?"}
          onClose={tv ? undefined : onClose}
          className="vx-settings-dialog"
          legend={tv ? legend : undefined}
          actions={
            <>
              {btn("settings-signout-confirm", "Sign out", onSignOut, { danger: true, icon: tv ? undefined : <LogOut aria-hidden="true" strokeWidth={2.2} /> })}
              {btn("settings-cancel", "Cancel", onClose)}
            </>
          }
        />
      </SettingsLayer>
    );
  }

  return <InstallDialog onClose={onClose} onInstall={onInstall} />;
}

/** Phone / desktop addon install (PhAddonInstall, DeskAddonInstall). TV uses TextEntry. */
function InstallDialog({ onClose, onInstall }: { onClose: () => void; onInstall: (url: string) => Promise<void> }) {
  const [value, setValue] = useState("https://");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
  }, []);
  const submit = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await onInstall(value);
      if (mounted.current) onClose();
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Unable to save");
    } finally {
      if (mounted.current) setPending(false);
    }
  };
  return (
    <SettingsLayer onClose={onClose} initialFocus="settings-install-url" focusKey="install" returnFocus="addon-add">
      {/* While saving only Cancel is disabled (DeskAddonInstall); × / Esc still leave. */}
      <Dialog title="Install addon manifest URL" onClose={onClose} className="vx-settings-dialog vx-settings-install">
        <form
          className="vx-settings-install__form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <TextField
            label="Install addon manifest URL"
            hideLabel
            mono
            data-focus-id="settings-install-url"
            value={value}
            onChange={(event) => setValue(event.target.value.slice(0, 2048))}
            disabled={pending}
            error={error || undefined}
            errorIcon={<CircleAlert aria-hidden="true" strokeWidth={2.2} />}
            inputMode="url"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            maxLength={2048}
          />
          <div className="vx-dialog__actions">
            <button
              type="submit"
              data-focus-id="settings-install-save"
              className={buttonClass({ kind: "primary", block: true, icon: pending })}
              aria-busy={pending || undefined}
            >
              <ButtonContent loading={pending} loadingLabel="Saving…">Done</ButtonContent>
            </button>
            <button type="button" className={buttonClass({ block: true })} disabled={pending} onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </Dialog>
    </SettingsLayer>
  );
}
