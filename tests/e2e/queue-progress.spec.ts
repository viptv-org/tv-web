import { expect, test, type Page, type Route } from '@playwright/test';

const apiOrigin = 'https://viptv.syek.tech';
const corsHeaders = {
  'access-control-allow-origin': 'http://127.0.0.1:4173',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
};

const queueEpisode = {
  id: 'queue-show:1:2', type: 'series', name: 'Queue Show', title: 'The Queue Episode',
  episode_title: 'The Queue Episode', series_id: 'queue-show', season: 1, episode: 2,
  position: 42, duration: 120, description: 'A resumable queue fixture.',
  source_addon_id: 'addon:queue', source_fingerprint: 'queue-release',
};
const catalogMovie = {
  id: 'fixture-movie', type: 'movie', name: 'Fixture movie', title: 'Fixture movie',
  description: 'Keeps Home populated after the queue changes.',
};
type FixtureState = {
  queue: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
  corrections: Array<Record<string, unknown>>;
  playback: Array<Record<string, unknown>>;
  progressWrites: Array<Record<string, unknown>>;
  queueReads: number;
  historyReads: number;
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', headers: corsHeaders, body: JSON.stringify(body) });
}

async function installFixture(page: Page, watched = false): Promise<FixtureState> {
  const state: FixtureState = {
    queue: [{ ...queueEpisode, watched }],
    history: [{ ...queueEpisode, watched }],
    corrections: [],
    playback: [],
    progressWrites: [],
    queueReads: 0,
    historyReads: 0,
  };
  await page.route(`${apiOrigin}/api/**`, async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
    if (path === '/api/auth/me') return json(route, {
      account: { id: '7', username: 'alex', name: 'Alex', role: 'member' },
      profiles: [{ id: '1', name: 'Alex', setup_complete: true }],
      profile_id: null, restricted: false, profile_setup_required: false,
    });
    if (path === '/api/auth/profile') return json(route, { profile_id: '1' });
    if (path === '/api/profiles/1/continue/page') {
      state.queueReads += 1;
      return json(route, { items: state.queue, offset: 0, total: state.queue.length, next_offset: null });
    }
    if (path === '/api/profiles/1/progress' && request.method() === 'GET') {
      state.historyReads += 1;
      return json(route, state.history);
    }
    if (path === '/api/profiles/1/progress/correct' && request.method() === 'PUT') {
      const body = JSON.parse(request.postData() || '{}') as Record<string, unknown>;
      state.corrections.push(body);
      const isWatched = body.action === 'watched';
      state.queue = isWatched ? [] : [{ ...queueEpisode, watched: false }];
      state.history = [{ ...queueEpisode, watched: isWatched }];
      return json(route, { ok: true });
    }
    if (path === '/api/profiles/1/progress' && request.method() === 'PUT') {
      state.progressWrites.push(JSON.parse(request.postData() || '{}') as Record<string, unknown>);
      return json(route, { ok: true });
    }
    if (path === '/api/profiles/1/favorites') return json(route, []);
    if (path === '/api/profiles/1/preferences') return json(route, {
      audio_language: 'en', subtitle_language: 'en', subtitles_enabled: false,
      subtitle_size: 'normal', subtitle_style: 'system', quality: 'auto', autoplay: true,
    });
    if (path === '/api/catalogs') return json(route, [{ id: 'popular', name: 'Popular', type: 'movie', addon_id: 2, supports_search: true, supports_skip: true }]);
    if (path === '/api/discover') return json(route, { metas: [catalogMovie], has_more: false, next_skip: null });
    if (path === '/api/live') return json(route, { channels: [], total: 0 });
    if (path === '/api/live/categories') return json(route, { categories: [], total: 0 });
    if (path === '/api/addons') return json(route, []);
    if (path === '/api/parent/status') return json(route, { pin_configured: false, unlocked: false, restricted: false });
    if (path === '/api/streams' && request.method() === 'POST') return json(route, { id: 'queue-job' });
    if (path === '/api/streams/queue-job') return json(route, {
      events: [{ seq: 1, source: 'addon:queue', streams: [{ id: 'queue-source', name: 'Queue source', title: 'Queue source', source_addon_id: 'addon:queue', source_fingerprint: 'queue-release' }] }],
      done: true,
    });
    if (path === '/api/playback' && request.method() === 'POST') {
      const body = JSON.parse(request.postData() || '{}') as Record<string, unknown>;
      state.playback.push(body);
      return json(route, {
        id: `playback-${state.playback.length}`, url: `/media/playback-${state.playback.length}/capability/index.m3u8`,
        format: 'hls', mode: 'direct', video_mode: 'copy', audio_mode: 'copy', position: Number(body.position ?? 0),
        duration: 120, live: false, audio_tracks: [], subtitle_tracks: [], subtitles_supported: false,
      });
    }
    return json(route, { error: `unhandled ${path}` }, 404);
  });
  return state;
}

