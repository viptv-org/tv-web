#!/usr/bin/env node
/*
 * App-wide state cells. PhStates / DeskStates / TvStates are composite boards
 * (many states on one sheet), so shoot.mjs cannot compare them as one screen.
 * This tool shoots each reachable cell as its own scenario and writes it next
 * to the matching crop of the board:
 *
 *   node tests/preview/states.mjs                      every cell
 *   node tests/preview/states.mjs --board TvStates     one board
 *   node tests/preview/states.mjs banner toast-error   cells whose slug contains a word
 *   node tests/preview/states.mjs --list               cells, captions, owners
 *
 * Needs the preview dev server on 127.0.0.1:4180 (start it with
 * `node tests/preview/shoot.mjs --keep <any screen>`; this tool never stops it).
 * Output (PREVIEW_OUT or test-results/preview-states): <Board>--<slug>.png (app),
 * .ref.png (board crop) and .compare.png (reference | app, 1:1).
 *
 * Screen cells compare the whole frame. Component cells (toasts, pills,
 * loading-more rows) compare a box of the reference cell's size centred on the
 * app element (`crop`). The mock backend, clock and media stubs are the
 * harness's (backend.ts); `before(page)` adds routes before the app loads.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { apiOrigin, installBackend, installMediaStubs, referenceDir } from './backend.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const outDir = process.env.PREVIEW_OUT ? resolve(process.env.PREVIEW_OUT) : join(root, 'test-results/preview-states');
const PORT = 4180;
const FREEZE = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';

const boards = {
  PhStates: { html: 'phone/PhStates.html', img: 'phone/PhStates.webp', size: [1760, 6476], frame: { width: 390, height: 844, family: 'phone', query: '', phone: true } },
  DeskStates: { html: 'desktop-web/DeskStates.html', img: 'desktop-web/DeskStates.webp', size: [3100, 4820], frame: { width: 1440, height: 900, family: 'desk', query: 'desktop-shell', desktop: true } },
  TvStates: { html: 'tv/TvStates.html', img: 'tv/TvStates.webp', size: [4200, 5309], frame: { width: 1920, height: 1080, family: 'tv', query: 'platform=tizen', tv: true } },
};

const MONSTER = '/tv/title/series/tt-monster';
const OAK = '/tv/title/movie/tt-oak-street';
/** Answer every API call with a refused connection from now on (backend goes down after load). */
const goDown = page => page.route(`${apiOrigin}/api/**`, route => route.abort('connectionrefused'));
/** A client error (400) on the named path pattern. */
const clientError = (page, pattern, error = 'VIPTV could not complete that request.') =>
  page.route(`${apiOrigin}${pattern}`, route => route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ error }) }));

/*
 * Cells: caption = the board's figcaption; owner = the family that renders it
 * (dialogs cells are this family's; the others are here so their owners can
 * compare with the same tool).
 */
