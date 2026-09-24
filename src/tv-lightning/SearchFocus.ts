import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type { SearchCardView, SearchKeyView } from "./searchModel";

export const SearchKey = Blits.Component("SearchKey", {
  props: ["position", "keyView"] as unknown as { position: number; keyView: SearchKeyView },
  template: `
    <Element :w="$keyView.width" h="64">
      <Element x="-10" y="-8" :w="$keyView.width + 20" h="80" rounded="18" color="$white" :show="$focused" />
      <Element :w="$keyView.width" h="64" rounded="14" :color="$focused ? $primary : $surface" />
      <Text x="0" y="13" :maxwidth="$keyView.width" align="center" :content="$labelText" font="Onest600" size="28" :color="$focused ? $onLight : $primary" :show="$keyView.action === 'character'" />
      <Element :x="($keyView.width - 28) / 2" y="18" w="28" h="28" :src="$focused ? $keyView.focusedIcon : $keyView.icon" :show="$keyView.action !== 'character'" />
    </Element>
  `,
  state() {
    return {
      focused: false, labelText: "",
      white: tokens["color.fill.white"], primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"], surface: tokens["color.fill.tv-field"],
    };
  },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("search-key", this.position); this.$emit("search-key-focused", this.position); },
    unfocus() { this.focused = false; },
  },
  methods: { reveal() { this.labelText = this.keyView.label; } },
  input: {
    left() { this.$emit("search-key-move", "left"); },
    right() { this.$emit("search-key-move", "right"); },
    up() { this.$emit("search-key-move", "up"); },
    down() { this.$emit("search-key-move", "down"); },
    back() { this.$emit("search-key-back"); },
    enter() { return () => this.$emit("search-key-activate"); },
    any(event: KeyboardEvent) {
      const code = event.keyCode;
      if (code >= 65 && code <= 90) this.$emit("search-physical-character", String.fromCharCode(code).toLowerCase());
      else if (code >= 48 && code <= 57) this.$emit("search-physical-character", String.fromCharCode(code));
      else if ([415, 10252, 417].includes(code)) this.$emit("search-jump-results");
    },
  },
});

/** Search uses the TV row tile: 320 × 180 art, with a caption below. */
export const SearchCard = Blits.Component("SearchCard", {
  props: ["position", "card"] as unknown as { position: number; card: SearchCardView },
  template: `
    <Element :show="$card.visible" w="320" h="270">
      <Element :x="$focused ? -10 : 0" :y="$focused ? -5 : 0" :scale="$focused ? 1.06 : 1">
        <Element x="-4" y="-4" w="328" h="188" rounded="20" color="$white" :show="$focused" />
        <Element w="320" h="180" rounded="16" color="$ground" />
        <Element w="320" h="180" rounded="16" fit="cover" :src="$card.image" :show="$card.image !== ''" />
        <Element x="14" y="14" w="69" h="32" rounded="10" color="$liveGround" :show="$card.live" />
        <Text x="22" y="18" :content="$liveLabel" font="Onest700" size="16" color="$white" :show="$card.live" />
        <Text x="0" y="60" maxwidth="320" align="center" :content="$monogramText" font="Bricolage700" size="48" color="$secondary" :show="$card.live && $card.image === ''" />
      </Element>
      <Text y="$focused ? 215 : 200" maxwidth="320" maxlines="1" :content="$titleText" font="Onest600" size="24" :color="$focused ? $primary : $body" />
      <Text y="$focused ? 250 : 234" maxwidth="320" maxlines="1" :content="$subtitleText" font="Onest" size="20" :color="$focused ? $secondary : $tertiary" />
    </Element>
  `,
  state() {
    return {
      focused: false, titleText: "", subtitleText: "", monogramText: "", liveLabel: "",
      pressed: false, holdFired: false, holdTimer: 0,
      white: tokens["color.fill.white"], ground: tokens["color.surface.1"],
      liveGround: tokens["color.status.live"], primary: tokens["color.text.primary"],
      body: tokens["color.text.body"], secondary: tokens["color.text.secondary"],
      tertiary: tokens["color.text.tertiary"],
    };
  },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("search-card", this.position); this.$emit("search-card-focused", this.position); },
    unfocus() { this.focused = false; clearTimeout(this.holdTimer); },
    destroy() { clearTimeout(this.holdTimer); },
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
    left() { this.$emit("search-card-move", "left"); },
    right() { this.$emit("search-card-move", "right"); },
    up() { this.$emit("search-card-move", "up"); },
    down() { this.$emit("search-card-move", "down"); },
    back() { this.$emit("search-card-back"); },
    menu() { this.$emit("search-card-hold", this.position); },
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
});
