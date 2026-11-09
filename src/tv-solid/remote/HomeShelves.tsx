/** @jsxImportSource @solidtv/solid */
import { createEffect, createMemo, createSignal, onCleanup, Show, type Accessor, type JSX } from "solid-js";
import { KeyedFor, TvView } from "../runtime";
import { Button, icon, Label, palette } from "./visuals";
import { reducedMotion } from "./motion";
import { railLayout } from "./rail-layout";
import { cardKey, type Card, type Row } from "./types";

const MOTION = {
  x: { duration: 180, easing: "ease-out" },
  y: { duration: 200, easing: "ease-out" },
};

/** Three bounded shelves; each card rail moves as one native transform. */
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
    }).filter(model => model.row.cards.length || model.row.state === "Failed" || model.index === props.row);
  });
  const active = () => Math.max(0, models().findIndex(model => model.index === props.row));
  const window = createMemo(() => models().slice(Math.max(0, active() - 1), active() + 2));
  const origin = () => props.top - (models()[active()]?.offset ?? 0) - 530;
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
      <KeyedFor each={window()} keyOf={model => model.row.id}>
        {model => {
          const source = createMemo(() => model().row.cards);
          const cards = createMemo(() => {
            const seen = new Set<string>();
            return source().filter(card => { const key = cardKey(card);if (seen.has(key)) return false;seen.add(key);return true; });
          });
          const indices = createMemo(() => new Map(cards().map((card, index) => [cardKey(card), index])));
          const selected = () => model().index === props.row;
          const portrait = () => model().row.id !== "continue";
          const width = () => portrait() ? 255.2 : 423.4;
          const height = () => portrait() ? 382.8 : 237.6;
          const step = () => portrait() ? 271.2 : 442.4;
          const index = () => selected() ? props.column : remembered.get(model().row.id) ?? 0;
          const layout = createMemo(() => railLayout(cards().length, index(), step(), width()));
          const y = () => origin() + model().offset;
          const alpha = () => selected() || moving() ? 1 : 0;
          const rendered = createMemo(() => cards().slice(layout().start, layout().end));
          return <>
            <TvView y={y()} alpha={alpha()} transition={motion}>
              <Label size={30} lineheight={1.2} font="Onest600" letterspacing={-0.3} maxwidth={1600} maxlines={1} content={model().row.title} />
              <Show when={model().row.state !== "Ready"}>
                <Show when={model().row.state === "Failed"}><Button x={0} y={96} w={260} label="Try again" focused={selected() && props.focused} /></Show>
                <Label x={model().row.state === "Failed" ? 284 : 0} y={96} size={26} maxwidth={900} color={palette.muted}
                  content={model().row.state === "Pending" ? "Loading…" : model().row.message ?? (model().row.state === "Failed" ? "Couldn’t load this row." : "No titles in this row yet.")} />
              </Show>
            </TvView>
            <TvView x={-layout().offset} y={y() + 52} alpha={alpha()} transition={motion}>
              <KeyedFor each={rendered()} keyOf={cardKey}>
                {card => {
                  const absolute = () => indices().get(cardKey(card())) ?? 0;
                  return props.renderTile(card, absolute, () => absolute() * step(), () => selected() && props.focused && absolute() === props.column, portrait);
                }}
              </KeyedFor>
            </TvView>
            <TvView x={layout().focus} y={y() + 52} w={width()} h={height()} alpha={selected() && props.focused ? 1 : 0} transition={motion}>
              <TvView w={width()} h={4} color={palette.text} />
              <TvView y={height() - 4} w={width()} h={4} color={palette.text} />
              <TvView w={4} h={height()} color={palette.text} />
              <TvView x={width() - 4} w={4} h={height()} color={palette.text} />
              <Show when={typeof (globalThis as any).__SolidTVRokuRenderer === "undefined"}>
                <TvView x={(width() - 72) / 2} y={(height() - 72) / 2} w={72} h={72} color="rgba(255,255,255,.16)">
                  <TvView x={22} y={21} w={28} h={30} src={icon("play", false, 0, palette.text)} />
                </TvView>
              </Show>
            </TvView>
          </>;
        }}
      </KeyedFor>
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
