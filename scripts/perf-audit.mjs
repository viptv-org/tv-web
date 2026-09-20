#!/usr/bin/env node
/**
 * VIPTV responsive-client performance audit.
 *
 * Runs the app under Chromium with a deterministic mocked backend and image
 * fixtures, then measures the scenarios that dominate perceived snappiness:
 * cold Home load, carousel arrow interaction latency, route switches and a
 * per-screen cost sweep. Artwork is served through the same wsrv.nl URL
 * shape the core image policy produces, so the audit measures the real
 * production image path (request count, decode-driven layout).
 *
 * Usage:
 *   npm run perf:audit                    # writes artifacts/perf/report-<ts>.json
 *   npm run perf:audit -- --compare artifacts/perf/report-<ts>.json
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = 4173;
const origin = `http://127.0.0.1:${port}`;
const apiOrigin = "https://viptv.syek.tech";
const cors = {
  "access-control-allow-origin": origin,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "authorization, content-type, x-csrf-token",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

// Deterministic fixture scale: every configured catalog contributes a full
// shelf, matching a populated Stremio account. Identical on every run so
// reports stay comparable.
const CATALOG_COUNT = 12;
const ITEMS_PER_CATALOG = 24;
const QUEUE_COUNT = 24;

const comparePath = process.argv.includes("--compare")
  ? resolve(process.cwd(), process.argv[process.argv.indexOf("--compare") + 1])
  : null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const round = (value) => Math.round(value * 10) / 10;

// ---------------------------------------------------------------------------
// Dev server lifecycle
// ---------------------------------------------------------------------------
let serverProcess = null;
async function urlReachable(url) {
  try {
    await fetch(url, { method: "HEAD" });
    return true;
  } catch {
    return false;
  }
}
async function ensureServer() {
  if (await urlReachable(origin)) return;
  serverProcess = spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
    cwd: root,
    detached: true,
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await urlReachable(origin)) return;
    await sleep(500);
  }
  throw new Error(`Dev server did not become reachable at ${origin}`);
}
function stopServer() {
  if (!serverProcess) return;
  try {
    process.kill(-serverProcess.pid, "SIGTERM");
  } catch {
    /* already gone */
  }
  serverProcess = null;
}
process.on("exit", stopServer);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopServer();
    process.exit(130);
  });
}

// ---------------------------------------------------------------------------
// Deterministic fixture backend (mirrors tests/e2e/helpers/responsiveBackend)
// ---------------------------------------------------------------------------
const addons = ["Cinemeta", "AIOMetadata", "MDBList", "Trakt"];
const catalogs = Array.from({ length: CATALOG_COUNT }, (_, i) => ({
  id: `catalog-${i}`,
  name: `${["Popular", "Trending", "Top Rated", "Award Winning"][i % 4]} ${i % 2 ? "Series" : "Movies"}`,
  type: i % 2 ? "series" : "movie",
  addon_id: 1 + (i % 4),
  addon_name: addons[i % 4],
  supports_search: true,
  supports_skip: true,
}));
const metasFor = (ci) =>
  Array.from({ length: ITEMS_PER_CATALOG }, (_, j) => ({
    id: `title-${ci}-${j}`,
    type: (catalogs[ci] ?? catalogs[0]).type,
    name: `Feature Title ${ci}.${j}`,
    title: `Feature Title ${ci}.${j}`,
    poster: `https://images.metahub.space/poster-${ci}-${j}.jpg`,
    background: `https://images.metahub.space/backdrop-${ci}-${j}.jpg`,
    description: "A deterministic fixture description for the performance audit inventory.",
    year: 2024 + (j % 3),
    genres: ["Adventure", "Drama"],
  }));
const queue = Array.from({ length: QUEUE_COUNT }, (_, i) => ({
  id: `queue-series:1:${i + 1}`,
  type: "episode",
  series_id: "queue-series",
  name: "Returning Series",
  title: `Episode ${i + 1}`,
  episode_title: `Episode ${i + 1}`,
  season: 1,
  episode: i + 1,
  position: 42 + i,
  duration: 2400,
  queue_status: "resume",
  poster: `https://episodes.metahub.space/episode-${i}.jpg`,
}));
const liveChannels = Array.from({ length: 4 }, (_, i) => ({
  id: `station-${i}`,
  type: "live",
  name: `International News ${i + 1}`,
  logo: `https://live.metahub.space/live-${i}.png`,
  section: "News",
}));
const state = { selectedProfileId: null };

