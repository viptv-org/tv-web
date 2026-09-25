/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import { railIcon } from "./railIcons";

export const railItems = [
  { index: 1, route: "search", icon: "search", label: "Search", y: 202 },
  { index: 2, route: "home", icon: "home", label: "Home", y: 282 },
  { index: 3, route: "discover", icon: "discover", label: "Discover", y: 360 },
  { index: 4, route: "live", icon: "live", label: "Live TV", y: 440 },
  { index: 5, route: "library", icon: "list", label: "My List", y: 516 },
  { index: 6, route: "settings", icon: "settings", label: "Settings", y: 978 },
] as const;

/** One collapsed rail for every browsing route; geometry is shared with its menu. */
export const CollapsedRail = (props: { avatar: string; current: string; show: boolean }) => (
  <TvView show={props.show}>
    <TvView x={44} y={54} w={56} h={56} rounded={28} color={tokens["color.surface.3"]} />
    <TvView x={50} y={60} w={44} h={44} rounded={22} src={props.avatar} show={props.avatar !== ""} />
    {railItems.map(item => <TvView>
      <TvView x={40} y={item.y - 20} w={64} h={64} rounded={32} color={tokens["color.surface.3"]} show={props.current === item.route} />
      <TvView x={60} y={item.y} w={24} h={24} src={railIcon(item.icon, props.current === item.route)} />
    </TvView>)}
  </TvView>
);

/** A labelled TV rail row. SolidTV owns focus and D-pad input while expanded. */
export const RailItem = defineScreen({
  props: [
    "position",
    "label",
    "icon",
    "focusedIcon",
    "current",
    "avatar",
    "profileName",
  ] as unknown as {
    position: number;
    label: string;
    icon: string;
    focusedIcon: string;
    current: boolean;
    avatar: string;
    profileName: string;
  },

  state() {
    return {
      focused: false,
      labelText: "",
      switchText: "",
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      secondary: tokens["color.text.secondary"],
      tertiary: tokens["color.text.tertiary"],
      onLight: tokens["color.on.light"],
      onLightSecondary: tokens["color.text.on-light-secondary"],
      avatarGround: tokens["color.surface.avatar"],
      clear: "rgba(0,0,0,0)",
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("rail-item", this.position);
      this.$emit("rail-focused", this.position);
    },
    unfocus() {
      this.focused = false;
    },
  },
  methods: {
    reveal() {
      this.labelText = this.position === 0 ? this.profileName : this.label;
      this.switchText = this.position === 0 ? "Switch profile" : "";
    },
  },
  input: {
    up() {
      this.$emit("rail-move", -1);
    },
    down() {
      this.$emit("rail-move", 1);
    },
    right() {
      this.$emit("rail-exit");
    },
    back() {
      this.$emit("rail-exit");
    },
    enter() {
      return () => this.$emit("rail-activate");
    },
  },

  render: (s) => (
    <TvView w={360} h={68}>
      <TvView
        x={-8}
        y={-4}
        w={376}
        h={76}
        rounded={38}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={360}
        h={68}
        rounded={34}
        color={s.focused ? s.primary : s.clear}
      />
      <TvView
        x={-4}
        y={6}
        w={56}
        h={56}
        rounded={28}
        color={s.avatarGround}
        show={s.position === 0}
      />
      <TvView
        x={2}
        y={12}
        zIndex={1}
        w={44}
        h={44}
        rounded={22}
        src={s.avatar}
        show={s.position === 0 && s.avatar !== ""}
      />
      <TvView
        x={12}
        y={22}
        zIndex={1}
        w={24}
        h={24}
        src={s.focused ? s.focusedIcon : s.icon}
        show={s.position !== 0}
      />
      <TvText
        x={76}
        y={s.position === 0 ? 8 : 18}
        content={s.labelText}
        font={
          s.focused || s.current || s.position === 0 ? "Onest700" : "Onest500"
        }
        size={26}
        color={s.focused ? s.onLight : s.current ? s.primary : s.secondary}
      />
      <TvText
        x={76}
        y={39}
        content={s.switchText}
        font={"Onest"}
        size={20}
        color={s.focused ? s.onLightSecondary : s.tertiary}
        show={s.position === 0}
      />
      <TvView
        x={326}
        y={30}
        w={8}
        h={8}
        rounded={4}
        color={s.primary}
        show={s.current && !s.focused}
      />
    </TvView>
  ),
});
