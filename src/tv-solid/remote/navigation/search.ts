import type { Accessor, Setter } from "solid-js";
import type { NavigationFocus } from "./focus";

interface SearchRegion {
  count: Accessor<number>; error: Accessor<string>;
  remembered: Accessor<number>; remember: (index: number) => void;
  move: (step: number) => void;
}
export function createSearchNavigation(options: {
  focus: NavigationFocus;
  keyboard: {index: Accessor<number>; set: Setter<number>};
  navIndex: Accessor<number>;
  media: SearchRegion & {needsRetry: Accessor<boolean>; available: Accessor<boolean>; moveRow: (step: number) => boolean};
  channels: SearchRegion;
}) {
  const {zone, column, setZone, setColumn} = options.focus;
  const {index: key, set: setKey} = options.keyboard;
  return (dx: number, dy: number) => {
    if (zone() === "keyboard") {
      const index = key(),
        col = index < 2 ? index * 3 : (index - 2) % 6;
      if (dy < 0 && index < 2) {
        setZone("nav");
        setColumn(options.navIndex());
      } else if (
        dx > 0 &&
        (index === 1 || col === 5) &&
        (options.media.available() ||
          options.channels.count() ||
          options.media.error() ||
          options.channels.error())
      ) {
        setZone(
          options.media.available()
            ? options.media.error() && !options.media.count() ? "search-retry" : "content"
            : options.channels.count()
              ? "search-channels"
              : options.media.error()
                ? "search-retry"
                : "search-channel-retry",
        );
        const region = zone() === "content" ? options.media : zone() === "search-channels" ? options.channels : undefined;
        setColumn(region ? Math.min(region.remembered(), Math.max(0, region.count() - 1)) : 0);
      } else if (index < 2) {
        if (dy > 0) setKey(2 + index * 3);
        else if (dx) setKey(Math.max(0, Math.min(1, index + dx)));
      } else if (dy < 0 && index < 8) setKey(col < 3 ? 0 : 1);
      else if (dy) setKey(Math.max(2, Math.min(37, index + dy * 6)));
      else if (dx && col + dx >= 0 && col + dx < 6) setKey(index + dx);
      return true;
    }
    if (
      ["search-retry", "search-channel-retry"].includes(zone())
    ) {
      if (dx < 0) setZone("keyboard");
      if (dy < 0) {
        if (zone() === "search-retry" && options.media.moveRow(-1)) return true;
        if (zone() === "search-channel-retry" && options.media.error())
          setZone("search-retry");
        else {
          setZone("nav");
          setColumn(options.navIndex());
        }
      }
      if (dy > 0) {
        if (zone() === "search-retry" && !options.media.count() && options.media.moveRow(1)) return true;
        if (zone() === "search-retry" && options.media.count()) {
          setZone("content");
          setColumn(Math.min(options.media.remembered(), options.media.count() - 1));
        } else if (options.channels.count()) {
          setZone("search-channels");
          setColumn(
            Math.min(options.channels.remembered(), options.channels.count() - 1),
          );
        } else if (options.channels.error()) setZone("search-channel-retry");
      }
      return true;
    }
    if (zone() === "search-channels") {
      options.channels.remember(column());
      if (dy < 0) {
        setZone(
          options.channels.error()
            ? "search-channel-retry"
            : options.media.available()
              ? options.media.error() && !options.media.count() ? "search-retry" : "content"
              : options.media.error()
                ? "search-retry"
                : "keyboard",
        );
        setColumn(
          Math.min(options.media.remembered(), Math.max(0, options.media.count() - 1)),
        );
      } else if (dx) options.channels.move(dx);
      return true;
    }
    if (zone() === "content") {
      options.media.remember(column());
      if (dy > 0) {
        if (options.media.moveRow(1)) return true;
        if (options.channels.count()) {
          setZone("search-channels");
          setColumn(
            Math.min(options.channels.remembered(), options.channels.count() - 1),
          );
        } else if (options.channels.error()) setZone("search-channel-retry");
      } else if (dy < 0) {
        if (options.media.needsRetry()) {
          setZone("search-retry");
          return true;
        }
        if (options.media.moveRow(-1)) return true;
        setZone("nav");
        setColumn(options.navIndex());
      } else if (dx < 0 && column() === 0) setZone("keyboard");
      else {
        options.media.move(column() + dx);
        options.media.remember(column());
      }
      return true;
    }

    return false;
  };
}
