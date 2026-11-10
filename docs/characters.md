# شخصیت‌ها و API استودیو

## احراز هویت `/api/studio`

همهٔ اقدام‌های پولی (`character`، `keyframe`، `puppet`) و خواندن فایل (`GET ?key=`) کاربرِ واردشده می‌خواهند.
کلاینت توکن Firebase Auth را در `Authorization: Bearer <ID token>` می‌فرستد و (اگر App Check روشن است) توکن App Check را در `X-Firebase-AppCheck`.
سرور توکن را طبق مستند رسمی Firebase («Verify ID tokens using a third-party JWT library») با کلیدهای عمومی گوگل بررسی می‌کند؛ هیچ راز یا کلیدی لازم نیست.
کد: `src/lib/studio-auth.server.ts`، منطق مسیر: `src/lib/studio-api.server.ts`.

`GET` هم بسته است: فایل‌ها شخصی‌اند و هیچ کلاینتی آن‌ها را با `<img src>` بی‌هدر نمی‌خواند. کلاینت فایل را با هدر می‌گیرد و `URL.createObjectURL` می‌سازد.

| متغیر محیطی | معنا |
|---|---|
| `FIREBASE_PROJECT_ID` | شناسهٔ پروژهٔ Firebase (لازم). `aud` باید همین باشد و `iss` = `https://securetoken.google.com/<FIREBASE_PROJECT_ID>`. بدون آن همهٔ درخواست‌ها 503 می‌گیرند (fail closed). |
| `FIREBASE_PROJECT_NUMBER` | شمارهٔ پروژه؛ برای App Check (`iss` = `https://firebaseappcheck.googleapis.com/<شماره>`، `aud` شامل `projects/<شماره>`). |
| `STUDIO_APP_CHECK` | `off`، `verify` (پیش‌فرض: اگر هدر آمد بررسی و در صورت نامعتبر بودن رد)، `enforce` (هدر اجباری؛ بدون `FIREBASE_PROJECT_NUMBER` = 503). |
| `STUDIO_DEV_AUTH_BYPASS` | فقط مقدار `1` و فقط در توسعهٔ محلی: درخواست بی‌توکن کاربر `dev-local` می‌شود. اگر `NODE_ENV=production` باشد یا `K_SERVICE`/`VERCEL`/`GROK_PROJECT_ID` تنظیم شده باشد، نادیده گرفته می‌شود. |
| `MEDIA_BUCKET` | باکت Cloud Storage استودیو (بدون آن 503). |
| `STUDIO_PER_IP` | سقف کوتاه‌مدت هر نشانی در ده دقیقه (حافظهٔ همان نمونه؛ فقط ضد رگبار). |
