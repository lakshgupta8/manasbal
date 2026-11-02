import { Injectable } from "@nestjs/common";
import { createTransport, type Transporter } from "nodemailer";
import { readMailSettings } from "./mail-settings.js";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export const MAIL_FROM = "Manasbal <no-reply@manasbal.test>";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// SMTP settings from SMTP_URL. Plain SMTP is allowed only to this computer (Mailpit); any other
// server must use TLS, from the start (smtps://) or by STARTTLS.
export function transportOptions(smtpUrl: string) {
  const url = new URL(smtpUrl);
  const secure = url.protocol === "smtps:";
  return {
    host: url.hostname,
    port: Number(url.port) || (secure ? 465 : 587),
    secure,
    requireTLS: !LOCAL_HOSTS.has(url.hostname),
    auth: url.username
      ? { user: decodeURIComponent(url.username), pass: decodeURIComponent(url.password) }
      : undefined,
  };
}

// Sends plain-text mail through SMTP, or nothing when MAIL_MODE is off. Never logs the address
// or the body: the body can hold a one-time link.
@Injectable()
export class MailerService {
  private transport: Transporter | undefined;

  async send(mail: Mail): Promise<void> {
    const settings = readMailSettings();
    if (settings.mode === "off") return;
    this.transport ??= createTransport(transportOptions(settings.smtpUrl));
    await this.transport.sendMail({ from: MAIL_FROM, ...mail });
  }
}
