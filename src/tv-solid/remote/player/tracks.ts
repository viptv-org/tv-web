import type { Accessor, Setter } from "solid-js";
import type { RemotePlayback } from "../playback";
import type { Overlay } from "../app-types";
import type { Preferences } from "../types";
import type { ScopedRequest } from "../feature-ports";
import { trackLabel } from "../track-label";

interface CaptionOverride {leaseId: string; appearance: {font_scale: number; text_color: string; background_color: string}}
export function createTrackPicker(options: {
  player: Pick<RemotePlayback, "tracks" | "selectTrack" | "leaseId">; roku: boolean;
  selection: {column: Setter<number>; row: Setter<number>};
  dialogs: {current: Accessor<Overlay | undefined>; open: (value: Overlay) => void; close: () => void};
  subtitle: {enabled: Accessor<boolean>; current: Accessor<Preferences | undefined>; adopt: (value: Preferences | undefined) => void;
    request: ScopedRequest; path: Accessor<string>; override: (value: CaptionOverride) => void};
}) {
  const {player, roku: isRokuUi} = options;
  const {column: setTrackColumn, row: setChoice} = options.selection;
  const {current: overlay, open: openOverlay, close: closeOverlay} = options.dialogs;
  const {current: preferences, adopt: setPreferences, request: call, override: setCaptionOverride} = options.subtitle;
  function openTracks() {
    setTrackColumn(0);
    openOverlay({
      kind: "tracks",
      title: "Audio & subtitles",
      columns: [
        {
          title: "Audio",
          items: player.tracks.audio
            .filter(
              (track) =>
                track.selectable === true && track.supported !== false,
            )
            .map((track) => ({
              id: `audio-${track.input_index}`,
              label: trackLabel(track, "Audio"),
              value: track.selected ? "✓" : "",
              run: async () => {
                await player.selectTrack("audio", track.input_index);
                closeOverlay();
              },
            })),
        },
        {
          title: "Subtitles",
          items: [
            ...(player.tracks.subtitlesSupported
              ? [
                  {
                    id: "off",
                    label: "Off",
                    value: player.tracks.text.every((track) => !track.selected)
                      ? "✓"
                      : "",
                    run: async () => {
                      await player.selectTrack("text", null);
                      closeOverlay();
                    },
                  },
                ]
              : []),
            ...player.tracks.text
              .filter(
                (track) =>
                  track.selectable === true && track.supported !== false,
              )
              .map((track) => ({
                id: `text-${track.input_index}`,
                label: trackLabel(track, "Subtitle"),
                value: track.selected ? "✓" : "",
                run: async () => {
                  await player.selectTrack("text", track.input_index);
                  closeOverlay();
                },
              })),
          ],
        },
        ...(options.subtitle.enabled()
          ? [
              {
                title: "Subtitle size",
                items: (
                  preferences()?.controls?.find(
                    (control) => control.id === "subtitle_font_scale",
                  )?.choices ?? []
                ).filter(option => !isRokuUi || Number(option.value) <= 1.25).map((option) => ({
                  id: String(option.value),
                  label: option.label,
                  value:
                    preferences()?.preferences.subtitle_font_scale ===
                    option.value
                      ? "✓"
                      : "",
                  run: async () => {
                    const previous = preferences()!;
                    const leaseId = player.leaseId;
                    const receipt = await call<Preferences>(
                      options.subtitle.path(),
                      "PUT",
                      {
                        revision: previous.revision,
                        preferences: {
                          ...previous.preferences,
                          subtitle_font_scale: option.value,
                        },
                      },
                    );
                    setPreferences(receipt);
                    const p = receipt.preferences;
                    if (
                      leaseId &&
                      player.leaseId === leaseId &&
                      typeof p.subtitle_font_scale === "number" &&
                      typeof p.subtitle_text_color === "string" &&
                      typeof p.subtitle_background_color === "string"
                    ) {
                      setCaptionOverride({
                        leaseId,
                        appearance: {
                          font_scale: p.subtitle_font_scale,
                          text_color: p.subtitle_text_color,
                          background_color: p.subtitle_background_color,
                        },
                      });
                    }
                    closeOverlay();
                  },
                })),
              },
            ]
          : []),
      ].filter((column) => column.items.length),
    });
    const modal = overlay();
    if (modal?.kind === "tracks")
      setChoice(
        Math.max(
          0,
          modal.columns[0]?.items.findIndex((item) => item.value === "✓") ??
            0,
        ),
      );
  }
  return openTracks;
}
