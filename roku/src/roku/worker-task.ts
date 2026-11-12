/**
 * Typed bridge to the SceneGraph `WorkerTask` component.
 *
 * The Task node runs BrightScript on a separate thread. TypeScript cannot
 * execute in that thread, so this API posts a command and observes the
 * response. Add commands in `src/compiled-components/WorkerTask.brs` when an
 * app needs parallel work; use `tasks.ts` for time-sliced TypeScript work.
 */
import { createElement, insertNode, setProp, tmTransaction } from "@roku-sdk/solid";

export type WorkerRequest =
  | { op: "echo"; value: any }
  | { op: "caption-mode" }
  | { op: "sleep"; ms: number }
  | { op: "json"; text: string }
  | { op: "fetch"; url: string; headers?: Record<string, string> }
  | { op: "storage"; action: "load"; section: string; key: string }
  | { op: "storage"; action: "save"; section: string; key: string; value: string }
  | { op: "http"; url: string; method: string; headers?: Record<string, string>; payload?: any };

/** A response acknowledges that the worker has finished its requested effects. */
export class RokuTaskResponseError extends Error {}

interface WorkerResponse<T = any> {
  ok: boolean;
  result?: T;
  error?: string;
}

export interface RokuTaskOptions {
  timeoutMs?: number;
  parent?: any;
  /** Storage acknowledgement waits for the Task's observed natural completion. */
  waitForCompletion?: boolean;
}

export interface RokuTaskHandle<T> {
  cancel(): void;
  result: Promise<T>;
}

export function postRokuTask<T = any>(
  request: WorkerRequest,
  options: RokuTaskOptions = {},
): RokuTaskHandle<T> {
  const parent = options.parent || (globalThis as any).__solidtvNativeRoot || null;
  let settled = false;
  let task: any = null;
  let timer: any = null;
  const natural = request.op === "storage" && options.waitForCompletion === true;
  let runObserved = false,
    terminalAfterRun = false;
  let responseReceived = false,
    pendingResponse: WorkerResponse<T> | undefined;

  let resolveResult!: (value: T) => void;
  let rejectResult!: (reason?: any) => void;
  const result = new Promise<T>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  const cleanup = (stop = true) => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (task && parent) {
      try {
        if (stop) setProp(task, "control", "STOP");
        tmTransaction.removeNode(parent, task);
      } catch (error) {
        // The task may already have been removed by a route teardown.
      }
    }
    task = null;
  };

  const finish = (fn: () => void, stop = true) => {
    if (settled) return;
    settled = true;
    cleanup(stop);
    fn();
  };

  if (!parent) {
    finish(() => rejectResult(new Error("WorkerTask: no SceneGraph root")));
    return { cancel: () => {}, result };
  }

  try {
    task = createElement("WorkerTask");
    const completeResponse = () => {
      if (!responseReceived || (natural && !terminalAfterRun)) return;
      const response = pendingResponse;
      if (response?.ok === false) {
        finish(
          () => rejectResult(new RokuTaskResponseError(response.error || "WorkerTask failed")),
          !natural,
        );
      } else {
        finish(() => resolveResult(response?.result as T), !natural);
      }
    };
    setProp(task, "request", request);
    if (natural)
      setProp(task, "onState", (value: string) => {
        const state = String(value).toLowerCase();
        if (state === "run") {
          runObserved = true;
          terminalAfterRun = false;
        } else if (runObserved && (state === "stop" || state === "done")) terminalAfterRun = true;
        completeResponse();
      });
    setProp(task, "onResponse", (response: WorkerResponse<T>) => {
      if (!response || (response.ok !== true && response.ok !== false)) {
        finish(() => rejectResult(new Error("WorkerTask failed")));
        return;
      }
      responseReceived = true;
      pendingResponse = response;
      completeResponse();
    });
    insertNode(parent, task);
    setProp(task, "control", "RUN");
  } catch (error) {
    finish(() => rejectResult(error));
    return { cancel: () => {}, result };
  }

  const timeoutMs = Math.max(1, options.timeoutMs ?? 10000);
  if (!settled)
    timer = setTimeout(() => {
      finish(() => rejectResult(new Error(`WorkerTask timed out after ${timeoutMs}ms`)));
    }, timeoutMs);

  return {
    result,
    cancel: () => finish(() => rejectResult(new Error("WorkerTask cancelled"))),
  };
}
