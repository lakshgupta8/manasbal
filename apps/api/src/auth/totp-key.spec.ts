import { requireTotpKey, totpKey } from "./totp-key.js";

const GOOD = Buffer.alloc(32, 7).toString("base64");
const SHORT = Buffer.alloc(16, 7).toString("base64");

describe("totpKey", () => {
  it("decodes a 32-byte base64 key", () => {
    expect(totpKey({ TOTP_KEY: GOOD })).toEqual(Buffer.alloc(32, 7));
  });

  it("refuses a missing key and a key of the wrong size", () => {
    expect(() => totpKey({})).toThrow("TOTP_KEY is not set");
    expect(() => totpKey({ TOTP_KEY: SHORT })).toThrow("TOTP_KEY must be 32 random bytes");
  });

  it("reads process.env by default", () => {
    expect(totpKey()).toHaveLength(32);
  });
});

describe("requireTotpKey", () => {
  it("stops production from starting without a usable key", () => {
    expect(() => requireTotpKey({ NODE_ENV: "production" })).toThrow("TOTP_KEY is not set");
    expect(() => requireTotpKey({ NODE_ENV: "production", TOTP_KEY: SHORT })).toThrow(
      "TOTP_KEY must be 32 random bytes",
    );
    expect(() => requireTotpKey({ NODE_ENV: "production", TOTP_KEY: GOOD })).not.toThrow();
  });

  it("lets development start without a key, but not with a broken one", () => {
    expect(() => requireTotpKey({ NODE_ENV: "development" })).not.toThrow();
    expect(() => requireTotpKey({ NODE_ENV: "development", TOTP_KEY: SHORT })).toThrow();
  });

  it("reads process.env by default", () => {
    expect(() => requireTotpKey()).not.toThrow();
  });
});
