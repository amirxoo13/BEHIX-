import { createFileRoute } from "@tanstack/react-router";
import { createStudioApi, liveStudioDeps } from "@/lib/studio-api.server";

/**
 * API استودیو: شناسنامهٔ بازیگر، فریم کلیدی، عروسک و خواندن فایل‌ها از Cloud Storage.
 * منطق و احراز هویت در src/lib/studio-api.server.ts است.
 */
let api: Promise<ReturnType<typeof createStudioApi>> | null = null;
const studio = () => (api ??= liveStudioDeps().then(createStudioApi));

export const Route = createFileRoute("/api/studio")({
  server: { handlers: { POST: async ({ request }) => (await studio()).post(request), GET: async ({ request }) => (await studio()).get(request) } },
});
