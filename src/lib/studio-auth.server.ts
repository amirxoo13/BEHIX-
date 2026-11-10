/**
 * احراز هویت API پولی استودیو (فقط سرور).
 *
 * هر درخواست باید «Authorization: Bearer <Firebase ID token>» داشته باشد. توکن طبق مستند رسمی
 * Firebase («Verify ID tokens using a third-party JWT library») بررسی می‌شود:
 *   alg = RS256، kid از کلیدهای عمومی securetoken، aud = شناسهٔ پروژه، iss = https://securetoken.google.com/<پروژه>،
 *   exp آینده، iat و auth_time گذشته، sub غیرخالی (= uid کاربر).
 * App Check (اختیاری/اجباری): هدر X-Firebase-AppCheck با JWKS رسمی App Check، RS256، typ=JWT،
 *   iss = https://firebaseappcheck.googleapis.com/<شمارهٔ پروژه>، aud شامل projects/<شمارهٔ پروژه>.
 *
 * پیکربندی فقط از متغیر محیطی (بدون کلید یا راز؛ کلیدهای عمومی گوگل خوانده می‌شوند):
 *   FIREBASE_PROJECT_ID       شناسهٔ پروژهٔ Firebase (لازم؛ بدون آن همهٔ درخواست‌ها رد می‌شوند = fail closed)
 *   FIREBASE_PROJECT_NUMBER   شمارهٔ پروژه (برای App Check)
 *   STUDIO_APP_CHECK          off | verify (پیش‌فرض: اگر هدر آمد بررسی کن) | enforce (هدر اجباری)
 *   STUDIO_DEV_AUTH_BYPASS=1  فقط توسعهٔ محلی: کاربر «dev-local» بدون توکن. وقتی NODE_ENV=production است
 *                             یا روی سرور مستقر (K_SERVICE، VERCEL، GROK_PROJECT_ID) هستیم، نادیده گرفته می‌شود.
 */
import { createHash } from "node:crypto";
import { createRemoteJWKSet, importX509, jwtVerify, type JWTPayload, type JWTVerifyGetKey, type CryptoKey, type KeyObject } from "jose";

export type AppCheckMode = "off" | "verify" | "enforce";
export type StudioAuthConfig = {
  projectId: string | null;
  projectNumber: string | null;
  appCheck: AppCheckMode;
  /** فقط وقتی true است که هم پرچم روشن باشد و هم محیط تولید نباشد. */
  devBypass: boolean;
};
export type StudioUser = { uid: string; appId: string | null; dev: boolean };
export type AuthResult = { ok: true; user: StudioUser } | { ok: false; status: 401 | 403 | 503; message: string };

export const DEV_UID = "dev-local";
export const ID_TOKEN_CERTS = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
export const APP_CHECK_JWKS = "https://firebaseappcheck.googleapis.com/v1/jwks";
const SKEW = 60; // ثانیه، برای اختلاف ساعت

const clean = (v: string | undefined) => v?.trim() || null;

/** آیا این فرایند روی سرور مستقر/تولید اجرا می‌شود؟ (در این حالت میان‌بُر توسعه هرگز فعال نیست.) */
export function isProductionEnv(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === "production" || Boolean(clean(env.K_SERVICE) || clean(env.VERCEL) || clean(env.GROK_PROJECT_ID));
}

export function studioAuthConfig(env: Record<string, string | undefined> = process.env): StudioAuthConfig {
  const mode = clean(env.STUDIO_APP_CHECK)?.toLowerCase();
  return {
    projectId: clean(env.FIREBASE_PROJECT_ID),
    projectNumber: clean(env.FIREBASE_PROJECT_NUMBER),
    appCheck: mode === "off" || mode === "enforce" ? mode : "verify",
    devBypass: env.STUDIO_DEV_AUTH_BYPASS === "1" && !isProductionEnv(env),
  };
}

/* ---------- کلیدهای عمومی ---------- */

type Key = CryptoKey | KeyObject;
let certs: { until: number; keys: Map<string, Key> } | null = null;
let certsPending: Promise<Map<string, Key>> | null = null;

async function loadCerts(fetchImpl: typeof fetch): Promise<Map<string, Key>> {
  const r = await fetchImpl(ID_TOKEN_CERTS, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`id-token certs ${r.status}`);
  const pems = (await r.json()) as Record<string, string>;
  const keys = new Map<string, Key>();
  for (const [kid, pem] of Object.entries(pems)) keys.set(kid, await importX509(pem, "RS256"));
  // طبق مستند: زمان تازه‌سازی از max-age هدر Cache-Control
  const maxAge = Number(/max-age=(\d+)/.exec(r.headers.get("cache-control") ?? "")?.[1] ?? 3600);
  certs = { until: Date.now() + Math.min(Math.max(maxAge, 60), 24 * 3600) * 1000, keys };
  return keys;
}

/** کلید امضای توکن‌های Firebase Auth بر اساس kid (کش‌شده). */
export function firebaseIdTokenKeys(fetchImpl: typeof fetch = fetch): JWTVerifyGetKey {
  return async (header) => {
    let keys = certs && certs.until > Date.now() ? certs.keys : null;
    if (!keys || (header.kid && !keys.has(header.kid))) {
      certsPending ??= loadCerts(fetchImpl).finally(() => { certsPending = null; });
      keys = await certsPending;
    }
    const k = header.kid ? keys.get(header.kid) : undefined;
    if (!k) throw new Error("unknown kid");
    return k;
  };
}

