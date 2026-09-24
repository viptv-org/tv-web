/** Opt-in browser focus marker for remote timing and preview assertions. */
import { activeElement } from "@solidtv/solid";
const enabled = new URLSearchParams(location.search).get("focusdebug") === "1";
export function noteFocus(view: string, index: number) {
  if (!enabled) return;
  (
    window as Window & {
      __viptvFocus?: { view: string; index: number; at: number; nativeFocus: boolean };
    }
  ).__viptvFocus = {
    view,
    index,
    at: performance.now(),
    nativeFocus: activeElement() !== undefined,
  };
}

export function noteUpNext(open: boolean, left = 0) {
  if (!enabled) return;
  (window as Window & {__viptvUpNext?:{open:boolean;left:number}}).__viptvUpNext={open,left};
}

/** Test-only identity marker; never includes source URLs or credentials. */
export function noteSourceIntent(
  itemId: string,
  sourceId: string,
  position: number,
  resume: boolean,
) {
  if (!enabled) return;
  (
    window as Window & {
      __viptvSourceIntent?: {
        itemId: string;
        sourceId: string;
        position: number;
        resume: boolean;
      };
    }
  ).__viptvSourceIntent = {
    itemId,
    sourceId,
    position,
    resume,
  };
}

/** Test-only filter state for D-pad acceptance; no source URLs or tokens. */
export function noteSourceFilter(
  quality: string,
  provider: string,
  rows: number,
) {
  if (!enabled) return;
  (
    window as Window & {
      __viptvSourceFilter?: { quality: string; provider: string; rows: number };
    }
  ).__viptvSourceFilter = {
    quality,
    provider,
    rows,
  };
}

/** Test-only list window for checking long D-pad navigation. */
export function noteSourceWindow(index: number, start: number) {
  if (!enabled) return;
  (
    window as Window & {
      __viptvSourceWindow?: { index: number; start: number };
    }
  ).__viptvSourceWindow = { index, start };
}

/** Test-only Discover grid window; contains no account or media identifiers. */
export function noteDiscoverWindow(
  index: number,
  start: number,
  count: number,
) {
  if (!enabled) return;
  (
    window as Window & {
      __viptvDiscoverWindow?: { index: number; start: number; count: number };
    }
  ).__viptvDiscoverWindow = { index, start, count };
}

export function noteDiscoverFilter(open: boolean) {
  if (!enabled) return;
  (
    window as Window & { __viptvDiscoverFilter?: { open: boolean } }
  ).__viptvDiscoverFilter = { open };
}

export function noteLibraryState(mode: string, count: number) {
  if (!enabled) return;
  (
    window as Window & { __viptvLibrary?: { mode: string; count: number } }
  ).__viptvLibrary = { mode, count };
}

export function noteTitleMenu(open: boolean, kind: string) {
  if (!enabled) return;
  (
    window as Window & { __viptvTitleMenu?: { open: boolean; kind: string } }
  ).__viptvTitleMenu = { open, kind };
}

export function noteSearchState(
  query: string,
  count: number,
  busy: boolean,
  partial: boolean,
  done = false,
) {
  if (!enabled) return;
  (
    window as Window & {
      __viptvSearch?: {
        query: string;
        count: number;
        busy: boolean;
        partial: boolean;
        done: boolean;
      };
    }
  ).__viptvSearch = {
    query,
    count,
    busy,
    partial,
    done,
  };
}

export function noteLiveState(
  row: number,
  cell: number | null,
  channels: number,
  programs: number,
  filter: string,
  windowStart: number,
  nowX: number,
) {
  if (!enabled) return;
  (
    window as Window & {
      __viptvLive?: {
        row: number;
        cell: number | null;
        channels: number;
        programs: number;
        filter: string;
        windowStart: number;
        nowX: number;
      };
    }
  ).__viptvLive = {
    row,
    cell,
    channels,
    programs,
    filter,
    windowStart,
    nowX,
  };
}

/** Test-only player state, without session or delivery URLs. */
export function notePlayerState(state: string, position: number) {
  if (!enabled) return;
  (
    window as Window & { __viptvPlayer?: { state: string; position: number } }
  ).__viptvPlayer = { state, position };
}

/** Test-only track-panel lifecycle marker. */
export function noteTrackPanel(open: boolean, kind: string) {
  if (!enabled) return;
  (
    window as Window & { __viptvTrackPanel?: { open: boolean; kind: string } }
  ).__viptvTrackPanel = { open, kind };
}

/** Test-only track choice, without media URLs or session data. */
export function noteTrackSelection(
  kind: string,
  id: string,
  available: boolean,
) {
  if (!enabled) return;
  (
    window as Window & {
      __viptvTrackSelection?: { kind: string; id: string; available: boolean };
    }
  ).__viptvTrackSelection = {
    kind,
    id,
    available,
  };
}
