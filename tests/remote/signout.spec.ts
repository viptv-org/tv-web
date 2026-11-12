import { test, expect } from "@playwright/test";
import { installRemoteBackend } from "../preview/remote-backend";

test("this-TV sign-out sends JSON and clears its grant only after server acknowledgement", async ({ page, baseURL }) => {
  const fixture = await installRemoteBackend(page, baseURL!, { session: false });
  await page.addInitScript(origin => {
    if (!sessionStorage.getItem("signout-grant-seeded")) {
      localStorage.setItem(`viptv-device:${origin}`, JSON.stringify({ accessToken: "fixture-access", refreshToken: "fixture-refresh" }));
      sessionStorage.setItem("signout-grant-seeded", "true");
    }
  }, baseURL!);
  let acknowledge!: () => void;
  const acknowledged = new Promise<void>((resolve) => { acknowledge = resolve; });
  let requested = false;
  await page.route("**/api/auth/logout", async route => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["content-type"]).toBe("application/json");
    expect(route.request().postDataJSON()).toEqual({});
    requested = true;
    await acknowledged;
    await route.fallback();
  });
  await page.goto("/tv/?platform=vizio&focusdebug=1");
  const state = page.locator("html");
  await expect(state).toHaveAttribute("data-tv-screen", "home");
  await expect(state).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowUp");
  const navigation = (await state.getAttribute("data-tv-navigation"))!.split(",");
  const current = Number((await state.getAttribute("data-tv-focus"))!.split(":")[1]);
  for (let i = current; i < navigation.indexOf("profiles"); i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(state).toHaveAttribute("data-tv-overlay", "choices");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(state).toHaveAttribute("data-tv-screen", "settings");
  await expect(state).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowUp");
  await expect(state).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowUp");
  await expect(state).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(state).toHaveAttribute("data-tv-overlay", "confirm");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect.poll(() => requested).toBe(true);
  const grant = () => page.evaluate(origin => localStorage.getItem(`viptv-device:${origin}`), baseURL!);
  expect(await grant()).not.toBeNull();
  await expect(state).toHaveAttribute("data-tv-screen", "settings");
  acknowledge();
  await expect(state).toHaveAttribute("data-tv-screen", "welcome");
  expect(await grant()).toBeNull();
  expect(fixture.requests.filter(r => r.path === "/api/auth/logout")).toHaveLength(1);
  expect(fixture.requests.some(r => /\/auth\/(?:sessions|device\/revoke)/.test(r.path))).toBe(false);
  await page.reload();
  await expect(state).toHaveAttribute("data-tv-screen", "welcome");
});
