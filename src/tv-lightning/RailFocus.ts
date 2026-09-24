import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";

/** A labelled TV rail row. Blits owns focus and D-pad input while expanded. */
export const RailItem = Blits.Component("RailItem", {
  props: ["position", "label", "icon", "focusedIcon", "current", "avatar", "profileName"] as unknown as {
    position: number; label: string; icon: string; focusedIcon: string; current: boolean;
    avatar: string; profileName: string;
  },
  template: `
    <Element w="360" h="68">
      <Element x="-8" y="-4" w="376" h="76" rounded="38" color="$white" :show="$focused" />
      <Element w="360" h="68" rounded="34" :color="$focused ? $primary : $clear" />
      <Element x="4" y="6" w="56" h="56" rounded="28" color="$avatarGround" :show="$position === 0" />
      <Element x="10" y="12" w="44" h="44" rounded="22" :src="$avatar" :show="$position === 0 && $avatar !== ''" />
      <Element x="26" y="20" w="28" h="28" :src="$focused ? $focusedIcon : $icon" :show="$position !== 0" />
      <Text x="76" :y="$position === 0 ? 8 : 18" :content="$labelText" :font="$focused || $current || $position === 0 ? 'Onest700' : 'Onest500'" size="26" :color="$focused ? $onLight : $current ? $primary : $secondary" />
      <Text x="76" y="39" :content="$switchText" font="Onest" size="20" :color="$focused ? $onLightSecondary : $tertiary" :show="$position === 0" />
      <Element x="326" y="30" w="8" h="8" rounded="4" color="$primary" :show="$current && !$focused" />
    </Element>
  `,
  state() {
    return {
      focused: false,
      labelText: "",
      switchText: "",
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      secondary: tokens["color.text.secondary"],
      tertiary: tokens["color.text.tertiary"],
      onLight: tokens["color.on.light"],
      onLightSecondary: tokens["color.text.on-light-secondary"],
      avatarGround: tokens["color.surface.avatar"],
      clear: "rgba(0,0,0,0)",
    };
  },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("rail-item", this.position); this.$emit("rail-focused", this.position); },
    unfocus() { this.focused = false; },
  },
  methods: {
    reveal() {
      this.labelText = this.position === 0 ? this.profileName : this.label;
      this.switchText = this.position === 0 ? "Switch profile" : "";
    },
  },
  input: {
    up() { this.$emit("rail-move", -1); },
    down() { this.$emit("rail-move", 1); },
    right() { this.$emit("rail-exit"); },
    back() { this.$emit("rail-exit"); },
    enter() { return () => this.$emit("rail-activate"); },
  },
});
