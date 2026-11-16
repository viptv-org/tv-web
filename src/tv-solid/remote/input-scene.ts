import type { Accessor } from "solid-js";
import { liveKeepsToday, liveNoSourceActions } from "./liveEmpty";
import type { Overlay } from "./app-types";
import type { LiveScene } from "./live-scene";
import type { PagingScene } from "./paging-scene";

/** The D-pad: which controller owns the press, in one order.
 *
 * Every screen with its own focus model registers one controller, and `move`
 * decides between them by the pair (screen, zone) — never by guessing from the
 * zone alone, because `content` means four different things on four screens.
 * The navigation bar is the exception: it is a zone on every screen, so it is
 * resolved here rather than in a controller.
 */
export function createMoveScene(options: {
  screen: Accessor<string>;
  zone: Accessor<string>;
  setZone: (value: string) => void;
  setColumn: (value: number | ((value: number) => number)) => void;
  overlay: Accessor<Overlay | undefined>;
  overlayClosing: Accessor<boolean>;
  openingSource: Accessor<unknown>;
  error: Accessor<string>;
  loading: Accessor<boolean>;
  countdown: { cancel: () => void };
  paging: Pick<PagingScene, "channelPending" | "cancelFocus">;
  liveScene: Pick<LiveScene, "focusSpread"> & { spread: Accessor<string>; viewer: Accessor<unknown>; recovery: Accessor<unknown[]> };
  restartHeroCycling: () => void;
  revealEndedControls: () => boolean;
  rememberContentFocus: () => void;
  rememberDetailFocus: () => void;
  setPairingFocused: (value: boolean) => void;
  navs: Accessor<readonly { id: string }[]>;
  contentFocus: { resolve: (row: never) => number };
  contentRow: () => never;
  libraryControlCount: () => number;
  navigateOverlay: (overlay: Overlay, dx: number, dy: number) => void;
  playerNavigation: { move: (dx: number, dy: number) => void };
  navigateProfiles: (dx: number, dy: number) => void;
  navigateSettings: (dx: number, dy: number) => void;
  navigateDetail: (dx: number, dy: number) => boolean;
  navigateCalendar: (dx: number, dy: number) => void;
  navigateHero: (dx: number, dy: number, screen: string) => void;
  navigateHomeRows: (dx: number, dy: number) => void;
  navigateSearch: (dx: number, dy: number) => boolean;
  navigateLive: (dx: number, dy: number) => boolean;
  navigateContent: (dx: number, dy: number) => void;
}) {
  function move(dx: number, dy: number): void {
    options.rememberContentFocus();
    options.rememberDetailFocus();
    options.countdown.cancel();
    options.paging.channelPending.set(undefined);
    if (options.screen() === "pairing") { options.setPairingFocused(true); return; }
    if (options.screen() === "signed-in") {
      // The confirmation exposes a single focusable acknowledgement; Left and
      // Right still move the reported focus for remote parity without acting.
      if (dx) options.setColumn(i => Math.max(0, Math.min(1, i + dx)));
      return;
    }
    if (options.overlayClosing() || options.error()) return;
    // The picker is terminal while the chosen stream opens.
    if (options.openingSource()) return;
    if (options.revealEndedControls()) return;
    options.paging.cancelFocus();
    options.restartHeroCycling();
    if (options.loading() && options.screen() === "welcome") return;
    if (options.overlay()) { options.navigateOverlay(options.overlay()!, dx, dy); return; }
    if (options.screen() === "player") { options.playerNavigation.move(dx, dy); return; }
    if (options.screen() === "profiles") { options.navigateProfiles(dx, dy); return; }
    if (options.zone() === "nav") {
      options.setColumn(i => Math.max(0, Math.min(options.navs().length - 1, i + dx)));
      if (dy > 0) {
        // The empty and failed Live forms own the whole page: Down enters them
        // only when there is an action to land on (LIVE-EMPTY-01, -05, -14).
        if (options.screen() === "live" && !liveKeepsToday(options.liveScene.spread() as never)) {
          const actions = options.liveScene.spread() === "no-source"
            ? liveNoSourceActions(options.liveScene.viewer() as never)
            : options.liveScene.recovery();
          if (actions.length) { options.setZone("live-empty"); options.setColumn(0); }
          return;
        }
        if (options.screen() === "live") { options.liveScene.focusSpread(); return; }
        options.setColumn(["movie", "series", "anime"].includes(options.screen())
          ? options.contentFocus.resolve(options.contentRow() as never)
          : 0);
        options.setZone(
          options.screen() === "home" || options.screen() === "detail" ? "hero"
            : options.screen() === "settings" ? "settings-nav"
              : options.screen() === "calendar" ? "calendar-days"
                : options.screen() === "search" ? "keyboard"
                  : options.screen() === "library" && options.libraryControlCount() ? "library-controls"
                    : "content",
        );
      }
      return;
    }
    if (options.screen() === "settings") { options.navigateSettings(dx, dy); return; }
    if (options.screen() === "detail" && options.navigateDetail(dx, dy)) return;
    if (options.screen() === "calendar") { options.navigateCalendar(dx, dy); return; }
    if (options.zone() === "hero") { options.navigateHero(dx, dy, options.screen()); return; }
    if (options.screen() === "home" && options.zone() === "rows") { options.navigateHomeRows(dx, dy); return; }
    if (options.screen() === "search" && options.navigateSearch(dx, dy)) return;
    if (options.screen() === "live" && options.navigateLive(dx, dy)) return;
    options.navigateContent(dx, dy);
  }
  return { move };
}

