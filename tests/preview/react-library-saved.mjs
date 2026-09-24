#!/usr/bin/env node
/* Matched React TV My List capture with saved titles for Lightning comparison.
 * Start the preview server with `node tests/preview/shoot.mjs --keep TvLibrary`,
 * then run this from the tv-web root. The image stays in ignored test output. */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { installBackend } from './backend.ts';

const output = join(process.cwd(), 'test-results/preview');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.clock.setFixedTime(new Date('2026-09-23T10:55:00-04:00'));
  await installBackend(page, { family: 'tv', session: 'ready', favorites: true });
  await page.goto('http://127.0.0.1:4180/?platform=tizen');
  const nav = page.locator('[data-focus-id="nav-My List"]');
  await nav.waitFor({ state: 'visible', timeout: 20000 });
  await nav.focus();
  await page.keyboard.press('Enter');
  const first = page.locator('[data-focus-id="result-0"]');
  await first.waitFor({ state: 'visible', timeout: 20000 });
  await first.focus();
  await page.waitForTimeout(1000);
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
  const file = join(output, 'TvLibrary.react-saved.png');
  await page.screenshot({ path: file });
  process.stdout.write(`${file}\n`);
} finally {
  await browser.close();
}
