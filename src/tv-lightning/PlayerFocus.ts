import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type { TrackChoiceView } from "./trackModel";

export const PlayerControl = Blits.Component("PlayerControl", {
  props: ["position", "action", "icon", "diameter"] as unknown as {
    position: number; action: string; icon: string; diameter: number;
  },
  template: `
    <Element :w="$diameter" :h="$diameter">
      <Element x="-4" y="-4" :w="$diameter + 8" :h="$diameter + 8" :rounded="$diameter / 2 + 4" color="$white" :show="$focused" />
      <Element :w="$diameter" :h="$diameter" :rounded="$diameter / 2" :color="$focused ? $primary : $surface" />
      <Text :x="$diameter / 2 - 18" :y="$diameter / 2 - 23" :content="$iconText" font="Onest700" size="36" :color="$focused ? $onLight : $primary" />
    </Element>
  `,
  state() {
    return {
      focused: false, iconText: "",
      white: tokens["color.fill.white"], primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"], surface: tokens["color.surface.3"],
    };
  },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("player-control", this.position); },
    unfocus() { this.focused = false; },
  },
  methods: { reveal() { this.iconText = this.icon; } },
  watch: { icon(value: string) { this.iconText = value; } },
  input: {
    left() { this.$emit("player-control-move", -1); },
    right() { this.$emit("player-control-move", 1); },
    up() { this.$emit("player-timeline-focus"); },
    enter() { return () => this.$emit("player-control-activate", this.action); },
  },
});

export const PlayerTimeline = Blits.Component("PlayerTimeline", {
  props: ["progress", "seeking", "previewText"] as unknown as {
    progress: number; seeking: boolean; previewText: string;
  },
  template: `
    <Element w="1728" h="42">
      <Element :y="$seeking ? 12 : 15" w="1728" :h="$seeking ? 12 : 6" rounded="6" color="$track" />
      <Element :y="$seeking ? 12 : 15" :w="Math.max(0, Math.min(1728, $progress * 1728))" :h="$seeking ? 12 : 6" rounded="6" color="$accent" />
      <Element :x="Math.max(0, Math.min(1688, $progress * 1728 - 20))" y="-2" w="40" h="40" rounded="20" color="$white" :show="$seeking" />
      <Element :x="Math.max(0, Math.min(1596, $progress * 1728 - 66))" y="-67" w="132" h="52" rounded="26" color="$bubble" :show="$seeking" />
      <Text :x="Math.max(0, Math.min(1596, $progress * 1728 - 66))" y="-55" maxwidth="132" align="center" :content="$previewText" font="Onest700" size="28" color="$white" :show="$seeking" />
    </Element>
  `,
  state() {
    return {
      focused: false,
      track: tokens["color.line.strong"], accent: tokens["color.accent.default"],
      white: tokens["color.fill.white"], bubble: tokens["color.surface.1"],
    };
  },
  hooks: {
    focus() { this.focused = true; noteFocus("player-timeline", 0); },
    unfocus() { this.focused = false; },
  },
  input: {
    left() { this.$emit("player-seek-preview", -10); },
    right() { this.$emit("player-seek-preview", 30); },
    down() { this.$emit("player-controls-return"); },
    enter() { return () => this.$emit("player-seek-commit"); },
  },
});

/** Focusable row in the TV audio/subtitles right panel. */
export const PlayerTrackOption = Blits.Component("PlayerTrackOption", {
  props: ["position", "choice"] as unknown as { position: number; choice: TrackChoiceView },
  template: `
    <Element w="660" h="80" :show="$choice.id !== ''">
      <Element x="-11" y="-4" w="682" h="88" rounded="23" color="$white" :show="$focused" />
      <Element w="660" h="80" rounded="20" :color="$focused ? $primary : $background" />
      <Text x="24" y="25" :content="$caption" font="Onest700" size="26" :color="$focused ? $onLight : $choice.available ? $primary : $secondary" />
      <Text :x="$suffixX" y="25" :content="$suffix" font="Onest" size="26" :color="$focused ? $onLightSecondary : $secondary" />
    </Element>
  `,
  state() {
    return {
      focused: false, caption: "", suffix: "", suffixX: 110,
      white: tokens["color.fill.white"], primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"], secondary: tokens["color.text.secondary"],
      onLightSecondary: tokens["color.text.on-light-secondary"],
      background: tokens["color.surface.1"],
    };
  },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("player-track-option", this.position); },
    unfocus() { this.focused = false; },
  },
  methods: {
    reveal() {
      this.caption = this.choice.label;
      this.suffix = this.choice.current ? "· Current" : !this.choice.available ? "· unavailable" : "";
      this.suffixX = Math.max(78, 24 + this.choice.label.length * 15);
    },
  },
  watch: {
    choice(value: TrackChoiceView) {
      this.caption = value.label;
      this.suffix = value.current ? "· Current" : !value.available ? "· unavailable" : "";
      this.suffixX = Math.max(78, 24 + value.label.length * 15);
    },
  },
  input: {
    up() { this.$emit("player-track-move", -1); },
    down() { this.$emit("player-track-move", 1); },
    enter() { return () => this.$emit("player-track-activate", this.position); },
  },
});
