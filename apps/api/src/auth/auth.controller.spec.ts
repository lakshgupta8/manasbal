import { AuthController } from "./auth.controller.js";
import { REFRESH_COOKIE, refreshCookieOptions } from "./cookie.js";

const USER_ID = "7b0c1e2a-3d4f-4a5b-8c6d-7e8f9a0b1c2d";

describe("AuthController", () => {
  const service = { signUp: vi.fn(), signIn: vi.fn() };
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

    await expect(controller.signUp(input)).resolves.toBe(created);
    expect(service.signUp).toHaveBeenCalledWith(input);
  });

  it("puts the refresh token in the cookie and keeps it out of the answer", async () => {
    const input = { email: "test.buyer@example.test", password: "a long passphrase" };
    service.signIn.mockResolvedValue({
      accessToken: "access.jwt",
      expiresIn: 900,
      refreshToken: "cookie-token",
    });
    const reply = { setCookie: vi.fn() };

    const answer = await controller.signIn(input, "Test Browser", reply);

    expect(answer).toEqual({ accessToken: "access.jwt", expiresIn: 900 });
    expect(service.signIn).toHaveBeenCalledWith(input, "Test Browser");
    expect(reply.setCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      "cookie-token",
      refreshCookieOptions(),
    );
  });
});
