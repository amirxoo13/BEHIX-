/**
 * ساخت نسخهٔ بدون سرورِ صفحهٔ «داستان به فیلم» برای اپ اندروید (Capacitor).
 * خروجی: dist-android/index.html و فایل‌هایش؛ `npx cap sync android` آن را داخل اپ کپی می‌کند.
 * فقط تصویرهای برند از public کپی می‌شوند (نه فایل‌های سنگین mediapipe که این صفحه لازم ندارد).
 */
import { cpSync, existsSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const outDir = resolve(__dirname, "dist-android");

/** Create a build plugin that prepares the Android entry page and copies local brand assets. */
function androidAssets(): Plugin {
  return {
    name: "behix:android-assets",
    apply: "build",
    closeBundle() {
      // اگر ساخت شکسته باشد android.html نوشته نمی‌شود؛ این‌جا ساکت می‌مانیم تا خطای اصلی Rollup دیده شود.
      const page = resolve(outDir, "android.html");
      if (!existsSync(page)) return;
      renameSync(page, resolve(outDir, "index.html"));
      cpSync(resolve(__dirname, "public/brand"), resolve(outDir, "brand"), { recursive: true });
      cpSync(resolve(__dirname, "public/favicon.svg"), resolve(outDir, "favicon.svg"));
    },
  };
}

export default defineConfig({
  plugins: [viteReact(), tailwindcss(), androidAssets()],
  resolve: {
    // کد سرور (تابع‌های createServerFn) نباید وارد باندل اپ آفلاین شود؛ جایگزین کلاینتی‌اش را می‌گذاریم.
    alias: [
      { find: /^@\/lib\/script-ai$/, replacement: resolve(__dirname, "src/android/script-ai.ts") },
      { find: "@", replacement: resolve(__dirname, "src") },
    ],
  },
  publicDir: false,
  base: "./",
  worker: { format: "es" },
  build: {
    outDir,
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: { input: resolve(__dirname, "android.html") },
  },
});
