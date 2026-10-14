/** @jsxImportSource @solidtv/solid */
import { createRenderEffect, createSignal } from 'solid-js';
import { TvView, TvText } from './runtime';
import { tokens } from '../theme/viptv-tokens.generated';

/** A failed transparent logo must leave a readable title. */
export function HomeHeroTitle(props: { logo: string; title: string }) {
  const [failed, setFailed] = createSignal(false);
  createRenderEffect(() => { props.logo; setFailed(false); });
  return <TvView>
    <TvView x={192} y={196} w={410} h={118} fit="contain" src={props.logo}
      show={!!props.logo && !failed()} onError={() => setFailed(true)} />
    <TvText x={192} y={196} maxwidth={760} maxlines={2} content={props.title}
      font="Bricolage700" size={56} color={tokens['color.text.primary']} show={!props.logo || failed()} />
  </TvView>;
}
