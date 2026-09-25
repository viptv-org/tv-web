/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type { DiscoverCardView } from "./discoverModel";

/** Shared grid card, including hold/release handling, for Discover and My List. */
export function createCatalogCard(scope: "discover" | "library") {
  return defineScreen({
  props: ["position", "card"] as unknown as {
    position: number;
    card: DiscoverCardView;
  },

  state() {
    return {
      focused: false,
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
  },
  watch: {
    card() { this.reveal(); },
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

  render: (s) => (
    <TvView show={s.card.id !== ""}>
      <TvView
        x={0}
        y={0}
      >
        <TvView
          x={-4}
          y={-4}
          w={368}
          h={210}
          rounded={20}
          color={s.white}
          show={s.focused}
        />
        <TvView w={360} h={202} rounded={16} color={s.ground} />
        <TvView
          w={360}
          h={202}
          rounded={16}
          fit={"cover"}
          src={s.card.image}
          show={s.card.image !== ""}
        />
        <TvView
          x={14}
          y={184}
          w={332}
          h={6}
          rounded={3}
          color={s.progressTrack}
          show={s.card.progress > 0}
        />
        <TvView
          x={14}
          y={184}
          w={Math.max(0, Math.min(332, s.card.progress * 332))}
          h={6}
          rounded={3}
          color={s.accent}
          show={s.card.progress > 0}
        />
      </TvView>
      <TvText
        y={219}
        maxwidth={360}
        maxlines={1}
        content={s.titleText}
        font={"Onest600"}
        size={24}
        color={s.focused ? s.primary : s.body}
      />
      <TvText
        y={255}
        maxwidth={360}
        maxlines={1}
        content={s.subtitleText}
        font={"Onest"}
        size={20}
        color={s.focused ? s.secondary : s.tertiary}
      />
    </TvView>
  ),
});
}
