/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import type { DetailEpisodeView } from "./detailModel";
import { noteFocus } from "./focusDebug";

/** Focus-owning title action; Play alone has the 700 ms secondary action. */
export const TitleAction = defineScreen({
  props: [
    "position",
    "action",
    "label",
    "icon",
    "buttonWidth",
    "holdable",
  ] as unknown as {
    position: number;
    action: string;
    label: string;
    icon: string;
    buttonWidth: number;
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
      noteFocus("title-action", this.position);
      this.$emit("title-action-focused", this.position);
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
      this.$emit("title-action-move", -1);
    },
    right() {
      this.$emit("title-action-move", 1);
    },
    down() {
      this.$emit("title-episodes-enter");
    },
    enter() {
      if (!this.pressed) {
        this.pressed = true;
        this.holdFired = false;
        if (this.holdable)
          this.holdTimer = window.setTimeout(() => {
            this.holdFired = true;
            this.$emit("title-action-hold", this.action);
          }, 700);
      }
      return () => {
        clearTimeout(this.holdTimer);
        const activate = !this.holdFired;
        this.pressed = false;
        if (activate) this.$emit("title-action-activate", this.action);
      };
    },
  },

  render: (s) => (
    <TvView w={s.buttonWidth} h={72}>
      <TvView
        x={-4}
        y={-4}
        w={s.buttonWidth + 8}
        h={80}
        rounded={40}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={s.buttonWidth}
        h={72}
        rounded={36}
        color={s.focused ? s.primary : s.surface}
      />
      <TvText
        x={32}
        y={18}
        content={s.iconText}
        font={"Onest"}
        size={28}
        color={s.focused ? s.onLight : s.primary}
      />
      <TvText
        x={s.icon === "" ? 34 : 78}
        y={18}
        content={s.labelText}
        font={"Onest700"}
        size={26}
        color={s.focused ? s.onLight : s.primary}
      />
    </TvView>
  ),
});

/** Episode row uses real SolidTV component focus and release activation. */
export const EpisodeTile = defineScreen({
  props: ["position", "episode"] as unknown as {
    position: number;
    episode: DetailEpisodeView;
  },

  state() {
    return {
      focused: false,
      watchingText: "",
      numberText: "",
      titleText: "",
      synopsisText: "",
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      secondary: tokens["color.text.secondary"],
      surface: tokens["color.surface.2"],
      progressTrack: tokens["color.line.strong"],
      badgeGround: tokens["color.fill.watching-badge"],
      accent: tokens["color.accent.default"],
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("title-episode", this.position);
      this.$emit("title-episode-focused", this.position);
    },
    unfocus() {
      this.focused = false;
    },
  },
  methods: {
    reveal() {
      this.watchingText = this.episode.watching ? "WATCHING" : "";
      this.numberText = this.episode.number;
      this.titleText = this.episode.title;
      this.synopsisText = this.episode.synopsis;
    },
  },
  input: {
    left() {
      this.$emit("title-episode-move", -1);
    },
    right() {
      this.$emit("title-episode-move", 1);
    },
    up() {
      this.$emit("title-actions-return");
    },
    enter() {
      return () => this.$emit("title-episode-activate", this.position);
    },
  },

  render: (s) => (
    <TvView show={s.episode.item !== null} scale={s.focused ? 1.06 : 1}>
      <TvView
        x={-4}
        y={-4}
        w={368}
        h={208}
        rounded={18}
        color={s.white}
        show={s.focused}
      />
      <TvView w={360} h={200} rounded={14} color={s.surface} />
      <TvView
        w={360}
        h={200}
        rounded={14}
        src={s.episode.image}
        show={s.episode.image !== ""}
      />
      <TvView
        x={14}
        y={178}
        w={332}
        h={6}
        color={s.progressTrack}
        show={s.episode.progress > 0}
      />
      <TvView
        x={14}
        y={178}
        w={Math.max(0, Math.min(332, s.episode.progress * 332))}
        h={6}
        color={s.accent}
        show={s.episode.progress > 0}
      />
      <TvView
        x={14}
        y={14}
        w={130}
        h={30}
        rounded={15}
        color={s.badgeGround}
        show={s.episode.watching}
      />
      <TvText
        x={25}
        y={17}
        content={s.watchingText}
        font={"Onest700"}
        size={16}
        color={s.white}
        show={s.episode.watching}
      />
      <TvText
        y={219}
        content={s.numberText}
        font={"Onest700"}
        size={18}
        color={s.secondary}
      />
      <TvText
        y={250}
        maxwidth={360}
        maxlines={1}
        content={s.titleText}
        font={"Onest700"}
        size={24}
        color={s.primary}
      />
      <TvText
        y={299}
        maxwidth={360}
        maxlines={2}
        content={s.synopsisText}
        font={"Onest"}
        size={20}
        color={s.secondary}
      />
    </TvView>
  ),
});
