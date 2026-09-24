/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type {
  LiveChannelView,
  LiveFilterView,
  LiveProgramView,
} from "./liveModel";

export const LiveFilterChip = defineScreen({
  props: ["position", "filter"] as unknown as {
    position: number;
    filter: LiveFilterView;
  },

  state() {
    return {
      focused: false,
      labelText: "",
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      selected: tokens["color.fill.tv-selected"],
      onLight: tokens["color.on.light"],
      secondary: tokens["color.text.secondary"],
      clear: "rgba(0,0,0,0)",
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("live-filter", this.position);
      this.$emit("live-filter-focused", this.position);
    },
    unfocus() {
      this.focused = false;
    },
  },
  methods: {
    reveal() {
      this.labelText = this.filter.label;
    },
  },
  input: {
    left() {
      this.$emit("live-filter-move", -1);
    },
    right() {
      this.$emit("live-filter-move", 1);
    },
    down() {
      this.$emit("live-enter-channels");
    },
    enter() {
      return () => this.$emit("live-filter-activate");
    },
  },

  render: (s) => (
    <TvView w={s.filter.width} h={56}>
      <TvView
        x={-4}
        y={-4}
        w={s.filter.width + 8}
        h={64}
        rounded={32}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={s.filter.width}
        h={56}
        rounded={28}
        color={s.focused ? s.primary : s.filter.selected ? s.selected : s.clear}
      />
      <TvText
        x={28}
        y={13}
        content={s.labelText}
        font={"Onest700"}
        size={24}
        color={
          s.focused ? s.onLight : s.filter.selected ? s.primary : s.secondary
        }
        show={s.filter.icon === ""}
      />
      <TvView
        x={(s.filter.width - 28) / 2}
        y={14}
        w={28}
        h={28}
        src={s.filter.icon}
        show={s.filter.icon !== ""}
      />
    </TvView>
  ),
});

export const LiveChannel = defineScreen({
  props: ["row", "channel"] as unknown as {
    row: number;
    channel: LiveChannelView;
  },

  state() {
    return {
      focused: false,
      numberText: "",
      monoText: "",
      nameText: "",
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      onLight: tokens["color.on.light"],
      tertiary: tokens["color.text.tertiary"],
      badge: tokens["color.surface.2"],
      lightBadge: tokens["color.fill.on-light-badge"],
      clear: "rgba(0,0,0,0)",
      pressed: false,
      holdFired: false,
      holdTimer: 0,
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("guide-channel", this.row);
      this.$emit("guide-channel-focused", this.row);
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
      this.numberText = this.channel.number;
      this.monoText = this.channel.monogram;
      this.nameText = this.channel.name;
    },
  },
  input: {
    up() {
      this.$emit("guide-channel-move", -1);
    },
    down() {
      this.$emit("guide-channel-move", 1);
    },
    left() {
      this.$emit("guide-channel-left");
    },
    right() {
      this.$emit("guide-program-enter", this.row);
    },
    menu() {
      this.$emit("guide-channel-hold", this.row);
    },
    enter() {
      if (!this.pressed) {
        this.pressed = true;
        this.holdFired = false;
        this.holdTimer = window.setTimeout(() => {
          this.holdFired = true;
          this.$emit("guide-channel-hold", this.row);
        }, 700);
      }
      return () => {
        clearTimeout(this.holdTimer);
        const activate = !this.holdFired;
        this.pressed = false;
        if (activate) this.$emit("guide-channel-activate", this.row);
      };
    },
  },

  render: (s) => (
    <TvView w={300} h={88}>
      <TvView
        x={-4}
        y={-4}
        w={308}
        h={96}
        rounded={20}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={300}
        h={88}
        rounded={16}
        color={s.focused ? s.primary : s.clear}
      />
      <TvText
        x={18}
        y={30}
        content={s.numberText}
        font={"Onest"}
        size={18}
        color={s.focused ? s.onLight : s.tertiary}
      />
      <TvView
        x={50}
        y={6}
        w={72}
        h={72}
        rounded={16}
        color={s.focused ? s.lightBadge : s.badge}
      />
      <TvText
        x={55}
        y={31}
        maxwidth={62}
        align={"center"}
        content={s.monoText}
        font={"Onest700"}
        size={16}
        color={s.focused ? s.onLight : s.primary}
      />
      <TvText
        x={140}
        y={29}
        maxwidth={160}
        maxlines={1}
        content={s.nameText}
        font={"Onest600"}
        size={22}
        color={s.focused ? s.onLight : s.primary}
      />
    </TvView>
  ),
});

export const LiveProgram = defineScreen({
  props: ["position", "block"] as unknown as {
    position: number;
    block: LiveProgramView;
  },

  state() {
    return {
      focused: false,
      rangeText: "",
      titleText: "",
      white: tokens["color.fill.white"],
      primary: tokens["color.text.primary"],
      tertiary: tokens["color.text.tertiary"],
      onLight: tokens["color.on.light"],
      onLightSecondary: tokens["color.text.on-light-secondary"],
      airing: tokens["color.guide.airing-tv"],
      upcoming: tokens["color.guide.upcoming-tv"],
      accent: tokens["color.accent.default"],
      pressed: false,
      holdFired: false,
      holdTimer: 0,
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("guide-program", this.position);
      this.$emit("guide-program-focused", {
        row: this.block.row,
        index: this.block.index,
        position: this.position,
      });
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
      this.rangeText = this.block.range;
      this.titleText = this.block.title;
    },
  },
  input: {
    left() {
      this.$emit("guide-program-move", {
        position: this.position,
        direction: "left",
      });
    },
    right() {
      this.$emit("guide-program-move", {
        position: this.position,
        direction: "right",
      });
    },
    up() {
      this.$emit("guide-program-move", {
        position: this.position,
        direction: "up",
      });
    },
    down() {
      this.$emit("guide-program-move", {
        position: this.position,
        direction: "down",
      });
    },
    menu() {
      this.$emit("guide-program-hold", this.position);
    },
    enter() {
      if (!this.pressed) {
        this.pressed = true;
        this.holdFired = false;
        this.holdTimer = window.setTimeout(() => {
          this.holdFired = true;
          this.$emit("guide-program-hold", this.position);
        }, 700);
      }
      return () => {
        clearTimeout(this.holdTimer);
        const activate = !this.holdFired;
        this.pressed = false;
        if (activate) this.$emit("guide-program-activate", this.position);
      };
    },
  },

  render: (s) => (
    <TvView w={s.block.width} h={88}>
      <TvView
        x={-4}
        y={-4}
        w={s.block.width + 8}
        h={96}
        rounded={20}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={s.block.width}
        h={88}
        rounded={16}
        color={s.focused ? s.primary : s.block.airing ? s.airing : s.upcoming}
      />
      <TvText
        x={20}
        y={14}
        content={s.rangeText}
        font={"Onest"}
        size={18}
        color={s.focused ? s.onLightSecondary : s.tertiary}
      />
      <TvText
        x={20}
        y={45}
        maxwidth={s.block.width - 40}
        maxlines={1}
        content={s.titleText}
        font={"Onest600"}
        size={24}
        color={s.focused ? s.onLight : s.primary}
      />
      <TvView
        x={0}
        y={83}
        w={s.block.width * s.block.progress}
        h={5}
        color={s.accent}
        show={s.block.airing && !s.focused}
      />
    </TvView>
  ),
});
