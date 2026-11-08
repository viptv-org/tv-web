/** @jsxImportSource @solidtv/solid */
import { For, Show } from "solid-js";
import { TvView } from "../runtime";
import { Button, Label, palette } from "./visuals";
import { imageSource } from "./image-source";
import { sdfTextMetrics } from "./text-measure";
import { timeOfDay } from "./time";
import type { CalendarEntry } from "./types";

export type CalendarDay = { key: string; label: string; date: Date };

export const calendarDayKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

export function calendarDays(entries: CalendarEntry[]): CalendarDay[] {
  const unique = new Map<string, Date>();
  for (const entry of entries) {
    const date = new Date(entry.date);
    if (!Number.isNaN(date.getTime())) unique.set(calendarDayKey(date), date);
  }
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return [...unique.entries()]
    .sort(([, left], [, right]) => left.getTime() - right.getTime())
    .slice(0, 7)
    .map(([key, date]) => {
      const label =
        key === calendarDayKey(today)
          ? "Today"
          : key === calendarDayKey(tomorrow)
            ? "Tomorrow"
            : `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()]} ${date.getDate()}`;
      return { key, label, date };
    });
}

const timeLabel = (date: Date) => timeOfDay(date.getTime());

const remainingLabel = (date: Date) => {
  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  if (minutes <= 0) return "Aired";
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60),
    rest = minutes % 60;
  return `in ${hours}h${rest ? ` ${rest}m` : ""}`;
};

export function CalendarBoard(props: {
  entries: CalendarEntry[];
  days: CalendarDay[];
  day: number;
  active: number;
  dayFocused: boolean;
  listFocused: boolean;
  watchFocused: boolean;
  loading: boolean;
  error: string;
}) {
  const visible = () => {
    const day = props.days[props.day];
    if (!day) return [];
    return props.entries.filter((entry) => {
      const date = new Date(entry.date);
      return !Number.isNaN(date.getTime()) && calendarDayKey(date) === day.key;
    });
  };
  const start = () => Math.max(0, props.active - 2);
  const selected = () => visible()[props.active] ?? visible()[0];
  return (
    <>
      <For each={props.days}>
        {(day, index) => {
          const width = () =>
            52 +
            Math.ceil(
              sdfTextMetrics("26px Onest700").measureText(day.label).width,
            );
          let x = 96;
          for (let i = 0; i < index(); i++)
            x +=
              52 +
              Math.ceil(
                sdfTextMetrics("26px Onest700").measureText(props.days[i].label)
                  .width,
              ) +
              10;
          return (
            <TvView
              x={x}
              y={140}
              w={width()}
              h={64}
              color={
                index() === props.day
                  ? palette.text
                  : props.dayFocused
                    ? "rgba(255,255,255,.10)"
                    : "rgba(0,0,0,0)"
              }
            >
              <Label
                w={width()}
                centerY={32}
                align="center"
                size={26}
                font="Onest700"
                maxlines={1}
                content={day.label}
                color={
                  index() === props.day
                    ? "#111113"
                    : props.dayFocused
                      ? palette.text
                      : palette.muted
                }
              />
            </TvView>
          );
        }}
      </For>
      <Show when={props.error}>
        <Label
          x={96}
          y={250}
          size={26}
          maxwidth={1100}
          color="#FF7A6E"
          content={props.error}
        />
      </Show>
      <Show when={!props.error && !visible().length}>
        <Label
          x={96}
          y={250}
          size={26}
          maxwidth={1100}
          color={palette.muted}
          content={
            props.loading ? "Loading the calendar…" : "Nothing airs on this day."
          }
        />
      </Show>
      <For each={visible().slice(start(), start() + 5)}>
        {(entry, index) => {
          const focused = () =>
            props.listFocused && index() + start() === props.active;
          const date = new Date(entry.date);
          return (
            <TvView
              x={96}
              y={250 + index() * 128}
              w={1100}
              h={112}
              color={focused() ? palette.text : "#222222"}
            >
              <Label
                x={24}
                w={140}
                align="right"
                centerY={56}
                size={26}
                font="Onest700"
                maxlines={1}
                content={timeLabel(date)}
                color={focused() ? "#111113" : palette.text}
              />
              <TvView
                x={174}
                y={14}
                w={56}
                h={84}
                color={palette.surface}
              >
                <Show when={entry.card.poster ?? entry.card.landscape}>
                  <TvView
                    w={56}
                    h={84}
                    src={imageSource(
                      entry.card.poster ?? entry.card.landscape,
                      168,
                    )}
                    fit="cover"
                  />
                </Show>
              </TvView>
              <Label
                x={246}
                y={16}
                size={30}
                font="Onest700"
                maxwidth={600}
                maxlines={1}
                content={entry.card.title}
                color={focused() ? "#111113" : palette.text}
              />
              <Label
                x={246}
                y={58}
                size={22}
                maxwidth={600}
                maxlines={1}
                content={`S${entry.season ?? 1} E${entry.episode ?? 1}${
                  entry.episode_title ? ` · ${entry.episode_title}` : ""
                }${entry.card.subtitle ? ` · ${entry.card.subtitle}` : ""}`}
                color={focused() ? "#4A4945" : palette.muted}
              />
              <Label
                x={900}
                y={16}
                w={176}
                align="right"
                size={22}
                font="Onest700"
                content={remainingLabel(date)}
                color={
                  focused()
                    ? "#111113"
                    : remainingLabel(date) === "Aired"
                      ? palette.muted
                      : palette.accent
                }
              />
            </TvView>
          );
        }}
      </For>
      <Show when={selected()}>
        {(entry) => {
          const date = new Date(entry().date);
          return (
            <>
              <TvView
                x={1292}
                y={250}
                w={580}
                h={326}
                color={palette.surface}
              >
                <Show when={entry().card.landscape ?? entry().card.poster}>
                  <TvView
                    w={580}
                    h={326}
                    src={imageSource(
                      entry().card.landscape ?? entry().card.poster,
                      1160,
                    )}
                    fit="cover"
                  />
                </Show>
              </TvView>
              <Label
                x={1292}
                y={608}
                size={40}
                font="Onest700"
                maxwidth={580}
                maxlines={2}
                content={entry().card.title}
              />
              <Label
                x={1292}
                y={708}
                size={24}
                lineheight={1.45}
                maxwidth={580}
                maxlines={4}
                color={palette.body}
                content={`Episode ${entry().episode ?? 1} aired at ${timeLabel(
                  date,
                )}.${
                  entry().episode_title
                    ? ` ${entry().episode_title}.`
                    : ""
                }`}
              />
              <Button
                x={1292}
                y={858}
                w={320}
                h={64}
                icon="play"
                iconSize={24}
                label={`Watch E${entry().episode ?? 1}`}
                focused={props.watchFocused}
              />
              <Label
                x={1292}
                y={940}
                size={22}
                color={palette.muted}
                content={`Data from ${
                  entry().source === "library" ? "your library" : "Simkl"
                }`}
              />
            </>
          );
        }}
      </Show>
    </>
  );
}
