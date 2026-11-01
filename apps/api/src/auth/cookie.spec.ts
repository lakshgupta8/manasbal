import { REFRESH_COOKIE, refreshCookieOptions } from "./cookie.js";

describe("refreshCookieOptions", () => {
  const common = { httpOnly: true, path: "/auth", maxAge: 14 * 24 * 3600 };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is cross-site and HTTPS-only in production", () => {
    expect(refreshCookieOptions(true)).toEqual({ ...common, sameSite: "none", secure: true });
  });

  it("is Lax and allows plain HTTP locally", () => {
    expect(refreshCookieOptions(false)).toEqual({ ...common, sameSite: "lax", secure: false });
  });

  it("reads production from NODE_ENV by default", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(refreshCookieOptions().secure).toBe(true);
    vi.stubEnv("NODE_ENV", "test");
    expect(refreshCookieOptions().secure).toBe(false);
  });

  it("names the cookie refresh_token", () => {
    expect(REFRESH_COOKIE).toBe("refresh_token");
  });
});
