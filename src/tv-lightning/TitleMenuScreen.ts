import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import { TitleMenuOption } from "./TitleMenuFocus";
import type { TitleMenuChoiceView } from "./titleMenuModel";

/** Right-side TV held-card menu and queue-removal Undo view. */
export const TitleMenuScreen = Blits.Component("TitleMenuScreen", {
  components: { TitleMenuOption },
  props: ["heading", "choices", "notice", "okLabel", "selectLabel", "backLabel", "cancelLabel"] as unknown as {
    heading: string; choices: TitleMenuChoiceView[]; okLabel: string;
    selectLabel: string; backLabel: string; cancelLabel: string; notice: string;
  },
  template: `
    <Element w="1920" h="1080" zIndex="30">
      <Element w="1920" h="1080" color="$scrim" />
      <Element x="1100" y="0" w="820" h="1080" color="$panel" />
      <Text x="1164" y="64" maxwidth="660" maxlines="2" lineheight="48" :content="$heading" font="Bricolage700" size="44" color="$primary" />
      <TitleMenuOption ref="titleMenuOption0" position="0" :choice="$choices[0]" x="1164" y="179" />
      <TitleMenuOption ref="titleMenuOption1" position="1" :choice="$choices[1]" x="1164" y="273" />
      <TitleMenuOption ref="titleMenuOption2" position="2" :choice="$choices[2]" x="1164" y="367" />
      <TitleMenuOption ref="titleMenuOption3" position="3" :choice="$choices[3]" x="1164" y="461" />
      <TitleMenuOption ref="titleMenuOption4" position="4" :choice="$choices[4]" x="1164" y="555" />
      <TitleMenuOption ref="titleMenuOption5" position="5" :choice="$choices[5]" x="1164" y="649" />
      <TitleMenuOption ref="titleMenuOption6" position="6" :choice="$choices[6]" x="1164" y="743" />
      <Text x="1164" y="863" maxwidth="660" :content="$notice" font="Onest" size="22" color="$body" />
      <Element x="1100" y="976" w="820" h="104" color="$panel" />
      <Element x="1530" y="994" w="45" h="31" rounded="8" color="$keyBorder" />
      <Element x="1532" y="996" w="41" h="27" rounded="6" color="$panel" />
      <Text x="1538" y="1000" :content="$okLabel" font="Onest700" size="16" color="$primary" />
      <Text x="1588" y="999" :content="$selectLabel" font="Onest" size="20" color="$body" />
      <Element x="1682" y="994" w="66" h="31" rounded="8" color="$keyBorder" />
      <Element x="1684" y="996" w="62" h="27" rounded="6" color="$panel" />
      <Text x="1693" y="1000" :content="$backLabel" font="Onest700" size="16" color="$primary" />
      <Text x="1760" y="999" :content="$cancelLabel" font="Onest" size="20" color="$body" />
    </Element>
  `,
  state() {
    return {
      scrim: tokens["color.scrim.tv-panel"], panel: tokens["color.surface.1"],
      primary: tokens["color.text.primary"], body: tokens["color.text.body"],
      keyBorder: tokens["color.line.keycap-tv"],
    };
  },
});
