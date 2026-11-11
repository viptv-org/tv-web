import type { Accessor, Setter } from "solid-js";
import type { Overlay, Screen } from "../app-types";

export function createKeyboardInput(options: {
  screen: Accessor<Screen>; overlay: Accessor<Overlay | undefined>; zone: Accessor<string>;
  cancelCountdown: () => void; hideControls: () => void; pair: () => Promise<void>; stop: () => Promise<void>;
  media: (event: KeyboardEvent) => boolean; text: Setter<string>; query: Accessor<string>; search: (value: string) => void;
  fail: (error: unknown) => void;
}) {
  const {screen, overlay, zone, hideControls, pair: beginPairing, stop: leavePlayer, text: setText, query: search, search: updateSearch, fail} = options;
  return (event: KeyboardEvent) => {
    options.cancelCountdown();
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (screen() === "player" && !overlay()) hideControls();
    if (
      screen() === "welcome" &&
      (event.key === "Enter" || event.keyCode === 13)
    ) {
      event.preventDefault();
      void beginPairing();
      return;
    }
    if (
      screen() === "player" &&
      (event.key === "MediaStop" || event.keyCode === 413)
    ) {
      event.preventDefault();
      if (!event.repeat) void leavePlayer().catch(fail);
      return;
    }
    if (screen() === "player" && !overlay() && options.media(event)) return;
    if (
      (overlay()?.kind === "text" ||
        (screen() === "search" && zone() === "keyboard")) &&
      event.key.length === 1
    ) {
      event.preventDefault();
      if (overlay()?.kind === "text")
        setText((value) => (value + event.key).slice(0, 2048));
      else updateSearch(search() + event.key);
    }
  };
}
