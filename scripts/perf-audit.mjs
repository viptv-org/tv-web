#!/usr/bin/env node
/**
 * VIPTV responsive-client performance audit.
 *
 * Runs the React entry under Chromium with a deterministic mocked backend and
 * image fixtures, then measures the scenarios that dominate perceived
 * snappiness: cold Home load, carousel arrow interaction latency, route
 * switches, Discover controls and a per-screen cost sweep. Artwork is served
 * through the same wsrv.nl URL shape the core image policy produces, so the
 * audit measures the real production image path (request count, decode-driven
 * layout).
 *
 * This is a gate, not a report generator. Every selector and interaction below
 * is derived from the current React screens (the emitting component is named
 * next to it) and a step that cannot find its target fails the process with the
 * selector, the screen it was on and the DOM that was actually there. The only
 * tolerated absences are listed in LEGITIMATE_ABSENCE and are recorded in the
 * report with their reason; they are never silent.
 *
 * The battery runs twice — once with prefers-reduced-motion: reduce (the cheap
 * half) and once with no-preference (the mode a real viewer gets) — so a motion
 * regression is visible instead of hiding behind the reduced-motion path.
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
const FAVORITE_COUNT = 24;
/** Carousel arrow clicks measured in a row, as before this audit was repaired. */
const CAROUSEL_STEPS = 5;
/**
 * Idle observation window on Home. Long enough for a few animation frames of
 * any entrance/hover transition to settle out of the measurement and for a
 * per-frame CSS animation to accumulate a stable rate.
 */
const IDLE_MS = 10000;

const comparePath = process.argv.includes("--compare")
  ? resolve(process.cwd(), process.argv[process.argv.indexOf("--compare") + 1])
  : null;

// ---------------------------------------------------------------------------
// DOM contract the audit depends on
// ---------------------------------------------------------------------------
/**
 * Derived from the current React entry, never guessed. Each selector names the
 * component that emits it, so a rename shows up here as a one-line diff next to
 * the component it tracks.
 *
 *   shelfSection      src/components/cards/ShelfCarousel.tsx  <section class="vx-shelf">
 *   shelfPageRight    src/components/cards/ShelfCarousel.tsx  aria-label="Scroll shelf right"
 *   shelfTrack        src/components/cards/Cards.tsx          .vx-shelf__body > .cards
 *   mediaCard         src/components/cards/Cards.tsx          .media-card
 *   navRail           src/ui/ShellNav.tsx                     <nav class="vx-rail" aria-label="Main navigation">
 *   nav-item          src/ui/ShellNav.tsx                     data-focus-id="nav-<destination>"
 *   profileCard       src/ui/Profiles.tsx                     data-focus-id="profile-0"
 *   discoverType      src/screens/BrowseScreen.tsx            id="discover-type-*" → data-focus-id
 *   discoverFilter    src/screens/BrowseScreen.tsx            id="discover-filter-*" → data-focus-id
 *   discoverGrid      src/screens/BrowseScreen.tsx + Cards    data-scroll-id="cards-result"
 *   liveMain          src/ui/Guide.tsx                        <main class="vx-live vx-live--desk">
 *   liveChannelRow    src/ui/Guide.tsx                        data-live-channel="<id>"
 *   libraryMain       src/screens/BrowseScreen.tsx            <main class="vx-browse vx-browse--library">
 *   searchMain        src/screens/BrowseScreen.tsx            <main class="vx-browse vx-browse--search">
 *   dialogScope       src/ui/TextEntry.tsx / AppDialogs.tsx   data-focus-scope="entry" | "modal"
 */
const SELECTORS = {
  homeMain: "main.vx-home",
  heroPlay: '[data-focus-id="hero-play"]',
  shelfSection: ".shelves > section.vx-shelf",
  shelfTitle: ".vx-shelf__title",
  shelfPageRight: '[aria-label="Scroll shelf right"]',
  shelfTrack: ".vx-shelf__body > .cards",
  mediaCard: ".media-card",
  navRail: 'nav[aria-label="Main navigation"]',
  profileCard: '[data-focus-id="profile-0"]',
  discoverMain: "main.vx-browse--discover",
  discoverType: '[data-focus-id^="discover-type-"]',
  discoverFilter: '[data-focus-id^="discover-filter-"]',
  discoverGrid: 'main.vx-browse--discover [data-scroll-id="cards-result"]',
  liveMain: "main.vx-live--desk",
  liveChannelRow: "main.vx-live--desk [data-live-channel]",
  libraryMain: "main.vx-browse--library",
  libraryGrid: 'main.vx-browse--library [data-scroll-id="cards-result"]',
  searchMain: "main.vx-browse--search",
  searchInput: 'main.vx-browse--search input[aria-label="Search titles"]',
  dialogScope: '[data-focus-scope="entry"], [data-focus-scope="modal"]',
};

/**
 * Absences the audit tolerates, each with the state that justifies it. Anything
 * not on this list fails the run: it means a selector or a fixture route drifted
 * away from the app instead of the app legitimately not rendering something.
 */
const LEGITIMATE_ABSENCE = {
  "no-round-trip-profile": "the stored session already selected a profile, so no chooser was drawn",
  "single-content-type": "every fixture catalog has the same type, so Discover draws one segment",
  "no-catalog-filters": "the fixture catalogs expose no filter controls",
  "carousel-exhausted": "every overflowing fixture shelf was already paged to its end",
};

// ---------------------------------------------------------------------------
// Performance gates
// ---------------------------------------------------------------------------
/**
 * Limits are per motion mode because the motion-on path is genuinely more
 * expensive. Each number came from measured runs on this host, rounded up with
 * ~2x headroom for shared-machine noise: see LIMIT_NOTES for the observation
 * each limit was derived from. They are intentionally loose enough to measure
 * the machine, not so loose they cannot fail.
 */
