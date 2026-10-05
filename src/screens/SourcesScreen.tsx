import { useEffect, useLayoutEffect, useRef, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
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
import { producerStatus, sourceDescription, sourceDetails, sourceProviderKey, type SourceProducer } from "./sourceProducers";

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

/** The button keeps focus; only its clipped description moves. */
function SourceDescription({ text }: { text: string }) {
  const textRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const content = textRef.current;
    const window = content?.parentElement;
    if (!content || !window) return;
    const measure = () => {
      const distance = Math.max(0, content.scrollHeight - window.clientHeight);
      content.dataset.overflow = distance > 1 ? "true" : "false";
      content.style.setProperty("--vx-source-description-travel", `${distance}px`);
      content.style.setProperty("--vx-source-description-duration", `${2.4 + distance / 12 * 2}s`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(window);
    observer.observe(content);
    return () => observer.disconnect();
  }, [text]);
  return <span ref={textRef} className="vx-source-row__file-motion">{text}</span>;
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
  desktop = false,
  phone = false,
  selected,
  sources,
  producers,
  sourceQuality,
  sourceProvider,
  providerPickerOpen,
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
  desktop?: boolean;
  phone?: boolean;
  selected: MediaItem | undefined;
  sources: readonly MediaSource[];
  producers: readonly SourceProducer[];
  sourceQuality: string;
  sourceProvider: string;
  providerPickerOpen: boolean;
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
  const providers = producers;
  const visible = sources.filter((s) => matchesFilters(s, sourceQuality, sourceProvider));
  const count = sources.length;
  const checking = busy && !preparing;
  const context = selected ? presentationContext(selected) : { title: "", status: "" };
  const discovery = checking ? (count ? "Still checking sources" : "Finding sources") : "";
  const progress = preparing ? "opening stream…" : discovery;
  const found = `${count} found`;
  // Phone: "Still checking sources · The End of Oak Street"; desktop: "12 found · Still checking sources";
  // TV: "Monster · S1 E1 · Still checking sources". Once every addon answered, the resume / queue
  // state takes the progress slot ("Resume at 12:48").
  const status = phone
    ? [progress || context.status, context.title].filter(Boolean).join(" · ")
    : tv
      ? [context.title, progress || context.status || found].filter(Boolean).join(" · ")
      : count || !busy ? [found, progress || context.status].filter(Boolean).join(" · ") : "Finding sources…";

  const providerChoices = () => [
    ...[{ key: "All", label: "All" }, ...providers].map(({ key, label }) => ({
      label: key === "All" ? label : `${label}${sources.some((source) => sourceProviderKey(source) === key) ? "" : busy ? " · Checking" : " · No playable sources"}`,
      current: key === sourceProvider,
      action: () => {
        setSourceProvider(key);
        setModal(undefined);
      },
    })),
    ...(responsive && !phone ? [] : [{ label: "Cancel", action: () => setModal(undefined) }]),
  ];
  const producerSignature = providers.map((provider) => `${provider.key}:${provider.label}:${sources.some((source) => sourceProviderKey(source) === provider.key) ? "rows" : busy ? "pending" : "empty"}`).join("|");
  const previousSignature = useRef(producerSignature);
  useEffect(() => {
    const changed = previousSignature.current !== producerSignature;
    previousSignature.current = producerSignature;
    if (changed && providerPickerOpen)
      setModal((current) => current?.title === "Source provider" ? { ...current, choices: providerChoices() } : current);
  }, [producerSignature, providerPickerOpen]);
  const chooseProvider = () =>
    setModal({
      title: "Source provider",
      view: { kind: "choices", anchor: responsive && !phone ? anchorBelow(document.querySelector('[data-focus-id="source-provider"]'), "end") : undefined },
      focus: sourceProvider === "All" ? "All" : providers.find((provider) => provider.key === sourceProvider)?.label,
      choices: providerChoices(),
    });
  const showDetails = (s: MediaSource) =>
    setModal({
      title: "Source details",
      view: { kind: "text" },
      body: sourceDetails(s),
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

  const selectedProducer = producers.find((producer) => producer.key === sourceProvider);
  const providerLabel = sourceProvider === "All" ? "All providers" : selectedProducer?.label ?? sourceProvider;
  const selectedStatus = selectedProducer ? producerStatus(selectedProducer, sources, !busy) : "";
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
    <div className="vx-overlay vx-overlay--fixed vx-title-overlay sources" data-viptv-video-controls="" data-focus-scope="sources">
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
              {checking ? <span className="vx-spinner" aria-hidden="true" /> : null}
              <span className="vx-sources__status-text">{status}</span>
            </div>
          ) : null}
        </div>
        <div className="vx-dialog__tools">{chips}</div>
        <div className="vx-dialog__scroll" onKeyDown={stepQuality}>
          {visible.map((s, i) => {
            const producer = producers.find((producer) => producer.key === sourceProviderKey(s));
            const provider = producer?.label ?? providerOf(s);
            const quality = s.quality ?? "";
            const file = sourceDescription(s);
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
                  quality={qualityOf(s) === "Unknown" ? (desktop ? "" : "—") : quality}
                  providerIcon={desktop ? (producer?.icon ? <img src={producer.icon} alt="" decoding="async" /> : <span>{provider.trim().slice(0, 2).toUpperCase()}</span>) : undefined}
                  provider={provider}
                  file={<SourceDescription text={file} />}
                  best={s === sources[0]}
                  opening={s.id === openingSource}
                  icon={<PlayIcon />}
                />
              </TvButton>
            );
          })}
          {!count ? (
            <div className="vx-sources__empty" role="status">
              {selectedStatus ? (
                <EmptyState icon={<Film aria-hidden="true" />} title={selectedStatus} />
              ) : busy ? (
                <EmptyState icon={<Search aria-hidden="true" />} title="Finding sources">Sources appear here as they arrive.</EmptyState>
              ) : (
                <EmptyState icon={<Film aria-hidden="true" />} title="No sources available">Check your add-ons in Settings.</EmptyState>
              )}
            </div>
          ) : !visible.length ? (
            <div className="vx-sources__empty" role="status">
              <EmptyState icon={<ListFilter aria-hidden="true" />} title={selectedStatus || "No matching sources"}>{selectedStatus ? "" : "Choose another provider or quality."}</EmptyState>
            </div>
          ) : null}
        </div>
        {responsive && !phone && !desktop ? (
          <div className="vx-dialog__footer">
            <KbdHints hints={[{ keys: ["↑", "↓"], label: "Move" }, { keys: ["Enter"], label: "Play" }, { keys: ["Esc"], label: "Close" }]} />
          </div>
        ) : null}
      </section>
      {tv ? <KeyLegend corner items={[{ key: "OK", label: "Play" }, { key: "◀ ▶", label: "Quality" }, { key: "BACK", label: "Close" }]} /> : null}
    </div>
  );
}
