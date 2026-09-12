import { useEffect, useState } from "react";
import { TvApi, type PlaybackPreferences, type JsonObject } from "../api";
import { TextEntry } from "./TextEntry";
import { TvButton, focusElement } from "./remote";
type Choice = { label: string; action: () => void };
export function Settings({
  api,
  profile,
  prefs,
  onPrefs,
  onProfiles,
  onSignOut,
  onError,
  onModal,
}: {
  api: TvApi;
  profile: string;
  prefs: PlaybackPreferences;
  onPrefs: (p: PlaybackPreferences) => void;
  onProfiles: () => void;
  onSignOut: () => void;
  onError: (e: unknown) => void;
  onModal: (title: string, choices: Choice[]) => void;
}) {
  const [addons, setAddons] = useState<readonly JsonObject[]>([]),
    [entry, setEntry] = useState<{
      title: string;
      secret?: boolean;
      save: (text: string) => Promise<void>;
    }>();
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
  return (
    <main className="settings">
      <h1>Settings</h1>
      <div className="settings-scroll">
        <TvButton id="settings-profiles" onActivate={onProfiles}>
          Profiles
        </TvButton>
        <h2>Playback</h2>
        <TvButton
          id="setting-autoplay"
          onActivate={() => save({ autoplay: !prefs.autoplay })}
        >
          Autoplay next episode: {prefs.autoplay ? "On" : "Off"}
        </TvButton>
        <TvButton
          id="setting-subtitlesEnabled"
          onActivate={() => save({ subtitlesEnabled: !prefs.subtitlesEnabled })}
        >
          Subtitles: {prefs.subtitlesEnabled ? "On" : "Off"}
        </TvButton>
        <TvButton
          id="quality"
          onActivate={() =>
            choose("Video quality", "quality", [
              ["Auto", "auto"],
              ["1080p", "1080p"],
              ["720p", "720p"],
              ["480p", "480p"],
            ])
          }
        >
          Quality: {prefs.quality}
        </TvButton>
        <TvButton
          id="audio-language"
          onActivate={() =>
            choose("Preferred audio language", "audioLanguage", [
              ["Default", ""],
              ["English", "eng"],
              ["Spanish", "spa"],
              ["French", "fra"],
              ["German", "deu"],
              ["Japanese", "jpn"],
            ])
          }
        >
          Audio language: {prefs.audioLanguage || "Default"}
        </TvButton>
        <TvButton
          id="subtitle-language"
          onActivate={() =>
            choose("Preferred subtitle language", "subtitleLanguage", [
              ["Default", ""],
              ["English", "eng"],
              ["Spanish", "spa"],
              ["French", "fra"],
              ["German", "deu"],
              ["Japanese", "jpn"],
            ])
          }
        >
          Subtitle language: {prefs.subtitleLanguage || "Default"}
        </TvButton>
        <TvButton
          id="subtitle-size"
          onActivate={() =>
            choose("Subtitle size", "subtitleSize", [
              ["Small", "small"],
              ["Normal", "normal"],
              ["Large", "large"],
            ])
          }
        >
          Subtitle size: {prefs.subtitleSize}
        </TvButton>
        <TvButton
          id="subtitle-style"
          onActivate={() =>
            choose("Subtitle style", "subtitleStyle", [
              ["System", "system"],
              ["Shadow", "shadow"],
              ["Opaque", "opaque"],
            ])
          }
        >
          Subtitle style: {prefs.subtitleStyle}
        </TvButton>
        <h2>Add-ons</h2>
        <TvButton
          id="addon-add"
          onActivate={() =>
            setEntry({
              title: "Add-on manifest URL",
              save: async (text) => {
                const url = new URL(text);
                if (url.protocol !== "https:")
                  throw new Error("Enter an HTTPS manifest URL.");
                await api.addAddon(url.href);
                setAddons(await api.addons());
                setEntry(undefined);
              },
            })
          }
        >
          Install add-on
        </TvButton>
        {addons.map((addon, i) => {
          const id = String(addon.id ?? "");
          return (
            <TvButton
              id={`addon-${i}`}
              key={id}
              onActivate={() =>
                onModal(String(addon.name ?? "Add-on"), [
                  {
                    label: addon.enabled === false ? "Enable" : "Disable",
                    action: () => {
                      onModal("", []);
                      void api
                        .updateAddon(id, { enabled: addon.enabled === false })
                        .then(() => api.addons())
                        .then(setAddons)
                        .catch(onError);
                    },
                  },
                  {
                    label: "Remove",
                    action: () =>
                      onModal(
                        "Remove this add-on? Its sources will no longer be available.",
                        [
                          { label: "Cancel", action: () => onModal("", []) },
                          {
                            label: "Remove add-on",
                            action: () => {
                              onModal("", []);
                              void api
                                .deleteAddon(id)
                                .then(() => api.addons())
                                .then(setAddons)
                                .catch(onError);
                            },
                          },
                        ],
                      ),
                  },
                  { label: "Cancel", action: () => onModal("", []) },
                ])
              }
            >
              {String(addon.name ?? "Add-on")} ·{" "}
              {addon.enabled === false ? "Disabled" : "Enabled"}
            </TvButton>
          );
        })}
        <h2>Account</h2>
        <TvButton
          id="parent-unlock"
          onActivate={() =>
            setEntry({
              title: "Parent PIN",
              secret: true,
              save: async (pin) => {
                if (!/^\d{4,8}$/.test(pin))
                  throw new Error("Enter a 4–8 digit PIN.");
                await api.unlockParent(pin);
                setEntry(undefined);
              },
            })
          }
        >
          Unlock parent controls
        </TvButton>
        <TvButton id="signout" onActivate={onSignOut}>
          Sign out
        </TvButton>
        <h2>About</h2>
        <p>viptv 0.1.0 · TV preview</p>
        <p>One library and the same remote actions across your TVs.</p>
      </div>
      {entry && (
        <div
          onKeyDown={(e) => {
            if (
              e.key === "Escape" ||
              e.keyCode === 10009 ||
              e.keyCode === 461
            ) {
              e.preventDefault();
              e.stopPropagation();
              setEntry(undefined);
              setTimeout(() => focusElement("addon-add"), 0);
            }
          }}
        >
          <TextEntry
            title={entry.title}
            secret={entry.secret}
            onSubmit={entry.save}
            onCancel={() => setEntry(undefined)}
          />
        </div>
      )}
    </main>
  );
}
