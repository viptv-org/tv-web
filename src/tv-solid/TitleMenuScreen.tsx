/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { TitleMenuOption } from "./TitleMenuFocus";
import type { TitleMenuChoiceView } from "./titleMenuModel";

/** Right-side TV held-card menu and queue-removal Undo view. */
export const TitleMenuScreen = defineScreen({
  components: { TitleMenuOption },
  props: [
    "heading",
    "choices",
    "notice",
    "okLabel",
    "selectLabel",
    "backLabel",
    "cancelLabel",
  ] as unknown as {
    heading: string;
    choices: TitleMenuChoiceView[];
    okLabel: string;
    selectLabel: string;
    backLabel: string;
    cancelLabel: string;
    notice: string;
  },

  state() {
    return {
      scrim: tokens["color.scrim.tv-panel"],
      panel: tokens["color.surface.1"],
      primary: tokens["color.text.primary"],
      body: tokens["color.text.body"],
      keyBorder: tokens["color.line.keycap-tv"],
    };
  },

  render: (s) => (
    <TvView w={1920} h={1080} zIndex={30}>
      <TvView w={1920} h={1080} color={s.scrim} />
      <TvView x={1100} y={0} w={820} h={1080} color={s.panel} />
      <TvText
        x={1164}
        y={64}
        maxwidth={660}
        maxlines={2}
        lineheight={48}
        content={s.heading}
        font={"Bricolage700"}
        size={44}
        color={s.primary}
      />
      <TitleMenuOption
        screenRef={"titleMenuOption0"}
        position={0}
        choice={s.choices[0]}
        x={1164}
        y={179}
      />
      <TitleMenuOption
        screenRef={"titleMenuOption1"}
        position={1}
        choice={s.choices[1]}
        x={1164}
        y={273}
      />
      <TitleMenuOption
        screenRef={"titleMenuOption2"}
        position={2}
        choice={s.choices[2]}
        x={1164}
        y={367}
      />
      <TitleMenuOption
        screenRef={"titleMenuOption3"}
        position={3}
        choice={s.choices[3]}
        x={1164}
        y={461}
      />
      <TitleMenuOption
        screenRef={"titleMenuOption4"}
        position={4}
        choice={s.choices[4]}
        x={1164}
        y={555}
      />
      <TitleMenuOption
        screenRef={"titleMenuOption5"}
        position={5}
        choice={s.choices[5]}
        x={1164}
        y={649}
      />
      <TitleMenuOption
        screenRef={"titleMenuOption6"}
        position={6}
        choice={s.choices[6]}
        x={1164}
        y={743}
      />
      <TvText
        x={1164}
        y={863}
        maxwidth={660}
        content={s.notice}
        font={"Onest"}
        size={22}
        color={s.body}
      />
      <TvView x={1100} y={976} w={820} h={104} color={s.panel} />
      <TvView x={1530} y={994} w={45} h={31} rounded={8} color={s.keyBorder} />
      <TvView x={1532} y={996} w={41} h={27} rounded={6} color={s.panel} />
      <TvText
        x={1538}
        y={1000}
        content={s.okLabel}
        font={"Onest700"}
        size={16}
        color={s.primary}
      />
      <TvText
        x={1588}
        y={999}
        content={s.selectLabel}
        font={"Onest"}
        size={20}
        color={s.body}
      />
      <TvView x={1682} y={994} w={66} h={31} rounded={8} color={s.keyBorder} />
      <TvView x={1684} y={996} w={62} h={27} rounded={6} color={s.panel} />
      <TvText
        x={1693}
        y={1000}
        content={s.backLabel}
        font={"Onest700"}
        size={16}
        color={s.primary}
      />
      <TvText
        x={1760}
        y={999}
        content={s.cancelLabel}
        font={"Onest"}
        size={20}
        color={s.body}
      />
    </TvView>
  ),
});
