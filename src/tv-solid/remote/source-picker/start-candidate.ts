import type { RemotePlayback } from "../playback";
import type { Source, TitleAction } from "../types";

export async function startSourceCandidate(options: {
  player: Pick<RemotePlayback, "replaceSource" | "start" | "stop" | "hasPresentedFrame" | "leaseId">;
  source: Source; action: TitleAction; direct: boolean; manual: boolean; replacing: boolean; position: () => number;
  current: () => boolean; notify: (message: string) => void;
}) {
  const {player, source, action: current, direct, manual, notify} = options;
  if (options.replacing) await player.replaceSource(source);
  else if (direct) {
    try {
      await player.start(
        current.card,
        source,
        current.resume || options.position() > 0,
        options.position(),
        {},
        undefined,
        true,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        throw error;
      await player.stop().catch(() => {});
      notify("Direct play didn't start; trying the gateway.");
      await player.start(
        current.card,
        source,
        current.resume || options.position() > 0,
        options.position(),
      );
    }
  } else
    await player.start(
      current.card,
      source,
      current.resume || options.position() > 0,
      options.position(),
    );
  const frameDeadline = Date.now() + 20000;
  while (!manual && !player.hasPresentedFrame && player.leaseId && options.current() && Date.now() < frameDeadline)
    await new Promise(resolve => setTimeout(resolve, 25));
  if (!options.current()) throw new DOMException("Playback cancelled", "AbortError");
  if (!manual && !player.hasPresentedFrame) throw new Error("This source didn’t present a video frame.");
}
