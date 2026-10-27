import { test, expect, type Page } from "@playwright/test";
import { installRemoteBackend } from "../preview/remote-backend";

const screen = (page: Page) => page.locator("html");
const nodes = (page: Page) =>
  page.evaluate(() => {
    const result: {
      x: number;
      y: number;
      w: number;
      h: number;
      text?: string;
      color: number;
      alpha: number;
    }[] = [];
    const visit = (n: any) => {
      if (n.isRenderable)
        result.push({
          x: n.absX,
          y: n.absY,
          w: n.props.w,
          h: n.props.h,
          text: n.viptvText,
          color: n.props.color,
          alpha: n.worldAlpha,
        });
      n.children?.forEach(visit);
    };
    visit((window as any).__viptvRenderer.stage.root);
    return result;
  });

async function boot(page: Page, origin: string) {
  const fixture = await installRemoteBackend(page, origin);
  await page.goto("/tv/?platform=vizio&focusdebug=1");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  return fixture;
}
async function navigate(page: Page, index: number) {
  await page.keyboard.press("ArrowUp");
  for (let i = 1; i < index; i++) await page.keyboard.press("ArrowRight");
  for (let i = index; i < 1; i++) await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
}
/** Open Settings and enter the given tab's content (Playback loads first;
 * nav movement tracks the loaded tab, so tab N is N-2 ArrowDowns away). */
async function openSettingsTab(page: Page, tab: number) {
  await navigate(page, 6);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "settings");
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  for (let i = 2; i < tab; i++) {
    await page.keyboard.press("ArrowDown");
    await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  }
  await page.keyboard.press("ArrowRight");
}

test("settings nav shows the boards' nine sections with icons in order", async ({
  page,
  baseURL,
}) => {
  await boot(page, baseURL!);
  await navigate(page, 6);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "settings");
  let labels: { text?: string; y: number }[] = [];
  await expect
    .poll(async () => {
      labels = (await nodes(page)).filter(
        (n) =>
          n.text &&
          n.x === 142 &&
          [
            "Account",
            "Profiles",
            "Playback",
            "Subtitles & audio",
            "Add-ons",
            "Source integrations",
            "Display",
            "Parental controls",
            "About",
          ].includes(n.text),
      );
      return labels.length;
    })
    .toBe(9);
  expect(labels.map((n) => n.text)).toEqual([
    "Account",
    "Profiles",
    "Playback",
    "Subtitles & audio",
    "Add-ons",
    "Source integrations",
    "Display",
    "Parental controls",
    "About",
  ]);
  const ys = labels.map((n) => n.y);
  for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBe(80);
  expect(ys[0]).toBeGreaterThanOrEqual(196);
  expect(ys[0]).toBeLessThan(232);
  // Each row carries its board icon (28px) 24px in from the row at x=72,
  // vertically centred within the 72px row (row top + 22).
  let iconCount = 0;
  await expect
    .poll(async () => {
      iconCount = (await nodes(page)).filter(
        (n) =>
          n.w === 28 &&
          n.h === 28 &&
          n.x === 96 &&
          !n.text &&
          n.y >= 218 &&
          n.y <= 196 + 8 * 80 + 22,
      ).length;
      return iconCount;
    })
    .toBe(9);
});

test("display tab renders the board rows and adjusts the accent inline", async ({
  page,
  baseURL,
}) => {
  const fixture = await boot(page, baseURL!);
  await openSettingsTab(page, 6);
  await expect(screen(page)).toHaveAttribute(
    "data-tv-focus",
    /^settings-content:0:/,
  );
  await expect
    .poll(async () => {
      const texts = (await nodes(page))
        .map((n) => n.text)
        .filter((t): t is string => !!t);
      return [
        "Accent colour",
        "Progress bars, marks and toggles",
        "Show ratings on cards",
        "★ 7.8 under focused titles",
        "Text size",
        "Reduce motion",
        "Follow TV",
        "Screen saver",
        "After 5 minutes",
        "Fit to screen",
        "Use if the edges of the picture are cut off",
      ].every((label) => texts.includes(label));
    })
    .toBe(true);
  // Four accent swatches sit inside the focused first row.
  const swatches = (await nodes(page)).filter(
    (n) => n.w === 44 && n.h === 44 && n.y === 246,
  );
  expect(swatches.map((n) => n.x)).toEqual([1566, 1628, 1690, 1752]);
  // Amber #F5C542 is selected; Right cycles to Coral and confirms remotely.
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() =>
      fixture.requests.some(
        (r) =>
          r.method === "PUT" &&
          r.path.endsWith("/preferences") &&
          r.body?.display?.accent_color === "#FF8B5C",
      ),
    )
    .toBe(true);
  // The accent immediately re-themes accent-driven surfaces (toggle pill).
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
  await expect
    .poll(async () => {
      const pill = (await nodes(page)).find(
        (n) => n.w === 68 && n.h === 38 && n.x === 1728 && n.y === 357,
      );
      return pill?.color;
    })
    .toBe(0xff8b5cff);
});

