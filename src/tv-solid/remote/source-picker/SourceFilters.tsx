/** @jsxImportSource @solidtv/solid */
import { TvView } from "../../runtime";
import { icon, Label, palette } from "../visuals";
import { filterPillWidth as sourceFilterPillWidth, filterTitleWidth as sourceFilterTitleWidth } from "../filter-pill-layout";

export function SourceFilters(props: { quality: string; provider: string; focused?: number }) {
  return <>
    <Label
      x={64}
      y={174}
      size={17}
      color={palette.muted}
      maxwidth={800}
      maxlines={1}
      content="Hold OK on a source for direct play"
    />
    <TvView
      x={64}
      y={216}
      w={
        sourceFilterPillWidth(
          "Quality:",
          props.quality,
        ) + 6
      }
      h={56}
      color={
        props.focused === 0
          ? palette.text
          : "#2A2A2E"
      }
    >
      <Label
        x={24}
        centerY={32}
        size={24}
        font="Onest600"
        content="Quality:"
        color={
          props.focused === 0
            ? "#4A4945"
            : palette.muted
        }
      />
      <Label
        x={24 + sourceFilterTitleWidth("Quality:") + 6}
        centerY={28}
        size={24}
        font="Onest600"
        maxwidth={
          sourceFilterPillWidth(
            "Quality:",
            props.quality,
          ) -
          74 -
          sourceFilterTitleWidth("Quality:")
        }
        maxlines={1}
        content={props.quality}
        color={
          props.focused === 0
            ? "#111113"
            : palette.text
        }
      />
      <TvView
        x={
          sourceFilterPillWidth(
            "Quality:",
            props.quality,
          ) -
          44
        }
        y={16}
        w={24}
        h={24}
        src={icon(
          "down",
          props.focused === 0,
        )}
      />
    </TvView>
    <TvView
      x={
        64 +
        sourceFilterPillWidth(
          "Quality:",
          props.quality,
        ) +
        14
      }
      y={216}
      w={
        sourceFilterPillWidth(
          "Source:",
          props.provider,
        ) + 6
      }
      h={56}
      color={
        props.focused === 1
          ? palette.text
          : "#2A2A2E"
      }
    >
      <Label
        x={24}
        centerY={32}
        size={24}
        font="Onest600"
        content="Source:"
        color={
          props.focused === 1
            ? "#4A4945"
            : palette.muted
        }
      />
      <Label
        x={24 + sourceFilterTitleWidth("Source:") + 6}
        centerY={28}
        size={24}
        font="Onest600"
        maxwidth={
          sourceFilterPillWidth(
            "Source:",
            props.provider,
          ) -
          74 -
          sourceFilterTitleWidth("Source:")
        }
        maxlines={1}
        content={props.provider}
        color={
          props.focused === 1
            ? "#111113"
            : palette.text
        }
      />
      <TvView
        x={
          sourceFilterPillWidth(
            "Source:",
            props.provider,
          ) -
          44
        }
        y={16}
        w={24}
        h={24}
        src={icon(
          "down",
          props.focused === 1,
        )}
      />
    </TvView>
  </>;
}
