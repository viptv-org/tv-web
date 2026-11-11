import { postRokuTask, RokuTaskResponseError, type WorkerRequest } from './worker-task';

let operations: Promise<void> = Promise.resolve();
let uncertain: Error | undefined;

/** Use the BrightScript section's Flush, rather than the SDK Registry cache. */
export function deviceStorage(section: string, key: string) {
  const execute = (request: WorkerRequest): Promise<string | null> => {
    const operation = operations.then(async () => {
      if (uncertain) throw uncertain;
      try {
        return await postRokuTask<string | null>(request, { timeoutMs: 5000 }).result;
      } catch (error) {
        // STOP is requested on timeout/cancellation, but its completion is not
        // acknowledged. Do not allow a later clear/write to race that Task.
        // An explicit response means the worker finished its storage effects.
        if (!(error instanceof RokuTaskResponseError))
          uncertain = new Error('Device storage did not finish. Relaunch the app to retry.');
        throw error;
      }
    });
    operations = operation.then(() => {}, () => {});
    return operation;
  };
  return {
    load: () => execute({ op: 'storage', action: 'load', section, key }),
    async save(value: string) { await execute({ op: 'storage', action: 'save', section, key, value }); },
    async clear() { await execute({ op: 'storage', action: 'clear', section, key }); },
  };
}
