import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import { SettingsChoice } from "./SettingsFocus";
import type { SettingsChoiceView } from "./settingsModel";

export interface SettingsDialogView {
  title: string;
  choices: SettingsChoiceView[];
  start: number;
  signout: boolean;
}

export const SettingsDialogScreen = Blits.Component("SettingsDialogScreen", {
  components: { SettingsChoice },
  props: ["view"] as unknown as { view: SettingsDialogView },
  template: `
    <Element>
      <Element w="1920" h="1080" color="$scrim" />
      <Element x="1100" y="0" w="820" h="1080" color="$panel" />
      <Text x="1164" y="62" maxwidth="710" :content="$view.title" font="Bricolage700" size="44" color="$primary" />
      <SettingsChoice ref="settingsChoice0" position="0" :choice="$view.choices[0]" x="1164" y="129" />
      <SettingsChoice ref="settingsChoice1" position="1" :choice="$view.choices[1]" x="1164" y="223" />
      <SettingsChoice ref="settingsChoice2" position="2" :choice="$view.choices[2]" x="1164" y="317" />
      <SettingsChoice ref="settingsChoice3" position="3" :choice="$view.choices[3]" x="1164" y="411" />
      <SettingsChoice ref="settingsChoice4" position="4" :choice="$view.choices[4]" x="1164" y="505" />
      <SettingsChoice ref="settingsChoice5" position="5" :choice="$view.choices[5]" x="1164" y="599" />
      <SettingsChoice ref="settingsChoice6" position="6" :choice="$view.choices[6]" x="1164" y="693" />
      <SettingsChoice ref="settingsChoice7" position="7" :choice="$view.choices[7]" x="1164" y="787" />
      <Element x="1530" y="994" w="45" h="31" rounded="8" color="$border" />
      <Text x="1540" y="1000" :content="$okText" font="Onest700" size="16" color="$primary" />
      <Text x="1588" y="999" :content="$selectText" font="Onest" size="20" color="$secondary" />
      <Element x="1682" y="994" w="66" h="31" rounded="8" color="$border" />
      <Text x="1691" y="1000" :content="$backText" font="Onest700" size="16" color="$primary" />
      <Text x="1762" y="999" :content="$cancelText" font="Onest" size="20" color="$secondary" />
    </Element>
  `,
  state() { return {
    okText: "", selectText: "", backText: "", cancelText: "",
    scrim: tokens["color.scrim.tv-panel"], panel: tokens["color.surface.1"],
    primary: tokens["color.text.primary"], secondary: tokens["color.text.secondary"],
    border: tokens["color.line.outline"],
  }; },
  methods: {
    reveal() { this.okText = "OK"; this.selectText = "Select"; this.backText = "BACK"; this.cancelText = "Cancel"; },
  },
});
