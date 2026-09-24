import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";
import type { LiveSearchKeyView } from "./liveSearchModel";

const LiveSearchKey = Blits.Component("LiveSearchKey", {
  props: ["position", "keyView"] as unknown as { position: number; keyView: LiveSearchKeyView },
  template: `
    <Element :w="$keyView.width" h="64">
      <Element x="-10" y="-8" :w="$keyView.width + 20" h="80" rounded="18" color="$white" :show="$focused" />
      <Element :w="$keyView.width" h="64" rounded="14" :color="$focused ? $white : $field" />
      <Text x="0" y="13" :maxwidth="$keyView.width" align="center" :content="$labelText" font="Onest600" size="28" :color="$focused ? $dark : $white" />
    </Element>
  `,
  state() { return { focused: false, labelText: "", white: tokens["color.fill.white"], dark: tokens["color.on.light"], field: tokens["color.fill.tv-field"] }; },
  hooks: {
    focus() { this.focused = true; this.reveal(); noteFocus("live-search-key", this.position); this.$emit("live-search-key-focused", this.position); },
    unfocus() { this.focused = false; },
  },
  methods: {
    reveal() { this.labelText = this.keyView.label; },
    restoreFocus() { this.focused = true; this.reveal(); },
  },
  input: {
    left() { this.$emit("live-search-key-move", "left"); },
    right() { this.$emit("live-search-key-move", "right"); },
    up() { this.$emit("live-search-key-move", "up"); },
    down() { this.$emit("live-search-key-move", "down"); },
    back() { this.$emit("live-search-close"); },
    enter() { return () => this.$emit("live-search-key-activate"); },
  },
});

export const LiveSearchScreen = Blits.Component("LiveSearchScreen", {
  components: { LiveSearchKey },
  props: ["view"] as unknown as { view: { keys: LiveSearchKeyView[] } },
  template: `
    <Element>
      <Element w="1920" h="1080" color="$bg" />
      <Text x="96" y="96" :content="$titleText" font="Bricolage700" size="42" color="$white" />
      <Element x="96" y="169" w="992" h="96" rounded="22" color="$field" />
      <Text x="126" y="198" maxwidth="930" :content="$queryText" font="Onest600" size="36" color="$white" />
      <Element :x="$caretX" y="200" w="3" h="40" color="$accent" />
      <Text x="957" y="290" w="131" align="right" :content="$countText" font="Onest" size="22" color="$secondary" />
      <LiveSearchKey :for="(entry, index) in $view.keys" :ref="'liveSearchKey' + $entry.id" key="$entry.id" :position="$index" :keyView="$entry" :x="$entry.x" :y="$entry.y" />
      <Element x="1399" y="994" w="46" h="31" rounded="8" color="$border" />
      <Text x="1409" y="1000" :content="$okText" font="Onest700" size="16" color="$white" />
      <Text x="1458" y="999" :content="$typeText" font="Onest" size="20" color="$secondary" />
      <Element x="1541" y="994" w="66" h="31" rounded="8" color="$border" />
      <Text x="1551" y="1000" :content="$backText" font="Onest700" size="16" color="$white" />
      <Text x="1620" y="999" :content="$deleteText" font="Onest" size="20" color="$secondary" />
      <Element x="1716" y="994" w="46" h="31" rounded="8" color="$border" />
      <Text x="1721" y="1000" content="▶▶" font="Onest700" size="16" color="$white" />
      <Text x="1776" y="999" :content="$doneText" font="Onest" size="20" color="$secondary" />
    </Element>
  `,
  state() { return {
    titleText: "", okText: "", typeText: "", backText: "", deleteText: "", doneText: "",
    queryText: "", caretX: 126, countText: "0 / 128",
    bg: tokens["color.bg"], white: tokens["color.fill.white"], field: tokens["color.fill.tv-field"], accent: tokens["color.accent.default"],
    secondary: tokens["color.text.secondary"], border: tokens["color.line.outline"],
  }; },
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
});