test("the ratings toggle writes the server preference on OK", async ({
  page,
  baseURL,
}) => {
  const fixture = await boot(page, baseURL!);
  await openSettingsTab(page, 6);
  await page.keyboard.press("ArrowDown");
  await expect(screen(page)).toHaveAttribute(
    "data-tv-focus",
    /^settings-content:1:/,
  );
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some(
        (r) =>
          r.method === "PUT" &&
          r.path.endsWith("/preferences") &&
          r.body?.display?.show_ratings === false,
      ),
    )
    .toBe(true);
  await expect(screen(page)).toHaveAttribute("data-tv-ready", "true");
});

test("choice controls use the server inventory and fit-to-screen calibrates live", async ({
  page,
  baseURL,
}) => {
  const fixture = await boot(page, baseURL!);
  await openSettingsTab(page, 6);
  // Text size row: the choice overlay offers the producer's three choices.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "choices");
  // Freshly opened overlay labels rasterize over the next committed frames.
  await expect
    .poll(async () => {
      const texts = (await nodes(page))
        .map((n) => n.text)
        .filter((t): t is string => !!t);
      return ["Small", "Default", "Large"].every((c) => texts.includes(c));
    })
    .toBe(true);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some(
        (r) =>
          r.method === "PUT" &&
          r.path.endsWith("/preferences") &&
          r.body?.display?.text_size === "large",
      ),
    )
    .toBe(true);
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "");
  // The 1.25 text scale rasterizes larger labels without layout changes.
  await expect
    .poll(async () => {
      const label = (await nodes(page)).find(
        (n) => n.text === "Display" && n.x === 640,
      );
      return label?.h ?? 0;
    })
    .toBeGreaterThan(46);

  // Fit to screen: calibration adjusts the stage inset live and Back cancels.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(screen(page)).toHaveAttribute(
    "data-tv-focus",
    /^settings-content:4:/,
  );
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "calibration");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() =>
      page.evaluate(
        () => document.getElementById("app")!.style.transform,
      ),
    )
    .toBe("scale(0.96)");
  await page.keyboard.press("Escape");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "");
  await expect
    .poll(() =>
      page.evaluate(
        () => document.getElementById("app")!.style.transform,
      ),
    )
    .toBe("");
  // No write moved the inset away from the server-saved zero.
  expect(
    fixture.requests.some(
      (r) =>
        r.method === "PUT" &&
        r.path.endsWith("/preferences") &&
        (r.body?.display?.screen_inset ?? 0) > 0,
    ),
  ).toBe(false);
  // OK confirms instead.
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "calibration");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some(
        (r) =>
          r.method === "PUT" &&
          r.path.endsWith("/preferences") &&
          r.body?.display?.screen_inset === 1,
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.getElementById("app")!.style.transform,
      ),
    )
    .toBe("scale(0.98)");
});

test("the screen saver dims to slow art after the server-set idle minutes", async ({
  page,
  baseURL,
}) => {
  await page.clock.install();
  const fixture = await boot(page, baseURL!);
  await openSettingsTab(page, 6);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(screen(page)).toHaveAttribute("data-tv-overlay", "choices");
  // Choose "After 2 minutes": Off -> 2 -> 5 -> 10 order, index 1.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      fixture.requests.some(
        (r) =>
          r.method === "PUT" &&
          r.path.endsWith("/preferences") &&
          r.body?.display?.screen_saver_minutes === 2,
      ),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  // Idle past the server-set minutes dims to the saver; the wake key only
  // dismisses it and is not delivered to the app.
  const focus = await screen(page).getAttribute("data-tv-focus");
  await page.clock.fastForward(2 * 60 * 1000 + 20 * 1000);
  await expect(screen(page)).toHaveAttribute("data-tv-saver", "true");
  await page.keyboard.press("ArrowDown");
  await expect(screen(page)).toHaveAttribute("data-tv-saver", "false");
  await expect(screen(page)).toHaveAttribute("data-tv-screen", "home");
  await expect(screen(page)).toHaveAttribute("data-tv-focus", focus!);
});
