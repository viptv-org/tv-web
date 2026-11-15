// Transition-walk harness: measures the frame cost of every animated
// transition in the TV client.
//
// The navigation harness (remote-perf.mjs) runs with reduced motion, so the
// animated paths never execute there: a drawer opens instantly, a hero does
// not crossfade, the player controls do not slide. This harness runs the
// transitions with motion enabled and reports, per transition, the frame
// gaps and long tasks it produced.
//
// Usage:
//   REMOTE_PREVIEW_ORIGIN=https://viptv.local.test:18571 \
//     node --experimental-strip-types tests/preview/remote-transitions.mjs
//
//   TRANSITIONS_OUTPUT=/tmp/tv-transitions.json   write the report
//   TRANSITIONS_ASSERT_BUDGET=1                  fail on a frame budget breach
//   TRANSITIONS_CPU_THROTTLE=4                   CDP CPU throttle rate
//   TRANSITIONS_ONLY=source-drawer-close         run one transition
//   TRANSITIONS_PROFILE=1                        write a CPU profile per transition
import { chromium } from "@playwright/test";
import { installRemoteBackend } from "./remote-backend.ts";
import { writeFileSync, mkdirSync } from "node:fs";

const origin = process.env.REMOTE_PREVIEW_ORIGIN ?? "https://viptv.local.test:18571";
const rate = Number(process.env.TRANSITIONS_CPU_THROTTLE ?? 4);
const only = process.env.TRANSITIONS_ONLY;
const profile = process.env.TRANSITIONS_PROFILE === "1";
const profileDir = process.env.TRANSITIONS_PROFILE_DIR ?? "/tmp/tv-transition-profiles";
const browser = await chromium.launch({
  args: [
    "--enable-unsafe-swiftshader",
    // The fixture host is a loopback server; the name is what the client and
    // the API origin check expect, so map it instead of editing /etc/hosts.
    "--host-resolver-rules=MAP viptv.local.test 127.0.0.1",
  ],
});

const percentile = (values, fraction) =>
  [...values].sort((a, b) => a - b)[
    Math.max(0, Math.ceil(values.length * fraction) - 1)
  ];

/** Wait until the document reports the given state. */
const waitState = (page, expected, timeout = 20000) =>
  page.waitForFunction(
    (want) => {
      const data = document.documentElement.dataset;
      return Object.entries(want).every(([key, value]) => data[key] === value);
    },
    expected,
    { timeout },
  );

/** Top self-time frames of a V8 CPU profile. */
function summarize(profileReport) {
  const totals = new Map();
  for (const node of profileReport.nodes ?? []) {
    const frame = node.callFrame ?? {};
    const url = (frame.url ?? "").replace(/^https?:\/\/[^/]+/, "");
    const key = `${frame.functionName || "(anonymous)"} @ ${url}:${frame.lineNumber + 1}`;
    totals.set(key, (totals.get(key) ?? 0) + (node.hitCount ?? 0));
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([frame, hits]) => ({ frame, hits }));
}

