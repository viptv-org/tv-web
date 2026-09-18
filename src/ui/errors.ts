import { TvApiError } from "../api/client";

/**
 * Error presentation for the whole app: every failure the UI shows is
 * classified once here, so banners and dialogs carry what actually happened
 * (the backend's answer, the failing request) instead of a bare string.
 */

export type ErrorKind = "network" | "server" | "auth" | "client" | "unknown";

export interface ErrorDetail {
  readonly kind: ErrorKind;
  /** Short headline naming the failure category. */
  readonly title: string;
  /** One plain-language sentence explaining what the failure means. */
  readonly message: string;
  /** Raw diagnostics for the collapsible details block. */
  readonly lines: readonly string[];
}

function detailLines(error: TvApiError): string[] {
  const lines = [
    `HTTP status: ${error.status === 0 ? "none (connection refused)" : String(error.status)}`,
  ];
  if (error.endpoint) lines.push(`Request: ${error.endpoint}`);
  if (error.code) lines.push(`Error code: ${error.code}`);
  lines.push(`Message: ${error.message}`);
  return lines;
}

export function describeApiError(error: unknown): ErrorDetail {
  if (error instanceof TvApiError) {
    if (error.status === 0) {
      return {
        kind: "network",
        title: "Can't reach the backend",
        message:
          "The connection was refused, so the backend is down or unreachable. Browsing and playback pause until it responds again.",
        lines: detailLines(error),
      };
    }
    if (error.status === 401 || error.status === 403) {
      return {
        kind: "auth",
        title: "Sign-in required",
        message: `${error.message} (HTTP ${error.status}).`,
        lines: detailLines(error),
      };
    }
    if (error.status >= 500) {
      return {
        kind: "server",
        title: "The backend reported an error",
        message: `${error.message} (HTTP ${error.status}).`,
        lines: detailLines(error),
      };
    }
    return {
      kind: "client",
      title: "The request was refused",
      message: `${error.message} (HTTP ${error.status}).`,
      lines: detailLines(error),
    };
  }
  if (error instanceof Error) {
    return {
      kind: "unknown",
      title: "Something went wrong",
      message: error.message,
      lines: [`Error: ${error.name}: ${error.message}`],
    };
  }
  return {
    kind: "unknown",
    title: "Something went wrong",
    message: String(error),
    lines: [],
  };
}

/**
 * The coalesced connectivity state: one surface tracks the whole outage, so
 * a burst of failed requests updates it instead of re-triggering a dialog
 * for each one.
 */
export interface ConnectionIssue {
  readonly failedCount: number;
  readonly firstFailedAt: number;
  readonly lastFailedAt: number;
}

export function nextConnectionFailure(
  previous: ConnectionIssue | undefined,
  now: number,
): ConnectionIssue {
  return previous
    ? {
        failedCount: previous.failedCount + 1,
        firstFailedAt: previous.firstFailedAt,
        lastFailedAt: now,
      }
    : { failedCount: 1, firstFailedAt: now, lastFailedAt: now };
}

export function connectionSummary(
  issue: ConnectionIssue,
  clock: (at: number) => string = defaultClock,
): string {
  const since = clock(issue.firstFailedAt);
  return issue.failedCount === 1
    ? `Backend unreachable since ${since}.`
    : `${issue.failedCount} requests failed since ${since}.`;
}

function defaultClock(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
