import { MAIL_FROM, MailerService, transportOptions } from "./mailer.service.js";

const sendMail = vi.fn<(mail: object) => Promise<unknown>>();
const createTransport = vi.fn<(options: object) => { sendMail: typeof sendMail }>(() => ({
  sendMail,
}));

vi.mock("nodemailer", () => ({ createTransport: (options: object) => createTransport(options) }));

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
    vi.stubEnv("SMTP_URL", "smtp://localhost:1025");
    const mailer = new MailerService();

    await mailer.send(mail);
    await mailer.send(mail);

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith(transportOptions("smtp://localhost:1025"));
    expect(sendMail).toHaveBeenCalledWith({ from: MAIL_FROM, ...mail });
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
});

describe("transportOptions", () => {
  it("allows plain SMTP to this computer only", () => {
    expect(transportOptions("smtp://localhost:1025")).toEqual({
      host: "localhost",
      port: 1025,
      secure: false,
      requireTLS: false,
      auth: undefined,
    });
    expect(transportOptions("smtp://127.0.0.1:1025").requireTLS).toBe(false);
    expect(transportOptions("smtp://[::1]:1025").requireTLS).toBe(false);
  });

  it("requires STARTTLS from any other server, on 587 by default", () => {
    expect(transportOptions("smtp://mail.example.test")).toMatchObject({
      host: "mail.example.test",
      port: 587,
      secure: false,
      requireTLS: true,
    });
  });

  it("uses TLS from the start for smtps, on 465 by default", () => {
    expect(transportOptions("smtps://mail.example.test")).toMatchObject({
      port: 465,
      secure: true,
      requireTLS: true,
    });
  });

  it("passes the user and password from the URL", () => {
    expect(transportOptions("smtps://sender%40example.test:p%40ss@mail.example.test").auth).toEqual(
      { user: "sender@example.test", pass: "p@ss" },
    );
  });
});
