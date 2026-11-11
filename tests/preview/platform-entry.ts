export function remoteTvEntry(defaultPlatform: string, focusdebug = false): string {
  const platform = process.env.REMOTE_TV_PLATFORM ?? defaultPlatform;
  if (!['web', 'webos', 'tizen', 'vizio'].includes(platform)) throw Error('REMOTE_TV_PLATFORM must be web, webos, tizen or vizio');
  return `/tv/?platform=${platform}${focusdebug ? '&focusdebug=1' : ''}`;
}
