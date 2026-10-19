import assert from "node:assert/strict";
import test from "node:test";
import axios from "axios";
import { createApiClient, isAuthFreeRequest } from "./client.js";
import { normalizeApiBaseURL } from "./config.js";
import { createSessionStorage } from "./session.js";
import { mergeById, readPage } from "./contracts.js";

const makeSession = () => {
  const values = new Map([["token", "old"], ["refreshToken", "refresh"]]);
  return createSessionStorage({
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
};
const response = (config, data) => ({ config, data, status: 200, headers: {}, statusText: "OK" });
const denied = (config, status = 401) => {
  throw new axios.AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, {}, { status, data: {} });
};

test("base URL normalization preserves same-origin and configured API roots", () => {
  for (const [input, expected] of [[undefined, "/api/"], ["/", "/api/"], ["/api/", "/api/"],
    [" https://example.test/ ", "https://example.test/api/"], ["https://example.test/api", "https://example.test/api/"]]) {
    assert.equal(normalizeApiBaseURL(input), expected);
  }
});

test("auth paths are matched without accidentally exempting unrelated requests", () => {
  assert.equal(isAuthFreeRequest({ url: "users/login/" }), true);
  assert.equal(isAuthFreeRequest({ url: "https://example.test/api/users/register/?x=1" }), true);
  assert.equal(isAuthFreeRequest({ url: "users/profile/?redirect=/users/login/" }), false);
  assert.equal(isAuthFreeRequest({ skipAuth: true }), true);
});

test("public auth requests never send stored or explicit access credentials", async () => {
  const client = createApiClient({ baseURL: "/api/", session: makeSession(), adapter: async (config) => {
    assert.equal(config.headers.get("Authorization"), undefined);
    return response(config, {});
  } });
  await client.post("users/register/", {}, { headers: { Authorization: "Bearer wrong" } });
});

test("concurrent unauthorized requests share one refresh and replay successfully", async () => {
  const session = makeSession();
  let refreshes = 0;
  const client = createApiClient({ baseURL: "/api/", session,
    adapter: async (config) => config.headers.get("Authorization") === "Bearer new"
      ? response(config, { ok: true }) : denied(config),
    refreshAdapter: async (config) => {
      refreshes += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return response(config, { access: "new" });
    },
  });
  const results = await Promise.all([client.get("media/feed/"), client.get("users/profile/"), client.get("users/messages/")]);
  assert.equal(refreshes, 1);
  assert.equal(results.every(({ data }) => data.ok), true);
  assert.equal(session.getAccess(), "new");
});

test("public login failures never refresh or expire an existing session", async () => {
  const session = makeSession();
  const client = createApiClient({ baseURL: "/api/", session, adapter: async (config) => denied(config),
    refreshAdapter: () => assert.fail("must not refresh"), onSessionExpired: () => assert.fail("must not redirect") });
  await assert.rejects(client.post("users/login/"));
  assert.equal(session.getAccess(), "old");
});

test("invalid refresh credentials clear the session once for concurrent requests", async () => {
  const session = makeSession();
  let expired = 0;
  const client = createApiClient({ baseURL: "/api/", session, onSessionExpired: () => { expired += 1; },
    adapter: async (config) => denied(config), refreshAdapter: async (config) => denied(config) });
  await Promise.allSettled([client.get("users/profile/"), client.get("media/feed/")]);
  assert.equal(expired, 1);
  assert.equal(session.getAccess(), null);
  assert.equal(session.getRefresh(), null);
});

test("refresh network failures preserve credentials", async () => {
  const session = makeSession();
  const client = createApiClient({ baseURL: "/api/", session, adapter: async (config) => denied(config),
    refreshAdapter: async () => { throw new Error("offline"); } });
  await assert.rejects(client.get("users/profile/"), /offline/);
  assert.equal(session.getRefresh(), "refresh");
});

test("in-flight refresh cannot resurrect a logged-out session", async () => {
  const session = makeSession();
  const client = createApiClient({ baseURL: "/api/", session, adapter: async (config) => denied(config),
    refreshAdapter: async (config) => { session.clear(); return response(config, { access: "new" }); } });
  await assert.rejects(client.get("users/profile/"), /Session changed/);
  assert.equal(session.getAccess(), null);
});

test("pages accept legacy arrays and cursor envelopes and merge repeated IDs", () => {
  assert.deepEqual(readPage([{ id: 1 }]), { items: [{ id: 1 }], next: null });
  assert.deepEqual(readPage({ results: [{ id: 2 }], next: "/next" }), { items: [{ id: 2 }], next: "/next" });
  assert.deepEqual(mergeById([{ id: 1, text: "old" }], [{ id: 1, text: "new" }, { id: 2 }]), [{ id: 1, text: "new" }, { id: 2 }]);
});
