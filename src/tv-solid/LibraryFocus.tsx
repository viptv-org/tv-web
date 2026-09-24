/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type { DiscoverCardView } from "./discoverModel";

export const LibrarySegment = defineScreen({
  props: ["position", "label", "selected", "width"] as unknown as {
    position: number;
    label: string;
    selected: boolean;
    width: number;
  },

  state() {
    return {
      focused: false,
      labelText: "",
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"],
      secondary: tokens["color.text.secondary"],
      selectedGround: tokens["color.fill.tv-selected"],
      clear: "rgba(0,0,0,0)",
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("library-segment", this.position);
      this.$emit("library-segment-focused", this.position);
    },
    unfocus() {
      this.focused = false;
    },
  },
  methods: {
    reveal() {
      this.labelText = this.label;
    },
  },
  input: {
    left() {
      this.$emit("library-segment-move", -1);
    },
    right() {
      this.$emit("library-segment-move", 1);
    },
    down() {
      this.$emit("library-card-enter");
    },
    enter() {
      return () => this.$emit("library-segment-activate");
    },
  },

  render: (s) => (
    <TvView w={s.width} h={56}>
      <TvView
        x={-4}
        y={-4}
        w={s.width + 8}
        h={64}
        rounded={32}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={s.width}
        h={56}
        rounded={28}
        color={s.focused ? s.primary : s.selected ? s.selectedGround : s.clear}
      />
      <TvText
        x={28}
        y={13}
        content={s.labelText}
        font={"Onest700"}
        size={24}
        color={s.focused ? s.onLight : s.selected ? s.primary : s.secondary}
      />
    </TvView>
  ),
});

export const LibraryCard = defineScreen({
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
      track: tokens["color.line.strong"],
      accent: tokens["color.accent.default"],
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("library-card", this.position);
      this.$emit("library-card-focused", this.position);
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
  input: {
    left() {
      this.$emit("library-card-move", "left");
    },
    right() {
      this.$emit("library-card-move", "right");
    },
    up() {
      this.$emit("library-card-move", "up");
    },
    down() {
      this.$emit("library-card-move", "down");
    },
    menu() {
      this.$emit("library-card-hold", this.position);
    },
    enter() {
      if (!this.pressed) {
        this.pressed = true;
        this.holdFired = false;
        this.holdTimer = window.setTimeout(() => {
          this.holdFired = true;
          this.$emit("library-card-hold", this.position);
        }, 700);
      }
      return () => {
        clearTimeout(this.holdTimer);
        const activate = !this.holdFired;
        this.pressed = false;
        if (activate) this.$emit("library-card-activate");
      };
    },
  },

  render: (s) => (
    <TvView show={s.card.id !== ""}>
      <TvView
        x={s.focused ? -11 : 0}
        y={s.focused ? -6 : 0}
        scale={s.focused ? 1.06 : 1}
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
          color={s.track}
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
        y={s.focused ? 235 : 219}
        maxwidth={360}
        maxlines={1}
        content={s.titleText}
        font={"Onest600"}
        size={24}
        color={s.focused ? s.primary : s.body}
      />
      <TvText
        y={s.focused ? 274 : 255}
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
