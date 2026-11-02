import { resetMail, verificationMail, webUrl } from "./verification-mail.js";

describe("verificationMail", () => {
  it("links to the storefront's verify page with the token", () => {
    const mail = verificationMail("test.buyer@example.test", "abc_DEF-123", "https://shop.test");

    expect(mail.to).toBe("test.buyer@example.test");
    expect(mail.subject).toBe("Confirm your Manasbal account");
    expect(mail.text).toContain("Use made-up details. This is a demo.");
    expect(mail.text).toContain("https://shop.test/verify-email?token=abc_DEF-123");
  });

  it("uses WEB_URL by default", () => {
    expect(verificationMail("a@example.test", "t").text).toContain(
      `${webUrl()}/verify-email?token=t`,
    );
  });
});

describe("webUrl", () => {
  it("reads WEB_URL, with the local storefront as the default", () => {
    expect(webUrl({ WEB_URL: "https://shop.test" })).toBe("https://shop.test");
    expect(webUrl({})).toBe("http://localhost:3000");
  });
});

describe("resetMail", () => {
  it("links to the storefront's reset page and says what to do if it was not asked for", () => {
    const mail = resetMail("test.buyer@example.test", "abc_DEF-123", "https://shop.test");

    expect(mail.to).toBe("test.buyer@example.test");
    expect(mail.subject).toBe("Reset your Manasbal password");
    expect(mail.text).toContain("Use made-up details. This is a demo.");
    expect(mail.text).toContain("https://shop.test/reset-password?token=abc_DEF-123");
    expect(mail.text).toContain("If you didn't ask for this, ignore this mail.");
  });

  it("uses WEB_URL by default", () => {
    expect(resetMail("a@example.test", "t").text).toContain(`${webUrl()}/reset-password?token=t`);
  });
});
