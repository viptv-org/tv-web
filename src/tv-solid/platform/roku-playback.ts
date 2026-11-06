/**
 * Roku playback boundary.
 *
 * The browser entry keeps the HTML/HLS player. The Roku build currently uses
 * this no-op adapter so the shared UI, navigation and catalog can run while the
 * native SceneGraph Video adapter is wired in. Video controls stay disabled
 * until the adapter publishes a real snapshot.
 */
const noActions = {
  pause: false,
  seek: false,
  restart: false,
  change_source: false,
  episodes: false,
  next_episode: false,
  tracks: false,
  subtitle_style: false,
  report_progress: false,
};

export class RemotePlayback {
  actions = noActions;
  tracks = { audio: [] as any[], text: [] as any[], subtitlesSupported: false };
  leaseId = "";
  subtitleAppearance: any = null;
  canReplaceSource = false;
  player = {
    pause: async () => {},
    play: async () => {},
  };

  constructor(..._args: any[]) {}

  async start(..._args: any[]) {}
  async stop() {}
  async replaceSource(..._args: any[]) {}
  async selectTrack(..._args: any[]) {}
  async dispose() {}
  subscribe(..._args: any[]) {
    return () => {};
  }
}
