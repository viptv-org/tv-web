/*
 * Screen registry: reference screen name → scenario.
 *
 * The frame (viewport, TV/phone/desktop mode, sample-data family) follows the
 * reference size in reference/screens/index.json:
 *   phone 390×844 · desktop app 1440×900 / 2560×1080 (title bar forced with the
 *   dev-only ?desktop-shell) · web 1280×800 · TV 1920×1080 (?platform=tizen).
 *
 * Fields
 *   path      responsive deep link (TV has no URL routing; it always starts at /)
 *   query     extra query string
 *   backend   installBackend options (tests/preview/backend.ts)
 *   player    install the media stubs (+ options: paused, error, position…)
 *   clock     'HH:MM' Eastern on 23 Sep 2026, or false for real time
 *   local     use the local-mode dev server (VITE_VIPTV_LOCAL_MODE=1)
 *   shell     override the desktop title bar (true/false)
 *   steps     async (h) => {…} to reach the state (see helpers in shoot.mjs)
 *   notReachable  why the app cannot show this state yet (listed by --list)
 *   note      known difference from the reference state
 */

// ---- shared step sequences ------------------------------------------------
const MONSTER = '/tv/title/series/tt-monster';
const OAK_SOURCES = '/tv/title/movie/tt-oak-street/sources';

/** Responsive: Monster title → S1 E1 → first source → player. */
async function responsivePlayer(h, { pause = false } = {}) {
  await h.activate('episode-0');
  await h.wait('source-0', 15000);
  await h.activate('source-0');
  await h.page.locator('.rp-controls, .player-controls, [data-focus-id="pause"]').first().waitFor({ timeout: 15000 });
  await h.settle();
  if (pause) await h.activate('pause');
  // Keep the controls up: pointer activity over the player.
  await h.page.mouse.move(h.frame.width / 2, h.frame.height / 2);
  await h.sleep(200);
}
/** Responsive: click the timeline at a fraction of its width (commits a seek). */
async function seekTo(h, fraction) {
  const bar = h.page.locator('[data-focus-id="timeline"]').first();
  const box = await bar.boundingBox();
  if (!box) throw new Error('no timeline');
  await h.page.mouse.click(box.x + box.width * fraction, box.y + box.height / 2);
  await h.sleep(300);
}
/** TV: Home → hero Details (Monster) → Choose source → first source. */
async function tvToTitle(h) {
  await h.activate('hero-details');
  await h.wait('detail-play');
  await h.settle();
}
async function tvToSources(h) {
  await tvToTitle(h);
  await h.activate('episode-0');
  await h.wait('source-0', 15000);
  await h.settle();
}
async function tvPlayer(h, { pause = false } = {}) {
  await tvToSources(h);
  await h.activate('source-0');
  await h.wait('pause', 15000);
  await h.settle();
  if (pause) await h.activate('pause');
}
async function openProfileEditor(h, name = 'zayne') {
  await h.activate('manage-profiles');
  await h.activate(h.page.getByRole('button', { name }).first());
  await h.wait('profile-save');
}
/** The text-entry dialog's field (it starts with "https://" for addon URLs, so fill, not type). */
const entryInput = h => h.page.getByRole('dialog').last().locator('input').first();
async function libraryQueue(h) {
  if (h.tv) await h.activate('library-queue');
  else await h.button('Continue Watching');
}
async function settingsRow(h, id) {
  if (h.tv) await h.tvGo('Settings');
  await h.activate(id);
  await h.settle();
}

