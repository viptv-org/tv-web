import { useEffect, useRef } from "react";

/** The nearest vertically scrolling ancestor; the app never scrolls the document itself. */
function scrollParent(node: HTMLElement): HTMLElement | null {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") return parent;
  }
  return null;
}

/**
 * Invisible end-of-list sentinel that requests the next page when it comes
 * within `margin` of its scroll container's visible edge — the replacement
 * for every "Load more" button. The observer is rooted at the nearest
 * scrolling ancestor (the responsive shell, or the TV result grid) so the
 * margin preloads before the user reaches the end. It is rebuilt whenever
 * `generation` changes (normally the loaded item count), so a page too short
 * to fill the viewport keeps loading until it overflows or the source is
 * exhausted. `disabled` holds it while a request is already in flight.
 */
export function AutoLoad({
  onLoad,
  disabled = false,
  generation,
  margin = 600,
}: {
  onLoad: () => void;
  disabled?: boolean;
  generation: number;
  margin?: number;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const load = useRef(onLoad);
  load.current = onLoad;
  useEffect(() => {
    const node = sentinel.current;
    if (!node || disabled || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load.current();
        }
      },
      { root: scrollParent(node), rootMargin: `${margin}px 0px` },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [disabled, generation, margin]);
  return <div ref={sentinel} className="auto-load" aria-hidden="true" />;
}
