export function createProgressFreshness(options: {
  owner: () => string;
  alive: () => boolean;
  changed: () => void;
}) {
  return {
    afterPlayback(settled: Promise<unknown>) {
      void settled.catch(() => {});
    },
  };
}
