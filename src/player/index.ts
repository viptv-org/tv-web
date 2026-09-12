import { Html5FallbackAdapter } from './html5-fallback';
import { TizenAvplayAdapter, type AvplayManager } from './tizen-avplay';
import type { HtmlMediaLike } from './vizio-html5';
import { VizioHtml5Adapter } from './vizio-html5';
import type { Player, PlayerPlatform } from './types';

export * from './types';
export * from './session';
export * from './tizen-avplay';
export * from './vizio-html5';
export * from './html5-fallback';

export interface CreatePlayerOptions {
  readonly platform: PlayerPlatform;
  readonly video?: HtmlMediaLike;
  readonly avplay?: AvplayManager;
}

/** One factory keeps the React UI independent of the TV's playback engine. */
export function createPlayer(options: CreatePlayerOptions): Player {
  switch (options.platform) {
    case 'tizen':
      return new TizenAvplayAdapter(options.avplay);
    case 'vizio':
      return new VizioHtml5Adapter(requireVideo(options.video));
    case 'html5':
      return new Html5FallbackAdapter(requireVideo(options.video));
  }
}

function requireVideo(video: HtmlMediaLike | undefined): HtmlMediaLike {
  if (!video) throw new Error('A video element is required for HTML playback.');
  return video;
}
