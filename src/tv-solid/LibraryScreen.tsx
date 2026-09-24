/** @jsxImportSource @solidtv/solid */
import type { DiscoverCardView as LibraryCardView } from "./discoverModel";
import { defineScreen, TvView, TvText } from "./runtime";
import { LibraryCard, LibrarySegment } from "./LibraryFocus";

/** TV My List and Continue Watching canvas; parent owns API and navigation. */
export const LibraryScreen = defineScreen({
  components: { LibraryCard, LibrarySegment },
  props: [
    "homeProfileAvatar",
    "railSearch",
    "railHomeUnselected",
    "railDiscover",
    "railLive",
    "railListSelected",
    "railSettings",
    "surface",
    "libraryHeading",
    "libraryMode",
    "libraryCards",
    "libraryWindowStart",
    "libraryError",
    "libraryOkLabel",
    "librarySelectLabel",
    "libraryOptionsIcon",
    "libraryOptionsLabel",
    "background",
    "primary",
    "body",
    "keyBorder",
  ] as unknown as {
    homeProfileAvatar: string;
    railSearch: string;
    railHomeUnselected: string;
    railDiscover: string;
    railLive: string;
    railListSelected: string;
    railSettings: string;
    surface: string;
    libraryHeading: string;
    libraryMode: string;
    libraryCards: LibraryCardView[];
    libraryWindowStart: number;
    libraryError: string;
    libraryOkLabel: string;
    librarySelectLabel: string;
    libraryOptionsIcon: string;
    libraryOptionsLabel: string;
    background: string;
    primary: string;
    body: string;
    keyBorder: string;
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
        src={s.homeProfileAvatar}
        show={s.homeProfileAvatar !== ""}
      />
      <TvView x={60} y={202} w={24} h={24} src={s.railSearch} />
      <TvView x={60} y={282} w={24} h={24} src={s.railHomeUnselected} />
      <TvView x={60} y={360} w={24} h={24} src={s.railDiscover} />
      <TvView x={60} y={440} w={24} h={24} src={s.railLive} />
      <TvView x={40} y={496} w={64} h={64} rounded={32} color={s.surface} />
      <TvView x={60} y={516} w={24} h={24} src={s.railListSelected} />
      <TvView x={60} y={978} w={24} h={24} src={s.railSettings} />
      <TvText
        x={192}
        y={54}
        content={s.libraryHeading}
        font={"Bricolage700"}
        size={52}
        color={s.primary}
      />
      <LibrarySegment
        screenRef={"librarySegment0"}
        position={0}
        label={"My List"}
        selected={s.libraryMode === "favorites"}
        width={141}
        x={192}
        y={135}
      />
      <LibrarySegment
        screenRef={"librarySegment1"}
        position={1}
        label={"Continue Watching"}
        selected={s.libraryMode === "queue"}
        width={277}
        x={341}
        y={135}
      />
      <LibraryCard
        screenRef={"libraryCard0"}
        position={s.libraryWindowStart}
        card={s.libraryCards[0]}
        x={192}
        y={240}
      />
      <LibraryCard
        screenRef={"libraryCard1"}
        position={s.libraryWindowStart + 1}
        card={s.libraryCards[1]}
        x={596}
        y={240}
      />
      <LibraryCard
        screenRef={"libraryCard2"}
        position={s.libraryWindowStart + 2}
        card={s.libraryCards[2]}
        x={1000}
        y={240}
      />
      <LibraryCard
        screenRef={"libraryCard3"}
        position={s.libraryWindowStart + 3}
        card={s.libraryCards[3]}
        x={1404}
        y={240}
      />
      <LibraryCard
        screenRef={"libraryCard4"}
        position={s.libraryWindowStart + 4}
        card={s.libraryCards[4]}
        x={192}
        y={564}
      />
      <LibraryCard
        screenRef={"libraryCard5"}
        position={s.libraryWindowStart + 5}
        card={s.libraryCards[5]}
        x={596}
        y={564}
      />
      <LibraryCard
        screenRef={"libraryCard6"}
        position={s.libraryWindowStart + 6}
        card={s.libraryCards[6]}
        x={1000}
        y={564}
      />
      <LibraryCard
        screenRef={"libraryCard7"}
        position={s.libraryWindowStart + 7}
        card={s.libraryCards[7]}
        x={1404}
        y={564}
      />
      <LibraryCard
        screenRef={"libraryCard8"}
        position={s.libraryWindowStart + 8}
        card={s.libraryCards[8]}
        x={192}
        y={888}
      />
      <LibraryCard
        screenRef={"libraryCard9"}
        position={s.libraryWindowStart + 9}
        card={s.libraryCards[9]}
        x={596}
        y={888}
      />
      <LibraryCard
        screenRef={"libraryCard10"}
        position={s.libraryWindowStart + 10}
        card={s.libraryCards[10]}
        x={1000}
        y={888}
      />
      <LibraryCard
        screenRef={"libraryCard11"}
        position={s.libraryWindowStart + 11}
        card={s.libraryCards[11]}
        x={1404}
        y={888}
      />
      <TvText
        x={192}
        y={240}
        maxwidth={1150}
        content={s.libraryError}
        font={"Onest"}
        size={26}
        color={s.body}
      />
      <TvView x={144} y={976} w={1776} h={104} color={s.background} />
      <TvView x={1548} y={994} w={45} h={31} rounded={8} color={s.keyBorder} />
      <TvView x={1550} y={996} w={41} h={27} rounded={6} color={s.background} />
      <TvText
        x={1557}
        y={1000}
        content={s.libraryOkLabel}
        font={"Onest700"}
        size={16}
        color={s.primary}
      />
      <TvText
        x={1608}
        y={999}
        content={s.librarySelectLabel}
        font={"Onest"}
        size={20}
        color={s.body}
      />
      <TvView x={1700} y={994} w={40} h={31} rounded={8} color={s.keyBorder} />
      <TvView x={1702} y={996} w={36} h={27} rounded={6} color={s.background} />
      <TvText
        x={1710}
        y={999}
        content={s.libraryOptionsIcon}
        font={"Onest"}
        size={19}
        color={s.primary}
      />
      <TvText
        x={1752}
        y={999}
        content={s.libraryOptionsLabel}
        font={"Onest"}
        size={20}
        color={s.body}
      />
    </TvView>
  ),
});
