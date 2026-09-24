import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type { TitleMenuChoiceView } from "./titleMenuModel";

export const TitleMenuOption = Blits.Component("TitleMenuOption", {
  props: ["position", "choice"] as unknown as { position: number; choice: TitleMenuChoiceView },
  template: `
    <Element :show="$choice.visible" w="660" h="80">
      <Element x="-10" y="-4" w="680" h="88" rounded="28" color="$white" :show="$focused" />
      <Element w="660" h="80" rounded="22" :color="$focused ? $primary : $clear" />
      <Element x="28" y="26" w="28" h="28" :src="$focused ? $choice.focusedIcon : $choice.icon" :show="$choice.icon !== ''" />
      <Text :x="$choice.icon === '' ? 28 : 74" y="24" maxwidth="550" maxlines="1" :content="$labelText" font="Onest600" size="26" :color="$focused ? $onLight : $primary" />
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
    focus() { this.focused = true; this.reveal(); noteFocus("title-menu-option", this.position); this.$emit("title-menu-focused", this.position); },
    unfocus() { this.focused = false; },
  },
  methods: { reveal() { this.labelText = this.choice.label; } },
  input: {
    up() { this.$emit("title-menu-move", -1); },
    down() { this.$emit("title-menu-move", 1); },
    enter() { return () => this.$emit("title-menu-activate"); },
    back() { this.$emit("title-menu-back"); },
  },
});
