import { requireJwtSecret } from "./jwt-secret.js";

describe("requireJwtSecret", () => {
  it("stops production from starting without JWT_SECRET", () => {
    expect(() => requireJwtSecret({ NODE_ENV: "production" })).toThrow(
      "JWT_SECRET is not set. Add it in Render → manasbal-api → Environment.",
    );
    expect(() => requireJwtSecret({ NODE_ENV: "production", JWT_SECRET: "" })).toThrow(
      "JWT_SECRET is not set",
    );
  });

  it("lets production start with JWT_SECRET", () => {
    expect(() => requireJwtSecret({ NODE_ENV: "production", JWT_SECRET: "set" })).not.toThrow();
  });

  it("lets development start without it", () => {
    expect(() => requireJwtSecret({ NODE_ENV: "development" })).not.toThrow();
  });

  it("reads process.env by default", () => {
    expect(() => requireJwtSecret()).not.toThrow();
  });
});