let appCheckJwks: JWTVerifyGetKey | null = null;
const appCheckKeys = (): JWTVerifyGetKey => (appCheckJwks ??= createRemoteJWKSet(new URL(APP_CHECK_JWKS), { cacheMaxAge: 6 * 3600_000 }));

/* ---------- بررسی ---------- */

export type VerifyDeps = { idKeys?: JWTVerifyGetKey; appCheckKeys?: JWTVerifyGetKey; now?: () => number };

const deny = (status: 401 | 403 | 503, message: string): AuthResult => ({ ok: false, status, message });

export async function verifyIdToken(token: string, projectId: string, keys: JWTVerifyGetKey, nowSec: number): Promise<JWTPayload & { sub: string }> {
  const { payload } = await jwtVerify(token, keys, {
    algorithms: ["RS256"],
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    currentDate: new Date(nowSec * 1000),
    clockTolerance: SKEW,
    requiredClaims: ["exp", "iat", "sub"],
  });
  if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 128) throw new Error("bad sub");
  if (typeof payload.iat !== "number" || payload.iat > nowSec + SKEW) throw new Error("iat in future");
  const authTime = (payload as { auth_time?: unknown }).auth_time;
  if (typeof authTime !== "number" || authTime > nowSec + SKEW) throw new Error("bad auth_time");
  return payload as JWTPayload & { sub: string };
}

export async function verifyAppCheckToken(token: string, projectNumber: string, keys: JWTVerifyGetKey, nowSec: number): Promise<string> {
  const { payload, protectedHeader } = await jwtVerify(token, keys, {
    algorithms: ["RS256"],
    typ: "JWT",
    issuer: `https://firebaseappcheck.googleapis.com/${projectNumber}`,
    audience: `projects/${projectNumber}`,
    currentDate: new Date(nowSec * 1000),
    clockTolerance: SKEW,
    requiredClaims: ["exp", "sub"],
  });
  if (protectedHeader.typ !== "JWT" || typeof payload.sub !== "string" || !payload.sub) throw new Error("bad app check token");
  return payload.sub;
}

/**
 * کاربر تأییدشدهٔ درخواست یا دلیل رد. هرگز شناسهٔ کاربرِ فرستاده‌شده از مرورگر را باور نمی‌کند.
 * بدون پیکربندی (FIREBASE_PROJECT_ID) همیشه 503 می‌دهد، مگر میان‌بُر توسعهٔ محلی روشن باشد.
 */
export async function verifyStudioRequest(headers: Headers, cfg: StudioAuthConfig = studioAuthConfig(), deps: VerifyDeps = {}): Promise<AuthResult> {
  const nowSec = Math.floor((deps.now?.() ?? Date.now()) / 1000);
  const bearer = /^Bearer\s+([A-Za-z0-9._-]{20,4096})$/.exec(headers.get("authorization")?.trim() ?? "")?.[1] ?? null;

  if (!bearer && cfg.devBypass) return { ok: true, user: { uid: DEV_UID, appId: null, dev: true } };
  if (!cfg.projectId) return deny(503, "ورود کاربر روی این سرور پیکربندی نشده است (FIREBASE_PROJECT_ID).");
  if (!bearer) return deny(401, "برای ساخت باید وارد حساب شوید.");

  let uid: string;
  try {
    uid = (await verifyIdToken(bearer, cfg.projectId, deps.idKeys ?? firebaseIdTokenKeys(), nowSec)).sub;
  } catch (e) {
    console.warn("[auth] id token rejected:", e instanceof Error ? `${e.name}: ${e.message}` : e);
    return deny(401, "نشست ورود معتبر نیست؛ دوباره وارد شوید.");
  }

  let appId: string | null = null;
  if (cfg.appCheck !== "off") {
    const ac = headers.get("x-firebase-appcheck")?.trim() || null;
    if (cfg.appCheck === "enforce" && !cfg.projectNumber) return deny(503, "App Check روی این سرور پیکربندی نشده است (FIREBASE_PROJECT_NUMBER).");
    if (!ac && cfg.appCheck === "enforce") return deny(401, "برنامه تأیید نشد (App Check).");
    if (ac && cfg.projectNumber) {
      try {
        appId = await verifyAppCheckToken(ac, cfg.projectNumber, deps.appCheckKeys ?? appCheckKeys(), nowSec);
      } catch {
        return deny(401, "برنامه تأیید نشد (App Check).");
      }
    }
  }
  return { ok: true, user: { uid, appId, dev: false } };
}

/**
 * شناسهٔ پایدار و غیرقابل‌برگشت صاحب فایل‌ها (sha256 از uid، ۲۴ رقم hex).
 * در مسیر فایل‌ها و شمارنده‌ها به‌جای خود uid می‌آید تا uid در نشانی فایل‌ها پیدا نباشد.
 */
export function ownerId(uid: string): string {
  return createHash("sha256").update(`behix-owner:${uid}`).digest("hex").slice(0, 24);
}