const cells = [
  // ---- phone ---------------------------------------------------------------
  { board: 'PhStates', slug: 'home-skeleton', caption: 'Home skeleton', owner: 'home', path: '/tv/home', backend: { catalogHang: true, queue: false } },
  { board: 'PhStates', slug: 'discover-skeleton', caption: 'Discover first page skeleton (12 posters)', owner: 'browse', path: '/tv/discover', backend: { catalogHang: true } },
  { board: 'PhStates', slug: 'banner', caption: 'Backend unreachable banner (above nav)', owner: 'dialogs', path: '/tv/home', backend: { backendDown: true } },
  { board: 'PhStates', slug: 'startup-error', caption: 'Startup error toast', owner: 'dialogs', path: '/tv/home', before: page => clientError(page, '/api/auth/me', 'VIPTV could not start.') },
  { board: 'PhStates', slug: 'discover-no-catalogs', caption: 'Discover — no catalogs', owner: 'browse', path: '/tv/discover', backend: { noCatalogs: true } },
  { board: 'PhStates', slug: 'my-list-empty', caption: 'My List — empty', owner: 'browse', path: '/tv/my-list' },
  { board: 'PhStates', slug: 'continue-empty', caption: 'Continue Watching — empty', owner: 'browse', path: '/tv/my-list', backend: { queue: false }, steps: h => h.button('Continue Watching') },
  { board: 'PhStates', slug: 'search-no-results', caption: 'Search — no results', owner: 'browse', path: '/tv/search', query: 'q=zzqx' },
  { board: 'PhStates', slug: 'toast-added', caption: 'Notice · Added to My List', owner: 'dialogs', path: OAK, crop: '.vx-toast', steps: h => h.activate('detail-save') },
  { board: 'PhStates', slug: 'toast-error', caption: 'Error toast · 4 s', owner: 'dialogs', path: OAK, crop: '.vx-toast--error', steps: async h => { await clientError(h.page, '/api/profiles/*/favorites*', 'Could not save your profile. Please try again.'); await h.activate('detail-save'); await h.wait('.vx-toast--error'); } },
  { board: 'PhStates', slug: 'preparing', caption: 'Preparing playback pill', owner: 'dialogs', path: '/tv/home', backend: { playbackHang: true }, player: {}, crop: '.vx-preparing', steps: async h => { await h.activate(h.page.getByRole('button', { name: 'Cartoon Network' }).first()); await h.wait('.vx-preparing'); } },

  // ---- desktop ---------------------------------------------------------------
  { board: 'DeskStates', slug: 'home-skeleton', caption: 'Home skeleton', owner: 'home', path: '/tv/home', backend: { catalogHang: true, queue: false } },
  { board: 'DeskStates', slug: 'discover-skeleton', caption: 'Discover first page skeleton', owner: 'browse', path: '/tv/discover', backend: { catalogHang: true } },
  { board: 'DeskStates', slug: 'banner', caption: 'Backend unreachable banner', owner: 'dialogs', path: '/tv/home', backend: { backendDown: true } },
  { board: 'DeskStates', slug: 'startup-error', caption: 'Startup error toast', owner: 'dialogs', path: '/tv/home', before: page => clientError(page, '/api/auth/me', 'VIPTV could not start.') },
  { board: 'DeskStates', slug: 'toast-added', caption: 'Notice · Added to My List', owner: 'dialogs', path: OAK, crop: '.vx-toast', steps: h => h.activate('detail-save') },
  { board: 'DeskStates', slug: 'toast-error', caption: 'Error toast · 4 s', owner: 'dialogs', path: OAK, crop: '.vx-toast--error', steps: async h => { await clientError(h.page, '/api/profiles/*/favorites*', 'Could not save your profile. Please try again.'); await h.activate('detail-save'); await h.wait('.vx-toast--error'); } },
  { board: 'DeskStates', slug: 'preparing', caption: 'Preparing playback pill', owner: 'dialogs', path: '/tv/home', backend: { playbackHang: true }, player: {}, crop: '.vx-preparing', steps: async h => { await h.activate(h.page.getByRole('button', { name: 'Cartoon Network' }).first()); await h.wait('.vx-preparing'); } },

  // ---- TV --------------------------------------------------------------------
  { board: 'TvStates', slug: 'startup-cover', caption: 'Startup cover (after choosing a profile)', owner: 'dialogs', backend: { catalogHang: true }, quiet: 300, settleMax: 1500 },
  { board: 'TvStates', slug: 'banner', caption: 'Backend unreachable panel', owner: 'dialogs', steps: async h => { await goDown(h.page); await h.activate('hero-details'); await h.wait('[data-focus-scope="error"]'); } },
  { board: 'TvStates', slug: 'toast-error', caption: 'Error toast over Home', owner: 'dialogs', steps: async h => { await clientError(h.page, '/api/meta/**', 'Could not save your profile. Please try again.'); await h.activate('hero-details'); await h.wait('.vx-toast--error'); } },
  { board: 'TvStates', slug: 'toast-home', caption: 'Notice · Press Home on your TV remote to le…', owner: 'dialogs', crop: '.vx-toast', steps: async h => { await h.press('Escape'); await h.wait('.vx-toast'); } },
  { board: 'TvStates', slug: 'preparing', caption: 'Preparing playback panel + LOADING', owner: 'dialogs', backend: { playbackHang: true }, player: {}, crop: '.vx-preparing', steps: async h => { await h.tvGo('Live TV'); await h.activate('guide-channel-0'); await h.wait('.vx-preparing'); } },
];

const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const boardFilter = option('--board');
const words = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--board');
const selected = cells.filter(cell => (!boardFilter || cell.board === boardFilter) && (!words.length || words.some(word => cell.slug.includes(word))));

