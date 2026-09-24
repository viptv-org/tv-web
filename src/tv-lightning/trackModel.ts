import type { Player, PlaybackSessionView } from "@viptv/video";

export interface TrackChoiceView {
  id: string;
  label: string;
  current: boolean;
  available: boolean;
  mode: "off" | "native" | "server";
  inputIndex: number;
}

export const emptyTrackChoice: TrackChoiceView = {
  id: "", label: "", current: false, available: false,
  mode: "server", inputIndex: -1,
};

/** Same direct/native preference and managed-session choices as React TV. */
export function trackChoicesFor(
  kind: "audio" | "text",
  player: Player,
  session: PlaybackSessionView,
): TrackChoiceView[] {
  const snapshot = player.snapshot;
  const canNative = session.mode === "direct" && (kind === "audio"
    ? player.capabilities.canSelectAudioTrack : player.capabilities.canSelectTextTrack);
  const native = kind === "audio" ? snapshot.tracks.audio : snapshot.tracks.text;
  const server = kind === "audio" ? session.audioTracks : session.subtitleTracks;
  const choices: TrackChoiceView[] = [];
  if (kind === "text" && (session.subtitlesSupported ||
      (session.mode === "direct" && player.capabilities.canDisableTextTrack))) {
    const off = canNative ? !snapshot.tracks.selectedTextId : !server.some(track => track.selected);
    choices.push({ id: "__off__", label: "Off", current: off, available: true, mode: "off", inputIndex: -1 });
  }
  if (canNative && native.length) {
    for (const track of native) choices.push({
      id: track.id,
      label: track.label,
      current: (kind === "audio" ? snapshot.tracks.selectedAudioId : snapshot.tracks.selectedTextId) === track.id,
      available: track.available,
      mode: "native",
      inputIndex: -1,
    });
  } else {
    for (const track of server) choices.push({
      id: String(track.inputIndex),
      label: track.title || track.language || `Track ${track.inputIndex + 1}`,
      current: track.selected,
      available: track.selectable,
      mode: "server",
      inputIndex: track.inputIndex,
    });
  }
  return choices;
}
