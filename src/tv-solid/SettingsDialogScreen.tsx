/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { SettingsChoice } from "./SettingsFocus";
import type { SettingsChoiceView } from "./settingsModel";

export interface SettingsDialogView {
  title: string;
  choices: SettingsChoiceView[];
  start: number;
  signout: boolean;
}

export const SettingsDialogScreen = defineScreen({
  components: { SettingsChoice },
  props: ["view"] as unknown as { view: SettingsDialogView },

  state() {
    return {
      okText: "",
      selectText: "",
      backText: "",
      cancelText: "",
      scrim: tokens["color.scrim.tv-panel"],
      panel: tokens["color.surface.1"],
      primary: tokens["color.text.primary"],
      secondary: tokens["color.text.secondary"],
      border: tokens["color.line.outline"],
    };
  },
  methods: {
    reveal() {
      this.okText = "OK";
      this.selectText = "Select";
      this.backText = "BACK";
      this.cancelText = "Cancel";
    },
  },

  render: (s) => (
    <TvView>
      <TvView w={1920} h={1080} color={s.scrim} />
      <TvView x={1100} y={0} w={820} h={1080} color={s.panel} />
      <TvText
        x={1164}
        y={62}
        maxwidth={710}
        content={s.view.title}
        font={"Bricolage700"}
        size={44}
        color={s.primary}
      />
      <SettingsChoice
        screenRef={"settingsChoice0"}
        position={0}
        choice={s.view.choices[0]}
        x={1164}
        y={129}
      />
      <SettingsChoice
        screenRef={"settingsChoice1"}
        position={1}
        choice={s.view.choices[1]}
        x={1164}
        y={223}
      />
      <SettingsChoice
        screenRef={"settingsChoice2"}
        position={2}
        choice={s.view.choices[2]}
        x={1164}
        y={317}
      />
      <SettingsChoice
        screenRef={"settingsChoice3"}
        position={3}
        choice={s.view.choices[3]}
        x={1164}
        y={411}
      />
      <SettingsChoice
        screenRef={"settingsChoice4"}
        position={4}
        choice={s.view.choices[4]}
        x={1164}
        y={505}
      />
      <SettingsChoice
        screenRef={"settingsChoice5"}
        position={5}
        choice={s.view.choices[5]}
        x={1164}
        y={599}
      />
      <SettingsChoice
        screenRef={"settingsChoice6"}
        position={6}
        choice={s.view.choices[6]}
        x={1164}
        y={693}
      />
      <SettingsChoice
        screenRef={"settingsChoice7"}
        position={7}
        choice={s.view.choices[7]}
        x={1164}
        y={787}
      />
      <TvView x={1530} y={994} w={45} h={31} rounded={8} color={s.border} />
      <TvText
        x={1540}
        y={1000}
        content={s.okText}
        font={"Onest700"}
        size={16}
        color={s.primary}
      />
      <TvText
        x={1588}
        y={999}
        content={s.selectText}
        font={"Onest"}
        size={20}
        color={s.secondary}
      />
      <TvView x={1682} y={994} w={66} h={31} rounded={8} color={s.border} />
      <TvText
        x={1691}
        y={1000}
        content={s.backText}
        font={"Onest700"}
        size={16}
        color={s.primary}
      />
      <TvText
        x={1762}
        y={999}
        content={s.cancelText}
        font={"Onest"}
        size={20}
        color={s.secondary}
      />
    </TvView>
  ),
});
