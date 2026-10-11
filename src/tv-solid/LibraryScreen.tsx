/** @jsxImportSource @solidtv/solid */
import { CollapsedRail } from "./CollapsedRail";
import type { DiscoverCardView as LibraryCardView } from "./discoverModel";
import { defineScreen, TvView, TvText } from "./runtime";
import { LibraryCard, LibrarySegment } from "./LibraryFocus";
import { libraryGrid } from "./libraryModel";

const librarySlotX = (mode: string, slot: number) => {
  const grid = libraryGrid(mode === "queue");
  return 192 + (slot % grid.columns) * grid.strideX;
};
const librarySlotY = (mode: string, slot: number) => {
  const grid = libraryGrid(mode === "queue");
  return 240 + Math.floor(slot / grid.columns) * grid.strideY;
};

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
      <CollapsedRail avatar={s.homeProfileAvatar} current="library"/>
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
        position={s.libraryWindowStart + 0}
        card={s.libraryCards[0]}
        poster={s.libraryMode !== "queue"}
        x={librarySlotX(s.libraryMode, 0)}
        y={librarySlotY(s.libraryMode, 0)}
      />
      <LibraryCard
        screenRef={"libraryCard1"}
        position={s.libraryWindowStart + 1}
        card={s.libraryCards[1]}
        poster={s.libraryMode !== "queue"}
        x={librarySlotX(s.libraryMode, 1)}
        y={librarySlotY(s.libraryMode, 1)}
      />
      <LibraryCard
        screenRef={"libraryCard2"}
        position={s.libraryWindowStart + 2}
        card={s.libraryCards[2]}
        poster={s.libraryMode !== "queue"}
        x={librarySlotX(s.libraryMode, 2)}
        y={librarySlotY(s.libraryMode, 2)}
      />
      <LibraryCard
        screenRef={"libraryCard3"}
        position={s.libraryWindowStart + 3}
        card={s.libraryCards[3]}
        poster={s.libraryMode !== "queue"}
        x={librarySlotX(s.libraryMode, 3)}
        y={librarySlotY(s.libraryMode, 3)}
      />
      <LibraryCard
        screenRef={"libraryCard4"}
        position={s.libraryWindowStart + 4}
        card={s.libraryCards[4]}
        poster={s.libraryMode !== "queue"}
        x={librarySlotX(s.libraryMode, 4)}
        y={librarySlotY(s.libraryMode, 4)}
      />
      <LibraryCard
        screenRef={"libraryCard5"}
        position={s.libraryWindowStart + 5}
        card={s.libraryCards[5]}
        poster={s.libraryMode !== "queue"}
        x={librarySlotX(s.libraryMode, 5)}
        y={librarySlotY(s.libraryMode, 5)}
      />
      <LibraryCard
        screenRef={"libraryCard6"}
        position={s.libraryWindowStart + 6}
        card={s.libraryCards[6]}
        poster={s.libraryMode !== "queue"}
        x={librarySlotX(s.libraryMode, 6)}
        y={librarySlotY(s.libraryMode, 6)}
      />
      <LibraryCard
        screenRef={"libraryCard7"}
        position={s.libraryWindowStart + 7}
        card={s.libraryCards[7]}
        poster={s.libraryMode !== "queue"}
        x={librarySlotX(s.libraryMode, 7)}
        y={librarySlotY(s.libraryMode, 7)}
      />
      <LibraryCard
        screenRef={"libraryCard8"}
        position={s.libraryWindowStart + 8}
        card={s.libraryCards[8]}
        poster={s.libraryMode !== "queue"}
        x={librarySlotX(s.libraryMode, 8)}
        y={librarySlotY(s.libraryMode, 8)}
      />
      <LibraryCard
        screenRef={"libraryCard9"}
        position={s.libraryWindowStart + 9}
        card={s.libraryCards[9]}
        poster={s.libraryMode !== "queue"}
        x={librarySlotX(s.libraryMode, 9)}
        y={librarySlotY(s.libraryMode, 9)}
      />
      <LibraryCard
        screenRef={"libraryCard10"}
        position={s.libraryWindowStart + 10}
        card={s.libraryCards[10]}
        poster={s.libraryMode !== "queue"}
        x={librarySlotX(s.libraryMode, 10)}
        y={librarySlotY(s.libraryMode, 10)}
      />
      <LibraryCard
        screenRef={"libraryCard11"}
        position={s.libraryWindowStart + 11}
        card={s.libraryCards[11]}
        poster={s.libraryMode !== "queue"}
        x={librarySlotX(s.libraryMode, 11)}
        y={librarySlotY(s.libraryMode, 11)}
      />
      <LibraryCard
        screenRef={"libraryCard12"}
        position={s.libraryWindowStart + 12}
        card={s.libraryCards[12]}
        poster={s.libraryMode !== "queue"}
        x={librarySlotX(s.libraryMode, 12)}
        y={librarySlotY(s.libraryMode, 12)}
      />
      <LibraryCard
        screenRef={"libraryCard13"}
        position={s.libraryWindowStart + 13}
        card={s.libraryCards[13]}
        poster={s.libraryMode !== "queue"}
        x={librarySlotX(s.libraryMode, 13)}
        y={librarySlotY(s.libraryMode, 13)}
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








    </TvView>
  ),
});
