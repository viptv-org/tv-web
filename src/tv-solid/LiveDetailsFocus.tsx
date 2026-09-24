/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";

export const LiveDetailsOption = defineScreen({
  props: ["position", "label"] as unknown as {
    position: number;
    label: string;
  },

  state() {
    return {
      focused: false,
      labelText: "",
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"],
      clear: "rgba(0,0,0,0)",
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("live-details-option", this.position);
      this.$emit("live-details-focused", this.position);
    },
    unfocus() {
      this.focused = false;
    },
  },
  methods: {
    reveal() {
      this.labelText = this.label;
    },
  },
  input: {
    up() {
      this.$emit("live-details-move", -1);
    },
    down() {
      this.$emit("live-details-move", 1);
    },
    back() {
      this.$emit("live-details-back");
    },
    enter() {
      return () => this.$emit("live-details-activate");
    },
  },

  render: (s) => (
    <TvView w={672} h={80}>
      <TvView
        x={-4}
        y={-5}
        w={680}
        h={90}
        rounded={28}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={672}
        h={80}
        rounded={24}
        color={s.focused ? s.primary : s.clear}
      />
      <TvText
        x={28}
        y={23}
        content={s.labelText}
        font={"Onest600"}
        size={26}
        color={s.focused ? s.onLight : s.primary}
      />
    </TvView>
  ),
});
