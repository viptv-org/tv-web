import { expect, it, vi } from "vitest";
import type { Overlay } from "../../src/tv-solid/remote/app-types";
import type { HouseholdSettings } from "../../src/tv-solid/remote/settings/ports";
import { createAddonSettings } from "../../src/tv-solid/remote/settings/addons";
import { createIntegrationSettings } from "../../src/tv-solid/remote/settings/integrations";

function setup(mayWrite: boolean, reads: Record<string, unknown>) {
  let overlay: Overlay | undefined;
  const writes: {path: string; method: string; body: unknown}[] = [];
  const signals: (AbortSignal | undefined)[] = [];
  const prompt: {submit?: (text: string) => Promise<void>} = {};
  const order: string[] = [];
  const options: HouseholdSettings = {
    request: async <T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> => {
      if (method === "GET") {signals.push(signal);return reads[path] as T;}
      writes.push({path, method, body});order.push(method);return {} as T;
    },
    path: path => `/profile${path}`, mayWrite: async () => mayWrite,
    dialogs: {open: value => {overlay = value;}, close: () => {order.push("close");}, dismiss: vi.fn()},
    prompt: (_title, submit) => {prompt.submit = submit;}, notify: vi.fn(),
    reload: async () => {order.push("reload");},
  };
  return {options, writes, signals, prompt, order, items: () => {
    if (overlay?.kind !== "choices" && overlay?.kind !== "confirm") throw new Error("Expected item dialog");
    return overlay.items;
  }};
}

it("a paired device can toggle an installed add-on without gaining household forms", async () => {
  const fixture = setup(false, {"/api/addons?limit=200": {items: [{id: 7, name: "Fixture"}]},
    "/profile/addon-activation": {addons: [{connection_id: "addon:7", enabled: false}]}});
  const signal = new AbortController().signal;
  const rows = await createAddonSettings(fixture.options)(signal);
  expect(fixture.signals).toEqual([signal, signal]);
  await rows[0].run();
  expect(fixture.options.notify).toHaveBeenCalled();
  expect(fixture.prompt.submit).toBeUndefined();
  await rows[1].run();
  expect(fixture.items().map(item => item.id)).toEqual(["enabled"]);
  await fixture.items()[0].run();
  expect(fixture.writes).toEqual([{path: "/profile/addon-activation", method: "PUT", body: {connection_id: "addon:7", enabled: true}}]);
  expect(fixture.order).toEqual(["PUT", "close", "reload"]);
});

it("integration fields stay draft-only until a revisioned save, then close before reload", async () => {
  const fixture = setup(true, {"/profile/source-integrations": {revision: 17, schemas: [{
    plugin_id: "fixture", name: "Fixture", state: "Ready", runtime_enabled: true, connection_id: "saved/one",
    credential_fields: [{id: "token", label: "Fixture credential", secret: true}], provider_choices: [], maximum_providers: 1,
  }]}});
  const signal = new AbortController().signal;
  const rows = await createIntegrationSettings(fixture.options)(signal);
  expect(fixture.signals).toEqual([signal]);
  await rows[0].run();
  await fixture.items().find(item => item.id === "token")!.run();
  await fixture.prompt.submit!("fixture-value");
  expect(fixture.writes).toEqual([]);
  await fixture.items().find(item => item.id === "save")!.run();
  expect(fixture.writes).toEqual([{path: "/profile/source-integrations", method: "PUT", body: {
    revision: 17, plugin_id: "fixture", configuration: {token: "fixture-value"},
  }}]);
  expect(fixture.order).toEqual(["PUT", "close", "reload"]);
});