// ---- registry ---------------------------------------------------------------
export const screens = {
  // ===== Phone 390×844 =====================================================
  Main: { path: '/tv/home' },
  Title: { path: '/tv/title/movie/tt-oak-street' },
  Sources: { path: OAK_SOURCES, backend: { sourcesDone: false } },
  Discover: { path: '/tv/discover' },
  Live: { path: '/tv/live' },
  Library: { path: '/tv/my-list', backend: { favorites: true } },
  Settings: { path: '/tv/settings', note: 'OLED switched on as drawn, so the ground is pure black', steps: h => h.activate('settings-oled') },
  PhPlayer: { path: MONSTER, player: {}, steps: h => responsivePlayer(h, { pause: true }) },
  PhPlayerSubs: { path: MONSTER, player: {}, steps: async h => { await responsivePlayer(h); await h.activate('subtitles'); } },
  PhPlayerInfo: { path: MONSTER, player: {}, steps: async h => { await responsivePlayer(h); await h.button('Playback info'); } },
  PhPlayerLive: { path: '/tv/home', player: { frame: '' }, steps: async h => { await h.activate(h.page.getByRole('button', { name: 'Cartoon Network' }).first()); await h.wait('.rp-controls, [data-focus-id="audio"]', 15000); } },
  PhPlayerBuffering: { notReachable: 'the seek notice + ring: a refused backend seek (backend seekRefused) surfaces as an HTTP 409 error toast and a pending seek (playbackHangAfter: 1) shows neither ring nor notice in this build; retry once the player shows both' },
  PhPlayerNext: { path: MONSTER, player: {}, backend: { playbackHangAfter: 1, sourcesDone: true }, steps: async h => { await responsivePlayer(h); await h.activate('next'); await h.sleep(600); } },
  PhUpNext: { notReachable: 'no Up Next card in the app yet' },
  PhPlayerError: { path: OAK_SOURCES, player: { stall: true }, steps: async h => { await h.activate('source-0'); await h.page.getByRole('dialog').first().waitFor({ timeout: 25000 }); } },
  PhSignIn: { backend: { session: 'none' } },
  PhProfiles: { backend: { session: 'profiles' }, path: '/tv/profiles' },
  PhProfilesManage: { backend: { session: 'profiles' }, path: '/tv/profiles', steps: h => h.activate('manage-profiles') },
  PhProfileEdit: { backend: { session: 'profiles' }, path: '/tv/profiles', steps: h => openProfileEditor(h) },
  PhProfileName: { backend: { session: 'profiles' }, path: '/tv/profiles', steps: async h => { await openProfileEditor(h); await h.activate('profile-name'); } },
  PhProfileAdd: { backend: { session: 'profiles', profileSaveHang: true }, path: '/tv/profiles', note: 'default avatar, not Clay friends 11', steps: async h => { await h.activate('add-profile'); await h.activate('profile-name'); await h.type('Ana'); await h.activate('text-save'); await h.activate('profile-save'); } },
  PhAvatars: { backend: { session: 'profiles' }, path: '/tv/profiles', steps: async h => { await openProfileEditor(h); await h.activate('profile-avatar'); await h.activate('avatar-category-clay'); } },
  PhProfileDelete: { backend: { session: 'profiles' }, path: '/tv/profiles', steps: async h => { await openProfileEditor(h); await h.activate('profile-delete'); } },
  PhPin: { path: '/tv/settings', backend: { signOutPin: true, wrongPin: true }, note: 'reached through Sign out, so the title reads "…to sign out"', steps: async h => { await h.activate('signout'); await h.choose('Sign out'); await h.wait('text-save'); await h.type('1234'); await h.activate('text-save'); await h.waitText('Incorrect PIN'); } },
  PhSignOut: { path: '/tv/settings', steps: h => h.activate('signout') },
  PhPlayback: { path: '/tv/settings/playback' },
  PhPlaybackChoice: { path: '/tv/settings/playback', steps: h => h.activate('audio-language') },
  PhAddons: { path: '/tv/settings/addons' },
  PhAddonInstall: { path: '/tv/settings/addons', steps: async h => { await h.activate('addon-add'); await h.fill('settings-install-url', 'http://addon.example/manifest.json'); await h.activate('settings-install-save'); await h.waitText('HTTPS manifest'); } },
  PhAddonManage: { path: '/tv/settings/addons', steps: h => h.activate('addon-2') },
  PhAddonRemove: { path: '/tv/settings/addons', steps: async h => { await h.activate('addon-1'); await h.button('Remove addon'); } },
  PhLocalHome: { local: true, init: seedLocalMode, path: '/', backend: { localAddons: true } },
  PhItemMenu: { path: '/tv/home', note: 'menu for Mayday (phone Continue Watching has no Monster)', steps: h => h.hold('queue-0') },
  PhItemMenuLive: { path: '/tv/live', note: 'Recent list (Cartoon Network first); the Live list menu adds Programme details', steps: async h => { await h.activate(h.page.getByRole('button', { name: 'Recent', exact: true })); await h.settle(); await h.hold('live-channel-0'); } },
  PhHidden: { path: '/tv/home', steps: async h => { await h.hold('queue-0'); await h.button('Hide from Continue Watching'); } },
  PhOverflowCue: { notReachable: 'cards have no touch ⋯ button yet' },
  PhDiscoverFilter: { path: '/tv/discover', steps: h => h.activate(h.page.getByRole('button', { name: /^Genre/ })) },
  PhFilterText: { path: '/tv/discover', steps: async h => { await h.activate(h.page.getByRole('button', { name: 'Latest digital' })); await h.settle(); await h.activate(h.page.getByRole('button', { name: /^Search catalog/ })); await h.activate('text-save'); await h.waitText('required filter'); } },
  PhSourceProvider: { path: OAK_SOURCES, steps: h => h.activate('source-provider') },
  PhSourceDetails: { path: OAK_SOURCES, steps: h => h.hold('source-0') },
  PhLiveDetails: { path: '/tv/live', steps: async h => { await h.hold('live-channel-1'); await h.choose('Programme details'); } },
  PhLiveDetailsNone: { path: '/tv/live', note: 'ESPN (no guide) stands in for Cartoon Network', steps: async h => { await h.page.locator('[data-focus-id="live-channel-11"]').scrollIntoViewIfNeeded(); await h.hold('live-channel-11'); await h.choose('Programme details'); } },
  PhSearch: { path: '/tv/search', query: 'q=naruto' },
  PhSearchBlank: { path: '/tv/search', query: 'q=naruto', backend: { searchFail: true }, note: 'partial-failure notice reached with a query' },
  PhLibraryCW: { path: '/tv/my-list', steps: libraryQueue, backend: { family: 'desk' } },
  PhCastUnavailable: { path: '/tv/settings', steps: h => h.activate('settings-watch-on-tv') },
  PhStates: { notReachable: 'composite board of many states; shoot the individual states instead' },

  // ===== Desktop app 1440×900 (title bar), web 1280×800, ultra-wide =========
  DeskHome: { path: '/tv/home' },
  DeskTitle: { path: '/tv/title/series/tt-monster' },
  DeskSources: { path: OAK_SOURCES },
  DeskDiscover: { path: '/tv/discover' },
  DeskLive: { path: '/tv/live' },
  DeskLibrary: { path: '/tv/my-list' },
  DeskSettings: { path: '/tv/settings', note: 'OLED switched on as drawn, so the ground is pure black', steps: async h => { await h.activate('settings-appearance'); await h.activate('settings-oled'); } },
  WideHome: { path: '/tv/home' },
  WebHome: { path: '/tv/home' },
  WebSearch: { path: '/tv/search', query: 'q=naruto' },
  DeskPlayer: { path: MONSTER, player: {}, steps: async h => { await responsivePlayer(h); const bar = h.page.locator('[data-focus-id="timeline"]').first(); const box = await bar.boundingBox(); if (box) await h.page.mouse.move(box.x + box.width * 0.61, box.y + box.height / 2); await h.sleep(300); } },
  DeskPlayerAudio: { path: MONSTER, player: {}, steps: async h => { await responsivePlayer(h); await h.activate('audio'); } },
  DeskPlayerInfo: { path: MONSTER, player: {}, steps: async h => { await responsivePlayer(h); await h.button('Playback info'); } },
  DeskPlayerLive: { path: '/tv/home', player: { frame: '' }, steps: async h => { await h.activate(h.page.getByRole('button', { name: 'Cartoon Network' }).first()); await h.wait('[data-focus-id="audio"]', 15000); await h.page.mouse.move(700, 450); } },
  DeskPlayerBuffering: { notReachable: 'the seek notice + ring: a refused backend seek (backend seekRefused) surfaces as an HTTP 409 error toast and a pending seek (playbackHangAfter: 1) shows neither ring nor notice in this build; retry once the player shows both' },
  DeskPlayerNext: { path: MONSTER, player: {}, backend: { playbackHangAfter: 1, sourcesDone: true }, steps: async h => { await responsivePlayer(h); await h.activate('next'); await h.sleep(600); } },
  DeskPlayerError: { path: OAK_SOURCES, player: { stall: true }, steps: async h => { await h.activate('source-0'); await h.page.getByRole('dialog').first().waitFor({ timeout: 25000 }); } },
  DeskPlayerRestore: { path: MONSTER, player: { failAfter: 1 }, backend: { sourcesDone: true }, steps: async h => { await responsivePlayer(h); await h.activate('next'); await h.waitText('could not be restored', 20000); } },
  DeskUpNext: { notReachable: 'no Up Next card in the app yet' },
  WebSignIn: { backend: { session: 'none' } },
  WebSignInError: { backend: { session: 'none', loginError: true }, steps: async h => { await h.fill('#signin-username', 'vynxc'); await h.fill('#signin-password', 'password'); await h.button('Sign in'); await h.waitText('incorrect'); } },
  WebSignInDevice: { backend: { session: 'none' }, steps: h => h.button('Use another device') },
  WebSignInLocal: { local: true, backend: { session: 'none' }, steps: h => h.focus(h.page.getByRole('button', { name: 'Use without an account' })) },
  DeskSignIn: { backend: { session: 'none' } },
  WebLinkTv: { notReachable: 'no web "Link your TV" code-entry page in this app' },
  DeskProfiles: { backend: { session: 'profiles' }, path: '/tv/profiles' },
  DeskProfilesPaged: { backend: { session: 'profiles', manyProfiles: true }, path: '/tv/profiles' },
  WebProfilesManage: { backend: { session: 'profiles' }, path: '/tv/profiles', steps: h => h.activate('manage-profiles') },
  DeskProfileEdit: { backend: { session: 'profiles' }, path: '/tv/profiles', note: 'default avatar, not Clay friends 5', steps: async h => { await h.activate('add-profile'); await h.activate('profile-save'); await h.waitText('Enter a name'); } },
  DeskAvatars: { backend: { session: 'profiles' }, path: '/tv/profiles', steps: async h => { await openProfileEditor(h); await h.activate('profile-avatar'); await h.activate('avatar-category-clay'); } },
  DeskProfileDelete: { backend: { session: 'profiles' }, path: '/tv/profiles', steps: async h => { await openProfileEditor(h); await h.activate('profile-delete'); } },
  DeskPin: { path: '/tv/settings', backend: { signOutPin: true }, note: 'reached through Sign out, so the title reads "…to sign out"', steps: async h => { await h.activate('signout'); await h.choose('Sign out'); await h.wait('text-save'); await h.type('123'); await h.activate('text-save'); } },
  DeskSignOut: { path: '/tv/settings', steps: h => h.activate('signout') },
  DeskPlayback: { path: '/tv/settings/playback' },
  DeskEngine: { path: '/tv/settings/playback', steps: async h => { await h.activate('settings-engine'); await h.page.getByRole('menuitemradio', { name: 'mpv' }).hover(); await h.sleep(200); } },
  DeskAddons: { path: '/tv/settings/addons' },
  DeskAddonInstall: { path: '/tv/settings/addons', backend: { addonInstallHang: true }, steps: async h => { await h.activate('addon-add'); await h.fill('settings-install-url', 'https://lordstreams.example/manifest.json'); await h.activate('settings-install-save'); await h.waitText('Saving'); } },
  DeskAddonManage: { path: '/tv/settings/addons', steps: h => h.activate('addon-2') },
  DeskAddonRemove: { path: '/tv/settings/addons', steps: async h => { await h.activate('addon-1'); await h.button('Remove addon'); } },
  WebLocalHome: { local: true, init: seedLocalMode, path: '/', backend: { localAddons: true } },
  WebLocalLoading: { local: true, init: seedLocalMode, path: '/', backend: { localAddons: 'hang' } },
  WebLocalEmpty: { local: true, init: () => { if (!sessionStorage.getItem('preview:local')) { sessionStorage.setItem('preview:local', '1'); localStorage.setItem('viptv.local.mode.v1', '1'); } }, path: '/' },
  WebLocalAddons: { local: true, init: seedLocalMode, path: '/', backend: { localAddons: true }, steps: async h => { await h.button('Addons'); await h.fill(h.page.getByLabel('Addon manifest URL'), 'https://lordstreams.example/manifest.json'); await h.button('Install addon'); } },
  WebLocalRemove: { local: true, init: seedLocalMode, path: '/', backend: { localAddons: true }, steps: async h => { await h.button('Addons'); await h.activate(h.page.getByRole('button', { name: 'Remove' }).first()); } },
  DeskItemMenu: { path: '/tv/home', steps: h => h.hold('queue-1') },
  DeskHidden: { path: '/tv/home', steps: async h => { await h.hold('queue-1'); await h.button('Hide from Continue Watching'); } },
  DeskDiscoverCatalog: { path: '/tv/discover', steps: h => h.activate('discover-catalog') },
  DeskDiscoverFilter: { path: '/tv/discover', steps: h => h.activate('discover-filter-genre') },
  DeskSourceProvider: { path: OAK_SOURCES, steps: h => h.activate('source-provider') },
  DeskSourceDetails: { path: OAK_SOURCES, steps: h => h.hold('source-0') },
  DeskLiveDetails: { path: '/tv/live', steps: h => h.hold(h.page.getByRole('button', { name: /^CNBC: Squawk on the Street/ })) },
  DeskSearchRecent: { path: '/tv/home', backend: { recentSearches: ['naruto', 'the batman', 'dune', 'fast charlie', 'lanterns', 'one night only', 're:zero', 'mayday'] }, steps: h => h.activate(h.page.getByRole('combobox').or(h.page.getByPlaceholder(/Search/)).first()) },
  DeskSearchMatches: { path: '/tv/home', steps: async h => { await h.activate(h.page.getByRole('combobox').or(h.page.getByPlaceholder(/Search/)).first()); await h.type('the'); await h.settle(); } },
  DeskLibraryCW: { path: '/tv/my-list', steps: libraryQueue },
  DeskCastSearch: { notReachable: 'Watch on TV pairing runs only in the Tauri runtime (SmartCast commands)' },
  DeskCastManual: { notReachable: 'Watch on TV pairing runs only in the Tauri runtime (SmartCast commands)' },
  DeskCastBusy: { notReachable: 'Watch on TV pairing runs only in the Tauri runtime (SmartCast commands)' },
  DeskCastPin: { notReachable: 'Watch on TV pairing runs only in the Tauri runtime (SmartCast commands)' },
  DeskCastRemote: { notReachable: 'Watch on TV pairing runs only in the Tauri runtime (SmartCast commands)' },
  DeskCastError: { notReachable: 'Watch on TV pairing runs only in the Tauri runtime (SmartCast commands)' },
  WebCastUnavailable: { path: '/tv/home', steps: h => h.activate('responsive-cast') },
  DeskStates: { notReachable: 'composite board of many states; shoot the individual states instead' },

  // ===== TV 1920×1080 (?platform=tizen, remote keys) ========================
  TvProfiles: { backend: { session: 'profiles' } },
  TvHome: {},
  // Reference: current Home, focus moved down to Discover (the menu expands while the rail holds focus).
  TvMenu: { steps: h => h.focus('nav-Discover') },
  TvTitle: { steps: tvToTitle },
  TvSources: { steps: tvToSources },
  TvDiscover: { steps: h => h.tvGo('Discover') },
  TvLive: { steps: async h => { await h.tvGo('Live TV'); await h.focus('guide-program-1-0'); } },
  TvSearch: { steps: async h => { await h.tvGo('Search'); await h.fill(h.page.getByRole('textbox', { name: 'Search titles' }), 'naruto'); await h.settle(); await h.focus('key-T'); } },
  TvSettings: { steps: h => h.tvGo('Settings') },
  TvPlayer: { player: { paused: true }, steps: h => tvPlayer(h, { pause: true }) },
  TvPlayerSeek: { player: {}, steps: async h => { await tvPlayer(h); await h.focus('timeline'); await h.press('ArrowRight', 3); } },
  TvPlayerSubs: { player: {}, steps: async h => { await tvPlayer(h); await h.activate('subtitles'); } },
  TvPlayerLive: { player: { live: true, frame: '' }, steps: async h => { await h.activate('recent-live-0'); await h.wait('audio', 15000); await h.focus('audio'); } },
  TvPlayerBuffering: { notReachable: 'the seek notice + ring: a refused backend seek (backend seekRefused) surfaces as an HTTP 409 error toast and a pending seek (playbackHangAfter: 1) shows neither ring nor notice in this build; retry once the player shows both' },
  TvPlayerNext: { player: {}, backend: { playbackHangAfter: 1, sourcesDone: true }, steps: async h => { await tvPlayer(h); await h.activate('next'); await h.waitText('Preparing playback'); } },
  TvUpNext: { notReachable: 'no Up Next card in the app yet' },
  TvPlayerError: { player: { error: true }, steps: async h => { await tvToSources(h); await h.activate('source-0'); await h.page.getByRole('dialog').first().waitFor({ timeout: 25000 }); } },
  TvPairing: { backend: { session: 'none' } },
  TvPairingLoading: { backend: { session: 'none', pairing: 'loading' } },
  TvPairingExpired: { backend: { session: 'none', pairing: 'expired' }, clock: false, steps: h => h.waitText('expired', 8000) },
  TvProfilesManage: { backend: { session: 'profiles' }, steps: async h => { await h.activate('manage-profiles'); await h.focus('profile-0'); } },
  TvManageCue: { backend: { session: 'profiles' }, steps: h => h.activate('manage-profiles') },
  TvProfileEdit: { backend: { session: 'profiles' }, steps: h => openProfileEditor(h) },
  TvProfileName: { backend: { session: 'profiles' }, steps: async h => { await openProfileEditor(h); await h.activate('profile-name'); } },
  TvAvatars: { backend: { session: 'profiles' }, steps: async h => { await openProfileEditor(h); await h.activate('profile-avatar'); await h.focus('avatar-category-clay'); await h.activate('avatar-category-clay'); await h.focus('avatar-0'); } },
  TvProfileDelete: { backend: { session: 'profiles' }, steps: async h => { await openProfileEditor(h); await h.activate('profile-delete'); } },
  TvPin: { backend: { signOutPin: true }, steps: async h => { await settingsRow(h, 'signout'); await h.choose('Sign out'); await h.wait('text-save'); await h.type('1234'); } },
  TvPinError: { backend: { signOutPin: true, wrongPin: true }, note: 'reached through Sign out, so the title reads "…to sign out"', steps: async h => { await settingsRow(h, 'signout'); await h.choose('Sign out'); await h.wait('text-save'); await h.type('1234'); await h.activate('text-save'); await h.waitText('Incorrect PIN'); } },
  TvSignOut: { steps: h => settingsRow(h, 'signout') },
  TvPlayback: { steps: async h => { await settingsRow(h, 'settings-playback'); await h.focus('quality'); } },
  TvPlaybackChoice: { steps: async h => { await settingsRow(h, 'settings-playback'); await h.activate('subtitle-size'); } },
  TvAddons: { steps: async h => { await settingsRow(h, 'settings-addons'); await h.focus('addon-2'); } },
  TvAddonInstall: { steps: async h => { await settingsRow(h, 'settings-addons'); await h.activate('addon-add'); } },
  TvAddonManage: { steps: async h => { await settingsRow(h, 'settings-addons'); await h.activate('addon-2'); } },
  TvAddonRemove: { steps: async h => { await settingsRow(h, 'settings-addons'); await h.activate('addon-1'); await h.button('Remove addon'); } },
  TvItemMenu: { steps: h => h.hold('queue-0') },
  TvHidden: { steps: async h => { await h.hold('queue-0'); await h.button('Hide from Continue Watching'); } },
  TvDiscoverFilter: { steps: async h => { await h.tvGo('Discover'); await h.activate('discover-filter-genre'); } },
  TvFilterText: { steps: async h => { await h.tvGo('Discover'); await h.activate('discover-catalog'); await h.button('Latest digital', { exact: false }); await h.settle(); await h.activate('discover-filter-search'); await h.activate('text-save'); await h.waitText('required filter'); } },
  TvSourceProvider: { steps: async h => { await tvToSources(h); await h.activate('source-provider'); } },
  TvSourceDetails: { steps: async h => { await tvToSources(h); await h.hold('source-0'); } },
  TvLiveDetails: { steps: async h => { await h.tvGo('Live TV'); await h.hold('guide-program-1-0'); } },
  TvLiveSearch: { steps: async h => { await h.tvGo('Live TV'); await h.activate('guide-search'); await h.type('cnb'); } },
  TvMoreInfo: { steps: async h => { await tvToTitle(h); await h.activate('detail-info'); } },
  TvLibrary: { steps: async h => { await h.tvGo('My List'); await h.activate('library-queue'); } },
  TvStates: { notReachable: 'composite board of many states; shoot the individual states instead' },
};

