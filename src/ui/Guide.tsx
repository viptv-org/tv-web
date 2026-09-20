import { createPortal } from "react-dom";
import { type Guide as GuideData, type GuideProgram, type MediaItem } from "../api";
import { TvButton } from "./remote";
import { TextEntry } from "./TextEntry";
import "./account-roku.css";
import "./guide-responsive.css";
import { DAY_SECONDS, GUIDE_CACHE_LIMIT, GUIDE_CELL_LIMIT, GUIDE_WIDTH, HOUR_SECONDS, PAGE_SIZE, PREFETCH_ROWS, RESPONSIVE_TIMELINE_WIDTH, RESPONSIVE_WINDOW_SECONDS, VISIBLE_ROWS, WINDOW_SECONDS, cellAt, filterOptions, firstVisibleRow, guideCells, halfHour } from "./guide-core";
import { useGuideController, type GuideProps } from "./useGuideController";
export { guideCells } from "./guide-core";

/* The Live TV channel guide: presentation only, over useGuideController. */
export function Guide(props: GuideProps) {
  const { api, onPlay, onError, onDetails, responsive = false } = props;
  const {
    activateCell, appendChannels, appendCursor, appendPending,
    appendScope, appending, cache, categories,
    category, cellsByRow, channels, closeSearchEntry,
    collection, failedLogos, filterItems, focusAfterLoad,
    focusAfterTimeline, following, formatTime, guides,
    key, loadGeneration, loading, moveWindow,
    now, offset, pageChannels, query,
    restoreNow, routePage, rowWindow, scrollViewport,
    searchEntry, searchEntryKey, selectFilter, selected,
    selectedGuide, selectedProgram, setAppending, setCategories,
    setCategory, setChannels, setCollection, setFailedLogos,
    setFollowing, setGuides, setLoading, setNow,
    setOffset, setQuery, setSearchEntry, setSelected,
    setSelectedProgram, setTotal, setWindowStart, total,
    visibleCells, visibleChannels, visibleFirst, windowStart,
    activeFilter, guideTimezone
  } = useGuideController(props);
  if (responsive) return (
    <main className="responsive-epg">
      {/* One page row: the guide and its sidebar share the single remaining row below it. */}
      <header className="epg-page-heading">
        <div className="epg-heading-title">
          <p className="epg-eyebrow">LIVE TV</p>
          <h1>Channel guide</h1>
          <p className="epg-scroll-help" id="epg-scroll-help">Scroll down for channels and sideways for later programmes. Select a channel to watch live.</p>
        </div>
        <div className="epg-heading-filter">
          <h2>{activeFilter.label}</h2>
          <p>{new Date(windowStart * 1000).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', timeZone: guideTimezone })} · {guideTimezone || 'Local time'}</p>
        </div>
        <label className="epg-search"><span>Search Live TV</span><input type="search" value={query} placeholder="Channels or programmes" maxLength={128} onChange={event => { setOffset(0); setQuery(event.target.value); }} /></label>
        <div className="epg-time-actions" aria-label="Guide navigation">
          <button type="button" disabled={windowStart <= halfHour()} onClick={() => moveWindow(-1)}>Earlier</button>
          <button type="button" aria-pressed={following} onClick={restoreNow}>Now</button>
          <button type="button" disabled={windowStart >= halfHour() + DAY_SECONDS} onClick={() => moveWindow(1)}>Later</button>
        </div>
      </header>
      <div className="epg-layout">
        <aside className="epg-categories" aria-label="Channel categories">
          <h2>Browse channels</h2>
          {filterItems.map(filter => <button type="button" key={filter.id} aria-pressed={filter.id === activeFilter.id} onClick={() => selectFilter(filter)}>{filter.label}</button>)}
        </aside>
        <section className="epg-content" aria-label="TV schedule">
          <label className="epg-mobile-category"><span>Channel category</span><select value={activeFilter.id} onChange={event => { const filter = filterItems.find(item => item.id === event.target.value); if (filter) selectFilter(filter); }}>{filterItems.map(filter => <option key={filter.id} value={filter.id}>{filter.label}</option>)}</select></label>
          <div className="epg-scroll" ref={scrollViewport} role="region" aria-label="Scrollable programme guide" aria-describedby="epg-scroll-help" tabIndex={0} onScroll={event => { const element = event.currentTarget; if (element.scrollLeft > 8) setFollowing(false); if (element.scrollHeight - element.scrollTop - element.clientHeight < 520) appendChannels(); }}>
            <div className="epg-grid">
              <div className="epg-time-header guide-header"><span className="epg-channel-heading">Channels</span><div className="epg-time-labels">{Array.from({ length: 12 }, (_, index) => <span key={index}>{selectedGuide?.timeline?.find(point => point.time === windowStart + index * 1_800)?.displayTime ?? formatTime(windowStart + index * 1_800)}</span>)}</div></div>
              {visibleChannels.map((channel, row) => <div className="epg-row" key={channel.id} data-testid={`guide-row-${row}`}>
                <button type="button" className="epg-channel" aria-label={channel.name} onClick={() => onPlay(channel)}>
                  {channel.poster && !failedLogos.has(channel.id) && <img src={channel.poster} alt="" loading="lazy" onError={() => setFailedLogos(previous => new Set(previous).add(channel.id))} />}
                  <span>{channel.name}</span>
                </button>
                <div className="epg-programs">{(visibleCells.get(row) ?? []).map((cell, index) => {
                  const width = ((cell.end - cell.start) / RESPONSIVE_WINDOW_SECONDS) * RESPONSIVE_TIMELINE_WIDTH;
                  return <button type="button" className={`epg-program${cell.missing ? ' epg-gap' : ''}`} key={`${cell.start}-${index}`} style={{ left: ((cell.start - windowStart) / RESPONSIVE_WINDOW_SECONDS) * RESPONSIVE_TIMELINE_WIDTH, width: Math.max(1, width - 4) }} aria-label={`${channel.name}: ${cell.title}, ${formatTime(cell.start)} to ${formatTime(cell.end)}`} onClick={() => activateCell(channel, cell)}>
                    <small>{cell.missing ? 'LIVE CHANNEL' : `${formatTime(cell.start)} – ${formatTime(cell.end)}`}</small><span>{cell.title}</span>
                  </button>;
                })}{now >= windowStart && now < windowStart + RESPONSIVE_WINDOW_SECONDS && <span className="epg-now responsive-guide-now" aria-hidden="true" style={{ left: ((now - windowStart) / RESPONSIVE_WINDOW_SECONDS) * RESPONSIVE_TIMELINE_WIDTH }} />}</div>
              </div>)}
            </div>
            {!channels.length && <p className="epg-empty" role="status">{loading ? 'Loading channels…' : query ? 'No matching US channels or current programmes. Try a channel name, section, or another title.' : 'No channels here yet. Choose another filter.'}</p>}
          </div>
        </section>
      </div>
      <footer className="epg-page-controls"><span role="status">{!channels.length ? `${total} channels` : appending ? `Loading more channels… ${channels.length} of ${total}` : `${channels.length} of ${total} channels`}</span></footer>
    </main>
  );
  return (
    <main className="guide roku-guide" onKeyDown={key}>
      <h1>Live TV</h1>
      <div className="guide-filters">
        <TvButton id="guide-search" onActivate={() => setSearchEntry(true)}>
          {query ? `Search Live TV: ${query}` : "Search Live TV"}
        </TvButton>
        {filterItems.map((filter, index) => (
          <TvButton
            id={`live-filter-${index}`}
            key={filter.id}
            aria-pressed={
              filter.collection === collection && filter.category === category
            }
            onActivate={() => {
              focusAfterLoad.current = 0;
              setCollection(filter.collection);
              setCategory(filter.category);
              setOffset(0);
            }}
          >
            {filter.label}
          </TvButton>
        ))}
      </div>
      {responsive && <div className="responsive-guide-controls" aria-label="Guide navigation">
        <TvButton id="guide-previous-channels" disabled={loading || (offset === 0 && visibleFirst === 0)} onActivate={() => pageChannels(-1)}>Previous channels</TvButton>
        <TvButton id="guide-next-channels" disabled={loading || offset + visibleFirst + VISIBLE_ROWS >= total} onActivate={() => pageChannels(1)}>Next channels</TvButton>
        <TvButton id="guide-earlier" disabled={windowStart <= halfHour()} onActivate={() => moveWindow(-1)}>Earlier</TvButton>
        <TvButton id="guide-now" aria-pressed={following} onActivate={restoreNow}>Now</TvButton>
        <TvButton id="guide-later" disabled={windowStart >= halfHour() + DAY_SECONDS} onActivate={() => moveWindow(1)}>Later</TvButton>
        <span>Current time {formatTime(now)}</span>
      </div>}
      <div className="guide-header">
        {[0, 1, 2, 3].map((index) => (
          <span key={index}>
            {selectedGuide?.timeline?.find(
              (point) => point.time === windowStart + index * 1_800,
            )?.displayTime ?? formatTime(windowStart + index * 1_800)}
          </span>
        ))}
      </div>
      <div className="guide-rows">
        {visibleChannels.map((channel, slot) => {
          const row = visibleFirst + slot;
          const cells = visibleCells.get(row) ?? [];
          return (
            <div
              className="guide-row"
              data-testid={`guide-row-${row}`}
              key={channel.id}
            >
              <TvButton
                id={`guide-channel-${row}`}
                onFocus={() => setSelected(row)}
                onActivate={() => onPlay(channel)}
                onHold={() => onDetails(channel)}
              >
                {channel.poster && !failedLogos.has(channel.id) ? (
                  <img
                    src={channel.poster}
                    alt={channel.name}
                    onError={() =>
                      setFailedLogos((previous) =>
                        new Set(previous).add(channel.id),
                      )
                    }
                  />
                ) : (
                  <span>{channel.name}</span>
                )}
              </TvButton>
              <div className="programs">
                {cells.map((cell, index) => {
                  const left =
                    ((cell.start - windowStart) / WINDOW_SECONDS) * GUIDE_WIDTH;
                  const width =
                    ((cell.end - cell.start) / WINDOW_SECONDS) * GUIDE_WIDTH;
                  return (
                    <TvButton
                      style={{
                        position: "absolute",
                        left,
                        width: Math.max(1, width - 3),
                        height: 87,
                      }}
                      id={`guide-program-${row}-${index}`}
                      key={`${cell.start}-${cell.end}-${index}`}
                      onFocus={() => {
                        setSelected(row);
                        setSelectedProgram(cell);
                      }}
                      onActivate={() => activateCell(channel, cell)}
                      onHold={() => onDetails(channel, cell.program)}
                    >
                      {width > 52 && (
                        <>
                          <small>
                            {cell.missing
                              ? "LIVE CHANNEL"
                              : cell.program &&
                                  cell.program.start <= now &&
                                  cell.program.end > now
                                ? `${Math.ceil((cell.program.end - now) / 60)} MIN LEFT`
                                : typeof cell.program?.raw.display_time ===
                                    "string"
                                  ? cell.program.raw.display_time
                                  : formatTime(cell.start)}
                          </small>
                          <span>{cell.title}</span>
                        </>
                      )}
                    </TvButton>
                  );
                })}
              </div>
            </div>
          );
        })}
        {responsive && now >= windowStart && now < windowStart + WINDOW_SECONDS && <div className="guide-now responsive-guide-now" aria-hidden="true" style={{ left: 132 + Math.floor(((now - windowStart) / WINDOW_SECONDS) * GUIDE_WIDTH), height: visibleChannels.length * 91 }} />}
      </div>
      {!responsive && now >= windowStart && now < windowStart + WINDOW_SECONDS && (
        <div
          className="guide-now"
          style={{
            left:
              432 +
              Math.floor(((now - windowStart) / WINDOW_SECONDS) * GUIDE_WIDTH),
          }}
        />
      )}
      <div className="guide-selection-count">
        {channels.length
          ? `${offset + selected + 1} / ${total}`
          : `${total} channels`}
      </div>
      <p className="guide-selection-title">
        {selectedProgram?.missing
          ? channels[selected]?.name
          : (selectedProgram?.title ?? channels[selected]?.name)}
      </p>
      <p className="guide-help">
        {responsive ? "Select a programme to watch or view details. Scroll sideways to see the full schedule." : "OK Watch / Details * Details Replay Now Back Sidebar"}
      </p>
      {selectedGuide?.timezone && (
        <span className="guide-timezone">{selectedGuide.timezone}</span>
      )}
      {!channels.length && (
        <p className="guide-empty" role="status">
          {loading
            ? "Loading channels…"
            : query
              ? "No matching US channels or current programmes. Try a channel name, section, or another title."
              : "No channels here yet. Choose another filter."}
        </p>
      )}
      {searchEntry &&
        createPortal(
          <div onKeyDownCapture={searchEntryKey}>
            <TextEntry
              title="Search Live TV"
              initialValue={query}
              onSubmit={async (value) => {
                focusAfterLoad.current = 0;
                setOffset(0);
                setQuery(value.trim().slice(0, 128));
                setSearchEntry(false);
              }}
              onCancel={closeSearchEntry}
            />
          </div>,
          document.querySelector(".tv-screen") ?? document.body,
        )}
    </main>
  );
}
