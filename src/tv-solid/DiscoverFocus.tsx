/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import { createCatalogCard } from "./CatalogCard";
import type { DiscoverChipView } from "./discoverModel";

/** Focusable type, catalog or filter chip in the TV Discover header. */
export const DiscoverChip = defineScreen({
  props: ["position", "chip"] as unknown as {
    position: number;
    chip: DiscoverChipView;
  },

  state() {
    return {
      focused: false,
      labelText: "",
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      secondary: tokens["color.text.secondary"],
      onLight: tokens["color.on.light"],
      selected: tokens["color.fill.tv-selected"],
      clear: "rgba(0,0,0,0)",
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("discover-chip", this.position);
      this.$emit("discover-chip-focused", this.position);
    },
    unfocus() {
      this.focused = false;
    },
  },
  methods: {
    reveal() {
      this.labelText = this.chip.label;
    },
  },
  input: {
    left() {
      this.$emit("discover-chip-move", -1);
    },
    right() {
      this.$emit("discover-chip-move", 1);
    },
    up() { this.$emit("discover-chip-row", -1); },
    down() { this.$emit("discover-chip-row", 1); },
    enter() {
      return () => this.$emit("discover-chip-activate");
    },
  },

  render: (s) => (
    <TvView show={s.chip.visible && s.chip.x + s.chip.width > 188 && s.chip.x < 1828} w={s.chip.width} h={56}>
      <TvView
        x={-4}
        y={-4}
        w={s.chip.width + 8}
        h={64}
        rounded={32}
        color={s.white}
        show={s.focused}
      />
      <TvView w={s.chip.width} h={56} rounded={28} color={s.chip.selected ? tokens["color.line.strong"] : tokens["color.line.chip"]} />
      <TvView
        x={1} y={1}
        w={s.chip.width - 2}
        h={54}
        rounded={28}
        color={s.focused ? s.primary : s.chip.selected ? s.selected : tokens["color.bg"]}
      />
      <TvText
        x={28}
        centerY={28}
        content={s.labelText}
        font={"Onest700"}
        size={24}
        color={
          s.focused ? s.onLight : s.chip.selected ? s.primary : s.secondary
        }
      />
    </TvView>
  ),
});

/** One 360 × 202 TV grid tile with real SolidTV focus and a separate caption. */
export const DiscoverCard = createCatalogCard("discover");
