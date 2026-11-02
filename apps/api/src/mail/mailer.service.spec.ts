import { MAIL_FROM, MailerService } from "./mailer.service.js";

const sendMail = vi.fn<(mail: object) => Promise<unknown>>();
const createTransport = vi.fn<(url: string) => { sendMail: typeof sendMail }>(() => ({ sendMail }));

vi.mock("nodemailer", () => ({ createTransport: (url: string) => createTransport(url) }));

const mail = { to: "test.buyer@example.test", subject: "Hello", text: "A short note" };

describe("MailerService", () => {
  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue({});
    createTransport.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends nothing when MAIL_MODE is off", async () => {
    vi.stubEnv("MAIL_MODE", "off");

    await new MailerService().send(mail);

    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("sends through SMTP_URL in smtp mode, opening the connection once", async () => {
    vi.stubEnv("MAIL_MODE", "smtp");
    vi.stubEnv("SMTP_URL", "smtp://mail.test:1025");
    const mailer = new MailerService();

    await mailer.send(mail);
    await mailer.send(mail);

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith("smtp://mail.test:1025");
    expect(sendMail).toHaveBeenCalledWith({ from: MAIL_FROM, ...mail });
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
});
