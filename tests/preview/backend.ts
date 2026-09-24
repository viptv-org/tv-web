/*
 * Preview harness mock backend. A private copy (not shared with tests/e2e) so
 * e2e helper changes never break the preview. Shapes are inferred only from
 * src/api/* and the vendored core normalizers; sample titles, copy, numbers
 * and artwork come from the design reference screens so screenshots compare
 * one-to-one with reference/screens/img/<platform>/<Name>.webp.
 *
 * Self-contained on purpose: Node runs this file with type stripping and the
 * repo typecheck includes tests/preview, so it imports nothing local.
 */
import type { Page, Route } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const apiOrigin = 'https://viptv.syek.tech';
export const sessionKey = `viptv-device:${apiOrigin}`;
export const referenceDir = fileURLToPath(new URL('../../../design/viptv-design-system/reference/', import.meta.url));
const hlsDir = fileURLToPath(new URL('../fixtures/hls/', import.meta.url));
const ART = 'https://art.example/ref/';

/** Reference platform family: phone art/sample data, desktop+web, or TV. */
export type Family = 'phone' | 'desk' | 'tv';

export interface BackendOptions {
  family: Family;
  /** none → pairing screen; profiles → Who's watching; ready → profile 1 selected. */
  session?: 'none' | 'profiles' | 'ready';
  /** Twelve profiles (paged Who's watching). */
  manyProfiles?: boolean;
  /** Pairing: device/code never answers (Connecting…) or the code expires after 1 s. */
  pairing?: 'pending' | 'loading' | 'expired';
  /** Web sign-in: the password is rejected. */
  loginError?: boolean;
  /** Profile edits/deletes and choosing "cedes" need the parent PIN (403 first). */
  profilePin?: boolean;
  /** Sign out needs the parent PIN. */
  signOutPin?: boolean;
  /** Every PIN is rejected (Incorrect PIN). */
  wrongPin?: boolean;
  /** Continue Watching entries (default true). */
  queue?: boolean;
  /** My List entries (default false). */
  favorites?: boolean;
  /** Sources keep "still checking" (default true) or finish. */
  sourcesDone?: boolean;
  /** Installing an addon fails (400). */
  addonInstallError?: boolean;
  /** The media element errors when playback starts. */
  playbackError?: boolean;
  /** Playback session request never answers (preparing). */
  playbackHang?: boolean;
  /** Playback requests after the first N never answer (preparing the next episode). */
  playbackHangAfter?: number;
  /** Playback requests after the first N fail (playback could not be restored). */
  playbackFailAfter?: number;
  /** Creating/updating a profile never answers (Saving profile…). */
  profileSaveHang?: boolean;
  /** Installing an addon never answers (Saving…). */
  addonInstallHang?: boolean;
  /** The search catalogs fail (partial results notice). */
  searchFail?: boolean;
  /** No catalogs at all. */
  noCatalogs?: boolean;
  /** Every API request fails as a refused connection. */
  backendDown?: boolean;
  /** Discover/catalog requests never answer (skeletons). */
  catalogHang?: boolean;
  /** Local mode: serve the Stremio addon hosts (lordstreams/thisiptv/lucidhosting.example); 'hang' never answers catalogs. */
  localAddons?: boolean | 'hang';
  /** Recent searches stored for the profile. */
  recentSearches?: string[];
  /** Media timeline for the stubbed player, seconds. */
  media?: { duration?: number; position?: number; paused?: boolean };
}

// ---------------------------------------------------------------------------
// Artwork: reference asset hashes by 6-char prefix.
const assetFiles = new Map<string, string>();
for (const file of readdirSync(`${referenceDir}assets`)) assetFiles.set(file.slice(0, 6), file);
/** A per-family art pick: one prefix for all families, or {desk, phone, tv}. */
type Art = string | Partial<Record<Family, string>>;
const pickArt = (art: Art | undefined, family: Family) => {
  if (!art) return undefined;
  const prefix = typeof art === 'string' ? art : art[family] ?? art.desk ?? art.phone ?? art.tv;
  const file = prefix && assetFiles.get(prefix);
  return file ? `${ART}${file}` : undefined;
};

