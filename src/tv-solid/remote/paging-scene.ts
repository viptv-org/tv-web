import type { Accessor, Setter } from "solid-js";
import type { PageDirection } from "./channelWindow";

/** The one machine that decides what a list is loading and where the focus goes
 * when it lands.
 *
 * A page request outlives the key that caused it, so three things have to agree:
 * which request owns the list, which focus position was asked for, and what the
 * list finally contains. They used to be a scope, a generation counter, a
 * `pendingFocus` object and two channel flags kept side by side; they are one
 * object here so a stale answer can be recognised as stale instead of being
 * applied to a newer list.
 */
export function createPagingScene(options: {
  screen: Accessor<string>;
  zone: Accessor<string>;
  row: Accessor<number>;
  column: Accessor<number>;
  setColumn: Setter<number>;
  /** The abort controller of the screen that owns the list. */
  parent: () => AbortController;
  /** The length and the next cursor of whatever list currently has focus. */
  length: () => number;
  next: () => string | undefined;
  /** Home's shelf under the focused row, when Home owns the focus. */
  shelf: () => { next_cursor?: string | null } | undefined;
  more: () => Promise<void>;
  loadHomePage: () => Promise<void>;
  rememberHomeRow: () => void;
  loadGuides: () => void;
}) {
  let scope: AbortController | undefined;
  let generation = 0;
  let busy = false;
  let pending:
    | { screen: string; zone: string; row: number; from: number; index: number; generation: number }
    | undefined;
  let channelPending: { from: string; direction: PageDirection } | undefined;
  let channelRetry: PageDirection | undefined;

  /** The signal a request should carry: one per traversal, retired on restart. */
  function pageSignal(): AbortSignal {
    if (!scope || scope.signal.aborted) {
      const owner = options.parent();
      const request = new AbortController();
      const cancel = () => request.abort();
      owner.signal.addEventListener("abort", cancel, { once: true });
      request.signal.addEventListener("abort", () => owner.signal.removeEventListener("abort", cancel), { once: true });
      if (owner.signal.aborted) request.abort();
      scope = request;
    }
    return scope.signal;
  }

  /** A new query or group: nothing in flight may land in the new list. */
  function restart(): AbortSignal {
    scope?.abort();
    scope = undefined;
    generation++;
    busy = false;
    pending = undefined;
    channelPending = undefined;
    channelRetry = undefined;
    return pageSignal();
  }

  /** Ask for an index that may be past the end of a short page. */
  function moveToItem(index: number, length: number, nextCursor?: string | null) {
    if (index >= length && nextCursor) {
      pending = {
        screen: options.screen(), zone: options.zone(), row: options.row(),
        from: options.column(), index, generation,
      };
    } else {
      options.setColumn(Math.max(0, Math.min(length - 1, index)));
    }
  }

  /** The page landed: either the focus can move, or the next page is needed. */
  function settle() {
    if (!pending) return;
    if (pending.generation !== generation || pending.screen !== options.screen() ||
      pending.zone !== options.zone() || pending.row !== options.row() || pending.from !== options.column()) return;
    const shelf = options.screen() === "home" ? options.shelf() : undefined;
    const length = options.length();
    const next = options.next();
    const asked = pending;
    if (asked.index < length || !next) {
      pending = undefined;
      options.setColumn(Math.max(0, Math.min(length - 1, asked.index)));
      options.rememberHomeRow();
      if (options.screen() === "live") options.loadGuides();
    } else if (!busy) {
      void (shelf ? options.loadHomePage() : options.more());
    }
  }

  /** A new profile: no traversal, no pending focus, no retry. */
  function reset() {
    scope?.abort(); scope = undefined; generation++; busy = false; pending = undefined;
    channelPending = undefined; channelRetry = undefined;
  }
  return {
    reset,
    pageSignal, restart, moveToItem, settle,
    generation: () => generation,
    busy: () => busy,
    setBusy: (value: boolean) => { busy = value; },
    cancelFocus: () => { pending = undefined; },
    channelPending: {
      current: () => channelPending,
      set: (value: { from: string; direction: PageDirection } | undefined) => { channelPending = value; },
    },
    channelRetry: {
      current: () => channelRetry,
      set: (value: PageDirection | undefined) => { channelRetry = value; },
    },
  };
}
