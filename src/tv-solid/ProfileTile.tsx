/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import type { TvProfile } from "../api";
import { tokens } from "../theme/viptv-tokens.generated";
import avatarCatalog from "../ui/avatars.json";
import { noteFocus } from "./focusDebug";
import { actionIcon } from "./actionIcons";

export interface ProfileTileData {
  id: string;
  name: string;
  image: string;
  initial: string;
  visible: boolean;
  add: boolean;
}

export const emptyProfileTile: ProfileTileData = {
  id: "",
  name: "",
  image: "",
  initial: "",
  visible: false,
  add: false,
};

export function profileTileData(profile: TvProfile): ProfileTileData {
  const style =
    typeof profile.raw.avatar_style === "string"
      ? profile.raw.avatar_style
      : "critters";
  const choice =
    typeof profile.raw.avatar_choice === "number"
      ? profile.raw.avatar_choice
      : 1;
  const available = avatarCatalog.categories.some(
    (category) =>
      category.style === style &&
      (!("available" in category) || category.available !== false),
  );
  return {
    id: profile.id,
    name: profile.name,
    image: available
      ? `${import.meta.env.BASE_URL}assets/avatar-catalog/${style}-${choice}.png`
      : "",
    initial: profile.name.trim().slice(0, 1).toUpperCase(),
    visible: true,
    add: false,
  };
}

export const addProfileTile: ProfileTileData = {
  id: "__add__",
  name: "Add profile",
  image: "",
  initial: "+",
  visible: true,
  add: true,
};

let cachedAddProfileOutline: string | undefined;
function addProfileOutline() {
  if (cachedAddProfileOutline) return cachedAddProfileOutline;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 220;
  const context = canvas.getContext("2d")!;
  context.strokeStyle = tokens["color.line.strong"];
  context.lineWidth = 4;
  context.setLineDash([6, 5]);
  context.beginPath();
  context.moveTo(46, 2);
  context.lineTo(174, 2);
  context.quadraticCurveTo(218, 2, 218, 46);
  context.lineTo(218, 174);
  context.quadraticCurveTo(218, 218, 174, 218);
  context.lineTo(46, 218);
  context.quadraticCurveTo(2, 218, 2, 174);
  context.lineTo(2, 46);
  context.quadraticCurveTo(2, 2, 46, 2);
  context.stroke();
  cachedAddProfileOutline = canvas.toDataURL("image/png");
  return cachedAddProfileOutline;
}

/** Each tile owns actual SolidTV focus and emits movement/activation to its screen. */
export const ProfileTile = defineScreen({
  // SolidTV accepts a name array at runtime; its TypeScript definitions model
  // props as a record. Keep the runtime form and type its instance shape.
  props: ["position", "tile", "x", "managing"] as unknown as {
    position: number;
    tile: ProfileTileData;
    x: number;
    managing: boolean;
  },

  state() {
    return {
      focused: false,
      imageFailed: false,
      lastImage: "",
      caption: "",
      letter: "",
      pencil: "",
      pressed: false,
      holdFired: false,
      holdTimer: 0,
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      secondary: tokens["color.text.secondary"],
      onLight: tokens["color.on.light"],
      background: tokens["color.bg"],
      avatarGround: tokens["color.surface.avatar"],
      letterGround: tokens["color.fill.profile-letter"],
      addOutline: addProfileOutline(),
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("profile-tile", this.position);
      this.$emit("profile-focus", this.position);
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
      this.caption = this.tile.name;
      this.letter = this.tile.initial;
      this.pencil = "✎";
      if (this.tile.image !== this.lastImage) {
        this.imageFailed = false;
        this.lastImage = this.tile.image;
      }
    },
    onImageError() {
      this.imageFailed = true;
    },
  },
  input: {
    left() {
      this.$emit("profile-move", { slot: this.position, delta: -1 });
    },
    right() {
      this.$emit("profile-move", { slot: this.position, delta: 1 });
    },
    down() {
      this.$emit("profile-manage-focus");
    },
    enter() {
      if (!this.pressed) {
        this.pressed = true;
        this.holdFired = false;
        this.holdTimer = window.setTimeout(() => {
          this.holdFired = true;
          this.$emit("profile-hold", this.position);
        }, 700);
      }
      return () => {
        clearTimeout(this.holdTimer);
        const activate = !this.holdFired;
        this.pressed = false;
        if (activate) this.$emit("profile-activate", this.position);
      };
    },
  },

  render: (s) => (
    <TvView y={398} show={s.tile.visible}>
      <TvView
        x={-4}
        y={-4}
        w={228}
        h={228}
        rounded={49}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={220}
        h={220}
        rounded={44}
        color={s.tile.add ? s.background : s.avatarGround}
      />
      <TvView w={220} h={220} src={s.addOutline} show={s.tile.add} />
      <TvView
        w={220}
        h={220}
        rounded={44}
        src={s.tile.image}
        show={s.tile.image !== "" && !s.imageFailed}
        onError={s.onImageError}
      />
      <TvView
        w={220}
        h={220}
        rounded={44}
        color={s.letterGround}
        show={!s.tile.add && (s.tile.image === "" || s.imageFailed)}
      />
      <TvText
        x={0}
        y={58}
        maxwidth={220}
        align={"center"}
        content={s.letter}
        font={"Bricolage800"}
        size={90}
        color={s.white}
        show={!s.tile.add && (s.tile.image === "" || s.imageFailed)}
      />
      <TvText
        x={0}
        y={56}
        maxwidth={220}
        align={"center"}
        content={s.letter}
        font={"Onest"}
        size={104}
        color={s.secondary}
        show={s.tile.add}
      />
      <TvText
        x={0}
        y={240}
        maxwidth={220}
        align={"center"}
        content={s.caption}
        font={s.focused ? "Onest700" : "Onest500"}
        size={28}
        color={s.focused ? s.primary : s.secondary}
      />
      <TvView
        x={164}
        y={164}
        w={40}
        h={40}
        rounded={20}
        color={s.white}
        show={s.managing && !s.tile.add}
      />
      <TvView
        x={173}
        y={173}
        w={22}
        h={22}
        src={actionIcon("pencil", true)}
        show={s.managing && !s.tile.add}
      />
    </TvView>
  ),
});

