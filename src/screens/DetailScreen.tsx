import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Check, ChevronDown, Ellipsis, Plus } from "lucide-react";
import { normalizeCore } from "../core";
import { presentation as itemPresentation } from "../core/presentations";
import { formatPlaybackTime } from "../ui/SeekBar";
import { CardArtwork, CardThumbnail, ReadyImage, artworkUrl } from "../ui/RokuArtwork";
import { ResponsiveTitle } from "../ui/ResponsiveTitle";
import { RokuText } from "../ui/RokuText";
import { TvButton } from "../ui/remote";
import type { Catalog, MediaItem, MediaPresentation, MediaSource } from "../api";
import { castMembers, directorNames, genreTarget, type GenreTarget } from "../ui/detailLinks";

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
  catalogs = [],
  origin,
  onGenre,
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
  /** Catalogs the genre links may browse. */
  catalogs?: readonly Catalog[];
  /** The catalog the title was opened from, preferred for genre links. */
  origin?: Catalog;
  onGenre?: (target: GenreTarget) => void;
}) {
  // Genre targets cost a catalog-filter projection per catalog: resolve them
  // once per title, not per render.
  const genres = useMemo(
    () => (responsive ? selected.genres.map((genre) => ({ genre, target: genreTarget(selected, genre, catalogs, origin) })) : []),
    [responsive, selected, catalogs, origin],
  );
  const cast = useMemo(() => (responsive ? castMembers(selected) : []), [responsive, selected]);
  const directors = responsive ? directorNames(selected) : "";
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
          {(responsive
            ? [selected.year, selected.runtime, selected.imdbRating ? `IMDb ${selected.imdbRating}` : ""]
            : [selected.year, selected.runtime, ...selected.genres])
            .filter(Boolean)
            .join(" · ")}
        </p>
        {genres.length > 0 && (
          <div className="detail-genres" role="list" aria-label="Genres">
            {genres.map(({ genre, target }) =>
              target && onGenre ? (
                <button
                  type="button"
                  role="listitem"
                  key={genre}
                  className="genre-chip"
                  title={`Browse ${genre} in ${target.catalog.name}`}
                  onClick={() => onGenre(target)}
                >
                  {genre}
                </button>
              ) : (
                <span role="listitem" key={genre} className="genre-chip is-static">{genre}</span>
              ),
            )}
          </div>
        )}
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
            {responsive ? <Ellipsis size={20} aria-hidden="true" /> : "More info"}
          </TvButton>
        </div>
        {responsive ? (
          directors && <p className="detail-credits">Director: {directors}</p>
        ) : (
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
        )}
      </div>
      {cast.length > 0 && (
        <section className="detail-cast" aria-label="Cast">
          <h2 className="episode-heading">Cast</h2>
          <div className="cast-row" data-scroll-id="cast">
            {cast.map((member, index) => (
              <div className="cast-member" key={`${member.name}-${index}`}>
                <span className="cast-photo" aria-hidden="true">
                  <span>{member.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
                  {member.photo && <ReadyImage src={artworkUrl(member.photo, 160, 160)} alt="" loading="lazy" />}
                </span>
                <strong>{member.name}</strong>
                {member.character && <small>{member.character}</small>}
              </div>
            ))}
          </div>
        </section>
      )}
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
                      itemPresentation(e).episodeImage ?? e.background ?? e.poster,
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
