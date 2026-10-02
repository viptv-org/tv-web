/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type { SourceChipView, SourceRowView } from "./sourceModel";
import { canvasFont } from "./fonts";

let sourceMeasure: CanvasRenderingContext2D | null;
function wrapSourceDescription(value: string): string[] {
  sourceMeasure ??= document.createElement("canvas").getContext("2d")!;
  sourceMeasure.font = `20px ${canvasFont("Onest", 20)}`;
  const lines: string[] = [];
  let line = "";
  for (const word of value.trim().split(/\s+/)) {
    if (!word) continue;
    const joined = line ? `${line} ${word}` : word;
    if (sourceMeasure.measureText(joined).width <= 430) { line = joined; continue; }
    if (line) { lines.push(line); line = ""; }
    for (const point of word) {
      if (line && sourceMeasure.measureText(line + point).width > 430) { lines.push(line); line = point; }
      else line += point;
    }
  }
  if (line) lines.push(line);
  return lines;
}

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
        centerY={26}
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
        centerY={26}
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
      fileIdentity: "",
      fileOffset: 0,
      fileDistance: 0,
      fileTimer: 0,
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
      this.stopDescriptionMotion();
    },
    destroy() {
      clearTimeout(this.holdTimer);
      this.stopDescriptionMotion();
    },
  },
  methods: {
    stopDescriptionMotion() {
      clearInterval(this.fileTimer);
      this.fileTimer = 0;
      this.fileOffset = 0;
    },
    startDescriptionMotion() {
      this.stopDescriptionMotion();
      if (!this.focused || this.fileDistance <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const started = performance.now();
      const dwell = 1200;
      const travel = this.fileDistance / 12 * 1000;
      const cycle = 2 * (dwell + travel);
      this.fileTimer = window.setInterval(() => {
        const elapsed = (performance.now() - started) % cycle;
        this.fileOffset = elapsed < dwell ? 0
          : elapsed < dwell + travel ? (elapsed - dwell) / travel * this.fileDistance
          : elapsed < 2 * dwell + travel ? this.fileDistance
          : (cycle - elapsed) / travel * this.fileDistance;
      }, 50);
    },
    reveal(row?: SourceRowView) {
      const current = row ?? this.row;
      this.qualityText = current.quality;
      this.bestText = current.best ? "BEST MATCH" : "";
      this.providerText = current.provider;
      const identity = `${current.id}\u0000${current.file}`;
      if (identity !== this.fileIdentity) {
        this.fileIdentity = identity;
        const lines = wrapSourceDescription(current.file);
        this.fileText = lines.join("\n");
        this.fileDistance = Math.max(0, (lines.length - 2) * 24);
        this.startDescriptionMotion();
      } else if (this.focused && !this.fileTimer) this.startDescriptionMotion();
      this.playIcon = "▶";
    },
  },
  watch: {
    row(value: SourceRowView) {
      this.reveal(value);
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
        y={2}
        content={s.bestText}
        font={"Onest700"}
        size={18}
        color={s.focused ? s.onLightAccent : s.accent}
      />
      <TvText
        x={140}
        y={s.row.best ? 24 : 18}
        maxwidth={430}
        maxlines={1}
        content={s.providerText}
        font={"Onest700"}
        size={26}
        color={s.focused ? s.onLight : s.primary}
      />
      <TvView x={140} y={56} w={430} h={48} clipping>
        <TvText
          y={-s.fileOffset}
          maxwidth={430}
          content={s.fileText}
          font={"Onest"}
          size={20}
          lineheight={1.2}
          color={s.focused ? s.onLightSecondary : s.secondary}
        />
      </TvView>
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