const fixtureImage = (width, height) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#15263a"/><circle cx="${round(width * 0.74)}" cy="${round(height * 0.28)}" r="${round(Math.max(8, width * 0.12))}" fill="#dab979"/><path d="M0 ${height}L${round(width * 0.32)} ${round(height * 0.43)}L${round(width * 0.62)} ${round(height * 0.76)}L${width} ${round(height * 0.38)}V${height}Z" fill="#42566a"/><path d="M0 ${height}L${round(width * 0.47)} ${round(height * 0.72)}L${width} ${round(height * 0.88)}V${height}Z" fill="#20313b"/></svg>`,
  );

async function installBackend(page) {
  await page.addInitScript(
    ({ key }) => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(
          key,
          JSON.stringify({
            sessionId: "perf-session",
            accountId: "7",
            profileId: null,
            accessToken: "fixture-access",
            refreshToken: "fixture-refresh",
            expiresIn: 900,
          }),
        );
      }
    },
    { key: `viptv-device:${apiOrigin}` },
  );
  await page.addInitScript(() => {
    if (window.__perf) return;
    const perf = { longtasks: [], lcp: 0 };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        perf.longtasks.push({ start: Math.round(entry.startTime), duration: Math.round(entry.duration) });
      }
    }).observe({ entryTypes: ["longtask"] });
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length) perf.lcp = Math.round(entries[entries.length - 1].startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
    window.__perf = perf;
  });

  // Deterministic images: every wsrv.nl request (the production image path the
  // core policy produces) and every raw origin URL (the retry/bypass paths)
  // resolve to the same sized fixture with cache headers.
  await page.route(
    /https:\/\/(wsrv\.nl|images\.metahub\.space|episodes\.metahub\.space|live\.metahub\.space|art\.example)\//,
    (route) => {
      const url = new URL(route.request().url());
      const width = Math.max(1, Number(url.searchParams.get("w")) || 512);
      const height = Math.max(1, Number(url.searchParams.get("h")) || 288);
      return route.fulfill({
        headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=604800" },
        body: fixtureImage(width, height),
      });
    },
  );

  const handleApiRoute = async (route) => {
    try {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = new URL(request.url()).pathname;
    const json = (body, status = 200) =>
      route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/auth/me") {
      return json({
        account: { id: "7", username: "alex", name: "Alex", role: "member" },
        profiles: [{ id: "1", name: "Alex", setup_complete: true }],
        profile_id: state.selectedProfileId,
        restricted: false,
        profile_setup_required: false,
      });
    }
    if (path === "/api/auth/profile") {
      state.selectedProfileId = "1";
      return json({ profile_id: "1" });
    }
    if (path === "/api/profiles/1/continue/page") return json({ items: queue, offset: 0, total: queue.length, next_offset: null });
    if (path === "/api/profiles/1/progress" || path === "/api/profiles/1/progress/series" || path === "/api/profiles/1/favorites") return json([]);
    if (path === "/api/profiles/1/preferences") {
      return json({
        audio_language: "en", subtitle_language: "en", subtitles_enabled: false,
        subtitle_size: "normal", subtitle_style: "system", quality: "auto", autoplay: true,
      });
    }
    if (path === "/api/addons") return json([]);
    if (path === "/api/catalogs") return json(catalogs);
    if (path === "/api/discover") {
      const id = new URL(request.url()).searchParams.get("catalog") ?? "";
      const index = Math.max(0, catalogs.findIndex((c) => c.id === id));
      return json({ metas: metasFor(index), has_more: false, next_skip: null });
    }
    if (path === "/api/live") return json({ channels: liveChannels, total: liveChannels.length });
    if (path === "/api/live/categories") return json({ categories: [], total: 0 });
    if (path.startsWith("/api/guide/")) return json({ programs: [], timeline: [], timezone: "UTC" });
    if (path === "/api/meta/series/queue-series") {
      return json({ meta: { id: "queue-series", type: "series", name: "Returning Series", poster: "https://images.metahub.space/poster-0-0.jpg", background: "https://images.metahub.space/backdrop-0-0.jpg", videos: queue.map((item) => ({ id: item.id, title: item.episode_title, season: item.season, episode: item.episode, thumbnail: `https://episodes.metahub.space/episode-${item.episode - 1}.jpg` })) } });
    }
    if (path.startsWith("/api/meta/")) {
      const parts = (path.split("/").at(-1) ?? "").split("-");
      const ci = Number(parts[1]);
      const j = Number(parts[2]);
      const list = metasFor(Number.isFinite(ci) ? ci : 0);
      return json({ meta: Number.isFinite(j) ? list[j] ?? list[0] : list[0] });
    }
    return json({ error: `Unhandled fixture route ${path}` }, 404);
    } catch (error) {
      return route
        .fulfill({ status: 500, headers: cors, contentType: "application/json", body: JSON.stringify({ error: String(error?.message ?? error) }) })
        .catch(() => {});
    }
  };
  await page.route(`${apiOrigin}/api/**`, handleApiRoute);
}

