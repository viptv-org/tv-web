import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";

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
