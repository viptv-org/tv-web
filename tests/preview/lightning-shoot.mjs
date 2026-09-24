#!/usr/bin/env node
/* Capture the isolated Lightning entry with the same backend fixtures and
 * 1920×1080 browser frame as the React TV reference harness. */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { installBackend } from './backend.ts';
import { outDir, reference } from './shoot.mjs';

const name = process.argv[2] ?? 'TvPairing';
const platform = process.argv.find(arg => arg.startsWith('--platform='))?.slice('--platform='.length) ?? 'tizen';
if (!['TvPairing', 'TvPairingLoading', 'TvPairingExpired', 'TvProfiles', 'TvProfilesManage', 'TvManageCue', 'TvHome', 'TvTitle'].includes(name)) {
  console.error('Usage: node tests/preview/lightning-shoot.mjs [TvPairing|TvPairingLoading|TvPairingExpired|TvProfiles|TvProfilesManage|TvManageCue|TvHome|TvTitle] [--platform=tizen|vizio|webos]');
  process.exit(2);
}
if (!['tizen', 'vizio', 'webos'].includes(platform)) throw new Error(`Unsupported TV platform ${platform}`);
const entry = reference(name);
if (!entry) throw new Error(`Missing design reference ${name}`);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  const logs = [];
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); else logs.push(message.text()); });
  const profiles = name.startsWith('TvProfiles') || name === 'TvManageCue';
  const backend = await installBackend(page, { family: 'tv', session: name === 'TvHome' || name === 'TvTitle' ? 'ready' : profiles ? 'profiles' : 'none', pairing: name === 'TvPairingLoading' ? 'loading' : name === 'TvPairingExpired' ? 'expired' : undefined });
  const url = process.env.LIGHTNING_PREVIEW_URL ?? 'http://127.0.0.1:4180/lightning.html';
  await page.goto(`${url}?platform=${platform}&focusdebug=1`);
  await page.locator('canvas').waitFor({ state: 'visible', timeout: 20000 }).catch(async cause => {
    throw new Error(`${cause.message}\nPage: ${await page.locator('body').innerText()}\n${errors.join('\n')}`);
  });
  await page.waitForTimeout(name === 'TvPairingExpired' ? 2200 : name === 'TvHome' || name === 'TvTitle' ? 1800 : 900);
  if (name === 'TvTitle') {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 5000 });
    await focused('home-action', 0);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await focused('title-action', 0);
    await page.waitForTimeout(350);
  }
  if (name === 'TvProfilesManage') {
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
  }
  if (name === 'TvManageCue') {
    await page.keyboard.down('Enter');
    await page.waitForTimeout(750);
    await page.keyboard.up('Enter');
    await page.waitForTimeout(100);
    if (backend.requests.some(request => request.path === '/api/auth/profile'))
      throw new Error('Held Enter also selected a profile on release');
  }
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${name}.lightning${platform === 'tizen' ? '' : `.${platform}`}.png`);
  await page.screenshot({ path: file });
  const pairingRequests = () => backend.requests.filter(request => request.path === '/api/auth/device/code').length;
  if (pairingRequests() !== (profiles || name === 'TvHome' || name === 'TvTitle' ? 0 : 1)) throw new Error(`Unexpected device-pairing request count ${pairingRequests()}`);
  if (name === 'TvHome' && !backend.requests.some(request => request.path.endsWith('/continue/page')))
    throw new Error(`Home did not request profile data: ${JSON.stringify(backend.requests)}`);
  if (name === 'TvHome') {
    // Deliberately rapid input catches focus handoff lag: the third control
    // must receive activation even before Blits paints the intermediate focus.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    if (!backend.requests.some(request => request.path.endsWith('/favorites/toggle')))
      throw new Error(`Rapid Right+Right+Enter did not activate My List: ${JSON.stringify(backend.requests)}`);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(120);
    await page.screenshot({ path: join(outDir, 'TvHome.lightning.card-focus.png') });
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(120);
    await page.screenshot({ path: join(outDir, 'TvHome.lightning.card-focus-next.png') });
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(120);
    const favoritesBeforeHold = backend.requests.filter(request => request.path.endsWith('/favorites/toggle')).length;
    await page.keyboard.down('Enter');
    await page.waitForTimeout(750);
    await page.keyboard.up('Enter');
    await page.waitForTimeout(100);
    if (backend.requests.filter(request => request.path.endsWith('/favorites/toggle')).length !== favoritesBeforeHold)
      throw new Error('Held Home OK also activated the focused action on release');
  }
  if (name === 'TvTitle') {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 5000 });
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(180);
    if (!backend.requests.some(request => request.path.endsWith('/favorites/toggle')))
      throw new Error('Title My List action did not use the shared API');
    await focused('title-action', 2);
    await page.keyboard.press('ArrowDown');
    await focused('title-episode', 0);
    await page.keyboard.press('ArrowRight');
    await focused('title-episode', 1);
    await page.screenshot({ path: join(outDir, 'TvTitle.lightning.episode-focus.png') });
    const detailRequests = () => backend.requests.filter(request => request.path === '/api/meta/series/tt-monster').length;
    const beforeBack = detailRequests();
    await page.keyboard.press('Escape');
    await focused('home-action', 1);
    await page.screenshot({ path: join(outDir, 'TvTitle.lightning.back-home.png') });
    await page.keyboard.press('Enter');
    await focused('title-action', 0);
    if (detailRequests() <= beforeBack)
      throw new Error(`Back did not restore Details focus: ${JSON.stringify(backend.requests)}`);
    await page.keyboard.press('Escape');
    await focused('home-action', 1);
    const movieDetailsBefore = backend.requests.filter(request => request.path === '/api/meta/movie/tt-obsession').length;
    await page.keyboard.press('ArrowDown');
    await focused('home-card', 0);
    await page.keyboard.press('ArrowRight');
    await focused('home-card', 1);
    await page.keyboard.press('Enter');
    await focused('title-action', 0);
    if (backend.requests.filter(request => request.path === '/api/meta/movie/tt-obsession').length <= movieDetailsBefore)
      throw new Error(`Home card Right+Enter did not open the selected movie title; requests: ${JSON.stringify(backend.requests)}; errors: ${JSON.stringify(errors)}`);
    await page.screenshot({ path: join(outDir, 'TvTitle.lightning.card-route.png') });
    await page.keyboard.press('Escape');
    await focused('home-card', 1);
    await page.screenshot({ path: join(outDir, 'TvTitle.lightning.card-return.png') });
  }
  if (name === 'TvPairingExpired') {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    if (pairingRequests() !== 2) throw new Error('Enter release did not request a fresh pairing code');
  }
  if (name === 'TvProfiles') {
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const selection = backend.requests.find(request => request.path === '/api/auth/profile');
    if (!selection || (selection.body?.profile_id ?? selection.body?.profileId) !== '2')
      throw new Error(`Right then Enter did not select the second profile; requests: ${JSON.stringify(backend.requests)}; errors: ${JSON.stringify(errors)}; logs: ${JSON.stringify(logs)}`);
  }
  const unexpected = errors.filter(message => !/Failed to load resource: the server responded with a status of 400/.test(message));
  if (unexpected.length || backend.errors.length) throw new Error([...unexpected, ...backend.errors].join('\n'));
  console.log(file);
} finally {
  await browser.close();
}
