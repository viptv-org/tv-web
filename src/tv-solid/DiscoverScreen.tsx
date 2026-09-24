/** @jsxImportSource @solidtv/solid */
import type { DiscoverCardView, DiscoverChipView } from "./discoverModel";
import { defineScreen, TvView, TvText } from "./runtime";
import { DiscoverCard, DiscoverChip } from "./DiscoverFocus";

/** Discover canvas, isolated so SolidTV parses a bounded screen template. */
export const DiscoverScreen = defineScreen({
  components: { DiscoverCard, DiscoverChip },
  props: [
    "homeProfileAvatar",
    "railSearch",
    "railHome",
    "railDiscoverSelected",
    "railLive",
    "railList",
    "railSettings",
    "surface",
    "discoverHeading",
    "discoverChips",
    "discoverCards",
    "discoverWindowStart",
    "discoverError",
    "discoverOkLabel",
    "discoverSelectLabel",
    "discoverOptionsIcon",
    "discoverOptionsLabel",
    "background",
    "primary",
    "body",
    "keyBorder",
  ] as unknown as {
    homeProfileAvatar: string;
    railSearch: string;
    railHome: string;
    railDiscoverSelected: string;
    railLive: string;
    railList: string;
    railSettings: string;
    surface: string;
    discoverHeading: string;
    discoverChips: DiscoverChipView[];
    discoverCards: DiscoverCardView[];
    discoverWindowStart: number;
    discoverError: string;
    discoverOkLabel: string;
    discoverSelectLabel: string;
    discoverOptionsIcon: string;
    discoverOptionsLabel: string;
    background: string;
    primary: string;
    body: string;
    keyBorder: string;
  },

  render: (s) => (
    <TvView>
      <TvView x={44} y={54} w={56} h={56} rounded={28} color={s.surface} />
      <TvView
        x={44}
        y={54}
        w={56}
        h={56}
        rounded={28}
        src={s.homeProfileAvatar}
        show={s.homeProfileAvatar !== ""}
      />
      <TvView x={58} y={202} w={28} h={28} src={s.railSearch} />
      <TvView x={58} y={280} w={28} h={28} src={s.railHome} />
      <TvView x={40} y={340} w={64} h={64} rounded={32} color={s.surface} />
      <TvView x={58} y={358} w={28} h={28} src={s.railDiscoverSelected} />
      <TvView x={58} y={436} w={28} h={28} src={s.railLive} />
      <TvView x={58} y={514} w={28} h={28} src={s.railList} />
      <TvView x={58} y={976} w={28} h={28} src={s.railSettings} />
      <TvText
        x={192}
        y={54}
        content={s.discoverHeading}
        font={"Bricolage700"}
        size={52}
        color={s.primary}
      />
      <DiscoverChip
        screenRef={"discoverChip0"}
        position={0}
        chip={s.discoverChips[0]}
        x={s.discoverChips[0].x}
        y={135}
      />
      <DiscoverChip
        screenRef={"discoverChip1"}
        position={1}
        chip={s.discoverChips[1]}
        x={s.discoverChips[1].x}
        y={135}
      />
      <DiscoverChip
        screenRef={"discoverChip2"}
        position={2}
        chip={s.discoverChips[2]}
        x={s.discoverChips[2].x}
        y={135}
      />
      <DiscoverChip
        screenRef={"discoverChip3"}
        position={3}
        chip={s.discoverChips[3]}
        x={s.discoverChips[3].x}
        y={135}
      />
      <DiscoverChip
        screenRef={"discoverChip4"}
        position={4}
        chip={s.discoverChips[4]}
        x={s.discoverChips[4].x}
        y={135}
      />
      <DiscoverChip
        screenRef={"discoverChip5"}
        position={5}
        chip={s.discoverChips[5]}
        x={s.discoverChips[5].x}
        y={135}
      />
      <DiscoverChip
        screenRef={"discoverChip6"}
        position={6}
        chip={s.discoverChips[6]}
        x={s.discoverChips[6].x}
        y={135}
      />
      <DiscoverChip
        screenRef={"discoverChip7"}
        position={7}
        chip={s.discoverChips[7]}
        x={s.discoverChips[7].x}
        y={135}
      />
      <DiscoverChip
        screenRef={"discoverChip8"}
        position={8}
        chip={s.discoverChips[8]}
        x={s.discoverChips[8].x}
        y={135}
      />
      <DiscoverChip
        screenRef={"discoverChip9"}
        position={9}
        chip={s.discoverChips[9]}
        x={s.discoverChips[9].x}
        y={135}
      />
      <DiscoverChip
        screenRef={"discoverChip10"}
        position={10}
        chip={s.discoverChips[10]}
        x={s.discoverChips[10].x}
        y={135}
      />
      <DiscoverChip
        screenRef={"discoverChip11"}
        position={11}
        chip={s.discoverChips[11]}
        x={s.discoverChips[11].x}
        y={135}
      />
      <DiscoverCard
        screenRef={"discoverCard0"}
        position={s.discoverWindowStart}
        card={s.discoverCards[0]}
        x={192}
        y={240}
      />
      <DiscoverCard
        screenRef={"discoverCard1"}
        position={s.discoverWindowStart + 1}
        card={s.discoverCards[1]}
        x={596}
        y={240}
      />
      <DiscoverCard
        screenRef={"discoverCard2"}
        position={s.discoverWindowStart + 2}
        card={s.discoverCards[2]}
        x={1000}
        y={240}
      />
      <DiscoverCard
        screenRef={"discoverCard3"}
        position={s.discoverWindowStart + 3}
        card={s.discoverCards[3]}
        x={1404}
        y={240}
      />
      <DiscoverCard
        screenRef={"discoverCard4"}
        position={s.discoverWindowStart + 4}
        card={s.discoverCards[4]}
        x={192}
        y={564}
      />
      <DiscoverCard
        screenRef={"discoverCard5"}
        position={s.discoverWindowStart + 5}
        card={s.discoverCards[5]}
        x={596}
        y={564}
      />
      <DiscoverCard
        screenRef={"discoverCard6"}
        position={s.discoverWindowStart + 6}
        card={s.discoverCards[6]}
        x={1000}
        y={564}
      />
      <DiscoverCard
        screenRef={"discoverCard7"}
        position={s.discoverWindowStart + 7}
        card={s.discoverCards[7]}
        x={1404}
        y={564}
      />
      <DiscoverCard
        screenRef={"discoverCard8"}
        position={s.discoverWindowStart + 8}
        card={s.discoverCards[8]}
        x={192}
        y={888}
      />
      <DiscoverCard
        screenRef={"discoverCard9"}
        position={s.discoverWindowStart + 9}
        card={s.discoverCards[9]}
        x={596}
        y={888}
      />
      <DiscoverCard
        screenRef={"discoverCard10"}
        position={s.discoverWindowStart + 10}
        card={s.discoverCards[10]}
        x={1000}
        y={888}
      />
      <DiscoverCard
        screenRef={"discoverCard11"}
        position={s.discoverWindowStart + 11}
        card={s.discoverCards[11]}
        x={1404}
        y={888}
      />
      <TvText
        x={192}
        y={240}
        maxwidth={1200}
        content={s.discoverError}
        font={"Onest"}
        size={26}
        color={s.primary}
      />
      <TvView x={144} y={976} w={1776} h={104} color={s.background} />
      <TvView x={1548} y={994} w={45} h={31} rounded={8} color={s.keyBorder} />
      <TvView x={1550} y={996} w={41} h={27} rounded={6} color={s.background} />
      <TvText
        x={1557}
        y={1000}
        content={s.discoverOkLabel}
        font={"Onest700"}
        size={16}
        color={s.primary}
      />
      <TvText
        x={1608}
        y={999}
        content={s.discoverSelectLabel}
        font={"Onest"}
        size={20}
        color={s.body}
      />
      <TvView x={1700} y={994} w={40} h={31} rounded={8} color={s.keyBorder} />
      <TvView x={1702} y={996} w={36} h={27} rounded={6} color={s.background} />
      <TvText
        x={1710}
        y={999}
        content={s.discoverOptionsIcon}
        font={"Onest"}
        size={19}
        color={s.primary}
      />
      <TvText
        x={1752}
        y={999}
        content={s.discoverOptionsLabel}
        font={"Onest"}
        size={20}
        color={s.body}
      />
    </TvView>
  ),
});
