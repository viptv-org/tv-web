export type SourceMenuOption = {
  id: string;
  label: string;
  count: number;
  height?: number;
  provider?: string;
};

export const sourceActionOptions = [
      {
        id: "direct",
        label: "Direct play",
        detail: "Try this source on this device · no transcoder",
      },
      {
        id: "gateway",
        label: "Play with gateway",
        detail: "Server delivery · transcodes when needed",
      },
      { id: "cancel", label: "Cancel", detail: "" },
    ];
