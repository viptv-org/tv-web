#!/usr/bin/env node
/* Same fixture, production-bundle browser timing for the TV Home remote path.
 * This is a Chromium measurement, not physical Tizen/Vizio/webOS evidence.
 * Run after npm run build and start vite preview on the chosen port. */
import { chromium } from '@playwright/test';
import { installBackend, installMediaStubs } from './backend.ts';

const origin = process.env.PERF_PREVIEW_URL ?? 'http://127.0.0.1:4182/tv';
const runs = Number(process.env.PERF_RUNS ?? 3);
const cpuThrottle = Number(process.env.PERF_CPU_THROTTLE ?? 1);
const sequence = Array.from({ length: 8 }, () => [
  ['ArrowRight', 1], ['ArrowRight', 2], ['ArrowLeft', 1], ['ArrowLeft', 0],
]).flat();
const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * (sorted.length - 1)))];
};
const summarize = values => ({
  samples: values.length,
  median: Number(percentile(values, 0.5).toFixed(2)),
  p95: Number(percentile(values, 0.95).toFixed(2)),
  max: Number(Math.max(...values).toFixed(2)),
});

const browser = await chromium.launch({ args: ['--disable-background-timer-throttling'] });
try {
  for (const mode of ['react', 'blits']) {
    const latencies = [];
    const frames = [];
    const readyTimes = [];
    for (let run = 0; run < runs; run++) {
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
        timezoneId: 'America/New_York', locale: 'en-US', colorScheme: 'dark',
        reducedMotion: 'reduce', serviceWorkers: 'block',
      });
      const page = await context.newPage();
      if (cpuThrottle > 1) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
      }
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        window.__bench = { lastKeyAt: -1, lastFocusAt: -1, frames: [], frameRunning: false };
        window.addEventListener('keydown', event => {
          if (event.key.startsWith('Arrow')) window.__bench.lastKeyAt = performance.now();
        }, true);
        document.addEventListener('focusin', () => { window.__bench.lastFocusAt = performance.now(); }, true);
      });
      const backend = await installBackend(page, { family: 'tv', session: 'ready' });
      await installMediaStubs(page, { frame: '63e024' });
      const start = Date.now();
      await page.goto(`${origin}${mode === 'blits' ? '/lightning.html?platform=tizen&focusdebug=1&perfdebug=1' : '/?platform=tizen'}`);
      if (mode === 'react') {
        const first = page.locator('[data-focus-id="hero-play"]');
        await first.waitFor({ state: 'visible', timeout: 20000 }).catch(async cause => {
          throw new Error(`${cause.message}; body=${(await page.locator('body').innerText()).slice(0, 1000)}; errors=${JSON.stringify(errors)}; requests=${JSON.stringify(backend.requests.slice(-8))}`);
        });
        await first.focus();
      } else {
        await page.waitForFunction(() => window.__viptvFocus?.view === 'home-action' && window.__viptvFocus?.index === 0, null, { timeout: 20000 });
      }
      readyTimes.push(Date.now() - start);
      if (mode === 'blits' && run === 0) {
        const marks = await page.evaluate(() => Object.fromEntries(
          performance.getEntriesByType('mark').filter(entry => entry.name.startsWith('viptv:')).map(entry => [entry.name, Number(entry.startTime.toFixed(1))])
        ));
        console.log(JSON.stringify({ mode, startupMarksMs: marks }));
      }
      await page.waitForTimeout(250);
      await page.evaluate(() => {
        const bench = window.__bench;
        bench.frameRunning = true;
        let previous = 0;
        const sample = time => {
          if (!bench.frameRunning) return;
          if (previous) bench.frames.push(time - previous);
          previous = time;
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      for (const [key, index] of sequence) {
        await page.keyboard.press(key);
        if (mode === 'react') {
          await page.waitForFunction(index => document.activeElement?.getAttribute('data-focus-id') === ['hero-play', 'hero-details', 'hero-save'][index], index, { timeout: 5000 });
        } else {
          await page.waitForFunction(index => window.__viptvFocus?.view === 'home-action' && window.__viptvFocus?.index === index, index, { timeout: 5000 });
        }
        const latency = await page.evaluate(mode => {
          const focusAt = mode === 'react' ? window.__bench.lastFocusAt : window.__viptvFocus?.at;
          return focusAt - window.__bench.lastKeyAt;
        }, mode);
        if (latency >= 0 && latency < 5000) latencies.push(latency);
      }
      frames.push(...await page.evaluate(() => {
        window.__bench.frameRunning = false;
        return window.__bench.frames;
      }));
      if (backend.errors.length) throw new Error(`${mode} fixture errors: ${backend.errors.join('; ')}`);
      await context.close();
    }
    console.log(JSON.stringify({
      mode, runs, cpuThrottle, readyMs: summarize(readyTimes), inputToFocusMs: summarize(latencies),
      frameIntervalMs: summarize(frames), framesOver33ms: frames.filter(value => value > 33.3).length,
      framesOver50ms: frames.filter(value => value > 50).length,
    }));
  }
} finally {
  await browser.close();
}
