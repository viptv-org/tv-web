import { test, expect, type Page } from "@playwright/test";
import { installRemoteBackend } from "../preview/remote-backend";

async function keys(page: Page, ...keys: string[]) {
  for (const key of keys) await page.keyboard.press(key);
}
async function library(page: Page) {
  await page.goto("/tv/?platform=vizio&focusdebug=1");
  await expect(page.locator("html")).toHaveAttribute("data-tv-ready", "true");
  await keys(page, "ArrowUp", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight", "Enter");
  await expect(page.locator("html")).toHaveAttribute("data-tv-screen", "library");
  await expect(page.locator("html")).toHaveAttribute("data-tv-ready", "true");
  await keys(page, "ArrowUp");
}
test("Library type and sort choices send producer values and persist through a revision refresh", async ({ page, baseURL }) => {
  const fixture = await installRemoteBackend(page, baseURL!);
  await library(page);
  await keys(page, "ArrowRight", "Enter");
  await expect.poll(() => fixture.libraryQueries.at(-1)?.type).toBe("movie");
  await expect(page.locator("html")).toHaveAttribute("data-tv-ready", "true");
  await keys(page, "ArrowRight", "ArrowRight", "ArrowRight", "Enter");
  // Server default Date added is second, even though Last watched is first.
  await expect(page.locator("html")).toHaveAttribute("data-tv-focus", /:1$/);
  await keys(page, "ArrowDown", "Enter");
  await expect.poll(() => fixture.libraryQueries.at(-1)?.sort).toBe("name_asc");
  await expect(page.locator("html")).toHaveAttribute("data-tv-overlay", "");
  fixture.reviseCatalog([1, 0]);
  await expect.poll(() => fixture.libraryQueries.length, { timeout: 20000 }).toBeGreaterThan(3);
  expect(fixture.libraryQueries.at(-1)).toMatchObject({ type: "movie", sort: "name_asc" });
});

test("Library Clear previews server defaults; Back cancels and Apply confirms them", async ({ page, baseURL }) => {
  const fixture = await installRemoteBackend(page, baseURL!);
  await library(page);
  await keys(page, "ArrowRight", "Enter");
  await expect.poll(() => fixture.libraryQueries.at(-1)?.type).toBe("movie");
  await expect(page.locator("html")).toHaveAttribute("data-tv-ready", "true");
  await keys(page, "ArrowRight", "ArrowRight", "Enter", "ArrowDown", "ArrowDown", "Enter", "ArrowDown", "Enter");
  expect(fixture.libraryQueries).toHaveLength(2);
  await keys(page, "Escape");
  expect(fixture.libraryQueries.at(-1)?.type).toBe("movie");
  await keys(page, "Enter", "ArrowDown", "ArrowDown", "Enter", "ArrowDown", "Enter", "ArrowDown", "Enter");
  await expect.poll(() => fixture.libraryQueries.at(-1)?.type).toBe("all");
  expect(fixture.libraryQueries.at(-1)?.sort).toBe("date_added");
  await expect(page.locator("html")).toHaveAttribute("data-tv-overlay", "");
});

test("failed Library filtering stays in its picker and retries the same intent", async ({ page, baseURL }) => {
  const fixture = await installRemoteBackend(page, baseURL!, { rejectLibraryFilterOnce: true });
  await library(page);
  await keys(page, "ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight", "Enter", "ArrowDown", "Enter");
  await expect.poll(() => fixture.libraryQueries.length).toBe(2);
  await expect(page.locator("html")).toHaveAttribute("data-tv-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-tv-overlay", "choices");
  await keys(page, "Enter");
  await expect.poll(() => fixture.libraryQueries.length).toBe(3);
  expect(fixture.libraryQueries[2]).toEqual(fixture.libraryQueries[1]);
  await expect(page.locator("html")).toHaveAttribute("data-tv-overlay", "");
});

test("Back cancels a pending Library read and rejects its late query receipt", async ({ page, baseURL }) => {
  await installRemoteBackend(page, baseURL!);
  let release!: () => void;
  let started = false;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/profiles/*/library?**', async route => {
    if (new URL(route.request().url()).searchParams.get('sort') !== 'name_asc') return route.fallback();
    started = true;
    await held;
    await route.fulfill({ json: { cards: [], complete: true, query: { type: 'all', sort: 'name_asc' }, controls: [] } }).catch(() => {});
  });
  await library(page);
  await keys(page, "ArrowRight", "ArrowRight", "ArrowRight", "Enter", "ArrowDown", "Enter");
  await expect.poll(() => started).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-tv-ready", "false");
  await keys(page, "Escape");
  await expect(page.locator("html")).toHaveAttribute("data-tv-ready", "true");
  release();
  await page.waitForTimeout(100);
  await keys(page, "Enter");
  await expect(page.locator("html")).toHaveAttribute("data-tv-overlay", "choices");
  await expect(page.locator("html")).toHaveAttribute("data-tv-focus", /:1$/);
});
