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
  /** Direct uses the active HTML adapter; remux requires a managed replacement. */
  readonly playbackMode?: 'direct' | 'remux';
  /** Server-provided facts for the shared track dialog. */
  readonly audioTracks?: readonly Record<string, unknown>[];
};
type FixtureState = {
  readonly playbackRequests: Array<Record<string, unknown>>;
  /** Safe request intent only; no source URL, headers, or credentials enter assertions. */
  readonly playbackIntents: Array<Pick<Record<string, unknown>, 'stream_id' | 'position' | 'audio_track_index' | 'subtitle_track_index' | 'subtitles_off'>>;
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
  const state: FixtureState = { playbackRequests: [], playbackIntents: [], progress: [], nextRequests: 0 };
  const preferences = { audio_language: 'en', subtitle_language: 'en', subtitles_enabled: false, subtitle_size: 'normal', subtitle_style: 'system', quality: 'auto', autoplay: true };
  await page.route('**/fixture.svg', route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="144" />' }));
  await page.route(`${apiOrigin}/api/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    // Stream discovery IDs contain the Stremio-style `series:season:episode`
    // identifier, which the real client correctly percent-encodes in its URL.
    const path = decodeURIComponent(url.pathname);
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
    if (path === '/api/auth/me') return json(route, { account: { id: '7', username: 'alex', name: 'Alex', role: 'member' }, profiles: [{ id: '1', name: 'Alex', setup_complete: true }], profile_id: null, restricted: false, profile_setup_required: false });
    if (path === '/api/auth/profile') return json(route, { profile_id: '1' });
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
      state.playbackIntents.push({ stream_id: body.stream_id, position: body.position, audio_track_index: body.audio_track_index, subtitle_track_index: body.subtitle_track_index, subtitles_off: body.subtitles_off });
      const id = `playback-${state.playbackRequests.length}`;
      const position = state.playbackRequests.length === 1 ? options.resumeAt ?? 0 : 0;
      return json(route, { id, url: `/media/${id}/capability/index.m3u8`, format: 'hls', mode: options.playbackMode ?? 'remux', video_mode: 'copy', audio_mode: 'copy', position, live: false, duration: 120, audio_tracks: options.audioTracks ?? [], subtitle_tracks: [], subtitles_supported: false });
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

/**
 * Shared React remote contract. These run only through the Vizio HTML boundary:
 * Samsung AVPlay owns its own hardware decoder/remote validation, while the
 * gestures and server contract are shared by the hosted TV surface.
 */
test.describe('Vizio remote player contract', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'requires the browser HTMLMediaElement boundary');

  test('preview seeks accelerate, commit only after an 800ms release, and Back cancels the preview', async ({ page }) => {
    test.skip(test.info().project.name !== 'vizio', 'shared gesture verified once against Vizio HTML5; AVPlay requires Samsung hardware validation');
    const noPageErrors = await installVizioMedia(page);
    const state = await installBackend(page, { playbackMode: 'direct' });
    await enterFirstEpisode(page, state);

    await page.getByRole('button', { name: 'Pause' }).press('ArrowUp');
    await expect(page.locator('[data-focus-id="timeline"]')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('0:10 / 2:00')).toBeVisible();
    expect(state.playbackRequests).toHaveLength(1);
    await page.keyboard.press('Escape');
    await expect(page.getByText('0:10 / 2:00')).toBeHidden();
    expect(state.playbackRequests).toHaveLength(1);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(760);
    expect(state.playbackRequests).toHaveLength(1);
    await page.waitForTimeout(100);
    // Direct mode seeks the active adapter, so it must not create a server replacement.
    expect(state.playbackRequests).toHaveLength(1);
    await page.evaluate(() => {
      for (let count = 0; count < 6; count++)
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
    });
    await expect(page.getByText('2:00 / 2:00')).toBeVisible();
    noPageErrors();
  });

  test('overlay timeout pauses for track dialog and Back restores its originating control before hiding chrome', async ({ page }) => {
    test.skip(test.info().project.name !== 'vizio', 'shared remote UI verified against Vizio HTML5; Tizen requires hardware remote validation');
    await page.clock.install();
    const noPageErrors = await installVizioMedia(page);
    const state = await installBackend(page, {
      playbackMode: 'direct',
      audioTracks: [{ input_index: 0, title: 'Stereo', selectable: true, supported: true }],
    });
    await enterFirstEpisode(page, state);

    const overlay = page.locator('.player-overlay');
    await expect(overlay).toBeVisible();
    await page.clock.fastForward(7000);
    await expect(overlay).toBeHidden();

    // Any recognized remote input reveals chrome again. Opening Audio makes the
    // modal own focus and must cancel the overlay timer while it is present.
    await page.keyboard.press('ArrowUp');
    await expect(overlay).toBeVisible();
    const audio = page.getByRole('button', { name: 'Audio' });
    await audio.press('Enter');
    await expect(page.getByRole('heading', { name: 'Audio' })).toBeVisible();
    await expect(page.locator('[data-focus-id="modal-0"]')).toBeFocused();
    await page.clock.fastForward(8000);
    await expect(overlay).toBeVisible();

    // First Back dismisses the track dialog and restores its originating player
    // control. The next Back hides open chrome; it must not exit playback yet.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Audio' })).toBeHidden();
    await expect(audio).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
    await expect(page.locator('.tv-screen.playing')).toBeVisible();
    expect(state.playbackRequests).toHaveLength(1);
    noPageErrors();
  });

  test('managed seek replaces the server session and unsupported tracks remain visibly unavailable', async ({ page }) => {
    test.skip(test.info().project.name !== 'vizio', 'managed replacement is shared; exercise one web-TV platform boundary');
    const noPageErrors = await installVizioMedia(page);
    const state = await installBackend(page);
    await page.route(`${apiOrigin}/api/playback`, async route => {
      const body = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;
      state.playbackRequests.push(body);
      state.playbackIntents.push({ stream_id: body.stream_id, position: body.position, audio_track_index: body.audio_track_index, subtitle_track_index: body.subtitle_track_index, subtitles_off: body.subtitles_off });
      return json(route, {
        id: `managed-${state.playbackRequests.length}`, url: `/media/managed/capability/index.m3u8`, format: 'hls', mode: 'remux', video_mode: 'copy', audio_mode: 'copy', position: Number(body.position ?? 0), live: false, duration: 120,
        audio_tracks: [{ input_index: 0, title: 'Stereo', selectable: true, supported: true }, { input_index: 1, title: 'Surround', selectable: false, supported: false }],
        subtitle_tracks: [{ input_index: 2, title: 'English', selectable: true, supported: true }], subtitles_supported: true,
      });
    });
    await enterFirstEpisode(page, state);
    await page.getByRole('button', { name: 'Pause' }).press('ArrowUp');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect.poll(() => state.playbackRequests.length).toBe(2);
    expect(state.playbackRequests[1]).toMatchObject({ position: 10 });

    await page.getByRole('button', { name: 'Audio' }).press('Enter');
    await expect(page.getByText('Surround · unavailable')).toBeVisible();
    await page.getByText('Surround · unavailable').press('Enter');
    await expect(page.getByText('This track is not supported on this TV.')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).press('Enter');
    await page.getByRole('button', { name: 'Subtitles' }).press('Enter');
    await page.getByRole('button', { name: 'Off' }).press('Enter');
    await expect.poll(() => state.playbackRequests.length).toBe(3);
    expect(state.playbackIntents).toEqual([
      { stream_id: 'first-source', position: 0, audio_track_index: undefined, subtitle_track_index: undefined, subtitles_off: undefined },
      { stream_id: 'first-source', position: 10, audio_track_index: undefined, subtitle_track_index: undefined, subtitles_off: undefined },
      { stream_id: 'first-source', position: 10, audio_track_index: undefined, subtitle_track_index: undefined, subtitles_off: true },
    ]);
    noPageErrors();
  });

  test('Exit saves progress and returns to the title source context', async ({ page }) => {
    test.skip(test.info().project.name !== 'vizio', 'exit behavior is shared; Vizio supplies the actual browser playback boundary');
    const noPageErrors = await installVizioMedia(page);
    const state = await installBackend(page);
    await enterFirstEpisode(page, state);
    await page.getByRole('button', { name: 'Exit' }).press('Enter');
    await expect(page.getByRole('button', { name: 'Current 1080p' })).toBeVisible();
    await expect.poll(() => state.progress.length).toBeGreaterThan(0);
    expect(state.progress[0]).toMatchObject({ id: first.id, source_addon_id: 'addon:current', source_fingerprint: 'first' });
    noPageErrors();
  });
});
