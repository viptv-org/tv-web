import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";

export const LiveDetailsOption = Blits.Component("LiveDetailsOption", {
  props: ["position", "label"] as unknown as { position: number; label: string },
  template: `
    <Element w="672" h="80">
      <Element x="-4" y="-5" w="680" h="90" rounded="28" color="$white" :show="$focused" />
      <Element w="672" h="80" rounded="24" :color="$focused ? $primary : $clear" />
      <Text x="28" y="23" :content="$labelText" font="Onest600" size="26" :color="$focused ? $onLight : $primary" />
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
    focus() { this.focused = true; this.reveal(); noteFocus("live-details-option", this.position); this.$emit("live-details-focused", this.position); },
    unfocus() { this.focused = false; },
  },
  methods: { reveal() { this.labelText = this.label; } },
  input: {
    up() { this.$emit("live-details-move", -1); },
    down() { this.$emit("live-details-move", 1); },
    back() { this.$emit("live-details-back"); },
    enter() { return () => this.$emit("live-details-activate"); },
  },
});
