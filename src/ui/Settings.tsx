import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TvApi, type PlaybackPreferences, type JsonObject } from "../api";

import { ENGINE_CHOICES } from "./enginePreference";
import type { NativeVideoEngine } from "@viptv/video";
import { TextEntry } from "./TextEntry";
import { TvButton, focusElement } from "./remote";
import { ChevronLeft, ChevronRight } from "lucide-react";
import packageInfo from "../../package.json";
import "./account-roku.css";

type Choice = { label: string; action: () => void };
type Row = Choice & {
  id: string;
  description: string;
  /** List layout: section the row is grouped under on the main page. */
  group?: "Profile" | "Playback" | "This device" | "Account";
  /** List layout: short title when the TV label also carries the value. */
  title?: string;
  /** List layout: secondary line under the title. */
  note?: string;
  /** List layout: trailing current value. */
  value?: string;
  /** List layout: on/off state rendered as a switch. */
  toggle?: boolean;
  /** List layout: informational row without a chevron. */
  info?: boolean;
  danger?: boolean;
};
const listGroups = ["Profile", "Playback", "This device", "Account"] as const;
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
const languageName = (value: string) =>
  languages.find(([, code]) => code === value)?.[0] ?? value;
export function Settings({
  api,
  profile,
  prefs,
  onPrefs,
  onProfiles,
  onManageProfiles = onProfiles,
  onSignOut,
  onError,
  onModal,
  serverOrigin = "https://viptv.syek.tech",
  appearance,
  playbackEngine,
  subpage,
  onSubpageChange,
  onBack,
  list = false,
  onWatchOnTv,
}: {
  api: TvApi;
  profile: string;
  prefs: PlaybackPreferences;
  onPrefs: (p: PlaybackPreferences) => void;
  onProfiles: () => void;
  onManageProfiles?: () => void;
  onSignOut: () => void;
  onError: (e: unknown) => void;
  onModal: (title: string, choices: Choice[]) => void;
  serverOrigin?: string;
  appearance?: { oled: boolean; toggle: () => void };
  playbackEngine?: { choice: NativeVideoEngine; select: (engine: NativeVideoEngine) => void };
  subpage?: "Settings" | "Playback preferences" | "Addons";
  onSubpageChange?: (p: "Settings" | "Playback preferences" | "Addons") => void;
  onBack?: () => void;
  /** Pointer/touch arrangement: a grouped settings list with inline values. */
  list?: boolean;
  /** Phone entry to the Watch on TV controller, which has no header there. */
  onWatchOnTv?: () => void;
}) {
  const [addons, setAddons] = useState<readonly JsonObject[]>([]);
  const [internalPage, setInternalPage] = useState<
    "Settings" | "Playback preferences" | "Addons"
  >("Settings");
  const page = subpage !== undefined ? subpage : internalPage;
  const setPage = (next: typeof page) => {
    if (subpage === undefined) setInternalPage(next);
    onSubpageChange?.(next);
  };
  const [selected, setSelected] = useState(0);
  const [entry, setEntry] = useState(false);
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
  const openPage = (next: typeof page) => {
    setSelected(0);
    setPage(next);
  };
  const save = (value: Partial<PlaybackPreferences>) =>
    void api.savePreferences(profile, value).then(onPrefs).catch(onError);
  const choose = (
    title: string,
    key: keyof PlaybackPreferences,
    values: readonly [string, string | boolean][],
  ) =>
    onModal(
      title,
      values.map(([label, value]) => ({
        label,
        action: () => {
          save({ [key]: value });
          onModal("", []);
        },
      })),
    );
  const refreshAddons = (request: Promise<unknown>) =>
    void request
      .then(() => api.addons())
      .then(setAddons)
      .catch(onError);
  const rows: Row[] =
    page === "Settings"
      ? [
          ...(appearance ? [{
            id: "settings-appearance",
            label: `OLED mode: ${appearance.oled ? "On" : "Off"}`,
            description: "Use a pure black background on this device. Your profile and playback settings stay the same.",
            action: appearance.toggle,
            group: "This device",
            title: "OLED mode",
            note: "Pure black background",
            toggle: appearance.oled,
          } satisfies Row] : []),
          ...(onWatchOnTv ? [{
            id: "settings-watch-on-tv",
            label: "Watch on TV",
            description: "Open VIPTV on a television.",
            action: onWatchOnTv,
            group: "This device",
            note: "Open VIPTV on a television",
          } satisfies Row] : []),
          ...(playbackEngine ? [{
            id: "settings-engine",
            label: `Playback engine: ${playbackEngine.choice === "auto" ? "Auto" : playbackEngine.choice}`,
            description: "The native engine that decodes video. Auto uses the app's preferred engine for this device.",
            group: "Playback",
            title: "Playback engine",
            value: playbackEngine.choice === "auto" ? "Auto" : playbackEngine.choice,
            action: () =>
              onModal(
                "Playback engine",
                ENGINE_CHOICES.map((engine) => ({
                  label: engine === "auto" ? "Auto" : engine,
                  action: () => {
                    playbackEngine.select(engine);
                    onModal("", []);
                  },
                })),
              ),
          } satisfies Row] : []),
          {
            id: "settings-profiles",
            label: "Switch profile",
            description: "Choose who's watching.",
            action: onProfiles,
            group: "Profile",
          },
          {
            id: "settings-playback",
            label: "Playback preferences",
            description: "Audio, subtitles and quality for this profile.",
            action: () => openPage("Playback preferences"),
            group: "Playback",
            note: "Audio, subtitles and quality",
          },
          {
            id: "settings-manage",
            label: "Manage profiles",
            description: "Add, rename, choose avatars or delete profiles.",
            action: onManageProfiles,
            group: "Profile",
            note: "Add, rename or delete profiles",
          },
          {
            id: "settings-about",
            label: "About VIPTV",
            description: `Version ${packageInfo.version}\n${serverOrigin}`,
            action: () => {},
            group: "Account",
            value: `Version ${packageInfo.version}`,
            info: true,
          },
          {
            id: "settings-addons",
            label: "Addons",
            description: "Manage addons shared by your account.",
            action: () => openPage("Addons"),
            group: "Account",
            note: "Shared by your account",
          },
          {
            id: "signout",
            label: "Sign out",
            description: list ? "Sign out of VIPTV on this device." : "Sign out of VIPTV on this TV.",
            action: onSignOut,
            group: "Account",
            danger: true,
          },
        ]
      : page === "Playback preferences"
        ? [
            {
              id: "audio-language",
              label: "Preferred audio",
              description: languageName(prefs.audioLanguage),
              action: () =>
                choose("Preferred audio", "audioLanguage", languages),
            },
            {
              id: "subtitle-language",
              label: "Preferred subtitles",
              description: languageName(prefs.subtitleLanguage),
              action: () =>
                choose("Preferred subtitles", "subtitleLanguage", languages),
            },
            {
              id: "setting-subtitlesEnabled",
              label: "Start with subtitles",
              description: prefs.subtitlesEnabled ? "On" : "Off",
              action: () =>
                choose("Start with subtitles", "subtitlesEnabled", [
                  ["On", true],
                  ["Off", false],
                ]),
            },
            {
              id: "subtitle-size",
              label: "Subtitle size",
              description:
                prefs.subtitleSize === "normal"
                  ? "System default"
                  : prefs.subtitleSize === "small"
                    ? "Small"
                    : "Large",
              action: () =>
                choose("Subtitle size", "subtitleSize", [
                  ["Small", "small"],
                  ["System default", "normal"],
                  ["Large", "large"],
                ]),
            },
            {
              id: "subtitle-style",
              label: "Subtitle appearance",
              description:
                prefs.subtitleStyle === "shadow"
                  ? "Text with shadow"
                  : prefs.subtitleStyle === "opaque"
                    ? "White text on black"
                    : "System default",
              action: () =>
                choose("Subtitle appearance", "subtitleStyle", [
                  ["System default", "system"],
                  ["Text with shadow", "shadow"],
                  ["White text on black", "opaque"],
                ]),
            },
            {
              id: "quality",
              label: "Maximum quality",
              description: prefs.quality === "auto" ? "Auto" : prefs.quality,
              action: () =>
                choose("Maximum quality", "quality", [
                  ["Auto", "auto"],
                  ["1080p", "1080p"],
                  ["720p", "720p"],
                  ["480p", "480p"],
                ]),
            },
          ]
        : [
            {
              id: "addon-add",
              label: "Install addon",
              description: "Enter a Stremio manifest URL.",
              action: () => setEntry(true),
              note: "Enter a Stremio manifest URL",
              value: "",
            },
            ...addons.map((addon, index): Row => {
              const id = String(addon.id ?? ""),
                name = String(addon.name ?? "Addon");
              return {
                id: `addon-${index}`,
                label: name,
                description: addon.enabled === false ? "Disabled" : "Enabled",
                action: () =>
                  onModal(`Manage ${name}`, [
                    {
                      label: addon.enabled === false ? "Enable" : "Disable",
                      action: () => {
                        onModal("", []);
                        refreshAddons(
                          api.updateAddon(id, {
                            enabled: addon.enabled === false,
                          }),
                        );
                      },
                    },
                    {
                      label: "Remove addon",
                      action: () =>
                        onModal(`Remove ${name}?`, [
                          { label: "Cancel", action: () => onModal("", []) },
                          {
                            label: "Remove",
                            action: () => {
                              onModal("", []);
                              refreshAddons(api.deleteAddon(id));
                            },
                          },
                        ]),
                    },
                    { label: "Cancel", action: () => onModal("", []) },
                  ]),
              };
            }),
          ];
  useEffect(() => {
    // Touch layouts take no programmatic focus: it would only paint a
    // remote focus state on the first row.
    if (!list) focusElement(rows[0].id);
  }, [page]);
  const caption =
    page === "Playback preferences"
      ? "Applies to your next playback. Manual track choices take priority."
      : page === "Addons"
        ? "Shared by all profiles and devices on your account."
        : "";
  const closeEntry = () => {
    setEntry(false);
    setTimeout(() => focusElement("addon-add"), 0);
  };
  const entryPortal =
    entry &&
    createPortal(
      <TextEntry
        title="Install addon manifest URL"
        initialValue="https://"
        onCancel={closeEntry}
        onSubmit={async (text) => {
          const url = new URL(text.trim());
          if (url.protocol !== "https:")
            throw new Error("Enter an HTTPS manifest URL.");
          await api.addAddon(url.href);
          setAddons(await api.addons());
          closeEntry();
        }}
      />,
      document.querySelector(".tv-screen") ?? document.body,
    );
  const back = () => {
    if (onBack) onBack();
    else openPage("Settings");
  };
  if (list) {
    // Main page rows carry an explanatory note; sub-page rows show their
    // current value, so the TV description panel has no phone counterpart.
    // A main-page row without a group still renders, in a trailing untitled section.
    const sections: (readonly [string, readonly Row[]])[] =
      page === "Settings"
        ? [
            ...listGroups.map((group) => [group, rows.filter((row) => row.group === group)] as const),
            ["", rows.filter((row) => !row.group)] as const,
          ].filter(([, groupRows]) => groupRows.length)
        : [["", rows]];
    return (
      <main className={`settings roku-settings list-settings ${page === "Settings" ? "" : "settings-subpage"}`}>
        <div className="settings-header">
          {page !== "Settings" && (
            <button type="button" className="settings-back-btn" aria-label="Back to Settings" onClick={back}>
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
          )}
          <h1>{page}</h1>
        </div>
        {caption && <p className="settings-caption">{caption}</p>}
        <div className="settings-scroll">
          {sections.map(([group, groupRows]) => (
            <section className="settings-group" key={group || "ungrouped"} aria-label={group || undefined}>
              {group && <h2>{group}</h2>}
              <div className="settings-card">
                {groupRows.map((row) => {
                  const note = row.note ?? "";
                  const value = row.value ?? (page === "Settings" ? undefined : row.description);
                  return (
                    <TvButton
                      key={row.id}
                      id={row.id}
                      className={`settings-row ${row.danger ? "danger" : ""} ${row.info ? "info" : ""}`}
                      aria-pressed={row.toggle}
                      onActivate={row.action}
                    >
                      <span className="settings-row-text">
                        <strong>{row.title ?? row.label}</strong>
                        {note && <small>{note}</small>}
                      </span>
                      {row.toggle !== undefined ? (
                        <span className="settings-switch" aria-hidden="true" />
                      ) : (
                        <>
                          {value && <span className="settings-value">{value}</span>}
                          {!row.info && !row.danger && <ChevronRight className="settings-chevron" size={18} aria-hidden="true" />}
                        </>
                      )}
                    </TvButton>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        {entryPortal}
      </main>
    );
  }
  return (
    <main
      className={`settings roku-settings ${caption ? "has-caption" : ""}`}
      onKeyDown={(event) => {
        if (
          !["Escape", "BrowserBack"].includes(event.key) &&
          event.keyCode !== 10009 &&
          event.keyCode !== 461
        )
          return;
        if (page === "Settings") return;
        event.preventDefault();
        event.stopPropagation();
        if (onBack) onBack();
        else {
          const restore =
            page === "Addons" ? "settings-addons" : "settings-playback";
          openPage("Settings");
          setTimeout(() => focusElement(restore), 0);
        }
      }}
    >
      <div className="settings-header">
        {page !== "Settings" && (
          <TvButton
            id="settings-back-btn"
            className="settings-back-btn"
            aria-label="Back to Settings"
            onActivate={back}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </TvButton>
        )}
        <h1>{page}</h1>
      </div>
      {caption && <p className="settings-caption">{caption}</p>}
      <div className="settings-scroll">
        {rows.map((row, index) => (
          <TvButton
            key={row.id}
            id={row.id}
            onFocus={() => setSelected(index)}
            onActivate={row.action}
          >
            {row.label}
          </TvButton>
        ))}
      </div>
      <aside className="settings-description">
        <h2>{rows[selected]?.label}</h2>
        <p>{rows[selected]?.description}</p>
      </aside>
      {entryPortal}
    </main>
  );
}
