/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type {
  SettingsChoiceView,
  SettingsProfileView,
  SettingsRowView,
} from "./settingsModel";
import { settingsIcon } from "./settingsIcons";

export const SettingsRow = defineScreen({
  props: ["position", "row"] as unknown as {
    position: number;
    row: SettingsRowView;
  },

  state() {
    return {
      focused: false,
      titleText: "",
      valueText: "",
      noteText: "",
      iconSrc: "",
      white: tokens["color.fill.white"],
      onLight: tokens["color.on.light"],
      onLightSecondary: tokens["color.text.on-light-secondary"],
      primary: tokens["color.text.primary"],
      secondary: tokens["color.text.secondary"],
      tertiary: tokens["color.text.tertiary"],
      danger: tokens["color.status.danger-tv"],
      clear: "rgba(0,0,0,0)",
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("settings-row", this.position);
      this.$emit("settings-row-focused", this.position);
    },
    unfocus() {
      this.focused = false;
      this.reveal();
    },
  },
  methods: {
    reveal() {
      this.titleText = this.row.title;
      this.valueText = this.row.value;
      this.noteText = this.row.note;
      this.iconSrc = settingsIcon(this.row.icon, this.focused, this.row.danger);
    },
  },
  input: {
    up() {
      this.$emit("settings-row-move", -1);
    },
    down() {
      this.$emit("settings-row-move", 1);
    },
    left() {
      this.$emit("settings-row-left");
    },
    right() {
      this.$emit("settings-row-right");
    },
    back() {
      this.$emit("settings-back");
    },
    enter() {
      return () => this.$emit("settings-row-activate");
    },
  },

  render: (s) => (
    <TvView show={s.row.visible} w={720} h={80}>
      <TvView
        x={-10}
        y={-5}
        w={742}
        h={90}
        rounded={27}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={720}
        h={80}
        rounded={22}
        color={s.focused ? s.primary : s.clear}
      />
      <TvView x={28} y={25} w={30} h={30} src={s.iconSrc} />
      <TvText
        x={78}
        y={s.row.note === "" ? 24 : 10}
        maxwidth={450}
        maxlines={1}
        content={s.titleText}
        font={"Onest600"}
        size={28}
        color={s.focused ? s.onLight : s.row.danger ? s.danger : s.primary}
      />
      <TvText
        x={78}
        y={45}
        maxwidth={490}
        maxlines={1}
        content={s.noteText}
        font={"Onest500"}
        size={20}
        color={s.focused ? s.onLightSecondary : s.tertiary}
        show={s.row.note !== ""}
      />
      <TvText
        x={500}
        y={25}
        maxwidth={185}
        align={"right"}
        maxlines={1}
        content={s.valueText}
        font={"Onest"}
        size={24}
        color={s.focused ? s.onLightSecondary : s.secondary}
        show={s.row.value !== ""}
      />
      <TvText
        x={680}
        y={22}
        content={"›"}
        font={"Onest"}
        size={36}
        color={s.focused ? s.onLight : s.primary}
        show={s.row.chevron}
      />
    </TvView>
  ),
});

export const SettingsProfile = defineScreen({
  props: ["position", "tile"] as unknown as {
    position: number;
    tile: SettingsProfileView;
  },

  state() {
    return {
      focused: false,
      nameText: "",
      initialText: "",
      watchingText: "",
      white: tokens["color.fill.white"],
      avatarGround: tokens["color.surface.avatar"],
      letterGround: tokens["color.surface.3"],
      primary: tokens["color.text.primary"],
      secondary: tokens["color.text.secondary"],
      tertiary: tokens["color.text.tertiary"],
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("settings-profile", this.position);
      this.$emit("settings-profile-focused", this.position);
    },
    unfocus() {
      this.focused = false;
    },
  },
  methods: {
    reveal() {
      this.nameText = this.tile.name;
      this.initialText = this.tile.initial;
      this.watchingText = this.tile.watching ? "Watching now" : "";
    },
  },
  input: {
    left() {
      this.$emit("settings-profile-move", -1);
    },
    right() {
      this.$emit("settings-profile-move", 1);
    },
    down() {
      this.$emit("settings-profile-exit");
    },
    back() {
      this.$emit("settings-profile-exit");
    },
    enter() {
      return () => this.$emit("settings-profile-activate");
    },
  },

  render: (s) => (
    <TvView show={s.tile.visible} w={160} h={240} scale={s.focused ? 1.04 : 1}>
      <TvView
        x={-4}
        y={-4}
        w={168}
        h={168}
        rounded={37}
        color={s.white}
        show={s.focused}
      />
      <TvView w={160} h={160} rounded={32} color={s.avatarGround} />
      <TvView
        w={160}
        h={160}
        rounded={32}
        color={s.letterGround}
        show={s.tile.image === ""}
      />
      <TvView
        w={160}
        h={160}
        rounded={32}
        src={s.tile.image}
        show={s.tile.image !== ""}
      />
      <TvText
        x={0}
        y={41}
        maxwidth={160}
        align={"center"}
        content={s.initialText}
        font={"Bricolage800"}
        size={64}
        color={s.white}
        show={s.tile.image === ""}
      />
      <TvText
        y={178}
        maxwidth={160}
        align={"center"}
        content={s.nameText}
        font={"Onest600"}
        size={26}
        color={s.tile.watching || s.focused ? s.primary : s.secondary}
      />
      <TvText
        y={212}
        maxwidth={160}
        align={"center"}
        content={s.watchingText}
        font={"Onest"}
        size={18}
        color={s.tertiary}
        show={s.tile.watching}
      />
    </TvView>
  ),
});

export const SettingsChoice = defineScreen({
  props: ["position", "choice"] as unknown as {
    position: number;
    choice: SettingsChoiceView;
  },

  state() {
    return {
      focused: false,
      labelText: "",
      white: tokens["color.fill.white"],
      onLight: tokens["color.on.light"],
      primary: tokens["color.text.primary"],
      danger: tokens["color.status.danger-tv"],
      clear: "rgba(0,0,0,0)",
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("settings-choice", this.position);
      this.$emit("settings-choice-focused", this.position);
    },
    unfocus() {
      this.focused = false;
    },
  },
  methods: {
    reveal() {
      this.labelText = this.choice.current
        ? `${this.choice.label} · Current`
        : this.choice.label;
    },
  },
  input: {
    up() {
      this.$emit("settings-choice-move", -1);
    },
    down() {
      this.$emit("settings-choice-move", 1);
    },
    back() {
      this.$emit("settings-dialog-back");
    },
    enter() {
      return () => this.$emit("settings-choice-activate");
    },
  },

  render: (s) => (
    <TvView show={s.choice.visible} w={680} h={76}>
      <TvView
        x={-8}
        y={-4}
        w={696}
        h={84}
        rounded={26}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={680}
        h={76}
        rounded={22}
        color={s.focused ? s.primary : s.clear}
      />
      <TvText
        x={30}
        y={21}
        content={s.labelText}
        font={"Onest600"}
        size={26}
        color={
          s.focused
            ? s.onLight
            : s.choice.value === "signout" ||
                s.choice.value === "remove" ||
                s.choice.value === "remove-addon"
              ? s.danger
              : s.primary
        }
      />
    </TvView>
  ),
});
