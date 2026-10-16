/**
 * ورودی اپ اندروید (Capacitor): فقط صفحهٔ «داستان به فیلم»، کاملاً روی خود گوشی و بدون سرور.
 * با `npm run android:web` در پوشهٔ dist-android ساخته می‌شود.
 */
import "@/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StoryApp } from "@/components/story/story-app";
import { useStoryWorkspace } from "@/studio/stick/use-workspace";

/** Own the device workspace without requiring the website router. */
function AndroidApp() {
  const workspace = useStoryWorkspace("");
  return <StoryApp workspace={workspace} brand={(content) => <div className="studio-brand">{content}</div>} />;
}

const root = document.getElementById("root");
if (!root) throw new Error("ریشهٔ صفحه پیدا نشد.");

createRoot(root).render(
  <StrictMode>
    <AndroidApp />
  </StrictMode>,
);
