export function createPlayerTransport(options: {
  play: () => Promise<void>; pause: () => Promise<void>;
  pending: (value: boolean) => void; reveal: () => void; activity: () => void; active: () => boolean;
}) {
  let generation = 0;
  return {
    retire() { generation++; options.pending(false); },
    async setPlaying(playing: boolean) {
      const intent = ++generation;
      options.pending(!playing);
      if (!playing) options.reveal();
      try {
        await (playing ? options.play() : options.pause());
      } catch (error) {
        if (intent !== generation || !options.active()) return;
        options.pending(false);
        throw error;
      } finally {
        if (intent === generation && options.active()) options.activity();
      }
    },
  };
}
