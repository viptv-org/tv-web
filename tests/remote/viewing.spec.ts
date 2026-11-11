import { test, expect, type Page } from "@playwright/test";
import { installRemoteBackend } from "../preview/remote-backend";
import { openNavigation } from "./navigation-helpers";
const screen = (page: Page) => page.locator("html");
const MEDIA_PROGRESS_TIMEOUT_MS = 20_000;
const mediaTime = (page: Page) =>
  page
    .locator("video")
    .evaluate((video) => (video as HTMLVideoElement).currentTime);
const mediaPaused = (page: Page) =>
  page
    .locator("video")
    .evaluate((video) => (video as HTMLVideoElement).paused);
async function expectPlaybackProgress(page: Page, seconds: number) {
  await expect
    .poll(() => mediaTime(page), { timeout: MEDIA_PROGRESS_TIMEOUT_MS })
    .toBeGreaterThan(seconds);
}
// Freeze the page clock once the app has committed its first screen, so timers
// and animation advance only where the test advances them.
async function pauseClock(page: Page) {
  await page.clock.pauseAt(
    new Date(await page.evaluate(() => Date.now() + 1000)),
  );
}
test("a rejected add-on mutation retains confirmed state and retries the same intent", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, {
    addons: 1,
    rejectActivationOnce: true,
  });
  await page.goto("/tv/?platform=vizio");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await navigate(page, "profiles");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowDown");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowDown");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "choices");
  await page.keyboard.press("Enter");
  const mutations = () =>
    fixture.requests.filter(
      (r) => r.path.endsWith("/addon-activation") && r.method === "PUT",
    );
  await expect.poll(() => mutations().length).toBe(1);
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  expect(fixture.addonEnabled("addon:1")).toBe(true);
  await page.keyboard.press("Enter");
  await expect.poll(() => mutations().length).toBe(2);
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  expect(mutations().map((r) => r.body.enabled)).toEqual([false, false]);
  expect(fixture.addonEnabled("addon:1")).toBe(false);
});
test("episode season navigation consumes the server offset and recommendations restore focus", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, {
    seasonPages: true,
  });
  await page.goto("/tv/?platform=vizio");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowDown");
  await expect(screen(page)).toHaveAttribute("data-tv-focus", /^seasons:/);
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "choices");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-focus", /^episodes:0:/);
  expect(
    fixture.requests.filter((r) => r.path.startsWith("/api/meta/")).length,
  ).toBe(2);
  await page.keyboard.press("ArrowDown");
  await expect(screen(page)).toHaveAttribute(
    "data-tv-focus",
    /^recommendations:/,
  );
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("Escape");
  await expect(screen(page)).toHaveAttribute(
    "data-tv-focus",
    /^recommendations:/,
  );
});
async function boot(page: Page, origin: string) {
  const fixture = await installRemoteBackend(page, origin);
  await page.goto("/tv/?platform=vizio");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  return fixture;
}
async function navigate(page: Page, id: string) {
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await openNavigation(page, id);
}

