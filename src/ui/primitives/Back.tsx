/*
 * The one Back control (src/styles/primitives/back.css).
 *
 * components.md §7 fixes the affordance: "Phone headers: a wordmark + avatar
 * (Home), a screen title, back + sub-page title, or a glass back button over
 * art", and "Desktop title bar (Tauri): 40 tall + hairline. It holds the
 * wordmark, Back / Forward ...". §10 draws the player's header as "back, title,
 * S·E". account-and-profile-settings.md puts that Back in the phone surface's
 * 48 header row as "44 back button" and calls it "a sub-page's back arrow".
 *
 * So there is one control: a real <button>, the ChevronLeft glyph, the name
 * "Back" and a 44 minimum target, in the leading slot of the surface it belongs
 * to. Only the slot differs, and `placement` is the prop that says which:
 *   page      the page header row, beside the sub-page title (P, and a D page
 *             that has a header at all)
 *   over-art  the glass disc over the title page's art (P title)
 *   player    the player overlay header, top-left ("back, title, S·E")
 *   titlebar  the desktop app's Back rail in its 40 tall title bar
 *
 * TV has no on-screen Back: the remote's Back key is the control there, so
 * nothing in src/tv-solid uses this. An overlay's × is a dismissal, not a page
 * Back (§8 "Close"), so the source sheet keeps .vx-close.
 *
 * The caller owns the destination: navigation, stopping playback and returning
 * focus stay with the surface that owns them.
 */
import { ChevronLeft } from "lucide-react";
import type { ButtonHTMLAttributes, MouseEvent, SyntheticEvent } from "react";
import { join } from "./classNames";

/** Where the contract puts Back. Never a per-page style choice. */
export type BackPlacement = "page" | "over-art" | "player" | "titlebar";

export type BackControlProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "children" | "type" | "aria-label" | "onClick"
> & {
  /** The slot the contract names for this surface. */
  placement?: BackPlacement;
  /** The accessible name; a Settings sub-page says "Back to Settings" (copy.md §Settings). */
  label?: string;
  /** data-focus-id, so existing remote and e2e hooks ("player-back") keep working. */
  id?: string;
  onActivate: () => void;
  className?: string;
};

const stop = (event: SyntheticEvent) => event.stopPropagation();

/** Title-bar buttons never drag the window and never keep focus from a press. */
const titlebarPointer = {
  onMouseDown: (event: MouseEvent<HTMLButtonElement>) => {
    stop(event);
    event.currentTarget.blur();
  },
  onPointerDown: stop,
};

export function BackControl({
  placement = "page",
  label = "Back",
  id,
  onActivate,
  className,
  ...rest
}: BackControlProps) {
  const titlebar = placement === "titlebar";
  return (
    <button
      {...rest}
      {...(titlebar ? titlebarPointer : undefined)}
      type="button"
      data-focus-id={id}
      tabIndex={titlebar ? -1 : rest.tabIndex}
      className={join("vx-back", `vx-back--${placement}`, className)}
      aria-label={label}
      onClick={(event) => {
        if (titlebar) {
          stop(event);
          event.currentTarget.blur();
        }
        onActivate();
      }}
    >
      <ChevronLeft aria-hidden="true" strokeWidth={2.2} />
    </button>
  );
}