import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { installBackend, installMediaStubs } from './backend.ts';

const origin = process.env.PREVIEW_API_ORIGIN;
assert(origin?.startsWith('https://'), 'Set PREVIEW_API_ORIGIN to the local HTTPS origin');
const url = process.env.SOLID_PREVIEW_URL ?? `${origin}/tv/solid.html`;
const out = process.env.PREVIEW_OUT ?? '/tmp/viptv-polish';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const platform = process.argv.includes('--tizen') ? 'tizen' : 'vizio';
const results = [];
async function scenario(name, options, run, intercept) {
  const only = process.argv.find(arg => arg.startsWith("--scenario="))?.slice(11);
  if (only && only !== name) return;
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const backend = await installBackend(page, { family: 'tv', session: 'ready', sourcesDone: true, ...options });
  await intercept?.(page);
  const focus = (view, index) => page.waitForFunction(({ view, index }) => window.__viptvFocus?.view === view && (index === undefined || window.__viptvFocus.index === index), { view, index }, { timeout: 7000 });
  const key = name => page.keyboard.press(name);
  const shot = async suffix => { await page.waitForTimeout(120); await page.screenshot({ path: `${out}/${name}-${suffix}-${platform}.png` }); };
  try {
    await page.goto(`${url}?platform=${platform}&focusdebug=1&perfdebug=1`);
    await run({ page, backend, focus, key, shot });
    assert.deepEqual(errors, []);
    results.push({ name, passed: true });
  } catch (error) {
    await shot('failure');
    throw new Error(`${name}: ${error.message}; focus=${JSON.stringify(await page.evaluate(() => window.__viptvFocus))}; errors=${JSON.stringify(errors)}; requests=${JSON.stringify(backend.requests.slice(-12).map(r => ({path:r.path,method:r.method,id:r.body?.id,type:r.body?.type})))}; visibleText=${JSON.stringify(await page.evaluate(()=>{ const out=[];const walk=n=>{if(n.textProps?.text && n.worldAlpha>0)out.push(n.textProps.text);for(const child of n.children??[])walk(child)};walk(window.__viptvRenderer.stage.root);return out;}))}`);
  } finally { await page.close(); }
}
try {
  await scenario('profile-selection', { session: 'profiles' }, async ({ page, backend, focus, key, shot }) => {
    await focus('profile-tile', 0);
    await key('ArrowRight'); await key('Enter');
    await focus('home-action', 0);
    assert.equal(backend.requests.filter(r => r.path === '/api/auth/profile').length, 1);
    assert.equal(backend.requests.find(r => r.path === '/api/auth/profile').body.profile_id, '2');
    await page.waitForFunction(() => window.__viptvHome?.count === 9);
    await shot('home');
  });
  await scenario('settings-sidebar', {}, async ({ focus, key, shot }) => {
    await focus('home-action', 0);
    await key('ArrowLeft'); await focus('rail-item', 2);
    for (let i = 0; i < 4; i++) await key('ArrowDown');
    await key('Enter'); await focus('settings-row', 0);
    await key('ArrowLeft'); await focus('rail-item', 6);
    await shot('expanded');
    await key('Escape'); await focus('settings-row', 0);
    await key('ArrowLeft'); await focus('rail-item', 6);
    for (let i = 0; i < 4; i++) await key('ArrowUp');
    await key('Enter'); await focus('home-action', 0);
  });
  await scenario('episode-carousel', {}, async ({ page, backend, focus, key, shot }) => {
    await focus('home-action', 0);
    await page.waitForFunction(() => window.__viptvHome?.count === 9);
    await key('ArrowRight'); await key('Enter'); await focus('title-action', 0);
    await key('ArrowDown'); await focus('title-season', 0);
    await key('ArrowDown'); await focus('title-episode', 0);
    for (let i = 1; i < 10; i++) { await key('ArrowRight'); await focus('title-episode', i); }
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const ring = await page.evaluate(() => {
      const out = []; const walk = n => {
        if (n.worldAlpha > .5 && n.props.color === 0xffffffff && [328, 368].includes(n.width) && [188, 208].includes(n.height)) out.push({ x: n.globalTransform.tx, right: n.globalTransform.tx + n.width });
        for (const child of n.children ?? []) walk(child);
      }; walk(window.__viptvRenderer.stage.root); return out;
    });
    assert.equal(ring.length, 1); assert(ring[0].x >= 188); assert.equal(ring[0].right, 1828);
    await shot('last');
    await key('ArrowRight'); await focus('title-episode', 9);
    await key('ArrowUp'); await focus('title-season', 0);
    await key('ArrowRight'); await key('ArrowDown'); await focus('title-episode', 0);
    await shot('season2');
    await key('Enter'); await focus('source-row', 0);
    assert(backend.requests.some(r => r.path === '/api/streams' && (r.body?.id === 'tt-monster:2:1' || r.body?.video_id === 'tt-monster:2:1')), 'Season 2 episode identity must reach source discovery');
    await key('Escape'); await focus('title-episode', 0);
    await key('Escape'); await focus('home-action', 1);
  });
  await scenario('home-carousel', {}, async ({ page, focus, key, shot }) => {
    await focus('home-action', 0);
    await page.waitForFunction(() => window.__viptvHome?.count === 20 && window.__viptvHome?.shelves > 1);
    await key('ArrowDown'); await focus('home-card', 0);
    const count = await page.evaluate(() => window.__viptvHome.count);
    for (let i = 1; i < count; i++) { await key('ArrowRight'); await focus('home-card', i); }
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const ring = await page.evaluate(() => {
      const out = []; const walk = n => {
        if (n.worldAlpha > .5 && n.props.color === 0xffffffff && [328, 368].includes(n.width) && [188, 208].includes(n.height)) out.push({ x: n.globalTransform.tx, right: n.globalTransform.tx + n.width });
        for (const child of n.children ?? []) walk(child);
      }; walk(window.__viptvRenderer.stage.root); return out;
    });
    assert.equal(ring.length, 1); assert(ring[0].x >= 188); assert.equal(ring[0].right, 1828);
    await shot('last');
    await key('ArrowDown'); await focus('home-card', 0); await shot('row-gap');
    await key('ArrowUp'); await focus('home-card', count - 1);
  }, page => page.route(`${origin}/api/profiles/*/continue/page*`, route => route.fulfill({ json: { items: Array.from({length:20}, (_, index) => ({ id:`tt-long-${index}`, type:'movie', name:`Continue watching title ${index + 1}`, position:60, duration:1200, queue_status:'resume' })), offset:0, total:20, next_offset:null } })));
  await scenario('live-controls', {}, async ({ page, backend, focus, key, shot }) => {
    await focus('home-action', 0);
    await page.waitForFunction(() => window.__viptvHome?.shelves > 1 && window.__viptvHome?.count === 9);
    await key('ArrowDown'); await focus('home-card', 0);
    await key('ArrowDown'); await focus('home-card', 0);
    await key('Enter'); await focus('source-row', 0);
    assert(!backend.requests.some(r => r.path.startsWith('/api/meta/live/')));
    assert(backend.requests.some(r => r.path === '/api/streams' && r.body?.type === 'live'));
    await page.waitForTimeout(150);
    await key('Enter'); await focus('player-control', 4);
    await key('ArrowLeft'); await key('ArrowUp'); await focus('player-control', 4);
    await shot('player');
    await key('ArrowRight'); await focus('player-control', 5);
    await key('ArrowRight'); await focus('player-control', 6);
    await key('Enter'); await focus('home-card', 0);
  }, page => installMediaStubs(page, { live: true }));
  await scenario('progressive-search', {}, async ({ page, backend, focus, key, shot }) => {
    await focus('home-action', 0);
    await key('ArrowLeft'); await focus('rail-item', 2);
    await key('ArrowUp'); await key('Enter'); await focus('search-key', 0);
    await page.keyboard.type('naruto');
    await page.waitForFunction(() => {
      let found = false;
      const walk = n => { if (n.textProps?.text === 'Fast match' && n.worldAlpha > .5 && n.isRenderable) found = true; for (const child of n.children ?? []) walk(child); };
      walk(window.__viptvRenderer.stage.root); return found;
    }, null, { timeout: 1200 });
    assert.notEqual(await page.evaluate(() => window.__viptvSearch?.done), true);
    for (let i = 0; i < 6; i++) await key('ArrowRight');
    await focus('search-card', 0);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const ring = await page.evaluate(() => {
      const out = []; const walk = n => { if (n.width === 328 && n.height === 188 && n.props.color === 0xffffffff && n.worldAlpha > .5) out.push({x:n.globalTransform.tx,y:n.globalTransform.ty}); for(const child of n.children??[])walk(child); };
      walk(window.__viptvRenderer.stage.root); return out;
    });
    assert.deepEqual(ring, [{ x: 846, y: 204 }]);
    await shot('first-card-ring');
    await page.waitForFunction(() => window.__viptvSearch?.done === true);
    await focus('search-card', 1);
  }, async page => {
    await page.route(`${origin}/api/catalogs`, route => route.fulfill({ json: ['slow', 'fast'].map(id => ({ id, name:id, type:'movie', addon_id:1, supports_search:true, extra:[{name:'search',is_required:true}] })) }));
    await page.route(`${origin}/api/discover*`, async route => {
      const slow = new URL(route.request().url()).searchParams.get('catalog') === 'slow';
      if (slow) await new Promise(done => setTimeout(done, 1800));
      await route.fulfill({ json: { metas:[{id:slow?'tt-slow':'tt-fast',type:'movie',name:slow?'Slow match':'Fast match'}], has_more:false, next_skip:null } });
    });
  });
  await scenario('vod-clock', {}, async ({ page, focus, key, shot }) => {
    await focus('home-action', 0);
    await page.waitForFunction(() => window.__viptvHome?.count === 9);
    await key('Enter'); await focus('source-row', 0);
    await key('Enter'); await focus('player-control', 1);
    await page.waitForTimeout(150);
    const result = await page.evaluate(async platform => {
      const initialPosition = window.__viptvPlayer.position;
      let blankFrames = 0;
      const video = document.getElementById('tv-video');
      for (let frame = 0; frame < 90; frame++) {
        if (frame % 10 === 0) {
          if (platform === 'tizen') window.webapis.avplay.jumpForward(1000);
          else video.currentTime += 1;
        }
        await new Promise(requestAnimationFrame);
        let visibleClock = false;
        const walk = node => {
          if (/^\d+:\d\d$/.test(node.textProps?.text ?? '') && node.globalTransform?.tx === 96 && node.worldAlpha > 0.5 && node.isRenderable) visibleClock = true;
          for (const child of node.children ?? []) walk(child);
        };
        walk(window.__viptvRenderer.stage.root);
        if (!visibleClock) blankFrames++;
      }
      return { frames: 90, blankFrames, advanced: window.__viptvPlayer.position > initialPosition };
    }, platform);
    assert(result.advanced, 'The playback clock must advance during the observation');
    assert.equal(result.blankFrames, 0, 'The player clock disappeared while its text changed');
    results.push({ name: 'clock-render-frames', ...result });
    await shot('controls');
  }, page => installMediaStubs(page, { position: 768 }));
  await scenario('slow-metadata', {}, async ({ page, backend, focus, key, shot }) => {
    await focus('home-action', 0);
    await page.waitForFunction(() => window.__viptvHome?.count === 9, null, { timeout: 1200 });
    await key('ArrowDown'); await focus('home-card', 0);
    await shot('queue-before-metadata');
    const calls = await page.evaluate(() => window.__metadataRequests);
    assert.equal(calls.filter(path => path === '/api/meta/series/tt-monster').length, 1, 'Hero must reuse queue hydration');
  }, async page => {
    await page.addInitScript(() => { window.__metadataRequests = []; });
    await page.route(`${origin}/api/meta/**`, async route => {
      await page.evaluate(path => window.__metadataRequests.push(path), new URL(route.request().url()).pathname).catch(() => {});
      await new Promise(done => setTimeout(done, 1800));
      await route.fallback().catch(() => {});
    });
  });
  await scenario('slow-startup', {}, async ({ page, focus, key, shot }) => {
    await focus('home-action', 0);
    const timing = await page.evaluate(() => window.__viptvFocus.at);
    assert(timing < 1200, `Shell waited on delayed data: ${timing}ms`);
    await key('ArrowLeft'); await focus('rail-item', 2);
    await shot('usable-rail');
    results.push({ name: 'shell-ms-with-1.8s-data-delay', value: Math.round(timing) });
  }, async page => {
    await page.route(`${origin}/api/profiles/*/continue/page*`, async route => { await new Promise(done => setTimeout(done, 1800)); await route.fallback(); });
    await page.route(`${origin}/api/discover*`, async route => { await new Promise(done => setTimeout(done, 1800)); await route.fallback(); });
  });
  console.log(JSON.stringify({ platform, results }, null, 2));
} finally { await browser.close(); }
