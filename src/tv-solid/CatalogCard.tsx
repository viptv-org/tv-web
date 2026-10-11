/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type { DiscoverCardView } from "./discoverModel";

/** Landscape grid still; My List draws 2:3 posters (TV-MYLIST-POSTER-001). */
const STILL = { w: 360, h: 202 };
const POSTER = { w: 200, h: 300 };

/** Shared grid card, including hold/release handling, for Discover and My List. */
export function createCatalogCard(scope: "discover" | "library") {
  return defineScreen({
  props: ["position", "card", "poster"] as unknown as {
    position: number;
    card: DiscoverCardView;
    poster?: boolean;
  },

  state() {
    return {
      focused: false,
      artFailed: false,
      titleText: "",
      subtitleText: "",
      pressed: false,
      holdFired: false,
      holdTimer: 0,
      white: tokens["color.fill.white"],
      ground: tokens["color.surface.1"],
      primary: tokens["color.text.primary"],
      body: tokens["color.text.body"],
      secondary: tokens["color.text.secondary"],
      tertiary: tokens["color.text.tertiary"],
      progressTrack: tokens["color.line.strong"],
      accent: tokens["color.accent.default"],
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus(`${scope}-card`, this.position);
      this.$emit(`${scope}-card-focused`, this.position);
    },
    unfocus() {
      this.focused = false;
      clearTimeout(this.holdTimer);
    },
    destroy() {
      clearTimeout(this.holdTimer);
    },
  },
  methods: {
    reveal() {
      this.titleText = this.card.title;
      this.subtitleText = this.card.subtitle;
    },
    onArtError() {
      this.artFailed = true;
    },
  },
  watch: {
    card() { this.artFailed = false; this.reveal(); },
    position() { if (this.focused) noteFocus(`${scope}-card`, this.position); },
  },
  input: {
    left() {
      this.$emit(`${scope}-card-move`, "left");
    },
    right() {
      this.$emit(`${scope}-card-move`, "right");
    },
    up() {
      this.$emit(`${scope}-card-move`, "up");
    },
    down() {
      this.$emit(`${scope}-card-move`, "down");
    },
    menu() {
      this.$emit(`${scope}-card-hold`, this.position);
    },
    enter() {
      if (!this.pressed) {
        this.pressed = true;
        this.holdFired = false;
        this.holdTimer = window.setTimeout(() => {
          this.holdFired = true;
          this.$emit(`${scope}-card-hold`, this.position);
        }, 700);
      }
      return () => {
        clearTimeout(this.holdTimer);
        const activate = !this.holdFired;
        this.pressed = false;
        if (activate) this.$emit(`${scope}-card-activate`);
      };
    },
  },

  render: (s) => {
    const size = () => (s.poster ? POSTER : STILL);
    const missingArt = () => s.card.image === "" || s.artFailed;
    return (
    <TvView show={s.card.id !== ""}>
      <TvView
        x={0}
        y={0}
      >
        <TvView
          x={-4}
          y={-4}
          w={size().w + 8}
          h={size().h + 8}
          rounded={20}
          color={s.white}
          show={s.focused}
        />
        <TvView w={size().w} h={size().h} rounded={16} color={s.ground} />
        <TvText
          x={16}
          y={size().h / 2 - 48}
          maxwidth={size().w - 32}
          maxlines={3}
          align={"center"}
          content={s.poster && missingArt() ? s.titleText : ""}
          font={"Bricolage700"}
          size={24}
          color={s.secondary}
        />
        <TvView
          w={size().w}
          h={size().h}
          rounded={16}
          fit={s.poster && s.card.logo ? "contain" : "cover"}
          src={s.card.image}
          show={!missingArt()}
          onError={s.onArtError}
        />
        <TvView
          x={14}
          y={size().h - 18}
          w={size().w - 28}
          h={6}
          rounded={3}
          color={s.progressTrack}
          show={s.card.progress > 0}
        />
        <TvView
          x={14}
          y={size().h - 18}
          w={Math.max(0, Math.min(size().w - 28, s.card.progress * (size().w - 28)))}
          h={6}
          rounded={3}
          color={s.accent}
          show={s.card.progress > 0}
        />
      </TvView>
      <TvText
        y={size().h + 17}
        maxwidth={size().w}
        maxlines={1}
        content={s.titleText}
        font={"Onest600"}
        size={24}
        color={s.focused ? s.primary : s.body}
      />
      <TvText
        y={size().h + 53}
        maxwidth={size().w}
        maxlines={1}
        content={s.subtitleText}
        font={"Onest"}
        size={20}
        color={s.focused ? s.secondary : s.tertiary}
      />
    </TvView>
    );
  },
});
}