test("TV startup loads one server bootstrap and no legacy engine", async ({
  page,
  baseURL,
}) => {
  const loaded: string[] = [];
  page.on("request", (r) => loaded.push(r.url()));
  await page.clock.install();
  const fixture = await boot(page, baseURL!);
  await pauseClock(page);
  await page.clock.runFor(400);
  expect(fixture.requests.map((r) => r.path)).toEqual(["/api/bootstrap"]);
  expect(
    loaded.some((url) => /\.wasm(?:\?|$)|viptv_core|local-torrent/.test(url)),
  ).toBe(false);
});
test("D-pad focus updates without network requests and restores after details", async ({
  page,
  baseURL,
}) => {
  const fixture = await boot(page, baseURL!);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  const before = await screen(page).getAttribute("data-tv-focus");
  expect(fixture.requests).toHaveLength(1);
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "detail");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("Escape"); // Return to the remembered Home card.
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await expect(screen(page)).toHaveAttribute("data-tv-focus", before!);
});
test("Play requests server selection and displays ranked sources", async ({
  page,
  baseURL,
}) => {
  const fixture = await boot(page, baseURL!);
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some((r) => r.path.endsWith("/source-ranking")),
    )
    .toBe(true);
  expect(
    fixture.requests.find((r) => r.path.endsWith("/viewing-action"))?.body
      .restart,
  ).toBe(false);
  expect(fixture.requests.some((r) => /\/v[23]\//.test(r.path))).toBe(false);
  await page.keyboard.press("Escape"); // Hide controls.
  await page.keyboard.press("Escape"); // Leave playback.
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
});
test("catalogs and filters use the server control contract", async ({
  page,
  baseURL,
}) => {
  const fixture = await boot(page, baseURL!);
  await navigate(page, "movie");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "movie");
  await expect
    .poll(() => fixture.requests.some((r) => r.path === "/api/discover"))
    .toBe(true);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect
    .poll(
      () => fixture.requests.filter((r) => r.path === "/api/discover").length,
    )
    .toBeGreaterThanOrEqual(2);
});
test("profile changes clear the previous view and bootstrap the new scope", async ({
  page,
  baseURL,
}) => {
  const fixture = await boot(page, baseURL!);
  await navigate(page, "profiles");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "profiles");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  expect(
    fixture.requests.find((r) => r.path === "/api/auth/profile")?.body,
  ).toEqual({ profile_id: "2" });
  expect(
    fixture.requests.filter((r) => r.path === "/api/bootstrap"),
  ).toHaveLength(2);
});
test("settings save server-confirmed preference revisions", async ({
  page,
  baseURL,
}) => {
  const fixture = await boot(page, baseURL!);
  await navigate(page, "profiles");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "settings");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some(
        (r) => r.method === "PUT" && r.path.endsWith("/preferences"),
      ),
    )
    .toBe(true);
  expect(
    fixture.requests.find(
      (r) => r.method === "PUT" && r.path.endsWith("/preferences"),
    )?.body.revision,
  ).toBe(0);
});
test("pairing has server-issued code and no guest mode", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, {
    session: false,
  });
  await page.goto("/tv/?platform=vizio");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "welcome");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "pairing");
  await expect
    .poll(() =>
      fixture.requests.some((r) => r.path === "/api/auth/device/code"),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "welcome");
});
test("search uses server results after text input", async ({
  page,
  baseURL,
}) => {
  const fixture = await boot(page, baseURL!);
  await navigate(page, "search");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "search");
  await page.keyboard.type("monster");
  await expect
    .poll(
      () => fixture.requests.filter((r) => r.path === "/api/discover").length,
    )
    .toBeGreaterThan(0);
});
test("live guide remains silent until explicit playback", async ({
  page,
  baseURL,
}) => {
  const fixture = await boot(page, baseURL!);
  await navigate(page, "live");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "live");
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(() => fixture.requests.some((r) => r.path.endsWith("/guide")))
    .toBe(true);
  expect(fixture.requests.some((r) => r.path === "/api/playback")).toBe(false);
});
test("scaled TV layout retains remote navigation", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await boot(page, baseURL!);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await expect(screen(page)).toHaveAttribute("data-tv-focus", /^rows:1:/);
  expect(await page.locator("canvas").count()).toBeGreaterThan(0);
});

test("leaving Search cancels its scheduled work without changing the next screen", async ({
  page,
  baseURL,
}) => {
  await page.clock.install();
  const fixture = await boot(page, baseURL!);
  await navigate(page, "search");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "search");
  await pauseClock(page);
  await page.keyboard.type("test");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape"); // Hide controls.
  await page.keyboard.press("Escape"); // Leave playback.
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  // The debounce that would issue the discover request has to elapse and still find nothing to do.
  await page.clock.runFor(200);
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  expect(
    fixture.requests.filter((r) => r.path === "/api/discover"),
  ).toHaveLength(0);
});

