import Blits from "@lightningjs/blits";
import { LibraryCard, LibrarySegment } from "./LibraryFocus";

/** TV My List and Continue Watching canvas; parent owns API and navigation. */
export const LibraryScreen = Blits.Component("LibraryScreen", {
  components: { LibraryCard, LibrarySegment },
  props: [
    "homeProfileAvatar", "railSearch", "railHomeUnselected", "railDiscover",
    "railLive", "railListSelected", "railSettings", "surface",
    "libraryHeading", "libraryMode", "libraryCards", "libraryWindowStart", "libraryError",
    "libraryOkLabel", "librarySelectLabel", "libraryOptionsIcon", "libraryOptionsLabel",
    "background", "primary", "body", "keyBorder",
  ] as unknown as Record<string, unknown>,
  template: `
    <Element>
      <Element x="44" y="54" w="56" h="56" rounded="28" color="$surface" />
      <Element x="50" y="60" w="44" h="44" rounded="22" :src="$homeProfileAvatar" :show="$homeProfileAvatar !== ''" />
      <Element x="60" y="202" w="24" h="24" :src="$railSearch" />
      <Element x="60" y="282" w="24" h="24" :src="$railHomeUnselected" />
      <Element x="60" y="360" w="24" h="24" :src="$railDiscover" />
      <Element x="60" y="440" w="24" h="24" :src="$railLive" />
      <Element x="40" y="496" w="64" h="64" rounded="32" color="$surface" />
      <Element x="60" y="516" w="24" h="24" :src="$railListSelected" />
      <Element x="60" y="978" w="24" h="24" :src="$railSettings" />
      <Text x="192" y="54" :content="$libraryHeading" font="Bricolage700" size="52" color="$primary" />
      <LibrarySegment ref="librarySegment0" position="0" label="My List" :selected="$libraryMode === 'favorites'" width="141" x="192" y="135" />
      <LibrarySegment ref="librarySegment1" position="1" label="Continue Watching" :selected="$libraryMode === 'queue'" width="277" x="341" y="135" />
      <LibraryCard ref="libraryCard0" :position="$libraryWindowStart" :card="$libraryCards[0]" x="192" y="240" />
      <LibraryCard ref="libraryCard1" :position="$libraryWindowStart + 1" :card="$libraryCards[1]" x="596" y="240" />
      <LibraryCard ref="libraryCard2" :position="$libraryWindowStart + 2" :card="$libraryCards[2]" x="1000" y="240" />
      <LibraryCard ref="libraryCard3" :position="$libraryWindowStart + 3" :card="$libraryCards[3]" x="1404" y="240" />
      <LibraryCard ref="libraryCard4" :position="$libraryWindowStart + 4" :card="$libraryCards[4]" x="192" y="564" />
      <LibraryCard ref="libraryCard5" :position="$libraryWindowStart + 5" :card="$libraryCards[5]" x="596" y="564" />
      <LibraryCard ref="libraryCard6" :position="$libraryWindowStart + 6" :card="$libraryCards[6]" x="1000" y="564" />
      <LibraryCard ref="libraryCard7" :position="$libraryWindowStart + 7" :card="$libraryCards[7]" x="1404" y="564" />
      <LibraryCard ref="libraryCard8" :position="$libraryWindowStart + 8" :card="$libraryCards[8]" x="192" y="888" />
      <LibraryCard ref="libraryCard9" :position="$libraryWindowStart + 9" :card="$libraryCards[9]" x="596" y="888" />
      <LibraryCard ref="libraryCard10" :position="$libraryWindowStart + 10" :card="$libraryCards[10]" x="1000" y="888" />
      <LibraryCard ref="libraryCard11" :position="$libraryWindowStart + 11" :card="$libraryCards[11]" x="1404" y="888" />
      <Text x="192" y="240" maxwidth="1150" :content="$libraryError" font="Onest" size="26" color="$body" />
      <Element x="144" y="976" w="1776" h="104" color="$background" />
      <Element x="1548" y="994" w="45" h="31" rounded="8" color="$keyBorder" />
      <Element x="1550" y="996" w="41" h="27" rounded="6" color="$background" />
      <Text x="1557" y="1000" :content="$libraryOkLabel" font="Onest700" size="16" color="$primary" />
      <Text x="1608" y="999" :content="$librarySelectLabel" font="Onest" size="20" color="$body" />
      <Element x="1700" y="994" w="40" h="31" rounded="8" color="$keyBorder" />
      <Element x="1702" y="996" w="36" h="27" rounded="6" color="$background" />
      <Text x="1710" y="999" :content="$libraryOptionsIcon" font="Onest" size="19" color="$primary" />
      <Text x="1752" y="999" :content="$libraryOptionsLabel" font="Onest" size="20" color="$body" />
    </Element>
  `,
});
