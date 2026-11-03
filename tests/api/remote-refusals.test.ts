import { expect, it, vi } from "vitest";
import { RemoteTvApi, type SessionStore } from "../../src/tv-solid/remote/api";
import {
  ACCOUNT_SESSION_REQUIRED,
  NOT_AVAILABLE,
  OWNER_REQUIRED,
  PARENT_PIN_REQUIRED,
} from "../../src/tv-solid/remote/refusals";
import type { Tokens } from "../../src/tv-solid/remote/types";

const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function store(
  initial: Tokens | null = { accessToken: "access", refreshToken: "refresh" },
) {
  let value = initial;
  return {
    load: vi.fn(async () => value),
    save: vi.fn(async (tokens: Tokens) => {
      value = tokens;
    }),
    clear: vi.fn(async () => {
      value = null;
    }),
  } satisfies SessionStore;
}

function apiFor(fetcher: typeof fetch, session = store()) {
  const api = new RemoteTvApi("https://example.test", session, fetcher);
  api.profile = "1";
  return { api, session };
}

/** The add-on write the shipped TV UI issues without asking for a PIN first. */
const installAddon = () =>
  ({ manifest_url: "https://addons.test/manifest.json" }) as object;

it("answers an add-on write refused for a device session with the account-session remedy, never a parent-PIN prompt", async () => {
  const fetcher = vi.fn(async () =>
    response(
      {
        error: "Manage account settings from an account session, not a paired TV.",
        error_code: "account_session_required",
      },
      403,
    ),
  );
  const { api } = apiFor(fetcher);

  const refused = api.call("/api/addons", "POST", installAddon());

  await expect(refused).rejects.toMatchObject({
    status: 403,
    code: "account_session_required",
    message: ACCOUNT_SESSION_REQUIRED,
  });
  await expect(refused).rejects.not.toMatchObject({
    message: PARENT_PIN_REQUIRED,
  });
  expect(fetcher).toHaveBeenCalledOnce();
});

it("keeps the parent-PIN prompt for the refusals a PIN can actually clear", async () => {
  for (const code of [
    "parent_required",
    "parent_pin_invalid",
    "parent_pin_incorrect",
  ]) {
    const { api } = apiFor(
      vi.fn(async () => response({ error: "Parent PIN required", error_code: code }, 403)),
    );
    await expect(api.call("/api/addons/4", "DELETE")).rejects.toMatchObject({
      status: 403,
      code,
      message: PARENT_PIN_REQUIRED,
    });
  }
});

it("separates a non-owner account session from a device session", async () => {
  const { api } = apiFor(
    vi.fn(async () =>
      response(
        {
          error: "Only the account owner can change household settings.",
          error_code: "owner_required",
        },
        403,
      ),
    ),
  );

  const refused = api.call("/api/profiles/1/source-integrations/remove", "DELETE");

  await expect(refused).rejects.toMatchObject({ message: OWNER_REQUIRED });
  await expect(refused).rejects.not.toMatchObject({
    message: PARENT_PIN_REQUIRED,
  });
});

it("does not promise a PIN for a refusal it cannot explain", async () => {
  const { api } = apiFor(
    vi.fn(async () => response({ error: "Forbidden", error_code: "forbidden" }, 403)),
  );

  await expect(
    api.call("/api/profiles/1/kids", "PUT", { enabled: true, max_age: 12 }),
  ).rejects.toMatchObject({ status: 403, message: NOT_AVAILABLE });
});

it("reads the household-write capability from the one identity route a device session may call", async () => {
  const fetcher = vi.fn(async (_input: RequestInfo | URL) =>
    response({ capabilities: { manage_account: false }, role: "device" }),
  );
  const { api } = apiFor(fetcher, store(null));

  await expect(api.manageAccount()).resolves.toBe(false);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls[0][0]).toBe("https://example.test/api/auth/me");
});

it("reports the capability as unknown instead of inventing one", async () => {
  const missing = apiFor(
    vi.fn(async () => response({ role: "device" })),
    store(null),
  );
  await expect(missing.api.manageAccount()).resolves.toBeUndefined();

  const refused = apiFor(
    vi.fn(async () => response({ error: "Forbidden" }, 403)),
    store(null),
  );
  await expect(refused.api.manageAccount()).resolves.toBeUndefined();
});

it("asks once per grant and asks again after a new pairing", async () => {
  const fetcher = vi.fn(async (_input: RequestInfo | URL) =>
    response({ capabilities: { manage_account: true } }),
  );
  const { api } = apiFor(fetcher, store(null));

  await api.manageAccount();
  await api.manageAccount();
  expect(fetcher).toHaveBeenCalledOnce();

  fetcher.mockImplementation(async (input: RequestInfo | URL) =>
    String(input).endsWith("/api/auth/device/token")
      ? response({ access_token: "next", refresh_token: "next-refresh" })
      : response({ capabilities: { manage_account: true } }),
  );
  await api.claim("device-code");
  await api.manageAccount();
  expect(fetcher).toHaveBeenCalledTimes(3);
});