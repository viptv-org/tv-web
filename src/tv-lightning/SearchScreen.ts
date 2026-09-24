import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import { SearchCard, SearchKey } from "./SearchFocus";
import type { SearchCardView, SearchHeadingView, SearchKeyView } from "./searchModel";

/** Fixed 1920 × 1080 TV Search canvas; components own keyboard/result focus. */
export const SearchScreen = Blits.Component("SearchScreen", {
  components: { SearchCard, SearchKey },
  props: [
    "homeProfileAvatar", "railSearchSelected", "railHomeUnselected", "railDiscover", "railLive",
    "railList", "railSettings", "surface", "background", "primary", "body", "keyBorder",
    "heading", "query", "placeholder", "caretX", "keys", "headings", "cards", "status",
    "okLabel", "typeLabel", "jumpIcon", "jumpLabel", "backLabel", "deleteLabel",
  ] as unknown as {
    homeProfileAvatar: string; railSearchSelected: string; railHomeUnselected: string;
    railDiscover: string; railLive: string; railList: string; railSettings: string;
    surface: string; background: string; primary: string; body: string; keyBorder: string;
    heading: string; query: string; placeholder: string; caretX: number; keys: SearchKeyView[];
    headings: SearchHeadingView[]; cards: SearchCardView[]; status: string;
    okLabel: string; typeLabel: string; jumpIcon: string; jumpLabel: string;
    backLabel: string; deleteLabel: string;
  },
  template: `
    <Element>
      <Element x="44" y="54" w="56" h="56" rounded="28" color="$surface" />
      <Element x="50" y="60" w="44" h="44" rounded="22" :src="$homeProfileAvatar" :show="$homeProfileAvatar !== ''" />
      <Element x="40" y="184" w="64" h="64" rounded="32" color="$surface" />
      <Element x="60" y="204" w="24" h="24" :src="$railSearchSelected" />
      <Element x="60" y="282" w="24" h="24" :src="$railHomeUnselected" />
      <Element x="60" y="360" w="24" h="24" :src="$railDiscover" />
      <Element x="60" y="440" w="24" h="24" :src="$railLive" />
      <Element x="60" y="516" w="24" h="24" :src="$railList" />
      <Element x="60" y="978" w="24" h="24" :src="$railSettings" />
      <Text x="192" y="54" :content="$heading" font="Bricolage700" size="52" color="$primary" />
      <Element x="192" y="136" w="560" h="80" rounded="20" color="$field" />
      <Text x="218" y="154" maxwidth="500" :content="$query === '' ? $placeholder : $query" font="Onest600" size="34" :color="$query === '' ? $tertiary : $primary" />
      <Element :x="$caretX" y="159" w="3" h="34" color="$accent" />
      <SearchKey :for="(entry, index) in $keys" ref="searchKey" key="$entry.id" :position="$index" :keyView="$entry" :x="$entry.x" :y="$entry.y" />
      <Element x="850" y="150" w="1070" h="826" clipping="true">
        <Text :for="section in $headings" key="$section.id" x="0" :y="$section.y - 150" :content="$section.title" font="Bricolage700" size="30" color="$primary" />
        <Text :for="section in $headings" key="$section.id" :x="$section.countX - 850" :y="$section.y - 141" :content="$section.count" font="Onest" size="22" color="$tertiary" />
        <SearchCard :for="card in $cards" :ref="'searchCard' + $card.position" key="$card.id" :position="$card.position" :card="$card" :x="$card.x - 850" :y="$card.y - 150" />
      </Element>
      <Text x="850" :y="$headings.length ? 113 : 155" :content="$status" font="Onest" size="24" color="$tertiary" />
      <Element x="850" y="976" w="1070" h="104" color="$background" />
      <Element x="1305" y="994" w="45" h="31" rounded="8" color="$keyBorder" />
      <Element x="1307" y="996" w="41" h="27" rounded="6" color="$background" />
      <Text x="1313" y="1000" :content="$okLabel" font="Onest700" size="16" color="$primary" />
      <Text x="1363" y="999" :content="$typeLabel" font="Onest" size="20" color="$body" />
      <Element x="1448" y="994" w="46" h="31" rounded="8" color="$keyBorder" />
      <Element x="1450" y="996" w="42" h="27" rounded="6" color="$background" />
      <Text x="1455" y="1000" :content="$jumpIcon" font="Onest700" size="16" color="$primary" />
      <Text x="1508" y="999" :content="$jumpLabel" font="Onest" size="20" color="$body" />
      <Element x="1685" y="994" w="66" h="31" rounded="8" color="$keyBorder" />
      <Element x="1687" y="996" w="62" h="27" rounded="6" color="$background" />
      <Text x="1695" y="1000" :content="$backLabel" font="Onest700" size="16" color="$primary" />
      <Text x="1763" y="999" :content="$deleteLabel" font="Onest" size="20" color="$body" />
    </Element>
  `,
  state() {
    return {
      field: tokens["color.fill.tv-field"],
      accent: tokens["color.accent.default"],
      tertiary: tokens["color.text.tertiary"],
    };
  },
});