// ---------------------------------------------------------------------------
// Titles. Art per family follows the reference screens (desktop posters are
// 172×258, phone posters are separate crops, TV tiles are 16:9 stills).
interface TitleSpec {
  id: string; type: 'movie' | 'series'; name: string; year: number; runtime?: string; genres: string[];
  poster?: Art; background?: Art; logo?: Art; description?: string; cast?: string[]; director?: string; imdb?: string;
}
const OAK_TEXT = 'The Platt family bands together to navigate their new surroundings after a cosmic event transports their suburban neighborhood to someplace unknown.';
const MONSTER_TEXT = 'This true-crime anthology series delivers a multi-layered psychological study of individuals whose extreme actions shocked society.';
const titles: TitleSpec[] = [
  { id: 'tt-oak-street', type: 'movie', name: 'The End of Oak Street', year: 2026, runtime: '100 min', genres: ['Action', 'Adventure', 'Mystery'], poster: { desk: 'c5e059', phone: '9f0f26', tv: '76544c' }, background: { desk: 'a57298', phone: '147a5b', tv: '76544c' }, logo: { desk: '274e70', phone: '83e64e', tv: '274e70' }, description: OAK_TEXT, cast: ['Anne Hathaway', 'Ewan McGregor', 'Maisy Stella'], imdb: '6.8' },
  { id: 'tt-mayday', type: 'movie', name: 'Mayday', year: 2026, runtime: '111 min', genres: ['Action', 'Adventure'], poster: { desk: '583431', phone: 'c484b9', tv: 'd40b97' }, background: 'd40b97', description: 'A pilot on a routine flight is pulled into a mid-air crisis that only she can resolve.' },
  { id: 'tt-camp-miasma', type: 'movie', name: 'Teenage Sex and Death at Camp Miasma', year: 2026, runtime: '112 min', genres: ['Drama', 'Horror'], poster: { desk: '1b8e77', phone: 'f17e56', tv: 'f77eaf' }, background: 'f77eaf' },
  { id: 'tt-whisper-man', type: 'movie', name: 'The Whisper Man', year: 2026, runtime: '111 min', genres: ['Crime', 'Drama'], poster: { desk: 'b3223e', phone: 'e79ab5', tv: 'dc2c45' }, background: 'dc2c45' },
  { id: 'tt-obsession', type: 'movie', name: 'Obsession', year: 2026, runtime: '109 min', genres: ['Horror', 'Romance'], poster: { desk: '853a62', phone: '82b9a5', tv: 'd38555' }, background: 'd38555' },
  { id: 'tt-practical-magic', type: 'movie', name: 'Practical Magic', year: 1998, runtime: '104 min', genres: ['Comedy', 'Drama'], poster: { desk: '77f3ff', phone: '4cb79e', tv: '2ac510' }, background: '2ac510' },
  { id: 'tt-in-the-grey', type: 'movie', name: 'In the Grey', year: 2026, runtime: '97 min', genres: ['Action', 'Drama'], poster: { desk: '4ad1cd', phone: '6ea8ce', tv: '4ecebe' }, background: '4ecebe' },
  { id: 'tt-ministry', type: 'movie', name: 'The Ministry of Ungentlemanly Warfare', year: 2024, runtime: '120 min', genres: ['Action', 'Comedy'], poster: { desk: '73769f', phone: '6c22aa', tv: 'ca61b7' }, background: 'ca61b7' },
  { id: 'tt-tony', type: 'movie', name: 'Tony', year: 2026, runtime: '106 min', genres: ['Biography', 'Drama'], poster: { desk: 'cf9ac6', phone: '832dc6' } },
  { id: 'tt-the-invite', type: 'movie', name: 'The Invite', year: 2026, runtime: '107 min', genres: ['Comedy'], poster: '6df8de' },
  { id: 'tt-backrooms', type: 'movie', name: 'Backrooms', year: 2026, runtime: '111 min', genres: ['Horror'], poster: '7a2433' },
  { id: 'tt-hail-mary', type: 'movie', name: 'Project Hail Mary', year: 2026, runtime: '157 min', genres: ['Adventure', 'Sci-Fi'], poster: 'f13178' },
  { id: 'tt-pressure', type: 'movie', name: 'Pressure', year: 2026, runtime: '101 min', genres: ['Drama'], poster: 'f8d575' },
  { id: 'tt-mandalorian', type: 'movie', name: 'Star Wars: The Mandalorian and Grogu', year: 2026, runtime: '132 min', genres: ['Action', 'Sci-Fi'], poster: 'a58ce5' },
  { id: 'tt-one-night-only', type: 'movie', name: 'One Night Only', year: 2026, runtime: '103 min', genres: ['Comedy'], poster: '73adb3', background: '162644' },
  { id: 'tt-weapons', type: 'movie', name: 'Weapons', year: 2025, runtime: '129 min', genres: ['Horror', 'Thriller'], poster: '138b3e' },
  { id: 'tt-wish-me-dead', type: 'movie', name: 'Those Who Wish Me Dead', year: 2021, runtime: '100 min', genres: ['Action', 'Thriller'], poster: '9655a6' },
  { id: 'tt-dune', type: 'movie', name: 'Dune', year: 2021, runtime: '155 min', genres: ['Sci-Fi', 'Adventure'], background: 'c0392e' },
  { id: 'tt-fast-charlie', type: 'movie', name: 'Fast Charlie', year: 2023, runtime: '90 min', genres: ['Action', 'Crime'], background: '39a481' },
  { id: 'tt-the-batman', type: 'movie', name: 'The Batman', year: 2022, runtime: '176 min', genres: ['Crime', 'Drama'], background: '3cae2e' },
  { id: 'tt-naruto-movie-tv', type: 'movie', name: 'Naruto Shippûden: The Movie', year: 2007, runtime: '94 min', genres: ['Animation', 'Action'], background: '4fb620' },
  // Series.
  { id: 'tt-monster', type: 'series', name: 'Monster: The Jeffrey Dahmer Story', year: 2022, runtime: '52 min', genres: ['Biography', 'Crime', 'Drama'], poster: 'd1f119', background: { desk: '63e024', phone: '63e024', tv: '7432c1' }, logo: 'd105c8', description: MONSTER_TEXT, cast: ['Evan Peters', 'Charlie Hunnam', 'Richard Jenkins'], imdb: '7.7' },
  { id: 'tt-muppet-show', type: 'series', name: 'The Muppet Show', year: 2026, runtime: '32 min', genres: ['Comedy'], poster: '86e419' },
  { id: 'tt-lanterns', type: 'series', name: 'Lanterns', year: 2026, runtime: '55 min', genres: ['Action', 'Drama'], background: '463bf3' },
  { id: 'tt-rezero', type: 'series', name: 'Re:Zero − Starting Life in Another World', year: 2016, runtime: '25 min', genres: ['Animation', 'Fantasy'], background: { desk: '59eef3', phone: '59eef3', tv: '22d40e' } },
  // Search "naruto".
  { id: 'tt-boruto-movie', type: 'movie', name: 'Boruto: Naruto the Movie', year: 2015, runtime: '95 min', genres: ['Animation', 'Action'], poster: { desk: 'b973bf', phone: 'b973bf', tv: '333acd' }, background: '333acd' },
  { id: 'tt-the-last-naruto', type: 'movie', name: 'The Last: Naruto the Movie', year: 2014, runtime: '112 min', genres: ['Animation', 'Action'], poster: { desk: '1daf86', phone: '1daf86', tv: '1e0b11' }, background: '1e0b11' },
  { id: 'tt-naruto-shippuden-movie', type: 'movie', name: 'Naruto Shippûden the Movie', year: 2007, runtime: '94 min', genres: ['Animation'], poster: '0009e1' },
  { id: 'tt-naruto-movie-2004', type: 'movie', name: 'Naruto the Movie', year: 2004, runtime: '82 min', genres: ['Animation'], poster: '9f45af' },
  { id: 'tt-naruto-movie-2008', type: 'movie', name: 'Naruto Shippuden the Movie', year: 2008, runtime: '95 min', genres: ['Animation'], poster: '070438' },
  { id: 'tt-naruto-movie-2010', type: 'movie', name: 'Naruto Shippûden the Movie', year: 2010, runtime: '85 min', genres: ['Animation'], poster: '5c0b51' },
  { id: 'tt-naruto-movie-2011', type: 'movie', name: 'Naruto Shippuden the Movie', year: 2011, runtime: '90 min', genres: ['Animation'], poster: '5942b4' },
  { id: 'tt-naruto-movie-2005', type: 'movie', name: 'Naruto the Movie', year: 2005, runtime: '93 min', genres: ['Animation'], poster: 'a8f1dd' },
  { id: 'tt-naruto-silver', type: 'movie', name: 'Naruto: Climbing Silver', year: 2021, runtime: '20 min', genres: ['Animation'], poster: '962bde' },
  { id: 'tt-naruto', type: 'series', name: 'Naruto', year: 2002, runtime: '23 min', genres: ['Animation', 'Action'], poster: { desk: '0390bb', phone: '0390bb', tv: 'ffe8d5' }, background: 'ffe8d5' },
  { id: 'tt-naruto-shippuden', type: 'series', name: 'Naruto: Shippuden', year: 2007, runtime: '23 min', genres: ['Animation', 'Action'], poster: { desk: 'd478c0', phone: 'd478c0', tv: '28c32c' }, background: '28c32c' },
  { id: 'tt-boruto', type: 'series', name: 'Boruto: Naruto Next Generations', year: 2017, runtime: '23 min', genres: ['Animation', 'Action'], poster: { desk: '8b1439', phone: '8b1439', tv: '973c0a' }, background: '973c0a' },
  { id: 'tt-naruto-sd', type: 'series', name: 'Naruto SD: Rock Lee', year: 2012, runtime: '24 min', genres: ['Animation', 'Comedy'], poster: 'e98b2b' },
];
const byId = new Map(titles.map(title => [title.id, title]));

