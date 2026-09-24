#!/usr/bin/env node
/* Capture the isolated Lightning entry with the same backend fixtures and
 * 1920×1080 browser frame as the React TV reference harness. */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { installBackend } from './backend.ts';
import { outDir, reference } from './shoot.mjs';

const name = process.argv[2] ?? 'TvPairing';
const viaPlay = process.argv.includes('--via-play');
const platform = process.argv.find(arg => arg.startsWith('--platform='))?.slice('--platform='.length) ?? 'tizen';
if (!['TvPairing', 'TvPairingLoading', 'TvPairingExpired', 'TvProfiles', 'TvProfilesManage', 'TvManageCue', 'TvHome', 'TvTitle', 'TvSources', 'TvSourceProvider', 'TvSourceDetails'].includes(name)) {
  console.error('Usage: node tests/preview/lightning-shoot.mjs [TvPairing|TvPairingLoading|TvPairingExpired|TvProfiles|TvProfilesManage|TvManageCue|TvHome|TvTitle|TvSources|TvSourceProvider|TvSourceDetails] [--platform=tizen|vizio|webos]');
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
  const backend = await installBackend(page, { family: 'tv', session: name === 'TvHome' || name === 'TvTitle' || name === 'TvSources' || name === 'TvSourceProvider' || name === 'TvSourceDetails' ? 'ready' : profiles ? 'profiles' : 'none', pairing: name === 'TvPairingLoading' ? 'loading' : name === 'TvPairingExpired' ? 'expired' : undefined });
  const url = process.env.LIGHTNING_PREVIEW_URL ?? 'http://127.0.0.1:4180/lightning.html';
  await page.goto(`${url}?platform=${platform}&focusdebug=1`);
  await page.locator('canvas').waitFor({ state: 'visible', timeout: 20000 }).catch(async cause => {
    throw new Error(`${cause.message}\nPage: ${await page.locator('body').innerText()}\n${errors.join('\n')}`);
  });
  await page.waitForTimeout(name === 'TvPairingExpired' ? 2200 : name === 'TvHome' || name === 'TvTitle' || name === 'TvSources' || name === 'TvSourceProvider' || name === 'TvSourceDetails' ? 1800 : 900);
  if (name === 'TvTitle' || name === 'TvSources' || name === 'TvSourceProvider' || name === 'TvSourceDetails') {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 5000 });
    await focused('home-action', 0);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await focused('title-action', 0);
    await page.waitForTimeout(350);
    if (name === 'TvSources' || name === 'TvSourceProvider' || name === 'TvSourceDetails') {
      if (!viaPlay) await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      await focused('source-row', 0);
      await page.waitForTimeout(150);
      if (name === 'TvSourceProvider') {
        await page.keyboard.press('ArrowUp');
        await focused('source-provider', 0);
        await page.keyboard.press('Enter');
        await focused('provider-option', 0);
        await page.waitForTimeout(100);
      }
      if (name === 'TvSourceDetails') {
        await page.keyboard.down('Enter');
        await page.waitForTimeout(750);
        await page.keyboard.up('Enter');
        await focused('source-details-close', 0);
        await page.waitForTimeout(150);
        if (await page.evaluate(() => window.__viptvSourceIntent))
          throw new Error('Held source OK also selected a source on release');
      }
    }
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
  const file = join(outDir, `${name}.lightning${viaPlay ? '.resume' : ''}${platform === 'tizen' ? '' : `.${platform}`}.png`);
  await page.screenshot({ path: file });
  const pairingRequests = () => backend.requests.filter(request => request.path === '/api/auth/device/code').length;
  if (pairingRequests() !== (profiles || name === 'TvHome' || name === 'TvTitle' || name === 'TvSources' || name === 'TvSourceProvider' || name === 'TvSourceDetails' ? 0 : 1)) throw new Error(`Unexpected device-pairing request count ${pairingRequests()}`);
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
  if (name === 'TvSources') {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 5000 });
    if (!backend.requests.some(request => request.path === '/api/streams' && request.method === 'POST') ||
        !backend.requests.some(request => request.path.startsWith('/api/streams/')))
      throw new Error(`Source discovery did not start and poll: ${JSON.stringify(backend.requests)}`);
    await page.keyboard.press('ArrowDown');
    await focused('source-row', 1);
    await page.keyboard.press('Enter');
    const intent = await page.evaluate(() => window.__viptvSourceIntent);
    if (intent?.sourceId !== 'source-2' || intent?.itemId !== 'tt-monster:1:1' || intent?.position !== 4 || intent?.resume !== viaPlay)
      throw new Error(`Wrong exact source intent: ${JSON.stringify(intent)}`);
    for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(120);
    await page.screenshot({ path: join(outDir, 'TvSources.lightning.paged.png') });
    await page.keyboard.press('Enter');
    const pagedIntent = await page.evaluate(() => window.__viptvSourceIntent);
    if (pagedIntent?.sourceId !== 'source-7')
      throw new Error(`Source rows did not page to the seventh source: ${JSON.stringify(pagedIntent)}`);
    await page.keyboard.press('ArrowRight');
    await focused('source-chip', 1);
    await page.keyboard.press('ArrowRight');
    await focused('source-chip', 2);
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await focused('source-provider', 0);
    await page.keyboard.press('ArrowDown');
    await focused('source-row', 0);
    await page.waitForTimeout(100);
    await page.screenshot({ path: join(outDir, 'TvSources.lightning.filtered.png') });
    await page.keyboard.press('Escape');
    await focused('title-action', viaPlay ? 0 : 1);
    const pollsAfterClose = backend.requests.filter(request => request.path.startsWith('/api/streams/')).length;
    await page.waitForTimeout(1700);
    if (backend.requests.filter(request => request.path.startsWith('/api/streams/')).length !== pollsAfterClose)
      throw new Error('Source polling continued after Back closed the panel');
  }
  if (name === 'TvSourceProvider') {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 5000 });
    await page.keyboard.press('ArrowDown');
    await focused('provider-option', 1);
    await page.keyboard.press('Enter');
    await focused('source-provider', 0);
    const filter = await page.evaluate(() => window.__viptvSourceFilter);
    if (filter?.provider !== 'LordStreams' || filter?.rows !== 3)
      throw new Error(`Wrong provider filter: ${JSON.stringify(filter)}`);
    await page.keyboard.press('Escape');
    await focused('title-action', 1);
  }
  if (name === 'TvSourceDetails') {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 5000 });
    await page.keyboard.press('Escape');
    await focused('source-row', 0);
    await page.keyboard.press('Escape');
    await focused('title-action', 1);
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
