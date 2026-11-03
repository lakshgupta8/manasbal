import { AuthController } from "./auth.controller.js";
import { REFRESH_COOKIE, refreshCookieOptions } from "./cookie.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";
// The request, as Fastify gives it: its id goes to the audit log.
const REQUEST = { id: "req-1" };

describe("AuthController", () => {
  const service = {
    signUp: vi.fn(),
    signIn: vi.fn(),
    refresh: vi.fn(),
    signOut: vi.fn(),
    verifyEmail: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    verifyTwoStep: vi.fn(),
  };
  const controller = new AuthController(service);

  it("passes the sign-up input to the service and answers its result", async () => {
    const input = {
      email: "test.buyer@example.test",
      password: "a long passphrase",
      name: "Test Buyer",
      confirmAdult: true as const,
    };
    const created = { id: USER_ID, email: input.email, name: input.name };
    service.signUp.mockResolvedValue(created);

    await expect(controller.signUp(input, REQUEST)).resolves.toBe(created);
    expect(service.signUp).toHaveBeenCalledWith(input, "req-1");
  });

  it("puts the refresh token in the cookie and keeps it out of the answer", async () => {
    const input = { email: "test.buyer@example.test", password: "a long passphrase" };
    service.signIn.mockResolvedValue({
      accessToken: "access.jwt",
      expiresIn: 900,
      refreshToken: "cookie-token",
    });
    const reply = { setCookie: vi.fn() };

    const answer = await controller.signIn(input, "Test Browser", REQUEST, reply);

    expect(answer).toEqual({ accessToken: "access.jwt", expiresIn: 900 });
    expect(service.signIn).toHaveBeenCalledWith(input, "Test Browser", "req-1");
    expect(reply.setCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      "cookie-token",
      refreshCookieOptions(),
    );
  });

  it("answers a two-step challenge as it is, and sets no cookie", async () => {
    const input = { email: "test.buyer@example.test", password: "a long passphrase" };
    const challenge = { twoFactorRequired: true, challengeToken: "challenge.jwt" };
    service.signIn.mockResolvedValue(challenge);
    const reply = { setCookie: vi.fn() };

    await expect(controller.signIn(input, undefined, REQUEST, reply)).resolves.toBe(challenge);
    expect(reply.setCookie).not.toHaveBeenCalled();
  });

  it("signs in after the second step, with the cookie as sign-in sets it", async () => {
    const input = { challengeToken: "challenge.jwt", code: "123456" };
    service.verifyTwoStep.mockResolvedValue({
      accessToken: "access.jwt",
      expiresIn: 900,
      refreshToken: "cookie-token",
    });
    const reply = { setCookie: vi.fn() };

    const answer = await controller.verifyTwoStep(input, "Test Browser", { id: "req-1" }, reply);

    expect(answer).toEqual({ accessToken: "access.jwt", expiresIn: 900 });
    expect(service.verifyTwoStep).toHaveBeenCalledWith(input, "Test Browser", "req-1");
    expect(reply.setCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      "cookie-token",
      refreshCookieOptions(),
    );
  });

  it("passes the link's token to the service", async () => {
    service.verifyEmail.mockResolvedValue(undefined);

    await expect(controller.verifyEmail({ token: "link-token" }, REQUEST)).resolves.toBeUndefined();
    expect(service.verifyEmail).toHaveBeenCalledWith("link-token", "req-1");
  });

  it("starts a reset for the email and answers nothing", () => {
    expect(
      controller.forgotPassword({ email: "test.buyer@example.test" }, REQUEST),
    ).toBeUndefined();
    expect(service.forgotPassword).toHaveBeenCalledWith("test.buyer@example.test", "req-1");
  });

  it("passes the reset token and the new password to the service", async () => {
    service.resetPassword.mockResolvedValue(undefined);

    await expect(
      controller.resetPassword({ token: "link-token", password: "a new long passphrase" }, REQUEST),
    ).resolves.toBeUndefined();
    expect(service.resetPassword).toHaveBeenCalledWith(
      "link-token",
      "a new long passphrase",
      "req-1",
    );
  });

  it("swaps the cookie's refresh token for a new pair", async () => {
    service.refresh.mockResolvedValue({
      accessToken: "new.jwt",
      expiresIn: 900,
      refreshToken: "new-cookie-token",
    });
    const reply = { setCookie: vi.fn() };
    const request = { ...REQUEST, cookies: { [REFRESH_COOKIE]: "old-cookie-token" } };

    const answer = await controller.refresh(request, "Test Browser", reply);

    expect(answer).toEqual({ accessToken: "new.jwt", expiresIn: 900 });
    expect(service.refresh).toHaveBeenCalledWith("old-cookie-token", "Test Browser", "req-1");
    expect(reply.setCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      "new-cookie-token",
      refreshCookieOptions(),
    );
  });

  it("signs out the cookie's session and clears the cookie", async () => {
    service.signOut.mockResolvedValue(undefined);
    const reply = { clearCookie: vi.fn() };
    const request = { ...REQUEST, cookies: { [REFRESH_COOKIE]: "old-cookie-token" } };

    await controller.signOut(request, reply);

    expect(service.signOut).toHaveBeenCalledWith("old-cookie-token", "req-1");
    expect(reply.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE, refreshCookieOptions());
  });
});
