import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronUp, Ellipsis, Film, Info, Plus } from "lucide-react";
import { presentation as itemPresentation } from "../core/presentations";
import { ReadyImage, artworkUrl } from "../ui/RokuArtwork";
import { TvButton } from "../ui/remote";
import type { Catalog, MediaItem, MediaPresentation, MediaSource, TvApi } from "../api";
import { enrichDetail, initialEpisode } from "../ui/detailProgress";
import { castMembers, directorNames, genreTarget, type GenreTarget } from "../ui/detailLinks";
import { buttonClass, SourcePillContent } from "../ui/primitives/Button";
import { CardArt, EpisodeCaption, MissingArt } from "../ui/primitives/Cards";
import { Badge, QualityBadge } from "../ui/primitives/Badges";
import { PlayIcon } from "../ui/primitives/icons";
import { Spinner } from "../ui/primitives/Progress";
import type { Choice, ModalView } from "../ui/app/appShared";
import { formatRuntime, providerOf, sourceKey } from "./titleSources";

/**
 * A modal request the screens can raise. Structurally compatible with the
 * App state machine's wider modal state (message/detail are App-owned), so
 * App's setModal passes through unchanged. `view` selects the title-family
 * presentation hint the generic modal reads (src/ui/app/AppDialogs.tsx).
 */
export type ModalChoice = Choice;
export type ModalRequest = {
  title: string;
  choices: ModalChoice[];
  body?: string;
  focus?: string;
  view?: ModalView;
};

/** The source discovery state of the title's play target (useCatalog previewSources). */
export type SourceSummary = { key: string; sources: readonly MediaSource[]; done: boolean };

const icon = { "aria-hidden": true, strokeWidth: 2.2 } as const;

/**
 * The title (detail) page: art, logo, facts, synopsis, the play / source /
 * My List / menu actions, credits and the episode list. Reference screens:
 * Title (phone, a movie), DeskTitle (desktop, a series), TvTitle (TV).
 * All data and actions stay owned by the App state machine. Under the
 * Sources overlay the same page stays mounted as its backdrop (`backdrop`):
 * inert, and without starting its own source discovery.
 */
