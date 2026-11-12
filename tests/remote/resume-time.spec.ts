import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { installRemoteBackend } from '../preview/remote-backend';

const labels = (page: Page) => page.evaluate(() => {
  const result: string[] = [];
  const visit = (node: any) => { if (node.isRenderable && node.viptvText) result.push(node.viptvText); node.children?.forEach(visit); };
  visit((window as any).__viptvRenderer.stage.root); return result;
});
const canvasPaintedLines = (page: Page, label: string) => page.evaluate(async label => {
  const renderer = (window as any).__viptvRenderer;
  let target: any, lines: string[] | undefined;
  const visit = (node: any) => {
    if (node.viptvText === label && node.renderState === 8 && node.isRenderable) target = node;
    node.children?.forEach(visit);
  };
  visit(renderer.root);
  if (!target) throw Error('Rendered Canvas label is unavailable');
  const textRenderer = target.textRenderer, renderText = textRenderer.renderText;
  textRenderer.renderText = function(this: any, props: any) {
    if (props.text !== label) return renderText.call(this, props);
    const captured: string[] = [];
    const prototypes = [CanvasRenderingContext2D.prototype,
      typeof OffscreenCanvasRenderingContext2D === 'undefined' ? undefined : OffscreenCanvasRenderingContext2D.prototype].filter(Boolean) as any[];
    const originals = prototypes.map(prototype => prototype.fillText);
    prototypes.forEach((prototype, index) => {
      prototype.fillText = function(this: any, ...args: any[]) {
        captured.push(String(args[0])); return originals[index].apply(this, args);
      };
    });
    try { const result = renderText.call(this, props); lines = captured; return result; }
    finally { prototypes.forEach((prototype, index) => { prototype.fillText = originals[index]; }); }
  };
  try {
    target.color = target.color;
    for (let i = 0; i < 2; i++) await new Promise<void>(resolve => {
      renderer.once('frameTick', () => { void Promise.resolve().then(resolve); }); renderer.requestRender();
    });
    if (!lines) throw Error('Canvas label did not repaint');
    return lines;
  } finally { textRenderer.renderText = renderText; }
}, label);
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
    const paintedLines = canvas ? await canvasPaintedLines(page, label) : undefined;
    const measure = () => page.evaluate(({ label, paintedLines }) => {
      const exposed = (window as any).__viptvRenderer;
      const renderer = exposed.rawRenderer ?? exposed;
      const webgl = document.documentElement.dataset.rendererBackend === 'webgl';
      let result: { width: number; textWidth: number; available: number; fontSize: number; fontFamily: string;
        drawnWidth: number; glyphCount?: number; expectedGlyphs?: number; paintedLines?: string[];
        reportedRemainingText?: boolean; truncated: boolean } | undefined;
      const visit = (node: any, inheritedAlpha = 1) => {
        const alpha = inheritedAlpha * (node.alpha ?? 1);
        if (alpha > 0 && node.renderState === 8 && node.viptvText === label) {
          const fontSize = node.fontSize, fontFamily = node.fontFamily;
          let textWidth: number;
          let glyphCount: number | undefined, expectedGlyphs: number | undefined, truncated: boolean;
          if (webgl) {
            const state = renderer.nodes.texts[node.id];
            if (!state?.layout || !state.font?.ready) return;
            const measured = renderer.measureText({ text: label, fontFamily, fontSize,
              lineHeight: node.lineHeight, letterSpacing: node.letterSpacing, maxWidth: 4096, maxLines: 1 });
            if (!measured) throw Error(`Rendered SDF font cannot be measured: ${fontFamily}`);
            textWidth = measured.w;
            glyphCount = state.layout.glyphCount;
            expectedGlyphs = Array.from(label).filter(character => character !== ' ').length;
            truncated = glyphCount !== expectedGlyphs;
          } else {
            if (!node.textureLoaded || !node.renderInfo) return;
            const context = document.createElement('canvas').getContext('2d')!;
            context.font = `${node.fontStyle} ${fontSize}px Unknown, ${fontFamily}`;
            textWidth = context.measureText(label).width;
            truncated = paintedLines?.join('') !== label;
          }
          const width = node.parent.width;
          result = { width, textWidth, available: Math.min(width - 82, node.maxWidth || Infinity),
            fontSize, fontFamily, drawnWidth: node.width, glyphCount, expectedGlyphs, paintedLines,
            reportedRemainingText: webgl ? undefined : node.renderInfo.hasRemainingText, truncated };
        }
        node.children?.forEach((child: any) => visit(child, alpha));
      };
      visit(renderer.root); return result;
    }, { label, paintedLines });
    let geometry: Awaited<ReturnType<typeof measure>>;
    try {
      await expect.poll(async () => { geometry = await measure(); return geometry !== undefined; }).toBe(true);
    } finally {
      await page.screenshot({ path: info.outputPath('resume-time-control.png') });
      writeFileSync(info.outputPath('actual-text-measurement.json'), JSON.stringify(geometry ?? null, null, 2));
      await info.attach('actual-text-measurement', { body: JSON.stringify(geometry ?? null), contentType: 'application/json' });
    }
    expect(geometry).toBeDefined(); expect(geometry!.width).toBeGreaterThanOrEqual(360);
    expect(geometry!.fontFamily).toBe('Onest700');
    expect(geometry!.fontSize).toBe(26 * (large ? 1.25 : 1));
    expect(geometry!.textWidth).toBeLessThanOrEqual(geometry!.available);
    expect(geometry!.truncated).toBe(false);
  });
}
