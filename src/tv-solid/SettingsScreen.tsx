/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { SettingsProfile, SettingsRow } from "./SettingsFocus";
import {
  SettingsDialogScreen,
  type SettingsDialogView,
} from "./SettingsDialogScreen";
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

export const SettingsScreen = defineScreen({
  components: { SettingsProfile, SettingsRow, SettingsDialogScreen },
  props: ["view", "panel", "dialogOpen", "dialog"] as unknown as {
    view: SettingsScreenView;
    panel: SettingsPanelView;
    dialogOpen: boolean;
    dialog: SettingsDialogView;
  },

  state() {
    return {
      okText: "",
      selectText: "",
      backText: "",
      backLabel: "",
      surface: tokens["color.surface.2"],
      primary: tokens["color.text.primary"],
      secondary: tokens["color.text.secondary"],
      tertiary: tokens["color.text.tertiary"],
      hairline: tokens["color.line.hairline"],
      border: tokens["color.line.outline"],
    };
  },
  methods: {
    reveal() {
      this.okText = "OK";
      this.selectText = "Select";
      this.backText = "BACK";
      this.backLabel = "Back";
    },
  },

  render: (s) => (
    <TvView>
      <TvView x={44} y={54} w={56} h={56} rounded={28} color={s.surface} />
      <TvView
        x={50}
        y={60}
        w={44}
        h={44}
        rounded={22}
        src={s.view.avatar}
        show={s.view.avatar !== ""}
      />
      <TvView x={60} y={202} w={24} h={24} src={s.view.railSearch} />
      <TvView x={60} y={282} w={24} h={24} src={s.view.railHome} />
      <TvView x={60} y={360} w={24} h={24} src={s.view.railDiscover} />
      <TvView x={60} y={440} w={24} h={24} src={s.view.railLive} />
      <TvView x={60} y={516} w={24} h={24} src={s.view.railList} />
      <TvView x={40} y={962} w={64} h={64} rounded={32} color={s.surface} />
      <TvView x={60} y={978} w={24} h={24} src={s.view.railSettings} />
      <TvText
        x={192}
        y={54}
        content={s.view.page}
        font={"Bricolage700"}
        size={56}
        color={s.primary}
      />
      <SettingsRow
        screenRef={"settingsRow0"}
        position={0}
        row={s.view.rows[0]}
        x={192}
        y={s.view.rows[0].y}
      />
      <SettingsRow
        screenRef={"settingsRow1"}
        position={1}
        row={s.view.rows[1]}
        x={192}
        y={s.view.rows[1].y}
      />
      <SettingsRow
        screenRef={"settingsRow2"}
        position={2}
        row={s.view.rows[2]}
        x={192}
        y={s.view.rows[2].y}
      />
      <SettingsRow
        screenRef={"settingsRow3"}
        position={3}
        row={s.view.rows[3]}
        x={192}
        y={s.view.rows[3].y}
      />
      <SettingsRow
        screenRef={"settingsRow4"}
        position={4}
        row={s.view.rows[4]}
        x={192}
        y={s.view.rows[4].y}
      />
      <SettingsRow
        screenRef={"settingsRow5"}
        position={5}
        row={s.view.rows[5]}
        x={192}
        y={s.view.rows[5].y}
      />
      <TvView
        x={212}
        y={629}
        w={680}
        h={2}
        color={s.hairline}
        show={s.view.page === "Settings"}
      />
      <TvText
        x={1040}
        y={190}
        maxwidth={780}
        content={s.panel.title}
        font={"Bricolage700"}
        size={38}
        color={s.primary}
      />
      <TvText
        x={1040}
        y={252}
        maxwidth={780}
        content={s.panel.description}
        font={"Onest"}
        size={24}
        color={s.secondary}
      />
      <SettingsProfile
        screenRef={"settingsProfile0"}
        position={0}
        tile={s.view.profiles[0]}
        x={1040}
        y={317}
        show={s.view.showProfiles}
      />
      <SettingsProfile
        screenRef={"settingsProfile1"}
        position={1}
        tile={s.view.profiles[1]}
        x={1232}
        y={317}
        show={s.view.showProfiles}
      />
      <SettingsProfile
        screenRef={"settingsProfile2"}
        position={2}
        tile={s.view.profiles[2]}
        x={1424}
        y={317}
        show={s.view.showProfiles}
      />
      <SettingsProfile
        screenRef={"settingsProfile3"}
        position={3}
        tile={s.view.profiles[3]}
        x={1616}
        y={317}
        show={s.view.showProfiles}
      />
      <TvText
        x={1040}
        y={323}
        maxwidth={780}
        content={s.panel.caption}
        font={"Onest"}
        size={22}
        color={s.tertiary}
        show={s.view.page !== "Settings"}
      />
      <TvView
        x={1040}
        y={624}
        w={784}
        h={2}
        color={s.hairline}
        show={s.view.page === "Settings"}
      />
      <TvText
        x={1040}
        y={654}
        content={s.view.version}
        font={"Onest"}
        size={22}
        color={s.tertiary}
        show={s.view.page === "Settings"}
      />
      <TvView x={1548} y={994} w={45} h={31} rounded={8} color={s.border} />
      <TvText
        x={1558}
        y={1000}
        content={s.okText}
        font={"Onest700"}
        size={16}
        color={s.primary}
      />
      <TvText
        x={1607}
        y={999}
        content={s.selectText}
        font={"Onest"}
        size={20}
        color={s.secondary}
      />
      <TvView x={1700} y={994} w={66} h={31} rounded={8} color={s.border} />
      <TvText
        x={1709}
        y={1000}
        content={s.backText}
        font={"Onest700"}
        size={16}
        color={s.primary}
      />
      <TvText
        x={1779}
        y={999}
        content={s.backLabel}
        font={"Onest"}
        size={20}
        color={s.secondary}
      />
      <SettingsDialogScreen
        screenRef={"settingsDialogScreen"}
        show={s.dialogOpen}
        view={s.dialog}
      />
    </TvView>
  ),
});
