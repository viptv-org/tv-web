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

for (const width of [390, 1440]) {
  test(`live guide keeps one page row and equal guide and sidebar columns at ${width}px`, async ({ page }) => {
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
        for (const card of row.widths) { widths.add(Math.round(card)); expect(card).toBeGreaterThanOrEqual(232); }
      }
      expect(Math.abs(Math.max(...layout.rows.map(row => row.right)) - layout.containerRight)).toBeLessThan(2);
      expect(widths.size).toBe(1);
      expect(layout.scrollWidth).toBe(layout.clientWidth);
    } else {
      // Phones use Home's own presentation: canonical 232px tiles on the single
      // scrolling row, never one card stretched across the whole page.
      expect(layout.rows).toHaveLength(1);
      for (const card of layout.rows[0].widths) {
        expect(card).toBeGreaterThanOrEqual(230);
        expect(card).toBeLessThanOrEqual(234);
      }
      expect(layout.scrollWidth).toBeGreaterThan(layout.clientWidth);
      expect(Math.abs(layout.containerLeft - heading.x)).toBeLessThan(2);
      expect(Math.abs(layout.containerRight - (heading.x + heading.width))).toBeLessThan(2);
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
