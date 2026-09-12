import { expect, test, type Page } from "@playwright/test";
const origin = "https://viptv.syek.tech";
async function fixture(
  page: Page,
  options: { expires?: number; qrFailure?: boolean } = {},
) {
  let codes = 0,
    polls = 0,
    approved = false;
  if (options.qrFailure)
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toDataURL = () => {
        throw new Error("Fixture QR rendering failed");
      };
    });
  await page.route(`${origin}/api/**`, async (route) => {
    const headers = {
      "access-control-allow-origin": "http://127.0.0.1:4173",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "authorization,content-type",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const path = new URL(route.request().url()).pathname;
    let status = 200,
      body: unknown = {};
    if (path.endsWith("/device/code")) {
      codes++;
      body = {
        device_code: `device-${codes}`,
        user_code: `CODE00000${codes}`,
        verification_uri: `${origin}/device`,
        verification_uri_complete: `${origin}/device?code=CODE00000${codes}`,
        qr_uri: `${origin}/api/auth/device/qr?code=CODE00000${codes}`,
        expires_in: options.expires ?? 60,
        interval: 1,
      };
    } else if (path.endsWith("/device/token")) {
      polls++;
      if (!approved) {
        status = 428;
        body = { error: "authorization_pending" };
      } else
        body = {
          session_id: "paired",
          account_id: 1,
          profile_id: null,
          access_token: "fixture-access",
          refresh_token: "fixture-refresh",
          expires_in: 900,
        };
    } else if (path.endsWith("/auth/me"))
      body = {
        account: { id: 1, username: "qa", name: "QA", role: "member" },
        profiles: [{ id: 1, name: "Viewer", setup_complete: true }],
        profile_id: null,
        restricted: false,
        profile_setup_required: false,
      };
    else status = 404;
    await route.fulfill({
      status,
      headers,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return {
    approve: () => {
      approved = true;
    },
    polls: () => polls,
    codes: () => codes,
  };
}

test("pending pairing transitions to profiles after approval and stops polling", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.goto("/?platform=vizio");
  await expect(page.getByText("CODE000001", { exact: true })).toBeVisible();
  await expect.poll(f.polls).toBeGreaterThan(0);
  f.approve();
  await expect(
    page.getByRole("heading", { name: "Who's watching?" }),
  ).toBeVisible();
  const completed = f.polls();
  await page.clock.install();
  await page.clock.fastForward(10000);
  expect(f.polls()).toBe(completed);
});
test("expired pairing can retry with a new code", async ({ page }) => {
  const f = await fixture(page, { expires: 1 });
  await page.goto("/?platform=vizio");
  await expect(page.getByText("CODE000001", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("expired");
  await page.getByRole("button", { name: "Dismiss" }).click();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("CODE000002", { exact: true })).toBeVisible();
  expect(f.codes()).toBe(2);
});
test("QR renderer failure preserves manual pairing and approval polling", async ({
  page,
}) => {
  const f = await fixture(page, { qrFailure: true });
  await page.goto("/?platform=vizio");
  await expect(page.getByText("CODE000001", { exact: true })).toBeVisible();
  f.approve();
  await expect(
    page.getByRole("heading", { name: "Who's watching?" }),
  ).toBeVisible();
});
