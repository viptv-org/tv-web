import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type { SourceChipView, SourceRowView } from "./sourceModel";

export const emptySourceChip: SourceChipView = {
  quality: "", label: "", count: 0, selected: false,
};

/** Quality filter with Lightning component focus. */
export const SourceChip = Blits.Component("SourceChip", {
  props: ["position", "chip", "chipWidth"] as unknown as {
    position: number; chip: SourceChipView; chipWidth: number;
  },
  template: `
    <Element :w="$chipWidth" h="52" :show="$chip.label !== ''">
      <Element :w="$chipWidth" h="52" rounded="26" :color="$focused ? $primary : $chip.selected ? $selected : $background" />
      <Text x="24" y="12" :content="$caption" font="Onest700" size="22" :color="$focused ? $onLight : $secondary" />
    </Element>
  `,
  state() {
    return {
      focused: false, caption: "",
      primary: tokens["color.text.primary"],
      secondary: tokens["color.text.secondary"],
      onLight: tokens["color.on.light"],
      selected: tokens["color.surface.3"],
      background: tokens["color.surface.1"],
    };
  },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("source-chip", this.position); },
    unfocus() { this.focused = false; },
  },
  methods: { reveal() { this.caption = `${this.chip.label}${this.chip.count ? ` ${this.chip.count}` : ""}`; } },
  watch: {
    chip(value: SourceChipView) { this.caption = `${value.label}${value.count ? ` ${value.count}` : ""}`; },
  },
  input: {
    left() { this.$emit("source-chip-move", -1); },
    right() { this.$emit("source-chip-move", 1); },
    down() { this.$emit("source-provider-focus"); },
    enter() { return () => this.$emit("source-chip-activate", this.position); },
  },
});

export const SourceProvider = Blits.Component("SourceProvider", {
  props: ["label"] as unknown as { label: string },
  template: `
    <Element w="240" h="52">
      <Element w="240" h="52" rounded="26" :color="$focused ? $primary : $background" />
      <Text x="24" y="12" :content="$caption" font="Onest700" size="22" :color="$focused ? $onLight : $secondary" />
    </Element>
  `,
  state() {
    return {
      focused: false, caption: "",
      primary: tokens["color.text.primary"], secondary: tokens["color.text.secondary"],
      onLight: tokens["color.on.light"], background: tokens["color.surface.1"],
    };
  },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("source-provider", 0); },
    unfocus() { this.focused = false; },
  },
  methods: { reveal() { this.caption = `${this.label} ⌄`; } },
  watch: {
    label(value: string) { this.caption = `${value} ⌄`; },
  },
  input: {
    up() { this.$emit("source-chip-restore"); },
    down() { this.$emit("source-rows-enter"); },
    enter() { return () => this.$emit("source-provider-activate"); },
  },
});

/** One source choice, including the 700 ms hold for its details. */
export const SourceRow = Blits.Component("SourceRow", {
  props: ["position", "row"] as unknown as { position: number; row: SourceRowView },
  template: `
    <Element w="660" h="104" :show="$row.id !== ''" :scale="$focused ? 1.02 : 1">
      <Element x="-4" y="-4" w="668" h="112" rounded="24" color="$white" :show="$focused" />
      <Element w="660" h="104" rounded="20" :color="$focused ? $primary : $wash" />
      <Element x="28" y="24" w="92" h="56" rounded="10" :color="$focused ? $onLightBadge : $tag" />
      <Text x="40" y="38" maxwidth="68" align="center" :content="$qualityText" font="Onest700" size="22" :color="$focused ? $onLight : $primary" />
      <Text x="140" y="4" :content="$bestText" font="Onest700" size="18" :color="$focused ? $onLightAccent : $accent" />
      <Text x="140" :y="$row.best ? 35 : 19" maxwidth="430" :content="$providerText" font="Onest700" size="28" :color="$focused ? $onLight : $primary" />
      <Text x="140" :y="$row.best ? 71 : 61" maxwidth="430" maxlines="1" :content="$fileText" font="Onest" size="20" :color="$focused ? $onLightSecondary : $secondary" />
      <Text x="616" y="34" :content="$playIcon" font="Onest" size="26" color="$onLight" :show="$focused" />
    </Element>
  `,
  state() {
    return {
      focused: false, pressed: false, holdFired: false, holdTimer: 0,
      qualityText: "", bestText: "", providerText: "", fileText: "", playIcon: "",
      white: tokens["color.fill.white"], primary: tokens["color.text.primary"],
      secondary: tokens["color.text.secondary"], onLight: tokens["color.on.light"],
      onLightSecondary: tokens["color.text.on-light-secondary"],
      onLightAccent: tokens["color.text.on-light-accent"],
      onLightBadge: tokens["color.fill.on-light-badge"],
      accent: tokens["color.accent.default"], tag: tokens["color.fill.tag"],
      wash: tokens["color.fill.wash"],
    };
  },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("source-row", this.position); },
    unfocus() { this.focused = false; clearTimeout(this.holdTimer); },
    destroy() { clearTimeout(this.holdTimer); },
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
    up() { this.$emit("source-row-move", -1); },
    down() { this.$emit("source-row-move", 1); },
    left() { this.$emit("source-quality-step", -1); },
    right() { this.$emit("source-quality-step", 1); },
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
});

export interface ProviderChoice {
  label: string;
  current: boolean;
  visible: boolean;
}

export const emptyProviderChoice: ProviderChoice = { label: "", current: false, visible: false };

/** Focus-owning choice in the TV source-provider panel. */
export const ProviderOption = Blits.Component("ProviderOption", {
  props: ["position", "choice"] as unknown as { position: number; choice: ProviderChoice },
  template: `
    <Element w="660" h="80" :show="$choice.visible">
      <Element x="-4" y="-4" w="668" h="88" rounded="23" color="$white" :show="$focused" />
      <Element w="660" h="80" rounded="20" :color="$focused ? $primary : $background" />
      <Text x="24" y="25" :content="$caption" font="Onest700" size="26" :color="$focused ? $onLight : $primary" />
      <Text :x="$currentX" y="25" :content="$currentText" font="Onest" size="26" :color="$focused ? $onLightSecondary : $secondary" />
    </Element>
  `,
  state() {
    return {
      focused: false, caption: "", currentText: "", currentX: 72,
      white: tokens["color.fill.white"], primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"],
      onLightSecondary: tokens["color.text.on-light-secondary"],
      secondary: tokens["color.text.secondary"], background: tokens["color.surface.1"],
    };
  },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("provider-option", this.position); },
    unfocus() { this.focused = false; },
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
    up() { this.$emit("provider-option-move", -1); },
    down() { this.$emit("provider-option-move", 1); },
    enter() { return () => this.$emit("provider-option-activate", this.position); },
  },
});

export const SourceDetailsClose = Blits.Component("SourceDetailsClose", {
  template: `
    <Element w="152" h="84">
      <Element x="-4" y="-4" w="160" h="92" rounded="46" color="$white" :show="$focused" />
      <Element w="152" h="84" rounded="42" :color="$focused ? $primary : $surface" />
      <Text x="38" y="24" :content="$caption" font="Onest700" size="26" :color="$focused ? $onLight : $primary" />
    </Element>
  `,
  state() {
    return {
      focused: false, caption: "",
      white: tokens["color.fill.white"], primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"], surface: tokens["color.surface.3"],
    };
  },
  hooks: {
    focus() { this.focused = true; this.caption = "Close"; noteFocus("source-details-close", 0); },
    unfocus() { this.focused = false; },
  },
  input: {
    enter() { return () => this.$emit("source-detail-close"); },
  },
});
