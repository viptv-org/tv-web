import { expect, test, type Page } from '@playwright/test';
import { installBackend } from './helpers/responsiveBackend';

async function clickOutside(page: Page) {
  const dialog = page.getByRole('dialog');
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThan(2);
  expect(bounds!.y).toBeGreaterThan(2);
  await page.mouse.click(2, 2);
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`responsive ${viewport.width}: outside text entry cancels its draft and restores the profile form`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'vizio', 'Shared responsive dialogs need one browser project per viewport.');
    await page.setViewportSize(viewport);
    const fixture = await installBackend(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Manage profiles', exact: true }).click();
    const opener = page.getByRole('button', { name: 'Alex' });
    await opener.click();
    await expect(page.getByRole('dialog', { name: 'Edit profile', exact: true })).toBeVisible();
    await page.locator('[data-focus-id="profile-name"]').click();
    const field = page.getByRole('textbox', { name: 'Profile name', exact: true });
    await field.fill('Unsaved draft');
    await field.click();
    await expect(field).toHaveValue('Unsaved draft');
    await expect(page.locator('.dialog-backdrop')).toHaveCount(1);
    await clickOutside(page);
    await expect(page.getByRole('dialog', { name: 'Edit profile', exact: true })).toBeVisible();
    await expect(page.locator('[data-focus-id="profile-name"]')).toHaveText('Alex');
    await expect(page.locator('[data-focus-id="profile-name"]')).toBeFocused();
    await clickOutside(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(fixture.requests.filter(request => request.path === '/api/profiles/1' && request.method !== 'GET')).toEqual([]);
    expect(fixture.errors).toEqual([]);
  });
}
