/**
 * ورودی اپ اندروید (Capacitor): فقط صفحهٔ «داستان به فیلم»، کاملاً روی خود گوشی و بدون سرور.
 * با `npm run android:web` در پوشهٔ dist-android ساخته می‌شود.
 */
import "@/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StoryApp } from "@/components/story/story-app";

const root = document.getElementById("root");
if (!root) throw new Error("ریشهٔ صفحه پیدا نشد.");

createRoot(root).render(
  <StrictMode>
    <StoryApp brand={(content) => <div className="flex min-w-0 items-center gap-3">{content}</div>} />
  </StrictMode>,
);
