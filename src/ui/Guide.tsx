/*
 * Live TV (screen family "live"). References: Live, DeskLive (+ ultra-wide), TvLive,
 * Ph/Desk/TvLiveDetails, PhLiveDetailsNone, TvLiveSearch, PhItemMenuLive.
 * Phone: a channel list (tap plays, long-press opens the channel menu).
 * Desktop / web: an EPG in px per minute (wider windows show more hours) with a
 * category sidebar (chips below 900 px). TV: hero for the focused programme, a chip
 * row and a five-row grid on the 1920 × 1080 canvas. Styles: src/styles/screens/live.css.
 * Presentation only; state, loading, keys and details live in useGuideController.
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Search, Tv, X } from "lucide-react";
import { type Guide as GuideData, type MediaItem } from "../api";
import { TvButton, focusElement } from "./remote";
import { TextEntry } from "./TextEntry";
import { AutoLoad } from "./AutoLoad";
import { buttonClass, ButtonContent } from "./primitives/Button";
import { chipClass } from "./primitives/Chips";
import { EmptyState, LoadingMore, SkeletonRow, StatusLine } from "./primitives/Feedback";
import { KeyLegend } from "./primitives/Keys";
import { PlayIcon } from "./primitives/icons";
import { ProgressBar } from "./primitives/Progress";
import {
  DAY_SECONDS, RESPONSIVE_TIMELINE_WIDTH, RESPONSIVE_WINDOW_SECONDS, WINDOW_SECONDS, type GuideCell, type GuideFilter,
  channelMonogram, deskSpan, elapsed, halfHour, nowNext, programAfter, tvSpan, zoneLabel,
} from "./guide-core";
import { useGuideController, type GuideDetails, type GuideProps } from "./useGuideController";
export { guideCells } from "./guide-core";

type Controller = ReturnType<typeof useGuideController>;

const COMPACT_QUERY = "(max-width: 899px)";
/** Desktop guide below 900 px: category chips replace the sidebar (one tree, not two). */
function useCompact(enabled: boolean) {
  const query = () => enabled && typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(COMPACT_QUERY).matches;
  const [compact, setCompact] = useState(query);
  useEffect(() => {
    if (!enabled || typeof window.matchMedia !== "function") return setCompact(false);
    const list = window.matchMedia(COMPACT_QUERY);
    const update = () => setCompact(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [enabled]);
  return compact;
}

/** Blocks sit inside their time slot: 2 px (DeskLive.html) / 4 px (TvLive.html) each side. */
const DESK_BLOCK_INSET = 2;
const TV_BLOCK_INSET = 4;

const halfHours = (from: number, seconds: number) =>
  Array.from({ length: Math.ceil(seconds / 1_800) }, (_, index) => from + index * 1_800);

function timelineLabel(guide: Controller, time: number) {
  return guide.selectedGuide?.timeline?.find((point) => point.time === time)?.displayTime ?? guide.formatTime(time);
}

/** Start shown on a block: the visible start (cut at the window), the programme's real end. */
function blockRange(guide: Controller, cell: GuideCell, period = false) {
  return guide.formatRange(cell.start, cell.program?.end ?? cell.end, period);
}

/* ------------------------------------------------------------------------ */
/* Programme details: phone sheet · desktop dialog (body row) · TV panel      */
/* ------------------------------------------------------------------------ */
function LiveDetails({ guide, details, tv }: { guide: Controller; details: GuideDetails; tv: boolean }) {
  const { channel, program } = details;
  const { closeDetails, watchDetails, formatRange } = guide;
  useEffect(() => {
    // After the modal / menu that may have opened it has restored its own focus.
    const timer = setTimeout(() => focusElement("live-details-watch"), 0);
    return () => clearTimeout(timer);
  }, []);
  const trapTab = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const focusables = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled])"))
      .filter((element) => element.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const close = (
    <button type="button" className="vx-close" aria-label="Close" onClick={closeDetails}>
      <X aria-hidden="true" strokeWidth={2.2} />
    </button>
  );
  const layer = (
    <div className="vx-overlay vx-live-details-layer">
      <div className="vx-scrim" aria-hidden="true" onClick={closeDetails} />
      <section
        className="vx-dialog vx-live-details"
        role="dialog"
        aria-modal="true"
        aria-labelledby={program ? "live-details-title" : undefined}
        aria-label={program ? undefined : "Programme details"}
        data-focus-scope="modal"
        tabIndex={-1}
        onKeyDown={trapTab}
      >
        <button type="button" className="vx-dialog__grabber" aria-label="Close" onClick={closeDetails}><span /></button>
        {program ? (
          <>
            <div className="vx-dialog__header">
              <h2 className="vx-dialog__title" id="live-details-title">{program.title || "Untitled programme"}</h2>
              {close}
            </div>
            <div className="vx-live-details__meta">
              <span className="vx-live-dot" aria-hidden="true" />
              <span className="vx-live-details__channel">{channel.name}</span>
              <span aria-hidden="true">·</span>
              <span>{formatRange(program.start, program.end)}</span>
            </div>
            {program.description ? <p className="vx-dialog__text vx-live-details__text">{program.description}</p> : null}
          </>
        ) : (
          <>
            <div className="vx-dialog__header vx-live-details__bare">{close}</div>
            <p className="vx-dialog__text">No guide information. You can still watch this channel.</p>
          </>
        )}
        <div className="vx-dialog__actions">
          <TvButton id="live-details-watch" className={buttonClass({ kind: "primary", icon: true })} onActivate={watchDetails}>
            <ButtonContent icon={<PlayIcon />}>Watch channel now</ButtonContent>
          </TvButton>
          <TvButton id="live-details-close" className={buttonClass()} onActivate={closeDetails}>Close</TvButton>
        </div>
        {tv ? <KeyLegend items={[{ key: "OK", label: "Select" }, { key: "BACK", label: "Close" }]} corner /> : null}
      </section>
    </div>
  );
  return createPortal(layer, document.querySelector(".tv-screen") ?? document.body);
}

function Monogram({ name, className = "vx-live-mono" }: { name: string; className?: string }) {
  return <span className={className} aria-hidden="true">{channelMonogram(name)}</span>;
}

/* ------------------------------------------------------------------------ */
/* Phone: channel list                                                        */
/* ------------------------------------------------------------------------ */
function PhoneLive({ props, guide }: { props: GuideProps; guide: Controller }) {
  const { onPlay, onMenu } = props;
  const {
    activeFilter, appendChannels, appending, channels, filterItems, formatShort, formatTime,
    guides, loading, now, openDetails, query, selectFilter, submitQuery, total,
  } = guide;
  const [searchOpen, setSearchOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const searching = searchOpen || !!query;
  useLayoutEffect(() => {
    if (searchOpen) input.current?.focus();
  }, [searchOpen]);
  const chipLabel = (filter: GuideFilter) => (filter.id === "all" ? "All" : filter.label);
  return (
    <main className="vx-live vx-live--phone">
      <header className="vx-live-phone__header">
        <h1 className="vx-live-phone__title">Live TV</h1>
        <span className="vx-live-clock"><span className="vx-live-dot" aria-hidden="true" />{formatTime(now)}</span>
        <button
          type="button"
          className="vx-live-phone__search-toggle"
          aria-label="Search Live TV"
          aria-expanded={searching}
          aria-controls="live-search-dock"
          onClick={() => {
            if (searching) {
              submitQuery("");
              setSearchOpen(false);
            } else setSearchOpen(true);
          }}
        >
          <Search aria-hidden="true" strokeWidth={2.2} />
        </button>
      </header>
      <div className="vx-live-chips" role="group" aria-label="Channel category">
        {filterItems.map((filter) => (
          <button type="button" key={filter.id} className={chipClass()} aria-pressed={filter.id === activeFilter.id} onClick={() => selectFilter(filter)}>
            <span>{chipLabel(filter)}</span>
          </button>
        ))}
      </div>
      <ul className="vx-live-list" aria-label="Channels">
        {channels.map((channel, index) => {
          const guideData = guides[channel.id];
          const { current, next } = nowNext(guideData?.programs ?? [], now);
          const details = () => openDetails(channel, current);
          return (
            <li key={channel.id}>
              <TvButton
                id={`live-channel-${index}`}
                className="vx-channel-row vx-live-item"
                aria-label={current ? `${channel.name}, now: ${current.title}` : channel.name}
                onActivate={() => onPlay(channel)}
                onHold={() => (onMenu ? onMenu(channel, details) : details())}
              >
                <Monogram name={channel.name} className="vx-monogram" />
                <span className="vx-channel-row__body">
                  <span className="vx-channel-row__channel">{channel.name}</span>
                  <span className={current ? "vx-channel-row__title" : "vx-channel-row__title vx-live-item__none"}>
                    {current ? current.title || "Untitled programme" : guideData ? "No guide information" : " "}
                  </span>
                  {current ? (
                    <span className="vx-progress vx-progress--small vx-live-progress" aria-hidden="true">
                      <span className="vx-progress__fill" style={{ width: `${elapsed(current.start, current.end, now) * 100}%` }} />
                    </span>
                  ) : null}
                  {next ? (
                    <span className="vx-channel-row__next">Next {formatShort(next.start)} · {next.title || "Untitled programme"}</span>
                  ) : null}
                </span>
              </TvButton>
            </li>
          );
        })}
        {loading && !channels.length &&
          Array.from({ length: 8 }, (_, index) => <li key={`skeleton-${index}`} aria-hidden="true"><SkeletonRow variant="phone" /></li>)}
      </ul>
      {channels.length > 0 && channels.length < total && (
        <AutoLoad onLoad={appendChannels} disabled={appending || loading} generation={channels.length} />
      )}
      {appending && <LoadingMore>Loading more channels…</LoadingMore>}
      {!loading && !channels.length && (
        <div className="vx-live-empty" role="status">
          {query ? (
            <EmptyState center icon={<Tv />} title="No channels or programmes match your search." />
          ) : (
            <EmptyState center icon={<Tv />} title="No channels here yet.">Choose another category.</EmptyState>
          )}
        </div>
      )}
      {searching && (
        <div className="vx-live-search-dock" id="live-search-dock">
          <label className="vx-search">
            <Search aria-hidden="true" strokeWidth={2.2} />
            <input
              ref={input}
              className="vx-search__input"
              type="search"
              aria-label="Search Live TV"
              placeholder="Search channels or programs"
              maxLength={128}
              value={query}
              onChange={(event) => submitQuery(event.target.value)}
              onBlur={() => { if (!query) setSearchOpen(false); }}
            />
            <button
              type="button"
              className="vx-search__clear"
              aria-label={query ? "Clear search" : "Close search"}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (query) {
                  submitQuery("");
                  input.current?.focus();
                } else setSearchOpen(false);
              }}
            >
              <X aria-hidden="true" strokeWidth={2.4} />
            </button>
          </label>
        </div>
      )}
      {guide.details && <LiveDetails guide={guide} details={guide.details} tv={false} />}
    </main>
  );
}

