import type { Page } from '@playwright/test';

export async function installTizenSdkBoundary(page: Page) {
  await page.addInitScript(() => {
    let state = 'NONE', clock = 0, listener: any = {};
    const calls: { play: number; pause: number; subtitles: number[]; silent: boolean[]; keys: string[] } = { play: 0, pause: 0, subtitles: [], silent: [], keys: [] };
    const avplay = {
      open() {
        if (!document.querySelector('#video-layer object[type="application/avplayer"]')) throw Error('Native surface missing');
        state = 'IDLE'; clock = 0;
      },
      close() { state = 'NONE'; }, stop() { state = 'IDLE'; },
      setListener(value: any) { listener = value; },
      prepareAsync(ready: () => void) { state = 'READY'; setTimeout(ready, 0); },
      play() {
        if (!['READY', 'PAUSED'].includes(state)) throw Error(`Invalid SDK play in ${state}`);
        state = 'PLAYING'; calls.play++; clock = 1000;
        const current = listener; setTimeout(() => current.oncurrentplaytime?.(clock), 0);
      },
      pause() {
        if (state !== 'PLAYING') throw Error(`Invalid SDK pause in ${state}`);
        state = 'PAUSED'; calls.pause++;
      },
      seekTo(ms: number, done: () => void) { clock = ms; done(); },
      getCurrentTime() { return clock; }, getDuration() { return 5000; },
      getTotalTrackInfo() { return [{ index: 8, type: 'TEXT', extra_info: '{"track_lang":"en"}' }]; },
      setSelectTrack(_kind: string, index: number) {
        if (!['PLAYING', 'PAUSED'].includes(state)) throw Error('TEXT selection before playback');
        calls.subtitles.push(index);
      },
      setSilentSubtitle(value: boolean) { calls.silent.push(value); },
      setDisplayRect() {},
    };
    Object.assign(window, {
      webapis: { avplay },
      tizen: { tvinputdevice: { registerKey(name: string) { calls.keys.push(name); } } },
      __tizenBoundaryCalls: calls,
    });
  });
}