/** Local mode: enter it and install three addons whose manifests the harness serves. */
function seedLocalMode() {
  if (sessionStorage.getItem('preview:local')) return;
  sessionStorage.setItem('preview:local', '1');
  localStorage.setItem('viptv.local.mode.v1', '1');
  // Mirrors localManifest() in backend.ts (init scripts cannot import).
  const addon = (ordinal, id, name, base, enabled) => ({
    ordinal, id, manifestUrl: `https://${base}/manifest.json`, installedAt: 1790000000000 + ordinal, enabled,
    manifest: { id, name, version: '1.0.0', resources: ['catalog', 'meta', 'stream'], types: ['movie', 'series'], idPrefixes: ['tt'],
      catalogs: ordinal === 1 ? [{ type: 'movie', id: 'popular', name: 'Popular movies' }, { type: 'movie', id: 'new', name: 'New releases' }] : [] },
  });
  localStorage.setItem('viptv.local.registry.v1', JSON.stringify({ version: 1, nextOrdinal: 4, addons: [
    addon(1, 'com.lordstreams.addon', 'LordStreams', 'lordstreams.example', true),
    addon(2, 'org.thisiptv.addon', 'ThisIPTV', 'thisiptv.example', true),
    addon(3, 'io.lucidhosting.addon', 'LucidHosting', 'lucidhosting.example', false),
  ] }));
}
