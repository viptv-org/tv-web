import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { installBackend } from './backend.ts';
import { fixtureCard } from './engine-fixture.ts';
const url = process.env.SOLID_PREVIEW_URL, origin = process.env.PREVIEW_API_ORIGIN;
if (!url?.startsWith('https://') || !origin?.startsWith('https://')) throw Error('Use an owned trusted HTTPS preview');
const output = process.env.PREVIEW_OUT ?? '/tmp/viptv-discovery-runtime'; mkdirSync(output, { recursive: true });
const choices = Array.from({ length: 40 }, (_, i) => ({ value: `g${i}`, label: `Genre ${i}` }));
const genre = { id: 'genre', label: 'Genre', kind: 'MultiChoice', required: true, choices, minimum: null, maximum: null, maximum_selections: 2 };
const browser = await chromium.launch({ executablePath: process.env.VIPTV_BROWSER_EXECUTABLE ?? '/opt/google/chrome/chrome' }); const results = [];
const focused = (page, id) => page.waitForFunction(id => window.__viptvEntryFocus?.id === id, id, { timeout: 5000 });
const chip = page => page.waitForFunction(() => window.__viptvFocus?.view === 'discover-chip' && !window.__viptvEntryFocus, null, { timeout: 5000 });
try {
  for (const platform of ['tizen', 'vizio', 'webos']) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await installBackend(page, { family: 'tv', session: 'ready', sourcesDone: true });
    const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1280; c.height = 720; c.getContext('2d').fillRect(0, 0, 1280, 720); return c.toDataURL().split(',')[1]; });
    for (const pattern of ['https://art.example/**', 'https://wsrv.nl/**']) await page.route(pattern,
      route => route.fulfill({ body: Buffer.from(png, 'base64'), contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } }));
    await page.route(`${origin}/api/v3/discovery-controls**`, route => {
      const type = new URL(route.request().url()).searchParams.get('type');
      return route.fulfill({ json: { provider_id: 'stremio', media_types: ['movie', 'series'], controls: [],
        catalogs: [1, 2].map(id => ({ id: 'top', name: 'Top', type, connection_id: `stremio:${id}`,
          connection_name: `Add-on ${id}`, addon_id: id, controls: [genre] })), discovery: { availability: 'Available' } } });
    });
    await page.route(target => target.origin === origin && target.pathname === '/api/v3/discover', route => {
      const target = new URL(route.request().url()); requests.push(target);
      return route.fulfill({ json: { cards: [fixtureCard({ id: 'movie-one', type: 'movie', name: 'Host fixture projection' })], complete: true, next_cursor: null } });
    });
    try {
      await page.goto(`${url}?platform=${platform}&focusdebug=1&perfdebug=1`);
      await page.waitForFunction(() => window.__viptvFocus?.view === 'home-action', null, { timeout: 15000 });
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(() => window.__viptvFocus?.view === 'rail-item' && window.__viptvFocus.index === 2);
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await chip(page);
      expect(requests).toHaveLength(0); // required input is resolved before catalog IO
      await page.keyboard.press('Enter'); await focused(page, 'choice-0');
      await page.keyboard.press('Enter'); await page.keyboard.press('ArrowDown'); await focused(page, 'choice-1');
      await page.keyboard.press('Enter'); await page.keyboard.press('ArrowDown'); await focused(page, 'choice-2');
      await page.keyboard.press('Enter'); expect(requests).toHaveLength(0); // third selection is refused locally
      await page.keyboard.press('ArrowUp'); await focused(page, 'choice-1'); await page.keyboard.press('Enter');
      for (let i = 2; i <= 35; i++) { await page.keyboard.press('ArrowDown'); await focused(page, `choice-${i}`); }
      await page.keyboard.press('Enter'); await page.screenshot({ path: `${output}/${platform}-scrolled-selections.png` });
      for (let i = 36; i <= 39; i++) { await page.keyboard.press('ArrowDown'); await focused(page, `choice-${i}`); }
      await page.keyboard.press('ArrowDown'); await focused(page, 'clear');
      await page.keyboard.press('ArrowRight'); await focused(page, 'apply'); await page.keyboard.press('Enter');
      await expect.poll(() => requests.length).toBe(1); await chip(page);
      expect(JSON.parse(requests[0].searchParams.get('values'))).toEqual([{ id: 'genre', values: ['g0', 'g35'] }]);
      expect(requests[0].searchParams.get('addon_id')).toBe('1');
      await page.keyboard.press('Enter'); await focused(page, 'choice-0');
      await page.keyboard.press('ArrowDown'); await focused(page, 'choice-1'); await page.keyboard.press('Enter');
      await page.keyboard.press('Escape'); await chip(page); expect(requests).toHaveLength(1);
      await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Enter'); await chip(page);
      expect(requests).toHaveLength(1); // changing owner resets the old catalog's selections
      await page.keyboard.press('Enter'); await focused(page, 'choice-0'); await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowRight'); await focused(page, 'apply'); await page.keyboard.press('Enter');
      await expect.poll(() => requests.length).toBe(2);
      expect(requests[1].searchParams.get('addon_id')).toBe('2');
      expect(JSON.parse(requests[1].searchParams.get('values'))).toEqual([{ id: 'genre', values: ['g0'] }]);
      expect(errors).toEqual([]); results.push({ platform, catalog_requests: requests.length, duplicate_catalog_owner_preserved: true, escaped_vectors: true,
        option_35_reachable: true, selection_limit: true, cancel_preserved_query: true, restored_filter_focus: true });
    } catch (error) { await page.screenshot({ path: `${output}/${platform}-failure.png` }); throw error; }
    finally { await page.close(); }
  }
  writeFileSync(`${output}/proof.json`, JSON.stringify(results, null, 2)); console.log(JSON.stringify(results));
} finally { await browser.close(); }
