import { expect, test, type Page } from '@playwright/test';

import { installBackend } from './helpers/responsiveBackend';

/** Owner-directed responsive layout corrections: one page row, one frame width. */
async function box(page: Page, selector: string) {
  const bounds = await page.locator(selector).first().boundingBox();
  expect(bounds, `${selector} must be laid out`).not.toBeNull();
  return bounds!;
}

async function openProfile(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Alex' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
}

test('phone Live TV is a searchable channel list with category chips and no guide table', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await installBackend(page, {});
  const cors = { 'access-control-allow-origin': 'http://127.0.0.1:4173' };
  const now = Math.floor(Date.now() / 1000);
  const stations = Array.from({ length: 88 }, (_, index) => ({ id: `station-${index}`, type: 'live', name: `Channel ${index + 1}`, section: 'News' }));
  const searches: string[] = [];
  await page.route('**/api/live**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/categories')) return route.fulfill({ headers: cors, json: { categories: [{ id: 'news', name: 'News', count: 88 }], total: 1 } });
    searches.push(url.searchParams.get('search') ?? '');
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? 40);
    return route.fulfill({ headers: cors, json: { channels: stations.slice(offset, offset + limit), total: stations.length } });
  });
  await page.route('**/api/guide/**', route => route.fulfill({ headers: cors, json: { programs: [{ title: 'Current programme', start: now - 600, end: now + 1200 }, { title: 'Later programme', start: now + 1200, end: now + 4800 }], timezone: 'UTC' } }));
  await openProfile(page);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Live TV', exact: true }).click();

  // No timeline table, time paging or category picker on a phone.
  await expect(page.locator('.live-row')).toHaveCount(40);
  await expect(page.locator('.epg-scroll')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Channel category' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Earlier', exact: true })).toHaveCount(0);
  const chips = page.getByRole('group', { name: 'Channel category' });
  await expect(chips.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(chips.getByRole('button', { name: 'News', exact: true })).toBeVisible();

  // Each row names the channel, what is on now with its progress, and what is next.
  const first = page.locator('.live-row').first();
  await expect(first).toContainText('Channel 1');
  await expect(first).toContainText('Current programme');
  await expect(first.locator('.live-progress')).toBeVisible();
  await expect(first).toContainText('Later programme');

  // Scrolling the page to the end of the list loads the next channel pages.
  const screen = page.locator('.tv-screen');
  await screen.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(page.locator('.live-row')).toHaveCount(80);
  await screen.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(page.locator('.live-row')).toHaveCount(88);

  await page.getByRole('searchbox', { name: 'Search Live TV' }).fill('news');
  await expect.poll(() => searches.at(-1)).toBe('news');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(fixture.errors).toEqual([]);
});

