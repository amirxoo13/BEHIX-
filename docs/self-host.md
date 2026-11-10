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
| `TTS_PER_IP`، `TTS_PER_DAY` | سقف ساخت صدا (مشترک بین `/api/tts`، `/api/voice` و `/api/music`، بر حسب «واحد»): ۱۲۰ واحد در ۱۰ دقیقه برای هر IP و ۳۰۰۰ در روز (پیش‌فرض). |
| `STT_ENABLED`، `STT_LOCATION`، `STT_MODEL` | زمان‌بندی لب با Speech-to-Text v2 در `/api/voice`. پیش‌فرض‌ها: روشن، `europe-west4`، `chirp_2`. `STT_ENABLED=off` آن را خاموش می‌کند (زمان‌بندی از دامنهٔ صدا ساخته می‌شود). |
| `VOICE_STT_COST` | وزن هر STT در سهمیه (پیش‌فرض ۱؛ هر TTS = ۱). |
| `LYRIA_MODEL`، `MUSIC_COST` | موسیقی پس‌زمینه با Lyria در `/api/music`. پیش‌فرض **خاموش**؛ با `LYRIA_MODEL=lyria-3-pro-preview` روشن می‌شود. `MUSIC_COST` وزن هر قطعه (پیش‌فرض ۵ واحد). |
| `LYRIA_RESPONSE_MODALITIES` | اختیاری، مثلاً `audio,text`: به‌صورت `response_modalities` به Interactions فرستاده می‌شود. آزمون زندهٔ ۲۰ آبان ۱۴۰۵ بدون آن پاسخ «completed» بدون هیچ خروجی داد. |
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

## زمان‌بندی لب (STT) و موسیقی (Lyria)

- **`/api/voice`** (POST `{lines:[{id,text,voice,style,preview?}]}`، حداکثر ۸ دیالوگ): برای هر دیالوگ صدای Gemini 3.8 TTS
  ساخته می‌شود، با Speech-to-Text v2 (`chirp_2`، `fa-IR`، زمان و اطمینان هر کلمه، recognizer ضمنی `_` در
  `https://{STT_LOCATION}-speech.googleapis.com`) زمان کلمه‌ها گرفته می‌شود و به VisemeTimeline تبدیل می‌شود. اگر STT
  خطا داد یا کلیپ از ۵۵ ثانیه بلندتر بود، زمان‌بندی از دامنهٔ صدا (`timing: "amplitude"`) یا متن ساخته می‌شود و واحد STT
  برمی‌گردد. صدا و `tts/<hash>.viseme.json` با یک کلید در `TTS_BUCKET` کش می‌شوند. `/api/tts` بدون تغییر می‌ماند.
- **`/api/music`**: یک پرامپت انگلیسی، فقط سازی، حداکثر ۱۸۴ ثانیه به `lyria-3-pro-preview` (منطقهٔ `global`، Interactions API)؛
  MP3 در `music/<hash>.mp3` همان سطل ذخیره می‌شود. بدون `TTS_BUCKET` کار نمی‌کند.
- **APIهایی که باید فعال باشند:** `aiplatform.googleapis.com` (TTS و Lyria)، `speech.googleapis.com` (STT)،
  `storage.googleapis.com` (کش).
  ```sh
  gcloud services enable aiplatform.googleapis.com speech.googleapis.com storage.googleapis.com
  ```
- **نقش‌های حساب سرویس (روی پروژهٔ خودتان بررسی کنید):**
  - `roles/aiplatform.user` — فراخوانی TTS و Lyria.
  - `roles/speech.client` (Cloud Speech Client) — شامل `speech.recognizers.recognize` است که Recognize با recognizer `_`
    لازم دارد ([فهرست نقش‌ها](https://cloud.google.com/iam/docs/roles-permissions/speech)). نقش Editor/Admin لازم نیست چون
    recognizer ساخته نمی‌شود.
  - `roles/storage.objectUser` روی `TTS_BUCKET` — خواندن/نوشتن کش و شمارندهٔ سهمیه (شمارنده از metadata و
    `ifMetagenerationMatch` استفاده می‌کند).
- **منطقه‌ها:** `chirp_2` برای `fa-IR` طبق جدول زبان‌های Speech-to-Text در `europe-west4`، `us-central1` و
  `asia-southeast1` هست (برچسب «Private GA»؛ ممکن است پروژه نیاز به دسترسی داشته باشد). Lyria فقط `global` است.
- **آزمون زنده (اختیاری، هزینه دارد):**
  ```sh
  VERIFY_STT=1 VERIFY_LYRIA=1 LYRIA_MODEL=lyria-3-pro-preview node --experimental-strip-types scripts/gcp-verify.mjs
  ```

## بررسی سلامت

```bash
curl -I http://127.0.0.1:3000/
curl -I http://127.0.0.1:3000/story
```

هر دو باید `HTTP/1.1 200` برگردانند.
