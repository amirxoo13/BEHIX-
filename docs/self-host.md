# اجرای BEHIX روی سرور خودتان

BEHIX به‌صورت پیش‌فرض یک سرور Node.js معمولی می‌سازد (Nitro preset `node-server`). به Vercel نیازی ندارد.

## پیش‌نیاز

- Node.js نسخهٔ ۲۲ یا بالاتر: `node --version`
- برای نصب پشت دامنه: nginx (یا هر reverse proxy دیگر)

## روش ۱: بدون Docker

۱. کد را بگیرید و وارد پوشه شوید:

```bash
git clone https://github.com/amirxoo13/BEHIX-.git
cd BEHIX-
```

۲. وابستگی‌ها را دقیقاً از روی lockfile نصب کنید:

```bash
npm ci --ignore-scripts
```

۳. نسخهٔ نهایی را بسازید. خروجی در پوشهٔ `.output` ساخته می‌شود:

```bash
npm run build
```

۴. سرور را اجرا کنید:

```bash
NODE_ENV=production PORT=3000 HOST=0.0.0.0 node .output/server/index.mjs
```

حالا سایت روی `http://آدرس-سرور:3000` باز می‌شود.

برای این‌که سرور بعد از ری‌استارت هم بالا بیاید، از `systemd` یا `pm2` استفاده کنید. نمونهٔ pm2:

```bash
npm install -g pm2
NODE_ENV=production PORT=3000 HOST=127.0.0.1 TRUSTED_IP_HEADER=x-real-ip pm2 start .output/server/index.mjs --name behix
pm2 save
```

## روش ۲: با Docker

```bash
docker build -t behix .
docker run -d --name behix -p 8080:8080 --restart unless-stopped behix
```

## پشت nginx با دامنه (پیشنهادی)

سقف درخواست‌های مدل زبانی و صدا بر اساس IP کاربر است. هدرهای IP را خود کاربر هم می‌تواند جعل کند، پس سرور فقط به هدری اعتماد می‌کند که در `TRUSTED_IP_HEADER` نوشته باشید و پراکسی خودتان آن را بنویسد.

بخش `location` در nginx:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

و سرور را با `TRUSTED_IP_HEADER=x-real-ip` اجرا کنید (مثل نمونهٔ pm2 بالا).

| حالت | مقدار `TRUSTED_IP_HEADER` |
|---|---|
| پشت nginx با `X-Real-IP $remote_addr` | `x-real-ip` |
| پشت nginx/Cloud Run با `$proxy_add_x_forwarded_for` | `x-forwarded-for` (آخرین مقدار خوانده می‌شود) |
| بدون پراکسی، مستقیم روی اینترنت | خالی بگذارید؛ آدرس اتصال استفاده می‌شود |

اگر سرور مستقیم روی اینترنت است، `TRUSTED_IP_HEADER` را **تنظیم نکنید**؛ وگرنه هر کسی با فرستادن آن هدر سقف را دور می‌زند.

## متغیرهای محیطی اختیاری

| متغیر | کاربرد |
|---|---|
| `SCRIPT_AI_BASE_URL`، `SCRIPT_AI_API_KEY`، `SCRIPT_AI_MODEL` | چیدن خودکار سناریو با مدل زبانی سازگار با OpenAI |
| `SCRIPT_AI_PER_HOUR`، `SCRIPT_AI_DAILY_TOKENS` | سقف مصرف مدل (پیش‌فرض ۱۰ درخواست در ساعت برای هر IP، ۳۰٬۰۰۰ توکن در روز) |
| `GOOGLE_CLOUD_PROJECT`، `TTS_BUCKET` | صدای Gemini؛ فقط روی Google Cloud کار می‌کند (از metadata server توکن می‌گیرد). بدون آن‌ها `/api/tts` پیام «فعال نیست» برمی‌گرداند و بقیهٔ برنامه کار می‌کند. |
| `TTS_MODEL`، `TTS_PREVIEW_MODEL`، `TTS_LOCATION`، `TTS_FALLBACK` | مدل صدا روی Agent Platform. پیش‌فرض‌ها: `gemini-3.8-flash-tts`، `gemini-3.8-flash-lite-tts`، `global` (یا `us` / `eu`). `TTS_FALLBACK=off` جایگزینی Flash به Flash-Lite را خاموش می‌کند. بخش «مهاجرت صدا به Gemini 3.8» را ببینید. |
| `TTS_PER_IP`، `TTS_PER_DAY` | سقف ساخت صدا: ۱۲۰ درخواست در ۱۰ دقیقه برای هر IP و ۳۰۰۰ در روز (پیش‌فرض). |
| `DATABASE_URL` | فقط اگر ورود کاربران را فعال کنید (Postgres). برای ساخت و ذخیرهٔ داستان لازم نیست؛ داستان‌ها در مرورگر کاربر ذخیره می‌شوند. |
| `NITRO_PRESET` | برای ساخت روی میزبان دیگر (مثلاً `vercel`)؛ پیش‌فرض `node-server` است. |

