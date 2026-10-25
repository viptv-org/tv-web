import type { Channel, LivePage, LivePageRequest } from "./types";

export type PageDirection = "previous" | "next";
export const channelKey = (channel: Channel) =>
  JSON.stringify([channel.connection_id, channel.id]);
const cursor = (value: unknown): value is string =>
  typeof value === "string" &&
  /^(0|[1-9]\d{0,9})$/.test(value) &&
  Number(value) <= 4294967295;
const size = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 200;
const descriptor = (value: LivePageRequest | null) =>
  value === null ||
  (!!value &&
    cursor(value.cursor) &&
    size(value.limit) &&
    size(value.page_size));

/** Validate the shared wire envelope; no cursor is synthesized from row counts. */
export function validateChannelPage(
  page: LivePage,
  request: LivePageRequest,
): LivePage {
  const p = page.paging;
  if (
    !p ||
    !cursor(p.origin) ||
    !size(p.limit) ||
    !size(p.page_size) ||
    p.origin !== request.cursor ||
    p.limit !== request.limit ||
    p.page_size !== request.page_size ||
    !descriptor(p.previous) ||
    !descriptor(p.next) ||
    p.previous?.cursor === p.origin ||
    p.next?.cursor === p.origin ||
    !Array.isArray(page.channels) ||
    page.channels.length > p.limit ||
    new Set(page.channels.map(channelKey)).size !== page.channels.length
  ) {
    throw new Error(
      "The server returned incompatible channel paging. Try again after updating the server.",
    );
  }
  return page;
}

export function pageRequest(page: LivePage): LivePageRequest {
  return {
    cursor: page.paging.origin,
    limit: page.paging.limit,
    page_size: page.paging.page_size,
  };
}
export function edgeRequest(
  pages: readonly LivePage[],
  direction: PageDirection,
): LivePageRequest | undefined {
  return (
    (direction === "previous" ? pages[0] : pages.at(-1))?.paging[direction] ??
    undefined
  );
}
export function samePageRequest(
  a: LivePageRequest | undefined,
  b: LivePageRequest | undefined,
) {
  return (
    !!a &&
    !!b &&
    a.cursor === b.cursor &&
    a.limit === b.limit &&
    a.page_size === b.page_size
  );
}

/** A bounded render window. Producer ordering and adjacent descriptors survive eviction. */
export function joinChannelWindow(
  pages: readonly LivePage[],
  incoming: LivePage,
  direction: PageDirection,
): LivePage[] {
  if (pages.some((page) => page.snapshot_id !== incoming.snapshot_id))
    throw new Error("Channel snapshot changed.");
  if (!samePageRequest(edgeRequest(pages, direction), pageRequest(incoming)))
    throw new Error("Channel page no longer adjoins this window.");
  const result =
    direction === "next"
      ? [...pages, incoming].slice(-2)
      : [incoming, ...pages].slice(0, 2);
  const keys = result.flatMap((page) => page.channels.map(channelKey));
  if (new Set(keys).size !== keys.length)
    throw new Error("The server repeated channels across pages.");
  return result;
}
