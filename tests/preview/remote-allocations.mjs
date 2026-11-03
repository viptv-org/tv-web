// Counts the canvas, 2D-context and measureText work the served TV entry does,
// splitting canvases that only measured text from those that rasterized.
// Measurement canvases are the ones a component must not create per instance:
// `npm run test -- tests/ui/text-measure.test.ts` pins that per component, and
// this records the whole entry. Run it against the same trusted HTTPS host as
// `remote-perf.mjs` and treat the numbers as browser-fixture evidence, not
// physical-TV evidence.
//
//   node tests/preview/https-static.mjs ../.local-https/certs 18571
//   REMOTE_PREVIEW_ORIGIN=https://viptv.local.test:18571 \
//     node --experimental-strip-types tests/preview/remote-allocations.mjs
import { chromium } from "@playwright/test";
import { installRemoteBackend } from "./remote-backend.ts";

const origin =
  process.env.REMOTE_PREVIEW_ORIGIN ?? "https://viptv.local.test:18571";
const runs = (process.env.ALLOC_RUNS ?? "cold-home,48-home-keys,48-down-keys")
  .split(",")
  .filter(Boolean);

/** Installed before the entry loads: every canvas creation is recorded, a
 * context is counted per `getContext("2d")`, and a canvas that is resized or
 * painted is marked as a raster surface rather than a measurement one. */
const instrument = () => {
  const canvases = [];
  const counts = { canvas: 0, contexts: 0, measure: 0 };
  window.__counts = counts;
  window.__canvases = canvases;
  const proto = HTMLCanvasElement.prototype;
  const dimensions = ["width", "height"].map((name) => [
    name,
    Object.getOwnPropertyDescriptor(proto, name),
  ]);
  const create = Document.prototype.createElement;
  Document.prototype.createElement = function (tag, ...rest) {
    const element = create.call(this, tag, ...rest);
    if (tag !== "canvas") return element;
    counts.canvas++;
    const record = { canvas: element, painted: false };
    canvases.push(record);
    for (const [name, descriptor] of dimensions)
      Object.defineProperty(element, name, {
        configurable: true,
        get: () => descriptor.get.call(element),
        set: (value) => {
          record.painted = true;
          descriptor.set.call(element, value);
        },
      });
    return element;
  };
  const getContext = proto.getContext;
  proto.getContext = function (type, ...rest) {
    if (type === "2d") counts.contexts++;
    return getContext.call(this, type, ...rest);
  };
  const context = CanvasRenderingContext2D.prototype;
  for (const name of [
    "fill",
    "fillRect",
    "stroke",
    "drawImage",
    "fillText",
    "getImageData",
    "putImageData",
    "createLinearGradient",
    "createRadialGradient",
    "arcTo",
  ]) {
    const original = context[name];
    context[name] = function (...args) {
      for (const record of canvases)
        if (record.canvas === this.canvas) record.painted = true;
      return original.call(this, ...args);
    };
  }
  const measure = context.measureText;
  context.measureText = function (text) {
    counts.measure++;
    return measure.call(this, text);
  };
};

const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
try {
  for (const run of runs) {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      reducedMotion: "reduce",
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    await installRemoteBackend(page, origin, {
      liveChannels: 120,
      liveGroups: 20,
      addons: 120,
      channelSearch: false,
      searchChannelCount: 120,
    });
    await page.addInitScript(instrument);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(origin + "/tv/?platform=vizio&perfdebug=1&focusdebug=1");
    await page.waitForFunction(
      () => document.documentElement.dataset.tvScreen === "home",
    );
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        ),
    );
    const samples = [];
    let recorded = 0;
    /** Counts reset per phase, so each sample is that phase's own work; the
     * canvas split covers the canvases created during the phase. */
    const record = async (phase) => {
      const sample = await page.evaluate((from) => {
        const scope = window;
        const created = scope.__canvases.slice(from);
        const counts = { ...scope.__counts };
        scope.__counts.canvas = 0;
        scope.__counts.contexts = 0;
        scope.__counts.measure = 0;
        return {
          ...counts,
          canvases: created.length,
          raster: created.filter((entry) => entry.painted).length,
          measurement: created.filter((entry) => !entry.painted).length,
          total: scope.__canvases.length,
        };
      }, recorded);
      recorded = sample.total;
      delete sample.total;
      samples.push({ phase, ...sample });
    };
    await record("cold-home");
    if (run !== "cold-home") {
      const keys =
        run === "48-down-keys"
          ? Array(48).fill("ArrowDown")
          : ["hero", "rows"].flatMap((zone) =>
              (zone === "rows" ? ["ArrowDown"] : []).concat(
                ...Array.from({ length: 6 }, () => [
                  "ArrowRight",
                  "ArrowRight",
                  "ArrowLeft",
                  "ArrowLeft",
                ]),
              ),
            );
      for (const key of keys) {
        await page.keyboard.press(key);
        await page.waitForTimeout(80);
      }
      await page.waitForTimeout(500);
      await record("keys");
    }
    console.log(JSON.stringify({ run, samples }));
    await context.close();
  }
} finally {
  await browser.close();
}