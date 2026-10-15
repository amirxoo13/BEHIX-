/**
 * ساخت نسخهٔ بدون سرورِ صفحهٔ «داستان به فیلم» برای اپ اندروید (Capacitor).
 * خروجی: dist-android/index.html و فایل‌هایش؛ `npx cap sync android` آن را داخل اپ کپی می‌کند.
 * فقط تصویرهای برند از public کپی می‌شوند (نه فایل‌های سنگین mediapipe که این صفحه لازم ندارد).
 */
import { cpSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const outDir = resolve(__dirname, "dist-android");

function androidAssets(): Plugin {
  return {
    name: "behix:android-assets",
    apply: "build",
    closeBundle() {
      renameSync(resolve(outDir, "android.html"), resolve(outDir, "index.html"));
      cpSync(resolve(__dirname, "public/brand"), resolve(outDir, "brand"), { recursive: true });
      cpSync(resolve(__dirname, "public/favicon.svg"), resolve(outDir, "favicon.svg"));
    },
  };
}

export default defineConfig({
  plugins: [viteReact(), tailwindcss(), androidAssets()],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
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
