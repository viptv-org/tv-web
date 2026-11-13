/** @jsxImportSource @solidtv/solid */
import { For, Show } from "solid-js";
import { TvView } from "../runtime";
import { welcomeWallSource } from "./tv-artwork.generated";
import { imageSource } from "./image-source";
import type { Card } from "./types";

const COLUMNS = 10;
const CELL_COUNT = 40;
const MAX_DYNAMIC_TILES = 8;
const SCALE = 1920 / 2520;
const STEP_X = 252 * SCALE;
const STEP_Y = 372 * SCALE;
const TILE_WIDTH = 181;
const TILE_HEIGHT = 271;
const posterSlots = Array.from({length: MAX_DYNAMIC_TILES}, (_, index) => index);

/** Keep the original welcome wall and rotate featured art through its fixed poster cells. */
export function PosterWall(props: {featured?: Card[]; slide?: number}) {
  const featured = () => props.featured ?? [];
  const items = () => featured().slice(0, MAX_DYNAMIC_TILES);
  const cardAt = (slot: number) => {
    const cards = items();
    if (!cards.length) return undefined;
    const offset = ((props.slide ?? 0) % cards.length + cards.length) % cards.length;
    return cards[(slot + offset) % cards.length];
  };
  const wallSlot = (slot: number) => Math.round((slot + 0.5) * (CELL_COUNT - 1) / items().length);
  return <TvView w={1920} h={1080}>
    <TvView w={1920} h={1080} src={welcomeWallSource()} fit="cover" />
    <For each={posterSlots}>{slot => <Show when={cardAt(slot) && (cardAt(slot)!.poster ?? cardAt(slot)!.landscape)}>
      {source => <TvView x={(wallSlot(slot) % COLUMNS) * STEP_X} y={Math.round(Math.floor(wallSlot(slot) / COLUMNS) * STEP_Y)}
        w={TILE_WIDTH} h={TILE_HEIGHT} fit="cover" alpha={.72}
        src={imageSource(source(), TILE_WIDTH, TILE_HEIGHT, "cover")} />}
    }</Show>}</For>
  </TvView>;
}
