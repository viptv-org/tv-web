/** @jsxImportSource @solidtv/solid */
import { createEffect, createMemo, createSignal, onCleanup, Show, type Accessor, type JSX } from "solid-js";
import { KeyedFor, TvView } from "../runtime";
import { Button, icon, Label, palette } from "./visuals";
import { reducedMotion } from "./motion";
import { railLayout } from "./rail-layout";
import { homeCardSize, focusFrameEdges } from "./focus-frame";
import { cardKey, type Card, type Row } from "./types";

const CARD_SLOTS = 12;

const MOTION = {
  x: { duration: 180, easing: "ease-out" },
  y: { duration: 200, easing: "ease-out" },
};

/** Three reusable shelves under one vertical transform; rails retain card slots. */
export function HomeShelves(props: {
  rows: Row[];
  row: number;
  column: number;
  focused: boolean;
  top: number;
  renderTile: (card: Accessor<Card>, index: Accessor<number>, x: Accessor<number>, focused: Accessor<boolean>, portrait: Accessor<boolean>) => JSX.Element;
}) {
  const remembered = new Map<string, number>();
  const [moving, setMoving] = createSignal(false);
  const motion = reducedMotion() ? undefined : MOTION;
  createEffect(() => { const ids = new Set(props.rows.map(row => row.id));for (const id of remembered.keys()) if (!ids.has(id)) remembered.delete(id); });
  createEffect(() => { const row = props.rows[props.row];if (row) remembered.set(row.id, props.column); });
  let priorRow = props.row;
  createEffect(() => {
    const row = props.row;
    if (row === priorRow) return;
    priorRow = row;
    setMoving(!!motion);
    const timer = setTimeout(() => setMoving(false), 220);
    onCleanup(() => clearTimeout(timer));
  });
  const models = createMemo(() => {
    let offset = 0;
    return props.rows.map((row, index) => {
      const value = { row, index, offset };
      if (row.cards.length || row.state === "Failed" || index === props.row)
        offset += (row.id === "continue" ? 237.6 : 382.8) + 156;
      return value;
    }).filter(model => model.row.cards.length || model.row.state === "Failed" || model.index === props.row)
      .map((model, ordinal) => ({ ...model, slot: ordinal % 3 }));
  });
  const active = createMemo(() => Math.max(0, models().findIndex(model => model.index === props.row)));
  const window = createMemo(() => {
    const start = Math.max(0, Math.min(active() - 1, models().length - 3));
    return models().slice(start, start + 3);
  });
  const origin = createMemo(() => props.top - (models()[active()]?.offset ?? 0) - 530);
  const markers = createMemo(() => {
    const count = props.rows.length, gap = Math.min(8, 220 / (count * 2));
    const unit = Math.min(6, (220 - gap * (count - 1)) / (count + 2));
    let y = (220 - (unit * (count + 2) + gap * (count - 1))) / 2;
    return props.rows.map((_, index) => {
      const height = index === props.row ? unit * 3 : unit;
      const marker = { index, y, height };y += height + gap;return marker;
    });
  });
  return (
    <TvView x={96} y={530} w={1728} h={550} clipping>
      <TvView y={origin()} transition={motion}>
      <KeyedFor each={window()} keyOf={model => model.slot}>
        {model => {
          const source = createMemo(() => model().row.cards);
          const cards = createMemo(() => {
            const seen = new Set<string>();
            return source().filter(card => { const key = cardKey(card);if (seen.has(key)) return false;seen.add(key);return true; });
          });
          const selected = createMemo(() => model().index === props.row);
          const portrait = createMemo(() => model().row.id !== "continue");
          const width = createMemo(() => homeCardSize(portrait()).width);
          const height = createMemo(() => homeCardSize(portrait()).height);
          const step = createMemo(() => homeCardSize(portrait()).step);
          const edges = createMemo(() => focusFrameEdges(width(),height()));
          const index = createMemo(() => selected() ? props.column : remembered.get(model().row.id) ?? 0);
          const layout = createMemo(() => railLayout(cards().length, index(), step(), width()));
          const y = createMemo(() => model().offset);
          const alpha = createMemo(() => selected() || moving() ? 1 : 0);
          const rendered = createMemo(() => {
            const start = Math.min(layout().start, Math.max(0, cards().length - CARD_SLOTS));
            return cards().slice(start, start + CARD_SLOTS).map((card, index) => ({ card, index: start + index }));
          });
          return <>
            <TvView y={y()} alpha={alpha()}>
              <Label size={30} lineheight={1.2} font="Onest600" letterspacing={-0.3} maxwidth={1600} maxlines={1} content={model().row.title} />
              <Show when={model().row.state !== "Ready"}>
                <Show when={model().row.state === "Failed"}><Button x={0} y={96} w={260} label="Try again" focused={selected() && props.focused} /></Show>
                <Label x={model().row.state === "Failed" ? 284 : 0} y={96} size={26} maxwidth={900} color={palette.muted}
                  content={model().row.state === "Pending" ? "Loading…" : model().row.message ?? (model().row.state === "Failed" ? "Couldn’t load this row." : "No titles in this row yet.")} />
              </Show>
            </TvView>
            <TvView y={y() + 52} alpha={alpha()}>
            <TvView x={-layout().offset} transition={motion}>
              <KeyedFor each={rendered()} keyOf={entry => entry.index % CARD_SLOTS}>
                {entry => {
                  const absolute = createMemo(() => entry().index);
                  return props.renderTile(() => entry().card, absolute, () => absolute() * step(), () => selected() && props.focused && absolute() === props.column, portrait);
                }}
              </KeyedFor>
            </TvView>
            </TvView>
            <TvView y={y() + 52}>
            <TvView x={layout().focus} w={width()} h={height()} alpha={selected() && props.focused ? 1 : 0} transition={motion} zIndex={1}>
              <KeyedFor each={edges()} keyOf={edge => edge.id}>
                {edge => <TvView x={edge().x} y={edge().y} w={edge().w} h={edge().h} color={palette.text} focusRing />}
              </KeyedFor>
              <Show when={typeof (globalThis as any).__SolidTVRokuRenderer === "undefined"}>
                <TvView x={(width() - 72) / 2} y={(height() - 72) / 2} w={72} h={72} color="rgba(255,255,255,.16)">
                  <TvView x={22} y={21} w={28} h={30} src={icon("play", false, 0, palette.text)} />
                </TvView>
              </Show>
            </TvView>
            </TvView>
          </>;
        }}
      </KeyedFor>
      </TvView>
      <Show when={props.rows.length > 1}>
        <TvView x={1708} y={props.top - 530 + 90} w={4} h={220} transition={motion}>
          <KeyedFor each={markers()} keyOf={marker => marker.index}>
            {marker => <TvView y={marker().y} w={4} h={marker().height} color={marker().index === props.row ? palette.text : "rgba(255,255,255,.3)"} />}
          </KeyedFor>
        </TvView>
      </Show>
    </TvView>
  );
}
