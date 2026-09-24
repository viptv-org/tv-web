import { Skel, SkeletonContinue, SkeletonTile } from "../ui/primitives/Feedback";
import type { CardShape } from "../ui/cardShapes";

/*
 * Home loading states (reference PhStates / DeskStates "Home skeleton"):
 * the real layout's shapes on the page ground, with the shimmer of the
 * skeleton primitives (src/styles/primitives/feedback.css). Geometry lives in
 * src/styles/screens/home.css (.vx-home-skel*). TV has no skeletons: it shows
 * the "Starting VIPTV…" cover, then real content.
 */

/**
 * A pending shelf's track in placeholder form: tiles of the loaded row's
 * kind (poster or still) in the same `.cards` track, so the loaded shelf
 * lands where its placeholder was.
 */
export function SkeletonShelfCards({ shape, count = 8 }: { shape: CardShape; count?: number }) {
  return (
    <div className="cards vx-cards vx-cards--skeleton" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonTile kind={shape === "poster" ? "poster" : "still"} key={index} />
      ))}
    </div>
  );
}

const DESK_SHELVES = [
  { kind: "still" as const, count: 8 },
  { kind: "live" as const, count: 8 },
];

/**
 * The responsive shell's loading state, drawn in Home's own geometry: phone
 * header + featured card + continue-card rows; desktop hero (text column and
 * art) + a row of stills and a row of live tiles. Replaces the startup cover
 * while the session restores and Home first loads. Inert and hidden from
 * assistive technology; the status label announces the load.
 */
export function HomeSkeleton({ phone }: { phone: boolean }) {
  return (
    <main className="home home-skeleton vx-home vx-home-skel skeleton-shell" role="status" aria-label="Loading VIPTV">
      {phone ? (
        <>
          <header className="vx-home__header" aria-hidden="true">
            <span className="vx-home__wordmark">VIPTV</span>
            <Skel className="vx-skel--round vx-home-skel__avatar" />
          </header>
          <div className="vx-home-skel__featured vx-skel-surface" aria-hidden="true">
            <Skel className="vx-home-skel__featured-art" />
            <div className="vx-home-skel__featured-body">
              <Skel className="vx-home-skel__logo" />
              <Skel className="vx-skel--line vx-home-skel__meta" />
              <span className="vx-skel-lines">
                <Skel className="vx-skel--line vx-home-skel__text vx-home-skel__text--1" />
                <Skel className="vx-skel--line vx-home-skel__text vx-home-skel__text--2" />
              </span>
              <span className="vx-skel-actions vx-home-skel__actions">
                <Skel className="vx-skel--grow" />
                <Skel className="vx-skel--round" />
              </span>
            </div>
          </div>
          {[0, 1, 2].map((row) => (
            <section className="vx-home-skel__shelf" aria-hidden="true" key={row}>
              <Skel className={`vx-home-skel__heading vx-home-skel__heading--${row}`} />
              <div className="vx-home-skel__row">
                <SkeletonContinue />
                <SkeletonContinue />
              </div>
            </section>
          ))}
        </>
      ) : (
        <>
          <section className="vx-home__hero" aria-hidden="true">
            <div className="vx-home__hero-grid">
              <div className="vx-home__copy">
                <Skel className="vx-skel--line vx-home-skel__eyebrow" />
                <Skel className="vx-home-skel__logo" />
                <Skel className="vx-skel--line vx-skel--line-md vx-home-skel__meta" />
                <span className="vx-skel-lines vx-home-skel__lines">
                  <Skel className="vx-skel--line vx-home-skel__text vx-home-skel__text--1" />
                  <Skel className="vx-skel--line vx-home-skel__text vx-home-skel__text--2" />
                  <Skel className="vx-skel--line vx-home-skel__text vx-home-skel__text--3" />
                </span>
                <span className="vx-skel-actions vx-home-skel__actions">
                  <Skel className="vx-skel--pill" />
                  <Skel className="vx-skel--pill" />
                  <Skel className="vx-skel--round" />
                </span>
              </div>
              <Skel className="vx-home-skel__art" />
            </div>
          </section>
          {DESK_SHELVES.map((shelf, row) => (
            <section className="vx-home-skel__shelf" aria-hidden="true" key={row}>
              <Skel className="vx-home-skel__heading" />
              <div className="vx-home-skel__row">
                {Array.from({ length: shelf.count }, (_, index) => (
                  <span className={`vx-skel-tile vx-skel-tile--still vx-home-skel__tile vx-home-skel__tile--${shelf.kind}`} key={index}>
                    <Skel className="vx-skel-tile__art" />
                    <span className="vx-skel-lines">
                      <Skel className="vx-skel--line vx-home-skel__caption" />
                      <Skel className="vx-skel--line vx-home-skel__caption vx-home-skel__caption--short" />
                    </span>
                  </span>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
