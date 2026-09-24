import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import type { HomeCardView } from "./homeModel";

/** A focus-owning Lightning action. Selection fires on remote key release. */
export const HomeAction = Blits.Component("HomeAction", {
  props: ["position", "action", "label", "icon", "buttonWidth", "buttonHeight", "round", "holdable"] as unknown as {
    position: number; action: string; label: string; icon: string;
    buttonWidth: number; buttonHeight: number; round: boolean; holdable: boolean;
  },
  template: `
    <Element :w="$buttonWidth" :h="$buttonHeight">
      <Element x="-4" y="-4" :w="$buttonWidth + 8" :h="$buttonHeight + 8" :rounded="$buttonHeight / 2 + 4" color="$white" :show="$focused" />
      <Element :w="$buttonWidth" :h="$buttonHeight" :rounded="$buttonHeight / 2" :color="$focused ? $primary : $surface" />
      <Text :x="$round ? 20 : $action === 'details' ? 33 : 45" :y="$buttonHeight / 2 - 17" :content="$iconText" font="Onest" :size="$round ? 38 : 27" :color="$focused ? $onLight : $primary" />
      <Text :x="$action === 'details' ? 33 : 81" :y="$buttonHeight / 2 - 16" :content="$labelText" font="Onest700" size="26" :color="$focused ? $onLight : $primary" :show="!$round" />
    </Element>
  `,
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
    focus() { this.focused = true; this.reveal(); this.$emit("home-action-focused", this.position); },
    unfocus() { this.focused = false; clearTimeout(this.holdTimer); },
    destroy() { clearTimeout(this.holdTimer); },
  },
  methods: {
    reveal() { this.labelText = this.label; this.iconText = this.icon; },
  },
  input: {
    left() { this.$emit("home-action-move", { position: this.position, delta: -1 }); },
    right() { this.$emit("home-action-move", { position: this.position, delta: 1 }); },
    down() { this.$emit("home-cards-enter"); },
    enter() {
      if (!this.pressed) {
        this.pressed = true;
        this.holdFired = false;
        if (this.holdable) this.holdTimer = window.setTimeout(() => {
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
});

/** First Home shelf tile. It receives focus from Blits, not the DOM registry. */
export const HomeCard = Blits.Component("HomeCard", {
  props: ["position", "card"] as unknown as { position: number; card: HomeCardView },
  template: `
    <Element :show="$card.id !== ''" :scale="$focused ? 1.06 : 1">
      <Element x="-4" y="-4" w="328" h="188" rounded="20" color="$white" :show="$focused" />
      <Element w="320" h="180" rounded="16" color="$surface" />
      <Element w="320" h="180" rounded="16" :src="$card.image" :show="$card.image !== ''" />
      <Element x="14" y="164" w="292" h="6" color="$progressTrack" :show="$card.progress > 0" />
      <Element x="14" y="164" :w="Math.max(0, Math.min(292, $card.progress * 292))" h="6" color="$accent" :show="$card.progress > 0" />
      <Text y="198" maxwidth="320" maxlines="1" :content="$titleText" font="Onest700" size="24" :color="$focused ? $primary : $primary" />
      <Text :y="$focused ? 239 : 231" maxwidth="320" maxlines="1" :content="$subtitleText" font="Onest" size="20" color="$secondary" />
    </Element>
  `,
  state() {
    return {
      focused: false,
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
    focus() { this.focused = true; this.reveal(); this.$emit("home-card-focused", this.position); },
    unfocus() { this.focused = false; },
  },
  methods: {
    reveal() { this.titleText = this.card.title; this.subtitleText = this.card.subtitle; },
  },
  input: {
    left() { this.$emit("home-card-move", { position: this.position, delta: -1 }); },
    right() { this.$emit("home-card-move", { position: this.position, delta: 1 }); },
    up() { this.$emit("home-action-return"); },
    enter() { return () => this.$emit("home-card-activate", this.position); },
  },
});
