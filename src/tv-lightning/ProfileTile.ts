import Blits from "@lightningjs/blits";
import type { TvProfile } from "../api";
import { tokens } from "../theme/viptv-tokens.generated";
import avatarCatalog from "../ui/avatars.json";
import { noteFocus } from "./focusDebug";

export interface ProfileTileData {
  id: string;
  name: string;
  image: string;
  initial: string;
  visible: boolean;
  add: boolean;
}

export const emptyProfileTile: ProfileTileData = {
  id: "", name: "", image: "", initial: "", visible: false, add: false,
};

export function profileTileData(profile: TvProfile): ProfileTileData {
  const style = typeof profile.raw.avatar_style === "string" ? profile.raw.avatar_style : "critters";
  const choice = typeof profile.raw.avatar_choice === "number" ? profile.raw.avatar_choice : 1;
  const available = avatarCatalog.categories.some(category =>
    category.style === style && (!("available" in category) || category.available !== false));
  return {
    id: profile.id,
    name: profile.name,
    image: available ? `${import.meta.env.BASE_URL}assets/avatar-catalog/${style}-${choice}.png` : "",
    initial: profile.name.trim().slice(0, 1).toUpperCase(),
    visible: true,
    add: false,
  };
}

export const addProfileTile: ProfileTileData = {
  id: "__add__", name: "Add profile", image: "", initial: "+", visible: true, add: true,
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

/** Each tile owns actual Blits focus and emits movement/activation to its screen. */
export const ProfileTile = Blits.Component("ProfileTile", {
  // Blits accepts a name array at runtime; its TypeScript definitions model
  // props as a record. Keep the runtime form and type its instance shape.
  props: ["position", "tile", "x", "managing"] as unknown as {
    position: number; tile: ProfileTileData; x: number; managing: boolean;
  },
  template: `
    <Element y="398" :show="$tile.visible" :scale="$focused ? 1.06 : 1">
      <Element x="-4" y="-4" w="228" h="228" rounded="49" color="$white" :show="$focused" />
      <Element w="220" h="220" rounded="44" :color="$tile.add ? $background : $avatarGround" />
      <Element w="220" h="220" :src="$addOutline" :show="$tile.add" />
      <Element w="220" h="220" rounded="44" :src="$tile.image" :show="$tile.image !== '' && !$imageFailed" @error="$onImageError" />
      <Element w="220" h="220" rounded="44" color="$letterGround" :show="!$tile.add && ($tile.image === '' || $imageFailed)" />
      <Text x="0" y="58" maxwidth="220" align="center" :content="$letter" font="Bricolage800" size="90" color="$white" :show="!$tile.add && ($tile.image === '' || $imageFailed)" />
      <Text x="0" y="56" maxwidth="220" align="center" :content="$letter" font="Onest" size="104" color="$secondary" :show="$tile.add" />
      <Text x="0" :y="$focused ? 250 : 240" maxwidth="220" align="center" :content="$caption" :font="$focused ? 'Onest700' : 'Onest500'" size="28" :color="$focused ? $primary : $secondary" />
      <Element x="174" y="174" w="40" h="40" rounded="20" color="$white" :show="$managing && !$tile.add" />
      <Text x="182" y="180" :content="$pencil" font="Onest" size="26" color="$onLight" :show="$managing && !$tile.add" />
    </Element>
  `,
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
    unfocus() { this.focused = false; clearTimeout(this.holdTimer); },
    destroy() { clearTimeout(this.holdTimer); },
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
    onImageError() { this.imageFailed = true; },
  },
  input: {
    left() { this.$emit("profile-move", { slot: this.position, delta: -1 }); },
    right() { this.$emit("profile-move", { slot: this.position, delta: 1 }); },
    down() { this.$emit("profile-manage-focus"); },
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
});

export const ManageProfilesButton = Blits.Component("ManageProfilesButton", {
  props: ["managing"] as unknown as { managing: boolean },
  template: `
    <Element x="824" y="761" w="272" h="60" rounded="30" :color="$focused ? $primary : $surface">
      <Text x="30" y="13" :content="$icon" font="Onest" size="25" :color="$focused ? $onLight : $primary" />
      <Text x="67" y="14" :content="$caption" font="Onest700" size="22" :color="$focused ? $onLight : $primary" />
    </Element>
  `,
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
    focus() { this.focused = true; this.reveal(); },
    unfocus() { this.focused = false; },
  },
  methods: {
    reveal() {
      this.caption = this.managing ? "Done" : "Manage profiles";
      this.icon = this.managing ? "✓" : "⚙";
    },
  },
  input: {
    up() { this.$emit("profile-restore-focus"); },
    enter() { return () => this.$emit("profile-manage-toggle"); },
  },
});
