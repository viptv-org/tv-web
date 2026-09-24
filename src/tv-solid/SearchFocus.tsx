/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type { SearchCardView, SearchKeyView } from "./searchModel";

export const SearchKey = defineScreen({
  props: ["position", "keyView"] as unknown as {
    position: number;
    keyView: SearchKeyView;
  },

  state() {
    return {
      focused: false,
      labelText: "",
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"],
      surface: tokens["color.fill.tv-field"],
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("search-key", this.position);
      this.$emit("search-key-focused", this.position);
    },
    unfocus() {
      this.focused = false;
    },
  },
  methods: {
    reveal() {
      this.labelText = this.keyView.label;
    },
  },
  input: {
    left() {
      this.$emit("search-key-move", "left");
    },
    right() {
      this.$emit("search-key-move", "right");
    },
    up() {
      this.$emit("search-key-move", "up");
    },
    down() {
      this.$emit("search-key-move", "down");
    },
    back() {
      this.$emit("search-key-back");
    },
    enter() {
      return () => this.$emit("search-key-activate");
    },
    any(event: KeyboardEvent) {
      const code = event.keyCode;
      if (code >= 65 && code <= 90)
        this.$emit(
          "search-physical-character",
          String.fromCharCode(code).toLowerCase(),
        );
      else if (code >= 48 && code <= 57)
        this.$emit("search-physical-character", String.fromCharCode(code));
      else if ([415, 10252, 417].includes(code))
        this.$emit("search-jump-results");
    },
  },

  render: (s) => (
    <TvView w={s.keyView.width} h={64}>
      <TvView
        x={-10}
        y={-8}
        w={s.keyView.width + 20}
        h={80}
        rounded={18}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={s.keyView.width}
        h={64}
        rounded={14}
        color={s.focused ? s.primary : s.surface}
      />
      <TvText
        x={0}
        y={13}
        maxwidth={s.keyView.width}
        align={"center"}
        content={s.labelText}
        font={"Onest600"}
        size={28}
        color={s.focused ? s.onLight : s.primary}
        show={s.keyView.action === "character"}
      />
      <TvView
        x={(s.keyView.width - 28) / 2}
        y={18}
        w={28}
        h={28}
        src={s.focused ? s.keyView.focusedIcon : s.keyView.icon}
        show={s.keyView.action !== "character"}
      />
    </TvView>
  ),
});

/** Search uses the TV row tile: 320 × 180 art, with a caption below. */
export const SearchCard = defineScreen({
  props: ["position", "card"] as unknown as {
    position: number;
    card: SearchCardView;
  },

  state() {
    return {
      focused: false,
      titleText: "",
      subtitleText: "",
      monogramText: "",
      liveLabel: "",
      pressed: false,
      holdFired: false,
      holdTimer: 0,
      white: tokens["color.fill.white"],
      ground: tokens["color.surface.1"],
      liveGround: tokens["color.status.live"],
      primary: tokens["color.text.primary"],
      body: tokens["color.text.body"],
      secondary: tokens["color.text.secondary"],
      tertiary: tokens["color.text.tertiary"],
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("search-card", this.position);
      this.$emit("search-card-focused", this.position);
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
      this.monogramText = this.card.monogram;
      this.liveLabel = this.card.live ? "LIVE" : "";
    },
  },
  input: {
    left() {
      this.$emit("search-card-move", "left");
    },
    right() {
      this.$emit("search-card-move", "right");
    },
    up() {
      this.$emit("search-card-move", "up");
    },
    down() {
      this.$emit("search-card-move", "down");
    },
    back() {
      this.$emit("search-card-back");
    },
    menu() {
      this.$emit("search-card-hold", this.position);
    },
    enter() {
      if (!this.pressed) {
        this.pressed = true;
        this.holdFired = false;
        this.holdTimer = window.setTimeout(() => {
          this.holdFired = true;
          this.$emit("search-card-hold", this.position);
        }, 700);
      }
      return () => {
        clearTimeout(this.holdTimer);
        const activate = !this.holdFired;
        this.pressed = false;
        if (activate) this.$emit("search-card-activate");
      };
    },
  },

  render: (s) => (
    <TvView show={s.card.visible} w={320} h={270}>
      <TvView
        x={s.focused ? -10 : 0}
        y={s.focused ? -5 : 0}
        scale={s.focused ? 1.06 : 1}
      >
        <TvView
          x={-4}
          y={-4}
          w={328}
          h={188}
          rounded={20}
          color={s.white}
          show={s.focused}
        />
        <TvView w={320} h={180} rounded={16} color={s.ground} />
        <TvView
          w={320}
          h={180}
          rounded={16}
          fit={"cover"}
          src={s.card.image}
          show={s.card.image !== ""}
        />
        <TvView
          x={14}
          y={14}
          w={69}
          h={32}
          rounded={10}
          color={s.liveGround}
          show={s.card.live}
        />
        <TvText
          x={22}
          y={18}
          content={s.liveLabel}
          font={"Onest700"}
          size={16}
          color={s.white}
          show={s.card.live}
        />
        <TvText
          x={0}
          y={60}
          maxwidth={320}
          align={"center"}
          content={s.monogramText}
          font={"Bricolage700"}
          size={48}
          color={s.secondary}
          show={s.card.live && s.card.image === ""}
        />
      </TvView>
      <TvText
        y={s.focused ? 215 : 200}
        maxwidth={320}
        maxlines={1}
        content={s.titleText}
        font={"Onest600"}
        size={24}
        color={s.focused ? s.primary : s.body}
      />
      <TvText
        y={s.focused ? 250 : 234}
        maxwidth={320}
        maxlines={1}
        content={s.subtitleText}
        font={"Onest"}
        size={20}
        color={s.focused ? s.secondary : s.tertiary}
      />
    </TvView>
  ),
});
