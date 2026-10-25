# Simkl — what powers each screen

Calendar (month + agenda): data.simkl.in/calendar/v2/{tv|anime|movie_release}.json — yesterday + 33 days, monthly files up to +3 months, refreshed every 6 h, cache 3–6 h on device. Each item: date, episode {season, episode, title}, finale_type (1 mid-season, 2 season, 3 series), joined to metadata (poster, network, ratings, status). Converted to the user's time zone; 'My shows' filters to the user's Simkl lists.

Up next / countdowns: /sync/all-items?next_watch_info=yes → next_to_watch_info {season, episode, date}. Simkl has no countdown field; we compute it. Items with next_to_watch = null are 'caught up'. Movies use release dates from movie_release.json.

Discover: trending files (today / week / month) titled 'Simkl Trending …' as Simkl requires; /premieres/{new|soon}; /airing (sort by time or rank); /best; genre paths (genre / type / country / network / year / sort); Surprise me = POST /search/random with filters and 'skip what I've watched'.

Advanced filters: server-side through Simkl's genre paths (genre · type · country · network · year/decade · sort) and /search/random (service, years, rating range, rank limit); client-side on what comes back (Simkl/IMDb rating, rank, status, runtime, language, episode count) plus VIPTV-only filters (hide watched, only what my add-ons can play). Genres include or exclude; filters save as smart lists that can appear as Home rows. Calendar filters: premieres / finales only, anime format, network, minimum rating, watching-only, movie releases. List filters: has a new episode, not started, caught up, still airing, rating, added date, episodes left.

Search: /search/{tv|anime|movie} with extended=full (ratings, status, episode count); IDs and links resolve through /redirect.

Lists: watching · plan to watch · on hold · completed · dropped (movies: plan / completed / dropped); move with /sync/add-to-list; ratings 1–10 via /sync/ratings; progress from watched_episodes_count / total_episodes_count. Custom lists are PRO/VIP and read-only.

Title: ratings (Simkl, IMDb, MAL), rank, drop rate, watching / completed counts, episode watched state, 'Mark season watched' via /sync/history.

Tracking: scrobble start / pause / stop on user actions only; ≥ 80 % marks watched, then a toast. Rating prompt only at the end of a season.

Stats: /users/{id}/stats — expensive, so only on opening the page or pressing Refresh.

Connect: desktop / phone / web use OAuth with PKCE in the browser; TV uses the device flow — simkl.com/pin with an 8-character code (BDWP-HQPK style) and a QR of the complete link, polling every 5 s, 15-minute expiry.

Rules that shape the UI: show Simkl's brand mark (placeholders here — swap in their official mark), link items to simkl.com (TV exempt), sync on launch and at most every 15–30 min, no heartbeat calls. Dates, episode titles and counts on these boards are sample data.

Source: api.simkl.org (API rules, calendar, trending, search, sync, scrobble, users, OAuth device flow).
