import { chromium } from "@playwright/test";
import { installRemoteBackend } from "./remote-backend.ts";
import { writeFileSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const origin =
  process.env.REMOTE_PREVIEW_ORIGIN ?? "https://viptv.local.test:18562";
const legacy = process.env.PERF_LEGACY === "1";
const dist =
  process.env.PERF_DIST ??
  (legacy ? "/tmp/viptv-tv-before-20261023" : "/tmp/viptv-tv-after-20261023");
const sourceRef = process.env.PERF_SOURCE_REF;
const workload = process.env.PERF_WORKLOAD ?? 'home';
if (!['home', 'grid', 'live', 'settings', 'search'].includes(workload) || (legacy && workload !== 'home')) throw new Error('Unsupported benchmark workload');
const expectedIndex = readFileSync(dist + "/index.html", "utf8");
const runs = Number(process.env.PERF_RUNS ?? 3),
  rate = Number(process.env.PERF_CPU_THROTTLE ?? 4),
  mode = process.env.PERF_GPU ?? "software";
const browser = await chromium.launch({
  args:
    mode === "hardware" ? ["--use-angle=gl"] : ["--enable-unsafe-swiftshader"],
});
const browserCdp = await browser.newBrowserCDPSession();
const { gpu } = await browserCdp.send("SystemInfo.getInfo");
if (mode === "hardware" && gpu.featureStatus.webgl !== "enabled") {
  await browser.close();
  throw new Error("Hardware WebGL is unavailable.");
}
const samples = [];
const percentile = (values, fraction) =>
  [...values].sort((a, b) => a - b)[
    Math.max(0, Math.ceil(values.length * fraction) - 1)
  ];
try {
  for (let run = 0; run < runs; run++) {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const requestCounts={};page.on("request",r=>{const path=new URL(r.url()).pathname;const key=path.endsWith("/guide")?"guide":path.endsWith("/channels")?"channels":path.startsWith("/api/")?"api-other":"assets";requestCounts[key]=(requestCounts[key]??0)+1;});
    if (legacy) {
      process.env.PREVIEW_API_ORIGIN = origin;
      const { installBackend } = await import("./backend.ts");
      await installBackend(page, { family: "tv", session: "ready" });
    } else {
      const fixture = await installRemoteBackend(page, origin, { liveChannels:120, liveGroups:20, addons:120, channelSearch:workload==='search', searchChannelCount:120 });
      if (workload === 'grid') await page.route('**/api/discover?**', route => {
        const offset = Number(new URL(route.request().url()).searchParams.get('skip') ?? 0);
        return route.fulfill({ json: {
          cards:Array.from({length:Math.min(40,210-offset)},(_,i)=>({ ...fixture.cards[(offset+i)%fixture.cards.length], identity:{kind:'movie',id:`perf-grid-${offset+i}`,ids:[]}, title:`Fixture title ${offset+i}` })),
          complete:true, next_cursor:offset+40<210?String(offset+40):null,
        }});
      });
    }
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    await cdp.send("Performance.enable");
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
    await page.goto(origin + "/tv/?platform=vizio&perfdebug=1&focusdebug=1");
    await page.waitForFunction(
      (legacy) =>
        legacy
          ? window.__viptvFocus?.view === "home-action"
          : document.documentElement.dataset.tvScreen === "home",
      legacy,
    );
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    const readyMs = await page.evaluate(() => performance.now());
    const keys = async (...keys) => { for (const key of keys) await page.keyboard.press(key); };
    if (workload !== 'home') {
      await keys('ArrowUp');
      const target = workload === 'search' ? 0 : workload === 'grid' ? 2 : workload === 'live' ? 4 : 6;
      if (target===0) await keys('ArrowLeft');
      for (let index=1; index<target; index++) await keys('ArrowRight');
      await keys('Enter');
      if (workload === 'settings') await keys('ArrowDown','Enter');
      await page.waitForFunction(screen=>document.documentElement.dataset.tvScreen===screen && document.documentElement.dataset.tvReady==='true', workload==='grid'?'movie':workload);
      if (workload === 'grid') await keys('ArrowDown');
      if (workload === 'search') {
        await page.keyboard.type('fixture');
        await page.waitForFunction(()=>document.documentElement.dataset.tvReady==='true');
      }
      if (workload === 'settings') {
        await keys('ArrowDown','ArrowDown');
        await page.waitForFunction(()=>document.documentElement.dataset.tvReady==='true');
        await keys('ArrowRight');
      }
    }
    const workloadReadyMs = await page.evaluate(() => performance.now());
    await page.waitForTimeout(500);
    const servedIndex = await page.evaluate(
      async () =>
        await (await fetch("/tv/index.html", { cache: "no-store" })).text(),
    );
    if (servedIndex !== expectedIndex)
      throw new Error(
        "The served entry does not match PERF_DIST; refusing to attribute performance to another build.",
      );
    await page.evaluate(() => (window.__remotePerf.active = true));
    await cdp.send("Profiler.enable");await cdp.send("Profiler.start");
    const before = await cdp.send("Performance.getMetrics");
    const focus = [];
    let peakFocusedIndex = 0;
    const keySets = workload==='search' ? [{zone:'typing',keys:[...'abcdefghij']},{zone:'erase',keys:Array(10).fill('Enter')},{zone:'search-channels',keys:[...Array(119).fill('ArrowRight'),...Array(119).fill('ArrowLeft')]}]
      : workload==='home' ? ['hero','rows'].map(zone=>({zone,keys:Array.from({length:6},()=>['ArrowRight','ArrowRight','ArrowLeft','ArrowLeft']).flat()}))
      : [{zone:workload,keys:[...Array(workload==='live'?119:workload==='grid'?28:100).fill('ArrowDown'),...Array(workload==='live'?119:workload==='grid'?28:100).fill('ArrowUp')]}];
    for (const {zone,keys:commands} of keySets) {
      if (zone === "rows") await page.keyboard.press("ArrowDown");
      if (zone === 'erase') await keys('ArrowUp','ArrowRight');
      if (zone === 'search-channels') await keys('ArrowRight','ArrowDown');
        for (const key of commands) {
          const observation = await page.evaluate((key) => {
            const start = performance.now();
            document.dispatchEvent(
              new KeyboardEvent("keydown", {
                key,
                bubbles: true,
                cancelable: true,
              }),
            );
            document.dispatchEvent(
              new KeyboardEvent("keyup", {
                key,
                bubbles: true,
                cancelable: true,
              }),
            );
            return { duration:performance.now() - start, focus:document.documentElement.dataset.tvFocus };
          }, key);
          focus.push(observation.duration);
          peakFocusedIndex = Math.max(peakFocusedIndex, Number(observation.focus?.split(':')[1] ?? 0));
          await page.waitForTimeout(80);
        }
      await page.waitForTimeout(500);
    }
    if (workload !== 'home' && peakFocusedIndex !== ({grid:196,live:119,settings:100,search:119})[workload]) throw new Error(`The ${workload} navigation fixture did not traverse its intended content: ${peakFocusedIndex}`);
    const after = await cdp.send("Performance.getMetrics");
    const profile=(await cdp.send("Profiler.stop")).profile;writeFileSync(process.env.PERF_PROFILE,JSON.stringify({profile,requestCounts,before,after}));
    const data = await page.evaluate(() => {
      window.__remotePerf.active = false;
      return {
        ...window.__remotePerf,
        texture: window.__viptvRendererMetrics?.(),
        js: performance
          .getEntriesByType("resource")
          .filter((e) => e.name.includes(".js"))
          .reduce((n, e) => n + e.decodedBodySize, 0),
      };
    });
    await cdp.send("HeapProfiler.collectGarbage");
    const heap = await cdp.send("Runtime.getHeapUsage");
    const metric = (set, name) =>
      set.metrics.find((e) => e.name === name)?.value ?? 0;
    const sample = {
      run,
      readyMs,
      workloadReadyMs,
      peakFocusedIndex,
      keyCount:focus.length,
      mainThreadMsPerKey:
        ((metric(after, "TaskDuration") - metric(before, "TaskDuration")) *
          1000) /
        focus.length,
      handlerP95: percentile(focus, 0.95),
      frameP95: percentile(data.frames, 0.95),
      framesOver50: data.frames.filter((n) => n > 50.1).length,
      longTasks: data.tasks.length,
      heapMiB: heap.usedSize / 1048576,
      textureMiB: (data.texture?.textureBytes ?? 0) / 1048576,
      jsKiB: data.js / 1024,
    };
    samples.push(sample);
    console.log(JSON.stringify(sample));
    await context.close();
  }
} finally {
  await browser.close();
}
const summary = Object.fromEntries(
  Object.keys(samples[0])
    .filter((k) => k !== "run")
    .map((k) => [
      k,
      percentile(
        samples.map((s) => s[k]),
        0.5,
      ),
    ]),
);
const hash = createHash("sha256");
for (const file of (sourceRef ? execFileSync('git',['ls-tree','--name-only',sourceRef+':src/tv-solid/remote'],{encoding:'utf8'}).trim().split('\n') : readdirSync("src/tv-solid/remote")).sort())
  hash
    .update(file)
    .update(
      sourceRef
        ? execFileSync("git", [
            "show",
            sourceRef + ":src/tv-solid/remote/" + file,
          ])
        : readFileSync("src/tv-solid/remote/" + file),
    );
const sourceSha256 = hash.digest("hex");
const bundle = createHash("sha256");
for (const file of [
  "index.html",
  "solid.html",
  ...readdirSync(dist + "/assets")
    .filter((file) => file.endsWith(".js"))
    .sort()
    .map((file) => "assets/" + file),
])
  bundle.update(file).update(readFileSync(dist + "/" + file));
const report = {
  legacy,
  workload,
  mode,
  rate,
  runs,
  sourceRevision: sourceRef ?? "working-tree",
  servedEntryVerified: true,
  sourceSha256: legacy ? undefined : sourceSha256,
  measuredBundleSha256: bundle.digest("hex"),
  fixtureSha256: createHash("sha256")
    .update(
      readFileSync(
        legacy ? "tests/preview/backend.ts" : "tests/preview/remote-backend.ts",
      ),
    )
    .digest("hex"),
  designRef: (sourceRef ? execFileSync('git',['show',sourceRef+':DESIGN_REF'],{encoding:'utf8'}) : readFileSync("DESIGN_REF", "utf8")).trim(),
  gpu,
  samples,
  summary,
  limitations:
    `Software GPU/browser fixtures are not physical-TV evidence. Workload: ${workload}; home has 48 hero/row keys, grid traverses 28 rows and returns (210 titles, five reused artworks), live traverses 120 channels and returns, settings traverses 100 add-on rows and returns, search types/deletes ten characters and traverses 120 channel results and returns. Network fixtures use the current server contract. Legacy Home uses its older API fixture and is not a matched-data comparison. CPU throttling does not emulate TV GPU performance.`,
};
writeFileSync(
  process.env.PERF_OUTPUT ?? "/tmp/viptv-tv-after-performance.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify({ summary }));
