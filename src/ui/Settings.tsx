import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TvApi, type PlaybackPreferences, type JsonObject } from "../api";

import { ENGINE_CHOICES } from "./enginePreference";
import type { NativeVideoEngine } from "@viptv/video";
import { TextEntry } from "./TextEntry";
import { TvButton, focusElement } from "./remote";
import packageInfo from "../../package.json";
import "./account-roku.css";

type Choice = { label: string; action: () => void };
type Row = Choice & { id: string; description: string };
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
          }] : []),
          ...(playbackEngine ? [{
            id: "settings-engine",
            label: `Playback engine: ${playbackEngine.choice === "auto" ? "Auto" : playbackEngine.choice}`,
            description: "The native engine that decodes video. Auto uses the app's preferred engine for this device.",
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
          }] : []),
          {
            id: "settings-profiles",
            label: "Switch profile",
            description: "Choose who's watching.",
            action: onProfiles,
          },
          {
            id: "settings-playback",
            label: "Playback preferences",
            description: "Audio, subtitles and quality for this profile.",
            action: () => openPage("Playback preferences"),
          },
          {
            id: "settings-manage",
            label: "Manage profiles",
            description: "Add, rename, choose avatars or delete profiles.",
            action: onManageProfiles,
          },
          {
            id: "settings-about",
            label: "About VIPTV",
            description: `Version ${packageInfo.version}\n${serverOrigin}`,
            action: () => {},
          },
          {
            id: "settings-addons",
            label: "Addons",
            description: "Manage addons shared by your account.",
            action: () => openPage("Addons"),
          },
          {
            id: "signout",
            label: "Sign out",
            description: "Sign out of VIPTV on this TV.",
            action: onSignOut,
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
    focusElement(rows[0].id);
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
            onActivate={() => {
              if (onBack) onBack();
              else openPage("Settings");
            }}
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
      {entry &&
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
        )}
    </main>
  );
}
