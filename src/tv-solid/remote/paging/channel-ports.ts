import type { Accessor, Setter } from "solid-js";
import type { Channel, LivePage } from "../types";
import type { Screen } from "../app-types";
import type { RemoteTvApi } from "../api";
import type { PageDirection } from "../channelWindow";
import type { NavigationFocus } from "../navigation/focus";
import type { PageRequestOwner } from "./owner";

export interface PendingChannelMove {from: string; direction: PageDirection}
export interface ChannelPagingPorts {
  owner: PageRequestOwner; focus: NavigationFocus; screen: Accessor<Screen>; overlay: Accessor<boolean>;
  windows: {pages: (searching: boolean) => LivePage[]; values: (searching: boolean) => Channel[]; adopt: (pages: LivePage[], searching?: boolean) => void};
  search: {query: Accessor<string>; remembered: Accessor<number>; remember: (index: number) => void; signal: () => AbortSignal;
    paging: Setter<boolean>; error: Setter<string>; refresh: (query: string) => void};
  live: {group: Accessor<string | undefined>; index: Accessor<number>; retire: () => void; guides: () => Promise<void>; reload: (group: string | undefined) => Promise<void>};
  pending: {current: Accessor<PendingChannelMove | undefined>; set: (value: PendingChannelMove | undefined) => void};
  retry: (direction: PageDirection | undefined) => void; retryAction: (action: () => void) => void;
  request: RemoteTvApi["live"];
}