const LIMITS = {
  reduced: {
    coldLcpMs: 1200,
    coldTotalBlockingMs: 400,
    idleRecalcPerSecond: 12,
    idleTaskMsPerSecond: 15,
    idleFrameP95Ms: 25,
    carouselMedianMs: 120,
    carouselMaxMs: 400,
    routeMedianMs: 300,
    screenMaxLongtaskMs: 300,
    discoverSwitchMedianMs: 300,
    discoverFilterOpenMs: 200,
  },
  motion: {
    coldLcpMs: 1600,
    coldTotalBlockingMs: 700,
    idleRecalcPerSecond: 90,
    idleTaskMsPerSecond: 60,
    idleFrameP95Ms: 25,
    carouselMedianMs: 200,
    carouselMaxMs: 600,
    routeMedianMs: 500,
    screenMaxLongtaskMs: 400,
    discoverSwitchMedianMs: 500,
    discoverFilterOpenMs: 300,
  },
};
const LIMIT_NOTES = {
  coldLcpMs: "cold Home LCP; ~5x the observed value, because a cold Vite transform can spike",
  coldTotalBlockingMs: "sum of cold-load long tasks; ~2x the observed value",
  idleRecalcPerSecond: "idle style recalcs/s: reduce observed ~0, motion ~60 (one per frame); reduce fails if an animation escapes its media query, motion fails at 1.5x a single per-frame animation",
  idleTaskMsPerSecond: "idle main-thread task time/s: reduce observed ~3, motion ~25; ~5x and ~2.4x observed",
  idleFrameP95Ms: "idle frame interval p95: both modes observed 16.8ms on a 60Hz clock; 25ms fails on any sustained dropped frame",
  carouselMedianMs: "median shelf arrow click (click → track settled); ~10x the observed 8-9ms to absorb host noise",
  carouselMaxMs: "slowest shelf arrow click; ~10x the observed maximum",
  routeMedianMs: "median nav rail switch (click → target screen painted); ~6x the observed 45-48ms",
  screenMaxLongtaskMs: "worst long task during a per-screen sweep leg; observed 0ms, so this catches the first 300ms regression",
  discoverSwitchMedianMs: "Discover content-type switch, click → filtered grid painted; ~6x the observed 48ms",
  discoverFilterOpenMs: "Discover filter control, click → its dialog mounted; ~12x the observed 16ms",
};

const MOTION_MODES = [
  { key: "reduced", reducedMotion: "reduce" },
  { key: "motion", reducedMotion: "no-preference" },
];

// ---------------------------------------------------------------------------
// Failure handling
// ---------------------------------------------------------------------------
/** A structural failure: the audit could not exercise what it claims to. */
class AuditFailure extends Error {
  constructor(message) {
    super(message);
    this.name = "AuditFailure";
  }
}
/** A measured value outside its gate. */
class GateFailure extends Error {
  constructor(failures) {
    super(failures.map((f) => `${f.name}: ${f.value}${f.unit} > ${f.limit}${f.unit}`).join("; "));
    this.name = "GateFailure";
    this.failures = failures;
  }
}
/** What the page is showing right now, for a failure message worth reading. */
const describeScreen = (page) =>
  page
    .evaluate(() => ({
      screens: Array.from(document.querySelectorAll("main")).map((main) => main.className),
      renderer: document.documentElement.dataset.renderer,
      bodyText: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 200),
    }))
    .catch(() => ({ screens: [], renderer: "unknown", bodyText: "" }));

async function structuralFailure(page, scenario, message) {
  const screen = await describeScreen(page);
  throw new AuditFailure(
    `${scenario}: ${message}\n  current <main>: ${screen.screens.join(" | ") || "(none)"}` +
      `\n  renderer: ${screen.renderer}\n  body: ${screen.bodyText}`,
  );
}

/** Fails the step when the page reported a problem the audit cannot classify. */
async function requireStep(page, scenario, result, absences) {
  if (result?.ok) return result;
  const code = result?.code ?? "unknown";
  if (Object.keys(LEGITIMATE_ABSENCE).includes(code)) {
    absences.push({ scenario, code, reason: LEGITIMATE_ABSENCE[code], detail: result?.detail });
    return result;
  }
  return structuralFailure(page, scenario, `${code}${result?.detail ? ` (${result.detail})` : ""}`);
}

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
  throw new AuditFailure(`Dev server did not become reachable at ${origin}`);
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
const favorites = metasFor(4).slice(0, FAVORITE_COUNT);
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

/**
 * Installs the fixture backend on one page. `unhandled` collects every API path
 * the client asked for that the fixture does not answer: a route the app
 * outgrew, which the run reports as a failure instead of a silent 404.
 */