test("real HLS playback reports frames/progress and releases the server lease", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, { media: true });
  await page.goto("/tv/?platform=vizio");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some((r) => r.path.endsWith("/source-ranking")),
    )
    .toBe(true);
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "player");
  await expectPlaybackProgress(page, 0.2);
  await expect
    .poll(() => fixture.requests.some((r) => r.path.endsWith("/first-frame")))
    .toBe(true);
  await page.keyboard.press("Escape"); // Hide controls.
  await page.keyboard.press("Escape"); // Leave playback.
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await expect
    .poll(() =>
      fixture.requests.some(
        (r) =>
          r.path === "/api/playback/fixture-playback" && r.method === "DELETE",
      ),
    )
    .toBe(true);
  expect(fixture.requests.some((r) => r.path.endsWith("/progress"))).toBe(true);
});
test("renewal refusal stops using the admitted media", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, {
    media: true,
    refuseRenewal: true,
  });
  await page.goto("/tv/?platform=vizio");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some((r) => r.path.endsWith("/source-ranking")),
    )
    .toBe(true);
  await page.keyboard.press("Enter");
  await expect
    .poll(() => fixture.requests.some((r) => r.path.endsWith("/heartbeat")))
    .toBe(true);
  await expect
    .poll(() =>
      page.locator("video").evaluate((v) => (v as HTMLVideoElement).paused),
    )
    .toBe(true);
});

test("Back cancels partial discovery and leaves its available rows usable", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, { finding: true });
  await page.goto("/tv/?platform=vizio");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some((r) => r.path.endsWith("/source-ranking")),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect
    .poll(() =>
      fixture.requests.some(
        (r) => r.path === "/api/streams/job-1" && r.method === "DELETE",
      ),
    )
    .toBe(true);
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
});
test("source quality selection is delegated to the server", async ({
  page,
  baseURL,
}) => {
  const fixture = await boot(page, baseURL!);
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some((r) => r.path.endsWith("/source-ranking")),
    )
    .toBe(true);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-source-menu", "quality");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some(
        (r) =>
          r.path.endsWith("/source-ranking") && r.body.quality_height === 2160,
      ),
    )
    .toBe(true);
});

test("Back releases an admitted replacement without opening its decoder after cleanup", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, {
    media: true,
    slowRelease: true,
  });
  const replacementMedia: string[] = [];
  page.on("request", request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/media/fixture-playback-2/")) replacementMedia.push(path);
  });
  const released = (id: string) => page.waitForResponse(response =>
    response.request().method() === "DELETE" && new URL(response.url()).pathname === `/api/playback/${id}`,
  );
  await page.clock.install();
  await page.goto("/tv/?platform=vizio");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some((r) => r.path.endsWith("/source-ranking")),
    )
    .toBe(true);
  await page.keyboard.press("Enter");
  await expectPlaybackProgress(page, 0.1);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect
    .poll(
      () =>
        fixture.requests.filter((r) => r.path.endsWith("/source-ranking"))
          .length,
    )
    .toBe(2);
  await page.keyboard.press("ArrowDown");
  const outgoingReleased = released("fixture-playback");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some(
        (r) =>
          r.path === "/api/playback/fixture-playback" && r.method === "DELETE",
      ),
    )
    .toBe(true);
  const admissions = () => fixture.requests.filter(request => request.path === "/api/playback");
  expect(admissions()).toHaveLength(2);
  expect(admissions()[1].body.replace_source).toMatchObject({ playback_id: "fixture-playback" });
  const replacementReleased = released("fixture-playback-2");
  await page.keyboard.press("Escape"); // Cancel the pending decoder handoff.
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await Promise.all([outgoingReleased, replacementReleased]);
  await pauseClock(page);
  await page.clock.runFor(500);
  expect(admissions()).toHaveLength(2);
  expect(replacementMedia).toEqual([]);
});

test("lease expiry stops cached media even while a heartbeat is stalled", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, {
    media: true,
    stallRenewal: true,
  });
  await page.goto("/tv/?platform=vizio");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some((r) => r.path.endsWith("/source-ranking")),
    )
    .toBe(true);
  await page.keyboard.press("Enter");
  await expectPlaybackProgress(page, 0.1);
  await expect
    .poll(() => fixture.requests.some((r) => r.path.endsWith("/heartbeat")))
    .toBe(true);
  await expect
    .poll(() =>
      fixture.requests.some(
        (r) =>
          r.path === "/api/playback/fixture-playback" && r.method === "DELETE",
      ),
    )
    .toBe(true);
  // The lease expiry is the app's own deadline; poll the media state it stops.
  await expect
    .poll(() => mediaPaused(page), { timeout: MEDIA_PROGRESS_TIMEOUT_MS })
    .toBe(true);
  expect(
    fixture.requests
      .filter((r) => r.path === "/api/playback")
      .length,
  ).toBe(1);
});

