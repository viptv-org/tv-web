import { test, expect, type Page } from "@playwright/test";
import { installRemoteBackend } from "../preview/remote-backend";

const selectionNotes = [
  "Play starts the best match. Change how it’s chosen in Settings › Playback.",
  "Choose a source to start playback. Change your default in Settings › Playback.",
];

async function visibleTexts(page: Page) {
  return page.evaluate(() => {
    const texts: string[] = [];
    const visit = (node: any) => {
      if (node.isRenderable && node.viptvText) texts.push(node.viptvText);
      node.children?.forEach(visit);
    };
    visit((window as any).__viptvRenderer.stage.root);
    return texts;
  });
}

for (const selectionNote of selectionNotes) {
  test(`source picker omits the retired server hint: ${selectionNote}`, async ({
    page,
    baseURL,
  }, testInfo) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const fixture = await installRemoteBackend(page, baseURL!, {
      finding: true,
      media: true,
    });
    await page.route("**/api/profiles/*/source-ranking", (route) =>
      route.fulfill({
        json: {
          streams: ["Fixture source A", "Fixture source B"].map(
            (title, index) => ({
              id: `stream-${index}`,
              name: title,
              quality_height: 1080,
              presentation: { provider_name: title },
              view: {
                title,
                body: "WEB-DL · H.264 · AAC",
                quality_label: "1080p",
              },
            }),
          ),
          best_match_id: "stream-0",
          quality_filters: [],
          total: 2,
          selection_note: selectionNote,
        },
      }),
    );
    await page.goto("/tv/?platform=vizio&focusdebug=1");
    const screen = page.locator("html");
    await expect(screen).toHaveAttribute("data-tv-screen", "home");
    await expect(screen).toHaveAttribute("data-tv-ready", "true");
    const priorFocus = await screen.getAttribute("data-tv-focus");
    await page.keyboard.press("Enter");
    await expect(screen).toHaveAttribute("data-tv-overlay", "sources");
    await expect.poll(() => visibleTexts(page)).toContain("Fixture source A");
    await expect.poll(() => visibleTexts(page)).toContain("Fixture source B");
    await expect
      .poll(() => visibleTexts(page))
      .toContain("Still checking sources");
    expect(await visibleTexts(page)).not.toContain(selectionNote);

    fixture.completeDiscovery();
    await expect
      .poll(() => visibleTexts(page))
      .not.toContain("Still checking sources");
    expect(await visibleTexts(page)).not.toContain(selectionNote);
    await page.screenshot({ path: testInfo.outputPath("source-picker.png") });
    await page.keyboard.press("Escape");
    await expect(screen).toHaveAttribute("data-tv-overlay", "");
    await expect(screen).toHaveAttribute("data-tv-screen", "home");
    await expect(screen).toHaveAttribute("data-tv-focus", priorFocus!);

    await page.keyboard.press("Enter");
    await expect(screen).toHaveAttribute("data-tv-overlay", "sources");
    await expect.poll(() => visibleTexts(page)).toContain("Fixture source B");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect
      .poll(() =>
        fixture.requests.some(
          (request) =>
            request.path === "/api/playback" &&
            request.body.stream_id === "stream-1",
        ),
      )
      .toBe(true);
    await expect(screen).toHaveAttribute("data-tv-screen", "player");
  });
}
