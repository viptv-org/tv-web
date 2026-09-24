import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type { SettingsChoiceView, SettingsProfileView, SettingsRowView } from "./settingsModel";
import { settingsIcon } from "./settingsIcons";

export const SettingsRow = Blits.Component("SettingsRow", {
  props: ["position", "row"] as unknown as { position: number; row: SettingsRowView },
  template: `
    <Element :show="$row.visible" w="720" h="80">
      <Element x="-10" y="-5" w="742" h="90" rounded="27" color="$white" :show="$focused" />
      <Element w="720" h="80" rounded="22" :color="$focused ? $primary : $clear" />
      <Element x="28" y="25" w="30" h="30" :src="$iconSrc" />
      <Text x="78" :y="$row.note === '' ? 24 : 10" maxwidth="450" maxlines="1" :content="$titleText" font="Onest600" size="28" :color="$focused ? $onLight : $row.danger ? $danger : $primary" />
      <Text x="78" y="45" maxwidth="490" maxlines="1" :content="$noteText" font="Onest500" size="20" :color="$focused ? $onLightSecondary : $tertiary" :show="$row.note !== ''" />
      <Text x="500" y="25" maxwidth="185" align="right" maxlines="1" :content="$valueText" font="Onest" size="24" :color="$focused ? $onLightSecondary : $secondary" :show="$row.value !== ''" />
      <Text x="680" y="22" content="›" font="Onest" size="36" :color="$focused ? $onLight : $primary" :show="$row.chevron" />
    </Element>
  `,
  state() { return {
    focused: false, titleText: "", valueText: "", noteText: "", iconSrc: "",
    white: tokens["color.fill.white"], onLight: tokens["color.on.light"],
    onLightSecondary: tokens["color.text.on-light-secondary"],
    primary: tokens["color.text.primary"], secondary: tokens["color.text.secondary"],
    tertiary: tokens["color.text.tertiary"], danger: tokens["color.status.danger-tv"], clear: "rgba(0,0,0,0)",
  }; },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("settings-row", this.position); this.$emit("settings-row-focused", this.position); },
    unfocus() { this.focused = false; this.reveal(); },
  },
  methods: { reveal() {
    this.titleText = this.row.title;
    this.valueText = this.row.value;
    this.noteText = this.row.note;
    this.iconSrc = settingsIcon(this.row.icon, this.focused, this.row.danger);
  } },
  input: {
    up() { this.$emit("settings-row-move", -1); },
    down() { this.$emit("settings-row-move", 1); },
    left() { this.$emit("settings-row-left"); },
    right() { this.$emit("settings-row-right"); },
    back() { this.$emit("settings-back"); },
    enter() { return () => this.$emit("settings-row-activate"); },
  },
});

export const SettingsProfile = Blits.Component("SettingsProfile", {
  props: ["position", "tile"] as unknown as { position: number; tile: SettingsProfileView },
  template: `
    <Element :show="$tile.visible" w="160" h="240" :scale="$focused ? 1.04 : 1">
      <Element x="-4" y="-4" w="168" h="168" rounded="37" color="$white" :show="$focused" />
      <Element w="160" h="160" rounded="32" color="$avatarGround" />
      <Element w="160" h="160" rounded="32" color="$letterGround" :show="$tile.image === ''" />
      <Element w="160" h="160" rounded="32" :src="$tile.image" :show="$tile.image !== ''" />
      <Text x="0" y="41" maxwidth="160" align="center" :content="$initialText" font="Bricolage800" size="64" color="$white" :show="$tile.image === ''" />
      <Text y="178" maxwidth="160" align="center" :content="$nameText" font="Onest600" size="26" :color="$tile.watching || $focused ? $primary : $secondary" />
      <Text y="212" maxwidth="160" align="center" :content="$watchingText" font="Onest" size="18" color="$tertiary" :show="$tile.watching" />
    </Element>
  `,
  state() { return {
    focused: false, nameText: "", initialText: "", watchingText: "",
    white: tokens["color.fill.white"], avatarGround: tokens["color.surface.avatar"], letterGround: tokens["color.surface.3"],
    primary: tokens["color.text.primary"], secondary: tokens["color.text.secondary"], tertiary: tokens["color.text.tertiary"],
  }; },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("settings-profile", this.position); this.$emit("settings-profile-focused", this.position); },
    unfocus() { this.focused = false; },
  },
  methods: { reveal() {
    this.nameText = this.tile.name;
    this.initialText = this.tile.initial;
    this.watchingText = this.tile.watching ? "Watching now" : "";
  } },
  input: {
    left() { this.$emit("settings-profile-move", -1); },
    right() { this.$emit("settings-profile-move", 1); },
    down() { this.$emit("settings-profile-exit"); },
    back() { this.$emit("settings-profile-exit"); },
    enter() { return () => this.$emit("settings-profile-activate"); },
  },
});

export const SettingsChoice = Blits.Component("SettingsChoice", {
  props: ["position", "choice"] as unknown as { position: number; choice: SettingsChoiceView },
  template: `
    <Element :show="$choice.visible" w="680" h="76">
      <Element x="-8" y="-4" w="696" h="84" rounded="26" color="$white" :show="$focused" />
      <Element w="680" h="76" rounded="22" :color="$focused ? $primary : $clear" />
      <Text x="30" y="21" :content="$labelText" font="Onest600" size="26" :color="$focused ? $onLight : ($choice.value === 'signout' || $choice.value === 'remove' || $choice.value === 'remove-addon') ? $danger : $primary" />
    </Element>
  `,
  state() { return {
    focused: false, labelText: "",
    white: tokens["color.fill.white"], onLight: tokens["color.on.light"],
    primary: tokens["color.text.primary"], danger: tokens["color.status.danger-tv"], clear: "rgba(0,0,0,0)",
  }; },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("settings-choice", this.position); this.$emit("settings-choice-focused", this.position); },
    unfocus() { this.focused = false; },
  },
  methods: { reveal() { this.labelText = this.choice.current ? `${this.choice.label} · Current` : this.choice.label; } },
  input: {
    up() { this.$emit("settings-choice-move", -1); },
    down() { this.$emit("settings-choice-move", 1); },
    back() { this.$emit("settings-dialog-back"); },
    enter() { return () => this.$emit("settings-choice-activate"); },
  },
});