/* ------------------------------------------------------------------------ */
/* Desktop / web: EPG                                                         */
/* ------------------------------------------------------------------------ */
function blockContent(cell: GuideCell, loaded: boolean, range: string, now: number, missingLabel: string) {
  if (cell.missing) {
    return loaded ? (
      <>
        <span className="vx-guide-block__time">Live channel</span>
        <span className="vx-guide-block__title">{missingLabel}</span>
      </>
    ) : null;
  }
  const airing = cell.start <= now && cell.end > now;
  return (
    <>
      <span className="vx-guide-block__time">{range}</span>
      <span className="vx-guide-block__title">{cell.title}</span>
      {airing ? <span className="vx-guide-block__bar" style={{ width: `${elapsed(cell.start, cell.end, now) * 100}%` }} /> : null}
    </>
  );
}

function blockClass(cell: GuideCell, now: number, extra = "") {
  const kind = cell.missing ? " vx-guide-block--empty" : cell.start <= now && cell.end > now ? " vx-guide-block--airing" : "";
  return `vx-guide-block vx-live-block${kind}${extra}`;
}

function DesktopLive({ props, guide }: { props: GuideProps; guide: Controller }) {
  const { onPlay, onMenu } = props;
  const {
    activateCell, activeFilter, allTotal, appendChannels, appending, channels, filterItems, following,
    guides, guideTimezone, loading, moveWindow, now, openDetails, query, restoreNow, scrollViewport,
    selectFilter, setFollowing, submitQuery, total, visibleCells, visibleChannels, windowStart,
  } = guide;
  const compact = useCompact(true);
  const nowX = now >= windowStart && now < windowStart + RESPONSIVE_WINDOW_SECONDS ? deskSpan(now - windowStart) : undefined;
  const date = new Date(windowStart * 1000).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", timeZone: guideTimezone });
  const countFor = (filter: GuideFilter) => (filter.id === "all" ? allTotal : filter.count);
  const categoryLabel = (filter: GuideFilter) => {
    const count = countFor(filter);
    return filter.id !== "all" && count !== undefined ? `${filter.label}, ${count} channels` : filter.label;
  };
  const categories = compact ? (
    <div className="vx-live-chips vx-live-chips--desk" role="group" aria-label="Channel categories">
      {filterItems.map((filter) => (
        <button type="button" key={filter.id} className={chipClass()} aria-pressed={filter.id === activeFilter.id} onClick={() => selectFilter(filter)}>
          <span>{filter.label}</span>
        </button>
      ))}
    </div>
  ) : (
    <div className="vx-live-cats" role="group" aria-label="Channel categories">
      {filterItems.map((filter) => {
        const count = countFor(filter);
        return (
          <button type="button" key={filter.id} className="vx-live-cat" aria-pressed={filter.id === activeFilter.id} aria-label={categoryLabel(filter)} onClick={() => selectFilter(filter)}>
            <span className="vx-live-cat__label">{filter.label}</span>
            {filter.collection ? null : <span className="vx-live-cat__count" aria-hidden="true">{count ?? ""}</span>}
          </button>
        );
      })}
    </div>
  );
  return (
    <main className="vx-live vx-live--desk">
      <header className="vx-live-desk__head">
        <div className="vx-live-desk__heading">
          <h1 className="vx-live-desk__title">Live TV</h1>
          <p className="vx-live-desk__date">{date} · {zoneLabel(guideTimezone, windowStart)}</p>
        </div>
        <div className="vx-live-desk__tools">
          <label className="vx-search vx-live-search">
            <Search aria-hidden="true" strokeWidth={2.2} />
            <input
              className="vx-search__input"
              type="search"
              aria-label="Search Live TV"
              placeholder="Search channels or programs"
              maxLength={128}
              value={query}
              onChange={(event) => submitQuery(event.target.value)}
            />
            {query ? (
              <button type="button" className="vx-search__clear" aria-label="Clear search" onClick={() => submitQuery("")}>
                <X aria-hidden="true" strokeWidth={2.4} />
              </button>
            ) : null}
          </label>
          <div className="vx-live-time" role="group" aria-label="Guide navigation">
            <button type="button" className="vx-live-time__step" aria-label="Earlier" disabled={windowStart <= halfHour()} onClick={() => moveWindow(-1)}>
              <ChevronLeft aria-hidden="true" strokeWidth={2.2} />
            </button>
            <button type="button" className="vx-live-time__now" aria-pressed={following} onClick={restoreNow}>Now</button>
            <button type="button" className="vx-live-time__step" aria-label="Later" disabled={windowStart >= halfHour() + DAY_SECONDS} onClick={() => moveWindow(1)}>
              <ChevronRight aria-hidden="true" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </header>
      {compact ? categories : null}
      <div className="vx-live-desk__body">
        {compact ? null : categories}
        <section className="vx-live-guide" aria-label="TV schedule">
          <div
            className="vx-live-guide__scroll"
            ref={scrollViewport}
            role="region"
            aria-label="Scrollable programme guide"
            tabIndex={0}
            onScroll={(event) => {
              const element = event.currentTarget;
              if (element.scrollLeft > 8) setFollowing(false);
              if (element.scrollHeight - element.scrollTop - element.clientHeight < 520) appendChannels();
            }}
          >
            <div className="vx-live-guide__grid" style={{ width: `calc(var(--vx-live-channel-w) + ${RESPONSIVE_TIMELINE_WIDTH}px)` }}>
              <div className="vx-live-guide__head">
                <span className="vx-live-guide__count">{total} channels</span>
                <div className="vx-live-guide__times" style={{ width: RESPONSIVE_TIMELINE_WIDTH }}>
                  {halfHours(windowStart, RESPONSIVE_WINDOW_SECONDS).map((time) => (
                    <span key={time} className="vx-live-guide__time" style={{ left: deskSpan(time - windowStart) }}>{timelineLabel(guide, time)}</span>
                  ))}
                  {nowX !== undefined ? <span className="vx-live-now-pill" style={{ left: nowX }}>{guide.formatShort(now)}</span> : null}
                </div>
              </div>
              {visibleChannels.map((channel, row) => {
                const loaded = !!guides[channel.id];
                const details = () => openDetails(channel, nowNext(guides[channel.id]?.programs ?? [], now).current);
                return (
                  <div className="vx-live-row" key={channel.id} data-testid={`guide-row-${row}`}>
                    <button
                      type="button"
                      className="vx-live-channel"
                      aria-label={channel.name}
                      onClick={() => onPlay(channel)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        if (onMenu) onMenu(channel, details);
                        else details();
                      }}
                    >
                      <Monogram name={channel.name} />
                      <span className="vx-live-channel__name">{channel.name}</span>
                    </button>
                    <div className="vx-live-row__programs" style={{ width: RESPONSIVE_TIMELINE_WIDTH }}>
                      {(visibleCells.get(row) ?? []).map((cell, index) => {
                        const width = deskSpan(cell.end - cell.start);
                        const range = blockRange(guide, cell);
                        return (
                          <button
                            type="button"
                            key={index}
                            className={blockClass(cell, now)}
                            style={{ left: deskSpan(cell.start - windowStart) + DESK_BLOCK_INSET, width: width - 2 * DESK_BLOCK_INSET }}
                            aria-label={cell.missing ? `${channel.name}: live channel, no guide data` : `${channel.name}: ${cell.title}, ${range}`}
                            onClick={() => activateCell(channel, cell)}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              openDetails(channel, cell.program);
                            }}
                          >
                            {width >= 40 ? blockContent(cell, loaded, range, now, "No guide data — watch live") : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {nowX !== undefined && visibleChannels.length > 0 ? (
                <span className="vx-live-now-line" aria-hidden="true" style={{ left: `calc(var(--vx-live-grid-pad, 0px) + var(--vx-live-channel-w) + ${nowX}px)` }} />
              ) : null}
            </div>
            {appending ? <LoadingMore>Loading more channels… {channels.length} of {total}</LoadingMore> : null}
            {!channels.length && (
              loading ? (
                <div className="vx-live-guide__loading">
                  <StatusLine>Loading channels…</StatusLine>
                  {Array.from({ length: 6 }, (_, index) => <SkeletonRow key={index} />)}
                </div>
              ) : (
                <div className="vx-live-empty" role="status">
                  {query ? (
                    <EmptyState icon={<Tv />} title="No matching US channels or current programmes.">Try a channel name, section, or another title.</EmptyState>
                  ) : (
                    <EmptyState icon={<Tv />} title="No channels here yet.">Choose another filter.</EmptyState>
                  )}
                </div>
              )
            )}
          </div>
        </section>
      </div>
      {guide.details && <LiveDetails guide={guide} details={guide.details} tv={false} />}
    </main>
  );
}

/* ------------------------------------------------------------------------ */
/* TV: hero + chips + grid                                                    */
/* ------------------------------------------------------------------------ */
function TvHero({ guide }: { guide: Controller }) {
  const { channels, guides, now, offset, selected, selectedProgram, visibleCells } = guide;
  const channel = channels[selected];
  if (!channel) return null;
  const cells = visibleCells.get(selected) ?? [];
  const cell = selectedProgram ?? cells.find((candidate) => candidate.start <= now && candidate.end > now);
  const program = cell?.missing ? undefined : cell?.program;
  const data: GuideData | undefined = guides[channel.id];
  const next = program ? programAfter(data?.programs ?? [], program) : undefined;
  const airing = !!cell && !!program && cell.start <= now && cell.end > now;
  return (
    <section className="vx-live-tv__hero" aria-label="Selected programme">
      <div className="vx-live-tv__info">
        <div className="vx-live-tv__eyebrow">
          <span className="vx-badge vx-badge--live">LIVE</span>
          <span>{offset + selected + 1} · {channel.name}</span>
        </div>
        <h2 className="vx-live-tv__title">{program ? program.title || "Untitled programme" : channel.name}</h2>
        {program && cell ? (
          <div className="vx-live-tv__when">
            <span>{blockRange(guide, cell, true)}</span>
            {airing ? (
              <>
                <ProgressBar value={elapsed(cell.start, cell.end, now) * 100} className="vx-live-tv__progress" />
                <span>{Math.max(1, Math.ceil((program.end - now) / 60))} min left</span>
              </>
            ) : null}
          </div>
        ) : null}
        {next ? (
          <span className="vx-live-tv__next">Next at {guide.formatShort(next.start)} · {next.title || "Untitled programme"}</span>
        ) : !program && data ? (
          <span className="vx-live-tv__next">No guide information. You can still watch this channel.</span>
        ) : null}
      </div>
      <div className="vx-live-tv__preview" aria-hidden="true">
        <span className="vx-live-tv__preview-mono">{channelMonogram(channel.name)}</span>
        Live preview
      </div>
    </section>
  );
}

function TvLive({ props, guide }: { props: GuideProps; guide: Controller }) {
  const {
    activateCell, activeFilter, channels, closeSearchEntry, details, filterItems, guides, key, loading,
    now, offset, openDetails, query, searchEntry, searchEntryKey, selectFilter, selected, setSearchEntry,
    setSelected, setSelectedProgram, submitQuery, visibleCells, visibleChannels, visibleFirst, windowStart,
  } = guide;
  const nowX = now >= windowStart && now < windowStart + WINDOW_SECONDS ? tvSpan(now - windowStart) : undefined;
  return (
    <main className="vx-live vx-live--tv" onKeyDown={key}>
      <h1 className="vx-sr-only">Live TV</h1>
      <TvHero guide={guide} />
      <div className="vx-live-tv__chips" role="group" aria-label="Channel category">
        <TvButton
          id="guide-search"
          className={chipClass({ className: "vx-live-tv__search" })}
          aria-label={query ? `Search Live TV: ${query}` : "Search Live TV"}
          onActivate={() => setSearchEntry(true)}
        >
          <Search aria-hidden="true" strokeWidth={2.4} />
          {query ? <span>{query}</span> : null}
        </TvButton>
        {filterItems.map((filter, index) => (
          <TvButton
            id={`live-filter-${index}`}
            key={filter.id}
            className={chipClass()}
            aria-pressed={filter.id === activeFilter.id}
            onActivate={() => selectFilter(filter)}
          >
            <span>{filter.label}</span>
          </TvButton>
        ))}
      </div>
      <section className="vx-live-tv__grid" aria-label="TV schedule">
        <div className="vx-live-tv__head" aria-hidden="true">
          {halfHours(windowStart, WINDOW_SECONDS).map((time) => (
            <span key={time} className="vx-live-tv__time" style={{ left: tvSpan(time - windowStart) }}>{timelineLabel(guide, time)}</span>
          ))}
          {nowX !== undefined ? <span className="vx-live-now-pill" style={{ left: nowX }}>{guide.formatShort(now)}</span> : null}
        </div>
        {visibleChannels.map((channel, slot) => {
          const row = visibleFirst + slot;
          const cells = visibleCells.get(row) ?? [];
          const loaded = !!guides[channel.id];
          const current = cells.find((cell) => !cell.missing && cell.start <= now && cell.end > now)?.program;
          return (
            <div className={row === selected ? "vx-live-tv__row is-selected" : "vx-live-tv__row"} data-testid={`guide-row-${row}`} key={channel.id}>
              <TvButton
                id={`guide-channel-${row}`}
                className="vx-live-tv__channel"
                aria-label={channel.name}
                onFocus={() => {
                  setSelected(row);
                  setSelectedProgram(undefined);
                }}
                onActivate={() => props.onPlay(channel)}
                onHold={() => openDetails(channel, current, `guide-channel-${row}`)}
              >
                <span className="vx-live-tv__number" aria-hidden="true">{offset + row + 1}</span>
                <Monogram name={channel.name} />
                <span className="vx-live-tv__name">{channel.name}</span>
              </TvButton>
              <div className="vx-live-tv__programs">
                {cells.map((cell, index) => {
                  const id = `guide-program-${row}-${index}`;
                  const width = tvSpan(cell.end - cell.start);
                  const range = blockRange(guide, cell);
                  return (
                    <TvButton
                      id={id}
                      key={index}
                      className={blockClass(cell, now, details?.block === id ? " is-open" : "")}
                      style={{ left: tvSpan(cell.start - windowStart) + TV_BLOCK_INSET, width: width - 2 * TV_BLOCK_INSET }}
                      aria-label={cell.missing ? `${channel.name}: live channel, no guide data` : `${channel.name}: ${cell.title}, ${range}`}
                      onFocus={() => {
                        setSelected(row);
                        setSelectedProgram(cell);
                      }}
                      onActivate={() => activateCell(channel, cell, id)}
                      onHold={() => openDetails(channel, cell.program, id)}
                    >
                      {width >= 60 ? blockContent(cell, loaded, range, now, "No guide data — press OK to watch live") : null}
                    </TvButton>
                  );
                })}
              </div>
            </div>
          );
        })}
        {nowX !== undefined && visibleChannels.length > 0 ? (
          <span className="vx-live-now-line" aria-hidden="true" style={{ left: `calc(var(--vx-live-grid-pad, 0px) + var(--vx-live-channel-w) + ${nowX}px)` }} />
        ) : null}
        {!channels.length && (
          loading ? (
            <StatusLine className="vx-live-tv__status">Loading channels…</StatusLine>
          ) : (
            <div className="vx-live-empty" role="status">
              {query ? (
                <EmptyState icon={<Tv />} title="No matching US channels or current programmes.">Try a channel name, section, or another title.</EmptyState>
              ) : (
                <EmptyState icon={<Tv />} title="No channels here yet.">Choose another filter.</EmptyState>
              )}
            </div>
          )
        )}
      </section>
      {details ? null : (
        <KeyLegend
          className="vx-live-tv__legend"
          corner
          items={[
            { key: "OK", label: "Watch" },
            { key: "☰", label: "Details" },
            { key: "▲ ▼", label: "Channels" },
            { key: "◀ ▶", label: "Time" },
          ]}
        />
      )}
      {details && <LiveDetails guide={guide} details={details} tv />}
      {searchEntry &&
        createPortal(
          <div onKeyDownCapture={searchEntryKey}>
            <TextEntry
              title="Search Live TV"
              initialValue={query}
              maxLength={128}
              showCount
              onSubmit={async (value) => {
                submitQuery(value.trim());
                guide.setSearchEntry(false);
              }}
              onCancel={closeSearchEntry}
            />
          </div>,
          document.querySelector(".tv-screen") ?? document.body,
        )}
    </main>
  );
}

/* The Live TV channel guide: presentation only, over useGuideController. */
export function Guide(props: GuideProps) {
  const { responsive = false, phone = false } = props;
  const guide = useGuideController(props);
  if (responsive && phone) return <PhoneLive props={props} guide={guide} />;
  if (responsive) return <DesktopLive props={props} guide={guide} />;
  return <TvLive props={props} guide={guide} />;
}