function helpers(page, frame, activity) {
  const byId = id => page.locator(`[data-focus-id="${id}"]`).first();
  const target = what => typeof what === 'string' ? (/^[#.[]/.test(what) ? page.locator(what).first() : byId(what)) : what;
  const h = {
    page, frame, tv: !!frame.tv, phone: !!frame.phone,
    sleep: ms => page.waitForTimeout(ms),
    async wait(what, timeout = 10000) { await target(what).waitFor({ state: 'visible', timeout }); },
    async waitText(text, timeout = 10000) { await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout }); },
    async activate(what) {
      const element = target(what);
      await element.waitFor({ state: 'visible', timeout: 10000 });
      if (frame.tv) { await element.focus(); await page.keyboard.press('Enter'); } else await element.click();
      await h.sleep(250);
    },
    async button(name, options = {}) { await h.activate(page.getByRole('button', { name, exact: options.exact ?? true }).first()); },
    async hold(what) {
      const element = target(what);
      await element.waitFor({ state: 'visible', timeout: 10000 });
      if (frame.tv) { await element.focus(); await page.keyboard.press('ContextMenu'); } else await element.click({ button: 'right' });
      await h.sleep(250);
    },
    async focus(what) { const element = target(what); await element.waitFor({ state: 'visible', timeout: 10000 }); await element.focus(); await h.sleep(150); },
    async press(key, times = 1) { for (let index = 0; index < times; index++) { await page.keyboard.press(key); await h.sleep(140); } },
    async tvGo(label) {
      const button = page.locator(`nav [data-focus-id="nav-${label}"]`).first();
      for (let attempt = 0; attempt < 4; attempt++) {
        await h.activate(button);
        if (await button.getAttribute('aria-current').catch(() => null) === 'page') break;
        await h.sleep(750);
      }
      await h.settle();
    },
    async settle(quiet = 600, max = 10000) {
      const start = Date.now();
      while (Date.now() - start < max && Date.now() - activity.last < quiet) await page.waitForTimeout(100);
      await page.evaluate(() => document.fonts.ready);
    },
  };
  return h;
}

/** Cell boxes on a board: render its HTML at the board size and read each figure. */
async function boardBoxes(browser, name) {
  const board = boards[name];
  const page = await browser.newPage({ viewport: { width: board.size[0], height: board.size[1] }, deviceScaleFactor: 1 });
  await page.route(/^https?:/, route => route.abort());
  await page.goto(pathToFileURL(join(referenceDir, 'screens/html', board.html)).href, { waitUntil: 'domcontentloaded' });
  const boxes = await page.evaluate(() => Array.from(document.querySelectorAll('figure')).map(figure => {
    const caption = figure.querySelector('figcaption')?.textContent?.trim() ?? '';
    const cell = figure.firstElementChild;
    const frame = cell?.firstElementChild;
    const rect = element => { const r = element.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; };
    return { caption, cell: cell ? rect(cell) : undefined, frame: frame ? rect(frame) : undefined };
  }));
  await page.close();
  return boxes;
}

async function cropReference(page, name, box, file) {
  const board = boards[name];
  const src = `data:image/webp;base64,${readFileSync(join(referenceDir, 'screens/img', board.img)).toString('base64')}`;
  await page.setViewportSize({ width: board.size[0], height: board.size[1] });
  await page.setContent(`<!doctype html><style>body{margin:0}img{display:block}</style><img src="${src}">`);
  await page.evaluate(() => document.images[0].decode());
  await page.screenshot({ path: file, clip: box });
}

