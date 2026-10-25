import { test, expect, type Page } from "@playwright/test";
import { installRemoteBackend } from "../preview/remote-backend";

const screen = (page: Page) => page.locator("html");
async function movies(page: Page) {
  await page.goto("/tv/?platform=vizio&focusdebug=1&perfdebug=1");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "movie");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowDown");
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
  await expect(screen(page)).toHaveAttribute("data-tv-focus", /^content:6:/);
}

test("revision replacement retains a surviving card's focus after server reordering", async ({
  page,
  baseURL,
}) => {
  await page.clock.install();
  const fixture = await installRemoteBackend(page, baseURL!);
  await movies(page);
  fixture.reviseCatalog([6, 0]);
  await page.clock.fastForward(16_000);
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__viptvRemoteMetrics().catalogCards),
    )
    .toBe(2);
  await expect(screen(page)).toHaveAttribute("data-tv-focus", /^content:0:/);
  await page.keyboard.press("Enter");
  await expect
    .poll(
      () =>
        fixture.requests.filter((r) => r.path.startsWith("/api/meta/")).at(-1)
          ?.path,
    )
    .toBe("/api/meta/movie/catalog-6");
});

test("Back refetches a revision-invalidated catalog instead of reviving its cached cards", async ({
  page,
  baseURL,
}) => {
  await page.clock.install();
  const fixture = await installRemoteBackend(page, baseURL!);
  await movies(page);
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "detail");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  fixture.reviseCatalog([0]);
  await page.clock.fastForward(16_000);
  await expect
    .poll(
      () =>
        fixture.requests.filter((r) => r.path.startsWith("/api/meta/")).length,
    )
    .toBe(2);
  await page.keyboard.press("Escape");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "movie");
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__viptvRemoteMetrics().catalogCards),
    )
    .toBe(1);
  await expect(screen(page)).toHaveAttribute("data-tv-focus", /^content:0:/);
});
async function live(page: Page) {
  await page.goto("/tv/?platform=vizio&focusdebug=1&perfdebug=1");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await page.keyboard.press("ArrowUp");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "live");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
}

test("all 200 server Live groups remain visible and selectable in a bounded focus window", async ({
  page,
  baseURL,
}) => {
  await installRemoteBackend(page, baseURL!, { liveGroups: 200 });
  const groupRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/live/channels"))
      groupRequests.push(url.searchParams.get("group_id") ?? "all");
  });
  await live(page);
  await page.keyboard.press("ArrowUp");
  for (let i = 0; i < 200; i++) await page.keyboard.press("ArrowRight");
  await expect(screen(page)).toHaveAttribute(
    "data-tv-focus",
    /^live-groups:200:/,
  );
  const groupBoxes = () =>
    page.evaluate(() => {
      const boxes: { x: number; y: number; color: number }[] = [];
      const visit = (node: any) => {
        if (
          node.isRenderable &&
          node.props?.w === 144 &&
          node.props?.h === 52 &&
          node.absY === 512
        )
          boxes.push({ x: node.absX, y: node.absY, color: node.props.color });
        node.children?.forEach(visit);
      };
      visit((window as any).__viptvRenderer.stage.root);
      return boxes;
    });
  await expect
    .poll(
      async () =>
        (await groupBoxes()).filter(
          (b) => b.color === 0xf4f2eeff && b.x >= 96 && b.x + 144 <= 1824,
        ).length,
    )
    .toBe(1);
  expect((await groupBoxes()).length).toBeLessThanOrEqual(9);
  expect(groupRequests).toEqual(["all"]);
  await page.keyboard.press("Enter");
  await expect.poll(() => groupRequests.at(-1)).toBe("group-200");
  await expect(screen(page)).toHaveAttribute("data-tv-focus", /^content:0:/);
});

test("guide snapshots and obsolete requests stay bounded while traversing 120 channels", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, { liveChannels: 120 });
  await live(page);
  const counts = () =>
    page.evaluate(() => (window as any).__viptvRemoteMetrics());
  for (let i = 1; i < 100; i++) {
    await page.keyboard.press("ArrowDown");
    await expect(screen(page)).toHaveAttribute(
      "data-tv-focus",
      new RegExp(`^content:${i}:`),
    );
    const metrics = await counts();
    expect(metrics.guideSnapshots).toBeLessThanOrEqual(25);
    expect(metrics.guideRequestsInFlight).toBeLessThanOrEqual(5);
  }
  for (let i = 98; i >= 0; i--) {
    await page.keyboard.press("ArrowUp");
    await expect(screen(page)).toHaveAttribute(
      "data-tv-focus",
      new RegExp(`^content:${i}:`),
    );
  }
  await expect.poll(async () => (await counts()).guideRequestsInFlight).toBe(0);
  await expect.poll(async () => (await counts()).guideRequestsInFlight).toBe(0);
  fixture.releasePages();
  expect((await counts()).guideSnapshots).toBeLessThanOrEqual(25);
});