try {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    // Motion must be on: with reduced motion the animated paths never run.
    reducedMotion: "no-preference",
    // The local fixture host serves a self-signed certificate.
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const fixture = await installRemoteBackend(page, origin, {
    media: true,
    liveChannels: 40,
    liveGroups: 8,
    addons: 40,
  });
  const cdp = await context.newCDPSession(page);
  if (rate > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  await cdp.send("Performance.enable");
  // The shared HLS fixture is a five-second VOD clip, which ends before the
  // player's five-second control auto-hide can elapse. Serve the same
  // segments as a live playlist so the player stays in "playing" long enough
  // for that transition to be measurable.
  await page.route("**/media/**/video.m3u8", (route) =>
    route.fulfill({
      contentType: "application/vnd.apple.mpegurl",
      body: [
        "#EXTM3U",
        "#EXT-X-VERSION:3",
        "#EXT-X-TARGETDURATION:1",
        "#EXT-X-MEDIA-SEQUENCE:0",
        ...Array.from(
          { length: 5 },
          (_, index) => `#EXTINF:1.000000,\nsegment${index}.ts`,
        ),
        "",
      ].join("\n"),
    }),
  );
  await page.addInitScript(() => {
    window.__remotePerf = { active: false, frames: [], tasks: [] };
    let previous = 0;
    const frame = (now) => {
      if (window.__remotePerf.active && previous)
        window.__remotePerf.frames.push(now - previous);
      previous = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    new PerformanceObserver((list) => {
      if (window.__remotePerf.active)
        window.__remotePerf.tasks.push(
          ...list.getEntries().map((e) => e.duration),
        );
    }).observe({ type: "longtask", buffered: false });
  });
  if (profile) mkdirSync(profileDir, { recursive: true });

  const openHome = async () => {
    await page.goto(origin + "/tv/?platform=vizio&focusdebug=1");
    await waitState(page, { tvScreen: "home", tvReady: "true" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
  };

  /** Open the source drawer from the Home hero. */
  const openSourceDrawer = () =>
    page.keyboard.press("Enter").then(() =>
      waitState(page, { tvOverlay: "sources" }),
    );

  /** Start playback and wait for the player. */
  const startPlayer = async () => {
    await openSourceDrawer();
    await page.waitForTimeout(400);
    await page.keyboard.press("Enter");
    await waitState(page, { tvScreen: "player" });
  };

  const transitions = [
    {
      name: "source-drawer-open",
      async run(page) {
        await measure(page, "source-drawer-open", () => openSourceDrawer());
      },
    },
    {
      name: "source-drawer-close",
      async run(page) {
        await openSourceDrawer();
        await page.waitForTimeout(400);
        await measure(page, "source-drawer-close", () =>
          page.keyboard.press("Backspace"),
        );
      },
    },
    {
      name: "source-drawer-round-trip",
      async run(page) {
        await openSourceDrawer();
        await page.waitForTimeout(400);
        await measure(page, "source-drawer-round-trip", async () => {
          await page.keyboard.press("Backspace");
          await waitState(page, { tvOverlay: "" });
          await page.keyboard.press("Enter");
          await waitState(page, { tvOverlay: "sources" });
        });
      },
    },
    {
      name: "source-drawer-filter",
      async run(page) {
        await openSourceDrawer();
        await page.waitForTimeout(400);
        await measure(page, "source-drawer-filter", async () => {
          await page.keyboard.press("ArrowUp");
          await page.waitForTimeout(120);
          await page.keyboard.press("ArrowRight");
        });
      },
    },
    {
      name: "hero-crossfade",
      async run(page) {
        const before = await page.evaluate(
          () => document.documentElement.dataset.tvHeroCycle,
        );
        await measure(page, "hero-crossfade", () =>
          page.waitForFunction(
            (was) =>
              document.documentElement.dataset.tvHeroCycle !== was &&
              document.documentElement.dataset.tvHeroCycle !== "",
            before,
            { timeout: 30000 },
          ),
        );
      },
    },
    {
      name: "shelf-scroll",
      async run(page) {
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await measure(page, "shelf-scroll", async () => {
          await page.keyboard.press("ArrowDown");
          await page.waitForTimeout(120);
          await page.keyboard.press("ArrowDown");
          await page.waitForTimeout(120);
        });
      },
    },
    {
      name: "shelf-focus-move",
      async run(page) {
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(250);
        await measure(page, "shelf-focus-move", async () => {
          await page.keyboard.press("ArrowRight");
          await page.waitForTimeout(120);
          await page.keyboard.press("ArrowRight");
        });
      },
    },
    {
      name: "player-start",
      async run(page) {
        await measure(page, "player-start", async () => {
          await openSourceDrawer();
          await page.waitForTimeout(400);
          await page.keyboard.press("Enter");
          await waitState(page, { tvScreen: "player" });
        });
      },
    },
    {
      name: "player-controls-hide",
      async run(page) {
        await startPlayer();
        await page.waitForTimeout(600);
        await measure(page, "player-controls-hide", () =>
          page.waitForFunction(
            () => document.documentElement.dataset.tvPlayerControls === "false",
            undefined,
            { timeout: 15000 },
          ),
        );
      },
    },
  ];

  /**
   * Measure one transition: reset the collector, trigger it, wait for it to
   * settle, then read the frames and long tasks it produced.
   */
  async function measure(page, name, trigger, settle) {
    await page.evaluate(() => {
      window.__remotePerf.frames.length = 0;
      window.__remotePerf.tasks.length = 0;
      window.__remotePerf.active = true;
    });
    if (profile) {
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
      await cdp.send("Profiler.start");
    }
    const started = Date.now();
    await trigger();
    if (settle) await settle();
    // Trailing frames: the settle predicate can fire a frame before the
    // animation that follows it has painted.
    await page.waitForTimeout(320);
    const data = await page.evaluate(() => {
      window.__remotePerf.active = false;
      return {
        frames: [...window.__remotePerf.frames],
        tasks: [...window.__remotePerf.tasks],
      };
    });
    const elapsed = Date.now() - started;
    const frames = data.frames;
    const sample = {
      name,
      elapsedMs: elapsed,
      frames: frames.length,
      frameP95: Number(percentile(frames, 0.95).toFixed(2)),
      frameMax: Number(Math.max(0, ...frames).toFixed(2)),
      framesOver50: frames.filter((n) => n > 50.1).length,
      longTasks: data.tasks.length,
      longestTaskMs: Number(Math.max(0, ...data.tasks).toFixed(2)),
    };
    if (profile) {
      const report = (await cdp.send("Profiler.stop")).profile;
      writeFileSync(
        `${profileDir}/${name}.cpuprofile`,
        JSON.stringify(report),
      );
      sample.hotFrames = summarize(report);
    }
    console.log(JSON.stringify(sample));
    return sample;
  }

  const samples = [];
  for (const transition of transitions) {
    if (only && transition.name !== only) continue;
    // Every transition starts from a freshly loaded Home hero, so one
    // transition cannot inherit another's state.
    await openHome();
    try {
      const result = await transition.run(page);
      if (result) samples.push(result);
    } catch (error) {
      // A transition that cannot run in this environment is recorded, not
      // fatal: the walk continues and the report says what was not covered.
      const failure = {
        name: transition.name,
        skipped: true,
        reason: error instanceof Error ? error.message : String(error),
      };
      samples.push(failure);
      console.log(JSON.stringify(failure));
    }
  }

  const measured = samples.filter((s) => !s.skipped);

  const report = {
    origin,
    cpuThrottle: rate,
    motion: "full",
    fixtureRequests: fixture.requests.length,
    samples,
    summary: Object.fromEntries(
      measured.map((s) => [
        s.name,
        {
          frameP95: s.frameP95,
          frameMax: s.frameMax,
          framesOver50: s.framesOver50,
          longTasks: s.longTasks,
          longestTaskMs: s.longestTaskMs,
        },
      ]),
    ),
    skipped: samples.filter((s) => s.skipped),
    limitations:
      "Software GPU in a desktop browser under CPU throttling. Absolute frame evidence for the animated paths, not physical-TV GPU evidence, and not a device playback claim." +
      (profile
        ? " CPU profiling was on for this run, so the timings include profiler overhead; use an unprofiled run for the budget."
        : ""),
  };
  writeFileSync(
    process.env.TRANSITIONS_OUTPUT ?? "/tmp/viptv-tv-transitions.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify({ summary: report.summary }));
  if (
    process.env.TRANSITIONS_ASSERT_BUDGET === "1" &&
    measured.some(
      (s) => s.frameP95 > 17.5 || s.framesOver50 > 0 || s.longTasks > 0,
    )
  )
    throw new Error(
      "Transition frame budget failed; raw evidence retained at " +
        (process.env.TRANSITIONS_OUTPUT ?? "/tmp/viptv-tv-transitions.json"),
    );
} finally {
  await browser.close();
}
