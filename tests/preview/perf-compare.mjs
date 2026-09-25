#!/usr/bin/env node
/** Compare the actual production TV entries with identical fixtures/input.
 * Sequential, alternating cold browser contexts avoid concurrent load and
 * always-running-one-renderer-first bias. This is browser evidence, not TV hardware. */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const origin = process.env.PERF_PREVIEW_URL ?? 'https://viptv.local.test:8443/tv';
if (!origin.startsWith('https://')) throw new Error('Benchmark production bundles over local HTTPS.');
process.env.PREVIEW_API_ORIGIN ??= new URL(origin).origin;
const { installBackend } = await import('./backend.ts');
const runs = Number(process.env.PERF_RUNS ?? 6);
const cpuThrottle = Number(process.env.PERF_CPU_THROTTLE ?? 4);
const keyInterval = Number(process.env.PERF_KEY_INTERVAL_MS ?? 80);
const output = process.env.PERF_OUTPUT;
const gpuMode = process.env.PERF_GPU ?? 'hardware';
const only = process.env.PERF_MODE;
const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)];
};
const summarize = values => ({ samples: values.length,
  median: +percentile(values, 0.5).toFixed(3), p95: +percentile(values, 0.95).toFixed(3), max: +Math.max(...values).toFixed(3) });
