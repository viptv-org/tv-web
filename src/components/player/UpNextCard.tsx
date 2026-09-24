import type { MediaItem } from "../../api";
import { artworkUrl, presentation } from "../../core/presentations";
import { PlayIcon } from "../../ui/primitives/icons";
import { TvButton } from "../../ui/remote";
import { upNextLabel, type UpNextCard as UpNextState } from "../../ui/app/upNext";

/**
 * Up Next (decisions.md 1; PhUpNext / DeskUpNext / TvUpNext): the next
 * episode's still, "NEXT EPISODE", its number and title, "Starts in N" with a
 * countdown bar, then Play now (the accent action on phone and desktop) and
 * Cancel. Phone: above the controls; desktop: bottom-right above the
 * timeline; TV: top-right under the status word, Play now focused.
 */
export function UpNextCard({
  card,
  current,
  onPlay,
  onCancel,
}: {
  card: UpNextState;
  current: MediaItem | undefined;
  onPlay: () => void;
  onCancel: () => void;
}) {
  const next = card.item;
  const art = next ? presentation(next).episodeImage ?? next.background ?? next.poster : undefined;
  // Requested at the TV still size (240 × 134, 2x for the desktop / phone stills).
  const still = art ? artworkUrl(art, 480, 268) : undefined;
  const title = upNextLabel(next, current);
  const seconds = Math.max(0, Math.ceil(card.left));
  const elapsed = card.total > 0 ? Math.min(100, Math.max(0, ((card.total - card.left) / card.total) * 100)) : 0;
  return (
    <section className="vx-up-next" aria-label="Up next">
      <div className="vx-up-next__row">
        {still ? (
          <img className="vx-up-next__still" src={still} alt="" />
        ) : (
          <span className="vx-up-next__still" aria-hidden="true" />
        )}
        <div className="vx-up-next__text">
          <span className="vx-up-next__eyebrow">Next episode</span>
          {title && <span className="vx-up-next__title">{title}</span>}
          <span className="vx-up-next__count">Starts in {seconds}</span>
        </div>
      </div>
      <span
        className="vx-progress vx-up-next__progress"
        role="progressbar"
        aria-label="Up next countdown"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(elapsed)}
      >
        <span className="vx-progress__fill" style={{ width: `${elapsed}%` }} />
      </span>
      <div className="vx-up-next__actions">
        <TvButton id="up-next-play" className="vx-btn vx-btn--primary vx-btn--lead" onActivate={onPlay}>
          <PlayIcon />
          Play now
        </TvButton>
        <TvButton id="up-next-cancel" className="vx-btn" onActivate={onCancel}>
          Cancel
        </TvButton>
      </div>
    </section>
  );
}
