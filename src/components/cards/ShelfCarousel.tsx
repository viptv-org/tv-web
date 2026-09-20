import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Desktop carousel affordance for a Home shelf: a compact backgroundless
 * chevron pair pinned to the row's bottom-right flips one card-page at a
 * time with an instant, pitch-quantized scroll. The pair stays mounted
 * while the row overflows — an exhausted direction greys out instead of
 * disappearing — and unmounts only when the whole row fits. The TV layout
 * keeps its spatial navigation and never renders this.
 */
export function ShelfCarousel({ children }: { children: ReactNode }) {
  const wrapper = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const node = wrapper.current
      ? Array.from(wrapper.current.children).find(
          (child) => child instanceof HTMLElement && child.classList.contains("cards"),
        )
      : null;
    scroller.current = (node as HTMLElement) ?? null;
    read();
    const target = scroller.current;
    if (!target) return;
    target.addEventListener("scroll", read, { passive: true });
    target.addEventListener("scrollend", read);
    window.addEventListener("resize", read);
    return () => {
      target.removeEventListener("scroll", read);
      target.removeEventListener("scrollend", read);
      window.removeEventListener("resize", read);
    };
  }, [read]);

  // Shelf content loads asynchronously; re-read bounds after every render so
  // the pair appears once cards overflow, without a ResizeObserver dependency.
  useEffect(() => { read(); });

  const scroll = (direction: 1 | -1) => {
    const node = scroller.current;
    if (!node) return;
    const card = node.querySelector<HTMLElement>(".responsive-card, .media-card");
    const pitch = (card?.offsetWidth ?? 256) + 24;
    const page = Math.max(Math.floor(node.clientWidth / pitch), 1) * pitch;
    node.scrollBy({ left: direction * page, behavior: "instant" });
  };

  return (
    <div className="shelf-carousel" ref={wrapper}>
      {children}
      {overflows && (
        <div className="shelf-nav">
          <button
            type="button"
            className="shelf-nav-btn"
            aria-label="Scroll shelf left"
            disabled={!canLeft}
            onClick={() => scroll(-1)}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="shelf-nav-btn"
            aria-label="Scroll shelf right"
            disabled={!canRight}
            onClick={() => scroll(1)}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
