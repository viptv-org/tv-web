import { describe, expect, it } from "vitest";

import { TvApi, TvApiError } from "../../src/api/client";
import {
  connectionSummary,
  describeApiError,
  nextConnectionFailure,
} from "../../src/ui/errors";

describe("describeApiError", () => {
  it("classifies connection refusals as backend-unreachable network failures", () => {
    const detail = describeApiError(
      new TvApiError(0, "Network request failed", "network", "GET /api/discover"),
    );
    expect(detail.kind).toBe("network");
    expect(detail.title).toBe("Can't reach the backend");
    expect(detail.lines).toContain("HTTP status: none (connection refused)");
    expect(detail.lines).toContain("Request: GET /api/discover");
    expect(detail.lines).toContain("Error code: network");
  });

  it("carries the backend's own message and code for server errors", () => {
    const detail = describeApiError(
      new TvApiError(503, "Service unavailable", "unhealthy", "POST /api/streams"),
    );
    expect(detail.kind).toBe("server");
    expect(detail.message).toContain("Service unavailable (HTTP 503)");
    expect(detail.lines).toContain("Request: POST /api/streams");
    expect(detail.lines).toContain("Error code: unhealthy");
  });

  it("separates auth refusals from other client errors", () => {
    expect(describeApiError(new TvApiError(401, "Unauthorized", "unauthorized")).kind).toBe("auth");
    expect(describeApiError(new TvApiError(400, "Invalid request", "bad_request")).kind).toBe("client");
  });

  it("falls back to the error name for non-API errors", () => {
    const detail = describeApiError(new Error("boom"));
    expect(detail.kind).toBe("unknown");
    expect(detail.message).toBe("boom");
    expect(detail.lines[0]).toContain("Error: ");
  });
});

describe("connection coalescing", () => {
  it("counts failures from the first one instead of retriggering", () => {
    const first = nextConnectionFailure(undefined, 1000);
    expect(first).toEqual({ failedCount: 1, firstFailedAt: 1000, lastFailedAt: 1000 });
    const burst = nextConnectionFailure(nextConnectionFailure(first, 5000), 9000);
    expect(burst.failedCount).toBe(3);
    expect(burst.firstFailedAt).toBe(1000);
    expect(burst.lastFailedAt).toBe(9000);
  });

  it("summarizes one failure and a burst differently", () => {
    const clock = (at: number) => `t${at}`;
    expect(
      connectionSummary({ failedCount: 1, firstFailedAt: 500, lastFailedAt: 500 }, clock),
    ).toBe("Backend unreachable since t500.");
    expect(
      connectionSummary({ failedCount: 7, firstFailedAt: 500, lastFailedAt: 9000 }, clock),
    ).toBe("7 requests failed since t500.");
  });
});

describe("probeBackend recovery gate", () => {
  const api = (status: number | "throw") =>
    new TvApi({
      baseUrl: "https://viptv.local.test:8443",
      fetch: async () => {
        if (status === "throw") throw new TypeError("Network request failed");
        return new Response("{}", { status });
      },
    });

  it("stays down while the gateway answers 5xx for a dead backend", async () => {
    await expect(api(502).probeBackend()).resolves.toBe(false);
    await expect(api(503).probeBackend()).resolves.toBe(false);
  });

  it("clears only once the backend itself answers below 500", async () => {
    await expect(api(200).probeBackend()).resolves.toBe(true);
    await expect(api(404).probeBackend()).resolves.toBe(true);
  });

  it("stays down on network-level failures", async () => {
    await expect(api("throw").probeBackend()).resolves.toBe(false);
  });
});