/** Monster, Season 1 — reference copy for E1–E6. */
const monsterEpisodes: { title: string; description: string; still?: Art }[] = [
  { title: 'Episode One', description: 'After throwing his neighbor off the stench coming from his apartment, Jeff heads to a local bar, where a young man is about to cross paths with a killer.', still: { desk: 'a24352', phone: 'a24352', tv: '42b16a' } },
  { title: 'Please Don’t Go', description: 'A young Jeff contends with troubles at home and school. Years later, his strange behavior evolves into something far more sinister.', still: { desk: 'fb7603', phone: 'fb7603', tv: '6815a9' } },
  { title: 'Doin’ A Dahmer', description: 'Left to live alone after his parents’ turbulent divorce, high school senior Jeff breaks routine when he invites a hitchhiker home.', still: { desk: '62243c', phone: '62243c', tv: 'd00331' } },
  { title: 'The Good Boy Box', description: 'From high school to the Army, Jeff struggles to find stability. While living in his grandmother’s house, Jeff’s urges intensify.', still: { desk: '343efa', phone: '343efa', tv: '0f11da' } },
  { title: 'Blood On Their Hands', description: 'Jeff’s list of victims grows longer without a full police investigation. An encounter with a teen lands him in trouble with the law.', still: '4baced' },
  { title: 'Silenced', description: 'Aspiring model Tony moves to Madison and meets Jeff at a bar, beginning a relationship through a shared sense of isolation.', still: '4d838f' },
  { title: 'Cassandra', description: 'After Jeff’s arrest, his neighbor Glenda struggles to be heard as the story spreads across the country.' },
  { title: 'Lionel', description: 'Jeff’s father wrestles with his own guilt while the trial draws national attention.' },
  { title: 'The Bogeyman', description: 'Jeff faces the consequences of his crimes as the case reaches its verdict.' },
  { title: 'God of Forgiveness, God of Vengeance', description: 'In prison, Jeff seeks redemption while the families of his victims seek justice.' },
];

function item(spec: TitleSpec, family: Family, extra: Record<string, unknown> = {}) {
  return {
    id: spec.id, type: spec.type, name: spec.name, year: spec.year, releaseInfo: String(spec.year),
    ...(spec.runtime ? { runtime: spec.runtime } : {}), genres: spec.genres,
    ...(pickArt(spec.poster, family) ? { poster: pickArt(spec.poster, family) } : pickArt(spec.background, family) ? { poster: pickArt(spec.background, family) } : {}),
    ...(pickArt(spec.background, family) ? { background: pickArt(spec.background, family) } : {}),
    ...(pickArt(spec.logo, family) ? { logo: pickArt(spec.logo, family) } : {}),
    ...(spec.description ? { description: spec.description } : {}),
    ...(spec.cast ? { cast: spec.cast } : {}),
    ...(spec.director ? { director: spec.director } : {}),
    ...(spec.imdb ? { imdbRating: spec.imdb } : {}),
    ...extra,
  };
}
function meta(spec: TitleSpec, family: Family) {
  const base = item(spec, family);
  if (spec.type !== 'series') return base;
  const videos = spec.id === 'tt-monster'
    ? [1, 2, 3].flatMap(season => monsterEpisodes.map((episode, index) => ({
      id: `${spec.id}:${season}:${index + 1}`, title: season === 1 ? episode.title : `Episode ${index + 1}`, season, episode: index + 1,
      description: season === 1 ? episode.description : 'Episode details are coming soon.',
      ...(season === 1 && pickArt(episode.still, family) ? { thumbnail: pickArt(episode.still, family) } : {}),
      released: `2022-09-21T00:00:00Z`,
    })))
    : Array.from({ length: 8 }, (_, index) => ({ id: `${spec.id}:1:${index + 1}`, title: index === 0 && spec.id === 'tt-lanterns' ? 'Pilot' : `Episode ${index + 1}`, season: 1, episode: index + 1, ...(pickArt(spec.background, family) ? { thumbnail: pickArt(spec.background, family) } : {}) }));
  return { ...base, videos };
}

/** Continue Watching per family (the three reference sets differ). */
function queueFor(family: Family) {
  const movie = (id: string, position: number, duration: number, art?: Art) => {
    const spec = byId.get(id)!;
    return { ...item(spec, family), ...(art ? { background: pickArt(art, family) } : {}), position, duration, queue_status: 'resume' };
  };
  const episode = (seriesId: string, season: number, number: number, episodeTitle: string, position: number, duration: number, still?: Art) => {
    const spec = byId.get(seriesId)!;
    return {
      ...item(spec, family), id: `${seriesId}:${season}:${number}`, type: 'episode', series_id: seriesId, name: spec.name,
      episode_title: episodeTitle, season, episode: number, position, duration, queue_status: 'resume',
      ...(pickArt(still, family) ? { thumbnail: pickArt(still, family) } : {}),
      // The reference item menu offers "Resume previous episode" for these rows.
      previous_episode: { id: `${seriesId}:${season}:${Math.max(1, number - 1)}`, type: 'episode', series_id: seriesId, name: spec.name, season, episode: Math.max(1, number - 1), position: 600, duration },
    };
  };
  if (family === 'tv') return [
    episode('tt-monster', 1, 1, 'Episode One', 4, 3130, 'd1f119'),
    movie('tt-obsession', 16, 6540, '3da010'),
    movie('tt-naruto-movie-tv', 18, 5640),
    episode('tt-rezero', 4, 15, 'A Single-Minded Stand', 300, 1500, '22d40e'),
    movie('tt-mayday', 0, 6660),
    movie('tt-whisper-man', 2650, 6660),
    movie('tt-in-the-grey', 3725, 5820),
    movie('tt-practical-magic', 1231, 6240),
    movie('tt-ministry', 6002, 7200),
  ].map(entry => entry.id === 'tt-mayday' ? { ...entry, queue_status: 'resume', position: 1 } : entry);
  if (family === 'phone') return [
    movie('tt-mayday', 4140, 6660),
    movie('tt-whisper-man', 2760, 6660),
    movie('tt-obsession', 5820, 6540),
  ];
  return [
    movie('tt-one-night-only', 4426, 6180),
    episode('tt-lanterns', 1, 1, 'Pilot', 343, 3300, '463bf3'),
    movie('tt-dune', 332, 9300),
    episode('tt-rezero', 4, 15, 'A Single-Minded Stand', 300, 1500, '59eef3'),
    movie('tt-fast-charlie', 4118, 5400),
    movie('tt-the-batman', 9397, 10560),
  ];
}
const favoritesFor = (family: Family) =>
  ['tt-practical-magic', 'tt-in-the-grey', 'tt-ministry', 'tt-tony', 'tt-obsession', 'tt-whisper-man'].map(id => item(byId.get(id)!, family));