/** The on-screen keyboard and the hardware text path.
 *
 * One rule: the same key index means the same thing whether the keyboard is
 * drawn over a text prompt or under the search field, so the two paths share
 * `completeTextInput` and differ only in where the text goes.
 */
export function createKeyboardScene(options: {
  overlay: Accessor<Overlay | undefined>;
  text: Accessor<string>;
  setText: (value: string | ((value: string) => string)) => void;
  key: Accessor<number>;
  search: Accessor<string>;
  updateSearch: (value: string, immediate?: boolean) => void;
  keyboardCharacters: Accessor<readonly string[]>;
  setKeyboardUpper: (value: (value: boolean) => boolean) => void;
  setKeyboardSymbols: (value: (value: boolean) => boolean) => void;
  setZone: (value: string) => void;
  setColumn: (value: number) => void;
  run: (work: () => Promise<void>) => Promise<void>;
  dismissOverlay: () => void;
}) {
  function completeTextInput(isOverlay: boolean): void {
    const modal = options.overlay();
    if (isOverlay && modal?.kind === "text") void options.run(() => modal.submit(options.text()));
    else { options.setZone("content"); options.setColumn(0); }
  }

  function keyboardActivate(isOverlay: boolean): void {
    const index = options.key();
    const modal = options.overlay();
    if (isOverlay && modal?.kind === "text" && modal.numeric) {
      if (index === 11) void options.run(() => modal.submit(options.text()));
      else if (index === 9) options.setText(value => value.slice(0, -1));
      else options.setText(value => (value + (index === 10 ? "0" : String(index + 1))).slice(0, 8));
      return;
    }
    if (index === 42) { options.setKeyboardUpper(value => !value); return; }
    if (index === 45) { options.setKeyboardSymbols(value => !value); return; }
    if (index === 46) { completeTextInput(isOverlay); return; }
    if (index === 47) {
      if (isOverlay) options.dismissOverlay();
      else options.updateSearch("");
      return;
    }
    const value = isOverlay ? options.text() : options.search();
    const next =
      index < 42 ? value + options.keyboardCharacters()[index]
        : index === 43 ? value + " "
          : index === 44 ? Array.from(value).slice(0, -1).join("")
            : value;
    if (isOverlay) options.setText(next.slice(0, 2048));
    else options.updateSearch(next);
  }

  return { completeTextInput, keyboardActivate };
}
