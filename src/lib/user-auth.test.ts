import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { authFetch, currentUser, getIdToken, isOwnApi, signIn, signOut, signUp, WEAK_PASSWORD } from "./user-auth.ts";

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function mockFetch(handler: (url: string, init: RequestInit) => Response) {
  globalThis.fetch = (async (u: string | URL | Request, init: RequestInit = {}) => {
    const url = String(u);
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
}
const ok = (expiresIn = "3600") => reply(200, { localId: "u1", email: "a@b.co", idToken: "tok1", refreshToken: "r1", expiresIn });

describe("user-auth (Firebase REST)", () => {
  beforeEach(() => {
    calls = [];
    signOut();
  });

  it("UT-AUTH-01 ورود: درخواست درست به Identity Toolkit و نگه‌داری کاربر", async () => {
    mockFetch(() => ok());
    const u = await signIn(" a@b.co ", "secret1");
    assert.deepEqual(u, { uid: "u1", email: "a@b.co" });
    assert.match(calls[0].url, /identitytoolkit\.googleapis\.com\/v1\/accounts:signInWithPassword\?key=/);
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { email: "a@b.co", password: "secret1", returnSecureToken: true });
    assert.deepEqual(currentUser(), { uid: "u1", email: "a@b.co" });
    assert.equal(await getIdToken(), "tok1");
  });

  it("UT-AUTH-02 خطاهای Firebase به فارسی", async () => {
    mockFetch(() => reply(400, { error: { message: "INVALID_LOGIN_CREDENTIALS" } }));
    await assert.rejects(signIn("a@b.co", "x"), /ایمیل یا رمز درست نیست/);
    mockFetch(() => reply(400, { error: { message: "WEAK_PASSWORD : Password should be at least 6 characters" } }));
    await assert.rejects(signUp("a@b.co", "1234567"), new RegExp(WEAK_PASSWORD));
    await assert.rejects(signUp("a@b.co", "123"), new RegExp(WEAK_PASSWORD));
    assert.equal(currentUser(), null);
  });

  it("UT-AUTH-03 توکن نزدیک انقضا با securetoken تمدید می‌شود؛ refresh باطل = خروج", async () => {
    mockFetch(() => ok("60")); // کمتر از ۵ دقیقه مانده
    await signIn("a@b.co", "secret1");
    mockFetch((url) => (url.includes("securetoken") ? reply(200, { id_token: "tok2", refresh_token: "r2", expires_in: "3600", user_id: "u1" }) : reply(500, {})));
    const [t1, t2] = await Promise.all([getIdToken(), getIdToken()]);
    assert.equal(t1, "tok2");
    assert.equal(t2, "tok2");
    assert.equal(calls.filter((c) => c.url.includes("securetoken")).length, 1, "دو درخواست هم‌زمان = یک تمدید");
    assert.equal(new URLSearchParams(String(calls.at(-1)!.init.body)).get("refresh_token"), "r1");

    mockFetch(() => ok("60"));
    await signIn("a@b.co", "secret1");
    mockFetch(() => reply(400, { error: { message: "TOKEN_EXPIRED" } }));
    assert.equal(await getIdToken(), null);
    assert.equal(currentUser(), null);
  });

  it("UT-AUTH-04 authFetch توکن را فقط به سرور خود BEHIX می‌فرستد", async () => {
    mockFetch(() => ok());
    await signIn("a@b.co", "secret1");
    calls = [];
    mockFetch(() => reply(200, {}));
    await authFetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" } });
    const h = new Headers(calls[0].init.headers);
    assert.equal(h.get("authorization"), "Bearer tok1");
    assert.equal(h.get("content-type"), "application/json");
    await authFetch("https://storage.googleapis.com/x/y.wav");
    assert.equal(new Headers(calls[1].init.headers).get("authorization"), null);
    signOut();
    await authFetch("/api/tts");
    assert.equal(new Headers(calls[2].init.headers).get("authorization"), null);
  });

  it("UT-AUTH-05 isOwnApi", () => {
    assert.equal(isOwnApi("/api/voice", "", ""), true);
    assert.equal(isOwnApi("//evil.com/x", "", ""), false);
    assert.equal(isOwnApi("https://behix.run.app/api/tts", "https://behix.run.app", ""), true);
    assert.equal(isOwnApi("https://evil.com/api/tts", "https://behix.run.app", "https://behix.run.app"), false);
    assert.equal(isOwnApi("https://site.com/api", "", "https://site.com"), true);
  });
});
