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
      <TvView x={846} y={146} w={1074} h={830} clipping={true}>
        {
          <KeyedFor each={s.headings} keyOf={(item) => item.id}>
            {(section, index) => (
              <TvText
                x={4}
                y={section().y - 146}
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
                x={section().countX - 846}
                y={section().y - 137}
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
                x={card().x - 846}
                y={card().y - 146}
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
    </TvView>
  ),
});
