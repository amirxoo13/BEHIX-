/**
 * توکن دسترسی Google Cloud برای سرور (Vertex AI، Text-to-Speech، Cloud Storage).
 * هیچ کلیدی در کد یا مرورگر نیست؛ فقط «Application Default Credentials» خود گوگل:
 *   ۱) روی Cloud Run / Compute Engine: حساب سرویس از metadata server.
 *   ۲) روی کامپیوتر توسعه‌دهنده: فایلی که `gcloud auth application-default login` می‌سازد
 *      (یا مسیری که در GOOGLE_APPLICATION_CREDENTIALS نوشته شده).
 *   ۳) اگر هیچ‌کدام کار نکرد (مثلاً ADC منقضی شده): حساب فعال gcloud CLI روی همین کامپیوتر
 *      (`gcloud auth print-access-token`). این مسیر فقط برای توسعهٔ محلی است.
 * بدون وابستگی اضافه (فقط fetch و node:crypto).
 */
type Token = { value: string; until: number };
type AdcFile =
  | { type: "authorized_user"; client_id: string; client_secret: string; refresh_token: string; quota_project_id?: string }
  | { type: "service_account"; client_email: string; private_key: string; token_uri?: string; project_id?: string };

const SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const METADATA = "http://metadata.google.internal/computeMetadata/v1";
let cached: Token | null = null;
let pending: Promise<Token> | null = null;

/** مسیر فایل ADC روی این سیستم‌عامل (همان مسیری که gcloud می‌نویسد). */
export function adcPath(env: Record<string, string | undefined> = process.env, platform: string = process.platform): string | null {
  const explicit = env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (explicit) return explicit;
  if (platform === "win32") return env.APPDATA ? `${env.APPDATA}\\gcloud\\application_default_credentials.json` : null;
  const home = env.HOME;
  return home ? `${home}/.config/gcloud/application_default_credentials.json` : null;
}

async function readAdc(): Promise<AdcFile | null> {
  const path = adcPath();
  if (!path) return null;
  try {
    const { readFile } = await import("node:fs/promises");
    const parsed = JSON.parse(await readFile(path, "utf8")) as AdcFile;
    return parsed.type === "authorized_user" || parsed.type === "service_account" ? parsed : null;
  } catch {
    return null;
  }
}

function b64url(data: string | Uint8Array): string {
  return Buffer.from(data).toString("base64url");
}

async function exchange(body: Record<string, string>, uri = "https://oauth2.googleapis.com/token"): Promise<Token> {
  const r = await fetch(uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`google oauth token ${r.status}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  return { value: j.access_token, until: Date.now() + j.expires_in * 1000 };
}

async function fromAdc(adc: AdcFile): Promise<Token> {
  if (adc.type === "authorized_user") {
    return exchange({
      grant_type: "refresh_token",
      client_id: adc.client_id,
      client_secret: adc.client_secret,
      refresh_token: adc.refresh_token,
    });
  }
  const { createSign } = await import("node:crypto");
  const now = Math.floor(Date.now() / 1000);
  const aud = adc.token_uri ?? "https://oauth2.googleapis.com/token";
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
    JSON.stringify({ iss: adc.client_email, scope: SCOPE, aud, iat: now, exp: now + 3600 }),
  )}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(adc.private_key);
  return exchange({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(signature)}` }, aud);
}

async function fromMetadata(): Promise<Token> {
  const r = await fetch(`${METADATA}/instance/service-accounts/default/token`, {
    headers: { "Metadata-Flavor": "Google" },
    signal: AbortSignal.timeout(2_500),
  });
  if (!r.ok) throw new Error(`metadata token ${r.status}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  return { value: j.access_token, until: Date.now() + j.expires_in * 1000 };
}

/** حساب فعال gcloud CLI (فقط توسعهٔ محلی). توکن‌های gcloud یک ساعت اعتبار دارند؛ ۴۵ دقیقه نگه می‌داریم. */
async function fromGcloudCli(): Promise<Token> {
  const { execFile } = await import("node:child_process");
  const value = await new Promise<string>((resolve, reject) => {
    execFile(
      process.platform === "win32" ? "gcloud.cmd" : "gcloud",
      ["auth", "print-access-token"],
      { timeout: 30_000, windowsHide: true, shell: process.platform === "win32" },
      (err, stdout) => (err ? reject(new Error("gcloud cli token failed")) : resolve(String(stdout).trim())),
    );
  });
  if (!/^[\w.\-]{20,}$/.test(value)) throw new Error("gcloud cli returned no token");
  return { value, until: Date.now() + 45 * 60_000 };
}

async function resolveToken(): Promise<Token> {
  const errors: string[] = [];
  const adc = await readAdc();
  if (adc) {
    try {
      return await fromAdc(adc);
    } catch (e) {
      errors.push(`adc: ${e instanceof Error ? e.message : e}`);
    }
  }
  try {
    return await fromMetadata();
  } catch (e) {
    errors.push(`metadata: ${e instanceof Error ? e.message : e}`);
  }
  try {
    return await fromGcloudCli();
  } catch (e) {
    errors.push(`gcloud: ${e instanceof Error ? e.message : e}`);
  }
  throw new Error(`Google Cloud credentials not available (${errors.join("; ")})`);
}

/** توکن معتبر (کش‌شده تا یک دقیقه قبل از انقضا). در خطا throw می‌کند. */
export async function gcpAccessToken(): Promise<string> {
  if (cached && cached.until > Date.now() + 60_000) return cached.value;
  pending ??= resolveToken().finally(() => {
    pending = null;
  });
  cached = await pending;
  return cached.value;
}

/** شناسهٔ پروژه: متغیر محیطی، بعد فایل ADC، بعد metadata server. */
export async function gcpProject(): Promise<string | null> {
  const fromEnv = process.env.GOOGLE_CLOUD_PROJECT?.trim() || process.env.GCLOUD_PROJECT?.trim();
  if (fromEnv) return fromEnv;
  const adc = await readAdc();
  if (adc?.type === "authorized_user" && adc.quota_project_id) return adc.quota_project_id;
  if (adc?.type === "service_account" && adc.project_id) return adc.project_id;
  try {
    const r = await fetch(`${METADATA}/project/project-id`, { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(2_000) });
    return r.ok ? (await r.text()).trim() || null : null;
  } catch {
    return null;
  }
}
