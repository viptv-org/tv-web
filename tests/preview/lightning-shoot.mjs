#!/usr/bin/env node
/* Capture the isolated Lightning entry with the same backend fixtures and
 * 1920×1080 browser frame as the React TV reference harness. */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { installBackend, installMediaStubs } from './backend.ts';
import { outDir, reference } from './shoot.mjs';

const name = process.argv[2] ?? 'TvPairing';
const viaPlay = process.argv.includes('--via-play');
const searchFailure = process.argv.includes('--search-fail');
const emptySearch = process.argv.includes('--empty-search');
const platform = process.argv.find(arg => arg.startsWith('--platform='))?.slice('--platform='.length) ?? 'tizen';
const settingsNames = ['TvSettings', 'TvPlayback', 'TvPlaybackChoice', 'TvAddons', 'TvAddonManage', 'TvAddonRemove', 'TvSignOut'];
if (!['TvPairing', 'TvPairingLoading', 'TvPairingExpired', 'TvProfiles', 'TvProfilesManage', 'TvManageCue', 'TvHome', 'TvMenu', 'TvDiscover', 'TvDiscoverFilter', 'TvLibrary', 'TvItemMenu', 'TvSearch', 'TvLive', 'TvLiveDetails', 'TvLiveSearch', ...settingsNames, 'TvTitle', 'TvSources', 'TvSourceProvider', 'TvSourceDetails', 'TvPlayer', 'TvPlayerSeek', 'TvPlayerSubs'].includes(name)) {
  console.error('Usage: node tests/preview/lightning-shoot.mjs [TvPairing|TvPairingLoading|TvPairingExpired|TvProfiles|TvProfilesManage|TvManageCue|TvHome|TvMenu|TvDiscover|TvDiscoverFilter|TvLibrary|TvItemMenu|TvSearch|TvLive|TvLiveDetails|TvLiveSearch|TvTitle|TvSources|TvSourceProvider|TvSourceDetails|TvPlayer|TvPlayerSeek|TvPlayerSubs] [--platform=tizen|vizio|webos]');
  process.exit(2);
}
if (!['tizen', 'vizio', 'webos'].includes(platform)) throw new Error(`Unsupported TV platform ${platform}`);
const entry = reference(name);
if (!entry) throw new Error(`Missing design reference ${name}`);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
    ...(name.startsWith('TvLive') ? { timezoneId: 'America/New_York' } : {}) });
  if (name.startsWith('TvLive')) await page.clock.setFixedTime(new Date('2026-09-23T10:55:00-04:00'));
  const errors = [];
  const logs = [];
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); else logs.push(message.text()); });
  const profiles = name.startsWith('TvProfiles') || name === 'TvManageCue';
  const backend = await installBackend(page, { family: 'tv', session: settingsNames.includes(name) || name === 'TvHome' || name === 'TvMenu' || name === 'TvDiscover' || name === 'TvDiscoverFilter' || name === 'TvLibrary' || name === 'TvItemMenu' || name === 'TvSearch' || name === 'TvLive' || name === 'TvLiveDetails' || name === 'TvLiveSearch' || name === 'TvTitle' || name === 'TvSources' || name === 'TvSourceProvider' || name === 'TvSourceDetails' || name === 'TvPlayer' || name === 'TvPlayerSeek' || name === 'TvPlayerSubs' ? 'ready' : profiles ? 'profiles' : 'none', pairing: name === 'TvPairingLoading' ? 'loading' : name === 'TvPairingExpired' ? 'expired' : undefined, favorites: name === 'TvLibrary', searchFail: searchFailure });
  if (name === 'TvPlayer' || name === 'TvPlayerSeek' || name === 'TvPlayerSubs' || name === 'TvLibrary' || name === 'TvItemMenu') await installMediaStubs(page, { frame: '63e024', paused: name === 'TvPlayer' });
  const url = process.env.LIGHTNING_PREVIEW_URL ?? 'http://127.0.0.1:4180/lightning.html';
  await page.goto(`${url}?platform=${platform}&focusdebug=1`);
  await page.locator('canvas').waitFor({ state: 'visible', timeout: 20000 }).catch(async cause => {
    throw new Error(`${cause.message}\nPage: ${await page.locator('body').innerText()}\n${errors.join('\n')}`);
  });
  await page.waitForTimeout(name === 'TvPairingExpired' ? 2200 : settingsNames.includes(name) || name === 'TvHome' || name === 'TvMenu' || name === 'TvDiscover' || name === 'TvDiscoverFilter' || name === 'TvLibrary' || name === 'TvItemMenu' || name === 'TvSearch' || name === 'TvLive' || name === 'TvLiveDetails' || name === 'TvLiveSearch' || name === 'TvTitle' || name === 'TvSources' || name === 'TvSourceProvider' || name === 'TvSourceDetails' || name === 'TvPlayer' || name === 'TvPlayerSeek' || name === 'TvPlayerSubs' ? 1800 : 900);
  if (settingsNames.includes(name)) {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 7000 });
    await focused('home-action', 0);
    await page.keyboard.press('ArrowLeft');
    await focused('rail-item', 2);
    for (let step = 0; step < 4; step++) {
      await page.keyboard.press('ArrowDown');
      await focused('rail-item', step + 3);
    }
    await page.keyboard.press('Enter');
    await focused('settings-row', 0);
    await page.waitForTimeout(300);
    if (name === 'TvPlayback' || name === 'TvPlaybackChoice') {
      await page.keyboard.press('ArrowDown');
      await focused('settings-row', 1);
      await page.keyboard.press('Enter');
      await focused('settings-row', 0);
      if (name === 'TvPlayback') {
        for (let step = 0; step < 5; step++) {
          await page.keyboard.press('ArrowDown');
          await focused('settings-row', step + 1);
        }
      } else {
        for (let step = 0; step < 3; step++) {
          await page.keyboard.press('ArrowDown');
          await focused('settings-row', step + 1);
        }
        await page.keyboard.press('Enter');
        await focused('settings-choice', 1);
      }
    } else if (name === 'TvAddons' || name === 'TvAddonManage' || name === 'TvAddonRemove') {
      for (let step = 0; step < 3; step++) {
        await page.keyboard.press('ArrowDown');
        await focused('settings-row', step + 1);
      }
      await page.keyboard.press('Enter');
      await focused('settings-row', 0);
      const targetAddonRow = name === 'TvAddonRemove' ? 2 : 3;
      for (let step = 0; step < targetAddonRow; step++) {
        await page.keyboard.press('ArrowDown');
        await focused('settings-row', step + 1);
      }
      if (name !== 'TvAddons') {
        await page.keyboard.press('Enter');
        await focused('settings-choice', 0);
        if (name === 'TvAddonRemove') {
          await page.keyboard.press('ArrowDown');
          await focused('settings-choice', 1);
          await page.keyboard.press('Enter');
          await focused('settings-choice', 0);
        }
      }
    } else if (name === 'TvSignOut') {
      for (let step = 0; step < 5; step++) {
        await page.keyboard.press('ArrowDown');
        await focused('settings-row', step + 1);
      }
      await page.keyboard.press('Enter');
      await focused('settings-choice', 1);
    }
    await page.waitForTimeout(300);
  }
  if (name === 'TvLive' || name === 'TvLiveDetails' || name === 'TvLiveSearch') {
    await page.waitForFunction(() => window.__viptvFocus?.view === 'home-action' && window.__viptvFocus?.index === 0, null, { timeout: 5000 });
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'rail-item' && window.__viptvFocus?.index === 2, null, { timeout: 5000 });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'rail-item' && window.__viptvFocus?.index === 4, null, { timeout: 5000 });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'guide-channel' && window.__viptvFocus?.index === 0, null, { timeout: 10000 });
    await page.waitForTimeout(450);
    if (name === 'TvLiveSearch') {
      await page.keyboard.press('ArrowUp');
      await page.waitForFunction(() => window.__viptvFocus?.view === 'live-filter' && window.__viptvFocus?.index === 1, null, { timeout: 5000 });
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(() => window.__viptvFocus?.view === 'live-filter' && window.__viptvFocus?.index === 0, null, { timeout: 5000 });
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.__viptvFocus?.view === 'live-search-key' && window.__viptvFocus?.index === 0, null, { timeout: 5000 }).catch(async cause => {
        throw new Error(`${cause.message}; focus ${JSON.stringify(await page.evaluate(() => window.__viptvFocus))}; live ${JSON.stringify(await page.evaluate(() => window.__viptvLive))}; errors ${JSON.stringify(errors)}`);
      });
      await page.keyboard.type('cnb', { delay: 50 });
      await page.waitForTimeout(500);
    } else {
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'guide-channel' && window.__viptvFocus?.index === 1, null, { timeout: 5000 });
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'guide-program' && window.__viptvLive?.row === 1 && window.__viptvLive?.cell === 0, null, { timeout: 5000 }).catch(async cause => {
      mkdirSync(outDir, { recursive: true });
      await page.screenshot({ path: join(outDir, 'TvLive.lightning.debug.png') });
      throw new Error(`${cause.message}; focus ${JSON.stringify(await page.evaluate(() => window.__viptvFocus))}; live ${JSON.stringify(await page.evaluate(() => window.__viptvLive))}; recent ${JSON.stringify(backend.requests.slice(-15))}; errors ${JSON.stringify(errors)}`);
    });
    await page.waitForTimeout(200);
    if (name === 'TvLiveDetails') {
      await page.keyboard.down('Enter');
      await page.waitForTimeout(750);
      await page.keyboard.up('Enter');
      await page.waitForFunction(() => window.__viptvFocus?.view === 'live-details-option' && window.__viptvFocus?.index === 0, null, { timeout: 5000 });
      await page.waitForTimeout(500);
    }
    }
  }
  if (name === 'TvSearch') {
    await page.waitForFunction(() => window.__viptvFocus?.view === 'home-action' && window.__viptvFocus?.index === 0, null, { timeout: 5000 });
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'rail-item' && window.__viptvFocus?.index === 2, null, { timeout: 5000 });
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'search-key' && window.__viptvFocus?.index === 0, null, { timeout: 5000 });
    if (!searchFailure && !emptySearch) {
      mkdirSync(outDir, { recursive: true });
      await page.waitForTimeout(120);
      await page.screenshot({ path: join(outDir, `TvSearch.lightning.blank${platform === 'tizen' ? '' : `.${platform}`}.png`) });
    }
    const query = emptySearch ? 'zzzz' : 'naruto';
    await page.keyboard.type(query, { delay: 40 });
    await page.waitForFunction(({ query, emptySearch, searchFailure }) =>
      window.__viptvSearch?.query === query && window.__viptvSearch?.done === true && window.__viptvSearch?.busy === false &&
      (emptySearch ? window.__viptvSearch.count === 0 : window.__viptvSearch.count > 0) &&
      (!searchFailure || window.__viptvSearch.partial === true),
    { query, emptySearch, searchFailure }, { timeout: 15000 });
    const resultCount = await page.evaluate(() => window.__viptvSearch?.count);
    if (!emptySearch && resultCount !== (searchFailure ? 1 : 14))
      throw new Error(`Search section count differs from the fixture: ${resultCount}`);
    for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'search-key' && window.__viptvFocus?.index === 19, null, { timeout: 5000 });
    await page.waitForTimeout(350);
  }
  if (name === 'TvItemMenu') {
    await page.waitForFunction(() => window.__viptvFocus?.view === 'home-action' && window.__viptvFocus?.index === 0, null, { timeout: 5000 });
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'home-card' && window.__viptvFocus?.index === 0, null, { timeout: 5000 });
    await page.keyboard.down('Enter');
    await page.waitForTimeout(750);
    await page.keyboard.up('Enter');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'title-menu-option' && window.__viptvFocus?.index === 0, null, { timeout: 5000 });
    await page.waitForTimeout(180);
    if (backend.requests.some(request => request.path === '/api/streams'))
      throw new Error('Held Home card also opened sources on release');
  }
  if (name === 'TvLibrary') {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 10000 });
    await focused('home-action', 0);
    await page.keyboard.press('ArrowLeft');
    await focused('rail-item', 2);
    for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowDown');
    await focused('rail-item', 5);
    await page.keyboard.press('Enter');
    await focused('library-card', 0).catch(async cause => {
      await page.screenshot({ path: join(outDir, 'TvLibrary.lightning.debug.png') });
      throw new Error(`${cause.message}; focus ${JSON.stringify(await page.evaluate(() => window.__viptvFocus))}; requests ${JSON.stringify(backend.requests)}; errors ${JSON.stringify(errors)}`);
    });
    await page.keyboard.press('ArrowUp');
    await focused('library-segment', 0);
    await page.keyboard.press('ArrowRight');
    await focused('library-segment', 1);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowDown');
    await focused('library-card', 0);
    await page.waitForTimeout(180);
  }
  if (name === 'TvDiscover' || name === 'TvDiscoverFilter') {
    await page.waitForFunction(() => window.__viptvFocus?.view === 'home-action', null, { timeout: 5000 });
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'rail-item' && window.__viptvFocus?.index === 2, null, { timeout: 5000 });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'discover-card' && window.__viptvFocus?.index === 0, null, { timeout: 10000 });
    if (name === 'TvDiscover') {
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => window.__viptvFocus?.view === 'discover-card' && window.__viptvFocus?.index === 1, null, { timeout: 5000 });
    } else {
      await page.keyboard.press('ArrowUp');
      await page.waitForFunction(() => window.__viptvFocus?.view === 'discover-chip' && window.__viptvFocus?.index === 0, null, { timeout: 5000 });
      for (let step = 0; step < 8; step++) await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => window.__viptvFocus?.view === 'discover-chip' && window.__viptvFocus?.index === 8, null, { timeout: 5000 });
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.__viptvFocus?.view === 'discover-filter-option' && window.__viptvFocus?.index === 0, null, { timeout: 5000 });
      const filter = await page.evaluate(() => window.__viptvDiscoverFilter);
      if (!filter?.open) throw new Error(`Discover filter did not stay open: ${JSON.stringify(filter)}`);
    }
    await page.waitForTimeout(250);
  }
  if (name === 'TvMenu') {
    await page.waitForFunction(() => window.__viptvFocus?.view === 'home-action', null, { timeout: 5000 });
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'rail-item' && window.__viptvFocus?.index === 2, null, { timeout: 5000 });
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'rail-item' && window.__viptvFocus?.index === 3, null, { timeout: 5000 });
    await page.waitForTimeout(150);
  }
  if (name === 'TvTitle' || name === 'TvSources' || name === 'TvSourceProvider' || name === 'TvSourceDetails' || name === 'TvPlayer' || name === 'TvPlayerSeek' || name === 'TvPlayerSubs') {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 5000 });
    await focused('home-action', 0);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await focused('title-action', 0);
    await page.waitForTimeout(350);
    if (name === 'TvSources' || name === 'TvSourceProvider' || name === 'TvSourceDetails' || name === 'TvPlayer' || name === 'TvPlayerSeek' || name === 'TvPlayerSubs') {
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
      if (name === 'TvPlayer') {
        await page.keyboard.press('Enter');
        await focused('player-control', 1);
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => window.__viptvPlayer?.state === 'paused', null, { timeout: 5000 });
        await page.waitForTimeout(150);
      }
      if (name === 'TvPlayerSeek') {
        await page.keyboard.press('Enter');
        await focused('player-control', 1);
        await page.keyboard.press('ArrowUp');
        await focused('player-timeline', 0);
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(140);
      }
      if (name === 'TvPlayerSubs') {
        await page.keyboard.press('Enter');
        await focused('player-control', 1);
        for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowRight');
        await focused('player-control', 5);
        await page.keyboard.press('Enter');
        await focused('player-track-option', 1);
        await page.waitForTimeout(500);
        const panel = await page.evaluate(() => window.__viptvTrackPanel);
        if (!panel?.open || panel.kind !== 'text')
          throw new Error(`Subtitle panel closed unexpectedly: ${JSON.stringify(panel)}; errors: ${JSON.stringify(errors)}`);
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
  const file = join(outDir, `${name}.lightning${viaPlay ? '.resume' : ''}${searchFailure ? '.failure' : emptySearch ? '.empty' : ''}${platform === 'tizen' ? '' : `.${platform}`}.png`);
  await page.screenshot({ path: file });
  if (settingsNames.includes(name)) {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 7000 });
    if (name === 'TvSettings') {
      await page.keyboard.press('ArrowRight');
      await focused('settings-profile', 0);
      await page.keyboard.press('ArrowLeft');
      await focused('settings-row', 0);
      await page.keyboard.press('Escape');
      await focused('home-action', 0);
    } else if (name === 'TvPlaybackChoice') {
      await page.keyboard.press('ArrowUp');
      await focused('settings-choice', 0);
      await page.keyboard.press('Enter');
      await focused('settings-row', 3);
      await page.waitForFunction(() => window.__viptvFocus?.view === 'settings-row', null, { timeout: 5000 });
      if (!backend.requests.some(request => request.method === 'PUT' && request.path.includes('/preferences')))
        throw new Error('Playback preference selection did not save through the profile API');
      await page.keyboard.press('Escape');
      await focused('settings-row', 1);
      await page.keyboard.press('Escape');
      await focused('home-action', 0);
    } else if (name === 'TvSignOut') {
      await page.keyboard.press('Escape');
      await focused('settings-row', 5);
      if (backend.requests.some(request => request.path.includes('logout') || request.path.includes('signout')))
        throw new Error('Cancel revoked the TV session');
    } else if (name === 'TvAddons') {
      await page.keyboard.press('Escape');
      await focused('settings-row', 3);
      await page.keyboard.press('Escape');
      await focused('home-action', 0);
    } else if (name === 'TvAddonManage') {
      await page.keyboard.press('Enter');
      await focused('settings-row', 3);
      if (!backend.requests.some(request => request.path.includes('/api/addons/') && request.method !== 'GET'))
        throw new Error('Addon enable action did not reach the addon API');
    } else if (name === 'TvAddonRemove') {
      await page.keyboard.press('Escape');
      await focused('settings-choice', 0);
      await page.keyboard.press('Escape');
      await focused('settings-row', 2).catch(async cause => {
        throw new Error(`${cause.message}; focus ${JSON.stringify(await page.evaluate(() => window.__viptvFocus))}; errors ${JSON.stringify(errors)}`);
      });
      if (backend.requests.some(request => request.method === 'DELETE' && request.path.includes('/api/addons/')))
        throw new Error('Cancelled addon removal called DELETE');
    }
  }
  if (name === 'TvLive') {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 7000 });
    const beforeStreams = backend.requests.filter(request => request.path === '/api/streams').length;
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => window.__viptvLive?.row === 1 && window.__viptvLive?.cell === 1, null, { timeout: 5000 });
    await page.keyboard.press('Enter');
    await focused('live-details-option', 0);
    if (backend.requests.filter(request => request.path === '/api/streams').length !== beforeStreams)
      throw new Error('Future programme OK started live playback');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'guide-program' && window.__viptvLive?.row === 1 && window.__viptvLive?.cell === 1, null, { timeout: 5000 });
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'guide-program' && window.__viptvLive?.row === 1 && window.__viptvLive?.cell === 0, null, { timeout: 5000 });
    await page.keyboard.press('Enter');
    await focused('source-row', 0);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'guide-program' && window.__viptvLive?.row === 1 && window.__viptvLive?.cell === 0, null, { timeout: 5000 });
    await page.keyboard.press('ArrowUp');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'guide-program' && window.__viptvLive?.row === 0, null, { timeout: 5000 });
    await page.keyboard.press('ArrowUp');
    await focused('live-filter', 1).catch(async cause => {
      throw new Error(`${cause.message}; focus ${JSON.stringify(await page.evaluate(() => window.__viptvFocus))}; live ${JSON.stringify(await page.evaluate(() => window.__viptvLive))}; logs ${JSON.stringify(logs.filter(log => log.startsWith('LIVE_')))}; errors ${JSON.stringify(errors)}`);
    });
    for (let step = 0; step < 3; step++) {
      await page.keyboard.press('ArrowRight');
      await focused('live-filter', step + 2).catch(async cause => {
        throw new Error(`${cause.message}; step ${step}; focus ${JSON.stringify(await page.evaluate(() => window.__viptvFocus))}; live ${JSON.stringify(await page.evaluate(() => window.__viptvLive))}; logs ${JSON.stringify(logs.filter(log => log.startsWith('LIVE_')))}; errors ${JSON.stringify(errors)}`);
      });
    }
    await focused('live-filter', 4).catch(async cause => {
      throw new Error(`${cause.message}; focus ${JSON.stringify(await page.evaluate(() => window.__viptvFocus))}; live ${JSON.stringify(await page.evaluate(() => window.__viptvLive))}; errors ${JSON.stringify(errors)}`);
    });
    await page.keyboard.press('Enter');
    await focused('guide-channel', 0);
    if (!backend.requests.some(request => request.path === '/api/live' && request.query.includes('category=news')))
      throw new Error('News filter did not request its channel category');
    await page.keyboard.press('Escape');
    await focused('home-action', 0);
  }
  if (name === 'TvLiveDetails') {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 5000 });
    await page.keyboard.press('ArrowDown');
    await focused('live-details-option', 1);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'guide-program' && window.__viptvLive?.row === 1 && window.__viptvLive?.cell === 0, null, { timeout: 5000 });
    await page.keyboard.press('ContextMenu');
    await focused('live-details-option', 0);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'guide-program' && window.__viptvLive?.row === 1 && window.__viptvLive?.cell === 0, null, { timeout: 5000 });
  }
  if (name === 'TvLiveSearch') {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'live-filter' && window.__viptvFocus?.index === 0, null, { timeout: 5000 });
    await page.waitForTimeout(180);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'live-search-key' && window.__viptvFocus?.index === 0, null, { timeout: 5000 }).catch(async cause => {
      throw new Error(`${cause.message}; focus ${JSON.stringify(await page.evaluate(() => window.__viptvFocus))}; live ${JSON.stringify(await page.evaluate(() => window.__viptvLive))}; errors ${JSON.stringify(errors)}`);
    });
    for (let step = 0; step < 8; step++) await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'live-search-key' && window.__viptvFocus?.index === 45, null, { timeout: 5000 }).catch(async cause => {
      await page.screenshot({ path: join(outDir, 'TvLiveSearch.lightning.debug.png') });
      throw new Error(`${cause.message}; focus ${JSON.stringify(await page.evaluate(() => window.__viptvFocus))}; errors ${JSON.stringify(errors)}`);
    });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__viptvFocus?.view === 'guide-channel' && window.__viptvFocus?.index === 0, null, { timeout: 5000 });
    if (!backend.requests.some(request => request.path === '/api/live' && request.query.includes('search=cnb')))
      throw new Error(`Live search did not request matching channels: ${JSON.stringify(backend.requests.filter(request => request.path === '/api/live'))}; focus ${JSON.stringify(await page.evaluate(() => window.__viptvFocus))}`);
  }
  if (name === 'TvMenu') {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 5000 });
    await page.keyboard.press('ArrowRight');
    await focused('home-action', 0);
    await page.keyboard.press('ArrowLeft');
    await focused('rail-item', 2);
    await page.keyboard.press('Escape');
    await focused('home-action', 0);
    await page.keyboard.press('ArrowLeft');
    await focused('rail-item', 2);
    await page.keyboard.press('ArrowUp');
    await focused('rail-item', 1);
    await page.keyboard.press('ArrowUp');
    await focused('rail-item', 0);
    await page.keyboard.press('Enter');
    await focused('profile-tile', 0);
  }
  if (name === 'TvItemMenu') {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 7000 });
    const hold = async () => {
      await page.keyboard.down('Enter');
      await page.waitForTimeout(750);
      await page.keyboard.up('Enter');
      await focused('title-menu-option', 0);
    };
    const reset = async () => {
      await page.reload();
      await focused('home-action', 0);
      await page.keyboard.press('ArrowDown');
      await focused('home-card', 0);
    };
    await page.keyboard.press('Escape');
    await focused('home-card', 0);
    await page.keyboard.press('ContextMenu');
    await focused('title-menu-option', 0);
    await page.keyboard.press('Escape');
    await focused('home-card', 0);
    await hold();
    await page.keyboard.press('ArrowDown');
    await focused('title-menu-option', 1);
    await page.keyboard.press('Enter');
    await focused('source-row', 0);
    await page.keyboard.press('Escape');
    await focused('home-card', 0);
    await reset();
    await hold();
    await page.keyboard.press('Enter');
    await focused('source-row', 0);
    await page.keyboard.press('Enter');
    await focused('player-control', 1);
    const previousIntent = await page.evaluate(() => window.__viptvSourceIntent);
    if (previousIntent?.position !== 600 || previousIntent?.resume !== true)
      throw new Error(`Previous episode lost Resume intent: ${JSON.stringify(previousIntent)}`);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await focused('source-row', 0);
    await page.keyboard.press('Escape');
    await focused('home-card', 0);
    await reset();
    await hold();
    for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowDown');
    await focused('title-menu-option', 3);
    await page.keyboard.press('Enter');
    await focused('source-row', 0);
    await page.keyboard.press('Enter');
    await focused('player-control', 1);
    const restartIntent = await page.evaluate(() => window.__viptvSourceIntent);
    if (restartIntent?.position !== 0 || restartIntent?.resume !== false)
      throw new Error(`Watch from beginning reused Resume intent: ${JSON.stringify(restartIntent)}`);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await focused('source-row', 0);
    await page.keyboard.press('Escape');
    await focused('home-card', 0);
    await reset();
    await hold();
    for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowDown');
    await focused('title-menu-option', 4);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__viptvTitleMenu?.open && window.__viptvTitleMenu?.kind === 'undo', null, { timeout: 7000 });
    await focused('title-menu-option', 0);
    await page.screenshot({ path: join(outDir, `TvItemMenu.lightning.undo${platform === 'tizen' ? '' : `.${platform}`}.png`) });
    if (!backend.requests.some(request => request.path.endsWith('/continue/visibility') && request.body.hidden === true))
      throw new Error('Hide did not update queue visibility');
    await page.keyboard.press('Enter');
    await focused('home-card', 0);
    if (!backend.requests.some(request => request.path.endsWith('/continue/visibility') && request.body.hidden === false))
      throw new Error('Undo did not restore queue visibility');
    await reset();
    await hold();
    for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowDown');
    await focused('title-menu-option', 5);
    await page.keyboard.press('Enter');
    await focused('home-card', 0);
    if (!backend.requests.some(request => request.path.endsWith('/favorites/toggle')))
      throw new Error('Title menu My List action did not reach the shared API');
    await reset();
    await hold();
    for (let step = 0; step < 2; step++) await page.keyboard.press('ArrowDown');
    await focused('title-menu-option', 2);
    await page.keyboard.press('Enter');
    await focused('home-card', 0);
    if (!backend.requests.some(request => request.path.includes('/progress') && request.method !== 'GET'))
      throw new Error('Mark watched did not correct progress');
  }
  if (name === 'TvSearch' && !searchFailure && !emptySearch) {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 7000 });
    if (!backend.requests.some(request => request.path === '/api/discover' && request.query.includes('search=naruto')) ||
        !backend.requests.some(request => request.path === '/api/live' && request.query.includes('search=naruto')))
      throw new Error('Search did not query both searchable catalogs and Live TV');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__viptvSearch?.query === 'narutot', null, { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__viptvSearch?.query === 'naruto', null, { timeout: 5000 });
    if (backend.requests.some(request => request.path === '/api/discover' && request.query.includes('search=narutot')))
      throw new Error('Replaced search query started a stale catalog request');
    await page.waitForFunction(() => window.__viptvSearch?.query === 'naruto' && window.__viptvSearch?.count > 0 && !window.__viptvSearch?.busy, null, { timeout: 10000 });
    for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowRight');
    await focused('search-card', 0);
    await page.keyboard.down('Enter');
    await page.waitForTimeout(750);
    await page.keyboard.up('Enter');
    await focused('title-menu-option', 0);
    await page.keyboard.press('Escape');
    await focused('search-card', 0);
    await page.keyboard.press('ArrowLeft');
    await focused('search-key', 23);
    await page.keyboard.press('ArrowRight');
    await focused('search-card', 0);
    await page.keyboard.press('ArrowRight');
    await focused('search-card', 1);
    await page.keyboard.press('Enter');
    await focused('title-action', 0);
    await page.keyboard.press('Escape');
    await focused('search-card', 1);
    await page.keyboard.press('ArrowDown');
    await focused('search-card', 10);
    await page.keyboard.press('ArrowDown');
    await focused('search-card', 13);
    await page.keyboard.down('Enter');
    await page.waitForTimeout(750);
    await page.keyboard.up('Enter');
    await focused('title-menu-option', 0);
    await page.keyboard.press('Escape');
    await focused('search-card', 13).catch(async cause => {
      throw new Error(`${cause.message}; focus ${JSON.stringify(await page.evaluate(() => window.__viptvFocus))}; menu ${JSON.stringify(await page.evaluate(() => window.__viptvTitleMenu))}; search ${JSON.stringify(await page.evaluate(() => window.__viptvSearch))}; errors ${JSON.stringify(errors)}`);
    });
    await page.keyboard.press('ArrowLeft');
    await focused('search-key', 23);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__viptvSearch?.query === 'narut', null, { timeout: 5000 });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await focused('search-key', 38);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__viptvSearch?.query === '', null, { timeout: 5000 });
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await focused('search-key', 36);
    for (let step = 0; step < 6; step++) await page.keyboard.press('ArrowUp');
    await focused('search-key', 0);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__viptvSearch?.query === 'a', null, { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__viptvSearch?.query === '', null, { timeout: 5000 });
    for (let step = 0; step < 6; step++) await page.keyboard.press('ArrowDown');
    await focused('search-key', 36);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__viptvSearch?.query === ' ', null, { timeout: 5000 });
    await page.keyboard.press('ArrowRight');
    await focused('search-key', 37);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__viptvSearch?.query === '', null, { timeout: 5000 });
    await page.keyboard.press('ArrowLeft');
    await focused('search-key', 36);
    await page.keyboard.press('ArrowLeft');
    await focused('rail-item', 1);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await focused('rail-item', 3);
    await page.keyboard.press('Enter');
    await focused('discover-card', 0);
    await page.keyboard.press('Escape');
    await focused('search-key', 36);
    await page.keyboard.press('ArrowLeft');
    await focused('rail-item', 1);
    for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowDown');
    await focused('rail-item', 5);
    await page.keyboard.press('Enter');
    await focused('library-segment', 0);
    await page.keyboard.press('Escape');
    await focused('search-key', 36);
    await page.keyboard.press('Escape');
    await focused('home-action', 0);
  }
  if (name === 'TvDiscover') {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 5000 });
    const beforeHold = backend.requests.filter(request => request.path === '/api/streams').length;
    await page.keyboard.down('Enter');
    await page.waitForTimeout(750);
    await page.keyboard.up('Enter');
    await focused('title-menu-option', 0);
    if (backend.requests.filter(request => request.path === '/api/streams').length !== beforeHold)
      throw new Error('Held Discover card also opened sources on release');
    await page.keyboard.press('Escape');
    await focused('discover-card', 1);
    await page.keyboard.press('Enter');
    await focused('title-action', 0);
    await page.keyboard.press('Escape');
    await focused('discover-card', 1);
    await page.keyboard.press('ArrowDown');
    await focused('discover-card', 5);
    await page.keyboard.press('ArrowDown');
    await focused('discover-card', 9);
    await page.keyboard.press('ArrowDown');
    await focused('discover-card', 13).catch(async cause => {
      throw new Error(`${cause.message}; actual ${JSON.stringify(await page.evaluate(() => ({ focus: window.__viptvFocus, window: window.__viptvDiscoverWindow })))}; errors ${JSON.stringify(errors)}`);
    });
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await focused('discover-card', 1);
    await page.keyboard.press('ArrowUp');
    await focused('discover-chip', 0);
    for (let step = 0; step < 8; step++) await page.keyboard.press('ArrowRight');
    await focused('discover-chip', 8);
    await page.keyboard.press('Enter');
    await focused('discover-filter-option', 0);
    await page.keyboard.press('ArrowDown');
    await focused('discover-filter-option', 1);
    await page.keyboard.press('Enter');
    await focused('discover-chip', 8);
    if (!backend.requests.some(request => request.path === '/api/discover' && request.query.includes('genre=Action')))
      throw new Error(`Genre selection did not request the filtered catalog: ${JSON.stringify(backend.requests)}`);
    for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowLeft');
    await focused('discover-chip', 5);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(180);
    if (!backend.requests.some(request => request.path === '/api/discover' && request.query.includes('catalog=seasonal')))
      throw new Error('Catalog chip did not request Seasonal');
    for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowLeft');
    await focused('discover-chip', 1);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(180);
    if (!backend.requests.some(request => request.path === '/api/discover' && request.query.includes('type=series')))
      throw new Error('Type chip did not request Series');
    await page.keyboard.press('ArrowLeft');
    await focused('discover-chip', 0);
    await page.keyboard.press('ArrowLeft');
    await focused('rail-item', 3);
    await page.keyboard.press('Escape');
    await focused('discover-chip', 0);
    await page.keyboard.press('Escape');
    await focused('home-action', 0);
  }
  if (name === 'TvLibrary') {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 10000 });
    const platformSuffix = platform === 'tizen' ? '' : `.${platform}`;
    if (!backend.requests.some(request => request.path.endsWith('/favorites')) ||
        !backend.requests.some(request => request.path.endsWith('/continue/page')))
      throw new Error('My List did not load both saved titles and Continue Watching');
    const sourceRequestsBeforeHold = backend.requests.filter(request => request.path === '/api/streams').length;
    await page.keyboard.down('Enter');
    await page.waitForTimeout(750);
    await page.keyboard.up('Enter');
    await page.waitForTimeout(80);
    if (backend.requests.filter(request => request.path === '/api/streams').length !== sourceRequestsBeforeHold)
      throw new Error('Held queue OK selected a source on release');
    await focused('title-menu-option', 0);
    await page.keyboard.press('Escape');
    await focused('library-card', 0);
    await page.keyboard.press('Enter');
    await focused('source-row', 0);
    await page.screenshot({ path: join(outDir, `TvLibrary.lightning.source${platformSuffix}.png`) });
    await page.keyboard.press('Enter');
    await focused('player-control', 1);
    const intent = await page.evaluate(() => window.__viptvSourceIntent);
    if (intent?.itemId !== 'tt-monster:1:1' || intent?.position !== 4 || intent?.resume !== true)
      throw new Error(`Library Resume lost the selected source or position: ${JSON.stringify(intent)}`);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await focused('source-row', 0);
    await page.keyboard.press('Escape');
    await focused('library-card', 0);
    await page.keyboard.press('ArrowUp');
    await focused('library-segment', 1);
    await page.keyboard.press('ArrowLeft');
    await focused('library-segment', 0);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__viptvLibrary?.mode === 'favorites', null, { timeout: 5000 });
    await page.waitForTimeout(120);
    const segmentAt = await page.evaluate(() => window.__viptvFocus?.at ?? 0);
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(at => window.__viptvFocus?.view === 'library-card' && window.__viptvFocus?.index === 0 && window.__viptvFocus?.at > at, segmentAt, { timeout: 5000 });
    await page.waitForTimeout(120);
    await page.screenshot({ path: join(outDir, `TvLibrary.lightning.saved${platformSuffix}.png`) });
    await page.keyboard.press('Enter');
    await focused('title-action', 0);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await focused('title-action', 2);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
    await focused('library-card', 0);
    await page.waitForFunction(() => window.__viptvLibrary?.mode === 'favorites' && window.__viptvLibrary?.count === 5, null, { timeout: 5000 });
    if (!backend.requests.some(request => request.path.endsWith('/favorites/toggle')))
      throw new Error('Detail My List action did not update the saved library');
    await page.keyboard.press('Escape');
    await focused('home-action', 0);
  }
  const pairingRequests = () => backend.requests.filter(request => request.path === '/api/auth/device/code').length;
  if (pairingRequests() !== (profiles || settingsNames.includes(name) || name === 'TvHome' || name === 'TvMenu' || name === 'TvDiscover' || name === 'TvDiscoverFilter' || name === 'TvLibrary' || name === 'TvItemMenu' || name === 'TvSearch' || name === 'TvLive' || name === 'TvLiveDetails' || name === 'TvLiveSearch' || name === 'TvTitle' || name === 'TvSources' || name === 'TvSourceProvider' || name === 'TvSourceDetails' || name === 'TvPlayer' || name === 'TvPlayerSeek' || name === 'TvPlayerSubs' ? 0 : 1)) throw new Error(`Unexpected device-pairing request count ${pairingRequests()}`);
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
    if (viaPlay && backend.requests.some(request => request.path === '/api/playback'))
      throw new Error('Resume without a saved fingerprint selected a source automatically');
    await page.keyboard.press('ArrowDown');
    await focused('source-row', 1);
    for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(120);
    await page.screenshot({ path: join(outDir, 'TvSources.lightning.paged.png') });
    const windowState = await page.evaluate(() => window.__viptvSourceWindow);
    if (windowState?.index !== 6 || windowState?.start !== 1)
      throw new Error(`Source rows did not page to the seventh source: ${JSON.stringify(windowState)}`);
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
  if (name === 'TvPlayer') {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 5000 });
    if (!backend.requests.some(request => request.path === '/api/playback' && request.method === 'POST'))
      throw new Error('Selected source did not start a backend playback session');
    const intent = await page.evaluate(() => window.__viptvSourceIntent);
    if (intent?.sourceId !== 'source-1' || intent?.itemId !== 'tt-monster:1:1' || intent?.position !== 4 || intent?.resume !== viaPlay)
      throw new Error(`Playback lost the explicit source/resume intent: ${JSON.stringify(intent)}`);
    const beforeSeek = (await page.evaluate(() => window.__viptvPlayer))?.position ?? 0;
    await page.keyboard.press('ArrowLeft');
    await focused('player-control', 0);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(180);
    const afterBackTen = (await page.evaluate(() => window.__viptvPlayer))?.position ?? 0;
    if (afterBackTen > beforeSeek)
      throw new Error(`Back-ten advanced the player from ${beforeSeek} to ${afterBackTen}`);
    await page.keyboard.press('ArrowUp');
    await focused('player-timeline', 0);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(180);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);
    const layer = await page.locator('#video-layer').evaluate(element => getComputedStyle(element).display);
    if (platform !== 'tizen' && layer === 'none') throw new Error('First Back exited playback instead of hiding controls');
    await page.keyboard.press('Escape');
    await focused('source-row', 0);
    if (!backend.requests.some(request => request.path.startsWith('/api/playback/') && request.method !== 'GET'))
      throw new Error('Exiting the player did not stop its backend session');
    if (!backend.requests.some(request => request.path.endsWith('/progress') && request.method !== 'GET'))
      throw new Error(`Exiting the player did not save progress: ${JSON.stringify(backend.requests.slice(-8))}`);
  }
  if (name === 'TvPlayerSeek') {
    const beforeCancel = (await page.evaluate(() => window.__viptvPlayer))?.position ?? 0;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    const afterCancel = (await page.evaluate(() => window.__viptvPlayer))?.position ?? 0;
    if (Math.abs(afterCancel - beforeCancel) > 1)
      throw new Error(`Back committed a seek preview: ${beforeCancel} → ${afterCancel}`);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const afterCommit = (await page.evaluate(() => window.__viptvPlayer))?.position ?? 0;
    if (afterCommit <= beforeCancel)
      throw new Error(`Enter did not commit a forward seek: ${beforeCancel} → ${afterCommit}`);
  }
  if (name === 'TvPlayerSubs') {
    const focused = (view, index) => page.waitForFunction(
      ({ view, index }) => window.__viptvFocus?.view === view && window.__viptvFocus?.index === index,
      { view, index }, { timeout: 5000 });
    const playbackRequests = () => backend.requests.filter(request => request.path === '/api/playback' && request.method === 'POST').length;
    const beforeUnsupported = playbackRequests();
    for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowDown');
    await focused('player-track-option', 5);
    await page.keyboard.press('Enter');
    const unsupported = await page.evaluate(() => window.__viptvTrackSelection);
    if (unsupported?.kind !== 'text' || unsupported.id !== '4' || unsupported.available !== false || playbackRequests() !== beforeUnsupported)
      throw new Error(`Unsupported subtitle changed playback: ${JSON.stringify(unsupported)}`);
    if (!(await page.evaluate(() => window.__viptvTrackPanel?.open))) throw new Error('Unsupported subtitle closed the panel');
    await page.keyboard.press('Escape');
    await focused('player-control', 5);
    await page.keyboard.press('Enter');
    await focused('player-track-option', 1);
    await page.keyboard.press('ArrowUp');
    await focused('player-track-option', 0);
    await page.keyboard.press('Enter');
    await focused('player-control', 5);
    const off = await page.evaluate(() => window.__viptvTrackSelection);
    if (off?.id !== '__off__' || playbackRequests() <= beforeUnsupported)
      throw new Error(`Subtitle Off did not replace the managed track: ${JSON.stringify(off)}`);
    await page.keyboard.press('ArrowLeft');
    await focused('player-control', 4);
    await page.keyboard.press('Enter');
    await focused('player-track-option', 0);
    await page.screenshot({ path: join(outDir, 'TvPlayerSubs.lightning.audio.png') });
    await page.keyboard.press('ArrowDown');
    await focused('player-track-option', 1);
    const beforeAudio = playbackRequests();
    await page.keyboard.press('Enter');
    await focused('player-control', 4);
    const audio = await page.evaluate(() => window.__viptvTrackSelection);
    if (audio?.kind !== 'audio' || audio.id !== '1' || playbackRequests() <= beforeAudio)
      throw new Error(`Audio track change did not replace the managed session: ${JSON.stringify(audio)}`);
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
  const unexpected = errors.filter(message => !/Failed to load resource: the server responded with a status of 400/.test(message) &&
    !(searchFailure && /Failed to load resource: the server responded with a status of 502/.test(message)));
  if (unexpected.length || backend.errors.length) throw new Error([...unexpected, ...backend.errors].join('\n'));
  console.log(file);
} finally {
  await browser.close();
}
