/** @jsxImportSource @solidtv/solid */
import { TvView } from "../../runtime";
import { icon, Label, palette } from "../visuals";
import { sdfTextMetrics } from "../text-measure";
import { filterTitleWidth } from "../filter-pill-layout";
import type { LivePage } from "../types";

export function LiveGroupSelector(props: { groups: LivePage["groups"]; group?: string; focused: boolean; selected: number }) {
  return <>
    {(() => {
      const groupList = () => [
        { id: "all", label: "All" },
        ...props.groups,
      ];
      const label = () => {
        const index =
          props.focused
            ? props.selected
            : props.group
              ? groupList().findIndex(
                  (group) => group.id === props.group,
                )
              : 0;
        return groupList()[Math.max(0, index)]?.label ?? "All";
      };
      const width = () => {
        const title = "Group:";
        const value = label();
        const context = sdfTextMetrics("24px Onest600");
        return Math.min(
          520,
          76 +
            Math.ceil(context.measureText(title).width) +
            Math.ceil(context.measureText(value).width),
        );
      };
      return (
        <TvView
          x={96}
          y={512}
          w={width() + 6}
          h={64}
          color={
            props.focused ? palette.text : "#2A2A2E"
          }
        >
          <Label
            x={24}
            centerY={32}
            size={24}
            font="Onest600"
            content="Group:"
            color={
              props.focused
                ? "#4A4945"
                : palette.muted
            }
          />
          <Label
            x={24 + filterTitleWidth("Group:") + 6}
            centerY={32}
            size={24}
            font="Onest600"
            maxwidth={
              width() -
              74 -
              filterTitleWidth("Group:")
            }
            maxlines={1}
            content={label()}
            color={
              props.focused
                ? "#111113"
                : palette.text
            }
          />
          <TvView
            x={width() - 44}
            y={20}
            w={24}
            h={24}
            src={icon("down", props.focused)}
          />
        </TvView>
      );
    })()}
  </>;
}
