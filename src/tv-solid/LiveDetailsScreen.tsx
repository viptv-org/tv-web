/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { LiveDetailsOption } from "./LiveDetailsFocus";

export const LiveDetailsScreen = defineScreen({
  components: { LiveDetailsOption },
  props: [
    "title",
    "channel",
    "range",
    "description",
    "watchLabel",
    "closeLabel",
    "okLabel",
    "selectLabel",
    "backLabel",
  ] as unknown as {
    title: string;
    channel: string;
    range: string;
    description: string;
    watchLabel: string;
    closeLabel: string;
    okLabel: string;
    selectLabel: string;
    backLabel: string;
  },

  state() {
    return {
      scrim: tokens["color.scrim.tv-panel"],
      panel: tokens["color.surface.1"],
      primary: tokens["color.text.primary"],
      secondary: tokens["color.text.secondary"],
      body: tokens["color.text.body"],
      liveGround: tokens["color.status.live"],
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
        content={s.title}
        font={"Bricolage700"}
        size={44}
        color={s.primary}
      />
      <TvView x={1164} y={139} w={12} h={12} rounded={6} color={s.liveGround} />
      <TvText
        x={1188}
        y={132}
        content={s.channel}
        font={"Onest600"}
        size={22}
        color={s.secondary}
      />
      <TvText
        x={1273}
        y={132}
        content={s.range}
        font={"Onest"}
        size={22}
        color={s.secondary}
      />
      <TvText
        x={1164}
        y={182}
        maxwidth={660}
        maxlines={3}
        lineheight={34}
        content={s.description}
        font={"Onest"}
        size={24}
        color={s.body}
      />
      <LiveDetailsOption
        screenRef={"liveDetailsOption0"}
        position={0}
        label={s.watchLabel}
        x={1158}
        y={264}
      />
      <LiveDetailsOption
        screenRef={"liveDetailsOption1"}
        position={1}
        label={s.closeLabel}
        x={1158}
        y={358}
      />
      <TvView x={1100} y={976} w={820} h={104} color={s.panel} />
      <TvView x={1542} y={994} w={45} h={31} rounded={8} color={s.keyBorder} />
      <TvView x={1544} y={996} w={41} h={27} rounded={6} color={s.panel} />
      <TvText
        x={1550}
        y={1000}
        content={s.okLabel}
        font={"Onest700"}
        size={16}
        color={s.primary}
      />
      <TvText
        x={1600}
        y={999}
        content={s.selectLabel}
        font={"Onest"}
        size={20}
        color={s.body}
      />
      <TvView x={1694} y={994} w={66} h={31} rounded={8} color={s.keyBorder} />
      <TvView x={1696} y={996} w={62} h={27} rounded={6} color={s.panel} />
      <TvText
        x={1704}
        y={1000}
        content={s.backLabel}
        font={"Onest700"}
        size={16}
        color={s.primary}
      />
      <TvText
        x={1770}
        y={999}
        content={s.closeLabel}
        font={"Onest"}
        size={20}
        color={s.body}
      />
    </TvView>
  ),
});