// ---------------------------------------------------------------------------
// Measurement helpers
// ---------------------------------------------------------------------------
const images = { requests: 0, bytes: 0, lastAt: 0 };
const pendingImages = new Map();
function trackImages(cdp) {
  cdp.on("Network.requestWillBeSent", (event) => {
    const isImage = event.type === "Image" || /wsrv\.nl|metahub\.space|art\.example/.test(event.request.url);
    if (!isImage) return;
    pendingImages.set(event.requestId, event.request.url);
    images.requests += 1;
    images.lastAt = Date.now();
  });
  cdp.on("Network.loadingFinished", (event) => {
    if (pendingImages.delete(event.requestId)) images.bytes += event.encodedDataLength || 0;
  });
  cdp.on("Network.loadingFailed", (event) => pendingImages.delete(event.requestId));
}
async function waitForImageQuiet(quietMs, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (Date.now() - images.lastAt >= quietMs) return;
    await sleep(100);
  }
}
async function cdpSnapshot(cdp) {
  const { metrics } = await cdp.send("Performance.getMetrics");
  const pick = (name) => metrics.find((m) => m.name === name)?.value ?? 0;
  return {
    LayoutCount: pick("LayoutCount"),
    RecalcStyleCount: pick("RecalcStyleCount"),
    LayoutDuration: pick("LayoutDuration"),
    RecalcStyleDuration: pick("RecalcStyleDuration"),
    ScriptDuration: pick("ScriptDuration"),
    TaskDuration: pick("TaskDuration"),
    JSHeapUsedSize: pick("JSHeapUsedSize"),
    Nodes: pick("Nodes"),
  };
}
const delta = (after, before) => {
  const out = {};
  for (const key of Object.keys(after)) out[key] = round(after[key] - (before[key] ?? 0));
  return out;
};
async function pageSnapshot(page) {
  return page.evaluate(() => ({
    domNodes: document.getElementsByTagName("*").length,
    cards: document.querySelectorAll(".media-card").length,
    shelves: document.querySelectorAll(".shelves section").length,
    longtasks: window.__perf.longtasks.slice(),
    lcp: window.__perf.lcp,
  }));
}
async function clearLongtasks(page) {
  await page.evaluate(() => { window.__perf.longtasks.length = 0; });
}

