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
  await expect(page.locator('.vx-live-item')).toHaveCount(40);
  await expect(page.locator('.vx-live-guide__scroll')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Channel category' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Earlier', exact: true })).toHaveCount(0);
  const chips = page.getByRole('group', { name: 'Channel category' });
  await expect(chips.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(chips.getByRole('button', { name: 'News', exact: true })).toBeVisible();

  // Each row names the channel, what is on now with its progress, and what is next.
  const first = page.locator('.vx-live-item').first();
  await expect(first).toContainText('Channel 1');
  await expect(first).toContainText('Current programme');
  await expect(first.locator('.vx-live-progress')).toBeVisible();
  await expect(first).toContainText('Later programme');

  // Scrolling the page to the end of the list loads the next channel pages.
  const screen = page.locator('.tv-screen');
  await screen.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(page.locator('.vx-live-item')).toHaveCount(80);
  await screen.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(page.locator('.vx-live-item')).toHaveCount(88);

  // Search sits behind the header button and docks its field above the nav.
  await expect(page.getByRole('searchbox', { name: 'Search Live TV' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Search Live TV' }).click();
  const field = page.getByRole('searchbox', { name: 'Search Live TV' });
  await expect(field).toBeFocused();
  const dock = await field.boundingBox();
  const nav = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
  expect(dock!.y + dock!.height).toBeLessThanOrEqual(nav!.y);
  await field.fill('news');
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
    await expect(page.locator('.vx-live--desk')).toBeVisible();
    await expect(page.locator('.vx-live-guide__scroll')).toBeVisible();

    // DeskLive: title + date, then the search field and Earlier / Now / Later
    // share the single heading row.
    const heading = await box(page, '.vx-live-desk__head');
    for (const selector of ['.vx-live-desk__heading', '.vx-live-search', '.vx-live-time']) {
      const child = await box(page, selector);
      expect(child.y).toBeGreaterThanOrEqual(heading.y - 1);
      expect(child.y + child.height).toBeLessThanOrEqual(heading.y + heading.height + 1);
    }

    if (width >= 900) {
      const sidebar = await box(page, '.vx-live-cats');
      const guide = await box(page, '.vx-live-guide');
      // Both columns start on the same row; the guide runs to the window edge.
      expect(Math.abs(sidebar.y - guide.y)).toBeLessThan(2);
      expect(sidebar.x + sidebar.width).toBeLessThan(guide.x);
      expect(Math.abs(guide.y + guide.height - 900)).toBeLessThan(2);
      // Heading and columns share the same frame edges.
      expect(Math.abs(heading.x - sidebar.x)).toBeLessThan(2);
      expect(Math.abs(heading.x + heading.width - (guide.x + guide.width))).toBeLessThan(2);
    } else {
      await expect(page.getByRole('group', { name: 'Channel categories' }).getByRole('button', { name: 'All US channels' })).toBeVisible();
      await expect(page.locator('.vx-live-cats')).toHaveCount(0);
    }

    // Channel paging buttons are gone from the responsive guide; the sidebar
    // filters channels, and reaching the end of the loaded rows loads the next
    // page inside the same scroll.
    await expect(page.getByRole('button', { name: 'Previous channels', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Next channels', exact: true })).toHaveCount(0);
    await expect(page.locator('.vx-live-guide__count')).toContainText('channels');
    // The page itself never scrolls; the guide scrolls both ways.
    expect(await page.locator('.vx-live--desk').evaluate(node => getComputedStyle(node).overflowY)).toBe('hidden');
    expect(await page.locator('.vx-live-guide__scroll').evaluate(node => getComputedStyle(node).overflowY)).toBe('auto');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });

  test(`discover grids keep fixed tiles and search shares the page frame at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installBackend(page, { activity: true, populated: true });
    await openProfile(page);
    const navigation = page.getByRole('navigation', { name: 'Main navigation' });
    await navigation.getByRole('button', { name: 'Discover', exact: true }).click();
    await expect(page.locator('.vx-browse .media-card')).toHaveCount(24);

    // Neither browse route carries a cross-link to the other.
    await expect(page.locator('[data-focus-id="browse-search"]')).toHaveCount(0);
    const heading = await box(page, '.vx-browse__title');
    const cards = await box(page, '.vx-browse__grid > .cards');

    const layout = await page.locator('.vx-browse__grid > .cards').evaluate(node => {
      const container = node.getBoundingClientRect();
      const byRow = new Map<number, { left: number; right: number; widths: number[] }>();
      for (const card of Array.from(node.children)) {
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
      // Desktop / web tiles keep their fixed width (web posters 164 × 246, never stretched):
      // every row starts on the title's edge, wider windows just fit more tiles.
      expect(layout.rows.length).toBeGreaterThan(1);
      expect(Math.abs(heading.x - cards.x)).toBeLessThan(2);
      const widths = new Set<number>();
      for (const row of layout.rows) {
        expect(Math.abs(row.left - heading.x)).toBeLessThan(2);
        expect(row.right).toBeLessThanOrEqual(layout.containerRight + 1);
        for (const card of row.widths) widths.add(Math.round(card));
      }
      expect([...widths]).toEqual([164]);
      expect(layout.scrollWidth).toBe(layout.clientWidth);
    } else {
      // Phones browse a vertical three-column poster grid that pages itself
      // in: every row spans the 16 px gutters, nothing scrolls sideways.
      expect(layout.rows.length).toBeGreaterThan(1);
      for (const row of layout.rows) {
        expect(row.widths).toHaveLength(3);
        expect(Math.abs(row.left - heading.x)).toBeLessThan(2);
        expect(Math.abs(row.right - (layout.containerRight - 16))).toBeLessThan(2);
      }
      expect(layout.scrollWidth).toBe(layout.clientWidth);
    }

    await navigation.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('.vx-browse').getByRole('heading', { name: 'Search', exact: true })).toBeAttached();
    await expect(page.getByRole('searchbox', { name: 'Search titles' })).toBeVisible();
    await expect(page.locator('[data-focus-id="browse-discover"]')).toHaveCount(0);
    await expect(page.locator('.vx-browse')).not.toContainText('Discover');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test('phone detail and source Back controls return through the title and Home', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installBackend(page, { activity: true, populated: true });
  await openProfile(page);
  const card = page.locator('.shelves .media-card').filter({ hasText: 'A Different Horizon' }).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.locator('.detail')).toBeVisible();
  await expect(page.locator('[data-focus-id="detail-back"]')).toBeVisible();
  await page.locator('[data-focus-id="detail-source"]').click();
  await expect(page.locator('.sources')).toBeVisible();
  await expect(page.locator('[data-focus-id="responsive-back"]')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('.sources')).toHaveCount(0);
  await expect(page.locator('.detail')).toBeVisible();
  await page.locator('[data-focus-id="detail-back"]').click();
  await page.getByRole('button', { name: 'Profile: Alex' }).click();
  await expect(page.getByRole('heading', { name: "Who's watching?" })).toBeVisible();
  await page.goBack();
  await expect(page.locator('.vx-home')).toBeVisible();
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
  const rows = page.locator('[data-testid^="guide-row-"]');
  await expect(rows).toHaveCount(40);
  await expect(page.locator('.vx-live-guide__count')).toHaveText('88 channels');
  const scroller = page.locator('.vx-live-guide__scroll');
  await scroller.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(rows).toHaveCount(80);
  await scroller.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(rows).toHaveCount(88);
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
      rail: box('nav[aria-label="Main navigation"]'), cast: box('[data-focus-id="responsive-cast"]'),
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
    // The rail never reflows between routes, and the scrollbar-less body row
    // (no gutter at all) keeps the content frame from moving sideways when a
    // route stops or starts scrolling.
    expect(next.rail).toEqual(home.rail);
    expect(next.cast).toEqual(home.cast);
    expect(next.profile).toEqual(home.profile);
    expect(Math.abs(next.heading[0] - home.heading[0])).toBeLessThanOrEqual(1);
    expect(next.gutter).toBe(home.gutter);
    expect(next.gutter).toBe(0);
  }
});
