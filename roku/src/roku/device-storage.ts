import { getRegistry } from '@roku-sdk/rsg-ts/runtime';
import type { Registry } from '@roku-sdk/interfaces';

let pendingRegistry: Promise<Registry> | undefined;
let writes: Promise<void> = Promise.resolve();
function deadline<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([operation, new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Device storage did not respond.')), 5000);
  })]).finally(() => clearTimeout(timer));
}
function registry() {
  return pendingRegistry ??= deadline(getRegistry()).catch(error => { pendingRegistry = undefined;throw error; });
}
export function deviceStorage(sectionName: string, key: string) {
  const update = (value: string | null) => {
    const operation = writes.catch(() => {}).then(async () => {
      const owner = await registry(), section = owner.create(sectionName);
      if (value === null) {
        if (!section.exists(key)) return;
        if (!section.delete(key)) throw new Error('Device settings could not be removed.');
      } else if (!section.write(key, value)) throw new Error('Device settings could not be saved.');
      if (!await deadline(owner.flush())) throw new Error('Device settings could not be saved.');
    });
    writes = operation;return operation;
  };
  return {
    async load() { await writes.catch(() => {});return (await registry()).create(sectionName).read(key); },
    save: (value: string) => update(value),
    clear: () => update(null),
  };
}