const clickCarouselStep = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const button =
          document.querySelector(".shelf-carousel .shelf-scroll-right") ||
          document.querySelector('.shelf-carousel [aria-label="Scroll shelf right"]');
        if (!button) return resolve({ error: "right scroll control not found" });
        const carousel = button.closest(".shelf-carousel");
        const scroller = carousel ? carousel.querySelector(".cards") : null;
        if (!scroller) return resolve({ error: "shelf scroller not found" });
        const start = performance.now();
        let settled = false;
        let stableFrames = 0;
        let lastLeft = scroller.scrollLeft;
        let frame = 0;
        const finish = (reason) => {
          if (settled) return;
          settled = true;
          cancelAnimationFrame(frame);
          scroller.removeEventListener("scrollend", onScrollEnd);
          resolve({ ms: Math.round(performance.now() - start), reason, scrollLeft: Math.round(scroller.scrollLeft) });
        };
        const onScrollEnd = () => finish("scrollend");
        scroller.addEventListener("scrollend", onScrollEnd, { once: true });
        const loop = () => {
          if (settled) return;
          if (Math.abs(scroller.scrollLeft - lastLeft) < 1) {
            stableFrames += 1;
            if (stableFrames >= 8) return finish("stable");
          } else {
            stableFrames = 0;
            lastLeft = scroller.scrollLeft;
          }
          frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
        setTimeout(() => finish("timeout"), 4000);
        button.click();
      }),
  );

const clickNav = (page, label, marker) =>
  page.evaluate(
    ({ label, marker }) =>
      new Promise((resolve) => {
        const buttons = document.querySelectorAll(
          '.desktop-sidebar nav button, nav[aria-label="Main navigation"] button',
        );
        const button = Array.from(buttons).find(
          (b) => (b.getAttribute("aria-label") || b.textContent.trim()) === label,
        );
        if (!button) return resolve({ label, error: "nav button not found" });
        const start = performance.now();
        button.click();
        const deadline = start + 10000;
        const check = () => {
          if (document.querySelector(marker)) {
            requestAnimationFrame(() =>
              requestAnimationFrame(() => resolve({ label, ms: Math.round(performance.now() - start) })),
            );
            return;
          }
          if (performance.now() > deadline) {
            return resolve({ label, error: "marker not found", ms: Math.round(performance.now() - start) });
          }
          setTimeout(check, 16);
        };
        check();
      }),
    { label, marker },
  );

