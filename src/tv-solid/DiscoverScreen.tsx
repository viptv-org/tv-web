/** @jsxImportSource @solidtv/solid */
import { CollapsedRail } from "./CollapsedRail";
import type { DiscoverCardView, DiscoverChipView } from "./discoverModel";
import { defineScreen, TvView, TvText, KeyedFor } from "./runtime";
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
      <CollapsedRail avatar={s.homeProfileAvatar} current="discover"/>
      <TvText
        x={192}
        y={54}
        content={s.discoverHeading}
        font={"Bricolage700"}
        size={52}
        color={s.primary}
      />
      <TvView x={188} y={154} w={1640} h={152} clipping>
        <KeyedFor each={s.discoverChips} keyOf={chip => `${chip.kind}:${chip.value}`}>
          {(chip, index) => <DiscoverChip screenRef={`discoverChip${index()}`} position={index()}
            chip={chip()} x={chip().x-188} y={chip().y-154} />}
        </KeyedFor>
      </TvView>
      <DiscoverCard
        screenRef={"discoverCard0"}
        position={s.discoverWindowStart}
        card={s.discoverCards[0]}
        x={192}
        y={318}
      />
      <DiscoverCard
        screenRef={"discoverCard1"}
        position={s.discoverWindowStart + 1}
        card={s.discoverCards[1]}
        x={596}
        y={318}
      />
      <DiscoverCard
        screenRef={"discoverCard2"}
        position={s.discoverWindowStart + 2}
        card={s.discoverCards[2]}
        x={1000}
        y={318}
      />
      <DiscoverCard
        screenRef={"discoverCard3"}
        position={s.discoverWindowStart + 3}
        card={s.discoverCards[3]}
        x={1404}
        y={318}
      />
      <DiscoverCard
        screenRef={"discoverCard4"}
        position={s.discoverWindowStart + 4}
        card={s.discoverCards[4]}
        x={192}
        y={658}
      />
      <DiscoverCard
        screenRef={"discoverCard5"}
        position={s.discoverWindowStart + 5}
        card={s.discoverCards[5]}
        x={596}
        y={658}
      />
      <DiscoverCard
        screenRef={"discoverCard6"}
        position={s.discoverWindowStart + 6}
        card={s.discoverCards[6]}
        x={1000}
        y={658}
      />
      <DiscoverCard
        screenRef={"discoverCard7"}
        position={s.discoverWindowStart + 7}
        card={s.discoverCards[7]}
        x={1404}
        y={658}
      />
      <DiscoverCard
        screenRef={"discoverCard8"}
        position={s.discoverWindowStart + 8}
        card={s.discoverCards[8]}
        x={192}
        y={998}
      />
      <DiscoverCard
        screenRef={"discoverCard9"}
        position={s.discoverWindowStart + 9}
        card={s.discoverCards[9]}
        x={596}
        y={998}
      />
      <DiscoverCard
        screenRef={"discoverCard10"}
        position={s.discoverWindowStart + 10}
        card={s.discoverCards[10]}
        x={1000}
        y={998}
      />
      <DiscoverCard
        screenRef={"discoverCard11"}
        position={s.discoverWindowStart + 11}
        card={s.discoverCards[11]}
        x={1404}
        y={998}
      />
      <TvText
        x={192}
        y={318}
        maxwidth={1200}
        content={s.discoverError}
        font={"Onest"}
        size={26}
        color={s.primary}
      />
      <TvView x={144} y={976} w={1776} h={104} color={s.background} />








    </TvView>
  ),
});
