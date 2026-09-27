#!/usr/bin/env node
import { chromium, expect } from '@playwright/test';
import { installBackend, installMediaStubs } from './backend.ts';

const url = process.env.SOLID_PREVIEW_URL;
if (!url?.startsWith('https://')) throw new Error('SOLID_PREVIEW_URL must be HTTPS');
const browser = await chromium.launch();
try {
  for (const platform of ['tizen', 'vizio', 'webos']) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const backend = await installBackend(page, { family: 'tv', session: 'ready', sourcesDone: true });
    await installMediaStubs(page, { duration: 3600, position: 42, frame: '63e024' });
    const requests = [], errors = [];
    let audio = 10, text = 9, off = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/playback', async route => {
      if (route.request().method() !== 'POST') return route.fallback();
      const body = route.request().postDataJSON(); requests.push(body);
      audio = body.audio_track_index ?? audio;
      text = body.subtitle_track_index ?? text;
      off = body.subtitles_off ?? off;
      const tracks = (kind, selected) => Array.from({ length: 12 }, (_, index) => ({
        input_index: index, language: 'en', language_status: 'known', title: `${kind} ${index + 1}`,
        codec: kind === 'Audio' ? 'aac' : 'subrip', selected: index === selected,
        supported: index !== 9 || kind === 'Subtitle', selectable: index !== 9 || kind === 'Subtitle',
      }));
      await route.fulfill({ status: 200, contentType: 'application/json', headers: {
        'access-control-allow-origin': new URL(url).origin, 'access-control-allow-credentials': 'true',
      }, body: JSON.stringify({
        id: `tracks-${requests.length}`, url: '/media/preview-playback/index.m3u8', format: 'hls', mode: 'remux',
        video_mode: 'copy', audio_mode: 'transcode', position: body.position ?? 0, live: false, duration: 3600,
        audio_tracks: tracks('Audio', audio), subtitle_tracks: tracks('Subtitle', off ? -1 : text), subtitles_supported: true,
      }) });
    });
    const focused = (view, index) => page.waitForFunction(({ view, index }) =>
      window.__viptvFocus?.view === view && window.__viptvFocus.index === index && window.__viptvFocus.nativeFocus === true,
      { view, index }, { timeout: 10000 });
    const moveTrack = async (key, index) => { await page.keyboard.press(key); await focused('player-track-option', index); };
    await page.goto(`${url}?platform=${platform}&focusdebug=1`); await focused('home-action', 0);
    await page.keyboard.press('Enter'); await focused('source-row', 0);
    await page.keyboard.press('Enter'); await focused('player-control', 1);
    for (let index = 2; index <= 4; index++) { await page.keyboard.press('ArrowRight'); await focused('player-control', index); }
    await page.keyboard.press('Enter'); await focused('player-track-option', 10);
    await moveTrack('ArrowUp', 9);
    await page.keyboard.press('Enter'); await focused('player-track-option', 9);
    expect(requests).toHaveLength(1); // unavailable choice must keep the picker open
    await moveTrack('ArrowUp', 8); await moveTrack('ArrowUp', 7); // previous page
    await moveTrack('ArrowDown', 8); await moveTrack('ArrowDown', 9);
    await moveTrack('ArrowDown', 10); await moveTrack('ArrowDown', 11);
    await moveTrack('ArrowDown', 11); // clamp at final track, not an empty slot
    await page.keyboard.press('Enter'); await focused('player-control', 4);
    await expect.poll(() => requests.length).toBe(2);
    await page.waitForFunction(()=>window.__viptvTrackSelection?.committed===true);
    expect(requests[1].audio_track_index).toBe(11);
    await page.keyboard.press('Enter'); await focused('player-track-option', 11);
    await page.keyboard.press('Escape'); await focused('player-control', 4);

    await page.keyboard.press('ArrowRight'); await focused('player-control', 5);
    await page.keyboard.press('Enter'); await focused('player-track-option', 10); // subtitle index 9 + Off
    await moveTrack('ArrowDown', 11); await moveTrack('ArrowDown', 12);
    await page.keyboard.press('Enter'); await focused('player-control', 5);
    await expect.poll(() => requests.length).toBe(3);
    await page.waitForFunction(()=>window.__viptvTrackSelection?.committed===true);
    expect(requests[2].subtitle_track_index).toBe(11);
    await page.keyboard.press('Enter'); await focused('player-track-option', 12);
    for (let index = 11; index >= 0; index--) await moveTrack('ArrowUp', index);
    await page.keyboard.press('Enter'); await focused('player-control', 5);
    await expect.poll(() => requests.length).toBe(4);
    expect(requests[3].subtitles_off).toBe(true);
    expect(errors).toEqual([]); expect(backend.errors).toEqual([]);
    console.log(`${platform}: 12-track paging, current beyond first page, unavailable row, exact selection, Off and Back focus passed`);
    await page.close();
  }
} finally { await browser.close(); }
