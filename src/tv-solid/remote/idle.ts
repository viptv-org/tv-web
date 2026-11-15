/** Run work when the browser has nothing better to do.
 *
 * Warming the playback engine is background work: it must not delay the frame
 * the user is looking at, and it must never sit between a press and the first
 * frame. The browser's idle callback is the answer to "when is there time".
 */
export function whenIdle(work: () => void): void {
  const scheduler = (
    globalThis as {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof scheduler === "function") {
    // The timeout is a ceiling, not a delay: it only matters on a device that
    // never reports itself idle.
    scheduler(() => work(), { timeout: 1000 });
    return;
  }
  setTimeout(work, 0);
}
