/** SolidTV playback info panel rows, shared by rendering and tests. */
export interface PlayerInfoRow { label: string; value: string }

export interface PlayerInfoSource {
  readonly diagnostics?: {
    readonly engine?: string;
    readonly networkTransport?: string;
    readonly transport?: string;
    readonly videoCodec?: string;
    readonly audioCodec?: string;
    readonly width?: number;
    readonly height?: number;
  } | null;
  readonly sessionMode?: string;
  readonly videoMode?: string;
  readonly audioMode?: string;
  readonly format?: string;
  readonly fallbackEngine?: string;
}

/** Map the server's delivery authority + engine diagnostics to TV rows. */
export function playerInfoRows(source: PlayerInfoSource): PlayerInfoRow[] {
  const diagnostics = source.diagnostics ?? undefined;
  const mode = source.sessionMode;
  const delivery =
    mode === "direct"
      ? diagnostics?.networkTransport === "browser-proxy"
        ? "Direct stream (proxy)"
        : "Direct stream"
      : mode === "transcode" || source.videoMode === "transcode" || source.audioMode === "transcode"
        ? "Transcoding"
        : mode === "remux"
          ? "Remuxing"
          : mode || "Unknown";
  return [
    { label: "Delivery", value: delivery },
    { label: "Engine", value: diagnostics?.engine ?? source.fallbackEngine ?? "Unknown" },
    { label: "Transport", value: diagnostics?.networkTransport ?? "Unknown" },
    { label: "Container", value: diagnostics?.transport ?? source.format ?? "Unknown" },
    { label: "Video delivery", value: source.videoMode ?? "" },
    { label: "Audio delivery", value: source.audioMode ?? "" },
    { label: "Video codec", value: diagnostics?.videoCodec ?? "" },
    { label: "Audio codec", value: diagnostics?.audioCodec ?? "" },
    {
      label: "Resolution",
      value: diagnostics?.width ? `${diagnostics.width} × ${diagnostics.height}` : "",
    },
  ].filter((row) => row.value);
}
