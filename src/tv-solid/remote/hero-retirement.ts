type AnimatedHeroNode = { lng?: { animation?: (property: string) => { waitUntilStopped(): Promise<unknown> } | undefined } };

/** Let native runs start, then keep both opacity halves until each has stopped. */
export function retireAfterHeroAnimations(nodes: readonly AnimatedHeroNode[], retire: () => void): () => void {
  let cancelled = false;
  const timer = setTimeout(() => {
    const runs: Promise<unknown>[] = [];
    nodes.forEach(node => ['alpha', 'x'].forEach(property => runs.push(node.lng?.animation?.(property)?.waitUntilStopped() ?? Promise.resolve())));
    void Promise.all(runs)
      .then(() => { if (!cancelled) retire(); });
  }, 0);
  return () => { cancelled = true; clearTimeout(timer); };
}
