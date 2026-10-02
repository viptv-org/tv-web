import type { MediaSource, StreamPoll } from "../api";
import { normalizeCore } from "../core";

export interface SourceProducer {
  /** The core sourceDisplay grouping key for an account add-on. */
  key: string;
  source: string;
  label: string;
  error?: string;
  errorCode?: string;
}

const sourceKeys = new WeakMap<MediaSource, string>();
export function sourceProviderKey(source: MediaSource) {
  if (!source.sourceAddonId) return "";
  let key = sourceKeys.get(source);
  if (!key) {
    key = normalizeCore<{ providerKey: string }>("sourceDisplay", source).providerKey;
    sourceKeys.set(source, key);
  }
  return key;
}

/** Only producers actually observed in discovery belong in the picker. */
export function observeSourceProducers(
  previous: readonly SourceProducer[],
  events: StreamPoll["events"],
  names: ReadonlyMap<string, string>,
): SourceProducer[] {
  const observed = new Map(previous.map((producer) => [producer.key, {
    ...producer, label: names.get(producer.source) ?? producer.label,
  }]));
  for (const event of events) {
    if (!/^addon:\d+$/.test(event.source)) continue;
    const key = sourceProviderKey({ id: "", name: "", sourceAddonId: event.source } as MediaSource);
    const prior = observed.get(key);
    observed.set(key, {
      key,
      source: event.source,
      label: names.get(event.source) ?? prior?.label ?? event.source,
      error: event.error ?? prior?.error,
      errorCode: event.errorCode ?? prior?.errorCode,
    });
  }
  return [...observed.values()];
}

export function configuredAddonNames(addons: readonly Record<string, unknown>[]) {
  const names = new Map<string, string>();
  for (const addon of addons) {
    if ((typeof addon.id === "number" || typeof addon.id === "string") &&
        typeof addon.name === "string" && addon.name.trim())
      names.set(`addon:${addon.id}`, addon.name.trim());
  }
  return names;
}

export function producerStatus(
  producer: SourceProducer,
  rows: readonly MediaSource[],
  done: boolean,
) {
  if (rows.some((row) => sourceProviderKey(row) === producer.key)) return "";
  if (!done) return `Still checking ${producer.label}`;
  if (producer.errorCode === "source_format_unsupported")
    return `${producer.label} returned formats this app cannot play. Only HTTP(S) streams are supported here.`;
  if (producer.error) return `${producer.label}: ${producer.error}`;
  return `No playable sources from ${producer.label}`;
}
