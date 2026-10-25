import { test, expect, type Page } from "@playwright/test";
import { installRemoteBackend } from "../preview/remote-backend";
const screen = (page: Page) => page.locator("html");
test("Live consumes the named best source and an explicit source change still requires selection", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, {
    media: true,
    best: true,
  });
  await page.goto("/tv/?platform=vizio");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  for (const key of [
    "ArrowUp",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "Enter",
  ])
    await page.keyboard.press(key);
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "live");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  expect(fixture.requests.some((r) => r.path === "/api/playback")).toBe(false);
  await page.keyboard.press("Enter");
  await expect
    .poll(
      () => fixture.requests.filter((r) => r.path === "/api/playback").length,
    )
    .toBe(1);
  expect(
    fixture.requests.find((r) => r.path === "/api/playback")?.body.stream_id,
  ).toBe("live-stream-1");
  expect(
    fixture.requests.find((r) => r.path.endsWith("/source-ranking"))?.body.ids,
  ).toEqual(["live-stream-0", "live-stream-1"]);
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((v) => (v as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThan(0.2);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "sources");
  await expect(screen(page)).toHaveAttribute("data-tv-sources", "2");
  await page.waitForTimeout(200);
  expect(fixture.requests.filter((r) => r.path === "/api/playback")).toHaveLength(1);
  await page.keyboard.press("Enter");
  await expect
    .poll(() => fixture.requests.filter((r) => r.path === "/api/playback").length)
    .toBe(2);
  expect(
    fixture.requests.filter((r) => r.path === "/api/playback")[1].body.stream_id,
  ).toBe("live-stream-0");
});
async function play(page: Page, live = false) {
  await page.goto("/tv/?platform=vizio&focusdebug=1");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  if (live) {
    await page.keyboard.press("ArrowUp");
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(screen(page)).toHaveAttribute("data-tv-screen", "live");
    await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  }
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute(
    "data-tv-sources",
    live ? "2" : "8",
  );
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((video) => (video as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThan(0.2);
}
async function timelineCount(page: Page) {
  return page.evaluate(() => {
    let count = 0;
    const visit = (node: any) => {
      if (
        node.isRenderable &&
        node.props?.w === 1728 &&
        node.props?.h === 8 &&
        node.absY === 936
      )
        count++;
      node.children?.forEach(visit);
    };
    visit((window as any).__viptvRenderer.stage.root);
    return count;
  });
}
test("Live track selection sends an observation for server replacement without requesting a VOD seek", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, {
    media: true,
    captionTracks: true,
  });
  await play(page, true);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "tracks");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect
    .poll(
      () => fixture.requests.filter((r) => r.path === "/api/playback").length,
    )
    .toBe(2);
  const request = fixture.requests.filter((r) => r.path === "/api/playback")[1]
    .body;
  expect(request.subtitles_off).toBe(true);
  expect(request.position).toBe(0);
  expect(request.replace_source.playback_id).toBe("fixture-playback");
  expect(request.replace_source.observed_position).toBeGreaterThan(0);
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "");
});
test("definitive authentication loss during a player mutation stops media and clears the profile view", async ({
  page,
  baseURL,
}) => {
  await installRemoteBackend(page, baseURL!, {
    media: true,
    captionTracks: true,
    expireOnPreference: true,
  });
  await play(page);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "tracks");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "welcome");
  await expect(screen(page)).toHaveAttribute("data-tv-sources", "0");
  expect(
    await page
      .locator("video")
      .evaluate((video) => (video as HTMLVideoElement).paused),
  ).toBe(true);
  expect(
    await page.evaluate(
      (origin) => localStorage.getItem(`viptv-device:${origin}`),
      baseURL!,
    ),
  ).toBeNull();
});

