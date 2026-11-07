/** @jsxImportSource @solidtv/solid */
/**
 * The drawing half of LIVE-EMPTY-001. The state, the copy and the geometry are
 * in `liveEmpty.ts`; this file only paints them, with the page's own primitives.
 *
 * The shipped entry draws 1920 × 1080, so these are the contract's T row:
 * the page area under the navigation is `LIVE_PAGE_TOP` … + `LIVE_PAGE_HEIGHT`.
 */
import { For, Show, createMemo } from "solid-js";
import { getRenderer } from "@solidtv/solid";
import { TvView } from "../runtime";
import { Label, palette } from "./visuals";
import {
  LIVE_ANSWER_T,
  LIVE_EMPTY_COPY,
  LIVE_NO_SOURCE_T,
  LIVE_PAGE_HEIGHT,
  LIVE_PAGE_TOP,
  liveEmptyArtworkSrc,
  liveNoSourceActions,
  liveWhoLine,
  type LiveBox,
  type LiveRecoveryAction,
  type LiveViewer,
} from "./liveEmpty";

const rgb = (hex: string) => {
  const value = hex.replace("#", "");
  const channel = (at: number) => parseInt(value.slice(at, at + 2), 16) || 0;
  return [channel(0), channel(2), channel(4)] as const;
};

/**
 * § Artwork: a page draws the wide crop once and then a `bg` gradient over it,
 * so the copy always sits on the darkest part. The stops are the contract's
 * (92 % left, 60 % at 45 %, 18 % right) and a page does not substitute its own.
 * One small cached alpha mask replaces a per-pixel blend pass.
 */
function scrimTexture() {
  const width = 512,
    height = 8,
    pixels = new ImageData(width, height),
    [r, g, b] = rgb(palette.bg),
    stops = LIVE_NO_SOURCE_T.scrim;
  const alphaAt = (position: number) => {
    let left: (typeof stops)[number] = stops[0],
      right: (typeof stops)[number] = stops[stops.length - 1];
    for (let i = 1; i < stops.length; i++)
      if (position <= stops[i].at) {
        left = stops[i - 1];
        right = stops[i];
        break;
      }
    const span = right.at - left.at;
    const t = span <= 0 ? 1 : (position - left.at) / span;
    return left.alpha + (right.alpha - left.alpha) * Math.max(0, Math.min(1, t));
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      pixels.data[i] = r;
      pixels.data[i + 1] = g;
      pixels.data[i + 2] = b;
      pixels.data[i + 3] = Math.round(alphaAt((x + 0.5) / width) * 255);
    }
  return getRenderer().createTexture("ImageTexture", {
    src: pixels,
    premultiplyAlpha: true,
    key: "live-empty-scrim-wide-v1",
  });
}

/** The crop and its scrim. Decorative: no text, no accessible name. */
function LiveEmptyArtwork() {
  const mask = scrimTexture();
  return (
    <TvView
      y={LIVE_PAGE_TOP}
      w={LIVE_NO_SOURCE_T.artwork.w}
      h={LIVE_NO_SOURCE_T.artwork.h}
    >
      <TvView
        w={LIVE_NO_SOURCE_T.artwork.w}
        h={LIVE_NO_SOURCE_T.artwork.h}
        color={palette.bg}
      />
      <TvView
        w={LIVE_NO_SOURCE_T.artwork.w}
        h={LIVE_NO_SOURCE_T.artwork.h}
        src={liveEmptyArtworkSrc()}
        fit="cover"
      />
      <TvView
        w={LIVE_NO_SOURCE_T.artwork.w}
        h={LIVE_NO_SOURCE_T.artwork.h}
        color="#ffffff"
        texture={mask}
      />
    </TvView>
  );
}

/** Side padding is the contract's; the label is centred, so the box grows with
 * its own text instead of clipping it at another control's fixed inset. */
function actionWidth(
  text: string,
  size: number,
  padding: number,
  font: string,
) {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return text.length * size + padding * 2;
  context.font = `${size}px ${font}`;
  return Math.ceil(context.measureText(text).width) + padding * 2;
}

/**
 * One action on the contract's T geometry: a pill whose fill is off-white when
 * focused and white 0.12 when not, with no accent.
 */
function EmptyButton(props: {
  box: LiveBox;
  label: string;
  size: number;
  font: string;
  padding: number;
  focused: boolean;
}) {
  const width = createMemo(() =>
    actionWidth(props.label, props.size, props.padding, props.font),
  );
  return (
    <TvView
      x={props.box.x}
      y={props.box.y}
      w={width()}
      h={props.box.h}
      color={props.focused ? palette.text : "rgba(255,255,255,.12)"}
    >
      <Label
        w={width()}
        centerY={props.box.h / 2}
        align="center"
        size={props.size}
        font={props.font}
        maxlines={1}
        content={props.label}
        color={props.focused ? "#111113" : palette.text}
      />
    </TvView>
  );
}