export const ManageProfilesButton = defineScreen({
  props: ["managing"] as unknown as { managing: boolean },

  state() {
    return {
      focused: false,
      caption: "",
      icon: "",
      primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"],
      surface: tokens["color.surface.3"],
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
    },
    unfocus() {
      this.focused = false;
    },
  },
  methods: {
    reveal() {
      this.caption = this.managing ? "Done" : "Manage profiles";
      this.icon = this.managing ? "✓" : "⚙";
    },
  },
  input: {
    up() {
      this.$emit("profile-restore-focus");
    },
    down() {
      this.$emit("profile-pager-focus");
    },
    enter() {
      return () => this.$emit("profile-manage-toggle");
    },
  },

  render: (s) => (
    <TvView
      x={828}
      y={761}
      w={264}
      h={60}
      rounded={30}
      color={s.focused ? s.primary : s.surface}
    >
      <TvView
        x={30}
        y={16}
        w={28}
        h={28}
        src={actionIcon(s.managing ? "check" : "settings", s.focused)}
      />
      <TvText
        x={67}
        y={17}
        content={s.caption}
        font={"Onest700"}
        size={22}
        color={s.focused ? s.onLight : s.primary}
      />
    </TvView>
  ),
});

export const ProfilePagerButton = defineScreen({
  props: ["position", "label", "disabled"] as unknown as { position: number; label: string; disabled: boolean },
  state() {
    return {
      focused: false,
      primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"],
      surface: tokens["color.surface.3"],
      white: tokens["color.fill.white"],
    };
  },
  hooks: {
    focus() { this.focused = true; noteFocus("profile-pager", this.position); },
    unfocus() { this.focused = false; },
  },
  input: {
    left() { this.$emit("profile-pager-move", -1); },
    right() { this.$emit("profile-pager-move", 1); },
    up() { this.$emit("profile-manage-focus"); },
    enter() { return () => { if (!this.disabled) this.$emit("profile-page-change", this.position === 0 ? -1 : 1); }; },
  },
  render: (s) => (
    <TvView w={220} h={56} alpha={s.disabled ? .4 : 1}>
      <TvView x={-4} y={-4} w={228} h={64} rounded={32} color={s.white} show={s.focused} />
      <TvView w={220} h={56} rounded={28} color={s.focused ? s.primary : s.surface} />
      <TvText x={0} y={14} maxwidth={220} align={"center"} content={s.label} font={"Onest700"} size={22} color={s.focused ? s.onLight : s.primary} />
    </TvView>
  ),
});
