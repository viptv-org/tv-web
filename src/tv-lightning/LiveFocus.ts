import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type { LiveChannelView, LiveFilterView, LiveProgramView } from "./liveModel";

export const LiveFilterChip = Blits.Component("LiveFilterChip", {
  props: ["position", "filter"] as unknown as { position: number; filter: LiveFilterView },
  template: `
    <Element :w="$filter.width" h="56">
      <Element x="-4" y="-4" :w="$filter.width + 8" h="64" rounded="32" color="$white" :show="$focused" />
      <Element :w="$filter.width" h="56" rounded="28" :color="$focused ? $primary : $filter.selected ? $selected : $clear" />
      <Text x="28" y="13" :content="$labelText" font="Onest700" size="24" :color="$focused ? $onLight : $filter.selected ? $primary : $secondary" :show="$filter.icon === ''" />
      <Element :x="($filter.width - 28) / 2" y="14" w="28" h="28" :src="$filter.icon" :show="$filter.icon !== ''" />
    </Element>
  `,
  state() {
    return {
      focused: false, labelText: "",
      white: tokens["color.fill.white"], primary: tokens["color.text.primary"],
      selected: tokens["color.fill.tv-selected"], onLight: tokens["color.on.light"],
      secondary: tokens["color.text.secondary"], clear: "rgba(0,0,0,0)",
    };
  },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("live-filter", this.position); this.$emit("live-filter-focused", this.position); },
    unfocus() { this.focused = false; },
  },
  methods: { reveal() { this.labelText = this.filter.label; } },
  input: {
    left() { this.$emit("live-filter-move", -1); },
    right() { this.$emit("live-filter-move", 1); },
    down() { this.$emit("live-enter-channels"); },
    enter() { return () => this.$emit("live-filter-activate"); },
  },
});

export const LiveChannel = Blits.Component("LiveChannel", {
  props: ["row", "channel"] as unknown as { row: number; channel: LiveChannelView },
  template: `
    <Element w="300" h="88">
      <Element x="-4" y="-4" w="308" h="96" rounded="20" color="$white" :show="$focused" />
      <Element w="300" h="88" rounded="16" :color="$focused ? $primary : $clear" />
      <Text x="18" y="30" :content="$numberText" font="Onest" size="18" :color="$focused ? $onLight : $tertiary" />
      <Element x="50" y="6" w="72" h="72" rounded="16" :color="$focused ? $lightBadge : $badge" />
      <Text x="55" y="31" maxwidth="62" align="center" :content="$monoText" font="Onest700" size="16" :color="$focused ? $onLight : $primary" />
      <Text x="140" y="29" maxwidth="160" maxlines="1" :content="$nameText" font="Onest600" size="22" :color="$focused ? $onLight : $primary" />
    </Element>
  `,
  state() {
    return {
      focused: false, numberText: "", monoText: "", nameText: "",
      white: tokens["color.fill.white"], primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"], tertiary: tokens["color.text.tertiary"],
      badge: tokens["color.surface.2"], lightBadge: tokens["color.fill.on-light-badge"],
      clear: "rgba(0,0,0,0)",
      pressed: false, holdFired: false, holdTimer: 0,
    };
  },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("guide-channel", this.row); this.$emit("guide-channel-focused", this.row); },
    unfocus() { this.focused = false; clearTimeout(this.holdTimer); },
    destroy() { clearTimeout(this.holdTimer); },
  },
  methods: { reveal() { this.numberText = this.channel.number; this.monoText = this.channel.monogram; this.nameText = this.channel.name; } },
  input: {
    up() { this.$emit("guide-channel-move", -1); },
    down() { this.$emit("guide-channel-move", 1); },
    left() { this.$emit("guide-channel-left"); },
    right() { this.$emit("guide-program-enter", this.row); },
    menu() { this.$emit("guide-channel-hold", this.row); },
    enter() {
      if (!this.pressed) {
        this.pressed = true; this.holdFired = false;
        this.holdTimer = window.setTimeout(() => { this.holdFired = true; this.$emit("guide-channel-hold", this.row); }, 700);
      }
      return () => {
        clearTimeout(this.holdTimer);
        const activate = !this.holdFired;
        this.pressed = false;
        if (activate) this.$emit("guide-channel-activate", this.row);
      };
    },
  },
});

export const LiveProgram = Blits.Component("LiveProgram", {
  props: ["position", "block"] as unknown as { position: number; block: LiveProgramView },
  template: `
    <Element :w="$block.width" h="88">
      <Element x="-4" y="-4" :w="$block.width + 8" h="96" rounded="20" color="$white" :show="$focused" />
      <Element :w="$block.width" h="88" rounded="16" :color="$focused ? $primary : $block.airing ? $airing : $upcoming" />
      <Text x="20" y="14" :content="$rangeText" font="Onest" size="18" :color="$focused ? $onLightSecondary : $tertiary" />
      <Text x="20" y="45" :maxwidth="$block.width - 40" maxlines="1" :content="$titleText" font="Onest600" size="24" :color="$focused ? $onLight : $primary" />
      <Element x="0" y="83" :w="$block.width * $block.progress" h="5" color="$accent" :show="$block.airing && !$focused" />
    </Element>
  `,
  state() {
    return {
      focused: false, rangeText: "", titleText: "",
      white: tokens["color.fill.white"], primary: tokens["color.text.primary"],
      tertiary: tokens["color.text.tertiary"], onLight: tokens["color.on.light"],
      onLightSecondary: tokens["color.text.on-light-secondary"],
      airing: tokens["color.guide.airing-tv"], upcoming: tokens["color.guide.upcoming-tv"],
      accent: tokens["color.accent.default"],
      pressed: false, holdFired: false, holdTimer: 0,
    };
  },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("guide-program", this.position); this.$emit("guide-program-focused", { row: this.block.row, index: this.block.index, position: this.position }); },
    unfocus() { this.focused = false; clearTimeout(this.holdTimer); },
    destroy() { clearTimeout(this.holdTimer); },
  },
  methods: { reveal() { this.rangeText = this.block.range; this.titleText = this.block.title; } },
  input: {
    left() { this.$emit("guide-program-move", { position: this.position, direction: "left" }); },
    right() { this.$emit("guide-program-move", { position: this.position, direction: "right" }); },
    up() { this.$emit("guide-program-move", { position: this.position, direction: "up" }); },
    down() { this.$emit("guide-program-move", { position: this.position, direction: "down" }); },
    menu() { this.$emit("guide-program-hold", this.position); },
    enter() {
      if (!this.pressed) {
        this.pressed = true; this.holdFired = false;
        this.holdTimer = window.setTimeout(() => { this.holdFired = true; this.$emit("guide-program-hold", this.position); }, 700);
      }
      return () => {
        clearTimeout(this.holdTimer);
        const activate = !this.holdFired;
        this.pressed = false;
        if (activate) this.$emit("guide-program-activate", this.position);
      };
    },
  },
});