async function installBackend(page, unhandled) {
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
      const url = new URL(request.url());
      const path = url.pathname;
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
      if (path === "/api/profiles/1/continue/page")
        return json({ items: queue, offset: 0, total: queue.length, next_offset: null });
      if (path === "/api/profiles/1/progress" || path === "/api/profiles/1/progress/series") return json([]);
      if (path === "/api/profiles/1/favorites") return json(favorites);
      if (path === "/api/profiles/1/preferences") {
        return json({
          audio_language: "en",
          subtitle_language: "en",
          subtitles_enabled: false,
          subtitle_size: "normal",
          subtitle_style: "system",
          quality: "auto",
          autoplay: true,
        });
      }
      if (path === "/api/health") return json({ status: "ok" });
      if (path === "/api/catalogs/revision") return json({ revision: 1 });
      if (path === "/api/catalogs") return json(catalogs);
      if (path === "/api/v2/addons") return json({ items: [], next_cursor: null });
      if (path === "/api/discover") {
        const id = url.searchParams.get("catalog") ?? "";
        const index = Math.max(0, catalogs.findIndex((c) => c.id === id));
        return json({ metas: metasFor(index), has_more: false, next_skip: null });
      }
      // Live TV now reads the v2 IPTV page and per-channel guide.
      if (path === "/api/v2/iptv/live/channels")
        return json({ catalog_id: 1, generation: 1, items: liveChannels, next_cursor: null, previous_cursor: null });
      if (path === "/api/v2/iptv/live/categories")
        return json({ catalog_id: 1, generation: 1, items: [], next_cursor: null, previous_cursor: null });
      if (path.startsWith("/api/v2/iptv/guide/")) return json({ programs: [], timeline: [], timezone: "UTC" });
      if (path === "/api/meta/series/queue-series") {
        return json({
          meta: {
            id: "queue-series",
            type: "series",
            name: "Returning Series",
            poster: "https://images.metahub.space/poster-0-0.jpg",
            background: "https://images.metahub.space/backdrop-0-0.jpg",
            videos: queue.map((item) => ({
              id: item.id,
              title: item.episode_title,
              season: item.season,
              episode: item.episode,
              thumbnail: `https://episodes.metahub.space/episode-${item.episode - 1}.jpg`,
            })),
          },
        });
      }
      if (path.startsWith("/api/meta/")) {
        const parts = (path.split("/").at(-1) ?? "").split("-");
        const ci = Number(parts[1]);
        const j = Number(parts[2]);
        const list = metasFor(Number.isFinite(ci) ? ci : 0);
        return json({ meta: Number.isFinite(j) ? list[j] ?? list[0] : list[0] });
      }
      unhandled.push(`${request.method()} ${path}${url.search}`);
      return json({ error: `Unhandled fixture route ${path}` }, 404);
    } catch (error) {
      return route
        .fulfill({
          status: 500,
          headers: cors,
          contentType: "application/json",
          body: JSON.stringify({ error: String(error?.message ?? error) }),
        })
        .catch(() => {});
    }
  };
  await page.route(`${apiOrigin}/api/**`, handleApiRoute);
}

// ---------------------------------------------------------------------------
// Measurement helpers
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const round = (value) => Math.round(value * 10) / 10;
/** Frame-gap statistics for one interaction: motion cost shows up here, not in long tasks. */
function frameStats(gaps) {
  if (!gaps?.length) return { frames: 0, median: 0, p95: 0, max: 0 };
  const sorted = [...gaps].sort((a, b) => a - b);
  return {
    frames: sorted.length,
    median: round(median(sorted)),
    p95: round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]),
    max: round(sorted[sorted.length - 1]),
  };
}

function createImageTracker() {
  const images = { requests: 0, bytes: 0, lastAt: 0 };
  const pending = new Map();
  return {
    images,
    attach(cdp) {
      cdp.on("Network.requestWillBeSent", (event) => {
        const isImage = event.type === "Image" || /wsrv\.nl|metahub\.space|art\.example/.test(event.request.url);
        if (!isImage) return;
        pending.set(event.requestId, event.request.url);
        images.requests += 1;
        images.lastAt = Date.now();
      });
      cdp.on("Network.loadingFinished", (event) => {
        if (pending.delete(event.requestId)) images.bytes += event.encodedDataLength || 0;
      });
      cdp.on("Network.loadingFailed", (event) => pending.delete(event.requestId));
    },
    async quiet(quietMs, timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (Date.now() - images.lastAt >= quietMs) return;
        await sleep(100);
      }
    },
    reset() {
      images.requests = 0;
      images.bytes = 0;
      images.lastAt = 0;
      pending.clear();
    },
  };
}

async function cdpSnapshot(cdp) {
  const raw = await perfMetrics(cdp);
  const rounded = {};
  for (const key of Object.keys(raw)) rounded[key] = round(raw[key]);
  return rounded;
}
/** Unrounded Chromium performance counters (durations are seconds). */
async function perfMetrics(cdp) {
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
  return page.evaluate((S) => ({
    domNodes: document.getElementsByTagName("*").length,
    cards: document.querySelectorAll(S.mediaCard).length,
    shelves: document.querySelectorAll(S.shelfSection).length,
    longtasks: window.__perf.longtasks.slice(),
    lcp: window.__perf.lcp,
  }), SELECTORS);
}
async function clearLongtasks(page) {
  await page.evaluate(() => {
    window.__perf.longtasks.length = 0;
  });
}
const longtaskTotal = (tasks) => Math.round(tasks.reduce((sum, task) => sum + task.duration, 0));

/**
 * Idle Home workload: no input, just what the rendered page does on its own.
 * Under prefers-reduced-motion the responsive Home is expected to be calm; with
 * motion on it runs per-frame CSS animation work, which is exactly the cost the
 * reduced-motion half of this audit cannot see. Normalised per second so the
 * window length can change without moving the gate.
 */
async function measureIdle(page, cdp, durationMs) {
  await clearLongtasks(page);
  const before = await perfMetrics(cdp);
  const frames = await page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const gaps = [];
        let last = performance.now();
        const end = last + duration;
        const loop = (now) => {
          const gap = now - last;
          last = now;
          if (gap > 0 && gap < 1000) gaps.push(gap);
          if (now < end) return void requestAnimationFrame(loop);
          resolve(gaps);
        };
        requestAnimationFrame(loop);
      }),
    durationMs,
  );
  const after = await perfMetrics(cdp);
  const longtasks = await page.evaluate(() => window.__perf.longtasks.slice());
  const perSecond = (value) => round((value / durationMs) * 1000);
  return {
    seconds: round(durationMs / 1000),
    frames: frameStats(frames),
    recalcPerSecond: Math.round(((after.RecalcStyleCount - before.RecalcStyleCount) / durationMs) * 1000),
    layoutPerSecond: Math.round(((after.LayoutCount - before.LayoutCount) / durationMs) * 1000),
    taskMsPerSecond: perSecond((after.TaskDuration - before.TaskDuration) * 1000),
    scriptMsPerSecond: perSecond((after.ScriptDuration - before.ScriptDuration) * 1000),
    recalcMsPerSecond: perSecond((after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000),
    longtaskCount: longtasks.length,
    longtaskMs: longtaskTotal(longtasks),
  };
}

