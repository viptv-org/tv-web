import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import { LiveDetailsOption } from "./LiveDetailsFocus";

export const LiveDetailsScreen = Blits.Component("LiveDetailsScreen", {
  components: { LiveDetailsOption },
  props: ["title", "channel", "range", "description", "watchLabel", "closeLabel", "okLabel", "selectLabel", "backLabel"] as unknown as {
    title: string; channel: string; range: string; description: string;
    watchLabel: string; closeLabel: string; okLabel: string; selectLabel: string; backLabel: string;
  },
  template: `
    <Element w="1920" h="1080" zIndex="30">
      <Element w="1920" h="1080" color="$scrim" />
      <Element x="1100" y="0" w="820" h="1080" color="$panel" />
      <Text x="1164" y="64" maxwidth="660" maxlines="2" :content="$title" font="Bricolage700" size="44" color="$primary" />
      <Element x="1164" y="139" w="12" h="12" rounded="6" color="$liveGround" />
      <Text x="1188" y="132" :content="$channel" font="Onest600" size="22" color="$secondary" />
      <Text x="1273" y="132" :content="$range" font="Onest" size="22" color="$secondary" />
      <Text x="1164" y="182" maxwidth="660" maxlines="3" lineheight="34" :content="$description" font="Onest" size="24" color="$body" />
      <LiveDetailsOption ref="liveDetailsOption0" position="0" :label="$watchLabel" x="1158" y="264" />
      <LiveDetailsOption ref="liveDetailsOption1" position="1" :label="$closeLabel" x="1158" y="358" />
      <Element x="1100" y="976" w="820" h="104" color="$panel" />
      <Element x="1542" y="994" w="45" h="31" rounded="8" color="$keyBorder" />
      <Element x="1544" y="996" w="41" h="27" rounded="6" color="$panel" />
      <Text x="1550" y="1000" :content="$okLabel" font="Onest700" size="16" color="$primary" />
      <Text x="1600" y="999" :content="$selectLabel" font="Onest" size="20" color="$body" />
      <Element x="1694" y="994" w="66" h="31" rounded="8" color="$keyBorder" />
      <Element x="1696" y="996" w="62" h="27" rounded="6" color="$panel" />
      <Text x="1704" y="1000" :content="$backLabel" font="Onest700" size="16" color="$primary" />
      <Text x="1770" y="999" :content="$closeLabel" font="Onest" size="20" color="$body" />
    </Element>
  `,
  state() {
    return {
      scrim: tokens["color.scrim.tv-panel"], panel: tokens["color.surface.1"],
      primary: tokens["color.text.primary"], secondary: tokens["color.text.secondary"],
      body: tokens["color.text.body"], liveGround: tokens["color.status.live"],
      keyBorder: tokens["color.line.keycap-tv"],
    };
  },
});
