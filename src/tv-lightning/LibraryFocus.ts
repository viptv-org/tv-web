import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type { DiscoverCardView } from "./discoverModel";

export const LibrarySegment = Blits.Component("LibrarySegment", {
  props: ["position", "label", "selected", "width"] as unknown as {
    position: number; label: string; selected: boolean; width: number;
  },
  template: `
    <Element :w="$width" h="56">
      <Element x="-4" y="-4" :w="$width + 8" h="64" rounded="32" color="$white" :show="$focused" />
      <Element :w="$width" h="56" rounded="28" :color="$focused ? $primary : $selected ? $selectedGround : $clear" />
      <Text x="28" y="13" :content="$labelText" font="Onest700" size="24" :color="$focused ? $onLight : $selected ? $primary : $secondary" />
    </Element>
  `,
  state() {
    return {
      focused: false, labelText: "",
      white: tokens["color.fill.white"], primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"], secondary: tokens["color.text.secondary"],
      selectedGround: tokens["color.fill.tv-selected"], clear: "rgba(0,0,0,0)",
    };
  },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("library-segment", this.position); this.$emit("library-segment-focused", this.position); },
    unfocus() { this.focused = false; },
  },
  methods: { reveal() { this.labelText = this.label; } },
  input: {
    left() { this.$emit("library-segment-move", -1); },
    right() { this.$emit("library-segment-move", 1); },
    down() { this.$emit("library-card-enter"); },
    enter() { return () => this.$emit("library-segment-activate"); },
  },
});

export const LibraryCard = Blits.Component("LibraryCard", {
  props: ["position", "card"] as unknown as { position: number; card: DiscoverCardView },
  template: `
    <Element :show="$card.id !== ''">
      <Element :x="$focused ? -11 : 0" :y="$focused ? -6 : 0" :scale="$focused ? 1.06 : 1">
        <Element x="-4" y="-4" w="368" h="210" rounded="20" color="$white" :show="$focused" />
        <Element w="360" h="202" rounded="16" color="$ground" />
        <Element w="360" h="202" rounded="16" fit="cover" :src="$card.image" :show="$card.image !== ''" />
        <Element x="14" y="184" w="332" h="6" rounded="3" color="$track" :show="$card.progress > 0" />
        <Element x="14" y="184" :w="Math.max(0, Math.min(332, $card.progress * 332))" h="6" rounded="3" color="$accent" :show="$card.progress > 0" />
      </Element>
      <Text y="$focused ? 235 : 219" maxwidth="360" maxlines="1" :content="$titleText" font="Onest600" size="24" :color="$focused ? $primary : $body" />
      <Text y="$focused ? 274 : 255" maxwidth="360" maxlines="1" :content="$subtitleText" font="Onest" size="20" :color="$focused ? $secondary : $tertiary" />
    </Element>
  `,
  state() {
    return {
      focused: false, titleText: "", subtitleText: "",
      pressed: false, holdFired: false, holdTimer: 0,
      white: tokens["color.fill.white"], ground: tokens["color.surface.1"],
      primary: tokens["color.text.primary"], body: tokens["color.text.body"],
      secondary: tokens["color.text.secondary"], tertiary: tokens["color.text.tertiary"],
      track: tokens["color.line.strong"], accent: tokens["color.accent.default"],
    };
  },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("library-card", this.position); this.$emit("library-card-focused", this.position); },
    unfocus() { this.focused = false; clearTimeout(this.holdTimer); },
    destroy() { clearTimeout(this.holdTimer); },
  },
  methods: { reveal() { this.titleText = this.card.title; this.subtitleText = this.card.subtitle; } },
  input: {
    left() { this.$emit("library-card-move", "left"); },
    right() { this.$emit("library-card-move", "right"); },
    up() { this.$emit("library-card-move", "up"); },
    down() { this.$emit("library-card-move", "down"); },
    menu() { this.$emit("library-card-hold", this.position); },
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
});
