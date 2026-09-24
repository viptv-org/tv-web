import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, History, Search, X } from "lucide-react";
import type { Catalog, MediaItem, TvApi } from "../api";
import { artworkUrl, cardPresentation, presentation } from "../core/presentations";
import { formatContentType } from "./catalogFilters";
import { ReadyImage } from "./RokuArtwork";
import "./SearchPopunder.css";

const QUICK_RESULTS = 8;
const HISTORY_LIMIT = 8;
const historyKey = (profile: string) => `viptv:search:history:${profile}`;

function readHistory(profile: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(historyKey(profile)) ?? "[]");
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string").slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function writeHistory(profile: string, entries: readonly string[]) {
  try {
    localStorage.setItem(historyKey(profile), JSON.stringify(entries));
  } catch {
    // Storage can be unavailable (private mode, quota); history is a convenience.
  }
}

/**
 * The few best matches for a quick query: the first searchable catalogs are
 * asked in parallel and their results interleave by rank, so every catalog's
 * top match leads before any catalog's second. Failed catalogs are skipped;
 * the full Search page still reports partial results.
 */
async function quickSearch(api: TvApi, catalogs: readonly Catalog[], query: string, signal: AbortSignal) {
  const searchable = catalogs.filter((catalog) => catalog.supportsSearch && catalog.type !== "live").slice(0, 6);
  const pages = await Promise.all(
    searchable.map((catalog) =>
      api
        .discover({ type: catalog.type, catalog: catalog.id, addonId: catalog.addonId, search: query }, { signal })
        .then((page) => page.items)
        .catch(() => [] as readonly MediaItem[]),
    ),
  );
  const seen = new Set<string>();
  const results: MediaItem[] = [];
  for (let rank = 0; results.length < QUICK_RESULTS && pages.some((page) => rank < page.length); rank += 1) {
    for (const page of pages) {
      const item = page[rank];
      if (!item || seen.has(`${item.type}:${item.id}`)) continue;
      seen.add(`${item.type}:${item.id}`);
      results.push(item);
      if (results.length === QUICK_RESULTS) break;
    }
  }
  return results;
}

type Entry =
  | { kind: "item"; item: MediaItem }
  | { kind: "all"; text: string }
  | { kind: "history"; text: string };

/**
 * Desktop header search, after Stremio's: a real field whose popunder lists
 * recent searches while empty and quick matches while typing. Arrow keys
 * move through the list, Enter opens the highlighted title or the full
 * Search page, Escape closes. The field keeps its own text; submitting hands
 * the query to the Search route.
 */
