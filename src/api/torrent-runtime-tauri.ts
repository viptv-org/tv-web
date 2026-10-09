import {invoke} from '@tauri-apps/api/core';
import type {RuntimeReply, TorrentRuntimePort} from './torrent-runtime';
/** Source, URL and authority values remain private to this effect adapter. */
export function tauriTorrentRuntime():TorrentRuntimePort {
  return {
    available:()=>invoke<boolean>('torrent_runtime_available'),
    clock:async()=>Number(await invoke<number>('torrent_runtime_clock')),
    call:async(command)=>JSON.parse(await invoke<string>('torrent_runtime_call',{request:JSON.stringify(command)})) as RuntimeReply,
  };
}
