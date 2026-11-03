import { DEV_WEB_ORIGINS, webOrigins } from "./web-origins.js";

describe("webOrigins", () => {
  it("reads a comma-separated list, trimming spaces and dropping empty entries", () => {
    expect(webOrigins({ WEB_ORIGINS: " https://shop.example , http://localhost:3000,," })).toEqual([
      "https://shop.example",
      "http://localhost:3000",
    ]);
  });

  it("falls back to the local shop outside production", () => {
    expect(webOrigins({})).toBe(DEV_WEB_ORIGINS);
    expect(webOrigins({ WEB_ORIGINS: " , " })).toBe(DEV_WEB_ORIGINS);
  });

  it("refuses to run production without it", () => {
    expect(() => webOrigins({ NODE_ENV: "production" })).toThrow("WEB_ORIGINS is not set");
  });

  it.each(["https://shop.example/", "https://shop.example/path", "shop.example", "*"])(
    "refuses %s, which is not a bare origin",
    (origin) => {
      expect(() => webOrigins({ WEB_ORIGINS: `https://ok.example,${origin}` })).toThrow(
        `WEB_ORIGINS has "${origin}"`,
      );
    },
  );
});
