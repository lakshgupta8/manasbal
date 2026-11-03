// The one place MAIL_MODE and SMTP_URL are read.
//   smtp: send through SMTP_URL (locally Mailpit, which catches every mail).
//   off:  send nothing; new accounts count as confirmed at once. Unset means off, and production
//         uses off.
export type MailSettings = { mode: "off" } | { mode: "smtp"; smtpUrl: string };

export const DEFAULT_SMTP_URL = "smtp://localhost:1025";

export function readMailSettings(env: NodeJS.ProcessEnv = process.env): MailSettings {
  const mode = env["MAIL_MODE"] || "off";
  if (mode === "off") return { mode };
  if (mode === "smtp") return { mode, smtpUrl: env["SMTP_URL"] || DEFAULT_SMTP_URL };
  throw new Error(`MAIL_MODE must be smtp or off, not "${mode}"`);
}