export function DetailScreen({
  responsive,
  phone = false,
  api,
  selected: given,
  presentation: givenPresentation,
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
  onBack,
  sourcePreview,
  previewSources,
  backdrop = false,
}: {
  responsive: boolean;
  /** The responsive phone arrangement (usePhoneLayout). */
  phone?: boolean;
  /** Loads a bare route reference's details when the page is the Sources backdrop. */
  api?: TvApi;
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
  /** Phone: the glass Back button over the art. */
  onBack?: () => void;
  sourcePreview?: SourceSummary;
  /** Starts the background discovery of an item's sources; returns its cancel. */
  previewSources?: (item: MediaItem) => () => void;
  /** Rendered under the Sources overlay. */
  backdrop?: boolean;
}) {
  // A Sources deep link starts from a bare reference (id only): the backdrop loads its details.
  const [loaded, setLoaded] = useState<MediaItem>();
  useEffect(() => {
    if (!backdrop || given.name || !api) return;
    let live = true;
    api.detail(given).then((value) => { if (live) setLoaded(enrichDetail(given, value.item)); }, () => undefined);
    return () => { live = false; };
  }, [backdrop, given.id, given.name]);
  const selected = loaded && loaded.id === given.id && !given.name ? loaded : given;
  const presentation = givenPresentation && selected === given ? givenPresentation : selected.name ? itemPresentation(selected) : undefined;
  const series = selected.type === "series" && !selected.episode;
  const art = presentation?.heroImage ?? selected.background ?? selected.poster;
  // Genre targets cost a catalog-filter projection per catalog: resolve them
  // once per title, not per render.
  const genres = useMemo(
    () => selected.genres.map((genre) => ({ genre, target: responsive && onGenre ? genreTarget(selected, genre, catalogs, origin) : undefined })),
    [responsive, selected, catalogs, origin, onGenre],
  );
  const cast = useMemo(() => castMembers(selected), [selected]);
  const directors = directorNames(selected);
  const saved = favorites.some((f) => f.id === selected.id);

  // The play target: the episode in progress, else the next unwatched one of
  // the chosen season, else the title itself.
  const seasons = useMemo(
    () => Array.from(new Set(episodes.map((e) => e.season).filter((s): s is number => s !== undefined))).sort((a, b) => a - b),
    [episodes],
  );
  // The play target: the episode the shared core opens the title on (resumed,
  // else next up) while its season is shown, else the chosen season's next
  // unwatched episode; a movie (or an episode page) plays itself.
  const initial = useMemo(() => (episodes.length ? initialEpisode(episodes, selected) : undefined), [episodes, selected]);
  const inSeason = (e: MediaItem) => e.season === season;
  const listed: MediaItem | undefined = episodes.length
    ? (initial && inSeason(initial) ? initial : episodes.find((e) => inSeason(e) && !e.watched) ?? episodes.find(inSeason) ?? initial ?? episodes[0])
    : series ? undefined : selected;
  // Opened from a queued episode: that item keeps its queue fields (next-episode, exact resume source).
  const target = listed && selected.episode !== undefined && listed.id === selected.id ? selected : listed ?? (series ? selected : undefined);
  const resume = !!target?.position && !target.watched;
  const playLabel = target && target.season !== undefined && target.episode !== undefined
    ? `${resume ? "Resume" : "Play"} S${target.season} E${target.episode}`
    : resume ? "Resume" : "Play";
  const startPlay = () => {
    if (selected.type === "live") return void play(selected);
    if (target) void discoverSources(target, resume);
  };
  const chooseSource = () => {
    if (target) void discoverSources(target);
  };

  // The best source for the play target, discovered in the background.
  const targetKey = target && selected.type !== "live" && !(target.type === "series" && !target.episode) ? sourceKey(target) : "";
  useEffect(() => {
    if (backdrop || !target || !targetKey || !previewSources) return;
    let cancel: (() => void) | undefined;
    // Let a quick pass through the page (Back, a season flick) settle first.
    const timer = setTimeout(() => {
      cancel = previewSources(target);
    }, 400);
    return () => {
      clearTimeout(timer);
      cancel?.();
    };
  }, [backdrop, targetKey]);
  const summary = sourcePreview && sourcePreview.key === targetKey ? sourcePreview : undefined;
  // TV: the row shows the play target's episode (Play keeps the focus).
  const targetIndex = episodes.filter((e) => e.season === season).findIndex((e) => e.id === target?.id);
  useEffect(() => {
    if (responsive || targetIndex < 0) return;
    const card = document.querySelector<HTMLElement>(`.vx-title__episode-list [data-focus-id="episode-${targetIndex}"]`);
    const list = card?.parentElement;
    if (!card || !list) return;
    const left = card.offsetLeft - list.offsetLeft;
    if (left + card.offsetWidth > list.clientWidth) list.scrollLeft = left - parseFloat(getComputedStyle(list).paddingLeft);
  }, [responsive, targetIndex, season, episodes.length]);
  const best = summary?.sources[0];
  const count = summary?.sources.length ?? 0;
  const sourcesCopy = `${count} ${count === 1 ? "source" : "sources"}`;
  const finding = !!targetKey && (!summary || (!summary.done && !count));

  // Facts: P/D "2026 · 1 h 40 min · Action · Adventure"; TV adds "Series" and the IMDb rating (TvTitle).
  const genreNode = genres.length ? (
    <span className="vx-title__genres">
      {genres.map(({ genre, target: link }, index) => (
        <span key={genre}>
          {index > 0 ? " · " : ""}
          {link && onGenre ? (
            <button type="button" className="vx-title__genre" title={`Browse ${genre} in ${link.catalog.name}`} onClick={() => onGenre(link)}>{genre}</button>
          ) : genre}
        </span>
      ))}
    </span>
  ) : null;
  const facts: ReactNode[] = [
    !responsive && selected.type === "series" ? "Series" : "",
    selected.year ? String(selected.year) : "",
    !responsive && selected.imdbRating ? `IMDb ${selected.imdbRating}` : "",
    formatRuntime(selected.runtime),
  ].filter(Boolean);
  if (genreNode) facts.push(genreNode);
  const factsLine = facts.length ? (
    <p className="vx-title__facts">
      {facts.map((fact, index) => (
        <span key={index} className="vx-title__fact">
          {index > 0 ? <span className="vx-title__dot" aria-hidden="true">·</span> : null}
          {fact}
        </span>
      ))}
    </p>
  ) : null;
  const credits = (cast.length > 0 || directors) && (
    <div className="vx-title__credits">
      {directors ? <p><span className="vx-title__credit-label">Director</span> {directors}</p> : null}
      {cast.length > 0 ? <p><span className="vx-title__credit-label">Cast</span> {cast.slice(0, 4).map((member) => member.name).join(", ")}</p> : null}
    </div>
  );
  const heading = <TitleHeading name={selected.name} logo={presentation?.titleLogo ?? undefined} />;

  const openMoreInfo = () =>
    setModal({
      title: selected.name,
      view: { kind: "text", meta: [selected.year, formatRuntime(selected.runtime), ...selected.genres].filter(Boolean).join(" · ") },
      body: [
        selected.description,
        directors ? `Director: ${directors}` : "",
        cast.length ? `Cast: ${cast.map((member) => member.name).join(", ")}` : "",
      ].filter(Boolean).join("\n\n"),
      choices: [{ label: "Close", action: () => setModal(undefined) }],
    });
  const openSeasons = () =>
    setModal({
      title: "Season",
      view: { kind: "choices" },
      focus: `Season ${season ?? seasons[0] ?? 1}`,
      choices: [
        ...seasons.map((n) => ({
          label: `Season ${n}`,
          current: n === season,
          action: () => {
            setSeason(n);
            setModal(undefined);
          },
        })),
        { label: "Cancel", action: () => setModal(undefined) },
      ],
    });

  const saveButton = (tv: boolean) => (
    <TvButton
      id="detail-save"
      className={tv ? buttonClass({ icon: true }) : buttonClass({ round: true, size: phone ? "detail" : "default" })}
      aria-label={saved ? "Remove from My List" : "Add to My List"}
      aria-pressed={saved}
      onActivate={() => void toggle(selected)}
    >
      {saved ? <Check {...icon} /> : <Plus {...icon} />}
      {tv ? "My List" : null}
    </TvButton>
  );
  const menuButton = (
    <TvButton
      id="detail-info"
      className={buttonClass({ round: true, size: phone ? "detail" : "default" })}
      aria-label="More options"
      aria-haspopup="menu"
      onActivate={() => manage(selected)}
    >
      <Ellipsis {...icon} strokeWidth={2.4} />
    </TvButton>
  );

  // ---- episodes --------------------------------------------------------
  const shown = episodes.filter((e) => e.season === season);
  const episodeList = episodes.length > 0 && (
    <section className="vx-title__episodes" aria-labelledby="vx-title-episodes">
      <div className="vx-title__episodes-head">
        {responsive ? (
          <>
            <h2 className="vx-title__section" id="vx-title-episodes">Episodes</h2>
            {seasons.length > 1 ? (
              <div className={phone ? "vx-title__seasons" : "vx-segmented"} role="group" aria-label="Season">
                {seasons.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={phone ? "vx-chip" : "vx-segmented__item"}
                    aria-pressed={n === season}
                    onClick={() => setSeason(n)}
                  >
                    <span>Season {n}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <h2 className="vx-sr-only" id="vx-title-episodes">Episodes</h2>
            <TvButton
              id="detail-season"
              className={buttonClass({ size: "small" })}
              aria-haspopup={seasons.length > 1 ? "dialog" : undefined}
              onActivate={() => (seasons.length > 1 ? openSeasons() : undefined)}
            >
              Season {season ?? seasons[0] ?? 1}
            </TvButton>
            <span className="vx-title__count">{shown.length} {shown.length === 1 ? "episode" : "episodes"}</span>
          </>
        )}
      </div>
      <div className="vx-title__episode-list" data-scroll-id="episodes">
        {shown.map((e, i) => {
          const still = artworkUrl(itemPresentation(e).episodeImage ?? e.background ?? e.poster, 544, 300);
          const watching = !e.watched && !!e.position;
          const progress = e.watched ? 100 : watching && e.duration ? (e.position! / e.duration) * 100 : undefined;
          const badge = watching ? <Badge kind="watching">Watching</Badge> : e.id === target?.id ? <Badge kind="up-next">Up next</Badge> : undefined;
          const number = e.episode ?? i + 1;
          return (
            <TvButton
              className="vx-card vx-card--episode vx-title__episode"
              id={`episode-${i}`}
              key={e.id}
              onActivate={() => void discoverSources(e)}
              onHold={() => manage(e)}
            >
              <CardArt
                src={still}
                missing={<MissingArt title={e.episodeTitle ?? e.name} icon={<Film aria-hidden="true" />} />}
                badge={badge}
                progress={progress}
              />
              {responsive ? (
                <span className="vx-card__caption">
                  <EpisodeCaption number={`E${number}`} title={e.episodeTitle ?? e.name} synopsis={e.description} />
                </span>
              ) : (
                <EpisodeCaption eyebrow={`Episode ${number}`} title={e.episodeTitle ?? e.name} synopsis={e.description} />
              )}
            </TvButton>
          );
        })}
      </div>
    </section>
  );

  // ---- TV (TvTitle) -------------------------------------------------------
  if (!responsive) {
    return (
      <main className={`detail vx-title ${series ? "series" : "movie"}`} aria-hidden={backdrop || undefined}>
        {art ? (
          <div className="vx-title__backdrop" aria-hidden="true">
            <ReadyImage className="vx-title__ambient" src={artworkUrl(art, 480, 270)} alt="" />
            <ReadyImage className="vx-title__sharp" src={artworkUrl(art, 1280, 720, true)} alt="" />
          </div>
        ) : null}
        <section className="vx-title__hero">
          {heading}
          {factsLine}
          {selected.description ? <p className="vx-title__synopsis">{selected.description}</p> : null}
          <div className="vx-title__actions">
            <TvButton id="detail-play" className={buttonClass({ icon: true })} onActivate={startPlay} onHold={chooseSource}>
              <PlayIcon />
              {playLabel}
            </TvButton>
            {targetKey ? (
              <TvButton id="detail-source" className="vx-source-pill" aria-label={best ? `Choose source: ${best.quality ? `${best.quality} ` : ""}${providerOf(best)}` : "Choose source"} onActivate={chooseSource}>
                {best ? <SourcePillContent quality={best.quality ?? "—"} provider={providerOf(best)} /> : <>{finding ? <Spinner variant="inline" /> : null}Choose source</>}
              </TvButton>
            ) : null}
            {saveButton(true)}
            <TvButton id="detail-info" className={buttonClass({ icon: true })} aria-haspopup="dialog" onActivate={openMoreInfo}>
              <Info {...icon} />
              More info
            </TvButton>
          </div>
        </section>
        {episodeList}
      </main>
    );
  }

  // ---- phone (Title) ------------------------------------------------------
  if (phone) {
    return (
      <main className={`detail vx-title ${series ? "series" : "movie"}`} aria-hidden={backdrop || undefined}>
        <div className="vx-title__art" aria-hidden="true">
          {art ? <ReadyImage src={artworkUrl(art, 780, 600, true)} alt="" /> : null}
        </div>
        {onBack && !backdrop ? (
          <TvButton id="detail-back" className="vx-title__back" aria-label="Back" onActivate={onBack}>
            <ChevronLeft {...icon} strokeWidth={2.4} />
          </TvButton>
        ) : null}
        <div className="vx-title__copy">
          {heading}
          {factsLine}
          {selected.description ? <p className="vx-title__synopsis">{selected.description}</p> : null}
          {credits}
        </div>
        {episodeList}
        <div className="vx-title__dock">
          {targetKey ? (
            <TvButton
              id="detail-source"
              className="vx-title__source-row"
              aria-label={count ? `Change source — ${count} ${count === 1 ? "source" : "sources"} found` : "Choose source"}
              aria-haspopup="dialog"
              onActivate={chooseSource}
            >
              {best?.quality ? <QualityBadge>{best.quality}</QualityBadge> : finding ? <Spinner variant="inline" /> : null}
              <span className="vx-title__source-text">
                <span className="vx-title__source-label">{best ? "Best source" : finding ? "Finding sources…" : "Sources"}</span>
                <span className="vx-title__source-name">{best ? providerOf(best) : "Choose a source"}</span>
              </span>
              {count ? <span className="vx-title__source-count">{sourcesCopy}</span> : null}
              <ChevronUp aria-hidden="true" strokeWidth={2.2} className="vx-title__source-chevron" />
            </TvButton>
          ) : null}
          <div className="vx-title__actions">
            {saveButton(false)}
            <TvButton id="detail-play" className={buttonClass({ kind: "primary", size: "detail", icon: true })} onActivate={startPlay} onHold={chooseSource}>
              <PlayIcon />
              {playLabel}
            </TvButton>
            {menuButton}
          </div>
        </div>
      </main>
    );
  }

  // ---- desktop / web (DeskTitle) --------------------------------------------
  return (
    <main className={`detail vx-title ${series ? "series" : "movie"}`} aria-hidden={backdrop || undefined}>
      <section className="vx-title__hero">
        {art ? (
          <div className="vx-title__ambient-layer" aria-hidden="true">
            <ReadyImage className="vx-title__ambient" src={artworkUrl(art, 480, 270)} alt="" />
          </div>
        ) : null}
        <div className="vx-title__grid">
          <div className="vx-title__copy">
            {heading}
            {factsLine}
            {selected.description ? <p className="vx-title__synopsis">{selected.description}</p> : null}
            <div className="vx-title__actions">
              <div className="vx-split">
                <TvButton id="detail-play" className="vx-split__main" onActivate={startPlay} onHold={chooseSource}>
                  <PlayIcon />
                  {playLabel}
                </TvButton>
                {targetKey ? (
                  <TvButton id="detail-source" className="vx-split__more" aria-label="Choose source" aria-haspopup="dialog" onActivate={chooseSource}>
                    <ChevronDown {...icon} />
                  </TvButton>
                ) : null}
              </div>
              {saveButton(false)}
              {menuButton}
            </div>
            {targetKey ? (
              <button
                type="button"
                className="vx-title__source-line"
                aria-label={count ? `Change source — ${count} ${count === 1 ? "source" : "sources"} found` : "Choose source"}
                aria-haspopup="dialog"
                onClick={chooseSource}
              >
                {best?.quality ? <QualityBadge>{best.quality}</QualityBadge> : finding ? <Spinner variant="inline" /> : null}
                <span>{best ? `${providerOf(best)} · best of ${sourcesCopy}` : finding ? "Finding sources…" : "No sources found yet"}</span>
                <span className="vx-title__source-change">{best ? "Change" : "Choose"}</span>
              </button>
            ) : null}
            {credits}
          </div>
          {art ? (
            <div className="vx-title__still">
              <ReadyImage src={artworkUrl(art, 1552, 864, true)} alt="" />
            </div>
          ) : null}
        </div>
      </section>
      {episodeList}
    </main>
  );
}

/** The title as its logo (sized per platform), or as display text when there is none or it fails. */
function TitleHeading({ name, logo }: { name: string; logo?: string }) {
  const [failed, setFailed] = useState<string>();
  const [loaded, setLoaded] = useState<string>();
  const useLogo = !!logo && failed !== logo;
  return (
    <h1 className={useLogo ? "vx-title__name vx-title__name--logo" : "vx-title__name"}>
      {useLogo ? (
        <img
          src={logo}
          alt=""
          style={loaded === logo ? undefined : { visibility: "hidden" }}
          onLoad={() => setLoaded(logo)}
          onError={() => setFailed(logo)}
        />
      ) : null}
      <span className={useLogo ? "vx-sr-only" : "vx-title__text"}>{name}</span>
    </h1>
  );
}