test("profile editor matches the supported fields and Back restores its child form", async ({
  page,
  baseURL,
}) => {
  await boot(page, baseURL!);
  await navigate(page, "profiles");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "profiles");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "choices");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "text");
  await page.keyboard.press("Escape");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "choices");
  await page.keyboard.press("Escape");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "");
});
test("source focus survives incremental reranking and user input cancels automatic selection", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, {
    finding: true,
    best: true,
    media: true,
  });
  await page.clock.install();
  await page.goto("/tv/?platform=vizio");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some((r) => r.path.endsWith("/source-ranking")),
    )
    .toBe(true);
  await expect(screen(page)).toHaveAttribute("data-tv-sources", "8");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowDown");
  await expect(screen(page)).toHaveAttribute("data-tv-source-choice", "1");
  fixture.addBestSource();
  // The renderer now runs a 60 fps loop; give the frozen clock one frame so
  // the discovery update is painted and focus can follow the new best source.
  await page.clock.runFor(32);
  await expect(screen(page)).toHaveAttribute("data-tv-source-choice", "1");
  await expect(screen(page)).toHaveAttribute("data-tv-source-identity", "stream-1");
  fixture.completeDiscovery();
  await expect(screen(page)).not.toHaveAttribute(
    "data-tv-source-status",
    "discovering",
  );
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "sources");
  await pauseClock(page);
  await page.clock.runFor(500);
  expect(fixture.requests.some((r) => r.path === "/api/playback")).toBe(false);
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some(
        (r) => r.path === "/api/playback" && r.body.stream_id === "stream-1",
      ),
    )
    .toBe(true);
});
test("a server-side profile change is adopted before the next viewing intent", async ({
  page,
  baseURL,
}) => {
  await page.clock.install();
  const fixture = await boot(page, baseURL!);
  fixture.setProfile("2");
  await page.clock.fastForward(16000);
  await expect
    .poll(
      () => fixture.requests.filter((r) => r.path === "/api/bootstrap").length,
    )
    .toBeGreaterThanOrEqual(2);
  await page.keyboard.press("Enter");
  await page.clock.runFor(32);
  await expect
    .poll(() =>
      fixture.requests.some((r) => r.path === "/api/profiles/2/viewing-action"),
    )
    .toBe(true);
});
test("loading My List cannot activate stale cards from the previous catalog", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, {
    delayLibrary: true,
  });
  await page.goto("/tv/?platform=vizio");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await navigate(page, "movie");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "library");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  expect(fixture.requests.some((r) => r.path.startsWith("/api/meta/"))).toBe(
    false,
  );
});
test("the 700ms hold opens the menu before release and cannot activate twice", async ({
  page,
  baseURL,
}) => {
  await page.clock.install();
  const fixture = await boot(page, baseURL!);
  await pauseClock(page);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.down("Enter");
  await page.clock.runFor(750);
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "choices");
  await page.keyboard.up("Enter");
  expect(fixture.requests.some((r) => r.path.startsWith("/api/meta/"))).toBe(
    false,
  );
});

test("normal-motion source drawers enter and exit at their reference bounds", async ({
  page,
  baseURL,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install();
  await installRemoteBackend(page, baseURL!);
  await page.goto("/tv/?platform=vizio&focusdebug=1");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.clock.pauseAt(
    new Date(await page.evaluate(() => Date.now() + 1000)),
  );
  const paneX = () =>
    page.evaluate(() => {
      let x: number | undefined;
      const visit = (node: any) => {
        if (
          node.props?.w === 960 &&
          node.props?.h === 1080 &&
          node.props?.color === 0x161618ff
        )
          x = node.props.x;
        node.children?.forEach(visit);
      };
      visit((window as any).__viptvRenderer.stage.root);
      return x;
    });
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "sources");
  await page.clock.runFor(50);
  expect(await paneX()).toBeGreaterThan(960);
  await page.clock.runFor(300);
  expect(await paneX()).toBeCloseTo(960, 0);
  await page.keyboard.press("Escape");
  await page.clock.runFor(100);
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "sources");
  expect(await paneX()).toBeGreaterThan(960);
  expect(await paneX()).toBeLessThan(1920);
  await page.clock.runFor(150);
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "");
  await expect(screen(page)).toHaveAttribute("data-tv-focus", /^hero:0:/);
  expect(await paneX()).toBeUndefined();
});

