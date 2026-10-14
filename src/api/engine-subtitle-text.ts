import { TvApiError, throwIfAborted, type RequestOptions } from './client-shared';

/** Only the selected API origin receives authentication; addon URLs never enter this transport. */
export async function engineSubtitleText(fetcher: typeof fetch, origin: string, id: string,
  accessToken: () => string | undefined, refresh: () => Promise<unknown>, options?: RequestOptions): Promise<string> {
  const scope = new AbortController(), cancel = () => scope.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; scope.abort(); }, 20_000);
  options?.signal?.addEventListener('abort', cancel, { once: true });
  if (options?.signal?.aborted) cancel();
  const send = async (retry: boolean): Promise<string> => {
    throwIfAborted(scope.signal);
    const token = accessToken();
    const response = await fetcher(`${origin}/api/v3/subtitle-content/${encodeURIComponent(id)}`, {
      headers: { Accept: 'text/vtt', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: scope.signal, redirect: 'error', cache: 'no-store',
    });
    if (response.status === 401 && retry) {
      await response.body?.cancel();
      if (token === accessToken()) await refresh();
      return send(false);
    }
    if (!response.ok) { await response.body?.cancel(); throw new TvApiError(response.status, 'Subtitles could not be loaded.'); }
    if (!/^text\/vtt(?:;|$)/i.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel(); throw new TvApiError(502, 'The server returned invalid subtitle content.');
    }
    const limit = 2 * 1024 * 1024;
    if (Number(response.headers.get('content-length')) > limit) {
      await response.body?.cancel(); throw new TvApiError(502, 'Subtitle content is too large.');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new TvApiError(502, 'The server returned empty subtitle content.');
    const decoder = new TextDecoder(), parts: string[] = [];
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > limit) { await reader.cancel(); throw new TvApiError(502, 'Subtitle content is too large.'); }
        parts.push(decoder.decode(value, { stream: true }));
      }
      parts.push(decoder.decode());
    } finally { reader.releaseLock(); }
    throwIfAborted(scope.signal);
    return parts.join('');
  };
  try { return await send(true); }
  catch (error) {
    if (timedOut && !options?.signal?.aborted) throw new TvApiError(408, 'Subtitle loading timed out. Try again.');
    throw error;
  } finally { clearTimeout(timer); options?.signal?.removeEventListener('abort', cancel); }
}
