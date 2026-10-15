import type { CapacitorConfig } from "@capacitor/cli";

/**
 * تنظیمات اپ اندروید BEHIX.
 * appId شناسهٔ دائمی اپ در مایکت است؛ بعد از اولین انتشار دیگر نباید عوض شود.
 */
const config: CapacitorConfig = {
  appId: "ir.behix.app",
  appName: "BEHIX",
  webDir: "dist-android",
  android: {
    // اپ کاملاً آفلاین است؛ محتوای http لازم نیست.
    allowMixedContent: false,
  },
};

export default config;
