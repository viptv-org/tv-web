#!/usr/bin/env node
/*
 * Preview harness: renders app screens that correspond to the design's
 * reference screens and writes test-results/preview/<Name>.png at the
 * reference size.
 *
 *   node tests/preview/shoot.mjs                 every reachable screen
 *   node tests/preview/shoot.mjs DeskHome TvHome named screens
 *   node tests/preview/shoot.mjs --platform tv   one reference platform
 *   node tests/preview/shoot.mjs --list          registry and coverage
 *   --keep      leave the dev server(s) running for the next call
 *   --headed    show the browser
 *   --debug     keep going on failure and print the page's console errors
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { installBackend, installMediaStubs, referenceDir } from './backend.ts';
import { screens } from './screens.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
// `npx playwright test` wipes test-results/; PREVIEW_OUT redirects output.
export const outDir = process.env.PREVIEW_OUT ? resolve(process.env.PREVIEW_OUT) : join(root, 'test-results/preview');
export const referenceIndex = JSON.parse(readFileSync(join(referenceDir, 'screens/index.json'), 'utf8'));
export const reference = name => referenceIndex.find(entry => entry.name === name);
/** Dev servers: the normal build, and a local-mode build (VITE_VIPTV_LOCAL_MODE=1). */
const servers = { app: { port: 4180, local: false }, local: { port: 4190, local: true } };
/* Env a harness server must (not) have: a LAN-preview or custom API origin
   would send API calls to a real backend instead of the mock. */
const UNSAFE_ENV = ['VITE_LAN_PREVIEW', 'VITE_API_ORIGIN', 'VITE_VIPTV_LOCAL_MODE'];
const FREEZE = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const platformFilter = option('--platform');
const names = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--platform');

/** The scenario's frame: viewport, URL mode and data family from the reference size. */
export function frameFor(entry, spec) {
  const [width, height] = entry.size;
  if (entry.platform === 'tv') return { width, height, family: 'tv', query: 'platform=tizen', tv: true };
  if (entry.platform === 'phone') return { width, height, family: 'phone', query: '', phone: true };
  // Desktop app at 1440×900 and 2560×1080; plain web at 1280×800.
  const desktop = spec.shell ?? width !== 1280;
  return { width, height, family: 'desk', query: desktop ? 'desktop-shell' : '', desktop };
}

async function reachable(port) {
  try { return (await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; }
}
/** The Vite env the server on `port` compiled in (read from a transformed module). */
async function serverEnv(port) {
  const source = await (await fetch(`http://127.0.0.1:${port}/src/local/capability.ts`, { signal: AbortSignal.timeout(5000) })).text();
  const match = /import\.meta\.env = (\{[^;]*\});/.exec(source);
  return match ? JSON.parse(match[1]) : undefined;
}
async function checkServer(kind) {
  const server = servers[kind];
  const env = await serverEnv(server.port).catch(() => undefined);
  const ok = env && env.DEV && (env.VITE_VIPTV_LOCAL_MODE === '1') === server.local
    && !env.VITE_LAN_PREVIEW && !env.VITE_API_ORIGIN;
  if (!ok) throw new Error(`port ${server.port} is serving something other than the preview ${kind} dev server (env ${JSON.stringify(env)}); stop it or free the port`);
}
const started = [];
/** Stop the dev servers this process started (not reused or --keep ones). */
export function stopServers() { for (const child of started.splice(0)) child.kill(); }
async function ensureServer(kind) {
  const server = servers[kind];
  if (await reachable(server.port)) { await checkServer(kind); return server.port; }
  const env = { ...process.env };
  for (const name of UNSAFE_ENV) delete env[name];
  if (server.local) env.VITE_VIPTV_LOCAL_MODE = '1';
  const child = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), '--port', String(server.port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: root, env, stdio: 'ignore', detached: flag('--keep'),
  });
  if (flag('--keep')) child.unref(); else started.push(child);
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await reachable(server.port)) { await checkServer(kind); return server.port; }
    await new Promise(done => setTimeout(done, 250));
  }
  throw new Error(`vite did not start on ${server.port}`);
}

