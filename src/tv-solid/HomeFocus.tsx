/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import type { HomeCardView } from "./homeModel";
import { noteFocus } from "./focusDebug";
import { vectorIcon, type VectorIcon } from "./vectorIcons";

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
      iconSource: "",
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
      const name: VectorIcon = this.action === "play" ? "play"
        : this.action === "details" ? "info"
        : this.icon === "✓" ? "check" : "plus";
      this.iconSource = vectorIcon(name,this.focused?this.onLight:this.primary,this.round?34:30);
    },
  },
  watch: { focused() { this.reveal(); }, icon() { this.reveal(); } },
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
    menu() {
      if (this.holdable) this.$emit("home-action-hold", this.action);
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
    <TvView w={s.buttonWidth} h={s.buttonHeight} scale={s.focused ? tokens["focus.tv-scale-button"] : 1}>
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
        color={s.focused ? s.primary : tokens["color.fill.tv-unfocused"]}
      />
      <TvView x={s.round ? 19 : 34} y={s.buttonHeight / 2 - (s.round ? 17 : 15)} w={s.round ? 34 : 30} h={s.round ? 34 : 30} fit="contain" src={s.iconSource} />
      <TvText
        x={s.action === "details" ? 34 : 72}
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
  props: ["position", "card", "shelf"] as unknown as {
    position: number;
    card: HomeCardView;
    shelf: number;
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
      noteFocus("home-card", this.shelf === 0 ? this.position : 1000 + this.shelf * 100 + this.position);
      this.$emit("home-card-focused", { shelf: this.shelf, position: this.position });
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
      this.$emit("home-card-move", { shelf: this.shelf, position: this.position, delta: -1 });
    },
    right() {
      this.$emit("home-card-move", { shelf: this.shelf, position: this.position, delta: 1 });
    },
    up() {
      this.$emit("home-shelf-up", { shelf: this.shelf, position: this.position });
    },
    down() {
      this.$emit("home-shelf-down", { shelf: this.shelf, position: this.position });
    },
    menu() {
      this.$emit("home-card-hold", { shelf: this.shelf, position: this.position });
    },
    enter() {
      if (!this.pressed) {
        this.pressed = true;
        this.holdFired = false;
        this.holdTimer = window.setTimeout(() => {
          this.holdFired = true;
          this.$emit("home-card-hold", { shelf: this.shelf, position: this.position });
        }, 700);
      }
      return () => {
        clearTimeout(this.holdTimer);
        const activate = !this.holdFired;
        this.pressed = false;
        if (activate) this.$emit("home-card-activate", { shelf: this.shelf, position: this.position });
      };
    },
  },

  render: (s) => (
    <TvView show={s.card.id !== ""}>
      <TvView w={320} h={180} scale={s.focused ? 1.06 : 1}>
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
        rounded={3}
        color={s.progressTrack}
        show={s.card.progress > 0}
      />
      <TvView
        x={14}
        y={164}
        w={Math.max(0, Math.min(292, s.card.progress * 292))}
        h={6}
        rounded={3}
        color={s.accent}
        show={s.card.progress > 0}
      />
      </TvView>
      <TvText
        y={s.focused ? 204 : 196}
        lineheight={1.3}
        cssLineBox={true}
        maxwidth={320}
        maxlines={1}
        content={s.titleText}
        font={"Onest600"}
        size={24}
        color={s.focused ? s.primary : s.primary}
      />
      <TvText
        y={s.focused ? 239.1875 : 231.1875}
        lineheight={1.35}
        cssLineBox={true}
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