// ---------------------------------------------------------------------------
// Catalogs (Discover reference: Movies · Series · Anime · Other; movie
// catalogs Popular · Seasonal · Trakt Trending · Latest digital).
const GENRES = ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller'];
const catalogs = [
  { id: 'top', type: 'movie', name: 'Popular', addon_id: 1, addon_name: 'Cinemeta', supports_search: true, supports_skip: true, genres: GENRES,
    extra: [{ name: 'genre', options: GENRES }, { name: 'year', options: ['2026', '2025', '2024', '2023'] }, { name: 'search' }, { name: 'skip' }] },
  { id: 'seasonal', type: 'movie', name: 'Seasonal', addon_id: 2, addon_name: 'Trakt', supports_search: false, supports_skip: true, extra: [{ name: 'skip' }] },
  { id: 'trakt-trending', type: 'movie', name: 'Trakt Trending', addon_id: 2, addon_name: 'Trakt', supports_search: false, supports_skip: true, extra: [{ name: 'skip' }] },
  // A required text extra, so the required-filter entry is reachable.
  { id: 'latest-digital', type: 'movie', name: 'Latest digital', addon_id: 1, addon_name: 'Cinemeta', supports_search: true, supports_skip: false, extra: [{ name: 'search', is_required: true }] },
  { id: 'top', type: 'series', name: 'Popular', addon_id: 1, addon_name: 'Cinemeta', supports_search: true, supports_skip: true,
    extra: [{ name: 'genre', options: GENRES }, { name: 'search' }, { name: 'skip' }] },
  { id: 'kitsu-top-airing', type: 'anime', name: 'Top airing', addon_id: 3, addon_name: 'Anime Kitsu', supports_search: false, supports_skip: true, extra: [{ name: 'skip' }] },
  { id: 'channels', type: 'channel', name: 'Channels', addon_id: 4, addon_name: 'ThisIPTV', supports_search: false, supports_skip: false, extra: [] },
];
const moviePool = ['tt-oak-street', 'tt-mayday', 'tt-camp-miasma', 'tt-whisper-man', 'tt-obsession', 'tt-practical-magic', 'tt-in-the-grey', 'tt-ministry', 'tt-tony', 'tt-the-invite', 'tt-backrooms', 'tt-hail-mary', 'tt-pressure', 'tt-mandalorian', 'tt-one-night-only', 'tt-weapons', 'tt-wish-me-dead'];
const seriesPool = ['tt-monster', 'tt-muppet-show', 'tt-lanterns', 'tt-rezero', 'tt-naruto', 'tt-naruto-shippuden', 'tt-boruto', 'tt-naruto-sd'];
const searchPool = titles.map(title => title.id);
function discover(url: URL, family: Family) {
  const type = url.searchParams.get('type') ?? 'movie';
  const catalog = url.searchParams.get('catalog') ?? 'top';
  const search = url.searchParams.get('search')?.trim().toLowerCase();
  const genre = url.searchParams.get('genre');
  let ids: string[];
  if (search) {
    const want = type === 'series' || type === 'anime' ? 'series' : 'movie';
    ids = searchPool.filter(id => byId.get(id)!.type === want && byId.get(id)!.name.toLowerCase().includes(search));
    // Search ranks the reference's "naruto" results first.
    ids.sort((left, right) => searchPool.indexOf(left) - searchPool.indexOf(right));
    if (search === 'naruto') ids = ids.filter(id => id !== 'tt-naruto-movie-tv');
  } else if (type === 'movie') {
    const rotate = { seasonal: 4, 'trakt-trending': 8, 'latest-digital': 2 }[catalog] ?? 0;
    ids = [...moviePool.slice(rotate), ...moviePool.slice(0, rotate)];
  } else if (type === 'series') ids = seriesPool;
  else if (type === 'anime') ids = ['tt-naruto-shippuden', 'tt-boruto', 'tt-rezero', 'tt-naruto'];
  else ids = [];
  if (genre) ids = ids.filter(id => byId.get(id)!.genres.includes(genre));
  const skip = Number(url.searchParams.get('skip') ?? 0);
  const page = ids.slice(skip, skip + 50);
  return { metas: page.map(id => item(byId.get(id)!, family, type === 'anime' ? { type: byId.get(id)!.type } : {})), has_more: false, next_skip: null };
}

