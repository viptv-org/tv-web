import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A Home shelf (reference DeskHome / Main / TvHome): the heading (display
 * type, optional tertiary count), a "See all" / "Guide" link, and on desktop
 * a pair of round chevrons that page the row one screenful at a time with an
 * instant, pitch-quantized scroll. The pair stays mounted while the row
 * overflows — an exhausted direction dims instead of disappearing — and
 * unmounts when the whole row fits. Phones and touch screens swipe (CSS hides
 * the pair); the TV keeps its spatial navigation and renders the heading only.
 *
 * The section is a direct child of `.shelves` (TV reveal scrolling and the
 * compact-home switch find it with `closest("section")`); its row is the
 * `.cards` track the children render.
 */
export function Shelf({
  title,
  count,
  link,
  onLink,
  linkLabel,
  controls = true,
  className,
  children,
}: {
  title: ReactNode;
  /** Tertiary count after the heading ("Continue watching 6"). */
  count?: number;
  /** "See all" / "Guide". */
  link?: string;
  onLink?: () => void;
  /** Accessible name when the visible link text is not enough ("See all Continue watching"). */
  linkLabel?: string;
  /** Desktop chevrons and the link (responsive layout only). */
  controls?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const body = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLElement | null>(null);
  const [overflows, setOverflows] = useState(false);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const read = useCallback(() => {
    const node = scroller.current;
    if (!node) return;
    setOverflows(node.scrollWidth > node.clientWidth + 8);
    setCanLeft(node.scrollLeft > 8);
    setCanRight(node.scrollLeft + node.clientWidth < node.scrollWidth - 8);
  }, []);

  // The row's `.cards` track is replaced when a pending shelf loads (skeleton
  // → cards), so the listeners follow whichever track is mounted. Shelf
  // content loads asynchronously; bounds are re-read after every render so
  // the pair appears once cards overflow, without a ResizeObserver dependency.
  const detach = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!controls) return;
    const node = body.current?.querySelector<HTMLElement>(":scope > .cards") ?? null;
    if (node !== scroller.current) {
      detach.current?.();
      detach.current = null;
      scroller.current = node;
      if (node) {
        node.addEventListener("scroll", read, { passive: true });
        node.addEventListener("scrollend", read);
        detach.current = () => {
          node.removeEventListener("scroll", read);
          node.removeEventListener("scrollend", read);
        };
      }
    }
    read();
  });
  useEffect(() => {
    if (!controls) return;
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("resize", read);
      detach.current?.();
      detach.current = null;
      scroller.current = null;
    };
  }, [read, controls]);

  const scroll = (direction: 1 | -1) => {
    const node = scroller.current;
    if (!node) return;
    const slots = node.querySelectorAll<HTMLElement>(":scope > .vx-card-slot");
    const first = slots[0];
    const gap = parseFloat(getComputedStyle(node).columnGap) || 0;
    const pitch = slots[1] && first ? slots[1].offsetLeft - first.offsetLeft : (first?.offsetWidth ?? 256) + gap;
    const page = Math.max(Math.floor((node.clientWidth + gap) / pitch), 1) * pitch;
    node.scrollBy({ left: direction * page, behavior: "instant" });
  };

  return (
    <section className={className ? `vx-shelf ${className}` : "vx-shelf"}>
      <header className="vx-shelf__head">
        <span className="vx-shelf__heading">
          <h2 className="vx-shelf__title">{title}</h2>
          {count !== undefined && count > 0 && <span className="vx-shelf__count">{count}</span>}
        </span>
        {controls && (link || overflows) && (
          <span className="vx-shelf__tools">
            {link && (
              <button type="button" className="vx-link vx-link--plain vx-shelf__link" aria-label={linkLabel} onClick={onLink}>
                {link}
              </button>
            )}
            {overflows && (
              <span className="shelf-nav vx-shelf__nav">
                <button
                  type="button"
                  className="vx-shelf__chevron"
                  aria-label="Scroll shelf left"
                  disabled={!canLeft}
                  onClick={() => scroll(-1)}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="vx-shelf__chevron"
                  aria-label="Scroll shelf right"
                  disabled={!canRight}
                  onClick={() => scroll(1)}
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </span>
            )}
          </span>
        )}
      </header>
      <div className="vx-shelf__body" ref={body}>
        {children}
      </div>
    </section>
  );
}
