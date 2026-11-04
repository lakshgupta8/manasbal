// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// Next.js's server code expects the AsyncLocalStorage its own server sets up.
vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  (globalThis as Record<string, unknown>).AsyncLocalStorage = AsyncLocalStorage;
});

const { NextRequest } = await import("next/server");
const { getRedirectUrl, unstable_doesMiddlewareMatch } =
  await import("next/experimental/testing/server");
const { default: proxy, config } = await import("./proxy");

const runsOn = (url: string) => unstable_doesMiddlewareMatch({ config, nextConfig: {}, url });

describe("proxy matcher", () => {
  it.each(["/", "/en", "/hi", "/en/no-such-page", "/authors", "/apiary"])(
    "puts %s under a language",
    (url) => {
      expect(runsOn(url)).toBe(true);
    },
  );

  // next.config.ts forwards these to the API: a language redirect would break them.
  it.each([
    "/api",
    "/api/categories",
    "/api/me/addresses",
    "/auth",
    "/auth/refresh",
    "/auth/2fa/setup",
  ])("leaves %s alone", (url) => {
    expect(runsOn(url)).toBe(false);
  });

  it.each(["/_next/static/chunk.js", "/_vercel/insights/script.js", "/manasbal-mark.svg"])(
    "leaves the file %s alone",
    (url) => {
      expect(runsOn(url)).toBe(false);
    },
  );
});

describe("proxy", () => {
  it("sends / to the English home page", () => {
    const response = proxy(new NextRequest("http://shop.test/"));

    expect(new URL(getRedirectUrl(response)!).pathname).toBe("/en");
  });

  it("leaves a page that already has a language where it is", () => {
    const response = proxy(new NextRequest("http://shop.test/hi"));

    expect(getRedirectUrl(response)).toBeNull();
  });
});
