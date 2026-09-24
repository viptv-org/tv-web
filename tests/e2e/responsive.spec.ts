import { expect, test, type Page } from '@playwright/test';

import { apiOrigin, sessionKey, movie, installBackend } from './helpers/responsiveBackend';

async function expectResponsiveViewport(page: Page, width: number) {
  const dimensions = await page.evaluate(() => {
    const screen = document.querySelector<HTMLElement>('.tv-screen')!;
    const box = screen.getBoundingClientRect();
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      screenWidth: box.width,
      internalWidth: screen.clientWidth,
      internalScrollWidth: screen.scrollWidth,
      screenLeft: box.left,
      transform: getComputedStyle(screen).transform,
      background: getComputedStyle(screen).backgroundColor,
    };
  });
  expect(dimensions.clientWidth).toBeLessThanOrEqual(width);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  expect(dimensions.internalScrollWidth).toBeLessThanOrEqual(dimensions.internalWidth + 1);
  expect(dimensions.screenWidth).toBeCloseTo(dimensions.clientWidth, 0);
  expect(dimensions.screenLeft).toBeCloseTo(0, 0);
  expect(dimensions.transform).toBe('none');
  // The frame ground is the design system's bg (#0B0B0C).
  expect(dimensions.background).toBe('rgb(11, 11, 12)');
  await expect(page.getByRole('alert')).toHaveCount(0);
}

