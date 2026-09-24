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
if (!['TvPairing', 'TvPairingLoading', 'TvPairingExpired'].includes(name)) {
  console.error('Usage: node tests/preview/lightning-shoot.mjs [TvPairing|TvPairingLoading|TvPairingExpired] [--platform=tizen|vizio|webos]');
  process.exit(2);
}
if (!['tizen', 'vizio', 'webos'].includes(platform)) throw new Error(`Unsupported TV platform ${platform}`);
const entry = reference(name);
if (!entry) throw new Error(`Missing design reference ${name}`);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const backend = await installBackend(page, { family: 'tv', session: 'none', pairing: name === 'TvPairingLoading' ? 'loading' : name === 'TvPairingExpired' ? 'expired' : undefined });
  const url = process.env.LIGHTNING_PREVIEW_URL ?? 'http://127.0.0.1:4180/lightning.html';
  await page.goto(`${url}?platform=${platform}`);
  await page.locator('canvas').waitFor({ state: 'visible', timeout: 20000 }).catch(async cause => {
    throw new Error(`${cause.message}\nPage: ${await page.locator('body').innerText()}\n${errors.join('\n')}`);
  });
  await page.waitForTimeout(name === 'TvPairingExpired' ? 2200 : 900);
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${name}.lightning${platform === 'tizen' ? '' : `.${platform}`}.png`);
  await page.screenshot({ path: file });
  const pairingRequests = () => backend.requests.filter(request => request.path === '/api/auth/device/code').length;
  if (pairingRequests() !== 1) throw new Error(`Expected one device-pairing request, got ${pairingRequests()}`);
  if (name === 'TvPairingExpired') {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    if (pairingRequests() !== 2) throw new Error('Enter release did not request a fresh pairing code');
  }
  const unexpected = errors.filter(message => !/Failed to load resource: the server responded with a status of 400/.test(message));
  if (unexpected.length || backend.errors.length) throw new Error([...unexpected, ...backend.errors].join('\n'));
  console.log(file);
} finally {
  await browser.close();
}
