/*
 * Design-system icons that lucide-react does not draw the way the design does.
 * Everything else uses lucide-react directly; primitives size any `> svg` child
 * (buttons P 20 / D 18 / T 28), so icons need no size props.
 */
import type { SVGProps } from "react";

/** The Play icon is a filled triangle (components.md §1). */
export function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" {...props}>
      <path d="M7 4.5v15a1 1 0 0 0 1.52.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z" fill="currentColor" />
    </svg>
  );
}
