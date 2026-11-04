import { describe, expect, it } from "vitest";
import { apiRewrites, shopPath } from "./api-routes";

describe("apiRewrites", () => {
  it("forwards /auth/* on the same path and everything under /api to the API", () => {
    expect(apiRewrites("https://api.example")).toEqual([
      { source: "/auth/:path*", destination: "https://api.example/auth/:path*" },
      { source: "/api/:path*", destination: "https://api.example/:path*" },
    ]);
  });

  it("drops spaces and trailing slashes from API_URL", () => {
    expect(apiRewrites(" http://localhost:3001// ")[1]).toEqual({
      source: "/api/:path*",
      destination: "http://localhost:3001/:path*",
    });
  });

  it.each([undefined, "", "  "])("adds none when API_URL is %j", (apiUrl) => {
    expect(apiRewrites(apiUrl)).toEqual([]);
  });
});

describe("shopPath", () => {
  it.each([
    ["/auth/refresh", "/auth/refresh"],
    ["/auth", "/auth"],
    ["/categories", "/api/categories"],
    ["/me/addresses", "/api/me/addresses"],
    ["/authors", "/api/authors"],
  ])("sends %s to %s", (apiPath, expected) => {
    expect(shopPath(apiPath)).toBe(expected);
  });
});
