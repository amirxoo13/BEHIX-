/**
 * Shared LIVE-PREVIEW OAuth client metadata.
 *
 * The sandbox serves each live preview on a dynamic `https://*.grok-sandbox.com`
 * URL, which can't be pre-registered per app. The broker instead exposes ONE
 * shared "preview" client that accepts any
 * `https://*.grok-sandbox.com/api/auth/oauth2/callback/*`
 * (broker: `app-builder-deployer/auth/src/preview-oauth.ts`). The client ID is
 * public; its secret must be injected server-side as `GROK_AUTH_CLIENT_SECRET`.
 * Without a configured secret, broker OAuth is unavailable (see `server.ts`).
 * When deployed the deployer injects per-app `GROK_AUTH_*` credentials.
 *
 * Preview credentials must match the broker's `GROK_PREVIEW_CLIENT_ID` /
 * `GROK_PREVIEW_CLIENT_SECRET`. Rotate or revoke exposed secrets at the broker;
 * never store them in application source or `VITE_*` configuration.
 */
export const PREVIEW_CLIENT_ID = "grok_preview";
/** The shared auth broker issuer (OIDC discovery lives under it). */
export const GROK_ISSUER_DEFAULT = "https://auth.grok.me";

/**
 * Host patterns whose callbacks the preview client accepts. Better Auth derives
 * the live preview's real origin from the request host and validates it against
 * this list (wildcard-matched), so the OAuth `redirect_uri` becomes the concrete
 * `https://<preview-host>/api/auth/oauth2/callback/...` the broker allows.
 */
export const PREVIEW_ALLOWED_HOSTS = ["*.grok-sandbox.com"] as const;
