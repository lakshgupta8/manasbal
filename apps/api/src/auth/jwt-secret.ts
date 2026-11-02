// Production must not start without the key that signs access tokens: every sign-in would fail.
// Elsewhere the first sign-in reports the missing key instead.
export function requireJwtSecret(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === "production" && !env["JWT_SECRET"]) {
    throw new Error("JWT_SECRET is not set. Add it in Render → manasbal-api → Environment.");
  }
}