test("queued playback observations cannot run under a newly paired session", async ({
  page,
  baseURL,
}) => {
  await installRemoteBackend(page, baseURL!, {
    media: true,
    captionTracks: true,
    expireOnPreference: true,
    pairingApproved: true,
  });
  let release!: () => void;
  let progress = 0;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/profiles/1/progress", async (route) => {
    progress++;
    await held;
    await route.fulfill({ json: { completed: false } }).catch(() => {});
  });
  await play(page);
  await expect.poll(() => progress).toBe(1);
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "MediaPause", bubbles: true }),
    ),
  );
  await expect
    .poll(() =>
      page.locator("video").evaluate((v) => (v as HTMLVideoElement).paused),
    )
    .toBe(true);
  for (const key of ["ArrowUp", "Enter", "ArrowRight", "Enter"])
    await page.keyboard.press(key);
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "welcome");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "signed-in", {
    timeout: 5000,
  });
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  release();
  await page.waitForTimeout(150);
  expect(progress).toBe(1);
});
test("track focus follows server selection and confirmed subtitle size changes the active decoder style", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, {
    media: true,
    captionTracks: true,
  });
  await play(page);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "tracks");
  await expect(screen(page)).toHaveAttribute("data-tv-focus", /:1$/);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some(
        (r) =>
          r.path.endsWith("/preferences") &&
          r.method === "PUT" &&
          r.body.preferences.subtitle_font_scale === 1.25,
      ),
    )
    .toBe(true);
  await expect
    .poll(() => page.locator("#tv-caption-style").textContent())
    .toContain("font-size: 2.75vw");
});
test("a failed source replacement retains its server-bound intent for a later explicit selection", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, {
    media: true,
    failReplacementOnce: true,
  });
  await play(page);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-sources", "8");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect
    .poll(
      () => fixture.requests.filter((r) => r.path === "/api/playback").length,
    )
    .toBe(2);
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  expect(
    await page.locator("video").evaluate((v) => (v as HTMLVideoElement).paused),
  ).toBe(true);
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "sources");
  await expect(screen(page)).toHaveAttribute("data-tv-sources", "8");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("Escape"); // Cancellation restores the failed-player state.
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "sources");
  await expect(screen(page)).toHaveAttribute("data-tv-sources", "8");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect
    .poll(
      () => fixture.requests.filter((r) => r.path === "/api/playback").length,
    )
    .toBe(3);
  const attempts = fixture.requests.filter((r) => r.path === "/api/playback");
  expect(attempts[2].body.stream_id).toBe("stream-2");
  expect(attempts[2].body.replace_source).toEqual(
    attempts[1].body.replace_source,
  );
  await expect
    .poll(() =>
      page.locator("video").evaluate((v) => (v as HTMLVideoElement).paused),
    )
    .toBe(false);
});
test("Live uses advertised actions, never writes VOD progress, and changes sources through the same channel", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, { media: true });
  await play(page, true);
  await expect.poll(() => timelineCount(page)).toBe(0);
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "MediaPause",
        keyCode: 19,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  expect(
    await page
      .locator("video")
      .evaluate((video) => (video as HTMLVideoElement).paused),
  ).toBe(false);
  expect(
    fixture.requests.some(
      (r) =>
        r.path.endsWith("/progress") || r.path.endsWith("/playback-events"),
    ),
  ).toBe(false);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "sources");
  await expect(screen(page)).toHaveAttribute("data-tv-sources", "2");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect
    .poll(
      () => fixture.requests.filter((r) => r.path === "/api/playback").length,
    )
    .toBe(2);
  const replacement = fixture.requests.filter(
    (r) => r.path === "/api/playback",
  )[1].body;
  expect(replacement.stream_id).toBe("live-stream-1");
  expect(replacement.replace_source.playback_id).toBe("fixture-playback");
  expect(replacement.replace_source.observed_position).toBeGreaterThan(0);
  expect(
    fixture.requests.filter((r) => r.path.endsWith("/live/channel-0/sources")),
  ).toHaveLength(2);
  expect(
    fixture.requests.some(
      (r) => r.path === "/api/streams" || r.path.endsWith("/viewing-action"),
    ),
  ).toBe(false);
});

test("manual replacement reports the admitted clock and executes the server-returned start position", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, {
    media: true,
    replacementPosition: 0.25,
  });
  await page.addInitScript(() => {
    (window as any).__mediaSeekTargets = [];
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      "currentTime",
    )!;
    Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
      ...descriptor,
      set(value) {
        (window as any).__mediaSeekTargets.push(value);
        descriptor.set!.call(this, value);
      },
    });
  });
  await play(page);
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((video) => (video as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThan(1);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-sources", "8");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  const observedBeforeSelection = await page
    .locator("video")
    .evaluate((video) => (video as HTMLVideoElement).currentTime);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect
    .poll(
      () => fixture.requests.filter((r) => r.path === "/api/playback").length,
    )
    .toBe(2);
  const request = fixture.requests.filter((r) => r.path === "/api/playback")[1]
    .body;
  expect(request.replace_source.playback_id).toBe("fixture-playback");
  expect(request.replace_source.observed_position).toBeGreaterThan(0.2);
  expect(
    Math.abs(
      request.replace_source.observed_position - observedBeforeSelection,
    ),
  ).toBeLessThan(0.5);
  expect(request.position).toBe(0);
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__mediaSeekTargets.includes(0.25)),
    )
    .toBe(true);
});

test("a VOD decoder also obeys explicit server refusal of pause and seek", async ({
  page,
  baseURL,
}) => {
  const fixture = await installRemoteBackend(page, baseURL!, {
    media: true,
    playbackActions: {
      pause: false,
      seek: false,
      restart: false,
      change_source: false,
      episodes: false,
      next_episode: false,
      tracks: false,
      subtitle_style: false,
    },
  });
  await play(page);
  await expect.poll(() => timelineCount(page)).toBe(0);
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "MediaPause",
        keyCode: 19,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  expect(
    await page
      .locator("video")
      .evaluate((video) => (video as HTMLVideoElement).paused),
  ).toBe(false);
  expect(
    fixture.requests.filter((r) => r.path === "/api/playback"),
  ).toHaveLength(1);
});