test("long add-on lists stay visible and profile activation uses a server intent", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, { addons: 12 });
  await page.goto("/tv/?platform=vizio&focusdebug=1");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await navigate(page, "profiles");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "settings");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowRight");
  for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowDown");
  await expect(screen(page)).toHaveAttribute(
    "data-tv-focus",
    /^settings-content:8:/,
  );
  const settingsRows = () =>
    page.evaluate(() => {
      const result: number[] = [];
      const visit = (node: any) => {
        if (
          node.props?.w === 1184 &&
          node.props?.h === 96 &&
          node.props?.color === 0xf4f2eeff &&
          node.isRenderable
        )
          result.push(node.absY);
        node.children?.forEach(visit);
      };
      visit((window as any).__viptvRenderer.stage.root);
      return result;
    });
  await expect
    .poll(
      async () =>
        (await settingsRows()).some((y) => y >= 220 && y < 980),
      { timeout: 10_000 },
    )
    .toBe(true);
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "choices");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some(
        (r) =>
          r.path.endsWith("/addon-activation") &&
          r.method === "PUT" &&
          r.body.connection_id === "addon:8" &&
          r.body.enabled === false,
      ),
    )
    .toBe(true);
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("Escape");
  await expect(screen(page)).toHaveAttribute("data-tv-focus", /^settings-nav:/);
  await page.keyboard.press("Escape"); // Hide controls.
  await page.keyboard.press("Escape"); // Leave playback.
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
});
test("live favourites are confirmed by the server without entering VOD metadata flows", async ({
  page,
  baseURL,
}) => {
  const fixture = await boot(page, baseURL!);
  await navigate(page, "live");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "live");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ContextMenu");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "choices");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some(
        (r) =>
          r.path.endsWith("/live/channel-0/favorite") && r.method === "PUT",
      ),
    )
    .toBe(true);
  expect(fixture.requests.some((r) => r.path.startsWith("/api/meta/"))).toBe(
    false,
  );
});

test("the remote keyboard can enter URL punctuation and case-sensitive credentials", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, {
    rejectAddon: true,
  });
  await page.goto("/tv/?platform=vizio");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await navigate(page, "profiles");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "text");
  let current = 0;
  const hit = async (target: number) => {
    while (Math.floor(current / 6) < Math.floor(target / 6)) {
      await page.keyboard.press("ArrowDown");
      current += 6;
    }
    while (Math.floor(current / 6) > Math.floor(target / 6)) {
      await page.keyboard.press("ArrowUp");
      current -= 6;
    }
    while (current < target) {
      await page.keyboard.press("ArrowRight");
      current++;
    }
    while (current > target) {
      await page.keyboard.press("ArrowLeft");
      current--;
    }
    await page.keyboard.press("Enter");
  };
  for (const index of [7, 19, 19, 15, 18, 39, 38, 38, 42, 0, 42, 37, 8, 14, 46])
    await hit(index);
  await expect
    .poll(() =>
      fixture.requests.some(
        (r) =>
          r.path === "/api/addons" &&
          r.method === "POST" &&
          r.body.manifest_url === "https://A.io",
      ),
    )
    .toBe(true);
  expect(
    fixture.requests.some(
      (r) => r.path.endsWith("/addon-activation") && r.method === "PUT",
    ),
  ).toBe(false);
});
test("Home hero context actions cannot reuse a hidden catalog card", async ({
  page,
  baseURL,
}) => {
  const fixture = await boot(page, baseURL!);
  await navigate(page, "movie");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape"); // Hide controls.
  await page.keyboard.press("Escape"); // Leave playback.
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await page.keyboard.press("ContextMenu");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "choices");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some((r) => r.path === "/api/meta/movie/tt-oak-street"),
    )
    .toBe(true);
});
