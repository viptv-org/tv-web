#!/usr/bin/env node
/*
 * Side-by-side comparison: the design reference (left) and the app screenshot
 * (right) at the same scale, written to test-results/preview/<Name>.compare.png
 * so one image can be opened with the Read tool.
 *
 *   node tests/preview/compare.mjs DeskHome [TvHome …]
 *   node tests/preview/compare.mjs --all [--platform tv]   every screen + index.html
 *   --shoot        shoot the app screen(s) first (otherwise reuse <Name>.png;
 *                  a missing PNG is shot on demand)
 *   --width <px>   width of each half (default: the reference width, capped at
 *                  1200 so a pair stays readable when downscaled)
 *   --stack        reference above the app instead of side by side
 *
 * --all writes test-results/preview/index.html: every reference screen with
 * its comparison, or why there is none (not reachable, shot failed, not shot).
 *
 * Composition runs in Playwright Chromium (no image library dependency).
 */
import { chromium } from '@playwright/test';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { outDir, reference, referenceIndex, shoot, stopServers } from './shoot.mjs';
import { referenceDir } from './backend.ts';
import { screens } from './screens.mjs';

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const valueFlags = ['--width', '--platform'];
const all = flag('--all');
const platformFilter = option('--platform');
let names = args.filter((arg, index) => !arg.startsWith('--') && !valueFlags.includes(args[index - 1]));
if (all) names = referenceIndex.filter(entry => entry.platform !== 'components' && (!platformFilter || entry.platform === platformFilter)).map(entry => entry.name);
if (!names.length) {
  console.error('usage: node tests/preview/compare.mjs <Name> [<Name>…] | --all [--platform phone|desktop-web|tv] [--shoot] [--width px] [--stack]');
  process.exit(2);
}

const escape = text => String(text).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
const dataUrl = (path, type) => `data:${type};base64,${readFileSync(path).toString('base64')}`;
const referenceImage = entry => join(referenceDir, 'screens/img', entry.platform, `${entry.name}.webp`);

