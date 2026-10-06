#!/usr/bin/env node
/**
 * Vizio SmartCast on-PC device simulator (production bundle + real stack).
 *
 * Drives the real tv-web production bundle served at
 * https://viptv.local.test:8443/tv/?platform=vizio against the real local
 * backend (keyring-enabled, port 18191 by default) with the real remote
 * gateway, and captures per-second playback telemetry under device-class
 * constraints:
 *
 * - User agent: the physically qualified V655-G9 SmartCast UA token set
 *   (video/src/vizio-evidence.ts). Only vizio-evidence's own UA matcher reads
 *   it; playback uses the platform=vizio entry, matching SmartCast deployment.
 * - CPU throttling via CDP Emulation.setCPUThrottlingRate.
 * - Network shaping via CDP Network.emulateNetworkConditions (presets below).
 * - JS heap bounded by --js-flags=--max-old-space-size (approximation).
 *
 * This is PC simulation evidence, not physical Vizio qualification.
 *
 * Usage:
 *   node tests/preview/vizio-sim.mjs                       # typical preset
 *   VIZIO_NET=bad node tests/preview/vizio-sim.mjs         # constrained network
 *   VIZIO_CASE_INDEXES=0,1 node tests/preview/vizio-sim.mjs
 *
 * Environment:
 *   VIZIO_NET          fast | typical | bad          (default typical)
 *   VIZIO_CPU_THROTTLE CPU throttle rate             (default 6)
 *   VIZIO_SECONDS      playback observation seconds  (default 90)
 *   VIZIO_CASE_INDEXES comma-separated case indexes from the sim manifest
 *   VIZIO_API_BASE     backend API base              (default http://127.0.0.1:18191/api)
 *   VIZIO_ORIGIN       viewing origin                (default https://viptv.local.test:8443)
 *   VIZIO_OUT_DIR      private report directory      (default .local-https/vizio-sim)
 *   VIZIO_AUTH_TOKEN   bearer token for the local backend (else a session row is created)
 *
 * Manifest: $VIZIO_OUT_DIR/sim-manifest.json — list of playable cases
 * (title + preferred stream ids) produced by vizio-sim-manifest.py.
 * The manifest's token is a temporary session in the disposable local DB.
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../../../', import.meta.url).pathname);
const NET = process.env.VIZIO_NET ?? 'typical';
const CPU = Number(process.env.VIZIO_CPU_THROTTLE ?? 6);
const SECONDS = Number(process.env.VIZIO_SECONDS ?? 90);
const API_BASE = process.env.VIZIO_API_BASE ?? 'http://127.0.0.1:18191/api';
const ORIGIN = process.env.VIZIO_ORIGIN ?? 'https://watch.local.test:8444';
const OUT_DIR = resolve(ROOT, process.env.VIZIO_OUT_DIR ?? '.local-https/vizio-sim');
const MANIFEST = resolve(OUT_DIR, 'sim-manifest.json');

// The physically qualified SmartCast tokens (V655-G9, FW 2.600.596.0-10).
const VIZIO_UA = 'Mozilla/5.0 (Linux; arm) Model/V655-G9 FW/2.600.596.0-10 Conjure/MTKB-7.600.259.0-prod Chrome/85.0.4183.0';

const NET_PRESETS = {
  // 25 Mbps cable-class downlink.
  fast: { downloadThroughput: 25 * 1024 * 1024 / 8, uploadThroughput: 5 * 1024 * 1024 / 8, latency: 40, packetLoss: 0 },
  // 10 Mbps, typical Vizio Wi-Fi at distance.
  typical: { downloadThroughput: 10 * 1024 * 1024 / 8, uploadThroughput: 2 * 1024 * 1024 / 8, latency: 60, packetLoss: 0 },
  // 5 Mbps congested Wi-Fi with loss — the "3-second stutter" regime.
  bad: { downloadThroughput: 5 * 1024 * 1024 / 8, uploadThroughput: 1 * 1024 * 1024 / 8, latency: 150, packetLoss: 0.005 },
};

if (!existsSync(MANIFEST)) {
  console.error(`Sim manifest missing: ${MANIFEST}
Create it first with .local-https/vizio-sim/sim-manifest.py (requires the stage-1 stack).`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const token = process.env.VIZIO_AUTH_TOKEN ?? manifest.token;
const allCases = manifest.items ?? [];
const selected = process.env.VIZIO_CASE_INDEXES
  ? String(process.env.VIZIO_CASE_INDEXES).split(',').filter(Boolean).map(Number).filter(i => allCases[i])
  : allCases.map((_, i) => i);
const cases = selected.map(i => ({ ...allCases[i], index: i }));
if (!cases.length) { console.error('No cases selected.'); process.exit(1); }

const preset = NET_PRESETS[NET] ?? NET_PRESETS.typical;
mkdirSync(OUT_DIR, { recursive: true });

const report = {
  schema: 1,
  measuredAt: new Date().toISOString(),
  simulation: {
    userAgent: VIZIO_UA,
    cpuThrottleRate: CPU,
    network: { name: NET, ...preset },
    jsHeapMiB: 256,
    origin: ORIGIN,
    apiBase: API_BASE,
    secondsPerCase: SECONDS,
    disclaimer: 'PC simulation (CDP CPU/network shaping + bounded heap), not physical Vizio hardware qualification.',
  },
  cases: [],
};

const browser = await chromium.launch({
  args: ['--disable-background-timer-throttling', '--js-flags=--max-old-space-size=256', '--autoplay-policy=no-user-gesture-required'],
});
try {
  for (const item of cases) {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      userAgent: VIZIO_UA,
      timezoneId: 'America/New_York', locale: 'en-US', colorScheme: 'dark',
      serviceWorkers: 'block',
      ignoreHTTPSErrors: false,
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, ...preset });

    const consoleErrors = [];
    page.on('pageerror', error => consoleErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

    // CDP network counters scoped to media segment requests.
    let mediaBytes = 0, mediaRequests = 0, mediaErrors = 0;
    cdp.on('Network.dataReceived', event => {
      const entry = networkUrls.get(event.requestId);
      if (entry && /\/media\/|\.ts($|\?)|\.m3u8($|\?)/.test(entry)) { mediaBytes += event.dataLength; }
    });
    const networkUrls = new Map();
    cdp.on('Network.requestWillBeSent', event => networkUrls.set(event.requestId, event.request.url));
    cdp.on('Network.loadingFailed', event => {
      const entry = networkUrls.get(event.requestId);
      if (entry && /\/media\/|\.ts($|\?)|\.m3u8($|\?)/.test(entry)) mediaErrors++;
    });

    const result = { alias: item.alias, title: item.title, index: item.index, stage: 'load', consoleErrors: [], mediaErrors: 0 };
    try {
      // Auth: install the device token set the same way a paired TV stores it.
      // Shape matches core Session (camelCase); profileId selects profile 1.
      await page.addInitScript(({ key, tokens }) => {
        localStorage.setItem(key, JSON.stringify(tokens));
      }, { key: `viptv-device:${ORIGIN}`, tokens: {
        sessionId: manifest.session, accountId: String(manifest.accountId ?? 1), profileId: String(manifest.profileId ?? 1),
        accessToken: token, refreshToken: manifest.refreshToken ?? '', expiresIn: 3600 * 6,
      } });

      await page.goto(`${ORIGIN}/tv/?platform=vizio`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      result.stage = 'home';
      // The TV video layer is always mounted (hidden behind the app surface).
      await page.waitForSelector('#tv-video', { state: 'attached', timeout: 30000 });
      // Home needs the catalog: wait until the app reports a signed-in, ready
      // home (hero present in the SolidTV app container).
      await page.waitForTimeout(6000);

      // Home -> first hero title: press Enter on hero-play.
      await page.keyboard.press('Enter');
      result.stage = 'detail';
      // Detail -> Play (hero action of the detail screen is Play). The app then
      // runs real discovery and auto-selects its best-ranked source.
      await page.waitForTimeout(2500);
      await page.keyboard.press('Enter');
      result.stage = 'sources';
      // The first Enter sometimes lands on a meta tile instead of the hero;
      // if the detail phase did not open the player, press Enter again after
      // the sources list has settled (app auto-plays the top-ranked source).
      await page.waitForTimeout(2500);
      // Real discovery + gateway preparation can take a while; watch for the
      // player to attach a src (poll the video element directly).
      const attachDeadline = Date.now() + 120000;
      let attached = false;
      while (Date.now() < attachDeadline && !attached) {
        attached = await page.evaluate(() => {
          const v = document.querySelector('video');
          return !!v && (!!v.src || v.querySelector('source'));
        }).catch(() => false);
        if (!attached) {
          // If a source list is on screen and no auto-selection happened yet,
          // press Enter on the focused (top) row to start the top source.
          await page.keyboard.press('Enter');
          await page.waitForTimeout(1500);
        }
      }
      result.sourceSelected = attached;
      result.stage = 'preparing';

      // Watch the real video element: per-second sampling of the same signals
      // the physical diagnosis used (buffered ranges, frames, state events).
      const began = Date.now();
      const samples = [];
      const events = { waiting: 0, stalled: 0, playing: 0, canplay: 0, error: 0, seeking: 0 };
      await page.evaluate(events => {
        const video = document.querySelector('video');
        if (!video) return;
        for (const name of Object.keys(events))
          video.addEventListener(name, () => { events[name]++; }, { passive: true });
        window.__vizioEvents = events;
        window.__vizioSamples = [];
        window.__vizioTimer = setInterval(() => {
          const v = document.querySelector('video');
          if (!v) return;
          const quality = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : null;
          window.__vizioSamples.push({
            at: Date.now() - window.__vizioBegan,
            state: v.readyState, network: v.networkState,
            time: v.currentTime, paused: v.paused, ended: v.ended,
            buffered: Array.from({ length: v.buffered.length }, (_, i) => [v.buffered.start(i), v.buffered.end(i)]),
            seekable: Array.from({ length: v.seekable.length }, (_, i) => [v.seekable.start(i), v.seekable.end(i)]),
            width: v.videoWidth, height: v.videoHeight,
            frames: quality ? quality.totalVideoFrames : null, dropped: quality ? quality.droppedVideoFrames : null,
            mediaError: v.error ? v.error.code : null,
          });
        }, 1000);
        window.__vizioBegan = Date.now();
      }, events);
      // Let it play for the observation window.
      await page.waitForTimeout(SECONDS * 1000);
      const capture = await page.evaluate(() => {
        clearInterval(window.__vizioTimer);
        return { samples: window.__vizioSamples ?? [], events: window.__vizioEvents ?? {}, src: (document.querySelector('video')?.src || '').replace(/https?:\/\/[^/]+/, '<origin>'), readyState: document.querySelector('video')?.readyState };
      });
      result.stage = 'observed';
      result.samples = capture.samples;
      result.events = capture.events;
      result.videoSrcForm = capture.src ? (capture.src.startsWith('blob:') ? 'mse-blob' : capture.src.includes('.m3u8') ? 'native-hls' : capture.src.includes('/media/') ? 'media-proxy' : 'direct') : 'none';
      result.mediaBytes = mediaBytes;
      result.mediaRequests = mediaRequests;
      result.mediaErrors = mediaErrors + result.mediaErrors;
      result.consoleErrors = consoleErrors.slice(0, 10);

      // Derive rebuffer/stutter metrics from the samples.
      const playing = capture.samples.filter(s => !s.paused && s.time > 0);
      result.playbackActive = playing.length > 0;
      if (playing.length > 1) {
        const stalls = [];
        let advancing = null;
        for (const s of capture.samples) {
          if (s.paused || s.time === 0) continue;
          if (advancing !== null && Math.abs(s.time - advancing.time) < 0.01 && s.at - advancing.at >= 2000) {
            stalls.push({ at: s.at / 1000, time: s.time, waitedMs: s.at - advancing.at });
          }
          if (advancing === null || Math.abs(s.time - advancing.time) >= 0.01) advancing = s;
        }
        result.stallEvents = stalls;
        result.stallCount = stalls.length + capture.events.waiting;
        // Buffer ahead at each sample (nearest buffered end > time).
        const bufferAhead = playing.map(s => {
          const end = (s.buffered || []).reduce((best, [start, stop]) => s.time >= start && stop > s.time ? Math.max(best, stop) : best, 0);
          return end ? +(end - s.time).toFixed(2) : 0;
        });
        result.bufferAheadSeconds = { min: Math.min(...bufferAhead), median: bufferAhead.sort((a, b) => a - b)[Math.floor(bufferAhead.length / 2)], max: Math.max(...bufferAhead) };
        result.avgTimePerSecond = +(playing[playing.length - 1].time / (playing[playing.length - 1].at / 1000)).toFixed(3);
        result.throughputMbps = +(mediaBytes * 8 / 1e6 / (SECONDS)).toFixed(2);
        result.firstFrameMs = (capture.samples.find(s => s.frames > 0 && s.width > 0)?.at) ?? null;
        result.droppedFrames = capture.samples.at(-1)?.dropped ?? null;
      }
      result.passed = !!result.playbackActive && (result.stallCount ?? 99) <= 1 && !capture.samples.some(s => s.mediaError);
    } catch (error) {
      result.error = String(error).slice(0, 300);
      result.passed = false;
    } finally {
      await context.close();
    }
    report.cases.push(result);
    console.log(JSON.stringify({ alias: result.alias, stage: result.stage, passed: result.passed, stalls: result.stallCount ?? null, bufferMedian: result.bufferAheadSeconds?.median ?? null, throughputMbps: result.throughputMbps ?? null }));
    // Gateway idle grace between cases.
    await new Promise(resolve_ => setTimeout(resolve_, 17000));
  }
  const summary = {
    cases: report.cases.length,
    passed: report.cases.filter(c => c.passed).length,
    stallCounts: report.cases.map(c => ({ alias: c.alias, stalls: c.stallCount ?? null, bufferAhead: c.bufferAheadSeconds ?? null })),
    firstFrameMs: report.cases.map(c => ({ alias: c.alias, firstFrameMs: c.firstFrameMs ?? null })),
  };
  report.summary = summary;
  const path = resolve(OUT_DIR, `sim-report-${NET}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ report: path, ...summary }, null, 2));
} finally {
  await browser.close();
}
