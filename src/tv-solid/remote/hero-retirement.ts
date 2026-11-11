type AnimatedHeroNode = { lng?: { animation?: (property: string) => { waitUntilStopped(): Promise<unknown> } | undefined } };

/** Let native runs start, then keep both opacity halves until each has stopped. */
export function retireAfterHeroAnimations(nodes: readonly AnimatedHeroNode[], retire: () => void): () => void {
  let cancelled = false;
  const timer = setTimeout(() => {
    void Promise.all(nodes.map(node => node.lng?.animation?.('alpha')?.waitUntilStopped() ?? Promise.resolve()))
      .then(() => { if (!cancelled) retire(); });
  }, 0);
  return () => { cancelled = true; clearTimeout(timer); };
}