/** Step helpers: role/label/data-focus-id selectors that survive restyling. */
function helpers(page, frame) {
  const byId = id => page.locator(`[data-focus-id="${id}"]`).first();
  const target = what => typeof what === 'string' ? (/^[#.[]/.test(what) ? page.locator(what).first() : byId(what)) : what;
  const h = {
    page, frame, tv: !!frame.tv, phone: !!frame.phone,
    id: byId,
    sleep: ms => page.waitForTimeout(ms),
    async wait(what, timeout = 10000) { await target(what).waitFor({ state: 'visible', timeout }); },
    async waitText(text, timeout = 10000) { await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout }); },
    /** Activate: click in responsive layouts, focus + OK on the TV. */
    async activate(what) {
      const element = target(what);
      await element.waitFor({ state: 'visible', timeout: 10000 });
      if (frame.tv) { await element.focus(); await page.keyboard.press('Enter'); }
      else await element.click();
      await h.sleep(250);
    },
    async button(name, options = {}) { await h.activate(page.getByRole('button', { name, exact: options.exact ?? true }).first()); },
    /** Hold OK (TV Info key) or right-click / long-press (responsive). */
    async hold(what) {
      const element = target(what);
      await element.waitFor({ state: 'visible', timeout: 10000 });
      if (frame.tv) { await element.focus(); await page.keyboard.press('ContextMenu'); }
      else await element.click({ button: 'right' });
      await h.sleep(250);
    },
    async focus(what) { const element = target(what); await element.waitFor({ state: 'visible', timeout: 10000 }); await element.focus(); await h.sleep(150); },
    async press(key, times = 1) { for (let index = 0; index < times; index++) { await page.keyboard.press(key); await h.sleep(140); } },
    async type(text) { await page.keyboard.type(text, { delay: 30 }); await h.sleep(200); },
    async fill(what, text) { const element = target(what); await element.waitFor({ state: 'visible', timeout: 10000 }); await element.fill(text); await h.sleep(200); },
    /** TV: open a rail destination (no URL routing on the TV). */
    async tvGo(label) { await h.activate(page.locator(`nav [data-focus-id="nav-${label}"]`)); await h.settle(); },
    async settle(quiet = 600) { await settle(page, quiet); },
  };
  return h;
}

let lastActivity = Date.now();
async function settle(page, quiet = 600, max = 10000) {
  const start = Date.now();
  while (Date.now() - start < max) {
    if (Date.now() - lastActivity >= quiet) break;
    await page.waitForTimeout(100);
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    const pending = [...document.images].filter(image => !image.complete && image.loading !== 'lazy');
    await Promise.race([Promise.all(pending.map(image => new Promise(done => { image.addEventListener('load', done, { once: true }); image.addEventListener('error', done, { once: true }); }))), new Promise(done => setTimeout(done, 4000))]);
  });
}