// ---------------------------------------------------------------------------
// Live TV (DeskLive / TvLive / Live reference), times in Eastern time on
// Wednesday 23 September 2026.
const et = (time: string) => Date.parse(`2026-09-23T${time}:00-04:00`) / 1000;
type Programme = [start: string, end: string, title: string, description?: string];
const channels: { id: string; name: string; badge: string; category: string; programmes: Programme[]; region?: string }[] = [
  { id: 'abc-news-live', name: 'ABC News Live', badge: 'abc', category: 'news', programmes: [['10:00', '11:00', 'ABC News Live First'], ['11:00', '11:30', 'ABC News Live First'], ['11:30', '12:00', 'ABC News Live'], ['12:00', '13:30', 'ABC News Live']] },
  { id: 'cnbc', name: 'CNBC', badge: 'CNBC', category: 'news', programmes: [['09:00', '12:00', 'Squawk on the Street', 'Live business news and market analysis as the trading day opens.'], ['12:00', '13:00', 'Halftime Report', 'Investment committee debate on the day’s market moves.'], ['13:00', '14:00', 'The Exchange']] },
  { id: 'cnn', name: 'CNN', badge: 'CNN', category: 'news', programmes: [['10:00', '11:00', 'The Situation Room'], ['11:00', '12:00', 'The Situation Room'], ['12:00', '13:00', 'Inside Politics With Dana Bash'], ['13:00', '14:00', 'CNN News Central']] },
  { id: 'fox-business', name: 'Fox Business', badge: 'FBN', category: 'news', programmes: [['09:00', '12:00', 'Varney & Company'], ['12:00', '14:00', 'The Big Money Show']] },
  { id: 'fox-news', name: 'Fox News', badge: 'FNC', category: 'news', programmes: [['09:00', '11:00', 'America’s Newsroom'], ['11:00', '12:00', 'The Faulkner Focus'], ['12:00', '13:00', 'Outnumbered'], ['13:00', '15:00', 'America Reports']] },
  { id: 'msnbc', name: 'MSNBC', badge: 'MS', category: 'news', programmes: [['10:00', '11:00', 'Money, Power, Politics With Stephanie Ruhle'], ['11:00', '12:00', 'State of Play with Peter Alexander'], ['12:00', '14:00', 'On the Line With Alicia Menendez']] },
  { id: 'nbc-news-now', name: 'NBC News Now', badge: 'NBC', category: 'news', programmes: [['10:00', '12:00', 'Current With Christine Romans'], ['12:00', '13:00', 'NBC News Daily With Morgan Radford'], ['13:00', '14:00', 'NBC News Daily']] },
  { id: 'newsmax', name: 'Newsmax', badge: 'NMX', category: 'news', programmes: [['10:00', '12:00', 'National Report'], ['12:00', '14:00', 'Bianca Across The Nation']] },
  { id: 'newsnation', name: 'NewsNation', badge: 'NN', category: 'news', programmes: [['10:00', '11:00', 'NewsNation Live'], ['11:00', '12:00', 'NewsNation Live With Marni Hughes'], ['12:00', '13:00', 'NewsNation Live With Nichole Berlie']] },
  { id: 'weather-channel', name: 'The Weather Channel', badge: 'TWC', category: 'news', programmes: [['10:00', '11:00', 'America’s Morning Headquarters'], ['11:00', '12:00', 'America’s Morning Headquarters'], ['12:00', '13:00', 'America’s Morning Headquarters']] },
  { id: 'acc-network', name: 'ACC Network', badge: 'ACC', category: 'sports', programmes: [['10:00', '11:00', 'ACC Network'], ['11:00', '14:00', 'College Football']] },
  { id: 'espn', name: 'ESPN', badge: 'ESPN', category: 'sports', programmes: [] },
  { id: 'cartoon-network-west', name: 'Cartoon Network', region: 'West', badge: 'CN', category: 'kids', programmes: [['10:00', '11:00', 'Teen Titans Go!']] },
  { id: 'cartoon-network-east', name: 'Cartoon Network', region: 'East', badge: 'CN', category: 'kids', programmes: [] },
  { id: 'cartoon-network-us', name: 'Cartoon Network', region: 'US', badge: 'CN', category: 'kids', programmes: [] },
  { id: 'comedy-central', name: 'Comedy Central', badge: 'CC', category: 'entertainment', programmes: [['10:00', '11:00', 'The Office']] },
  { id: 'syfy', name: 'SYFY', badge: 'SYFY', category: 'entertainment', programmes: [['10:00', '12:00', 'Futurama']] },
  { id: 'anime-central', name: 'Anime Central', badge: 'AC', category: 'entertainment', programmes: [['10:00', '11:00', 'Naruto Shippuden']] },
];
const liveCategories = [
  { id: 'news', name: 'News', count: 10 }, { id: 'sports', name: 'Sports', count: 16 }, { id: 'entertainment', name: 'Entertainment', count: 13 },
  { id: 'movies', name: 'Movies', count: 1 }, { id: 'premium', name: 'Premium', count: 20 }, { id: 'kids', name: 'Kids', count: 16 },
  { id: 'documentaries', name: 'Documentaries', count: 4 }, { id: 'home-food', name: 'Home & Food', count: 6 },
];
const recentLive = ['cartoon-network-west', 'cartoon-network-east', 'cartoon-network-us', 'comedy-central', 'syfy', 'abc-news-live'];
const liveItem = (channel: typeof channels[number]) => ({
  id: channel.id, type: 'live', name: channel.name, section: channel.category,
  // No logo art in the reference: the app draws its text badge.
  ...(channel.region ? { description: channel.region, genres: [channel.region] } : {}),
});
function live(url: URL) {
  const search = url.searchParams.get('search')?.trim().toLowerCase();
  const collection = url.searchParams.get('collection');
  const category = url.searchParams.get('category');
  let list = channels.filter(channel => !['anime-central', 'cartoon-network-us', 'comedy-central', 'syfy'].includes(channel.id) || collection === 'recent' || !!search);
  if (collection === 'recent') list = recentLive.map(id => channels.find(channel => channel.id === id)!);
  else if (collection === 'favorites') list = [];
  if (category) list = list.filter(channel => channel.category === category);
  if (search) list = channels.filter(channel => channel.name.toLowerCase().includes(search) || channel.programmes.some(([, , title]) => title.toLowerCase().includes(search)));
  const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 40);
  const total = collection || category || search ? list.length : 86;
  return { channels: list.slice(offset, offset + limit).map(liveItem), total };
}
function guide(id: string) {
  const channel = channels.find(candidate => candidate.id === id);
  return {
    timezone: 'America/New_York',
    programs: (channel?.programmes ?? []).map(([start, end, title, description]) => ({ title, start: et(start), end: et(end), ...(description ? { description } : {}) })),
  };
}

// ---------------------------------------------------------------------------
// Profiles, addons, sources, playback.
const threeProfiles = () => [
  { id: '1', name: 'vynxc', avatar_style: 'lorelei', avatar_choice: 47, setup_complete: true, primary: true },
  { id: '2', name: 'zayne', avatar_style: 'lorelei', avatar_choice: 48, setup_complete: true },
  // No avatar in the reference: the initial shows (this catalog entry does not exist).
  { id: '3', name: 'cedes', avatar_style: 'preview-none', avatar_choice: 1, setup_complete: true },
];
const extraProfiles = [['mira', 'clay', 1], ['theo', 'clay', 4], ['ana', 'clay', 11], ['jules', 'clay', 7], ['sam', 'clay', 9], ['noor', 'clay', 14], ['kai', 'clay', 16], ['lena', 'clay', 18], ['omar', 'clay', 2]] as const;
const addons = () => [
  { id: 1, name: 'LordStreams', enabled: true, version: '2.4.0', description: 'Movies and series streams.' },
  { id: 2, name: 'ThisIPTV', enabled: true, version: '1.8.2', description: 'Live channels and on-demand streams.' },
  { id: 3, name: 'LucidHosting', enabled: false, version: '0.9.1', description: 'Hosted streams.' },
  { id: 4, name: 'ProxPanel Fans', enabled: true, version: '1.2.0', description: 'Community streams.' },
];
function sources(label: string, file: string) {
  const rows: [string, string, string, string?][] = [
    ['LordStreams', '1080p', `${label} - 2026`], ['ThisIPTV', '1080p', `${label} (2026)`], ['LucidHosting', '720p', `${label} (2026)`],
    ['ProxPanel Fans', '720p', `${label} - 2026`], ['ThisIPTV', 'SD', `${label} (2026) · Backup`],
    ['LordStreams', '1080p', `${label} - 2026 · Remux`], ['ThisIPTV', '1080p', `${label} (2026) · HEVC`], ['LordStreams', '1080p', `${label} (2026) · x264`],
    ['LucidHosting', '720p', `${label} (2026) · WEB`], ['ProxPanel Fans', '720p', `${label} (2026) · WEB-DL`], ['ProxPanel Fans', 'SD', `${label} (2026) · 480p`], ['LucidHosting', 'SD', `${label} (2026) · Mobile`],
  ];
  return rows.map(([provider, quality, title], index) => ({
    id: `source-${index + 1}`, name: provider, title, source_name: provider, source_quality: quality,
    source_addon_id: `addon:${addons().find(addon => addon.name === provider)!.id}`,
    filename: file.replace('1080p', quality === 'SD' ? '480p' : quality), description: `${provider}\n${title}\n${file}`,
  }));
}
const track = (inputIndex: number, language: string, title: string, codec: string, selected = false, supported = true) =>
  ({ input_index: inputIndex, language, language_status: 'known', title, codec, selected, supported, selectable: supported });

