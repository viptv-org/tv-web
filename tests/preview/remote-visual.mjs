import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { installRemoteBackend } from './remote-backend.ts';

// Private review captures only; these are never design assets or release files.
const origin = process.env.REMOTE_PREVIEW_ORIGIN ?? 'https://viptv.local.test:18562';
const out = process.env.REMOTE_VISUAL_OUT ?? '/tmp/viptv-tv-visual';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const evidence = [];
// Bounds transcribed from the pinned Tv3 HTML, independent of the renderer.
const referenceBounds = {
  home: [{ x:96,y:876,w:384,h:216 }],
  episodes: [{ x:96,y:236,w:448,h:252 },{ x:568,y:236,w:448,h:252 },{ x:96,y:728,w:232,h:348 }],
  movies: [{ x:96,y:244,w:232,h:348 },{ x:344,y:244,w:232,h:348 }],
  sources: [{ x:960,y:0,w:960,h:1080 }],
  'settings-playback': [{ x:640,y:220,w:1184,h:96 }],
  'settings-display': [{ x:640,y:220,w:1184,h:96 }],
  'settings-account': [{ x:640,y:220,w:1184,h:96 }],
  'parent-pin': [{ x:744,y:540,w:136,h:76 }],
};
async function scenario(options, action) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await installRemoteBackend(page, origin, options);
  const key = async (...keys) => { for (const name of keys) await page.keyboard.press(name); };
  const ready = async screen => {
    await page.waitForFunction(screen => document.documentElement.dataset.tvScreen === screen && document.documentElement.dataset.tvReady === 'true', screen);
  };
  const snap = async (name, boards) => {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => {
      const boxes = []; const visit = node => {
        if (node.isRenderable && [88, 136, 232, 384, 448, 800, 960, 1184].includes(node.props?.w)) boxes.push({ x: node.absX, y: node.absY, w: node.props.w, h: node.props.h });
        node.children?.forEach(visit);
      }; visit(window.__viptvRenderer.stage.root);
      return { screen: document.documentElement.dataset.tvScreen, focus: document.documentElement.dataset.tvFocus, overlay: document.documentElement.dataset.tvOverlay, boxes };
    });
    await page.screenshot({ path: `${out}/${name}.png` });
    for (const expected of referenceBounds[name] ?? []) {
      if (!state.boxes.some(actual => Object.keys(expected).every(key => Math.abs(actual[key] - expected[key]) < 0.5))) throw new Error(`${name}: reference bounds missing: ${JSON.stringify(expected)}`);
    }
    evidence.push({ name, boards, ...state, referenceBounds: referenceBounds[name], errors: [...errors] });
    if (errors.length) throw new Error(errors.join('\n'));
  };
  const nav = async index => {
    await key('ArrowUp');
    for (let i = 1; i < index; i++) await key('ArrowRight');
    for (let i = index; i < 1; i++) await key('ArrowLeft');
    await key('Enter');
  };
  try {
    await page.goto(origin + '/tv/?platform=vizio&focusdebug=1');
    await ready(options.session === false ? 'welcome' : 'home');
    await action({ page, key, ready, snap, nav });
  } finally { await context.close(); }
}
try {
  await scenario({ session: false }, async ({ key, snap }) => {
    await snap('welcome', ['Tv3Welcome']); await key('Enter');
    await snap('pairing', ['Tv3SignIn']);
  });
  await scenario({}, async ({ key, snap, ready }) => {
    await snap('home', ['Tv3Home']); await key('ArrowDown');
    await snap('browse', ['Tv3Browse', 'Tv3HomeToRows']); await key('Enter'); await ready('detail');
    await snap('title', ['Tv3Title']); await key('ArrowDown');
    await snap('episodes', ['Tv3Episodes']); await key('ArrowUp');
    await snap('seasons', ['Tv3Episodes']); await key('ArrowDown', 'ArrowDown');
    await snap('recommendations', ['Tv3Episodes']);
  });
  for (const [name, options, boards] of [
    ['sources', {}, ['Tv3Sources']],
    ['sources-partial', { finding: true }, ['Tv3SourcesLoading']],
    ['sources-empty', { emptySources: true }, ['Tv3SourcesEmpty']],
  ]) await scenario(options, async ({ key, snap }) => { await key('Enter'); await snap(name, boards); });
  await scenario({}, async ({ key, nav, snap, ready }) => {
    await nav(2); await ready('movie'); await snap('movies', ['Tv3Movies']);
    await key('Enter'); await snap('catalogs', ['Tv3MoviesCatalogs']);
    await key('Escape', 'ArrowRight', 'Enter'); await snap('filters', ['Tv3MoviesFilters']);
    await key('Escape', 'ArrowDown', 'Enter'); await ready('detail'); await snap('movie', ['Tv3Movie']);
  });
  await scenario({ empty: true }, async ({ nav, snap, ready }) => { await nav(2); await ready('movie'); await snap('movies-empty', ['Tv3MoviesEmpty']); });
  await scenario({}, async ({ nav, snap, page }) => {
    await page.route('**/api/discover?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Catalog unavailable. Try again.' }) }));
    await nav(2); await snap('movies-error', ['Tv3MoviesError']);
  });
  await scenario({}, async ({ nav, key, snap }) => { await nav(0); await key('a'); await snap('search', ['Tv3Search']); });
  await scenario({}, async ({ nav, snap }) => { await nav(4); await snap('live', ['Tv3Live']); });
  await scenario({}, async ({ nav, key, snap, ready }) => { await key('ArrowRight', 'Enter'); await ready('home'); await nav(5); await ready('library'); await snap('library', ['Tv3MyList']); });
  await scenario({}, async ({ nav, key, snap }) => {
    await nav(6); await key('Enter'); await snap('profiles', ['Tv3Profiles']);
    await key('ArrowDown', 'Enter'); await snap('profile-edit', ['Tv3ProfileEdit']);
    await key('Enter'); await snap('profile-name', ['Tv3ProfileEdit']);
  });
  await scenario({ addons: 12 }, async ({ nav, key, snap, ready }) => {
    // Nav opens on Playback (index 2 of the board's nine sections).
    await nav(6); await key('ArrowDown', 'Enter'); await ready('settings');
    await snap('settings-playback', ['Tv3SetPlayback']);
    await key('ArrowDown'); await ready('settings'); await snap('settings-subtitles', ['Tv3SetSubs']);
    await key('ArrowDown'); await ready('settings'); await snap('settings-addons', ['Tv3SetAddons']);
    await key('ArrowRight', 'Enter'); await snap('addon-entry', ['Tv3AddonEntry']);
    await key('Escape', 'Escape', 'ArrowDown'); await ready('settings'); await snap('settings-sources', ['Tv3SetSources']);
    // The Display board depicts its focused first row; capture content focus.
    // Inline swatch editing owns Left/Right there, so Back exits to the nav.
    await key('ArrowDown'); await ready('settings'); await key('ArrowRight'); await snap('settings-display', ['Tv3SetDisplay']); await key('Escape');
    await key('ArrowDown'); await ready('settings'); await snap('settings-parental', ['Tv3SetParental']);
    await key('ArrowRight', 'Enter'); await snap('parent-pin', ['Tv3Pin']);
    await key('Escape', 'Escape', 'ArrowDown'); await ready('settings'); await snap('settings-about', ['Tv3SetAbout']);
    // Account is the first section; its sign-out row opens the board dialog.
    for (let i = 0; i < 8; i++) await key('ArrowUp'); await ready('settings');
    await snap('settings-account', ['Tv3SignOut']);
    await key('ArrowRight', 'ArrowDown', 'Enter'); await snap('sign-out', ['Tv3SignOut']);
  });
} finally { await browser.close(); }
writeFileSync(`${out}/geometry.json`, JSON.stringify(evidence, null, 2));
console.log(`${evidence.length} private captures with renderer geometry: ${out}`);
