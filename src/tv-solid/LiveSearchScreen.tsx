/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText, KeyedFor } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type { LiveSearchKeyView } from "./liveSearchModel";

const LiveSearchKey = defineScreen({
  props: ["position", "keyView"] as unknown as {
    position: number;
    keyView: LiveSearchKeyView;
  },

  state() {
    return {
      focused: false,
      labelText: "",
      white: tokens["color.fill.white"],
      dark: tokens["color.on.light"],
      field: tokens["color.fill.tv-field"],
    };
  },
  hooks: {
    focus() {
      this.focused = true;
      this.reveal();
      noteFocus("live-search-key", this.position);
      this.$emit("live-search-key-focused", this.position);
    },
    unfocus() {
      this.focused = false;
    },
  },
  methods: {
    reveal() {
      this.labelText = this.keyView.label;
    },
    restoreFocus() {
      this.focused = true;
      this.reveal();
    },
  },
  input: {
    left() {
      this.$emit("live-search-key-move", "left");
    },
    right() {
      this.$emit("live-search-key-move", "right");
    },
    up() {
      this.$emit("live-search-key-move", "up");
    },
    down() {
      this.$emit("live-search-key-move", "down");
    },
    back() {
      this.$emit("live-search-close");
    },
    enter() {
      return () => this.$emit("live-search-key-activate");
    },
  },

  render: (s) => (
    <TvView w={s.keyView.width} h={64}>
      <TvView
        x={-10}
        y={-8}
        w={s.keyView.width + 20}
        h={80}
        rounded={18}
        color={s.white}
        show={s.focused}
      />
      <TvView
        w={s.keyView.width}
        h={64}
        rounded={14}
        color={s.focused ? s.white : s.field}
      />
      <TvText
        x={0}
        y={13}
        maxwidth={s.keyView.width}
        align={"center"}
        content={s.labelText}
        font={"Onest600"}
        size={28}
        color={s.focused ? s.dark : s.white}
      />
    </TvView>
  ),
});

export const LiveSearchScreen = defineScreen({
  components: { LiveSearchKey },
  props: ["view"] as unknown as { view: { keys: LiveSearchKeyView[] } },

  state() {
    return {
      titleText: "",
      okText: "",
      typeText: "",
      backText: "",
      deleteText: "",
      doneText: "",
      queryText: "",
      caretX: 126,
      countText: "0 / 128",
      bg: tokens["color.bg"],
      white: tokens["color.fill.white"],
      field: tokens["color.fill.tv-field"],
      accent: tokens["color.accent.default"],
      secondary: tokens["color.text.secondary"],
      border: tokens["color.line.outline"],
    };
  },
  methods: {
    setQuery(query: string) {
      this.queryText = query;
      this.caretX = 126 + query.length * 24;
      this.countText = `${query.length} / 128`;
    },
    reveal() {
      this.titleText = "Search live TV";
      this.okText = "OK";
      this.typeText = "Type";
      this.backText = "BACK";
      this.deleteText = "Delete";
      this.doneText = "Done";
    },
  },

  render: (s) => (
    <TvView>
      <TvView w={1920} h={1080} color={s.bg} />
      <TvText
        x={96}
        y={96}
        content={s.titleText}
        font={"Bricolage700"}
        size={42}
        color={s.white}
      />
      <TvView x={96} y={169} w={992} h={96} rounded={22} color={s.field} />
      <TvText
        x={126}
        y={198}
        maxwidth={930}
        content={s.queryText}
        font={"Onest600"}
        size={36}
        color={s.white}
      />
      <TvView x={s.caretX} y={200} w={3} h={40} color={s.accent} />
      <TvText
        x={957}
        y={290}
        w={131}
        align={"right"}
        content={s.countText}
        font={"Onest"}
        size={22}
        color={s.secondary}
      />
      {
        <KeyedFor each={s.view.keys} keyOf={(item) => item.id}>
          {(entry, index) => (
            <LiveSearchKey
              screenRef={"liveSearchKey" + entry().id}
              position={index()}
              keyView={entry()}
              x={entry().x}
              y={entry().y}
            />
          )}
        </KeyedFor>
      }
      <TvView x={1399} y={994} w={46} h={31} rounded={8} color={s.border} />
      <TvText
        x={1409}
        y={1000}
        content={s.okText}
        font={"Onest700"}
        size={16}
        color={s.white}
      />
      <TvText
        x={1458}
        y={999}
        content={s.typeText}
        font={"Onest"}
        size={20}
        color={s.secondary}
      />
      <TvView x={1541} y={994} w={66} h={31} rounded={8} color={s.border} />
      <TvText
        x={1551}
        y={1000}
        content={s.backText}
        font={"Onest700"}
        size={16}
        color={s.white}
      />
      <TvText
        x={1620}
        y={999}
        content={s.deleteText}
        font={"Onest"}
        size={20}
        color={s.secondary}
      />
      <TvView x={1716} y={994} w={46} h={31} rounded={8} color={s.border} />
      <TvText
        x={1721}
        y={1000}
        content={"▶▶"}
        font={"Onest700"}
        size={16}
        color={s.white}
      />
      <TvText
        x={1776}
        y={999}
        content={s.doneText}
        font={"Onest"}
        size={20}
        color={s.secondary}
      />
    </TvView>
  ),
});
