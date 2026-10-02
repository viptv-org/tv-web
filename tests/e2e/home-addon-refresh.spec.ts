import { expect, test } from "@playwright/test";
import { apiOrigin, installBackend } from "./helpers/responsiveBackend";

test("Home adds a catalog after a revision change without resetting a surviving card", async ({ page }, info) => {
  test.skip(info.project.name !== "vizio", "The responsive renderer runs once per browser viewport.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install();
  await installBackend(page);
  let revision = "rev1";
  let catalogsFetched = 0;
  let revisionsFetched = 0;
  let failNewOnce = true;
  let newFailures = 0;
  const headers = { "access-control-allow-origin": "http://127.0.0.1:4173", "content-type": "application/json" };
  await page.route(`${apiOrigin}/api/catalogs/revision`, route => {
    revisionsFetched++;
    return route.fulfill({ headers, body: JSON.stringify({ revision }) });
  });
  await page.route(`${apiOrigin}/api/catalogs`, route => {
    catalogsFetched++;
    const catalogs = [{ id: "popular", name: "Popular", type: "movie", addon_id: 2, supports_search: true, supports_skip: true }];
    if (revision === "rev2") catalogs.push({ id: "new", name: "New Addon Picks", type: "movie", addon_id: 3, supports_search: true, supports_skip: true });
    return route.fulfill({ headers, body: JSON.stringify(catalogs) });
  });
  await page.route(`${apiOrigin}/api/discover**`, route => {
    if (revision === "rev2" && failNewOnce && new URL(route.request().url()).searchParams.get("catalog") === "new") {
      failNewOnce = false;
      newFailures++;
      return route.fulfill({ status: 502, headers, body: JSON.stringify({ error: "temporarily unavailable" }) });
    }
    return route.fallback();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Alex" }).click();
  const card = page.locator('[data-focus-id="home-0"]');
  await expect(card).toBeVisible();
  await expect.poll(() => revisionsFetched).toBeGreaterThanOrEqual(2);
  await card.focus();
  const initialCatalogs = catalogsFetched;
  await page.clock.fastForward(15_000);
  await page.clock.fastForward(15_000);
  expect(revisionsFetched).toBeGreaterThanOrEqual(3);
  expect(catalogsFetched).toBe(initialCatalogs);
  revision = "rev2";
  await page.clock.fastForward(15_000);
  await expect.poll(() => catalogsFetched, { message: `revision requests: ${revisionsFetched}` }).toBeGreaterThan(initialCatalogs);
  expect(newFailures).toBe(1);
  await page.clock.fastForward(15_000);
  await expect.poll(() => catalogsFetched).toBeGreaterThanOrEqual(initialCatalogs + 2);
  await expect(page.getByText("Movies · New Addon Picks")).toBeVisible();
  await expect(card).toBeFocused();
});
