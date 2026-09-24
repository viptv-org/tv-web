/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import type { HomeCardView } from "./homeModel";
import { noteFocus } from "./focusDebug";

/** A focus-owning SolidTV action. Selection fires on remote key release. */
export const HomeAction = defineScreen({
  props: [
    "position",
    "action",
    "label",
    "icon",
    "buttonWidth",
    "buttonHeight",
    "round",
    "holdable",
  ] as unknown as {
    position: number;
    action: string;
    label: string;
    icon: string;
    buttonWidth: number;
    buttonHeight: number;
    round: boolean;
    holdable: boolean;
  },

  state() {
    return {
      focused: false,
      pressed: false,
      holdFired: false,
      holdTimer: 0,
      labelText: "",
      iconText: "",
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"],
      surface: tokens["color.surface.3"],
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("home-action", this.position);
      this.$emit("home-action-focused", this.position);
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
      this.labelText = this.label;
      this.iconText = this.icon;
    },
  },
  input: {
    left() {
      this.$emit("home-action-move", { position: this.position, delta: -1 });
    },
    right() {
      this.$emit("home-action-move", { position: this.position, delta: 1 });
    },
    down() {
      this.$emit("home-cards-enter");
    },
    enter() {
      if (!this.pressed) {
        this.pressed = true;
        this.holdFired = false;
        if (this.holdable)
          this.holdTimer = window.setTimeout(() => {
            this.holdFired = true;
            this.$emit("home-action-hold", this.action);
          }, 700);
      }
      return () => {
        clearTimeout(this.holdTimer);
        const activate = !this.holdFired;
        this.pressed = false;
        if (activate) this.$emit("home-action-activate", this.action);
      };
    },
  },

  render: (s) => (
    <TvView w={s.buttonWidth} h={s.buttonHeight}>
      <TvView
        x={-4}
        y={-4}
        w={s.buttonWidth + 8}
        h={s.buttonHeight + 8}
        rounded={s.buttonHeight / 2 + 4}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={s.buttonWidth}
        h={s.buttonHeight}
        rounded={s.buttonHeight / 2}
        color={s.focused ? s.primary : s.surface}
      />
      <TvText
        x={s.round ? 20 : s.action === "details" ? 33 : 45}
        y={s.buttonHeight / 2 - 17}
        content={s.iconText}
        font={"Onest"}
        size={s.round ? 38 : 27}
        color={s.focused ? s.onLight : s.primary}
      />
      <TvText
        x={s.action === "details" ? 33 : 81}
        y={s.buttonHeight / 2 - 16}
        content={s.labelText}
        font={"Onest700"}
        size={26}
        color={s.focused ? s.onLight : s.primary}
        show={!s.round}
      />
    </TvView>
  ),
});

/** First Home shelf tile. It receives focus from SolidTV, not the DOM registry. */
export const HomeCard = defineScreen({
  props: ["position", "card"] as unknown as {
    position: number;
    card: HomeCardView;
  },

  state() {
    return {
      focused: false,
      pressed: false,
      holdFired: false,
      holdTimer: 0,
      titleText: "",
      subtitleText: "",
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      secondary: tokens["color.text.secondary"],
      surface: tokens["color.surface.2"],
      progressTrack: tokens["color.line.strong"],
      accent: tokens["color.accent.default"],
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("home-card", this.position);
      this.$emit("home-card-focused", this.position);
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
      this.$emit("home-card-move", { position: this.position, delta: -1 });
    },
    right() {
      this.$emit("home-card-move", { position: this.position, delta: 1 });
    },
    up() {
      this.$emit("home-action-return");
    },
    menu() {
      this.$emit("home-card-hold", this.position);
    },
    enter() {
      if (!this.pressed) {
        this.pressed = true;
        this.holdFired = false;
        this.holdTimer = window.setTimeout(() => {
          this.holdFired = true;
          this.$emit("home-card-hold", this.position);
        }, 700);
      }
      return () => {
        clearTimeout(this.holdTimer);
        const activate = !this.holdFired;
        this.pressed = false;
        if (activate) this.$emit("home-card-activate", this.position);
      };
    },
  },

  render: (s) => (
    <TvView show={s.card.id !== ""} scale={s.focused ? 1.06 : 1}>
      <TvView
        x={-4}
        y={-4}
        w={328}
        h={188}
        rounded={20}
        color={s.white}
        show={s.focused}
      />
      <TvView w={320} h={180} rounded={16} color={s.surface} />
      <TvView
        w={320}
        h={180}
        rounded={16}
        src={s.card.image}
        show={s.card.image !== ""}
      />
      <TvView
        x={14}
        y={164}
        w={292}
        h={6}
        color={s.progressTrack}
        show={s.card.progress > 0}
      />
      <TvView
        x={14}
        y={164}
        w={Math.max(0, Math.min(292, s.card.progress * 292))}
        h={6}
        color={s.accent}
        show={s.card.progress > 0}
      />
      <TvText
        y={198}
        maxwidth={320}
        maxlines={1}
        content={s.titleText}
        font={"Onest700"}
        size={24}
        color={s.focused ? s.primary : s.primary}
      />
      <TvText
        y={s.focused ? 239 : 231}
        maxwidth={320}
        maxlines={1}
        content={s.subtitleText}
        font={"Onest"}
        size={20}
        color={s.secondary}
      />
    </TvView>
  ),
});
