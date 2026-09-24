#!/usr/bin/env node
/*
 * DEV component gallery → screenshots + reference comparison.
 *
 *   node scripts/gallery.mjs                 all 9 component sheets
 *   node scripts/gallery.mjs CmpPhone1 CmpTv2
 *   --keep     leave the dev server running for the next call
 *   --no-rows  skip the per-row comparison crops
 *
 * Renders /?gallery=<phone|desktop|tv>&sheet=<Sheet> (src/ui/primitives/gallery)
 * with the viewport of that platform (phone 390 wide, so the ≤599px rules apply;
 * desktop 1440; TV 1920 with the .tv-layout canvas at 1:1), forces the
 * pseudo-classes named by data-force="hover|active|focus|focus-visible" through
 * CDP, and captures the whole sheet beyond the viewport. Output in
 * test-results/gallery/: <Sheet>.png, <Sheet>.compare.png (reference | gallery,
 * downscaled) and <Sheet>.row<NN>.png (reference crop above the gallery crop at
 * 1:1, one per figure row) for reading with an image viewer.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const referenceDir = resolve(root, '../design/viptv-design-system/reference/components');
const outDir = join(root, 'test-results/gallery');
const PORT = 4197;
const ALL = ['CmpPhone1', 'CmpPhone2', 'CmpPhone3', 'CmpDesk1', 'CmpDesk2', 'CmpDesk3', 'CmpTv1', 'CmpTv2', 'CmpTv3'];
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const names = args.filter((arg) => !arg.startsWith('--'));
const sheets = names.length ? names : ALL;
const FREEZE = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';

async function reachable() {
  try { return (await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; }
}
let server;
async function ensureServer() {
  if (await reachable()) return;
  const env = { ...process.env };
  for (const name of ['VITE_LAN_PREVIEW', 'VITE_API_ORIGIN', 'VITE_VIPTV_LOCAL_MODE']) delete env[name];
  server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: root, env, stdio: 'ignore', detached: flag('--keep'),
  });
  if (flag('--keep')) server.unref();
  for (let attempt = 0; attempt < 240; attempt++) {
    if (await reachable()) return;
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`vite did not start on ${PORT}`);
}

function platformOf(sheet) {
  if (sheet.startsWith('CmpPhone')) return { gallery: 'phone', width: 390, height: 844 };
  if (sheet.startsWith('CmpTv')) return { gallery: 'tv', width: 1920, height: 1080 };
  return { gallery: 'desktop', width: 1440, height: 900 };
}

async function forceStates(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root: documentNode } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: documentNode.nodeId, selector: '[data-force]' });
  for (const nodeId of nodeIds) {
    const { attributes } = await cdp.send('DOM.getAttributes', { nodeId });
    const value = attributes[attributes.indexOf('data-force') + 1] ?? '';
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: value.split(/\s+/).filter(Boolean) });
  }
  return { cdp, count: nodeIds.length };
}

const dataUrl = (path, type) => `data:${type};base64,${readFileSync(path).toString('base64')}`;

async function compose(browser, sheet, size, rows) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const ref = dataUrl(join(referenceDir, `${sheet}.webp`), 'image/webp');
  const app = dataUrl(join(outDir, `${sheet}.png`), 'image/png');
  const results = await page.evaluate(async ({ ref, app, size, rows, withRows }) => {
    const load = (src) => new Promise((done, fail) => { const image = new Image(); image.onload = () => done(image); image.onerror = fail; image.src = src; });
    const [refImage, appImage] = await Promise.all([load(ref), load(app)]);
    const out = {};
    // Whole sheet side by side, capped at 1600 px per half.
    const scale = Math.min(1, 1600 / size.width);
    const w = Math.round(size.width * scale), h = Math.round(size.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w * 2 + 24; canvas.height = h;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ff00ff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(refImage, 0, 0, w, h);
    context.drawImage(appImage, w + 24, 0, w, h);
    out.compare = canvas.toDataURL('image/png');
    if (withRows) {
      out.rows = rows.map((rect) => {
        const pad = 8;
        const x = Math.max(0, Math.floor(rect.x - pad)), y = Math.max(0, Math.floor(rect.y - pad));
        const cw = Math.min(size.width - x, Math.ceil(rect.width + pad * 2)), ch = Math.min(size.height - y, Math.ceil(rect.height + pad * 2));
        const crop = document.createElement('canvas');
        crop.width = cw; crop.height = ch * 2 + 6;
        const c = crop.getContext('2d');
        c.fillStyle = '#ff00ff'; c.fillRect(0, 0, crop.width, crop.height);
        c.drawImage(refImage, x, y, cw, ch, 0, 0, cw, ch);
        c.drawImage(appImage, x, y, cw, ch, 0, ch + 6, cw, ch);
        return crop.toDataURL('image/png');
      });
    }
    return out;
  }, { ref, app, size, rows, withRows: !flag('--no-rows') });
  await page.close();
  const write = (file, url) => writeFileSync(join(outDir, file), Buffer.from(url.split(',')[1], 'base64'));
  write(`${sheet}.compare.png`, results.compare);
  (results.rows ?? []).forEach((url, index) => write(`${sheet}.row${String(index + 1).padStart(2, '0')}.png`, url));
  return results.rows?.length ?? 0;
}

await ensureServer();
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
let failed = 0;
try {
  for (const sheet of sheets) {
    const platform = platformOf(sheet);
    const context = await browser.newContext({
      viewport: { width: platform.width, height: platform.height }, deviceScaleFactor: 1,
      colorScheme: 'dark', reducedMotion: 'reduce', serviceWorkers: 'block',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(`http://127.0.0.1:${PORT}/?gallery=${platform.gallery}&sheet=${sheet}`);
      await page.locator('.vx-gallery-sheet').first().waitFor({ state: 'attached', timeout: 30000 });
      await page.addStyleTag({ content: FREEZE });
      await page.evaluate(async () => { await document.fonts.ready; });
      await page.waitForTimeout(300);
      const { count } = await forceStates(page);
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      const size = await page.evaluate(() => { const r = document.querySelector('.vx-gallery-sheet').getBoundingClientRect(); return { width: Math.round(r.width), height: Math.round(r.height) }; });
      const rows = await page.evaluate(() => {
        const sheet = document.querySelector('.vx-gallery-sheet').getBoundingClientRect();
        return [...document.querySelectorAll('.vx-gallery-row')].map((row) => { const r = row.getBoundingClientRect(); return { x: r.x - sheet.x, y: r.y - sheet.y, width: r.width, height: r.height }; });
      });
      const missing = await page.evaluate(() => [...document.querySelectorAll('figure[data-missing]')].map((f) => f.getAttribute('data-caption')));
      await page.screenshot({ path: join(outDir, `${sheet}.png`), fullPage: true, clip: { x: 0, y: 0, ...size }, animations: 'disabled', caret: 'hide' });
      const rowFiles = await compose(browser, sheet, size, rows);
      console.log(`${sheet}: ${size.width}×${size.height}, ${count} forced, ${rowFiles} row crops${missing.length ? `, ${missing.length} figures not built: ${missing.join(' | ')}` : ''}`);
      if (errors.length) console.log(`  page errors: ${errors.slice(0, 5).join(' / ')}`);
    } catch (error) {
      failed++;
      console.log(`FAIL ${sheet}: ${String(error.message ?? error).split('\n')[0]}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  if (server && !flag('--keep')) server.kill();
}
process.exit(failed ? 1 : 0);
