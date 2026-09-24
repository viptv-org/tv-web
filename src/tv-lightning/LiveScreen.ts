import Blits from "@lightningjs/blits";
import { tokens } from "../theme/viptv-tokens.generated";
import { LiveChannel, LiveFilterChip, LiveProgram } from "./LiveFocus";
import type { LiveChannelView, LiveFilterView, LiveHeroView, LiveProgramView } from "./liveModel";

export const LiveScreen = Blits.Component("LiveScreen", {
  components: { LiveChannel, LiveFilterChip, LiveProgram },
  props: [
    "chrome", "hero", "filters", "channels", "programs", "timeline", "nowX", "nowLabel", "status",
  ] as unknown as {
    chrome: {
      homeProfileAvatar: string; railSearch: string; railHomeUnselected: string;
      railDiscover: string; railLiveSelected: string; railList: string; railSettings: string;
      surface: string; background: string; primary: string; body: string; keyBorder: string;
      liveLabel: string; previewLabel: string; okLabel: string; watchLabel: string;
      optionsIcon: string; detailsLabel: string; channelIcon: string; channelsLabel: string;
      timeIcon: string; timeLabel: string;
    };
    hero: LiveHeroView; filters: LiveFilterView[]; channels: LiveChannelView[];
    programs: LiveProgramView[]; timeline: { x: number; label: string }[];
    nowX: number; nowLabel: string; status: string;
  },
  template: `
    <Element>
      <Element x="44" y="54" w="56" h="56" rounded="28" color="$chrome.surface" />
      <Element x="50" y="60" w="44" h="44" rounded="22" :src="$chrome.homeProfileAvatar" :show="$chrome.homeProfileAvatar !== ''" />
      <Element x="60" y="202" w="24" h="24" :src="$chrome.railSearch" />
      <Element x="60" y="282" w="24" h="24" :src="$chrome.railHomeUnselected" />
      <Element x="60" y="360" w="24" h="24" :src="$chrome.railDiscover" />
      <Element x="40" y="418" w="64" h="64" rounded="32" color="$chrome.surface" />
      <Element x="60" y="438" w="24" h="24" :src="$chrome.railLiveSelected" />
      <Element x="60" y="516" w="24" h="24" :src="$chrome.railList" />
      <Element x="60" y="978" w="24" h="24" :src="$chrome.railSettings" />
      <Element x="192" y="105" w="68" h="32" rounded="8" color="$liveGround" :show="$hero.channel !== null" />
      <Text x="204" y="110" :content="$chrome.liveLabel" font="Onest700" size="20" color="$white" :show="$hero.channel !== null" />
      <Text x="274" y="108" :content="$hero.label" font="Onest" size="22" color="$secondary" />
      <Text x="192" y="157" maxwidth="1100" maxlines="1" :content="$hero.title" font="Bricolage700" size="52" color="$chrome.primary" />
      <Text x="192" y="236" :content="$hero.range" font="Onest" size="22" color="$secondary" />
      <Element x="387" y="245" w="220" h="6" rounded="3" color="$track" :show="$hero.airing" />
      <Element x="387" y="245" :w="$hero.progress * 220" h="6" rounded="3" color="$accent" :show="$hero.airing" />
      <Text x="625" y="236" :content="$hero.minutesLeft" font="Onest" size="22" color="$secondary" />
      <Text x="192" y="278" maxwidth="1050" :content="$hero.next" font="Onest" size="22" color="$tertiary" />
      <Element x="1344" y="70" w="480" h="268" rounded="20" color="$previewBorder" />
      <Element x="1346" y="72" w="476" h="264" rounded="18" color="$previewGround" />
      <Text x="1344" y="156" maxwidth="480" align="center" :content="$hero.monogram" font="Bricolage800" size="56" color="$secondary" />
      <Text x="1344" y="231" maxwidth="480" align="center" :content="$chrome.previewLabel" font="Onest" size="20" color="$tertiary" />
      <LiveFilterChip :for="(entry, index) in $filters" :ref="'liveFilter' + $entry.id" key="$entry.id" :position="$index" :filter="$entry" :x="$entry.x" y="374" />
      <Element x="192" y="460" w="1728" h="516" clipping="true">
        <Text :for="time in $timeline" key="$time.x" :x="$time.x - 192 + 16" y="12" :content="$time.label" font="Onest600" size="22" color="$secondary" />
        <Element :for="time in $timeline" key="$time.x" :x="$time.x - 192" y="0" w="2" h="48" color="$hairline" />
        <LiveChannel :for="(entry, index) in $channels" :ref="'liveChannel' + $entry.channel.id" key="$entry.channel.id" :row="$entry.row" :channel="$entry" x="0" :y="$entry.y - 460" />
        <LiveProgram :for="(entry, index) in $programs" :ref="'liveProgram' + $entry.id" key="$entry.id" :position="$index" :block="$entry" :x="$entry.x - 192" :y="$entry.y - 460" />
        <Element :x="$nowX - 192" y="48" w="3" h="468" color="$accent" :show="$nowX >= 0" />
        <Element :x="$nowX - 192 - 39" y="6" w="78" h="36" rounded="18" color="$accent" :show="$nowX >= 0" />
        <Text :x="$nowX - 192 - 27" y="13" :content="$nowLabel" font="Onest700" size="18" color="$onAccent" :show="$nowX >= 0" />
      </Element>
      <Text x="192" y="545" :content="$status" font="Onest" size="24" color="$secondary" />
      <Element x="144" y="976" w="1776" h="104" color="$chrome.background" />
      <Element x="1216" y="1008" w="44" h="31" rounded="8" color="$chrome.keyBorder" />
      <Text x="1226" y="1013" :content="$chrome.okLabel" font="Onest700" size="16" color="$chrome.primary" />
      <Text x="1275" y="1012" :content="$chrome.watchLabel" font="Onest" size="20" color="$chrome.body" />
      <Element x="1373" y="1008" w="40" h="31" rounded="8" color="$chrome.keyBorder" />
      <Text x="1384" y="1012" :content="$chrome.optionsIcon" font="Onest" size="19" color="$chrome.primary" />
      <Text x="1424" y="1012" :content="$chrome.detailsLabel" font="Onest" size="20" color="$chrome.body" />
      <Element x="1523" y="1008" w="58" h="31" rounded="8" color="$chrome.keyBorder" />
      <Text x="1535" y="1013" :content="$chrome.channelIcon" font="Onest700" size="16" color="$chrome.primary" />
      <Text x="1594" y="1012" :content="$chrome.channelsLabel" font="Onest" size="20" color="$chrome.body" />
      <Element x="1717" y="1008" w="54" h="31" rounded="8" color="$chrome.keyBorder" />
      <Text x="1728" y="1013" :content="$chrome.timeIcon" font="Onest700" size="16" color="$chrome.primary" />
      <Text x="1784" y="1012" :content="$chrome.timeLabel" font="Onest" size="20" color="$chrome.body" />
    </Element>
  `,
  state() {
    return {
      white: tokens["color.fill.white"], secondary: tokens["color.text.secondary"],
      tertiary: tokens["color.text.tertiary"], onAccent: tokens["color.on.accent"],
      liveGround: tokens["color.status.live"], accent: tokens["color.accent.default"],
      track: tokens["color.line.strong"], hairline: tokens["color.line.hairline"],
      previewBorder: tokens["color.line.outline"], previewGround: tokens["color.surface.1"],
    };
  },
});
