import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { REFRESH_COOKIE } from "./cookie.js";
import { ORIGIN_REFUSED, OriginGuard } from "./origin.guard.js";

function context(origin?: string, cookies?: Record<string, string>): ExecutionContext {
  const request = { headers: origin === undefined ? {} : { origin }, cookies };
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

describe("OriginGuard", () => {
  const guard = new OriginGuard();
  const cookie = { [REFRESH_COOKIE]: "cookie-token" };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets in the shop's origin, with or without the cookie", () => {
    expect(guard.canActivate(context("http://localhost:3000", cookie))).toBe(true);
    expect(guard.canActivate(context("http://localhost:5173"))).toBe(true);
  });

  it("refuses another site with 403, cookie or not", () => {
    for (const request of [
      context("https://evil.example", cookie),
      context("https://evil.example"),
      context("null", cookie),
    ]) {
      expect(() => guard.canActivate(request)).toThrow(new ForbiddenException(ORIGIN_REFUSED));
    }
  });

  it("refuses a request with the cookie but no Origin", () => {
    expect(() => guard.canActivate(context(undefined, cookie))).toThrow(
      new ForbiddenException(ORIGIN_REFUSED),
    );
  });

  it("lets through a request with neither Origin nor cookie, cookie plugin or not", () => {
    expect(guard.canActivate(context(undefined, {}))).toBe(true);
    expect(guard.canActivate(context())).toBe(true);
  });

  it("reads WEB_ORIGINS", () => {
    vi.stubEnv("WEB_ORIGINS", "https://shop.example");
    const configured = new OriginGuard();

    expect(configured.canActivate(context("https://shop.example", cookie))).toBe(true);
    expect(() => configured.canActivate(context("http://localhost:3000", cookie))).toThrow(
      ForbiddenException,
    );
  });
});
