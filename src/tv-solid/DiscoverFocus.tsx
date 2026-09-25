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
    down() {
      this.$emit("discover-card-enter");
    },
    enter() {
      return () => this.$emit("discover-chip-activate");
    },
  },

  render: (s) => (
    <TvView show={s.chip.visible} w={s.chip.width} h={56}>
      <TvView
        x={-4}
        y={-4}
        w={s.chip.width + 8}
        h={64}
        rounded={32}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={s.chip.width}
        h={56}
        rounded={28}
        color={s.focused ? s.primary : s.chip.selected ? s.selected : s.clear}
      />
      <TvText
        x={28}
        y={13}
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

export const DiscoverFilterOption = defineScreen({
  props: ["position", "label", "selected", "visible"] as unknown as {
    position: number;
    label: string;
    selected: boolean;
    visible: boolean;
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
      noteFocus("discover-filter-option", this.position);
      this.$emit("discover-option-focused", this.position);
    },
    unfocus() {
      this.focused = false;
    },
  },
  methods: {
    reveal() {
      this.labelText = this.selected ? `${this.label} · Current` : this.label;
    },
  },
  input: {
    up() {
      this.$emit("discover-option-move", -1);
    },
    down() {
      this.$emit("discover-option-move", 1);
    },
    enter() {
      return () => this.$emit("discover-option-activate");
    },
    back() {
      this.$emit("discover-option-close");
    },
  },

  render: (s) => (
    <TvView show={s.visible} w={672} h={82}>
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
        h={82}
        rounded={24}
        color={s.focused ? s.primary : s.clear}
      />
      <TvText
        x={28}
        y={25}
        content={s.labelText}
        font={"Onest600"}
        size={26}
        color={s.focused ? s.onLight : s.primary}
      />
    </TvView>
  ),
});