for (const viewport of [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'ultrawide', width: 2560, height: 1080 },
]) {
  test(`responsive ${viewport.name}: real profile, Home, detail and source flow fits the viewport`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'vizio', 'The shared HTML application runs once per viewport, independently of TV decoder adapters.');
    await page.setViewportSize(viewport);
    const fixture = await installBackend(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: "Who's watching?" })).toBeVisible();
    await expectResponsiveViewport(page, viewport.width);
    await page.getByRole('button', { name: 'Alex' }).click();
    await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeVisible();
    const card = page.locator('.media-card').filter({ hasText: movie.name });
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();
    await expectResponsiveViewport(page, viewport.width);
    await page.keyboard.press('Tab');
    // Desktop hero: Play / Details / +; the phone featured card: Play / + (its
    // art opens the title). Secondary hero buttons are surface-3 with
    // off-white text (DeskHome, Main).
    const focusedAction = page.locator(viewport.width < 600 ? '[data-focus-id="hero-save"]' : '[data-focus-id="hero-details"]');
    await focusedAction.focus();
    await expect(focusedAction).toHaveCSS('background-color', 'rgb(42, 42, 46)');
    await expect(focusedAction).toHaveCSS('color', 'rgb(244, 242, 238)');
    const heroFontSize = await page.locator('.hero h1').evaluate(node => parseFloat(getComputedStyle(node).fontSize));
    expect(heroFontSize).toBeGreaterThanOrEqual(24);
    const cardBox = await card.boundingBox();
    // Phone Home posters are a third of the phone grid (111); desktop tiles keep fixed widths.
    expect(cardBox?.width).toBeGreaterThanOrEqual(viewport.width < 600 ? 100 : 140);
    expect(cardBox?.width).toBeLessThanOrEqual(viewport.width);
    if (viewport.width >= 1440) {
      const rail = await page.evaluate(() => {
        const box = (selector: string) => {
          const rect = document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        };
        return { nav: box('nav[aria-label="Main navigation"]'), myList: box('[data-focus-id="nav-My List"]'), cast: box('[data-focus-id="responsive-cast"]'), settings: box('[data-focus-id="nav-Settings"]'), profile: box('[data-focus-id="responsive-profile"]') };
      });
      // The 84 rail: destinations from the top, then On TV, Settings and the
      // avatar at the bottom (DeskHome / WebHome).
      expect(rail.nav.left).toBe(0);
      expect(rail.nav.right).toBe(84);
      expect(rail.nav.bottom).toBe(viewport.height);
      expect(rail.myList.bottom).toBeLessThan(rail.cast.top);
      expect(rail.cast.bottom).toBeLessThanOrEqual(rail.settings.top);
      expect(rail.settings.bottom).toBeLessThanOrEqual(rail.profile.top);
      expect(rail.profile.bottom).toBe(viewport.height - 18);
    }
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-home.png`), animations: 'disabled', fullPage: true });

    const navigation = page.getByRole('navigation', { name: 'Main navigation' });
    // Phones have no Settings in the bottom nav: it sits in the My List header.
    const openSettings = async () => {
      if (viewport.width < 600) {
        await navigation.getByRole('button', { name: 'My List', exact: true }).click();
        await page.locator('[data-focus-id="library-settings"]').click();
      } else await navigation.getByRole('button', { name: 'Settings', exact: true }).click();
    };
    // Phone Settings is not a tab screen (no bottom nav): Back returns to My List.
    const openHome = async () => {
      if (viewport.width < 600) await page.goBack();
      await navigation.getByRole('button', { name: 'Home', exact: true }).click();
    };
    await expect(page.locator('.responsive-toolbar').getByRole('button', { name: /OLED/ })).toHaveCount(0);
    // Phones render OLED mode as a switch row (Settings); wider layouts show the
    // Appearance pane's OLED switch (DeskSettings).
    const oled = (on: boolean) => viewport.width < 600
      ? page.locator(`[data-focus-id="settings-oled"][aria-checked="${on}"]`)
      : page.locator(`[role="switch"][aria-label="OLED mode"][aria-checked="${on}"]`);
    await openSettings();
    await oled(false).click();
    await expect(oled(true)).toBeVisible();
    await expect(page.locator('.tv-screen')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await openHome();
    await page.reload();
    await expect(page.locator('.home')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('viptv:appearance:oled'))).toBe('true');
    await expect(page.locator('.tv-screen')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await openSettings();
    await oled(true).click();
    await openHome();
    await expectResponsiveViewport(page, viewport.width);

    await card.click();
    await page.locator('[data-focus-id="detail-info"]').click();
    const moreDialog = page.getByRole('dialog', { name: movie.name });
    await expect(moreDialog.getByRole('button', { name: 'Choose source', exact: true })).toBeVisible();
    await expect(moreDialog.getByRole('button', { name: 'Add to My List', exact: true })).toBeVisible();
    await moreDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(moreDialog).toHaveCount(0);
    await page.goBack();
    await expect(card).toBeVisible();

    if (viewport.name === 'phone') {
      await navigation.getByRole('button', { name: 'My List', exact: true }).click();
      await page.locator('[data-focus-id="library-settings"]').click();
    }
    const cast = page.getByRole('button', { name: /^Watch on TV/ });
    await cast.click();
    const castDialog = page.getByRole('dialog', { name: 'Watch on TV' });
    await expect(castDialog).toContainText('VIPTV desktop app with SmartCast support');
    await expect(castDialog).toContainText('This browser cannot pair with or control your TV');
    await expect(castDialog.getByLabel('TV IP address')).toHaveCount(0);
    // The last "Close" is the action button (the × disc / phone grabber carry the same label).
    await castDialog.getByRole('button', { name: 'Close', exact: true }).last().click();
    await expect(castDialog).toHaveCount(0);
    await expect(cast).toBeFocused();
    await expectResponsiveViewport(page, viewport.width);
    if (viewport.name === 'phone') {
      await page.goBack();
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Home', exact: true }).click();
      // Phone keeps Discover in the bottom navigation; the browse routes no
      // longer carry a cross-link to each other.
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Search', exact: true }).click();
      await expect(page.locator('.vx-browse').getByRole('heading', { name: 'Search', exact: true })).toBeVisible();
      await expect(page.locator('[data-focus-id="browse-discover"]')).toHaveCount(0);
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Discover', exact: true }).click();
      await expect(page.locator('.vx-browse').getByRole('heading', { name: 'Discover', exact: true })).toBeVisible();
      await expect(page.locator('[data-focus-id="browse-search"]')).toHaveCount(0);
      await expectResponsiveViewport(page, viewport.width);
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Home', exact: true }).click();
      await expect(page.locator('.home')).toBeVisible();
    }

    await card.click();
    await expect(page.locator('.detail').getByRole('heading', { name: movie.name })).toBeVisible();
    await expectResponsiveViewport(page, viewport.width);
    await page.locator('[data-focus-id="detail-source"]').click();
    await expect(page.locator('.vx-sources__status')).toContainText(viewport.width < 600 ? movie.name : 'found');
    await expect(page.locator('[data-focus-id="source-0"]')).toBeVisible();
    await expectResponsiveViewport(page, viewport.width);
    expect(fixture.requests.some(request => request.path === '/api/meta/movie/responsive-movie')).toBe(true);
    expect(fixture.requests.find(request => request.path === '/api/streams' && request.method === 'POST')?.body).toMatchObject({ id: movie.id, type: 'movie' });
    expect(fixture.requests.some(request => request.path === '/api/playback')).toBe(false);

    await page.keyboard.press('Escape');
    await expect(page.locator('.detail')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.home')).toBeVisible();
    await page.reload();
    await expect(page.locator('.home')).toBeVisible();
    await expectResponsiveViewport(page, viewport.width);
    const session = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), sessionKey);
    expect(session).toMatchObject({ sessionId: 'responsive-session', accountId: '7', profileId: '1', accessToken: 'fixture-access', refreshToken: 'fixture-refresh' });
    expect(fixture.requests.filter(request => request.path === '/api/auth/profile')).toHaveLength(1);
    expect(fixture.errors).toEqual([]);
  });
}

for (const viewport of [
  { name: 'phone', width: 390, height: 844, invalidLogo: false },
  { name: 'desktop', width: 1440, height: 900, invalidLogo: true },
]) {
  test(`responsive ${viewport.name}: series episodes remain full size with ${viewport.invalidLogo ? 'failed logo text fallback' : 'loaded title logo'}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'vizio', 'Shared HTML series layout needs one browser run per viewport.');
    await page.setViewportSize(viewport);
    const fixture = await installBackend(page, { series: true, invalidLogo: viewport.invalidLogo });
    await page.goto('/');
    await page.getByRole('button', { name: 'Alex' }).click();
    await expect(page.locator('.home')).toBeVisible();
    const title = page.locator('.hero .responsive-title');
    if (viewport.invalidLogo) {
      await expect(title.locator('img')).toHaveJSProperty('complete', true);
      await expect(title.locator('img')).toHaveJSProperty('naturalWidth', 0);
      await expect(title).not.toHaveClass(/has-logo/);
      await expect(title.locator('span')).toHaveCSS('clip-path', 'none');
      await expect(title).toContainText(fixture.title.name);
    } else {
      await expect(title).toHaveClass(/has-logo/);
      await expect(title.locator('img')).toBeVisible();
      await expect(title.locator('img')).toHaveJSProperty('naturalWidth', 1280);
      await expect(title.locator('img')).toHaveCSS('object-fit', 'contain');
    }
    await page.locator('.media-card').filter({ hasText: fixture.title.name }).click();
    await expect(page.locator('.detail.series')).toBeVisible();
    await expect(page.locator('.responsive-app')).toHaveJSProperty('scrollTop', 0);
    if (viewport.width >= 1200) {
      // The rail stays on a title page (its section current); detail, sources
      // and profiles add no second leading Back control.
      const nav = await page.locator('nav[aria-label="Main navigation"]').boundingBox();
      expect(nav!.x).toBe(0);
      expect(nav!.width).toBe(84);
      await expect(page.locator('[data-focus-id="nav-Home"]')).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('[data-focus-id="responsive-back"]')).toHaveCount(0);
    }
    const episode = page.locator('[data-focus-id="episode-0"]');
    await expect(episode).toContainText('Episode 1');
    await expect(page.locator('.vx-title__episode')).toHaveCount(8);
    const dimensions = await episode.boundingBox();
    expect(dimensions?.width).toBeGreaterThanOrEqual(240);
    const grid = page.locator('.vx-title__episode-list');
    if (viewport.name === 'phone') {
      await expect(grid).toHaveCSS('display', 'flex');
      expect(await grid.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    } else {
      await expect(grid).toHaveCSS('display', 'grid');
      // Read both cards in one animation frame: the real shell can still be
      // smoothly revealing focused content between separate protocol calls.
      const positions = await grid.evaluate(node => Array.from(node.querySelectorAll('.vx-title__episode')).slice(0, 2).map(card => {
        const box = card.getBoundingClientRect(); return { x: box.x, y: box.y };
      }));
      expect(positions[1].y).toBeCloseTo(positions[0].y, 0);
      expect(positions[1].x).toBeGreaterThan(positions[0].x);
    }
    await expectResponsiveViewport(page, viewport.width);
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-series.png`), animations: 'disabled', fullPage: true });
    await episode.click();
    await expect(page.locator('.vx-sources__status')).toContainText(viewport.width < 600 ? 'S1 E1' : 'found');
    await expect(page.locator('[data-focus-id="source-0"]')).toBeVisible();
    expect(fixture.requests.find(request => request.path === '/api/streams')?.body).toMatchObject({ id: 'responsive-series:1:1', series_id: 'responsive-series', season: 1, episode: 1 });
    await expectResponsiveViewport(page, viewport.width);
    expect(fixture.errors).toEqual([]);
  });
}

for (const width of [360, 390, 768, 1024, 1280, 1440, 2560]) {
  test(`populated responsive ${width}: shelves never enlarge the hero or application`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'vizio');
    const height = width < 600 ? 844 : 1000;
    await page.setViewportSize({ width, height });
    const fixture = await installBackend(page, { populated: true });
    await page.goto('/');
    await expect(page.locator('[data-focus-id="profile-0"]')).toContainText(fixture.profileName);
    await expectResponsiveViewport(page, width);
    await page.locator('[data-focus-id="profile-0"]').click();
    // Rows near the viewport load as it fills; at least three shelves show.
    await expect.poll(() => page.locator('.shelves section').count()).toBeGreaterThanOrEqual(3);
    // Windowed rows mount only the visible slice of each shelf; pixel
    // spacers keep every 24-item track fully scrollable (checked via the
    // geometry scrollWidth assertions below).
    const mounted = await page.locator('.shelves .media-card').count();
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(72);
    await expect(page.locator('.responsive-hero-art > img')).toHaveJSProperty('naturalWidth', 3840);
    await expect(page.locator('.hero .responsive-title')).toHaveClass(/has-logo/);
    const geometry = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>('.responsive-app')!;
      const art = document.querySelector<HTMLElement>('.responsive-hero-art')!;
      const image = art.querySelector('img')!;
      const shelf = document.querySelector<HTMLElement>('.cards')!;
      const hero = art.getBoundingClientRect();
      const bitmap = image.getBoundingClientRect();
      return { rootWidth: root.clientWidth, rootScrollWidth: root.scrollWidth, heroWidth: hero.width, heroHeight: hero.height, heroLeft: hero.left, heroRight: hero.right, imageWidth: bitmap.width, imageHeight: bitmap.height, shelfWidth: shelf.clientWidth, shelfScrollWidth: shelf.scrollWidth };
    });
    expect(geometry.rootScrollWidth).toBeLessThanOrEqual(geometry.rootWidth + 1);
    expect(geometry.heroWidth).toBeLessThanOrEqual(geometry.rootWidth);
    expect(geometry.heroLeft).toBeGreaterThanOrEqual(0);
    expect(geometry.heroRight).toBeLessThanOrEqual(width);
    expect(geometry.heroHeight).toBeLessThanOrEqual(width < 600 ? 240 : 480);
    // Phone featured art is 206 tall at every width (Main); the desktop hero
    // art keeps 774:432 and never grows past 776 wide (DeskHome).
    if (width < 600) expect(geometry.heroHeight).toBe(206);
    else {
      expect(geometry.heroWidth / geometry.heroHeight).toBeCloseTo(774 / 432, 1);
      expect(geometry.heroWidth).toBeLessThanOrEqual(776);
    }
    expect(geometry.imageWidth).toBeLessThanOrEqual(geometry.heroWidth + 1);
    expect(geometry.imageHeight).toBeLessThanOrEqual(geometry.heroHeight + 1);
    expect(geometry.shelfWidth).toBeLessThanOrEqual(geometry.rootWidth);
    expect(geometry.shelfScrollWidth).toBeGreaterThan(geometry.shelfWidth);
    await expectResponsiveViewport(page, width);
    await page.screenshot({ path: testInfo.outputPath(`populated-${width}.png`) });

    if (width === 390 || width === 1440) {
      const navigation = page.getByRole('navigation', { name: 'Main navigation' });
      await navigation.getByRole('button', { name: 'Search', exact: true }).click();
      // Web: the page field names the page; its heading is for assistive technology only.
      await expect(page.locator('.vx-browse').getByRole('heading', { name: 'Search', exact: true })).toBeAttached();
      await navigation.getByRole('button', { name: 'Discover', exact: true }).click();
      await expect(page.locator('.vx-browse .media-card')).toHaveCount(24);
      await expectResponsiveViewport(page, width);
      const browse = await page.locator('.vx-browse').boundingBox();
      const results = await page.locator('.vx-browse .vx-browse__grid').boundingBox();
      expect(browse!.height).toBeGreaterThan(results!.height);
      expect(results!.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: testInfo.outputPath(`populated-${width}-discover.png`) });
      await navigation.getByRole('button', { name: 'Home', exact: true }).click();
      await page.locator('.shelves .media-card').filter({ hasText: fixture.title.name }).first().click();
      await expect(page.locator('.detail')).toBeVisible();
      await expectResponsiveViewport(page, width);
      const synopsis = await page.locator('.vx-title__synopsis').boundingBox();
      const actions = await page.locator('.vx-title__actions').boundingBox();
      expect(actions!.y).toBeGreaterThanOrEqual(synopsis!.y + synopsis!.height);
      await page.screenshot({ path: testInfo.outputPath(`populated-${width}-detail.png`) });
      await page.locator('[data-focus-id="detail-info"]').click();
      const modal = page.locator('[data-focus-scope="modal"]');
      await expect(modal).toBeVisible();
      const modalBox = await modal.boundingBox();
      expect(modalBox!.width).toBeLessThanOrEqual(width < 600 ? width : width - 20);
      expect(modalBox!.height).toBeLessThanOrEqual(height - 20);
      expect(modalBox!.height).toBeGreaterThan(100);
      await expectResponsiveViewport(page, width);
      await page.keyboard.press('Escape');
      await expect(modal).toHaveCount(0);
      await page.locator('[data-focus-id="detail-source"]').click();
      const source = page.locator('[data-focus-id="source-0"]');
      await expect(source).toContainText('International Cinema and Television Collection');
      await expect(source.locator('.vx-source-row__file')).toHaveCSS('color', 'rgb(143, 141, 137)');
      await expectResponsiveViewport(page, width);
      const sourceSize = await source.evaluate(node => ({ height: node.clientHeight, scrollHeight: node.scrollHeight, width: node.clientWidth, scrollWidth: node.scrollWidth }));
      expect(sourceSize.scrollHeight).toBeLessThanOrEqual(sourceSize.height + 1);
      expect(sourceSize.scrollWidth).toBeLessThanOrEqual(sourceSize.width + 1);
      await page.screenshot({ path: testInfo.outputPath(`populated-${width}-sources.png`) });
    }
    expect(fixture.errors).toEqual([]);
  });
}

for (const width of [390, 1440]) {
  test(`responsive Back restores populated shelf offsets at ${width}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'vizio');
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installBackend(page, { populated: true });
    await page.goto('/');
    await page.locator('[data-focus-id="profile-0"]').click();
    // The loading skeleton shares Home's layout classes; wait for Home itself.
    await expect(page.locator('.home-skeleton')).toHaveCount(0);
    const section = page.locator('.shelves section').last();
    // Windowed rows mount only cards near the row's scroll offset, so pan
    // the row to card 12 first and address it as the 4th mounted card.
    const cardId = await section.locator('.cards').evaluate(el => {
      const slots = el.querySelectorAll<HTMLElement>(':scope > .vx-card-slot');
      const pitch = slots[1].offsetLeft - slots[0].offsetLeft;
      el.scrollLeft = 12 * pitch;
      return slots[0].querySelector<HTMLElement>('.media-card')!.dataset.focusId!.replace(/-\d+$/, '-12');
    });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    // Address card 12 by its focus id: the windowed row remounts its slice as it scrolls.
    const card = page.locator(`[data-focus-id="${cardId}"]`);
    await card.scrollIntoViewIfNeeded();
    await card.focus();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const offsets = () => page.evaluate(() => ({
      top: document.querySelector('.responsive-app')!.scrollTop,
      left: document.querySelector('.shelves section:last-child .cards')!.scrollLeft,
    }));
    const before = await offsets();
    expect(before.top).toBeGreaterThan(0);
    expect(before.left).toBeGreaterThan(0);
    await card.click();
    await expect(page.locator('.detail')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(card).toBeVisible();
    await expect.poll(async () => (await offsets()).left).toBe(before.left);
    // Browser scroll clamping can round the final content edge by a few pixels.
    await expect.poll(async () => Math.abs((await offsets()).top - before.top)).toBeLessThanOrEqual(3);
  });
}

