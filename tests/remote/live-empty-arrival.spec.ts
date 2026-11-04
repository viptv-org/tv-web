import { expect, test } from "@playwright/test";
import { installRemoteBackend } from "../preview/remote-backend";

test.use({ reducedMotion: "no-preference" });

for (const empty of [
  { spread: "no-source", availability: "NeedsConfiguration", action: "Set up live TV" },
  { spread: "no-channels", availability: "Available", action: "Source integrations" },
] as const) for (const pageAction of [false, true]) test(`Live replaces ${empty.spread} in place from ${pageAction ? "the empty-page action" : "navigation"}`, async ({ page, baseURL }) => {
  const fixture = await installRemoteBackend(page, baseURL!, {
    liveChannels: 0,
    liveAvailability: empty.availability,
  });
  await page.route("**/api/auth/me", route => route.fulfill({ json: {
    role: "owner", capabilities: { manage_account: true },
  } }));
  await page.clock.install();
  const state = page.locator("html");
  await page.goto("/tv/?platform=vizio&focusdebug=1");
  await expect(state).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowUp");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(state).toHaveAttribute("data-tv-live-spread", empty.spread);
  if (pageAction) {
    await expect.poll(() => page.evaluate(action => {
      const text: string[] = [];
      const visit = (node: any) => {
        if (node.viptvText) text.push(node.viptvText);
        node.children?.forEach(visit);
      };
      visit((window as any).__viptvRenderer.stage.root);
      return text.includes(action);
    }, empty.action)).toBe(true);
    await page.keyboard.press("ArrowDown");
    await expect(state).toHaveAttribute("data-tv-focus", /^live-empty:0:/);
  } else await expect(state).toHaveAttribute("data-tv-focus", /^nav:4:/);
  await page.evaluate(() => {
    const renderer = (window as any).__viptvRenderer;
    (window as any).__arrivalFrames = [];
    renderer.on("frameTick", () => queueMicrotask(() => {
      const rows: any[] = [];
      const visit = (node: any) => {
        if (node.viptvText === "Updated channel 0" && node.parent?.width === 300)
          rows.push([node.parent.absX, node.parent.absY, node.parent.worldAlpha]);
        node.children?.forEach(visit);
      };
      visit(renderer.stage.root);
      const html = document.documentElement;
      (window as any).__arrivalFrames.push({ screen: html.dataset.tvScreen, spread: html.dataset.tvLiveSpread, rows });
    }));
  });
  fixture.addLiveChannels(3);
  await page.clock.fastForward(15000);
  await expect(state).toHaveAttribute("data-tv-live-spread", "today");
  await expect(state).toHaveAttribute("data-tv-focus", /^content:0:/);
  await expect(state).toHaveAttribute("data-tv-channel-id", "channel-0");
  await page.clock.runFor(50);
  const frames = await page.evaluate(() => (window as any).__arrivalFrames);
  expect(frames.length).toBeGreaterThan(0);
  for (const frame of frames) {
    expect(frame.screen).toBe("live");
    expect([empty.spread, "today"]).toContain(frame.spread);
    if (frame.spread === "today") expect(frame.rows).toEqual([[96, 636, 1]]);
  }
  expect(frames.some((frame: any) => frame.spread === "today")).toBe(true);
  await page.keyboard.press("ArrowDown");
  await expect(state).toHaveAttribute("data-tv-channel-id", "channel-1");
});