/** Compose one comparison; returns the output path. */
async function compose(page, entry, appPath) {
  const [width, height] = entry.size;
  const half = Number(option('--width')) || Math.min(width, 1200);
  const scaledHeight = Math.round(height * half / width);
  const stack = flag('--stack');
  // Two caption lines (what, then detail) so narrow phone halves stay readable.
  const cell = (title, detail, src) => `<figure><figcaption><b>${escape(title)}</b><span>${escape(detail)}</span></figcaption><img src="${src}" style="width:${half}px;height:${scaledHeight}px"></figure>`;
  const scale = half === width ? '1:1' : `scaled ${Math.round(half / width * 100)}%`;
  const note = screens[entry.name]?.note;
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#2b2b30;font:600 16px system-ui,sans-serif;color:#eee}
    main{display:flex;${stack ? 'flex-direction:column;' : ''}gap:16px;padding:16px;width:max-content}
    figure{margin:0} figcaption{height:44px;width:${half}px;overflow:hidden;margin-bottom:6px}
    figcaption b,figcaption span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    figcaption b{font-size:16px;line-height:22px} figcaption span{font-weight:400;font-size:13px;line-height:20px;color:#bbb}
    img{display:block;object-fit:fill;outline:1px solid #555}
  </style><main>
    ${cell(`Reference · ${entry.name}`, `${entry.title} · ${width}×${height} · ${scale}`, dataUrl(referenceImage(entry), 'image/webp'))}
    ${cell(`App · ${entry.name}`, note ? `Note: ${note}` : `${entry.name}.png · ${scale}`, dataUrl(appPath, 'image/png'))}
  </main>`);
  await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
  const out = join(outDir, `${entry.name}.compare.png`);
  await page.locator('main').screenshot({ path: out });
  return out;
}

function writeIndex(rows) {
  const lastRun = existsSync(join(outDir, 'last-run.json')) ? JSON.parse(readFileSync(join(outDir, 'last-run.json'), 'utf8')) : { failed: [] };
  const platforms = ['phone', 'desktop-web', 'tv'].filter(platform => rows.some(row => row.entry.platform === platform));
  const counts = state => rows.filter(row => row.state === state).length;
  const card = ({ entry, state, reason }) => {
    const spec = screens[entry.name];
    const ref = relative(outDir, referenceImage(entry));
    const body = state === 'ok'
      ? `<a href="${entry.name}.compare.png"><img loading="lazy" src="${entry.name}.compare.png" alt="${escape(entry.name)} comparison"></a>`
      : `<p class="why">${escape(reason ?? '')}</p>`;
    return `<article class="${state}" id="${entry.name}"><h3>${escape(entry.name)} <small>${escape(entry.title)} · ${entry.size.join('×')}</small> <span class="tag">${state}</span></h3>
      ${body}
      <p class="links"><a href="${escape(ref)}">reference</a>${state === 'ok' ? ` · <a href="${entry.name}.png">app</a>` : ''}${spec?.note ? ` · <em>${escape(spec.note)}</em>` : ''}${lastRun.failed?.includes(entry.name) ? ' · <strong>failed in the last shoot run</strong>' : ''}</p></article>`;
  };
  const html = `<!doctype html><meta charset="utf-8"><title>VIPTV preview vs reference</title><style>
    body{margin:0;padding:24px;background:#1b1b1f;color:#e8e8ea;font:15px/1.4 system-ui,sans-serif}
    h1{margin:0 0 4px} h2{margin:32px 0 12px;border-bottom:1px solid #333;padding-bottom:6px}
    nav a{color:#9cf;margin-right:12px}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(560px,1fr));gap:16px}
    article{background:#26262b;border-radius:8px;padding:12px}
    article img{width:100%;display:block;border-radius:4px}
    h3{margin:0 0 8px;font-size:16px} small{color:#999;font-weight:400}
    .tag{font-size:12px;padding:1px 6px;border-radius:4px;background:#2e5e2e}
    .unreachable .tag{background:#555} .failed .tag,.missing .tag{background:#7a2e2e}
    .why{color:#bbb;font-style:italic} .links{margin:8px 0 0;font-size:13px;color:#aaa} a{color:#9cf}
  </style>
  <h1>Preview vs reference</h1>
  <p>${rows.length} screens · ${counts('ok')} compared · ${counts('unreachable')} not reachable · ${counts('failed') + counts('missing')} without a shot. Generated ${new Date().toISOString()} by <code>node tests/preview/compare.mjs --all</code>.</p>
  <nav>${platforms.map(platform => `<a href="#${platform}">${platform}</a>`).join('')}</nav>
  ${platforms.map(platform => `<h2 id="${platform}">${platform}</h2><div class="grid">${rows.filter(row => row.entry.platform === platform).map(card).join('\n')}</div>`).join('\n')}`;
  const file = join(outDir, 'index.html');
  writeFileSync(file, html);
  return file;
}

const browser = await chromium.launch();
const rows = [];
let failed = 0;
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  for (const name of names) {
    const entry = reference(name);
    if (!entry) { console.log(`FAIL ${name}: not a reference screen`); failed++; continue; }
    const spec = screens[name];
    if (!spec || spec.notReachable) {
      rows.push({ entry, state: 'unreachable', reason: spec ? spec.notReachable : 'not registered in screens.mjs' });
      if (!all) { console.log(`FAIL ${name}: not reachable: ${spec?.notReachable ?? 'not registered'}`); failed++; }
      continue;
    }
    const app = join(outDir, `${name}.png`);
    if (!existsSync(referenceImage(entry))) { rows.push({ entry, state: 'missing', reason: 'no reference image' }); console.log(`FAIL ${name}: no reference image`); failed++; continue; }
    if (flag('--shoot') || !existsSync(app)) {
      try { await shoot(browser, name); }
      catch (error) {
        const reason = String(error.message ?? error).split('\n')[0];
        rows.push({ entry, state: 'failed', reason: `shoot failed: ${reason}` });
        console.log(`FAIL ${name}: could not shoot: ${reason}`); failed++; continue;
      }
    }
    const out = await compose(page, entry, app);
    rows.push({ entry, state: 'ok', shotAt: statSync(app).mtime });
    console.log(`ok   ${name.padEnd(22)} ${out}`);
  }
  await page.close();
} finally {
  await browser.close();
  stopServers();
}
if (all) console.log(`index: ${writeIndex(rows)}`);
process.exitCode = failed ? 1 : 0;