// ---------------------------------------------------------------------------

export interface BackendHandle {
  requests: { method: string; path: string; body: unknown }[];
  errors: string[];
}

export async function installBackend(page: Page, options: BackendOptions): Promise<BackendHandle> {
  const family = options.family;
  const requests: BackendHandle['requests'] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const session = options.session ?? 'ready';
  let profiles: Record<string, unknown>[] = threeProfiles();
  if (options.manyProfiles) profiles.push(...extraProfiles.map(([name, style, choice], index) => ({ id: String(index + 4), name, avatar_style: style, avatar_choice: choice, setup_complete: true })));
  let selectedProfile: string | null = session === 'ready' ? '1' : null;
  let unlocked = false;
  let favorites = options.favorites ? favoritesFor(family) : [];
  const queue = options.queue === false ? [] : queueFor(family);
  let addonList = addons();
  let playbackCount = 0;

  await page.addInitScript(({ key, token, recent }) => {
    // Idempotent across reloads: the harness seeds only the first document.
    if (sessionStorage.getItem('preview:seeded')) return;
    sessionStorage.setItem('preview:seeded', '1');
    localStorage.clear();
    if (token) localStorage.setItem(key, JSON.stringify(token));
    if (recent) localStorage.setItem('viptv:search:history:1', JSON.stringify(recent));
  }, {
    key: sessionKey,
    token: session === 'none' ? null : { sessionId: 'preview-session', accountId: '7', profileId: session === 'ready' ? '1' : null, accessToken: 'preview-access', refreshToken: 'preview-refresh', expiresIn: 900 },
    recent: options.recentSearches ?? null,
  });

  const serveFile = (route: Route, path: string, contentType?: string) => {
    try { return route.fulfill({ status: 200, body: readFileSync(path), ...(contentType ? { contentType } : {}) }); }
    catch { return route.fulfill({ status: 404, body: '' }); }
  };
  const art = (route: Route, url: string) => {
    const file = url.startsWith(ART) ? decodeURIComponent(url.slice(ART.length)).split(/[?#]/)[0] : '';
    if (!file || !/^[0-9a-f]{32}\.(jpg|png|webp)$/.test(file)) return route.fulfill({ status: 404, body: '' });
    return serveFile(route, `${referenceDir}assets/${file}`, file.endsWith('png') ? 'image/png' : 'image/jpeg');
  };
  // Nothing may reach the network: unknown external hosts fail fast.
  await page.route(url => !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url.href), route => route.abort('blockedbyclient'));
  // A dev server must never proxy API or media calls to a real backend.
  await page.route(/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/(api|media)\//, route => route.abort('blockedbyclient'));
  await page.route('https://art.example/**', route => art(route, route.request().url()));
  await page.route('https://wsrv.nl/**', route => {
    const inner = new URL(route.request().url()).searchParams.get('url') ?? '';
    return art(route, /^https?:/.test(inner) ? inner : `https://${inner}`);
  });
  // Reference profile photos served as the catalog avatars the fixtures pick.
  await page.route('**/assets/avatar-catalog/lorelei-47.png', route => serveFile(route, `${referenceDir}assets/${assetFiles.get('5112cc')}`, 'image/png'));
  await page.route('**/assets/avatar-catalog/lorelei-48.png', route => serveFile(route, `${referenceDir}assets/${assetFiles.get('e12f8d')}`, 'image/png'));
  if (options.localAddons) await installLocalAddons(page, family, options.localAddons === 'hang');
  await page.route(`${apiOrigin}/media/**`, route => {
    const name = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    if (name.endsWith('.m3u8')) return serveFile(route, `${hlsDir}index.m3u8`, 'application/vnd.apple.mpegurl');
    return serveFile(route, `${hlsDir}${name.replace(/\.ts$/, '.bin')}`, 'video/mp2t');
  });

  await page.route(`${apiOrigin}/api/**`, async route => {
    const request = route.request();
    const headers = {
      'access-control-allow-origin': route.request().headers().origin ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type, x-csrf-token, accept',
    };
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const url = new URL(request.url());
    const path = url.pathname, method = request.method();
    let body: Record<string, unknown> = {};
    try { body = JSON.parse(request.postData() || '{}'); } catch { /* not JSON */ }
    requests.push({ method, path, body });
    const hang = () => new Promise<void>(() => undefined);
    if (options.backendDown) return route.abort('connectionrefused');
    const pinGate = () => (options.wrongPin || !unlocked) ? json({ error: 'parent PIN required' }, 403) : undefined;

    // Session and pairing.
    if (path === '/api/health') return json({ ok: true });
    if (path === '/api/auth/me') return json({
      account: { id: '7', username: 'vynxc', name: 'vynxc', role: 'admin' }, profiles,
      profile_id: selectedProfile, restricted: false, profile_setup_required: false,
    });
    if (path === '/api/auth/profile') {
      if (options.profilePin && body.profile_id === '3') { const gate = pinGate(); if (gate) return gate; }
      selectedProfile = String(body.profile_id);
      return json({ profile_id: selectedProfile });
    }
    if (path === '/api/auth/device/code') {
      if (options.pairing === 'loading') return hang();
      const expired = options.pairing === 'expired';
      return json({ device_code: 'preview-device-code', user_code: 'AB12CD34EF', verification_uri: 'https://viptv.syek.tech/device', verification_uri_complete: 'https://viptv.syek.tech/device?code=AB12CD34EF', qr_uri: 'https://viptv.syek.tech/api/auth/device/qr?code=AB12CD34EF', expires_in: expired ? 1 : 600, interval: expired ? 1 : 60 });
    }
    if (path === '/api/auth/device/token') return json({ error: 'authorization_pending' }, 400);
    if (path === '/api/auth/device/refresh') return json({ session_id: 'preview-session', account_id: '7', profile_id: selectedProfile, access_token: 'preview-access-2', refresh_token: 'preview-refresh-2', expires_in: 900 });
    if (path === '/api/auth/login') return options.loginError ? json({ error: 'invalid credentials' }, 401) : json({ csrf_token: 'preview-csrf' });
    if (path === '/api/auth/device/approve') return json({ ok: true });
    if (path === '/api/auth/logout') {
      if (options.signOutPin) { const gate = pinGate(); if (gate) return gate; }
      return json({ ok: true });
    }
    if (path === '/api/parent/status') return json({ pin_configured: true, unlocked, restricted: false });
    if (path === '/api/parent/unlock') {
      if (options.wrongPin) return json({ error: 'incorrect PIN' }, 403);
      unlocked = true;
      return json({ unlocked: true });
    }
    if (path === '/api/parent/pin') return json({ ok: true });

    // Profiles.
    if (path === '/api/profiles' && method === 'GET') return json(profiles);
    if (path === '/api/profiles' && method === 'POST') {
      if (options.profileSaveHang) return hang();
      if (options.profilePin) { const gate = pinGate(); if (gate) return gate; }
      const created = { id: String(profiles.length + 1), setup_complete: true, ...body };
      profiles = [...profiles, created];
      return json(created);
    }
    const profileMatch = /^\/api\/profiles\/([^/]+)$/.exec(path);
    if (profileMatch && (method === 'PATCH' || method === 'DELETE')) {
      if (options.profileSaveHang && method === 'PATCH') return hang();
      if (options.profilePin) { const gate = pinGate(); if (gate) return gate; }
      const target = profiles.find(profile => profile.id === profileMatch[1]);
      if (!target) return json({ error: 'not found' }, 404);
      if (method === 'DELETE') { profiles = profiles.filter(profile => profile !== target); return json({ ok: true }); }
      Object.assign(target, body);
      return json(target);
    }

    // Profile-scoped library.
    const scoped = /^\/api\/profiles\/([^/]+)\/(.+)$/.exec(path);
    if (scoped) {
      const [, , rest] = scoped;
      if (rest === 'continue/page') return json({ items: queue, offset: 0, total: queue.length, next_offset: null });
      if (rest === 'continue/settings') return json({ autoplay: true });
      if (rest === 'continue/visibility') return json({ ok: true });
      if (rest === 'continue/next') return json({ status: 'next', item: { id: 'tt-monster:1:2', type: 'episode', series_id: 'tt-monster', name: 'Monster: The Jeffrey Dahmer Story', episode_title: 'Please Don’t Go', season: 1, episode: 2 } });
      if (rest === 'progress' && method === 'GET') return json([]);
      if (rest === 'progress/series') return json(url.searchParams.get('series_id') === 'tt-monster' ? [{ id: 'tt-monster:1:1', type: 'episode', series_id: 'tt-monster', name: 'Monster: The Jeffrey Dahmer Story', season: 1, episode: 1, position: 4, duration: 3130 }] : []);
      if (rest.startsWith('progress')) return json({ ok: true });
      if (rest === 'favorites' && method === 'GET') return json(favorites);
      if (rest === 'favorites/toggle') {
        const id = String(body.id ?? '');
        const saved = !favorites.some(entry => entry.id === id);
        const spec = byId.get(id);
        favorites = saved && spec ? [...favorites, item(spec, family)] : favorites.filter(entry => entry.id !== id);
        return json({ saved });
      }
      if (rest === 'favorites') return json({ ok: true });
      if (rest === 'preferences') {
        const preferences = { audio_language: '', subtitle_language: '', subtitles_enabled: false, subtitle_size: 'normal', subtitle_style: 'system', quality: 'auto', autoplay: true };
        return json(method === 'PUT' ? { ...preferences, ...body } : preferences);
      }
    }

    // Addons.
    if (path === '/api/addons' && method === 'GET') return json(addonList);
    if (path === '/api/addons' && method === 'POST') {
      if (options.addonInstallHang) return hang();
      if (options.addonInstallError) return json({ error: 'Enter an HTTPS manifest URL.' }, 400);
      return json({ id: 9, name: 'New addon', enabled: true });
    }
    const addonMatch = /^\/api\/addons\/([^/]+)$/.exec(path);
    if (addonMatch) {
      if (method === 'DELETE') { addonList = addonList.filter(addon => String(addon.id) !== addonMatch[1]); return json({ ok: true }); }
      const addon = addonList.find(entry => String(entry.id) === addonMatch[1]);
      if (addon) Object.assign(addon, body);
      return json(addon ?? {});
    }

    // Catalog, detail, sources.
    if (path === '/api/catalogs') return json(options.noCatalogs ? [] : catalogs);
    if (path === '/api/discover') {
      if (options.catalogHang) return hang();
      if (options.searchFail && url.searchParams.get('search')) return json({ error: 'upstream failed' }, 502);
      return json(discover(url, family));
    }
    const metaMatch = /^\/api\/meta\/([^/]+)\/([^/]+)$/.exec(path);
    if (metaMatch) {
      const spec = byId.get(decodeURIComponent(metaMatch[2]));
      return spec ? json({ meta: meta(spec, family) }) : json({ error: 'not found' }, 404);
    }
    if (path === '/api/streams' && method === 'POST') {
      const id = String(body.series_id ?? body.id ?? '');
      return json({ id: id.startsWith('tt-monster') ? 'streams-monster' : `streams-${id || 'title'}` });
    }
    const streamMatch = /^\/api\/streams\/([^/]+)$/.exec(path);
    if (streamMatch) {
      const monster = streamMatch[1] === 'streams-monster';
      const after = Number(url.searchParams.get('after') ?? 0);
      const list = monster ? sources('Monster S1 E1', 'Monster.S01E01.1080p.WEB.mkv') : sources('The End of Oak Street', 'The.End.of.Oak.Street.2026.1080p.WEB.mkv');
      return json({ events: after > 0 ? [] : [{ seq: 1, source: 'addon:1', streams: list }], done: options.sourcesDone ?? false });
    }

    // Live.
    if (path === '/api/live/categories') return json({ categories: liveCategories, total: liveCategories.length });
    if (path === '/api/live') return json(live(url));
    const guideMatch = /^\/api\/guide\/([^/]+)$/.exec(path);
    if (guideMatch) return json(guide(decodeURIComponent(guideMatch[1])));

    // Playback.
    if (path === '/api/playback' && method === 'POST') {
      playbackCount++;
      if (options.playbackHang || (options.playbackHangAfter !== undefined && playbackCount > options.playbackHangAfter)) return hang();
      if (options.playbackFailAfter !== undefined && playbackCount > options.playbackFailAfter) return json({ error: 'upstream unavailable', error_code: 'SOURCE_TIMEOUT' }, 504);
      const liveSession = String(body.type ?? '') === 'live' || /cartoon|news|cnbc|cnn|espn/.test(String(body.id ?? ''));
      return json({
        id: 'preview-playback', url: '/media/preview-playback/index.m3u8', format: 'hls', mode: 'remux', video_mode: 'copy', audio_mode: 'transcode',
        position: liveSession ? 0 : options.media?.position ?? 768, live: liveSession, duration: liveSession ? 0 : options.media?.duration ?? 3130,
        audio_tracks: [track(0, 'en', 'English · 5.1', 'eac3', true), track(1, 'en', 'English · Stereo', 'aac'), track(2, 'es', 'Spanish · Stereo', 'aac'), track(3, 'ja', 'Japanese · TrueHD', 'truehd', false, false)],
        subtitle_tracks: [track(0, 'en', 'English', 'subrip', true), track(1, 'en', 'English (SDH)', 'subrip'), track(2, 'es', 'Spanish', 'subrip'), track(3, 'fr', 'French', 'subrip'), track(4, 'pt', 'Portuguese (PGS)', 'hdmv_pgs_subtitle', false, false), track(5, 'de', 'German', 'subrip')],
        subtitles_supported: true,
      });
    }
    if (path.startsWith('/api/playback')) return json({ ok: true });
    return json({ error: `Unhandled preview route ${method} ${path}` }, 404);
  });
  return { requests, errors };
}

/** Local addon mode: the Stremio hosts the seeded local registry points at. */
const localCatalogs: Record<string, string[]> = {
  popular: ['tt-oak-street', 'tt-mayday', 'tt-whisper-man', 'tt-obsession', 'tt-practical-magic', 'tt-in-the-grey', 'tt-ministry'],
  new: ['tt-hail-mary', 'tt-pressure', 'tt-mandalorian', 'tt-one-night-only', 'tt-weapons', 'tt-wish-me-dead', 'tt-the-invite'],
};
export const localManifest = (id: string, name: string, catalogs: boolean) => ({
  id, name, version: '1.0.0', resources: ['catalog', 'meta', 'stream'], types: ['movie', 'series'], idPrefixes: ['tt'],
  catalogs: catalogs ? [{ type: 'movie', id: 'popular', name: 'Popular movies' }, { type: 'movie', id: 'new', name: 'New releases' }] : [],
});
async function installLocalAddons(page: Page, family: Family, hang: boolean) {
  const hosts: Record<string, [string, string, boolean]> = {
    'lordstreams.example': ['com.lordstreams.addon', 'LordStreams', true],
    'thisiptv.example': ['org.thisiptv.addon', 'ThisIPTV', false],
    'lucidhosting.example': ['io.lucidhosting.addon', 'LucidHosting', false],
  };
  await page.route(/^https:\/\/(lordstreams|thisiptv|lucidhosting)\.example\//, async route => {
    const url = new URL(route.request().url());
    const [id, name, catalogs] = hosts[url.hostname];
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (url.pathname.endsWith('/manifest.json')) return json(localManifest(id, name, catalogs));
    const catalog = /\/catalog\/([^/]+)\/([^/.]+)/.exec(url.pathname);
    if (catalog) {
      if (hang) return new Promise<void>(() => undefined);
      return json({ metas: (localCatalogs[catalog[2]] ?? []).map(entry => item(byId.get(entry)!, family)) });
    }
    return json({ streams: [] });
  });
}

/**
 * Platform edges only: a fake AVPlay for Tizen and a media element that
 * "plays" without decoding (Playwright Chromium has no H.264). The player
 * frame shows `frame` (a reference still) so screenshots read like video.
 */
export async function installMediaStubs(page: Page, options: { duration?: number; position?: number; paused?: boolean; error?: boolean; frame?: string; live?: boolean } = {}) {
  const frame = options.frame && assetFiles.get(options.frame) ? `${ART}${assetFiles.get(options.frame)}` : '';
  await page.addInitScript(({ duration, position, paused, error, frame }) => {
    let avplayTime = position * 1000;
    Object.defineProperty(window, 'webapis', { configurable: true, value: { avplay: {
      open() {}, close() {}, prepareAsync(success: () => void) { setTimeout(success, 0); }, play() {}, pause() {}, stop() {}, suspend() {}, restore() {},
      seekTo(milliseconds: number, success?: () => void) { avplayTime = milliseconds; success?.(); },
      jumpForward(milliseconds: number, success?: () => void) { avplayTime += milliseconds; success?.(); },
      jumpBackward(milliseconds: number, success?: () => void) { avplayTime -= milliseconds; success?.(); },
      getCurrentTime() { return avplayTime; }, getDuration() { return duration * 1000; }, getState() { return 'PLAYING'; },
      getTotalTrackInfo() { return []; }, getCurrentStreamInfo() { return []; },
      setListener() {}, setDisplayRect() {}, setDisplayMethod() {}, setSelectTrack() {}, setSilentSubtitle() {}, setStreamingProperty() {},
    } } });
    const media = HTMLMediaElement.prototype;
    const nativeCanPlay = media.canPlayType;
    media.canPlayType = function (type: string) { return /mpegurl|mp4|avc1|mp4a|aac|webm|mp2t/i.test(type) ? 'probably' : nativeCanPlay.call(this, type); };
    const state = new WeakMap<HTMLMediaElement, { time: number; paused: boolean; src: string }>();
    const get = (element: HTMLMediaElement) => { let value = state.get(element); if (!value) { value = { time: position, paused: true, src: '' }; state.set(element, value); } return value; };
    const fire = (element: HTMLMediaElement, ...names: string[]) => names.forEach(name => element.dispatchEvent(new Event(name)));
    Object.defineProperty(media, 'duration', { configurable: true, get() { return get(this).src ? duration : NaN; } });
    Object.defineProperty(media, 'currentTime', { configurable: true, get() { return get(this).time; }, set(value: number) { get(this).time = Number(value) || 0; setTimeout(() => fire(this, 'seeking', 'seeked', 'timeupdate'), 0); } });
    Object.defineProperty(media, 'paused', { configurable: true, get() { return get(this).paused; } });
    Object.defineProperty(media, 'readyState', { configurable: true, get() { return get(this).src ? 4 : 0; } });
    Object.defineProperty(media, 'error', { configurable: true, get() { return error && get(this).src ? { code: 4, message: 'MEDIA_ERR_SRC_NOT_SUPPORTED' } : null; } });
    Object.defineProperty(media, 'buffered', { configurable: true, get() { const time = get(this).time; return { length: 1, start: () => 0, end: () => Math.min(duration || time + 60, time + 90) }; } });
    Object.defineProperty(media, 'src', { configurable: true, get() { return get(this).src; }, set(value: string) { get(this).src = String(value); } });
    media.load = function (this: HTMLMediaElement) {
      const element = this;
      if (!get(element).src) return;
      setTimeout(() => error ? fire(element, 'error') : fire(element, 'loadstart', 'durationchange', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough'), 30);
    };
    media.play = function (this: HTMLMediaElement) { get(this).paused = false; setTimeout(() => fire(this, 'play', 'playing', 'timeupdate'), 0); return Promise.resolve(); };
    media.pause = function (this: HTMLMediaElement) { if (!get(this).paused) { get(this).paused = true; setTimeout(() => fire(this, 'pause'), 0); } };
    const nativeRemove = Element.prototype.removeAttribute;
    media.removeAttribute = function (this: HTMLMediaElement, name: string) { if (name === 'src') get(this).src = ''; return nativeRemove.call(this, name); };
    if (typeof MediaSource !== 'undefined') MediaSource.isTypeSupported = () => true;
    if (navigator.mediaCapabilities) navigator.mediaCapabilities.decodingInfo = async () => ({ supported: true, smooth: true, powerEfficient: true } as MediaCapabilitiesDecodingInfo);
    if (frame) document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.dataset.preview = 'video-frame';
      style.textContent = `video.video{background:#000 url("${frame}") center/cover no-repeat!important;object-position:-99999px -99999px!important}`;
      document.head.append(style);
    });
    void paused;
  }, { duration: options.live ? Infinity : options.duration ?? 3130, position: options.live ? 0 : options.position ?? 768, paused: options.paused ?? false, error: options.error ?? false, frame });
}
