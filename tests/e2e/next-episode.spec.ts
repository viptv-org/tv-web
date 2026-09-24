import { expect, test, type Page, type Route } from '@playwright/test';

declare global { interface Window { finishFixturePlayback(video: HTMLMediaElement): void; } }

const apiOrigin = 'https://viptv.syek.tech';
const corsHeaders = {
  'access-control-allow-origin': 'http://127.0.0.1:4173',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
};

const show = {
  id: 'fixture-show', type: 'series', name: 'Fixture Show', title: 'Fixture Show',
  description: 'A two episode continuation fixture.', genres: ['Drama'], poster: '/fixture.svg', background: '/fixture.svg',
};
const first = {
  id: 'fixture-show:1:1', type: 'series', name: 'Fixture Show', title: 'Pilot', episode_title: 'Pilot',
  series_id: show.id, season: 1, episode: 1, duration: 120, source_addon_id: 'addon:current', source_fingerprint: 'first',
};
const second = {
  id: 'fixture-show:1:2', type: 'series', name: 'Fixture Show', title: 'The Better Source', episode_title: 'The Better Source',
  series_id: show.id, season: 1, episode: 2, duration: 120,
};
type FixtureOptions = {
  readonly queue?: readonly Record<string, unknown>[];
  /** Holds continuation discovery long enough for the real Back cancellation boundary. */
  readonly delayNext?: boolean;
  /** The initial player begins in the final ten seconds, an explicit Resume case. */
  readonly resumeAt?: number;
};
type FixtureState = {
  readonly playbackRequests: Array<Record<string, unknown>>;
  readonly progress: Array<Record<string, unknown>>;
  nextRequests: number;
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', headers: corsHeaders, body: JSON.stringify(body) });
}

/** Controlled HTML media edge: UI/controller code receives the real DOM events. */
async function installVizioMedia(page: Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const media = HTMLMediaElement.prototype;
    // This fixture simulates native HLS; real MSE decoding has a separate test.
    const nativeCanPlayType = media.canPlayType;
    media.canPlayType = function(type: string) {
      return /mpegurl/i.test(type) ? 'probably' : nativeCanPlayType.call(this, type);
    };
    const positions = new WeakMap<HTMLMediaElement, number>();
    const playing = new WeakMap<HTMLMediaElement, boolean>();
    const completed = new WeakMap<HTMLMediaElement, boolean>();
    const sources = new WeakMap<HTMLMediaElement, string>();
    // The adapter is under test, not Chromium's HLS stack. Keeping the
    // capability value here prevents the browser from independently fetching
    // and rejecting the synthetic HLS URL as a decoder error.
    Object.defineProperty(media, 'src', {
      configurable: true,
      get() { return sources.get(this as HTMLMediaElement) ?? ''; },
      set(value: string) { sources.set(this as HTMLMediaElement, String(value)); },
    });
    Object.defineProperty(media, 'duration', { configurable: true, get() { return 120; } });
    Object.defineProperty(media, 'currentTime', {
      configurable: true,
      get() { return positions.get(this as HTMLMediaElement) ?? 0; },
      set(value: number) {
        positions.set(this as HTMLMediaElement, Number(value));
        completed.set(this as HTMLMediaElement, false);
        this.dispatchEvent(new Event('timeupdate'));
      },
    });
    Object.defineProperty(media, 'paused', { configurable: true, get() { return playing.get(this as HTMLMediaElement) !== true; } });
    Object.defineProperty(media, 'ended', { configurable: true, get() { return completed.get(this as HTMLMediaElement) === true; } });
    media.load = function(this: HTMLMediaElement) { queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata'))); };
    media.play = function(this: HTMLMediaElement) {
      playing.set(this, true);
      completed.set(this, false);
      queueMicrotask(() => this.dispatchEvent(new Event('play')));
      return Promise.resolve();
    };
    media.pause = function(this: HTMLMediaElement) { playing.set(this, false); this.dispatchEvent(new Event('pause')); };
    window.finishFixturePlayback = video => {
      positions.set(video, 120);
      playing.set(video, false);
      completed.set(video, true);
      video.dispatchEvent(new Event('timeupdate'));
      video.dispatchEvent(new Event('ended'));
    };
  });
  return () => expect(pageErrors).toEqual([]);
}