const metrics = async cdp => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(({ name, value }) => [name, value]));
const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const zones = ['hero', 'shelf', 'guide'];
const cycles = Array.from({ length: 6 }, () => [['ArrowRight', 1], ['ArrowRight', 2], ['ArrowLeft', 1], ['ArrowLeft', 0]]).flat();
const sourceFiles = ['src/tv-solid/App.tsx', 'src/tv-solid/main.ts', 'src/tv-solid/runtime.ts', 'package-lock.json', 'vite.config.ts'];
const sourceHash = createHash('sha256');
for (const file of sourceFiles) sourceHash.update(file).update(readFileSync(new URL('../../' + file, import.meta.url)));
const report = { schema: 2, measuredAt: new Date().toISOString(), sourceSha256: sourceHash.digest('hex'), sourceFiles, cpuThrottle, runs, keyIntervalMs: keyInterval, viewport: [1920, 1080],
  fixture: 'preview/backend.ts: family=tv, session=ready',
  startup: 'navigation to Home focus available, fonts ready and two animation-frame opportunities',
  input: 'browser-dispatched remote keys; capture-to-focus plus summed synchronous keydown listener work (including stopped propagation)',
  frames: 'requestAnimationFrame intervals, not physical display/presentation or GPU-completion measurements',
  memory: 'post-GC JS heap only; excludes GPU allocations and external pixel buffers',
  raw: [], summary: {} };
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', ...(gpuMode === 'hardware' ? ['--use-angle=gl'] : [])] });
const browserCdp = await browser.newBrowserCDPSession();
const { gpu } = await browserCdp.send('SystemInfo.getInfo');
report.gpu = { mode: gpuMode, devices: gpu.devices, features: gpu.featureStatus };
if (gpuMode === 'hardware' && gpu.featureStatus.webgl !== 'enabled') {
  await browser.close();
  throw new Error('Hardware WebGL unavailable; use PERF_GPU=software explicitly to measure software fallback.');
}
report.browser = browser.version();
try {
  for (let run = 0; run < runs; run++) {
    for (const mode of only ? [only] : run % 2 ? ['solid', 'react'] : ['react', 'solid']) {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
        timezoneId: 'America/New_York', locale: 'en-US', colorScheme: 'dark', reducedMotion: 'reduce', serviceWorkers: 'block' });
      try {
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send('Performance.enable');
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
          // Freeze wall-clock date for guide fixtures without Playwright's
          // clock shim: performance.now/RAF/resource timing must stay native.
          const NativeDate = Date;
          const epoch = NativeDate.parse('2026-09-23T10:55:00-04:00');
          class FixtureDate extends NativeDate {
            constructor(...args) { super(...(args.length ? args : [epoch])); }
            static now() { return epoch; }
          }
          window.Date = FixtureDate;
          window.__bench = { active: false, lastKeyAt: -1, lastFocusAt: -1, handler: [], frames: [], longTasks: [], opportunities: [] };
          window.addEventListener('keydown', () => {
            window.__bench.lastKeyAt = performance.now();
            if (window.__bench.active) window.__bench.handler.push(0);
          }, true);
          // Guide handlers stop propagation. Measure registered callbacks,
          // rather than relying on a bubbling listener that never sees them.
          const add = EventTarget.prototype.addEventListener;
          const remove = EventTarget.prototype.removeEventListener;
          const targets = new WeakMap();
          EventTarget.prototype.addEventListener = function(type, listener, options) {
            if (type !== 'keydown' || !listener) return add.call(this, type, listener, options);
            let byListener = targets.get(this);
            if (!byListener) targets.set(this, byListener = new WeakMap());
            let callbacks = byListener.get(listener);
            if (!callbacks) byListener.set(listener, callbacks = new Map());
            const capture = typeof options === 'boolean' ? options : !!options?.capture;
            let wrapped = callbacks.get(capture);
            if (!wrapped) {
              wrapped = function(event) {
                const b = window.__bench, index = b.handler.length - 1, start = performance.now();
                try { return typeof listener === 'function' ? listener.call(this, event) : listener.handleEvent(event); }
                finally { if (b.active && index >= 0) b.handler[index] += performance.now() - start; }
              };
              callbacks.set(capture, wrapped);
            }
            return add.call(this, type, wrapped, options);
          };
          EventTarget.prototype.removeEventListener = function(type, listener, options) {
            const capture = typeof options === 'boolean' ? options : !!options?.capture;
            return remove.call(this, type, type === 'keydown' && listener ? targets.get(this)?.get(listener)?.get(capture) ?? listener : listener, options);
          };
          document.addEventListener('focusin', () => { window.__bench.lastFocusAt = performance.now(); }, true);
          new PerformanceObserver(list => {
            if (window.__bench.active) window.__bench.longTasks.push(...list.getEntries().map(e => e.duration));
          }).observe({ type: 'longtask', buffered: false });
        });
        const backend = await installBackend(page, { family: 'tv', session: 'ready' });
        await page.goto(`${origin}/${mode === 'solid' ? 'solid.html?platform=tizen&focusdebug=1&perfdebug=1' : '?platform=tizen'}`, { waitUntil: 'domcontentloaded' });
        // Use the same polling mechanism for both entries. React's focus API is
        // DOM-based; SolidTV's opt-in marker is emitted by its real focus hooks.
        await page.waitForFunction(mode => {
          if (mode === 'solid') return window.__viptvFocus?.view === 'home-action' && window.__viptvFocus?.index === 0;
          const hero = document.querySelector('[data-focus-id="hero-play"]');
          if (!hero || !hero.getBoundingClientRect().width) return false;
          if (document.activeElement !== hero) hero.focus();
          return true;
        }, mode, { timeout: 20000 });
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(nextFrame);
        const readyMs = await page.evaluate(() => performance.now());
        await page.waitForTimeout(500);
        await cdp.send('HeapProfiler.collectGarbage');
        const heapBefore = (await metrics(cdp)).JSHeapUsedSize;
        const paths = [];
        let guideReadyMs;
        for (const zone of zones) {
          if (zone === 'shelf') {
            await page.keyboard.press('ArrowDown');
            await page.waitForFunction(mode => mode === 'solid'
              ? window.__viptvFocus?.view === 'home-card' && window.__viptvFocus?.index === 0
              : document.activeElement?.getAttribute('data-focus-id') === 'queue-0', mode, { timeout: 5000 });
            await page.waitForTimeout(200);
          }
          if (zone === 'guide') {
            if (mode === 'solid') {
              await page.keyboard.press('ArrowLeft');
              await page.waitForFunction(() => window.__viptvFocus?.view === 'rail-item' && window.__viptvFocus?.index === 2);
              await page.keyboard.press('ArrowDown');
              await page.keyboard.press('ArrowDown');
              await page.keyboard.press('Enter');
              await page.waitForFunction(() => window.__viptvFocus?.view === 'guide-channel' && window.__viptvFocus?.index === 0);
            } else {
              await page.getByRole('button', { name: 'Live TV', exact: true }).focus();
              await page.keyboard.press('Enter');
              await page.locator('[data-focus-id="guide-channel-0"]').waitFor();
              await page.locator('[data-focus-id="guide-channel-0"]').focus();
            }
            await page.evaluate(nextFrame);
            guideReadyMs = await page.evaluate(() => performance.now() - window.__bench.lastKeyAt);
            await page.waitForTimeout(500);
          }
          await page.evaluate(() => {
            const b = window.__bench;
            b.handler = []; b.frames = []; b.longTasks = []; b.active = true;
            let previous;
            function frame(time) {
              if (!b.active) return;
              if (previous !== undefined) b.frames.push(time - previous);
              previous = time; requestAnimationFrame(frame);
            }
            requestAnimationFrame(frame);
          });
          const before = await metrics(cdp);
          const focus = [];
          const frameOpportunity = [];
          for (const [key, index] of cycles) {
            const sent = Date.now();
            await page.keyboard.press(zone === 'guide' ? key === 'ArrowRight' ? 'ArrowDown' : 'ArrowUp' : key);
            await page.waitForFunction(({ mode, zone, index }) => mode === 'solid'
              ? window.__viptvFocus?.view === (zone === 'hero' ? 'home-action' : zone === 'guide' ? 'guide-channel' : 'home-card') && window.__viptvFocus?.index === index
              : document.activeElement?.getAttribute('data-focus-id') === (zone === 'hero' ? ['hero-play', 'hero-details', 'hero-save'][index] : zone === 'guide' ? `guide-channel-${index}` : `queue-${index}`), { mode, zone, index }, { timeout: 5000 });
            focus.push(await page.evaluate(mode => (mode === 'react' ? window.__bench.lastFocusAt : window.__viptvFocus.at) - window.__bench.lastKeyAt, mode));
            frameOpportunity.push(await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(time => resolve(time - window.__bench.lastKeyAt))))));
            await page.waitForTimeout(Math.max(0, keyInterval - (Date.now() - sent)));
          }
          const after = await metrics(cdp);
          const samples = await page.evaluate(() => { window.__bench.active = false; return { handler: window.__bench.handler, frames: window.__bench.frames, longTasks: window.__bench.longTasks }; });
          if (focus.length !== cycles.length || samples.handler.length !== cycles.length || focus.some(v => v < 0)) throw new Error(`${mode}/${zone}: missing or invalid input samples (${focus.length} focus, ${samples.handler.length} handler, negative=${focus.filter(v=>v<0).length})`);
          paths.push({ zone, focusMs: focus, handlerMs: samples.handler, frameOpportunityMs: frameOpportunity, frameIntervalsMs: samples.frames,
            longTasksMs: samples.longTasks, mainThreadTaskMs: (after.TaskDuration - before.TaskDuration) * 1000,
            scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
            layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
            styleMs: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000 });
          await page.evaluate(nextFrame);
        }
        await cdp.send('HeapProfiler.collectGarbage');
        const after = await metrics(cdp);
        const resources = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => /\.js(?:\?|$)/.test(e.name)).reduce((out, e) => ({ count: out.count + 1, decodedBytes: out.decodedBytes + e.decodedBodySize }), { count: 0, decodedBytes: 0 }));
        if (errors.length || backend.errors.length) throw new Error([...errors, ...backend.errors].join('\n'));
        report.raw.push({ mode, run, readyMs, guideReadyMs, paths, jsHeapBeforeBytes: heapBefore, jsHeapAfterBytes: after.JSHeapUsedSize, jsResources: resources });
        console.log(JSON.stringify({ mode, run, readyMs: +readyMs.toFixed(1), mainThreadMs: +paths.reduce((n, p) => n + p.mainThreadTaskMs, 0).toFixed(1) }));
      } finally { await context.close(); }
    }
  }
  for (const mode of ['react', 'solid']) {
    const trials = report.raw.filter(r => r.mode === mode);
    if (!trials.length) continue;
    const paths = trials.flatMap(t => t.paths);
    const frames = paths.flatMap(p => p.frameIntervalsMs);
    report.summary[mode] = { readyMs: summarize(trials.map(t => t.readyMs)),
      firstGuideFocusReadyMs: summarize(trials.map(t => t.guideReadyMs)),
      inputToFocusMs: summarize(paths.flatMap(p => p.focusMs)), handlerMs: summarize(paths.flatMap(p => p.handlerMs)),
      inputToTwoFrameOpportunitiesMs: summarize(paths.flatMap(p => p.frameOpportunityMs)),
      frameIntervalMs: summarize(frames), framesOver33ms: frames.filter(f => f > 33.4).length,
      framesOver50ms: frames.filter(f => f > 50.1).length,
      longTasks: paths.reduce((n, p) => n + p.longTasksMs.length, 0),
      mainThreadMsPerKey: summarize(trials.map(t => t.paths.reduce((n,p) => n + p.mainThreadTaskMs,0) / (cycles.length * zones.length))),
      postGcJsHeapMiB: summarize(trials.map(t => t.jsHeapAfterBytes / 1024 / 1024)),
      jsDecodedKiB: summarize(trials.map(t => t.jsResources.decodedBytes / 1024)),
      paths: Object.fromEntries(zones.map(zone => { const ps = paths.filter(p => p.zone === zone); return [zone, { handlerMs: summarize(ps.flatMap(p => p.handlerMs)), inputToFocusMs: summarize(ps.flatMap(p => p.focusMs)) }]; })) };
  }
  if (report.summary.react && report.summary.solid) {
    const r = report.summary.react, s = report.summary.solid;
    report.comparison = {
      startupFaster: s.readyMs.median < r.readyMs.median,
      firstGuideEntryFaster: s.firstGuideFocusReadyMs.median < r.firstGuideFocusReadyMs.median,
      handlerP95Faster: s.handlerMs.p95 < r.handlerMs.p95,
      mainThreadPerKeyLower: s.mainThreadMsPerKey.median < r.mainThreadMsPerKey.median,
      focusP95Faster: s.inputToFocusMs.p95 < r.inputToFocusMs.p95,
      noLongTasks: s.longTasks === 0,
      frameP95Within60Hz: s.frameIntervalMs.p95 <= 17.5,
      noFramesOver50ms: s.framesOver50ms === 0,
    };
  }
  console.log(JSON.stringify({ summary: report.summary, comparison: report.comparison }));
  if (output) { mkdirSync(dirname(resolve(output)), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); }
  if (process.env.PERF_ASSERT_BETTER === '1' && (!report.comparison || Object.values(report.comparison).some(value => !value))) throw new Error('SolidTV did not meet every comparative performance gate; inspect the report.');
} finally { await browser.close(); }