for (const width of [390, 768, 1440]) {
  test(`responsive populated queue and real-shaped live logos remain separated at ${width}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'vizio');
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // live_catalog::channels supplies type=live and logo; continuation supplies
    // the exact episode, progress and series_id, not a generic movie fixture.
    const fixture = await installBackend(page, { populated: true, activity: true });
    await page.goto('/');
    await page.locator('[data-focus-id="profile-0"]').click();
    const queue = page.locator('.shelves section').filter({ has: page.getByRole('heading', { name: 'Continue watching', exact: true }) });
    // The queue row is windowed: only the visible slice stays mounted, but
    // the full 24-item track remains scrollable behind pixel spacers. The
    // visible slice mounts asynchronously after layout measurement.
    await expect.poll(() => queue.locator('.media-card').count()).toBeGreaterThan(0);
    const mountedQueue = await queue.locator('.media-card').count();
    expect(mountedQueue).toBeGreaterThan(0);
    expect(mountedQueue).toBeLessThan(24);
    // The whole 24-card track stays scrollable at the row's real pitch.
    const track = await queue.locator('.cards').evaluate(el => {
      const card = el.querySelector<HTMLElement>(':scope > .vx-card-slot')!;
      return { scrollWidth: el.scrollWidth, pitch: card.offsetWidth + (parseFloat(getComputedStyle(el).columnGap) || 0) };
    });
    expect(track.scrollWidth).toBeGreaterThan(23 * track.pitch);
    await expect(page.locator('.shelves section').first()).toContainText('Continue watching');
    await expect(queue.locator('[data-focus-id="queue-0"]')).toContainText('S1');
    // Card art is served through the shared wsrv pipeline at card geometry
    // (the phone continue card's thumb keeps an episode's still).
    await expect(queue.locator('[data-focus-id="queue-0"] img')).toHaveAttribute('src', 'https://wsrv.nl/?url=https%3A%2F%2Fart.example%2Fepisode.svg%3Fepisode%3D1&w=256&h=144&fit=cover&output=jpg&q=85&we');
    await expect(queue.locator('[data-focus-id="queue-1"] img')).toHaveAttribute('src', 'https://wsrv.nl/?url=https%3A%2F%2Fart.example%2Fepisode.svg%3Fepisode%3D2&w=256&h=144&fit=cover&output=jpg&q=85&we');
    expect(fixture.requests.some(request => request.path === '/api/meta/series/queue-series')).toBe(true);
    // 42 s of 2400 s: the accent bar reads 2 %.
    await expect(queue.locator('[data-focus-id="queue-0"] [role="progressbar"]')).toHaveAttribute('aria-valuenow', String(Math.round(42 / 2400 * 100)));
    const live = page.locator('[data-focus-id="recent-live-0"]');
    // Lazy card art only loads once its row is on screen.
    await live.scrollIntoViewIfNeeded();
    // Channel logos are text monograms (components.md §6): desktop live tiles
    // draw the monogram with a LIVE badge and the name below; phones draw the
    // live-now card (LIVE label, name, section). No logo bitmap is loaded.
    if (width < 600) {
      await expect(live).toHaveClass(/vx-live-card/);
      await expect(live).toContainText('Live');
    } else {
      await expect(live).toHaveClass(/vx-card--live/);
      await expect(live.locator('.vx-card__art--monogram')).toHaveText(/^IN1\s*LIVE$/);
    }
    await expect(live).toContainText('International News 1');
    await expect(live).toContainText('News');
    await expect(live.locator('img')).toHaveCount(0);
    // Lower-shelf focus still sets compact-home (the TV hides its hero); the
    // responsive hero keeps its place.
    const heroBefore = await page.locator('.responsive-hero-art').boundingBox();
    await live.focus();
    await expect(page.locator('.home')).toHaveClass(/compact-home/);
    expect(await page.locator('.responsive-hero-art').boundingBox()).toEqual(heroBefore);
    await expectResponsiveViewport(page, width);
    await page.screenshot({ path: testInfo.outputPath(`queue-live-${width}.png`) });
    await queue.locator('[data-focus-id="queue-0"]').click();
    await expect(page.locator('[data-focus-id="source-0"]')).toBeVisible();
    expect(fixture.requests.find(request => request.path === '/api/streams')?.body).toMatchObject({ id: 'queue-series:1:1', series_id: 'queue-series', season: 1, episode: 1 });
    expect(fixture.errors).toEqual([]);
  });
}

test('responsive web uses selected tabs without remote focus skin at phone and desktop sizes', async ({ page }, info) => {
  test.skip(info.project.name !== 'vizio');
  await page.setViewportSize({ width: 390, height: 844 });
  await installBackend(page);
  await page.goto('/');
  const profile = page.locator('[data-focus-id="profile-0"]');
  await profile.focus();
  // Phones draw no focus ring on the profile tile (no TV ring, no desktop keyboard ring).
  expect(await profile.evaluate(node => getComputedStyle(node.querySelector('.vx-profile__avatar')!).boxShadow)).toBe('none');
  await profile.click();
  const home = page.locator('[data-focus-id="nav-Home"]');
  await home.focus();
  // Phone bottom nav: the current tab is an off-white pill with dark text;
  // phones draw no focus ring (Main, CmpPhone2).
  await expect(home).toHaveAttribute('aria-current', 'page');
  await expect(home).toHaveCSS('outline-style', 'none');
  await expect(home).toHaveCSS('box-shadow', 'none');
  await expect(home).toHaveCSS('background-color', 'rgb(244, 242, 238)');
  await expect(home).toHaveCSS('color', 'rgb(17, 17, 19)');
  await expect(page.locator('[data-focus-id="nav-Discover"]')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  // Phones draw no focus ring on a card (only desktop keyboard focus does).
  const card = page.locator('[data-focus-id="home-0"]');
  await card.focus();
  expect(await card.evaluate(node => getComputedStyle(node.querySelector('.vx-card__art')!, '::after').boxShadow)).toBe('none');
  const action = page.locator('[data-focus-id="hero-save"]');
  await action.focus();
  await expect(action).toHaveCSS('outline-style', 'none');
  await expect(action).toHaveCSS('box-shadow', 'none');
  await expect(action).toHaveCSS('background-color', 'rgb(42, 42, 46)');
  // Settings is not a phone tab: the My List header carries it, and the
  // Settings page shows no bottom nav.
  await expect(page.locator('[data-focus-id="nav-Settings"]')).toHaveCount(0);
  await page.locator('[data-focus-id="nav-My List"]').click();
  await page.locator('[data-focus-id="library-settings"]').click();
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  // Desktop rail: the current destination has a surface-2 fill; keyboard
  // focus is the off-white ring with a ground gap, never a fill (CmpDesk2).
  await page.setViewportSize({ width: 1440, height: 900 });
  const settings = page.locator('[data-focus-id="nav-Settings"]');
  await expect(settings).toHaveAttribute('aria-current', 'page');
  await expect(settings).toHaveCSS('background-color', 'rgb(33, 33, 36)');
  await page.keyboard.press('Tab');
  await home.focus();
  await expect(home).toHaveCSS('outline-style', 'none');
  await expect(home).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(home).toHaveCSS('box-shadow', 'rgb(11, 11, 12) 0px 0px 0px 2px, rgb(244, 242, 238) 0px 0px 0px 4px');
  await page.keyboard.press('ArrowRight');
  await expect(home).toBeFocused();
});
