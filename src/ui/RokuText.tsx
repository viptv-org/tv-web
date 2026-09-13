import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

/** Roku ScrollingLabel: a focused overflowing line travels at a fixed pixel rate. */
export function RokuText({
  children,
  speed = 48,
}: {
  children: string;
  speed?: number;
}) {
  const frame = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const measure = () =>
      setDistance(
        Math.max(
          0,
          (element.firstElementChild?.scrollWidth ?? 0) - element.clientWidth,
        ),
      );
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children]);
  return (
    <span
      ref={frame}
      className={`roku-text ${distance ? "overflows" : ""}`}
      style={
        {
          "--marquee-distance": `${-distance}px`,
          "--marquee-duration": `${Math.max(1, distance / speed)}s`,
        } as CSSProperties
      }
    >
      <span>{children}</span>
    </span>
  );
}
