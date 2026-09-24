import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type { DiscoverCardView, DiscoverChipView } from "./discoverModel";

/** Focusable type, catalog or filter chip in the TV Discover header. */
export const DiscoverChip = Blits.Component("DiscoverChip", {
  props: ["position", "chip"] as unknown as { position: number; chip: DiscoverChipView },
  template: `
    <Element :show="$chip.visible" :w="$chip.width" h="56">
      <Element x="-4" y="-4" :w="$chip.width + 8" h="64" rounded="32" color="$white" :show="$focused" />
      <Element :w="$chip.width" h="56" rounded="28" :color="$focused ? $primary : $chip.selected ? $selected : $clear" />
      <Text x="28" y="13" :content="$labelText" font="Onest700" size="24" :color="$focused ? $onLight : $chip.selected ? $primary : $secondary" />
    </Element>
  `,
  state() {
    return {
      focused: false, labelText: "",
      white: tokens["color.fill.white"], primary: tokens["color.text.primary"],
      secondary: tokens["color.text.secondary"], onLight: tokens["color.on.light"],
      selected: tokens["color.fill.tv-selected"], clear: "rgba(0,0,0,0)",
    };
  },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("discover-chip", this.position); this.$emit("discover-chip-focused", this.position); },
    unfocus() { this.focused = false; },
  },
  methods: { reveal() { this.labelText = this.chip.label; } },
  input: {
    left() { this.$emit("discover-chip-move", -1); },
    right() { this.$emit("discover-chip-move", 1); },
    down() { this.$emit("discover-card-enter"); },
    enter() { return () => this.$emit("discover-chip-activate"); },
  },
});

/** One 360 × 202 TV grid tile with real Blits focus and a separate caption. */
export const DiscoverCard = Blits.Component("DiscoverCard", {
  props: ["position", "card"] as unknown as { position: number; card: DiscoverCardView },
  template: `
    <Element :show="$card.id !== ''">
      <Element :x="$focused ? -11 : 0" :y="$focused ? -6 : 0" :scale="$focused ? 1.06 : 1">
        <Element x="-4" y="-4" w="368" h="210" rounded="20" color="$white" :show="$focused" />
        <Element w="360" h="202" rounded="16" color="$ground" />
        <Element w="360" h="202" rounded="16" :src="$card.image" :show="$card.image !== ''" />
      </Element>
      <Text y="$focused ? 232 : 224" maxwidth="360" maxlines="1" :content="$titleText" font="Onest600" size="24" :color="$focused ? $primary : $body" />
      <Text y="$focused ? 270 : 260" maxwidth="360" maxlines="1" :content="$subtitleText" font="Onest" size="20" :color="$focused ? $secondary : $tertiary" />
    </Element>
  `,
  state() {
    return {
      focused: false, titleText: "", subtitleText: "",
      white: tokens["color.fill.white"], ground: tokens["color.surface.1"],
      primary: tokens["color.text.primary"], body: tokens["color.text.body"],
      secondary: tokens["color.text.secondary"], tertiary: tokens["color.text.tertiary"],
    };
  },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("discover-card", this.position); this.$emit("discover-card-focused", this.position); },
    unfocus() { this.focused = false; },
  },
  methods: { reveal() { this.titleText = this.card.title; this.subtitleText = this.card.subtitle; } },
  input: {
    left() { this.$emit("discover-card-move", "left"); },
    right() { this.$emit("discover-card-move", "right"); },
    up() { this.$emit("discover-card-move", "up"); },
    down() { this.$emit("discover-card-move", "down"); },
    enter() { return () => this.$emit("discover-card-activate"); },
  },
});

export const DiscoverFilterOption = Blits.Component("DiscoverFilterOption", {
  props: ["position", "label", "selected", "visible"] as unknown as {
    position: number; label: string; selected: boolean; visible: boolean;
  },
  template: `
    <Element :show="$visible" w="672" h="82">
      <Element x="-4" y="-5" w="680" h="90" rounded="28" color="$white" :show="$focused" />
      <Element w="672" h="82" rounded="24" :color="$focused ? $primary : $clear" />
      <Text x="28" y="25" :content="$labelText" font="Onest600" size="26" :color="$focused ? $onLight : $primary" />
    </Element>
  `,
  state() {
    return {
      focused: false, labelText: "",
      white: tokens["color.fill.white"], primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"], clear: "rgba(0,0,0,0)",
    };
  },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("discover-filter-option", this.position); this.$emit("discover-option-focused", this.position); },
    unfocus() { this.focused = false; },
  },
  methods: { reveal() { this.labelText = this.selected ? `${this.label} · Current` : this.label; } },
  input: {
    up() { this.$emit("discover-option-move", -1); },
    down() { this.$emit("discover-option-move", 1); },
    enter() { return () => this.$emit("discover-option-activate"); },
    back() { this.$emit("discover-option-close"); },
  },
});
