#!/usr/bin/env node
import { chromium, expect } from '@playwright/test';
import { installBackend, installMediaStubs } from './backend.ts';

const url = process.env.SOLID_PREVIEW_URL;
if (!url?.startsWith('https://')) throw new Error('SOLID_PREVIEW_URL must be HTTPS');
const browser = await chromium.launch();
const focused = (page, view, index) => page.waitForFunction(({ view, index }) =>
  window.__viptvFocus?.view === view && (index === undefined || window.__viptvFocus.index === index),
  { view, index }, { timeout: 10000 });

async function fixture(platform, failure = false) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, timezoneId: 'America/New_York' });
  await page.clock.setFixedTime(new Date('2026-09-23T10:55:00-04:00'));
  const backend = await installBackend(page, { family: 'tv', session: 'ready', ...(failure ? { playbackFailAfter: 0 } : {}) });
  await installMediaStubs(page, { frame: '63e024', live: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${url}?platform=${platform}&focusdebug=1`);
  await focused(page, 'home-action', 0);
  await page.keyboard.press('ArrowLeft'); await focused(page, 'rail-item', 2);
  await page.keyboard.press('ArrowDown'); await focused(page, 'rail-item', 3);
  await page.keyboard.press('ArrowDown'); await focused(page, 'rail-item', 4);
  await page.keyboard.press('Enter'); await focused(page, 'guide-channel', 0);
  return { page, backend, errors };
}

function expectDirect(backend, count) {
  const starts = backend.requests.filter(request => request.path === '/api/playback' && request.method === 'POST');
  expect(starts).toHaveLength(count);
  for (const start of starts) {
    expect(start.body).toMatchObject({ channel_id: expect.any(String), position: 0 });
    expect(start.body.stream_id).toBeUndefined();
  }
  expect(backend.requests.filter(request => request.path === '/api/streams')).toHaveLength(0);
  expect(backend.requests.filter(request => request.method === 'PUT' && /\/progress$/.test(request.path))).toHaveLength(0);
}

try {
  for (const platform of ['tizen', 'vizio', 'webos']) {
    const { page, backend, errors } = await fixture(platform);
    await page.keyboard.press('ArrowDown'); await focused(page, 'guide-channel', 1);
    await page.keyboard.press('Enter'); await focused(page, 'player-control', 1);
    expectDirect(backend, 1);
    // Hide chrome, then leave playback. There must be no intervening source screen.
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await focused(page, 'guide-channel', 1);
    expect(backend.requests.some(request => request.method === 'DELETE' && request.path.startsWith('/api/playback/'))).toBe(true);

    // Starting from a currently airing programme restores the same programme focus.
    await page.keyboard.press('ArrowRight'); await focused(page, 'guide-program');
    const programIndex = await page.evaluate(() => window.__viptvFocus.index);
    await page.keyboard.press('Enter'); await focused(page, 'player-control', 1);
    expectDirect(backend, 2);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await focused(page, 'guide-program', programIndex);
    expect(errors).toEqual([]); expect(backend.errors).toEqual([]);
    console.log(`${platform}: direct channel/programme playback, no discovery, no live progress, and exact guide return passed`);
    await page.close();
  }

  const { page, backend, errors } = await fixture('vizio', true);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__viptvEntryFocus?.id?.startsWith('player-dialog-'), null, { timeout: 10000 });
  expectDirect(backend, 1);
  await page.keyboard.press('Escape');
  await focused(page, 'guide-channel', 0);
  expect(errors).toEqual([]); expect(backend.errors).toEqual([]);
  console.log('Vizio: direct live preparation failure returns to the original guide channel');
  await page.close();

  {
    const { page, backend, errors } = await fixture('vizio');
    let release;
    const held = new Promise(resolve => { release = resolve; });
    let intercepted = 0;
    await page.route('**/api/playback', async route => {
      if (route.request().method() !== 'POST' || ++intercepted !== 1) return route.fallback();
      await held;
      await route.fulfill({ status: 200, contentType: 'application/json', headers: {
        'access-control-allow-origin': new URL(url).origin,
        'access-control-allow-credentials': 'true',
      }, body: JSON.stringify({ id: 'delayed-cancelled-live', url: '/media/preview-playback/index.m3u8', format: 'hls', mode: 'remux', video_mode: 'copy', audio_mode: 'transcode', position: 0, live: true, duration: 0, audio_tracks: [], subtitle_tracks: [], subtitles_supported: false }) });
    });
    try {
      await page.keyboard.press('Enter'); await expect.poll(() => intercepted).toBe(1);
      await page.keyboard.press('Escape'); await focused(page, 'guide-channel', 0);
      await page.keyboard.press('ArrowDown'); await focused(page, 'guide-channel', 1);
      await page.keyboard.press('Enter'); await focused(page, 'player-control', 1);
      release();
      // The controller cleans up the cancelled backend session. Its old start
      // then returns the current owner; stale UI code must not stop that owner.
      await expect.poll(() => backend.requests.some(request => request.method === 'DELETE' && request.path === '/api/playback/delayed-cancelled-live')).toBe(true);
      await page.waitForTimeout(250);
      expect(backend.requests.filter(request => request.method === 'DELETE' && request.path === '/api/playback/preview-playback')).toHaveLength(0);
      expect(await page.evaluate(() => window.__viptvPlayer?.state)).toBe('playing');
      await focused(page, 'player-control', 1);
      expect(errors).toEqual([]); expect(backend.errors).toEqual([]);
      console.log('Vizio: cancelled delayed live start cannot stop newer channel playback');
    } finally { release(); await page.close(); }
  }
} finally { await browser.close(); }
