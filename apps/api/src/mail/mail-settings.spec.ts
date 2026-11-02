import { DEFAULT_SMTP_URL, readMailSettings } from "./mail-settings.js";

describe("readMailSettings", () => {
  it("is off when MAIL_MODE is unset, empty or off", () => {
    expect(readMailSettings({})).toEqual({ mode: "off" });
    expect(readMailSettings({ MAIL_MODE: "" })).toEqual({ mode: "off" });
    expect(readMailSettings({ MAIL_MODE: "off", SMTP_URL: "smtp://mail.test:25" })).toEqual({
      mode: "off",
    });
  });

  it("sends through SMTP_URL in smtp mode", () => {
    expect(readMailSettings({ MAIL_MODE: "smtp", SMTP_URL: "smtp://mail.test:25" })).toEqual({
      mode: "smtp",
      smtpUrl: "smtp://mail.test:25",
    });
  });

  it("uses the local Mailpit when SMTP_URL is unset", () => {
    expect(readMailSettings({ MAIL_MODE: "smtp" })).toEqual({
      mode: "smtp",
      smtpUrl: DEFAULT_SMTP_URL,
    });
  });

  it("refuses any other mode, so a typo fails loudly", () => {
    expect(() => readMailSettings({ MAIL_MODE: "smpt" })).toThrow(
      'MAIL_MODE must be smtp or off, not "smpt"',
    );
  });

  it("reads process.env by default", () => {
    expect(readMailSettings()).toEqual({ mode: "off" });
  });
});
