/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * T10: enabled for BEHIX. Sign-up / sign-in forms use `authClient.signUp.email`
 * / `authClient.signIn.email` from `@/lib/auth/client`.
 */
export const emailAndPasswordEnabled = true;

/** Better Auth `emailAndPassword` options (spread into `betterAuth` in server.ts). */
export const emailAndPasswordOptions = {
  enabled: true,
  minPasswordLength: 8,
  maxPasswordLength: 128,
  autoSignIn: true,
  // No mailer is wired yet, so verification cannot be required. Revisit once
  // an email provider exists.
  requireEmailVerification: false,
} as const;