for (const width of [390, 1440]) {
  test(`live guide keeps one page row and equal guide and sidebar columns at ${width}px`, async ({ page }) => {
    test.skip(width < 600, 'phones show the channel list, covered above');
    await page.setViewportSize({ width, height: 900 });
    await installBackend(page, { activity: true });
    await openProfile(page);
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Live TV', exact: true }).click();
    await expect(page.locator('.responsive-epg')).toBeVisible();
    await expect(page.locator('.epg-scroll')).toBeVisible();

    // The separate guide toolbar is gone: the active filter, its date, the
    // search field and Earlier/Now/Later share the single heading row.
    await expect(page.locator('.epg-toolbar')).toHaveCount(0);
    const heading = await box(page, '.epg-page-heading');
    for (const selector of ['.epg-heading-title', '.epg-heading-filter', '.epg-search', '.epg-time-actions']) {
      const child = await box(page, selector);
      expect(child.y).toBeGreaterThanOrEqual(heading.y - 1);
      expect(child.y + child.height).toBeLessThanOrEqual(heading.y + heading.height + 1);
    }

    if (width >= 900) {
      const sidebar = await box(page, '.epg-categories');
      const guide = await box(page, '.epg-scroll');
      // Both columns start on the same row and are the same size.
      expect(Math.abs(sidebar.y - guide.y)).toBeLessThan(2);
      expect(Math.abs(sidebar.height - guide.height)).toBeLessThan(2);
      expect(sidebar.x + sidebar.width).toBeLessThan(guide.x);
      // Heading and columns share the same frame edges.
      expect(Math.abs(heading.x - sidebar.x)).toBeLessThan(2);
      expect(Math.abs(heading.x + heading.width - (guide.x + guide.width))).toBeLessThan(2);
      const pageControls = await box(page, '.epg-page-controls');
      expect(pageControls.y).toBeGreaterThanOrEqual(sidebar.y + sidebar.height - 1);
    } else {
      await expect(page.getByRole('combobox', { name: 'Channel category' })).toBeVisible();
      await expect(page.locator('.epg-categories')).toBeHidden();
    }

    // Channel paging buttons are gone from the responsive guide; the sidebar
    // filters channels, and reaching the end of the loaded rows loads the next
    // page inside the same scroll.
    await expect(page.getByRole('button', { name: 'Previous channels', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Next channels', exact: true })).toHaveCount(0);
    await expect(page.locator('.epg-page-controls')).toContainText('channels');
    expect(await page.locator('.tv-screen').evaluate(node => getComputedStyle(node).overflowY)).toBe('scroll');
    expect(await page.locator('.epg-scroll').evaluate(node => getComputedStyle(node).overflowY)).toBe('scroll');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });

  test(`discover and search results fill the shared frame at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installBackend(page, { activity: true, populated: true });
    await openProfile(page);
    const navigation = page.getByRole('navigation', { name: 'Main navigation' });
    await navigation.getByRole('button', { name: 'Discover', exact: true }).click();
    await expect(page.locator('.browse .media-card')).toHaveCount(24);

    // Neither browse route carries a cross-link to the other.
    await expect(page.locator('[data-focus-id="browse-search"]')).toHaveCount(0);
    const heading = await box(page, '.browse > h1');
    const cards = await box(page, '.result-grid > .cards');
    expect(Math.abs(heading.x - cards.x)).toBeLessThan(2);
    expect(Math.abs(heading.x + heading.width - (cards.x + cards.width))).toBeLessThan(2);

    const layout = await page.locator('.result-grid > .cards').evaluate(node => {
      const container = node.getBoundingClientRect();
      const byRow = new Map<number, { left: number; right: number; widths: number[] }>();
      for (const card of Array.from(node.querySelectorAll('.responsive-card'))) {
        const rect = card.getBoundingClientRect();
        const row = byRow.get(Math.round(rect.y)) ?? { left: rect.left, right: rect.right, widths: [] };
        row.left = Math.min(row.left, rect.left);
        row.right = Math.max(row.right, rect.right);
        row.widths.push(rect.width);
        byRow.set(Math.round(rect.y), row);
      }
      return {
        containerLeft: container.left, containerRight: container.right,
        scrollWidth: node.scrollWidth, clientWidth: node.clientWidth,
        rows: [...byRow.values()],
      };
    });
    if (width >= 600) {
      expect(layout.rows.length).toBeGreaterThan(1);
      // Every desktop row starts on the frame edge and the widest row ends on
      // it too, so the grid is never narrower than the header above it.
      const widths = new Set<number>();
      for (const row of layout.rows) {
        expect(Math.abs(row.left - layout.containerLeft)).toBeLessThan(2);
        // Discover is set to poster cards (cardShapes.ts): a 160px minimum track.
        for (const card of row.widths) { widths.add(Math.round(card)); expect(card).toBeGreaterThanOrEqual(160); }
      }
      expect(Math.abs(Math.max(...layout.rows.map(row => row.right)) - layout.containerRight)).toBeLessThan(2);
      expect(widths.size).toBe(1);
      expect(layout.scrollWidth).toBe(layout.clientWidth);
    } else {
      // Phones browse a vertical three-column poster grid that pages itself
      // in: every row starts and ends on the frame edges, nothing scrolls sideways.
      expect(layout.rows.length).toBeGreaterThan(1);
      for (const row of layout.rows) {
        expect(row.widths).toHaveLength(3);
        expect(Math.abs(row.left - layout.containerLeft)).toBeLessThan(2);
        expect(Math.abs(row.right - layout.containerRight)).toBeLessThan(2);
      }
      expect(layout.scrollWidth).toBe(layout.clientWidth);
      expect(Math.abs(layout.containerLeft - heading.x)).toBeLessThan(2);
      expect(Math.abs(layout.containerRight - (heading.x + heading.width))).toBeLessThan(2);
      await expect(page.locator('.browse .media-card').first().locator('.card-title')).toBeVisible();
    }

    await navigation.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('.browse').getByRole('heading', { name: 'Search', exact: true })).toBeVisible();
    await expect(page.locator('[data-focus-id="browse-discover"]')).toHaveCount(0);
    await expect(page.locator('.browse')).not.toContainText('Discover');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test('responsive header, detail, sources and profiles have no leading Back control', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installBackend(page, { activity: true, populated: true });
  await openProfile(page);
  await expect(page.locator('[data-focus-id="responsive-back"]')).toHaveCount(0);
  const card = page.locator('.shelves .media-card').filter({ hasText: 'A Different Horizon' }).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.locator('.detail')).toBeVisible();
  await expect(page.locator('[data-focus-id="responsive-back"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Choose source', exact: true }).click();
  await expect(page.locator('.sources')).toBeVisible();
  await expect(page.locator('[data-focus-id="responsive-back"]')).toHaveCount(0);
  await page.locator('[data-focus-id="responsive-profile"]').click();
  await expect(page.getByRole('heading', { name: "Who's watching?" })).toBeVisible();
  await expect(page.locator('[data-focus-id="responsive-back"]')).toHaveCount(0);
  // Browser history still returns to the pages the removed control reached.
  await page.goBack();
  await expect(page.locator('.sources')).toBeVisible();
});

test('scrolling the responsive guide to its end loads the next channel page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await installBackend(page, {});
  const cors = { 'access-control-allow-origin': 'http://127.0.0.1:4173' };
  const stations = Array.from({ length: 88 }, (_, index) => ({ id: `station-${index}`, type: 'live', name: `Channel ${index + 1}`, section: 'News' }));
  await page.route('**/api/live**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/categories')) return route.fulfill({ headers: cors, json: { categories: [], total: 0 } });
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? 40);
    return route.fulfill({ headers: cors, json: { channels: stations.slice(offset, offset + limit), total: stations.length } });
  });
  await openProfile(page);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Live TV', exact: true }).click();
  await expect(page.locator('.epg-row')).toHaveCount(40);
  await expect(page.locator('.epg-page-controls')).toContainText('40 of 88 channels');
  const scroller = page.locator('.epg-scroll');
  await scroller.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(page.locator('.epg-row')).toHaveCount(80);
  await expect(page.locator('.epg-page-controls')).toContainText('80 of 88 channels');
  await scroller.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(page.locator('.epg-row')).toHaveCount(88);
  await expect(page.locator('.epg-page-controls')).toContainText('88 of 88 channels');
  expect(fixture.errors).toEqual([]);
});

test('header and frame hold their position between a tall and a short route', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installBackend(page, { activity: true, populated: true });
  await openProfile(page);
  const geometry = () => page.evaluate(() => {
    const box = (selector: string) => {
      const element = document.querySelector(selector)!;
      const rect = element.getBoundingClientRect();
      return [Math.round(rect.x), Math.round(rect.width)];
    };
    const root = document.querySelector<HTMLElement>('.tv-screen')!;
    return {
      brand: box('.responsive-toolbar .brand'), cast: box('[data-focus-id="responsive-cast"]'),
      profile: box('[data-focus-id="responsive-profile"]'), heading: box('h1'),
      gutter: root.offsetWidth - root.clientWidth, overflow: root.scrollHeight > root.clientHeight,
    };
  });
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const home = await geometry();
  expect(home.overflow).toBe(true);
  for (const screen of ['Discover', 'Search']) {
    await nav.getByRole('button', { name: screen, exact: true }).click();
    await page.waitForTimeout(600);
    const next = await geometry();
    // The shared header never reflows between routes, and reserving the scroll
    // gutter keeps the content frame from moving sideways when a route stops
    // or starts scrolling.
    expect(next.brand).toEqual(home.brand);
    expect(next.cast).toEqual(home.cast);
    expect(next.profile).toEqual(home.profile);
    expect(next.heading[0]).toBe(home.heading[0]);
    expect(next.gutter).toBe(home.gutter);
  }
});