// ---------------------------------------------------------------------------
// Audit run
// ---------------------------------------------------------------------------
const pageErrors = [];
let activeBrowser = null;
async function run() {
  await ensureServer();
  console.log("[perf] dev server ready");
  const browser = await chromium.launch();
  activeBrowser = browser;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  context.setDefaultTimeout(15000);
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Performance.enable");
  trackImages(cdp);
  await installBackend(page);

  // Warmup pass: compiles vite modules so the measured cold load is not
  // dominated by first-request transform latency.
  await page.goto(origin);
  await page.getByRole("button", { name: "Alex" }).click();
  await page.locator(".shelves .media-card").first().waitFor({ timeout: 30000 });
  await sleep(600);
  console.log("[perf] warmup complete");

  // Measured cold load: reset the profile server-side, reload, sign in.
  state.selectedProfileId = null;
  await cdp.send("Network.clearBrowserCache");
  // The app persists the chosen profile in the stored session, so a plain
  // reload would skip the chooser. Reset it to measure the full cold path.
  await page.evaluate(({ key }) => {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const session = JSON.parse(raw);
      session.profileId = null;
      localStorage.setItem(key, JSON.stringify(session));
    } catch { /* leave the stored session untouched */ }
  }, { key: `viptv-device:${apiOrigin}` });
  const imageBase = { requests: images.requests, bytes: images.bytes };
  const metricsBase = await cdpSnapshot(cdp);
  await page.goto(origin);
  await page.getByRole("button", { name: "Alex" }).click();
  await page.locator(".shelves .media-card").first().waitFor({ timeout: 30000 });
  await waitForImageQuiet(800, 20000);
  const coldPage = await pageSnapshot(page);
  const coldMetrics = await cdpSnapshot(cdp);
  const coldHome = {
    domNodes: coldPage.domNodes,
    cards: coldPage.cards,
    shelves: coldPage.shelves,
    lcp: coldPage.lcp,
    longtasks: coldPage.longtasks,
    longtaskCount: coldPage.longtasks.length,
    totalBlockingTime: coldPage.longtasks.reduce((sum, t) => sum + t.duration, 0),
    imageRequests: images.requests - imageBase.requests,
    imageBytes: images.bytes - imageBase.bytes,
    heapMB: round((coldMetrics.JSHeapUsedSize - metricsBase.JSHeapUsedSize) / 1048576),
    layout: delta(coldMetrics, metricsBase),
  };
  console.log(`[perf] cold home: lcp=${coldHome.lcp}ms longtasks=${coldHome.longtaskCount}/${coldHome.totalBlockingTime}ms dom=${coldHome.domNodes} cards=${coldHome.cards} shelves=${coldHome.shelves} images=${coldHome.imageRequests}`);

  // Carousel interaction: five consecutive right-arrow clicks on the first shelf.
  const carouselClicks = [];
  let imagesBeforeCarousel = images.requests;
  let metricsBeforeCarousel = await cdpSnapshot(cdp);
  for (let i = 0; i < 5; i++) {
    await clearLongtasks(page);
    const step = await clickCarouselStep(page);
    const longtasks = await page.evaluate(() => window.__perf.longtasks.slice());
    carouselClicks.push({ ...step, longtaskMs: longtasks.reduce((sum, t) => sum + t.duration, 0) });
    console.log(`[perf] carousel ${i + 1}: ${step.error ?? `${step.ms}ms (${step.reason})`}`);
    await sleep(350);
  }
  const metricsAfterCarousel = await cdpSnapshot(cdp);
  const carousel = {
    clicks: carouselClicks,
    medianMs: median(carouselClicks.filter((c) => typeof c.ms === "number").map((c) => c.ms)),
    imageRequestsDuring: images.requests - imagesBeforeCarousel,
    layout: delta(metricsAfterCarousel, metricsBeforeCarousel),
  };

  // Route switches: Home -> Discover -> Home.
  const routes = [];
  for (let cycle = 0; cycle < 1; cycle++) {
    for (const { label, marker } of [
      { label: "Discover", marker: '[data-focus-id="discover-type"]' },
      { label: "Home", marker: ".shelves .media-card" },
    ]) {
      await clearLongtasks(page);
      const before = await cdpSnapshot(cdp);
      const leg = await clickNav(page, label, marker);
      await sleep(400);
      const longtasks = await page.evaluate(() => window.__perf.longtasks.slice());
      const after = await cdpSnapshot(cdp);
      routes.push({
        ...leg,
        longtaskCount: longtasks.length,
        longtaskMs: longtasks.reduce((sum, t) => sum + t.duration, 0),
        layout: delta(after, before),
      });
      console.log(`[perf] route ${leg.label}: ${leg.error ?? `${leg.ms}ms`}`);
    }
  }

  // Per-screen sweep.
  const screens = [];
  for (const { label, marker } of [
    { label: "Live TV", marker: ".epg-scroll" },
    { label: "My List", marker: '[data-scroll-id^="cards-saved"]' },
    { label: "Search", marker: "main.search" },
  ]) {
    await clearLongtasks(page);
    const imagesBefore = images.requests;
    const before = await cdpSnapshot(cdp);
    const pageBefore = await pageSnapshot(page);
    await clickNav(page, label, marker);
    await waitForImageQuiet(700, 8000);
    const longtasks = await page.evaluate(() => window.__perf.longtasks.slice());
    const after = await cdpSnapshot(cdp);
    const pageAfter = await pageSnapshot(page);
    screens.push({
      label,
      longtaskCount: longtasks.length,
      longtaskMs: longtasks.reduce((sum, t) => sum + t.duration, 0),
      domNodes: pageAfter.domNodes,
      domNodeDelta: pageAfter.domNodes - pageBefore.domNodes,
      imageRequests: images.requests - imagesBefore,
      layout: delta(after, before),
    });
    console.log(`[perf] screen ${label}: dom=${pageAfter.domNodes} longtasks=${longtasks.length}`);
  }

  console.log("[perf] closing browser");
  await browser.close();
  return { coldHome, carousel, routes, screens };
}

