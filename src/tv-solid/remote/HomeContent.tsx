/** @jsxImportSource @solidtv/solid */
import { For, Show, type Accessor } from "solid-js";
import { TvView } from "../runtime";
import { HomeShelves } from "./HomeShelves";
import { BrowsePreview } from "./BrowsePreview";
import { MediaTile as Tile } from "./MediaTile";
import { HeroProgress } from "./Billboard";
import { TitleMetadata as Metadata } from "./TitleMetadata";
import { bottomTitleY } from "./title-layout";
import { homeCardSize } from "./focus-frame";
import { Button, Label, palette } from "./visuals";
import type { Card, Home, Row } from "./types";

interface HomeFocus { zone: Accessor<string>; row: Accessor<number>; column: Accessor<number>; action: Accessor<number> }
interface HomePresentation { card: Accessor<Card | undefined>; mode: Accessor<string | undefined> }
interface Billboard { slide: Accessor<number>; started: Accessor<number>; active: Accessor<boolean> }

type HomeContentProps = {
  home?: Home;
  hasHero: boolean;
  presentation: HomePresentation;
  focus: HomeFocus;
  billboard: Billboard;
  shelfTop: number;
  columnForRow: (row: Row) => number;
  isSaved: (card: Card) => boolean;
};

export function HomeContent(props: HomeContentProps) {
  return <>
    <Show when={props.home?.complete && !props.hasHero}>
      <Label
        x={96}
        y={300}
        size={44}
        font="Onest700"
        content="Nothing here yet"
      />
      <Label
        x={96}
        y={375}
        size={28}
        color={palette.muted}
        maxwidth={1000}
        content="Add an add-on in Settings to find something to watch."
      />
      <Button
        x={96}
        y={480}
        w={320}
        label="Open Settings"
        focused={props.focus.zone() === "hero"}
      />
    </Show>
    <Show when={props.presentation.mode() === "hero" ? props.presentation.card() : undefined}>
      {(card) => (
        <TvView
          x={96}
          y={props.focus.zone() === "rows" ? -700 : 330}
          w={1100}
          transition={{
            y: {
              duration: 220,
              timingFunction: "cubic-bezier(.2,0,0,1)",
            },
          }}
          show={props.focus.zone() !== "rows"}
        >
          <Show when={!card().logo}><Label
                content={card().title}
                font="Onest700"
                y={bottomTitleY(card().title, 48, 800, 160)}
                size={48}
                lineheight={1.2}
                maxwidth={800}
                maxheight={160}
                maxlines={2}
              /></Show>
          <Metadata card={card()} y={188} />
          <Label
            y={234}
            size={26}
            lineheight={1.45}
            maxwidth={780}
            maxlines={2}
            color={palette.body}
            content={card().description ?? ""}
          />
          <Button
            x={0}
            y={338}
            w={220}
            h={72}
            icon="play"
            iconSize={24}
            label="Play"
            focused={props.focus.zone() === "hero" && props.focus.action() === 0}
          />
          <Button
            x={240}
            y={338}
            w={72}
            h={72}
            icon={props.isSaved(card()) ? "check" : "plus"}
            focused={props.focus.zone() === "hero" && props.focus.action() === 1}
          />
          <Button
            x={332}
            y={338}
            w={72}
            h={72}
            icon="info"
            focused={props.focus.zone() === "hero" && props.focus.action() === 2}
          />
          <For each={(props.home?.featured ?? []).slice(0, 5)}>
            {(_, i) => (
              <TvView
                x={i() * 24 + (i() > props.billboard.slide() ? 32 : 0)}
                y={450}
              >
                <Show
                  when={i() === props.billboard.slide()}
                  fallback={
                    <TvView
                      w={16}
                      h={4}
                      color="rgba(255,255,255,.3)"
                    />
                  }
                >
                  <HeroProgress
                    started={props.billboard.started()}
                    running={props.billboard.active()}
                  />
                </Show>
              </TvView>
            )}
          </For>
        </TvView>
      )}
    </Show>
    <Show when={props.focus.zone() === "rows" && props.presentation.mode() !== "hero" && props.presentation.card()}>
      {(card) => (
        <BrowsePreview
          card={card()}
          externalLogo
          summaryBottom={props.shelfTop}
        />
      )}
    </Show>
    <Show when={props.home?.rows?.length}>
      <HomeShelves rows={props.home!.rows} row={props.focus.row()} column={props.focus.column()}
        focused={props.focus.zone() === "rows"} columnForRow={shelf => props.columnForRow(shelf)} top={props.shelfTop}
        renderTile={(card, _index, x, focused, portrait) => (
          <Tile card={card()} x={x()} y={0}
            w={homeCardSize(portrait()).width} h={homeCardSize(portrait()).height}
            poster={portrait()} focused={focused()} focusBorder={false} preload />
        )} />
    </Show>

  </>;
}