async function enterHome(page: Page, watched = false) {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const state = await installFixture(page, watched);
  await page.addInitScript(() => {
    const media = HTMLMediaElement.prototype;
    const playing = new WeakMap<HTMLMediaElement, boolean>();
    Object.defineProperty(media, 'duration', { configurable: true, get: () => 120 });
    Object.defineProperty(media, 'paused', { configurable: true, get(this: HTMLMediaElement) { return playing.get(this) !== true; } });
    media.load = function(this: HTMLMediaElement) { queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata'))); };
    media.play = function(this: HTMLMediaElement) { playing.set(this, true); queueMicrotask(() => this.dispatchEvent(new Event('play'))); return Promise.resolve(); };
    media.pause = function(this: HTMLMediaElement) { playing.set(this, false); this.dispatchEvent(new Event('pause')); };
  });
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), {
    key: `viptv-device:${apiOrigin}`,
    token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 },
  });
  await page.goto('/?platform=vizio');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Queue Show' })).toBeVisible();
  return { state, assertNoPageErrors: () => expect(pageErrors).toEqual([]) };
}

test.describe('Vizio queue progress contract', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'remote UI acceptance uses Chromium only');

  test('Mark watched posts the canonical correction and refreshes queue plus history', async ({ page }) => {
    test.skip(test.info().project.name !== 'vizio', 'the hosted remote surface is shared; exercise it once');
    const { state, assertNoPageErrors } = await enterHome(page);
    const card = page.getByRole('button', { name: 'Queue Show' });
    await card.click({ button: 'right' });
    await expect(page.getByRole('button', { name: 'Mark watched' })).toBeVisible();
    await page.getByRole('button', { name: 'Mark watched' }).press('Enter');

    await expect.poll(() => state.corrections).toEqual([
      expect.objectContaining({ id: queueEpisode.id, type: 'series', action: 'watched', duration: 120 }),
    ]);
    await expect(card).toHaveCount(0);
    await expect.poll(() => state.queueReads).toBeGreaterThanOrEqual(2);
    await expect.poll(() => state.historyReads).toBeGreaterThanOrEqual(2);
    await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    assertNoPageErrors();
  });

  test('Mark unwatched re-enters Continue Watching and its queue menu exposes restart', async ({ page }) => {
    test.skip(test.info().project.name !== 'vizio', 'the hosted remote surface is shared; exercise it once');
    const { state, assertNoPageErrors } = await enterHome(page, true);
    const card = page.getByRole('button', { name: 'Queue Show' });
    await card.click({ button: 'right' });
    await expect(page.getByRole('button', { name: 'Mark unwatched' })).toBeVisible();
    await page.getByRole('button', { name: 'Mark unwatched' }).press('Enter');

    await expect.poll(() => state.corrections).toEqual([
      expect.objectContaining({ id: queueEpisode.id, type: 'series', action: 'unwatched', duration: 120 }),
    ]);
    await expect(card).toBeVisible();
    await expect(card).toBeFocused();
    await card.click({ button: 'right' });
    await expect(page.getByRole('button', { name: 'Watch from the beginning' })).toBeVisible();
    await page.getByRole('button', { name: 'Watch from the beginning' }).press('Enter');
    await expect(page.getByRole('button', { name: 'Queue source' })).toBeVisible();
    await page.getByRole('button', { name: 'Queue source' }).press('Enter');
    await expect.poll(() => state.playback).toEqual([
      expect.objectContaining({ stream_id: 'queue-source', position: 0 }),
    ]);
    expect(state.history).toEqual([{ ...queueEpisode, watched: false }]);
    expect(state.progressWrites).toEqual([]);
    await expect(page.getByRole('alert')).toHaveCount(0);
    assertNoPageErrors();
  });
});
