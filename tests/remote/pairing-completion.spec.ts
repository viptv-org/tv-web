import { test, expect } from "@playwright/test";
import { installRemoteBackend } from "../preview/remote-backend";

for (const selected of [true, false]) {
  test(`pairing confirmation consumes bootstrap and continues to ${selected ? "Home" : "profiles"}`, async ({ page, baseURL }) => {
    const fixture = await installRemoteBackend(page, baseURL!, {
      session: false, pairingApproved: true, pairingProfile: selected,
    });
    await page.goto("/tv/?platform=vizio");
    const state = page.locator("html");
    await expect(state).toHaveAttribute("data-tv-ready", "true");
    await page.keyboard.press("Enter");
    await expect(state).toHaveAttribute("data-tv-screen", "signed-in");
    expect(fixture.requests.filter(r => r.path === "/api/bootstrap")).toHaveLength(1);
    expect(fixture.requests.filter(r => r.path === "/api/auth/profile")).toHaveLength(0);
    await page.keyboard.press("ArrowRight");
    await expect(state).toHaveAttribute("data-tv-focus", "confirmation:0:1");
    await expect(state).toHaveAttribute("data-tv-screen", selected ? "home" : "profiles", { timeout: 4000 });
    expect(fixture.requests.filter(r => r.path === "/api/bootstrap")).toHaveLength(1);
    await page.reload();
    await expect(state).toHaveAttribute("data-tv-screen", selected ? "home" : "profiles");
    expect(fixture.requests.filter(r => r.path === "/api/auth/device/token")).toHaveLength(1);
  });
}

test("Back acknowledges successful pairing without revoking it or leaving a timed navigation behind", async ({ page, baseURL }) => {
  const fixture = await installRemoteBackend(page, baseURL!, { session: false, pairingApproved: true });
  await page.goto("/tv/?platform=vizio");
  const state = page.locator("html");
  await expect(state).toHaveAttribute("data-tv-ready", "true");
  await page.keyboard.press("Enter");
  await expect(state).toHaveAttribute("data-tv-screen", "signed-in");
  await page.keyboard.press("Escape");
  await expect(state).toHaveAttribute("data-tv-screen", "home");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(state).toHaveAttribute("data-tv-screen", "movie");
  await page.waitForTimeout(2700);
  await expect(state).toHaveAttribute("data-tv-screen", "movie");
  expect(fixture.requests.some(r => r.path === "/api/auth/logout")).toBe(false);
});
