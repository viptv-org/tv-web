/** @jsxImportSource @solidtv/solid */
import { For, createRenderEffect, createSignal, onCleanup } from 'solid-js';
import { TvView } from './runtime';
import { tokens } from '../theme/viptv-tokens.generated';
import { featuredKey, nextFeatured } from './homeFeatured';
import type { HomeView } from './homeModel';
import type { MediaItem } from '../api';

/** The timer starts with decoded artwork; only these small indicator nodes tick. */
export function HomeHeroIndicators(props: { home: HomeView; running: boolean; ready: boolean;
  advance: (item: MediaItem) => void }) {
  const [progress, setProgress] = createSignal(0);
  const [visible, setVisible] = createSignal(!document.hidden);
  const visibility = () => setVisible(!document.hidden);
  document.addEventListener('visibilitychange', visibility);
  onCleanup(() => document.removeEventListener('visibilitychange', visibility));
  let key = '', elapsed = 0;
  createRenderEffect(() => {
    const selected = featuredKey(props.home.heroItem), next = nextFeatured(props.home);
    if (selected !== key) { key = selected; elapsed = 0; setProgress(0); }
    if (!props.running || !props.ready || !visible() || !next) return;
    let start = performance.now() - elapsed;
    const interacted = () => { start = performance.now(); elapsed = 0; setProgress(0); };
    document.addEventListener('keydown', interacted, true);
    const timer = window.setInterval(() => {
      elapsed = performance.now() - start;
      setProgress(Math.min(1, elapsed / 8000));
      if (elapsed >= 8000) { clearInterval(timer); props.advance(next); }
    }, 50);
    onCleanup(() => {
      elapsed = Math.min(8000, performance.now() - start);
      clearInterval(timer); document.removeEventListener('keydown', interacted, true);
    });
  });
  const selected = () => Math.max(0, props.home.featured?.findIndex(item => featuredKey(item) === featuredKey(props.home.heroItem)) ?? 0);
  return <TvView x={192} y={650} h={4} show={(props.home.featured?.length ?? 0) > 1}>
    <For each={props.home.featured}>{(_, index) => <TvView x={index() * 24 + (index() > selected() ? 32 : 0)}>
      <TvView w={index() === selected() ? 48 : 16} h={4} rounded={2} color={tokens['color.line.strong']} />
      <TvView w={48 * progress()} h={4} rounded={2} color={tokens['color.text.primary']} show={index() === selected()} />
    </TvView>}</For>
  </TvView>;
}