## مهاجرت صدا به Gemini 3.8 (Agent Platform)

`/api/tts` دیگر از Cloud Text-to-Speech و `gemini-2.5-pro-tts` استفاده نمی‌کند؛ هر کلیپ تازه با
`generateContent` روی Agent Platform (`aiplatform.googleapis.com`) ساخته می‌شود.
مرجع: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/text-to-speech/overview

- **مدل‌ها:** `TTS_MODEL` (پیش‌فرض `gemini-3.8-flash-tts`) برای دیالوگ‌ها؛ `TTS_PREVIEW_MODEL`
  (پیش‌فرض `gemini-3.8-flash-lite-tts`) برای پیش‌نمایش (`preview: true` در بدنهٔ درخواست) و جایگزین.
- **زنجیرهٔ جایگزین:** Flash ← Flash-Lite (همان API) ← پاسخ 502 با پیام فارسی برای همان دیالوگ. هیچ جایگزینی
  با Gemini 2.5 وجود ندارد. سهمیهٔ روزانه یک بار رزرو و در شکست کامل پس داده می‌شود.
- **منطقه:** `TTS_LOCATION` = `global` (پیش‌فرض) یا `us` / `eu` (نقطه‌های `aiplatform.us.rep.googleapis.com` و
  `aiplatform.eu.rep.googleapis.com`).
- **دسترسی:** حساب سرویس Cloud Run باید `roles/aiplatform.user` داشته باشد و API `aiplatform.googleapis.com`
  روی پروژه فعال باشد. هیچ کلیدی در مرورگر یا `.env` نیست (فقط ADC).
- **قالب صدا:** WAV شانزده‌بیتی، ۲۴ کیلوهرتز، تک‌کاناله (`audio/wav`). اگر API صدای خام PCM بدهد، سرور سرآیند
  WAV می‌گذارد. مرورگر WAV و MP3 هر دو را رمزگشایی می‌کند.
- **کش:** کلید شامل مدل است: `tts/sha256("<model>|<voice>|<prompt>|<text>").wav` در `TTS_BUCKET`، و همان
  هش روی دستگاه (`voice:<hash>` در IndexedDB). کلیپ‌های قدیمی (`….mp3` با هش `gemini-2.5-pro-tts|…`)
  پاک نمی‌شوند و اگر همان جمله/صدا/لحن پیدا شود هنوز از GCS و IndexedDB خوانده و پخش می‌شوند؛ فقط کلیپ تازه با
  2.5 ساخته نمی‌شود. ترتیب جستجو: کلید Flash، کلید Flash-Lite، کلید قدیمی MP3. پاسخ هدر `x-tts-model` دارد.
- **بررسی زنده:** `node --experimental-strip-types scripts/gcp-verify.mjs` هر دو مدل 3.8 را در `global`، `us` و
  `eu` می‌آزماید و WAVها را در `verify-out/` می‌نویسد.

## بررسی سلامت

```bash
curl -I http://127.0.0.1:3000/
curl -I http://127.0.0.1:3000/story
```

هر دو باید `HTTP/1.1 200` برگردانند.
