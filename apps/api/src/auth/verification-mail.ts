import type { Mail } from "../mail/mailer.service.js";

// EmailToken.purpose for the sign-up confirmation link, and how long it works.
export const VERIFY_EMAIL = "verify-email";
export const EMAIL_TOKEN_HOURS = 24;

// EmailToken.purpose for the password reset link. Shorter-lived: it can take over the account.
export const RESET_PASSWORD = "reset-password";
export const RESET_TOKEN_HOURS = 1;

// The storefront's address; the links in the mails open its pages.
export function webUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env["WEB_URL"] || "http://localhost:3000";
}

function link(path: string, token: string, base: string): string {
  const url = new URL(path, base);
  url.searchParams.set("token", token);
  return url.toString();
}

// Plain and short. The token goes only into the link, never into a log.
export function verificationMail(to: string, token: string, base = webUrl()): Mail {
  return {
    to,
    subject: "Confirm your Manasbal account",
    text: [
      "Manasbal",
      "",
      "Use made-up details. This is a demo.",
      "",
      "Confirm your email address with this link. It works once, for 24 hours:",
      link("/verify-email", token, base),
      "",
    ].join("\n"),
  };
}

export function resetMail(to: string, token: string, base = webUrl()): Mail {
  return {
    to,
    subject: "Reset your Manasbal password",
    text: [
      "Manasbal",
      "",
      "Use made-up details. This is a demo.",
      "",
      "Choose a new password with this link. It works once, for 1 hour:",
      link("/reset-password", token, base),
      "",
      "If you didn't ask for this, ignore this mail.",
      "",
    ].join("\n"),
  };
}
