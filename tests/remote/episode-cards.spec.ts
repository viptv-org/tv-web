import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { installRemoteBackend } from "../preview/remote-backend";
import type { Card } from "../../src/tv-solid/remote/types";

const titles = ["The Quietly Approaching Threat", "Akatsuki's Invasion", "Under the Starry Sky", "The Old Monk's Prayer"];
async function fixture(page: Page, origin: string, canvas: boolean, delayed: boolean) {
  await page.addInitScript(canvas => {
    if (!canvas) return;
    Object.defineProperty(window, "Worker", {configurable: true, value: undefined});
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: any[]) {
      return type.includes("webgl") ? null : original.apply(this, [type, ...args] as any);
    } as typeof original;
  }, canvas);
  const base = await installRemoteBackend(page, origin);
  await page.route("**/fixture/*", route => route.fulfill({contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><path fill="#182132" d="M0 0h1920v1080H0z"/></svg>'}));
  const series: Card = {...base.cards[0], title: "Naruto Shippuden", identity: {kind: "series", id: "tt0988824", ids: []}};
  const cards: Card[] = Array.from({length: 17}, (_, index) => ({
    ...series, title: titles[index] ?? `Episode ${index + 1}`, subtitle: `S4 E${index + 1}`, badges: [],
    identity: {kind: "series", id: `tt0988824:4:${index + 1}`, ids: [], episode: {order: "aired", season: 4, episode: index + 1}},
    parent_identity: series.identity, poster: null, logo: null,
    landscape: index === 2 ? null : `${origin}/fixture/episode-art-${index === 1 ? "success.svg" : "failed.jpg"}`,
    progress: index === 0 ? .05236978860202954 : index === 1 ? .011362704586639488 : null,
    view: {saved: false, progress: index === 0 ? .05236978860202954 : index === 1 ? .011362704586639488 : null},
  }));
  let fail!: () => void, succeed!: () => void;
  const failed = new Promise<void>(resolve => { fail = resolve; });
  const success = new Promise<void>(resolve => { succeed = resolve; });
  await page.route("**/fixture/episode-art-*", async route => {
    if (route.request().url().endsWith("success.svg")) {
      if (delayed) await success;
      return route.fulfill({contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="414" height="233"><rect width="414" height="233" fill="#533064"/></svg>'});
    }
    if (delayed) await failed;
    return route.fulfill({status: 404, contentType: "text/plain", body: "Artwork unavailable"});
  });
  await page.route("**/api/meta/**", route => route.fulfill({json: {
    item: series, seasons: [{season: 4, offset: 0, episode_count: 17}], episodes: cards, recommendations: [], next_cursor: null,
  }}));
  const intents: string[] = [];
  await page.route("**/api/profiles/*/viewing-action", route => {
    const value = route.request().postDataJSON().card as Card;
    intents.push(value.identity.id);
    return route.fulfill({json: {card: cards.find(card => card.identity.id === value.identity.id) ?? series,
      label: "Play", resume: false, source_selection: "ask"}});
  });
  await page.route("**/api/streams", route => route.fulfill({json: {streams: []}}));
  await page.goto("/tv/?focusdebug=1");
  await expect(page.locator("html")).toHaveAttribute("data-tv-ready", "true");
  for (const key of ["ArrowDown", "Enter"]) await page.keyboard.press(key);
  await expect(page.locator("html")).toHaveAttribute("data-tv-screen", "detail");
  await expect(page.locator("html")).toHaveAttribute("data-tv-ready", "true");
  for (const key of ["ArrowDown", "ArrowDown"]) await page.keyboard.press(key);
  await expect(page.locator("html")).toHaveAttribute("data-tv-focus", /^episodes:0:/);
  return {fail, succeed, cards, intents};
}

async function episodePaint({title, frames, mark}: {title: string; frames: number; mark?: string}) {
  const exposed = (window as any).__viptvRenderer, renderer = exposed.rawRenderer ?? exposed;
  const canvasMode = document.documentElement.dataset.rendererBackend === "canvas";
  const canvas = document.querySelector("#app canvas") as HTMLCanvasElement;
  const scale = canvas.width / 1920;
  const ctx: any = canvasMode ? canvas.getContext("2d") : renderer.backend?.gl ?? canvas.getContext("webgl") ?? canvas.getContext("webgl2");
  const samples: {missing: boolean; id: number; x: number; y: number; width: number; height: number; captions: number; captionInk: number; white: number; accent: number}[] = [];
  let badFrame: string | undefined;
  const capture = () => {
    const labels: any[] = [];
    const walk = (node: any) => {
      if (node.worldAlpha > 0 && (node.viptvText === title || node.props?.text === title)) labels.push(node);
      node.children?.forEach(walk);
    };
    walk(exposed.stage.root);
    let card = labels[0]?.parent;
    while (card && !(card.props.w > 300 && card.props.w < 500 && card.props.h > card.props.w * 9 / 16 + 50)) card = card.parent;
    if (!card) {
      samples.push({missing: true, id: -1, x: 0, y: 0, width: 0, height: 0, captions: labels.length, captionInk: 0, white: 0, accent: 0});
      if (!badFrame) badFrame = canvas.toDataURL("image/png");
      return;
    }
    const width = card.props.w, height = card.props.h - 80, x = card.absX, y = card.absY;
    const px = Math.round(x * scale), py = Math.round(y * scale);
    const w = Math.max(1, Math.min(Math.round(width * scale), canvas.width - px)), h = Math.max(1, Math.round(height * scale));
    let data: Uint8Array | Uint8ClampedArray;
    if (canvasMode) data = ctx.getImageData(px, py, w, h).data;
    else { data = new Uint8Array(w * h * 4); ctx.readPixels(px, canvas.height - py - h, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, data); }
    let white = 0, accent = 0;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const i = (yy * w + xx) * 4;
      if ((xx < 4 * scale || xx >= w - 4 * scale || yy < 4 * scale || yy >= h - 4 * scale) &&
        Math.min(data[i], data[i + 1], data[i + 2]) > 200) white++;
      if (yy >= h - 8 * scale && yy < h - 3 * scale && data[i] > 180 && data[i + 1] > 110 && data[i + 2] < 130) accent++;
    }
    const captionY = py + h + Math.round(14 * scale), captionH = Math.max(1, Math.round(30 * scale));
    let caption: Uint8Array | Uint8ClampedArray;
    if (canvasMode) caption = ctx.getImageData(px, captionY, w, captionH).data;
    else { caption = new Uint8Array(w * captionH * 4); ctx.readPixels(px, canvas.height - captionY - captionH, w, captionH, ctx.RGBA, ctx.UNSIGNED_BYTE, caption); }
    let captionInk = 0;
    for (let i = 0; i < caption.length; i += 4) if (Math.min(caption[i], caption[i + 1], caption[i + 2]) > 180) captionInk++;
    samples.push({missing: false, id: card.id, x, y, width, height, captions: labels.length, captionInk: captionInk / (scale * scale), white: white / (scale * scale), accent: accent / (scale * scale)});
    if ((!white || labels.length > 1) && !badFrame) badFrame = canvas.toDataURL("image/png");
  };
  const owner = canvasMode ? renderer.stage : renderer, method = canvasMode ? "drawFrame" : "frame", original = owner[method];
  owner[method] = function(this: any, ...args: any[]) {
    if (canvasMode) { const result = original.apply(this, args); capture(); return result; }
    let drawn = false;
    const backend = renderer.backend, draw = backend.draw;
    backend.draw = function(this: any, ...values: any[]) { drawn = true; return draw.apply(this, values); };
    try { return original.apply(this, args); }
    finally { backend.draw = draw; if (drawn) capture(); }
  };
  if (mark) (window as any).__viptvEpisodeCaptureReady = mark;
  try {
    for (let i = 0; i < frames; i++) await new Promise<void>(resolve => {
      renderer.once("frameTick", () => { void Promise.resolve().then(resolve); }); renderer.requestRender();
    });
  } finally { owner[method] = original; }
  return {canvasMode, samples, badFrame};
}

const paint = (page: Page, title: string, frames = 1, mark?: string) => page.evaluate(episodePaint, {title, frames, mark});
for (const canvas of [false, true]) {
  const mode = canvas ? "Canvas" : "WebGL";
  test(`episode title/focus/real progress survive late failure and late success (${mode})`, async ({page, baseURL}, info) => {
    const f = await fixture(page, baseURL!, canvas, true);
    try {
      await expect.poll(async () => (await paint(page, titles[0])).samples[0]?.white ?? 0).toBeGreaterThan(300);
      const before = await paint(page, titles[0]);
      expect(before.canvasMode).toBe(canvas);
      expect(before.samples[0].captionInk).toBeGreaterThan(100);
      const recording = paint(page, titles[0], 90, "late-failure");
      await page.waitForFunction(() => (window as any).__viptvEpisodeCaptureReady === "late-failure");
      const response = page.waitForResponse(response => response.url().endsWith("episode-art-failed.jpg") && response.status() === 404);
      f.fail();
      await response;
      const failed = await recording;
      writeFileSync(info.outputPath("late-failure.json"), JSON.stringify({before, failed}, null, 2));
      if (failed.badFrame) writeFileSync(info.outputPath("late-failure.png"), Buffer.from(failed.badFrame.split(",")[1], "base64"));
      expect(failed.canvasMode).toBe(canvas);
      expect.soft(failed.samples.length).toBeGreaterThan(30);
      expect.soft(failed.samples.some(frame => frame.missing)).toBe(false);
      expect.soft(failed.samples.every(frame => frame.white > 300 && frame.accent > 6)).toBe(true);
      expect.soft(failed.samples.every(frame => frame.captions === 1 && frame.captionInk > 100 && frame.id === before.samples[0].id)).toBe(true);
      await expect(page.locator("html")).toHaveAttribute("data-tv-focus", /^episodes:0:/);
      await page.keyboard.press("ArrowRight");
      f.succeed();
      const loaded = await paint(page, titles[1], 30);
      expect(loaded.canvasMode).toBe(canvas);
      expect.soft(loaded.samples.length).toBeGreaterThan(8);
      expect.soft(loaded.samples.some(frame => frame.missing)).toBe(false);
      expect.soft(loaded.samples.every(frame => frame.white > 300 && frame.accent > 2 && frame.captions === 1 && frame.captionInk > 100)).toBe(true);
      await page.keyboard.press("ArrowRight");
      const missing = await paint(page, titles[2], 16);
      expect(missing.canvasMode).toBe(canvas);
      expect.soft(missing.samples.length).toBeGreaterThan(4);
      expect.soft(missing.samples.some(frame => frame.missing)).toBe(false);
      expect.soft(missing.samples.every(frame => frame.white > 300 && frame.accent === 0 && frame.captions === 1 && frame.captionInk > 100)).toBe(true);
      await page.screenshot({path: info.outputPath("missing-art-focused.png")});
    } finally { f.fail(); f.succeed(); }
  });

  test(`all 17 episode identities remain visible and selected through row boundaries (${mode})`, async ({page, baseURL}, info) => {
    const f = await fixture(page, baseURL!, canvas, false);
    for (let column = 0; column < 17; column++) {
      if (column) await page.keyboard.press("ArrowRight");
      await expect(page.locator("html")).toHaveAttribute("data-tv-focus", new RegExp(`^episodes:${column}:`));
      await expect.poll(async () => (await paint(page, f.cards[column].title, 2)).samples.some(frame => !frame.missing && frame.white > 300)).toBe(true);
      const result = await paint(page, f.cards[column].title, 3), card = result.samples[0];
      expect(result.canvasMode).toBe(canvas);
      expect(card, "selected episode must retain its caption and card node").toBeTruthy();
      expect.soft(card.missing).toBe(false);
      expect.soft(result.samples.some(frame => frame.white > 300)).toBe(true);
      expect.soft(card.x).toBeGreaterThanOrEqual(96);
      expect.soft(card.x + card.width).toBeLessThanOrEqual(1824);
      if (column === 3) await page.screenshot({path: info.outputPath("fourth-episode-focus.png")});
    }
    for (let column = 15; column >= 0; column--) {
      await page.keyboard.press("ArrowLeft");
      await expect(page.locator("html")).toHaveAttribute("data-tv-focus", new RegExp(`^episodes:${column}:`));
      await expect.poll(async () => (await paint(page, f.cards[column].title, 2)).samples.some(frame => !frame.missing && frame.white > 300)).toBe(true);
      const result = await paint(page, f.cards[column].title, 2), card = result.samples[0];
      expect(result.canvasMode).toBe(canvas);
      expect(card, "return navigation must retain the selected episode").toBeTruthy();
      expect.soft(card.missing).toBe(false);
      expect.soft(result.samples.some(frame => frame.white > 300)).toBe(true);
      expect.soft(card.x).toBeGreaterThanOrEqual(96);
      expect.soft(card.x + card.width).toBeLessThanOrEqual(1824);
    }
    for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp"); await page.keyboard.press("ArrowDown");
    await expect(page.locator("html")).toHaveAttribute("data-tv-focus", /^episodes:8:/);
    await page.keyboard.press("Enter");
    await expect.poll(() => f.intents[f.intents.length - 1]).toBe("tt0988824:4:9");
  });
}
