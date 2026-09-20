import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { normalizeCore } from "../core";
import { formatPlaybackTime } from "../ui/SeekBar";
import { CardArtwork, CardThumbnail, ReadyImage, artworkUrl } from "../ui/RokuArtwork";
import { ResponsiveTitle } from "../ui/ResponsiveTitle";
import { RokuText } from "../ui/RokuText";
import { TvButton } from "../ui/remote";
import type { MediaItem, MediaPresentation, MediaSource } from "../api";

/**
 * A modal request the screens can raise. Structurally compatible with the
 * App state machine's wider modal state (message/detail are App-owned), so
 * App's setModal passes through unchanged.
 */
export type ModalChoice = { label: string; action: () => void };
export type ModalRequest = {
  title: string;
  choices: ModalChoice[];
  body?: string;
  focus?: string;
};

function SeasonDropdown({
  seasons,
  activeSeason,
  onSelectSeason,
}: {
  seasons: number[];
  activeSeason?: number;
  onSelectSeason: (s: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="custom-season-dropdown" ref={containerRef}>
      <button
        type="button"
        className="season-dropdown-btn"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>Season {activeSeason ?? seasons[0]}</span>
        <ChevronDown size={14} className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <div className="season-dropdown-menu" role="menu">
          {seasons.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitem"
              className={`season-dropdown-item ${s === (activeSeason ?? seasons[0]) ? "is-selected" : ""}`}
              onClick={() => {
                onSelectSeason(s);
                setOpen(false);
              }}
            >
              <span>Season {s}</span>
              {s === (activeSeason ?? seasons[0]) && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The detail screen for the selected item: poster/backdrop art, facts,
 * synopsis, primary actions, credits and the episode grid. All data and
 * actions stay owned by the App state machine; this component only renders
 * what it is given, with the DOM contract (class names, focus ids, roles)
 * frozen.
 */
export function DetailScreen({
  responsive,
  selected,
  presentation,
  episodes,
  season,
  setSeason,
  favorites,
  play,
  discoverSources,
  manage,
  toggle,
  setModal,
}: {
  responsive: boolean;
  selected: MediaItem;
  presentation: MediaPresentation | undefined;
  episodes: readonly MediaItem[];
  season: number | undefined;
  setSeason: Dispatch<SetStateAction<number | undefined>>;
  favorites: readonly MediaItem[];
  play: (item: MediaItem, source?: MediaSource, position?: number) => unknown;
  discoverSources: (item: MediaItem, resume?: boolean) => unknown;
  manage: (item: MediaItem) => void;
  toggle: (item: MediaItem) => unknown;
  setModal: Dispatch<SetStateAction<ModalRequest | undefined>>;
}) {
  return (
    <main
      className={`detail ${selected.type === "series" && !selected.episode ? "series" : "movie"}`}
    >
      {!responsive && selected.background && (
        <div className="detail-backdrop" aria-hidden="true">
          <ReadyImage src={selected.background} alt="" />
        </div>
      )}
      {!responsive && <ReadyImage className="poster" src={selected.poster} alt="" />}
      {responsive && <div className="responsive-detail-art"><CardArtwork src={presentation?.heroImage ?? undefined} fallback="Preview unavailable" /></div>}
      <div className="detail-copy">
        {responsive ? <ResponsiveTitle title={selected.name} logo={presentation?.titleLogo} /> : <h1><RokuText>{selected.name}</RokuText></h1>}
        <p className="detail-facts">
          {[selected.year, selected.runtime, ...selected.genres]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="detail-synopsis">{selected.description}</p>
        <div className="actions">
          <TvButton
            id="detail-play"
            onActivate={() => {
              if (selected.type === "series" && !selected.episode) {
                if (responsive) {
                  const targetEpisode = episodes.find((e) => e.position && !e.watched) ?? episodes.find((e) => e.season === season) ?? episodes[0] ?? selected;
                  void discoverSources(targetEpisode, !!targetEpisode.position);
                } else {
                  setModal({
                    title: "Season",
                    choices: Array.from(
                      new Set(episodes.map((e) => e.season)),
                    ).map((n) => ({
                      label: `Season ${n ?? 1}`,
                      action: () => {
                        setSeason(n);
                        setModal(undefined);
                      },
                    })),
                  });
                }
              } else {
                void (selected.type === "live"
                  ? play(selected)
                  : discoverSources(selected, !!selected.position));
              }
            }}
            onHold={() => void discoverSources(selected)}
          >
            {selected.type === "series" && !selected.episode
              ? (responsive
                ? (() => {
                    const resumeEp = episodes.find((e) => e.position && !e.watched);
                    if (resumeEp && resumeEp.position) return `Resume S${resumeEp.season ?? 1}:E${resumeEp.episode ?? 1}`;
                    const targetEp = episodes.find((e) => e.season === season) ?? episodes[0];
                    return targetEp ? `Play S${targetEp.season ?? 1}:E${targetEp.episode ?? 1}` : "Play";
                  })()
                : `Season ${season ?? 1}`)
              : selected.position
                ? `Resume at ${formatPlaybackTime(selected.position)}`
                : "Choose source"}
          </TvButton>
          {!!selected.position &&
            !(selected.type === "series" && !selected.episode) && (
              <TvButton
                id="detail-source"
                onActivate={() => void discoverSources(selected)}
              >
                Choose source
              </TvButton>
            )}
          <TvButton
            id="detail-save"
            className="detail-save-btn"
            aria-label={favorites.some((f) => f.id === selected.id) ? "Remove from My List" : "Add to My List"}
            aria-pressed={favorites.some((f) => f.id === selected.id)}
            onActivate={() => void toggle(selected)}
          >
            {responsive ? (favorites.some((f) => f.id === selected.id) ? <Check size={18} /> : <Plus size={18} />) : favorites.some((f) => f.id === selected.id) ? "Remove from My List" : "+ My List"}
          </TvButton>
          <TvButton
            id="detail-info"
            aria-label="More options"
            onActivate={() => {
              if (responsive) {
                manage(selected);
              } else {
                setModal({
                  title: selected.name,
                  body: [
                    selected.name,
                    [
                      selected.year,
                      selected.runtime,
                      ...selected.genres,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                    selected.description,
                    typeof selected.raw.director === "string"
                      ? `Director: ${selected.raw.director}`
                      : "",
                    Array.isArray(selected.raw.cast)
                      ? `Cast: ${selected.raw.cast.filter((name) => typeof name === "string").join(", ")}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join("\n\n"),
                  choices: [
                    {
                      label: "Close",
                      action: () => setModal(undefined),
                    },
                  ],
                });
              }
            }}
          >
            {responsive ? "•••" : "More info"}
          </TvButton>
        </div>
        <p className="detail-credits">
          {[
            typeof selected.raw.director === "string"
              ? `Director: ${selected.raw.director}`
              : "",
            Array.isArray(selected.raw.cast)
              ? `Cast: ${selected.raw.cast.filter((name) => typeof name === "string").join(", ")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n")}
        </p>
      </div>
      {episodes.length > 0 && (
        <>
          <div className="episodes-header">
            <span className="episode-heading">Episodes</span>
            {responsive && (() => {
              const seasons = Array.from(
                new Set(episodes.map((e) => e.season).filter((s): s is number => s !== undefined)),
              ).sort((a, b) => a - b);
              return seasons.length > 1 ? (
                <SeasonDropdown
                  seasons={seasons}
                  activeSeason={season}
                  onSelectSeason={(s) => setSeason(s)}
                />
              ) : null;
            })()}
          </div>
          <div className="episode-grid" data-scroll-id="episodes">
            {episodes
              .filter((e) => e.season === season)
              .map((e, i) => {
                const episodeCard = <TvButton
                  className="episode"
                  id={`episode-${i}`}
                  key={e.id}
                  onActivate={() => void discoverSources(e)}
                  onHold={() => manage(e)}
                >
                  <CardThumbnail
                    src={artworkUrl(
                      normalizeCore<MediaPresentation>("presentation", e).episodeImage ?? e.background ?? e.poster,
                      256,
                      144,
                    )}
                    fallback={
                      <>
                        <img
                          src={`${import.meta.env.BASE_URL}assets/viptv-mark.png`}
                          alt=""
                        />
                        <span>Preview unavailable</span>
                      </>
                    }
                    watched={e.watched}
                    progress={!e.watched && !!e.position && !!e.duration ? e.position : undefined}
                    maxProgress={e.duration ?? 1}
                  />
                  <small>EPISODE {e.episode ?? "?"}</small>
                  <h2>
                    <RokuText>{e.episodeTitle ?? e.name}</RokuText>
                  </h2>
                  <p>{e.description}</p>
                </TvButton>;
                return responsive ? <div className="responsive-episode" key={e.id}>{episodeCard}</div> : episodeCard;
              })}
          </div>
        </>
      )}
    </main>
  );
}
