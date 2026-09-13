import type { HtmlMediaLike } from './vizio-html5';
import { VIZIO_HTML5_CAPABILITIES, VizioHtml5Adapter } from './vizio-html5';
import type { PlayerCapabilities } from './types';

const HTML5_FALLBACK_CAPABILITIES: PlayerCapabilities = {
  ...VIZIO_HTML5_CAPABILITIES,
  platform: 'html5',
  engine: 'HTMLMediaElement preview',
  limitations: [
    'Preview adapter only: it uses native HTML media or hls.js/MSE for a backend-compatible URL.',
    'Mediabunny/WebCodecs probing, demuxing, and decode are not implemented here.',
    'Browser codec, DRM, adaptive, seek, and subtitle results remain runtime probes.',
  ],
};

/** Browser preview adapter. It has the same explicit direct-URL contract as Vizio. */
export class Html5FallbackAdapter extends VizioHtml5Adapter {
  readonly capabilities = HTML5_FALLBACK_CAPABILITIES;

  constructor(media: HtmlMediaLike) {
    super(media);
  }
}
