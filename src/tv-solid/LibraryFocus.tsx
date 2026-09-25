/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import { createCatalogCard } from "./CatalogCard";

export const LibrarySegment = defineScreen({
  props: ["position", "label", "selected", "width"] as unknown as {
    position: number;
    label: string;
    selected: boolean;
    width: number;
  },

  state() {
    return {
      focused: false,
      labelText: "",
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"],
      secondary: tokens["color.text.secondary"],
      selectedGround: tokens["color.fill.tv-selected"],
      clear: "rgba(0,0,0,0)",
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("library-segment", this.position);
      this.$emit("library-segment-focused", this.position);
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
    left() {
      this.$emit("library-segment-move", -1);
    },
    right() {
      this.$emit("library-segment-move", 1);
    },
    down() {
      this.$emit("library-card-enter");
    },
    enter() {
      return () => this.$emit("library-segment-activate");
    },
  },

  render: (s) => (
    <TvView w={s.width} h={56}>
      <TvView
        x={-4}
        y={-4}
        w={s.width + 8}
        h={64}
        rounded={32}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={s.width}
        h={56}
        rounded={28}
        color={s.focused ? s.primary : s.selected ? s.selectedGround : s.clear}
      />
      <TvText
        x={28}
        y={13}
        content={s.labelText}
        font={"Onest700"}
        size={24}
        color={s.focused ? s.onLight : s.selected ? s.primary : s.secondary}
      />
    </TvView>
  ),
});

export const LibraryCard = createCatalogCard("library");
