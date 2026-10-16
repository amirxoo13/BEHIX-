# چه چیزی زیر مجوز MIT این مخزن نیست

فایل `LICENSE` فقط به کدی مربوط است که صاحب مخزن حق مجوز دادنش را دارد.

این‌ها مجوز خودشان را دارند و با MIT این مخزن عوض نمی‌شوند:

- وابستگی‌های `package.json` و `package-lock.json`. هر بسته مجوز خودش را در `node_modules` دارد.
- `public/mediapipe/face_landmarker.task`
- `public/mediapipe/vision_wasm_internal.js`
- `public/mediapipe/vision_wasm_internal.wasm`

این سه فایل خروجی MediaPipe / Emscripten هستند و همراه کامیت `f583c8a` آمده‌اند. مجوزشان در خود این مخزن نوشته نشده است. پروژهٔ MediaPipe مجوز Apache-2.0 دارد. این فایل‌ها را MIT فرض نکنید.

`public/__grok/` از کامیت اول داخل درخت است و متن مجوز جداگانه‌ای در مخزن ندارد. تا وقتی صاحب آن فایل‌ها مشخص نشده، آن پوشه را مشمول `LICENSE` ندانید.