function summarize(report) {
  const lines = [];
  const { coldHome, carousel, routes, screens } = report;
  lines.push(`Cold Home: LCP ${coldHome.lcp}ms, long tasks ${coldHome.longtaskCount} (${coldHome.totalBlockingTime}ms total), DOM ${coldHome.domNodes} nodes, cards ${coldHome.cards} across ${coldHome.shelves} shelves, images ${coldHome.imageRequests} requests (${(coldHome.imageBytes / 1024).toFixed(0)}KB fixture bytes), heap +${coldHome.heapMB}MB`);
  lines.push(`Carousel next (5 clicks): median ${carousel.medianMs}ms — [${carousel.clicks.map((c) => (c.error ? c.error : c.ms)).join(", ")}]ms, images during ${carousel.imageRequestsDuring}, layout count ${carousel.layout.LayoutCount}`);
  for (const leg of routes) {
    lines.push(`Route ${leg.label}: ${leg.error ?? `${leg.ms}ms`} (long tasks ${leg.longtaskCount}/${leg.longtaskMs}ms, layouts ${leg.layout.LayoutCount})`);
  }
  for (const screen of screens) {
    lines.push(`Screen ${screen.label}: DOM ${screen.domNodes} (${screen.domNodeDelta >= 0 ? "+" : ""}${screen.domNodeDelta}), long tasks ${screen.longtaskCount}/${screen.longtaskMs}ms, images ${screen.imageRequests}`);
  }
  const top = [...coldHome.longtasks].sort((a, b) => b.duration - a.duration).slice(0, 5);
  if (top.length) {
    lines.push("Top cold-load long tasks: " + top.map((t) => `${t.duration}ms @ ${t.start}ms`).join(", "));
  }
  return lines;
}

function compareReports(baseline, current) {
  const lines = [];
  const pairs = [
    ["cold LCP", baseline.coldHome.lcp, current.coldHome.lcp, "ms"],
    ["cold total long tasks", baseline.coldHome.totalBlockingTime, current.coldHome.totalBlockingTime, "ms"],
    ["cold image requests", baseline.coldHome.imageRequests, current.coldHome.imageRequests, ""],
    ["cold DOM nodes", baseline.coldHome.domNodes, current.coldHome.domNodes, ""],
    ["carousel median", baseline.carousel.medianMs, current.carousel.medianMs, "ms"],
    ["carousel images during", baseline.carousel.imageRequestsDuring, current.carousel.imageRequestsDuring, ""],
  ];
  for (const [name, before, after, unit] of pairs) {
    const change = round(after - before);
    lines.push(`${name}: ${before}${unit} -> ${after}${unit} (${change >= 0 ? "+" : ""}${change}${unit})`);
  }
  const routeBefore = median(baseline.routes.filter((r) => r.ms).map((r) => r.ms));
  const routeAfter = median(current.routes.filter((r) => r.ms).map((r) => r.ms));
  lines.push(`route median: ${routeBefore}ms -> ${routeAfter}ms (${round(routeAfter - routeBefore)}ms)`);
  return lines;
}

run()
  .then((scenarios) => {
    const report = {
      meta: {
        timestamp: new Date().toISOString(),
        url: origin,
        viewport: "1440x900",
        fixture: { catalogs: CATALOG_COUNT, itemsPerCatalog: ITEMS_PER_CATALOG, queue: QUEUE_COUNT },
        pageErrors,
      },
      ...scenarios,
    };
    const outDir = resolve(root, "artifacts/perf");
    mkdirSync(outDir, { recursive: true });
    const file = resolve(outDir, `report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(file, JSON.stringify(report, null, 2));
    console.log(`VIPTV performance audit — ${report.meta.timestamp}`);
    console.log(`Report: ${file}\n`);
    for (const line of summarize(report)) console.log(line);
    if (comparePath && existsFileSync(comparePath)) {
      const baseline = JSON.parse(readFileSync(comparePath, "utf8"));
      console.log("\nComparison against baseline:");
      for (const line of compareReports(baseline, report)) console.log(line);
    } else if (comparePath) {
      console.warn(`\n--compare: ${comparePath} does not exist; no comparison printed.`);
    }
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // A crashed scenario must not leave a live Chromium keeping Node alive.
    await activeBrowser?.close().catch(() => {});
    stopServer();
  });

function existsFileSync(path) {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}
