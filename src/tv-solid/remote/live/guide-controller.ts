import { batch, type Accessor, type Setter } from "solid-js";
import type { Channel, Guide, Program } from "../types";

/** Bounded Live guide requests and cache retention, independent of page routing. */
export function createLiveGuideController(options: {
  scope: Accessor<AbortController>;
  channels: Accessor<Channel[]>;
  channelIndex: Accessor<number>;
  rowStart: Accessor<number>;
  programs: {current: Accessor<Record<string, Program[]>>; set: Setter<Record<string, Program[]>>};
  info: {set: Setter<Record<string, Guide["view"]>>};
  selection: {current: Accessor<Program | undefined>; set: Setter<number>};
  request: (channel: string, signal: AbortSignal) => Promise<Guide>;
  notify: (message: string) => void;
}) {
  const {channels, channelIndex: liveChannelIndex, rowStart: guideRowStart, notify} = options;
  const {current: programs, set: setPrograms} = options.programs;
  const setGuideInfo = options.info.set;
  const {current: currentProgram, set: setProgramIndex} = options.selection;
  const guideFlights = new Map<string, AbortController>();
  const guideTimes = new Map<string, number>();
  let guideGeneration = 0;
  function retireLiveGuides() {
    guideGeneration++;
    for (const flight of guideFlights.values()) flight.abort();
    guideFlights.clear();
    guideTimes.clear();
    setPrograms({});
    setGuideInfo({});
    setProgramIndex(0);
  }
  const guideKeep = () =>
    new Set(
      channels()
        .slice(Math.max(0, liveChannelIndex() - 10), liveChannelIndex() + 15)
        .map((channel) => channel.id),
    );
  function trimGuides() {
    const keep = guideKeep();
    batch(() => {
      setPrograms((old) =>
        Object.fromEntries(
          Object.entries(old).filter(([id]) => keep.has(id)),
        ),
      );
      setGuideInfo((old) =>
        Object.fromEntries(
          Object.entries(old).filter(([id]) => keep.has(id)),
        ),
      );
    });
    for (const id of guideTimes.keys())
      if (!keep.has(id)) guideTimes.delete(id);
  }
  async function loadGuide(index: number, force = false) {
    const channel = channels()[index];
    if (
      !channel ||
      (!force &&
        programs()[channel.id] &&
        Date.now() - (guideTimes.get(channel.id) ?? 0) < 30_000) ||
      (guideFlights.has(channel.id) &&
        !guideFlights.get(channel.id)!.signal.aborted)
    )
      return;
    const owner = options.scope();
    const request = new AbortController();
    const cancel = () => request.abort();
    if (owner.signal.aborted) return;
    owner.signal.addEventListener("abort", cancel, { once: true });
    guideFlights.set(channel.id, request);
    const focusedProgram =
      channels()[liveChannelIndex()]?.id === channel.id
        ? currentProgram()?.id
        : undefined;
    try {
      const result = await options.request(channel.id, request.signal);
      if (
        options.scope() !== owner ||
        request.signal.aborted ||
        !guideKeep().has(channel.id)
      )
        return;
      guideTimes.set(channel.id, Date.now());
      batch(() => {
        setPrograms((old) => ({ ...old, [channel.id]: result.programs }));
        setGuideInfo((old) => ({ ...old, [channel.id]: result.view }));
        if (channels()[liveChannelIndex()]?.id === channel.id) {
          const retained = result.programs.findIndex(
            (program) => program.id === focusedProgram,
          );
          setProgramIndex(
            retained >= 0
              ? retained
              : Math.max(
                  0,
                  result.programs.findIndex(
                    (program) =>
                      program.id === result.view?.current_program_id,
                  ),
                ),
          );
        }
      });
      trimGuides();
    } catch (e) {
      if (
        options.scope() === owner &&
        !request.signal.aborted &&
        !(e instanceof DOMException)
      )
        notify("Programme information is unavailable.");
    } finally {
      owner.signal.removeEventListener("abort", cancel);
      if (guideFlights.get(channel.id) === request)
        guideFlights.delete(channel.id);
    }
  }
  async function loadVisibleGuides(force = false) {
    const owner = options.scope(),
      ticket = ++guideGeneration;
    const start = Math.max(0, guideRowStart()),
      end = guideRowStart() + 5;
    const visible = new Set(
      channels()
        .slice(start, end)
        .map((channel) => channel.id),
    );
    for (const [id, flight] of guideFlights)
      if (!visible.has(id)) flight.abort();
    trimGuides();
    for (let i = start; i < Math.min(channels().length, end); i += 3) {
      if (owner !== options.scope() || owner.signal.aborted || ticket !== guideGeneration)
        return;
      await Promise.all(
        Array.from(
          { length: Math.min(3, channels().length - i, end - i) },
          (_, n) => loadGuide(i + n, force),
        ),
      );
    }
  }
  function dispose() {
    guideTimes.clear();
    for (const flight of guideFlights.values()) flight.abort();
    guideFlights.clear();
  }
  return {retire: retireLiveGuides, load: loadGuide, loadVisible: loadVisibleGuides, dispose,
    inFlight: () => [...guideFlights.values()].filter(request => !request.signal.aborted).length};
}
