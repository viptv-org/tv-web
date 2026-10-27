import { test, expect, type Page } from "@playwright/test";
import { installRemoteBackend } from "../preview/remote-backend";
const screen = (page: Page) => page.locator("html");
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
  await navigate(page, 6);
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
  await page.keyboard.press("ArrowUp");
  await expect(screen(page)).toHaveAttribute("data-tv-focus", /^seasons:/);
  await page.keyboard.press("ArrowRight");
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
  return fixture;
}
async function navigate(page: Page, index: number) {
  await page.keyboard.press("ArrowUp");
  for (let i = 1; i < index; i++) await page.keyboard.press("ArrowRight");
  for (let i = index; i < 1; i++) await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
}

test("TV startup loads one server bootstrap and no legacy engine", async ({
  page,
  baseURL,
}) => {
  const loaded: string[] = [];
  page.on("request", (r) => loaded.push(r.url()));
  const fixture = await boot(page, baseURL!);
  await page.waitForTimeout(400);
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
  await page.keyboard.press("Escape");
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
  await page.keyboard.press("Escape");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
});
test("catalogs and filters use the server control contract", async ({
  page,
  baseURL,
}) => {
  const fixture = await boot(page, baseURL!);
  await navigate(page, 2);
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
  await navigate(page, 6);
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
  await navigate(page, 6);
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
  await page.waitForTimeout(100);
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
  await navigate(page, 0);
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
  await navigate(page, 4);
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
  const fixture = await boot(page, baseURL!);
  await navigate(page, 0);
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "search");
  await page.keyboard.type("test");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await page.waitForTimeout(350);
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
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((v) => (v as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThan(0.2);
  await expect
    .poll(() => fixture.requests.some((r) => r.path.endsWith("/first-frame")))
    .toBe(true);
  await page.keyboard.press("Escape");
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
  await page.keyboard.press("ArrowRight");
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

test("Back during source replacement cannot start another lease after release finishes", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, {
    media: true,
    slowRelease: true,
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
    .poll(() =>
      page
        .locator("video")
        .evaluate((video) => (video as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThan(0.1);
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
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some(
        (r) =>
          r.path === "/api/playback/fixture-playback" && r.method === "DELETE",
      ),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await page.waitForTimeout(500);
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  expect(
    fixture.requests.filter((r) => r.path === "/api/playback"),
  ).toHaveLength(1);
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
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((video) => (video as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThan(0.1);
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
  await page.waitForTimeout(3200);
  expect(
    await page
      .locator("video")
      .evaluate((video) => (video as HTMLVideoElement).paused),
  ).toBe(true);
  expect(
    fixture.requests.filter((r) => r.path === "/api/playback"),
  ).toHaveLength(1);
});

test("profile editor matches the supported fields and Back restores its child form", async ({
  page,
  baseURL,
}) => {
  await boot(page, baseURL!);
  await navigate(page, 6);
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
  await page.goto("/tv/?platform=vizio");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some((r) => r.path.endsWith("/source-ranking")),
    )
    .toBe(true);
  await page.keyboard.press("ArrowDown");
  fixture.addBestSource();
  await expect(screen(page)).toHaveAttribute("data-tv-focus", /:2$/);
  fixture.completeDiscovery();
  await page.waitForTimeout(500);
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
  await navigate(page, 2);
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
  const fixture = await boot(page, baseURL!);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.down("Enter");
  await page.waitForTimeout(750);
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
  await installRemoteBackend(page, baseURL!);
  await page.goto("/tv/?platform=vizio&focusdebug=1");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
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
  await page.waitForTimeout(50);
  expect(await paneX()).toBeGreaterThan(960);
  await page.waitForTimeout(350);
  expect(await paneX()).toBeCloseTo(960, 0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(40);
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "sources");
  await page.waitForTimeout(250);
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "");
  await expect(screen(page)).toHaveAttribute("data-tv-focus", /^hero:0:/);
});

test("long add-on lists stay visible and profile activation uses a server intent", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, { addons: 12 });
  await page.goto("/tv/?platform=vizio&focusdebug=1");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await navigate(page, 6);
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
  const rows = await page.evaluate(() => {
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
  expect(rows.some((y) => y >= 220 && y < 980)).toBe(true);
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
  await page.keyboard.press("Escape");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
});
test("live favourites are confirmed by the server without entering VOD metadata flows", async ({
  page,
  baseURL,
}) => {
  const fixture = await boot(page, baseURL!);
  await navigate(page, 4);
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
  await navigate(page, 6);
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
  await navigate(page, 2);
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
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
