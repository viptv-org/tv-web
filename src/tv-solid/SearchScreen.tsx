/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText, KeyedFor } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { SearchCard, SearchKey } from "./SearchFocus";
import type {
  SearchCardView,
  SearchHeadingView,
  SearchKeyView,
} from "./searchModel";

/** Fixed 1920 × 1080 TV Search canvas; components own keyboard/result focus. */
export const SearchScreen = defineScreen({
  components: { SearchCard, SearchKey },
  props: [
    "homeProfileAvatar",
    "railSearchSelected",
    "railHomeUnselected",
    "railDiscover",
    "railLive",
    "railList",
    "railSettings",
    "surface",
    "background",
    "primary",
    "body",
    "keyBorder",
    "heading",
    "query",
    "placeholder",
    "caretX",
    "keys",
    "headings",
    "cards",
    "status",
    "okLabel",
    "typeLabel",
    "jumpIcon",
    "jumpLabel",
    "backLabel",
    "deleteLabel",
  ] as unknown as {
    homeProfileAvatar: string;
    railSearchSelected: string;
    railHomeUnselected: string;
    railDiscover: string;
    railLive: string;
    railList: string;
    railSettings: string;
    surface: string;
    background: string;
    primary: string;
    body: string;
    keyBorder: string;
    heading: string;
    query: string;
    placeholder: string;
    caretX: number;
    keys: SearchKeyView[];
    headings: SearchHeadingView[];
    cards: SearchCardView[];
    status: string;
    okLabel: string;
    typeLabel: string;
    jumpIcon: string;
    jumpLabel: string;
    backLabel: string;
    deleteLabel: string;
  },

  state() {
    return {
      field: tokens["color.fill.tv-field"],
      accent: tokens["color.accent.default"],
      tertiary: tokens["color.text.tertiary"],
    };
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
      <TvView x={40} y={184} w={64} h={64} rounded={32} color={s.surface} />
      <TvView x={60} y={204} w={24} h={24} src={s.railSearchSelected} />
      <TvView x={60} y={282} w={24} h={24} src={s.railHomeUnselected} />
      <TvView x={60} y={360} w={24} h={24} src={s.railDiscover} />
      <TvView x={60} y={440} w={24} h={24} src={s.railLive} />
      <TvView x={60} y={516} w={24} h={24} src={s.railList} />
      <TvView x={60} y={978} w={24} h={24} src={s.railSettings} />
      <TvText
        x={192}
        y={54}
        content={s.heading}
        font={"Bricolage700"}
        size={52}
        color={s.primary}
      />
      <TvView x={192} y={136} w={560} h={80} rounded={20} color={s.field} />
      <TvText
        x={218}
        y={154}
        maxwidth={500}
        content={s.query === "" ? s.placeholder : s.query}
        font={"Onest600"}
        size={34}
        color={s.query === "" ? s.tertiary : s.primary}
      />
      <TvView x={s.caretX} y={159} w={3} h={34} color={s.accent} />
      {
        <KeyedFor each={s.keys} keyOf={(item) => item.id}>
          {(entry, index) => (
            <SearchKey
              position={index()}
              keyView={entry()}
              x={entry().x}
              y={entry().y}
              screenRef={"searchKey" + index()}
            />
          )}
        </KeyedFor>
      }
      <TvView x={850} y={150} w={1070} h={826} clipping={true}>
        {
          <KeyedFor each={s.headings} keyOf={(item) => item.id}>
            {(section, index) => (
              <TvText
                x={0}
                y={section().y - 150}
                content={section().title}
                font={"Bricolage700"}
                size={30}
                color={s.primary}
              />
            )}
          </KeyedFor>
        }
        {
          <KeyedFor each={s.headings} keyOf={(item) => item.id}>
            {(section, index) => (
              <TvText
                x={section().countX - 850}
                y={section().y - 141}
                content={section().count}
                font={"Onest"}
                size={22}
                color={s.tertiary}
              />
            )}
          </KeyedFor>
        }
        {
          <KeyedFor each={s.cards} keyOf={(item) => item.id}>
            {(card, index) => (
              <SearchCard
                screenRef={"searchCard" + card().position}
                position={card().position}
                card={card()}
                x={card().x - 850}
                y={card().y - 150}
              />
            )}
          </KeyedFor>
        }
      </TvView>
      <TvText
        x={850}
        y={s.headings.length ? 113 : 155}
        content={s.status}
        font={"Onest"}
        size={24}
        color={s.tertiary}
      />
      <TvView x={850} y={976} w={1070} h={104} color={s.background} />
      <TvView x={1305} y={994} w={45} h={31} rounded={8} color={s.keyBorder} />
      <TvView x={1307} y={996} w={41} h={27} rounded={6} color={s.background} />
      <TvText
        x={1313}
        y={1000}
        content={s.okLabel}
        font={"Onest700"}
        size={16}
        color={s.primary}
      />
      <TvText
        x={1363}
        y={999}
        content={s.typeLabel}
        font={"Onest"}
        size={20}
        color={s.body}
      />
      <TvView x={1448} y={994} w={46} h={31} rounded={8} color={s.keyBorder} />
      <TvView x={1450} y={996} w={42} h={27} rounded={6} color={s.background} />
      <TvText
        x={1455}
        y={1000}
        content={s.jumpIcon}
        font={"Onest700"}
        size={16}
        color={s.primary}
      />
      <TvText
        x={1508}
        y={999}
        content={s.jumpLabel}
        font={"Onest"}
        size={20}
        color={s.body}
      />
      <TvView x={1685} y={994} w={66} h={31} rounded={8} color={s.keyBorder} />
      <TvView x={1687} y={996} w={62} h={27} rounded={6} color={s.background} />
      <TvText
        x={1695}
        y={1000}
        content={s.backLabel}
        font={"Onest700"}
        size={16}
        color={s.primary}
      />
      <TvText
        x={1763}
        y={999}
        content={s.deleteLabel}
        font={"Onest"}
        size={20}
        color={s.body}
      />
    </TvView>
  ),
});