export function SearchPopunder({
  api,
  catalogs,
  profile,
  onOpen,
  onSubmit,
}: {
  api: TvApi;
  catalogs: readonly Catalog[];
  profile: string;
  onOpen: (item: MediaItem) => void;
  onSubmit: (query: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<readonly MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [history, setHistory] = useState(() => readHistory(profile));
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const text = query.trim();

  useEffect(() => setHistory(readHistory(profile)), [profile]);

  useEffect(() => {
    setActive(-1);
    if (!text) {
      setResults([]);
      setLoading(false);
      return;
    }
    const scope = api.createScope();
    setLoading(true);
    const timer = setTimeout(() => {
      void quickSearch(api, catalogs, text, scope.signal).then((items) => {
        if (scope.signal.aborted) return;
        setResults(items);
        setLoading(false);
      });
    }, 300);
    return () => {
      clearTimeout(timer);
      scope.abort();
    };
  }, [api, catalogs, text]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const remember = (value: string) => {
    const next = [value, ...history.filter((entry) => entry.toLowerCase() !== value.toLowerCase())].slice(0, HISTORY_LIMIT);
    setHistory(next);
    writeHistory(profile, next);
  };
  const dismiss = () => {
    setOpen(false);
    setActive(-1);
    field.current?.blur();
  };
  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    remember(trimmed);
    setQuery(trimmed);
    dismiss();
    onSubmit(trimmed);
  };
  const entries: Entry[] = text
    ? [...results.map((item): Entry => ({ kind: "item", item })), { kind: "all", text }]
    : history.map((entry): Entry => ({ kind: "history", text: entry }));
  const choose = (entry: Entry) => {
    if (entry.kind === "item") {
      remember(text);
      dismiss();
      onOpen(entry.item);
    } else submit(entry.text);
  };
  const key = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) return;
    // The field owns these keys; the app shell would otherwise treat Escape as Back.
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") return dismiss();
    if (event.key === "Enter") {
      const entry = entries[active];
      if (entry) choose(entry);
      else submit(query);
      return;
    }
    setOpen(true);
    // -1 is the field itself; the highlight wraps through it at either end.
    const step = event.key === "ArrowDown" ? 1 : -1;
    setActive((current) => {
      const next = current + step;
      if (next < -1) return entries.length - 1;
      return next >= entries.length ? -1 : next;
    });
  };

  const showPanel = open && (!!text || history.length > 0);
  return (
    <div className="search-popunder" ref={root}>
      {/* The title-bar field (shell family): 460 × 30, "Search movies and
          series", a clear button once there is text, no shortcut hint. */}
      <label className={`search-popunder-field vx-titlebar-search ${showPanel ? "is-open" : ""}`}>
        <Search className="vx-titlebar-search-icon" size={15} strokeWidth={2} aria-hidden="true" />
        <input
          ref={field}
          className="vx-titlebar-search-input"
          type="search"
          role="combobox"
          aria-label="Search"
          aria-expanded={showPanel}
          aria-controls="search-popunder-list"
          aria-activedescendant={active >= 0 ? `search-popunder-${active}` : undefined}
          placeholder="Search movies and series"
          maxLength={256}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={key}
        />
        {query && (
          <button type="button" className="search-popunder-clear vx-titlebar-search-clear" aria-label="Clear search" onClick={() => { setQuery(""); field.current?.focus(); }}>
            <X size={12} strokeWidth={2.4} aria-hidden="true" />
          </button>
        )}
      </label>
      {showPanel && (
        <div className="search-popunder-panel" id="search-popunder-list" role="listbox" aria-label={text ? "Search suggestions" : "Recent searches"}>
          {!text && (
            <div className="search-popunder-heading">
              <span>Recent searches</span>
              <button type="button" onClick={() => { setHistory([]); writeHistory(profile, []); }}>Clear</button>
            </div>
          )}
          {text && loading && !results.length && <p className="search-popunder-status">Searching…</p>}
          {text && !loading && !results.length && <p className="search-popunder-status">No quick matches</p>}
          {entries.map((entry, index) => {
            const common = {
              id: `search-popunder-${index}`,
              role: "option" as const,
              "aria-selected": index === active,
              className: `search-popunder-row ${index === active ? "is-active" : ""} row-${entry.kind}`,
              onPointerEnter: () => setActive(index),
              onClick: () => choose(entry),
            };
            if (entry.kind === "history")
              return (
                <button type="button" key={`history-${entry.text}`} {...common}>
                  <History size={15} aria-hidden="true" />
                  <span className="search-popunder-name">{entry.text}</span>
                </button>
              );
            if (entry.kind === "all")
              return (
                <button type="button" key="all" {...common}>
                  <Search size={15} aria-hidden="true" />
                  <span className="search-popunder-name">See all results for “{entry.text}”</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              );
            const { item } = entry;
            const art = presentation(item).posterImage ?? cardPresentation(item, "catalog").image ?? undefined;
            return (
              <button type="button" key={`${item.type}:${item.id}`} {...common}>
                <span className="search-popunder-art">
                  <ReadyImage src={artworkUrl(art, 80, 120)} alt="" loading="lazy" />
                </span>
                <span className="search-popunder-text">
                  <span className="search-popunder-name">{item.name}</span>
                  <small>{[formatContentType(item.type), item.year].filter(Boolean).join(" · ")}</small>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
