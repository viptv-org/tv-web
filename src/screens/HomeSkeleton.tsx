import { Bookmark, Compass, House, Search, Settings, Tv } from "lucide-react";
import { RemoteControlIcon } from "../ui/DesktopTitlebar";
import { homeCatalogShape, CARD_SHAPES, type CardShape } from "../ui/cardShapes";

const NAV_ICONS = [House, Compass, Tv, Bookmark, Search, Settings];
// Continue Watching first, then the Home catalog pattern.
const SHELVES: CardShape[] = [CARD_SHAPES.continueWatching, homeCatalogShape(0), homeCatalogShape(1)];

/**
 * A shelf's card track in placeholder form: the loaded row's wrapper and
 * card classes, so a pending shelf has the loaded shelf's exact geometry.
 */
export function SkeletonShelfCards({ shape, count = 8 }: { shape: CardShape; count?: number }) {
  return (
    <div className="shelf-carousel" aria-hidden="true">
      <div className={`cards ${shape === "poster" ? "poster-grid" : ""}`}>
        {Array.from({ length: count }, (_, index) => (
          <div className={`responsive-card ${shape === "poster" ? "poster" : ""}`} key={index}>
            <div className={`media-card ${shape === "poster" ? "poster-card" : ""}`}>
              <div className="art-fallback skeleton-block" />
              <strong><span className="skeleton-line" style={{ width: "80%" }} /></strong>
              <small><span className="skeleton-line" style={{ width: "55%" }} /></small>
              <span className="card-caption">
                <span className="card-title"><span className="skeleton-line" style={{ width: "80%" }} /></span>
                <span className="card-meta"><span className="skeleton-line" style={{ width: "40%" }} /></span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The responsive shell's loading state: the navigation and Home built from
 * Home's own class names (hero art, title, synopsis, actions, shelves of
 * landscape and poster cards), so the stylesheet lays it out exactly where
 * the loaded page will be at every width. Replaces the startup cover while
 * the session restores and Home first loads. Inert and hidden from
 * assistive technology; the status label announces the load.
 */
export function HomeSkeleton({ phone }: { phone: boolean }) {
  return (
    <>
      <aside className="desktop-sidebar skeleton-shell" aria-hidden="true">
        <div className="sidebar-centered-group">
          <nav>
            {NAV_ICONS.map((Icon, index) => (
              <button type="button" tabIndex={-1} key={index} className={index === 0 ? "active" : ""}>
                <Icon className="nav-icon" size={24} strokeWidth={index === 0 ? 2.25 : 1.75} />
              </button>
            ))}
          </nav>
          {!phone && (
            <button type="button" tabIndex={-1} className="sidebar-cast">
              <RemoteControlIcon />
            </button>
          )}
        </div>
        {!phone && (
          <button type="button" tabIndex={-1} className="sidebar-profile">
            <span className="sidebar-profile-initials skeleton-block" />
          </button>
        )}
      </aside>
      <main className="home home-skeleton skeleton-shell" role="status" aria-label="Loading VIPTV">
        <div className="responsive-hero-art skeleton-block" aria-hidden="true" />
        <div className="hero" aria-hidden="true">
          {/* Hidden with the real eyebrow where the hero stacks. */}
          <small><span className="skeleton-line" style={{ width: 112 }} /></small>
          {/* Most catalog titles carry a title logo: hold its slot, not a text line. */}
          <h1 className="responsive-title"><span className="skeleton-block skeleton-logo" /></h1>
          <p>
            {["100%", "96%", "100%", "64%"].map((width, index) => (
              <span className="skeleton-line" style={{ width }} key={index} />
            ))}
          </p>
          <div className="hero-facts"><span className="skeleton-line" style={{ width: 132 }} /></div>
          <div className="actions">
            <button type="button" tabIndex={-1} data-focus-id="hero-details" className="skeleton-block" />
            <button type="button" tabIndex={-1} className="compact-action hero-save-btn skeleton-block" />
          </div>
        </div>
        <div className="shelves" aria-hidden="true">
          {SHELVES.map((shape, row) => (
            <section key={row}>
              <header className="shelf-heading">
                <h2><span className="skeleton-line" style={{ width: row === 0 ? 150 : 190 }} /></h2>
              </header>
              <SkeletonShelfCards shape={shape} />
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
