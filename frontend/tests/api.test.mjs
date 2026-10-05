import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/services/api.js", import.meta.url), "utf8");
let instance = 0;
async function setup({ storageBlocked = false, writeBlocked = false, apiUrl = "" } = {}) {
  const values = new Map();
  const target = new EventTarget();
  Object.assign(target, {
    location: { protocol: "http:", hostname: "localhost", origin: "http://localhost:5173" },
    sessionStorage: {
      getItem(key) { if (storageBlocked) throw new Error("blocked"); return values.get(key) ?? null; },
      setItem(key, value) { if (storageBlocked || writeBlocked) throw new Error("blocked"); values.set(key, value); },
      removeItem(key) { if (storageBlocked) throw new Error("blocked"); values.delete(key); },
    },
    setTimeout, clearTimeout,
  });
  globalThis.window = target;
  const code = source.replace("import.meta.env.VITE_API_URL", JSON.stringify(apiUrl));
  const api = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}#${++instance}`);
  return { api, target, values };
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

test("admin login/logout works when browser storage reads or writes are blocked", async () => {
  for (const options of [{ storageBlocked: true }, { writeBlocked: true }]) {
    const { api } = await setup(options);
    globalThis.fetch = async () => json({ token: "ephemeral-token", expires_in: 300 });
    await api.loginAdmin("secret");
    assert.equal(api.getAdminSessionToken(), "ephemeral-token");
    await api.logoutAdmin();
    assert.equal(api.hasAdminSession(), false);
  }
});

test("a late 401 from an older session cannot log out a newly authenticated session", async () => {
  const { api, values, target } = await setup();
  values.set("inventory-admin-session", "old-token");
  let finishOld;
  let authEvents = 0;
  target.addEventListener("inventory-auth-required", () => authEvents++);
  globalThis.fetch = async url => url.endsWith("/auth/login") ? json({ token: "new-token" }) : new Promise(resolve => { finishOld = resolve; });
  const pending = api.getDevices();
  await api.loginAdmin("secret");
  finishOld(json({ detail: "expired" }, 401));
  await assert.rejects(pending, error => error.status === 401);
  assert.equal(api.getAdminSessionToken(), "new-token");
  assert.equal(authEvents, 0);
});

test("public requests omit saved credentials; private requests use bearer without cookies", async () => {
  const { api, values } = await setup({ apiUrl: "/api" });
  values.set("inventory-admin-session", "private-token");
  const requests = [];
  globalThis.fetch = async (url, options) => { requests.push({ url, options }); return json([]); };
  await api.getPublicCatalog("page=1");
  await api.getDevices();
  assert.equal(requests[0].url, "http://localhost:5173/api/public/assets/catalog?page=1");
  assert.equal(requests[0].options.headers.Authorization, undefined);
  assert.equal(requests[1].options.headers.Authorization, "Bearer private-token");
  assert.equal(requests[1].options.credentials, "omit");
  assert.equal(requests[1].options.cache, "no-store");
  assert.equal(requests[1].options.headers["Content-Type"], undefined);
});

test("relative API bases resolve consistently on nested routes and storage fallback preserves a restored session", async () => {
  const { api, values, target } = await setup({ apiUrl: "api" });
  target.location.pathname = "/catalog/DEV-00001";
  values.set("inventory-admin-session", "restored-token");
  assert.equal(api.getAdminSessionToken(), "restored-token");
  target.sessionStorage.getItem = () => { throw new Error("now blocked"); };
  assert.equal(api.getAdminSessionToken(), "restored-token");
  let requestUrl;
  globalThis.fetch = async url => { requestUrl = url; return json([]); };
  await api.getDevices();
  assert.equal(requestUrl, "http://localhost:5173/api/devices/");
  assert.equal(api.mediaUrl("/uploads/devices/1/a.png"), "http://localhost:5173/api/uploads/devices/1/a.png");
});

test("expired current session is cleared and validation errors remain readable", async () => {
  const { api, values, target } = await setup();
  values.set("inventory-admin-session", "expired-token");
  let required = 0;
  target.addEventListener("inventory-auth-required", () => required++);
  globalThis.fetch = async () => json({ detail: "expired" }, 401);
  await assert.rejects(api.getDevices(), /expired/);
  assert.equal(api.hasAdminSession(), false);
  assert.equal(required, 1);
  globalThis.fetch = async () => json({ detail: [{ loc: ["body", "name"], msg: "required" }] }, 422);
  await assert.rejects(api.createDevice({}), /name: required/);
});

test("cancelled public navigation does not falsely announce a network failure", async () => {
  const { api, target } = await setup();
  const statuses = [];
  target.addEventListener("inventory-connection", event => statuses.push(event.detail.status));
  globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), { once: true });
  });
  const controller = new AbortController();
  const pending = api.getCatalogAsset("DEV-00001", controller.signal);
  controller.abort();
  await assert.rejects(pending, error => error.name === "AbortError");
  assert.deepEqual(statuses, []);
});

test("HTML API misconfiguration, transport errors and unsafe media URLs are rejected", async () => {
  const { api, target } = await setup();
  const statuses = [];
  target.addEventListener("inventory-connection", event => statuses.push(event.detail.status));
  globalThis.fetch = async () => new Response("<html>SPA fallback</html>", { status: 200 });
  await assert.rejects(api.getPublicCatalog(""), /răspuns invalid/);
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(api.getDevices(), /Conexiunea cu serverul/);
  assert.deepEqual(statuses, ["offline", "offline"]);
  for (const path of ["javascript:alert(1)", "data:text/html,test", "https://user:secret@host/photo.jpg"]) assert.equal(api.mediaUrl(path), "");
  assert.equal(api.mediaUrl("/uploads/devices/1/a.png"), "http://localhost:8000/uploads/devices/1/a.png");
});

test("request deadlines release the UI without automatically retrying a mutation", async () => {
  const { api, target } = await setup();
  let deadline;
  let calls = 0;
  target.setTimeout = callback => { deadline = callback; return 1; };
  target.clearTimeout = () => {};
  globalThis.fetch = async (_url, options) => {
    calls++;
    return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("timeout", "AbortError"))));
  };
  const pending = api.createDevice({ name: "Camera" });
  deadline();
  await assert.rejects(pending, /Verifică rezultatul operației/);
  assert.equal(calls, 1);
});

test("LDAP login sends the username; local login and method discovery stay anonymous", async () => {
  const { api, values } = await setup();
  values.set("inventory-admin-session", "saved-token");
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return url.endsWith("/auth/methods") ? json({ password: true, ldap: true }) : json({ token: `token-${requests.length}` });
  };
  assert.deepEqual(await api.getLoginMethods(), { password: true, ldap: true });
  await api.loginAdmin("ldap-secret", "ana");
  await api.loginAdmin("local-secret");
  assert.equal(requests[0].options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(requests[1].options.body), { username: "ana", password: "ldap-secret" });
  assert.deepEqual(JSON.parse(requests[2].options.body), { password: "local-secret" });
  assert.equal(requests[1].options.headers.Authorization, undefined);
  assert.equal(api.getAdminSessionToken(), "token-3");
});
