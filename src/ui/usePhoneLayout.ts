import { useEffect, useState } from "react";

/** The responsive phone breakpoint, mirrored by the `max-width: 599px` CSS rules. */
export const PHONE_QUERY = "(max-width: 599px)";

const matches = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(PHONE_QUERY).matches
    : false;

/**
 * True while the responsive shell renders its phone arrangement. Phone-only
 * components (the Live TV channel list, Discover chips, the Settings list)
 * render from this instead of hiding a second tree with CSS. The TV layout
 * never switches, whatever the window width.
 */
export function usePhoneLayout(responsive: boolean): boolean {
  const [phone, setPhone] = useState(() => responsive && matches());
  useEffect(() => {
    if (!responsive || typeof window.matchMedia !== "function") {
      setPhone(false);
      return;
    }
    const query = window.matchMedia(PHONE_QUERY);
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [responsive]);
  return phone;
}
