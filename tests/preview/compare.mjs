#!/usr/bin/env node
/*
 * Side-by-side comparison: the design reference (left) and the app screenshot
 * (right) at the same scale, written to test-results/preview/<Name>.compare.png
 * so one image can be opened with the Read tool.
 *
 *   node tests/preview/compare.mjs DeskHome [TvHome …]
 *   --shoot        shoot the app screen first (otherwise reuse <Name>.png)
 *   --width <px>   width of each half in the composite (default: the reference
 *                  width, capped at 1200 so a pair stays readable when downscaled)
 *   --stack        reference above the app instead of side by side
 *
 * Composition runs in Playwright Chromium (no image library dependency).
 */
import { chromium } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { outDir, reference, shoot, stopServers } from './shoot.mjs';
import { referenceDir } from './backend.ts';

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const names = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--width');
if (!names.length) {
  console.error('usage: node tests/preview/compare.mjs <Name> [<Name>…] [--shoot] [--width px] [--stack]');
  process.exit(2);
}

const dataUrl = (path, type) => `data:${type};base64,${readFileSync(path).toString('base64')}`;

const browser = await chromium.launch();
let failed = 0;
try {
  for (const name of names) {
    const entry = reference(name);
    if (!entry) { console.log(`FAIL ${name}: not a reference screen`); failed++; continue; }
    const app = join(outDir, `${name}.png`);
    if (flag('--shoot') || !existsSync(app)) {
      try { await shoot(browser, name); }
      catch (error) { console.log(`FAIL ${name}: could not shoot: ${String(error.message ?? error).split('\n')[0]}`); failed++; continue; }
    }
    const refPath = join(referenceDir, 'screens/img', entry.platform, `${name}.webp`);
    if (!existsSync(refPath)) { console.log(`FAIL ${name}: no reference image at ${refPath}`); failed++; continue; }
    const [width, height] = entry.size;
    const half = Number(option('--width')) || Math.min(width, 1200);
    const scale = half / width;
    const stack = flag('--stack');
    const gap = 16, label = 28;
    const cell = (title, src) => `<figure><figcaption>${title}</figcaption><img src="${src}" style="width:${half}px;height:${Math.round(height * scale)}px"></figure>`;
    const html = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;background:#2b2b30;font:600 16px system-ui,sans-serif;color:#eee}
      main{display:flex;${stack ? 'flex-direction:column;' : ''}gap:${gap}px;padding:${gap}px;width:max-content}
      figure{margin:0} figcaption{height:${label}px;line-height:${label}px}
      img{display:block;object-fit:fill;outline:1px solid #555}
    </style><main>
      ${cell(`Reference · ${entry.platform}/${name}.webp · ${width}×${height}`, dataUrl(refPath, 'image/webp'))}
      ${cell(`App · ${name}.png`, dataUrl(app, 'image/png'))}
    </main>`;
    const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
    await page.setContent(html);
    await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
    const out = join(outDir, `${name}.compare.png`);
    await page.locator('main').screenshot({ path: out });
    await page.close();
    console.log(`ok   ${name.padEnd(22)} ${out}`);
  }
} finally {
  await browser.close();
  stopServers();
}
process.exitCode = failed ? 1 : 0;
