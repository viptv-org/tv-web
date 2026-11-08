import { VizioHtml5Adapter } from "../../../vendor/video/src/vizio-html5";
import type { Player } from "../../../vendor/video/src/types";

/** The HTML/HLS playback engine, and with it hls.js.
 *
 * `vendor/video/src/vizio-html5.ts` statically imports hls.js, which is 1450
 * KiB of source and the majority of this app's largest chunk. Importing this
 * module is what puts hls.js in a bundle, so nothing outside `playback.ts` may
 * import it statically: `playback.ts` reaches it through `import()` when a
 * session first opens. An AVPlay TV never evaluates it, and no TV needs an HTML
 * engine before the first session.
 */
export function createHtmlHlsPlayer(video: HTMLVideoElement): Player {
  return new VizioHtml5Adapter(video, { unreliableFrameReporting: /PlayStation\s*4/i.test(navigator.userAgent) });
}
