/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText, KeyedFor } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type { TrackChoiceView } from "./trackModel";
import { actionIcon, type ActionIcon } from "./actionIcons";
const CONTROL_ICON = parseFloat(tokens["size.icon.tv"]);

export const PlayerControl = defineScreen({
  props: ["position", "action", "icon", "diameter"] as unknown as {
    position: number;
    action: string;
    icon: string;
    diameter: number;
  },

  state() {
    return {
      focused: false,
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
      noteFocus("player-control", this.position);
    },
    unfocus() {
      this.focused = false;
    },
  },
  methods: {
    reveal() {
      const icon: ActionIcon = this.action === "back10" ? "back10"
        : this.action === "forward30" ? "forward30"
        : this.action === "next" ? "next"
        : this.action === "audio" ? "audio"
        : this.action === "subtitles" ? "captions"
        : this.action === "exit" ? "exit"
        : this.action === "info" ? "info"
        : this.icon === "Ⅱ" ? "pause" : "play";
      this.iconSource = actionIcon(icon, this.focused);
    },
  },
  watch: {
    icon() {
      this.reveal();
    },
    focused() {
      this.reveal();
    },
  },
  input: {
    left() {
      this.$emit("player-control-move", -1);
    },
    right() {
      this.$emit("player-control-move", 1);
    },
    up() {
      this.$emit("player-timeline-focus");
    },
    enter() {
      return () => this.$emit("player-control-activate", this.action);
    },
  },

  render: (s) => (
    <TvView w={s.diameter} h={s.diameter}>
      <TvView
        x={-4}
        y={-4}
        w={s.diameter + 8}
        h={s.diameter + 8}
        rounded={s.diameter / 2 + 4}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={s.diameter}
        h={s.diameter}
        rounded={s.diameter / 2}
        color={s.focused ? s.primary : s.surface}
      />
      <TvView x={(s.diameter-CONTROL_ICON)/2} y={(s.diameter-CONTROL_ICON)/2} w={CONTROL_ICON} h={CONTROL_ICON} fit="contain" src={s.iconSource} />
    </TvView>
  ),
});

export const PlayerTimeline = defineScreen({
  props: ["progress", "seeking", "previewText", "buffered"] as unknown as {
    progress: number;
    buffered: {start:number;end:number}[];
    seeking: boolean;
    previewText: string;
  },

  state() {
    return {
      focused: false,
      track: tokens["color.line.strong"],
      accent: tokens["color.accent.default"],
      white: tokens["color.fill.white"],
      bubble: tokens["color.surface.1"],
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      noteFocus("player-timeline", 0);
    },
    unfocus() {
      this.focused = false;
    },
  },
  input: {
    left() {
      this.$emit("player-seek-preview", -10);
    },
    right() {
      this.$emit("player-seek-preview", 30);
    },
    down() {
      this.$emit("player-controls-return");
    },
    enter() {
      return () => this.$emit("player-seek-commit");
    },
  },

  render: (s) => (
    <TvView w={1728} h={42}>
      <TvView
        y={s.seeking ? 12 : 15}
        w={1728}
        h={s.seeking ? 12 : 6}
        rounded={6}
        color={s.track}
      />
      {/* Engine-reported buffered ranges: a lighter fill under the played
          bar, never on top of it (explicit z-order, not insertion order). */}
      <KeyedFor each={s.buffered??[]} keyOf={range=>range.start}>{range=><TvView
        x={range().start*1728} y={s.seeking?12:15} w={(range().end-range().start)*1728}
        h={s.seeking?12:6} rounded={s.seeking?6:3} color={tokens["color.line.control"]}/>}</KeyedFor>
      <TvView
        y={s.seeking ? 12 : 15}
        w={Math.max(0, Math.min(1728, s.progress * 1728))}
        h={s.seeking ? 12 : 6}
        rounded={6}
        color={s.accent}
        zIndex={1}
      />
      <TvView
        x={Math.max(0, Math.min(1688, s.progress * 1728 - 20))}
        y={-2}
        w={40}
        h={40}
        rounded={20}
        color={s.white}
        show={s.focused || s.seeking}
        zIndex={2}
      />
      <TvView
        x={Math.max(0, Math.min(1596, s.progress * 1728 - 66))}
        y={-67}
        w={132}
        h={52}
        rounded={26}
        color={s.bubble}
        show={s.seeking}
      />
      <TvText
        x={Math.max(0, Math.min(1596, s.progress * 1728 - 66))}
        y={-55}
        maxwidth={132}
        align={"center"}
        content={s.previewText}
        font={"Onest700"}
        size={28}
        color={s.white}
        show={s.seeking}
      />
    </TvView>
  ),
});

/** Focusable row in the TV audio/subtitles right panel. */
export const PlayerTrackOption = defineScreen({
  props: ["position", "choice"] as unknown as {
    position: number;
    choice: TrackChoiceView;
  },

  state() {
    return {
      focused: false,
      caption: "",
      suffix: "",
      suffixX: 110,
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"],
      secondary: tokens["color.text.secondary"],
      onLightSecondary: tokens["color.text.on-light-secondary"],
      background: tokens["color.surface.1"],
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("player-track-option", this.position);
    },
    unfocus() {
      this.focused = false;
    },
  },
  methods: {
    reveal() {
      this.caption = this.choice.label;
      this.suffix = this.choice.current
        ? "· Current"
        : !this.choice.available
          ? "· unavailable"
          : "";
      this.suffixX = Math.max(78, 24 + this.choice.label.length * 15);
    },
  },
  watch: {
    choice(value: TrackChoiceView) {
      this.caption = value.label;
      this.suffix = value.current
        ? "· Current"
        : !value.available
          ? "· unavailable"
          : "";
      this.suffixX = Math.max(78, 24 + value.label.length * 15);
    },
  },
  input: {
    up() {
      this.$emit("player-track-move", -1);
    },
    down() {
      this.$emit("player-track-move", 1);
    },
    enter() {
      return () => this.$emit("player-track-activate", this.position);
    },
  },

  render: (s) => (
    <TvView w={660} h={80} show={s.choice.id !== ""}>
      <TvView
        x={-11}
        y={-4}
        w={682}
        h={88}
        rounded={23}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={660}
        h={80}
        rounded={20}
        color={s.focused ? s.primary : s.background}
      />
      <TvText
        x={24}
        y={25}
        content={s.caption}
        font={"Onest700"}
        size={26}
        color={
          s.focused ? s.onLight : s.choice.available ? s.primary : s.secondary
        }
      />
      <TvText
        x={s.suffixX}
        y={25}
        content={s.suffix}
        font={"Onest"}
        size={26}
        color={s.focused ? s.onLightSecondary : s.secondary}
      />
    </TvView>
  ),
});
