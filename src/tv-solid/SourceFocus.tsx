/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type { SourceChipView, SourceRowView } from "./sourceModel";

export const emptySourceChip: SourceChipView = {
  quality: "",
  label: "",
  count: 0,
  selected: false,
};

/** Quality filter with SolidTV component focus. */
export const SourceChip = defineScreen({
  props: ["position", "chip", "chipWidth"] as unknown as {
    position: number;
    chip: SourceChipView;
    chipWidth: number;
  },

  state() {
    return {
      focused: false,
      caption: "",
      primary: tokens["color.text.primary"],
      secondary: tokens["color.text.secondary"],
      onLight: tokens["color.on.light"],
      selected: tokens["color.surface.3"],
      background: tokens["color.surface.1"],
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("source-chip", this.position);
    },
    unfocus() {
      this.focused = false;
    },
  },
  methods: {
    reveal() {
      this.caption = `${this.chip.label}${this.chip.count ? ` ${this.chip.count}` : ""}`;
    },
  },
  watch: {
    chip(value: SourceChipView) {
      this.caption = `${value.label}${value.count ? ` ${value.count}` : ""}`;
    },
  },
  input: {
    left() {
      this.$emit("source-chip-move", -1);
    },
    right() {
      this.$emit("source-chip-move", 1);
    },
    down() {
      this.$emit("source-provider-focus");
    },
    enter() {
      return () => this.$emit("source-chip-activate", this.position);
    },
  },

  render: (s) => (
    <TvView w={s.chipWidth} h={52} show={s.chip.label !== ""}>
      <TvView
        w={s.chipWidth}
        h={52}
        rounded={26}
        color={
          s.focused ? s.primary : s.chip.selected ? s.selected : s.background
        }
      />
      <TvText
        x={24}
        y={12}
        content={s.caption}
        font={"Onest700"}
        size={22}
        color={s.focused ? s.onLight : s.secondary}
      />
    </TvView>
  ),
});

export const SourceProvider = defineScreen({
  props: ["label"] as unknown as { label: string },

  state() {
    return {
      focused: false,
      caption: "",
      primary: tokens["color.text.primary"],
      secondary: tokens["color.text.secondary"],
      onLight: tokens["color.on.light"],
      background: tokens["color.surface.1"],
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("source-provider", 0);
    },
    unfocus() {
      this.focused = false;
    },
  },
  methods: {
    reveal() {
      this.caption = `${this.label} ⌄`;
    },
  },
  watch: {
    label(value: string) {
      this.caption = `${value} ⌄`;
    },
  },
  input: {
    up() {
      this.$emit("source-chip-restore");
    },
    down() {
      this.$emit("source-rows-enter");
    },
    enter() {
      return () => this.$emit("source-provider-activate");
    },
  },

  render: (s) => (
    <TvView w={240} h={52}>
      <TvView
        w={240}
        h={52}
        rounded={26}
        color={s.focused ? s.primary : s.background}
      />
      <TvText
        x={24}
        y={12}
        content={s.caption}
        font={"Onest700"}
        size={22}
        color={s.focused ? s.onLight : s.secondary}
      />
    </TvView>
  ),
});

