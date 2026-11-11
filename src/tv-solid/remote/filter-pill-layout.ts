import { sdfTextMetrics } from "./text-measure";

export const filterTitleWidth = (text: string) => Math.ceil(sdfTextMetrics("24px Onest600").measureText(text).width);
export const filterPillWidth = (title: string, value: string) =>
  76 + filterTitleWidth(title) + Math.ceil(sdfTextMetrics("24px Onest600").measureText(value).width);
