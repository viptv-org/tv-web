export type TvPlatform = 'web' | 'webos' | 'tizen' | 'vizio';

export function resolveTvPlatform(search: string, userAgent: string): TvPlatform {
  const requested = new URLSearchParams(search).get('platform');
  if (requested === 'web' || requested === 'webos' || requested === 'tizen' || requested === 'vizio') return requested;
  if (/\b(?:Web0S|webOS)\b/i.test(userAgent)) return 'webos';
  if (/\bTizen\b/i.test(userAgent) && /\b(?:SMART-TV|SmartTV|TV)\b/i.test(userAgent)) return 'tizen';
  return 'web';
}