/** One source choice, including the 700 ms hold for its details. */
export const SourceRow = defineScreen({
  props: ["position", "row"] as unknown as {
    position: number;
    row: SourceRowView;
  },

  state() {
    return {
      focused: false,
      pressed: false,
      holdFired: false,
      holdTimer: 0,
      qualityText: "",
      bestText: "",
      providerText: "",
      fileText: "",
      playIcon: "",
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      secondary: tokens["color.text.secondary"],
      onLight: tokens["color.on.light"],
      onLightSecondary: tokens["color.text.on-light-secondary"],
      onLightAccent: tokens["color.text.on-light-accent"],
      onLightBadge: tokens["color.fill.on-light-badge"],
      accent: tokens["color.accent.default"],
      tag: tokens["color.fill.tag"],
      wash: tokens["color.fill.wash"],
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("source-row", this.position);
    },
    unfocus() {
      this.focused = false;
      clearTimeout(this.holdTimer);
    },
    destroy() {
      clearTimeout(this.holdTimer);
    },
  },
  methods: {
    reveal() {
      this.qualityText = this.row.quality;
      this.bestText = this.row.best ? "BEST MATCH" : "";
      this.providerText = this.row.provider;
      this.fileText = this.row.file;
      this.playIcon = "▶";
    },
  },
  watch: {
    row(value: SourceRowView) {
      this.qualityText = value.quality;
      this.bestText = value.best ? "BEST MATCH" : "";
      this.providerText = value.provider;
      this.fileText = value.file;
      this.playIcon = "▶";
    },
  },
  input: {
    up() {
      this.$emit("source-row-move", -1);
    },
    down() {
      this.$emit("source-row-move", 1);
    },
    left() {
      this.$emit("source-quality-step", -1);
    },
    right() {
      this.$emit("source-quality-step", 1);
    },
    enter() {
      if (!this.pressed) {
        this.pressed = true;
        this.holdFired = false;
        this.holdTimer = window.setTimeout(() => {
          this.holdFired = true;
          this.$emit("source-row-hold", this.position);
        }, 700);
      }
      return () => {
        clearTimeout(this.holdTimer);
        const activate = !this.holdFired;
        this.pressed = false;
        if (activate) this.$emit("source-row-activate", this.position);
      };
    },
  },

  render: (s) => (
    <TvView w={660} h={104} show={s.row.id !== ""}>
      <TvView
        x={-4}
        y={-4}
        w={668}
        h={112}
        rounded={24}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={660}
        h={104}
        rounded={20}
        color={s.focused ? s.primary : s.wash}
      />
      <TvView
        x={28}
        y={24}
        w={92}
        h={56}
        rounded={10}
        color={s.focused ? s.onLightBadge : s.tag}
      />
      <TvText
        x={40}
        y={38}
        maxwidth={68}
        align={"center"}
        content={s.qualityText}
        font={"Onest700"}
        size={22}
        color={s.focused ? s.onLight : s.primary}
      />
      <TvText
        x={140}
        y={4}
        content={s.bestText}
        font={"Onest700"}
        size={18}
        color={s.focused ? s.onLightAccent : s.accent}
      />
      <TvText
        x={140}
        y={s.row.best ? 35 : 19}
        maxwidth={430}
        content={s.providerText}
        font={"Onest700"}
        size={28}
        color={s.focused ? s.onLight : s.primary}
      />
      <TvText
        x={140}
        y={s.row.best ? 71 : 61}
        maxwidth={430}
        maxlines={1}
        content={s.fileText}
        font={"Onest"}
        size={20}
        color={s.focused ? s.onLightSecondary : s.secondary}
      />
      <TvText
        x={616}
        y={34}
        content={s.playIcon}
        font={"Onest"}
        size={26}
        color={s.onLight}
        show={s.focused}
      />
    </TvView>
  ),
});

export interface ProviderChoice {
  label: string;
  current: boolean;
  visible: boolean;
}

export const emptyProviderChoice: ProviderChoice = {
  label: "",
  current: false,
  visible: false,
};

/** Focus-owning choice in the TV source-provider panel. */
export const ProviderOption = defineScreen({
  props: ["position", "choice"] as unknown as {
    position: number;
    choice: ProviderChoice;
  },

  state() {
    return {
      focused: false,
      caption: "",
      currentText: "",
      currentX: 72,
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"],
      onLightSecondary: tokens["color.text.on-light-secondary"],
      secondary: tokens["color.text.secondary"],
      background: tokens["color.surface.1"],
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("provider-option", this.position);
    },
    unfocus() {
      this.focused = false;
    },
  },
  methods: {
    reveal() {
      this.caption = this.choice.label;
      this.currentText = this.choice.current ? "· Current" : "";
      this.currentX = Math.max(72, 24 + this.choice.label.length * 14);
    },
  },
  watch: {
    choice(value: ProviderChoice) {
      this.caption = value.label;
      this.currentText = value.current ? "· Current" : "";
      this.currentX = Math.max(72, 24 + value.label.length * 14);
    },
  },
  input: {
    up() {
      this.$emit("provider-option-move", -1);
    },
    down() {
      this.$emit("provider-option-move", 1);
    },
    enter() {
      return () => this.$emit("provider-option-activate", this.position);
    },
  },

  render: (s) => (
    <TvView w={660} h={80} show={s.choice.visible}>
      <TvView
        x={-4}
        y={-4}
        w={668}
        h={88}
        rounded={23}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={660}
        h={80}
        rounded={20}
        color={s.focused ? s.primary : s.background}
      />
      <TvText
        x={24}
        y={25}
        content={s.caption}
        font={"Onest700"}
        size={26}
        color={s.focused ? s.onLight : s.primary}
      />
      <TvText
        x={s.currentX}
        y={25}
        content={s.currentText}
        font={"Onest"}
        size={26}
        color={s.focused ? s.onLightSecondary : s.secondary}
      />
    </TvView>
  ),
});

export const SourceDetailsClose = defineScreen({
  state() {
    return {
      focused: false,
      caption: "",
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"],
      surface: tokens["color.surface.3"],
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.caption = "Close";
      noteFocus("source-details-close", 0);
    },
    unfocus() {
      this.focused = false;
    },
  },
  input: {
    enter() {
      return () => this.$emit("source-detail-close");
    },
  },

  render: (s) => (
    <TvView w={152} h={84}>
      <TvView
        x={-4}
        y={-4}
        w={160}
        h={92}
        rounded={46}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={152}
        h={84}
        rounded={42}
        color={s.focused ? s.primary : s.surface}
      />
      <TvText
        x={38}
        y={24}
        content={s.caption}
        font={"Onest700"}
        size={26}
        color={s.focused ? s.onLight : s.primary}
      />
    </TvView>
  ),
});
