import type { Card } from './types';

export interface SourceChoice {
  provider_id: string;
  provider_name?: string;
  audio_languages: string[];
}
export interface SourceReuseContext { title?: SourceChoice; across?: SourceChoice; }
export interface DevicePlaybackPort {
  load(): Promise<string | null>;
  save(value: string): Promise<void>;
}
type State = { version: 1; autoplay: boolean; across: string[]; entries: [string, SourceChoice][] };
const KEY = 'viptv-device-playback:v1';
const MAX_BYTES = 16_384, MAX_ENTRIES = 200;
const empty = (): State => ({ version: 1, autoplay: true, across: [], entries: [] });
const bytes = (value: string) => encodeURIComponent(value).replace(/%[A-F\d]{2}/g, 'x').length;
const text = (value: unknown, max = 256): value is string => typeof value === 'string' &&
  !!value.trim() && bytes(value) <= max && !/[\u0000-\u001f\u007f]/.test(value) && !value.includes('://');
function choice(value: unknown): SourceChoice | undefined {
  const v = value as Partial<SourceChoice> | null;
  if (!v || !text(v.provider_id) || v.provider_name !== undefined && !text(v.provider_name) ||
      !Array.isArray(v.audio_languages) || v.audio_languages.length > 8 || !v.audio_languages.every(s => text(s, 32))) return;
  return { provider_id: v.provider_id, ...(v.provider_name ? { provider_name: v.provider_name } : {}), audio_languages: [...new Set(v.audio_languages)] };
}
const validKey = (key: unknown): key is string => typeof key === 'string' && key.length > 0 && key.length <= 1024;
export const deviceProfileKey = (origin: string, profile: string) => JSON.stringify([new URL(origin).origin, profile]);
export function deviceTitleKey(scope: string, card: Card): string {
  const identity = card.identity.kind === 'series' && card.parent_identity ? card.parent_identity : card.identity;
  return JSON.stringify([scope, card.provider_id, identity.kind, identity.id]);
}

/** Persistence/observations only. The server chooses the fresh ranked source IDs. */
export class DevicePlayback {
  readonly ready: Promise<void>;
  private state = empty();
  private queue: Promise<void> = Promise.resolve();
  version = 0;
  constructor(private port: DevicePlaybackPort = (globalThis as any).__viptvDevicePlaybackPort ?? {
    async load() { return localStorage.getItem(KEY); },
    async save(value: string) { localStorage.setItem(KEY, value); },
  }, private changed: () => void = () => {}) {
    this.ready = this.read();
  }
  private async read() {
    try {
      const raw = await this.port.load();
      if (!raw || bytes(raw) > MAX_BYTES) return;
      const v = JSON.parse(raw) as Partial<State>;
      if (v.version !== 1) return;
      this.state = {
        version: 1, autoplay: typeof v.autoplay === 'boolean' ? v.autoplay : true,
        across: Array.isArray(v.across) ? v.across.filter(validKey).slice(-32) : [],
        entries: Array.isArray(v.entries) ? v.entries.flatMap(entry => {
          if (!Array.isArray(entry) || !validKey(entry[0])) return [];
          const value = choice(entry[1]);return value ? [[entry[0], value] as [string, SourceChoice]] : [];
        }).slice(-MAX_ENTRIES) : [],
      };
    } catch { this.state = empty(); }
    finally { this.version++; this.changed(); }
  }
  get autoplay() { return this.state.autoplay; }
  across(scope: string) { return this.state.across.includes(scope); }
  async context(scope: string, title: string): Promise<SourceReuseContext> {
    await this.ready;await this.queue.catch(() => {});
    const entries = new Map(this.state.entries);
    return { title: choice(entries.get(title)), across: this.across(scope) ? choice(entries.get(`global:${scope}`)) : undefined };
  }
  private mutate(change: (state: State, entries: Map<string, SourceChoice>) => void): Promise<void> {
    const operation = this.queue.catch(() => {}).then(async () => {
      await this.ready;
      const state: State = { ...this.state, across: [...this.state.across], entries: [] };
      const entries = new Map(this.state.entries);
      change(state, entries);
      let remaining = MAX_BYTES - bytes(JSON.stringify(state));
      if (remaining < 0) throw new Error('Device playback settings are too large.');
      const newest = [...entries].slice(-MAX_ENTRIES).reverse();
      for (const entry of newest) {
        const cost = bytes(JSON.stringify(entry)) + (state.entries.length ? 1 : 0);
        if (cost > remaining) break;
        state.entries.push(entry); remaining -= cost;
      }
      state.entries.reverse();
      await this.port.save(JSON.stringify(state));
      this.state = state; this.version++; this.changed();
    });
    this.queue = operation;return operation;
  }
  setAutoplay(enabled: boolean) { return this.mutate(state => { state.autoplay = enabled; }); }
  setAcross(scope: string, enabled: boolean) {
    return this.mutate((state, entries) => {
      state.across = state.across.filter(key => key !== scope);
      if (enabled) {
        state.across.push(scope);state.across = state.across.slice(-32);
        if (!entries.has(`global:${scope}`) && entries.has(`last:${scope}`)) entries.set(`global:${scope}`, entries.get(`last:${scope}`)!);
      }
    });
  }
  remember(scope: string, title: string, observation: SourceChoice) {
    const value = choice(observation);
    if (!value) return Promise.reject(new Error('This source cannot be remembered.'));
    return this.mutate((state, entries) => {
      for (const key of [title, `last:${scope}`, ...(state.across.includes(scope) ? [`global:${scope}`] : [])]) {
        entries.delete(key); entries.set(key, value);
      }
    });
  }
}