export async function shoot(browser, name, { debug = false } = {}) {
  const entry = reference(name);
  const spec = screens[name];
  if (!entry) throw new Error(`${name} is not a reference screen`);
  if (!spec) throw new Error(`${name} is not registered in tests/preview/screens.mjs`);
  if (spec.notReachable) throw new Error(`${name} is not reachable yet: ${spec.notReachable}`);
  const frame = frameFor(entry, spec);
  const port = await ensureServer(spec.local ? 'local' : 'app');
  const context = await browser.newContext({
    viewport: { width: frame.width, height: frame.height }, deviceScaleFactor: 1,
    ...(frame.phone ? { isMobile: true, hasTouch: true } : {}),
    timezoneId: 'America/New_York', locale: 'en-US', colorScheme: 'dark', reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('request', () => { lastActivity = Date.now(); });
  page.on('requestfinished', () => { lastActivity = Date.now(); });
  page.on('requestfailed', () => { lastActivity = Date.now(); });
  try {
    // Reference clock: Wednesday 23 Sep 2026, 10:55 ET (phone 10:32).
    if (spec.clock !== false) await page.clock.setFixedTime(new Date(`2026-09-23T${spec.clock ?? (frame.phone ? '10:32' : '10:55')}:00-04:00`));
    const backend = await installBackend(page, { family: frame.family, ...(spec.backend ?? {}) });
    if (spec.player || frame.tv) await installMediaStubs(page, { frame: '63e024', ...(spec.player ?? {}) });
    if (spec.init) await page.addInitScript(spec.init);
    const path = spec.path ?? (frame.tv ? '/' : '/tv/home');
    const query = [frame.query, spec.query].filter(Boolean).join('&');
    await page.goto(`http://127.0.0.1:${port}${path}${query ? `${path.includes('?') ? '&' : '?'}${query}` : ''}`);
    await page.locator('.tv-screen, #root > *').first().waitFor({ state: 'attached', timeout: 20000 });
    const h = helpers(page, frame);
    await h.settle(800);
    if (spec.steps) await spec.steps(h);
    await h.settle(spec.quiet ?? 600);
    await page.addStyleTag({ content: FREEZE });
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    mkdirSync(outDir, { recursive: true });
    const file = join(outDir, `${name}.png`);
    await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
    const problems = backend.errors.map(error => `page error: ${error}`);
    return { file, problems, consoleErrors };
  } catch (error) {
    if (debug) {
      mkdirSync(outDir, { recursive: true });
      await page.screenshot({ path: join(outDir, `${name}.failed.png`) }).catch(() => undefined);
      console.error(consoleErrors.slice(0, 8).join('\n'));
    }
    throw error;
  } finally {
    await context.close();
  }
}

function list() {
  const rows = referenceIndex.filter(entry => entry.platform !== 'components' && (!platformFilter || entry.platform === platformFilter));
  let reachable = 0;
  const missing = [];
  for (const entry of rows) {
    const spec = screens[entry.name];
    const state = !spec ? 'NOT REGISTERED' : spec.notReachable ? `not reachable yet: ${spec.notReachable}` : 'ok';
    if (spec && !spec.notReachable) reachable++;
    if (!spec) missing.push(entry.name);
    console.log(`${entry.name.padEnd(22)} ${entry.platform.padEnd(12)} ${entry.size.join('×').padEnd(10)} ${state}${spec?.note ? `  (${spec.note})` : ''}`);
  }
  console.log(`\n${reachable} reachable of ${rows.length} reference screens${missing.length ? `; unregistered: ${missing.join(', ')}` : ''}`);
}

async function main() {
  const selected = referenceIndex
    .filter(entry => entry.platform !== 'components')
    .filter(entry => !platformFilter || entry.platform === platformFilter)
    .filter(entry => !names.length || names.includes(entry.name))
    .filter(entry => names.length || (screens[entry.name] && !screens[entry.name].notReachable));
  const unknown = names.filter(name => !reference(name));
  if (unknown.length) console.error(`Unknown reference screen(s): ${unknown.join(', ')}`);
  const browser = await chromium.launch({ headless: !flag('--headed') });
  const summary = { ok: [], failed: [] };
  try {
    for (const entry of selected) {
      const started = Date.now();
      try {
        const { file, problems } = await shoot(browser, entry.name, { debug: flag('--debug') });
        summary.ok.push(entry.name);
        console.log(`ok   ${entry.name.padEnd(22)} ${((Date.now() - started) / 1000).toFixed(1)}s  ${file.replace(`${root}/`, '')}${problems.length ? `\n     ${problems.join('\n     ')}` : ''}`);
      } catch (error) {
        summary.failed.push(entry.name);
        console.log(`FAIL ${entry.name.padEnd(22)} ${String(error.message ?? error).split('\n')[0]}`);
      }
    }
  } finally {
    await browser.close();
    stopServers();
  }
  writeFileSync(join(outDir, 'last-run.json'), JSON.stringify(summary, null, 2));
  console.log(`\n${summary.ok.length} shot, ${summary.failed.length} failed${summary.failed.length ? `: ${summary.failed.join(', ')}` : ''}`);
  process.exitCode = summary.failed.length ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(outDir, { recursive: true });
  if (flag('--list')) list();
  else main().catch(error => { console.error(error); process.exit(1); });
}
