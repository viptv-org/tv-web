import { useEffect, useRef, useState } from "react";
import {
  TvApi,
  type Guide as GuideData,
  type MediaItem,
  type GuideProgram,
} from "../api";
import { TvButton, focusElement } from "./remote";
const halfHour = () => Math.floor(Date.now() / 1800000) * 1800;
export function Guide({
  api,
  onPlay,
  onError,
  onDetails,
}: {
  api: TvApi;
  onPlay: (item: MediaItem) => void;
  onError: (error: unknown) => void;
  onDetails: (item: MediaItem, program?: GuideProgram) => void;
}) {
  const [channels, setChannels] = useState<readonly MediaItem[]>([]),
    [total, setTotal] = useState(0),
    [offset, setOffset] = useState(0),
    [collection, setCollection] = useState(""),
    [query, setQuery] = useState(""),
    [loading, setLoading] = useState(false),
    [selected, setSelected] = useState(0),
    [windowStart, setWindowStart] = useState(halfHour),
    [now, setNow] = useState(Date.now() / 1000),
    [following, setFollowing] = useState(true),
    [guides, setGuides] = useState<Record<string, GuideData>>({});
  const cache = useRef(
    new Map<string, { expires: number; guide: GuideData }>(),
  );
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now() / 1000);
      if (following) setWindowStart(halfHour());
    }, 30000);
    return () => clearInterval(t);
  }, [following]);
  useEffect(() => {
    const scope = api.createScope();
    const t = setTimeout(
      () => {
        setLoading(true);
        void api
          .live(
            {
              view: "us",
              collection: collection || undefined,
              search: query.trim() || undefined,
              offset,
              limit: 40,
            },
            { signal: scope.signal },
          )
          .then((page) => {
            if (scope.signal.aborted) return;
            setChannels(page.channels);
            setTotal(page.total);
            setSelected(0);
          })
          .catch((e) => {
            if (!scope.signal.aborted) onError(e);
          })
          .finally(() => {
            if (!scope.signal.aborted) setLoading(false);
          });
      },
      query ? 650 : 0,
    );
    return () => {
      clearTimeout(t);
      scope.abort();
    };
  }, [api, offset, collection, query]);
  useEffect(() => {
    const scope = api.createScope();
    const slice = channels.slice(Math.max(0, selected - 1), selected + 6);
    const pending = slice.filter(
      (c) =>
        !cache.current.has(c.id) ||
        (cache.current.get(c.id)?.expires ?? 0) < Date.now(),
    );
    let cursor = 0;
    const worker = async () => {
      while (cursor < pending.length && !scope.signal.aborted) {
        const c = pending[cursor++];
        let guide: GuideData,
          ttl = 300000;
        try {
          guide = await api.guide(c.id, { signal: scope.signal });
        } catch {
          guide = { programs: [], timezone: "" };
          ttl = 60000;
        }
        if (scope.signal.aborted) return;
        cache.current.delete(c.id);
        cache.current.set(c.id, { guide, expires: Date.now() + ttl });
        while (cache.current.size > 40)
          cache.current.delete(cache.current.keys().next().value!);
        setGuides((g) => ({ ...g, [c.id]: guide }));
      }
    };
    for (let i = 0; i < Math.min(3, pending.length); i++) void worker();
    return () => scope.abort();
  }, [api, channels, selected]);
  const shift = (direction: number) => {
    setFollowing(false);
    setWindowStart((t) =>
      Math.max(halfHour(), Math.min(halfHour() + 86400, t + direction * 3600)),
    );
  };
  const key = (event: React.KeyboardEvent) => {
    const id = (event.target as HTMLElement).dataset.focusId ?? "";
    if (!id.startsWith("guide-")) return;
    if (event.key === "MediaTrackPrevious") {
      event.preventDefault();
      event.stopPropagation();
      setFollowing(true);
      setWindowStart(halfHour());
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      if (id.includes("program")) {
        event.preventDefault();
        event.stopPropagation();
        shift(event.key === "ArrowLeft" ? -1 : 1);
      }
    } else if (
      event.key === "ArrowDown" &&
      selected === channels.length - 1 &&
      offset + 40 < total
    ) {
      event.preventDefault();
      event.stopPropagation();
      setOffset((o) => o + 40);
      setTimeout(() => focusElement("guide-channel-0"), 100);
    } else if (event.key === "ArrowUp" && selected === 0 && offset > 0) {
      event.preventDefault();
      event.stopPropagation();
      setOffset((o) => Math.max(0, o - 40));
    }
  };
  return (
    <main className="guide" onKeyDown={key}>
      <h1>Live TV</h1>
      <div className="guide-filters">
        <input
          aria-label="Search live channels"
          value={query}
          onChange={(e) => {
            setOffset(0);
            setQuery(e.target.value);
          }}
        />
        {[
          ["", "All US"],
          ["favorites", "My channels"],
          ["recent", "Recent"],
        ].map(([value, label], i) => (
          <TvButton
            id={`live-filter-${i}`}
            key={value}
            onActivate={() => {
              setCollection(value);
              setOffset(0);
            }}
          >
            {label}
          </TvButton>
        ))}
      </div>
      <div className="guide-header">
        {[0, 1, 2, 3].map((i) => (
          <span key={i}>
            {new Date((windowStart + i * 1800) * 1000).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ))}
      </div>
      <div className="guide-rows">
        {channels.map((channel, i) => {
          const programs = (guides[channel.id]?.programs ?? []).filter(
            (p) => p.end > windowStart && p.start < windowStart + 7200,
          );
          return (
            <div className="guide-row" key={channel.id}>
              <TvButton
                id={`guide-channel-${i}`}
                onFocus={() => setSelected(i)}
                onActivate={() => onPlay(channel)}
                onHold={() => onDetails(channel)}
              >
                <img src={channel.poster} alt="" />
                {channel.name}
              </TvButton>
              <div className="programs">
                {programs.map((p, j) => {
                  const left =
                    (Math.max(0, p.start - windowStart) / 7200) * 804;
                  const width =
                    ((Math.min(windowStart + 7200, p.end) -
                      Math.max(windowStart, p.start)) /
                      7200) *
                    804;
                  return (
                    <TvButton
                      style={{
                        position: "absolute",
                        left,
                        width: Math.max(1, width - 3),
                        height: 87,
                      }}
                      id={`guide-program-${i}-${j}`}
                      key={`${p.start}-${j}`}
                      onFocus={() => setSelected(i)}
                      onActivate={() =>
                        p.start <= now && p.end > now
                          ? onPlay(channel)
                          : onDetails(channel, p)
                      }
                      onHold={() => onDetails(channel, p)}
                    >
                      {p.title}
                    </TvButton>
                  );
                })}
                {programs.length === 0 && (
                  <TvButton
                    id={`guide-program-${i}-empty`}
                    onFocus={() => setSelected(i)}
                    onActivate={() => onPlay(channel)}
                    onHold={() => onDetails(channel)}
                  >
                    No guide information
                  </TvButton>
                )}
                {now >= windowStart && now < windowStart + 7200 && (
                  <div
                    className="guide-now"
                    style={{ left: ((now - windowStart) / 7200) * 804 }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="guide-pager">
        <TvButton
          id="guide-page-previous"
          disabled={offset === 0}
          onActivate={() => setOffset((o) => Math.max(0, o - 40))}
        >
          Previous channels
        </TvButton>
        <span>
          {offset + 1}–{offset + channels.length} of {total}
        </span>
        <TvButton
          id="guide-page-next"
          disabled={offset + 40 >= total}
          onActivate={() => setOffset((o) => o + 40)}
        >
          Next channels
        </TvButton>
        <TvButton
          id="guide-follow"
          onActivate={() => {
            setFollowing(true);
            setWindowStart(halfHour());
          }}
        >
          Now
        </TvButton>
      </div>
      {loading && <p role="status">Loading channels…</p>}
    </main>
  );
}
