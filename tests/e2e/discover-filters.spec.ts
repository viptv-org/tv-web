import { expect, test, type Route } from '@playwright/test';

const apiOrigin = 'https://viptv.syek.tech';
const cors = {
  'access-control-allow-origin': 'http://127.0.0.1:4173',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
};
const profile = { id: '1', name: 'Alex', setup_complete: true, avatar: 'critters-1.png' };
const calendar = {
  id: 'calendar', name: 'Calendar', type: 'movie', addon_id: 2,
  supports_search: true, supports_skip: true, genres: ['Drama', 'Comedy'],
  extra: [
    { name: 'year', is_required: true, options: ['2024', '2025'], default: '2024', options_limit: 2 },
    { name: 'genre', is_required: false, options: ['Drama', 'Comedy'], default: null, options_limit: 16 },
    { name: 'country', is_required: false, options: [], default: null, options_limit: 1 },
    { name: 'search', is_required: false, options: [], default: null, options_limit: 1 },
    { name: 'skip', is_required: false, options: [], default: null, options_limit: 1 },
  ],
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
}

test('Discover applies declared defaults and resets pagination for genre, input and catalog search filters', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'the shared browse controller needs one browser contract run');
  const discovers: URL[] = [];
  const preferences = { audio_language: 'en', subtitle_language: 'en', subtitles_enabled: false, subtitle_size: 'normal', subtitle_style: 'system', quality: 'auto', autoplay: true };
  await page.route(`${apiOrigin}/api/**`, async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (path === '/api/auth/me') return json(route, { account: { id: '7', username: 'alex', name: 'Alex', role: 'member' }, profiles: [profile], profile_id: null, restricted: false, profile_setup_required: false });
    if (path === '/api/auth/profile') return json(route, { profile_id: '1' });
    if (path === '/api/profiles/1/continue/page') return json(route, { items: [], offset: 0, total: 0, next_offset: null });
    if (path === '/api/profiles/1/progress' || path === '/api/profiles/1/favorites') return json(route, []);
    if (path === '/api/profiles/1/preferences') return json(route, preferences);
    if (path === '/api/catalogs') return json(route, [calendar]);
    if (path === '/api/live') return json(route, { channels: [], total: 0 });
    if (path === '/api/discover') {
      discovers.push(url);
      const skip = url.searchParams.get('skip') ?? '0';
      return json(route, { metas: [{ id: `movie-${skip}`, type: 'movie', name: `Calendar ${skip}` }], has_more: skip === '0', next_skip: skip === '0' ? 20 : null });
    }
    return json(route, { error: `unhandled fixture route ${path}` }, 404);
  });
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), {
    key: `viptv-device:${apiOrigin}`,
    token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 },
  });

  await page.goto('/?platform=vizio');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await page.getByRole('button', { name: 'Discover' }).click();
  await expect(page.getByRole('button', { name: 'Year: 2024' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Genre: Any' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Country: Any' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search catalog: Any' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load more' })).toBeVisible();
  let last = discovers.at(-1)!;
  expect(last.searchParams.get('skip')).toBe('0');
  expect(JSON.parse(last.searchParams.get('extras') ?? '{}')).toEqual({ year: '2024' });

  await page.getByRole('button', { name: 'Genre: Any' }).click();
  await page.getByRole('button', { name: 'Drama' }).click();
  await expect(page.getByRole('button', { name: 'Genre: Drama' })).toBeVisible();
  last = discovers.at(-1)!;
  expect(last.searchParams.get('skip')).toBe('0');
  expect(last.searchParams.get('genre')).toBe('Drama');
  expect(JSON.parse(last.searchParams.get('extras') ?? '{}')).toEqual({ year: '2024' });

  await page.getByRole('button', { name: 'Country: Any' }).click();
  await page.getByRole('textbox', { name: 'Country' }).fill('US');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Country: US' })).toBeVisible();
  last = discovers.at(-1)!;
  expect(last.searchParams.get('skip')).toBe('0');
  expect(JSON.parse(last.searchParams.get('extras') ?? '{}')).toEqual({ year: '2024', country: 'US' });

  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.getByRole('button', { name: 'Calendar 20' })).toBeVisible();
  expect(discovers.at(-1)!.searchParams.get('skip')).toBe('20');

  await page.getByRole('button', { name: 'Search catalog: Any' }).click();
  await page.getByRole('textbox', { name: 'Search catalog' }).fill('moon');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Search catalog: moon' })).toBeVisible();
  last = discovers.at(-1)!;
  expect(last.searchParams.get('skip')).toBe('0');
  expect(last.searchParams.get('search')).toBe('moon');
  expect(last.searchParams.get('genre')).toBe('Drama');
  expect(JSON.parse(last.searchParams.get('extras') ?? '{}')).toEqual({ year: '2024', country: 'US' });
  await expect(page.getByRole('alert')).toHaveCount(0);
});
