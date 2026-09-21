import type { Page } from '@playwright/test';

export const apiOrigin = 'https://viptv.syek.tech';
export const sessionKey = `viptv-device:${apiOrigin}`;
export const movie = {
  id: 'responsive-movie', type: 'movie', name: 'A Different Horizon', title: 'A Different Horizon',
  poster: 'https://art.example/poster.svg', background: 'https://art.example/backdrop.svg',
  description: 'A small crew follows a distant signal across an unfamiliar world. The journey brings them home.',
  year: 2026, genres: ['Adventure', 'Drama'],
};

export async function installBackend(page: Page, options: { series?: boolean; invalidLogo?: boolean; populated?: boolean; activity?: boolean } = {}) {
  const title = options.series ? {
    ...movie, id: 'responsive-series', type: 'series', name: 'Beyond the Horizon', title: 'Beyond the Horizon',
    logo: `https://art.example/${options.invalidLogo ? 'invalid-logo' : 'title-logo'}.svg`,
    videos: Array.from({ length: 8 }, (_, index) => ({ id: `responsive-series:1:${index + 1}`, title: `Episode ${index + 1}`, season: 1, episode: index + 1, thumbnail: 'https://art.example/episode.svg', description: `Episode ${index + 1} brings the crew closer to the signal.` })),
  } : options.populated ? { ...movie, logo: 'https://art.example/title-logo.svg', description: `${movie.description} ${movie.description} This extended description exercises real catalog copy wrapping across phones, tablets and wide desktop displays.` } : movie;
  const queue = Array.from({ length: 24 }, (_, index) => ({
    id: `queue-series:1:${index + 1}`, type: 'episode', series_id: 'queue-series',
    name: 'Returning Series', title: `Episode ${index + 1}`, episode_title: `Episode ${index + 1}`,
    season: 1, episode: index + 1, position: 42 + index, duration: 2400, queue_status: 'resume',
    poster: 'https://art.example/poster.svg',
  }));
  const liveChannels = Array.from({ length: 4 }, (_, index) => ({
    id: `station-${index}`, type: 'live', name: `International News ${index + 1}`, logo: `https://art.example/live-logo-${index}.svg`, section: 'News',
  }));
  const profileName = options.populated ? 'Alexandria Montgomery-Jones' : 'Alex';
  let selectedProfileId: string | null = null;
  const requests: { method: string; path: string; body: Record<string, unknown> }[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ key }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
      sessionId: 'responsive-session', accountId: '7', profileId: null,
      accessToken: 'fixture-access', refreshToken: 'fixture-refresh', expiresIn: 900,
    }));
  }, { key: sessionKey });
  const artworkResponse = (path: string) => {
    if (path === '/invalid-logo.svg') return { status: 404, body: '' };
    const portrait = path === '/poster.svg';
    const logo = path === '/title-logo.svg';
    if (path.startsWith('/live-logo-')) return { contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="7000" height="1000" viewBox="0 0 7000 1000"><text x="0" y="750" font-size="900" fill="white">WORLD NEWS</text></svg>' };
    const width = logo ? 1280 : portrait ? 2000 : path === '/episode.svg' ? 1920 : 3840;
    const height = logo ? 320 : portrait ? 3000 : path === '/episode.svg' ? 1080 : 2160;
    const content = logo
      ? '<path d="M20 40L120 160 20 280H100L200 160 100 40Z" fill="#f5f5f5"/><text x="245" y="195" font-family="sans-serif" font-size="110" fill="#f5f5f5">THE HORIZON</text>'
      : `<rect width="${width}" height="${height}" fill="#15263a"/><circle cx="${width * .74}" cy="${height * .28}" r="${width * .12}" fill="#dab979"/><path d="M0 ${height}L${width * .32} ${height * .43}L${width * .62} ${height * .76}L${width} ${height * .38}V${height}Z" fill="#42566a"/><path d="M0 ${height}L${width * .47} ${height * .72}L${width} ${height * .88}V${height}Z" fill="#20313b"/>`;
    return { contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>` };
  };
  await page.route('https://art.example/**', route => route.fulfill(artworkResponse(new URL(route.request().url()).pathname)));
  // Card art is served through the shared wsrv pipeline; unwrap the origin
  // URL so the fixtures answer for the derivative requests too.
  await page.route('https://wsrv.nl/**', route => {
    const inner = new URL(route.request().url()).searchParams.get('url');
    const origin = inner ? new URL(inner) : undefined;
    route.fulfill(origin && origin.hostname === 'art.example' ? artworkResponse(origin.pathname) : { status: 404, body: '' });
  });
  // The core artwork policy proxies every remote image through wsrv.nl; unwrap
  // the inner url so fixture artwork serves locally without network access.
  await page.route('https://wsrv.nl/**', route => {
    const inner = new URL(route.request().url()).searchParams.get('url');
    route.fulfill(artworkResponse(inner ? new URL(inner).pathname : '/'));
  });
  await page.route(`${apiOrigin}/api/**`, async route => {
    const request = route.request();
    const headers = {
      'access-control-allow-origin': 'http://127.0.0.1:4173',
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type',
    };
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(request.url()).pathname;
    const body = JSON.parse(request.postData() || '{}') as Record<string, unknown>;
    requests.push({ method: request.method(), path, body });
    if (path === '/api/auth/me') return json({
      account: { id: '7', username: 'alex', name: 'Alex', role: 'member' },
      profiles: [{ id: '1', name: profileName, setup_complete: true }],
      profile_id: selectedProfileId, restricted: false, profile_setup_required: false,
    });
    if (path === '/api/auth/profile') {
      selectedProfileId = String(body.profile_id);
      return json({ profile_id: selectedProfileId });
    }
    if (path === '/api/profiles/1/continue/page') return json({ items: options.activity ? queue : [], offset: 0, total: options.activity ? queue.length : 0, next_offset: null });
    if (path === '/api/profiles/1/progress' || path === '/api/profiles/1/favorites') return json([]);
    if (path === '/api/profiles/1/preferences') return json({ audio_language: 'en', subtitle_language: 'en', subtitles_enabled: false, subtitle_size: 'normal', subtitle_style: 'system', quality: 'auto', autoplay: true });
    if (path === '/api/addons') return json([]);
    if (path === '/api/catalogs') return json(Array.from({ length: options.populated ? 4 : 1 }, (_, i) => ({ id: i ? `catalog-${i}` : 'popular', name: options.populated ? `Global Cinema Collection — ${['Popular', 'Recently Added', 'Drama', 'Adventure'][i]} Features and Award-Winning International Television` : 'Popular', type: title.type, addon_id: 2, supports_search: true, supports_skip: true })));
    if (path === '/api/discover') return json({ metas: options.populated ? Array.from({ length: 24 }, (_, i) => ({ ...title, id: i ? `title-${i}` : title.id, name: i ? `The Long Journey Through the Mountains: Chapter ${i}` : title.name })) : [title], has_more: false, next_skip: null });
    if (path === '/api/live') return json({ channels: options.activity ? liveChannels : [], total: options.activity ? liveChannels.length : 0 });
    if (path === '/api/live/categories') return json({ categories: [], total: 0 });
    if (path.startsWith('/api/guide/')) return json({ programs: [], timeline: [], timezone: 'UTC' });
    if (options.activity && path === '/api/meta/series/queue-series') return json({ meta: { id: 'queue-series', type: 'series', name: 'Returning Series', poster: 'https://art.example/poster.svg', background: 'https://art.example/backdrop.svg', videos: queue.map(item => ({ id: item.id, title: item.episode_title, season: item.season, episode: item.episode, thumbnail: `https://art.example/episode.svg?episode=${item.episode}` })) } });
    if (path === `/api/meta/${title.type}/${title.id}`) return json({ meta: title });
    if (options.populated && /^\/api\/meta\/movie\/title-\d+$/.test(path)) return json({ meta: { ...title, id: path.split("/").at(-1), name: "The Long Journey Through the Mountains" } });
    if (path === '/api/profiles/1/progress/series') return json([]);
    if (path === '/api/streams' && request.method() === 'POST') return json({ id: 'responsive-sources' });
    if (path === '/api/streams/responsive-sources') return json({ events: [{ seq: 1, source: 'addon:2', streams: [{ id: 'responsive-stream', name: options.populated ? 'International Cinema Archive • High Definition • Original Language and Commentary • Extended Edition' : 'Responsive source 1080p', title: 'A Different Horizon 1080p', source_addon_id: 'addon:2', source_name: options.populated ? 'International Cinema and Television Collection — Premium Archive Provider' : 'Fixture addon' }] }], done: true });
    return json({ error: `Unhandled fixture route ${path}` }, 404);
  });
  return { requests, errors, title, profileName };
}

