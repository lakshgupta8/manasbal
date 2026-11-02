import { Injectable } from "@nestjs/common";
import { createTransport, type Transporter } from "nodemailer";
import { readMailSettings } from "./mail-settings.js";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export const MAIL_FROM = "Manasbal <no-reply@manasbal.test>";

// Sends plain-text mail through SMTP, or nothing when MAIL_MODE is off. Never logs the address
// or the body: the body can hold a one-time link.
@Injectable()
export class MailerService {
  private transport: Transporter | undefined;

  async send(mail: Mail): Promise<void> {
    const settings = readMailSettings();
    if (settings.mode === "off") return;
    this.transport ??= createTransport(settings.smtpUrl);
    await this.transport.sendMail({ from: MAIL_FROM, ...mail });
  }
}
