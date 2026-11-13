/** @jsxImportSource @solidtv/solid */
import { createEffect, createMemo, createSignal, Show } from "solid-js";
import { KeyedFor, TvView } from "../runtime";
import { focusFrameEdges } from "./focus-frame";
import { imagePixels, imageSource } from "./image-source";
import { sdfTextMetrics } from "./text-measure";
import { cardOutline, icon, Label, Logo, palette } from "./visuals";
import { cardKey, type Card } from "./types";

const isRokuUi = typeof (globalThis as any).__SolidTVRokuRenderer !== "undefined";

export function MediaTile(props: {
  card: Card;
  x: number;
  y: number;
  w: number;
  h: number;
  focused: boolean;
  poster?: boolean;
  focusedCaptions?: boolean;
  focusBorder?: boolean;
  preload?: boolean;
  fallbackArtwork?: string | null;
}) {
  const edges = createMemo(() => focusFrameEdges(props.w,props.h));
  const progress = () =>
    props.card.progress ?? props.card.view?.progress ?? null;
  const source = createMemo(() =>
    props.poster
      ? (props.card.poster ?? props.card.landscape)
      : (props.card.view?.preview?.background ??
        props.card.landscape ??
        props.card.poster));
  const identity = createMemo(() => cardKey(props.card));
  const primary = createMemo(() => imageSource(source(), imagePixels(props.w), imagePixels(props.h)));
  const alternative = createMemo(() => imageSource(props.fallbackArtwork, imagePixels(props.w), imagePixels(props.h)));
  const captionVisible = () => !props.poster || props.focused || props.focusedCaptions;
  const [primaryFailed, setPrimaryFailed] = createSignal(false);
  const [alternativeFailed, setAlternativeFailed] = createSignal(false);
  createEffect(() => {
    identity(); primary(); setPrimaryFailed(false);
  });
  createEffect(() => {
    identity(); alternative(); setAlternativeFailed(false);
  });
  const request = createMemo(() => {
    if (primary() && !primaryFailed()) return primary();
    const fallback = alternative();
    return fallback && fallback !== primary() && !alternativeFailed() ? fallback : "";
  });
  const label = () =>
    props.card.view?.tile_badge?.label ??
    props.card.badges.find((badge) => !/simkl/i.test(badge)) ??
    null;
  const badgeWidth = createMemo(() => {
    const context = sdfTextMetrics("18px Onest700");
    return Math.min(
      props.w - 20,
      Math.ceil(
        context.measureText(label() ?? "").width,
      ) + 20,
    );
  });
  const meta = () =>
    props.card.subtitle ||
    props.card.view?.compact_metadata_parts?.join(" · ") ||
    "";
  return (
    <TvView x={props.x} y={props.y} w={props.w} h={props.h + 80} clipping>
      <TvView
        w={props.w}
        h={props.h}
        color={palette.surface}
        clipping
      >
        <TvView w={props.w} h={props.h} color="#1A1A1C">
          <Show
            when={request()}
            keyed
            fallback={
              <Show when={props.poster}>
              <Label
                x={14}
                y={props.h - 70}
                size={props.poster ? 24 : 22}
                lineheight={1.2}
                font="Onest600"
                maxwidth={props.w - 28}
                maxlines={2}
                content={props.card.title}
                color="rgba(244,242,238,.9)"
              />
              </Show>
            }
          >
          {uri => <TvView
            w={props.w}
            h={props.h}
            src={uri}
            preload={props.preload}
            fit="cover"
            onError={() => {
              if (request() !== uri) return;
              if (uri === primary()) setPrimaryFailed(true);
              else setAlternativeFailed(true);
            }}
          />}
          </Show>
          <Show when={!request() && !props.poster && props.card.identity.episode}>
            <TvView x={(props.w - 48) / 2} y={(props.h - 48) / 2} w={48} h={48} alpha={.45} src={icon("episodes")} />
          </Show>
        </TvView>
        <Show when={!props.poster && props.card.logo}>
          <TvView
            x={18}
            y={props.h - 74}
            w={props.w * 0.62}
            h={56}
            clipping
          >
            <Logo
              src={props.card.logo!}
              h={56}
              size={28}
              maxWidth={props.w * 0.62}
              title={props.card.title}
            />
          </TvView>
        </Show>
        <Show when={label()}>
          <TvView
            x={10}
            y={10}
            w={badgeWidth()}
            h={30}
            color={
              /new episode/i.test(label() ?? "")
                ? palette.text
                : label() === "LIVE"
                  ? "#E5484D"
                  : "rgba(11,11,12,.8)"
            }
          >
            <Label
              x={10}
              centerY={15}
              size={18}
              font="Onest700"
              maxwidth={props.w - 30}
              maxlines={1}
              content={label() ?? ""}
              color={
                /new episode/i.test(label() ?? "")
                  ? "#111113"
                  : palette.text
              }
            />
          </TvView>
        </Show>
        <Show when={isRokuUi}>
        <TvView w={props.w} h={props.h} show={props.focused && props.focusBorder !== false}>
          <KeyedFor each={edges()} keyOf={edge => edge.id}>
            {edge => <TvView x={edge().x} y={edge().y} w={edge().w} h={edge().h} color={palette.text} focusRing />}
          </KeyedFor>
        </TvView>
        </Show>
        <TvView w={props.w} h={props.h} show={(progress() ?? 0) > 0}>
          <TvView
            x={3}
            y={props.h - 8}
            w={props.w - 6}
            h={5}
            color="rgba(255,255,255,.25)"
          >
            <TvView
              w={(props.w - 6) * Math.max(0, Math.min(1, progress() ?? 0))}
              h={5}
              color={palette.accent}
            />
          </TvView>
        </TvView>
        <Show when={!isRokuUi}>
        <TvView w={props.w} h={props.h} show={props.focused && props.focusBorder !== false}>
          <TvView
            w={props.w}
            h={props.h}
            src={cardOutline(props.w, props.h, true)}
          />
          <TvView
            x={(props.w - 72) / 2}
            y={(props.h - 72) / 2}
            w={72}
            h={72}
            color="rgba(255,255,255,.16)"
          >
            <TvView
              x={22}
              y={21}
              w={28}
              h={30}
              src={icon("play", false, 0, "#F4F2EE")}
            />
          </TvView>
        </TvView>
        </Show>
      </TvView>
      <Show when={captionVisible()}>
        <TvView y={props.h + 14} w={props.w} h={66} clipping>
          <Show when={!props.poster || request()}>
          <Label
            y={0}
            size={24}
            lineheight={1.2}
            font="Onest600"
            maxwidth={props.w}
            maxlines={1}
            content={props.card.title}
            color={palette.text}
          />
          </Show>
          <Label
            y={33}
            size={20}
            lineheight={1.3}
            maxwidth={props.w}
            maxlines={1}
            content={meta()}
            color={palette.muted}
          />
        </TvView>
      </Show>
    </TvView>
  );
}
