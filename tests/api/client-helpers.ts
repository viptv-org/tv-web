import { MemoryDeviceSessionStore, TvApi } from "../../src/api";

export type Call = { readonly input: string; readonly init?: RequestInit };
export const deviceTokens = {
  sessionId: "s1",
  accountId: "1",
  profileId: null,
  accessToken: "access",
  refreshToken: "refresh",
  expiresIn: 900,
};
export function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
export function apiFor(
  fetcher: typeof fetch,
  sessionStore?: MemoryDeviceSessionStore,
) {
  return new TvApi({
    baseUrl: "https://viptv.example",
    fetch: fetcher,
    sessionStore,
  });
}
export function scripted(...replies: Response[]) {
  const calls: Call[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ input: String(input), init });
    const next = replies.shift();
    if (!next) throw new Error("Unexpected request");
    return next;
  };
  return { calls, fetcher };
}
