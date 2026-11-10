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
| `STUDIO_PER_USER_DAY` | سقف روزانهٔ ساخت هر کاربر (پیش‌فرض ۲۰). پایدار. |
| `STUDIO_PER_DAY` | سقف روزانهٔ ساخت کل سرور (پیش‌فرض ۴۰۰). پایدار. |

## سهمیهٔ روزانه

شمارنده‌ها در همان `MEDIA_BUCKET` زیر `quota/studio/<YYYY-MM-DD>/u/<owner>` و `quota/studio/<YYYY-MM-DD>/all` هستند
(metadata یک شیء خالی، نوشتن با `ifMetagenerationMatch`)، پس بین همهٔ نمونه‌های سرور مشترک‌اند و با راه‌اندازی دوباره صفر نمی‌شوند.
`<owner>` = ۲۴ رقم اول sha256 از uid (خود uid در نشانی‌ها نمی‌آید). سهم پیش از کار پولی رزرو و اگر کار شکست خورد پس داده می‌شود.
حساب سرویس سرور باید روی این باکت `storage.objects.create/get/update` داشته باشد (مثلاً نقش Storage Object User).
پیشنهاد: قانون Lifecycle برای پاک کردن `quota/` بعد از ۷ روز.

## فایل‌ها: صاحب‌دار و تغییرناپذیر

کد: `src/lib/studio-keys.ts`. هر فایل تازه زیر پوشهٔ صاحبش با نام یکتا نوشته می‌شود و نوشتن با `ifGenerationMatch=0` است (هیچ شیء موجودی بازنویسی نمی‌شود؛ تلاش دوباره = `ObjectExistsError`):

- `cast/<owner>/<id>.png` برگهٔ شخصیت
- `frames/<owner>/<id>.png` فریم کلیدی
- `cast/<owner>/<puppet>/<version>.png` و `.json` عروسک؛ هر ساخت یک نسخهٔ تازه است.

`GET` و مرجع‌های `keyframe` فقط فایل خود کاربر را می‌پذیرند (فایل کاربر دیگر: 404 / 403). فایل‌های قدیمی بی‌صاحب (`cast/<name>.png`) برای هر کاربر واردشده فقط‌خواندنی‌اند.

## شخصیت ریگ در فیلم داستانی (آزمایشی)

| متغیر | مقدار | توضیح |
|---|---|---|
| `VITE_BEHIX_RIG_CHARACTERS` | `1` برای روشن | پیش‌فرض خاموش. با خاموش بودن، خروجی آدمک‌ها بایت‌به‌بایت مثل قبل است. این متغیر عمومی است (در کد کاربر ساخته می‌شود) و راز نیست. |

- هر عضو بازیگران پروژه می‌تواند فیلد اختیاری `character` داشته باشد: `{kind:"stick"}`، `{kind:"photo", charId}` یا `{kind:"rig", rigKey, view?}`. نبودِ آن یعنی آدمک.
- ریگ فقط وقتی کشیده می‌شود که پرچم روشن باشد، نوع شخصیت `rig` باشد و ریگ با `registerRig`/`registerRigJson` (در `src/studio/v2/story-rig.ts`) بار شده باشد؛ وگرنه همان آدمک کشیده می‌شود. هنوز رابطی برای بارگذاری ریگ از Cloud Storage در /story وجود ندارد (فایل‌ها خصوصی‌اند و باید با توکن خوانده شوند).
- قالب ریگ: `behix.rig` نسخهٔ ۱ (`src/studio/v2/rig-format.ts`)؛ فایل‌های عروسک قدیمی با `migrate`/`loadPuppet` خودکار ارتقا می‌یابند.
- محدودیت‌های فعلی: ریگ نمی‌نشیند (روی زمین ایستاده کشیده می‌شود)، شیء در دست کشیده نمی‌شود، و دهان ساده از شدت صدا ساخته می‌شود (نه از شکل‌های دهان).
- کیفیت بُرش هر عروسک تازه با `src/lib/alpha-qa.ts` سنجیده و در فیلد `qa` ذخیره می‌شود؛ فعلاً فقط گزارش است و ساخت را متوقف نمی‌کند.
