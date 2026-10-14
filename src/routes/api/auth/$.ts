import { createFileRoute } from "@tanstack/react-router";

/**
 * T10: mounts this app's Better Auth at `/api/auth/*` (sign-up, sign-in,
 * get-session, sign-out, OAuth callbacks). Server-only: `auth` is imported
 * lazily inside the handler so it never reaches the client bundle.
 *
 * Fail safe: on a deployed (Vercel / production) server without DATABASE_URL,
 * auth would fall back to PGLite, which is not packaged in the Vercel bundle and
 * crashes the function (verified locally), so we refuse with a generic 503 and
 * log the reason server-side only. The verify.server.ts guard is unchanged.
 */
async function handle(request: Request): Promise<Response> {
  const deployed = Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
  const hasDb = Boolean(process.env.DATABASE_URL?.trim());
  if (deployed && !hasDb) {
    console.error("[auth] DATABASE_URL is not set on a deployed server — refusing auth requests.");
    return Response.json(
      { code: "AUTH_UNAVAILABLE", message: "Sign-in is temporarily unavailable." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  try {
    const { auth } = await import("@/lib/auth/server");
    return await auth.handler(request);
  } catch (err) {
    console.error("[auth] handler failed:", err);
    return Response.json(
      { code: "AUTH_ERROR", message: "Sign-in failed. Please try again." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
