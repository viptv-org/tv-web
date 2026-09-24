import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import { SettingsProfile, SettingsRow } from "./SettingsFocus";
import { SettingsDialogScreen, type SettingsDialogView } from "./SettingsDialogScreen";
import type { SettingsProfileView, SettingsRowView } from "./settingsModel";

export interface SettingsScreenView {
  page: string;
  rows: SettingsRowView[];
  profiles: SettingsProfileView[];
  showProfiles: boolean;
  avatar: string;
  railSearch: string;
  railHome: string;
  railDiscover: string;
  railLive: string;
  railList: string;
  railSettings: string;
  version: string;
}
export interface SettingsPanelView {
  title: string;
  description: string;
  caption: string;
}

export const SettingsScreen = Blits.Component("SettingsScreen", {
  components: { SettingsProfile, SettingsRow, SettingsDialogScreen },
  props: ["view", "panel", "dialogOpen", "dialog"] as unknown as { view: SettingsScreenView; panel: SettingsPanelView; dialogOpen: boolean; dialog: SettingsDialogView },
  template: `
    <Element>
      <Element x="44" y="54" w="56" h="56" rounded="28" color="$surface" />
      <Element x="50" y="60" w="44" h="44" rounded="22" :src="$view.avatar" :show="$view.avatar !== ''" />
      <Element x="60" y="202" w="24" h="24" :src="$view.railSearch" />
      <Element x="60" y="282" w="24" h="24" :src="$view.railHome" />
      <Element x="60" y="360" w="24" h="24" :src="$view.railDiscover" />
      <Element x="60" y="440" w="24" h="24" :src="$view.railLive" />
      <Element x="60" y="516" w="24" h="24" :src="$view.railList" />
      <Element x="40" y="962" w="64" h="64" rounded="32" color="$surface" />
      <Element x="60" y="978" w="24" h="24" :src="$view.railSettings" />
      <Text x="192" y="54" :content="$view.page" font="Bricolage700" size="56" color="$primary" />
      <SettingsRow ref="settingsRow0" position="0" :row="$view.rows[0]" x="192" :y="$view.rows[0].y" />
      <SettingsRow ref="settingsRow1" position="1" :row="$view.rows[1]" x="192" :y="$view.rows[1].y" />
      <SettingsRow ref="settingsRow2" position="2" :row="$view.rows[2]" x="192" :y="$view.rows[2].y" />
      <SettingsRow ref="settingsRow3" position="3" :row="$view.rows[3]" x="192" :y="$view.rows[3].y" />
      <SettingsRow ref="settingsRow4" position="4" :row="$view.rows[4]" x="192" :y="$view.rows[4].y" />
      <SettingsRow ref="settingsRow5" position="5" :row="$view.rows[5]" x="192" :y="$view.rows[5].y" />
      <Element x="212" y="629" w="680" h="2" color="$hairline" :show="$view.page === 'Settings'" />
      <Text x="1040" y="190" maxwidth="780" :content="$panel.title" font="Bricolage700" size="38" color="$primary" />
      <Text x="1040" y="252" maxwidth="780" :content="$panel.description" font="Onest" size="24" color="$secondary" />
      <SettingsProfile ref="settingsProfile0" position="0" :tile="$view.profiles[0]" x="1040" y="317" :show="$view.showProfiles" />
      <SettingsProfile ref="settingsProfile1" position="1" :tile="$view.profiles[1]" x="1232" y="317" :show="$view.showProfiles" />
      <SettingsProfile ref="settingsProfile2" position="2" :tile="$view.profiles[2]" x="1424" y="317" :show="$view.showProfiles" />
      <SettingsProfile ref="settingsProfile3" position="3" :tile="$view.profiles[3]" x="1616" y="317" :show="$view.showProfiles" />
      <Text x="1040" y="323" maxwidth="780" :content="$panel.caption" font="Onest" size="22" color="$tertiary" :show="$view.page !== 'Settings'" />
      <Element x="1040" y="624" w="784" h="2" color="$hairline" :show="$view.page === 'Settings'" />
      <Text x="1040" y="654" :content="$view.version" font="Onest" size="22" color="$tertiary" :show="$view.page === 'Settings'" />
      <Element x="1548" y="994" w="45" h="31" rounded="8" color="$border" />
      <Text x="1558" y="1000" :content="$okText" font="Onest700" size="16" color="$primary" />
      <Text x="1607" y="999" :content="$selectText" font="Onest" size="20" color="$secondary" />
      <Element x="1700" y="994" w="66" h="31" rounded="8" color="$border" />
      <Text x="1709" y="1000" :content="$backText" font="Onest700" size="16" color="$primary" />
      <Text x="1779" y="999" :content="$backLabel" font="Onest" size="20" color="$secondary" />
      <SettingsDialogScreen ref="settingsDialogScreen" :show="$dialogOpen" :view="$dialog" />
    </Element>
  `,
  state() { return {
    okText: "", selectText: "", backText: "", backLabel: "",
    surface: tokens["color.surface.2"], primary: tokens["color.text.primary"],
    secondary: tokens["color.text.secondary"], tertiary: tokens["color.text.tertiary"],
    hairline: tokens["color.line.hairline"], border: tokens["color.line.outline"],
  }; },
  methods: {
    reveal() { this.okText = "OK"; this.selectText = "Select"; this.backText = "BACK"; this.backLabel = "Back"; },
  },
});
