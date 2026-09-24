/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvView, TvText, KeyedFor } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { LiveChannel, LiveFilterChip, LiveProgram } from "./LiveFocus";
import type {
  LiveChannelView,
  LiveFilterView,
  LiveHeroView,
  LiveProgramView,
} from "./liveModel";

export const LiveScreen = defineScreen({
  components: { LiveChannel, LiveFilterChip, LiveProgram },
  props: [
    "chrome",
    "hero",
    "filters",
    "channels",
    "programs",
    "timeline",
    "nowX",
    "nowLabel",
    "status",
  ] as unknown as {
    chrome: {
      homeProfileAvatar: string;
      railSearch: string;
      railHomeUnselected: string;
      railDiscover: string;
      railLiveSelected: string;
      railList: string;
      railSettings: string;
      surface: string;
      background: string;
      primary: string;
      body: string;
      keyBorder: string;
      liveLabel: string;
      previewLabel: string;
      okLabel: string;
      watchLabel: string;
      optionsIcon: string;
      detailsLabel: string;
      channelIcon: string;
      channelsLabel: string;
      timeIcon: string;
      timeLabel: string;
    };
    hero: LiveHeroView;
    filters: LiveFilterView[];
    channels: LiveChannelView[];
    programs: LiveProgramView[];
    timeline: { x: number; label: string }[];
    nowX: number;
    nowLabel: string;
    status: string;
  },

  state() {
    return {
      white: tokens["color.fill.white"],
      secondary: tokens["color.text.secondary"],
      tertiary: tokens["color.text.tertiary"],
      onAccent: tokens["color.on.accent"],
      liveGround: tokens["color.status.live"],
      accent: tokens["color.accent.default"],
      track: tokens["color.line.strong"],
      hairline: tokens["color.line.hairline"],
      previewBorder: tokens["color.line.outline"],
      previewGround: tokens["color.surface.1"],
    };
  },

  render: (s) => (
    <TvView>
      <TvView
        x={44}
        y={54}
        w={56}
        h={56}
        rounded={28}
        color={s.chrome.surface}
      />
      <TvView
        x={50}
        y={60}
        w={44}
        h={44}
        rounded={22}
        src={s.chrome.homeProfileAvatar}
        show={s.chrome.homeProfileAvatar !== ""}
      />
      <TvView x={60} y={202} w={24} h={24} src={s.chrome.railSearch} />
      <TvView x={60} y={282} w={24} h={24} src={s.chrome.railHomeUnselected} />
      <TvView x={60} y={360} w={24} h={24} src={s.chrome.railDiscover} />
      <TvView
        x={40}
        y={418}
        w={64}
        h={64}
        rounded={32}
        color={s.chrome.surface}
      />
      <TvView x={60} y={438} w={24} h={24} src={s.chrome.railLiveSelected} />
      <TvView x={60} y={516} w={24} h={24} src={s.chrome.railList} />
      <TvView x={60} y={978} w={24} h={24} src={s.chrome.railSettings} />
      <TvView
        x={192}
        y={105}
        w={68}
        h={32}
        rounded={8}
        color={s.liveGround}
        show={s.hero.channel !== null}
      />
      <TvText
        x={204}
        y={110}
        content={s.chrome.liveLabel}
        font={"Onest700"}
        size={20}
        color={s.white}
        show={s.hero.channel !== null}
      />
      <TvText
        x={274}
        y={108}
        content={s.hero.label}
        font={"Onest"}
        size={22}
        color={s.secondary}
      />
      <TvText
        x={192}
        y={157}
        maxwidth={1100}
        maxlines={1}
        content={s.hero.title}
        font={"Bricolage700"}
        size={52}
        color={s.chrome.primary}
      />
      <TvText
        x={192}
        y={236}
        content={s.hero.range}
        font={"Onest"}
        size={22}
        color={s.secondary}
      />
      <TvView
        x={387}
        y={245}
        w={220}
        h={6}
        rounded={3}
        color={s.track}
        show={s.hero.airing}
      />
      <TvView
        x={387}
        y={245}
        w={s.hero.progress * 220}
        h={6}
        rounded={3}
        color={s.accent}
        show={s.hero.airing}
      />
      <TvText
        x={625}
        y={236}
        content={s.hero.minutesLeft}
        font={"Onest"}
        size={22}
        color={s.secondary}
      />
      <TvText
        x={192}
        y={278}
        maxwidth={1050}
        content={s.hero.next}
        font={"Onest"}
        size={22}
        color={s.tertiary}
      />
      <TvView
        x={1344}
        y={70}
        w={480}
        h={268}
        rounded={20}
        color={s.previewBorder}
      />
      <TvView
        x={1346}
        y={72}
        w={476}
        h={264}
        rounded={18}
        color={s.previewGround}
      />
      <TvText
        x={1344}
        y={156}
        maxwidth={480}
        align={"center"}
        content={s.hero.monogram}
        font={"Bricolage800"}
        size={56}
        color={s.secondary}
      />
      <TvText
        x={1344}
        y={231}
        maxwidth={480}
        align={"center"}
        content={s.chrome.previewLabel}
        font={"Onest"}
        size={20}
        color={s.tertiary}
      />
      {
        <KeyedFor each={s.filters} keyOf={(item) => item.id}>
          {(entry, index) => (
            <LiveFilterChip
              screenRef={"liveFilter" + entry().id}
              position={index()}
              filter={entry()}
              x={entry().x}
              y={374}
            />
          )}
        </KeyedFor>
      }
      <TvView x={192} y={460} w={1728} h={516} clipping={true}>
        {
          <KeyedFor each={s.timeline} keyOf={(item) => item.x}>
            {(time, index) => (
              <TvText
                x={time().x - 192 + 16}
                y={12}
                content={time().label}
                font={"Onest600"}
                size={22}
                color={s.secondary}
              />
            )}
          </KeyedFor>
        }
        {
          <KeyedFor each={s.timeline} keyOf={(item) => item.x}>
            {(time, index) => (
              <TvView
                x={time().x - 192}
                y={0}
                w={2}
                h={48}
                color={s.hairline}
              />
            )}
          </KeyedFor>
        }
        {
          <KeyedFor each={s.channels} keyOf={(item) => item.channel.id}>
            {(entry, index) => (
              <LiveChannel
                screenRef={"liveChannel" + entry().channel.id}
                row={entry().row}
                channel={entry()}
                x={0}
                y={entry().y - 460}
              />
            )}
          </KeyedFor>
        }
        {
          <KeyedFor each={s.programs} keyOf={(item) => item.id}>
            {(entry, index) => (
              <LiveProgram
                screenRef={"liveProgram" + entry().id}
                position={index()}
                block={entry()}
                x={entry().x - 192}
                y={entry().y - 460}
              />
            )}
          </KeyedFor>
        }
        <TvView
          x={s.nowX - 192}
          y={48}
          w={3}
          h={468}
          color={s.accent}
          show={s.nowX >= 0}
        />
        <TvView
          x={s.nowX - 192 - 39}
          y={6}
          w={78}
          h={36}
          rounded={18}
          color={s.accent}
          show={s.nowX >= 0}
        />
        <TvText
          x={s.nowX - 192 - 27}
          y={13}
          content={s.nowLabel}
          font={"Onest700"}
          size={18}
          color={s.onAccent}
          show={s.nowX >= 0}
        />
      </TvView>
      <TvText
        x={192}
        y={545}
        content={s.status}
        font={"Onest"}
        size={24}
        color={s.secondary}
      />
      <TvView x={144} y={976} w={1776} h={104} color={s.chrome.background} />
      <TvView
        x={1216}
        y={1008}
        w={44}
        h={31}
        rounded={8}
        color={s.chrome.keyBorder}
      />
      <TvText
        x={1226}
        y={1013}
        content={s.chrome.okLabel}
        font={"Onest700"}
        size={16}
        color={s.chrome.primary}
      />
      <TvText
        x={1275}
        y={1012}
        content={s.chrome.watchLabel}
        font={"Onest"}
        size={20}
        color={s.chrome.body}
      />
      <TvView
        x={1373}
        y={1008}
        w={40}
        h={31}
        rounded={8}
        color={s.chrome.keyBorder}
      />
      <TvText
        x={1384}
        y={1012}
        content={s.chrome.optionsIcon}
        font={"Onest"}
        size={19}
        color={s.chrome.primary}
      />
      <TvText
        x={1424}
        y={1012}
        content={s.chrome.detailsLabel}
        font={"Onest"}
        size={20}
        color={s.chrome.body}
      />
      <TvView
        x={1523}
        y={1008}
        w={58}
        h={31}
        rounded={8}
        color={s.chrome.keyBorder}
      />
      <TvText
        x={1535}
        y={1013}
        content={s.chrome.channelIcon}
        font={"Onest700"}
        size={16}
        color={s.chrome.primary}
      />
      <TvText
        x={1594}
        y={1012}
        content={s.chrome.channelsLabel}
        font={"Onest"}
        size={20}
        color={s.chrome.body}
      />
      <TvView
        x={1717}
        y={1008}
        w={54}
        h={31}
        rounded={8}
        color={s.chrome.keyBorder}
      />
      <TvText
        x={1728}
        y={1013}
        content={s.chrome.timeIcon}
        font={"Onest700"}
        size={16}
        color={s.chrome.primary}
      />
      <TvText
        x={1784}
        y={1012}
        content={s.chrome.timeLabel}
        font={"Onest"}
        size={20}
        color={s.chrome.body}
      />
    </TvView>
  ),
});
