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
if (!['TvPairing', 'TvPairingLoading', 'TvPairingExpired', 'TvProfiles', 'TvProfilesManage', 'TvManageCue'].includes(name)) {
  console.error('Usage: node tests/preview/lightning-shoot.mjs [TvPairing|TvPairingLoading|TvPairingExpired|TvProfiles|TvProfilesManage|TvManageCue] [--platform=tizen|vizio|webos]');
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
  const backend = await installBackend(page, { family: 'tv', session: profiles ? 'profiles' : 'none', pairing: name === 'TvPairingLoading' ? 'loading' : name === 'TvPairingExpired' ? 'expired' : undefined });
  const url = process.env.LIGHTNING_PREVIEW_URL ?? 'http://127.0.0.1:4180/lightning.html';
  await page.goto(`${url}?platform=${platform}`);
  await page.locator('canvas').waitFor({ state: 'visible', timeout: 20000 }).catch(async cause => {
    throw new Error(`${cause.message}\nPage: ${await page.locator('body').innerText()}\n${errors.join('\n')}`);
  });
  await page.waitForTimeout(name === 'TvPairingExpired' ? 2200 : 900);
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
  if (pairingRequests() !== (profiles ? 0 : 1)) throw new Error(`Unexpected device-pairing request count ${pairingRequests()}`);
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
