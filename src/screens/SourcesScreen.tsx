import { type Dispatch, type SetStateAction } from "react";
import { TvButton } from "../ui/remote";
import { formatPlaybackTime } from "../ui/SeekBar";
import type { MediaItem, MediaSource } from "../api";
import type { ModalRequest } from "./DetailScreen";

function presentationContext(item: MediaItem) {
  const context =
    item.season !== undefined
      ? `S${item.season} · E${item.episode ?? 1}${item.episodeTitle ? ` · ${item.episodeTitle}` : ""}`
      : "";
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
  return [context, status].filter(Boolean).join(" · ");
}

/**
 * The source-selection screen: quality/provider filters over the discovered
 * stream list, with per-source details and the opening-stream state. All
 * data and actions stay owned by the App state machine; this component only
 * renders what it is given, with the DOM contract (class names, focus ids,
 * roles) frozen.
 */
export function SourcesScreen({
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
}: {
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
}) {
  return (
    <main className="sources">
      <h1>Sources</h1>
      <p className="source-context">
        {selected?.name}
        {selected ? `  ${presentationContext(selected)}` : ""}
      </p>
      <div className="source-filters">
        <TvButton
          id="source-quality"
          onActivate={() =>
            setModal({
              title: "Quality",
              focus: sourceQuality,
              choices: [
                "All",
                ...Array.from(
                  new Set(sources.map((s) => s.quality ?? "Unknown")),
                ),
              ].map((label) => ({
                label,
                action: () => {
                  setSourceQuality(label);
                  setModal(undefined);
                },
              })),
            })
          }
        >
          Quality: {sourceQuality}
        </TvButton>
        <TvButton
          id="source-provider"
          onActivate={() =>
            setModal({
              title: "Source provider",
              focus: sourceProvider,
              choices: [
                "All",
                ...Array.from(
                  new Set(sources.map((s) => s.sourceName ?? s.name)),
                ),
              ].map((label) => ({
                label,
                action: () => {
                  setSourceProvider(label);
                  setModal(undefined);
                },
              })),
            })
          }
        >
          Provider: {sourceProvider}
        </TvButton>
        <span className={busy ? "finding" : undefined}>
          {busy && (
            <i
              className="source-discovery-spinner"
              aria-hidden="true"
            />
          )}
          {busy && preparing
            ? "Opening stream…"
            : busy
              ? "Finding sources…"
              : `${sources.length} ${sources.length === 1 ? "source" : "sources"}`}
        </span>
      </div>
      <div className="source-results">
        {sources
          .filter(
            (s) =>
              (sourceQuality === "All" ||
                (s.quality ?? "Unknown") === sourceQuality) &&
              (sourceProvider === "All" ||
                (s.sourceName ?? s.name) === sourceProvider),
          )
          .map((s, i) => (
            <TvButton
              id={`source-${i}`}
              key={s.id}
              className={
                s.id === openingSource ? "source opening" : "source"
              }
              onHold={() =>
                setModal({
                  title: "Source details",
                  body: [s.name, s.title, s.filename, s.sourceName]
                    .filter(Boolean)
                    .join("\n\n"),
                  choices: [
                    {
                      label: "Close",
                      action: () => setModal(undefined),
                    },
                  ],
                })
              }
              onActivate={() =>
                selected &&
                void play(selected, s, selected.position ?? 0)
              }
            >

              {s.id === openingSource && (
                <i
                  className="source-discovery-spinner source-opening-spinner"
                  aria-hidden="true"
                />
              )}
              <h2>{s.sourceName ?? s.name}</h2>
              <p>
                {[s.name, s.title ?? s.filename]
                  .filter(Boolean)
                  .join("\n")}
              </p>
              <small>
                {[s.quality, s.audio, s.sourceName].filter(Boolean).join(" · ")}
              </small>
            </TvButton>
          ))}
        {!sources.length && (
          <div
            className={`source-empty ${busy ? "finding" : ""}`}
            role="status"
          >
            <h2>
              {busy ? "Finding sources" : "No sources available"}
            </h2>
            <p>
              {busy
                ? "Sources appear here as they arrive."
                : "Check your add-ons in Settings."}
            </p>
          </div>
        )}
        {sources.length > 0 &&
          !sources.some(
            (s) =>
              (sourceQuality === "All" ||
                (s.quality ?? "Unknown") === sourceQuality) &&
              (sourceProvider === "All" ||
                (s.sourceName ?? s.name) === sourceProvider),
          ) && (
            <p>
              No matching sources. Choose another provider or quality.
            </p>
          )}
      </div>
    </main>
  );
}
