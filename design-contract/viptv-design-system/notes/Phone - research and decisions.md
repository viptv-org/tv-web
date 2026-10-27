# Phone — research and decisions

Built from the TV study's look (Onest UI type, title logos, white primary button, glass secondary, accent only for progress). Research and why:

1. Tabs: Home · Live · My List, with Search as its own button at the trailing end (Apple HIG tab bars; Netflix's 2026 iPhone app: Home, Clips, Search, My Netflix). Profile, settings, add-ons and History sit behind the avatar or inside My List — fewer, single-word tabs.
2. Cast button top-right on every screen that can play; a mini controller on every screen while casting; volume inside the Watch on sheet; casting never stops when you navigate (Google Cast design checklist).
3. Home: one big card hero (~55–60% of the first screen), 16:9 Continue Watching with progress + "…" menu, 2:3 posters, live channels.
4. Sheets with a grabber for seasons, sources, sort/filter, add-ons and Continue Watching options (HIG sheets: medium/large detents; Material bottom sheets).
5. Player is landscape for full titles (Netflix): double-tap ±10 s with a ripple, Episodes · Audio & subtitles · Speed · Lock along the bottom, screen lock against pocket touches, scrub thumbnails, Skip intro / Next episode, live with a channel list.
6. Link a TV from the phone: scan the TV's QR, or type its code (letters only, no look-alikes), check the TV name, pick the profile, done — then offer the remote (Netflix/YouTube TV sign-in; RFC 8628).
7. Every sign-in method: browser, email code, password, approve from another device (QR + code), IPTV provider (Xtream / M3U), or no account.
9. Nothing autoplays: no trailers, no next-episode countdown — Next episode is a button.
8. Targets 44 pt+, 16 pt gutters, text 13–17 pt so Dynamic Type has room; skeletons not spinners; offline banner keeps saved content usable.

Sources: Apple HIG (tab bars, sheets, loading, playing video), Google Cast design checklist, Netflix help + 2026 iPhone redesign coverage, Material bottom sheet + motion, RFC 8628.
