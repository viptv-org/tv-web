/** Samsung's system SDK is available to packaged apps, not hosted pages. */
export async function prepareTizenHost(platform: string): Promise<void> {
  if (platform !== 'tizen' || location.protocol !== 'file:' || hasAvplay()) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const finish = (error?: Error) => {
      clearTimeout(timer);
      script.onload = script.onerror = null;
      if (error) { script.remove(); reject(error); } else resolve();
    };
    const timer = setTimeout(() => finish(new Error('Samsung playback SDK did not load.')), 8000);
    script.onload = () => finish(hasAvplay() ? undefined : new Error('Samsung AVPlay is unavailable.'));
    script.onerror = () => finish(new Error('Samsung playback SDK is unavailable.'));
    script.src = '$WEBAPIS/webapis/webapis.js';
    document.head.appendChild(script);
  });
}

function hasAvplay(): boolean {
  return !!(window as Window & { webapis?: { avplay?: unknown } }).webapis?.avplay;
}

/** The native surface shares the existing video layer beneath canvas controls. */
export function ensureTizenSurface(): void {
  if (document.getElementById('tv-avplay')) return;
  const layer = document.getElementById('video-layer');
  if (!layer) throw new Error('The Samsung video layer is unavailable.');
  const surface = document.createElement('object');
  surface.id = 'tv-avplay';
  surface.type = 'application/avplayer';
  surface.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  layer.appendChild(surface);
  const video = document.getElementById('tv-video');
  if (video) video.style.display = 'none';
}
