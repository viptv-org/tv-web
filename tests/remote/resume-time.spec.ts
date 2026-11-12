import { expect, test, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';

const labels = (page: Page) => page.evaluate(() => {
  const result: string[] = [];
  const visit = (node: any) => { if (node.isRenderable && node.viptvText) result.push(node.viptvText); node.children?.forEach(visit); };
  visit((window as any).__viptvRenderer.stage.root); return result;
});
async function fixture(page: Page, baseURL: string, canvas: boolean, position: number, label: string, large = false) {
  if (canvas) await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: any[]) {
      return type.includes('webgl') ? null : original.apply(this, [type, ...args] as any);
    } as typeof original;
  });
  const backend = await installRemoteBackend(page, baseURL, { media: true });
  if (large) backend.bootstrap().preferences!.display!.text_size = 'large';
  const card = { ...backend.card, subtitle: null, progress: .3125,
    metadata: { ...backend.card.metadata!, runtime_minutes: 2 } };
  const home = backend.bootstrap().home!;
  home.hero = card; home.featured = [card];
  home.rows = [{ ...home.rows[0], id: 'continue', cards: [{ ...card, view: { ...card.view!,
    preview: { background: card.landscape ?? null, caption: 'Resume at 0:02', action: 'play', progress: .3125, resume_position_millis: 2000 } } }] }];
  await page.route('**/viewing-action', route => route.fulfill({ json: { card, label, resume: true,
    source_selection: 'ask', progress: .3125, resume_position_millis: position, remaining_label: '99m left' } }));
  await page.goto('/tv/?focusdebug=1');
  const state = page.locator('html');
  await expect(state).toHaveAttribute('data-tv-ready', 'true');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-screen', 'detail');
  await expect(state).toHaveAttribute('data-tv-ready', 'true');
  await expect.poll(() => labels(page)).toContain(label);
  expect((await labels(page)).some(text => /\b\d+[ms] left\b/.test(text))).toBe(false);
  return backend;
}
for (const canvas of [false, true]) {
  test(`fresh resume clock drives the label and actual admission (${canvas ? 'Canvas' : 'WebGL'})`, async ({ page, baseURL }) => {
    const backend = await fixture(page, baseURL!, canvas, 1250, 'Resume at 0:01');
    const state = page.locator('html');
    await page.keyboard.press('Enter');
    await expect(state).toHaveAttribute('data-tv-sources', '8');
    await expect(state).toHaveAttribute('data-tv-ready', 'true');
    await page.keyboard.press('Enter');
    await expect.poll(() => backend.requests.filter(request => request.path === '/api/playback' && request.method === 'POST').length).toBe(1);
    expect(backend.requests.find(request => request.path === '/api/playback' && request.method === 'POST')!.body.position).toBe(1.25);
    await expect(state).toHaveAttribute('data-tv-player-state', 'playing');
    await expect.poll(() => page.locator('video').evaluate(video => (video as HTMLVideoElement).currentTime)).toBeGreaterThanOrEqual(1.25);
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'MediaStop', keyCode: 413, bubbles: true })));
    await expect(state).not.toHaveAttribute('data-tv-screen', 'player');
  });
  for (const [large, position, label] of [[false, 3_723_000, 'Resume at 1:02:03'], [true, 3_723_000, 'Resume at 1:02:03'], [true, 604_799_000, 'Resume at 167:59:59']] as const)
  test(`hour resume label fits its control without remaining-time copy (${canvas ? 'Canvas' : 'WebGL'}, large=${large}, ${position})`, async ({ page, baseURL }, info) => {
    await fixture(page, baseURL!, canvas, position, label, large);
    const geometry = await page.evaluate(({ label, large }) => {
      let result: { width: number; textWidth: number; available: number } | undefined;
      const visit = (node: any) => {
        if (node.isRenderable && node.viptvText === label) {
          const context = document.createElement('canvas').getContext('2d')!;
          context.font = `${26 * (large ? 1.25 : 1)}px Onest700`;
          const width = node.parent.width ?? node.parent.props.w;
          result = { width, textWidth: context.measureText(label).width, available: width - 82 };
        }
        node.children?.forEach(visit);
      };
      visit((window as any).__viptvRenderer.stage.root); return result;
    }, { label, large });
    expect(geometry).toBeDefined(); expect(geometry!.width).toBeGreaterThanOrEqual(360);
    expect(geometry!.textWidth).toBeLessThanOrEqual(geometry!.available);
    await page.screenshot({ path: info.outputPath('resume-time-control.png') });
  });
}