/**
 * One shelf arrow click: finds the shelf's right chevron, clicks it, and
 * measures until the `.cards` track stops moving (scrollend, 8 stable frames,
 * or a 4s timeout that the caller treats as a failure).
 */
const carouselStep = (page, shelfIndex) =>
  page.evaluate(
    ({ shelfIndex, S }) =>
      new Promise((resolve) => {
        const title = (shelf) => shelf?.querySelector(S.shelfTitle)?.textContent?.trim() ?? "(untitled)";
        const shelves = Array.from(document.querySelectorAll(S.shelfSection));
        const shelf = shelves[shelfIndex];
        if (!shelf) return resolve({ ok: false, code: "shelf-missing", detail: `shelf ${shelfIndex} of ${shelves.length}` });
        const button = shelf.querySelector(S.shelfPageRight);
        if (!button) return resolve({ ok: false, code: "page-control-missing", detail: `shelf "${title(shelf)}"` });
        if (button.disabled) return resolve({ ok: false, code: "page-control-disabled", detail: `shelf "${title(shelf)}"` });
        const track = shelf.querySelector(S.shelfTrack);
        if (!track) return resolve({ ok: false, code: "track-missing", detail: `shelf "${title(shelf)}"` });
        const start = performance.now();
        const startLeft = track.scrollLeft;
        const gaps = [];
        let last = start;
        let frame = 0;
        let settled = false;
        let stable = 0;
        let lastLeft = startLeft;
        const finish = (reason) => {
          if (settled) return;
          settled = true;
          if (frame) cancelAnimationFrame(frame);
          track.removeEventListener("scrollend", onScrollEnd);
          resolve({
            ok: true,
            ms: Math.round(performance.now() - start),
            reason,
            shelf: title(shelf),
            scrollLeft: Math.round(track.scrollLeft),
            movedBy: Math.round(track.scrollLeft - startLeft),
            gaps,
          });
        };
        const onScrollEnd = () => finish("scrollend");
        track.addEventListener("scrollend", onScrollEnd, { once: true });
        const loop = (now) => {
          if (settled) return;
          const gap = now - last;
          last = now;
          if (gap > 0 && gap < 1000) gaps.push(gap);
          if (Math.abs(track.scrollLeft - lastLeft) < 1) {
            if (++stable >= 8) return finish("stable");
          } else {
            stable = 0;
            lastLeft = track.scrollLeft;
          }
          frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
        setTimeout(() => finish("timeout"), 4000);
        button.click();
      }),
    { shelfIndex, S: SELECTORS },
  );

/**
 * One rail navigation: clicks the destination's rail item and measures until
 * its marker is on screen. A missing rail item or marker is drift, and the
 * caller fails on it.
 */
const navStep = (page, label, marker) =>
  page.evaluate(
    ({ label, marker, S }) =>
      new Promise((resolve) => {
        const selector = `${S.navRail} [data-focus-id="nav-${label}"]`;
        const matches = document.querySelectorAll(selector);
        if (matches.length !== 1) return resolve({ ok: false, code: "nav-item-missing", detail: `${selector} matched ${matches.length}` });
        const button = matches[0];
        const start = performance.now();
        const gaps = [];
        let last = start;
        let frame = 0;
        let settled = false;
        const loop = (now) => {
          if (settled) return;
          const gap = now - last;
          last = now;
          if (gap > 0 && gap < 1000) gaps.push(gap);
          frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
        const stop = (payload) => {
          if (settled) return;
          settled = true;
          cancelAnimationFrame(frame);
          resolve({ ...payload, ms: Math.round(performance.now() - start), gaps });
        };
        button.click();
        const deadline = start + 10000;
        const check = () => {
          if (settled) return;
          if (document.querySelector(marker)) {
            requestAnimationFrame(() => requestAnimationFrame(() => stop({ ok: true })));
            return;
          }
          if (performance.now() > deadline) return stop({ ok: false, code: "marker-missing", detail: `${marker} never appeared` });
          setTimeout(check, 16);
        };
        check();
      }),
    { label, marker, S: SELECTORS },
  );

/** Discover content-type segment: click it and wait for the filtered grid. */
const discoverTypeStep = (page) =>
  page.evaluate(
    ({ S }) =>
      new Promise((resolve) => {
        const segments = Array.from(document.querySelectorAll(S.discoverType));
        if (!segments.length) return resolve({ ok: false, code: "discover-type-missing", detail: S.discoverType });
        const target = segments.find((segment) => segment.getAttribute("aria-pressed") !== "true");
        if (!target) return resolve({ ok: false, code: "single-content-type", detail: `${segments.length} segment(s)` });
        const label = target.dataset.focusId;
        const start = performance.now();
        const gaps = [];
        let last = start;
        let frame = 0;
        let settled = false;
        const loop = (now) => {
          if (settled) return;
          const gap = now - last;
          last = now;
          if (gap > 0 && gap < 1000) gaps.push(gap);
          frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
        const stop = (payload) => {
          if (settled) return;
          settled = true;
          cancelAnimationFrame(frame);
          resolve({ ...payload, label, ms: Math.round(performance.now() - start), gaps });
        };
        target.click();
        const deadline = start + 10000;
        const check = () => {
          if (settled) return;
          const pressed = document.querySelector(`[data-focus-id="${label}"][aria-pressed="true"]`);
          const grid = document.querySelector(S.discoverGrid);
          if (pressed && grid) {
            requestAnimationFrame(() => requestAnimationFrame(() => stop({ ok: true, cards: grid.querySelectorAll(S.mediaCard).length })));
            return;
          }
          if (performance.now() > deadline) return stop({ ok: false, code: "discover-switch-timeout", detail: `${label} never became active` });
          setTimeout(check, 16);
        };
        check();
      }),
    { S: SELECTORS },
  );

/** Discover filter chip: open its dialog/popover, then close it again. */
async function discoverFilterStep(page) {
  const result = await page.evaluate(
    ({ S }) =>
      new Promise((resolve) => {
        const chips = Array.from(document.querySelectorAll(S.discoverFilter));
        if (!chips.length) return resolve({ ok: false, code: "no-catalog-filters", detail: S.discoverFilter });
        const chip = chips[0];
        const label = chip.dataset.focusId;
        const start = performance.now();
        chip.click();
        const deadline = start + 10000;
        const check = () => {
          if (document.querySelector(S.dialogScope)) {
            return resolve({ ok: true, label, ms: Math.round(performance.now() - start) });
          }
          if (performance.now() > deadline) return resolve({ ok: false, code: "filter-dialog-missing", detail: `${label} opened nothing` });
          setTimeout(check, 16);
        };
        check();
      }),
    { S: SELECTORS },
  );
  if (!result.ok) return result;
  const closedAt = Date.now();
  await page.keyboard.press("Escape");
  try {
    await page.locator(SELECTORS.dialogScope).first().waitFor({ state: "detached", timeout: 5000 });
  } catch {
    return { ok: false, code: "filter-dialog-stuck", detail: `${result.label} stayed open after Escape` };
  }
  return { ...result, closeMs: Date.now() - closedAt };
}

// ---------------------------------------------------------------------------
// One audit pass, per motion mode
// ---------------------------------------------------------------------------
const pageErrors = [];
let activeBrowser = null;

async function measurePass(mode) {
  const browser = activeBrowser;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: mode.reducedMotion });
  context.setDefaultTimeout(15000);
  const page = await context.newPage();
  const modeErrors = [];
  page.on("pageerror", (error) => {
    modeErrors.push(error.message);
    pageErrors.push(`[${mode.key}] ${error.message}`);
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Performance.enable");
  const images = createImageTracker();
  images.attach(cdp);
  const unhandled = [];
  await installBackend(page, unhandled);
  state.selectedProfileId = null;
  const absences = [];
  const log = (message) => console.log(`[perf:${mode.key}] ${message}`);

  // The platform must honour the motion preference we asked for, or every
  // number below is labelled wrong.
  const motionMatches = await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (motionMatches !== (mode.reducedMotion === "reduce")) {
    await context.close();
    throw new AuditFailure(
      `[${mode.key}] prefers-reduced-motion evaluated to ${motionMatches}; the context requested ${mode.reducedMotion}`,
    );
  }

  const signIn = async (scenario) => {
    // The chooser is drawn only when the stored session has no profile, and the
    // Home shelf appears straight away when it does. Wait for whichever arrives
    // instead of racing a bare count() against React's first commit.
    const chooser = page.locator(SELECTORS.profileCard);
    const home = page.locator(`${SELECTORS.shelfSection} ${SELECTORS.mediaCard}`);
    try {
      await Promise.race([
        chooser.first().waitFor({ timeout: 30000 }),
        home.first().waitFor({ timeout: 30000 }),
      ]);
    } catch {
      await structuralFailure(page, scenario, `neither the profile chooser (${SELECTORS.profileCard}) nor Home appeared`);
    }
    const count = await chooser.count();
    if (count === 1) {
      await chooser.first().click();
      return "chooser";
    }
    if (count > 1) await structuralFailure(page, scenario, `${SELECTORS.profileCard} matched ${count} profile cards`);
    absences.push({ scenario, code: "no-round-trip-profile", reason: LEGITIMATE_ABSENCE["no-round-trip-profile"] });
    return "stored";
  };
  const waitForHome = async (scenario) => {
    try {
      await page.locator(`${SELECTORS.shelfSection} ${SELECTORS.mediaCard}`).first().waitFor({ timeout: 30000 });
    } catch {
      await structuralFailure(page, scenario, `Home never drew a card inside ${SELECTORS.shelfSection}`);
    }
    if ((await page.locator(SELECTORS.homeMain).count()) !== 1)
      await structuralFailure(page, scenario, `${SELECTORS.homeMain} was not exactly one element`);
  };

  // Warmup pass: compiles vite modules so the measured cold load is not
  // dominated by first-request transform latency. The second context inherits
  // the same dev server, so it only needs the module graph touched once.
  await page.goto(origin);
  await signIn("warmup");
  await waitForHome("warmup");
  await sleep(600);
  log("warmup complete");

  // ---- Cold Home -----------------------------------------------------------
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
    } catch {
      /* leave the stored session untouched */
    }
  }, { key: `viptv-device:${apiOrigin}` });
  images.reset();
  const metricsBase = await cdpSnapshot(cdp);
  await page.goto(origin);
  await signIn("cold Home");
  await waitForHome("cold Home");
  await images.quiet(800, 20000);
  const coldPage = await pageSnapshot(page);
  const coldMetrics = await cdpSnapshot(cdp);
  if (coldPage.cards === 0) await structuralFailure(page, "cold Home", `${SELECTORS.mediaCard} never rendered`);
  if (coldPage.shelves === 0) await structuralFailure(page, "cold Home", `${SELECTORS.shelfSection} never rendered`);
  const coldHome = {
    domNodes: coldPage.domNodes,
    cards: coldPage.cards,
    shelves: coldPage.shelves,
    lcp: coldPage.lcp,
    longtasks: coldPage.longtasks,
    longtaskCount: coldPage.longtasks.length,
    totalBlockingTime: longtaskTotal(coldPage.longtasks),
    imageRequests: images.images.requests,
    imageBytes: images.images.bytes,
    heapMB: round((coldMetrics.JSHeapUsedSize - metricsBase.JSHeapUsedSize) / 1048576),
    layout: delta(coldMetrics, metricsBase),
  };
  log(
    `cold home: lcp=${coldHome.lcp}ms longtasks=${coldHome.longtaskCount}/${coldHome.totalBlockingTime}ms ` +
      `dom=${coldHome.domNodes} cards=${coldHome.cards} shelves=${coldHome.shelves} images=${coldHome.imageRequests}`,
  );

  // ---- Idle Home -----------------------------------------------------------
  const idle = await measureIdle(page, cdp, IDLE_MS);
  log(
    `idle ${idle.seconds}s: recalc=${idle.recalcPerSecond}/s layout=${idle.layoutPerSecond}/s ` +
      `task=${idle.taskMsPerSecond}ms/s frame p95=${idle.frames.p95}ms longtasks=${idle.longtaskCount}`,
  );

  // ---- Carousel ------------------------------------------------------------
  // Five arrow clicks, continuing on the next overflowing shelf when the
  // current one reaches its end (an exhausted shelf disables its chevron; that
  // is a fixture-scale limit, not drift, and is recorded as such).
  const clicks = [];
  const shelvedOut = [];
  let shelfIndex = 0;
  const imagesBeforeCarousel = images.images.requests;
  const metricsBeforeCarousel = await cdpSnapshot(cdp);
  while (clicks.length < CAROUSEL_STEPS && shelfIndex < 20) {
    await clearLongtasks(page);
    const step = await carouselStep(page, shelfIndex);
    if (!step.ok) {
      if (step.code === "page-control-disabled") {
        shelvedOut.push(step.detail ?? `shelf ${shelfIndex}`);
        shelfIndex += 1;
        continue;
      }
      if (step.code === "shelf-missing") {
        absences.push({ scenario: "carousel", code: "carousel-exhausted", reason: LEGITIMATE_ABSENCE["carousel-exhausted"] });
        break;
      }
      await requireStep(page, "carousel", step, absences);
    }
    if (step.reason === "timeout") await structuralFailure(page, "carousel", `shelf "${step.shelf}" never settled after a right click`);
    if (Math.abs(step.movedBy) < 8) await structuralFailure(page, "carousel", `shelf "${step.shelf}" reported an enabled right control but did not scroll`);
    const longtasks = await page.evaluate(() => window.__perf.longtasks.slice());
    clicks.push({ ...step, frames: frameStats(step.gaps), longtaskMs: longtaskTotal(longtasks) });
    log(`carousel ${clicks.length}: ${step.ms}ms (${step.reason}) shelf "${step.shelf}" +${step.movedBy}px frames=${frameStats(step.gaps).median}ms/median`);
    await sleep(300);
  }
  if (clicks.length < CAROUSEL_STEPS)
    await structuralFailure(page, "carousel", `only ${clicks.length}/${CAROUSEL_STEPS} steps could run (shelves exhausted: ${shelvedOut.join(", ") || "none"})`);
  const metricsAfterCarousel = await cdpSnapshot(cdp);
  const carousel = {
    clicks: clicks.map(({ gaps, ...rest }) => rest),
    medianMs: median(clicks.map((c) => c.ms)),
    maxMs: Math.max(...clicks.map((c) => c.ms)),
    medianFrameMs: round(median(clicks.map((c) => c.frames.median))),
    shelvesExhausted: shelvedOut,
    imageRequestsDuring: images.images.requests - imagesBeforeCarousel,
    layout: delta(metricsAfterCarousel, metricsBeforeCarousel),
  };

  // ---- Route switches ------------------------------------------------------
  const routes = [];
  for (const { label, marker } of [
    { label: "Discover", marker: SELECTORS.discoverType },
    { label: "Home", marker: `${SELECTORS.shelfSection} ${SELECTORS.mediaCard}` },
  ]) {
    await clearLongtasks(page);
    const before = await cdpSnapshot(cdp);
    const leg = await navStep(page, label, marker);
    await requireStep(page, `route ${label}`, leg, absences);
    await sleep(400);
    const longtasks = await page.evaluate(() => window.__perf.longtasks.slice());
    const after = await cdpSnapshot(cdp);
    routes.push({
      label,
      ms: leg.ms,
      frames: frameStats(leg.gaps),
      longtaskCount: longtasks.length,
      longtaskMs: longtaskTotal(longtasks),
      layout: delta(after, before),
    });
    log(`route ${label}: ${leg.ms}ms frames=${frameStats(leg.gaps).median}ms/median`);
  }

  // ---- Discover controls ---------------------------------------------------
  // Back to Discover for the control interactions (the route legs above end on
  // Home). Prep steps are still fail-loud, they are just not measured legs.
  if (!(await page.locator(SELECTORS.discoverMain).count())) {
    const back = await navStep(page, "Discover", SELECTORS.discoverType);
    await requireStep(page, "discover prep", back, absences);
  }
  const discoverBefore = await pageSnapshot(page);
  if (discoverBefore.cards === 0) await structuralFailure(page, "discover", `no grid cards inside ${SELECTORS.discoverGrid}`);
  const typeSwitch = await discoverTypeStep(page);
  if (typeSwitch.ok) {
    await sleep(300);
    log(`discover type ${typeSwitch.label}: ${typeSwitch.ms}ms cards=${typeSwitch.cards}`);
  } else await requireStep(page, "discover type", typeSwitch, absences);
  const typeSwitchTwo = typeSwitch.ok ? await discoverTypeStep(page) : typeSwitch;
  if (typeSwitchTwo.ok) await sleep(300);
  else if (typeSwitch.ok) await requireStep(page, "discover type (second)", typeSwitchTwo, absences);
  const filterStep = await discoverFilterStep(page);
  if (filterStep.ok) log(`discover filter ${filterStep.label}: open ${filterStep.ms}ms close ${filterStep.closeMs}ms`);
  else await requireStep(page, "discover filter", filterStep, absences);
  const discover = {
    typeSwitches: [typeSwitch, typeSwitchTwo].filter((step) => step.ok).map(({ gaps, ...rest }) => rest),
    filter: filterStep.ok ? (({ ...rest }) => rest)(filterStep) : { skipped: filterStep.code, reason: LEGITIMATE_ABSENCE[filterStep.code] },
    cards: discoverBefore.cards,
  };

  // ---- Per-screen sweep ----------------------------------------------------
  const screens = [];
  for (const { label, marker } of [
    { label: "Live TV", marker: SELECTORS.liveChannelRow },
    { label: "My List", marker: SELECTORS.libraryGrid },
    { label: "Search", marker: SELECTORS.searchMain },
  ]) {
    await clearLongtasks(page);
    const imagesBefore = images.images.requests;
    const before = await cdpSnapshot(cdp);
    const pageBefore = await pageSnapshot(page);
    const leg = await navStep(page, label, marker);
    await requireStep(page, `screen ${label}`, leg, absences);
    await images.quiet(700, 8000);
    const longtasks = await page.evaluate(() => window.__perf.longtasks.slice());
    const after = await cdpSnapshot(cdp);
    const pageAfter = await pageSnapshot(page);
    screens.push({
      label,
      ms: leg.ms,
      frames: frameStats(leg.gaps),
      longtaskCount: longtasks.length,
      longtaskMs: longtaskTotal(longtasks),
      domNodes: pageAfter.domNodes,
      domNodeDelta: pageAfter.domNodes - pageBefore.domNodes,
      imageRequests: images.images.requests - imagesBefore,
      layout: delta(after, before),
    });
    log(`screen ${label}: ${leg.ms}ms dom=${pageAfter.domNodes} longtasks=${longtasks.length}`);
  }

  // ---- Back home -----------------------------------------------------------
  const homeReturn = await navStep(page, "Home", `${SELECTORS.shelfSection} ${SELECTORS.mediaCard}`);
  await requireStep(page, "route Home (return)", homeReturn, absences);

  await context.close();
  return {
    mode: mode.key,
    reducedMotion: mode.reducedMotion,
    coldHome,
    idle,
    carousel,
    routes,
    discover,
    screens,
    absences,
    pageErrors: modeErrors,
    unhandledRoutes: [...new Set(unhandled)],
  };
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------
function evaluateGates(results) {
  const checks = [];
  const check = (mode, name, value, unit) => {
    const limit = LIMITS[mode]?.[name];
    if (limit === undefined) return;
    checks.push({ mode, name, value, unit, limit, pass: value <= limit });
  };
  for (const report of results) {
    const mode = report.mode;
    check(mode, "coldLcpMs", report.coldHome.lcp, "ms");
    check(mode, "coldTotalBlockingMs", report.coldHome.totalBlockingTime, "ms");
    check(mode, "idleRecalcPerSecond", report.idle.recalcPerSecond, "/s");
    check(mode, "idleTaskMsPerSecond", report.idle.taskMsPerSecond, "ms/s");
    check(mode, "idleFrameP95Ms", report.idle.frames.p95, "ms");
    check(mode, "carouselMedianMs", report.carousel.medianMs, "ms");
    check(mode, "carouselMaxMs", report.carousel.maxMs, "ms");
    check(mode, "routeMedianMs", median(report.routes.map((r) => r.ms)), "ms");
    check(mode, "screenMaxLongtaskMs", Math.max(...report.screens.map((s) => s.longtaskMs)), "ms");
    const switches = report.discover.typeSwitches.map((s) => s.ms).filter((ms) => typeof ms === "number");
    if (switches.length) check(mode, "discoverSwitchMedianMs", median(switches), "ms");
    if (typeof report.discover.filter.ms === "number") check(mode, "discoverFilterOpenMs", report.discover.filter.ms, "ms");
    if (report.unhandledRoutes.length)
      checks.push({
        mode,
        name: "fixtureRoutesCovered",
        value: report.unhandledRoutes.length,
        unit: "",
        limit: 0,
        pass: false,
        detail: report.unhandledRoutes,
      });
    if (report.pageErrors.length)
      checks.push({ mode, name: "pageErrors", value: report.pageErrors.length, unit: "", limit: 0, pass: false, detail: report.pageErrors });
  }
  return checks;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
function summarize(report) {
  const lines = [];
  for (const pass of report.passes) {
    const { coldHome, carousel, routes, discover, screens } = pass;
    lines.push(`— ${pass.mode} (prefers-reduced-motion: ${pass.reducedMotion}) —`);
    lines.push(
      `Cold Home: LCP ${coldHome.lcp}ms, long tasks ${coldHome.longtaskCount} (${coldHome.totalBlockingTime}ms total), ` +
        `DOM ${coldHome.domNodes} nodes, cards ${coldHome.cards} across ${coldHome.shelves} shelves, ` +
        `images ${coldHome.imageRequests} requests, heap +${coldHome.heapMB}MB`,
    );
    lines.push(
      `Idle ${pass.idle.seconds}s after cold Home: style recalcs ${pass.idle.recalcPerSecond}/s, layouts ${pass.idle.layoutPerSecond}/s, ` +
        `main-thread tasks ${pass.idle.taskMsPerSecond}ms/s, frame p95 ${pass.idle.frames.p95}ms, long tasks ${pass.idle.longtaskCount}`,
    );
    lines.push(
      `Carousel right (${carousel.clicks.length} clicks): median ${round(carousel.medianMs)}ms, max ${round(carousel.maxMs)}ms` +
        (carousel.medianFrameMs > 0 ? `, median frame ${carousel.medianFrameMs}ms` : ", settled inside one frame") +
        ` — [${carousel.clicks.map((c) => `${c.ms}ms`).join(", ")}], ` +
        `images during ${carousel.imageRequestsDuring}, layout count ${carousel.layout.LayoutCount}`,
    );
    for (const leg of routes) lines.push(`Route ${leg.label}: ${leg.ms}ms (long tasks ${leg.longtaskCount}/${leg.longtaskMs}ms, frames ${leg.frames.median}ms median)`);
    lines.push(
      `Discover: ${discover.typeSwitches.length} type switch(es) ` +
        `[${discover.typeSwitches.map((s) => `${s.label} ${s.ms}ms`).join(", ")}], ` +
        (typeof discover.filter.ms === "number"
          ? `filter ${discover.filter.label} opens in ${discover.filter.ms}ms, closes in ${discover.filter.closeMs}ms`
          : `filter skipped (${discover.filter.reason})`) +
        `, grid cards ${discover.cards}`,
    );
    for (const screen of screens)
      lines.push(
        `Screen ${screen.label}: ${screen.ms}ms, DOM ${screen.domNodes} (${screen.domNodeDelta >= 0 ? "+" : ""}${screen.domNodeDelta}), ` +
          `long tasks ${screen.longtaskCount}/${screen.longtaskMs}ms, frames ${screen.frames.median}ms median, images ${screen.imageRequests}`,
      );
    if (pass.absences.length)
      lines.push(`Recorded absences: ${pass.absences.map((a) => `${a.code} (${a.reason})`).join("; ")}`);
    const top = [...coldHome.longtasks].sort((a, b) => b.duration - a.duration).slice(0, 3);
    if (top.length) lines.push("Top cold-load long tasks: " + top.map((t) => `${t.duration}ms @ ${t.start}ms`).join(", "));
  }

  const reduced = report.passes.find((pass) => pass.mode === "reduced");
  const motion = report.passes.find((pass) => pass.mode === "motion");
  if (reduced && motion) {
    const ratio = (a, b) => (a ? round(b / a) : 0);
    lines.push("— motion cost (no-preference vs reduce) —");
    lines.push(
      `carousel median ${round(reduced.carousel.medianMs)}ms → ${round(motion.carousel.medianMs)}ms (${ratio(reduced.carousel.medianMs, motion.carousel.medianMs)}x), ` +
        `route median ${round(median(reduced.routes.map((r) => r.ms)))}ms → ${round(median(motion.routes.map((r) => r.ms)))}ms, ` +
        `cold LCP ${reduced.coldHome.lcp}ms → ${motion.coldHome.lcp}ms`,
    );
    lines.push(
      `idle main-thread tasks ${reduced.idle.taskMsPerSecond}ms/s → ${motion.idle.taskMsPerSecond}ms/s ` +
        `(${ratio(reduced.idle.taskMsPerSecond, motion.idle.taskMsPerSecond)}x), ` +
        `style recalcs ${reduced.idle.recalcPerSecond}/s → ${motion.idle.recalcPerSecond}/s`,
    );
  }
  lines.push("— gates —");
  for (const gate of report.gates)
    lines.push(
      `${gate.pass ? "PASS" : "FAIL"} ${gate.mode}/${gate.name}: ${gate.value}${gate.unit} (limit ${gate.limit}${gate.unit})` +
        (gate.detail ? ` ${JSON.stringify(gate.detail)}` : ""),
    );
  return lines;
}

function compareReports(baseline, current) {
  const lines = [];
  const pairs = [
    ["cold LCP", (r) => r.coldHome.lcp, "ms"],
    ["cold total long tasks", (r) => r.coldHome.totalBlockingTime, "ms"],
    ["cold image requests", (r) => r.coldHome.imageRequests, ""],
    ["cold DOM nodes", (r) => r.coldHome.domNodes, ""],
    ["idle tasks", (r) => r.idle.taskMsPerSecond, "ms/s"],
    ["idle style recalcs", (r) => r.idle.recalcPerSecond, "/s"],
    ["carousel median", (r) => r.carousel.medianMs, "ms"],
    ["carousel images during", (r) => r.carousel.imageRequestsDuring, ""],
  ];
  for (const pass of current.passes) {
    const before = baseline.passes?.find((candidate) => candidate.mode === pass.mode);
    lines.push(`${pass.mode}:`);
    if (!before) {
      lines.push("  (baseline has no comparable mode)");
      continue;
    }
    for (const [name, read, unit] of pairs) {
      const change = round(read(pass) - read(before));
      lines.push(`  ${name}: ${read(before)}${unit} -> ${read(pass)}${unit} (${change >= 0 ? "+" : ""}${change}${unit})`);
    }
    const routeBefore = median(before.routes.map((r) => r.ms));
    const routeAfter = median(pass.routes.map((r) => r.ms));
    lines.push(`  route median: ${routeBefore}ms -> ${routeAfter}ms (${round(routeAfter - routeBefore)}ms)`);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Audit run
// ---------------------------------------------------------------------------
async function run() {
  await ensureServer();
  console.log("[perf] dev server ready");
  const browser = await chromium.launch();
  activeBrowser = browser;
  const passes = [];
  try {
    for (const mode of MOTION_MODES) {
      console.log(`[perf] measuring ${mode.key} (prefers-reduced-motion: ${mode.reducedMotion})`);
      passes.push(await measurePass(mode));
    }
  } finally {
    await browser.close().catch(() => {});
    activeBrowser = null;
  }
  const gates = evaluateGates(passes);
  return { passes, gates };
}

run()
  .then(({ passes, gates }) => {
    const report = {
      meta: {
        timestamp: new Date().toISOString(),
        url: origin,
        viewport: "1440x900",
        fixture: { catalogs: CATALOG_COUNT, itemsPerCatalog: ITEMS_PER_CATALOG, queue: QUEUE_COUNT, favorites: FAVORITE_COUNT },
        carouselSteps: CAROUSEL_STEPS,
        limits: LIMITS,
        pageErrors,
      },
      passes,
      gates,
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
    const failures = gates.filter((gate) => !gate.pass);
    if (failures.length) {
      console.error(`\n${failures.length} performance gate(s) failed:`);
      for (const gate of failures) console.error(`  ${gate.mode}/${gate.name}: ${gate.value}${gate.unit} > ${gate.limit}${gate.unit}`);
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    // A structural failure is the point of the gate: say what could not be
    // measured, then leave non-zero so CI cannot pass on a silent no-op.
    console.error(`\n${error instanceof AuditFailure || error instanceof GateFailure ? "AUDIT FAILED" : "AUDIT ERROR"}: ${error.message}`);
    if (!(error instanceof AuditFailure || error instanceof GateFailure) && error?.stack) console.error(error.stack);
    if (pageErrors.length) console.error(`Page errors: ${JSON.stringify(pageErrors)}`);
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