/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type { TitleMenuChoiceView } from "./titleMenuModel";

export const TitleMenuOption = defineScreen({
  props: ["position", "choice"] as unknown as {
    position: number;
    choice: TitleMenuChoiceView;
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
      noteFocus("title-menu-option", this.position);
      this.$emit("title-menu-focused", this.position);
    },
    unfocus() {
      this.focused = false;
    },
  },
  methods: {
    reveal() {
      this.labelText = this.choice.label;
    },
  },
  input: {
    up() {
      this.$emit("title-menu-move", -1);
    },
    down() {
      this.$emit("title-menu-move", 1);
    },
    enter() {
      return () => this.$emit("title-menu-activate");
    },
    back() {
      this.$emit("title-menu-back");
    },
  },

  render: (s) => (
    <TvView show={s.choice.visible} w={660} h={80}>
      <TvView
        x={-10}
        y={-4}
        w={680}
        h={88}
        rounded={28}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={660}
        h={80}
        rounded={22}
        color={s.focused ? s.primary : s.clear}
      />
      <TvView
        x={28}
        y={26}
        w={28}
        h={28}
        src={s.focused ? s.choice.focusedIcon : s.choice.icon}
        show={s.choice.icon !== ""}
      />
      <TvText
        x={s.choice.icon === "" ? 28 : 74}
        y={24}
        maxwidth={550}
        maxlines={1}
        content={s.labelText}
        font={"Onest600"}
        size={26}
        color={s.focused ? s.onLight : s.primary}
      />
    </TvView>
  ),
});
