import { expect, test, type Page } from "@playwright/test";
import { installRemoteBackend } from "../preview/remote-backend";

const state = (page: Page) => page.locator("html");
async function openDisplay(page: Page) {
  await page.keyboard.press("ArrowUp");
  const ids = (await state(page).getAttribute("data-tv-navigation"))!.split(",");
  const current = Number((await state(page).getAttribute("data-tv-focus"))!.split(":")[1]);
  const profile = ids.indexOf("profiles");
  for (let i = current; i < profile; i++) await page.keyboard.press("ArrowRight");
  for (let i = profile; i < current; i++) await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
  await expect(state(page)).toHaveAttribute("data-tv-screen", "settings");
  await expect(state(page)).toHaveAttribute("data-tv-ready", "true");
  for (let i = 2; i < 6; i++) {
    await page.keyboard.press("ArrowDown");
    await expect(state(page)).toHaveAttribute("data-tv-ready", "true");
  }
  await page.keyboard.press("ArrowRight");
  await expect(state(page)).toHaveAttribute("data-tv-focus", /^settings-content:0:/);
}

for (const canvas of [false, true]) test(`Select keeps the persisted last accent after reload (${canvas ? "Canvas" : "WebGL"})`, async ({page, baseURL}) => {
  await page.addInitScript(canvas => {
    if (!canvas) return;
    Object.defineProperty(window, "Worker", {configurable: true, value: undefined});
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: any[]) {
      return type.includes("webgl") ? null : original.apply(this, [type, ...args] as any);
    } as typeof original;
  }, canvas);
  const f = await installRemoteBackend(page, baseURL!);
  await page.route("**/fixture/**", route => route.fulfill({contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#303034"/></svg>'}));
  await page.goto("/tv/?focusdebug=1");
  await expect(state(page)).toHaveAttribute("data-tv-screen", "home");
  await expect(state(page)).toHaveAttribute("data-tv-ready", "true");
  expect(await state(page).getAttribute("data-renderer-backend")).toBe(canvas ? "canvas" : "webgl");
  await openDisplay(page);
  const writes = () => f.requests.filter(request => request.method === "PUT" && request.path.endsWith("/preferences"));
  const selectedSwatch = () => page.evaluate(() => {
    let x: number | undefined;
    const walk = (node: any) => {
      if (node.isRenderable && node.props.w === 56 && node.props.h === 56 && node.absY === 240 && node.absX >= 1560) x = node.absX;
      node.children?.forEach(walk);
    };
    walk((window as any).__viptvRenderer.stage.root); return x;
  });
  for (const [color, x] of [["#FF8B5C", 1622], ["#62D9BC", 1684], ["#A3BCFF", 1746]] as const) {
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => writes().at(-1)?.body?.display?.accent_color).toBe(color);
    await expect(state(page)).toHaveAttribute("data-tv-ready", "true");
    await expect.poll(selectedSwatch).toBe(x);
  }
  expect(writes()).toHaveLength(3);
  await page.keyboard.press("Enter");
  await expect(state(page)).toHaveAttribute("data-tv-ready", "true");
  expect.soft(writes()).toHaveLength(3);
  expect.soft(f.bootstrap().preferences?.display?.accent_color).toBe("#A3BCFF");
  await page.reload();
  await expect(state(page)).toHaveAttribute("data-tv-screen", "home");
  await expect(state(page)).toHaveAttribute("data-tv-ready", "true");
  await openDisplay(page);
  expect(f.bootstrap().preferences?.display?.accent_color).toBe("#A3BCFF");
  await expect.poll(() => page.evaluate(() => {
    let color: number | undefined;
    const walk = (node: any) => {
      if (node.isRenderable && node.props.w === 68 && node.props.h === 38 && node.absX === 1728 && node.absY === 357) color = node.props.color;
      node.children?.forEach(walk);
    };
    walk((window as any).__viptvRenderer.stage.root); return color;
  })).toBe(0xa3bcffff);
});