/**
 * § No source (LIVE-EMPTY-001A). One broadcast frame: the crop behind a
 * left-set text block. Every filter chip, preview, guide row and channel row is
 * absent because the caller does not draw the page chrome behind it.
 *
 * `viewer` is `undefined` until the identity answers: the text block then draws
 * without an action block or who line and holds their height, so nothing moves
 * when the answer lands.
 */
export function LiveNoSource(props: {
  viewer: LiveViewer | undefined;
  /** The focused action, or `undefined` when the block holds no focus. */
  focused: number | undefined;
}) {
  const T = LIVE_NO_SOURCE_T,
    who = () => liveWhoLine(props.viewer),
    actions = () =>
      liveNoSourceActions(props.viewer).map((id) =>
        id === "setup" ? LIVE_EMPTY_COPY.setup : LIVE_EMPTY_COPY.addOns,
      );
  return (
    <>
      <LiveEmptyArtwork />
      <TvView y={LIVE_PAGE_TOP} w={1920} h={T.artwork.h}>
        <Label
          x={T.eyebrow.x}
          y={T.eyebrow.y}
          w={T.eyebrow.w}
          size={T.eyebrowSize}
          font="Onest700"
          letterspacing={Math.round(T.eyebrowSize * 0.08)}
          maxlines={1}
          content={LIVE_EMPTY_COPY.eyebrow}
          color={palette.muted}
        />
        <Label
          x={T.headline.x}
          y={T.headline.y}
          size={T.headlineSize}
          lineheight={T.headlineLine / T.headlineSize}
          maxwidth={T.headline.w}
          maxlines={T.headlineLines}
          content={LIVE_EMPTY_COPY.headline}
        />
        <Label
          x={T.body.x}
          y={T.body.y}
          size={T.bodySize}
          lineheight={T.bodyLine / T.bodySize}
          maxwidth={T.body.w}
          maxlines={T.bodyLines}
          content={LIVE_EMPTY_COPY.body}
          color={palette.body}
        />
        <Show when={!who()}>
          <For each={actions()}>
            {(label, index) => (
              <EmptyButton
                box={index() === 0 ? T.primary : T.secondary}
                label={label}
                size={index() === 0 ? T.primarySize : T.secondarySize}
                font={index() === 0 ? "Onest700" : "Onest600"}
                padding={
                  index() === 0 ? T.primaryPadding : T.secondaryPadding
                }
                focused={props.focused === index()}
              />
            )}
          </For>
        </Show>
        <Show when={who()}>
          <Label
            x={T.who.x}
            y={T.who.y}
            size={T.whoSize}
            lineheight={T.whoLine / T.whoSize}
            maxwidth={T.who.w}
            maxlines={2}
            content={who()}
            color={palette.body}
          />
        </Show>
      </TvView>
    </>
  );
}

/**
 * § Sources, no channels (LIVE-EMPTY-001B) and the failed first request. No
 * artwork: this is either a working page whose source did not answer, or a
 * page nothing has proved configured yet. Copy, the server's own human reason
 * and the account-gated recovery come from `liveEmpty.ts`; the first action is
 * the primary, so **Try again** leads whenever there is something to retry.
 */
export function LiveAnswer(props: {
  headline: string;
  body: string;
  actions: { id: LiveRecoveryAction; label: string }[];
  /** The focused action, or `undefined` when the block holds no focus. */
  focused: number | undefined;
}) {
  const T = LIVE_ANSWER_T;
  return (
    <TvView y={LIVE_PAGE_TOP} w={1920} h={LIVE_PAGE_HEIGHT}>
      <Label
        x={T.headline.x}
        y={T.headline.y}
        size={T.headlineSize}
        font="Onest700"
        lineheight={T.headlineLine / T.headlineSize}
        maxwidth={T.headline.w}
        maxlines={T.headlineLines}
        content={props.headline}
      />
      <Label
        x={T.body.x}
        y={T.body.y}
        size={T.bodySize}
        lineheight={T.bodyLine / T.bodySize}
        maxwidth={T.body.w}
        maxlines={T.bodyLines}
        content={props.body}
        color={palette.body}
      />
      <For each={props.actions}>
        {(action, index) => (
          <EmptyButton
            box={index() === 0 ? T.primary : T.secondary}
            label={action.label}
            size={index() === 0 ? LIVE_NO_SOURCE_T.primarySize : LIVE_NO_SOURCE_T.secondarySize}
            font={index() === 0 ? "Onest700" : "Onest600"}
            padding={
              index() === 0
                ? LIVE_NO_SOURCE_T.primaryPadding
                : LIVE_NO_SOURCE_T.secondaryPadding
            }
            focused={props.focused === index()}
          />
        )}
      </For>
    </TvView>
  );
}
