/**
 * ورود کاربر با Firebase Authentication (ایمیل و رمز) از طریق REST رسمی، بدون SDK سنگین؛ هم در وب و هم در اپ اندروید (Capacitor).
 *   ورود:      accounts:signInWithPassword   https://firebase.google.com/docs/reference/rest/auth#section-sign-in-email-password
 *   ثبت‌نام:   accounts:signUp
 *   فراموشی:   accounts:sendOobCode (PASSWORD_RESET)
 *   تمدید:     securetoken.googleapis.com/v1/token (refresh_token)
 * تنظیمات Firebase عمومی‌اند (کلید API وب، شناسهٔ پروژه) و راز نیستند؛ با VITE_FIREBASE_* قابل تغییرند.
 * توکن کوتاه‌عمر (ID token) فقط در حافظه است؛ refresh token در localStorage همین دستگاه می‌ماند تا ورود باقی بماند.
 */
const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
export const FIREBASE = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyCM2dkkLwwNPxPkLmm9mCaGkyqZ9ndXvGM",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "anime-512918",
};

export type User = { uid: string; email: string };
type Session = User & { refreshToken: string };
const KEY = "behix.auth.v1";
const IDT = "https://identitytoolkit.googleapis.com/v1/accounts";

let session: Session | null = null;
let idToken: { value: string; until: number } | null = null;
const listeners = new Set<(u: User | null) => void>();

const store = {
  get(): Session | null {
    try {
      const raw = globalThis.localStorage?.getItem(KEY);
      const s = raw ? (JSON.parse(raw) as Session) : null;
      return s && typeof s.uid === "string" && typeof s.refreshToken === "string" ? s : null;
    } catch {
      return null;
    }
  },
  set(s: Session | null) {
    try {
      if (s) globalThis.localStorage?.setItem(KEY, JSON.stringify(s));
      else globalThis.localStorage?.removeItem(KEY);
    } catch {
      /* حالت خصوصی مرورگر: ورود فقط تا بستن صفحه می‌ماند */
    }
  },
};

session = store.get();

const emit = () => listeners.forEach((f) => f(currentUser()));
export const currentUser = (): User | null => (session ? { uid: session.uid, email: session.email } : null);
export function onUserChange(f: (u: User | null) => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** پیام‌های خطای Firebase به فارسی. */
const MESSAGES: Record<string, string> = {
  EMAIL_EXISTS: "این ایمیل قبلاً ثبت شده است؛ وارد شوید.",
  EMAIL_NOT_FOUND: "ایمیل یا رمز درست نیست.",
  INVALID_PASSWORD: "ایمیل یا رمز درست نیست.",
  INVALID_LOGIN_CREDENTIALS: "ایمیل یا رمز درست نیست.",
  INVALID_EMAIL: "ایمیل معتبر نیست.",
  USER_DISABLED: "این حساب غیرفعال شده است.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "تلاش زیاد بود؛ کمی بعد دوباره امتحان کنید.",
  OPERATION_NOT_ALLOWED: "ورود با ایمیل روی سرور فعال نیست.",
};
export const WEAK_PASSWORD = "رمز باید دست‌کم ۶ حرف باشد.";

async function call<T>(url: string, body: Record<string, unknown>, form = false): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: { "content-type": form ? "application/x-www-form-urlencoded" : "application/json" },
      body: form ? new URLSearchParams(body as Record<string, string>) : JSON.stringify(body),
    });
  } catch {
    throw new Error("اتصال به سرویس ورود برقرار نشد.");
  }
  const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } } & T;
  if (!r.ok) {
    const code = (j.error?.message ?? "").split(" ")[0].split(":")[0].trim();
    throw new Error(code.startsWith("WEAK_PASSWORD") ? WEAK_PASSWORD : (MESSAGES[code] ?? "ورود انجام نشد؛ دوباره امتحان کنید."));
  }
  return j;
}

type SignResult = { localId: string; email: string; idToken: string; refreshToken: string; expiresIn: string };
function accept(r: SignResult): User {
  session = { uid: r.localId, email: r.email, refreshToken: r.refreshToken };
  idToken = { value: r.idToken, until: Date.now() + Number(r.expiresIn) * 1000 };
  store.set(session);
  emit();
  return { uid: r.localId, email: r.email };
}

export async function signIn(email: string, password: string): Promise<User> {
  return accept(await call<SignResult>(`${IDT}:signInWithPassword?key=${FIREBASE.apiKey}`, { email: email.trim(), password, returnSecureToken: true }));
}
export async function signUp(email: string, password: string): Promise<User> {
  if (password.length < 6) throw new Error(WEAK_PASSWORD);
  return accept(await call<SignResult>(`${IDT}:signUp?key=${FIREBASE.apiKey}`, { email: email.trim(), password, returnSecureToken: true }));
}
export async function sendPasswordReset(email: string): Promise<void> {
  await call(`${IDT}:sendOobCode?key=${FIREBASE.apiKey}`, { requestType: "PASSWORD_RESET", email: email.trim() });
}
export function signOut(): void {
  session = null;
  idToken = null;
  store.set(null);
  emit();
}

let refreshing: Promise<string | null> | null = null;
/** توکن معتبر کاربر (در صورت نیاز تمدید می‌شود) یا null اگر وارد نشده. */
export async function getIdToken(): Promise<string | null> {
  if (!session) return null;
  if (idToken && idToken.until > Date.now() + 5 * 60_000) return idToken.value;
  refreshing ??= (async () => {
    try {
      const r = await call<{ id_token: string; refresh_token: string; expires_in: string; user_id: string }>(
        `https://securetoken.googleapis.com/v1/token?key=${FIREBASE.apiKey}`,
        { grant_type: "refresh_token", refresh_token: session!.refreshToken },
        true,
      );
      session = { ...session!, uid: r.user_id, refreshToken: r.refresh_token };
      store.set(session);
      idToken = { value: r.id_token, until: Date.now() + Number(r.expires_in) * 1000 };
      return idToken.value;
    } catch {
      // refresh token باطل شده (مثلاً رمز عوض شده): خروج تا کاربر دوباره وارد شود.
      signOut();
      return null;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** توکن فقط به سرور خود BEHIX می‌رود (مسیر نسبی، همین دامنه یا VITE_API_BASE)، نه به آدرس دیگری مثل لینک فایل. */
export function isOwnApi(url: string, base = env.VITE_API_BASE ?? "", here = globalThis.location?.origin ?? ""): boolean {
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) return !url.startsWith("//");
  try {
    const o = new URL(url).origin;
    return o === here || (!!base && o === new URL(base).origin);
  } catch {
    return false;
  }
}

/** هدر ورود برای server function ها (برنامهٔ فیلم و فهم فیلمنامه). */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

/** fetch با توکن کاربر (اگر وارد شده) برای مسیرهای پولی سرور BEHIX. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = isOwnApi(input) ? await getIdToken() : null;
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
