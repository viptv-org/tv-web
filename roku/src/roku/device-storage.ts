import { postRokuTask, RokuTaskResponseError, type WorkerRequest } from './worker-task';

export interface JsonDeviceStorage<T> {
  load(): Promise<T | null>;
  save(value: T): Promise<void>;
  clear(): Promise<void>;
}

type StorageOperation = {
  operation: number;
  category: 'session' | 'playback' | 'other';
  action: 'load' | 'save' | 'clear';
};
type StorageStep = 'read' | 'prepare' | 'commit';
type StoragePhase = 'storage-start' | 'storage-step' | 'storage-complete' | 'storage-failed';
type StorageStatus = 'started' | 'ack' | 'blocked' | 'uncertain' | 'known-failure' | 'error';
let operations: Promise<void> = Promise.resolve();
let uncertain = false;
let sequence = 0;

function context(section: string, action: StorageOperation['action']): StorageOperation {
  return {
    operation: ++sequence,
    category:
      section === 'viptv-session' ? 'session' : section === 'viptv-playback' ? 'playback' : 'other',
    action,
  };
}

function observe(
  operation: StorageOperation,
  phase: StoragePhase,
  status: StorageStatus,
  step?: StorageStep,
): void {
  const g = globalThis as any;
  const observer = g.__solidtvRuntimeObserver;
  if (typeof observer !== 'function') return;
  try {
    observer({
      ...operation,
      phase,
      status,
      ...(step ? { step } : {}),
      at: g.performance?.now?.() ?? Date.now(),
    });
  } catch {
    /* Local observation cannot affect storage. */
  }
}

function serialized<T>(context: StorageOperation, work: () => Promise<T>): Promise<T> {
  const operation = operations.then(async () => {
    if (uncertain) {
      observe(context, 'storage-failed', 'blocked');
      throw new Error('Device storage did not finish. Relaunch the app to retry.');
    }
    observe(context, 'storage-start', 'started');
    try {
      const result = await work();
      observe(context, 'storage-complete', 'ack');
      return result;
    } catch (error) {
      observe(
        context,
        'storage-failed',
        uncertain
          ? 'uncertain'
          : error instanceof RokuTaskResponseError
            ? 'known-failure'
            : 'error',
      );
      throw error;
    }
  });
  operations = operation.then(
    () => {},
    () => {},
  );
  return operation;
}

async function native(
  request: Extract<WorkerRequest, { op: 'storage' }>,
  context: StorageOperation,
  step: StorageStep,
): Promise<string | null> {
  try {
    const result =
      (await postRokuTask<string | null>(request, { timeoutMs: 5000, waitForCompletion: true })
        .result) ?? null;
    observe(context, 'storage-step', 'ack', step);
    return result;
  } catch (error) {
    // A requested STOP is not a completion acknowledgement. Keep a late Task
    // from racing any later save/clear, including one on another section.
    if (!(error instanceof RokuTaskResponseError)) uncertain = true;
    throw error;
  }
}

function encode(value: unknown): string {
  try {
    const result = JSON.stringify(value);
    if (typeof result === 'string') return result;
  } catch {
    /* report no record contents */
  }
  throw new Error('Device settings could not be encoded.');
}

/** JSON values only: representations may differ while logical contents agree. */
export function jsonDeviceStorage<T>(section: string, key: string): JsonDeviceStorage<T> {
  const read = async (context: StorageOperation) => {
    const raw = await native({ op: 'storage', action: 'load', section, key }, context, 'read');
    if (raw !== null && typeof raw !== 'string')
      throw new Error('Device settings could not be read.');
    return raw;
  };
  const commit = (canonical: string, action: 'save' | 'clear') => {
    const operation = context(section, action);
    return serialized(operation, async () => {
      const current = await read(operation);
      // Both writes contain the NEW JSON value. A retry may find the previous
      // preparation visible, so choose another equivalent representation then.
      const first = ' ' + canonical;
      const prepared = current === first ? '  ' + canonical : first;
      await native(
        { op: 'storage', action: 'save', section, key, value: prepared },
        operation,
        'prepare',
      );
      await native(
        { op: 'storage', action: 'save', section, key, value: canonical },
        operation,
        'commit',
      );
    });
  };
  return {
    load: () => {
      const operation = context(section, 'load');
      return serialized(operation, async () => {
        const raw = await read(operation);
        if (!raw) return null;
        try {
          return JSON.parse(raw) as T | null;
        } catch {
          throw new Error('Device settings could not be read.');
        }
      });
    },
    async save(value) {
      const canonical = encode(value);
      await commit(canonical, 'save');
    },
    clear: () => commit('null', 'clear'),
  };
}

/** Canonicalize before callers apply byte limits to a JSON string representation. */
export function jsonStringPort(store: JsonDeviceStorage<unknown>) {
  return {
    async load(): Promise<string | null> {
      const value = await store.load();
      return value === null ? null : encode(value);
    },
    async save(value: string): Promise<void> {
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        throw new Error('Device settings could not be encoded.');
      }
      await store.save(parsed);
    },
  };
}
