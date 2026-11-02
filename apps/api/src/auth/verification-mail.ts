import type { Mail } from "../mail/mailer.service.js";

// EmailToken.purpose for the sign-up confirmation link.
export const VERIFY_EMAIL = "verify-email";

// How long a confirmation link works.
export const EMAIL_TOKEN_HOURS = 24;

// The storefront's address; the link in the mail opens its /verify-email page.
export function webUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env["WEB_URL"] || "http://localhost:3000";
}

// Plain and short. The token goes only into the link, never into a log.
export function verificationMail(to: string, token: string, base = webUrl()): Mail {
  const link = new URL("/verify-email", base);
  link.searchParams.set("token", token);
  return {
    to,
    subject: "Confirm your Manasbal account",
    text: [
      "Manasbal",
      "",
      "Use made-up details. This is a demo.",
      "",
      "Confirm your email address with this link. It works once, for 24 hours:",
      link.toString(),
      "",
    ].join("\n"),
  };
}
