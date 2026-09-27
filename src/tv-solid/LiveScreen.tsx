/** @jsxImportSource @solidtv/solid */
import { CollapsedRail } from "./CollapsedRail";
import { defineScreen, TvView, TvText, KeyedFor } from "./runtime";
import { ChannelLogo } from "./ChannelLogo";
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
      <CollapsedRail avatar={s.chrome.homeProfileAvatar} current="live"/>
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
      <ChannelLogo x={1370} y={96} w={428} h={216} src={s.hero.channel?.poster || ""} label={s.hero.monogram} color={s.secondary}/>
      <TvView x={188} y={370} w={1640} h={64} clipping>
      {
        <KeyedFor each={s.filters} keyOf={(item) => item.id}>
          {(entry, index) => (
            <LiveFilterChip
              screenRef={"liveFilter" + entry().id}
              position={index()}
              filter={entry()}
              x={entry().x-188}
              y={4}
            />
          )}
        </KeyedFor>
      }
      </TvView>
      <TvView x={188} y={460} w={1640} h={566} clipping={true}>
        {
          <KeyedFor each={s.timeline} keyOf={(item) => item.x}>
            {(time, index) => (
              <TvText
                x={time().x - 188 + 16}
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
                x={time().x - 188}
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
                x={4}
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
                x={entry().x - 188}
                y={entry().y - 460}
              />
            )}
          </KeyedFor>
        }
        <TvView
          x={s.nowX - 188}
          y={48}
          w={3}
          h={468}
          color={s.accent}
          show={s.nowX >= 0}
        />
        <TvView
          x={s.nowX - 188 - 39}
          y={6}
          w={78}
          h={36}
          rounded={18}
          color={s.accent}
          show={s.nowX >= 0}
        />
        <TvText
          x={s.nowX - 188 - 27}
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
      <TvView x={144} y={1026} w={1776} h={54} color={s.chrome.background} />









    </TvView>
  ),
});