async function installBackend(page: Page, options: FixtureOptions = {}): Promise<FixtureState> {
  const state: FixtureState = { playbackRequests: [], progress: [], nextRequests: 0 };
  const preferences = { audio_language: 'en', subtitle_language: 'en', subtitles_enabled: false, subtitle_size: 'normal', subtitle_style: 'system', quality: 'auto', autoplay: true };
  await page.route('**/fixture.svg', route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="144" />' }));
  let selectedProfileId: string | null = null;
  await page.route(`${apiOrigin}/api/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    // Stream discovery IDs contain the Stremio-style `series:season:episode`
    // identifier, which the real client correctly percent-encodes in its URL.
    const path = decodeURIComponent(url.pathname);
    if (/^\/api\/profiles\/[^/]+\/progress\/series$/.test(path)) return json(route, []);
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
    if (path === '/api/auth/me') return json(route, { account: { id: '7', username: 'alex', name: 'Alex', role: 'member' }, profiles: [{ id: '1', name: 'Alex', setup_complete: true }], profile_id: selectedProfileId, restricted: false, profile_setup_required: false });
    if (path === '/api/auth/profile') {
      selectedProfileId = String(route.request().postDataJSON().profile_id);
      return json(route, { profile_id: selectedProfileId });
    }
    if (path === '/api/profiles/1/continue/page') return json(route, { items: options.queue ?? [], offset: 0, total: options.queue?.length ?? 0, next_offset: null });
    if (path === '/api/profiles/1/progress' && request.method() === 'GET') return json(route, []);
    if (path === '/api/profiles/1/favorites' && request.method() === 'GET') return json(route, []);
    if (path === '/api/profiles/1/preferences') return json(route, preferences);
    if (path === '/api/catalogs') return json(route, [{ id: 'series', name: 'Series', type: 'series', addon_id: 2, supports_search: true, supports_skip: true }]);
    if (path === '/api/discover') return json(route, { metas: [show], has_more: false, next_skip: null });
    if (path === `/api/meta/series/${show.id}` || path === `/api/meta/series/${first.id}`)
      return json(route, { meta: { ...show, videos: [first, second] } });
    if (path === '/api/streams' && request.method() === 'POST') {
      const body = JSON.parse(request.postData() || '{}') as { id?: string };
      return json(route, { id: `streams-${body.id}` });
    }
    if (path === `/api/streams/streams-${first.id}`) return json(route, { events: [{ seq: 1, source: 'addon:current', streams: [{ id: 'first-source', name: 'Current 1080p', title: '1080p H.264 English', source_addon_id: 'addon:current', source_fingerprint: 'first', audioEvidenceScore: 8 }] }], done: true });
    if (path === `/api/streams/streams-${second.id}`) return json(route, { events: [{ seq: 1, source: 'addon:ranked', streams: [
      { id: 'next-incompatible', name: '2160p HEVC Spanish', title: '2160p HEVC Spanish', source_addon_id: 'addon:ranked', audioEvidenceScore: 0 },
      { id: 'next-ranked', name: '1080p H.264 English', title: '1080p H.264 English', source_addon_id: 'addon:ranked', audioEvidenceScore: 8 },
    ] }], done: true });
    if (path === '/api/profiles/1/continue/next') {
      state.nextRequests += 1;
      if (options.delayNext) await new Promise(resolve => setTimeout(resolve, 750));
      return json(route, { status: 'next', item: second });
    }
    if (path === '/api/playback' && request.method() === 'POST') {
      const body = JSON.parse(request.postData() || '{}') as Record<string, unknown>;
      state.playbackRequests.push(body);
      const id = `playback-${state.playbackRequests.length}`;
      const position = state.playbackRequests.length === 1 ? options.resumeAt ?? 0 : 0;
      return json(route, { id, url: `/media/${id}/capability/index.m3u8`, format: 'hls', mode: 'remux', video_mode: 'copy', audio_mode: 'copy', position, live: false, duration: 120, audio_tracks: [], subtitle_tracks: [], subtitles_supported: false });
    }
    if (path === '/api/profiles/1/progress' && request.method() === 'PUT') {
      state.progress.push(JSON.parse(request.postData() || '{}') as Record<string, unknown>);
      return json(route, { ok: true });
    }
    if (path.startsWith('/api/playback/') || path === '/api/live/categories' || path === '/api/addons') return json(route, path === '/api/live/categories' ? { categories: [], total: 0 } : []);
    return json(route, { error: `unhandled ${path}` }, 404);
  });
  return state;
}

async function enterFirstEpisode(page: Page, state: FixtureState) {
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await page.goto('/?platform=vizio');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await page.getByRole('button', { name: 'Fixture Show' }).press('Enter');
  await page.locator('[data-focus-id="episode-0"]').press('Enter');
  await page.getByRole('button', { name: 'Current 1080p' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  expect(state.playbackRequests).toHaveLength(1);
}

test('Vizio: explicit Next preserves the selected series and uses the best ranked continuation source', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'the shared Next controller needs one browser platform boundary');
  const noPageErrors = await installVizioMedia(page);
  const state = await installBackend(page);
  await enterFirstEpisode(page, state);

  await page.getByRole('button', { name: 'Next episode' }).press('Enter');
  await expect.poll(() => state.playbackRequests).toHaveLength(2);
  expect(state.playbackRequests[1]).toMatchObject({ stream_id: 'next-ranked', position: 0 });
  await expect(page.locator('.player-context')).toContainText('S1 · E2 · The Better Source');
  expect(state.progress[0]).toMatchObject({ id: first.id });
  noPageErrors();
});

test('Vizio: Back cancels a still-preparing Next without replacing the outgoing episode', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'the cancellation boundary is shared by hosted TV packages');
  const noPageErrors = await installVizioMedia(page);
  const state = await installBackend(page, { delayNext: true });
  await enterFirstEpisode(page, state);

  await page.getByRole('button', { name: 'Next episode' }).press('Enter');
  await expect(page.locator('.vx-preparing')).toContainText('Preparing playback');
  await expect.poll(() => state.nextRequests).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.waitForTimeout(900);
  expect(state.nextRequests).toBe(1);
  expect(state.playbackRequests).toHaveLength(1);
  await expect(page.locator('.player-context')).toContainText('S1 · E1 · Pilot');
  noPageErrors();
});

test('Vizio: final-ten autoplay requires playing instead of advancing while paused', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'the shared autoplay policy needs one media event boundary');
  const noPageErrors = await installVizioMedia(page);
  const state = await installBackend(page);
  await enterFirstEpisode(page, state);
  const video = page.locator('video');

  // The same final-ten timeupdate only qualifies once playback is active.
  await page.getByRole('button', { name: 'Pause' }).press('Enter');
  await video.evaluate(node => { if (!(node instanceof HTMLVideoElement)) throw new Error("Expected video"); node.currentTime = 116; });
  await page.waitForTimeout(100);
  expect(state.nextRequests).toBe(0);
  await page.getByRole('button', { name: 'Play' }).press('Enter');
  await expect.poll(() => state.playbackRequests).toHaveLength(2);
  expect(state.playbackRequests[1]).toMatchObject({ stream_id: 'next-ranked' });
  noPageErrors();
});

test('Vizio: an explicit final-ten Resume waits for ended before continuing', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'the explicit-resume guard is shared by both hosted platforms');
  const noPageErrors = await installVizioMedia(page);
  const resumed = { ...first, position: 115, duration: 120, queue_status: 'resume' };
  const state = await installBackend(page, { queue: [resumed], resumeAt: 115 });
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await page.goto('/?platform=vizio');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await page.getByRole('button', { name: 'Resume', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  const video = page.locator('video');

  // resumeRemainder is set by the explicit 115-second request; a subsequent
  // playing/timeupdate cannot skip the remainder of that episode.
  await video.evaluate(node => { if (!(node instanceof HTMLVideoElement)) throw new Error("Expected video"); node.currentTime = 116; });
  await page.waitForTimeout(100);
  expect(state.nextRequests).toBe(0);

  await video.evaluate(node => { if (!(node instanceof HTMLVideoElement)) throw new Error("Expected video"); window.finishFixturePlayback(node); });
  await expect.poll(() => state.playbackRequests).toHaveLength(2);
  expect(state.playbackRequests[1]).toMatchObject({ stream_id: 'next-ranked' });
  noPageErrors();
});

test('Vizio: Home next-up management resumes the previous episode and Back returns to title detail', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'Home Resume navigation is shared by both hosted platforms');
  const noPageErrors = await installVizioMedia(page);
  const queued = { ...second, queue_status: 'next', previous_episode: first, position: 12, duration: 120 };
  const state = await installBackend(page, { queue: [queued] });
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await page.goto('/?platform=vizio');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  const card = page.getByRole('button', { name: 'Fixture Show' }).first();
  await card.click({ button: 'right' });
  await expect(page.getByRole('button', { name: 'Resume previous episode' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume previous episode' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  expect(state.playbackRequests[0]).toMatchObject({ stream_id: 'first-source' });
  // Visible player chrome is one Back level; the next Back returns to the
  // Home Resume title context.
  await page.keyboard.press('Escape');
  await expect(page.locator('.tv-screen.playing')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Fixture Show' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Season 1' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  noPageErrors();
});

test('Vizio: Next stays with the current IPTV account even when another provider arrives first', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'continuation account policy is shared');
  const noPageErrors = await installVizioMedia(page);
  const state = await installBackend(page);
  await page.route(`${apiOrigin}/api/streams/**`, async route => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    if (/^\/api\/profiles\/[^/]+\/progress\/series$/.test(path)) return json(route, []);
    if (path === `/api/streams/streams-${first.id}`) return json(route, { events: [{ seq: 1, source: 'iptv:7', streams: [
      { id: 'first-source', name: 'Current 1080p', source_addon_id: 'iptv:7', source_fingerprint: 'first' },
    ] }], done: true });
    if (path === `/api/streams/streams-${second.id}`) return json(route, { events: [{ seq: 1, source: 'iptv:8', streams: [
      { id: 'wrong-account', name: 'Other provider', source_addon_id: 'iptv:8' },
    ] }, { seq: 2, source: 'iptv:7', streams: [
      { id: 'same-account', name: 'Current provider', source_addon_id: 'iptv:7' },
    ] }], done: true });
    return route.fallback();
  });
  await enterFirstEpisode(page, state);
  await page.getByRole('button', { name: 'Next episode' }).press('Enter');
  await expect.poll(() => state.playbackRequests).toHaveLength(2);
  expect(state.playbackRequests[1]).toMatchObject({ stream_id: 'same-account', position: 0 });
  await expect(page.locator('.player-context')).toContainText('S1 · E2');
  noPageErrors();
});

test('Vizio: failed Next tries at most three distinct sources and preserves the outgoing episode', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'bounded continuation recovery is shared');
  const noPageErrors = await installVizioMedia(page);
  const state = await installBackend(page);
  await page.route(`${apiOrigin}/api/streams/**`, async route => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    if (/^\/api\/profiles\/[^/]+\/progress\/series$/.test(path)) return json(route, []);
    if (path !== `/api/streams/streams-${second.id}`) return route.fallback();
    return json(route, { events: [{ seq: 1, source: 'addon:ranked', streams: [1, 2, 3, 4].map(index => ({
      id: `failed-next-${index}`, name: '1080p H.264 English', source_addon_id: 'addon:ranked', audioEvidenceScore: 8,
    })) }], done: true });
  });
  await page.route(`${apiOrigin}/api/playback`, async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;
    if (body.stream_id === 'first-source') return route.fallback();
    state.playbackRequests.push(body);
    return json(route, { error: 'Source is temporarily unavailable.' }, 503);
  });
  await enterFirstEpisode(page, state);
  await page.getByRole('button', { name: 'Next episode' }).press('Enter');
  await expect(page.getByRole('alert')).toBeVisible();
  expect(state.playbackRequests.map(request => request.stream_id)).toEqual([
    'first-source', 'failed-next-1', 'failed-next-2', 'failed-next-3',
  ]);
  await expect(page.locator('.player-context')).toContainText('S1 · E1 · Pilot');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  noPageErrors();
});

test('Vizio: failed explicit Resume offers exact Retry and manual source choice at the saved position', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'source recovery intent is shared');
  const noPageErrors = await installVizioMedia(page);
  const state = await installBackend(page, { queue: [{ ...first, position: 42, queue_status: 'resume' }] });
  await page.route(`${apiOrigin}/api/playback`, async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    state.playbackRequests.push(JSON.parse(route.request().postData() || '{}') as Record<string, unknown>);
    return json(route, { error: 'Source is temporarily unavailable.' }, 503);
  });
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await page.goto('/?platform=vizio');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await page.getByRole('button', { name: 'Resume', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  expect(state.playbackRequests).toHaveLength(1);
  await page.getByRole('button', { name: 'Retry', exact: true }).press('Enter');
  await expect.poll(() => state.playbackRequests).toHaveLength(2);
  await expect(page.getByRole('button', { name: 'Choose another source' })).toBeVisible();
  await page.getByRole('button', { name: 'Choose another source' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Current 1080p' })).toBeVisible();
  expect(state.playbackRequests).toHaveLength(2);
  await page.getByRole('button', { name: 'Current 1080p' }).press('Enter');
  await expect.poll(() => state.playbackRequests).toHaveLength(3);
  expect(state.playbackRequests.every(request => request.stream_id === 'first-source' && request.position === 42)).toBe(true);
  await page.getByRole('button', { name: 'Back', exact: true }).press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Continue watching', exact: true })).toBeVisible();
  noPageErrors();
});
