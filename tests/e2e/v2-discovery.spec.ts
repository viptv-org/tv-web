import { expect, test } from '@playwright/test';
import { apiOrigin, installBackend, movie } from './helpers/responsiveBackend';

for (const partial of [false, true]) {
  test(`v2 discovery: ${partial ? 'healthy provider survives failure' : 'safe failure and fresh retry'}`, async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    // Deny all unhandled external traffic, including third-party artwork.
    await page.route('**/*', route => new URL(route.request().url()).origin === origin
      ? route.continue() : route.abort());
    const fixture = await installBackend(page);
    let starts = 0;
    const headers = {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type',
    };
    await page.route(`${apiOrigin}/api/v2/streams**`, route => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (request.method() === 'POST') {
        starts++;
        expect(request.postDataJSON().id).toBe(movie.id);
        return route.fulfill({ headers, json: { id: `job-${starts}` } });
      }
      return route.fulfill({ headers, json: { done: true, events: [
        { seq: 1, source: 'provider:1', streams: [], error_code: 'provider_connection_limit', error: 'http://private.invalid/user/password/stream' },
        ...(partial ? [{ seq: 2, source: 'provider:2', streams: [{ id: 'healthy-stream', name: 'Healthy source', title: '1080p', source_name: 'Healthy provider', source_provider_id: '2' }] }] : []),
      ] } });
    });
    await page.goto('/tv/?renderer=react');
    await page.getByRole('button', { name: 'Alex', exact: true }).click();
    await page.locator('.media-card').filter({ hasText: movie.name }).click();
    await page.locator('[data-focus-id="detail-source"]').click();
    if (partial) {
      await expect(page.locator('[data-focus-id="source-0"]')).toBeVisible();
      await expect(page.getByRole('alert')).toHaveCount(0);
    } else {
      await expect(page.getByRole('alert')).toContainText('connection limit');
      const previous = starts;
      await page.goBack();
      await page.locator('[data-focus-id="detail-source"]').click();
      await expect.poll(() => starts).toBeGreaterThan(previous);
      await expect(page.getByRole('alert')).toContainText('connection limit');
    }
    await expect(page.locator('body')).not.toContainText('private.invalid');
    expect(fixture.requests.some(request => request.path.startsWith('/api/streams'))).toBe(false);
    expect(fixture.errors).toEqual([]);
  });
}
