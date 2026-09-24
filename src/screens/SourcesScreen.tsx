import { type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import { ChevronDown, Film, ListFilter, Search, X } from "lucide-react";
import { TvButton } from "../ui/remote";
import { formatPlaybackTime } from "../ui/SeekBar";
import type { MediaItem, MediaSource } from "../api";
import type { ModalRequest } from "./DetailScreen";
import { anchorBelow } from "./titleMenu";
import { sourceRowClass, SourceRowContent } from "../ui/primitives/Cards";
import { EmptyState } from "../ui/primitives/Feedback";
import { KbdHints, KeyLegend } from "../ui/primitives/Keys";
import { PlayIcon } from "../ui/primitives/icons";
import { episodeCode, matchesFilters, providerOf, qualityChoices, qualityLabel, qualityOf } from "./titleSources";

/** The item being sourced: "The End of Oak Street" / "Monster: … · S1 E1", and its queue / resume state. */
function presentationContext(item: MediaItem) {
  const status =
    item.queueStatus === "next"
      ? "Play next episode"
      : item.queueStatus === "caught_up"
        ? "You're caught up"
        : item.queueStatus === "upcoming"
          ? "Next episode coming soon"
          : item.position
            ? `Resume at ${formatPlaybackTime(item.position)}`
            : "";
  return { title: [item.name, episodeCode(item)].filter(Boolean).join(" · "), status };
}

/**
 * Choose a source: an overlay over the title page (the `sources` route keeps
 * its URL and Back level). Phone bottom sheet (Sources), desktop right drawer
 * 460 (DeskSources), TV right panel 820 (TvSources). Quality chips, the
 * "Source provider" list, a status line while addons still answer, and the
 * source rows ("Best match" on the first). Hold OK / right-click on a row
 * opens its details. All data and actions stay owned by the App state machine.
 */
export function SourcesScreen({
  responsive,
  phone = false,
  selected,
  sources,
  sourceQuality,
  sourceProvider,
  setSourceQuality,
  setSourceProvider,
  busy,
  preparing,
  openingSource,
  play,
  setModal,
  onClose,
}: {
  responsive: boolean;
  phone?: boolean;
  selected: MediaItem | undefined;
  sources: readonly MediaSource[];
  sourceQuality: string;
  sourceProvider: string;
  setSourceQuality: Dispatch<SetStateAction<string>>;
  setSourceProvider: Dispatch<SetStateAction<string>>;
  busy: boolean;
  preparing: boolean;
  openingSource: string | undefined;
  play: (item: MediaItem, source?: MediaSource, position?: number) => unknown;
  setModal: Dispatch<SetStateAction<ModalRequest | undefined>>;
  /** Closes the overlay (the route's Back). */
  onClose: () => void;
}) {
  const tv = !responsive;
  const qualities = qualityChoices(sources);
  const qualityValues = ["All", ...qualities.map((q) => q.quality)];
  const providers = Array.from(new Set(sources.map(providerOf)));
  const visible = sources.filter((s) => matchesFilters(s, sourceQuality, sourceProvider));
  const count = sources.length;
  const checking = busy && !preparing;
  const context = selected ? presentationContext(selected) : { title: "", status: "" };
  // "Still checking [2] addons": the poll step does not say how many addons are pending.
  const progress = preparing ? "opening stream…" : checking ? "still checking addons" : "";
  const found = `${count} found`;
  // Phone: "Still checking addons · The End of Oak Street"; desktop: "12 found · still checking addons";
  // TV: "Monster · S1 E1 · still checking addons". Once every addon answered, the resume / queue
  // state takes the progress slot ("Resume at 12:48").
  const status = phone
    ? [progress ? progress[0].toUpperCase() + progress.slice(1) : context.status, context.title].filter(Boolean).join(" · ")
    : tv
      ? [context.title, progress || context.status || found].filter(Boolean).join(" · ")
      : count || !busy ? [found, progress || context.status].filter(Boolean).join(" · ") : "Finding sources…";

  const chooseProvider = () =>
    setModal({
      title: "Source provider",
      view: { kind: "choices", anchor: responsive && !phone ? anchorBelow(document.querySelector('[data-focus-id="source-provider"]'), "end") : undefined },
      focus: sourceProvider,
      choices: [
        ...["All", ...providers].map((label) => ({
          label,
          current: label === sourceProvider,
          action: () => {
            setSourceProvider(label);
            setModal(undefined);
          },
        })),
        // The desktop popover closes on Esc / outside press (DeskSourceProvider has no Cancel row).
        ...(responsive && !phone ? [] : [{ label: "Cancel", action: () => setModal(undefined) }]),
      ],
    });
  const showDetails = (s: MediaSource) =>
    setModal({
      title: "Source details",
      view: { kind: "text" },
      body: [s.name, s.title, s.filename, s.sourceName].filter(Boolean).join("\n\n"),
      choices: [{ label: "Close", action: () => setModal(undefined) }],
    });
  // TV: ◀ ▶ on a source row steps through the quality filters (the legend's "Quality").
  const stepQuality = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!tv || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    if (!(event.target as HTMLElement).closest(".vx-source-row")) return;
    event.preventDefault();
    event.stopPropagation();
    const index = qualityValues.indexOf(sourceQuality);
    const next = qualityValues[(index + (event.key === "ArrowRight" ? 1 : qualityValues.length - 1)) % qualityValues.length];
    setSourceQuality(next);
  };

  const providerLabel = sourceProvider === "All" ? "All providers" : sourceProvider;
  const chips = (
    <>
      {phone || tv ? (
        qualityValues.map((value, index) => {
          const n = value === "All" ? count : qualities.find((q) => q.quality === value)?.count ?? 0;
          return (
            <TvButton
              key={value}
              id={`source-quality-${index}`}
              className="vx-chip"
              aria-pressed={value === sourceQuality}
              onActivate={() => setSourceQuality(value)}
            >
              <span>{value === "All" ? "All" : qualityLabel(value)}</span>
              {tv && n ? <span className="vx-chip__count">{n}</span> : null}
            </TvButton>
          );
        })
      ) : (
        <div className="vx-segmented vx-segmented--drawer" role="group" aria-label="Quality">
          {qualityValues.map((value, index) => (
            <TvButton
              key={value}
              id={`source-quality-${index}`}
              className="vx-segmented__item"
              aria-pressed={value === sourceQuality}
              onActivate={() => setSourceQuality(value)}
            >
              {value === "All" ? "All" : qualityLabel(value)}
            </TvButton>
          ))}
        </div>
      )}
      <TvButton
        id="source-provider"
        className={tv ? `vx-chip vx-chip--dropdown${sourceProvider === "All" ? "" : " vx-chip--set"}` : "vx-btn vx-btn--outline"}
        aria-haspopup="dialog"
        onActivate={chooseProvider}
      >
        {tv ? <span>{providerLabel}</span> : providerLabel}
        <ChevronDown aria-hidden="true" strokeWidth={2.2} />
      </TvButton>
    </>
  );

  return (
    <div className="vx-overlay vx-overlay--fixed vx-title-overlay sources" data-focus-scope="sources">
      <div className="vx-scrim" aria-hidden="true" onClick={onClose} />
      <section className="vx-dialog vx-dialog--drawer vx-sources" role="dialog" aria-modal="true" aria-labelledby="vx-sources-title">
        <button type="button" className="vx-dialog__grabber" aria-label="Close sources" tabIndex={-1} onClick={onClose}><span /></button>
        <div className="vx-dialog__head">
          <div className="vx-dialog__header">
            <h2 className="vx-dialog__title" id="vx-sources-title">Choose a source</h2>
            {phone && count ? <span className="vx-dialog__meta">{found}</span> : null}
            {responsive && !phone ? (
              <button type="button" className="vx-close" aria-label="Close" onClick={onClose}><X aria-hidden="true" strokeWidth={2.2} /></button>
            ) : null}
          </div>
          {status ? (
            <div className="vx-status vx-sources__status" role="status">
              {busy ? <span className="vx-spinner" aria-hidden="true" /> : null}
              <span className="vx-sources__status-text">{status}</span>
            </div>
          ) : null}
        </div>
        <div className="vx-dialog__tools">{chips}</div>
        <div className="vx-dialog__scroll" onKeyDown={stepQuality}>
          {visible.map((s, i) => {
            const provider = providerOf(s);
            const quality = s.quality ?? "";
            const file = [s.title ?? s.filename, s.audio].filter(Boolean).join(" · ");
            return (
              <TvButton
                id={`source-${i}`}
                key={s.id}
                className={sourceRowClass(s === sources[0])}
                aria-label={`Play from ${provider}${quality ? `, ${quality}` : ""}${file ? `, ${file}` : ""}`}
                onHold={() => showDetails(s)}
                onActivate={() => selected && void play(selected, s, selected.position ?? 0)}
              >
                <SourceRowContent
                  quality={qualityOf(s) === "Unknown" ? "—" : quality}
                  provider={provider}
                  file={file}
                  best={s === sources[0]}
                  opening={s.id === openingSource}
                  icon={<PlayIcon />}
                />
              </TvButton>
            );
          })}
          {!count ? (
            <div className="vx-sources__empty" role="status">
              {busy ? (
                <EmptyState icon={<Search aria-hidden="true" />} title="Finding sources">Sources appear here as they arrive.</EmptyState>
              ) : (
                <EmptyState icon={<Film aria-hidden="true" />} title="No sources available">Check your add-ons in Settings.</EmptyState>
              )}
            </div>
          ) : !visible.length ? (
            <div className="vx-sources__empty" role="status">
              <EmptyState icon={<ListFilter aria-hidden="true" />} title="No matching sources">Choose another provider or quality.</EmptyState>
            </div>
          ) : null}
        </div>
        {responsive && !phone ? (
          <div className="vx-dialog__footer">
            <KbdHints hints={[{ keys: ["↑", "↓"], label: "Move" }, { keys: ["Enter"], label: "Play" }, { keys: ["Esc"], label: "Close" }]} />
          </div>
        ) : null}
      </section>
      {tv ? <KeyLegend corner items={[{ key: "OK", label: "Play" }, { key: "◀ ▶", label: "Quality" }, { key: "BACK", label: "Close" }]} /> : null}
    </div>
  );
}
