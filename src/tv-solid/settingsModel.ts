import type { JsonObject, PlaybackPreferences, TvProfile } from "../api";
import { profileTileData } from "./ProfileTile";

export type SettingsPage = "Settings" | "Playback preferences" | "Addons";
export interface SettingsRowView {
  id: string;
  title: string;
  description: string;
  value: string;
  note: string;
  icon: string;
  y: number;
  danger: boolean;
  chevron: boolean;
  visible: boolean;
}
export interface SettingsProfileView {
  id: string;
  name: string;
  image: string;
  initial: string;
  watching: boolean;
  visible: boolean;
}
export interface SettingsChoiceView {
  label: string;
  value: string | boolean;
  current: boolean;
  visible: boolean;
}

export const emptySettingsRow: SettingsRowView = {
  id: "",
  title: "",
  description: "",
  value: "",
  note: "",
  icon: "",
  y: 0,
  danger: false,
  chevron: false,
  visible: false,
};
export const emptySettingsProfile: SettingsProfileView = {
  id: "",
  name: "",
  image: "",
  initial: "",
  watching: false,
  visible: false,
};
export const emptySettingsChoice: SettingsChoiceView = {
  label: "",
  value: "",
  current: false,
  visible: false,
};

export const defaultSettingsPreferences: PlaybackPreferences = {
  audioLanguage: "",
  subtitleLanguage: "",
  subtitlesEnabled: false,
  subtitleSize: "normal",
  subtitleStyle: "system",
  quality: "auto",
  autoplay: true,
};

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
const languageName = (code: string) =>
  languages.find(([, value]) => value === code)?.[0] ?? code;

export function settingsRows(
  page: SettingsPage,
  prefs: PlaybackPreferences,
  addons: readonly JsonObject[],
  serverOrigin: string,
  version: string,
): SettingsRowView[] {
  const make = (
    id: string,
    title: string,
    description: string,
    icon: string,
    value = "",
    note = "",
    danger = false,
  ): SettingsRowView => ({
    id,
    title,
    description,
    icon,
    value,
    note,
    danger,
    chevron: page === "Settings" && !danger,
    y: 166,
    visible: true,
  });
  const rows =
    page === "Settings"
      ? [
          make(
            "settings-profiles",
            "Switch profile",
            "Choose who’s watching. Press ▶ to pick from here.",
            "users",
          ),
          make(
            "settings-playback",
            "Playback preferences",
            "Audio, subtitles and quality for this profile.",
            "play",
          ),
          make(
            "settings-manage",
            "Manage profiles",
            "Add, rename, choose avatars or delete profiles.",
            "user",
          ),
          make(
            "settings-addons",
            "Addons",
            "Manage addons shared by your account.",
            "puzzle",
          ),
          make(
            "settings-about",
            "About VIPTV",
            `Version ${version}\n${serverOrigin}`,
            "info",
          ),
          make(
            "signout",
            "Sign out",
            "Sign out of VIPTV on this TV.",
            "logout",
            "",
            "",
            true,
          ),
        ]
      : page === "Playback preferences"
        ? [
            make(
              "audio-language",
              "Preferred audio",
              `Current: ${languageName(prefs.audioLanguage)}`,
              "languages",
              languageName(prefs.audioLanguage),
            ),
            make(
              "subtitle-language",
              "Preferred subtitles",
              `Current: ${languageName(prefs.subtitleLanguage)}`,
              "captions",
              languageName(prefs.subtitleLanguage),
            ),
            make(
              "setting-subtitlesEnabled",
              "Start with subtitles",
              `Current: ${prefs.subtitlesEnabled ? "On" : "Off"}`,
              "captions",
              prefs.subtitlesEnabled ? "On" : "Off",
            ),
            make(
              "subtitle-size",
              "Subtitle size",
              `Current: ${prefs.subtitleSize === "normal" ? "System default" : prefs.subtitleSize === "small" ? "Small" : "Large"}`,
              "type",
              prefs.subtitleSize === "normal"
                ? "System default"
                : prefs.subtitleSize === "small"
                  ? "Small"
                  : "Large",
            ),
            make(
              "subtitle-style",
              "Subtitle appearance",
              `Current: ${prefs.subtitleStyle === "shadow" ? "Text with shadow" : prefs.subtitleStyle === "opaque" ? "White text on black" : "System default"}`,
              "palette",
              prefs.subtitleStyle === "shadow"
                ? "Text with shadow"
                : prefs.subtitleStyle === "opaque"
                  ? "White text on black"
                  : "System default",
            ),
            make(
              "quality",
              "Maximum quality",
              `Current: ${prefs.quality === "auto" ? "Auto" : prefs.quality}`,
              "gauge",
              prefs.quality === "auto" ? "Auto" : prefs.quality,
            ),
          ]
        : [
            make(
              "addon-add",
              "Install addon",
              "Enter a Stremio manifest URL.",
              "plus",
              "",
              "Enter a Stremio manifest URL",
            ),
            ...addons.map((addon, index) =>
              make(
                `addon-${index}`,
                String(addon.name ?? "Addon"),
                addon.enabled === false ? "Disabled" : "Enabled",
                "puzzle",
                addon.enabled === false ? "Disabled" : "Enabled",
              ),
            ),
          ];
  return rows.map((row, index) => ({
    ...row,
    y: page === "Settings" && index === 5 ? 651 : 166 + index * 90,
  }));
}

export function settingsProfiles(
  profiles: readonly TvProfile[],
  selectedId: string,
): SettingsProfileView[] {
  return profiles.slice(0, 4).map((profile) => {
    const tile = profileTileData(profile);
    return {
      id: profile.id,
      name: profile.name,
      image: tile.image,
      initial: tile.initial,
      watching: profile.id === selectedId,
      visible: true,
    };
  });
}

export function settingsChoices(
  rowId: string,
  prefs: PlaybackPreferences,
): { key: keyof PlaybackPreferences; options: SettingsChoiceView[] } | null {
  const options = (
    key: keyof PlaybackPreferences,
    values: readonly [string, string | boolean][],
  ) => ({
    key,
    options: values.map(([label, value]) => ({
      label,
      value,
      current: prefs[key] === value,
      visible: true,
    })),
  });
  if (rowId === "audio-language") return options("audioLanguage", languages);
  if (rowId === "subtitle-language")
    return options("subtitleLanguage", languages);
  if (rowId === "setting-subtitlesEnabled")
    return options("subtitlesEnabled", [
      ["On", true],
      ["Off", false],
    ]);
  if (rowId === "subtitle-size")
    return options("subtitleSize", [
      ["Small", "small"],
      ["System default", "normal"],
      ["Large", "large"],
    ]);
  if (rowId === "subtitle-style")
    return options("subtitleStyle", [
      ["System default", "system"],
      ["Text with shadow", "shadow"],
      ["White text on black", "opaque"],
    ]);
  if (rowId === "quality")
    return options("quality", [
      ["Auto", "auto"],
      ["1080p", "1080p"],
      ["720p", "720p"],
      ["480p", "480p"],
    ]);
  return null;
}
