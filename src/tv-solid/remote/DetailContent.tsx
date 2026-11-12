/** @jsxImportSource @solidtv/solid */
import { DetailSkeleton } from "./DetailSkeleton";
import { Show } from "solid-js";
import { KeyedFor, TvView } from "../runtime";
import { MediaTile as Tile } from "./MediaTile";
import { TitleMetadata as Metadata } from "./TitleMetadata";
import { bottomTitleY } from "./title-layout";
import { seasonLabel } from "./seasons";
import { Button, icon, Label, palette } from "./visuals";
import { cardKey, type Card, type Detail } from "./types";

type DetailContentProps = {
  detail?: Detail;
  selectedKind?: string;
  hasEpisodes: boolean;
  episodes: Card[];
  zone: string;
  column: number;
  heroAction: number;
  seasonIndex: number;
  episodeColumn: number;
  recommendationColumn: number;
  actionLabel: string;
  progress: number;
  remaining: string;
  saved: boolean;
};

export function DetailContent(props: DetailContentProps) {
  return <>
    <Show when={!props.detail}>
      <DetailSkeleton series={props.selectedKind === "series"} />
    </Show>
    <Show when={props.detail}>
      {(value) => (
        <>
          <Show
            when={
              !value().item.logo &&
              props.hasEpisodes &&
              ["episodes", "seasons", "recommendations"].includes(
                props.zone,
              )
            }
          >
            <Label
              x={96}
              y={54}
              size={56}
              font="Onest700"
              maxwidth={760}
              maxlines={1}
              content={value().item.title}
            />
          </Show>
          <TvView
            show={
              !props.hasEpisodes ||
              !["episodes", "seasons", "recommendations"].includes(
                props.zone,
              )
            }
            x={96}
            y={
              ["episodes", "seasons", "recommendations"].includes(
                props.zone,
              )
                ? props.hasEpisodes
                  ? -480
                  : -156
                : 0
            }
          >
            <TvView y={props.hasEpisodes ? 250 : 220}>
              <Show when={!value().item.logo}><Label
                    content={value().item.title}
                    font="Onest700"
                    y={bottomTitleY(
                      value().item.title,
                      56,
                      640,
                      props.hasEpisodes ? 134 : 190,
                    )}
                    size={56}
                    lineheight={1.2}
                    maxwidth={850}
                    maxlines={2}
                  /></Show>
            </TvView>
            <Metadata
              card={value().item}
              y={props.hasEpisodes ? 410 : 432}
              detail
            />
            <Label
              y={props.hasEpisodes ? 460 : 482}
              size={26}
              lineheight={1.45}
              maxwidth={800}
              maxlines={3}
              color={palette.body}
              content={value().item.description ?? ""}
            />
            <Button
              x={0}
              y={props.hasEpisodes ? 648 : 668}
              w={260}
              icon="play"
              label={props.actionLabel}
              focused={props.zone === "hero" && props.heroAction === 0}
            />
            <Show when={props.progress > 0}>
              <Label
                x={276}
                y={props.hasEpisodes ? 670 : 690}
                size={22}
                font="Onest600"
                maxwidth={150}
                maxlines={1}
                color={palette.muted}
                content={props.remaining}
              />
              <TvView
                x={0}
                y={(props.hasEpisodes ? 648 : 668) + 80}
                w={260}
                h={4}
                color="rgba(244,242,238,.2)"
              />
              <TvView
                x={0}
                y={(props.hasEpisodes ? 648 : 668) + 80}
                w={
                  260 *
                  Math.max(
                    0,
                    Math.min(
                      1,
                      props.progress,
                    ),
                  )
                }
                h={4}
                color={palette.text}
              />
            </Show>
            <Button
              x={props.progress > 0 ? 440 : 280}
              y={props.hasEpisodes ? 648 : 668}
              icon={props.saved ? "check" : "plus"}
              focused={props.zone === "hero" && props.heroAction === 1}
            />
    
          </TvView>
          <TvView
            x={96}
            y={
              ["episodes", "seasons", "recommendations"].includes(
                props.zone,
              )
                ? props.hasEpisodes
                  ? value().seasons.length
                    ? 154
                    : 184
                  : 680
                : value().seasons.length
                  ? 816
                  : 836
            }
            w={1824}
            h={850}
            clipping={true}
          >
            <Show when={!value().seasons.length}>
              <Label
                size={30}
                font="Onest600"
                content={
                  props.hasEpisodes
                    ? "Episodes"
                    : "More Like This"
                }
              />
            </Show>
            <Show when={value().seasons.length}>
              <Label x={0} centerY={26} size={30} font="Onest600" content="Episodes" />
              <TvView x={192}>
                <Button x={0} y={0} w={260} h={52}
                  label={seasonLabel(value().seasons[props.seasonIndex]?.season)}
                  focused={props.zone === "seasons"} />
                <TvView x={220} y={14} w={24} h={24} src={icon("down", props.zone === "seasons")} />
              </TvView>
              <Label x={480} centerY={26} size={22} color={palette.muted}
                content={`${value().seasons[props.seasonIndex]?.episode_count ?? 0} episodes`} />
            </Show>
            <Show when={props.hasEpisodes && !props.episodes.length}>
              <Label y={96} size={26} color={palette.muted} content="No episodes in this season yet." />
            </Show>
            <KeyedFor
              each={(props.hasEpisodes
                ? props.episodes
                : value().recommendations
              ).slice(
                Math.floor(props.episodeColumn / (props.hasEpisodes ? 4 : 7)) * (props.hasEpisodes ? 4 : 7),
                Math.floor(props.episodeColumn / (props.hasEpisodes ? 4 : 7)) * (props.hasEpisodes ? 4 : 7) + 8,
              )}
              keyOf={cardKey}
            >
              {(card, i) => (
                <Tile
                  card={card()}
                  x={i() * (props.hasEpisodes ? 472 : 248)}
                  y={
                    value().seasons.length
                      ? props.zone === "hero"
                        ? 72
                        : 82
                      : 52
                  }
                  w={props.hasEpisodes ? 448 : 232}
                  h={props.hasEpisodes ? 252 : 348}
                  poster={!props.hasEpisodes}
                  focused={
                    props.zone === "episodes" &&
                    i() ===
                      props.column % (props.hasEpisodes ? 4 : 7)
                  }
                />
              )}
            </KeyedFor>
          </TvView>
          <Show
            when={
              props.hasEpisodes &&
              value().recommendations.length &&
              ["episodes", "seasons", "recommendations"].includes(
                props.zone,
              )
            }
          >
            <TvView x={96} y={676} w={1824} h={404} clipping>
              <Label
                size={30}
                font="Onest600"
                content="More Like This"
              />
              <KeyedFor
                each={value().recommendations.slice(
                  Math.floor(props.recommendationColumn / 7) * 7,
                  Math.floor(props.recommendationColumn / 7) * 7 + 8,
                )}
                keyOf={cardKey}
              >
                {(card, i) => (
                  <Tile
                    card={card()}
                    x={i() * 248}
                    y={52}
                    w={232}
                    h={348}
                    poster
                    focused={
                      props.zone === "recommendations" &&
                      props.column % 7 === i()
                    }
                  />
                )}
              </KeyedFor>
            </TvView>
          </Show>
        </>
      )}
    </Show>
  </>;
}
