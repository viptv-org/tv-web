import Blits from "@lightningjs/blits";
import { DiscoverCard, DiscoverChip } from "./DiscoverFocus";

/** Discover canvas, isolated so Blits parses a bounded screen template. */
export const DiscoverScreen = Blits.Component("DiscoverScreen", {
  components: { DiscoverCard, DiscoverChip },
  props: ["homeProfileAvatar", "railSearch", "railHome", "railDiscoverSelected", "railLive", "railList", "railSettings", "surface", "discoverHeading", "discoverChips", "discoverCards", "discoverWindowStart", "discoverError", "discoverOkLabel", "discoverSelectLabel", "discoverOptionsIcon", "discoverOptionsLabel", "background", "primary", "body", "keyBorder"] as unknown as Record<string, unknown>,
  template: `
        <Element>
          <Element x="44" y="54" w="56" h="56" rounded="28" color="$surface" />
          <Element x="50" y="60" w="44" h="44" rounded="22" :src="$homeProfileAvatar" :show="$homeProfileAvatar !== ''" />
          <Element x="60" y="202" w="24" h="24" :src="$railSearch" />
          <Element x="60" y="282" w="24" h="24" :src="$railHome" />
          <Element x="40" y="340" w="64" h="64" rounded="32" color="$surface" />
          <Element x="60" y="360" w="24" h="24" :src="$railDiscoverSelected" />
          <Element x="60" y="440" w="24" h="24" :src="$railLive" />
          <Element x="60" y="516" w="24" h="24" :src="$railList" />
          <Element x="60" y="978" w="24" h="24" :src="$railSettings" />
          <Text x="192" y="54" :content="$discoverHeading" font="Bricolage700" size="52" color="$primary" />
          <DiscoverChip ref="discoverChip0" position="0" :chip="$discoverChips[0]" :x="$discoverChips[0].x" y="135" />
          <DiscoverChip ref="discoverChip1" position="1" :chip="$discoverChips[1]" :x="$discoverChips[1].x" y="135" />
          <DiscoverChip ref="discoverChip2" position="2" :chip="$discoverChips[2]" :x="$discoverChips[2].x" y="135" />
          <DiscoverChip ref="discoverChip3" position="3" :chip="$discoverChips[3]" :x="$discoverChips[3].x" y="135" />
          <DiscoverChip ref="discoverChip4" position="4" :chip="$discoverChips[4]" :x="$discoverChips[4].x" y="135" />
          <DiscoverChip ref="discoverChip5" position="5" :chip="$discoverChips[5]" :x="$discoverChips[5].x" y="135" />
          <DiscoverChip ref="discoverChip6" position="6" :chip="$discoverChips[6]" :x="$discoverChips[6].x" y="135" />
          <DiscoverChip ref="discoverChip7" position="7" :chip="$discoverChips[7]" :x="$discoverChips[7].x" y="135" />
          <DiscoverChip ref="discoverChip8" position="8" :chip="$discoverChips[8]" :x="$discoverChips[8].x" y="135" />
          <DiscoverChip ref="discoverChip9" position="9" :chip="$discoverChips[9]" :x="$discoverChips[9].x" y="135" />
          <DiscoverChip ref="discoverChip10" position="10" :chip="$discoverChips[10]" :x="$discoverChips[10].x" y="135" />
          <DiscoverChip ref="discoverChip11" position="11" :chip="$discoverChips[11]" :x="$discoverChips[11].x" y="135" />
          <DiscoverCard ref="discoverCard0" :position="$discoverWindowStart" :card="$discoverCards[0]" x="192" y="240" />
          <DiscoverCard ref="discoverCard1" :position="$discoverWindowStart + 1" :card="$discoverCards[1]" x="596" y="240" />
          <DiscoverCard ref="discoverCard2" :position="$discoverWindowStart + 2" :card="$discoverCards[2]" x="1000" y="240" />
          <DiscoverCard ref="discoverCard3" :position="$discoverWindowStart + 3" :card="$discoverCards[3]" x="1404" y="240" />
          <DiscoverCard ref="discoverCard4" :position="$discoverWindowStart + 4" :card="$discoverCards[4]" x="192" y="564" />
          <DiscoverCard ref="discoverCard5" :position="$discoverWindowStart + 5" :card="$discoverCards[5]" x="596" y="564" />
          <DiscoverCard ref="discoverCard6" :position="$discoverWindowStart + 6" :card="$discoverCards[6]" x="1000" y="564" />
          <DiscoverCard ref="discoverCard7" :position="$discoverWindowStart + 7" :card="$discoverCards[7]" x="1404" y="564" />
          <DiscoverCard ref="discoverCard8" :position="$discoverWindowStart + 8" :card="$discoverCards[8]" x="192" y="888" />
          <DiscoverCard ref="discoverCard9" :position="$discoverWindowStart + 9" :card="$discoverCards[9]" x="596" y="888" />
          <DiscoverCard ref="discoverCard10" :position="$discoverWindowStart + 10" :card="$discoverCards[10]" x="1000" y="888" />
          <DiscoverCard ref="discoverCard11" :position="$discoverWindowStart + 11" :card="$discoverCards[11]" x="1404" y="888" />
          <Text x="192" y="240" maxwidth="1200" :content="$discoverError" font="Onest" size="26" color="$primary" />
          <Element x="144" y="976" w="1776" h="104" color="$background" />
          <Element x="1548" y="994" w="45" h="31" rounded="8" color="$keyBorder" />
          <Element x="1550" y="996" w="41" h="27" rounded="6" color="$background" />
          <Text x="1557" y="1000" :content="$discoverOkLabel" font="Onest700" size="16" color="$primary" />
          <Text x="1608" y="999" :content="$discoverSelectLabel" font="Onest" size="20" color="$body" />
          <Element x="1700" y="994" w="40" h="31" rounded="8" color="$keyBorder" />
          <Element x="1702" y="996" w="36" h="27" rounded="6" color="$background" />
          <Text x="1710" y="999" :content="$discoverOptionsIcon" font="Onest" size="19" color="$primary" />
          <Text x="1752" y="999" :content="$discoverOptionsLabel" font="Onest" size="20" color="$body" />
        </Element>
  `,
});
