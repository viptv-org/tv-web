import { expect, test, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';

const state = (page: Page) => page.locator('html');
async function press(page: Page, ...keys: string[]) {
  for (const key of keys) await page.keyboard.press(key);
}
const episodes = (page: Page) => page.evaluate(() => {
  const result: { src: string; x: number; y: number }[] = [];
  function walk(node: any) {
    if (node.isRenderable && node.props.w === 448 && node.props.h === 252 && node.texture?.props?.src?.includes('/fixture/'))
      result.push({ src: node.texture.props.src, x: node.absX, y: node.absY });
    node.children?.forEach(walk);
  }
  walk((window as any).__viptvRenderer.stage.root);
  return result;
});

test('detail seasons, episodes and recommendations retain independent selections and episode geometry', async ({ page, baseURL }, testInfo) => {
  const fixture = await installRemoteBackend(page, baseURL!);
  const series = fixture.cards[0];
  const cards = fixture.cards.map((card, index) => ({ ...card, identity: { kind: 'series', id: `episode-${index}`, ids: [], episode: { season: 1, episode: index + 1, order: 'aired' } }, parent_identity: series.identity }));
  await page.route('**/api/meta/**', route => route.fulfill({ json: {
    item: series, seasons: [{ season: 1, offset: 0, episode_count: cards.length }], episodes: cards, recommendations: fixture.cards, next_cursor: null,
  } }));
  await page.goto('/tv/?focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await press(page, 'ArrowDown', 'Enter');
  await expect(state(page)).toHaveAttribute('data-tv-screen', 'detail');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await press(page, 'ArrowDown', 'ArrowDown', ...Array(5).fill('ArrowRight'));
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^episodes:5:/);
  await expect.poll(() => episodes(page)).not.toHaveLength(0);
  const before = await episodes(page);
  await page.screenshot({ path: testInfo.outputPath('detail-episode-focus.png') });
  await press(page, 'ArrowDown');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^recommendations:0:/);
  expect(await episodes(page)).toEqual(before);
  await press(page, ...Array(3).fill('ArrowRight'), 'ArrowUp');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^episodes:5:/);
  await press(page, 'ArrowDown');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^recommendations:3:/);
  await press(page, 'ArrowUp', 'ArrowUp');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^seasons:/);
  expect(await episodes(page)).toEqual(before);
  await press(page, 'ArrowUp', 'ArrowDown', 'ArrowDown');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^episodes:5:/);
  await press(page, 'ArrowUp', 'Enter', 'Enter');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^episodes:5:/);
});