async function shootCell(browser, cell, size) {
  const board = boards[cell.board];
  const frame = board.frame;
  const context = await browser.newContext({
    viewport: { width: frame.width, height: frame.height }, deviceScaleFactor: 1,
    ...(frame.phone ? { isMobile: true, hasTouch: true } : {}),
    timezoneId: 'America/New_York', locale: 'en-US', colorScheme: 'dark', reducedMotion: 'reduce', serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const activity = { last: Date.now() };
  for (const event of ['request', 'requestfinished', 'requestfailed']) page.on(event, () => { activity.last = Date.now(); });
  try {
    await page.clock.setFixedTime(new Date(`2026-09-23T${frame.phone ? '10:32' : '10:55'}:00-04:00`));
    await installBackend(page, { family: frame.family, ...(cell.backend ?? {}) });
    if (cell.player || frame.tv) await installMediaStubs(page, { frame: '63e024', ...(cell.player ?? {}) });
    if (cell.before) await cell.before(page);
    const path = cell.path ?? (frame.tv ? '/' : '/tv/home');
    const query = [frame.query, cell.query].filter(Boolean).join('&');
    await page.goto(`http://127.0.0.1:${PORT}${path}${query ? `?${query}` : ''}`);
    await page.locator('.tv-screen, #root > *').first().waitFor({ state: 'attached', timeout: 20000 });
    const h = helpers(page, frame, activity);
    await h.settle(800, cell.settleMax ?? 10000);
    if (cell.steps) await cell.steps(h);
    await h.settle(cell.quiet ?? 600, cell.settleMax ?? 10000);
    await page.addStyleTag({ content: FREEZE });
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const file = join(outDir, `${cell.board}--${cell.slug}.png`);
    let clip;
    if (cell.crop) {
      const box = await page.locator(cell.crop).first().boundingBox();
      if (!box) throw new Error(`no ${cell.crop}`);
      const width = Math.min(size.width, frame.width), height = Math.min(size.height, frame.height);
      const x = Math.max(0, Math.min(frame.width - width, Math.round(box.x + box.width / 2 - width / 2)));
      const y = Math.max(0, Math.min(frame.height - height, Math.round(box.y + box.height / 2 - height / 2)));
      clip = { x, y, width, height };
    }
    await page.screenshot({ path: file, animations: 'disabled', caret: 'hide', ...(clip ? { clip } : {}) });
    return file;
  } finally {
    await context.close();
  }
}

async function compose(page, cell, refFile, appFile, size) {
  const data = file => `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  const scale = Math.min(1, 1200 / size.width);
  const w = Math.round(size.width * scale), hgt = Math.round(size.height * scale);
  await page.setViewportSize({ width: 400, height: 300 });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#2b2b30;font:600 15px system-ui,sans-serif;color:#eee}
    main{display:flex;gap:16px;padding:16px;width:max-content} figure{margin:0} figcaption{height:26px}
    img{display:block;width:${w}px;height:${hgt}px;outline:1px solid #555}
  </style><main>
    <figure><figcaption>Reference · ${cell.board} · ${cell.caption}</figcaption><img src="${data(refFile)}"></figure>
    <figure><figcaption>App · ${cell.slug} (${cell.owner})</figcaption><img src="${data(appFile)}"></figure></main>`);
  await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
  const out = appFile.replace(/\.png$/, '.compare.png');
  await page.locator('main').screenshot({ path: out });
  return out;
}

async function main() {
  if (args.includes('--list')) {
    for (const cell of cells) console.log(`${cell.board.padEnd(11)} ${cell.slug.padEnd(22)} ${cell.owner.padEnd(8)} ${cell.caption}`);
    return;
  }
  try { await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(2000) }); }
  catch { throw new Error(`no preview dev server on ${PORT}: run node tests/preview/shoot.mjs --keep <any screen> first`); }
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const summary = { ok: [], failed: [] };
  try {
    const boxes = {};
    const util = await browser.newPage({ deviceScaleFactor: 1 });
    for (const cell of selected) {
      boxes[cell.board] ??= await boardBoxes(browser, cell.board);
      const figure = boxes[cell.board].find(entry => entry.caption === cell.caption);
      const name = `${cell.board}--${cell.slug}`;
      if (!figure) { console.log(`FAIL ${name}: no figure captioned "${cell.caption}"`); summary.failed.push(name); continue; }
      const frameSize = boards[cell.board].frame;
      // A screen cell holds a frame of the platform size; a component cell is compared as a whole.
      const refBox = !cell.crop && figure.frame && figure.frame.width === frameSize.width ? figure.frame : figure.cell;
      const refFile = join(outDir, `${name}.ref.png`);
      await cropReference(util, cell.board, refBox, refFile);
      try {
        const appFile = await shootCell(browser, cell, refBox);
        const out = await compose(util, cell, refFile, appFile, refBox);
        summary.ok.push(name);
        console.log(`ok   ${name.padEnd(34)} ${out.replace(`${root}/`, '')}`);
      } catch (error) {
        summary.failed.push(name);
        console.log(`FAIL ${name}: ${String(error.message ?? error).split('\n')[0]}`);
      }
    }
  } finally {
    await browser.close();
  }
  writeFileSync(join(outDir, 'last-run.json'), JSON.stringify(summary, null, 2));
  console.log(`\n${summary.ok.length} shot, ${summary.failed.length} failed`);
  process.exitCode = summary.failed.length ? 1 : 0;
}

main().catch(error => { console.error(error); process.exit(1); });
