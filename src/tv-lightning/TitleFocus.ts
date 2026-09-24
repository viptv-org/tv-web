import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import type { DetailEpisodeView } from "./detailModel";
import { noteFocus } from "./focusDebug";

/** Focus-owning title action; Play alone has the 700 ms secondary action. */
export const TitleAction = Blits.Component("TitleAction", {
  props: ["position", "action", "label", "icon", "buttonWidth", "holdable"] as unknown as {
    position: number; action: string; label: string; icon: string;
    buttonWidth: number; holdable: boolean;
  },
  template: `
    <Element :w="$buttonWidth" h="72">
      <Element x="-4" y="-4" :w="$buttonWidth + 8" h="80" rounded="40" color="$white" :show="$focused" />
      <Element :w="$buttonWidth" h="72" rounded="36" :color="$focused ? $primary : $surface" />
      <Text x="32" y="18" :content="$iconText" font="Onest" size="28" :color="$focused ? $onLight : $primary" />
      <Text :x="$icon === '' ? 34 : 78" y="18" :content="$labelText" font="Onest700" size="26" :color="$focused ? $onLight : $primary" />
    </Element>
  `,
  state() {
    return {
      focused: false, pressed: false, holdFired: false, holdTimer: 0,
      labelText: "", iconText: "",
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"],
      surface: tokens["color.surface.3"],
    };
  },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("title-action", this.position); this.$emit("title-action-focused", this.position); },
    unfocus() { this.focused = false; clearTimeout(this.holdTimer); },
    destroy() { clearTimeout(this.holdTimer); },
  },
  methods: {
    reveal() { this.labelText = this.label; this.iconText = this.icon; },
  },
  input: {
    left() { this.$emit("title-action-move", -1); },
    right() { this.$emit("title-action-move", 1); },
    down() { this.$emit("title-episodes-enter"); },
    enter() {
      if (!this.pressed) {
        this.pressed = true;
        this.holdFired = false;
        if (this.holdable) this.holdTimer = window.setTimeout(() => {
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
});

/** Episode row uses real Blits component focus and release activation. */
export const EpisodeTile = Blits.Component("EpisodeTile", {
  props: ["position", "episode"] as unknown as { position: number; episode: DetailEpisodeView },
  template: `
    <Element :show="$episode.item !== null" :scale="$focused ? 1.06 : 1">
      <Element x="-4" y="-4" w="368" h="208" rounded="18" color="$white" :show="$focused" />
      <Element w="360" h="200" rounded="14" color="$surface" />
      <Element w="360" h="200" rounded="14" :src="$episode.image" :show="$episode.image !== ''" />
      <Element x="14" y="178" w="332" h="6" color="$progressTrack" :show="$episode.progress > 0" />
      <Element x="14" y="178" :w="Math.max(0, Math.min(332, $episode.progress * 332))" h="6" color="$accent" :show="$episode.progress > 0" />
      <Element x="14" y="14" w="130" h="30" rounded="15" color="$badgeGround" :show="$episode.watching" />
      <Text x="25" y="17" :content="$watchingText" font="Onest700" size="16" color="$white" :show="$episode.watching" />
      <Text y="219" :content="$numberText" font="Onest700" size="18" color="$secondary" />
      <Text y="250" maxwidth="360" maxlines="1" :content="$titleText" font="Onest700" size="24" color="$primary" />
      <Text y="299" maxwidth="360" maxlines="2" :content="$synopsisText" font="Onest" size="20" color="$secondary" />
    </Element>
  `,
  state() {
    return {
      focused: false,
      watchingText: "", numberText: "", titleText: "", synopsisText: "",
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
    focus() { this.focused = true; this.reveal(); noteFocus("title-episode", this.position); this.$emit("title-episode-focused", this.position); },
    unfocus() { this.focused = false; },
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
    left() { this.$emit("title-episode-move", -1); },
    right() { this.$emit("title-episode-move", 1); },
    up() { this.$emit("title-actions-return"); },
    enter() { return () => this.$emit("title-episode-activate", this.position); },
  },
});
