import { expect, test } from "@playwright/test";
import { installRemoteBackend } from "../preview/remote-backend";

for (const quotaFailure of [false, true]) {
  test(`legacy browser preserves rotated authentication${quotaFailure ? " when storage writes fail" : " across reload"}`, async ({ page, baseURL }) => {
    await installRemoteBackend(page, baseURL!, { session: false });
    await page.addInitScript(({ origin, quotaFailure }) => {
      Object.defineProperty(navigator, "locks", { value: undefined });
      const key = `viptv-device:${origin}`;
      if (!sessionStorage.getItem("session-test-seeded")) {
        localStorage.setItem(key, JSON.stringify({ accessToken: "old", refreshToken: "refresh-old" }));
        sessionStorage.setItem("session-test-seeded", "true");
      }
      if (quotaFailure) {
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name, value) {
          if (name === key) throw new DOMException("Full", "QuotaExceededError");
          return setItem.call(this, name, value);
        };
      }
    }, { origin: baseURL!, quotaFailure });
    const rotations: string[] = [];
    let validAccess = "expired";
    await page.route("**/api/**", async route => {
      const request = route.request();
      if (new URL(request.url()).pathname === "/api/auth/device/refresh") {
        rotations.push(request.postDataJSON().refresh_token);
        validAccess = `access-${rotations.length}`;
        return route.fulfill({ json: { access_token: validAccess, refresh_token: `refresh-${rotations.length}` } });
      }
      if (request.headers().authorization !== `Bearer ${validAccess}`)
        return route.fulfill({ status: 401, json: { error: "unauthorized" } });
      return route.fallback();
    });
    await page.goto("/tv/solid.html");
    const state = page.locator("html");
    await expect(state).toHaveAttribute("data-tv-screen", "home");
    expect(rotations).toEqual(["refresh-old"]);
    validAccess = "expired-again";
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(state).toHaveAttribute("data-tv-screen", "movie");
    await expect.poll(() => rotations).toEqual(["refresh-old", "refresh-1"]);
    await expect(state).toHaveAttribute("data-tv-ready", "true");
    if (quotaFailure) {
      expect(await page.evaluate(origin => localStorage.getItem(`viptv-device:${origin}`), baseURL!)).toBeNull();
    } else {
      await page.reload();
      await expect(state).toHaveAttribute("data-tv-screen", "home");
      expect(rotations).toEqual(["refresh-old", "refresh-1"]);
    }
  });
}
