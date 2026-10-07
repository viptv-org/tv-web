import { it, expect } from "vitest";
import { playerInfoRows } from "../../src/tv-solid/playerInfo";

it("labels a proxied direct session as Direct stream (proxy)", () => {
  const rows = playerInfoRows({
    diagnostics: { engine: "native-html", networkTransport: "browser-proxy", transport: "hls" },
    sessionMode: "direct",
    videoMode: "copy",
    audioMode: "copy",
    format: "hls",
  });
  expect(rows.find((row) => row.label === "Delivery")?.value).toBe("Direct stream (proxy)");
  expect(rows.find((row) => row.label === "Engine")?.value).toBe("native-html");
  expect(rows.find((row) => row.label === "Container")?.value).toBe("hls");
});

it("labels a remux session and a transcode session distinctly", () => {
  expect(playerInfoRows({ sessionMode: "remux", videoMode: "copy", audioMode: "copy" })
    .find((row) => row.label === "Delivery")?.value).toBe("Remuxing");
  expect(playerInfoRows({ sessionMode: "transcode", videoMode: "encode", audioMode: "copy" })
    .find((row) => row.label === "Delivery")?.value).toBe("Transcoding");
  expect(playerInfoRows({ sessionMode: "transcode", videoMode: "copy", audioMode: "transcode" })
    .find((row) => row.label === "Delivery")?.value).toBe("Transcoding");
});

it("marks a direct non-proxied session and reports engine data with fallbacks", () => {
  const rows = playerInfoRows({
    diagnostics: { engine: "hls.js", networkTransport: "browser-proxy", videoCodec: "avc1", width: 1920, height: 1080 },
    sessionMode: "direct",
    videoMode: "copy",
    audioMode: "copy",
    fallbackEngine: "HTMLMediaElement",
  });
  expect(rows.find((row) => row.label === "Delivery")?.value).toBe("Direct stream (proxy)");
  expect(rows.find((row) => row.label === "Resolution")?.value).toBe("1920 × 1080");
  expect(rows.find((row) => row.label === "Video codec")?.value).toBe("avc1");

  const direct = playerInfoRows({ diagnostics: null, sessionMode: "direct", fallbackEngine: "HTMLMediaElement" });
  expect(direct.find((row) => row.label === "Delivery")?.value).toBe("Direct stream");
  expect(direct.find((row) => row.label === "Engine")?.value).toBe("HTMLMediaElement");
});

it("omits empty rows and reports Unknown when nothing is known", () => {
  const rows = playerInfoRows({});
  expect(rows.map((row) => row.label)).toEqual(["Delivery", "Engine", "Transport", "Container"]);
  expect(rows.find((row) => row.label === "Delivery")?.value).toBe("Unknown");
  expect(rows.find((row) => row.label === "Transport")?.value).toBe("Unknown");
});
